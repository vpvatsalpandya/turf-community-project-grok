import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { addDaysISO, localDateISO } from "@/lib/turf/time";
import { nid } from "@/lib/utils";
import { ensureMembership } from "./membership";
import { ready } from "./ready";

async function requireAdmin(userId: string) {
  const sql = await ready();
  const m = await ensureMembership(sql, userId);
  if (!m.isPlatformAdmin) throw new Error("Platform admin only.");
  return { sql, membership: m };
}

export const adminOverview = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql } = await requireAdmin(context.userId);
    const orgs = await sql<Record<string, unknown>>`
      select o.id, o.legal_name, o.status, o.created_at,
             s.status as sub_status, s.trial_ends_on, s.next_invoice_on, s.referred,
             (select count(*) from venue v where v.org_id = o.id)::int as venues
        from org o
        left join subscription s on s.org_id = o.id
       order by o.created_at desc`;
    const invoices = await sql<Record<string, unknown>>`
      select i.*, o.legal_name from invoice i join org o on o.id = i.org_id
       order by i.period_start desc limit 40`;
    const referrals = await sql<Record<string, unknown>>`
      select r.*, c.referrer_name, c.referrer_phone, c.referrer_upi, o.legal_name
        from referral r
        join referral_code c on c.code = r.code
        join org o on o.id = r.referred_org_id
       order by r.qualified_at desc nulls last`;
    const codes = await sql`select * from referral_code order by created_at desc`;
    return {
      orgs: orgs.map((o) => ({
        id: String(o.id),
        name: String(o.legal_name),
        status: String(o.status),
        subStatus: o.sub_status ? String(o.sub_status) : null,
        trialEndsOn: o.trial_ends_on ? String(o.trial_ends_on).slice(0, 10) : null,
        nextInvoiceOn: o.next_invoice_on ? String(o.next_invoice_on).slice(0, 10) : null,
        referred: Boolean(o.referred),
        venues: Number(o.venues),
      })),
      invoices: invoices.map((i) => ({
        id: String(i.id),
        orgId: String(i.org_id),
        orgName: String(i.legal_name),
        periodStart: String(i.period_start).slice(0, 10),
        periodEnd: String(i.period_end).slice(0, 10),
        amountDuePaise: Number(i.amount_due_paise),
        status: String(i.status),
        paymentRef: i.payment_ref ? String(i.payment_ref) : null,
      })),
      referrals: referrals.map((r) => ({
        id: String(r.id),
        code: String(r.code),
        orgName: String(r.legal_name),
        status: String(r.status),
        payoutPaise: Number(r.payout_paise),
        referrerName: String(r.referrer_name),
        referrerUpi: r.referrer_upi ? String(r.referrer_upi) : null,
        flaggedReason: r.flagged_reason ? String(r.flagged_reason) : null,
      })),
      codes: codes.map((c) => ({
        code: String(c.code),
        name: String(c.referrer_name),
        phone: String(c.referrer_phone),
        upi: c.referrer_upi ? String(c.referrer_upi) : null,
        active: Boolean(c.active),
      })),
    };
  });

export const generateInvoices = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { sql, membership } = await requireAdmin(context.userId);
    const today = localDateISO();
    const subs = await sql<{
      org_id: string;
      base_paise: number;
      included_venues: number;
      extra_venue_paise: number;
      next_invoice_on: string | null;
    }>`
      select org_id, base_paise, included_venues, extra_venue_paise, next_invoice_on::text
        from subscription
       where next_invoice_on is not null and next_invoice_on <= ${today}::date`;
    let made = 0;
    for (const s of subs) {
      const exists = await sql`select 1 from invoice where org_id = ${s.org_id} and period_start = ${s.next_invoice_on}::date`;
      if (exists.length) continue;
      const venues = await sql<{ n: number }>`select count(*)::int as n from venue where org_id = ${s.org_id}`;
      const extra = Math.max(0, Number(venues[0]?.n ?? 0) - Number(s.included_venues));
      const discounts = await sql<{ type: string; value: string }>`
        select type, value::text from subscription_discount
         where org_id = ${s.org_id}
           and applies_from <= ${s.next_invoice_on}::date
           and (applies_until is null or applies_until >= ${s.next_invoice_on}::date)`;
      const extraPaise = extra * Number(s.extra_venue_paise);
      let amount = Number(s.base_paise) + extraPaise;
      let discountPaise = 0;
      for (const d of discounts) {
        if (d.type === "percent") discountPaise += Math.floor((amount * Number(d.value)) / 100);
        else discountPaise += Number(d.value);
      }
      amount = Math.max(0, amount - discountPaise);
      const periodEnd = addDaysISO(String(s.next_invoice_on).slice(0, 10), 30);
      await sql`
        insert into invoice (
          id, org_id, period_start, period_end, base_paise, extra_venue_count, extra_venue_paise,
          discount_paise, discount_snapshot, amount_due_paise, status
        ) values (
          ${nid("inv")}, ${s.org_id}, ${s.next_invoice_on}::date, ${periodEnd}::date,
          ${s.base_paise}, ${extra}, ${extraPaise}, ${discountPaise},
          ${JSON.stringify(discounts)}::jsonb, ${amount}, 'due'
        )`;
      await sql`
        update subscription
           set current_period_start = ${s.next_invoice_on}::date,
               current_period_end = ${periodEnd}::date,
               next_invoice_on = ${periodEnd}::date
         where org_id = ${s.org_id}`;
      made += 1;
    }
    void membership;
    return { made };
  });

export const markInvoicePaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { invoiceId: string; paymentRef: string; via?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await requireAdmin(context.userId);
    const inv = await sql<{ org_id: string }>`
      update invoice set
        status = 'paid', paid_via = ${data.via ?? "upi"}, payment_ref = ${data.paymentRef},
        marked_paid_by = ${membership.appUserId}, paid_at = now()
      where id = ${data.invoiceId}
      returning org_id`;
    if (!inv[0]) throw new Error("Invoice not found");
    await sql`update org set status = 'active' where id = ${inv[0].org_id}`;
    await sql`update subscription set status = 'active' where org_id = ${inv[0].org_id}`;
    const ref = await sql<{ id: string; status: string }>`
      select id, status from referral where referred_org_id = ${inv[0].org_id} limit 1`;
    if (ref[0] && ref[0].status === "signed_up") {
      await sql`
        update referral set status = 'qualified', qualified_at = now() where id = ${ref[0].id}`;
    }
    return { ok: true };
  });

export const applyOrgDiscount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: { orgId: string; type: "percent" | "flat"; value: number; reason: string; until?: string | null }) =>
      input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership } = await requireAdmin(context.userId);
    await sql`
      insert into subscription_discount (id, org_id, type, value, reason, applies_from, applies_until, created_by)
      values (${nid("sd")}, ${data.orgId}, ${data.type}, ${data.value}, ${data.reason}, current_date, ${data.until ?? null}::date, ${membership.appUserId})`;
    return { ok: true };
  });

export const markReferralPaid = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { referralId: string; payoutRef: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql } = await requireAdmin(context.userId);
    await sql`
      update referral set status = 'paid', payout_ref = ${data.payoutRef}, paid_at = now()
       where id = ${data.referralId} and status in ('qualified','payout_due')`;
    return { ok: true };
  });

export const saveReferralCode = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { code: string; name: string; phone: string; upi?: string }) => input)
  .handler(async ({ context, data }) => {
    await requireAdmin(context.userId);
    const sql = await ready();
    await sql`
      insert into referral_code (code, referrer_name, referrer_phone, referrer_upi)
      values (${data.code.trim().toUpperCase()}, ${data.name}, ${data.phone}, ${data.upi ?? null})
      on conflict (code) do update set referrer_name = excluded.referrer_name, referrer_upi = excluded.referrer_upi, active = true`;
    return { ok: true };
  });

export const overrideTrial = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { orgId: string; trialEndsOn: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql } = await requireAdmin(context.userId);
    await sql`
      update subscription
         set trial_ends_on = ${data.trialEndsOn}::date,
             status = 'trialing'
       where org_id = ${data.orgId}`;
    await sql`update org set status = 'trialing' where id = ${data.orgId}`;
    return { ok: true };
  });

export const waiveInvoice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { invoiceId: string; reason?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership } = await requireAdmin(context.userId);
    const inv = await sql<{ org_id: string }>`
      update invoice
         set status = 'waived',
             payment_ref = ${data.reason ?? "waived"},
             marked_paid_by = ${membership.appUserId},
             paid_at = now()
       where id = ${data.invoiceId} and status in ('due','overdue')
       returning org_id`;
    if (!inv[0]) throw new Error("Invoice not found or already settled.");
    return { ok: true };
  });

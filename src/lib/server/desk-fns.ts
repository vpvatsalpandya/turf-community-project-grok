import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { formatInr } from "@/lib/turf/money";
import type { BookingRow, WaitlistRow } from "@/lib/turf/types";
import { localDateISO, refCode } from "@/lib/turf/time";
import { nid } from "@/lib/utils";
import { POLICY_DEFAULT } from "@/lib/turf/types";
import type { TemplateKind } from "@/lib/turf/messages";
import {
  assertVenueAccess,
  canExport,
  ensureMembership,
  homeVenueId,
} from "./membership";
import { BOOKING_SELECT, mapBooking, mapResource, mapVenue, normalizePhone, asDate, asIso } from "./map";
import { findIdentityByPhone, canonicalIdentityId } from "./identity";
import { ready } from "./ready";
import { renderBookingMessage, renderWaitlistMessage } from "./templates";

function mapWaitlist(r: Record<string, unknown>): WaitlistRow {
  return {
    id: String(r.id),
    venueId: String(r.venue_id),
    resourceId: String(r.resource_id),
    resourceName: String(r.resource_name ?? ""),
    identityId: r.identity_id ? String(r.identity_id) : null,
    name: String(r.name),
    phone: String(r.phone_e164),
    localDate: asDate(r.local_date),
    periodStart: asIso(r.period_start),
    periodEnd: asIso(r.period_end),
    status: r.status as WaitlistRow["status"],
    notes: r.notes ? String(r.notes) : null,
    createdAt: asIso(r.created_at),
  };
}

async function contextVenue(
  userId: string,
  venueId?: string | null,
) {
  const sql = await ready();
  const membership = await ensureMembership(sql, userId);
  const vid = venueId || (await homeVenueId(sql, membership));
  await assertVenueAccess(sql, membership, vid);
  return { sql, membership, venueId: vid };
}

export const getDeskContext = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const list = membership.isPlatformAdmin
      ? await sql<Record<string, unknown>>`select * from venue order by name`
      : await sql<Record<string, unknown>>`select * from venue where org_id = ${membership.orgId} order by name`;
    const venueId = membership.venueId ?? list[0]?.id;
    const venue = list.find((v) => String(v.id) === venueId) ?? list[0];
    const sub = await sql<{
      status: string;
      trial_ends_on: string | null;
      next_invoice_on: string | null;
    }>`
      select status, trial_ends_on::text, next_invoice_on::text
        from subscription where org_id = ${membership.orgId} limit 1`;
    const requestCount = venue
      ? await sql<{ n: number }>`
          select count(*)::int as n from booking
           where venue_id = ${String(venue.id)} and state = 'requested'`
      : [{ n: 0 }];
    const noshowCount = venue
      ? await sql<{ n: number }>`
          select count(*)::int as n from noshow_flag f
           join booking b on b.id = f.booking_id
           where b.venue_id = ${String(venue.id)} and f.reviewed_at is null and f.dismissed = false`
      : [{ n: 0 }];
    const waitlistCount = venue
      ? await sql<{ n: number }>`
          select count(*)::int as n from waitlist
           where venue_id = ${String(venue.id)} and status = 'waiting'`
      : [{ n: 0 }];
    return {
      membership,
      venues: list.map(mapVenue),
      venue: venue ? mapVenue(venue) : null,
      subscription: sub[0] ?? null,
      requestCount: Number(requestCount[0]?.n ?? 0),
      noshowCount: Number(noshowCount[0]?.n ?? 0),
      waitlistCount: Number(waitlistCount[0]?.n ?? 0),
    };
  });

export const listDayBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; date: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const resources = (
      await sql<Record<string, unknown>>`
        select * from resource where venue_id = ${venueId} and status = 'active' order by sort_order, name`
    ).map(mapResource);
    const bookings = await sql.query<Record<string, unknown>>(
      `select ${BOOKING_SELECT}
         from booking b
         join resource r on r.id = b.resource_id
         left join customer_profile p on p.id = b.profile_id
         left join customer_identity i on i.id = b.identity_id
        where b.venue_id = $1 and b.local_date = $2::date
          and b.state not in ('declined','lapsed')
        order by b.period_start, r.sort_order`,
      [venueId, data.date],
    );
    const blackouts = await sql<{
      id: string;
      resource_id: string;
      period_start: string;
      period_end: string;
      reason: string;
    }>`
      select id, resource_id, period_start, period_end, reason from blackout
       where resource_id in (select id from resource where venue_id = ${venueId})
         and period_start::date <= ${data.date}::date
         and period_end::date >= ${data.date}::date`;
    const flags = await sql<{ booking_id: string }>`
      select f.booking_id from noshow_flag f
       join booking b on b.id = f.booking_id
      where b.venue_id = ${venueId} and f.reviewed_at is null and dismissed = false`;
    const waiters = await sql<Record<string, unknown>>`
      select w.id, w.venue_id, w.resource_id, w.identity_id, w.name, w.phone_e164,
             w.local_date, w.period_start, w.period_end, w.status, w.notes, w.created_at,
             r.name as resource_name
        from waitlist w
        join resource r on r.id = w.resource_id
       where w.venue_id = ${venueId}
         and w.local_date = ${data.date}::date
         and w.status = 'waiting'
       order by w.created_at`;
    const creditByProfile = await loyaltyCredits(sql, venueId);
    return {
      resources,
      bookings: bookings.map((b) =>
        mapBooking(b, b.profile_id ? creditByProfile[String(b.profile_id)] ?? 0 : 0),
      ),
      blackouts: blackouts.map((b) => ({
        id: b.id,
        resourceId: b.resource_id,
        start: String(b.period_start),
        end: String(b.period_end),
        reason: b.reason,
      })),
      noshowIds: flags.map((f) => f.booking_id),
      waitlist: waiters.map(mapWaitlist),
    };
  });

export const listNoshowCandidates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${BOOKING_SELECT}
         from noshow_flag f
         join booking b on b.id = f.booking_id
         join resource r on r.id = b.resource_id
         left join customer_profile p on p.id = b.profile_id
         left join customer_identity i on i.id = b.identity_id
        where b.venue_id = $1 and f.reviewed_at is null and f.dismissed = false
          and b.state = 'confirmed'
        order by b.period_start`,
      [venueId],
    );
    return rows.map((b) => mapBooking(b));
  });

export const dismissNoshowFlag = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const b = await sql<{ venue_id: string }>`select venue_id from booking where id = ${data.bookingId}`;
    if (!b[0]) throw new Error("Not found");
    await assertVenueAccess(sql, membership, b[0].venue_id);
    await sql`
      update noshow_flag
         set dismissed = true, reviewed_at = now()
       where booking_id = ${data.bookingId}`;
    return { ok: true };
  });

async function loyaltyCredits(sql: Awaited<ReturnType<typeof ready>>, venueId: string) {
  const rows = await sql<{ profile_id: string; paise: number }>`
    select l.profile_id,
           coalesce(sum(case when pr.type = 'spend_threshold' then l.delta else 0 end), 0)::int as paise
      from loyalty_ledger l
      join loyalty_program pr on pr.id = l.program_id
     where pr.venue_id = ${venueId}
     group by l.profile_id`;
  // Visit stamp: 9 stamps → ₹1500 credit available
  const stamps = await sql<{ profile_id: string; bal: number; reward: number }>`
    select distinct on (l.profile_id) l.profile_id,
           (select coalesce(sum(delta),0) from loyalty_ledger x where x.profile_id = l.profile_id and x.program_id = pr.id)::int as bal,
           coalesce((pr.config->>'rewardPaise')::int, 0) as reward
      from loyalty_ledger l
      join loyalty_program pr on pr.id = l.program_id
     where pr.venue_id = ${venueId} and pr.type = 'visit_stamp'`;
  const map: Record<string, number> = {};
  for (const r of rows) map[r.profile_id] = Number(r.paise);
  for (const s of stamps) {
    const need = 9;
    if (Number(s.bal) >= need) map[s.profile_id] = (map[s.profile_id] ?? 0) + Number(s.reward);
  }
  return map;
}

export const listOpenRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const rows = await sql.query<Record<string, unknown>>(
      `select ${BOOKING_SELECT}
         from booking b
         join resource r on r.id = b.resource_id
         left join customer_profile p on p.id = b.profile_id
         left join customer_identity i on i.id = b.identity_id
        where b.venue_id = $1 and b.state = 'requested'
        order by b.period_start, b.created_at`,
      [venueId],
    );
    const credits = await loyaltyCredits(sql, venueId);
    const bookings = rows.map((b) =>
      mapBooking(b, b.profile_id ? credits[String(b.profile_id)] ?? 0 : 0),
    );
    const groups: Record<string, BookingRow[]> = {};
    for (const b of bookings) {
      const key = `${b.resourceId}|${b.periodStart}`;
      (groups[key] ??= []).push(b);
    }
    return {
      groups: Object.values(groups).map((items) => ({
        resourceId: items[0]!.resourceId,
        resourceName: items[0]!.resourceName,
        start: items[0]!.periodStart,
        end: items[0]!.periodEnd,
        localDate: items[0]!.localDate,
        items,
      })),
      total: bookings.length,
    };
  });

export const acceptRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      bookingId: string;
      amountCollectedPaise?: number;
      paymentMode?: string;
      paymentNote?: string;
      applyLoyalty?: boolean;
      language?: "en" | "hi";
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const b = await sql<{ venue_id: string; profile_id: string | null; amount_due_paise: number }>`
      select venue_id, profile_id, amount_due_paise from booking where id = ${data.bookingId} limit 1`;
    if (!b[0]) throw new Error("Request not found");
    await assertVenueAccess(sql, membership, b[0].venue_id);

    if (data.applyLoyalty && b[0].profile_id) {
      const credits = await loyaltyCredits(sql, b[0].venue_id);
      const credit = credits[b[0].profile_id] ?? 0;
      if (credit > 0) {
        const apply = Math.min(credit, Number(b[0].amount_due_paise));
        await sql`
          update booking
             set loyalty_redeemed_paise = ${apply},
                 amount_due_paise = amount_due_paise - ${apply}
           where id = ${data.bookingId}`;
        const prog = await sql<{ id: string }>`
          select id from loyalty_program where venue_id = ${b[0].venue_id} and type = 'visit_stamp' limit 1`;
        if (prog[0]) {
          await sql`
            insert into loyalty_ledger (profile_id, program_id, booking_id, delta, balance_after, kind)
            values (${b[0].profile_id}, ${prog[0].id}, ${data.bookingId}, ${-9}, 0, 'redeem')`;
        }
      }
    }

    const result = await sql<{ ok: boolean; error: string | null; booking_id: string | null }>`
      select * from turf_accept_booking(
        ${data.bookingId}, ${membership.appUserId}, ${membership.role},
        ${data.amountCollectedPaise ?? null}, ${data.paymentMode ?? "upi_offline"}, ${data.paymentNote ?? null}
      )`;
    const row = result[0];
    if (!row?.ok) {
      throw new Error(
        row?.error === "SLOT_UNAVAILABLE"
          ? "Slot already taken — this request was declined."
          : row?.error ?? "Could not accept",
      );
    }
    const msg = await renderBookingMessage(sql, data.bookingId, "request_confirmed", data.language ?? "hi");
    return { ok: true, message: msg.body, bookingId: data.bookingId };
  });

export const declineRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; reason?: string; language?: "en" | "hi" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const b = await sql<{ venue_id: string }>`select venue_id from booking where id = ${data.bookingId}`;
    if (!b[0]) throw new Error("Not found");
    await assertVenueAccess(sql, membership, b[0].venue_id);
    const result = await sql<{ ok: boolean; error: string | null }>`
      select * from turf_transition(${data.bookingId}, 'declined', ${membership.appUserId}, ${membership.role}, ${data.reason ?? "declined"})`;
    if (!result[0]?.ok) throw new Error(result[0]?.error ?? "Could not decline");
    const msg = await renderBookingMessage(sql, data.bookingId, "request_declined", data.language ?? "hi");
    return { ok: true, message: msg.body };
  });

export const transitionBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; to: "checked_in" | "completed" | "no_show" | "cancelled"; reason?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const b = await sql<{ venue_id: string; identity_id: string | null; state: string; profile_id: string | null; amount_collected_paise: number }>`
      select venue_id, identity_id, state, profile_id, amount_collected_paise from booking where id = ${data.bookingId}`;
    if (!b[0]) throw new Error("Not found");
    await assertVenueAccess(sql, membership, b[0].venue_id);
    if (data.to === "no_show" && membership.role === "staff" === false && false) {
      /* staff-marked only — all desk roles may mark */
    }
    const result = await sql<{ ok: boolean; error: string | null }>`
      select * from turf_transition(${data.bookingId}, ${data.to}, ${membership.appUserId}, ${membership.role}, ${data.reason ?? data.to})`;
    if (!result[0]?.ok) throw new Error(result[0]?.error ?? "Invalid transition");
    if (data.to === "no_show" && b[0].identity_id) {
      await sql`update customer_identity set lifetime_no_shows = lifetime_no_shows + 1 where id = ${b[0].identity_id}`;
      await sql`update noshow_flag set reviewed_at = now() where booking_id = ${data.bookingId}`;
    }
    if (data.to === "completed" && b[0].identity_id) {
      await sql`
        update customer_identity
           set lifetime_bookings = lifetime_bookings + 1
         where id = ${b[0].identity_id}`;
      if (b[0].profile_id) {
        await sql`
          update customer_profile
             set total_bookings = total_bookings + 1,
                 total_spend_paise = total_spend_paise + ${Number(b[0].amount_collected_paise)},
                 last_booked_at = now()
           where id = ${b[0].profile_id}`;
        await accrueLoyalty(sql, b[0].venue_id, b[0].profile_id, data.bookingId, Number(b[0].amount_collected_paise));
      }
    }
    if (data.to === "cancelled" && b[0].identity_id && data.reason === "late") {
      await sql`update customer_identity set lifetime_late_cancels = lifetime_late_cancels + 1 where id = ${b[0].identity_id}`;
    }
    let message: string | null = null;
    let waiters: WaitlistRow[] = [];
    if (data.to === "cancelled") {
      message = (await renderBookingMessage(sql, data.bookingId, "cancellation", "hi")).body;
      const slot = await sql<{
        venue_id: string;
        resource_id: string;
        period_start: string;
        period_end: string;
      }>`
        select venue_id, resource_id, period_start, period_end
          from booking where id = ${data.bookingId}`;
      if (slot[0]) {
        const rows = await sql<Record<string, unknown>>`
          select w.id, w.venue_id, w.resource_id, w.identity_id, w.name, w.phone_e164,
                 w.local_date, w.period_start, w.period_end, w.status, w.notes, w.created_at,
                 r.name as resource_name
            from waitlist w
            join resource r on r.id = w.resource_id
           where w.venue_id = ${slot[0].venue_id}
             and w.resource_id = ${slot[0].resource_id}
             and w.status = 'waiting'
             and w.period_start < ${slot[0].period_end}::timestamptz
             and w.period_end > ${slot[0].period_start}::timestamptz
           order by w.created_at`;
        waiters = rows.map(mapWaitlist);
      }
    }
    return { ok: true, message, waiters };
  });

async function accrueLoyalty(
  sql: Awaited<ReturnType<typeof ready>>,
  venueId: string,
  profileId: string,
  bookingId: string,
  collectedPaise: number,
) {
  const programs = await sql<{ id: string; type: string; config: unknown }>`
    select id, type, config from loyalty_program where venue_id = ${venueId} and status = 'active'`;
  for (const p of programs) {
    const cfg = (typeof p.config === "string" ? JSON.parse(p.config) : p.config) as Record<string, unknown>;
    const balRow = await sql<{ s: number }>`
      select coalesce(sum(delta),0)::int as s from loyalty_ledger where profile_id = ${profileId} and program_id = ${p.id}`;
    const bal = Number(balRow[0]?.s ?? 0);
    if (p.type === "visit_stamp") {
      const next = bal + 1;
      await sql`
        insert into loyalty_ledger (profile_id, program_id, booking_id, delta, balance_after, kind)
        values (${profileId}, ${p.id}, ${bookingId}, 1, ${next}, 'earn')`;
    } else if (p.type === "points") {
      const per = Number(cfg.pointsPerRupee ?? 0.1);
      const pts = Math.floor((collectedPaise / 100) * per);
      if (pts > 0) {
        await sql`
          insert into loyalty_ledger (profile_id, program_id, booking_id, delta, balance_after, kind)
          values (${profileId}, ${p.id}, ${bookingId}, ${pts}, ${bal + pts}, 'earn')`;
      }
    }
  }
}

export const lookupCustomer = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; phone: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    let phone: string;
    try {
      phone = normalizePhone(data.phone);
    } catch {
      return null;
    }
    const identityId = await findIdentityByPhone(sql, phone);
    if (!identityId) return { phone, identity: null };
    const rows = await sql<Record<string, unknown>>`
      select i.id as identity_id, i.phone_e164, i.display_name,
             i.lifetime_bookings, i.lifetime_no_shows, i.lifetime_late_cancels,
             p.id as profile_id, p.name_at_venue, p.notes, p.total_bookings, p.total_spend_paise
        from customer_identity i
        left join customer_profile p on p.identity_id = i.id and p.venue_id = ${venueId}
       where i.id = ${identityId}
       limit 1`;
    if (!rows[0]) return { phone, identity: null };
    const r = rows[0];
    const credits = await loyaltyCredits(sql, venueId);
    return {
      phone,
      identity: {
        identityId: String(r.identity_id),
        profileId: r.profile_id ? String(r.profile_id) : null,
        name: String(r.name_at_venue ?? r.display_name ?? ""),
        notes: r.notes ? String(r.notes) : "",
        totalBookings: Number(r.total_bookings ?? 0),
        totalSpendPaise: Number(r.total_spend_paise ?? 0),
        loyaltyCreditPaise: r.profile_id ? credits[String(r.profile_id)] ?? 0 : 0,
      },
    };
  });

export const quickCreateBooking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId?: string;
      resourceId: string;
      startISO: string;
      endISO: string;
      name: string;
      phone: string;
      amountDuePaise: number;
      amountCollectedPaise: number;
      paymentMode: string;
      paymentNote?: string;
      channel?: "staff" | "phone" | "walkin";
      applyLoyalty?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await contextVenue(context.userId, data.venueId);
    if (membership.orgStatus === "read_only" || membership.orgStatus === "cancelled") {
      throw new Error("Account is read-only until the invoice is marked paid.");
    }
    const phone = normalizePhone(data.phone);
    const foundId = await findIdentityByPhone(sql, phone);
    const identityId = foundId ?? nid("cid");
    if (!foundId) {
      await sql`
        insert into customer_identity (id, phone_e164, phone_verified, display_name)
        values (${identityId}, ${phone}, true, ${data.name.trim()})`;
    }
    const profRows = await sql<{ id: string }>`
      select id from customer_profile where identity_id = ${identityId} and venue_id = ${venueId} limit 1`;
    const profileId = profRows[0]?.id ?? nid("prf");
    if (!profRows[0]) {
      await sql`
        insert into customer_profile (id, identity_id, venue_id, name_at_venue, first_booked_at)
        values (${profileId}, ${identityId}, ${venueId}, ${data.name.trim()}, now())`;
    }
    const venue = await sql<{ slug: string; timezone: string }>`select slug, timezone from venue where id = ${venueId}`;
    const res = await sql<{ buffer_minutes: number }>`select buffer_minutes from resource where id = ${data.resourceId}`;
    if (!res[0]) throw new Error("Pitch not found");
    const start = new Date(data.startISO);
    const end = new Date(data.endISO);
    const blockedEnd = new Date(end.getTime() + Number(res[0].buffer_minutes) * 60000);
    const localDate = localDateISO(start, venue[0]?.timezone ?? "Asia/Kolkata");
    let due = data.amountDuePaise;
    let loyalty = 0;
    if (data.applyLoyalty) {
      const credits = await loyaltyCredits(sql, venueId);
      const credit = credits[profileId] ?? 0;
      loyalty = Math.min(credit, due);
      due -= loyalty;
    }
    const prefix = (venue[0]?.slug ?? "tc").slice(0, 3).toUpperCase();
    const id = nid("bk");
    const result = await sql<{ ok: boolean; error: string | null; booking_id: string | null }>`
      select * from turf_create_booking(
        ${id}, ${refCode(prefix)}, ${venueId}, ${data.resourceId}, ${identityId}, ${profileId},
        ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz,
        ${start.toISOString()}::timestamptz, ${blockedEnd.toISOString()}::timestamptz,
        ${localDate}::date, 'confirmed', ${data.channel ?? "staff"},
        ${data.amountDuePaise + loyalty}, 0, ${loyalty}, ${due}, ${data.amountCollectedPaise},
        ${data.paymentMode}, ${data.paymentNote ?? null}, null,
        ${JSON.stringify(POLICY_DEFAULT)}::jsonb, null, ${membership.appUserId}, ${nid("cr")}
      )`;
    if (!result[0]?.ok) {
      throw new Error(result[0]?.error === "SLOT_UNAVAILABLE" ? "That slot is already confirmed." : result[0]?.error ?? "Failed");
    }
    if (loyalty > 0) {
      const prog = await sql<{ id: string }>`
        select id from loyalty_program where venue_id = ${venueId} and type = 'visit_stamp' limit 1`;
      if (prog[0]) {
        await sql`
          insert into loyalty_ledger (profile_id, program_id, booking_id, delta, balance_after, kind)
          values (${profileId}, ${prog[0].id}, ${id}, ${-9}, 0, 'redeem')`;
      }
    }
    const msg = await renderBookingMessage(sql, id, "request_confirmed", "hi");
    return { ok: true, bookingId: id, message: msg.body, amountDuePaise: due };
  });

export const blockSlot = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; resourceId: string; startISO: string; endISO: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await contextVenue(context.userId, data.venueId);
    const res = await sql`select 1 from resource where id = ${data.resourceId} and venue_id = ${venueId}`;
    if (!res.length) throw new Error("Pitch not found");
    const id = nid("blk");
    await sql`
      insert into blackout (id, resource_id, period_start, period_end, reason, created_by)
      values (${id}, ${data.resourceId}, ${data.startISO}::timestamptz, ${data.endISO}::timestamptz, ${data.reason}, ${membership.appUserId})`;
    return { ok: true, id };
  });

export const listWaitlist = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; date?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const rows = data.date
      ? await sql<Record<string, unknown>>`
          select w.id, w.venue_id, w.resource_id, w.identity_id, w.name, w.phone_e164,
                 w.local_date, w.period_start, w.period_end, w.status, w.notes, w.created_at,
                 r.name as resource_name
            from waitlist w
            join resource r on r.id = w.resource_id
           where w.venue_id = ${venueId}
             and w.local_date = ${data.date}::date
             and w.status in ('waiting','notified')
           order by w.period_start, w.created_at`
      : await sql<Record<string, unknown>>`
          select w.id, w.venue_id, w.resource_id, w.identity_id, w.name, w.phone_e164,
                 w.local_date, w.period_start, w.period_end, w.status, w.notes, w.created_at,
                 r.name as resource_name
            from waitlist w
            join resource r on r.id = w.resource_id
           where w.venue_id = ${venueId}
             and w.status in ('waiting','notified')
             and w.local_date >= current_date
           order by w.period_start, w.created_at
           limit 80`;
    return rows.map(mapWaitlist);
  });

export const addWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId?: string;
      resourceId: string;
      startISO: string;
      endISO: string;
      name: string;
      phone: string;
      notes?: string;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await contextVenue(context.userId, data.venueId);
    if (membership.orgStatus === "read_only" || membership.orgStatus === "cancelled") {
      throw new Error("Account is read-only until the invoice is marked paid.");
    }
    const res = await sql<{ id: string }>`
      select id from resource where id = ${data.resourceId} and venue_id = ${venueId}`;
    if (!res[0]) throw new Error("Pitch not found");
    const phone = normalizePhone(data.phone);
    const foundId = await findIdentityByPhone(sql, phone);
    const identityId = foundId ?? nid("cid");
    const name = data.name.trim() || "Waitlist";
    if (!foundId) {
      await sql`
        insert into customer_identity (id, phone_e164, phone_verified, display_name)
        values (${identityId}, ${phone}, true, ${name})`;
    }
    const profRows = await sql<{ id: string }>`
      select id from customer_profile where identity_id = ${identityId} and venue_id = ${venueId} limit 1`;
    const profileId = profRows[0]?.id ?? nid("prf");
    if (!profRows[0]) {
      await sql`
        insert into customer_profile (id, identity_id, venue_id, name_at_venue)
        values (${profileId}, ${identityId}, ${venueId}, ${name})`;
    }
    const venue = await sql<{ timezone: string }>`select timezone from venue where id = ${venueId}`;
    const start = new Date(data.startISO);
    const end = new Date(data.endISO);
    const localDate = localDateISO(start, venue[0]?.timezone ?? "Asia/Kolkata");
    const id = nid("wl");
    try {
      await sql`
        insert into waitlist (
          id, venue_id, resource_id, identity_id, profile_id, name, phone_e164,
          local_date, period_start, period_end, notes, created_by
        ) values (
          ${id}, ${venueId}, ${data.resourceId}, ${identityId}, ${profileId}, ${name}, ${phone},
          ${localDate}::date, ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz,
          ${data.notes ?? null}, ${membership.appUserId}
        )`;
    } catch {
      throw new Error("That number is already waiting for this slot.");
    }
    return { ok: true, id };
  });

export const notifyWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { waitlistId: string; language?: "en" | "hi" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const row = await sql<{ venue_id: string; status: string }>`
      select venue_id, status from waitlist where id = ${data.waitlistId}`;
    if (!row[0]) throw new Error("Not on the list");
    await assertVenueAccess(sql, membership, row[0].venue_id);
    if (row[0].status === "cancelled") throw new Error("Already taken off the list.");
    await sql`
      update waitlist
         set status = 'notified', notified_at = now()
       where id = ${data.waitlistId} and status in ('waiting','notified')`;
    const msg = await renderWaitlistMessage(sql, data.waitlistId, data.language ?? "hi");
    return { ok: true, message: msg.body };
  });

export const cancelWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { waitlistId: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const row = await sql<{ venue_id: string }>`
      select venue_id from waitlist where id = ${data.waitlistId}`;
    if (!row[0]) throw new Error("Not on the list");
    await assertVenueAccess(sql, membership, row[0].venue_id);
    await sql`
      update waitlist set status = 'cancelled' where id = ${data.waitlistId}`;
    return { ok: true };
  });

export const getShareMessage = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { bookingId: string; kind: TemplateKind; language?: "en" | "hi" }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const b = await sql<{ venue_id: string }>`select venue_id from booking where id = ${data.bookingId}`;
    if (!b[0]) throw new Error("Not found");
    await assertVenueAccess(sql, membership, b[0].venue_id);
    return renderBookingMessage(sql, data.bookingId, data.kind, data.language ?? "hi");
  });

export const lookupPrice = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; resourceId: string; startISO: string; endISO: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const v = await sql<{ slug: string; timezone: string }>`select slug, timezone from venue where id = ${venueId}`;
    const date = localDateISO(new Date(data.startISO), v[0]?.timezone ?? "Asia/Kolkata");
    const { getAvailability } = await import("./public-fns");
    const avail = await getAvailability({ data: { slug: v[0]!.slug, date } });
    const match = avail.slots.find(
      (s) => s.resourceId === data.resourceId && s.startISO === new Date(data.startISO).toISOString(),
    );
    return { pricePaise: match?.pricePaise ?? 0, label: match?.priceLabel ?? null, formatted: formatInr(match?.pricePaise ?? 0) };
  });

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; q?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await contextVenue(context.userId, data.venueId);
    const q = `%${(data.q ?? "").trim()}%`;
    const rows = await sql<Record<string, unknown>>`
      select p.id, p.identity_id, p.name_at_venue, p.notes, p.total_bookings, p.total_spend_paise,
             p.last_booked_at, i.phone_e164
        from customer_profile p
        join customer_identity i on i.id = p.identity_id
       where p.venue_id = ${venueId}
         and i.deleted_at is null
         and (${data.q ?? ""} = '' or p.name_at_venue ilike ${q} or i.phone_e164 ilike ${q})
       order by p.last_booked_at desc nulls last
       limit 80`;
    return rows.map((r) => ({
      id: String(r.id),
      identityId: String(r.identity_id),
      name: String(r.name_at_venue ?? ""),
      phone: String(r.phone_e164),
      notes: r.notes ? String(r.notes) : "",
      totalBookings: Number(r.total_bookings),
      totalSpendPaise: Number(r.total_spend_paise),
      lastBookedAt: r.last_booked_at ? String(r.last_booked_at) : null,
    }));
  });

export const exportCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await contextVenue(context.userId, data.venueId);
    if (membership.role !== "owner" && !membership.isPlatformAdmin) throw new Error("Only the owner can export.");
    // Dedicated export path — never include reliability_score or lifetime_* 
    const rows = await sql<{
      name_at_venue: string | null;
      phone_e164: string;
      notes: string | null;
      total_bookings: number;
      total_spend_paise: number;
      last_booked_at: string | null;
    }>`
      select p.name_at_venue, i.phone_e164, p.notes, p.total_bookings, p.total_spend_paise, p.last_booked_at
        from customer_profile p
        join customer_identity i on i.id = p.identity_id
       where p.venue_id = ${venueId} and i.deleted_at is null
       order by p.name_at_venue`;
    await sql`
      insert into data_export_log (org_id, actor_id, kind, row_count)
      values (${membership.orgId}, ${membership.appUserId}, 'customers', ${rows.length})`;
    return {
      csv:
        "name,phone,notes,bookings,spend_inr,last_booked\n" +
        rows
          .map((r) =>
            [
              csv(r.name_at_venue),
              csv(r.phone_e164),
              csv(r.notes),
              r.total_bookings,
              (Number(r.total_spend_paise) / 100).toFixed(0),
              r.last_booked_at ? String(r.last_booked_at).slice(0, 10) : "",
            ].join(","),
          )
          .join("\n"),
      rowCount: rows.length,
    };
  });

export const mergeCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; keepIdentityId: string; absorbIdentityId: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await contextVenue(context.userId, data.venueId);
    if (!canExport(membership)) throw new Error("Only the owner can merge duplicates.");
    if (data.keepIdentityId === data.absorbIdentityId) throw new Error("Pick two different customers.");

    const keepId = await canonicalIdentityId(sql, data.keepIdentityId);
    const absorbId = await canonicalIdentityId(sql, data.absorbIdentityId);
    if (keepId === absorbId) throw new Error("Those are already the same person.");

    const allowed = await sql`
      select 1 from customer_profile
       where venue_id = ${venueId} and identity_id in (${keepId}, ${absorbId})`;
    if (allowed.length < 1) throw new Error("Both customers must belong to this turf.");

    const keepProf = await sql<{ id: string }>`
      select id from customer_profile where identity_id = ${keepId} and venue_id = ${venueId} limit 1`;
    const absorbProf = await sql<{ id: string }>`
      select id from customer_profile where identity_id = ${absorbId} and venue_id = ${venueId} limit 1`;
    const keepProfileId = keepProf[0]?.id ?? nid("prf");
    if (!keepProf[0]) {
      await sql`
        insert into customer_profile (id, identity_id, venue_id, name_at_venue, first_booked_at)
        values (${keepProfileId}, ${keepId}, ${venueId}, 'Customer', now())`;
    }

    const otherProfiles = await sql<{ id: string; venue_id: string }>`
      select id, venue_id from customer_profile where identity_id = ${absorbId}`;
    for (const p of otherProfiles) {
      const existing = await sql<{ id: string }>`
        select id from customer_profile where identity_id = ${keepId} and venue_id = ${p.venue_id} limit 1`;
      if (existing[0]) {
        await sql`
          update booking set profile_id = ${existing[0].id}, identity_id = ${keepId}
           where profile_id = ${p.id}`;
        await sql`
          update loyalty_ledger set profile_id = ${existing[0].id} where profile_id = ${p.id}`;
        await sql`
          update customer_profile k
             set total_bookings = k.total_bookings + a.total_bookings,
                 total_spend_paise = k.total_spend_paise + a.total_spend_paise,
                 notes = coalesce(k.notes, a.notes),
                 last_booked_at = greatest(k.last_booked_at, a.last_booked_at)
            from customer_profile a
           where k.id = ${existing[0].id} and a.id = ${p.id}`;
        await sql`delete from customer_profile where id = ${p.id}`;
      } else {
        await sql`update customer_profile set identity_id = ${keepId} where id = ${p.id}`;
      }
    }

    await sql`update booking set identity_id = ${keepId} where identity_id = ${absorbId}`;
    await sql`update waitlist set identity_id = ${keepId} where identity_id = ${absorbId}`;
    if (absorbProf[0] && absorbProf[0].id !== keepProfileId) {
      await sql`update booking set profile_id = ${keepProfileId} where profile_id = ${absorbProf[0].id}`;
      await sql`update waitlist set profile_id = ${keepProfileId} where profile_id = ${absorbProf[0].id}`;
    }

    await sql`
      update customer_identity k
         set lifetime_bookings = k.lifetime_bookings + a.lifetime_bookings,
             lifetime_no_shows = k.lifetime_no_shows + a.lifetime_no_shows,
             lifetime_late_cancels = k.lifetime_late_cancels + a.lifetime_late_cancels,
             display_name = coalesce(k.display_name, a.display_name),
             phone_verified = k.phone_verified or a.phone_verified
        from customer_identity a
       where k.id = ${keepId} and a.id = ${absorbId}`;
    await sql`
      update customer_identity
         set merged_into = ${keepId}, deleted_at = now()
       where id = ${absorbId}`;

    return { ok: true, keepId };
  });

function csv(v: string | null | undefined) {
  const s = v ?? "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

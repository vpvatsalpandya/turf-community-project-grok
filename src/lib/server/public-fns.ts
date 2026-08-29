import { createServerFn } from "@tanstack/react-start";
import { generateSlots } from "@/lib/turf/availability";
import { applyDiscount, formatInr } from "@/lib/turf/money";
import { POLICY_DEFAULT, type SlotOffer, type VenuePublic } from "@/lib/turf/types";
import { addDaysISO, durationLabel, formatTime, localDateISO, refCode } from "@/lib/turf/time";
import { nid } from "@/lib/utils";
import { BOOKING_SELECT, mapResource, mapVenue, normalizePhone } from "./map";
import { findIdentityByPhone } from "./identity";
import { ready } from "./ready";
import { renderBookingMessage } from "./templates";

export const getPublicVenue = createServerFn({ method: "GET" })
  .validator((slug: string) => slug)
  .handler(async ({ data: slug }) => {
    const sql = await ready();
    const rows = await sql<Record<string, unknown>>`
      select * from venue where slug = ${slug} and status = 'active' limit 1`;
    if (!rows[0]) return null;
    const venue = mapVenue(rows[0]);
    const resources = await sql<Record<string, unknown>>`
      select * from resource where venue_id = ${venue.id} and status = 'active' order by sort_order, name`;
    const bands = await sql<{ price_paise: number; label: string | null }>`
      select distinct price_paise, label from price_band
       where resource_id in (select id from resource where venue_id = ${venue.id})
       order by price_paise`;
    return {
      venue,
      resources: resources.map(mapResource),
      priceFromPaise: bands[0] ? Number(bands[0].price_paise) : 0,
      bands: bands.map((b) => ({
        paise: Number(b.price_paise),
        label: b.label,
        formatted: formatInr(Number(b.price_paise)),
      })),
    };
  });

export const getAvailability = createServerFn({ method: "GET" })
  .validator((input: { slug: string; date: string }) => input)
  .handler(async ({ data }) => {
    const sql = await ready();
    const vrows = await sql<Record<string, unknown>>`
      select * from venue where slug = ${data.slug} and status = 'active' limit 1`;
    if (!vrows[0]) return { slots: [] as SlotOffer[], venue: null as VenuePublic | null };
    const venue = mapVenue(vrows[0]);
    const resources = (
      await sql<Record<string, unknown>>`
        select * from resource where venue_id = ${venue.id} and status = 'active' and is_bookable = true
         order by sort_order, name`
    ).map(mapResource);

    const resIds = resources.map((r) => r.id);
    if (!resIds.length) return { slots: [], venue };

    const windows = await sql.query<{
      resource_id: string;
      day_of_week: number;
      opens_at: string;
      closes_minutes_from_midnight: number;
    }>(
      `select resource_id, day_of_week, opens_at::text, closes_minutes_from_midnight
         from operating_window where resource_id = any($1::text[])`,
      [resIds],
    );
    const bands = await sql.query<{
      resource_id: string;
      day_of_week: number | null;
      starts_at: string;
      ends_at: string;
      price_paise: number;
      label: string | null;
      priority: number;
    }>(
      `select resource_id, day_of_week, starts_at::text, ends_at::text, price_paise, label, priority
         from price_band where resource_id = any($1::text[])`,
      [resIds],
    );
    const overrides = await sql<{
      venue_id: string | null;
      resource_id: string | null;
      on_date: string;
      is_closed: boolean;
      opens_at: string | null;
      closes_at: string | null;
      price_multiplier: string | number | null;
    }>`
      select venue_id, resource_id, on_date::text, is_closed, opens_at::text, closes_at::text, price_multiplier
        from date_override
       where on_date = ${data.date}::date
         and (venue_id = ${venue.id} or resource_id = any(${resIds}::text[]))`;

    const trees = await sql.query<{ ancestor_id: string; descendant_id: string }>(
      `select ancestor_id, descendant_id from resource_tree
        where ancestor_id = any($1::text[]) or descendant_id = any($1::text[])`,
      [resIds],
    );
    const conflictOf = (rid: string) => {
      const set = new Set<string>([rid]);
      for (const t of trees) {
        if (t.descendant_id === rid) set.add(t.ancestor_id);
        if (t.ancestor_id === rid) set.add(t.descendant_id);
      }
      return [...set];
    };

    const busyBookings = await sql.query<{
      resource_id: string;
      blocked_start: string;
      blocked_end: string;
    }>(
      `select resource_id, blocked_start, blocked_end from booking
        where venue_id = $1 and local_date between ($2::date - 1) and ($2::date + 1)
          and state in ('confirmed','checked_in')`,
      [venue.id, data.date],
    );
    const blackouts = await sql.query<{
      resource_id: string;
      period_start: string;
      period_end: string;
    }>(
      `select resource_id, period_start, period_end from blackout
        where resource_id = any($1::text[])`,
      [resIds],
    );
    const busy = [
      ...busyBookings.map((b) => ({
        resourceId: b.resource_id,
        start: String(b.blocked_start),
        end: String(b.blocked_end),
      })),
      ...blackouts.map((b) => ({
        resourceId: b.resource_id,
        start: String(b.period_start),
        end: String(b.period_end),
      })),
    ];

    const requestCounts = await sql.query<{ resource_id: string; period_start: string; n: number }>(
      `select resource_id, period_start::text, count(*)::int as n from booking
        where venue_id = $1 and local_date = $2::date and state = 'requested'
        group by resource_id, period_start`,
      [venue.id, data.date],
    );

    const slots: SlotOffer[] = [];
    const now = Date.now();
    for (const res of resources) {
      const generated = generateSlots({
        dateISO: data.date,
        timezone: venue.timezone,
        resourceId: res.id,
        slotMinutes: res.slotMinutes,
        bufferMinutes: res.bufferMinutes,
        windows,
        bands,
        overrides: overrides.map((o) => ({
          ...o,
          on_date: String(o.on_date).slice(0, 10),
        })),
        busy,
        conflictIds: conflictOf(res.id),
        venueId: venue.id,
      });
      for (const g of generated) {
        if (g.end.getTime() < now) continue;
        const reqN =
          requestCounts.find(
            (c) => c.resource_id === res.id && new Date(c.period_start).getTime() === g.start.getTime(),
          )?.n ?? 0;
        slots.push({
          resourceId: res.id,
          resourceName: res.name,
          sport: res.sport,
          startISO: g.start.toISOString(),
          endISO: g.end.toISOString(),
          localDate: g.localDate,
          label: `${formatTime(g.start, venue.timezone)} · ${durationLabel(g.start, g.end)}`,
          pricePaise: g.pricePaise,
          priceLabel: g.priceLabel,
          available: g.available,
          requestCount: Number(reqN),
        });
      }
    }
    return { slots, venue };
  });

export const sendOtp = createServerFn({ method: "POST" })
  .validator((input: { phone: string; slug: string }) => input)
  .handler(async ({ data }) => {
    const sql = await ready();
    const phone = normalizePhone(data.phone);
    const recent = await sql<{ n: number }>`
      select count(*)::int as n from otp_challenge
       where phone_e164 = ${phone} and created_at > now() - interval '10 minutes'`;
    if (Number(recent[0]?.n ?? 0) >= 5) {
      throw new Error("Too many codes for this number. Wait 10 minutes.");
    }
    const code = String(100000 + Math.floor(Math.random() * 900000));
    const id = nid("otp");
    await sql`
      insert into otp_challenge (id, phone_e164, code, expires_at)
      values (${id}, ${phone}, ${code}, now() + interval '10 minutes')`;
    return {
      phone,
      // Phase 1 has no SMS gateway. Show the code so the number can still be verified.
      demoCode: code,
      expiresInSec: 600,
    };
  });

export const verifyOtp = createServerFn({ method: "POST" })
  .validator((input: { phone: string; code: string }) => input)
  .handler(async ({ data }) => {
    const sql = await ready();
    const phone = normalizePhone(data.phone);
    const rows = await sql<{ id: string; code: string; attempts: number }>`
      select id, code, attempts from otp_challenge
       where phone_e164 = ${phone} and verified = false and expires_at > now()
       order by created_at desc limit 1`;
    const row = rows[0];
    if (!row) throw new Error("Code expired. Request a new one.");
    if (row.attempts >= 5) throw new Error("Too many attempts. Request a new code.");
    if (row.code !== data.code.trim()) {
      await sql`update otp_challenge set attempts = attempts + 1 where id = ${row.id}`;
      throw new Error("That code does not match.");
    }
    await sql`update otp_challenge set verified = true where id = ${row.id}`;
    await sql`
      insert into customer_identity (id, phone_e164, phone_verified)
      values (${nid("cid")}, ${phone}, true)
      on conflict (phone_e164) do update set phone_verified = true`;
    return { ok: true, phone };
  });

export const previewPromo = createServerFn({ method: "POST" })
  .validator((input: { slug: string; code: string; resourceId: string; startISO: string; pricePaise: number }) => input)
  .handler(async ({ data }) => {
    const sql = await ready();
    const v = await sql<{ id: string }>`select id from venue where slug = ${data.slug} limit 1`;
    if (!v[0]) throw new Error("Venue not found");
    const promo = await applyPromo(sql, v[0].id, data.code, data.resourceId, data.startISO, data.pricePaise, null);
    return promo;
  });

export async function applyPromo(
  sql: Awaited<ReturnType<typeof ready>>,
  venueId: string,
  code: string,
  resourceId: string,
  startISO: string,
  pricePaise: number,
  identityId: string | null,
): Promise<{ promoId: string | null; discountPaise: number; duePaise: number; label: string | null }> {
  if (!code.trim()) {
    return { promoId: null, discountPaise: 0, duePaise: pricePaise, label: null };
  }
  const rows = await sql<Record<string, unknown>>`
    select * from promo_code
     where venue_id = ${venueId} and upper(code) = ${code.trim().toUpperCase()} and active = true
     limit 1`;
  const p = rows[0];
  if (!p) throw new Error("That code is not valid here.");
  const now = Date.now();
  if (p.valid_from && new Date(String(p.valid_from)).getTime() > now) throw new Error("Code not active yet.");
  if (p.valid_until && new Date(String(p.valid_until)).getTime() < now) throw new Error("Code has expired.");
  if (p.usage_limit_total != null && Number(p.times_used) >= Number(p.usage_limit_total)) {
    throw new Error("Code has been fully used.");
  }
  const days = p.applicable_day_of_week as number[] | null;
  if (days && days.length) {
    const dow = new Date(startISO).getUTCDay(); // rough; promo day uses local via date
    const local = localDateISO(new Date(startISO));
    const jsDow = new Date(`${local}T12:00:00+05:30`).getDay();
    if (!days.map(Number).includes(jsDow)) throw new Error("Code does not apply to this day.");
    void dow;
  }
  const resources = p.applicable_resource_ids as string[] | null;
  if (resources && resources.length && !resources.includes(resourceId)) {
    throw new Error("Code does not apply to this pitch.");
  }
  if (identityId && p.usage_limit_per_customer != null) {
    const used = await sql<{ n: number }>`
      select count(*)::int as n from booking
       where promo_code_id = ${String(p.id)} and identity_id = ${identityId}
         and state not in ('declined','lapsed','cancelled')`;
    if (Number(used[0]?.n ?? 0) >= Number(p.usage_limit_per_customer)) {
      throw new Error("You have already used this code.");
    }
  }
  const type = String(p.type) as "percent" | "flat";
  if (type === "percent" && p.max_discount_paise == null) {
    throw new Error("Percent codes need a cap. Ask the owner.");
  }
  const { discountPaise, duePaise } = applyDiscount({
    pricePaise,
    type,
    value: Number(p.value),
    maxDiscountPaise: p.max_discount_paise == null ? null : Number(p.max_discount_paise),
  });
  return { promoId: String(p.id), discountPaise, duePaise, label: String(p.code) };
}

export const submitRequest = createServerFn({ method: "POST" })
  .validator(
    (input: {
      slug: string;
      resourceId: string;
      startISO: string;
      endISO: string;
      name: string;
      phone: string;
      otpVerified: boolean;
      promo?: string;
      consent: boolean;
      language?: "en" | "hi";
    }) => input,
  )
  .handler(async ({ data }) => {
    if (!data.consent) throw new Error("Consent is required to submit a request.");
    if (!data.otpVerified) throw new Error("Verify your phone first.");
    if (!data.name.trim()) throw new Error("Name is required.");
    const sql = await ready();
    const vrows = await sql<Record<string, unknown>>`
      select * from venue where slug = ${data.slug} and status = 'active' limit 1`;
    if (!vrows[0]) throw new Error("Venue not found");
    const venue = mapVenue(vrows[0]);
    const phone = normalizePhone(data.phone);
    const verified = await sql`
      select 1 from otp_challenge
       where phone_e164 = ${phone} and verified = true and expires_at > now() - interval '1 hour'
       limit 1`;
    if (!verified.length) throw new Error("Phone verification expired. Send a new code.");

    const phoneId = await findIdentityByPhone(sql, phone);
    let identityId = phoneId ?? nid("cid");
    if (!phoneId) {
      await sql`
        insert into customer_identity (id, phone_e164, phone_verified, display_name)
        values (${identityId}, ${phone}, true, ${data.name.trim()})`;
    } else {
      await sql`
        update customer_identity
           set display_name = coalesce(display_name, ${data.name.trim()}), phone_verified = true
         where id = ${identityId}`;
    }
    const profRows = await sql<{ id: string }>`
      select id from customer_profile where identity_id = ${identityId} and venue_id = ${venue.id} limit 1`;
    const profileId = profRows[0]?.id ?? nid("prf");
    if (!profRows[0]) {
      await sql`
        insert into customer_profile (id, identity_id, venue_id, name_at_venue, first_booked_at)
        values (${profileId}, ${identityId}, ${venue.id}, ${data.name.trim()}, now())`;
    } else {
      await sql`update customer_profile set name_at_venue = ${data.name.trim()} where id = ${profileId}`;
    }

    const res = await sql<{ slot_minutes: number; buffer_minutes: number; name: string }>`
      select slot_minutes, buffer_minutes, name from resource where id = ${data.resourceId} and venue_id = ${venue.id} limit 1`;
    if (!res[0]) throw new Error("Pitch not found");

    const start = new Date(data.startISO);
    const end = new Date(data.endISO);
    if (!(end > start)) throw new Error("Invalid slot");
    const localDate = localDateISO(start, venue.timezone);
    const priceRows = await sql<{ price_paise: number }>`
      select 1 as price_paise`;
    void priceRows;
    // Price from availability engine
    const avail = await getAvailability({ data: { slug: data.slug, date: localDate } });
    const match = avail.slots.find(
      (s) => s.resourceId === data.resourceId && s.startISO === start.toISOString(),
    );
    const pricePaise = match?.pricePaise ?? 0;
    if (!match || !match.available) throw new Error("That slot is no longer free to request.");

    const promo = await applyPromo(
      sql,
      venue.id,
      data.promo ?? "",
      data.resourceId,
      start.toISOString(),
      pricePaise,
      identityId,
    );

    const id = nid("bk");
    const prefix = venue.slug.slice(0, 3).toUpperCase().padEnd(3, "X");
    const blockedEnd = new Date(end.getTime() + Number(res[0].buffer_minutes) * 60000);
    const expires = new Date(Date.now() + venue.requestWindowMinutes * 60000);

    const result = await sql<{ ok: boolean; error: string | null; booking_id: string | null }>`
      select * from turf_create_booking(
        ${id}, ${refCode(prefix)}, ${venue.id}, ${data.resourceId}, ${identityId}, ${profileId},
        ${start.toISOString()}::timestamptz, ${end.toISOString()}::timestamptz,
        ${start.toISOString()}::timestamptz, ${blockedEnd.toISOString()}::timestamptz,
        ${localDate}::date, 'requested', 'link',
        ${pricePaise}, ${promo.discountPaise}, 0, ${promo.duePaise}, 0,
        null, null, ${promo.promoId}, ${JSON.stringify(POLICY_DEFAULT)}::jsonb,
        ${expires.toISOString()}::timestamptz, null, ${nid("cr")}
      )`;
    const row = result[0];
    if (!row?.ok) throw new Error(row?.error === "SLOT_UNAVAILABLE" ? "That slot was just taken." : row?.error ?? "Could not submit");
    const msg = await renderBookingMessage(sql, row.booking_id!, "request_received", data.language ?? "hi");
    const created = await sql.query<Record<string, unknown>>(
      `select ${BOOKING_SELECT} from booking b
         join resource r on r.id = b.resource_id
         left join customer_profile p on p.id = b.profile_id
         left join customer_identity i on i.id = b.identity_id
        where b.id = $1`,
      [row.booking_id],
    );
    return {
      bookingId: row.booking_id,
      refCode: String(created[0]?.ref_code),
      amountDuePaise: promo.duePaise,
      expiresAt: expires.toISOString(),
      message: msg.body,
      upiId: venue.upiId,
      venuePhone: venue.contactPhone,
      wording: "This is a request, not a booking. The owner confirms after payment.",
    };
  });

export const listDemoVenues = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await ready();
  const rows = await sql<Record<string, unknown>>`
    select * from venue where status = 'active' order by is_demo desc, name`;
  return rows.map(mapVenue);
});

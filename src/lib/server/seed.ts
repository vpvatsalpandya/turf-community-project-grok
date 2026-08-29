import type { Sql } from "@/lib/db";
import { DEFAULT_TEMPLATES, TEMPLATE_KINDS } from "@/lib/turf/messages";
import { addDaysISO, localDateISO, zonedInstant } from "@/lib/turf/time";
import { nid } from "@/lib/utils";

const ORG = "org_demo";
const VENUE = "venue_greenfield";
const GROUND = "res_ground";
const PITCH1 = "res_pitch1";
const PITCH2 = "res_pitch2";
const CRICKET = "res_cricket";

function instant(dateISO: string, hhmm: string) {
  return zonedInstant(dateISO, hhmm, "Asia/Kolkata").toISOString();
}

export async function seedDemo(sql: Sql): Promise<void> {
  const exists = await sql`select 1 from venue where id = ${VENUE} limit 1`;
  if (exists.length) return;

  const today = localDateISO();
  const tmr = addDaysISO(today, 1);
  const satOffset = (6 - new Date(`${today}T12:00:00+05:30`).getDay() + 7) % 7;
  const sat = addDaysISO(today, satOffset === 0 ? 0 : satOffset);
  const sun = addDaysISO(sat, 1);

  await sql`
    insert into org (id, legal_name, status)
    values (${ORG}, 'Greenfield Sports LLP', 'trialing')
    on conflict do nothing`;

  await sql`
    insert into venue (
      id, org_id, name, slug, timezone, address, city, lat, lng,
      amenities, photos, upi_id, contact_phone, request_window_minutes, is_demo
    ) values (
      ${VENUE}, ${ORG}, 'Greenfield Turf', 'greenfield', 'Asia/Kolkata',
      'Near SP Ring Road, Bopal', 'Ahmedabad',
      23.0225, 72.5714,
      ${[
        "Floodlights",
        "Changing rooms",
        "Drinking water",
        "Parking",
        "First aid",
        "Cafe",
      ]},
      ${JSON.stringify([
        { src: "/venues/greenfield-night.jpg", alt: "Floodlit 5-a-side pitch at night" },
        { src: "/venues/greenfield-dual.jpg", alt: "Two pitches side by side" },
        { src: "/venues/greenfield-cricket.jpg", alt: "Box cricket nets at dusk" },
        { src: "/venues/greenfield-desk.jpg", alt: "The booking desk" },
      ])}::jsonb,
      'greenfieldturf@upi', '+919876543210', 240, true
    )
    on conflict do nothing`;

  const resources: [string, string | null, string, string, number, number][] = [
    [GROUND, null, "Ground A", "football", 60, 0],
    [PITCH1, GROUND, "Pitch 1", "football", 60, 0],
    [PITCH2, GROUND, "Pitch 2", "football", 60, 0],
    [CRICKET, null, "Box Cricket", "cricket", 60, 10],
  ];
  let order = 0;
  for (const [id, parent, name, sport, slot, buffer] of resources) {
    await sql`
      insert into resource (id, venue_id, parent_id, name, sport, slot_minutes, buffer_minutes, sort_order, is_bookable)
      values (${id}, ${VENUE}, ${parent}, ${name}, ${sport}, ${slot}, ${buffer}, ${order}, true)
      on conflict do nothing`;
    order += 1;
  }
  await sql`select rebuild_resource_tree(${VENUE})`;

  // Hours 6:00–23:00 every day for bookable leaves + ground
  for (const rid of [GROUND, PITCH1, PITCH2, CRICKET]) {
    for (let dow = 0; dow <= 6; dow++) {
      await sql`
        insert into operating_window (id, resource_id, day_of_week, opens_at, closes_minutes_from_midnight)
        values (${nid("ow")}, ${rid}, ${dow}, ${"06:00"}, ${23 * 60})
        on conflict do nothing`;
    }
    const bands: [string, number, string, string, number, string, number][] = [
      [rid, -1, "06:00", "10:00", 80000, "Morning", 1],
      [rid, -1, "10:00", "17:00", 60000, "Dead hours", 1],
      [rid, -1, "17:00", "21:00", 150000, "Peak", 2],
      [rid, -1, "21:00", "23:00", 120000, "Late", 1],
      [rid, 0, "17:00", "21:00", 180000, "Sunday peak", 3],
      [rid, 6, "17:00", "21:00", 180000, "Saturday peak", 3],
    ];
    for (const [resourceId, dow, start, end, price, label, pri] of bands) {
      await sql`
        insert into price_band (id, resource_id, day_of_week, starts_at, ends_at, price_paise, label, priority)
        values (
          ${nid("pb")}, ${resourceId},
          ${dow < 0 ? null : dow}, ${start}, ${end}, ${price}, ${label}, ${pri}
        )`;
    }
  }

  for (const kind of TEMPLATE_KINDS) {
    await sql`
      insert into message_template (id, venue_id, kind, body, language)
      values (${nid("mt")}, ${VENUE}, ${kind}, ${DEFAULT_TEMPLATES[kind].en}, 'en')
      on conflict do nothing`;
    await sql`
      insert into message_template (id, venue_id, kind, body, language)
      values (${nid("mt")}, ${VENUE}, ${kind}, ${DEFAULT_TEMPLATES[kind].hi}, 'hi')
      on conflict do nothing`;
  }

  await sql`
    insert into loyalty_program (id, venue_id, name, type, config, expiry_months, status)
    values (
      'loy_tenth', ${VENUE}, '10th Booking Free', 'visit_stamp',
      ${JSON.stringify({ stamps: 9, rewardPaise: 150000, label: "10th hour free up to ₹1,500" })}::jsonb,
      12, 'active'
    ) on conflict do nothing`;
  await sql`
    insert into loyalty_program (id, venue_id, name, type, config, expiry_months, status)
    values (
      'loy_weekday', ${VENUE}, 'Weekday Warrior', 'points',
      ${JSON.stringify({ pointsPerRupee: 0.1, weekdayMultiplier: 2, rupeePerPoint: 1, weekdays: [1, 2, 3, 4] })}::jsonb,
      12, 'active'
    ) on conflict do nothing`;

  await sql`
    insert into promo_code (id, venue_id, code, type, value, max_discount_paise, usage_limit_total, usage_limit_per_customer, active)
    values ('promo_first', ${VENUE}, 'FIRST100', 'flat', 10000, 10000, 200, 1, true)
    on conflict do nothing`;
  await sql`
    insert into promo_code (id, venue_id, code, type, value, max_discount_paise, usage_limit_total, usage_limit_per_customer, applicable_day_of_week, active)
    values ('promo_mid', ${VENUE}, 'MIDWEEK', 'percent', 20, 40000, 500, 4, ${[1, 2, 3, 4]}, true)
    on conflict do nothing`;

  await sql`
    insert into subscription (
      org_id, status, trial_ends_on, current_period_start, current_period_end, next_invoice_on, referred
    ) values (
      ${ORG}, 'trialing', ${addDaysISO(today, 28)}, ${today}, ${addDaysISO(today, 28)}, ${addDaysISO(today, 28)}, false
    ) on conflict do nothing`;

  await sql`
    insert into referral_code (code, referrer_name, referrer_phone, referrer_upi, active)
    values ('RAHUL50', 'Rahul Patel', '+919820011223', 'rahulpatel@upi', true)
    on conflict do nothing`;

  // Customers
  const customers: { id: string; phone: string; name: string; bookings: number; noshows: number; late: number }[] = [
    { id: "id_aarav", phone: "+919876500001", name: "Aarav Mehta", bookings: 18, noshows: 0, late: 0 },
    { id: "id_diya", phone: "+919876500002", name: "Diya Shah", bookings: 7, noshows: 0, late: 1 },
    { id: "id_kabir", phone: "+919876500003", name: "Kabir Joshi", bookings: 2, noshows: 0, late: 0 },
    { id: "id_isha", phone: "+919876500004", name: "Isha Patel", bookings: 11, noshows: 2, late: 0 },
    { id: "id_veer", phone: "+919876500005", name: "Veer Desai", bookings: 4, noshows: 0, late: 0 },
    { id: "id_maya", phone: "+919876500006", name: "Maya Trivedi", bookings: 1, noshows: 0, late: 0 },
    { id: "id_dev", phone: "+919876500007", name: "Dev Rana", bookings: 9, noshows: 0, late: 0 },
    { id: "id_anaya", phone: "+919876500008", name: "Anaya Kothari", bookings: 3, noshows: 0, late: 0 },
  ];
  for (const c of customers) {
    await sql`
      insert into customer_identity (
        id, phone_e164, phone_verified, display_name,
        lifetime_bookings, lifetime_no_shows, lifetime_late_cancels, reliability_score
      ) values (
        ${c.id}, ${c.phone}, true, ${c.name}, ${c.bookings}, ${c.noshows}, ${c.late},
        ${100 - c.noshows * 15 - c.late * 5}
      ) on conflict do nothing`;
    await sql`
      insert into customer_profile (
        id, identity_id, venue_id, name_at_venue, total_bookings, total_spend_paise,
        first_booked_at, last_booked_at
      ) values (
        ${"pr_" + c.id.slice(3)}, ${c.id}, ${VENUE}, ${c.name}, ${c.bookings}, ${c.bookings * 120000},
        now() - interval '120 days', now() - interval '3 days'
      ) on conflict do nothing`;
  }

  type SeedB = {
    id: string;
    ref: string;
    resource: string;
    ident: string;
    date: string;
    start: string;
    end: string;
    state: string;
    channel: string;
    price: number;
    collected: number;
    mode?: string;
    expiresHours?: number;
  };

  const bookings: SeedB[] = [
    { id: "bk_y1", ref: "GTA-A1K9Q", resource: PITCH1, ident: "id_aarav", date: addDaysISO(today, -1), start: "18:00", end: "19:00", state: "completed", channel: "staff", price: 150000, collected: 150000, mode: "upi_offline" },
    { id: "bk_y2", ref: "GTA-B2L8P", resource: PITCH2, ident: "id_dev", date: addDaysISO(today, -1), start: "19:00", end: "20:00", state: "completed", channel: "link", price: 150000, collected: 150000, mode: "upi_offline" },
    { id: "bk_y3", ref: "GTA-C3M7N", resource: CRICKET, ident: "id_diya", date: addDaysISO(today, -1), start: "20:00", end: "21:00", state: "no_show", channel: "phone", price: 150000, collected: 0 },
    { id: "bk_ns1", ref: "GTA-NS6AM", resource: PITCH1, ident: "id_isha", date: today, start: "06:00", end: "07:00", state: "confirmed", channel: "phone", price: 80000, collected: 80000, mode: "upi_offline" },
    { id: "bk_t1", ref: "GTA-D4N6M", resource: PITCH1, ident: "id_aarav", date: today, start: "07:00", end: "08:00", state: "completed", channel: "walkin", price: 80000, collected: 80000, mode: "cash" },
    { id: "bk_t2", ref: "GTA-E5P5L", resource: PITCH2, ident: "id_veer", date: today, start: "18:00", end: "19:00", state: "checked_in", channel: "staff", price: 150000, collected: 150000, mode: "upi_offline" },
    { id: "bk_t3", ref: "GTA-F6Q4K", resource: GROUND, ident: "id_dev", date: today, start: "19:00", end: "21:00", state: "confirmed", channel: "phone", price: 300000, collected: 300000, mode: "upi_offline" },
    { id: "bk_r1", ref: "GTA-G7R3J", resource: PITCH1, ident: "id_kabir", date: tmr, start: "20:00", end: "21:00", state: "requested", channel: "link", price: 150000, collected: 0, expiresHours: 4 },
    { id: "bk_r2", ref: "GTA-H8S2H", resource: PITCH1, ident: "id_maya", date: tmr, start: "20:00", end: "21:00", state: "requested", channel: "link", price: 140000, collected: 0, expiresHours: 3 },
    { id: "bk_r3", ref: "GTA-J9T1G", resource: PITCH1, ident: "id_isha", date: tmr, start: "20:00", end: "21:00", state: "requested", channel: "link", price: 150000, collected: 0, expiresHours: 2 },
    { id: "bk_r4", ref: "GTA-K1U9F", resource: PITCH2, ident: "id_anaya", date: tmr, start: "20:00", end: "21:00", state: "requested", channel: "link", price: 150000, collected: 0, expiresHours: 4 },
    { id: "bk_c1", ref: "GTA-L2V8E", resource: CRICKET, ident: "id_diya", date: tmr, start: "18:00", end: "19:00", state: "confirmed", channel: "staff", price: 150000, collected: 150000, mode: "cash" },
    { id: "bk_c2", ref: "GTA-M3W7D", resource: PITCH2, ident: "id_aarav", date: tmr, start: "07:00", end: "08:00", state: "confirmed", channel: "staff", price: 80000, collected: 80000, mode: "upi_offline" },
    { id: "bk_s1", ref: "GTA-N4X6C", resource: GROUND, ident: "id_dev", date: sat, start: "18:00", end: "20:00", state: "confirmed", channel: "phone", price: 360000, collected: 180000, mode: "upi_offline" },
    { id: "bk_s2", ref: "GTA-P5Y5B", resource: PITCH1, ident: "id_veer", date: sun, start: "08:00", end: "09:00", state: "confirmed", channel: "link", price: 80000, collected: 80000, mode: "upi_offline" },
  ];

  for (const b of bookings) {
    const startISO = instant(b.date, b.start);
    const endISO = instant(b.date, b.end);
    const profile = "pr_" + b.ident.slice(3);
    const expires =
      b.state === "requested"
        ? new Date(Date.now() + (b.expiresHours ?? 4) * 3600000).toISOString()
        : null;
    const checkedIn = b.state === "checked_in" || b.state === "completed" ? startISO : null;
    const checkedOut = b.state === "completed" ? endISO : null;
    await sql`
      insert into booking (
        id, ref_code, venue_id, resource_id, identity_id, profile_id,
        period_start, period_end, blocked_start, blocked_end, local_date,
        state, channel, price_paise, amount_due_paise, amount_collected_paise,
        payment_mode, policy_snapshot, request_expires_at,
        checked_in_at, checked_out_at
      ) values (
        ${b.id}, ${b.ref}, ${VENUE}, ${b.resource}, ${b.ident}, ${profile},
        ${startISO}::timestamptz, ${endISO}::timestamptz, ${startISO}::timestamptz, ${endISO}::timestamptz, ${b.date}::date,
        ${b.state}, ${b.channel}, ${b.price}, ${b.price - (b.id === "bk_r2" ? 10000 : 0)}, ${b.collected},
        ${b.mode ?? null}, ${JSON.stringify({ cancelHours: 4 })}::jsonb, ${expires}::timestamptz,
        ${checkedIn}::timestamptz, ${checkedOut}::timestamptz
      ) on conflict do nothing`;
    await sql`
      insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
      values (${b.id}, null, ${b.state}, null, 'system', 'seed')`;
  }

  // FIRST100 applied on maya's request
  await sql`update booking set promo_code_id = 'promo_first', discount_paise = 10000, amount_due_paise = 140000 where id = 'bk_r2'`;

  // Loyalty stamps for Aarav (8 of 9)
  for (let i = 0; i < 8; i++) {
    await sql`
      insert into loyalty_ledger (profile_id, program_id, delta, balance_after, kind, expires_on)
      values ('pr_aarav', 'loy_tenth', 1, ${i + 1}, 'earn', ${addDaysISO(today, 300)}::date)`;
  }

  // Isha has earned the 10th-hour reward — her open request can redeem it
  for (let i = 0; i < 9; i++) {
    await sql`
      insert into loyalty_ledger (profile_id, program_id, delta, balance_after, kind, expires_on)
      values ('pr_isha', 'loy_tenth', 1, ${i + 1}, 'earn', ${addDaysISO(today, 300)}::date)`;
  }

  // A blackout tomorrow morning on cricket (maintenance)
  await sql`
    insert into blackout (id, resource_id, period_start, period_end, reason)
    values (
      'blk_maint', ${CRICKET},
      ${instant(tmr, "10:00")}::timestamptz,
      ${instant(tmr, "13:00")}::timestamptz,
      'Net repair'
    ) on conflict do nothing`;

  await sql`
    insert into waitlist (
      id, venue_id, resource_id, identity_id, profile_id, name, phone_e164,
      local_date, period_start, period_end, status
    ) values (
      'wl_maya_ground', ${VENUE}, ${GROUND}, 'id_maya', 'pr_maya', 'Maya Trivedi', '+919876500006',
      ${today}::date, ${instant(today, "19:00")}::timestamptz, ${instant(today, "21:00")}::timestamptz, 'waiting'
    ) on conflict do nothing`;
  await sql`
    insert into waitlist (
      id, venue_id, resource_id, identity_id, profile_id, name, phone_e164,
      local_date, period_start, period_end, status
    ) values (
      'wl_kabir_cricket', ${VENUE}, ${CRICKET}, 'id_kabir', 'pr_kabir', 'Kabir Joshi', '+919876500003',
      ${tmr}::date, ${instant(tmr, "18:00")}::timestamptz, ${instant(tmr, "19:00")}::timestamptz, 'waiting'
    ) on conflict do nothing`;
}

/** Idempotent. Safe to call after the venue already exists (HMR / long-lived preview). */
export async function seedWaitlistIfEmpty(sql: Sql): Promise<void> {
  try {
    const n = await sql`select 1 from waitlist limit 1`;
    if (n.length) return;
    const venue = await sql`select 1 from venue where id = ${VENUE} limit 1`;
    if (!venue.length) return;
    const today = localDateISO();
    const tmr = addDaysISO(today, 1);
    await sql`
      insert into waitlist (
        id, venue_id, resource_id, identity_id, profile_id, name, phone_e164,
        local_date, period_start, period_end, status
      ) values (
        'wl_maya_ground', ${VENUE}, ${GROUND}, 'id_maya', 'pr_maya', 'Maya Trivedi', '+919876500006',
        ${today}::date, ${instant(today, "19:00")}::timestamptz, ${instant(today, "21:00")}::timestamptz, 'waiting'
      ) on conflict do nothing`;
    await sql`
      insert into waitlist (
        id, venue_id, resource_id, identity_id, profile_id, name, phone_e164,
        local_date, period_start, period_end, status
      ) values (
        'wl_kabir_cricket', ${VENUE}, ${CRICKET}, 'id_kabir', 'pr_kabir', 'Kabir Joshi', '+919876500003',
        ${tmr}::date, ${instant(tmr, "18:00")}::timestamptz, ${instant(tmr, "19:00")}::timestamptz, 'waiting'
      ) on conflict do nothing`;
  } catch {
    // Table missing until 0004 applies.
  }
}

/** Past confirmed slot with no check-in so the no-show review list isn't empty. */
export async function seedNoshowCandidateIfEmpty(sql: Sql): Promise<void> {
  try {
    const exists = await sql`select 1 from booking where id = 'bk_ns1' limit 1`;
    if (exists.length) return;
    const venue = await sql`select 1 from venue where id = ${VENUE} limit 1`;
    if (!venue.length) return;
    const today = localDateISO();
    const startISO = instant(today, "06:00");
    const endISO = instant(today, "07:00");
    await sql`
      insert into booking (
        id, ref_code, venue_id, resource_id, identity_id, profile_id,
        period_start, period_end, blocked_start, blocked_end, local_date,
        state, channel, price_paise, amount_due_paise, amount_collected_paise,
        payment_mode, policy_snapshot
      ) values (
        'bk_ns1', 'GTA-NS6AM', ${VENUE}, ${PITCH1}, 'id_isha', 'pr_isha',
        ${startISO}::timestamptz, ${endISO}::timestamptz, ${startISO}::timestamptz, ${endISO}::timestamptz, ${today}::date,
        'confirmed', 'phone', 80000, 80000, 80000,
        'upi_offline', ${JSON.stringify({ cancelHours: 4 })}::jsonb
      ) on conflict do nothing`;
    await sql`
      insert into booking_event (booking_id, from_state, to_state, actor_id, actor_type, reason)
      values ('bk_ns1', null, 'confirmed', null, 'system', 'seed')`;
  } catch {
    // Ignore if the slot is already taken on a long-lived desk.
  }
}

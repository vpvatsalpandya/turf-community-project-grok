import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { inr, isValidInPhone, normalizePhone, slugify } from "@/lib/utils";
import { AREA_PINS } from "./geo";
import {
  demoAllowed,
  formatHoldLeft,
  HOLD_MINUTES,
  hourBucketIst,
  isUniqueViolation,
  mapsDirFromVenue,
  normalizeSport,
  parseCoord,
  parsePhotos,
  qrImageSrc,
  REQUESTS_PER_HOUR,
  upiPayUri,
  waMeUrl,
} from "./live";
import { addDays, formatIstTime, istDateTime, toIso, todayIst } from "./time";
import { ensureOwnerProfile } from "./accounts";
import { isDeskRole } from "./demo-logins";

export { getMyProfile, listPlayerNights, listAdminBoard, prepareDemoLogins, listTeam, addTeamMember, removeTeamMember } from "./accounts";
export type { PlayerBooking, TeamMember } from "./accounts";

const HOLD_STATUSES = ["pending", "confirmed", "checked_in"] as const;
const BILLED_STATUSES = ["confirmed", "checked_in", "checked_out"] as const;

export type Venue = {
  id: string;
  userId: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  address: string;
  pitchCount: number;
  sport: string;
  priceInr: number;
  slotMinutes: number;
  openHour: number;
  closeHour: number;
  upiId: string;
  phone: string;
  notes: string;
  lat: number | null;
  lng: number | null;
  photos: string[];
};

export type Booking = {
  id: string;
  venueId: string;
  pitchIndex: number;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  amountInr: number;
  createdAt: string;
  holdUntil: string | null;
  holdLeft: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
};

export type Slot = {
  startAt: string;
  endAt: string;
  label: string;
  openPitches: number;
  pitchCount: number;
  status: "open" | "held" | "past";
  amountInr: number;
};

type VenueRow = {
  id: string;
  user_id: string;
  slug: string;
  name: string;
  city: string;
  area: string;
  address?: string | null;
  pitch_count: number;
  sport: string;
  price_inr: number;
  slot_minutes: number;
  open_hour: number;
  close_hour: number;
  upi_id: string;
  phone: string;
  notes: string;
  lat?: unknown;
  lng?: unknown;
  photos?: unknown;
};

type BookingRow = {
  id: string;
  venue_id: string;
  pitch_index: number;
  start_at: unknown;
  end_at: unknown;
  status: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  amount_inr: number;
  created_at?: unknown;
  hold_until?: unknown;
  checked_in_at?: unknown;
  checked_out_at?: unknown;
};

function mapVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    userId: row.user_id,
    slug: row.slug,
    name: row.name,
    city: row.city,
    area: row.area,
    address: row.address ?? "",
    pitchCount: Number(row.pitch_count),
    sport: normalizeSport(row.sport),
    priceInr: Number(row.price_inr),
    slotMinutes: Number(row.slot_minutes),
    openHour: Number(row.open_hour),
    closeHour: Number(row.close_hour),
    upiId: row.upi_id,
    phone: row.phone,
    notes: row.notes,
    lat: parseCoord(row.lat),
    lng: parseCoord(row.lng),
    photos: parsePhotos(row.photos),
  };
}

function mapBooking(row: BookingRow): Booking {
  const createdAt = row.created_at ? toIso(row.created_at) : new Date().toISOString();
  const holdUntil = row.hold_until ? toIso(row.hold_until) : null;
  const left =
    row.status === "pending"
      ? formatHoldLeft(
          Math.max(
            0,
            (holdUntil
              ? new Date(holdUntil).getTime()
              : new Date(createdAt).getTime() + HOLD_MINUTES * 60_000) - Date.now(),
          ),
        )
      : null;
  return {
    id: row.id,
    venueId: row.venue_id,
    pitchIndex: Number(row.pitch_index),
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status,
    source: row.source,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    amountInr: Number(row.amount_inr),
    createdAt,
    holdUntil,
    holdLeft: left && left.startsWith("0") ? "expiring" : left,
    checkedInAt: row.checked_in_at ? toIso(row.checked_in_at) : null,
    checkedOutAt: row.checked_out_at ? toIso(row.checked_out_at) : null,
  };
}

function slotLabel(start: Date, end: Date) {
  return `${formatIstTime(start)} – ${formatIstTime(end)}`;
}

function buildSlots(venue: Venue, dateKey: string, bookings: Booking[]): Slot[] {
  const now = Date.now();
  const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
  const slots: Slot[] = [];
  const closeMs = venue.closeHour * 60;
  for (let minutes = venue.openHour * 60; minutes + venue.slotMinutes <= closeMs; minutes += venue.slotMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const start = istDateTime(dateKey, h, m);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    const taken = new Set(
      bookings
        .filter(
          (b) =>
            HOLD_STATUSES.includes(b.status as (typeof HOLD_STATUSES)[number]) &&
            new Date(b.startAt).getTime() < end.getTime() &&
            new Date(b.endAt).getTime() > start.getTime(),
        )
        .map((b) => b.pitchIndex),
    );
    const openPitches = Math.max(0, venue.pitchCount - taken.size);
    const past = start.getTime() <= now;
    slots.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      label: slotLabel(start, end),
      openPitches,
      pitchCount: venue.pitchCount,
      status: past ? "past" : openPitches === 0 ? "held" : "open",
      amountInr: amount,
    });
  }
  return slots;
}

async function expireStaleHolds(venueId?: string) {
  const sql = await getSql();
  const cutoff = new Date(Date.now() - HOLD_MINUTES * 60_000).toISOString();
  if (venueId) {
    await sql`
      update bookings
      set status = 'expired'
      where venue_id = ${venueId}
        and status = 'pending'
        and (
          (hold_until is not null and hold_until < now())
          or (hold_until is null and created_at < ${cutoff})
        )
    `;
    return;
  }
  await sql`
    update bookings
    set status = 'expired'
    where status = 'pending'
      and (
        (hold_until is not null and hold_until < now())
        or (hold_until is null and created_at < ${cutoff})
      )
  `;
}

async function loadVenueBySlug(slug: string): Promise<Venue | null> {
  const sql = await getSql();
  const rows = await sql<VenueRow>`select * from venues where slug = ${slug} limit 1`;
  return rows[0] ? mapVenue(rows[0]) : null;
}

function pinFromArea(area: string): { lat: number; lng: number } | null {
  const k = area.trim().toLowerCase();
  if (!k) return null;
  const hit = AREA_PINS.find((a) => a.label.toLowerCase() === k || a.id === k);
  return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

async function ensureDemo(): Promise<Venue> {
  if (!demoAllowed()) {
    const existing = await loadVenueBySlug("demo");
    if (existing) return existing;
    throw new Error("Demo turf is not live");
  }
  const { seedDemoAccounts } = await import("./accounts.server");
  await seedDemoAccounts();
  const existing = await loadVenueBySlug("demo");
  if (existing) {
    const { attachDemoVenue } = await import("./accounts.server");
    await attachDemoVenue(existing.id);
    return (await loadVenueBySlug("demo")) ?? existing;
  }
  const sql = await getSql();
  const id = "venue-demo";
  const ownerId = "user-demo-owner";
  await sql`
    insert into venues (
      id, user_id, slug, name, city, area, address, pitch_count, sport, price_inr,
      slot_minutes, open_hour, close_hour, upi_id, phone, notes, lat, lng
    ) values (
      ${id}, ${ownerId}, 'demo', 'Greenfield Arena', 'Vadodara', 'Alkapuri',
      'Alkapuri, Vadodara, Gujarat', 2, '5-a-side football', 900, 60, 6, 23,
      'greenfield@okaxis', '9876543210',
      'Floodlit 5-a-side. Pay UPI before confirmation. Arrive 10 minutes early.',
      22.3132, 73.1718
    )
    on conflict (slug) do nothing
  `;
  const today = todayIst();
  const seedHours = [19, 20];
  for (const hour of seedHours) {
    const start = istDateTime(today, hour, 0);
    if (start.getTime() < Date.now()) continue;
    const end = new Date(start.getTime() + 60 * 60_000);
    const bid = `seed-${today}-${hour}`;
    await sql`
      insert into bookings (
        id, venue_id, pitch_index, start_at, end_at, status, source,
        customer_name, customer_phone, notes, amount_inr
      ) values (
        ${bid}, ${id}, 1, ${start.toISOString()}, ${end.toISOString()},
        'confirmed', 'walkin', 'Walk-in side', '9998887776', '', 900
      )
      on conflict (id) do nothing
    `;
  }
  const venue = await loadVenueBySlug("demo");
  if (!venue) throw new Error("Could not seed demo turf");
  const { attachDemoVenue } = await import("./accounts.server");
  await attachDemoVenue(venue.id);
  return venue;
}

async function loadDeskAccess(userId: string): Promise<{ role: string; venue: Venue | null }> {
  const sql = await getSql();
  const profile = await sql<{ role: string; venue_id: string | null }>`
    select role, venue_id from profiles where user_id = ${userId} limit 1
  `;
  const role = profile[0]?.role ?? "owner";
  const owned = await sql<VenueRow>`
    select * from venues where user_id = ${userId} order by created_at asc limit 1
  `;
  if (owned[0]) return { role, venue: mapVenue(owned[0]) };
  if (profile[0]?.venue_id) {
    const rows = await sql<VenueRow>`select * from venues where id = ${profile[0].venue_id} limit 1`;
    if (rows[0]) return { role, venue: mapVenue(rows[0]) };
  }
  return { role, venue: null };
}

async function bookingsOnDay(venueId: string, dateKey: string): Promise<Booking[]> {
  await expireStaleHolds(venueId);
  const sql = await getSql();
  const from = istDateTime(dateKey, 0, 0);
  const to = istDateTime(addDays(dateKey, 1), 0, 0);
  const rows = await sql<BookingRow>`
    select * from bookings
    where venue_id = ${venueId}
      and start_at >= ${from.toISOString()}
      and start_at < ${to.toISOString()}
    order by start_at asc, pitch_index asc
  `;
  return rows.map(mapBooking);
}

export const getLiveConfig = createServerFn({ method: "GET" }).handler(async () => {
  return { demo: demoAllowed(), holdMinutes: HOLD_MINUTES };
});

export const listCommunityVenues = createServerFn({ method: "GET" }).handler(async () => {
  if (demoAllowed()) {
    try {
      await ensureDemo();
    } catch {
      /* preview seed is best-effort */
    }
  }
  const sql = await getSql();
  const rows = await sql<VenueRow>`select * from venues order by name asc`;
  return rows.map(mapVenue).map((v) => ({
    slug: v.slug,
    name: v.name,
    city: v.city,
    area: v.area,
    address: v.address,
    phone: v.phone,
    priceInr: v.priceInr,
    notes: v.notes,
    sport: v.sport,
    lat: v.lat,
    lng: v.lng,
  }));
});

export const getPublicBoard = createServerFn({ method: "GET" })
  .validator((input: { slug: string; date: string }) => input)
  .handler(async ({ data }) => {
    let venue: Venue | null = null;
    if (data.slug === "demo") {
      try {
        venue = await ensureDemo();
      } catch {
        venue = await loadVenueBySlug("demo");
      }
    } else {
      venue = await loadVenueBySlug(data.slug);
    }
    if (!venue) return { venue: null, slots: [] as Slot[], date: data.date, holdMinutes: HOLD_MINUTES };
    const bookings = await bookingsOnDay(venue.id, data.date);
    return { venue, slots: buildSlots(venue, data.date, bookings), date: data.date, holdMinutes: HOLD_MINUTES };
  });

async function assertPhoneBudget(phone: string) {
  const sql = await getSql();
  const bucket = hourBucketIst();
  const rows = await sql<{ n: number }>`
    insert into request_limits (phone, bucket, n)
    values (${phone}, ${bucket}, 1)
    on conflict (phone, bucket) do update set n = request_limits.n + 1
    returning n
  `;
  const n = Number(rows[0]?.n ?? 1);
  if (n > REQUESTS_PER_HOUR) {
    throw new Error("Too many requests from this number. Try again in an hour.");
  }
}

export const requestSlot = createServerFn({ method: "POST" })
  .middleware([optionalAuthMiddleware])
  .validator((input: {
    slug: string;
    startAt: string;
    name: string;
    phone: string;
    notes?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const name = data.name.trim();
    const phone = normalizePhone(data.phone);
    if (name.length < 2) throw new Error("Name is too short");
    if (!isValidInPhone(phone)) throw new Error("Enter a valid 10-digit Indian mobile");
    await assertPhoneBudget(phone);
    let venue: Venue | null = null;
    if (data.slug === "demo") {
      try {
        venue = await ensureDemo();
      } catch {
        venue = await loadVenueBySlug("demo");
      }
    } else {
      venue = await loadVenueBySlug(data.slug);
    }
    if (!venue) throw new Error("This turf link is not live");
    await expireStaleHolds(venue.id);
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    if (Number.isNaN(start.getTime())) throw new Error("Pick a valid slot");
    if (end.getTime() <= Date.now()) throw new Error("That slot has already started");
    const sql = await getSql();
    const taken = await sql<{ pitch_index: number }>`
      select pitch_index from bookings
      where venue_id = ${venue.id}
        and status in ('pending','confirmed','checked_in')
        and start_at < ${end.toISOString()}
        and end_at > ${start.toISOString()}
    `;
    const used = new Set(taken.map((r) => Number(r.pitch_index)));
    let pitch = 0;
    for (let i = 1; i <= venue.pitchCount; i += 1) {
      if (!used.has(i)) {
        pitch = i;
        break;
      }
    }
    if (!pitch) throw new Error("That slot just filled. Pick another.");
    const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
    const id = crypto.randomUUID();
    const holdUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
    try {
      await sql`
        insert into bookings (
          id, venue_id, pitch_index, start_at, end_at, status, source,
          customer_name, customer_phone, notes, amount_inr, hold_until, customer_user_id
        ) values (
          ${id}, ${venue.id}, ${pitch}, ${start.toISOString()}, ${end.toISOString()},
          'pending', 'link', ${name}, ${phone}, ${data.notes?.trim() ?? ""}, ${amount},
          ${holdUntil}, ${context.userId}
        )
      `;
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error("That slot just filled. Pick another.");
      throw err;
    }
    const payLine = venue.upiId
      ? `Pay ${inr(amount)} to ${venue.upiId} and wait for confirmation.`
      : `Pay ${inr(amount)} at the counter. The owner will confirm the slot.`;
    const label = slotLabel(start, end);
    const message = [
      `Slot request · ${venue.name}`,
      `${label} · Pitch ${pitch}`,
      `${name} · ${phone}`,
      payLine,
      `Hold drops in ${HOLD_MINUTES} min if not confirmed.`,
    ].join("\n");
    const ownerText = [
      `New request · ${venue.name}`,
      `${label} · Pitch ${pitch} · ${inr(amount)}`,
      `${name} · ${phone}`,
      data.notes?.trim() ? `Note: ${data.notes.trim()}` : "",
      `Confirm on the desk in ${HOLD_MINUTES} min or the hold drops.`,
    ]
      .filter(Boolean)
      .join("\n");
    const playerText = [
      `Turf Community · ${venue.name}`,
      `${label} · Pitch ${pitch} is held for ${HOLD_MINUTES} min.`,
      payLine,
      "The owner confirms after UPI. This is not a booking yet.",
    ].join("\n");
    const payUri = venue.upiId
      ? upiPayUri({ pa: venue.upiId, pn: venue.name, am: amount, tn: `${venue.name} ${label}` })
      : "";
    const [ownerPing, playerPing] = await Promise.all([
      import("./whatsapp.server").then((m) =>
        m.dispatchWhatsApp({
          kind: "owner_request",
          toPhone: venue.phone,
          body: ownerText,
          bookingId: id,
          venueId: venue.id,
        }),
      ),
      import("./whatsapp.server").then((m) =>
        m.dispatchWhatsApp({
          kind: "player_ack",
          toPhone: phone,
          body: playerText,
          bookingId: id,
          venueId: venue.id,
        }),
      ),
    ]);
    return {
      id,
      pitch,
      amountInr: amount,
      label,
      venueName: venue.name,
      upiId: venue.upiId,
      phone: venue.phone,
      message,
      payUri,
      qrSrc: payUri ? qrImageSrc(payUri) : "",
      ownerWa: waMeUrl(venue.phone, ownerText),
      mapsUrl: mapsDirFromVenue(venue),
      holdMinutes: HOLD_MINUTES,
      holdUntil,
      address: venue.address || [venue.area, venue.city].filter(Boolean).join(", "),
      waOwner: ownerPing,
      waPlayer: playerPing,
    };
  });

export const getMyDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { date: string }) => input)
  .handler(async ({ context, data }) => {
    await ensureOwnerProfile(context.userId);
    if (demoAllowed()) {
      try {
        await ensureDemo();
      } catch {
        /* preview seed is best-effort */
      }
    }
    const access = await loadDeskAccess(context.userId);
    const venue = access.venue;
    if (!venue) {
      return {
        venue: null,
        role: access.role,
        bookings: [] as Booking[],
        slots: [] as Slot[],
        stats: null,
        holdMinutes: HOLD_MINUTES,
      };
    }
    const bookings = await bookingsOnDay(venue.id, data.date);
    const slots = buildSlots(venue, data.date, bookings);
    const pending = bookings.filter((b) => b.status === "pending").length;
    const tonight = bookings.filter((b) => BILLED_STATUSES.includes(b.status as (typeof BILLED_STATUSES)[number])).length;
    const collected = bookings
      .filter((b) => BILLED_STATUSES.includes(b.status as (typeof BILLED_STATUSES)[number]))
      .reduce((sum, b) => sum + b.amountInr, 0);
    return {
      venue,
      role: access.role,
      bookings,
      slots,
      stats: { pending, tonight, collected },
      holdMinutes: HOLD_MINUTES,
    };
  });

export const saveVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    name: string;
    city: string;
    area: string;
    address?: string;
    pitchCount: number;
    priceInr: number;
    slotMinutes: number;
    openHour: number;
    closeHour: number;
    upiId: string;
    phone: string;
    notes: string;
    sport?: string;
    lat?: number | null;
    lng?: number | null;
    photos?: string[];
  }) => input)
  .handler(async ({ context, data }) => {
    await ensureOwnerProfile(context.userId);
    const name = data.name.trim();
    if (name.length < 2) throw new Error("Give the turf a name");
    const priceInr = Math.max(100, Math.min(20000, Math.round(data.priceInr) || 800));
    const pitchCount = Math.max(1, Math.min(6, Math.round(data.pitchCount) || 1));
    const slotMinutes = [60, 90, 120].includes(data.slotMinutes) ? data.slotMinutes : 60;
    const openHour = Math.max(0, Math.min(22, data.openHour));
    const closeHour = Math.max(openHour + 1, Math.min(24, data.closeHour));
    const sport = normalizeSport(data.sport);
    const photos = parsePhotos(data.photos);
    const area = data.area.trim();
    const city = data.city.trim() || "Vadodara";
    const address = (data.address ?? "").trim();
    let lat = parseCoord(data.lat);
    let lng = parseCoord(data.lng);
    if (lat == null || lng == null) {
      const pin = pinFromArea(area);
      if (pin) {
        lat = pin.lat;
        lng = pin.lng;
      }
    }
    const phone = normalizePhone(data.phone);
    const sql = await getSql();
    const access = await loadDeskAccess(context.userId);
    if (isDeskRole(access.role) && access.role !== "owner") {
      throw new Error("Only the owner can edit the turf sheet");
    }
    const existing = await sql<VenueRow>`
      select * from venues where user_id = ${context.userId} order by created_at asc limit 1
    `;
    const photoJson = JSON.stringify(photos);
    if (existing[0]) {
      await sql`
        update venues set
          name = ${name},
          city = ${city},
          area = ${area},
          address = ${address},
          pitch_count = ${pitchCount},
          sport = ${sport},
          price_inr = ${priceInr},
          slot_minutes = ${slotMinutes},
          open_hour = ${openHour},
          close_hour = ${closeHour},
          upi_id = ${data.upiId.trim()},
          phone = ${phone},
          notes = ${data.notes.trim()},
          lat = ${lat},
          lng = ${lng},
          photos = ${photoJson}::jsonb
        where id = ${existing[0].id} and user_id = ${context.userId}
      `;
      const rows = await sql<VenueRow>`select * from venues where id = ${existing[0].id}`;
      await sql`
        update profiles set venue_id = ${existing[0].id} where user_id = ${context.userId}
      `;
      return mapVenue(rows[0]);
    }
    let slug = slugify(name);
    const clash = await sql<{ slug: string }>`select slug from venues where slug = ${slug}`;
    if (clash[0]) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
    const id = crypto.randomUUID();
    await sql`
      insert into venues (
        id, user_id, slug, name, city, area, address, pitch_count, sport, price_inr,
        slot_minutes, open_hour, close_hour, upi_id, phone, notes, lat, lng, photos
      ) values (
        ${id}, ${context.userId}, ${slug}, ${name}, ${city}, ${area}, ${address}, ${pitchCount},
        ${sport}, ${priceInr}, ${slotMinutes}, ${openHour}, ${closeHour},
        ${data.upiId.trim()}, ${phone}, ${data.notes.trim()}, ${lat}, ${lng}, ${photoJson}::jsonb
      )
    `;
    const rows = await sql<VenueRow>`select * from venues where id = ${id} and user_id = ${context.userId}`;
    await sql`
      update profiles set venue_id = ${id} where user_id = ${context.userId}
    `;
    return mapVenue(rows[0]);
  });

export const addWalkIn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { startAt: string; name: string; phone: string }) => input)
  .handler(async ({ context, data }) => {
    const name = data.name.trim() || "Walk-in";
    const phone = normalizePhone(data.phone);
    const access = await loadDeskAccess(context.userId);
    if (!access.venue) throw new Error("Set up your turf first");
    if (!isDeskRole(access.role)) throw new Error("Not a desk login");
    const venue = access.venue;
    await expireStaleHolds(venue.id);
    const sql = await getSql();
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    const taken = await sql<{ pitch_index: number }>`
      select pitch_index from bookings
      where venue_id = ${venue.id}
        and status in ('pending','confirmed','checked_in')
        and start_at < ${end.toISOString()}
        and end_at > ${start.toISOString()}
    `;
    const used = new Set(taken.map((r) => Number(r.pitch_index)));
    let pitch = 0;
    for (let i = 1; i <= venue.pitchCount; i += 1) {
      if (!used.has(i)) {
        pitch = i;
        break;
      }
    }
    if (!pitch) throw new Error("No pitch free on that slot");
    const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
    const id = crypto.randomUUID();
    try {
      await sql`
        insert into bookings (
          id, venue_id, pitch_index, start_at, end_at, status, source,
          customer_name, customer_phone, notes, amount_inr
        ) values (
          ${id}, ${venue.id}, ${pitch}, ${start.toISOString()}, ${end.toISOString()},
          'confirmed', 'walkin', ${name}, ${phone || "0000000000"}, 'Walk-in at gate', ${amount}
        )
      `;
    } catch (err) {
      if (isUniqueViolation(err)) throw new Error("No pitch free on that slot");
      throw err;
    }
    return { id };
  });

const STATUS_LABEL: Record<string, string> = {
  confirmed: "CONFIRMED",
  declined: "DECLINED",
  cancelled: "CANCELLED",
  checked_in: "CHECKED IN",
  checked_out: "CHECKED OUT",
  no_show: "NO SHOW",
};

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => input)
  .handler(async ({ context, data }) => {
    const allowed = ["confirmed", "declined", "cancelled", "checked_in", "checked_out", "no_show"];
    if (!allowed.includes(data.status)) throw new Error("Unknown action");
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    const sql = await getSql();
    const current = await sql<{ status: string }>`
      select b.status from bookings b
      where b.id = ${data.id} and b.venue_id = ${access.venue.id}
      limit 1
    `;
    if (!current[0]) throw new Error("Booking not found");
    const from: Record<string, string[]> = {
      pending: ["confirmed", "declined"],
      confirmed: ["checked_in", "cancelled", "no_show"],
      checked_in: ["checked_out"],
    };
    if (!from[current[0].status]?.includes(data.status)) {
      throw new Error("That action is not available on this row");
    }
    const extra =
      data.status === "checked_in"
        ? sql`
            update bookings b
            set status = ${data.status}, checked_in_at = coalesce(b.checked_in_at, now())
            where b.id = ${data.id}
              and b.venue_id = ${access.venue.id}
            returning b.id, b.customer_phone, b.customer_name, b.start_at, b.pitch_index, b.amount_inr, b.venue_id
          `
        : data.status === "checked_out"
          ? sql`
            update bookings b
            set status = ${data.status}, checked_out_at = now(), checked_in_at = coalesce(b.checked_in_at, now())
            where b.id = ${data.id}
              and b.venue_id = ${access.venue.id}
            returning b.id, b.customer_phone, b.customer_name, b.start_at, b.pitch_index, b.amount_inr, b.venue_id
          `
          : sql`
            update bookings b
            set status = ${data.status}
            where b.id = ${data.id}
              and b.venue_id = ${access.venue.id}
            returning b.id, b.customer_phone, b.customer_name, b.start_at, b.pitch_index, b.amount_inr, b.venue_id
          `;
    const rows = await extra;
    if (!rows[0]) throw new Error("Booking not found");
    const row = rows[0] as {
      id: string;
      customer_phone: string;
      customer_name: string;
      start_at: unknown;
      pitch_index: number;
      amount_inr: number;
      venue_id: string;
    };
    const statusWord = STATUS_LABEL[data.status] ?? data.status;
    const body = [
      `Turf Community · ${access.venue.name}`,
      `${formatIstTime(toIso(row.start_at))} · Pitch ${row.pitch_index} is ${statusWord}.`,
      `${row.customer_name} · ${inr(Number(row.amount_inr))}`,
      data.status === "confirmed" ? "Show this at the gate. Arrive 10 minutes early." : "",
      data.status === "declined" || data.status === "cancelled"
        ? "The hour is free. Request another slot if you still want to play."
        : "",
      data.status === "checked_in" ? "You are on the pitch. Play the hour." : "",
      data.status === "checked_out" ? "Hour closed. Thank you." : "",
      data.status === "no_show" ? "Marked no-show. The hour is released." : "",
    ]
      .filter(Boolean)
      .join("\n");
    const { dispatchWhatsApp } = await import("./whatsapp.server");
    await dispatchWhatsApp({
      kind: "player_status",
      toPhone: row.customer_phone,
      body,
      bookingId: row.id,
      venueId: row.venue_id,
    });
    return { ok: true };
  });
import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { inr, isValidInPhone, normalizePhone, slugify } from "@/lib/utils";
import { addDays, formatIstTime, istDateTime, toIso, todayIst } from "./time";

const DEMO_USER = "system-demo";
const HOLD_STATUSES = ["pending", "confirmed", "checked_in"] as const;

export type Venue = {
  id: string; userId: string; slug: string; name: string; city: string; area: string;
  pitchCount: number; sport: string; priceInr: number; slotMinutes: number;
  openHour: number; closeHour: number; upiId: string; phone: string; notes: string;
};
export type Booking = {
  id: string; venueId: string; pitchIndex: number; startAt: string; endAt: string;
  status: string; source: string; customerName: string; customerPhone: string;
  notes: string; amountInr: number;
};
export type Slot = {
  startAt: string; endAt: string; label: string; openPitches: number; pitchCount: number;
  status: "open" | "held" | "past"; amountInr: number;
};

type VenueRow = {
  id: string; user_id: string; slug: string; name: string; city: string; area: string;
  pitch_count: number; sport: string; price_inr: number; slot_minutes: number;
  open_hour: number; close_hour: number; upi_id: string; phone: string; notes: string;
};
type BookingRow = {
  id: string; venue_id: string; pitch_index: number; start_at: unknown; end_at: unknown;
  status: string; source: string; customer_name: string; customer_phone: string;
  notes: string; amount_inr: number;
};

function mapVenue(row: VenueRow): Venue {
  return {
    id: row.id, userId: row.user_id, slug: row.slug, name: row.name, city: row.city,
    area: row.area, pitchCount: Number(row.pitch_count), sport: row.sport,
    priceInr: Number(row.price_inr), slotMinutes: Number(row.slot_minutes),
    openHour: Number(row.open_hour), closeHour: Number(row.close_hour),
    upiId: row.upi_id, phone: row.phone, notes: row.notes,
  };
}
function mapBooking(row: BookingRow): Booking {
  return {
    id: row.id, venueId: row.venue_id, pitchIndex: Number(row.pitch_index),
    startAt: toIso(row.start_at), endAt: toIso(row.end_at), status: row.status,
    source: row.source, customerName: row.customer_name, customerPhone: row.customer_phone,
    notes: row.notes, amountInr: Number(row.amount_inr),
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
        .filter((b) => HOLD_STATUSES.includes(b.status as (typeof HOLD_STATUSES)[number]) && new Date(b.startAt).getTime() < end.getTime() && new Date(b.endAt).getTime() > start.getTime())
        .map((b) => b.pitchIndex),
    );
    const openPitches = Math.max(0, venue.pitchCount - taken.size);
    const past = start.getTime() <= now;
    slots.push({ startAt: start.toISOString(), endAt: end.toISOString(), label: slotLabel(start, end), openPitches, pitchCount: venue.pitchCount, status: past ? "past" : openPitches === 0 ? "held" : "open", amountInr: amount });
  }
  return slots;
}
async function loadVenueBySlug(slug: string): Promise<Venue | null> {
  const sql = await getSql();
  const rows = await sql<VenueRow>`select * from venues where slug = ${slug} limit 1`;
  return rows[0] ? mapVenue(rows[0]) : null;
}
async function ensureDemo(): Promise<Venue> {
  const existing = await loadVenueBySlug("demo");
  if (existing) return existing;
  const sql = await getSql();
  const id = "venue-demo";
  await sql`insert into venues (id, user_id, slug, name, city, area, pitch_count, sport, price_inr, slot_minutes, open_hour, close_hour, upi_id, phone, notes) values (${id}, ${DEMO_USER}, 'demo', 'Greenfield Arena', 'Vadodara', 'Alkapuri', 2, '5-a-side football', 900, 60, 6, 23, 'greenfield@okaxis', '9876543210', 'Floodlit 5-a-side. Pay UPI before confirmation. Arrive 10 minutes early.') on conflict (slug) do nothing`;
  const today = todayIst();
  for (const hour of [19, 20]) {
    const start = istDateTime(today, hour, 0);
    if (start.getTime() < Date.now()) continue;
    const end = new Date(start.getTime() + 60 * 60_000);
    const bid = `seed-${today}-${hour}`;
    await sql`insert into bookings (id, venue_id, pitch_index, start_at, end_at, status, source, customer_name, customer_phone, notes, amount_inr) values (${bid}, ${id}, 1, ${start.toISOString()}, ${end.toISOString()}, 'confirmed', 'walkin', 'Walk-in side', '9998887776', '', 900) on conflict (id) do nothing`;
  }
  const venue = await loadVenueBySlug("demo");
  if (!venue) throw new Error("Could not seed demo turf");
  return venue;
}
async function bookingsOnDay(venueId: string, dateKey: string): Promise<Booking[]> {
  const sql = await getSql();
  const from = istDateTime(dateKey, 0, 0);
  const to = istDateTime(addDays(dateKey, 1), 0, 0);
  const rows = await sql<BookingRow>`select * from bookings where venue_id = ${venueId} and start_at >= ${from.toISOString()} and start_at < ${to.toISOString()} order by start_at asc, pitch_index asc`;
  return rows.map(mapBooking);
}

export const getPublicBoard = createServerFn({ method: "GET" })
  .validator((input: { slug: string; date: string }) => input)
  .handler(async ({ data }) => {
    const venue = data.slug === "demo" ? await ensureDemo() : await loadVenueBySlug(data.slug);
    if (!venue) return { venue: null, slots: [] as Slot[], date: data.date };
    const bookings = await bookingsOnDay(venue.id, data.date);
    return { venue, slots: buildSlots(venue, data.date, bookings), date: data.date };
  });

export const requestSlot = createServerFn({ method: "POST" })
  .validator((input: { slug: string; startAt: string; name: string; phone: string; notes?: string }) => input)
  .handler(async ({ data }) => {
    const name = data.name.trim();
    const phone = normalizePhone(data.phone);
    if (name.length < 2) throw new Error("Name is too short");
    if (!isValidInPhone(phone)) throw new Error("Enter a valid 10-digit Indian mobile");
    const venue = data.slug === "demo" ? await ensureDemo() : await loadVenueBySlug(data.slug);
    if (!venue) throw new Error("This turf link is not live");
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    if (Number.isNaN(start.getTime())) throw new Error("Pick a valid slot");
    if (end.getTime() <= Date.now()) throw new Error("That slot has already started");
    const sql = await getSql();
    const taken = await sql<{ pitch_index: number }>`select pitch_index from bookings where venue_id = ${venue.id} and status in ('pending','confirmed','checked_in') and start_at < ${end.toISOString()} and end_at > ${start.toISOString()}`;
    const used = new Set(taken.map((r) => Number(r.pitch_index)));
    let pitch = 0;
    for (let i = 1; i <= venue.pitchCount; i += 1) { if (!used.has(i)) { pitch = i; break; } }
    if (!pitch) throw new Error("That slot just filled. Pick another.");
    const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
    const id = crypto.randomUUID();
    await sql`insert into bookings (id, venue_id, pitch_index, start_at, end_at, status, source, customer_name, customer_phone, notes, amount_inr) values (${id}, ${venue.id}, ${pitch}, ${start.toISOString()}, ${end.toISOString()}, 'pending', 'link', ${name}, ${phone}, ${data.notes?.trim() ?? ""}, ${amount})`;
    const payLine = venue.upiId ? `Pay ${inr(amount)} to ${venue.upiId} and wait for confirmation.` : `Pay ${inr(amount)} at the counter. The owner will confirm the slot.`;
    const message = [`Slot request · ${venue.name}`, `${slotLabel(start, end)} · Pitch ${pitch}`, `${name} · ${phone}`, payLine].join("\n");
    return { id, pitch, amountInr: amount, label: slotLabel(start, end), venueName: venue.name, upiId: venue.upiId, message };
  });

export const getMyDesk = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { date: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await getSql();
    const rows = await sql<VenueRow>`select * from venues where user_id = ${context.userId} order by created_at asc limit 1`;
    const venue = rows[0] ? mapVenue(rows[0]) : null;
    if (!venue) return { venue: null, bookings: [] as Booking[], slots: [] as Slot[], stats: null };
    const bookings = await bookingsOnDay(venue.id, data.date);
    const slots = buildSlots(venue, data.date, bookings);
    const pending = bookings.filter((b) => b.status === "pending").length;
    const tonight = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status)).length;
    const collected = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.status)).reduce((sum, b) => sum + b.amountInr, 0);
    return { venue, bookings, slots, stats: { pending, tonight, collected } };
  });

export const saveVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; city: string; area: string; pitchCount: number; priceInr: number; slotMinutes: number; openHour: number; closeHour: number; upiId: string; phone: string; notes: string }) => input)
  .handler(async ({ context, data }) => {
    const name = data.name.trim();
    if (name.length < 2) throw new Error("Give the turf a name");
    const priceInr = Math.max(100, Math.min(20000, Math.round(data.priceInr) || 800));
    const pitchCount = Math.max(1, Math.min(6, Math.round(data.pitchCount) || 1));
    const slotMinutes = [60, 90, 120].includes(data.slotMinutes) ? data.slotMinutes : 60;
    const openHour = Math.max(0, Math.min(22, data.openHour));
    const closeHour = Math.max(openHour + 1, Math.min(24, data.closeHour));
    const sql = await getSql();
    const existing = await sql<VenueRow>`select * from venues where user_id = ${context.userId} order by created_at asc limit 1`;
    if (existing[0]) {
      await sql`update venues set name = ${name}, city = ${data.city.trim() || "Vadodara"}, area = ${data.area.trim()}, pitch_count = ${pitchCount}, price_inr = ${priceInr}, slot_minutes = ${slotMinutes}, open_hour = ${openHour}, close_hour = ${closeHour}, upi_id = ${data.upiId.trim()}, phone = ${normalizePhone(data.phone)}, notes = ${data.notes.trim()} where id = ${existing[0].id} and user_id = ${context.userId}`;
      return mapVenue({ ...existing[0], name, city: data.city.trim() || "Vadodara" });
    }
    let slug = slugify(name);
    const clash = await sql<{ slug: string }>`select slug from venues where slug = ${slug}`;
    if (clash[0]) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
    const id = crypto.randomUUID();
    await sql`insert into venues (id, user_id, slug, name, city, area, pitch_count, sport, price_inr, slot_minutes, open_hour, close_hour, upi_id, phone, notes) values (${id}, ${context.userId}, ${slug}, ${name}, ${data.city.trim() || "Vadodara"}, ${data.area.trim()}, ${pitchCount}, '5-a-side football', ${priceInr}, ${slotMinutes}, ${openHour}, ${closeHour}, ${data.upiId.trim()}, ${normalizePhone(data.phone)}, ${data.notes.trim()})`;
    const rows = await sql<VenueRow>`select * from venues where id = ${id} and user_id = ${context.userId}`;
    return mapVenue(rows[0]);
  });

export const addWalkIn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { startAt: string; name: string; phone: string }) => input)
  .handler(async ({ context, data }) => {
    const name = data.name.trim() || "Walk-in";
    const phone = normalizePhone(data.phone);
    const sql = await getSql();
    const rows = await sql<VenueRow>`select * from venues where user_id = ${context.userId} limit 1`;
    if (!rows[0]) throw new Error("Set up your turf first");
    const venue = mapVenue(rows[0]);
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    const taken = await sql<{ pitch_index: number }>`select pitch_index from bookings where venue_id = ${venue.id} and status in ('pending','confirmed','checked_in') and start_at < ${end.toISOString()} and end_at > ${start.toISOString()}`;
    const used = new Set(taken.map((r) => Number(r.pitch_index)));
    let pitch = 0;
    for (let i = 1; i <= venue.pitchCount; i += 1) { if (!used.has(i)) { pitch = i; break; } }
    if (!pitch) throw new Error("No pitch free on that slot");
    const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
    const id = crypto.randomUUID();
    await sql`insert into bookings (id, venue_id, pitch_index, start_at, end_at, status, source, customer_name, customer_phone, notes, amount_inr) values (${id}, ${venue.id}, ${pitch}, ${start.toISOString()}, ${end.toISOString()}, 'confirmed', 'walkin', ${name}, ${phone || "0000000000"}, 'Walk-in at gate', ${amount})`;
    return { id };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => input)
  .handler(async ({ context, data }) => {
    const allowed = ["confirmed", "declined", "cancelled", "checked_in", "no_show"];
    if (!allowed.includes(data.status)) throw new Error("Unknown action");
    const sql = await getSql();
    const rows = await sql<{ id: string }>`update bookings b set status = ${data.status} from venues v where b.id = ${data.id} and b.venue_id = v.id and v.user_id = ${context.userId} returning b.id`;
    if (!rows[0]) throw new Error("Booking not found");
    return { ok: true };
  });

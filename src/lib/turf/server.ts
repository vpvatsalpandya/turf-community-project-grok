import { createServerFn } from "@tanstack/react-start";
import { dbSource, getSql, withTransaction } from "@/lib/db";
import { authMiddleware, optionalAuthMiddleware } from "@/lib/auth/middleware";
import { inr, isValidInPhone, normalizePhone, slugify } from "@/lib/utils";
import { AREA_PINS } from "./geo";
import {
  demoAllowed,
  formatHoldLeft,
  HOLD_MINUTES,
  hourBucketIst,
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
import { canExportCustomers, canMergeCustomers, canSeeReports, canShareLink, isDeskRole } from "./demo-logins";
import {
  blockSlot as engineBlockSlot,
  createBooking,
  ensureResources,
  expireHolds,
  isOccupyingStatus,
  isRequestedStatus,
  listBlackouts,
  SlotError,
  transitionBooking,
  unblockSlot as engineUnblockSlot,
  type EngineBlackout,
  type TransitionTo,
} from "./engine";
import {
  buildReports,
  customersCsv,
  mergeCustomers,
  reportWindow,
  resolveCustomer,
  type ReportBooking,
} from "./desk";
import {
  filledTemplate,
  isTemplateKind,
  varsFor,
  type SavedTemplate,
  type TemplateKind,
} from "./messages";

export { getMyProfile, listPlayerNights, listAdminBoard, prepareDemoLogins, listTeam, addTeamMember, removeTeamMember, claimSignupRole } from "./accounts";
export type { PlayerBooking, TeamMember } from "./accounts";

const BILLED_STATUSES = ["confirmed", "checked_in", "checked_out", "completed"] as const;

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
  closeMinutes: number;
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
  resourceId: string;
  pitchIndex: number;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  customerName: string;
  customerPhone: string;
  notes: string;
  amountInr: number;
  amountPaise: number;
  createdAt: string;
  holdUntil: string | null;
  holdLeft: string | null;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  declineReason: string | null;
  paymentMode: string;
};

export type Resource = {
  id: string;
  venueId: string;
  name: string;
  pitchIndex: number;
};

export type WaitlistRow = {
  id: string;
  venueId: string;
  resourceId: string;
  startAt: string;
  endAt: string;
  customerName: string;
  customerPhone: string;
  status: string;
  resourceName: string;
};

export type DeskCustomer = {
  id: string;
  phone: string;
  name: string;
  visits: number;
  spendInr: number;
  noShows: number;
  lastSeenAt: string | null;
};

export type Blackout = EngineBlackout;

export type SavedMessage = SavedTemplate;

export type Slot = {
  startAt: string;
  endAt: string;
  label: string;
  openPitches: number;
  pitchCount: number;
  requestCount: number;
  heldPitches: number;
  status: "open" | "full" | "past" | "blocked";
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
  close_minutes?: number | null;
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
  resource_id?: string | null;
  pitch_index: number;
  start_at: unknown;
  end_at: unknown;
  status: string;
  source: string;
  customer_name: string;
  customer_phone: string;
  notes: string;
  amount_inr: number;
  amount_paise?: number | null;
  created_at?: unknown;
  hold_until?: unknown;
  checked_in_at?: unknown;
  checked_out_at?: unknown;
  decline_reason?: string | null;
  payment_mode?: string | null;
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
    closeMinutes: Number(row.close_minutes ?? row.close_hour * 60),
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
  const paise = row.amount_paise != null ? Number(row.amount_paise) : Number(row.amount_inr) * 100;
  const left =
    isRequestedStatus(row.status) && holdUntil
      ? formatHoldLeft(Math.max(0, new Date(holdUntil).getTime() - Date.now()))
      : null;
  return {
    id: row.id,
    venueId: row.venue_id,
    resourceId: row.resource_id || `${row.venue_id}:p${row.pitch_index}`,
    pitchIndex: Number(row.pitch_index),
    startAt: toIso(row.start_at),
    endAt: toIso(row.end_at),
    status: row.status === "pending" ? "requested" : row.status,
    source: row.source,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    amountInr: Math.round(paise / 100),
    amountPaise: paise,
    createdAt,
    holdUntil,
    holdLeft: left && left.startsWith("0") ? "expiring" : left,
    checkedInAt: row.checked_in_at ? toIso(row.checked_in_at) : null,
    checkedOutAt: row.checked_out_at ? toIso(row.checked_out_at) : null,
    declineReason: row.decline_reason ?? null,
    paymentMode: row.payment_mode ?? "",
  };
}

function slotLabel(start: Date, end: Date) {
  return `${formatIstTime(start)} – ${formatIstTime(end)}`;
}

function overlaps(aStart: string, aEnd: string, bStart: number, bEnd: number) {
  return new Date(aStart).getTime() < bEnd && new Date(aEnd).getTime() > bStart;
}

function buildSlots(
  venue: Venue,
  dateKey: string,
  bookings: Booking[],
  blackouts: EngineBlackout[] = [],
): Slot[] {
  const now = Date.now();
  const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
  const slots: Slot[] = [];
  const closeMs = venue.closeMinutes || venue.closeHour * 60;
  for (let minutes = venue.openHour * 60; minutes + venue.slotMinutes <= closeMs; minutes += venue.slotMinutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    const start = istDateTime(dateKey, h, m);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    const startMs = start.getTime();
    const endMs = end.getTime();
    const occupying = new Set(
      bookings
        .filter((b) => isOccupyingStatus(b.status) && overlaps(b.startAt, b.endAt, startMs, endMs))
        .map((b) => b.pitchIndex),
    );
    const rained = new Set<number>();
    for (const bl of blackouts) {
      if (overlaps(bl.startAt, bl.endAt, startMs, endMs)) {
        occupying.add(bl.pitchIndex);
        rained.add(bl.pitchIndex);
      }
    }
    const requested = bookings.filter(
      (b) => isRequestedStatus(b.status) && overlaps(b.startAt, b.endAt, startMs, endMs),
    );
    const heldPitchSet = new Set(
      requested
        .filter((b) => b.holdUntil && new Date(b.holdUntil).getTime() > now)
        .map((b) => b.pitchIndex),
    );
    const heldPitches = heldPitchSet.size;
    const blockedPitches = new Set([...occupying, ...heldPitchSet]);
    const openPitches = Math.max(0, venue.pitchCount - blockedPitches.size);
    const past = startMs <= now;
    const full = occupying.size >= venue.pitchCount;
    const onlyRain = full && occupying.size === rained.size;
    slots.push({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      label: slotLabel(start, end),
      openPitches,
      pitchCount: venue.pitchCount,
      requestCount: requested.length,
      heldPitches,
      status: past ? "past" : onlyRain ? "blocked" : full ? "full" : "open",
      amountInr: amount,
    });
  }
  return slots;
}

async function blackoutsOnDay(venueId: string, dateKey: string) {
  const sql = await getSql();
  return listBlackouts(sql, {
    venueId,
    from: istDateTime(dateKey, 0, 0),
    to: istDateTime(addDays(dateKey, 1), 6, 0),
  });
}

async function loadSavedTemplates(venueId: string): Promise<SavedTemplate[]> {
  const sql = await getSql();
  const rows = await sql<{ kind: string; language: string; body: string }>`
    select kind, language, body from message_templates
    where venue_id = ${venueId}
  `;
  return rows
    .filter((r) => isTemplateKind(r.kind) && (r.language === "en" || r.language === "hi"))
    .map((r) => ({
      kind: r.kind as TemplateKind,
      language: r.language as "en" | "hi",
      body: r.body,
    }));
}

async function expireStaleHolds(venueId?: string) {
  const sql = await getSql();
  await expireHolds(sql, venueId);
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
    const sql = await getSql();
    await ensureResources(sql, existing.id, existing.pitchCount);
    await attachDemoVenue(existing.id);
    return (await loadVenueBySlug("demo")) ?? existing;
  }
  const sql = await getSql();
  const id = "venue-demo";
  const ownerId = "user-demo-owner";
  await sql`
    insert into venues (
      id, user_id, slug, name, city, area, address, pitch_count, sport, price_inr,
      slot_minutes, open_hour, close_hour, close_minutes, upi_id, phone, notes, lat, lng
    ) values (
      ${id}, ${ownerId}, 'demo', 'Greenfield Arena', 'Vadodara', 'Alkapuri',
      'Alkapuri, Vadodara, Gujarat', 2, '5-a-side football', 900, 60, 6, 23, 1380,
      'greenfield@okaxis', '9876543210',
      'Floodlit 5-a-side. Pay UPI before confirmation. Arrive 10 minutes early.',
      22.3132, 73.1718
    )
    on conflict (slug) do nothing
  `;
  await ensureResources(sql, id, 2);
  const today = todayIst();
  const seedHours = [19, 20];
  for (const hour of seedHours) {
    const start = istDateTime(today, hour, 0);
    if (start.getTime() < Date.now()) continue;
    const end = new Date(start.getTime() + 60 * 60_000);
    const bid = `seed-${today}-${hour}`;
    await sql`
      insert into bookings (
        id, venue_id, resource_id, pitch_index, start_at, end_at, status, source,
        customer_name, customer_phone, notes, amount_inr, amount_paise
      ) values (
        ${bid}, ${id}, ${`${id}:p1`}, 1, ${start.toISOString()}, ${end.toISOString()},
        'confirmed', 'walkin', 'Walk-in side', '9998887776', '', 900, 90000
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
  return { demo: demoAllowed(), holdMinutes: HOLD_MINUTES, persist: dbSource === "neon" };
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
    try {
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
    if (!venue) return { venue: null, slots: [] as Slot[], date: data.date, holdMinutes: HOLD_MINUTES, persist: dbSource === "neon" };
    const bookings = await bookingsOnDay(venue.id, data.date);
    const blackouts = await blackoutsOnDay(venue.id, data.date);
    return { venue, slots: buildSlots(venue, data.date, bookings, blackouts), date: data.date, holdMinutes: HOLD_MINUTES, persist: dbSource === "neon" };
    } catch {
      return { venue: null, slots: [] as Slot[], date: data.date, holdMinutes: HOLD_MINUTES, persist: dbSource === "neon" };
    }
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
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    if (Number.isNaN(start.getTime())) throw new Error("Pick a valid slot");
    const amount = Math.round((venue.priceInr * venue.slotMinutes) / 60);
    let booked;
    try {
      booked = await withTransaction(async (tx) =>
        createBooking(tx, {
          venueId: venue.id,
          periodStart: start,
          periodEnd: end,
          actor: { id: context.userId || `guest:${phone}`, role: "player" },
          customerPhone: phone,
          customerName: name,
          amountPaise: amount * 100,
          idempotencyKey: `link:${venue.id}:${start.toISOString()}:${phone}`,
          source: "link",
          notes: data.notes,
        }),
      );
    } catch (err) {
      if (err instanceof SlotError) {
        if (err.code === "SLOT_IN_THE_PAST") throw new Error("That slot has already started");
        if (err.code === "SLOT_UNAVAILABLE") throw new Error("That slot just filled. Pick another.");
        throw new Error(err.message);
      }
      throw err;
    }
    const id = booked.id;
    const pitch = booked.pitchIndex;
    const holdUntil = booked.holdUntil;
    const held = Boolean(holdUntil);
    const payLine = venue.upiId
      ? `Pay ${inr(amount)} to ${venue.upiId} and wait for confirmation.`
      : `Pay ${inr(amount)} at the counter. The owner will confirm the slot.`;
    const label = slotLabel(start, end);
    const message = [
      `Slot request · ${venue.name}`,
      `${label} · Pitch ${pitch}`,
      `${name} · ${phone}`,
      payLine,
      held
        ? `Hold drops in ${HOLD_MINUTES} min if not confirmed.`
        : "Request is in. The owner confirms after UPI — this hour is not held for you yet.",
    ].join("\n");
    const ownerText = [
      `New request · ${venue.name}`,
      `${label} · Pitch ${pitch} · ${inr(amount)}`,
      `${name} · ${phone}`,
      data.notes?.trim() ? `Note: ${data.notes.trim()}` : "",
      held
        ? `Confirm on the desk in ${HOLD_MINUTES} min or the hold drops.`
        : "Another request already holds this hour. Accept one, the rest drop.",
    ]
      .filter(Boolean)
      .join("\n");
    const playerText = [
      `Turf Community · ${venue.name}`,
      held
        ? `${label} · Pitch ${pitch} is held for ${HOLD_MINUTES} min.`
        : `${label} · Pitch ${pitch} request is in. The owner picks one side after UPI.`,
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
      holdUntil: holdUntil ?? "",
      held,
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
        resources: [] as Resource[],
        waitlist: [] as WaitlistRow[],
        noshowCandidates: [] as Booking[],
        blackouts: [] as Blackout[],
        templates: [] as SavedTemplate[],
        stats: null,
        holdMinutes: HOLD_MINUTES,
        persist: dbSource === "neon",
      };
    }
    const sql = await getSql();
    await ensureResources(sql, venue.id, venue.pitchCount);
    const bookings = await bookingsOnDay(venue.id, data.date);
    const blackouts = await blackoutsOnDay(venue.id, data.date);
    const slots = buildSlots(venue, data.date, bookings, blackouts);
    const pending = bookings.filter((b) => isRequestedStatus(b.status)).length;
    const tonight = bookings.filter((b) => BILLED_STATUSES.includes(b.status as (typeof BILLED_STATUSES)[number])).length;
    const collected = bookings
      .filter((b) => BILLED_STATUSES.includes(b.status as (typeof BILLED_STATUSES)[number]))
      .reduce((sum, b) => sum + b.amountInr, 0);
    const resourceRows = await sql<{ id: string; venue_id: string; name: string; pitch_index: number }>`
      select id, venue_id, name, pitch_index from resources
      where venue_id = ${venue.id}
      order by pitch_index asc
    `;
    const waitRows = await sql<{
      id: string;
      venue_id: string;
      resource_id: string;
      start_at: unknown;
      end_at: unknown;
      customer_name: string;
      customer_phone: string;
      status: string;
      resource_name: string | null;
    }>`
      select w.id, w.venue_id, w.resource_id, w.start_at, w.end_at, w.customer_name, w.customer_phone, w.status,
             coalesce(r.name, 'Pitch') as resource_name
      from waitlist w
      left join resources r on r.id = w.resource_id
      where w.venue_id = ${venue.id}
        and w.status in ('waiting', 'notified')
        and w.start_at >= ${istDateTime(data.date, 0, 0).toISOString()}
      order by w.created_at asc
    `;
    const waitlist: WaitlistRow[] = waitRows.map((w) => ({
      id: w.id,
      venueId: w.venue_id,
      resourceId: w.resource_id,
      startAt: toIso(w.start_at),
      endAt: toIso(w.end_at),
      customerName: w.customer_name,
      customerPhone: w.customer_phone,
      status: w.status,
      resourceName: w.resource_name || "Pitch",
    }));
    const nowIso = new Date().toISOString();
    const noshowCandidates = bookings.filter(
      (b) => b.status === "confirmed" && b.endAt < nowIso,
    );
    const templates = await loadSavedTemplates(venue.id);
    return {
      venue,
      role: access.role,
      bookings,
      slots,
      resources: resourceRows.map((r) => ({
        id: r.id,
        venueId: r.venue_id,
        name: r.name,
        pitchIndex: Number(r.pitch_index),
      })),
      waitlist,
      noshowCandidates,
      blackouts,
      templates,
      stats: { pending, tonight, collected, waitlist: waitlist.filter((w) => w.status === "waiting").length },
      holdMinutes: HOLD_MINUTES,
      persist: dbSource === "neon",
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
    const openHour = Math.max(0, Math.min(23, data.openHour));
    const closeHour = Math.max(openHour + 1, Math.min(26, data.closeHour));
    const closeMinutes = closeHour * 60;
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
          close_minutes = ${closeMinutes},
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
      await ensureResources(sql, existing[0].id, pitchCount);
      return mapVenue(rows[0]);
    }
    let slug = slugify(name);
    const clash = await sql<{ slug: string }>`select slug from venues where slug = ${slug}`;
    if (clash[0]) slug = `${slug}-${crypto.randomUUID().slice(0, 4)}`;
    const id = crypto.randomUUID();
    await sql`
      insert into venues (
        id, user_id, slug, name, city, area, address, pitch_count, sport, price_inr,
        slot_minutes, open_hour, close_hour, close_minutes, upi_id, phone, notes, lat, lng, photos
      ) values (
        ${id}, ${context.userId}, ${slug}, ${name}, ${city}, ${area}, ${address}, ${pitchCount},
        ${sport}, ${priceInr}, ${slotMinutes}, ${openHour}, ${closeHour}, ${closeMinutes},
        ${data.upiId.trim()}, ${phone}, ${data.notes.trim()}, ${lat}, ${lng}, ${photoJson}::jsonb
      )
    `;
    const rows = await sql<VenueRow>`select * from venues where id = ${id} and user_id = ${context.userId}`;
    await sql`
      update profiles set venue_id = ${id} where user_id = ${context.userId}
    `;
    await ensureResources(sql, id, pitchCount);
    return mapVenue(rows[0]);
  });

export const addWalkIn = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    startAt: string;
    name: string;
    phone: string;
    resourceId?: string;
    amountPaise?: number;
    paymentMode?: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const name = data.name.trim() || "Walk-in";
    const phone = normalizePhone(data.phone);
    if (!isValidInPhone(phone)) throw new Error("Enter a 10-digit Indian mobile");
    const access = await loadDeskAccess(context.userId);
    if (!access.venue) throw new Error("Set up your turf first");
    if (!isDeskRole(access.role)) throw new Error("Not a desk login");
    const venue = access.venue;
    const start = new Date(data.startAt);
    const end = new Date(start.getTime() + venue.slotMinutes * 60_000);
    const amountPaise =
      data.amountPaise != null && Number.isInteger(data.amountPaise)
        ? data.amountPaise
        : Math.round((venue.priceInr * venue.slotMinutes) / 60) * 100;
    try {
      const booked = await withTransaction(async (tx) =>
        createBooking(tx, {
          venueId: venue.id,
          resourceId: data.resourceId,
          periodStart: start,
          periodEnd: end,
          actor: { id: context.userId, role: access.role },
          customerPhone: phone,
          customerName: name,
          amountPaise,
          idempotencyKey: `walkin:${context.userId}:${data.resourceId ?? "any"}:${start.toISOString()}`,
          source: "walkin",
          paymentMode: data.paymentMode ?? "cash",
        }),
      );
      return { id: booked.id, shareText: booked.shareText ?? "" };
    } catch (err) {
      if (err instanceof SlotError) {
        if (err.code === "SLOT_UNAVAILABLE") throw new Error("No pitch free on that slot");
        if (err.code === "SLOT_IN_THE_PAST") throw new Error("That slot has already finished");
        throw new Error(err.message);
      }
      throw err;
    }
  });

const STATUS_LABEL: Record<string, string> = {
  confirmed: "CONFIRMED",
  declined: "DECLINED",
  cancelled: "CANCELLED",
  checked_in: "CHECKED IN",
  checked_out: "CHECKED OUT",
  completed: "CHECKED OUT",
  no_show: "NO SHOW",
};

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string; status: string }) => input)
  .handler(async ({ context, data }) => {
    const allowed: TransitionTo[] = [
      "confirmed",
      "declined",
      "cancelled",
      "checked_in",
      "checked_out",
      "completed",
      "no_show",
    ];
    if (!allowed.includes(data.status as TransitionTo)) throw new Error("Unknown action");
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    let booked;
    try {
      booked = await withTransaction(async (tx) =>
        transitionBooking(tx, {
          bookingId: data.id,
          to: data.status as TransitionTo,
          actor: { id: context.userId, role: access.role },
        }),
      );
    } catch (err) {
      if (err instanceof SlotError) {
        if (err.code === "SLOT_UNAVAILABLE") throw new Error("That hour is already taken");
        throw new Error(err.message);
      }
      throw err;
    }
    const statusWord = STATUS_LABEL[data.status] ?? data.status;
    const body = [
      `Turf Community · ${access.venue.name}`,
      `${formatIstTime(booked.startAt)} · Pitch ${booked.pitchIndex} is ${statusWord}.`,
      `${booked.customerName} · ${inr(booked.amountInr)}`,
      data.status === "confirmed" ? "Show this at the gate. Arrive 10 minutes early." : "",
      data.status === "declined" || data.status === "cancelled"
        ? "The hour is free. Request another slot if you still want to play."
        : "",
      data.status === "checked_in" ? "You are on the pitch. Play the hour." : "",
      data.status === "checked_out" || data.status === "completed" ? "Hour closed. Thank you." : "",
      data.status === "no_show" ? "Marked no-show. The hour is released." : "",
    ]
      .filter(Boolean)
      .join("\n");
    const { dispatchWhatsApp } = await import("./whatsapp.server");
    await dispatchWhatsApp({
      kind: "player_status",
      toPhone: booked.customerPhone,
      body,
      bookingId: booked.id,
      venueId: booked.venueId,
    });
    let waiters: WaitlistRow[] = [];
    if (data.status === "cancelled" || data.status === "no_show") {
      const sql = await getSql();
      const rows = await sql<{
        id: string;
        venue_id: string;
        resource_id: string;
        start_at: unknown;
        end_at: unknown;
        customer_name: string;
        customer_phone: string;
        status: string;
        resource_name: string | null;
      }>`
        select w.id, w.venue_id, w.resource_id, w.start_at, w.end_at, w.customer_name, w.customer_phone, w.status,
               coalesce(r.name, 'Pitch') as resource_name
        from waitlist w
        left join resources r on r.id = w.resource_id
        where w.venue_id = ${booked.venueId}
          and w.resource_id = ${booked.resourceId}
          and w.start_at = ${booked.startAt}
          and w.status in ('waiting', 'notified')
        order by w.created_at asc
      `;
      waiters = rows.map((w) => ({
        id: w.id,
        venueId: w.venue_id,
        resourceId: w.resource_id,
        startAt: toIso(w.start_at),
        endAt: toIso(w.end_at),
        customerName: w.customer_name,
        customerPhone: w.customer_phone,
        status: w.status,
        resourceName: w.resource_name || "Pitch",
      }));
    }
    const shareKind: TemplateKind | null =
      data.status === "confirmed"
        ? "request_confirmed"
        : data.status === "declined"
          ? "request_declined"
          : data.status === "cancelled"
            ? "cancellation"
            : null;
    let shareText = booked.shareText ?? body;
    if (shareKind && access.venue) {
      const saved = await loadSavedTemplates(access.venue.id);
      shareText = filledTemplate(
        shareKind,
        "hi",
        varsFor({
          customerName: booked.customerName,
          venueName: access.venue.name,
          resourceName: `Pitch ${booked.pitchIndex}`,
          startAt: booked.startAt,
          endAt: booked.endAt,
          amountInr: booked.amountInr,
          upiId: access.venue.upiId,
          venuePhone: access.venue.phone,
          ref: booked.id.replace(/-/g, "").slice(0, 6),
        }),
        saved,
      );
    }
    return {
      ok: true,
      shareText,
      declinedCount: booked.declinedCount ?? 0,
      waiters,
    };
  });

export const lookupCustomer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { phone: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) return { name: "", visits: 0 };
    const phone = normalizePhone(data.phone);
    if (!phone) return { name: "", visits: 0 };
    const sql = await getSql();
    const aliased = await resolveCustomer(sql, { venueId: access.venue.id, phone });
    if (aliased) return { name: aliased.name, visits: aliased.visits, phone: aliased.phone };
    const last = await sql<{ customer_name: string }>`
      select customer_name from bookings
      where venue_id = ${access.venue.id} and customer_phone = ${phone}
      order by created_at desc
      limit 1
    `;
    return { name: last[0]?.customer_name ?? "", visits: last[0] ? 1 : 0, phone };
  });

export const addWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: {
    resourceId: string;
    startAt: string;
    endAt: string;
    name: string;
    phone: string;
  }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    const phone = normalizePhone(data.phone);
    if (!isValidInPhone(phone)) throw new Error("Enter a valid 10-digit Indian mobile");
    const sql = await getSql();
    await sql`
      insert into waitlist (
        id, venue_id, resource_id, start_at, end_at, customer_name, customer_phone, status
      ) values (
        ${crypto.randomUUID()}, ${access.venue.id}, ${data.resourceId},
        ${data.startAt}, ${data.endAt}, ${data.name.trim() || "Waitlist"}, ${phone}, 'waiting'
      )
    `;
    return { ok: true };
  });


export const notifyWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { waitlistId: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    const sql = await getSql();
    const rows = await sql<{
      id: string;
      customer_name: string;
      customer_phone: string;
      start_at: unknown;
      resource_id: string;
      status: string;
      resource_name: string | null;
    }>`
      select w.id, w.customer_name, w.customer_phone, w.start_at, w.resource_id, w.status,
             coalesce(r.name, 'Pitch') as resource_name
      from waitlist w
      left join resources r on r.id = w.resource_id
      where w.id = ${data.waitlistId} and w.venue_id = ${access.venue.id}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("Waitlist row not found");
    await sql`update waitlist set status = 'notified' where id = ${row.id}`;
    const saved = await loadSavedTemplates(access.venue.id);
    const message = filledTemplate(
      "waitlist_open",
      "hi",
      varsFor({
        customerName: row.customer_name,
        venueName: access.venue.name,
        resourceName: row.resource_name || "Pitch",
        startAt: toIso(row.start_at),
        amountInr: access.venue.priceInr,
        upiId: access.venue.upiId,
        venuePhone: access.venue.phone,
      }),
      saved,
    );
    return { ok: true as const, message, phone: row.customer_phone };
  });

export const cancelWaitlist = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { waitlistId: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    const sql = await getSql();
    await sql`
      update waitlist set status = 'removed'
      where id = ${data.waitlistId} and venue_id = ${access.venue.id}
    `;
    return { ok: true as const };
  });

export const blockHour = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { resourceId: string; startAt: string; endAt: string; reason: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    const reason = data.reason.trim() || "Rain";
    try {
      return await withTransaction(async (tx) =>
        engineBlockSlot(tx, {
          venueId: access.venue!.id,
          resourceId: data.resourceId,
          periodStart: data.startAt,
          periodEnd: data.endAt,
          reason,
          actor: { id: context.userId, role: access.role },
        }),
      );
    } catch (err) {
      if (err instanceof SlotError) {
        if (err.code === "SLOT_UNAVAILABLE") throw new Error("That hour is already taken");
        throw new Error(err.message);
      }
      throw err;
    }
  });

export const unblockHour = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { id: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) throw new Error("Not a desk login");
    try {
      return await withTransaction(async (tx) =>
        engineUnblockSlot(tx, { id: data.id, actor: { id: context.userId, role: access.role } }),
      );
    } catch (err) {
      if (err instanceof SlotError) throw new Error(err.message);
      throw err;
    }
  });

export const listCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { q?: string }) => input)
  .handler(async ({ context, data }): Promise<DeskCustomer[]> => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) return [];
    const sql = await getSql();
    const cards = await sql<{
      id: string;
      phone: string;
      name: string;
      visits: number;
      last_seen_at: unknown;
    }>`
      select id, phone, name, visits, last_seen_at
      from customers
      where venue_id = ${access.venue.id}
      order by last_seen_at desc
    `;
    const spend = await sql<{
      customer_phone: string;
      visits: number;
      spend_paise: number;
      no_shows: number;
      last_seen: unknown;
      last_name: string;
    }>`
      select customer_phone,
             count(*) filter (where status in ('confirmed','checked_in','checked_out','completed'))::int as visits,
             coalesce(sum(amount_paise) filter (where status in ('confirmed','checked_in','checked_out','completed')), 0)::bigint as spend_paise,
             count(*) filter (where status = 'no_show')::int as no_shows,
             max(created_at) as last_seen,
             (array_agg(customer_name order by created_at desc))[1] as last_name
      from bookings
      where venue_id = ${access.venue.id}
      group by customer_phone
    `;
    const byPhone = new Map(spend.map((s) => [s.customer_phone, s]));
    const seen = new Set<string>();
    const out: DeskCustomer[] = [];
    for (const c of cards) {
      seen.add(c.phone);
      const s = byPhone.get(c.phone);
      out.push({
        id: c.id,
        phone: c.phone,
        name: c.name || s?.last_name || "",
        visits: s ? Number(s.visits) : Number(c.visits),
        spendInr: s ? Math.round(Number(s.spend_paise) / 100) : 0,
        noShows: s ? Number(s.no_shows) : 0,
        lastSeenAt: toIso(s?.last_seen ?? c.last_seen_at),
      });
    }
    for (const s of spend) {
      if (seen.has(s.customer_phone)) continue;
      out.push({
        id: `phone:${s.customer_phone}`,
        phone: s.customer_phone,
        name: s.last_name || "",
        visits: Number(s.visits),
        spendInr: Math.round(Number(s.spend_paise) / 100),
        noShows: Number(s.no_shows),
        lastSeenAt: toIso(s.last_seen),
      });
    }
    const q = (data.q ?? "").trim().toLowerCase();
    const filtered = q
      ? out.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q))
      : out;
    filtered.sort((a, b) => b.visits - a.visits || b.spendInr - a.spendInr);
    return filtered;
  });

export const mergeDeskCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { keepPhone: string; absorbPhone: string }) => input)
  .handler(async ({ context, data }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !canMergeCustomers(access.role)) throw new Error("Only the owner can merge");
    const keepPhone = normalizePhone(data.keepPhone);
    const absorbPhone = normalizePhone(data.absorbPhone);
    return withTransaction((tx) =>
      mergeCustomers(tx, { venueId: access.venue!.id, keepPhone, absorbPhone }),
    );
  });

export const exportCustomers = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !canExportCustomers(access.role)) throw new Error("Only the owner can export");
    const rows = await listCustomers({ data: { q: "" } });
    return { csv: customersCsv(rows), rowCount: rows.length };
  });

export const getReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !canSeeReports(access.role)) {
      throw new Error("Reports are on the manager and owner desks");
    }
    const venue = access.venue;
    const today = todayIst();
    const { fromKey, toKey } = reportWindow(today, 28);
    const sql = await getSql();
    const from = istDateTime(fromKey, 0, 0);
    const to = istDateTime(addDays(toKey, 1), 0, 0);
    const rows = await sql<{
      start_at: unknown;
      status: string;
      amount_paise: number | null;
      amount_inr: number;
      payment_mode: string | null;
      customer_name: string;
      customer_phone: string;
      resource_id: string | null;
      pitch_index: number;
      checked_in_at: unknown;
      resource_name: string | null;
    }>`
      select b.start_at, b.status, b.amount_paise, b.amount_inr, b.payment_mode,
             b.customer_name, b.customer_phone, b.resource_id, b.pitch_index, b.checked_in_at,
             coalesce(r.name, 'Pitch ' || b.pitch_index) as resource_name
      from bookings b
      left join resources r on r.id = b.resource_id
      where b.venue_id = ${venue.id}
        and b.start_at >= ${from.toISOString()}
        and b.start_at < ${to.toISOString()}
    `;
    const bookings: ReportBooking[] = rows.map((b) => ({
      startAt: toIso(b.start_at),
      status: b.status,
      amountPaise: Number(b.amount_paise ?? b.amount_inr * 100),
      paymentMode: b.payment_mode || "",
      customerName: b.customer_name,
      customerPhone: b.customer_phone,
      resourceName: b.resource_name || `Pitch ${b.pitch_index}`,
      pitchIndex: Number(b.pitch_index),
      checkedInAt: b.checked_in_at ? toIso(b.checked_in_at) : null,
    }));
    return buildReports({
      bookings,
      pitchCount: venue.pitchCount,
      fromKey,
      toKey,
      todayKey: today,
    });
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { kind: string; language: "en" | "hi"; body: string }) => input)
  .handler(async ({ context, data }) => {
    if (!isTemplateKind(data.kind)) throw new Error("Unknown template");
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !canShareLink(access.role)) throw new Error("Not allowed");
    const body = data.body.trim();
    if (body.length < 1 || body.length > 2000) throw new Error("Keep the message under 2000 characters");
    const sql = await getSql();
    await sql`
      insert into message_templates (venue_id, kind, language, body, updated_at)
      values (${access.venue.id}, ${data.kind}, ${data.language}, ${body}, now())
      on conflict (venue_id, kind, language) do update set body = excluded.body, updated_at = now()
    `;
    return { ok: true as const };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await loadDeskAccess(context.userId);
    if (!access.venue || !isDeskRole(access.role)) return { templates: [] as SavedTemplate[] };
    return { templates: await loadSavedTemplates(access.venue.id) };
  });

import { reliabilityBadge } from "@/lib/turf/reliability";
import type { BookingRow, BookingState, Channel, ResourceRow, VenuePublic } from "@/lib/turf/types";

export function asIso(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s) && !s.includes("T") && s.length === 10) return s;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toISOString();
}

export function asDate(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return asIso(v).slice(0, 10);
}

export function mapVenue(r: Record<string, unknown>): VenuePublic {
  const photosRaw = r.photos;
  let photos: { src: string; alt: string }[] = [];
  if (typeof photosRaw === "string") {
    try {
      photos = JSON.parse(photosRaw);
    } catch {
      photos = [];
    }
  } else if (Array.isArray(photosRaw)) {
    photos = photosRaw as { src: string; alt: string }[];
  }
  const amenities = Array.isArray(r.amenities) ? (r.amenities as string[]) : [];
  return {
    id: String(r.id),
    orgId: String(r.org_id),
    name: String(r.name),
    slug: String(r.slug),
    timezone: String(r.timezone ?? "Asia/Kolkata"),
    address: r.address ? String(r.address) : null,
    city: r.city ? String(r.city) : null,
    amenities,
    photos,
    upiId: r.upi_id ? String(r.upi_id) : null,
    contactPhone: r.contact_phone ? String(r.contact_phone) : null,
    requestWindowMinutes: Number(r.request_window_minutes ?? 240),
    status: String(r.status ?? "active"),
  };
}

export function mapResource(r: Record<string, unknown>): ResourceRow {
  return {
    id: String(r.id),
    venueId: String(r.venue_id),
    parentId: r.parent_id ? String(r.parent_id) : null,
    name: String(r.name),
    sport: r.sport ? String(r.sport) : null,
    slotMinutes: Number(r.slot_minutes ?? 60),
    bufferMinutes: Number(r.buffer_minutes ?? 0),
    minSlots: Number(r.min_slots ?? 1),
    maxSlots: Number(r.max_slots ?? 6),
    isBookable: Boolean(r.is_bookable),
    sortOrder: Number(r.sort_order ?? 0),
    status: String(r.status ?? "active"),
  };
}

export function mapBooking(r: Record<string, unknown>, loyaltyCreditPaise = 0): BookingRow {
  const ident = r as {
    lifetime_bookings?: number;
    lifetime_no_shows?: number;
    lifetime_late_cancels?: number;
  };
  const hasIdent = r.phone_e164 != null || r.lifetime_bookings != null;
  return {
    id: String(r.id),
    refCode: String(r.ref_code),
    venueId: String(r.venue_id),
    resourceId: String(r.resource_id),
    resourceName: String(r.resource_name ?? ""),
    identityId: r.identity_id ? String(r.identity_id) : null,
    profileId: r.profile_id ? String(r.profile_id) : null,
    customerName: r.customer_name ? String(r.customer_name) : r.display_name ? String(r.display_name) : null,
    customerPhone: r.phone_e164 ? String(r.phone_e164) : null,
    periodStart: asIso(r.period_start),
    periodEnd: asIso(r.period_end),
    localDate: asDate(r.local_date),
    state: r.state as BookingState,
    channel: r.channel as Channel,
    pricePaise: Number(r.price_paise ?? 0),
    discountPaise: Number(r.discount_paise ?? 0),
    loyaltyRedeemedPaise: Number(r.loyalty_redeemed_paise ?? 0),
    amountDuePaise: Number(r.amount_due_paise ?? 0),
    amountCollectedPaise: Number(r.amount_collected_paise ?? 0),
    paymentMode: r.payment_mode ? String(r.payment_mode) : null,
    paymentNote: r.payment_note ? String(r.payment_note) : null,
    requestExpiresAt: r.request_expires_at ? asIso(r.request_expires_at) : null,
    checkedInAt: r.checked_in_at ? asIso(r.checked_in_at) : null,
    checkedOutAt: r.checked_out_at ? asIso(r.checked_out_at) : null,
    cancelReason: r.cancel_reason ? String(r.cancel_reason) : null,
    createdAt: asIso(r.created_at),
    reliability: hasIdent
      ? reliabilityBadge({
          lifetime_bookings: Number(ident.lifetime_bookings ?? 0),
          lifetime_no_shows: Number(ident.lifetime_no_shows ?? 0),
          lifetime_late_cancels: Number(ident.lifetime_late_cancels ?? 0),
        })
      : null,
    loyaltyCreditPaise,
  };
}

export function normalizePhone(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return `+91${d}`;
  if (d.length === 12 && d.startsWith("91")) return `+${d}`;
  if (d.length === 11 && d.startsWith("0")) return `+91${d.slice(1)}`;
  if (phone.trim().startsWith("+") && d.length >= 10 && d.length <= 15) return `+${d}`;
  throw new Error("Enter a valid 10-digit Indian mobile number");
}

export const BOOKING_SELECT = `
  b.id, b.ref_code, b.venue_id, b.resource_id, b.identity_id, b.profile_id,
  b.period_start, b.period_end, b.local_date, b.state, b.channel,
  b.price_paise, b.discount_paise, b.loyalty_redeemed_paise,
  b.amount_due_paise, b.amount_collected_paise, b.payment_mode, b.payment_note,
  b.request_expires_at, b.checked_in_at, b.checked_out_at, b.cancel_reason, b.created_at,
  r.name as resource_name,
  coalesce(p.name_at_venue, i.display_name) as customer_name,
  i.phone_e164, i.display_name, i.lifetime_bookings, i.lifetime_no_shows, i.lifetime_late_cancels
`;

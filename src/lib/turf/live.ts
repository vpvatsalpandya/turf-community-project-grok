import { isValidInPhone, normalizePhone } from "@/lib/utils";
import { type LatLng } from "./geo";

export const HOLD_MINUTES = 20;
export const REQUESTS_PER_HOUR = 6;
export const MAX_PHOTOS = 3;

/** Preview (no Neon) keeps demo desks. Deployed Neon does not, unless TURF_DEMO=1. */
export function demoAllowed() {
  const url = typeof process !== "undefined" ? process.env.DATABASE_URL?.trim() : "";
  if (url) return process.env.TURF_DEMO === "1";
  return true;
}

export const SPORTS = [
  "5-a-side football",
  "7-a-side football",
  "Box cricket",
  "Pickleball",
  "Football + box cricket",
  "Football + pickleball",
  "Box cricket + pickleball",
  "Football, box cricket + pickleball",
] as const;

export type Sport = (typeof SPORTS)[number];

export function normalizeSport(value: string | undefined | null): Sport {
  const v = (value ?? "").trim();
  return (SPORTS as readonly string[]).includes(v) ? (v as Sport) : "5-a-side football";
}

export function parsePhotos(value: unknown): string[] {
  let raw: unknown = value;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p): p is string => typeof p === "string" && (p.startsWith("data:image/") || p.startsWith("https://")))
    .slice(0, MAX_PHOTOS);
}

export function parseCoord(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function upiPayUri(opts: { pa: string; pn: string; am: number; tn: string }) {
  const pa = opts.pa.trim();
  if (!pa) return "";
  const params = new URLSearchParams({
    pa,
    pn: opts.pn.slice(0, 50) || "Turf",
    am: String(opts.am),
    cu: "INR",
    tn: opts.tn.slice(0, 50),
  });
  return `upi://pay?${params.toString()}`;
}

export function qrImageSrc(data: string) {
  if (!data) return "";
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&ecc=M&margin=8&data=${encodeURIComponent(data)}`;
}

export function waMeUrl(phone: string, text: string) {
  const n = normalizePhone(phone);
  const q = `text=${encodeURIComponent(text)}`;
  if (isValidInPhone(n)) return `https://wa.me/91${n}?${q}`;
  return `https://wa.me/?${q}`;
}

export function waShareUrl(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function mapsDirFromVenue(opts: {
  name: string;
  address: string;
  area: string;
  city: string;
  lat: number | null;
  lng: number | null;
}) {
  if (opts.lat != null && opts.lng != null) {
    return `https://www.google.com/maps/dir/?api=1&destination=${opts.lat},${opts.lng}`;
  }
  const q = [opts.name, opts.address || opts.area, opts.city].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

export function pinOrNull(lat: number | null, lng: number | null): LatLng | null {
  if (lat == null || lng == null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

export function hourBucketIst(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const grab = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${grab("year")}-${grab("month")}-${grab("day")}T${grab("hour")}`;
}

export function holdRemainingMs(holdUntil: string | null | undefined, createdAt?: string) {
  const until = holdUntil
    ? new Date(holdUntil).getTime()
    : createdAt
      ? new Date(createdAt).getTime() + HOLD_MINUTES * 60_000
      : 0;
  return Math.max(0, until - Date.now());
}

export function formatHoldLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60_000));
  if (m <= 1) return "1 min left";
  return `${m} min left`;
}

export function isUniqueViolation(err: unknown) {
  const e = err as { code?: string; message?: string };
  if (e?.code === "23505") return true;
  const m = (e?.message ?? "").toLowerCase();
  return m.includes("duplicate key") || m.includes("unique constraint") || m.includes("unique index");
}

export function telHref(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (!d) return null;
  const local = d.length === 12 && d.startsWith("91") ? d.slice(2) : d.startsWith("0") ? d.slice(1) : d;
  if (!/^[6-9]\d{9}$/.test(local)) return null;
  return `tel:+91${local}`;
}

export const IST = "Asia/Kolkata";

export function localDateISO(d: Date = new Date(), tz = IST): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function localParts(d: Date = new Date(), tz = IST) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: get("weekday"),
    dateISO: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/** JS Sunday=0 … Saturday=6, matching the schema. */
export function dayOfWeekISO(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 6, 30)).getUTCDay();
}

export function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Instant for a wall-clock time in a named zone. */
export function zonedInstant(dateISO: string, hhmm: string, tz = IST): Date {
  const [hour, minute] = hhmm.split(":").map(Number);
  // Search UTC candidates — IST is +05:30, this still works for any fixed offset
  // and for DST-less Asia/Kolkata. We format-check the candidate.
  const guess = new Date(`${dateISO}T${hhmm}:00+05:30`);
  const check = localParts(guess, tz);
  if (check.dateISO === dateISO && check.hour === hour && check.minute === minute) {
    return guess;
  }
  // Fallback: iterate a small window
  const base = new Date(`${dateISO}T00:00:00Z`).getTime();
  for (let off = -12; off <= 14; off += 0.25) {
    const cand = new Date(base + (hour * 60 + minute) * 60000 - off * 3600000);
    const p = localParts(cand, tz);
    if (p.dateISO === dateISO && p.hour === hour && p.minute === minute) return cand;
  }
  return guess;
}

export function minutesFromMidnight(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function hhmmFromMinutes(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function formatTime(d: Date, tz = IST): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

export function formatDateLong(dateISO: string, tz = IST): string {
  const dt = zonedInstant(dateISO, "12:00", tz);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(dt);
}

export function formatDateFull(dateISO: string, tz = IST): string {
  const dt = zonedInstant(dateISO, "12:00", tz);
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
}

export function defaultDeskDate(tz = IST): string {
  const p = localParts(new Date(), tz);
  if (p.hour >= 21) return addDaysISO(p.dateISO, 1);
  return p.dateISO;
}

export function durationLabel(start: Date, end: Date): string {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins % 60 === 0) return `${mins / 60}h`;
  if (mins > 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

export function refCode(prefix = "TC"): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const buf = crypto.getRandomValues(new Uint8Array(5));
  for (const b of buf) out += alphabet[b % alphabet.length];
  return `${prefix}-${out}`;
}

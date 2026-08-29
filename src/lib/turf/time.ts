export const IST = "Asia/Kolkata";

export function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function istDateTime(dateKey: string, hour: number, minute = 0): Date {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateKey}T${hh}:${mm}:00+05:30`);
}

export function formatIstTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

export function formatIstDate(dateKey: string, weekday: "short" | "long" = "short"): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 6));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday,
    day: "numeric",
    month: "short",
  }).format(dt);
}

export function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

export function dateKeyFromIso(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

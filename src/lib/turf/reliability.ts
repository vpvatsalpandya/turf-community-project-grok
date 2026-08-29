import type { ReliabilityBadge } from "./types";

export function reliabilityBadge(row: {
  lifetime_bookings: number;
  lifetime_no_shows: number;
  lifetime_late_cancels: number;
}): ReliabilityBadge {
  const bookings = Number(row.lifetime_bookings) || 0;
  const noshows = Number(row.lifetime_no_shows) || 0;
  const late = Number(row.lifetime_late_cancels) || 0;
  // Coarse badge — never a raw score, never a cross-venue history list.
  if (bookings < 3) return "New";
  if (noshows >= 2) return "No-show risk";
  if (late >= 1) return "Has cancelled late";
  if (bookings >= 5 && noshows === 0) return "Reliable";
  return "New";
}

export function badgeTone(b: ReliabilityBadge): "good" | "warn" | "bad" | "neutral" {
  if (b === "Reliable") return "good";
  if (b === "Has cancelled late") return "warn";
  if (b === "No-show risk") return "bad";
  return "neutral";
}

const PREFIX = "turf.board.v1.";

export type CachedBoard<T> = { at: number; data: T };

export function cacheDayBoard<T>(venueId: string, date: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${PREFIX}${venueId}.${date}`, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota — ignore */
  }
}

export function readDayBoard<T>(venueId: string, date: string): CachedBoard<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${PREFIX}${venueId}.${date}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedBoard<T>;
    if (!parsed?.data) return null;
    return parsed;
  } catch {
    return null;
  }
}

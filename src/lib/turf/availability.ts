import {
  dayOfWeekISO,
  hhmmFromMinutes,
  minutesFromMidnight,
  zonedInstant,
} from "./time.ts";

export type WindowRow = {
  resource_id: string;
  day_of_week: number;
  opens_at: string;
  closes_minutes_from_midnight: number;
};

export type BandRow = {
  resource_id: string;
  day_of_week: number | null;
  starts_at: string;
  ends_at: string;
  price_paise: number;
  label: string | null;
  priority: number;
};

export type OverrideRow = {
  venue_id: string | null;
  resource_id: string | null;
  on_date: string;
  is_closed: boolean;
  opens_at: string | null;
  closes_at: string | null;
  price_multiplier: string | number | null;
};

export type BusyPeriod = {
  resourceId: string;
  start: string;
  end: string;
};

export type GeneratedSlot = {
  resourceId: string;
  start: Date;
  end: Date;
  localDate: string;
  pricePaise: number;
  priceLabel: string | null;
  available: boolean;
};

function timeStr(v: string): string {
  // PG time often comes back as HH:MM:SS
  return String(v).slice(0, 5);
}

export function priceFor(
  bands: BandRow[],
  resourceId: string,
  dateISO: string,
  startHHmm: string,
): { pricePaise: number; label: string | null } {
  const dow = dayOfWeekISO(dateISO);
  const t = minutesFromMidnight(startHHmm);
  const applicable = bands
    .filter((b) => b.resource_id === resourceId)
    .filter((b) => b.day_of_week == null || Number(b.day_of_week) === dow)
    .filter((b) => {
      const s = minutesFromMidnight(timeStr(b.starts_at));
      const e = minutesFromMidnight(timeStr(b.ends_at));
      if (e > s) return t >= s && t < e;
      // overnight band
      return t >= s || t < e;
    })
    .sort((a, b) => b.priority - a.priority);
  const top = applicable[0];
  if (!top) return { pricePaise: 0, label: null };
  return { pricePaise: Number(top.price_paise), label: top.label };
}

function overlaps(a0: Date, a1: Date, b0: Date, b1: Date) {
  return a0 < b1 && a1 > b0;
}

export function generateSlots(opts: {
  dateISO: string;
  timezone: string;
  resourceId: string;
  slotMinutes: number;
  bufferMinutes: number;
  windows: WindowRow[];
  bands: BandRow[];
  overrides: OverrideRow[];
  busy: BusyPeriod[];
  conflictIds: string[];
  venueId: string;
}): GeneratedSlot[] {
  const dow = dayOfWeekISO(opts.dateISO);
  const override =
    opts.overrides.find(
      (o) =>
        o.on_date === opts.dateISO &&
        (o.resource_id === opts.resourceId ||
          (o.resource_id == null && o.venue_id === opts.venueId)),
    ) ?? null;

  if (override?.is_closed) return [];

  const dayWindows = opts.windows.filter(
    (w) => w.resource_id === opts.resourceId && Number(w.day_of_week) === dow,
  );

  const slots: GeneratedSlot[] = [];
  const openList: { openMin: number; closeMin: number }[] = [];

  if (override?.opens_at && override.closes_at) {
    openList.push({
      openMin: minutesFromMidnight(timeStr(override.opens_at)),
      closeMin: minutesFromMidnight(timeStr(override.closes_at)),
    });
  } else {
    for (const w of dayWindows) {
      openList.push({
        openMin: minutesFromMidnight(timeStr(w.opens_at)),
        closeMin: Number(w.closes_minutes_from_midnight),
      });
    }
  }

  const multiplier = override?.price_multiplier != null ? Number(override.price_multiplier) : 1;
  const step = opts.slotMinutes;

  for (const win of openList) {
    for (let m = win.openMin; m + step <= win.closeMin; m += step) {
      const startHHmm = hhmmFromMinutes(m);
      const startDate = opts.dateISO;
      let endDate = opts.dateISO;
      const endMin = m + step;
      let endHHmm = hhmmFromMinutes(endMin);
      if (endMin >= 24 * 60) {
        const [y, mo, d] = opts.dateISO.split("-").map(Number);
        const nx = new Date(Date.UTC(y, mo - 1, d + 1));
        endDate = nx.toISOString().slice(0, 10);
      }
      const start = zonedInstant(startDate, startHHmm, opts.timezone);
      const end = zonedInstant(endDate, endHHmm, opts.timezone);
      const blockedEnd = new Date(end.getTime() + opts.bufferMinutes * 60000);
      const priced = priceFor(opts.bands, opts.resourceId, opts.dateISO, startHHmm);
      const pricePaise = Math.round(priced.pricePaise * multiplier);
      const conflict = opts.busy.some(
        (b) =>
          opts.conflictIds.includes(b.resourceId) &&
          overlaps(start, blockedEnd, new Date(b.start), new Date(b.end)),
      );
      slots.push({
        resourceId: opts.resourceId,
        start,
        end,
        localDate: opts.dateISO,
        pricePaise,
        priceLabel: priced.label,
        available: !conflict && pricePaise > 0,
      });
    }
  }
  return slots;
}

export function periodsOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string,
): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(aEnd) > new Date(bStart);
}

import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { addDaysISO, dayOfWeekISO, localDateISO, localParts } from "@/lib/turf/time";
import { assertVenueAccess, ensureMembership, homeVenueId } from "./membership";
import { ready } from "./ready";

export const getReports = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; from?: string; to?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    const venueId = data.venueId || (await homeVenueId(sql, membership));
    await assertVenueAccess(sql, membership, venueId);
    const to = data.to || localDateISO();
    const from = data.from || addDaysISO(to, -28);

    const revenue = await sql<{
      local_date: string;
      resource_name: string;
      payment_mode: string | null;
      collected: number;
      bookings: number;
    }>`
      select b.local_date::text as local_date, r.name as resource_name, b.payment_mode,
             coalesce(sum(b.amount_collected_paise),0)::int as collected,
             count(*)::int as bookings
        from booking b
        join resource r on r.id = b.resource_id
       where b.venue_id = ${venueId}
         and b.local_date between ${from}::date and ${to}::date
         and b.state in ('confirmed','checked_in','completed')
       group by b.local_date, r.name, b.payment_mode
       order by b.local_date`;

    const occupancyRows = await sql<{
      resource_name: string;
      local_date: string;
      period_start: unknown;
    }>`
      select r.name as resource_name, b.local_date::text as local_date, b.period_start
        from booking b
        join resource r on r.id = b.resource_id
       where b.venue_id = ${venueId}
         and b.local_date between ${from}::date and ${to}::date
         and b.state in ('confirmed','checked_in','completed')`;

    const occupancy: { resource_name: string; dow: number; hour: number; booked: number }[] = [];
    const occTmp = new Map<string, { resource_name: string; dow: number; hour: number; booked: number }>();
    for (const o of occupancyRows) {
      let start: Date | null = null;
      if (o.period_start instanceof Date && !Number.isNaN(o.period_start.getTime())) {
        start = o.period_start;
      } else {
        const s = String(o.period_start ?? "").trim().replace(" ", "T");
        const d = new Date(s);
        if (!Number.isNaN(d.getTime())) start = d;
      }
      if (!start) continue;
      const dateISO = String(o.local_date).slice(0, 10) || localDateISO(start);
      const hour = localParts(start).hour;
      const dow = dayOfWeekISO(dateISO);
      const key = `${o.resource_name}|${dow}|${hour}`;
      const cur = occTmp.get(key) ?? { resource_name: String(o.resource_name), dow, hour, booked: 0 };
      cur.booked += 1;
      occTmp.set(key, cur);
    }
    occupancy.push(...occTmp.values());

    // Dead hours: for each weekday × hour band, occupancy vs capacity heuristic
    const resources = await sql<{ n: number }>`
      select count(*)::int as n from resource where venue_id = ${venueId} and is_bookable = true and status = 'active'`;
    const days = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86400000) + 1);
    const capPerHour = Number(resources[0]?.n ?? 1);
    const bandMap = new Map<string, { dow: number; hour: number; booked: number }>();
    for (const o of occupancy) {
      const key = `${o.dow}-${o.hour}`;
      const cur = bandMap.get(key) ?? { dow: Number(o.dow), hour: Number(o.hour), booked: 0 };
      cur.booked += Number(o.booked);
      bandMap.set(key, cur);
    }
    const occupancyGrid: { dow: number; hour: number; booked: number; pct: number }[] = [];
    const weeks = Math.max(1, days / 7);
    const possible = capPerHour * weeks;
    for (let dow = 0; dow <= 6; dow++) {
      for (let hour = 6; hour <= 22; hour++) {
        const booked = bandMap.get(`${dow}-${hour}`)?.booked ?? 0;
        occupancyGrid.push({
          dow,
          hour,
          booked,
          pct: possible <= 0 ? 0 : Math.round((booked / possible) * 100),
        });
      }
    }
    const deadHours = occupancyGrid
      .filter((b) => b.hour >= 10 && b.hour <= 21)
      .sort((a, b) => a.pct - b.pct || a.dow - b.dow || a.hour - b.hour);

    const todaySheet = await sql<{
      ref_code: string;
      resource_name: string;
      period_start: string;
      period_end: string;
      customer_name: string | null;
      phone: string | null;
      state: string;
      amount_due_paise: number;
      amount_collected_paise: number;
    }>`
      select b.ref_code, r.name as resource_name, b.period_start, b.period_end,
             coalesce(p.name_at_venue, i.display_name) as customer_name,
             i.phone_e164 as phone, b.state, b.amount_due_paise, b.amount_collected_paise
        from booking b
        join resource r on r.id = b.resource_id
        left join customer_profile p on p.id = b.profile_id
        left join customer_identity i on i.id = b.identity_id
       where b.venue_id = ${venueId} and b.local_date = ${to}::date
         and b.state in ('confirmed','checked_in','requested','completed')
       order by b.period_start`;

    const totals = revenue.reduce(
      (acc, r) => {
        acc.collected += Number(r.collected);
        acc.bookings += Number(r.bookings);
        return acc;
      },
      { collected: 0, bookings: 0 },
    );

    const util = await sql<{ showed: number; booked: number }>`
      select
        coalesce(sum(case when checked_in_at is not null then 1 else 0 end), 0)::int as showed,
        count(*)::int as booked
        from booking
       where venue_id = ${venueId}
         and local_date between ${from}::date and ${to}::date
         and state in ('confirmed','checked_in','completed','no_show')`;
    const bookedN = Number(util[0]?.booked ?? 0);
    const showedN = Number(util[0]?.showed ?? 0);

    const byMode: Record<string, number> = {};
    for (const r of revenue) {
      const k = r.payment_mode || "unpaid";
      byMode[k] = (byMode[k] ?? 0) + Number(r.collected);
    }

    return {
      from,
      to,
      totals: {
        ...totals,
        showed: showedN,
        utilisedPct: bookedN <= 0 ? 0 : Math.round((showedN / bookedN) * 100),
      },
      byMode,
      revenue,
      occupancy,
      occupancyGrid,
      deadHours: deadHours.slice(0, 12),
      todaySheet,
    };
  });

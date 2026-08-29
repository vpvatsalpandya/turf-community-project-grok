import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDeskContext } from "@/lib/server/desk-fns";
import { getReports } from "@/lib/server/report-fns";
import { formatInr, formatInrCompact } from "@/lib/turf/money";
import { formatTime } from "@/lib/turf/time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const Route = createFileRoute("/app/reports")({ component: Reports });

function Reports() {
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["reports", venueId],
    enabled: Boolean(venueId),
    queryFn: () => getReports({ data: { venueId } }),
  });
  const d = q.data;
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Reports</h1>
          <p className="text-sm text-muted">Four numbers. The dead-hours one is why owners stay.</p>
        </div>
        <Button size="sm" variant="secondary" className="no-print" onClick={() => window.print()}>
          Print today
        </Button>
      </div>
      {d && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4 no-print">
            <Stat label="Collected" value={formatInrCompact(d.totals.collected)} />
            <Stat label="Bookings" value={String(d.totals.bookings)} />
            <Stat label="Showed up" value={`${d.totals.utilisedPct}%`} />
            <Stat label="UPI" value={formatInrCompact(d.byMode["upi_offline"] ?? 0)} />
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] no-print">
            <h2 className="font-display text-xl font-semibold">Dead hours</h2>
            <p className="mt-1 text-sm text-muted">
              Lowest occupancy in the last 28 days. Fill these before buying more ads.
            </p>
            <ul className="mt-4 space-y-2">
              {d.deadHours.map((h) => (
                <li key={`${h.dow}-${h.hour}`} className="flex items-center justify-between text-sm">
                  <span>
                    {DOW[h.dow]} {String(h.hour).padStart(2, "0")}:00
                  </span>
                  <span className="tabular text-muted">{h.pct}% booked</span>
                </li>
              ))}
              {d.deadHours.length === 0 && <p className="text-sm text-muted">Not enough history yet.</p>}
            </ul>
          </section>

          <section className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)] no-print">
            <h2 className="font-display text-xl font-semibold">Occupancy</h2>
            <p className="mt-1 text-sm text-muted">Last 28 days. Darker is fuller.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[32rem] border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="px-1 py-1 text-left font-medium text-muted"> </th>
                    {Array.from({ length: 17 }, (_, i) => i + 6).map((h) => (
                      <th key={h} className="px-0.5 py-1 font-medium text-muted tabular">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DOW.map((name, dow) => (
                    <tr key={name}>
                      <td className="px-1 py-1 text-muted">{name}</td>
                      {Array.from({ length: 17 }, (_, i) => i + 6).map((hour) => {
                        const cell = d.occupancyGrid?.find((c) => c.dow === dow && c.hour === hour);
                        const pct = cell?.pct ?? 0;
                        return (
                          <td key={hour} className="px-0.5 py-0.5">
                            <div
                              title={`${name} ${hour}:00 · ${pct}%`}
                              className={cn(
                                "grid h-8 place-items-center rounded-sm tabular",
                                pct >= 70
                                  ? "bg-accent text-accent-fg"
                                  : pct >= 40
                                    ? "bg-accent/40 text-fg"
                                    : pct >= 15
                                      ? "bg-accent/20 text-muted"
                                      : "bg-surface-3 text-faint",
                              )}
                            >
                              {pct}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="print-sheet rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl font-semibold">Today sheet</h2>
            <ul className="mt-3 divide-y divide-border">
              {d.todaySheet.map((r) => (
                <li key={r.ref_code} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span>
                    <span className="font-mono text-xs text-faint">{r.ref_code}</span> {r.resource_name} ·{" "}
                    {formatTime(new Date(r.period_start))} · {r.customer_name}
                  </span>
                  <span className="tabular">{formatInr(Number(r.amount_collected_paise))}</span>
                </li>
              ))}
              {d.todaySheet.length === 0 && <p className="text-sm text-muted">Empty sheet for this date.</p>}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-wide text-faint">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold tabular">{value}</p>
    </div>
  );
}

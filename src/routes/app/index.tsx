import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { DayBoard } from "@/components/day-board";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  dismissNoshowFlag,
  getDeskContext,
  listNoshowCandidates,
  transitionBooking,
} from "@/lib/server/desk-fns";
import { addDaysISO, defaultDeskDate, formatDateLong, formatTime } from "@/lib/turf/time";

export const Route = createFileRoute("/app/")({ component: Today });

function Today() {
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const [date, setDate] = useState(defaultDeskDate());
  const venue = ctx.data?.venue;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-faint">Today sheet</p>
          <h1 className="font-display text-3xl font-semibold">{formatDateLong(date)}</h1>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setDate(addDaysISO(date, -1))}>
            Prev
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDate(defaultDeskDate())}>
            Today
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setDate(addDaysISO(date, 1))}>
            Next
          </Button>
          <Button size="sm" variant="secondary" className="no-print" onClick={() => window.print()}>
            Print
          </Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">
        Tap an empty cell to book in under 15 seconds. Tap a block to check in, share, or mark no-show.
      </p>
      {ctx.data && ctx.data.requestCount > 0 && (
        <Link to="/app/requests" className="mt-3 block rounded-xl bg-warn/15 px-3 py-2 text-sm text-warn">
          {ctx.data.requestCount} open request{ctx.data.requestCount === 1 ? "" : "s"} waiting — two taps to accept
        </Link>
      )}
      {ctx.data && ctx.data.waitlistCount > 0 && (
        <Link to="/app/waitlist" className="mt-2 block rounded-xl bg-surface px-3 py-2 text-sm text-muted shadow-[var(--shadow-border)]">
          {ctx.data.waitlistCount} on the waitlist — if a slot frees, copy the message and send it
        </Link>
      )}
      {venue && ctx.data && ctx.data.noshowCount > 0 && <NoshowReview venueId={venue.id} />}
      <div className="mt-4">
        {venue ? <DayBoard venueId={venue.id} date={date} /> : <p className="text-sm text-muted">No venue yet.</p>}
      </div>
    </div>
  );
}

function NoshowReview({ venueId }: { venueId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["noshows", venueId],
    queryFn: () => listNoshowCandidates({ data: { venueId } }),
  });
  const dismiss = useMutation({
    mutationFn: (bookingId: string) => dismissNoshowFlag({ data: { bookingId } }),
    onSuccess: () => {
      toast.success("Cleared — check them in from the sheet if they showed");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const mark = useMutation({
    mutationFn: (bookingId: string) =>
      transitionBooking({ data: { bookingId, to: "no_show" } }),
    onSuccess: () => {
      toast.success("Marked no-show");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = q.data ?? [];
  if (!rows.length) return null;
  return (
    <section className="mt-3 rounded-2xl bg-danger/10 p-4 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-lg font-semibold">Did they show?</h2>
      <p className="mt-1 text-sm text-muted">
        Never auto-marked. Tap no-show only when you are sure — this is the call you do not want to get wrong.
      </p>
      <ul className="mt-3 space-y-2">
        {rows.map((b) => (
          <li
            key={b.id}
            className="flex flex-col gap-2 rounded-xl bg-surface p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="font-medium">
                {b.customerName ?? "Walk-in"}{" "}
                {b.customerPhone && (
                  <a href={`tel:${b.customerPhone}`} className="text-sm text-accent-2">
                    {b.customerPhone}
                  </a>
                )}
              </p>
              <p className="text-sm text-muted">
                {b.resourceName} · {formatTime(new Date(b.periodStart))}
              </p>
              {b.reliability && <Badge tone="bad">{b.reliability}</Badge>}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => dismiss.mutate(b.id)} disabled={dismiss.isPending}>
                They showed
              </Button>
              <Button size="sm" variant="danger" onClick={() => mark.mutate(b.id)} disabled={mark.isPending}>
                No-show
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

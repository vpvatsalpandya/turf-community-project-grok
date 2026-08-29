import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShareBox } from "@/components/share-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { acceptRequest, declineRequest, getDeskContext, listOpenRequests } from "@/lib/server/desk-fns";
import { formatInr } from "@/lib/turf/money";
import { formatDateLong, formatTime } from "@/lib/turf/time";
import { badgeTone } from "@/lib/turf/reliability";

export const Route = createFileRoute("/app/requests")({ component: Requests });

function Requests() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["requests", venueId],
    enabled: Boolean(venueId),
    queryFn: () => listOpenRequests({ data: { venueId } }),
  });
  const [share, setShare] = useState<string | null>(null);

  const accept = useMutation({
    mutationFn: (args: { bookingId: string; applyLoyalty?: boolean }) =>
      acceptRequest({ data: { bookingId: args.bookingId, paymentMode: "upi_offline", language: "hi", applyLoyalty: args.applyLoyalty } }),
    onSuccess: (r) => {
      setShare(r.message);
      toast.success("Confirmed");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const decline = useMutation({
    mutationFn: (bookingId: string) => declineRequest({ data: { bookingId, language: "hi" } }),
    onSuccess: (r) => {
      setShare(r.message);
      toast("Declined");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Open requests</h1>
      <p className="mt-1 text-sm text-muted">
        Multiple people can request the same slot. Accepting one declines the rest in the same transaction.
      </p>
      {share && (
        <div className="mt-4">
          <ShareBox text={share} title="Send this now" />
        </div>
      )}
      <div className="mt-6 space-y-6">
        {(q.data?.groups ?? []).length === 0 && (
          <p className="rounded-2xl bg-surface p-6 text-sm text-muted shadow-[var(--shadow-border)]">
            Nothing waiting. Share the venue link from More.
          </p>
        )}
        {(q.data?.groups ?? []).map((g) => (
          <section key={`${g.resourceId}-${g.start}`} className="rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <header className="mb-3">
              <p className="text-xs uppercase tracking-wide text-faint">{formatDateLong(g.localDate)}</p>
              <h2 className="font-display text-xl font-semibold">
                {g.resourceName} · {formatTime(new Date(g.start))}{" "}
                <span className="ml-2 text-base font-normal text-muted">
                  {g.items.length} request{g.items.length === 1 ? "" : "s"}
                </span>
              </h2>
            </header>
            <ul className="space-y-2">
              {g.items.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-col gap-2 rounded-xl bg-surface-2 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">
                      {b.customerName}{" "}
                      {b.customerPhone && (
                        <a href={`tel:${b.customerPhone}`} className="text-sm text-accent-2">
                          {b.customerPhone}
                        </a>
                      )}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {b.reliability && <Badge tone={badgeTone(b.reliability)}>{b.reliability}</Badge>}
                      <Badge>{formatInr(b.amountDuePaise)}</Badge>
                      {b.discountPaise > 0 && <Badge tone="accent">promo</Badge>}
                      {b.loyaltyCreditPaise > 0 && (
                        <Badge tone="good">{formatInr(b.loyaltyCreditPaise)} credit</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {b.loyaltyCreditPaise > 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => accept.mutate({ bookingId: b.id, applyLoyalty: true })}
                        disabled={accept.isPending}
                      >
                        Accept · apply {formatInr(b.loyaltyCreditPaise)}
                      </Button>
                    )}
                    <Button size="sm" onClick={() => accept.mutate({ bookingId: b.id })} disabled={accept.isPending}>
                      Accept
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => decline.mutate(b.id)}>
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

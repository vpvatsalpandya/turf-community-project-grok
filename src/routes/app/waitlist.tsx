import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShareBox } from "@/components/share-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cancelWaitlist, getDeskContext, listWaitlist, notifyWaitlist } from "@/lib/server/desk-fns";
import { formatDateLong, formatTime } from "@/lib/turf/time";

export const Route = createFileRoute("/app/waitlist")({ component: Waitlist });

function Waitlist() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["waitlist", venueId],
    enabled: Boolean(venueId),
    queryFn: () => listWaitlist({ data: { venueId } }),
  });
  const [share, setShare] = useState<string | null>(null);

  const notify = useMutation({
    mutationFn: (id: string) => notifyWaitlist({ data: { waitlistId: id, language: "hi" } }),
    onSuccess: (r) => {
      setShare(r.message);
      toast.success("Copy this and send it");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const drop = useMutation({
    mutationFn: (id: string) => cancelWaitlist({ data: { waitlistId: id } }),
    onSuccess: () => {
      toast("Taken off the list");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = q.data ?? [];
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Waitlist</h1>
      <p className="mt-1 text-sm text-muted">
        When a slot is full, add a name from Today. If it cancels, copy the message and send it from your WhatsApp.
      </p>
      {share && (
        <div className="mt-4">
          <ShareBox text={share} title="Slot opened — send this" />
        </div>
      )}
      <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-muted">Nobody waiting. Add someone from a booked cell on Today.</li>
        )}
        {rows.map((w) => (
          <li key={w.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{w.name}</p>
              <a href={`tel:${w.phone}`} className="text-sm text-accent-2">
                {w.phone}
              </a>
              <p className="text-xs text-muted">
                {w.resourceName} · {formatDateLong(w.localDate)} · {formatTime(new Date(w.periodStart))}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={w.status === "notified" ? "warn" : "neutral"}>{w.status}</Badge>
              <Button size="sm" onClick={() => notify.mutate(w.id)} disabled={notify.isPending}>
                Copy message
              </Button>
              <Button size="sm" variant="secondary" onClick={() => drop.mutate(w.id)}>
                Remove
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getDeskContext } from "@/lib/server/desk-fns";
import { activateLoyaltyPreset, listLoyalty } from "@/lib/server/setup-fns";
import { formatInr } from "@/lib/turf/money";

const PRESETS = [
  { key: "tenth", name: "10th Booking Free", blurb: "9 stamps, then one hour free up to ₹1,500." },
  { key: "weekday", name: "Weekday Warrior", blurb: "2× points Monday–Thursday. Fills dead hours." },
  { key: "spend", name: "₹500 back on ₹5,000", blurb: "Spend threshold. Credit applies on the next visit." },
  { key: "friends", name: "Bring 3 Friends", blurb: "3 stamps, 4th hour free up to ₹1,500." },
];

export const Route = createFileRoute("/app/loyalty")({ component: Loyalty });

function Loyalty() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["loyalty", venueId],
    enabled: Boolean(venueId),
    queryFn: () => listLoyalty({ data: { venueId } }),
  });
  const add = useMutation({
    mutationFn: (key: string) => activateLoyaltyPreset({ data: { venueId, key } }),
    onSuccess: () => {
      toast.success("Program is on");
      void qc.invalidateQueries({ queryKey: ["loyalty"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const names = new Set((q.data?.programs ?? []).map((p) => p.name));
  const canEdit = ctx.data?.membership?.role !== "staff";
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Loyalty</h1>
      <p className="text-sm text-muted">
        Accrues on completed visits only. Points never spend at another owner's turf. Expiry is 12 months.
      </p>
      <div className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
        <p className="text-xs uppercase tracking-wide text-faint">Outstanding unredeemed rewards</p>
        <p className="mt-1 font-display text-3xl font-semibold tabular">
          {formatInr(q.data?.outstandingPaise ?? 0)}
        </p>
        <p className="mt-1 text-sm text-muted">Most owners design something too generous on the first try.</p>
      </div>
      {canEdit && (
        <section className="space-y-2">
          <h2 className="font-display text-xl font-semibold">Presets</h2>
          <p className="text-sm text-muted">Turn one on. Redemption is a tap on the accept screen.</p>
          <ul className="space-y-2">
            {PRESETS.map((p) => (
              <li key={p.key} className="flex items-start justify-between gap-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-sm text-muted">{p.blurb}</p>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={names.has(p.name) || add.isPending}
                  onClick={() => add.mutate(p.key)}
                >
                  {names.has(p.name) ? "On" : "Turn on"}
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      <ul className="space-y-2">
        {(q.data?.programs ?? []).map((p) => (
          <li key={p.id} className="rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
            <p className="font-medium">{p.name}</p>
            <p className="text-sm text-muted">
              {p.type.replace("_", " ")} · expires {p.expiryMonths} months · {p.status}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

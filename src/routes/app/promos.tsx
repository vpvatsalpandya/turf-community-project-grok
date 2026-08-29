import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDeskContext } from "@/lib/server/desk-fns";
import { listPromos, savePromo } from "@/lib/server/setup-fns";
import { formatInr } from "@/lib/turf/money";

export const Route = createFileRoute("/app/promos")({ component: Promos });

function Promos() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["promos", venueId],
    enabled: Boolean(venueId),
    queryFn: () => listPromos({ data: { venueId } }),
  });
  const [code, setCode] = useState("WEEKDAY");
  const [type, setType] = useState<"percent" | "flat">("percent");
  const [value, setValue] = useState("20");
  const [cap, setCap] = useState("400");
  const save = useMutation({
    mutationFn: () =>
      savePromo({
        data: {
          venueId: venueId!,
          code,
          type,
          value: type === "flat" ? Math.round(Number(value) * 100) : Number(value),
          maxDiscountPaise: type === "percent" ? Math.round(Number(cap) * 100) : null,
          active: true,
        },
      }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Promo codes</h1>
      <p className="text-sm text-muted">Separate from subscription discounts. Percent codes must have a rupee cap.</p>
      <form
        className="grid gap-2 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" />
        <select
          className="h-11 rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
          value={type}
          onChange={(e) => setType(e.target.value as "percent" | "flat")}
        >
          <option value="percent">Percent</option>
          <option value="flat">Flat ₹</option>
        </select>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === "flat" ? "Rupees" : "Percent"} />
        {type === "percent" && <Input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="Max ₹ off" />}
        <Button type="submit" className="sm:col-span-2">
          Save code
        </Button>
      </form>
      <ul className="space-y-2">
        {(q.data ?? []).map((p) => (
          <li key={p.id} className="flex items-center justify-between rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
            <span className="font-mono">{p.code}</span>
            <span className="flex items-center gap-2 text-sm text-muted">
              {p.type === "percent" ? `${p.value}%` : formatInr(p.value)} · used {p.timesUsed}
              <Badge tone={p.active ? "good" : "neutral"}>{p.active ? "on" : "off"}</Badge>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

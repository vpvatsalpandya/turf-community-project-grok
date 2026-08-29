import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDeskContext, listCustomers, mergeCustomers } from "@/lib/server/desk-fns";
import { formatInr } from "@/lib/turf/money";

export const Route = createFileRoute("/app/customers")({ component: Customers });

function Customers() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const [q, setQ] = useState("");
  const [keep, setKeep] = useState("");
  const [absorb, setAbsorb] = useState("");
  const venueId = ctx.data?.venue?.id;
  const list = useQuery({
    queryKey: ["customers", venueId, q],
    enabled: Boolean(venueId),
    queryFn: () => listCustomers({ data: { venueId, q } }),
  });
  const merge = useMutation({
    mutationFn: () => mergeCustomers({ data: { venueId, keepIdentityId: keep, absorbIdentityId: absorb } }),
    onSuccess: () => {
      toast.success("Merged. The extra phone now points at the kept customer.");
      setKeep("");
      setAbsorb("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const rows = list.data ?? [];
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Customers</h1>
      <p className="text-sm text-muted">This list is this venue only. Reliability stays on the platform.</p>
      <Input className="mt-4" placeholder="Search name or phone" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {rows.map((c) => (
          <li key={c.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium">{c.name}</p>
              <a href={`tel:${c.phone}`} className="text-sm text-accent-2">
                {c.phone}
              </a>
            </div>
            <div className="text-right text-sm text-muted">
              <p className="tabular">{c.totalBookings} visits</p>
              <p className="tabular">{formatInr(c.totalSpendPaise)}</p>
            </div>
          </li>
        ))}
      </ul>
      {ctx.data?.membership?.role !== "staff" && rows.length >= 2 && (
        <section className="mt-6 space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl font-semibold">Merge duplicates</h2>
          <p className="text-sm text-muted">
            Staff will create two cards for the same person. Keep one. The other phone still finds them.
          </p>
          <select
            className="h-11 w-full rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
            value={keep}
            onChange={(e) => setKeep(e.target.value)}
          >
            <option value="">Keep this customer</option>
            {rows.map((c) => (
              <option key={c.identityId} value={c.identityId}>
                {c.name} · {c.phone}
              </option>
            ))}
          </select>
          <select
            className="h-11 w-full rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
            value={absorb}
            onChange={(e) => setAbsorb(e.target.value)}
          >
            <option value="">Merge this one away</option>
            {rows
              .filter((c) => c.identityId !== keep)
              .map((c) => (
                <option key={c.identityId} value={c.identityId}>
                  {c.name} · {c.phone}
                </option>
              ))}
          </select>
          <Button onClick={() => merge.mutate()} disabled={!keep || !absorb || merge.isPending}>
            Merge
          </Button>
        </section>
      )}
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  adminOverview,
  applyOrgDiscount,
  generateInvoices,
  markInvoicePaid,
  markReferralPaid,
  overrideTrial,
  saveReferralCode,
  waiveInvoice,
} from "@/lib/server/admin-fns";
import { getDeskContext } from "@/lib/server/desk-fns";
import { formatInr } from "@/lib/turf/money";

export const Route = createFileRoute("/admin/")({ component: Admin });

function Admin() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const q = useQuery({ queryKey: ["admin"], queryFn: () => adminOverview() });
  const [ref, setRef] = useState("");
  const gen = useMutation({
    mutationFn: () => generateInvoices(),
    onSuccess: (r) => {
      toast.success(`${r.made} invoice(s)`);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const pay = useMutation({
    mutationFn: (invoiceId: string) => markInvoicePaid({ data: { invoiceId, paymentRef: ref || "UPI-manual" } }),
    onSuccess: () => {
      toast.success("Marked paid");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const [code, setCode] = useState("RAHUL50");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [upi, setUpi] = useState("");
  const [orgId, setOrgId] = useState("");
  const [discType, setDiscType] = useState<"percent" | "flat">("percent");
  const [discValue, setDiscValue] = useState("20");
  const [discReason, setDiscReason] = useState("");
  const [trialEnds, setTrialEnds] = useState("");
  const saveCode = useMutation({
    mutationFn: () => saveReferralCode({ data: { code, name, phone, upi } }),
    onSuccess: () => {
      toast.success("Code saved");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const payRef = useMutation({
    mutationFn: (id: string) => markReferralPaid({ data: { referralId: id, payoutRef: ref || "UPI-out" } }),
    onSuccess: () => {
      toast.success("Payout marked");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const disc = useMutation({
    mutationFn: () =>
      applyOrgDiscount({
        data: {
          orgId,
          type: discType,
          value: discType === "flat" ? Math.round(Number(discValue) * 100) : Number(discValue),
          reason: discReason || "manual",
        },
      }),
    onSuccess: () => {
      toast.success("Discount applied");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const trial = useMutation({
    mutationFn: () => overrideTrial({ data: { orgId, trialEndsOn: trialEnds } }),
    onSuccess: () => {
      toast.success("Trial extended");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const waive = useMutation({
    mutationFn: (invoiceId: string) => waiveInvoice({ data: { invoiceId, reason: ref || "waived" } }),
    onSuccess: () => {
      toast.success("Waived");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!ctx.data?.membership?.isPlatformAdmin) {
    return (
      <AppShell membership={ctx.data?.membership ?? null}>
        <p className="text-sm text-muted">Platform admin only. Sign in as admin@turfcommunity.com.</p>
        <Link to="/app" className="mt-3 inline-block text-accent-2">
          Back to the desk
        </Link>
      </AppShell>
    );
  }

  const d = q.data;
  return (
    <AppShell membership={ctx.data.membership} requestCount={ctx.data.requestCount}>
      <h1 className="font-display text-3xl font-semibold">Platform</h1>
      <p className="text-sm text-muted">Manual collection. ~15 minutes a month if you keep the queue clean.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" onClick={() => gen.mutate()}>
          Run invoices
        </Button>
        <Input className="max-w-xs" placeholder="Payment ref" value={ref} onChange={(e) => setRef(e.target.value)} />
      </div>

      <h2 className="mt-8 font-display text-xl font-semibold">Accounts</h2>
      <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)]">
        {(d?.orgs ?? []).map((o) => (
          <li key={o.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <span>
              {o.name} · {o.venues} venue{o.venues === 1 ? "" : "s"}
              {o.trialEndsOn ? ` · trial to ${o.trialEndsOn}` : ""}
              {o.referred ? " · referred" : ""}
            </span>
            <Badge tone={o.status === "read_only" ? "bad" : o.status === "trialing" ? "warn" : "good"}>{o.status}</Badge>
          </li>
        ))}
        {(d?.orgs ?? []).length === 0 && <p className="text-sm text-muted">No accounts yet.</p>}
      </ul>

      <h2 className="mt-8 font-display text-xl font-semibold">Discount or extend trial</h2>
      <form
        className="mt-2 grid gap-2 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!orgId) {
            toast.error("Pick an account");
            return;
          }
          disc.mutate();
        }}
      >
        <select
          className="h-11 rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)] sm:col-span-2"
          value={orgId}
          onChange={(e) => setOrgId(e.target.value)}
        >
          <option value="">Account</option>
          {(d?.orgs ?? []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <select
          className="h-11 rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
          value={discType}
          onChange={(e) => setDiscType(e.target.value as "percent" | "flat")}
        >
          <option value="percent">Percent off rent</option>
          <option value="flat">Flat ₹ off</option>
        </select>
        <Input value={discValue} onChange={(e) => setDiscValue(e.target.value)} placeholder={discType === "flat" ? "Rupees" : "Percent"} />
        <Input className="sm:col-span-2" value={discReason} onChange={(e) => setDiscReason(e.target.value)} placeholder="Reason" />
        <Button type="submit" disabled={disc.isPending}>
          Apply discount
        </Button>
        <div className="flex gap-2">
          <Input type="date" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
          <Button
            type="button"
            variant="secondary"
            disabled={!orgId || !trialEnds || trial.isPending}
            onClick={() => trial.mutate()}
          >
            Extend trial
          </Button>
        </div>
      </form>

      <h2 className="mt-8 font-display text-xl font-semibold">Invoices</h2>
      <ul className="mt-2 space-y-2">
        {(d?.invoices ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
            <span>
              {i.orgName} · {i.periodStart} · {formatInr(i.amountDuePaise)}
            </span>
            <span className="flex items-center gap-2">
              <Badge>{i.status}</Badge>
              {i.status !== "paid" && i.status !== "waived" && (
                <>
                  <Button size="sm" onClick={() => pay.mutate(i.id)}>
                    Mark paid
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => waive.mutate(i.id)}>
                    Waive
                  </Button>
                </>
              )}
            </span>
          </li>
        ))}
        {(d?.invoices ?? []).length === 0 && <p className="text-sm text-muted">None yet. Run invoices after a trial ends.</p>}
      </ul>

      <h2 className="mt-8 font-display text-xl font-semibold">Referrals</h2>
      <form
        className="mt-2 grid gap-2 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          saveCode.mutate();
        }}
      >
        <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="CODE" />
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Referrer name" required />
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" required />
        <Input value={upi} onChange={(e) => setUpi(e.target.value)} placeholder="UPI" />
        <Button type="submit" className="sm:col-span-2">
          Save referral code
        </Button>
      </form>
      <ul className="mt-3 space-y-2">
        {(d?.referrals ?? []).map((r) => (
          <li key={r.id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
            <span>
              {r.referrerName} → {r.orgName} · {formatInr(r.payoutPaise)} {r.flaggedReason ? `(${r.flaggedReason})` : ""}
            </span>
            <span className="flex items-center gap-2">
              <Badge>{r.status}</Badge>
              {r.status === "qualified" && (
                <Button size="sm" onClick={() => payRef.mutate(r.id)}>
                  Mark paid
                </Button>
              )}
            </span>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { QrCode } from "@/components/qr-code";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { exportCustomers, getDeskContext } from "@/lib/server/desk-fns";

export const Route = createFileRoute("/app/more")({ component: More });

function More() {
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venue = ctx.data?.venue;
  const m = ctx.data?.membership;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = venue ? `${origin}/v/${venue.slug}` : "";

  const exp = useMutation({
    mutationFn: () => exportCustomers({ data: { venueId: venue?.id } }),
    onSuccess: (r) => {
      const blob = new Blob([r.csv], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "customers.csv";
      a.click();
      toast.success(`Exported ${r.rowCount} rows`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">More</h1>
      {venue && (
        <section className="print-qr rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-wide text-faint">Gate QR</p>
          <p className="mt-1 font-display text-2xl font-semibold">{venue.name}</p>
          <p className="mt-1 break-all font-mono text-sm">{link}</p>
          <p className="mt-2 text-sm text-muted">Print this. Tape it at the gate. Customers request from their phone.</p>
          {link && (
            <div className="mx-auto mt-4 max-w-56">
              <QrCode value={link} label="Scan to request a slot" />
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2 no-print">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard.writeText(link);
                toast.success("Copied");
              }}
            >
              Copy link
            </Button>
            <Link to="/v/$slug" params={{ slug: venue.slug }}>
              <Button size="sm">Open page</Button>
            </Link>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              Print QR
            </Button>
          </div>
        </section>
      )}
      <nav className="divide-y divide-border overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-border)] no-print">
        <Link to="/app/customers" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Customers
        </Link>
        <Link to="/app/waitlist" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Waitlist
        </Link>
        <Link to="/app/setup" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Venue, hours, prices
        </Link>
        <Link to="/app/promos" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Promo codes
        </Link>
        <Link to="/app/loyalty" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Loyalty
        </Link>
        <Link to="/app/messages" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Message templates
        </Link>
        <Link to="/app/staff" className="block px-4 py-3 text-sm hover:bg-surface-2">
          Staff logins
        </Link>
        {m?.isPlatformAdmin && (
          <Link to="/admin" className="block px-4 py-3 text-sm hover:bg-surface-2">
            Platform admin
          </Link>
        )}
      </nav>
      <div className="flex items-center justify-between rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)] no-print">
        <div>
          <p className="font-medium">Export customers</p>
          <p className="text-xs text-muted">Owner only. Never includes reliability or other-venue history.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => exp.mutate()} disabled={m?.role === "staff"}>
          CSV
        </Button>
      </div>
      <div className="flex gap-2 text-sm text-muted no-print">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Badge>{m?.orgStatus}</Badge>
      </div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";

export const Route = createFileRoute("/terms")({ component: Terms });

function Terms() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-10 text-fg">
      <div className="mx-auto max-w-2xl">
        <Link to="/">
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold">Terms of use</h1>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>Turf Community is booking software sold to turf owners. A customer request is not a confirmed booking. The venue accepts after receiving payment out-of-band (UPI, cash, bank).</p>
          <p>Subscription is ₹999 per account per month, two venues included, ₹249 per extra venue. Trial is one full month unless the account was referred. Non-payment: banner at +7 days, read-only at +14 days. We never hard-lock a venue mid-weekend.</p>
          <p>The venue owns its customer_profile and booking records and may export them. After termination, the platform will not use that data for new products. Aggregate occupancy statistics, stripped of identity, may be retained.</p>
          <p>No-shows are staff-marked only. The platform will not auto-flag a player as a no-show. Disputes are settled from the append-only booking event log.</p>
          <p>These terms are the phase-1 SaaS agreement. A lawyer review of the consent notice is required before production launch.</p>
        </div>
      </div>
    </main>
  );
}

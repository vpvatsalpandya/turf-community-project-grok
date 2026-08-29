import { createFileRoute, Link } from "@tanstack/react-router";
import { Wordmark } from "@/components/logo";

export const Route = createFileRoute("/privacy")({ component: Privacy });

function Privacy() {
  return (
    <main className="min-h-dvh bg-bg px-5 py-10 text-fg">
      <div className="mx-auto max-w-2xl">
        <Link to="/">
          <Wordmark />
        </Link>
        <h1 className="mt-8 font-display text-3xl font-semibold">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted">DPDP Act 2023 · Turf Community is the Data Fiduciary. The venue is a joint fiduciary for bookings taken on its page.</p>
        <div className="mt-6 space-y-4 text-sm leading-relaxed text-muted">
          <p>We collect your name and phone when you request a slot, and staff-entered notes the venue adds to your profile. Purpose: booking management, service communication, and platform analytics (occupancy, no-show rates).</p>
          <p>We do not sell personal data. A venue may export its own customer_profile and bookings. Reliability badges and lifetime no-show counts stay on the platform and are never included in an owner export.</p>
          <p>Phone numbers are stored in E.164. Identities can be merged when staff create duplicates. Deleted accounts are soft-deleted (`deleted_at`) and excluded from queries.</p>
          <p>To request deletion, email privacy@turfcommunity.com from the registered number or owner email. We will honour it within the Act’s timelines. This preview build logs export events; there is no SMS or payment processor in phase 1.</p>
          <p>Consent is collected on the request form, naming both the platform and the venue. Withdrawing consent does not erase bookings already completed — those remain for the venue’s accounts.</p>
        </div>
      </div>
    </main>
  );
}

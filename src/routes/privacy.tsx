import { createFileRoute, Link } from "@tanstack/react-router";
import { PitchMark } from "@/components/mark";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg">
      <header className="px-4 py-4">
        <Link to="/" className="flex items-center gap-2 text-fg">
          <PitchMark className="size-8" />
          <span className="font-display text-lg tracking-wide uppercase">Turf Community</span>
        </Link>
      </header>
      <article className="space-y-4 px-4 pb-10">
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">Legal</p>
        <h1 className="font-display text-4xl tracking-tight uppercase">Privacy</h1>
        <p className="text-sm leading-relaxed text-muted">Last updated 4 September 2026. Gujarat, India.</p>
        <p className="text-sm leading-relaxed text-muted">
          Turf Community is a slot diary for turf, box-cricket and pickleball grounds. We collect
          only what a night at the gate needs. We do not sell lists. We do not run a payment
          gateway — UPI is between the player and the owner.
        </p>
        <h2 className="font-display text-2xl uppercase">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
          <li>Owner: name, email, password hash or Google/X login, turf sheet (hours, UPI id, gate phone, photos, map pin).</li>
          <li>Player request: name, 10-digit Indian mobile, optional note, slot and amount.</li>
          <li>Technical: sign-in cookies, a per-hour request count on the mobile number to stop spam.</li>
        </ul>
        <h2 className="font-display text-2xl uppercase">Why</h2>
        <p className="text-sm leading-relaxed text-muted">
          To hold a pitch for twenty minutes, show the owner who asked, ping them on WhatsApp when
          connected, and let the gate call you. Photos and pins are shown on the public booking page so captains can find
          the floodlights.
        </p>
        <h2 className="font-display text-2xl uppercase">Who sees it</h2>
        <p className="text-sm leading-relaxed text-muted">
          The turf owner and their signed-in desk see your request. Platform HQ can see live turfs
          and tonight’s board to run the directory. Other players see that a slot is held — not
          your name or number. We do not sell personal data. We do not share it for advertising.
        </p>
        <h2 className="font-display text-2xl uppercase">How long</h2>
        <p className="text-sm leading-relaxed text-muted">
          Bookings stay on the night board so the owner can reconcile UPI. You can ask an owner to
          decline or cancel a row. Expired holds (unpaid after 20 minutes) stay as expired for the
          diary, not as a live lock.
        </p>
        <h2 className="font-display text-2xl uppercase">Your rights (DPDP)</h2>
        <p className="text-sm leading-relaxed text-muted">
          You may ask to see, correct, or erase personal data we hold, or withdraw consent for
          further requests, by emailing the owner of the turf you booked or writing to us via the
          owner academy contact on this site. We will not keep a player account unless you create
          one. Most captains book as guests.
        </p>
        <h2 className="font-display text-2xl uppercase">Children</h2>
        <p className="text-sm leading-relaxed text-muted">
          The product is for adult captains and turf owners. Do not submit a child’s personal data.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Questions: open <Link to="/learn" className="text-accent">Owner academy</Link> or the
          desk of the turf you used.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}

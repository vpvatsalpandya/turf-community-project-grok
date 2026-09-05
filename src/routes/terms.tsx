import { createFileRoute, Link } from "@tanstack/react-router";
import { PitchMark } from "@/components/mark";
import { SiteFooter } from "@/components/site-footer";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
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
        <h1 className="font-display text-4xl tracking-tight uppercase">Terms</h1>
        <p className="text-sm leading-relaxed text-muted">Last updated 4 September 2026. Gujarat, India.</p>
        <p className="text-sm leading-relaxed text-muted">
          Turf Community is a slot diary. It is not a payment gateway, not a marketplace with
          escrow, and not a guarantee that a pitch is empty. The owner of each ground is the
          contracting party for the hour.
        </p>
        <h2 className="font-display text-2xl uppercase">What a request is</h2>
        <p className="text-sm leading-relaxed text-muted">
          A player request holds one pitch for twenty minutes. That is a hold, not a booking.
          The owner confirms after they see UPI (or cash at the gate). If they decline, cancel,
          or let the hold expire, the hour is free again. Do not enter a ground on a pending row.
        </p>
        <h2 className="font-display text-2xl uppercase">Money</h2>
        <p className="text-sm leading-relaxed text-muted">
          UPI is between the player and the owner. We never take a cut, never hold funds, never
          issue refunds. Rain, lights, fights, no-shows: the owner refunds on their own UPI.
          Directory prices for grounds not on Turf Community are public listings and may be stale —
          call before you drive.
        </p>
        <h2 className="font-display text-2xl uppercase">Owners</h2>
        <p className="text-sm leading-relaxed text-muted">
          You warrant that you run the ground you list, that the UPI id is yours, and that the
          hours, sport and photos are honest. You confirm or decline every hold. Check-in and
          check-out are your gate record. You may connect WhatsApp so we can ping your number
          when a request lands; you can disconnect it on the desk.
        </p>
        <h2 className="font-display text-2xl uppercase">Directory</h2>
        <p className="text-sm leading-relaxed text-muted">
          Every football, box-cricket and pickleball ground we could list in Vadodara is shown to
          players, whether or not the owner has joined. Grounds on Turf Community are highlighted
          and bookable. The rest show Call and Visit only. Listing a ground you do not own, or
          scraping our directory for ads, is not allowed.
        </p>
        <h2 className="font-display text-2xl uppercase">Acceptable use</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-muted">
          <li>No fake requests, no flooding a mobile, no holding slots you will not pay for.</li>
          <li>No listing a pitch you cannot actually sell tonight.</li>
          <li>No using the service for anything other than recreational ground time.</li>
        </ul>
        <h2 className="font-display text-2xl uppercase">Liability</h2>
        <p className="text-sm leading-relaxed text-muted">
          Injuries, lost balls, stolen shoes, rain — the ground’s own house rules apply. We
          provide software. We are not on the floodlights with you. The service is provided as
          available. Gujarat courts, Vadodara.
        </p>
        <p className="text-sm leading-relaxed text-muted">
          Also read <Link to="/privacy" className="text-accent">Privacy</Link>. Gate staff should
          open <Link to="/learn" className="text-accent">Owner academy</Link>.
        </p>
      </article>
      <SiteFooter />
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, ClipboardList, QrCode, Shield, Smartphone } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <nav className="flex items-center gap-2">
          <Link to="/v/$slug" params={{ slug: "greenfield" }} className="hidden text-sm text-muted sm:inline">
            Try a request
          </Link>
          <Link to="/login" search={{ next: "/app" }}>
            <Button size="sm">Open the desk</Button>
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-16 pt-6 md:pt-10">
        <div className="stagger-in relative z-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">For turf owners in India</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Stop losing Saturday to a WhatsApp group.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Customers request a slot on a link. You confirm after the UPI hits. The calendar never lies, even when two people tap the same 8pm.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/v/$slug" params={{ slug: "greenfield" }}>
              <Button size="lg" className="w-full sm:w-auto">
                Request a slot at Greenfield
                <ArrowRight className="size-4" />
              </Button>
            </Link>
            <Link to="/login" search={{ next: "/app" }}>
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                Sign in as the owner
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-faint">₹999/month · first month free · no payment gateway in phase 1</p>
        </div>
        <div className="mt-10 overflow-hidden rounded-[28px] shadow-[var(--shadow-border)]">
          <img
            src="/venues/greenfield-night.jpg"
            alt="Floodlit 5-a-side turf at night"
            className="aspect-[16/9] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
        </div>
      </section>

      <section className="border-t border-border bg-bg-2 py-16">
        <div className="mx-auto grid max-w-6xl gap-6 px-5 md:grid-cols-3">
          {[
            {
              icon: ClipboardList,
              title: "A request is not a booking",
              body: "Customers pick a time and wait. You accept after money lands. If two people want 8pm, one gets it — the rest get a clean decline you can paste into WhatsApp.",
            },
            {
              icon: Shield,
              title: "Double-bookings are a database problem",
              body: "Confirming a slot locks the pitch and every nested court in one transaction. Ground A and Pitch 1 cannot both be sold for the same hour.",
            },
            {
              icon: Smartphone,
              title: "Built for a bad-wifi gate",
              body: "Staff enter a walk-in in under 15 seconds. Today's sheet is printable. No chat, no reviews, no consumer feed — those generate support calls.",
            },
          ].map((c) => (
            <article key={c.title} className="rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
              <c.icon className="size-5 text-accent" />
              <h2 className="mt-4 text-xl font-semibold">{c.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <img
            src="/venues/greenfield-desk.jpg"
            alt="The booking desk"
            className="aspect-[4/3] w-full rounded-2xl object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">The desk</p>
            <h2 className="mt-2 text-3xl font-semibold">The notebook, retired.</h2>
            <ul className="mt-5 space-y-3 text-sm text-muted">
              {[
                "Accept screen grouped by slot — two taps, then a share text.",
                "Phone first on walk-ins. Existing customers auto-fill.",
                "Dead-hours report: Tue–Thu 2–5pm is 12% booked. That's why ₹999 makes sense.",
                "QR at the gate opens the request page. Free, and it makes the product feel real.",
              ].map((t) => (
                <li key={t} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-border py-16">
        <div className="mx-auto max-w-3xl px-5 text-center">
          <QrCode className="mx-auto size-8 text-accent" />
          <h2 className="mt-4 text-3xl font-semibold">₹999 / month per account</h2>
          <p className="mt-3 text-muted">
            Two venues included. ₹249 per extra venue. First month free unless you were referred — referred accounts pay in month one so the referrer can actually get paid.
          </p>
          <p className="mt-3 text-sm text-faint">
            No WhatsApp API. No SMS. No payment gateway. Messages copy out of the desk onto the number your customers already trust.
          </p>
          <div className="mt-8">
            <Link to="/login" search={{ next: "/app" }}>
              <Button size="lg">
                Open the desk
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-border px-5 py-8 text-sm text-faint">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/v/$slug" params={{ slug: "greenfield" }}>
              Greenfield
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Link2, ShieldCheck } from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({ component: Home });

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return <div className="h-11 w-28 animate-pulse rounded-md bg-raised" />;
  }
  if (user) {
    return (
      <Link to="/desk">
        <Button size="sm">Open desk</Button>
      </Link>
    );
  }
  return (
    <Link to="/login">
      <Button variant="secondary" size="sm">
        Sign in
      </Button>
    </Link>
  );
}

function Home() {
  return (
    <main className="min-h-dvh bg-bg">
      <header className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
        <div className="flex items-center gap-2">
          <PitchMark className="size-9" />
          <span className="font-display text-lg font-semibold tracking-wide uppercase">
            Turf Community
          </span>
        </div>
        <AuthSlot />
      </header>

      <section className="relative mx-auto max-w-5xl overflow-hidden rounded-xl px-4 pb-10 pt-2">
        <div className="relative isolate overflow-hidden rounded-xl bg-surface shadow-[0_0_0_1px_rgba(232,242,235,0.08)]">
          <img
            src="/hero.jpg"
            alt="Floodlit 5-a-side turf at night"
            className="absolute inset-0 h-full w-full object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/75 to-bg/25" />
          <div className="relative z-10 space-y-4 px-5 pb-8 pt-28 sm:px-8 sm:pt-40 sm:pb-10">
            <p className="text-xs font-medium tracking-[0.2em] text-accent uppercase">
              For turf owners in India
            </p>
            <h1 className="font-display text-5xl leading-none font-semibold tracking-tight text-fg uppercase sm:text-7xl">
              The booking book,
              <br />
              retired.
            </h1>
            <p className="max-w-md text-sm leading-relaxed text-fg/90 sm:text-base">
              Customers request a slot on a link. You confirm after the UPI
              lands. No gateway, no customer accounts, no commission.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link to="/b/$slug" params={{ slug: "demo" }} className="block">
                <Button size="lg" className="w-full sm:w-auto">
                  Book the demo turf
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <SignedOut>
                <Link to="/login" className="block">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    I run a turf
                  </Button>
                </Link>
              </SignedOut>
              <SignedIn>
                <Link to="/desk" className="block">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Open owner desk
                  </Button>
                </Link>
              </SignedIn>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-3 px-4 pb-16 sm:grid-cols-3">
        {[
          {
            icon: Link2,
            title: "One link",
            body: "Share it on WhatsApp status. Players pick a date and a floodlit hour.",
          },
          {
            icon: CalendarClock,
            title: "You confirm",
            body: "Pending holds the slot. Accept after payment. Decline and it frees.",
          },
          {
            icon: ShieldCheck,
            title: "Gate, not an app store",
            body: "Walk-ins, check-in, no-show. The person at the entrance runs the night.",
          },
        ].map((item) => (
          <article
            key={item.title}
            className="rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]"
          >
            <item.icon className="mb-4 size-5 text-accent" />
            <h2 className="font-display text-2xl tracking-tight uppercase">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.body}</p>
          </article>
        ))}
      </section>
    </main>
  );
}

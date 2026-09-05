import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarClock, GraduationCap, Link2, MapPin, ShieldCheck } from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { VADODARA_TURFS } from "@/lib/turf/vadodara-directory";
import { getMyProfile } from "@/lib/turf/server";
import type { DemoLogin } from "@/lib/turf/demo-logins";

export const Route = createFileRoute("/")({ component: Home });

function AuthSlot() {
  const { user, isPending } = useCurrentUserState();
  const [home, setHome] = useState<{ to: DemoLogin["home"]; label: string } | null>(null);

  useEffect(() => {
    if (!user) {
      setHome(null);
      return;
    }
    getMyProfile()
      .then((p) => setHome({ to: p.home, label: p.cta }))
      .catch(() => setHome({ to: "/desk", label: "Open desk" }));
  }, [user]);

  if (isPending) {
    return <div className="h-11 w-28 animate-pulse rounded-md bg-raised" />;
  }
  if (user) {
    if (!home) return <div className="h-11 w-28 animate-pulse rounded-md bg-raised" />;
    return (
      <Link to={home.to}>
        <Button size="sm">{home.label}</Button>
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
        <div className="flex items-center gap-2">
          <Link to="/turfs" className="text-sm text-muted hover:text-fg">
            Vadodara turfs
          </Link>
          <Link to="/learn" className="hidden text-sm text-muted hover:text-fg sm:inline">
            Owner academy
          </Link>
          <AuthSlot />
        </div>
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
              <Link to="/turfs" className="block">
                <Button size="lg" className="w-full sm:w-auto">
                  Vadodara turfs
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link to="/b/$slug" params={{ slug: "demo" }} className="block">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Book the demo turf
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

      <section className="mx-auto grid max-w-5xl gap-3 px-4 pb-6 sm:grid-cols-3">
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
            body: "Walk-ins, check-in, check-out, no-show. The person at the entrance runs the night.",
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

      <section className="mx-auto max-w-5xl px-4 pb-6">
        <article className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(232,242,235,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <MapPin className="mt-0.5 size-6 shrink-0 text-accent" />
            <div>
              <h2 className="font-display text-2xl tracking-tight uppercase">Vadodara directory</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                {VADODARA_TURFS.length} football, box-cricket and pickleball grounds, sorted
                from where you are. Greenfield Arena is live on Turf Community. The rest you
                can still call or visit.
              </p>
            </div>
          </div>
          <Link to="/turfs" className="shrink-0">
            <Button className="w-full sm:w-auto">
              See turfs by distance
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </article>
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-16">
        <article className="flex flex-col gap-4 rounded-lg bg-surface p-5 shadow-[0_0_0_1px_rgba(232,242,235,0.08)] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <GraduationCap className="mt-0.5 size-6 shrink-0 text-accent" />
            <div>
              <h2 className="font-display text-2xl tracking-tight uppercase">Owner academy</h2>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">
                What to fill on night one, a six-module course, the gate SOP, and FAQs.
                Staff and managers get their own logins from the owner desk.
              </p>
            </div>
          </div>
          <Link to="/learn" className="shrink-0">
            <Button variant="secondary" className="w-full sm:w-auto">
              Open academy
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </article>
      </section>
    </main>
  );
}

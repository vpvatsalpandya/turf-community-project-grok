import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/logo";
import { QrCode } from "@/components/qr-code";
import { ShareBox } from "@/components/share-box";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_TEMPLATES, renderTemplate } from "@/lib/turf/messages";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({ component: Home });

const DEMO_VARS = {
  customer_name: "Rahul",
  venue: "Greenfield Sports",
  resource: "Ground A",
  date: "Sat",
  time: "8:00pm",
  duration: "1 hour",
  amount: "₹1,200",
  ref_code: "GF-8PM",
  upi_id: "greenfield@upi",
  venue_phone: "98xxxxxx10",
};

const LOYALTY_CHIPS = [
  "10th Booking Free",
  "Weekday Warrior",
  "₹500 back on ₹5,000",
  "Bring 3 Friends",
];

const DEAD_HOURS = ["2pm", "3pm", "4pm"];
const DEAD_DAYS: { name: string; fill: number[] }[] = [
  { name: "Tue", fill: [10, 14, 8] },
  { name: "Wed", fill: [12, 9, 16] },
  { name: "Thu", fill: [11, 18, 10] },
];

function Home() {
  return (
    <div className="min-h-dvh bg-bg text-fg">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Wordmark />
        <nav className="flex items-center gap-3">
          <a href="#demo" className="hidden text-sm text-muted sm:inline">
            Demo
          </a>
          <Link to="/login" search={{ next: "/app" }} className="text-sm text-muted">
            Sign in
          </Link>
        </nav>
      </header>

      <section className="relative mx-auto max-w-6xl overflow-hidden px-5 pb-16 pt-6 md:pt-10">
        <div className="relative z-10 max-w-2xl">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">For turf owners in India</p>
          <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] tracking-tight md:text-6xl">
            Stop losing Saturday to a WhatsApp group.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted md:text-lg">
            Customers request a slot on a link. You confirm after the UPI hits. The calendar never lies, even when two people tap the same 8pm.
          </p>
          <div className="mt-8 flex flex-col items-start gap-3">
            <Link to="/login" search={{ next: "/app" }}>
              <Button size="lg">Sign in as the owner</Button>
            </Link>
            <a href="#demo" className="text-sm text-muted">
              See the labeled Greenfield demo below — not the product funnel.
            </a>
          </div>
        </div>
        <div className="mt-10 overflow-hidden rounded-[28px] shadow-[var(--shadow-border)]">
          <img
            src="/venues/greenfield-night.jpg"
            alt="Floodlit 5-a-side turf at night"
            className="aspect-[16/9] w-full object-cover outline outline-1 -outline-offset-1 outline-white/10"
          />
        </div>
      </section>

      <DemoBlock />
      <DeadHoursBlock />
      <PriceStepper />
      <GateQrBlock />
      <LoyaltyChips />

      <footer className="border-t border-border px-5 py-8 text-sm text-faint">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Wordmark />
          <div className="flex gap-4">
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DemoBlock() {
  const [picked, setPicked] = useState(false);
  const [share, setShare] = useState<"accept" | "decline" | null>(null);
  const confirmed = renderTemplate(DEFAULT_TEMPLATES.request_confirmed.hi, DEMO_VARS);
  const declined = renderTemplate(DEFAULT_TEMPLATES.request_declined.hi, DEMO_VARS);

  return (
    <section id="demo" className="border-t border-border bg-bg-2 py-16">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Demo</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">One slot. Accept or decline. Paste into WhatsApp.</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Local proof only — nothing is booked, and the API is not called. This is labeled DEMO so it is not a consumer entry.
        </p>
        <div className="mt-6 max-w-md rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-wide text-faint">Greenfield Sports · DEMO</p>
          <button
            type="button"
            onClick={() => {
              setPicked(true);
              setShare(null);
            }}
            className={cn(
              "slot-press mt-3 w-full rounded-lg bg-surface-2 px-3 py-3 text-left text-sm shadow-[var(--shadow-border)]",
              picked && "ring-2 ring-accent",
            )}
          >
            <span className="block font-medium">Ground A · Sat 8:00pm</span>
            <span className="text-muted">₹1,200</span>
          </button>
          {picked && (
            <div className="mt-4 flex gap-2">
              <Button
                size="sm"
                onClick={() => setShare("accept")}
              >
                Accept
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setShare("decline")}
              >
                Decline
              </Button>
            </div>
          )}
          {share === "accept" && (
            <div className="mt-4">
              <ShareBox text={confirmed} title="Paste-ready confirm" />
            </div>
          )}
          {share === "decline" && (
            <div className="mt-4">
              <ShareBox text={declined} title="Paste-ready decline" />
            </div>
          )}
        </div>
        <p className="mt-4">
          <Link to="/v/$slug" params={{ slug: "greenfield" }} className="text-sm text-muted underline-offset-2 hover:underline">
            Open the real request page
          </Link>
        </p>
      </div>
    </section>
  );
}

function DeadHoursBlock() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="grid items-center gap-10 md:grid-cols-2">
        <img
          src="/venues/greenfield-desk.jpg"
          alt="The booking desk"
          className="aspect-[4/3] w-full rounded-2xl object-cover outline outline-1 -outline-offset-1 outline-white/10"
        />
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Dead hours</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Tue–Thu 2–5pm is 12% booked.</h2>
          <p className="mt-2 text-sm text-muted">
            Owner math, not a consumer calendar. Those hours are why a quiet weekday price still pays the lights.
          </p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {DEAD_DAYS.map((d) => (
              <div key={d.name} className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
                <p className="text-xs font-medium text-muted">{d.name}</p>
                <ul className="mt-2 space-y-2">
                  {DEAD_HOURS.map((label, i) => (
                    <li key={label}>
                      <div className="flex items-center justify-between text-[11px] text-faint">
                        <span>{label}</span>
                        <span className="tabular">{d.fill[i]}%</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-accent/80"
                          style={{ width: `${d.fill[i]}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-3 text-sm font-medium tabular text-accent">12% booked across Tue–Thu 2–5pm</p>
        </div>
      </div>
    </section>
  );
}

function PriceStepper() {
  const [extra, setExtra] = useState(0);
  const [referral, setReferral] = useState("");
  const venues = 2 + extra;
  const total = 999 + extra * 249;
  const referred = referral.trim().length > 0;

  return (
    <section className="border-t border-border bg-bg-2 py-16">
      <div className="mx-auto max-w-xl px-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">₹999 / month</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">Two venues included. Extra pitches at ₹249.</h2>
        <p className="mt-2 text-sm text-muted">2 venues included at ₹999/month. Extra venues at ₹249 each.</p>
        <div className="mt-6 rounded-2xl bg-surface p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted">Extra venues</p>
              <p className="font-display text-2xl font-semibold tabular">{venues} total</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="grid size-11 place-items-center rounded-lg bg-surface-2 text-lg shadow-[var(--shadow-border)]"
                onClick={() => setExtra((n) => Math.max(0, n - 1))}
                aria-label="Fewer extra venues"
              >
                −
              </button>
              <span className="w-8 text-center tabular font-medium">{extra}</span>
              <button
                type="button"
                className="grid size-11 place-items-center rounded-lg bg-surface-2 text-lg shadow-[var(--shadow-border)]"
                onClick={() => setExtra((n) => n + 1)}
                aria-label="More extra venues"
              >
                +
              </button>
            </div>
          </div>
          <p className="mt-4 font-display text-3xl font-semibold tabular">₹{total.toLocaleString("en-IN")}/month</p>
          <label className="mt-4 block text-sm text-muted">
            Referral code
            <Input
              className="mt-1"
              placeholder="Optional"
              value={referral}
              onChange={(e) => setReferral(e.target.value)}
            />
          </label>
          {referred ? (
            <p className="mt-3 text-sm text-warn">
              Referred accounts pay in month one so the referrer can get paid.
            </p>
          ) : (
            <p className="mt-3 text-sm text-accent-2">First month free.</p>
          )}
          <p className="mt-4 text-xs text-faint">
            Phase 1: no WhatsApp API / no SMS / no payment gateway. Messages copy out of the desk onto the number your customers already trust.
          </p>
        </div>
      </div>
    </section>
  );
}

function GateQrBlock() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(`${window.location.origin}/v/greenfield`);
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Gate QR</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Print it. Tape it at the gate.</h2>
      <p className="mt-2 max-w-xl text-sm text-muted">
        Players scan this and land on the Greenfield request page. Free, and it makes the desk feel real before Saturday.
      </p>
      <div className="mt-6 max-w-xs">
        {url ? (
          <QrCode value={url} label="Gate QR — print and tape at the gate" className="print-qr" />
        ) : (
          <div className="aspect-square max-w-56 rounded-lg bg-surface-2" />
        )}
      </div>
    </section>
  );
}

function LoyaltyChips() {
  return (
    <section className="border-t border-border py-16">
      <div className="mx-auto max-w-6xl px-5">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-accent">Loyalty tools</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">Programs the owner runs — not a player feed.</h2>
        <p className="mt-2 max-w-xl text-sm text-muted">
          Tools the owner runs for their players. Turn one on from the desk. Points never spend at another turf.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          {LOYALTY_CHIPS.map((name) => (
            <span
              key={name}
              className="rounded-full bg-surface-2 px-3 py-2 text-sm shadow-[var(--shadow-border)]"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

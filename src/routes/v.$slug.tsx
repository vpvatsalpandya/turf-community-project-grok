import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, ShieldCheck } from "lucide-react";
import { Wordmark } from "@/components/logo";
import { ShareBox } from "@/components/share-box";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getAvailability,
  getPublicVenue,
  previewPromo,
  sendOtp,
  submitRequest,
  verifyOtp,
} from "@/lib/server/public-fns";
import { formatInr } from "@/lib/turf/money";
import { addDaysISO, defaultDeskDate, formatDateFull, formatTime } from "@/lib/turf/time";
import type { SlotOffer } from "@/lib/turf/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/v/$slug")({ component: VenuePage });

function VenuePage() {
  const { slug } = Route.useParams();
  const venueQ = useQuery({ queryKey: ["venue", slug], queryFn: () => getPublicVenue({ data: slug }) });
  const [date, setDate] = useState(defaultDeskDate());
  const availQ = useQuery({
    queryKey: ["avail", slug, date],
    queryFn: () => getAvailability({ data: { slug, date } }),
  });
  const [picked, setPicked] = useState<SlotOffer | null>(null);

  const data = venueQ.data;
  if (venueQ.isPending) {
    return (
      <div className="min-h-dvh bg-bg p-6 text-muted">
        Loading the turf…
      </div>
    );
  }
  if (!data) {
    return (
      <div className="grid min-h-dvh place-items-center bg-bg text-fg">
        <p>That turf is not listed.</p>
      </div>
    );
  }
  const { venue, resources, priceFromPaise } = data;

  return (
    <div className="min-h-dvh bg-bg pb-24 text-fg">
      <header className="flex items-center justify-between px-4 py-4">
        <Link to="/">
          <Wordmark compact />
        </Link>
        <Link to="/login" search={{ next: "/app" }} className="text-sm text-muted">
          Owner desk
        </Link>
      </header>

      <div className="relative">
        <img
          src={venue.photos[0]?.src ?? "/venues/greenfield-night.jpg"}
          alt={venue.photos[0]?.alt ?? venue.name}
          className="h-56 w-full object-cover md:h-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/20 to-transparent" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-xs uppercase tracking-[0.16em] text-accent">{venue.city}</p>
          <h1 className="font-display text-3xl font-semibold">{venue.name}</h1>
          {venue.address && (
            <p className="mt-1 flex items-center gap-1 text-sm text-muted">
              <MapPin className="size-3.5" /> {venue.address}
            </p>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4">
        <div className="mt-4 flex flex-wrap gap-2">
          {venue.amenities.map((a) => (
            <Badge key={a}>{a}</Badge>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">
          From {formatInr(priceFromPaise)} / hour · {resources.length} bookable pitches
        </p>
        <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">
          This is a <span className="text-fg">request</span>, not a booking. The owner confirms after they receive payment on UPI.
        </p>

        <div className="mt-6 flex items-center justify-between">
          <button type="button" className="size-11 rounded-lg hover:bg-surface-2" onClick={() => setDate(addDaysISO(date, -1))}>
            <ChevronLeft className="mx-auto" />
          </button>
          <div className="text-center">
            <p className="font-display text-lg font-semibold">{formatDateFull(date)}</p>
            <p className="text-xs text-faint">Times in {venue.timezone.replace("_", " ")}</p>
          </div>
          <button type="button" className="size-11 rounded-lg hover:bg-surface-2" onClick={() => setDate(addDaysISO(date, 1))}>
            <ChevronRight className="mx-auto" />
          </button>
        </div>

        <div className="mt-4 space-y-5">
          {resources
            .filter((r) => r.isBookable)
            .map((r) => {
              const slots = (availQ.data?.slots ?? []).filter((s) => s.resourceId === r.id);
              return (
                <section key={r.id}>
                  <h2 className="text-sm font-semibold">
                    {r.name}
                    {r.sport ? <span className="ml-2 font-normal text-muted">· {r.sport}</span> : null}
                  </h2>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {slots.length === 0 && (
                      <p className="col-span-3 text-sm text-muted">No hours published for this day.</p>
                    )}
                    {slots.map((s) => (
                      <button
                        key={s.startISO}
                        type="button"
                        disabled={!s.available}
                        onClick={() => setPicked(s)}
                        className={cn(
                          "slot-press rounded-lg px-2 py-2 text-left text-xs shadow-[var(--shadow-border)] transition-colors",
                          s.available
                            ? "bg-surface-2 hover:bg-surface-3"
                            : "bg-surface opacity-40",
                          picked?.startISO === s.startISO && picked.resourceId === s.resourceId && "ring-2 ring-accent",
                        )}
                      >
                        <span className="block font-medium tabular">{s.label.split(" · ")[0]}</span>
                        <span className="text-muted">{s.available ? formatInr(s.pricePaise) : "Taken"}</span>
                        {s.requestCount > 0 && s.available && (
                          <span className="mt-0.5 block text-[10px] text-warn">{s.requestCount} waiting</span>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
        </div>
      </div>

      {picked && (
        <RequestSheet
          slug={slug}
          slot={picked}
          upi={venue.upiId}
          onClose={() => setPicked(null)}
          onDone={() => {
            setPicked(null);
            void availQ.refetch();
          }}
        />
      )}
    </div>
  );
}

function RequestSheet({
  slug,
  slot,
  upi,
  onClose,
  onDone,
}: {
  slug: string;
  slot: SlotOffer;
  upi: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [promo, setPromo] = useState("");
  const [consent, setConsent] = useState(false);
  const [result, setResult] = useState<{ message: string; refCode: string; amountDuePaise: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [lang, setLang] = useState<"hi" | "en">("hi");

  const otpMut = useMutation({
    mutationFn: () => sendOtp({ data: { phone, slug } }),
    onSuccess: (d) => {
      setDemoCode(d.demoCode);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const verMut = useMutation({
    mutationFn: () => verifyOtp({ data: { phone, code: otp } }),
    onSuccess: () => {
      setVerified(true);
      setErr(null);
    },
    onError: (e: Error) => setErr(e.message),
  });
  const promoQ = useQuery({
    queryKey: ["promo", promo, slot.startISO],
    enabled: promo.length >= 4,
    queryFn: () =>
      previewPromo({
        data: { slug, code: promo, resourceId: slot.resourceId, startISO: slot.startISO, pricePaise: slot.pricePaise },
      }),
    retry: false,
  });
  const due = promoQ.data?.duePaise ?? slot.pricePaise;
  const submitMut = useMutation({
    mutationFn: () =>
      submitRequest({
        data: {
          slug,
          resourceId: slot.resourceId,
          startISO: slot.startISO,
          endISO: slot.endISO,
          name,
          phone,
          otpVerified: verified,
          promo,
          consent,
          language: lang,
        },
      }),
    onSuccess: (d) =>
      setResult({ message: d.message, refCode: d.refCode, amountDuePaise: d.amountDuePaise }),
    onError: (e: Error) => setErr(e.message),
  });

  const start = useMemo(() => new Date(slot.startISO), [slot.startISO]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-bg/70 p-0 md:items-center md:p-6">
      <div className="sheet-up max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-[var(--shadow-border)] md:rounded-3xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-faint">Request this slot</p>
            <h2 className="font-display text-xl font-semibold">
              {slot.resourceName} · {formatTime(start)}
            </h2>
            <p className="text-sm text-muted">
              {formatInr(due)}
              {promoQ.data?.discountPaise ? ` · saved ${formatInr(promoQ.data.discountPaise)}` : ""}
            </p>
          </div>
          <button type="button" className="text-sm text-muted" onClick={onClose}>
            Close
          </button>
        </div>

        {result ? (
          <div className="mt-5 space-y-4">
            <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent-2">
              Request {result.refCode} is in. This is not a booking until the owner confirms.
            </p>
            {upi && (
              <p className="text-sm">
                Pay <span className="tabular font-semibold">{formatInr(result.amountDuePaise)}</span> to{" "}
                <span className="font-mono">{upi}</span> then wait for confirmation.
              </p>
            )}
            <ShareBox text={result.message} title="Send to the turf on WhatsApp" />
            <Button className="w-full" onClick={onDone}>
              Done
            </Button>
          </div>
        ) : (
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              submitMut.mutate();
            }}
          >
            <Input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
            <div className="flex gap-2">
              <Input
                placeholder="10-digit mobile"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  setVerified(false);
                }}
                required
              />
              <Button type="button" variant="secondary" onClick={() => otpMut.mutate()} disabled={otpMut.isPending}>
                {otpMut.isPending ? "…" : "Code"}
              </Button>
            </div>
            {demoCode && !verified && (
              <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                No SMS in phase 1 — enter this code: <span className="font-mono text-accent">{demoCode}</span>
              </p>
            )}
            {demoCode && !verified && (
              <div className="flex gap-2">
                <Input placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" />
                <Button type="button" variant="secondary" onClick={() => verMut.mutate()}>
                  Verify
                </Button>
              </div>
            )}
            {verified && (
              <p className="flex items-center gap-1 text-sm text-accent-2">
                <ShieldCheck className="size-4" /> Number verified
              </p>
            )}
            <Input
              placeholder="Promo code (optional)"
              value={promo}
              onChange={(e) => setPromo(e.target.value.toUpperCase())}
            />
            {promoQ.isError && <p className="text-xs text-danger">{(promoQ.error as Error).message}</p>}
            <label className="flex items-start gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-accent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                required
              />
              <span>
                I agree that Turf Community and {slug} may use this number for booking management, service messages, and platform analytics. See{" "}
                <Link to="/privacy" className="underline">
                  Privacy
                </Link>
                .
              </span>
            </label>
            <div className="flex gap-2 text-xs">
              <button type="button" className={lang === "hi" ? "text-accent" : "text-muted"} onClick={() => setLang("hi")}>
                Hinglish
              </button>
              <button type="button" className={lang === "en" ? "text-accent" : "text-muted"} onClick={() => setLang("en")}>
                English
              </button>
            </div>
            {err && <p className="text-sm text-danger">{err}</p>}
            <Button type="submit" className="w-full" disabled={submitMut.isPending}>
              <Clock className="size-4" />
              {submitMut.isPending ? "Sending request…" : `Request ${formatInr(due)}`}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

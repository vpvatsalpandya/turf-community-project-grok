import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Check, ChevronLeft, MapPin, Navigation, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PitchMark } from "@/components/mark";
import { mapsDirFromVenue, telHref } from "@/lib/turf/live";
import { getPublicBoard, requestSlot, type Slot, type Venue } from "@/lib/turf/server";
import { addDays, formatIstDate, todayIst } from "@/lib/turf/time";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/b/$slug")({ component: BookPage });

function dates() {
  const start = todayIst();
  return Array.from({ length: 10 }, (_, i) => addDays(start, i));
}

type Done = {
  message: string;
  label: string;
  amountInr: number;
  upiId: string;
  venueName: string;
  pitch: number;
  payUri: string;
  qrSrc: string;
  ownerWa: string;
  mapsUrl: string;
  holdMinutes: number;
  holdUntil: string;
  address: string;
  phone: string;
  waOwner: { sent: boolean; error: string };
  waPlayer: { sent: boolean; error: string };
};

function BookPage() {
  const { slug } = Route.useParams();
  const dayOptions = useMemo(dates, []);
  const [date, setDate] = useState(dayOptions[0]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Slot | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [left, setLeft] = useState("");

  useEffect(() => {
    let live = true;
    setLoading(true);
    getPublicBoard({ data: { slug, date } })
      .then((res) => {
        if (!live) return;
        setVenue(res.venue);
        setSlots(res.slots);
      })
      .catch(() => {
        if (live) toast.error("Could not load this turf");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [slug, date]);

  useEffect(() => {
    if (!done?.holdUntil) return;
    function tick() {
      const ms = new Date(done!.holdUntil).getTime() - Date.now();
      if (ms <= 0) {
        setLeft("Hold dropped");
        return;
      }
      const m = Math.max(1, Math.ceil(ms / 60_000));
      setLeft(`${m} min left on the hold`);
    }
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, [done]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setBusy(true);
    try {
      const res = await requestSlot({
        data: { slug, startAt: picked.startAt, name, phone, notes },
      });
      setDone(res);
      setPicked(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  if (!loading && !venue) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4 text-center">
        <div>
          <PitchMark className="mx-auto size-12" />
          <h1 className="mt-4 font-display text-3xl uppercase">Link not live</h1>
          <p className="mt-2 text-sm text-muted">This turf has not published a booking page.</p>
          <Link to="/turfs" className="mt-6 inline-block text-sm text-accent">
            See Vadodara grounds
          </Link>
        </div>
      </main>
    );
  }

  const call = venue ? telHref(venue.phone) : null;
  const maps = venue ? mapsDirFromVenue(venue) : "";

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-28">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link to="/turfs" className="grid size-11 place-items-center rounded-md hover:bg-raised">
            <ChevronLeft className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-xl tracking-tight uppercase">
              {venue?.name ?? "Loading"}
            </p>
            {venue ? (
              <p className="flex items-center gap-1 text-xs text-muted">
                <MapPin className="size-3" />
                {venue.area ? `${venue.area}, ` : ""}
                {venue.city} · {inr(venue.priceInr)}/hr · {venue.sport}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      {done ? (
        <section className="space-y-4 px-4 pt-8">
          <div className="grid size-12 place-items-center rounded-full bg-accent text-accent-fg">
            <Check className="size-6" />
          </div>
          <h1 className="font-display text-4xl tracking-tight uppercase">Request sent</h1>
          <p className="text-sm leading-relaxed text-muted">
            {done.venueName} · {done.label} · Pitch {done.pitch}. The owner confirms after
            payment. This is not a guaranteed booking yet.
          </p>
          {done.waOwner.sent ? (
            <p className="text-sm text-accent">Owner was WhatsApp’d automatically.</p>
          ) : (
            <p className="text-sm text-warn">
              Automatic WhatsApp is not connected on this turf yet. Ping them below so the hold
              does not drop.
            </p>
          )}
          {left ? <p className="text-xs uppercase tracking-wide text-warn">{left}</p> : null}
          <div className="rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]">
            <p className="text-xs tracking-wide text-muted uppercase">Pay now</p>
            <p className="mt-1 font-display text-3xl tabular-nums">{inr(done.amountInr)}</p>
            {done.upiId ? (
              <p className="mt-1 text-sm text-fg">
                UPI · <span className="font-medium">{done.upiId}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">Pay at the counter, then wait.</p>
            )}
            {done.qrSrc ? (
              <img
                src={done.qrSrc}
                alt="UPI QR"
                className="mx-auto mt-4 size-44 rounded-md bg-fg p-2"
                crossOrigin="anonymous"
              />
            ) : null}
          </div>
          {done.payUri ? (
            <a href={done.payUri} className="block">
              <Button className="w-full">Pay with UPI</Button>
            </a>
          ) : null}
          <a href={done.ownerWa} target="_blank" rel="noreferrer" className="block">
            <Button variant={done.waOwner.sent ? "secondary" : "primary"} className="w-full">
              WhatsApp the owner
            </Button>
          </a>
          <div className="grid grid-cols-2 gap-2">
            {done.phone ? (
              <a href={telHref(done.phone) ?? undefined}>
                <Button variant="secondary" className="w-full">
                  <Phone className="size-4" />
                  Call
                </Button>
              </a>
            ) : null}
            <a href={done.mapsUrl} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="w-full">
                <Navigation className="size-4" />
                Maps
              </Button>
            </a>
          </div>
          <Button variant="ghost" className="w-full" onClick={() => setDone(null)}>
            Request another slot
          </Button>
        </section>
      ) : (
        <>
          {venue?.photos?.length ? (
            <div className="flex gap-2 overflow-x-auto px-4 pt-4">
              {venue.photos.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt=""
                  className="h-36 w-56 shrink-0 rounded-md object-cover"
                  crossOrigin="anonymous"
                />
              ))}
            </div>
          ) : null}
          {venue?.notes ? (
            <p className="px-4 pt-3 text-sm leading-relaxed text-muted">{venue.notes}</p>
          ) : null}
          <div className="mt-3 grid grid-cols-2 gap-2 px-4">
            {call ? (
              <a href={call}>
                <Button variant="secondary" className="w-full" size="sm">
                  <Phone className="size-4" />
                  Call gate
                </Button>
              </a>
            ) : (
              <Button variant="secondary" className="w-full" size="sm" disabled>
                No gate phone
              </Button>
            )}
            <a href={maps} target="_blank" rel="noreferrer">
              <Button variant="secondary" className="w-full" size="sm">
                <Navigation className="size-4" />
                Directions
              </Button>
            </a>
          </div>

          <div className="flex gap-2 overflow-x-auto px-4 py-4">
            {dayOptions.map((d) => {
              const active = d === date;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    setDate(d);
                    setPicked(null);
                  }}
                  className={`min-w-[4.5rem] shrink-0 rounded-md px-3 py-2 text-left transition-colors ${
                    active ? "bg-accent text-accent-fg" : "bg-surface text-fg"
                  }`}
                >
                  <span className="block text-[11px] tracking-wide uppercase opacity-80">
                    {formatIstDate(d).split(" ")[0]}
                  </span>
                  <span className="font-display text-lg leading-none">
                    {formatIstDate(d).split(" ").slice(1).join(" ")}
                  </span>
                </button>
              );
            })}
          </div>

          <section className="space-y-2 px-4">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-md bg-surface" />
                ))}
              </div>
            ) : (
              slots.map((slot) => {
                const locked = slot.status !== "open";
                const selected = picked?.startAt === slot.startAt;
                return (
                  <button
                    key={slot.startAt}
                    type="button"
                    disabled={locked}
                    onClick={() => setPicked(slot)}
                    className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left shadow-[0_0_0_1px_rgba(232,242,235,0.08)] transition-colors ${
                      selected
                        ? "bg-accent text-accent-fg"
                        : locked
                          ? "bg-surface/50 text-faint"
                          : "bg-surface text-fg hover:bg-raised"
                    }`}
                  >
                    <span>
                      <span className="block font-medium">{slot.label}</span>
                      <span className={`text-xs ${selected ? "opacity-80" : "text-muted"}`}>
                        {slot.status === "past"
                          ? "Started"
                          : slot.status === "held"
                            ? "Full"
                            : `${slot.openPitches} of ${slot.pitchCount} open`}
                      </span>
                    </span>
                    <span className="tabular-nums text-sm font-medium">{inr(slot.amountInr)}</span>
                  </button>
                );
              })
            )}
          </section>
        </>
      )}

      {picked && !done ? (
        <form
          onSubmit={submit}
          className="fixed inset-x-0 bottom-0 z-20 space-y-3 rounded-t-xl border-t border-border bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-8px_40px_rgba(0,0,0,0.45)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-xl uppercase">{picked.label}</p>
              <p className="text-xs text-muted">{inr(picked.amountInr)} · held for you after request</p>
            </div>
            <button type="button" className="text-sm text-muted" onClick={() => setPicked(null)}>
              Close
            </button>
          </div>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          <Field label="Mobile">
            <Input
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </Field>
          <Field label="Note to the owner">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Team name, 7-a-side, etc."
            />
          </Field>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Sending…" : "Request this slot"}
          </Button>
        </form>
      ) : null}
    </main>
  );
}

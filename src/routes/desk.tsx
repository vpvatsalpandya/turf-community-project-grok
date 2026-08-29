import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, Copy, Settings2, Share2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { PitchMark } from "@/components/mark";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addWalkIn, getMyDesk, saveVenue, setBookingStatus, type Booking, type Slot, type Venue } from "@/lib/turf/server";
import { addDays, formatIstDate, formatIstTime, todayIst } from "@/lib/turf/time";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/desk")({ component: DeskPage });
type Tab = "today" | "share" | "venue";

function DeskPage() {
  const { user, isPending } = useCurrentUserState();
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(todayIst);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [stats, setStats] = useState<{ pending: number; tonight: number; collected: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const userId = user?.id;
  const reload = useCallback(async () => {
    const res = await getMyDesk({ data: { date } });
    setVenue(res.venue); setBookings(res.bookings); setSlots(res.slots); setStats(res.stats);
  }, [date]);
  useEffect(() => {
    if (isPending || !userId) return;
    let live = true;
    setLoading(true);
    reload().catch((err) => { if (live) toast.error(err instanceof Error ? err.message : "Could not load desk"); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [isPending, userId, reload]);
  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(todayIst(), i)), []);
  if (isPending) return <main className="grid min-h-dvh place-items-center bg-bg text-muted">Loading desk…</main>;
  if (!user) return <RedirectToSignIn />;
  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-24">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <PitchMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg tracking-wide uppercase">{venue?.name ?? "Owner desk"}</p>
            <p className="truncate text-xs text-muted">{venue ? `${venue.city} · /b/${venue.slug}` : "Set up your turf"}</p>
          </div>
        </Link>
        <UserButton />
      </header>
      {tab === "today" ? <TodayBoard date={date} days={days} setDate={setDate} loading={loading} venue={venue} bookings={bookings} slots={slots} stats={stats} onChange={reload} onNeedVenue={() => setTab("venue")} /> : null}
      {tab === "share" ? <SharePanel venue={venue} /> : null}
      {tab === "venue" ? <VenueForm venue={venue} onSaved={async () => { await reload(); setTab("today"); }} /> : null}
      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto grid max-w-lg grid-cols-3">
          {([["today", CalendarDays, "Today"], ["share", Share2, "Share"], ["venue", Settings2, "Turf"]] as const).map(([id, Icon, label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${tab === id ? "text-accent" : "text-muted"}`}>
              <Icon className="size-5" />{label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function TodayBoard({ date, days, setDate, loading, venue, bookings, slots, stats, onChange, onNeedVenue }: {
  date: string; days: string[]; setDate: (d: string) => void; loading: boolean; venue: Venue | null;
  bookings: Booking[]; slots: Slot[]; stats: { pending: number; tonight: number; collected: number } | null;
  onChange: () => Promise<void>; onNeedVenue: () => void;
}) {
  const [walkStart, setWalkStart] = useState<string | null>(null);
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  if (!venue) {
    return (
      <section className="px-4 pt-6">
        <h1 className="font-display text-4xl uppercase">Set the pitch</h1>
        <p className="mt-2 text-sm text-muted">Name, hours, price, UPI. Then share the booking link. The diary can stay in the drawer.</p>
        <Button className="mt-6" onClick={onNeedVenue}>Create turf</Button>
      </section>
    );
  }
  const pending = bookings.filter((b) => b.status === "pending");
  async function act(id: string, status: string) {
    setBusyId(id);
    try { await setBookingStatus({ data: { id, status } }); await onChange(); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Could not update"); }
    finally { setBusyId(null); }
  }
  async function walkIn(e: FormEvent) {
    e.preventDefault();
    if (!walkStart) return;
    try {
      await addWalkIn({ data: { startAt: walkStart, name: walkName, phone: walkPhone } });
      setWalkStart(null); setWalkName(""); setWalkPhone(""); await onChange(); toast.success("Walk-in booked");
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not add walk-in"); }
  }
  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4">
        {days.map((d) => (
          <button key={d} type="button" onClick={() => setDate(d)} className={`min-w-[4.5rem] shrink-0 rounded-md px-3 py-2 text-left ${d === date ? "bg-accent text-accent-fg" : "bg-surface"}`}>
            <span className="block text-[11px] uppercase opacity-80">{formatIstDate(d).split(" ")[0]}</span>
            <span className="font-display text-lg leading-none">{formatIstDate(d).split(" ").slice(1).join(" ")}</span>
          </button>
        ))}
      </div>
      {stats ? (
        <div className="mt-4 grid grid-cols-3 gap-2 px-4">
          {[["Pending", String(stats.pending)], ["On the board", String(stats.tonight)], ["Tonight", inr(stats.collected)]].map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface px-3 py-3">
              <p className="text-[11px] tracking-wide text-muted uppercase">{label}</p>
              <p className="font-display text-2xl tabular-nums leading-tight">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
      <section className="mt-6 px-4">
        <h2 className="font-display text-xl tracking-wide uppercase">Requests</h2>
        {loading ? <div className="mt-2 h-20 animate-pulse rounded-md bg-surface" /> : pending.length === 0 ? <p className="mt-2 text-sm text-muted">No pending requests this day.</p> : (
          <ul className="mt-2 space-y-2">
            {pending.map((b) => (
              <li key={b.id} className="rounded-lg bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.customerName}</p>
                    <p className="text-xs text-muted">{formatIstTime(b.startAt)} · Pitch {b.pitchIndex} · {b.customerPhone}</p>
                    {b.notes ? <p className="mt-1 text-sm text-muted">{b.notes}</p> : null}
                  </div>
                  <p className="tabular-nums text-sm">{inr(b.amountInr)}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" disabled={busyId === b.id} onClick={() => act(b.id, "confirmed")}><Check className="size-4" />Confirm</Button>
                  <Button size="sm" variant="secondary" disabled={busyId === b.id} onClick={() => act(b.id, "declined")}><X className="size-4" />Decline</Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="mt-6 px-4">
        <h2 className="font-display text-xl tracking-wide uppercase">Slots</h2>
        <ul className="mt-2 space-y-1.5">
          {slots.map((slot) => {
            const occupying = bookings.filter((b) => ["pending", "confirmed", "checked_in"].includes(b.status) && b.startAt === slot.startAt);
            return (
              <li key={slot.startAt} className="flex items-center gap-3 rounded-md bg-surface px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="truncate text-xs text-muted">{occupying.length ? occupying.map((b) => `${b.customerName} · P${b.pitchIndex}`).join(" · ") : slot.status === "past" ? "Passed" : "Open"}</p>
                </div>
                {occupying.filter((b) => b.status === "confirmed").map((b) => (
                  <Button key={b.id} size="sm" variant="ghost" onClick={() => act(b.id, "checked_in")}>In</Button>
                ))}
                {slot.status === "open" ? <Button size="sm" variant="secondary" onClick={() => setWalkStart(slot.startAt)}>Walk-in</Button> : null}
              </li>
            );
          })}
        </ul>
      </section>
      {walkStart ? (
        <form onSubmit={walkIn} className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg space-y-3 rounded-t-xl border-t border-border bg-surface p-4">
          <div className="flex justify-between"><p className="font-display text-xl uppercase">Walk-in</p><button type="button" className="text-sm text-muted" onClick={() => setWalkStart(null)}>Close</button></div>
          <Field label="Name"><Input value={walkName} onChange={(e) => setWalkName(e.target.value)} /></Field>
          <Field label="Mobile"><Input value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} inputMode="numeric" /></Field>
          <Button type="submit" className="w-full">Confirm at gate</Button>
        </form>
      ) : null}
    </div>
  );
}

function SharePanel({ venue }: { venue: Venue | null }) {
  if (!venue) return <p className="px-4 text-sm text-muted">Create your turf first, then share the link.</p>;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/b/${venue.slug}`;
  const blurb = `Book ${venue.name} (${venue.area ? venue.area + ", " : ""}${venue.city}) here: ${url}`;
  return (
    <section className="space-y-4 px-4">
      <h1 className="font-display text-3xl uppercase">Share the link</h1>
      <p className="text-sm text-muted">Status, groups, the gate. Players request. You confirm after UPI.</p>
      <div className="rounded-lg bg-surface p-4 text-sm break-all">{url}</div>
      <Button className="w-full" onClick={async () => { await navigator.clipboard.writeText(url); toast.success("Link copied"); }}><Copy className="size-4" />Copy booking link</Button>
      <Button variant="secondary" className="w-full" onClick={async () => { await navigator.clipboard.writeText(blurb); toast.success("WhatsApp text copied"); }}>Copy WhatsApp status</Button>
      <Link to="/b/$slug" params={{ slug: venue.slug }} className="block"><Button variant="ghost" className="w-full">Open public page</Button></Link>
    </section>
  );
}

function VenueForm({ venue, onSaved }: { venue: Venue | null; onSaved: () => Promise<void> }) {
  const [name, setName] = useState(venue?.name ?? "");
  const [city, setCity] = useState(venue?.city ?? "Vadodara");
  const [area, setArea] = useState(venue?.area ?? "");
  const [pitchCount, setPitchCount] = useState(String(venue?.pitchCount ?? 1));
  const [priceInr, setPriceInr] = useState(String(venue?.priceInr ?? 800));
  const [slotMinutes, setSlotMinutes] = useState(String(venue?.slotMinutes ?? 60));
  const [openHour, setOpenHour] = useState(String(venue?.openHour ?? 6));
  const [closeHour, setCloseHour] = useState(String(venue?.closeHour ?? 23));
  const [upiId, setUpiId] = useState(venue?.upiId ?? "");
  const [phone, setPhone] = useState(venue?.phone ?? "");
  const [notes, setNotes] = useState(venue?.notes ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!venue) return;
    setName(venue.name); setCity(venue.city); setArea(venue.area); setPitchCount(String(venue.pitchCount));
    setPriceInr(String(venue.priceInr)); setSlotMinutes(String(venue.slotMinutes)); setOpenHour(String(venue.openHour));
    setCloseHour(String(venue.closeHour)); setUpiId(venue.upiId); setPhone(venue.phone); setNotes(venue.notes);
  }, [venue]);
  async function onSubmit(e: FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await saveVenue({ data: { name, city, area, pitchCount: Number(pitchCount), priceInr: Number(priceInr), slotMinutes: Number(slotMinutes), openHour: Number(openHour), closeHour: Number(closeHour), upiId, phone, notes } });
      toast.success("Turf saved"); await onSaved();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Could not save"); }
    finally { setBusy(false); }
  }
  return (
    <form onSubmit={onSubmit} className="space-y-3 px-4 pb-6">
      <h1 className="font-display text-3xl uppercase">Your turf</h1>
      <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} required /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Area"><Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Alkapuri" /></Field>
        <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pitches"><Input type="number" min={1} max={6} value={pitchCount} onChange={(e) => setPitchCount(e.target.value)} /></Field>
        <Field label="₹ per hour"><Input type="number" min={100} value={priceInr} onChange={(e) => setPriceInr(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Slot min"><Input type="number" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)} /></Field>
        <Field label="Opens"><Input type="number" min={0} max={22} value={openHour} onChange={(e) => setOpenHour(e.target.value)} /></Field>
        <Field label="Closes"><Input type="number" min={1} max={24} value={closeHour} onChange={(e) => setCloseHour(e.target.value)} /></Field>
      </div>
      <Field label="UPI id"><Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="turf@okaxis" /></Field>
      <Field label="Gate phone"><Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" /></Field>
      <Field label="Notes on the public page"><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? "Saving…" : "Save turf"}</Button>
    </form>
  );
}

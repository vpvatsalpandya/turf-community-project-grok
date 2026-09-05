import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Copy,
  GraduationCap,
  LogOut,
  MessageCircle,
  Phone,
  Settings2,
  Share2,
  UserX,
  Users,
  X,
} from "lucide-react";
import { Academy } from "@/components/academy";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PitchMark } from "@/components/mark";
import { WaConnect } from "@/components/wa-connect";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addTeamMember,
  addWalkIn,
  getMyDesk,
  getMyProfile,
  listTeam,
  removeTeamMember,
  saveVenue,
  setBookingStatus,
  type Booking,
  type Slot,
  type TeamMember,
  type Venue,
} from "@/lib/turf/server";
import {
  canConnectWa,
  canEditTurf,
  canManageTeam,
  canShareLink,
  isDeskRole,
  roleLabel,
} from "@/lib/turf/demo-logins";
import { SPORTS, telHref, waMeUrl, waShareUrl } from "@/lib/turf/live";
import { canAddPhoto, compressVenuePhoto } from "@/lib/turf/photos";
import { addDays, formatIstDate, formatIstTime, todayIst } from "@/lib/turf/time";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/desk")({ component: DeskPage });

type Tab = "today" | "share" | "venue" | "team" | "learn";

function DeskPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");
  const [date, setDate] = useState(todayIst);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [stats, setStats] = useState<{ pending: number; tonight: number; collected: number } | null>(
    null,
  );
  const [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(true);
  const lastPending = useRef(0);
  const skipNotify = useRef(true);

  const userId = user?.id;

  const reload = useCallback(async () => {
    const res = await getMyDesk({ data: { date } });
    setVenue(res.venue);
    setBookings(res.bookings);
    setSlots(res.slots);
    setStats(res.stats);
    setRole(res.role || "owner");
    const next = res.stats?.pending ?? 0;
    if (
      !skipNotify.current &&
      next > lastPending.current &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted"
    ) {
      const newest = res.bookings.find((b) => b.status === "pending");
      if (newest) {
        new Notification("New slot request", {
          body: `${newest.customerName} · ${formatIstTime(newest.startAt)} · ${inr(newest.amountInr)}`,
        });
      }
    }
    skipNotify.current = false;
    lastPending.current = next;
    if (typeof document !== "undefined") {
      const base = res.venue?.name ?? "Owner desk";
      document.title = next ? `(${next}) ${base}` : base;
    }
  }, [date]);

  useEffect(() => {
    if (isPending || !userId) return;
    let live = true;
    getMyProfile()
      .then((p) => {
        if (!live) return;
        if (p.role && !isDeskRole(p.role)) {
          void navigate({ to: p.home });
        }
      })
      .catch(() => {});
    setLoading(true);
    reload()
      .catch((err) => {
        if (live) toast.error(err instanceof Error ? err.message : "Could not load desk");
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [isPending, userId, reload, navigate]);

  useEffect(() => {
    if (isPending || !userId) return;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
    const tick = window.setInterval(() => {
      void reload().catch(() => {});
    }, 12_000);
    return () => window.clearInterval(tick);
  }, [isPending, userId, reload]);

  const days = useMemo(() => Array.from({ length: 8 }, (_, i) => addDays(todayIst(), i)), []);
  const shareOk = canShareLink(role);
  const turfOk = canEditTurf(role);
  const teamOk = canManageTeam(role);
  const waOk = canConnectWa(role);

  const tabs = useMemo(() => {
    const all: Array<[Tab, typeof CalendarDays, string]> = [["today", CalendarDays, "Today"]];
    if (shareOk) all.push(["share", Share2, "Share"]);
    if (turfOk) all.push(["venue", Settings2, "Turf"]);
    if (teamOk) all.push(["team", Users, "Team"]);
    all.push(["learn", GraduationCap, "Learn"]);
    return all;
  }, [shareOk, turfOk, teamOk]);

  useEffect(() => {
    if (!tabs.some(([id]) => id === tab)) setTab("today");
  }, [tabs, tab]);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg text-muted">Loading desk…</main>;
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-24">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <PitchMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="truncate font-display text-lg tracking-wide uppercase">
              {venue?.name ?? "Desk"}
            </p>
            <p className="truncate text-xs text-muted">
              {roleLabel(role)}
              {venue ? ` · ${venue.city}` : turfOk ? " · Set up your turf" : " · Ask the owner to add this login"}
            </p>
          </div>
        </Link>
        <UserButton />
      </header>

      {tab === "today" ? (
        <TodayBoard
          date={date}
          days={days}
          setDate={setDate}
          loading={loading}
          venue={venue}
          bookings={bookings}
          slots={slots}
          stats={stats}
          canCreate={turfOk}
          onChange={reload}
          onNeedVenue={() => setTab("venue")}
          onLearn={() => setTab("learn")}
        />
      ) : null}
      {tab === "share" && shareOk ? <SharePanel venue={venue} showWa={waOk} /> : null}
      {tab === "venue" && turfOk ? (
        <VenueForm
          venue={venue}
          onSaved={async () => {
            await reload();
            setTab("today");
          }}
        />
      ) : null}
      {tab === "team" && teamOk ? <TeamPanel /> : null}
      {tab === "learn" ? (
        <section className="px-4">
          <Academy venue={venue} />
        </section>
      ) : null}

      <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div
          className={`mx-auto grid max-w-lg ${
            tabs.length === 2
              ? "grid-cols-2"
              : tabs.length === 3
                ? "grid-cols-3"
                : tabs.length === 5
                  ? "grid-cols-5"
                  : "grid-cols-4"
          }`}
        >
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 text-xs ${
                tab === id ? "text-accent" : "text-muted"
              }`}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}

function TodayBoard({
  date,
  days,
  setDate,
  loading,
  venue,
  bookings,
  slots,
  stats,
  canCreate,
  onChange,
  onNeedVenue,
  onLearn,
}: {
  date: string;
  days: string[];
  setDate: (d: string) => void;
  loading: boolean;
  venue: Venue | null;
  bookings: Booking[];
  slots: Slot[];
  stats: { pending: number; tonight: number; collected: number } | null;
  canCreate: boolean;
  onChange: () => Promise<void>;
  onNeedVenue: () => void;
  onLearn: () => void;
}) {
  const [walkStart, setWalkStart] = useState<string | null>(null);
  const [walkName, setWalkName] = useState("");
  const [walkPhone, setWalkPhone] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  if (!venue) {
    return (
      <section className="px-4 pt-6">
        <h1 className="font-display text-4xl uppercase">{canCreate ? "Set the pitch" : "No turf yet"}</h1>
        <p className="mt-2 text-sm text-muted">
          {canCreate
            ? "Name, hours, price, UPI. Then share the booking link. The diary can stay in the drawer."
            : "This gate login is not linked to a turf. Ask the owner to add you under Team."}
        </p>
        {canCreate ? (
          <>
            <ul className="mt-5 space-y-1.5 text-sm text-muted">
              <li>
                <span className="text-accent">Needed</span> — turf name
              </li>
              <li>
                <span className="text-warn">Tonight</span> — area, city, pitches, ₹/hour, 60/90/120, hours, UPI,
                gate phone
              </li>
              <li>
                <span className="text-faint">Optional</span> — notes on the public page
              </li>
            </ul>
            <Button className="mt-6 w-full" onClick={onNeedVenue}>
              Create turf
            </Button>
          </>
        ) : null}
        <Button variant="secondary" className="mt-2 w-full" onClick={onLearn}>
          <GraduationCap className="size-4" />
          What to fill — academy
        </Button>
      </section>
    );
  }

  const pending = bookings.filter((b) => b.status === "pending");

  async function act(id: string, status: string) {
    setBusyId(id);
    try {
      await setBookingStatus({ data: { id, status } });
      await onChange();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  async function walkIn(e: FormEvent) {
    e.preventDefault();
    if (!walkStart) return;
    try {
      await addWalkIn({ data: { startAt: walkStart, name: walkName, phone: walkPhone } });
      setWalkStart(null);
      setWalkName("");
      setWalkPhone("");
      await onChange();
      toast.success("Walk-in booked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add walk-in");
    }
  }

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto px-4">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={`min-w-[4.5rem] shrink-0 rounded-md px-3 py-2 text-left ${
              d === date ? "bg-accent text-accent-fg" : "bg-surface"
            }`}
          >
            <span className="block text-xs uppercase opacity-80">
              {formatIstDate(d).split(" ")[0]}
            </span>
            <span className="font-display text-lg leading-none">
              {formatIstDate(d).split(" ").slice(1).join(" ")}
            </span>
          </button>
        ))}
      </div>

      {stats ? (
        <div className="mt-4 grid grid-cols-3 gap-2 px-4">
          {[
            ["Pending", String(stats.pending)],
            ["On the board", String(stats.tonight)],
            ["Tonight", inr(stats.collected)],
          ].map(([label, value]) => (
            <div key={label} className="rounded-md bg-surface px-3 py-3">
              <p className="text-xs tracking-wide text-muted uppercase">{label}</p>
              <p className="font-display text-2xl tabular-nums leading-tight">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <section className="mt-6 px-4">
        <h2 className="font-display text-xl tracking-wide uppercase">Requests</h2>
        {loading ? (
          <div className="mt-2 h-20 animate-pulse rounded-md bg-surface" />
        ) : pending.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No pending requests this day.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {pending.map((b) => (
              <li key={b.id} className="rounded-lg bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{b.customerName}</p>
                    <p className="text-xs text-muted">
                      {formatIstTime(b.startAt)} · Pitch {b.pitchIndex} · {b.customerPhone}
                    </p>
                    {b.notes ? <p className="mt-1 text-sm text-muted">{b.notes}</p> : null}
                    {b.holdLeft ? <p className="mt-1 text-xs text-warn">{b.holdLeft}</p> : null}
                  </div>
                  <p className="tabular-nums text-sm">{inr(b.amountInr)}</p>
                </div>
                <PlayerReach name={b.customerName} phone={b.customerPhone} venue={venue.name} />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={busyId === b.id}
                    onClick={() => act(b.id, "confirmed")}
                  >
                    <Check className="size-4" />
                    Confirm
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busyId === b.id}
                    onClick={() => act(b.id, "declined")}
                  >
                    <X className="size-4" />
                    Decline
                  </Button>
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
            const occupying = bookings.filter(
              (b) =>
                ["pending", "confirmed", "checked_in"].includes(b.status) &&
                b.startAt === slot.startAt,
            );
            return (
              <li
                key={slot.startAt}
                className="flex flex-wrap items-center gap-2 rounded-md bg-surface px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{slot.label}</p>
                  <p className="truncate text-xs text-muted">
                    {occupying.length
                      ? occupying.map((b) => `${b.customerName} · P${b.pitchIndex}`).join(" · ")
                      : slot.status === "past"
                        ? "Passed"
                        : "Open"}
                  </p>
                </div>
                {occupying
                  .filter((b) => b.status === "confirmed")
                  .map((b) => (
                    <div key={b.id} className="flex shrink-0 flex-wrap justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, "checked_in")}
                      >
                        In
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, "no_show")}
                      >
                        <UserX className="size-4" />
                        No-show
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyId === b.id}
                        onClick={() => act(b.id, "cancelled")}
                      >
                        Cancel
                      </Button>
                    </div>
                  ))}
                {occupying
                  .filter((b) => b.status === "checked_in")
                  .map((b) => (
                    <Button
                      key={b.id}
                      size="sm"
                      variant="ghost"
                      disabled={busyId === b.id}
                      onClick={() => act(b.id, "checked_out")}
                    >
                      <LogOut className="size-4" />
                      Out
                    </Button>
                  ))}
                {slot.status === "open" ? (
                  <Button size="sm" variant="secondary" onClick={() => setWalkStart(slot.startAt)}>
                    Walk-in
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      {walkStart ? (
        <form
          onSubmit={walkIn}
          className="fixed inset-x-0 bottom-16 z-20 mx-auto max-w-lg space-y-3 rounded-t-xl border-t border-border bg-surface p-4"
        >
          <div className="flex justify-between">
            <p className="font-display text-xl uppercase">Walk-in</p>
            <button type="button" className="text-sm text-muted" onClick={() => setWalkStart(null)}>
              Close
            </button>
          </div>
          <Field label="Name" hint="Captain or side name">
            <Input value={walkName} onChange={(e) => setWalkName(e.target.value)} />
          </Field>
          <Field label="Mobile" hint="10-digit Indian number. Can skip if they are already at the fence.">
            <Input value={walkPhone} onChange={(e) => setWalkPhone(e.target.value)} inputMode="numeric" />
          </Field>
          <Button type="submit" className="w-full">
            Confirm at gate
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function PlayerReach({
  name,
  phone,
  venue,
}: {
  name: string;
  phone: string;
  venue: string;
}) {
  const call = telHref(phone);
  const wa = waMeUrl(phone, `Hi ${name}, this is ${venue} desk.`);
  if (!call && !wa) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {call ? (
        <a href={call}>
          <Button size="sm" variant="ghost">
            <Phone className="size-4" />
            Call
          </Button>
        </a>
      ) : null}
      <a href={wa} target="_blank" rel="noreferrer">
        <Button size="sm" variant="ghost">
          <MessageCircle className="size-4" />
          WhatsApp
        </Button>
      </a>
    </div>
  );
}

function SharePanel({ venue, showWa }: { venue: Venue | null; showWa: boolean }) {
  if (!venue) {
    return <p className="px-4 text-sm text-muted">Create your turf first, then share the link.</p>;
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/b/${venue.slug}`;
  const blurb = `Book ${venue.name} (${venue.area ? venue.area + ", " : ""}${venue.city}) here: ${url}`;
  return (
    <section className="space-y-4 px-4 pb-6">
      <h1 className="font-display text-3xl uppercase">Share the link</h1>
      <p className="text-sm text-muted">
        Status, groups, the gate. Players request. You confirm after UPI. WhatsApp pings fire on
        their own once you connect it below.
      </p>
      <div className="rounded-lg bg-surface p-4 text-sm break-all">{url}</div>
      <Button
        className="w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied");
        }}
      >
        <Copy className="size-4" />
        Copy booking link
      </Button>
      <a href={waShareUrl(blurb)} target="_blank" rel="noreferrer" className="block">
        <Button variant="secondary" className="w-full">
          Share on WhatsApp
        </Button>
      </a>
      <Button
        variant="ghost"
        className="w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(blurb);
          toast.success("WhatsApp text copied");
        }}
      >
        Copy WhatsApp status
      </Button>
      <Link to="/b/$slug" params={{ slug: venue.slug }} className="block">
        <Button variant="ghost" className="w-full">
          Open public page
        </Button>
      </Link>
      <Link to="/learn" className="block">
        <Button variant="ghost" className="w-full">
          Send academy to gate staff
        </Button>
      </Link>
      {showWa ? (
        <div className="border-t border-border pt-6">
          <WaConnect title="Automatic WhatsApp" />
        </div>
      ) : (
        <p className="text-sm text-muted">
          Automatic WhatsApp is on the owner login. You can still share the booking link from here.
        </p>
      )}
    </section>
  );
}

function VenueForm({
  venue,
  onSaved,
}: {
  venue: Venue | null;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(venue?.name ?? "");
  const [city, setCity] = useState(venue?.city ?? "Vadodara");
  const [area, setArea] = useState(venue?.area ?? "");
  const [address, setAddress] = useState(venue?.address ?? "");
  const [sport, setSport] = useState(venue?.sport ?? "5-a-side football");
  const [pitchCount, setPitchCount] = useState(String(venue?.pitchCount ?? 1));
  const [priceInr, setPriceInr] = useState(String(venue?.priceInr ?? 800));
  const [slotMinutes, setSlotMinutes] = useState(String(venue?.slotMinutes ?? 60));
  const [openHour, setOpenHour] = useState(String(venue?.openHour ?? 6));
  const [closeHour, setCloseHour] = useState(String(venue?.closeHour ?? 23));
  const [upiId, setUpiId] = useState(venue?.upiId ?? "");
  const [phone, setPhone] = useState(venue?.phone ?? "");
  const [notes, setNotes] = useState(venue?.notes ?? "");
  const [photos, setPhotos] = useState<string[]>(venue?.photos ?? []);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!venue) return;
    setName(venue.name);
    setCity(venue.city);
    setArea(venue.area);
    setAddress(venue.address);
    setSport(venue.sport);
    setPitchCount(String(venue.pitchCount));
    setPriceInr(String(venue.priceInr));
    setSlotMinutes(String(venue.slotMinutes));
    setOpenHour(String(venue.openHour));
    setCloseHour(String(venue.closeHour));
    setUpiId(venue.upiId);
    setPhone(venue.phone);
    setNotes(venue.notes);
    setPhotos(venue.photos);
  }, [venue]);

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    if (!canAddPhoto(photos)) {
      toast.error("Three photos is the max");
      return;
    }
    try {
      const data = await compressVenuePhoto(file);
      setPhotos((prev) => [...prev, data]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add photo");
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await saveVenue({
        data: {
          name,
          city,
          area,
          address,
          pitchCount: Number(pitchCount),
          priceInr: Number(priceInr),
          slotMinutes: Number(slotMinutes),
          openHour: Number(openHour),
          closeHour: Number(closeHour),
          upiId,
          phone,
          notes,
          sport,
          photos,
        },
      });
      toast.success("Turf saved");
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-4 pb-6">
      <h1 className="font-display text-3xl uppercase">Your turf</h1>
      <p className="text-sm text-muted">
        Name is required. Fill UPI and hours before you share the link.
      </p>
      <Field label="Name" required hint="Becomes /b/your-turf-name on first save. At least 2 characters.">
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Area" hint="Locality players search for.">
          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="Alkapuri" />
        </Field>
        <Field label="City" hint="Defaults to Vadodara if blank.">
          <Input value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>
      <Field label="Gate address" hint="Printed on the public page and in Maps.">
        <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Alkapuri, Vadodara" />
      </Field>
      <Field label="Sport" hint="Shown on the directory card.">
        <Select value={sport} onChange={(e) => setSport(e.target.value)}>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pitches" hint="1–6. Same hour can be sold once per pitch.">
          <Input
            type="number"
            min={1}
            max={6}
            value={pitchCount}
            onChange={(e) => setPitchCount(e.target.value)}
          />
        </Field>
        <Field label="₹ per hour" hint="₹100–₹20,000. Slot price = this × length.">
          <Input
            type="number"
            min={100}
            value={priceInr}
            onChange={(e) => setPriceInr(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Slot" hint="60, 90 or 120.">
          <Select value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)}>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
            <option value="120">120 min</option>
          </Select>
        </Field>
        <Field label="Opens" hint="IST hour. 6 = 6am.">
          <Input type="number" min={0} max={22} value={openHour} onChange={(e) => setOpenHour(e.target.value)} />
        </Field>
        <Field label="Closes" hint="Must be later than opens. 23 = 11pm.">
          <Input
            type="number"
            min={1}
            max={24}
            value={closeHour}
            onChange={(e) => setCloseHour(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="UPI id"
        hint="Shown after they request. Leave blank only if they pay at the counter."
      >
        <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="turf@okaxis" />
      </Field>
      <Field label="Gate phone" hint="10-digit Indian mobile. Players call if they are lost.">
        <Input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Notes on the public page" hint="Shoes, extra ball, arrive 10 min early.">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <Field label="Night photos" hint="Up to three. Captains see these on the booking page.">
        <input
          type="file"
          accept="image/*"
          className="block w-full text-sm text-muted file:mr-3 file:h-11 file:rounded-md file:border-0 file:bg-raised file:px-3 file:text-fg"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            void onPhoto(file);
          }}
        />
      </Field>
      {photos.length ? (
        <ul className="grid grid-cols-3 gap-2">
          {photos.map((src, i) => (
            <li key={i} className="relative overflow-hidden rounded-md bg-raised">
              <img src={src} alt="" className="aspect-square w-full object-cover" crossOrigin="anonymous" />
              <button
                type="button"
                className="absolute top-1 right-1 grid size-8 place-items-center rounded-full bg-bg/80 text-fg"
                onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remove photo"
              >
                <X className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Saving…" : "Save turf"}
      </Button>
      <Link to="/learn" className="block text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
        Unsure what to fill? Open the academy
      </Link>
    </form>
  );
}

function TeamPanel() {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"staff" | "manager">("staff");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const rows = await listTeam();
    setMembers(rows);
  }

  useEffect(() => {
    reload().catch(() => setMembers([]));
  }, []);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await addTeamMember({ data: { name, email, password, role } });
      setName("");
      setEmail("");
      setPassword("");
      toast.success("Login added. Send them the email and password.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add login");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId: string) {
    setBusy(true);
    try {
      await removeTeamMember({ data: { userId } });
      toast.success("Removed from this turf");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 px-4 pb-6">
      <h1 className="font-display text-3xl uppercase">Gate logins</h1>
      <p className="text-sm leading-relaxed text-muted">
        Staff run tonight: confirm, walk-in, In / Out / no-show. Manager also shares the booking
        link. Neither can change UPI or price.
      </p>
      <ul className="space-y-2">
        {(members ?? []).map((m) => (
          <li key={m.userId} className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3">
            <div className="min-w-0">
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted">
                {roleLabel(m.role)} · {m.email}
              </p>
            </div>
            {m.role !== "owner" ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => void onRemove(m.userId)}>
                Remove
              </Button>
            ) : (
              <p className="text-xs text-faint">You</p>
            )}
          </li>
        ))}
      </ul>
      {members && members.length === 0 ? (
        <p className="text-sm text-muted">Save the turf sheet first, then add a gate login.</p>
      ) : null}

      <form onSubmit={onAdd} className="space-y-3 rounded-lg bg-surface p-4">
        <p className="font-display text-xl uppercase">Add a login</p>
        <Field label="Name" required hint="The person at the gate or the manager.">
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </Field>
        <Field label="Email" required hint="This is their sign-in.">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </Field>
        <Field label="Password" required hint="At least 8 characters. Send it on WhatsApp, not on the public page.">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>
        <Field label="Role" hint="Staff = board only. Manager = board + share.">
          <Select value={role} onChange={(e) => setRole(e.target.value as "staff" | "manager")}>
            <option value="staff">Gate staff</option>
            <option value="manager">Manager</option>
          </Select>
        </Field>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Add login"}
        </Button>
      </form>
    </section>
  );
}

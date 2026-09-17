import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Ellipsis,
  GraduationCap,
  Inbox,
  Settings2,
  Share2,
  Users,
  X,
} from "lucide-react";
import { Academy } from "@/components/academy";
import { DeskMore, type MorePane } from "@/components/desk-more";
import { NightBoard } from "@/components/night-board";
import { PersistBanner } from "@/components/persist-banner";
import { ShareBox } from "@/components/share-box";
import { MessageTemplates } from "@/components/message-templates";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { PitchMark } from "@/components/mark";
import { WaConnect } from "@/components/wa-connect";
import { ScreenLoader } from "@/components/screen-loader";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  addTeamMember,
  getMyDesk,
  getMyProfile,
  listTeam,
  removeTeamMember,
  saveVenue,
  setBookingStatus,
  type Booking,
  type Resource,
  type Slot,
  type TeamMember,
  type Venue,
  type WaitlistRow,
  type Blackout,
} from "@/lib/turf/server";
import type { SavedTemplate } from "@/lib/turf/messages";
import {
  canConnectWa,
  canEditTurf,
  canManageTeam,
  canShareLink,
  isDeskRole,
  roleLabel,
} from "@/lib/turf/demo-logins";
import { SPORTS, qrImageSrc, waShareUrl } from "@/lib/turf/live";
import { canAddPhoto, compressVenuePhoto } from "@/lib/turf/photos";
import { formatIstTime, todayIst } from "@/lib/turf/time";
import { inr } from "@/lib/utils";
import { cacheDayBoard, readDayBoard } from "@/lib/turf/offline-board";

export const Route = createFileRoute("/desk")({ component: DeskPage });

type Tab = "today" | "requests" | "share" | "venue" | "team" | "more" | "learn";

function DeskPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("today");
  const [morePane, setMorePane] = useState<MorePane>("waitlist");
  const [date, setDate] = useState(todayIst);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistRow[]>([]);
  const [noshow, setNoshow] = useState<Booking[]>([]);
  const [blackouts, setBlackouts] = useState<Blackout[]>([]);
  const [templates, setTemplates] = useState<SavedTemplate[]>([]);
  const [stale, setStale] = useState(false);
  const [persist, setPersist] = useState(true);
  const [stats, setStats] = useState<{ pending: number; tonight: number; collected: number; waitlist: number } | null>(
    null,
  );
  const [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(true);
  const lastPending = useRef(0);
  const skipNotify = useRef(true);
  const venueIdRef = useRef<string | null>(null);

  const userId = user?.id;

  const reload = useCallback(async () => {
    const apply = (res: {
      venue: Venue | null;
      bookings: Booking[];
      slots: Slot[];
      resources?: Resource[];
      waitlist?: WaitlistRow[];
      noshowCandidates?: Booking[];
      blackouts?: Blackout[];
      templates?: SavedTemplate[];
      persist?: boolean;
      stats: { pending: number; tonight: number; collected: number; waitlist: number } | null;
      role?: string;
    }) => {
      setVenue(res.venue);
      setBookings(res.bookings);
      setSlots(res.slots);
      setResources(res.resources ?? []);
      setWaitlist(res.waitlist ?? []);
      setNoshow(res.noshowCandidates ?? []);
      setBlackouts(res.blackouts ?? []);
      setTemplates(res.templates ?? []);
      setPersist(res.persist !== false);
      setStats(res.stats);
      setRole(res.role || "owner");
      if (res.venue) venueIdRef.current = res.venue.id;
    };

    try {
      const res = await getMyDesk({ data: { date } });
      apply(res);
      setStale(false);
      if (res.venue) cacheDayBoard(res.venue.id, date, res);
      const next = res.stats?.pending ?? 0;
      if (
        !skipNotify.current &&
        next > lastPending.current &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        const newest = res.bookings.find((b) => b.status === "requested" || b.status === "pending");
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
    } catch (err) {
      const cached = venueIdRef.current ? readDayBoard<Parameters<typeof apply>[0]>(venueIdRef.current, date) : null;
      if (cached?.data) {
        apply(cached.data);
        setStale(true);
        return;
      }
      throw err;
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

  const shareOk = canShareLink(role);
  const turfOk = canEditTurf(role);
  const teamOk = canManageTeam(role);
  const waOk = canConnectWa(role);
  const requestsOk = canShareLink(role);

  const tabs = useMemo(() => {
    const all: Array<[Tab, typeof CalendarDays, string]> = [["today", CalendarDays, "Tonight"]];
    if (requestsOk) all.push(["requests", Inbox, "Requests"]);
    if (shareOk) all.push(["share", Share2, "Share"]);
    if (turfOk) all.push(["venue", Settings2, "Setup"]);
    if (teamOk) all.push(["team", Users, "Team"]);
    all.push(["more", Ellipsis, "More"]);
    return all;
  }, [shareOk, turfOk, teamOk, requestsOk]);

  useEffect(() => {
    if (tab === "learn") return;
    if (!tabs.some(([id]) => id === tab)) setTab("today");
  }, [tabs, tab]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const focus = localStorage.getItem("turf-desk-focus");
    if (focus && turfOk) {
      setTab("venue");
    }
  }, [turfOk]);

  if (isPending) {
    return (
      <main className="min-h-dvh bg-bg">
        <ScreenLoader label="Opening desk…" />
      </main>
    );
  }
  if (!user) return <RedirectToSignIn />;
  if (loading && !venue) {
    return (
      <main className="min-h-dvh bg-bg">
        <ScreenLoader label="Loading tonight…" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-24">
      <PersistBanner persist={persist} />
      <header className="no-print flex items-center justify-between gap-3 px-4 py-4">
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("learn")}
            className={`grid size-11 place-items-center rounded-md ${
              tab === "learn" ? "bg-accent text-accent-fg" : "bg-surface text-muted"
            }`}
            aria-label="Academy"
          >
            <GraduationCap className="size-5" />
          </button>
          <UserButton />
        </div>
      </header>

      {tab === "today" ? (
        venue ? (
          <NightBoard
            date={date}
            setDate={setDate}
            venue={venue}
            bookings={bookings}
            slots={slots}
            resources={resources}
            waitlist={waitlist}
            noshow={noshow}
            blackouts={blackouts}
            templates={templates}
            stale={stale}
            stats={stats}
            loading={loading}
            onChange={reload}
            onOpenRequests={requestsOk ? () => setTab("requests") : undefined}
            onOpenWaitlist={() => {
              setMorePane("waitlist");
              setTab("more");
            }}
          />
        ) : (
          <EmptyDesk canCreate={turfOk} onNeedVenue={() => setTab("venue")} onLearn={() => setTab("learn")} />
        )
      ) : null}
      {tab === "requests" && requestsOk ? (
        <RequestsPanel
          bookings={bookings}
          venue={venue}
          loading={loading}
          onChange={reload}
        />
      ) : null}
      {tab === "share" && shareOk ? (
        <SharePanel venue={venue} showWa={waOk} templates={templates} onSaved={reload} />
      ) : null}
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
      {tab === "more" && venue ? (
        <DeskMore
          role={role}
          venue={venue}
          waitlist={waitlist}
          templates={templates}
          pane={morePane}
          setPane={setMorePane}
          onChange={reload}
        />
      ) : tab === "more" ? (
        <p className="px-4 text-sm text-muted">Create your turf first.</p>
      ) : null}
      {tab === "learn" ? (
        <section className="px-4">
          <Academy
            venue={venue}
            onFillField={
              turfOk
                ? (id) => {
                    localStorage.setItem("turf-desk-focus", id);
                    setTab("venue");
                  }
                : undefined
            }
          />
        </section>
      ) : null}

      <nav className="no-print fixed inset-x-0 bottom-0 z-10 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg overflow-x-auto">
          {tabs.map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-xs ${
                tab === id ? "text-accent" : "text-muted"
              }`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {id === "requests" && (stats?.pending ?? 0) > 0 ? (
                  <span className="absolute -top-1.5 -right-2 min-w-4 rounded-full bg-accent px-1 text-center text-xs tabular-nums text-accent-fg">
                    {stats?.pending}
                  </span>
                ) : null}
              </span>
              {label}
            </button>
          ))}
        </div>
      </nav>
    </main>
  );
}


function EmptyDesk({
  canCreate,
  onNeedVenue,
  onLearn,
}: {
  canCreate: boolean;
  onNeedVenue: () => void;
  onLearn: () => void;
}) {
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

function RequestsPanel({
  bookings,
  venue,
  loading,
  onChange,
}: {
  bookings: Booking[];
  venue: Venue | null;
  loading: boolean;
  onChange: () => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [share, setShare] = useState<string | null>(null);
  const requested = bookings.filter((b) => b.status === "requested" || b.status === "pending");
  const groups = new Map<string, Booking[]>();
  for (const b of requested) {
    const key = `${b.resourceId}:${b.startAt}`;
    const list = groups.get(key) ?? [];
    list.push(b);
    groups.set(key, list);
  }

  async function act(id: string, status: string) {
    setBusyId(id);
    try {
      const res = await setBookingStatus({ data: { id, status } });
      if (res.shareText) setShare(res.shareText);
      await onChange();
      toast.success(status === "confirmed" ? "Accepted — send this" : "Declined — send this");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusyId(null);
    }
  }

  if (!venue) {
    return <p className="px-4 text-sm text-muted">Create your turf first.</p>;
  }

  return (
    <section className="space-y-4 px-4 pb-6">
      <h1 className="font-display text-3xl uppercase">Requests</h1>
      <p className="text-sm text-muted">
        Many people can request the same hour. Accept one after UPI lands — the rest drop.
      </p>
      {share ? <ShareBox text={share} title="Send the winner" /> : null}
      {loading ? <div className="h-20 animate-pulse rounded-md bg-surface" /> : null}
      {requested.length === 0 && !loading ? (
        <p className="text-sm text-muted">No open requests this day.</p>
      ) : (
        [...groups.entries()].map(([key, rows]) => (
          <div key={key} className="rounded-lg bg-surface p-3">
            <p className="text-xs tracking-wide text-muted uppercase">
              Pitch {rows[0]?.pitchIndex} ·{" "}
              {new Date(rows[0]!.startAt).toLocaleTimeString("en-IN", {
                timeZone: "Asia/Kolkata",
                hour: "numeric",
                minute: "2-digit",
              })}
              {" · "}
              {rows.length} request{rows.length === 1 ? "" : "s"}
            </p>
            <ul className="mt-2 space-y-3">
              {rows.map((b) => (
                <li key={b.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{b.customerName}</p>
                      <p className="text-xs text-muted">
                        Pitch {b.pitchIndex} · {b.customerPhone}
                        {b.holdLeft ? ` · ${b.holdLeft}` : ""}
                      </p>
                    </div>
                    <p className="tabular-nums text-sm">{inr(b.amountInr)}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" disabled={busyId === b.id} onClick={() => void act(b.id, "confirmed")}>
                      <Check className="size-4" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyId === b.id}
                      onClick={() => void act(b.id, "declined")}
                    >
                      <X className="size-4" />
                      Decline
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  );
}

function SharePanel({
  venue,
  showWa,
  templates,
  onSaved,
}: {
  venue: Venue | null;
  showWa: boolean;
  templates: SavedTemplate[];
  onSaved: () => Promise<void>;
}) {
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
      <div className="print-qr rounded-lg bg-surface p-4">
        <p className="text-xs tracking-wide text-muted uppercase">Gate QR</p>
        <p className="mt-1 font-display text-2xl uppercase">{venue.name}</p>
        <p className="mt-2 text-sm text-muted">Print this. Tape it at the gate. Captains request from their phone.</p>
        <img
          src={qrImageSrc(url)}
          alt="Scan to request a slot"
          className="mx-auto mt-4 size-44 bg-fg p-2"
          crossOrigin="anonymous"
        />
        <div className="mt-3 flex flex-wrap gap-2 no-print">
          <Button size="sm" variant="secondary" onClick={() => window.print()}>
            Print QR
          </Button>
        </div>
      </div>
      <ShareBox text={url} title="Booking link" />
      <ShareBox text={blurb} title="WhatsApp status" />
      <ShareBox
        text={`Captains — book ${venue.name} on this link, pick the hour, send name + mobile. Pay UPI ${venue.upiId || "at the counter"}. The gate confirms after money lands.\n${url}`}
        title="Captains’ group"
      />
      <ShareBox
        text={`GATE CARD · ${venue.name}\n${url}\nUPI ${venue.upiId || "(counter)"}\nGate ${venue.phone || "(add phone)"}\nAccept one request after UPI. Decline frees the hour. Walk-in from an empty cell.`}
        title="Gate print"
      />
      <MessageTemplates venue={venue} templates={templates} canEdit onSaved={onSaved} />
      <a href={waShareUrl(blurb)} target="_blank" rel="noreferrer" className="block">
        <Button variant="secondary" className="w-full">
          Share on WhatsApp
        </Button>
      </a>
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
  const [focus, setFocus] = useState<string | null>(null);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = localStorage.getItem("turf-desk-focus");
    if (!id) return;
    setFocus(id);
    localStorage.removeItem("turf-desk-focus");
    window.setTimeout(() => {
      document.getElementById(`setup-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

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
        <Input id="setup-name" value={name} onChange={(e) => setName(e.target.value)} required className={focus === "name" ? "ring-2 ring-accent" : undefined} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Area" hint="Locality players search for.">
          <Input id="setup-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Alkapuri" />
        </Field>
        <Field label="City" hint="Defaults to Vadodara if blank.">
          <Input id="setup-city" value={city} onChange={(e) => setCity(e.target.value)} />
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
            id="setup-pitches"
            type="number"
            min={1}
            max={6}
            value={pitchCount}
            onChange={(e) => setPitchCount(e.target.value)}
          />
        </Field>
        <Field label="₹ per hour" hint="₹100–₹20,000. Slot price = this × length.">
          <Input
            id="setup-price"
            type="number"
            min={100}
            value={priceInr}
            onChange={(e) => setPriceInr(e.target.value)}
          />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Slot" hint="60, 90 or 120.">
          <Select id="setup-slot" value={slotMinutes} onChange={(e) => setSlotMinutes(e.target.value)}>
            <option value="60">60 min</option>
            <option value="90">90 min</option>
            <option value="120">120 min</option>
          </Select>
        </Field>
        <Field label="Opens" hint="IST hour. 6 = 6am.">
          <Input id="setup-open" type="number" min={0} max={23} value={openHour} onChange={(e) => setOpenHour(e.target.value)} />
        </Field>
        <Field label="Closes" hint="26 = 2am next day. 23 = 11pm.">
          <Input
            id="setup-hours"
            type="number"
            min={1}
            max={26}
            value={closeHour}
            onChange={(e) => setCloseHour(e.target.value)}
          />
        </Field>
      </div>
      <Field
        label="UPI id"
        hint="Shown after they request. Leave blank only if they pay at the counter."
      >
        <Input id="setup-upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="turf@okaxis" />
      </Field>
      <Field label="Gate phone" hint="10-digit Indian mobile. Players call if they are lost.">
        <Input id="setup-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" />
      </Field>
      <Field label="Notes on the public page" hint="Shoes, extra ball, arrive 10 min early.">
        <Textarea id="setup-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
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

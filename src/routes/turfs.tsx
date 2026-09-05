import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  LocateFixed,
  MapPin,
  Navigation,
  Phone,
  Sparkles,
} from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { listCommunityVenues } from "@/lib/turf/server";
import {
  mergeDirectory,
  matchesFilter,
  type ListedTurf,
  type SportFilter,
} from "@/lib/turf/vadodara-directory";
import {
  AREA_PINS,
  VADODARA_CENTRE,
  formatKm,
  mapsDirUrl,
  telHref,
  type LatLng,
} from "@/lib/turf/geo";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/turfs")({ component: TurfsPage });

type Filter = SportFilter;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "community", label: "On Community" },
  { id: "football", label: "Football" },
  { id: "cricket", label: "Box cricket" },
  { id: "pickleball", label: "Pickleball" },
];

function TurfsPage() {
  const [live, setLive] = useState<Awaited<ReturnType<typeof listCommunityVenues>>>([]);
  const [from, setFrom] = useState<LatLng | null>(VADODARA_CENTRE);
  const [originLabel, setOriginLabel] = useState("City centre");
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    listCommunityVenues()
      .then(setLive)
      .catch(() => {
        toast.error("Could not load Turf Community grounds");
      });
  }, []);
  const rows = useMemo(() => mergeDirectory(live, from), [live, from]);

  const visible = useMemo(() => rows.filter((row) => matchesFilter(row, filter)), [rows, filter]);

  const onCount = rows.filter((r) => r.onCommunity).length;
  const filterCounts: Record<Filter, number> = {
    all: rows.length,
    community: onCount,
    football: rows.filter((r) => matchesFilter(r, "football")).length,
    cricket: rows.filter((r) => matchesFilter(r, "cricket")).length,
    pickleball: rows.filter((r) => matchesFilter(r, "pickleball")).length,
  };

  function useGps() {
    if (!navigator.geolocation) {
      toast.error("This browser cannot share location");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFrom({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setOriginLabel("Your location");
        setLocating(false);
      },
      () => {
        setLocating(false);
        toast.error("Location blocked — pick an area instead");
      },
      { enableHighAccuracy: true, timeout: 12_000 },
    );
  }

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex min-w-0 items-center gap-2">
            <PitchMark className="size-8 shrink-0" />
            <span className="font-display text-lg tracking-wide uppercase">Turf Community</span>
          </Link>
          <Link to="/login" className="text-xs text-muted hover:text-fg">
            I run a turf
          </Link>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-6">
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">Vadodara</p>
        <h1 className="font-display text-4xl leading-none tracking-tight uppercase">
          Every ground, by distance.
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {rows.length} football, box-cricket and pickleball grounds from public listings.{" "}
          <span className="text-accent">{onCount} on Turf Community</span> — book those here.
          The rest you can call or visit.
        </p>
      </section>

      <section className="mt-5 px-4">
        <div className="flex gap-2">
          <Button className="flex-1" size="sm" onClick={useGps} disabled={locating}>
            <LocateFixed className="size-4" />
            {locating ? "Finding you…" : "Use my location"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-faint">
          Sorted from <span className="text-muted">{originLabel}</span>. Neighbourhood pins —
          Visit opens the exact gate in Maps.
        </p>
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {AREA_PINS.map((area) => {
            const active = originLabel === area.label && from?.lat === area.lat;
            return (
              <button
                key={area.id}
                type="button"
                onClick={() => {
                  setFrom({ lat: area.lat, lng: area.lng });
                  setOriginLabel(area.label);
                }}
                className={`h-11 shrink-0 rounded-md px-3 text-sm ${
                  active ? "bg-accent text-accent-fg" : "bg-surface text-muted"
                }`}
              >
                {area.label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-5 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`h-11 shrink-0 rounded-md px-3 text-xs font-medium ${
              filter === id ? "bg-accent text-accent-fg" : "bg-surface text-muted"
            }`}
            aria-label={`${label}, ${filterCounts[id]} grounds`}
            aria-pressed={filter === id}
          >
            {label} {filterCounts[id]}
          </button>
        ))}
      </div>

      <ul className="mt-4 space-y-3 px-4">
        {visible.length === 0 ? (
          <li className="rounded-lg bg-surface p-4 text-sm text-muted">
            No grounds in this filter. Try All, or pick another sport.
          </li>
        ) : (
          visible.map((row) => <TurfCard key={row.id} row={row} />)
        )}
      </ul>

      <p className="px-4 pt-8 text-xs leading-relaxed text-faint">
        Directory compiled August 2026 from TurfBooking, Hudle, Justdial, CricketGround,
        KheloMore, Playo and venue pages. Football turfs, box cricket and pickleball courts.
        Hours and rates change. Not every ground in the district is listed — owners can add
        theirs from the desk.
      </p>
    </main>
  );
}

function TurfCard({ row }: { row: ListedTurf }) {
  const phone = row.livePhone;
  const call = telHref(phone);
  const visit = mapsDirUrl(`${row.name}, ${row.address}`);

  return (
    <li
      className={`rounded-lg p-4 ${
        row.onCommunity
          ? "bg-surface shadow-[0_0_0_1px_var(--color-accent)]"
          : "bg-surface shadow-[0_0_0_1px_rgba(232,242,235,0.08)]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl tracking-tight uppercase">{row.name}</h2>
            {row.onCommunity ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
                <Sparkles className="size-3" />
                On Turf Community
              </span>
            ) : null}
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3 shrink-0" />
            {row.area}
            {row.km != null ? ` · ${formatKm(row.km)}` : null}
          </p>
        </div>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted">{row.address}</p>
      <p className="mt-1 text-xs text-faint">
        {row.sports.join(" · ")}
        {row.hours ? ` · ${row.hours}` : ""}
        {row.livePrice ? ` · from ${inr(row.livePrice)}/hr` : ""}
      </p>
      {row.notes ? <p className="mt-2 text-sm leading-relaxed text-fg/90">{row.notes}</p> : null}

      <div className="mt-3 flex flex-col gap-2">
        {row.onCommunity && row.slug ? (
          <Link to="/b/$slug" params={{ slug: row.slug }} className="block">
            <Button className="w-full">
              Book a slot
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        ) : (
          <p className="text-xs text-faint">Not on Turf Community yet — call or visit the gate.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {call ? (
            <a href={call}>
              <Button variant="secondary" className="w-full">
                <Phone className="size-4" />
                Call
              </Button>
            </a>
          ) : (
            <Button variant="secondary" className="w-full" disabled>
              <Phone className="size-4" />
              No number
            </Button>
          )}
          <a href={visit} target="_blank" rel="noreferrer">
            <Button variant="secondary" className="w-full">
              <Navigation className="size-4" />
              Visit
            </Button>
          </a>
        </div>
      </div>
    </li>
  );
}

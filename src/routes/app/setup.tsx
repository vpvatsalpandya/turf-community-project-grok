import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getDeskContext } from "@/lib/server/desk-fns";
import {
  getVenueSetup,
  saveHours,
  saveOverride,
  savePriceBand,
  saveResource,
  saveVenue,
} from "@/lib/server/setup-fns";
import { formatInr } from "@/lib/turf/money";
import { minutesFromMidnight } from "@/lib/turf/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/setup")({ component: Setup });

const AMENITIES = [
  "Floodlights",
  "Changing rooms",
  "Drinking water",
  "Parking",
  "First aid",
  "Cafe",
  "Washrooms",
  "Seating",
];
const STOCK = [
  { src: "/venues/greenfield-night.jpg", alt: "Floodlit pitch" },
  { src: "/venues/greenfield-dual.jpg", alt: "Two pitches" },
  { src: "/venues/greenfield-cricket.jpg", alt: "Box cricket" },
  { src: "/venues/greenfield-desk.jpg", alt: "Desk" },
];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SPORTS = ["football", "cricket", "tennis", "badminton", "other"];

function hhmm(mins: number) {
  const m = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function closeMinutes(open: string, close: string) {
  const o = minutesFromMidnight(open);
  let c = minutesFromMidnight(close);
  if (c <= o) c += 24 * 60;
  return c;
}

function Setup() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["setup", venueId],
    enabled: Boolean(venueId),
    queryFn: () => getVenueSetup({ data: { venueId } }),
  });
  const v = q.data?.venue;
  const [name, setName] = useState<string | null>(null);
  const [upi, setUpi] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [windowMin, setWindowMin] = useState<number | null>(null);
  const [amenities, setAmenities] = useState<string[] | null>(null);
  const [photos, setPhotos] = useState<{ src: string; alt: string }[] | null>(null);
  const [photoUrl, setPhotoUrl] = useState("");
  const [openPitch, setOpenPitch] = useState<string | null>(null);

  const saveV = useMutation({
    mutationFn: () =>
      saveVenue({
        data: {
          venueId: venueId!,
          name: name ?? v!.name,
          upiId: upi ?? v!.upiId ?? undefined,
          contactPhone: phone ?? v!.contactPhone ?? undefined,
          address: address ?? v!.address ?? undefined,
          city: city ?? v!.city ?? undefined,
          amenities: amenities ?? v!.amenities,
          requestWindowMinutes: windowMin ?? v!.requestWindowMinutes,
          photos: photos ?? v!.photos,
        },
      }),
    onSuccess: () => {
      toast.success("Venue saved");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPitch = useMutation({
    mutationFn: () =>
      saveResource({
        data: {
          venueId: venueId!,
          name: "New pitch",
          sport: "football",
          slotMinutes: 60,
          bufferMinutes: 0,
          isBookable: true,
        },
      }),
    onSuccess: (r) => {
      toast.success("Pitch added — hours copied from the first pitch");
      setOpenPitch(r.id);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = amenities ?? v?.amenities ?? [];
  const shots = photos ?? v?.photos ?? [];

  if (!v) return <p className="text-sm text-muted">Loading setup…</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold">Venue setup</h1>
        <p className="mt-1 text-sm text-muted">Hours, pitches, photos. Owners who skip this will half-finish and churn.</p>
      </div>

      <section className="space-y-3 rounded-2xl bg-surface p-4 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl font-semibold">Identity</h2>
        <Input defaultValue={v.name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <Input defaultValue={v.upiId ?? ""} onChange={(e) => setUpi(e.target.value)} placeholder="UPI id" />
        <Input defaultValue={v.contactPhone ?? ""} onChange={(e) => setPhone(e.target.value)} placeholder="Desk phone" />
        <Input defaultValue={v.address ?? ""} onChange={(e) => setAddress(e.target.value)} placeholder="Address" />
        <Input defaultValue={v.city ?? ""} onChange={(e) => setCity(e.target.value)} placeholder="City" />
        <label className="block text-sm text-muted">
          Request window
          <select
            className="mt-1 h-11 w-full rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
            defaultValue={v.requestWindowMinutes}
            onChange={(e) => setWindowMin(Number(e.target.value))}
          >
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
            <option value={480}>8 hours</option>
          </select>
        </label>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map((a) => {
            const on = active.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() =>
                  setAmenities(on ? active.filter((x) => x !== a) : [...active, a])
                }
                className={cn(
                  "h-11 rounded-lg px-3 text-sm shadow-[var(--shadow-border)]",
                  on ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted",
                )}
              >
                {a}
              </button>
            );
          })}
        </div>
        <div>
          <p className="mb-2 text-sm text-muted">Photos — tap to include, or paste a URL</p>
          <div className="grid grid-cols-4 gap-2">
            {STOCK.map((p) => {
              const on = shots.some((s) => s.src === p.src);
              return (
                <button
                  key={p.src}
                  type="button"
                  onClick={() =>
                    setPhotos(on ? shots.filter((s) => s.src !== p.src) : [...shots, p])
                  }
                  className={cn(
                    "overflow-hidden rounded-lg",
                    on ? "ring-2 ring-accent" : "opacity-70",
                  )}
                >
                  <img src={p.src} alt={p.alt} className="aspect-square w-full object-cover outline outline-1 -outline-offset-1 outline-fg/10" />
                </button>
              );
            })}
          </div>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!photoUrl.trim()) return;
              setPhotos([...shots, { src: photoUrl.trim(), alt: v.name }]);
              setPhotoUrl("");
            }}
          >
            <Input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://… photo URL" />
            <Button type="submit" variant="secondary">
              Add
            </Button>
          </form>
        </div>
        <Button onClick={() => saveV.mutate()} disabled={saveV.isPending}>
          Save venue
        </Button>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Pitches</h2>
          <Button size="sm" variant="secondary" onClick={() => addPitch.mutate()}>
            Add pitch
          </Button>
        </div>
        <ul className="space-y-2">
          {q.data?.resources.map((r) => (
            <PitchEditor
              key={r.id}
              venueId={venueId!}
              resource={r}
              parents={q.data.resources.filter((p) => p.id !== r.id)}
              windows={q.data.windows.filter((w) => w.resource_id === r.id)}
              open={openPitch === r.id}
              onToggle={() => setOpenPitch(openPitch === r.id ? null : r.id)}
            />
          ))}
        </ul>
      </section>

      <PriceSection
        venueId={venueId!}
        resources={q.data?.resources ?? []}
        bands={q.data?.bands ?? []}
      />

      <ClosureSection
        venueId={venueId!}
        overrides={q.data?.overrides ?? []}
      />
    </div>
  );
}

function PitchEditor({
  venueId,
  resource,
  parents,
  windows,
  open,
  onToggle,
}: {
  venueId: string;
  resource: {
    id: string;
    name: string;
    sport: string | null;
    parentId: string | null;
    slotMinutes: number;
    bufferMinutes: number;
    isBookable: boolean;
  };
  parents: { id: string; name: string }[];
  windows: { day_of_week: number; opens_at: string; closes_minutes_from_midnight: number }[];
  open: boolean;
  onToggle: () => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(resource.name);
  const [sport, setSport] = useState(resource.sport ?? "football");
  const [parentId, setParentId] = useState(resource.parentId ?? "");
  const [slot, setSlot] = useState(String(resource.slotMinutes));
  const [buffer, setBuffer] = useState(String(resource.bufferMinutes));
  const [bookable, setBookable] = useState(resource.isBookable);
  const sample = windows[0];
  const [opens, setOpens] = useState(sample ? String(sample.opens_at).slice(0, 5) : "06:00");
  const [closes, setCloses] = useState(sample ? hhmm(sample.closes_minutes_from_midnight) : "23:00");

  const save = useMutation({
    mutationFn: () =>
      saveResource({
        data: {
          venueId,
          id: resource.id,
          name,
          sport,
          parentId: parentId || null,
          slotMinutes: Number(slot) || 60,
          bufferMinutes: Number(buffer) || 0,
          isBookable: bookable,
        },
      }),
    onSuccess: () => {
      toast.success("Pitch saved");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const hours = useMutation({
    mutationFn: () =>
      saveHours({
        data: {
          venueId,
          resourceId: resource.id,
          days: DOW.map((_, i) => ({
            dayOfWeek: i,
            opensAt: opens,
            closesMinutes: closeMinutes(opens, closes),
          })),
        },
      }),
    onSuccess: () => {
      toast.success("Hours saved for every day");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <li className="rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
      <button type="button" className="flex w-full items-center justify-between text-left" onClick={onToggle}>
        <span>
          <span className="font-medium">{resource.name}</span>
          <span className="ml-2 text-sm text-muted">
            · {resource.sport} · {resource.slotMinutes} min
            {resource.parentId ? " · nested" : ""}
          </span>
        </span>
        <span className="text-sm text-faint">{open ? "Close" : "Edit"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3 border-t border-border pt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
          <select
            className="h-11 w-full rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
            value={sport}
            onChange={(e) => setSport(e.target.value)}
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="h-11 w-full rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">No parent (standalone)</option>
            {parents.map((p) => (
              <option key={p.id} value={p.id}>
                Nested under {p.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <Input value={slot} onChange={(e) => setSlot(e.target.value)} placeholder="Slot minutes" inputMode="numeric" />
            <Input value={buffer} onChange={(e) => setBuffer(e.target.value)} placeholder="Buffer minutes" inputMode="numeric" />
          </div>
          <label className="flex h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={bookable} onChange={(e) => setBookable(e.target.checked)} />
            Bookable on the public page
          </label>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save pitch
          </Button>
          <p className="text-xs uppercase tracking-wide text-faint">Hours (every day)</p>
          <div className="grid grid-cols-2 gap-2">
            <Input type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
            <Input type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
          </div>
          <Button variant="secondary" onClick={() => hours.mutate()} disabled={hours.isPending}>
            Save hours
          </Button>
        </div>
      )}
    </li>
  );
}

function PriceSection({
  venueId,
  resources,
  bands,
}: {
  venueId: string;
  resources: { id: string; name: string }[];
  bands: {
    id: string;
    resourceId: string;
    dayOfWeek: number | null;
    startsAt: string;
    endsAt: string;
    pricePaise: number;
    label: string | null;
  }[];
}) {
  const qc = useQueryClient();
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [starts, setStarts] = useState("17:00");
  const [ends, setEnds] = useState("21:00");
  const [rupees, setRupees] = useState("1500");
  const [label, setLabel] = useState("Peak");
  const add = useMutation({
    mutationFn: () =>
      savePriceBand({
        data: {
          venueId,
          resourceId,
          startsAt: starts,
          endsAt: ends,
          pricePaise: Math.round(Number(rupees) * 100),
          label,
        },
      }),
    onSuccess: () => {
      toast.success("Band added");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const nameOf = useMemo(() => Object.fromEntries(resources.map((r) => [r.id, r.name])), [resources]);
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">Price bands</h2>
      <ul className="mt-2 space-y-2">
        {bands.map((b) => (
          <li key={b.id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
            <span>
              {nameOf[b.resourceId] ?? "Pitch"} · {b.startsAt}–{b.endsAt} {b.label}{" "}
              {b.dayOfWeek != null ? `(${DOW[b.dayOfWeek]})` : ""}
            </span>
            <span className="flex items-center gap-2 tabular">
              {formatInr(b.pricePaise)}
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  savePriceBand({
                    data: {
                      venueId,
                      id: b.id,
                      resourceId: b.resourceId,
                      startsAt: b.startsAt,
                      endsAt: b.endsAt,
                      pricePaise: b.pricePaise,
                      delete: true,
                    },
                  }).then(() => qc.invalidateQueries())
                }
              >
                Remove
              </Button>
            </span>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid gap-2 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)] sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <select
          className="h-11 rounded-lg bg-surface-2 px-3 shadow-[var(--shadow-border)]"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
        >
          {resources.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" />
        <Input type="time" value={starts} onChange={(e) => setStarts(e.target.value)} />
        <Input type="time" value={ends} onChange={(e) => setEnds(e.target.value)} />
        <Input value={rupees} onChange={(e) => setRupees(e.target.value)} placeholder="₹" inputMode="numeric" />
        <Button type="submit" disabled={add.isPending || !resourceId}>
          Add band
        </Button>
      </form>
    </section>
  );
}

function ClosureSection({
  venueId,
  overrides,
}: {
  venueId: string;
  overrides: { id: string; onDate: string; isClosed: boolean; reason: string }[];
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("Holiday");
  const add = useMutation({
    mutationFn: () => saveOverride({ data: { venueId, onDate: date, isClosed: true, reason } }),
    onSuccess: () => {
      toast.success("Closed that date");
      setDate("");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section>
      <h2 className="font-display text-xl font-semibold">Closures</h2>
      <p className="text-sm text-muted">Rain day, Diwali, tournament — the public page hides slots.</p>
      <ul className="mt-2 space-y-2">
        {overrides.map((o) => (
          <li key={o.id} className="flex items-center justify-between rounded-xl bg-surface p-3 text-sm shadow-[var(--shadow-border)]">
            <span>
              {o.onDate} · {o.reason || "Closed"}
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                saveOverride({ data: { venueId, id: o.id, onDate: o.onDate, isClosed: true, reason: o.reason, delete: true } }).then(
                  () => qc.invalidateQueries(),
                )
              }
            >
              Remove
            </Button>
          </li>
        ))}
        {overrides.length === 0 && <p className="text-sm text-muted">No closures yet.</p>}
      </ul>
      <form
        className="mt-3 flex flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          add.mutate();
        }}
      >
        <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" />
        <Button type="submit" disabled={add.isPending}>
          Close date
        </Button>
      </form>
    </section>
  );
}

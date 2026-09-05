import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin } from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile, listPlayerNights, type PlayerBooking } from "@/lib/turf/server";
import { formatIstDate, formatIstTime } from "@/lib/turf/time";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/play")({ component: PlayPage });

function PlayPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [bookings, setBookings] = useState<PlayerBooking[] | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let live = true;
    getMyProfile()
      .then((p) => {
        if (!live) return;
        if (p.role !== "player") {
          void navigate({ to: p.home });
          return;
        }
        setName(p.name);
        return listPlayerNights();
      })
      .then((res) => {
        if (!live || !res || res.forbidden) return;
        setBookings(res.bookings);
        if (res.name) setName(res.name);
      })
      .catch(() => {
        if (live) setBookings([]);
      });
    return () => {
      live = false;
    };
  }, [isPending, user, navigate]);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg text-muted">Loading…</main>;
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-16">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <PitchMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-lg tracking-wide uppercase">My night</p>
            <p className="truncate text-xs text-muted">{name || "Player"}</p>
          </div>
        </Link>
        <UserButton />
      </header>

      <section className="space-y-3 px-4">
        <h1 className="font-display text-4xl tracking-tight uppercase">Your slots.</h1>
        <p className="text-sm leading-relaxed text-muted">
          Players do not need an account to request a slot. This desk is so you can
          see what you already asked for.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/turfs" className="block flex-1">
            <Button className="w-full">
              Vadodara grounds
              <ArrowRight className="size-4" />
            </Button>
          </Link>
          <Link to="/b/$slug" params={{ slug: "demo" }} className="block flex-1">
            <Button variant="secondary" className="w-full">
              Book Greenfield
            </Button>
          </Link>
        </div>
      </section>

      <ul className="mt-6 space-y-3 px-4">
        {bookings === null ? (
          <li className="h-28 animate-pulse rounded-lg bg-surface" />
        ) : bookings.length === 0 ? (
          <li className="rounded-lg bg-surface p-4 text-sm text-muted">
            No requests yet. Pick a turf and send a slot.
          </li>
        ) : (
          bookings.map((row) => <RequestCard key={row.id} row={row} />)
        )}
      </ul>
    </main>
  );
}

function RequestCard({ row }: { row: PlayerBooking }) {
  const start = new Date(row.startAt);
  const dateKey = start.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return (
    <li className="rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl tracking-tight uppercase">{row.venueName}</h2>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin className="size-3" />
            Pitch {row.pitchIndex} · {formatIstDate(dateKey)} · {formatIstTime(row.startAt)}
          </p>
        </div>
        <StatusPill status={row.status} />
      </div>
      <p className="mt-2 text-sm text-muted">
        {inr(row.amountInr)}
        {row.notes ? ` · ${row.notes}` : ""}
      </p>
      <Link to="/b/$slug" params={{ slug: row.slug }} className="mt-3 block">
        <Button variant="secondary" className="w-full" size="sm">
          Open booking page
        </Button>
      </Link>
    </li>
  );
}

function StatusPill({ status }: { status: string }) {
  const label =
    status === "pending"
      ? "Waiting on desk"
      : status === "confirmed"
        ? "Confirmed"
        : status === "checked_in"
          ? "In"
          : status === "checked_out"
            ? "Out"
          : status;
  const accent = status === "pending" ? "text-warn" : "text-accent";
  return <span className={`text-xs font-medium uppercase ${accent}`}>{label}</span>;
}

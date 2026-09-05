import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button } from "@/components/ui/button";
import { WaConnect } from "@/components/wa-connect";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { getMyProfile, listAdminBoard } from "@/lib/turf/server";
import { formatIstTime } from "@/lib/turf/time";
import { inr } from "@/lib/utils";

export const Route = createFileRoute("/admin")({ component: AdminPage });

type Board = Awaited<ReturnType<typeof listAdminBoard>>;

function AdminPage() {
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Extract<Board, { forbidden: false }> | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let live = true;
    getMyProfile()
      .then((p) => {
        if (!live) return;
        if (p.role !== "admin") {
          void navigate({ to: p.home });
          return;
        }
        return listAdminBoard();
      })
      .then((res) => {
        if (!live || !res || res.forbidden) return;
        setBoard(res);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [isPending, user, navigate]);

  if (isPending) {
    return <main className="grid min-h-dvh place-items-center bg-bg text-muted">Loading HQ…</main>;
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-16">
      <header className="flex items-center justify-between gap-3 px-4 py-4">
        <Link to="/" className="flex min-w-0 items-center gap-2">
          <PitchMark className="size-8 shrink-0" />
          <div className="min-w-0">
            <p className="font-display text-lg tracking-wide uppercase">HQ</p>
            <p className="truncate text-xs text-muted">Platform admin</p>
          </div>
        </Link>
        <UserButton />
      </header>

      <section className="space-y-3 px-4">
        <h1 className="font-display text-4xl tracking-tight uppercase">Every live turf.</h1>
        <p className="text-sm leading-relaxed text-muted">
          Owners run their own desk. You see who is on Turf Community tonight.
        </p>
      </section>

      {board ? (
        <>
          <section className="mt-5 grid grid-cols-3 gap-2 px-4">
            <Stat label="On Community" value={String(board.onCommunity)} />
            <Stat label="Directory" value={String(board.directoryTotal)} />
            <Stat label="Pending" value={String(board.pending)} />
          </section>

          <section className="mt-8 px-4">
            <h2 className="font-display text-2xl tracking-tight uppercase">Tonight</h2>
            <ul className="mt-3 space-y-2">
              {board.tonight.length === 0 ? (
                <li className="rounded-lg bg-surface p-4 text-sm text-muted">No bookings on the clock yet.</li>
              ) : (
                board.tonight.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]"
                  >
                    <div>
                      <p className="text-sm text-fg">{row.customerName}</p>
                      <p className="text-xs text-muted">
                        {row.venueName} · {formatIstTime(row.startAt)} · {inr(row.amountInr)}
                      </p>
                    </div>
                    <span className={`text-xs uppercase ${row.status === "pending" ? "text-warn" : "text-accent"}`}>
                      {row.status}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="mt-8 px-4">
            <h2 className="font-display text-2xl tracking-tight uppercase">Live venues</h2>
            <ul className="mt-3 space-y-2">
              {board.venues.map((v) => (
                <li
                  key={v.slug}
                  className="rounded-lg bg-surface p-4 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]"
                >
                  <p className="font-display text-2xl tracking-tight uppercase">{v.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {v.area || v.city} · from {inr(v.priceInr)}/hr
                  </p>
                  <Link to="/b/$slug" params={{ slug: v.slug }} className="mt-3 block">
                    <Button variant="secondary" size="sm" className="w-full">
                      Public page
                      <ArrowRight className="size-4" />
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <section className="mt-8 px-4 pb-10">
            <WaConnect title="Platform WhatsApp" />
          </section>
        </>
      ) : (
        <div className="mt-6 space-y-3 px-4">
          <div className="h-20 animate-pulse rounded-lg bg-surface" />
          <div className="h-32 animate-pulse rounded-lg bg-surface" />
        </div>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface p-3 shadow-[0_0_0_1px_rgba(232,242,235,0.08)]">
      <p className="font-display text-3xl tracking-tight">{value}</p>
      <p className="mt-1 text-[11px] tracking-wide text-muted uppercase">{label}</p>
    </div>
  );
}

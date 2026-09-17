import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, MapPin, Navigation, Phone, Sparkles } from "lucide-react";
import { PitchMark } from "@/components/mark";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { ScreenLoader } from "@/components/screen-loader";
import { listCommunityVenues } from "@/lib/turf/server";
import { mergeDirectory } from "@/lib/turf/vadodara-directory";
import { VADODARA_CENTRE, formatKm, mapsDirUrl, telHref } from "@/lib/turf/geo";
import { cn, inr } from "@/lib/utils";

export const Route = createFileRoute("/g/$id")({ component: GroundPage });

function GroundPage() {
  const { id } = Route.useParams();
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState<Awaited<ReturnType<typeof listCommunityVenues>>>([]);

  useEffect(() => {
    listCommunityVenues()
      .then(setLive)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const row = useMemo(
    () => mergeDirectory(live, VADODARA_CENTRE).find((item) => item.id === id),
    [live, id],
  );

  if (loading) {
    return (
      <main className="min-h-dvh bg-bg">
        <ScreenLoader label="Opening ground…" />
      </main>
    );
  }

  if (!row) {
    return (
      <main className="grid min-h-dvh place-items-center bg-bg px-4 text-center">
        <div>
          <PitchMark className="mx-auto size-12" />
          <h1 className="mt-4 font-display text-3xl uppercase">Ground not listed</h1>
          <Link to="/turfs" className="mt-6 inline-block text-sm text-accent">
            Back to Vadodara turfs
          </Link>
        </div>
      </main>
    );
  }

  const call = telHref(row.livePhone);
  const visit = mapsDirUrl(`${row.name}, ${row.address}`);

  return (
    <main className="mx-auto min-h-dvh max-w-lg bg-bg pb-16">
      <header className="sticky top-0 z-10 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link to="/turfs" className="grid size-11 place-items-center rounded-md hover:bg-raised">
            <ChevronLeft className="size-5" />
          </Link>
          <p className="min-w-0 truncate font-display text-xl tracking-tight uppercase">{row.name}</p>
        </div>
      </header>

      <section className="space-y-3 px-4 pt-6">
        {row.onCommunity ? (
          <p className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-fg">
            <Sparkles className="size-3" />
            On Turf Community
          </p>
        ) : (
          <p className="text-xs font-medium tracking-[0.18em] text-muted uppercase">Directory</p>
        )}
        <h1 className="font-display text-4xl leading-none tracking-tight uppercase">{row.name}</h1>
        <p className="flex items-center gap-1 text-sm text-muted">
          <MapPin className="size-4 shrink-0" />
          {row.area}
          {row.km != null ? ` · ${formatKm(row.km)} from city centre` : null}
        </p>
        <p className="text-sm leading-relaxed text-muted">{row.address}</p>
        <p className="text-sm text-fg/90">
          {row.sports.join(" · ")}
          {row.hours ? ` · ${row.hours}` : ""}
          {row.livePrice ? ` · from ${inr(row.livePrice)}/hr` : ""}
        </p>
        {row.notes ? <p className="text-sm leading-relaxed text-muted">{row.notes}</p> : null}
      </section>

      <section className="mt-6 space-y-2 px-4">
        {row.onCommunity && row.slug ? (
          <Link
            to="/b/$slug"
            params={{ slug: row.slug }}
            className={cn(buttonVariants({ variant: "primary" }), "w-full")}
          >
            Book a slot
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
        <div className="grid grid-cols-2 gap-2">
          {call ? (
            <ButtonLink href={call} variant="secondary" className="w-full">
              <Phone className="size-4" />
              Call
            </ButtonLink>
          ) : (
            <Button variant="secondary" className="w-full" disabled>
              <Phone className="size-4" />
              No number
            </Button>
          )}
          <ButtonLink href={visit} target="_blank" rel="noreferrer" variant="secondary" className="w-full">
            <Navigation className="size-4" />
            Visit
          </ButtonLink>
        </div>
      </section>
    </main>
  );
}

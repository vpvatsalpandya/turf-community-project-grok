import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DayBoard } from "@/components/day-board";
import { getDeskContext } from "@/lib/server/desk-fns";
import { addDaysISO, formatDateLong, localDateISO } from "@/lib/turf/time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/calendar")({ component: Calendar });

function Calendar() {
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const start = localDateISO();
  const days = Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  const [date, setDate] = useState(start);
  const venue = ctx.data?.venue;
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold">Week</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDate(d)}
            className={cn(
              "min-w-[4.5rem] rounded-xl px-3 py-2 text-sm shadow-[var(--shadow-border)]",
              d === date ? "bg-accent text-accent-fg" : "bg-surface",
            )}
          >
            {formatDateLong(d)}
          </button>
        ))}
      </div>
      <div className="mt-4">{venue && <DayBoard venueId={venue.id} date={date} />}</div>
    </div>
  );
}

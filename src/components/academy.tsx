import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  Check,
  ChevronDown,
  ClipboardList,
  Copy,
  GraduationCap,
  HelpCircle,
  ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACCOUNT_FIELDS,
  FAQS,
  MODULES,
  NIGHT_CARD,
  NOT_COLLECTED,
  SOP_SECTIONS,
  TURF_FIELDS,
  requiredLabel,
  type AcademyField,
} from "@/lib/turf/academy";
import type { Venue } from "@/lib/turf/server";
import { cn } from "@/lib/utils";

type Pane = "fill" | "modules" | "sop" | "faq";

const DONE_KEY = "turf-academy-done";

function loadDone(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DONE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function FieldTable({ rows }: { rows: AcademyField[] }) {
  return (
    <ul className="space-y-2">
      {rows.map((row) => (
        <li key={row.field} className="rounded-md bg-surface px-3 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{row.field}</p>
            <span
              className={cn(
                "shrink-0 text-xs tracking-wide uppercase",
                row.required === "needed"
                  ? "text-accent"
                  : row.required === "should"
                    ? "text-warn"
                    : "text-faint",
              )}
            >
              {requiredLabel(row.required)}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">e.g. {row.example}</p>
          <p className="mt-1 text-sm leading-relaxed text-fg/90">{row.why}</p>
        </li>
      ))}
    </ul>
  );
}

export function Academy({ venue }: { venue?: Venue | null }) {
  const [pane, setPane] = useState<Pane>("fill");
  const [openModule, setOpenModule] = useState<string | null>(MODULES[0]?.id ?? null);
  const [done, setDone] = useState<string[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    setDone(loadDone());
  }, []);

  function toggleDone(id: string) {
    setDone((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const progress = useMemo(
    () => Math.round((done.filter((id) => MODULES.some((m) => m.id === id)).length / MODULES.length) * 100),
    [done],
  );

  const nightCard = venue
    ? `${NIGHT_CARD}\n\nThis ground: ${venue.name}${venue.area ? ` · ${venue.area}` : ""}, ${venue.city}\nUPI: ${venue.upiId || "(pay at counter)"}\nGate: ${venue.phone || "(add a gate phone)"}\nLink: /b/${venue.slug}`
    : NIGHT_CARD;

  return (
    <div className="space-y-5">
      <header className="space-y-2">
        <p className="flex items-center gap-2 text-xs font-medium tracking-[0.18em] text-accent uppercase">
          <GraduationCap className="size-4" />
          Owner academy
        </p>
        <h1 className="font-display text-4xl leading-none tracking-tight uppercase">
          Fill this. Run the night.
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          Twelve minutes. Share this page with the person at the entrance — they do not
          need the owner password.
        </p>
        <div className="h-1.5 overflow-hidden rounded-full bg-raised">
          <div
            className="h-full bg-accent transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-faint">{progress}% of modules marked done on this phone</p>
      </header>

      <nav className="grid grid-cols-4 gap-1 rounded-md bg-surface p-1">
        {(
          [
            ["fill", ListChecks, "Fill"],
            ["modules", GraduationCap, "Learn"],
            ["sop", ClipboardList, "SOP"],
            ["faq", HelpCircle, "FAQ"],
          ] as const
        ).map(([id, Icon, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPane(id)}
            className={cn(
              "flex h-11 min-h-11 flex-col items-center justify-center rounded-sm text-xs",
              pane === id ? "bg-accent text-accent-fg" : "text-muted",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </nav>

      {pane === "fill" ? (
        <section className="space-y-6">
          <div>
            <h2 className="font-display text-2xl tracking-wide uppercase">1. Owner account</h2>
            <p className="mt-1 text-sm text-muted">Sign up or continue with Grok. Then the desk opens.</p>
            <div className="mt-3">
              <FieldTable rows={ACCOUNT_FIELDS} />
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-wide uppercase">2. The turf sheet</h2>
            <p className="mt-1 text-sm text-muted">
              Desk → Turf. Name is the only hard stop. Fill the rest before you share the link.
            </p>
            <div className="mt-3">
              <FieldTable rows={TURF_FIELDS} />
            </div>
          </div>
          <div>
            <h2 className="font-display text-2xl tracking-wide uppercase">Not asked on purpose</h2>
            <ul className="mt-3 space-y-1.5 text-sm text-muted">
              {NOT_COLLECTED.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-faint">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      {pane === "modules" ? (
        <section className="space-y-2">
          {MODULES.map((mod, i) => {
            const open = openModule === mod.id;
            const complete = done.includes(mod.id);
            return (
              <article key={mod.id} className="rounded-md bg-surface">
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                  onClick={() => setOpenModule(open ? null : mod.id)}
                >
                  <span className="font-display text-2xl leading-none text-accent tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{mod.title}</span>
                      {complete ? <Check className="size-4 text-accent" /> : null}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted">
                      {mod.minutes} min · {mod.outcome}
                    </span>
                  </span>
                  <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
                </button>
                {open ? (
                  <div className="space-y-3 border-t border-border px-3 py-3">
                    <ol className="list-decimal space-y-2 pl-4 text-sm leading-relaxed">
                      {mod.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <div className="rounded-md bg-raised px-3 py-3">
                      <p className="text-xs tracking-wide text-muted uppercase">Check</p>
                      <p className="mt-1 text-sm font-medium">{mod.check.q}</p>
                      <p className="mt-1 text-sm leading-relaxed text-muted">{mod.check.a}</p>
                    </div>
                    <Button
                      size="sm"
                      variant={complete ? "secondary" : "primary"}
                      onClick={() => toggleDone(mod.id)}
                    >
                      {complete ? "Mark undone" : "Mark done"}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      {pane === "sop" ? (
        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              className="w-full"
              onClick={async () => {
                await navigator.clipboard.writeText(nightCard);
                toast.success("Night card copied");
              }}
            >
              <Copy className="size-4" />
              Copy night card
            </Button>
          </div>
          {venue ? (
            <p className="rounded-md bg-raised px-3 py-2 text-sm text-muted">
              Personalised for <span className="text-fg">{venue.name}</span>
              {venue.upiId ? ` · ${venue.upiId}` : " · add UPI on the Turf tab"}
            </p>
          ) : null}
          {SOP_SECTIONS.map((section) => (
            <article key={section.title} className="rounded-md bg-surface px-3 py-3">
              <h2 className="font-display text-xl tracking-wide uppercase">{section.title}</h2>
              <ol className="mt-2 list-decimal space-y-1.5 pl-4 text-sm leading-relaxed">
                {section.beats.map((beat) => (
                  <li key={beat}>{beat}</li>
                ))}
              </ol>
            </article>
          ))}
          <pre className="overflow-x-auto rounded-md bg-raised px-3 py-3 text-xs leading-relaxed whitespace-pre-wrap text-muted">
            {nightCard}
          </pre>
        </section>
      ) : null}

      {pane === "faq" ? (
        <section className="space-y-2">
          {FAQS.map((item, i) => {
            const open = openFaq === i;
            return (
              <article key={item.q} className="rounded-md bg-surface">
                <button
                  type="button"
                  className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left"
                  onClick={() => setOpenFaq(open ? null : i)}
                >
                  <span className="text-sm font-medium">{item.q}</span>
                  <ChevronDown className={cn("size-4 shrink-0 text-faint transition-transform", open && "rotate-180")} />
                </button>
                {open ? (
                  <p className="border-t border-border px-3 py-3 text-sm leading-relaxed text-muted">
                    {item.a}
                  </p>
                ) : null}
              </article>
            );
          })}
        </section>
      ) : null}

      <p className="flex items-center gap-2 pb-4 text-xs text-faint">
        <BookOpen className="size-3.5" />
        Phase 1 · one turf · UPI out of band · IST
      </p>
    </div>
  );
}

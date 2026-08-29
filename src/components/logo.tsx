import { cn } from "@/lib/utils";

export function Mark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="currentColor" className="text-accent" />
      <rect x="6" y="8" width="20" height="16" rx="1.5" fill="none" stroke="var(--color-accent-fg)" strokeWidth="1.6" />
      <circle cx="16" cy="16" r="3.2" fill="none" stroke="var(--color-accent-fg)" strokeWidth="1.3" />
      <path d="M16 8v16M6 16h20" fill="none" stroke="var(--color-accent-fg)" strokeWidth="1.1" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <Mark />
      {!compact && (
        <span className="font-display text-lg font-semibold tracking-tight">
          Turf Community
        </span>
      )}
    </span>
  );
}

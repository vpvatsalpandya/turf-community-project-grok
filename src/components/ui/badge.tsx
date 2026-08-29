import { cn } from "@/lib/utils";

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        tone === "neutral" && "bg-surface-3 text-muted",
        tone === "good" && "bg-accent/15 text-accent-2",
        tone === "warn" && "bg-warn/15 text-warn",
        tone === "bad" && "bg-danger/15 text-danger",
        tone === "accent" && "bg-accent text-accent-fg",
        className,
      )}
    >
      {children}
    </span>
  );
}

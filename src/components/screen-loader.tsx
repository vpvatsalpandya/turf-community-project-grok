import { PitchMark } from "@/components/mark";

export function ScreenLoader({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="grid min-h-[50vh] place-items-center px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3">
        <PitchMark className="size-10 animate-pulse" />
        <p className="text-sm text-muted">{label}</p>
      </div>
    </div>
  );
}

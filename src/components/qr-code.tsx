import { renderSVG } from "uqr";
import { cn } from "@/lib/utils";

export function QrCode({
  value,
  label,
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const svg = renderSVG(value, {
    ecc: "M",
    border: 2,
    pixelSize: 8,
    whiteColor: "#fffdf6",
    blackColor: "#142018",
  });
  return (
    <figure className={cn("inline-flex flex-col items-center gap-2", className)}>
      <div
        className="aspect-square w-full max-w-56 overflow-hidden rounded-lg bg-surface-2 p-2 shadow-[var(--shadow-border)] [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
        aria-label={label ?? "QR code"}
      />
      {label ? <figcaption className="text-center text-xs text-muted">{label}</figcaption> : null}
    </figure>
  );
}

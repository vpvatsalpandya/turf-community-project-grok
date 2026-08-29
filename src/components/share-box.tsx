import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHARE_HINT } from "@/lib/turf/messages";

export function ShareBox({ text, title = "Send this" }: { text: string; title?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }
  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ text, title });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await copy();
  }
  return (
    <div className="rounded-xl bg-surface-2 p-3 shadow-[var(--shadow-border)]">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">{title}</p>
      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-fg">{text}</pre>
      <p className="mt-2 text-xs text-muted">{SHARE_HINT}</p>
      <div className="mt-3 flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={copy}>
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button type="button" size="sm" onClick={share}>
          <Share2 className="size-4" />
          Share
        </Button>
      </div>
    </div>
  );
}

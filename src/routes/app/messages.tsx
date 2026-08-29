import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { getDeskContext } from "@/lib/server/desk-fns";
import { listTemplates, saveTemplate } from "@/lib/server/setup-fns";
import type { TemplateKind } from "@/lib/turf/messages";

export const Route = createFileRoute("/app/messages")({ component: Messages });

function Messages() {
  const qc = useQueryClient();
  const ctx = useQuery({ queryKey: ["desk"], queryFn: () => getDeskContext() });
  const venueId = ctx.data?.venue?.id;
  const q = useQuery({
    queryKey: ["tpl", venueId],
    enabled: Boolean(venueId),
    queryFn: () => listTemplates({ data: { venueId } }),
  });
  const [kind, setKind] = useState<TemplateKind>("request_confirmed");
  const [lang, setLang] = useState<"en" | "hi">("hi");
  const current = q.data?.templates.find((t) => t.kind === kind && t.language === lang)?.body
    ?? q.data?.defaults[kind]?.[lang]
    ?? "";
  const [body, setBody] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () =>
      saveTemplate({ data: { venueId: venueId!, kind, language: lang, body: body ?? current } }),
    onSuccess: () => {
      toast.success("Saved");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4">
      <h1 className="font-display text-3xl font-semibold">Templates</h1>
      <p className="text-sm text-muted">
        Variables: {"{customer_name} {venue} {resource} {date} {time} {duration} {amount} {ref_code} {upi_id} {venue_phone}"}
      </p>
      <div className="flex flex-wrap gap-2">
        {(q.data?.kinds ?? []).map((k) => (
          <Button key={k} size="sm" variant={k === kind ? "primary" : "secondary"} onClick={() => { setKind(k); setBody(null); }}>
            {k.replace(/_/g, " ")}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant={lang === "hi" ? "primary" : "secondary"} onClick={() => { setLang("hi"); setBody(null); }}>
          Hinglish
        </Button>
        <Button size="sm" variant={lang === "en" ? "primary" : "secondary"} onClick={() => { setLang("en"); setBody(null); }}>
          English
        </Button>
      </div>
      <Textarea value={body ?? current} onChange={(e) => setBody(e.target.value)} className="min-h-40" />
      <Button onClick={() => save.mutate()}>Save template</Button>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { platformVerifyToken } from "@/lib/turf/whatsapp.server";

export const Route = createFileRoute("/api/wa/webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const expected = await platformVerifyToken();
        if (mode === "subscribe" && expected && token === expected && challenge) {
          return new Response(challenge, { status: 200 });
        }
        return new Response("forbidden", { status: 403 });
      },
      POST: async () => {
        // Incoming Cloud API events keep the 24-hour session window open.
        // We acknowledge and ignore the body in this phase.
        return new Response("ok", { status: 200 });
      },
    },
  },
});

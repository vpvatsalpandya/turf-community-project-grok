import { getSql } from "@/lib/db";
import { isValidInPhone, normalizePhone } from "@/lib/utils";

export type WaProvider = "cloud" | "green";

export type WaAccountPublic = {
  id: string;
  venueId: string | null;
  provider: WaProvider;
  instance: string;
  displayPhone: string;
  templateOwner: string;
  templatePlayer: string;
  verifyTokenSet: boolean;
  tokenSet: boolean;
  enabled: boolean;
  connected: boolean;
};

type WaAccountRow = {
  id: string;
  venue_id: string | null;
  provider: string;
  token: string;
  instance: string;
  display_phone: string;
  template_owner: string;
  template_player: string;
  verify_token: string;
  enabled: boolean;
};

type WaOutboxRow = {
  id: string;
  kind: string;
  to_phone: string;
  body: string;
  booking_id: string | null;
  venue_id: string | null;
  provider: string;
  status: string;
  error: string;
  created_at: unknown;
  sent_at: unknown;
};

function e164(phone: string) {
  const n = normalizePhone(phone);
  return isValidInPhone(n) ? `91${n}` : "";
}

function mapAccount(row: WaAccountRow): WaAccountPublic {
  const tokenSet = Boolean(row.token.trim());
  const instanceSet = Boolean(row.instance.trim());
  const enabled = Boolean(row.enabled);
  return {
    id: row.id,
    venueId: row.venue_id,
    provider: row.provider === "green" ? "green" : "cloud",
    instance: row.instance,
    displayPhone: row.display_phone,
    templateOwner: row.template_owner,
    templatePlayer: row.template_player,
    verifyTokenSet: Boolean(row.verify_token.trim()),
    tokenSet,
    enabled,
    connected: enabled && tokenSet && instanceSet,
  };
}

async function loadAccount(id: string): Promise<WaAccountRow | null> {
  const sql = await getSql();
  const rows = await sql<WaAccountRow>`select * from wa_accounts where id = ${id} limit 1`;
  return rows[0] ?? null;
}

async function loadVenueAccount(venueId: string): Promise<WaAccountRow | null> {
  const sql = await getSql();
  const venue = await sql<WaAccountRow>`
    select * from wa_accounts where venue_id = ${venueId} limit 1
  `;
  if (venue[0]?.enabled && venue[0].token.trim() && venue[0].instance.trim()) return venue[0];
  const platform = await loadAccount("platform");
  if (platform?.enabled && platform.token.trim() && platform.instance.trim()) return platform;
  const envToken = process.env.WHATSAPP_TOKEN?.trim() ?? "";
  const envInstance =
    process.env.WHATSAPP_PHONE_NUMBER_ID?.trim() || process.env.WHATSAPP_INSTANCE?.trim() || "";
  if (envToken && envInstance) {
    return {
      id: "env",
      venue_id: null,
      provider: process.env.WHATSAPP_PROVIDER?.trim() === "green" ? "green" : "cloud",
      token: envToken,
      instance: envInstance,
      display_phone: process.env.WHATSAPP_DISPLAY?.trim() ?? "",
      template_owner: process.env.WHATSAPP_TEMPLATE_OWNER?.trim() ?? "",
      template_player: process.env.WHATSAPP_TEMPLATE_PLAYER?.trim() ?? "",
      verify_token: process.env.WHATSAPP_VERIFY_TOKEN?.trim() ?? "",
      enabled: true,
    };
  }
  return platform;
}

async function sendCloud(account: WaAccountRow, to: string, body: string, templateName: string) {
  const url = `https://graph.facebook.com/v21.0/${account.instance}/messages`;
  const headers = {
    Authorization: `Bearer ${account.token}`,
    "Content-Type": "application/json",
  };
  if (templateName.trim()) {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: templateName.trim(),
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: body
                .split("\n")
                .slice(0, 4)
                .map((line) => ({ type: "text", text: line.slice(0, 60) || "-" })),
            },
          ],
        },
      }),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (res.ok && !json.error) return;
    if (json.error?.message && /template/i.test(json.error.message) === false) {
      throw new Error(json.error.message);
    }
  }
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: body.slice(0, 4000), preview_url: false },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `WhatsApp Cloud ${res.status}`);
  }
}

async function sendGreen(account: WaAccountRow, to: string, body: string) {
  const url = `https://api.green-api.com/waInstance${account.instance}/sendMessage/${account.token}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId: `${to}@c.us`, message: body.slice(0, 4000) }),
  });
  const json = (await res.json().catch(() => ({}))) as {
    idMessage?: string;
    error?: boolean;
    message?: string;
  };
  if (!res.ok || json.error) {
    throw new Error(json.message || `Green API ${res.status}`);
  }
}

export async function dispatchWhatsApp(opts: {
  kind: "owner_request" | "player_ack" | "player_status" | "test";
  toPhone: string;
  body: string;
  bookingId?: string;
  venueId?: string;
}): Promise<{ sent: boolean; error: string }> {
  const to = e164(opts.toPhone);
  const id = crypto.randomUUID();
  const sql = await getSql();
  if (!to) {
    await sql`
      insert into wa_outbox (id, kind, to_phone, body, booking_id, venue_id, status, error)
      values (${id}, ${opts.kind}, ${opts.toPhone}, ${opts.body}, ${opts.bookingId ?? null}, ${opts.venueId ?? null}, 'failed', 'Invalid Indian mobile')
    `;
    return { sent: false, error: "Invalid Indian mobile" };
  }
  const account = await loadVenueAccount(opts.venueId ?? "platform");
  if (!account || !account.enabled || !account.token.trim() || !account.instance.trim()) {
    await sql`
      insert into wa_outbox (id, kind, to_phone, body, booking_id, venue_id, status, error)
      values (${id}, ${opts.kind}, ${to}, ${opts.body}, ${opts.bookingId ?? null}, ${opts.venueId ?? null}, 'queued', 'WhatsApp not connected')
    `;
    return { sent: false, error: "WhatsApp not connected" };
  }
  await sql`
    insert into wa_outbox (id, kind, to_phone, body, booking_id, venue_id, provider, status)
    values (${id}, ${opts.kind}, ${to}, ${opts.body}, ${opts.bookingId ?? null}, ${opts.venueId ?? null}, ${account.provider}, 'queued')
  `;
  try {
    if (account.provider === "green") {
      await sendGreen(account, to, opts.body);
    } else {
      const template =
        opts.kind === "owner_request" ? account.template_owner : account.template_player;
      await sendCloud(account, to, opts.body, template);
    }
    await sql`
      update wa_outbox set status = 'sent', sent_at = now(), error = '' where id = ${id}
    `;
    return { sent: true, error: "" };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed";
    await sql`
      update wa_outbox set status = 'failed', error = ${message} where id = ${id}
    `;
    return { sent: false, error: message };
  }
}

export async function platformVerifyToken() {
  const row = await loadAccount("platform");
  return row?.verify_token?.trim() || process.env.WHATSAPP_VERIFY_TOKEN?.trim() || "";
}

async function requireVenueId(userId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql<{ id: string }>`
    select id from venues where user_id = ${userId} order by created_at asc limit 1
  `;
  return rows[0]?.id ?? null;
}

async function requireAdmin(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ role: string }>`
    select role from profiles where user_id = ${userId} limit 1
  `;
  return rows[0]?.role === "admin";
}

export async function readWaAccount(userId: string): Promise<WaAccountPublic | null> {
  const admin = await requireAdmin(userId);
  if (admin) {
    const row = (await loadAccount("platform")) ?? {
      id: "platform",
      venue_id: null,
      provider: "cloud",
      token: "",
      instance: "",
      display_phone: "",
      template_owner: "",
      template_player: "",
      verify_token: "",
      enabled: false,
    };
    return mapAccount(row);
  }
  const venueId = await requireVenueId(userId);
  if (!venueId) return null;
  const sql = await getSql();
  const rows = await sql<WaAccountRow>`
    select * from wa_accounts where venue_id = ${venueId} limit 1
  `;
  if (rows[0]) return mapAccount(rows[0]);
  return {
    id: venueId,
    venueId,
    provider: "cloud",
    instance: "",
    displayPhone: "",
    templateOwner: "",
    templatePlayer: "",
    verifyTokenSet: false,
    tokenSet: false,
    enabled: false,
    connected: false,
  };
}

export async function writeWaAccount(
  userId: string,
  data: {
    provider: WaProvider;
    token?: string;
    instance: string;
    displayPhone: string;
    templateOwner?: string;
    templatePlayer?: string;
    verifyToken?: string;
    enabled: boolean;
  },
) {
  const admin = await requireAdmin(userId);
  const venueId = admin ? null : await requireVenueId(userId);
  if (!admin && !venueId) throw new Error("Save the turf sheet first");
  const id = admin ? "platform" : venueId!;
  const sql = await getSql();
  const existing = await sql<WaAccountRow>`select * from wa_accounts where id = ${id} limit 1`;
  const token = data.token?.trim();
  const nextToken = token ? token : (existing[0]?.token ?? "");
  const verify = data.verifyToken?.trim();
  const nextVerify = verify ? verify : (existing[0]?.verify_token ?? "");
  await sql`
    insert into wa_accounts (
      id, venue_id, provider, token, instance, display_phone,
      template_owner, template_player, verify_token, enabled, updated_at
    ) values (
      ${id}, ${venueId}, ${data.provider}, ${nextToken}, ${data.instance.trim()},
      ${normalizePhone(data.displayPhone)}, ${data.templateOwner?.trim() ?? ""},
      ${data.templatePlayer?.trim() ?? ""}, ${nextVerify}, ${data.enabled}, now()
    )
    on conflict (id) do update set
      provider = excluded.provider,
      token = excluded.token,
      instance = excluded.instance,
      display_phone = excluded.display_phone,
      template_owner = excluded.template_owner,
      template_player = excluded.template_player,
      verify_token = excluded.verify_token,
      enabled = excluded.enabled,
      updated_at = now()
  `;
  const rows = await sql<WaAccountRow>`select * from wa_accounts where id = ${id}`;
  return mapAccount(rows[0]);
}

export async function pingWaTest(userId: string, phone: string) {
  const admin = await requireAdmin(userId);
  const venueId = admin ? undefined : ((await requireVenueId(userId)) ?? undefined);
  return dispatchWhatsApp({
    kind: "test",
    toPhone: phone,
    body: "Turf Community test. If you can read this, automatic WhatsApp is live.",
    venueId,
  });
}

export async function readWaOutbox(userId: string) {
  const admin = await requireAdmin(userId);
  const sql = await getSql();
  const venueId = admin ? null : await requireVenueId(userId);
  const rows = admin
    ? await sql<WaOutboxRow>`select * from wa_outbox order by created_at desc limit 30`
    : venueId
      ? await sql<WaOutboxRow>`
          select * from wa_outbox where venue_id = ${venueId} order by created_at desc limit 20
        `
      : [];
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    toPhone: r.to_phone.replace(/^91/, "").replace(/(\d{2})\d+(\d{2})/, "$1••••$2"),
    body: r.body,
    status: r.status,
    error: r.error,
    createdAt: String(r.created_at ?? ""),
  }));
}

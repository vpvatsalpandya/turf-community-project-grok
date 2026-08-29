import type { Sql } from "@/lib/db";
import { formatInr } from "@/lib/turf/money";
import {
  DEFAULT_TEMPLATES,
  renderTemplate,
  type TemplateKind,
  type TemplateVars,
} from "@/lib/turf/messages";
import { durationLabel, formatDateLong, formatTime } from "@/lib/turf/time";

export async function loadTemplate(
  sql: Sql,
  venueId: string,
  kind: TemplateKind,
  language: "en" | "hi",
): Promise<string> {
  const rows = await sql<{ body: string }>`
    select body from message_template
     where kind = ${kind} and language = ${language}
       and (venue_id = ${venueId} or venue_id is null)
     order by case when venue_id is null then 1 else 0 end
     limit 1`;
  if (rows[0]) return rows[0].body;
  return DEFAULT_TEMPLATES[kind][language];
}

export async function renderBookingMessage(
  sql: Sql,
  bookingId: string,
  kind: TemplateKind,
  language: "en" | "hi" = "hi",
): Promise<{ body: string; vars: TemplateVars; venueId: string }> {
  const rows = await sql<Record<string, unknown>>`
    select b.ref_code, b.period_start, b.period_end, b.amount_due_paise, b.venue_id,
           r.name as resource_name,
           v.name as venue_name, v.upi_id, v.contact_phone, v.timezone,
           coalesce(p.name_at_venue, i.display_name, 'there') as customer_name
      from booking b
      join resource r on r.id = b.resource_id
      join venue v on v.id = b.venue_id
      left join customer_profile p on p.id = b.profile_id
      left join customer_identity i on i.id = b.identity_id
     where b.id = ${bookingId}
     limit 1`;
  const b = rows[0];
  if (!b) throw new Error("Booking not found");
  const tz = String(b.timezone ?? "Asia/Kolkata");
  const start = new Date(String(b.period_start));
  const end = new Date(String(b.period_end));
  const vars: TemplateVars = {
    customer_name: String(b.customer_name ?? "there"),
    venue: String(b.venue_name),
    resource: String(b.resource_name),
    date: formatDateLong(start.toISOString().slice(0, 10), tz),
    time: formatTime(start, tz),
    duration: durationLabel(start, end),
    amount: formatInr(Number(b.amount_due_paise ?? 0)),
    ref_code: String(b.ref_code),
    upi_id: b.upi_id ? String(b.upi_id) : "ask the desk",
    venue_phone: b.contact_phone ? String(b.contact_phone) : "",
  };
  const venueId = String(b.venue_id);
  const tpl = await loadTemplate(sql, venueId, kind, language);
  return { body: renderTemplate(tpl, vars), vars, venueId };
}

export async function renderWaitlistMessage(
  sql: Sql,
  waitlistId: string,
  language: "en" | "hi" = "hi",
): Promise<{ body: string; vars: TemplateVars; venueId: string }> {
  const rows = await sql<Record<string, unknown>>`
    select w.name, w.period_start, w.period_end, w.venue_id,
           r.name as resource_name,
           v.name as venue_name, v.upi_id, v.contact_phone, v.timezone
      from waitlist w
      join resource r on r.id = w.resource_id
      join venue v on v.id = w.venue_id
     where w.id = ${waitlistId}
     limit 1`;
  const w = rows[0];
  if (!w) throw new Error("Waitlist entry not found");
  const tz = String(w.timezone ?? "Asia/Kolkata");
  const start = new Date(String(w.period_start));
  const end = new Date(String(w.period_end));
  const vars: TemplateVars = {
    customer_name: String(w.name ?? "there"),
    venue: String(w.venue_name),
    resource: String(w.resource_name),
    date: formatDateLong(start.toISOString().slice(0, 10), tz),
    time: formatTime(start, tz),
    duration: durationLabel(start, end),
    amount: "pay at the desk",
    ref_code: "waitlist",
    upi_id: w.upi_id ? String(w.upi_id) : "ask the desk",
    venue_phone: w.contact_phone ? String(w.contact_phone) : "",
  };
  const venueId = String(w.venue_id);
  const tpl = await loadTemplate(sql, venueId, "waitlist_open", language);
  return { body: renderTemplate(tpl, vars), vars, venueId };
}

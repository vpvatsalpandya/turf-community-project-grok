import type { Sql } from "@/lib/db";
import type { Membership, Role } from "@/lib/turf/types";
import { DEFAULT_TEMPLATES, TEMPLATE_KINDS } from "@/lib/turf/messages";
import { addDaysISO, localDateISO } from "@/lib/turf/time";
import { nid, slugify } from "@/lib/utils";

type AuthUser = { id: string; email: string | null; name: string | null };

export async function loadAuthUser(sql: Sql, userId: string): Promise<AuthUser> {
  const rows = await sql<{ id: string; email: string | null; name: string }>`
    select id, email, name from "user" where id = ${userId} limit 1`;
  if (rows[0]) return rows[0];
  return { id: userId, email: null, name: null };
}

function mapMembership(r: {
  id: string;
  user_id: string;
  org_id: string;
  venue_id: string | null;
  role: Role;
  display_name: string | null;
  email: string | null;
  is_platform_admin: boolean;
  org_status: string;
  org_name: string;
}): Membership {
  return {
    appUserId: r.id,
    userId: r.user_id,
    orgId: r.org_id,
    venueId: r.venue_id,
    role: r.role,
    displayName: r.display_name,
    email: r.email,
    isPlatformAdmin: r.is_platform_admin,
    orgStatus: r.org_status as Membership["orgStatus"],
    orgName: r.org_name,
  };
}

export async function getMembership(sql: Sql, userId: string): Promise<Membership | null> {
  const rows = await sql<{
    id: string;
    user_id: string;
    org_id: string;
    venue_id: string | null;
    role: Role;
    display_name: string | null;
    email: string | null;
    is_platform_admin: boolean;
    org_status: string;
    org_name: string;
  }>`
    select a.id, a.user_id, a.org_id, a.venue_id, a.role, a.display_name, a.email,
           a.is_platform_admin, o.status as org_status, o.legal_name as org_name
      from app_user a
      join org o on o.id = a.org_id
     where a.user_id = ${userId}
     limit 1`;
  return rows[0] ? mapMembership(rows[0]) : null;
}

export async function ensureMembership(sql: Sql, userId: string): Promise<Membership> {
  const existing = await getMembership(sql, userId);
  if (existing) return existing;

  const auth = await loadAuthUser(sql, userId);
  const email = (auth.email ?? "").toLowerCase();

  if (email) {
    const invite = await sql<{ id: string; org_id: string; venue_id: string | null; role: Role }>`
      select id, org_id, venue_id, role from staff_invite
       where lower(email) = ${email}
       limit 1`;
    if (invite[0]) {
      const id = nid("au");
      await sql`
        insert into app_user (id, user_id, org_id, venue_id, role, display_name, email)
        values (${id}, ${userId}, ${invite[0].org_id}, ${invite[0].venue_id}, ${invite[0].role}, ${auth.name}, ${email})`;
      await sql`delete from staff_invite where id = ${invite[0].id}`;
      const m = await getMembership(sql, userId);
      if (m) return m;
    }
  }

  const anyOwner = await sql`select 1 from app_user limit 1`;
  const isFirst = anyOwner.length === 0;
  const today = localDateISO();

  if (isFirst) {
    // Preview convenience: first operator owns Greenfield so the desk has data.
    // Never auto-grant platform admin — that was a landmine on a public deploy.
    const id = nid("au");
    const admin = email === "admin@turfcommunity.com";
    await sql`
      insert into app_user (id, user_id, org_id, venue_id, role, display_name, email, is_platform_admin)
      values (${id}, ${userId}, 'org_demo', 'venue_greenfield', 'owner', ${auth.name}, ${email || null}, ${admin})`;
    const m = await getMembership(sql, userId);
    if (!m) throw new Error("Failed to attach demo membership");
    return m;
  }

  const orgId = nid("org");
  const venueId = nid("ven");
  const name = auth.name?.trim() || "My Turf";
  let slug = slugify(name) || "turf";
  const clash = await sql`select 1 from venue where slug = ${slug} limit 1`;
  if (clash.length) slug = `${slug}-${orgId.slice(-4)}`;

  await sql`insert into org (id, legal_name, status) values (${orgId}, ${name}, 'trialing')`;
  await sql`
    insert into venue (id, org_id, name, slug, timezone, amenities, photos, request_window_minutes)
    values (${venueId}, ${orgId}, ${name}, ${slug}, 'Asia/Kolkata', '{}', '[]'::jsonb, 240)`;
  const resId = nid("res");
  await sql`
    insert into resource (id, venue_id, name, sport, slot_minutes, is_bookable, sort_order)
    values (${resId}, ${venueId}, 'Pitch 1', 'football', 60, true, 0)`;
  await sql`select rebuild_resource_tree(${venueId})`;
  for (let dow = 0; dow <= 6; dow++) {
    await sql`
      insert into operating_window (id, resource_id, day_of_week, opens_at, closes_minutes_from_midnight)
      values (${nid("ow")}, ${resId}, ${dow}, ${"06:00"}, ${23 * 60})`;
  }
  await sql`
    insert into price_band (id, resource_id, starts_at, ends_at, price_paise, label, priority)
    values (${nid("pb")}, ${resId}, ${"06:00"}, ${"23:00"}, 100000, 'Standard', 1)`;
  for (const kind of TEMPLATE_KINDS) {
    await sql`
      insert into message_template (id, venue_id, kind, body, language)
      values (${nid("mt")}, ${venueId}, ${kind}, ${DEFAULT_TEMPLATES[kind].en}, 'en')`;
    await sql`
      insert into message_template (id, venue_id, kind, body, language)
      values (${nid("mt")}, ${venueId}, ${kind}, ${DEFAULT_TEMPLATES[kind].hi}, 'hi')`;
  }
  await sql`
    insert into subscription (org_id, status, trial_ends_on, current_period_start, current_period_end, next_invoice_on, referred)
    values (${orgId}, 'trialing', ${addDaysISO(today, 30)}, ${today}, ${addDaysISO(today, 30)}, ${addDaysISO(today, 30)}, false)`;
  const au = nid("au");
  await sql`
    insert into app_user (id, user_id, org_id, venue_id, role, display_name, email, is_platform_admin)
    values (${au}, ${userId}, ${orgId}, ${venueId}, 'owner', ${auth.name}, ${email || null}, false)`;

  const m = await getMembership(sql, userId);
  if (!m) throw new Error("Failed to create membership");
  return m;
}

export function canManageVenue(m: Membership): boolean {
  return m.role === "owner" || m.role === "manager" || m.isPlatformAdmin;
}

export function canAccept(m: Membership): boolean {
  return m.role !== "platform_admin" || m.isPlatformAdmin || Boolean(m.venueId);
}

export function canExport(m: Membership): boolean {
  return m.role === "owner" || m.isPlatformAdmin;
}

export function canManageStaff(m: Membership): boolean {
  return m.role === "owner" || m.isPlatformAdmin;
}

export async function assertVenueAccess(sql: Sql, m: Membership, venueId: string): Promise<void> {
  if (m.isPlatformAdmin) return;
  const rows = await sql`
    select 1 from venue v
     where v.id = ${venueId} and v.org_id = ${m.orgId}
     limit 1`;
  if (!rows.length) throw new Error("Forbidden");
}

export async function homeVenueId(sql: Sql, m: Membership): Promise<string> {
  if (m.venueId) return m.venueId;
  const rows = await sql<{ id: string }>`
    select id from venue where org_id = ${m.orgId} and status = 'active' order by name limit 1`;
  if (!rows[0]) throw new Error("No venue");
  return rows[0].id;
}

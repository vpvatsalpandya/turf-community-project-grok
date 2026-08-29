import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { DEFAULT_TEMPLATES, TEMPLATE_KINDS, type TemplateKind } from "@/lib/turf/messages";
import { nid } from "@/lib/utils";
import { assertVenueAccess, canManageStaff, canManageVenue, ensureMembership, homeVenueId } from "./membership";
import { mapResource, mapVenue } from "./map";
import { ready } from "./ready";

async function setupCtx(userId: string, venueId?: string) {
  const sql = await ready();
  const membership = await ensureMembership(sql, userId);
  const vid = venueId || (await homeVenueId(sql, membership));
  await assertVenueAccess(sql, membership, vid);
  if (!canManageVenue(membership) && membership.role !== "staff") {
    /* staff can read, not write */
  }
  return { sql, membership, venueId: vid };
}

export const getVenueSetup = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await setupCtx(context.userId, data.venueId);
    const v = await sql<Record<string, unknown>>`select * from venue where id = ${venueId}`;
    const resources = await sql<Record<string, unknown>>`
      select * from resource where venue_id = ${venueId} order by sort_order, name`;
    const windows = await sql<{
      id: string;
      resource_id: string;
      day_of_week: number;
      opens_at: string;
      closes_minutes_from_midnight: number;
    }>`
      select id, resource_id, day_of_week, opens_at::text, closes_minutes_from_midnight
        from operating_window where resource_id in (select id from resource where venue_id = ${venueId})
       order by day_of_week`;
    const bands = await sql<Record<string, unknown>>`
      select id, resource_id, day_of_week, starts_at::text, ends_at::text, price_paise, label, priority
        from price_band where resource_id in (select id from resource where venue_id = ${venueId})
       order by priority desc, starts_at`;
    return {
      venue: mapVenue(v[0]!),
      resources: resources.map(mapResource),
      windows,
      bands: bands.map((b) => ({
        id: String(b.id),
        resourceId: String(b.resource_id),
        dayOfWeek: b.day_of_week == null ? null : Number(b.day_of_week),
        startsAt: String(b.starts_at).slice(0, 5),
        endsAt: String(b.ends_at).slice(0, 5),
        pricePaise: Number(b.price_paise),
        label: b.label ? String(b.label) : null,
        priority: Number(b.priority),
      })),
      overrides: (
        await sql<Record<string, unknown>>`
          select id, venue_id, resource_id, on_date::text, is_closed, opens_at::text, closes_at::text, reason
            from date_override
           where venue_id = ${venueId} or resource_id in (select id from resource where venue_id = ${venueId})
           order by on_date desc`
      ).map((o) => ({
        id: String(o.id),
        venueId: o.venue_id ? String(o.venue_id) : null,
        resourceId: o.resource_id ? String(o.resource_id) : null,
        onDate: String(o.on_date).slice(0, 10),
        isClosed: Boolean(o.is_closed),
        opensAt: o.opens_at ? String(o.opens_at).slice(0, 5) : null,
        closesAt: o.closes_at ? String(o.closes_at).slice(0, 5) : null,
        reason: o.reason ? String(o.reason) : "",
      })),
    };
  });

export const saveVenue = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      name: string;
      address?: string;
      city?: string;
      upiId?: string;
      contactPhone?: string;
      amenities?: string[];
      requestWindowMinutes?: number;
      photos?: { src: string; alt: string }[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    await sql`
      update venue set
        name = ${data.name.trim()},
        address = ${data.address ?? null},
        city = ${data.city ?? null},
        upi_id = ${data.upiId ?? null},
        contact_phone = ${data.contactPhone ?? null},
        amenities = ${data.amenities ?? []},
        request_window_minutes = ${data.requestWindowMinutes ?? 240}
      where id = ${venueId}`;
    if (data.photos) {
      await sql`update venue set photos = ${JSON.stringify(data.photos)}::jsonb where id = ${venueId}`;
    }
    return { ok: true };
  });

export const saveResource = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      id?: string;
      name: string;
      sport?: string;
      parentId?: string | null;
      slotMinutes: number;
      bufferMinutes: number;
      isBookable: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    const id = data.id ?? nid("res");
    if (data.id) {
      await sql`
        update resource set
          name = ${data.name.trim()}, sport = ${data.sport ?? null},
          parent_id = ${data.parentId ?? null}, slot_minutes = ${data.slotMinutes},
          buffer_minutes = ${data.bufferMinutes}, is_bookable = ${data.isBookable}
        where id = ${id} and venue_id = ${venueId}`;
    } else {
      await sql`
        insert into resource (id, venue_id, parent_id, name, sport, slot_minutes, buffer_minutes, is_bookable, sort_order)
        values (${id}, ${venueId}, ${data.parentId ?? null}, ${data.name.trim()}, ${data.sport ?? null},
                ${data.slotMinutes}, ${data.bufferMinutes}, ${data.isBookable}, 10)`;
      const sourceId = data.parentId
        ? data.parentId
        : (
            await sql<{ id: string }>`
              select id from resource where venue_id = ${venueId} and id <> ${id} order by sort_order limit 1`
          )[0]?.id;
      if (sourceId) {
        const windows = await sql<{
          day_of_week: number;
          opens_at: string;
          closes_minutes_from_midnight: number;
        }>`
          select day_of_week, opens_at::text, closes_minutes_from_midnight
            from operating_window where resource_id = ${sourceId}`;
        for (const w of windows) {
          await sql`
            insert into operating_window (id, resource_id, day_of_week, opens_at, closes_minutes_from_midnight)
            values (${nid("ow")}, ${id}, ${w.day_of_week}, ${String(w.opens_at).slice(0, 5)}, ${w.closes_minutes_from_midnight})`;
        }
        const band = await sql<{
          starts_at: string;
          ends_at: string;
          price_paise: number;
          label: string | null;
        }>`
          select starts_at::text, ends_at::text, price_paise, label from price_band
           where resource_id = ${sourceId} order by priority desc limit 1`;
        if (band[0]) {
          await sql`
            insert into price_band (id, resource_id, starts_at, ends_at, price_paise, label, priority)
            values (
              ${nid("pb")}, ${id}, ${String(band[0].starts_at).slice(0, 5)}, ${String(band[0].ends_at).slice(0, 5)},
              ${band[0].price_paise}, ${band[0].label}, 1
            )`;
        }
      } else {
        for (let dow = 0; dow <= 6; dow++) {
          await sql`
            insert into operating_window (id, resource_id, day_of_week, opens_at, closes_minutes_from_midnight)
            values (${nid("ow")}, ${id}, ${dow}, ${"06:00"}, ${23 * 60})`;
        }
        await sql`
          insert into price_band (id, resource_id, starts_at, ends_at, price_paise, label, priority)
          values (${nid("pb")}, ${id}, ${"06:00"}, ${"23:00"}, 100000, 'Standard', 1)`;
      }
    }
    await sql`select rebuild_resource_tree(${venueId})`;
    return { ok: true, id };
  });

export const savePriceBand = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      id?: string;
      resourceId: string;
      startsAt: string;
      endsAt: string;
      pricePaise: number;
      label?: string;
      dayOfWeek?: number | null;
      delete?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    const own = await sql`select 1 from resource where id = ${data.resourceId} and venue_id = ${venueId}`;
    if (!own.length) throw new Error("Pitch not found");
    if (data.delete && data.id) {
      await sql`delete from price_band where id = ${data.id}`;
      return { ok: true };
    }
    const id = data.id ?? nid("pb");
    if (data.id) {
      await sql`
        update price_band set starts_at = ${data.startsAt}, ends_at = ${data.endsAt},
          price_paise = ${data.pricePaise}, label = ${data.label ?? null}, day_of_week = ${data.dayOfWeek ?? null}
        where id = ${id}`;
    } else {
      await sql`
        insert into price_band (id, resource_id, day_of_week, starts_at, ends_at, price_paise, label, priority)
        values (${id}, ${data.resourceId}, ${data.dayOfWeek ?? null}, ${data.startsAt}, ${data.endsAt}, ${data.pricePaise}, ${data.label ?? null}, 1)`;
    }
    return { ok: true, id };
  });

export const saveHours = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      resourceId: string;
      days: { dayOfWeek: number; opensAt: string; closesMinutes: number }[];
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    const own = await sql`select 1 from resource where id = ${data.resourceId} and venue_id = ${venueId}`;
    if (!own.length) throw new Error("Pitch not found");
    await sql`delete from operating_window where resource_id = ${data.resourceId}`;
    for (const d of data.days) {
      if (d.dayOfWeek < 0 || d.dayOfWeek > 6) continue;
      await sql`
        insert into operating_window (id, resource_id, day_of_week, opens_at, closes_minutes_from_midnight)
        values (${nid("ow")}, ${data.resourceId}, ${d.dayOfWeek}, ${d.opensAt}, ${d.closesMinutes})`;
    }
    return { ok: true };
  });

export const saveOverride = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      id?: string;
      resourceId?: string | null;
      onDate: string;
      isClosed: boolean;
      reason: string;
      delete?: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    if (data.delete && data.id) {
      await sql`delete from date_override where id = ${data.id}`;
      return { ok: true };
    }
    const id = data.id ?? nid("ov");
    await sql`
      insert into date_override (id, venue_id, resource_id, on_date, is_closed, reason)
      values (${id}, ${venueId}, ${data.resourceId ?? null}, ${data.onDate}::date, ${data.isClosed}, ${data.reason.trim() || "Closed"})`;
    return { ok: true, id };
  });

export const listPromos = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await setupCtx(context.userId, data.venueId);
    const rows = await sql<Record<string, unknown>>`
      select * from promo_code where venue_id = ${venueId} order by code`;
    return rows.map((r) => ({
      id: String(r.id),
      code: String(r.code),
      type: String(r.type) as "percent" | "flat",
      value: Number(r.value),
      maxDiscountPaise: r.max_discount_paise == null ? null : Number(r.max_discount_paise),
      timesUsed: Number(r.times_used),
      active: Boolean(r.active),
      usageLimitTotal: r.usage_limit_total == null ? null : Number(r.usage_limit_total),
    }));
  });

export const savePromo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (input: {
      venueId: string;
      id?: string;
      code: string;
      type: "percent" | "flat";
      value: number;
      maxDiscountPaise?: number | null;
      active: boolean;
    }) => input,
  )
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (membership.role === "staff") throw new Error("Staff cannot edit promo codes.");
    if (data.type === "percent" && (data.maxDiscountPaise == null || data.maxDiscountPaise <= 0)) {
      throw new Error("Percent codes need a rupee cap. A 50% off tournament block will ruin your Saturday.");
    }
    const id = data.id ?? nid("promo");
    if (data.id) {
      await sql`
        update promo_code set code = ${data.code.trim().toUpperCase()}, type = ${data.type},
          value = ${data.value}, max_discount_paise = ${data.maxDiscountPaise ?? null}, active = ${data.active}
        where id = ${id} and venue_id = ${venueId}`;
    } else {
      await sql`
        insert into promo_code (id, venue_id, code, type, value, max_discount_paise, active)
        values (${id}, ${venueId}, ${data.code.trim().toUpperCase()}, ${data.type}, ${data.value}, ${data.maxDiscountPaise ?? null}, ${data.active})`;
    }
    return { ok: true, id };
  });

export const listLoyalty = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await setupCtx(context.userId, data.venueId);
    const programs = await sql<Record<string, unknown>>`
      select * from loyalty_program where venue_id = ${venueId} order by name`;
    const outstanding = await sql<{ paise: number }>`
      select coalesce(sum(case when pr.type = 'visit_stamp' and bal.s >= 9
              then (pr.config->>'rewardPaise')::int else 0 end), 0)::int as paise
        from loyalty_program pr
        left join lateral (
          select profile_id, sum(delta) as s from loyalty_ledger
           where program_id = pr.id group by profile_id
        ) bal on true
       where pr.venue_id = ${venueId}`;
    return {
      programs: programs.map((p) => ({
        id: String(p.id),
        name: String(p.name),
        type: String(p.type),
        config: typeof p.config === "string" ? JSON.parse(String(p.config)) : p.config,
        status: String(p.status),
        expiryMonths: Number(p.expiry_months),
      })),
      outstandingPaise: Number(outstanding[0]?.paise ?? 0),
    };
  });

export const LOYALTY_PRESETS = [
  {
    key: "tenth",
    name: "10th Booking Free",
    type: "visit_stamp" as const,
    config: { stamps: 9, rewardPaise: 150000, label: "10th hour free up to ₹1,500" },
  },
  {
    key: "weekday",
    name: "Weekday Warrior",
    type: "points" as const,
    config: { pointsPerRupee: 0.1, weekdayMultiplier: 2, rupeePerPoint: 1, weekdays: [1, 2, 3, 4] },
  },
  {
    key: "spend",
    name: "₹500 back on ₹5,000",
    type: "spend_threshold" as const,
    config: { thresholdPaise: 500000, rewardPaise: 50000 },
  },
  {
    key: "friends",
    name: "Bring 3 Friends",
    type: "visit_stamp" as const,
    config: { stamps: 3, rewardPaise: 150000, label: "4th hour free up to ₹1,500" },
  },
];

export const activateLoyaltyPreset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string; key: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    const preset = LOYALTY_PRESETS.find((p) => p.key === data.key);
    if (!preset) throw new Error("Unknown preset.");
    const exists = await sql`select 1 from loyalty_program where venue_id = ${venueId} and name = ${preset.name} limit 1`;
    if (exists.length) throw new Error("That program is already on.");
    const id = nid("loy");
    await sql`
      insert into loyalty_program (id, venue_id, name, type, config, expiry_months, status)
      values (${id}, ${venueId}, ${preset.name}, ${preset.type}, ${JSON.stringify(preset.config)}::jsonb, 12, 'active')`;
    return { ok: true, id };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: { venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, venueId } = await setupCtx(context.userId, data.venueId);
    const rows = await sql<{ id: string; kind: string; body: string; language: string }>`
      select id, kind, body, language from message_template where venue_id = ${venueId} order by kind, language`;
    return { templates: rows, kinds: TEMPLATE_KINDS, defaults: DEFAULT_TEMPLATES };
  });

export const saveTemplate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { venueId: string; kind: TemplateKind; language: "en" | "hi"; body: string }) => input)
  .handler(async ({ context, data }) => {
    const { sql, membership, venueId } = await setupCtx(context.userId, data.venueId);
    if (!canManageVenue(membership)) throw new Error("Managers and owners only.");
    await sql`
      insert into message_template (id, venue_id, kind, body, language)
      values (${nid("mt")}, ${venueId}, ${data.kind}, ${data.body}, ${data.language})
      on conflict (venue_id, kind, language) do update set body = excluded.body`;
    return { ok: true };
  });

export const listStaff = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    if (!canManageStaff(membership) && !membership.isPlatformAdmin) throw new Error("Owners only.");
    const users = await sql<{
      id: string;
      email: string | null;
      display_name: string | null;
      role: string;
      user_id: string;
    }>`
      select id, email, display_name, role, user_id from app_user where org_id = ${membership.orgId} order by role`;
    const invites = await sql<{ id: string; email: string; role: string }>`
      select id, email, role from staff_invite where org_id = ${membership.orgId}`;
    return { users, invites };
  });

export const inviteStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { email: string; role: "manager" | "staff"; venueId?: string }) => input)
  .handler(async ({ context, data }) => {
    const sql = await ready();
    const membership = await ensureMembership(sql, context.userId);
    if (!canManageStaff(membership)) throw new Error("Owners only.");
    const email = data.email.trim().toLowerCase();
    await sql`
      insert into staff_invite (id, org_id, venue_id, email, role, invited_by)
      values (${nid("inv")}, ${membership.orgId}, ${data.venueId ?? membership.venueId}, ${email}, ${data.role}, ${membership.appUserId})
      on conflict (org_id, email) do update set role = excluded.role`;
    return { ok: true };
  });

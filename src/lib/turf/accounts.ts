import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { VADODARA_TURFS } from "./vadodara-directory";
import { addDays, istDateTime, toIso, todayIst } from "./time";
import { ctaForRole, homeForRole, type DemoRole } from "./demo-logins";
import { demoAllowed } from "./live";

export type Profile = {
  role: DemoRole | "owner";
  name: string;
  email: string | null;
  home: "/play" | "/desk" | "/admin";
  cta: string;
  venueId: string | null;
};

export type PlayerBooking = {
  id: string;
  venueName: string;
  slug: string;
  startAt: string;
  endAt: string;
  status: string;
  amountInr: number;
  pitchIndex: number;
  notes: string;
};

export async function ensureOwnerProfile(userId: string) {
  const sql = await getSql();
  const rows = await sql<{ user_id: string }>`
    select user_id from profiles where user_id = ${userId} limit 1
  `;
  if (rows[0]) return;
  const user = await sql.query<{ name: string; email: string }>(
    `select name, email from "user" where id = $1 limit 1`,
    [userId],
  );
  const name = user[0]?.name?.trim() || "Owner";
  await sql`
    insert into profiles (user_id, role, display_name)
    values (${userId}, 'owner', ${name})
    on conflict (user_id) do nothing
  `;
}

export const prepareDemoLogins = createServerFn({ method: "GET" }).handler(async () => {
  if (!demoAllowed()) return { ok: true as const, demo: false as const };
  const { seedDemoAccounts } = await import("./accounts.server");
  await seedDemoAccounts();
  return { ok: true as const, demo: true as const };
});

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<Profile> => {
    await ensureOwnerProfile(context.userId);
    const sql = await getSql();
    const rows = await sql<{ role: string; display_name: string; venue_id: string | null }>`
      select role, display_name, venue_id from profiles where user_id = ${context.userId} limit 1
    `;
    const role = (rows[0]?.role ?? "owner") as DemoRole;
    const user = await sql.query<{ email: string; name: string }>(
      `select email, name from "user" where id = $1 limit 1`,
      [context.userId],
    );
    return {
      role,
      name: rows[0]?.display_name || user[0]?.name || "",
      email: user[0]?.email ?? null,
      home: homeForRole(role),
      cta: ctaForRole(role),
      venueId: rows[0]?.venue_id ?? null,
    };
  });

export const listPlayerNights = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await sql<{ role: string; display_name: string }>`
      select role, display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const role = profile[0]?.role ?? "player";
    if (role !== "player") {
      return { forbidden: true as const, role, bookings: [] as PlayerBooking[] };
    }
    const rows = await sql<{
      id: string;
      name: string;
      slug: string;
      start_at: unknown;
      end_at: unknown;
      status: string;
      amount_inr: number;
      pitch_index: number;
      notes: string;
    }>`
      select b.id, v.name, v.slug, b.start_at, b.end_at, b.status,
             b.amount_inr, b.pitch_index, b.notes
      from bookings b
      join venues v on v.id = b.venue_id
      where b.customer_user_id = ${context.userId}
      order by b.start_at desc
    `;
    return {
      forbidden: false as const,
      role,
      name: profile[0]?.display_name ?? "Player",
      bookings: rows.map((r) => ({
        id: r.id,
        venueName: r.name,
        slug: r.slug,
        startAt: toIso(r.start_at),
        endAt: toIso(r.end_at),
        status: r.status,
        amountInr: Number(r.amount_inr),
        pitchIndex: Number(r.pitch_index),
        notes: r.notes,
      })),
    };
  });

export const listAdminBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const sql = await getSql();
    const profile = await sql<{ role: string; display_name: string }>`
      select role, display_name from profiles where user_id = ${context.userId} limit 1
    `;
    const role = profile[0]?.role ?? "";
    if (role !== "admin") {
      return { forbidden: true as const, role };
    }
    const venues = await sql<{
      name: string;
      slug: string;
      city: string;
      area: string;
      phone: string;
      price_inr: number;
    }>`
      select name, slug, city, area, phone, price_inr from venues order by name asc
    `;
    const from = istDateTime(todayIst(), 0, 0);
    const to = istDateTime(addDays(todayIst(), 1), 0, 0);
    const tonight = await sql<{
      id: string;
      name: string;
      slug: string;
      customer_name: string;
      status: string;
      start_at: unknown;
      amount_inr: number;
    }>`
      select b.id, v.name, v.slug, b.customer_name, b.status, b.start_at, b.amount_inr
      from bookings b
      join venues v on v.id = b.venue_id
      where b.start_at >= ${from.toISOString()}
        and b.start_at < ${to.toISOString()}
      order by b.start_at asc
    `;
    const pending = tonight.filter((b) => b.status === "pending").length;
    return {
      forbidden: false as const,
      role,
      name: profile[0]?.display_name ?? "HQ",
      directoryTotal: VADODARA_TURFS.length,
      onCommunity: venues.length,
      pending,
      venues: venues.map((v) => ({
        name: v.name,
        slug: v.slug,
        city: v.city,
        area: v.area,
        phone: v.phone,
        priceInr: Number(v.price_inr),
      })),
      tonight: tonight.map((b) => ({
        id: b.id,
        venueName: b.name,
        slug: b.slug,
        customerName: b.customer_name,
        status: b.status,
        startAt: toIso(b.start_at),
        amountInr: Number(b.amount_inr),
      })),
    };
  });

export type TeamMember = {
  userId: string;
  name: string;
  email: string;
  role: "staff" | "manager" | "owner";
};

export const listTeam = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { listTeamHandler } = await import("./accounts.server");
    return listTeamHandler(context.userId);
  });

export const addTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { name: string; email: string; password: string; role: "staff" | "manager" }) => input)
  .handler(async ({ context, data }) => {
    const { addTeamMemberHandler } = await import("./accounts.server");
    return addTeamMemberHandler(context.userId, data);
  });

export const removeTeamMember = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: { userId: string }) => input)
  .handler(async ({ context, data }) => {
    const { removeTeamMemberHandler } = await import("./accounts.server");
    return removeTeamMemberHandler(context.userId, data.userId);
  });

import { createServerFn } from "@tanstack/react-start";
import { getSql } from "@/lib/db";
import { authMiddleware } from "@/lib/auth/middleware";
import { VADODARA_TURFS } from "./vadodara-directory";
import { addDays, istDateTime, toIso, todayIst } from "./time";
import { ctaForRole, DEMO_LOGINS, homeForRole, type DemoRole } from "./demo-logins";
import { demoAllowed, HOLD_MINUTES } from "./live";

export type Profile = {
  role: DemoRole | "owner";
  name: string;
  email: string | null;
  home: "/play" | "/desk" | "/admin";
  cta: string;
  venueId: string | null;
};

let seedLock: Promise<void> | null = null;

export async function seedDemoAccounts() {
  if (!demoAllowed()) return;
  if (!seedLock) {
    seedLock = runSeed().catch((err) => {
      seedLock = null;
      throw err;
    });
  }
  await seedLock;
}

async function runSeed() {
  const sql = await getSql();
  const { hashPassword } = await import("@better-auth/utils/password");

  for (const demo of DEMO_LOGINS) {
    const existing = await sql.query<{ id: string }>(
      `select id from "user" where email = $1 limit 1`,
      [demo.email],
    );
    let userId = existing[0]?.id;
    if (!userId) {
      userId = demo.id;
      await sql.query(
        `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, true, now(), now())
         on conflict ("email") do nothing`,
        [userId, demo.name, demo.email],
      );
      const again = await sql.query<{ id: string }>(
        `select id from "user" where email = $1 limit 1`,
        [demo.email],
      );
      userId = again[0]?.id ?? userId;
    }

    const acc = await sql.query<{ id: string }>(
      `select id from account where "userId" = $1 and "providerId" = 'credential' limit 1`,
      [userId],
    );
    if (!acc[0]) {
      const hash = await hashPassword(demo.password);
      await sql.query(
        `insert into account (
           "id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
         ) values ($1, $2, 'credential', $3, $4, now(), now())`,
        [`acc-${userId}`, userId, userId, hash],
      );
    }

    await sql`
      insert into profiles (user_id, role, display_name)
      values (${userId}, ${demo.role}, ${demo.name})
      on conflict (user_id) do update set
        role = excluded.role,
        display_name = excluded.display_name
    `;
  }

  const demoVenue = await sql<{ id: string }>`select id from venues where slug = 'demo' limit 1`;
  if (demoVenue[0]) await linkDeskProfiles(demoVenue[0].id);
}

export async function attachDemoVenue(venueId: string) {
  if (!demoAllowed()) return;
  const sql = await getSql();
  const owner = DEMO_LOGINS.find((d) => d.role === "owner")!;
  const row = await sql.query<{ id: string }>(
    `select id from "user" where email = $1 limit 1`,
    [owner.email],
  );
  const ownerId = row[0]?.id ?? owner.id;
  await sql`
    update venues
    set user_id = ${ownerId}
    where id = ${venueId}
      and user_id in ('system-demo', ${owner.id}, ${ownerId})
  `;
  await linkDeskProfiles(venueId);
  await seedPlayerHold(venueId, ownerId);
}

async function linkDeskProfiles(venueId: string) {
  const sql = await getSql();
  for (const demo of DEMO_LOGINS.filter((d) => d.role === "owner" || d.role === "staff" || d.role === "manager")) {
    const row = await sql.query<{ id: string }>(
      `select id from "user" where email = $1 limit 1`,
      [demo.email],
    );
    const userId = row[0]?.id ?? demo.id;
    await sql`
      update profiles
      set venue_id = ${venueId}
      where user_id = ${userId}
    `;
  }
}

async function seedPlayerHold(venueId: string, _ownerId: string) {
  const sql = await getSql();
  const player = DEMO_LOGINS.find((d) => d.role === "player")!;
  const prow = await sql.query<{ id: string }>(
    `select id from "user" where email = $1 limit 1`,
    [player.email],
  );
  const playerId = prow[0]?.id ?? player.id;
  const existing = await sql<{ id: string }>`
    select id from bookings where id = 'seed-player-request' limit 1
  `;
  let start = istDateTime(todayIst(), 21, 0);
  if (start.getTime() <= Date.now()) start = istDateTime(addDays(todayIst(), 1), 21, 0);
  const end = new Date(start.getTime() + 60 * 60_000);
  const holdUntil = new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString();
  if (existing[0]) {
    await sql`
      update bookings set
        customer_user_id = ${playerId},
        hold_until = ${holdUntil}
      where id = 'seed-player-request'
        and status = 'pending'
    `;
    return;
  }
  await sql`
    insert into bookings (
      id, venue_id, pitch_index, start_at, end_at, status, source,
      customer_name, customer_phone, notes, amount_inr, customer_user_id, hold_until
    ) values (
      'seed-player-request', ${venueId}, 2, ${start.toISOString()}, ${end.toISOString()},
      'pending', 'link', ${player.name}, '9876501234',
      'UPI sent — waiting on the desk', 900, ${playerId}, ${holdUntil}
    )
    on conflict (id) do nothing
  `;
}

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

async function ownerVenueId(userId: string): Promise<string> {
  const sql = await getSql();
  const owned = await sql<{ id: string }>`
    select id from venues where user_id = ${userId} order by created_at asc limit 1
  `;
  if (!owned[0]) throw new Error("Save the turf sheet first");
  const profile = await sql<{ role: string }>`
    select role from profiles where user_id = ${userId} limit 1
  `;
  if (profile[0]?.role && profile[0].role !== "owner") {
    throw new Error("Only the owner can manage gate logins");
  }
  return owned[0].id;
}

export async function listTeamHandler(userId: string): Promise<TeamMember[]> {
  const sql = await getSql();
  const owned = await sql<{ id: string }>`
    select id from venues where user_id = ${userId} order by created_at asc limit 1
  `;
  const profile = await sql<{ role: string; venue_id: string | null }>`
    select role, venue_id from profiles where user_id = ${userId} limit 1
  `;
  const venueId = owned[0]?.id ?? profile[0]?.venue_id;
  if (!venueId) return [];
  const rows = await sql<{ user_id: string; role: string; display_name: string }>`
    select user_id, role, display_name from profiles
    where venue_id = ${venueId}
      and role in ('owner', 'manager', 'staff')
    order by
      case role when 'owner' then 0 when 'manager' then 1 else 2 end,
      display_name asc
  `;
  const members: TeamMember[] = [];
  for (const row of rows) {
    const user = await sql.query<{ email: string; name: string }>(
      `select email, name from "user" where id = $1 limit 1`,
      [row.user_id],
    );
    const role = row.role as TeamMember["role"];
    members.push({
      userId: row.user_id,
      name: row.display_name || user[0]?.name || "",
      email: user[0]?.email ?? "",
      role,
    });
  }
  return members;
}

export async function addTeamMemberHandler(
  userId: string,
  data: { name: string; email: string; password: string; role: "staff" | "manager" },
): Promise<TeamMember> {
  const venueId = await ownerVenueId(userId);
  const name = data.name.trim();
  const email = data.email.trim().toLowerCase();
  const password = data.password;
  if (name.length < 2) throw new Error("Give them a name");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Need a real email");
  if (password.length < 8) throw new Error("Password must be 8+ characters");
  if (data.role !== "staff" && data.role !== "manager") throw new Error("Role must be staff or manager");

  const sql = await getSql();
  const existing = await sql.query<{ id: string }>(
    `select id from "user" where email = $1 limit 1`,
    [email],
  );
  if (existing[0]) throw new Error("That email already has a login");

  const { hashPassword } = await import("@better-auth/utils/password");
  const id = crypto.randomUUID();
  await sql.query(
    `insert into "user" ("id", "name", "email", "emailVerified", "createdAt", "updatedAt")
     values ($1, $2, $3, true, now(), now())`,
    [id, name, email],
  );
  const hash = await hashPassword(password);
  await sql.query(
    `insert into account (
       "id", "accountId", "providerId", "userId", "password", "createdAt", "updatedAt"
     ) values ($1, $2, 'credential', $3, $4, now(), now())`,
    [`acc-${id}`, id, id, hash],
  );
  await sql`
    insert into profiles (user_id, role, display_name, venue_id)
    values (${id}, ${data.role}, ${name}, ${venueId})
    on conflict (user_id) do update set
      role = excluded.role,
      display_name = excluded.display_name,
      venue_id = excluded.venue_id
  `;
  return { userId: id, name, email, role: data.role };
}

export async function removeTeamMemberHandler(userId: string, memberId: string) {
  const venueId = await ownerVenueId(userId);
  if (memberId === userId) throw new Error("You cannot remove yourself");
  const sql = await getSql();
  const row = await sql<{ role: string; venue_id: string | null }>`
    select role, venue_id from profiles where user_id = ${memberId} limit 1
  `;
  if (!row[0] || row[0].venue_id !== venueId) throw new Error("Not on this turf");
  if (row[0].role === "owner") throw new Error("The owner login stays");
  await sql`
    update profiles set venue_id = null where user_id = ${memberId} and venue_id = ${venueId}
  `;
  return { ok: true as const };
}

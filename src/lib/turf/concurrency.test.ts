import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

type Sql = {
  query: <T>(text: string, params?: unknown[]) => Promise<T[]>;
};

async function boot(): Promise<Sql> {
  const pg = new PGlite();
  await pg.waitReady;
  for (const file of ["0002_schema.sql", "0003_functions.sql"]) {
    const sql = readFileSync(new URL(`../../../migrations/${file}`, import.meta.url), "utf8");
    await pg.exec(sql);
  }
  const run = async <T>(text: string, params: unknown[] = []) => {
    const res = await pg.query<T>(text, params);
    return res.rows;
  };
  return { query: run };
}

async function seedTree(sql: Sql) {
  await sql.query(`insert into org (id, legal_name, status) values ('o1', 'T', 'active')`);
  await sql.query(
    `insert into venue (id, org_id, name, slug, timezone) values ('v1', 'o1', 'Green', 'green', 'Asia/Kolkata')`,
  );
  await sql.query(
    `insert into resource (id, venue_id, parent_id, name, is_bookable, sort_order)
     values ('g', 'v1', null, 'Ground A', true, 0),
            ('p1', 'v1', 'g', 'Pitch 1', true, 1),
            ('p2', 'v1', 'g', 'Pitch 2', true, 2)`,
  );
  await sql.query(`select rebuild_resource_tree('v1')`);
}

const START = "2026-08-29T14:30:00+00:00"; // 20:00 IST
const END = "2026-08-29T15:30:00+00:00";
const DATE = "2026-08-29";

async function createBooking(
  sql: Sql,
  opts: { id: string; ref: string; resource: string; state: string },
) {
  const rows = await sql.query<{ ok: boolean; error: string | null; booking_id: string | null }>(
    `select * from turf_create_booking(
      $1, $2, 'v1', $3, null, null,
      $4::timestamptz, $5::timestamptz, $4::timestamptz, $5::timestamptz,
      $6::date, $7, 'staff', 100000, 0, 0, 100000, 0,
      null, null, null, '{}'::jsonb, now() + interval '4 hours', null, $1
    )`,
    [opts.id, opts.ref, opts.resource, START, END, DATE, opts.state],
  );
  return rows[0]!;
}

async function accept(sql: Sql, id: string) {
  const rows = await sql.query<{ ok: boolean; error: string | null; booking_id: string | null }>(
    `select * from turf_accept_booking($1, 'actor', 'staff', 100000, 'upi_offline', null)`,
    [id],
  );
  return rows[0]!;
}

test("50 accepts of one slot → exactly 1 confirmed", async () => {
  const sql = await boot();
  await seedTree(sql);
  const ids = Array.from({ length: 50 }, (_, i) => `bk_${i}`);
  for (const [i, id] of ids.entries()) {
    const r = await createBooking(sql, { id, ref: `GTA-${i}`, resource: "p1", state: "requested" });
    assert.equal(r.ok, true, r.error ?? "");
  }
  const results = await Promise.all(ids.map((id) => accept(sql, id)));
  const ok = results.filter((r) => r.ok);
  assert.equal(ok.length, 1);
  const confirmed = await sql.query<{ n: number }>(
    `select count(*)::int as n from booking where state = 'confirmed'`,
  );
  assert.equal(Number(confirmed[0]!.n), 1);
  const declined = await sql.query<{ n: number }>(
    `select count(*)::int as n from booking where state = 'declined'`,
  );
  assert.equal(Number(declined[0]!.n), 49);
});

test("Ground A and Pitch 1 cannot both confirm — no deadlock", async () => {
  const sql = await boot();
  await seedTree(sql);
  await createBooking(sql, { id: "a", ref: "A", resource: "g", state: "requested" });
  await createBooking(sql, { id: "b", ref: "B", resource: "p1", state: "requested" });
  const [ga, p1] = await Promise.all([accept(sql, "a"), accept(sql, "b")]);
  const wins = [ga, p1].filter((r) => r.ok).length;
  assert.equal(wins, 1);
});

test("Pitch 1 and Pitch 2 both confirm; Ground A then unavailable", async () => {
  const sql = await boot();
  await seedTree(sql);
  await createBooking(sql, { id: "a", ref: "A", resource: "p1", state: "requested" });
  await createBooking(sql, { id: "b", ref: "B", resource: "p2", state: "requested" });
  const [r1, r2] = await Promise.all([accept(sql, "a"), accept(sql, "b")]);
  assert.equal(r1.ok, true, r1.error ?? "");
  assert.equal(r2.ok, true, r2.error ?? "");
  const ground = await createBooking(sql, { id: "c", ref: "C", resource: "g", state: "confirmed" });
  assert.equal(ground.ok, false);
  assert.equal(ground.error, "SLOT_UNAVAILABLE");
});

test("accepting one request declines overlapping requests atomically", async () => {
  const sql = await boot();
  await seedTree(sql);
  await createBooking(sql, { id: "a", ref: "A", resource: "p1", state: "requested" });
  await createBooking(sql, { id: "b", ref: "B", resource: "p1", state: "requested" });
  await createBooking(sql, { id: "c", ref: "C", resource: "g", state: "requested" });
  const r = await accept(sql, "a");
  assert.equal(r.ok, true);
  const states = await sql.query<{ id: string; state: string }>(`select id, state from booking order by id`);
  const map = Object.fromEntries(states.map((s) => [s.id, s.state]));
  assert.equal(map.a, "confirmed");
  assert.equal(map.b, "declined");
  assert.equal(map.c, "declined");
});

test("cancel frees the slot immediately", async () => {
  const sql = await boot();
  await seedTree(sql);
  const made = await createBooking(sql, { id: "a", ref: "A", resource: "p1", state: "confirmed" });
  assert.equal(made.ok, true);
  const t = await sql.query<{ ok: boolean; error: string | null }>(
    `select * from turf_transition('a', 'cancelled', 'actor', 'staff', 'change of plan')`,
  );
  assert.equal(t[0]!.ok, true, t[0]!.error ?? "");
  const again = await createBooking(sql, { id: "b", ref: "B", resource: "p1", state: "confirmed" });
  assert.equal(again.ok, true, again.error ?? "");
});

test("staff confirmed vs link request — exactly one confirmed", async () => {
  const sql = await boot();
  await seedTree(sql);
  await createBooking(sql, { id: "req", ref: "R", resource: "p1", state: "requested" });
  const [staff, acc] = await Promise.all([
    createBooking(sql, { id: "st", ref: "S", resource: "p1", state: "confirmed" }),
    accept(sql, "req"),
  ]);
  const confirmed = [staff.ok, acc.ok].filter(Boolean).length;
  assert.equal(confirmed, 1);
});

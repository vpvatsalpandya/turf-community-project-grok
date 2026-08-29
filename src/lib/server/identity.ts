import type { Sql } from "@/lib/db";

/** Follow merged_into so duplicate phones land on the surviving identity. */
export async function canonicalIdentityId(sql: Sql, startId: string): Promise<string> {
  let id = startId;
  for (let i = 0; i < 6; i++) {
    const rows = await sql<{ id: string; merged_into: string | null }>`
      select id, merged_into from customer_identity where id = ${id} limit 1`;
    if (!rows[0] || !rows[0].merged_into) return id;
    id = rows[0].merged_into;
  }
  return id;
}

export async function findIdentityByPhone(sql: Sql, phone: string): Promise<string | null> {
  const rows = await sql<{ id: string; merged_into: string | null }>`
    select id, merged_into from customer_identity
     where phone_e164 = ${phone}
     order by deleted_at nulls first, created_at
     limit 1`;
  if (!rows[0]) return null;
  return canonicalIdentityId(sql, rows[0].merged_into ?? rows[0].id);
}

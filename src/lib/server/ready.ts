import { getSql, type Sql } from "@/lib/db";
import { seedDemo, seedWaitlistIfEmpty, seedNoshowCandidateIfEmpty } from "./seed";
import { runJobs } from "./jobs";

const g = globalThis as typeof globalThis & { __turfReady__?: Promise<Sql> };

export async function ready(): Promise<Sql> {
  g.__turfReady__ ??= (async () => {
    const sql = await getSql();
    await seedDemo(sql);
    await runJobs(sql);
    return sql;
  })().catch((err) => {
    g.__turfReady__ = undefined;
    throw err;
  });
  const sql = await g.__turfReady__;
  await getSql();
  await seedWaitlistIfEmpty(sql);
  await seedNoshowCandidateIfEmpty(sql);
  await runJobs(sql);
  return sql;
}

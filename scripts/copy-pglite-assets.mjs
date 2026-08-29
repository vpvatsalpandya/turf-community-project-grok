#!/usr/bin/env node
/**
 * Nitro's Vercel bundle inlines `@electric-sql/pglite` as `_libs/electric-sql__pglite.mjs`
 * but does not copy the WASM / data files that module loads from disk at runtime.
 * Without them, `vite preview` (and a PGLite-mode deploy) dies on:
 *   ENOENT …/__server.func/_libs/pglite.data
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules/@electric-sql/pglite/dist");
const DEST = join(ROOT, ".vercel/output/functions/__server.func/_libs");
const FILES = ["pglite.data", "pglite.wasm", "initdb.wasm"];

export function copyPgliteAssets() {
  if (!existsSync(DEST)) {
    console.log("[pglite] no vercel function output yet — skip");
    return { copied: 0, skipped: true };
  }
  mkdirSync(DEST, { recursive: true });
  let copied = 0;
  for (const name of FILES) {
    const from = join(SRC, name);
    const to = join(DEST, name);
    if (!existsSync(from)) {
      console.warn(`[pglite] missing ${from}`);
      continue;
    }
    copyFileSync(from, to);
    copied += 1;
  }
  console.log(`[pglite] copied ${copied} asset(s) into function output`);
  return { copied, skipped: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = copyPgliteAssets();
  if (!r.skipped && r.copied < FILES.length) process.exitCode = 1;
}

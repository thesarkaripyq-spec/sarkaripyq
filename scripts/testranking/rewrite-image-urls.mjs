// Phase 2 of the image migration: reads the manifest built by
// migrate-images.mjs ({originalUrl: newPublicUrl | null}) and rewrites every
// question_html/option_html row that references a migrated URL to point at
// the new Supabase Storage URL instead. Rows with a URL that permanently
// failed (null in the manifest) or that hasn't been attempted yet are left
// untouched - re-run this again after a later migrate-images.mjs run picks
// up more of them. Safe to re-run: rewriting an already-rewritten row is a
// no-op (the old URL is no longer present to match).
//
// Usage: node scripts/testranking/rewrite-image-urls.mjs [--concurrency=N]

import { Pool } from "pg";
import { readFile } from "node:fs/promises";
import { config } from "dotenv";

config({ path: ".env.local" });

const MANIFEST_PATH = "scripts/testranking/.cache/image-manifest.json";
const concurrencyArg = process.argv.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split("=")[1], 10) : 20;

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function applyManifest(html, manifest) {
  let out = html;
  let changed = false;
  for (const [oldUrl, newUrl] of manifest) {
    if (out.includes(oldUrl)) {
      out = out.split(oldUrl).join(newUrl);
      changed = true;
    }
  }
  return changed ? out : null;
}

async function main() {
  const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  const manifestEntries = Object.entries(manifest).filter(([, v]) => v); // skip nulls (failed) and unattempted
  log(`Loaded manifest: ${manifestEntries.length} successfully-migrated URLs to apply`);

  if (manifestEntries.length === 0) {
    log("Nothing to apply yet - run migrate-images.mjs first.");
    return;
  }

  const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL, max: CONCURRENCY });

  // Build one combined work queue across both tables so the whole pool stays
  // busy end-to-end, rather than draining questions before starting options.
  const queue = [];
  for (const [table, column] of [
    ["questions", "question_html"],
    ["options", "option_html"],
  ]) {
    const { rows } = await pool.query(`select id, ${column} as html from ${table} where ${column} like '%<img%'`);
    log(`${table}: ${rows.length} rows with images to check`);
    for (const row of rows) queue.push({ table, column, id: row.id, html: row.html });
  }
  log(`Total rows to check: ${queue.length}, concurrency=${CONCURRENCY}`);

  let cursor = 0;
  let checked = 0;
  let updated = 0;
  const startedAt = Date.now();

  async function worker() {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      const newHtml = applyManifest(item.html, manifestEntries);
      if (newHtml) {
        await pool.query(`update ${item.table} set ${item.column} = $1 where id = $2`, [newHtml, item.id]);
        updated++;
      }
      checked++;
      if (checked % 500 === 0) {
        const rate = (checked / ((Date.now() - startedAt) / 1000)).toFixed(1);
        log(`  ${checked}/${queue.length} checked, ${updated} updated so far (${rate} rows/sec)`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  await pool.end();

  log(`DONE. ${checked} rows checked, ${updated} rows updated.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

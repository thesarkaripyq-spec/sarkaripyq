// Downloads every external image referenced in questions.question_html /
// options.option_html and re-uploads it to this project's own Supabase
// Storage bucket ("question-images"), building a manifest of
// {originalUrl: newPublicUrl} as it goes. Resumable: already-processed URLs
// (success OR permanent failure) are skipped on re-run. Does NOT touch the
// database - see rewrite-image-urls.mjs for the second phase that points
// question_html/option_html at the new URLs using this manifest.
//
// Usage:
//   node scripts/testranking/migrate-images.mjs [--limit=N] [--concurrency=N]

import { Client } from "pg";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "question-images";
const CACHE_DIR = "scripts/testranking/.cache";
const MANIFEST_PATH = path.join(CACHE_DIR, "image-manifest.json");
const LOG_PATH = path.join(CACHE_DIR, "image-migration.log");

const DELAY_MS = 250; // per-worker spacing - still polite even with concurrency > 1
const MAX_RETRIES = 3;

const limitArg = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;
const concurrencyArg = process.argv.find((a) => a.startsWith("--concurrency="));
const CONCURRENCY = concurrencyArg ? parseInt(concurrencyArg.split("=")[1], 10) : 1;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  return line;
}

async function loadManifest() {
  try {
    return JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
  } catch {
    return {};
  }
}

async function saveManifest(manifest) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function storagePathFor(url) {
  const hash = createHash("sha1").update(url).digest("hex");
  let ext = ".png";
  try {
    const p = new URL(url).pathname;
    const m = p.match(/\.([a-zA-Z0-9]{2,5})$/);
    if (m) ext = `.${m[1].toLowerCase()}`;
  } catch {
    // malformed URL - keep default extension
  }
  return `q/${hash}${ext}`;
}

async function downloadAndUpload(url, logLines) {
  const storagePath = storagePathFor(url);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const imgRes = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SarkariPYQ-ImageMigration/1.0)" },
      });
      if (!imgRes.ok) throw new Error(`fetch HTTP ${imgRes.status}`);
      const buffer = Buffer.from(await imgRes.arrayBuffer());
      const contentType = imgRes.headers.get("content-type") || "image/png";

      const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_KEY}`,
          apikey: SERVICE_KEY,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
        body: buffer,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`upload HTTP ${uploadRes.status}: ${errText.slice(0, 200)}`);
      }

      return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
    } catch (err) {
      logLines.push(log(`  attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${err.message}`));
      if (attempt < MAX_RETRIES) await sleep(1000 * attempt);
    }
  }
  return null;
}

async function main() {
  const client = new Client({ connectionString: process.env.SUPABASE_DB_URL });
  await client.connect();

  const { rows: qImgs } = await client.query(`
    select unnest(regexp_matches(question_html, 'src="([^"]+)"', 'g')) as src
    from questions where question_html like '%<img%'
  `);
  const { rows: oImgs } = await client.query(`
    select unnest(regexp_matches(option_html, 'src="([^"]+)"', 'g')) as src
    from options where option_html like '%<img%'
  `);
  await client.end();

  const distinctUrls = [...new Set([...qImgs, ...oImgs].map((r) => r.src))].filter((u) =>
    u.startsWith("http"),
  );

  const manifest = await loadManifest();
  const logLines = [];
  let done = 0,
    failed = 0,
    skipped = 0;
  const toProcess = distinctUrls.filter((u) => !(u in manifest)).slice(0, LIMIT);

  logLines.push(
    log(
      `Starting. ${distinctUrls.length} distinct URLs total, ${Object.keys(manifest).length} already in manifest, processing up to ${toProcess.length} now, concurrency=${CONCURRENCY}.`,
    ),
  );

  // Single Node process, N concurrent async workers pulling from one shared
  // queue - not N separate processes, so there's no file-locking/race risk
  // on manifest.json (all reads/writes stay on one event loop). Each worker
  // still paces its own requests with DELAY_MS, so total request rate is
  // roughly CONCURRENCY x (1 / DELAY_MS), spread across 3 source domains.
  let cursor = 0;
  let lastSave = Date.now();

  async function worker() {
    while (cursor < toProcess.length) {
      const url = toProcess[cursor++];
      await sleep(DELAY_MS);
      const newUrl = await downloadAndUpload(url, logLines);
      if (newUrl) {
        manifest[url] = newUrl;
        done++;
      } else {
        manifest[url] = null; // permanent failure marker - don't retry every run
        failed++;
        logLines.push(log(`  GAVE UP: ${url}`));
      }

      if ((done + failed) % 50 === 0 || Date.now() - lastSave > 15000) {
        lastSave = Date.now();
        await saveManifest(manifest);
        logLines.push(log(`Progress: ${done} done, ${failed} failed this run.`));
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

  await saveManifest(manifest);
  const totalSucceeded = Object.values(manifest).filter(Boolean).length;
  const totalFailed = Object.values(manifest).filter((v) => v === null).length;
  logLines.push(
    log(
      `DONE this run. +${done} uploaded, +${failed} failed. Manifest total: ${totalSucceeded} succeeded, ${totalFailed} permanently failed, ${distinctUrls.length - totalSucceeded - totalFailed} not yet attempted.`,
    ),
  );

  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(LOG_PATH, logLines.join("\n") + "\n", { flag: "a" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

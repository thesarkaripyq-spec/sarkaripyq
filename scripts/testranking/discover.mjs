// Conservative discovery of SSC PYQ ("Previous Paper") series exposed by
// TestRanking's public Free Mock Test pages, per the signed authorization
// letter from GP Learning Pvt Ltd (Ref GPL/TSTRK/API/2026-0831).
//
// Only touches:
//   - GET /user/free-mock-test/{slug}           (public page, to read the
//     package id out of its embedded __NEXT_DATA__)
//   - GET /admin/api/get-tab-package-series-v1/{packageId}/... (public
//     listing endpoint — confirmed to work with zero cookies, wide-open
//     CORS, and returns a fresh anonymous session cookie of its own)
//
// Does NOT touch /admin/api/questions-solutions-new/* — that fetch happens
// in scripts/testranking/import.mjs, run separately.

import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const CACHE_DIR = path.join(ROOT, "scripts", "testranking", ".cache");
const PAGES_CACHE = path.join(CACHE_DIR, "pages");
const LISTINGS_CACHE = path.join(CACHE_DIR, "listings");
const LOG_FILE = path.join(CACHE_DIR, "discover.log");

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SarkariPYQ-Importer/1.0 (+admin@sarkaripyq.com)";

// Core SSC exam categories (excludes quiz/sectional/selection variants,
// which aren't full previous-year papers).
const SSC_CATEGORIES = [
  "ssc-cgl",
  "cgl-tier-ii",
  "ssc-chsl",
  "chsl-tier-ii",
  "ssc-cpo",
  "cpo-tier-ii",
  "ssc-stenographer",
  "ssc-mts",
  "ssc-jht",
  "ssc-gd-constable",
  "ssc-je-paper-ii",
];

const REQUEST_DELAY_MS = 1200; // conservative spacing between requests
const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 2000;

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  return line;
}

async function appendLog(lines) {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(LOG_FILE, lines.join("\n") + "\n", { flag: "a" });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, logLines) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "*/*",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (err) {
      lastErr = err;
      logLines.push(log(`  attempt ${attempt}/${MAX_RETRIES} failed for ${url}: ${err.message}`));
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_BASE_DELAY_MS * attempt);
      }
    }
  }
  throw lastErr;
}

async function getCachedOrFetch(cachePath, url, logLines) {
  try {
    const cached = await readFile(cachePath, "utf8");
    logLines.push(log(`  cache hit: ${path.basename(cachePath)}`));
    return cached;
  } catch {
    // not cached
  }
  await sleep(REQUEST_DELAY_MS);
  const body = await fetchWithRetry(url, logLines);
  await mkdir(path.dirname(cachePath), { recursive: true });
  await writeFile(cachePath, body, "utf8");
  return body;
}

function extractNextData(html) {
  const m = html.match(/__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s);
  if (!m) throw new Error("__NEXT_DATA__ not found on page");
  return JSON.parse(m[1]);
}

async function discoverPackageId(slug, logLines) {
  const url = `https://www.testranking.in/user/free-mock-test/${slug}`;
  const cachePath = path.join(PAGES_CACHE, `${slug}.html`);
  const html = await getCachedOrFetch(cachePath, url, logLines);
  const data = extractNextData(html);
  const pkg = data?.props?.pageProps?._packageDetail;
  if (!pkg?.package_id) {
    throw new Error(`no _packageDetail.package_id on page for ${slug}`);
  }
  return pkg;
}

async function discoverSeriesForPackage(slug, packageId, logLines) {
  // Path params observed from real browser requests (referenced from this
  // same public page) and held constant except packageId:
  //   mainTab=0 (Tier I), subMainTab=1 (Previous Year), childTab=0 (Full Test),
  //   subChildTab=-1 (All years), page=0, pageSize=1000.
  // The two trailing opaque tokens (4643625, 561) are carried through
  // unchanged from an observed working request rather than guessed.
  const url = `https://www.testranking.in/admin/api/get-tab-package-series-v1/${packageId}/0/1/0/-1/4643625/0/1000/561`;
  const cachePath = path.join(LISTINGS_CACHE, `${slug}-${packageId}.json`);
  const body = await getCachedOrFetch(cachePath, url, logLines);
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(`listing response for ${slug} was not valid JSON`);
  }
  return data;
}

function extractPreviousPaperSeries(listingData) {
  // The listing payload's exact top-level shape varies; walk it defensively
  // looking for objects with series_id + series_type.
  const found = [];
  const seen = new Set();

  function walk(node) {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else if (node && typeof node === "object") {
      if (node.series_id && node.series_type) {
        if (node.series_type === "Previous Paper" && !seen.has(node.series_id)) {
          seen.add(node.series_id);
          found.push({
            series_id: node.series_id,
            series_name: node.series_name ?? null,
            total_question: node.total_question ?? null,
            total_marks: node.total_marks ?? null,
            is_free: node.is_free ?? null,
          });
        }
      } else {
        for (const v of Object.values(node)) walk(v);
      }
    }
  }
  walk(listingData);
  return found;
}

async function main() {
  const logLines = [];
  const manifest = { generatedAt: new Date().toISOString(), categories: {} };
  let totalSeries = 0;

  for (const slug of SSC_CATEGORIES) {
    logLines.push(log(`Discovering ${slug} ...`));
    try {
      const pkg = await discoverPackageId(slug, logLines);
      logLines.push(log(`  package_id=${pkg.package_id} (${pkg.package_name ?? slug})`));

      const listing = await discoverSeriesForPackage(slug, pkg.package_id, logLines);
      const series = extractPreviousPaperSeries(listing);
      logLines.push(log(`  found ${series.length} Previous Paper series`));

      manifest.categories[slug] = {
        package_id: pkg.package_id,
        package_name: pkg.package_name ?? null,
        series,
      };
      totalSeries += series.length;
    } catch (err) {
      logLines.push(log(`  ERROR: ${err.message} — skipping ${slug}`));
      manifest.categories[slug] = { error: err.message, series: [] };
    }
  }

  manifest.totalSeries = totalSeries;

  const manifestPath = path.join(CACHE_DIR, "manifest.json");
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  logLines.push(log(`Wrote manifest with ${totalSeries} total series to ${manifestPath}`));

  await appendLog(logLines);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

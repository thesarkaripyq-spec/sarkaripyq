// Imports the normalized TestRanking PYQ corpus (scripts/testranking/.cache/normalized/*.json,
// produced by normalize.py from the local scrape store) into Supabase Postgres.
//
// Touches only: local JSON files + SUPABASE_DB_URL (your own database).
// Never calls testranking.in. Idempotent: safe to re-run (upserts on the
// same unique constraints the schema already enforces).
//
// Usage:
//   node scripts/testranking/import.mjs [--dry-run] [--only cgl,chsl] [--limit 5]

import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });

const NORMALIZED_DIR = path.join(process.cwd(), "scripts", "testranking", ".cache", "normalized");
const LOG_PATH = path.join(process.cwd(), "scripts", "testranking", ".cache", "import.log");

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const onlyArg = args.find((a) => a.startsWith("--only="));
const ONLY = onlyArg ? new Set(onlyArg.split("=")[1].split(",")) : null;
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = limitArg ? parseInt(limitArg.split("=")[1], 10) : Infinity;

const logLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

async function flushLog() {
  await mkdir(path.dirname(LOG_PATH), { recursive: true });
  await writeFile(LOG_PATH, logLines.join("\n") + "\n", { flag: "a" });
}

async function ensureSubjects(client) {
  const newSubjectsPath = path.join(NORMALIZED_DIR, "_new_subjects.json");
  let extra = [];
  try {
    extra = JSON.parse(await readFile(newSubjectsPath, "utf8"));
  } catch {
    // none produced by normalize.py this run
  }
  for (const s of extra) {
    await client.query(
      `insert into subjects (slug, name, display_order)
       values ($1, $2, $3)
       on conflict (slug) do nothing`,
      [s.slug, s.name, s.display_order],
    );
  }
  const { rows } = await client.query("select id, slug from subjects");
  return new Map(rows.map((r) => [r.slug, r.id]));
}

async function ensureExam(client, examCache, slug) {
  if (examCache.has(slug)) return examCache.get(slug);
  const { rows } = await client.query("select id from exams where slug = $1", [slug]);
  if (rows.length === 0) {
    throw new Error(`exam slug "${slug}" not found in exams table - seed it first (supabase/seed or a migration)`);
  }
  examCache.set(slug, rows[0].id);
  return rows[0].id;
}

// Builds "($1,$2,$3),($4,$5,$6),..." plus the flattened params array for a
// multi-row INSERT, so one paper's worth of questions/options goes over the
// wire in a handful of round trips instead of hundreds.
function valuesClause(rows, colsPerRow) {
  const params = [];
  const groups = rows.map((row) => {
    const placeholders = row.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    return `(${placeholders.join(",")})`;
  });
  return { sql: groups.join(","), params };
}

async function importPaper(client, examId, subjectIds, paper, stats) {
  const paperRes = await client.query(
    `insert into papers (exam_id, year, tier, exam_date, shift, slug, title, is_published)
     values ($1, $2, $3, $4, $5, $6, $7, true)
     on conflict (exam_id, year, tier, slug)
     do update set title = excluded.title, exam_date = excluded.exam_date, shift = excluded.shift
     returning id`,
    [examId, paper.year, paper.tier ?? "", paper.exam_date, paper.shift, paper.slug, paper.title],
  );
  const paperId = paperRes.rows[0].id;

  const usable = [];
  for (const q of paper.questions) {
    const subjectId = subjectIds.get(q.subject_slug);
    if (!subjectId) {
      log(`  SKIP question (unknown subject "${q.subject_slug}") paper=${paper.slug} q#${q.question_number}`);
      stats.questionsSkipped++;
      continue;
    }
    usable.push({ ...q, subjectId });
  }
  if (usable.length === 0) return;

  const qRows = usable.map((q) => [
    paperId, q.subjectId, q.question_number, q.question_html, q.explanation_html, true,
  ]);
  const qValues = valuesClause(qRows, 6);
  const qRes = await client.query(
    `insert into questions (paper_id, subject_id, question_number, question_html, explanation_html, is_published)
     values ${qValues.sql}
     on conflict (paper_id, question_number)
     do update set question_html = excluded.question_html, explanation_html = excluded.explanation_html,
                   subject_id = excluded.subject_id
     returning id, question_number`,
    qValues.params,
  );
  stats.questions += qRes.rows.length;
  const idByNumber = new Map(qRes.rows.map((r) => [r.question_number, r.id]));

  const questionIds = [...idByNumber.values()];
  // Replace options wholesale so a re-run never leaves stale rows behind.
  await client.query("delete from options where question_id = any($1::uuid[])", [questionIds]);

  const optRows = [];
  for (const q of usable) {
    const questionId = idByNumber.get(q.question_number);
    for (const opt of q.options) {
      optRows.push([questionId, opt.label, opt.option_html, opt.is_correct, opt.display_order]);
    }
  }
  if (optRows.length > 0) {
    const optValues = valuesClause(optRows, 5);
    await client.query(
      `insert into options (question_id, label, option_html, is_correct, display_order)
       values ${optValues.sql}`,
      optValues.params,
    );
    stats.options += optRows.length;
  }
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error("SUPABASE_DB_URL is not set in .env.local");
    process.exit(1);
  }

  const files = (await readdir(NORMALIZED_DIR))
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
    .filter((f) => !ONLY || ONLY.has(f.replace(".json", "")))
    .sort();

  if (files.length === 0) {
    console.error(`No normalized exam files found in ${NORMALIZED_DIR}. Run normalize.py first.`);
    process.exit(1);
  }

  const client = new Client({ connectionString: dbUrl });
  await client.connect();
  log(`Connected. Mode: ${DRY_RUN ? "DRY RUN (rolled back)" : "LIVE"}. Files: ${files.join(", ")}`);

  const stats = { papers: 0, papersFailed: 0, questions: 0, questionsSkipped: 0, options: 0 };
  const examCache = new Map();

  try {
    const subjectIds = await ensureSubjects(client);
    log(`Subjects available: ${[...subjectIds.keys()].join(", ")}`);

    for (const file of files) {
      const examSlug = file.replace(".json", "");
      const payload = JSON.parse(await readFile(path.join(NORMALIZED_DIR, file), "utf8"));
      const examId = await ensureExam(client, examCache, examSlug);

      log(`--- ${examSlug}: ${payload.papers.length} papers ---`);
      const papers = payload.papers.slice(0, LIMIT);

      for (const paper of papers) {
        try {
          await client.query("BEGIN");
          await importPaper(client, examId, subjectIds, paper, stats);
          if (DRY_RUN) {
            await client.query("ROLLBACK");
          } else {
            await client.query("COMMIT");
          }
          stats.papers++;
        } catch (err) {
          await client.query("ROLLBACK");
          stats.papersFailed++;
          log(`  ERROR importing paper ${paper.slug} (series ${paper.source_series_id}): ${err.message}`);
        }
      }
    }

    log(
      `Done. papers=${stats.papers} papersFailed=${stats.papersFailed} ` +
        `questions=${stats.questions} questionsSkipped=${stats.questionsSkipped} options=${stats.options}`,
    );
  } finally {
    await client.end();
    await flushLog();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

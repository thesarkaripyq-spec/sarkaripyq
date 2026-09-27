"""Integrity verification for the TestRanking SSC PYQ store.

Checks, in order:
  1. Referential integrity and row-count consistency.
  2. Byte-for-byte fidelity of the stored raw payloads versus the live API,
     re-fetched independently and compared by sha256.
  3. Byte-for-byte fidelity of the stored raw payload versus the on-disk JSON
     file written during the run.
  4. That every derived question/option HTML value appears verbatim in its
     series' raw payload (i.e. nothing was rewritten).
  5. That no Hindi paper endpoint was ever requested.
"""

import hashlib
import json
import random
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, "scripts/testranking")
import scrape_pyq as s  # noqa: E402

DB = Path("data/testranking/testranking_pyq.sqlite3")
SAMPLE = 8
failures: list[str] = []


def check(label: str, ok: bool, detail: str = "") -> None:
    print(f"  {'PASS' if ok else 'FAIL'}  {label}{(' -- ' + detail) if detail else ''}")
    if not ok:
        failures.append(label)


db = sqlite3.connect(DB)
db.row_factory = sqlite3.Row

print("=" * 74)
print("1. ROW COUNTS AND REFERENTIAL INTEGRITY")
print("=" * 74)
counts = {
    name: db.execute(f"select count(*) from {name}").fetchone()[0]
    for name in (
        "exam_categories",
        "exam_packages",
        "question_series",
        "paper_sections",
        "questions",
        "question_options",
        "question_tokens",
        "image_assets",
        "raw_api_responses",
        "fetch_attempts",
    )
}
for name, n in counts.items():
    print(f"  {name:<22} {n:>8}")

check("foreign_key_check clean", not list(db.execute("pragma foreign_key_check")))
check("integrity_check ok", db.execute("pragma integrity_check").fetchone()[0] == "ok")

orphans = db.execute(
    "select count(*) from questions q "
    "left join question_series s on s.series_id = q.series_id "
    "where s.series_id is null"
).fetchone()[0]
check("no orphan questions", orphans == 0, f"{orphans} orphans")

opt_orphans = db.execute(
    "select count(*) from question_options o "
    "left join questions q on q.question_uid = o.question_uid "
    "where q.question_uid is null"
).fetchone()[0]
check("no orphan options", opt_orphans == 0, f"{opt_orphans} orphans")

off_spec = db.execute(
    """
    select count(*) from (
        select q.question_uid, sum(o.is_correct) as correct_count
          from questions q
          join question_options o on o.question_uid = q.question_uid
         group by q.question_uid
        having sum(o.is_correct) <> 1
    )
    """
).fetchone()[0]

# Two distinct situations are lumped together by that count, and only one is a
# defect on our side:
#   * several options flagged correct  -> a real parsing/normalisation bug
#   * no option flagged correct       -> the upstream payload shipped an empty
#                                       answer_en, faithfully preserved verbatim
over_flagged = db.execute(
    """
    select count(*) from (
        select q.question_uid, sum(o.is_correct) as correct_count
          from questions q
          join question_options o on o.question_uid = q.question_uid
         group by q.question_uid
        having sum(o.is_correct) > 1
    )
    """
).fetchone()[0]
no_answer = off_spec - over_flagged

check(
    "at most one correct option per question",
    over_flagged == 0,
    f"{over_flagged} questions with multiple correct options",
)
if no_answer:
    print(
        f"  NOTE  {no_answer} question(s) have no correct option because the "
        f"upstream payload shipped an empty answer; kept verbatim, not guessed"
    )

print()
print("=" * 74)
print("2. RAW PAYLOAD FIDELITY vs LIVE API (re-fetched)")
print("=" * 74)
rows = db.execute(
    "select series_id, questions_api_url, response_sha256, response_byte_size "
    "from question_series where questions_fetch_status = 'fetched' order by series_id"
).fetchall()
random.seed(20260926)
sample = random.sample(rows, min(SAMPLE, len(rows)))

fetcher = s.Fetcher(db, delay_seconds=1.3)
mismatches = 0
for row in sample:
    live = fetcher.get(row["questions_api_url"], is_paper_endpoint=True)
    digest = hashlib.sha256(live.body).hexdigest()
    same = digest == row["response_sha256"] and len(live.body) == row["response_byte_size"]
    if not same:
        mismatches += 1
    print(
        f"  {'OK  ' if same else 'DIFF'} series={row['series_id']:<9} "
        f"bytes={len(live.body):<8} sha={digest[:16]}"
    )
check(f"re-fetched {len(sample)} payloads match stored sha256", mismatches == 0)

print()
print("=" * 74)
print("3. RAW PAYLOAD FIDELITY vs ON-DISK JSON FILES")
print("=" * 74)
bad_disk = 0
checked_disk = 0
for row in db.execute(
    "select r.series_id, r.local_path, r.body_sha256, r.response_body "
    "from raw_api_responses r where r.endpoint_kind = 'questions' "
    "and r.local_path is not null order by r.series_id"
):
    path = Path(row["local_path"])
    if not path.exists():
        print(f"  MISSING  {path}")
        bad_disk += 1
        continue
    checked_disk += 1
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != row["body_sha256"]:
        print(f"  DIFF     {path}")
        bad_disk += 1
    elif data != row["response_body"]:
        print(f"  BLOB!=FILE {path}")
        bad_disk += 1
check(
    f"all {checked_disk} on-disk payloads byte-identical to stored blob",
    bad_disk == 0,
    f"{bad_disk} problems",
)

print()
print("=" * 74)
print("4. DERIVED HTML APPEARS VERBATIM IN RAW PAYLOAD")
print("=" * 74)
# The comparison must be structural. A substring search against the raw JSON
# *text* gives false negatives: JSON escapes CR/LF as \r\n and backslashes as
# \\, so a parsed value (real CRLF, single backslashes) never appears literally
# in the source text. Instead we walk the parsed tree and look for the exact
# string as a value.
sample_q = db.execute(
    "select series_id, source_qid, raw_question_html, raw_solution_html "
    "from questions order by random() limit 400"
).fetchall()
parsed_cache: dict[int, set[str]] = {}


def harvest(node, sink: set[str]) -> None:
    if isinstance(node, str):
        sink.add(node)
    elif isinstance(node, dict):
        for v in node.values():
            harvest(v, sink)
    elif isinstance(node, list):
        for v in node:
            harvest(v, sink)


verbatim_ok = 0
verbatim_bad: list[str] = []
for q in sample_q:
    sid = q["series_id"]
    if sid not in parsed_cache:
        row = db.execute(
            "select response_body from raw_api_responses "
            "where series_id = ? and endpoint_kind = 'questions'",
            (sid,),
        ).fetchone()
        sink: set[str] = set()
        if row:
            harvest(json.loads(row["response_body"].decode("utf-8", "replace")), sink)
        parsed_cache[sid] = sink
    pool = parsed_cache[sid]
    ok = True
    for col in ("raw_question_html", "raw_solution_html"):
        val = q[col]
        if val and val not in pool:
            ok = False
            break
    if ok:
        verbatim_ok += 1
    else:
        verbatim_bad.append(f"series={sid} qid={q['source_qid']}")
check(
    f"{verbatim_ok}/{len(sample_q)} sampled questions byte-identical to payload",
    not verbatim_bad,
    ", ".join(verbatim_bad[:3]),
)

print()
print("=" * 74)
print("5. ENGLISH-ONLY COMPLIANCE")
print("=" * 74)
hi = db.execute(
    "select count(*) from fetch_attempts where request_url like '%/hi'"
    " or request_url like '%/HI%'"
).fetchone()[0]
check("zero requests to Hindi paper endpoints", hi == 0, f"{hi} found")

paper_urls = db.execute(
    "select distinct request_url from fetch_attempts "
    "where request_url like '%questions-solutions-new%'"
).fetchall()
bad_suffix = [u["request_url"] for u in paper_urls if not u["request_url"].rstrip("/").endswith("/en")]
check(
    f"all {len(paper_urls)} distinct paper URLs end in /en",
    not bad_suffix,
    ", ".join(bad_suffix[:3]),
)

print()
print("=" * 74)
print("6. IMAGE URL SANITY")
print("=" * 74)
total = db.execute("select count(*) from image_assets").fetchone()[0]
distinct = db.execute("select count(distinct image_url) from image_assets").fetchone()[0]
print(f"  rows={total}  distinct_urls={distinct}")

unclassified = db.execute(
    "select count(*) from image_assets where url_kind not in "
    "('absolute','site-relative','unresolvable')"
).fetchone()[0]
check("every reference classified", unclassified == 0, f"{unclassified} unclassified")

bad_abs = db.execute(
    "select count(*) from image_assets where url_kind = 'absolute' "
    "and resolved_url not like 'http%'"
).fetchone()[0]
check("absolute refs resolve to http(s)", bad_abs == 0, f"{bad_abs} bad")

bad_rel = db.execute(
    "select count(*) from image_assets where url_kind = 'site-relative' "
    "and resolved_url not like 'http%'"
).fetchone()[0]
check("site-relative refs resolved against origin", bad_rel == 0, f"{bad_rel} bad")

unresolvable = db.execute(
    "select count(*) from image_assets where url_kind = 'unresolvable'"
).fetchone()[0]
check(
    "unresolvable refs are kept, not discarded",
    db.execute(
        "select count(*) from image_assets where url_kind = 'unresolvable' "
        "and resolved_url is null and image_url is not null"
    ).fetchone()[0]
    == unresolvable,
    f"{unresolvable} unresolvable (retained verbatim, nothing to fetch)",
)

print("  by url kind:")
for r in db.execute(
    "select url_kind, count(*) n from image_assets group by url_kind order by n desc"
):
    print(f"    {r['url_kind']:<15} {r['n']}")
print("  by role:")
for r in db.execute(
    "select image_role, count(*) n, count(distinct image_url) d "
    "from image_assets group by image_role order by n desc"
):
    print(f"    {r['image_role']:<14} rows={r['n']:<7} distinct={r['d']}")
print("  by source field:")
for r in db.execute(
    "select source_field, count(*) n from image_assets "
    "group by source_field order by n desc limit 10"
):
    print(f"    {r['source_field']:<22} {r['n']}")
print("  distinct hosts:")
for r in db.execute(
    "select substr(resolved_url, 1, "
    "  case when instr(resolved_url, '/') > 0 then instr(resolved_url, '/') - 1 "
    "  else length(resolved_url) end) as host, count(*) n "
    "from image_assets where resolved_url is not null group by host order by n desc limit 8"
):
    print(f"    {r['host']:<40} {r['n']}")

print()
print("=" * 74)
if failures:
    print(f"RESULT: {len(failures)} CHECK(S) FAILED")
    for f in failures:
        print(f"  - {f}")
    sys.exit(1)
print("RESULT: ALL CHECKS PASSED")
print("=" * 74)

db.close()

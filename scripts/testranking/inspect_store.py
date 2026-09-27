"""Spot-check the stored content so the numbers are backed by real rows."""

import sqlite3

db = sqlite3.connect("data/testranking/testranking_pyq.sqlite3")
db.row_factory = sqlite3.Row


def show(label, value, width=90):
    text = str(value).replace("\n", " ")
    if len(text) > width:
        text = text[: width - 3] + "..."
    print(f"  {label:<26} {text}")


print("=" * 92)
print("SAMPLE PAPER")
print("=" * 92)
s = db.execute(
    "select * from question_series where series_id = 3321083"
).fetchone()
print(f"  series_id        {s['series_id']}")
print(f"  series_name      {s['series_name']}")
print(f"  series_type      {s['series_type']}")
show("package", db.execute(
    "select package_slug, package_name from exam_packages where package_id=?",
    (s["package_id"],)).fetchone()[:])
show("questions_api_url", s["questions_api_url"])
show("response_sha256", s["response_sha256"])
print(f"  response bytes     {s['response_byte_size']}")
print(f"  total_marks/time   {s['total_marks']} / {s['total_time']} min")

print("\n  sections:")
for r in db.execute(
    "select section_id, section_name, question_count from paper_sections "
    "where series_id=? order by section_id",
    (s["series_id"],),
):
    print(f"    [{r['section_id']}] {r['section_name']:<32} {r['question_count']} questions")

print("\n  first question:")
q = db.execute(
    "select * from questions where series_id=? order by question_uid limit 1",
    (s["series_id"],),
).fetchone()
print(f"    qid={q['source_qid']}  topic={q['topic_id']}  marks={q['marks']}  "
      f"answer=option {q['answer_option_index']} ({q['answer_type']})")
print(f"    has_question_image={q['has_question_image']}  has_option_image={q['has_option_image']}")
show("question_en", q["raw_question_html"], 88)
show("solution_en", q["raw_solution_html"], 88)
print("    options:")
for o in db.execute(
    "select option_index, option_label, raw_option_html, is_correct "
    "from question_options where question_uid=? order by option_index",
    (q["question_uid"],),
):
    body = (o["raw_option_html"] or "").replace("\r", "").replace("\n", "")
    print(f"      {o['option_label']}. {body[:60]:<62} correct={o['is_correct']}")
print("    opaque tokens:")
for t in db.execute(
    "select option_index, token_value from question_tokens where question_uid=? order by option_index",
    (q["question_uid"],),
):
    print(f"      q{t['option_index']}_en = {t['token_value']}")

print()
print("=" * 92)
print("SAMPLE IMAGE ASSET (with question that embeds it)")
print("=" * 92)
a = db.execute(
    "select ia.*, q.source_qid from image_assets ia "
    "join questions q on q.question_uid = ia.question_uid "
    "where ia.image_role='question' and ia.url_kind='absolute' limit 1"
).fetchone()
print(f"  image_uid        {a['image_uid']}")
print(f"  series_id        {a['series_id']}   qid={a['source_qid']}")
print(f"  source_field     {a['source_field']}")
print(f"  image_role       {a['image_role']}")
print(f"  image_url        {a['image_url']}")
print(f"  url_kind         {a['url_kind']}")

print()
print("=" * 92)
print("UNRESOLVABLE REFERENCE (kept verbatim, flagged)")
print("=" * 92)
u = db.execute(
    "select series_id, source_field, image_url, url_kind, resolved_url "
    "from image_assets where url_kind='unresolvable'"
).fetchall()
for r in u:
    print(f"  series={r['series_id']}  field={r['source_field']}")
    print(f"  image_url   {r['image_url']}")
    print(f"  url_kind    {r['url_kind']}   resolved_url={r['resolved_url']}")

print()
print("=" * 92)
print("SITE-RELATIVE REFERENCES (resolved against origin)")
print("=" * 92)
for r in db.execute(
    "select series_id, source_field, image_url, resolved_url from image_assets "
    "where url_kind='site-relative' limit 4"
):
    print(f"  {r['image_url']}\n    -> {r['resolved_url']}")

print()
print("=" * 92)
print("COVERAGE BY EXAM")
print("=" * 92)
# Aggregated in separate subqueries: joining questions and image_assets in one
# query fans out and multiplies the counts.
for r in db.execute(
    """
    select p.package_slug, p.package_label,
           (select count(*) from question_series qs
             where qs.package_id = p.package_id
               and qs.series_type = 'Previous Paper')                       as papers,
           (select count(*) from questions q
             join question_series qs on qs.series_id = q.series_id
            where qs.package_id = p.package_id
              and qs.series_type = 'Previous Paper')                       as questions,
           (select count(*) from image_assets ia
             join question_series qs on qs.series_id = ia.series_id
            where qs.package_id = p.package_id
              and qs.series_type = 'Previous Paper')                       as images
      from exam_packages p
     where p.is_available = 1
     order by questions desc
    """
):
    print(
        f"  {r['package_slug']:<18} {str(r['package_label'])[:26]:<28} "
        f"papers={r['papers']:<5} questions={r['questions']:<7} images={r['images']}"
    )

print()
print("=" * 92)
print("PAPERS BY YEAR (parsed from series name)")
print("=" * 92)
years = {}
for r in db.execute(
    "select series_name from question_series where series_type = 'Previous Paper'"
):
    # Series names look like "SSC CGL - 12 Sep 2025 - Shift 1"; match a
    # 4-digit year in a plausible range rather than just the last 4 chars.
    found = None
    for token in r["series_name"].replace("-", " ").split():
        t = token.strip("(),")
        if len(t) == 4 and t.isdigit() and "1990" <= t <= "2035":
            found = t
            break
    years[found or "unparsed"] = years.get(found or "unparsed", 0) + 1
for yr, n in sorted(years.items(), reverse=True):
    print(f"  {yr}: {n} papers")
print(f"  (total {sum(years.values())} papers)")
db.close()

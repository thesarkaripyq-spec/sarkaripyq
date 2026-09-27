"""Normalize the scraped TestRanking SQLite store into JSON files matching
SarkariPYQ's Supabase schema (exams/subjects/topics/papers/questions/options).

Read-only against the SQLite DB. Writes normalized JSON under
scripts/testranking/.cache/normalized/<exam_slug>.json for the Node import
script (import.mjs) to upsert via SUPABASE_DB_URL. Makes no network calls and
touches no database - safe to re-run freely.
"""

import json
import re
import sqlite3
from collections import defaultdict
from html import unescape
from html.parser import HTMLParser

DB_PATH = "data/testranking/testranking_pyq.sqlite3"
OUT_DIR = "scripts/testranking/.cache/normalized"
SPLITS_PATH = "scripts/testranking/.cache/combined_section_splits.json"

# --- exam mapping: package_slug -> (exam_slug, tier) ------------------------
PACKAGE_TO_EXAM = {
    "ssc-cgl": ("cgl", "Tier 1"),
    "cgl-tier-ii": ("cgl", "Tier 2"),
    "ssc-chsl": ("chsl", "Tier 1"),
    "chsl-tier-ii": ("chsl", "Tier 2"),
    "ssc-cpo": ("cpo", "Tier 1"),
    "cpo-tier-ii": ("cpo", "Tier 2"),
    # "" (not None/null) for untiered exams: papers.tier is NOT NULL now -
    # a plain SQL UNIQUE constraint never treats two NULLs as equal, which
    # previously made every re-import silently duplicate these papers
    # instead of updating them (fixed in migration 0004).
    "ssc-mts": ("mts", ""),
    "ssc-stenographer": ("steno", ""),
    "selection-post": ("selection-post", ""),
    "gd-const-2026": ("gd", ""),
}

# --- subject mapping: section_name -> subject slug --------------------------
SECTION_TO_SUBJECT = {
    "Quantitative Aptitude": "quantitative-aptitude",
    "PART-C (Quantitative Aptitude)": "quantitative-aptitude",
    "PART-C (Elementary Mathematics)": "quantitative-aptitude",
    "PART-C (Quantitative Aptitude (Basic Arithmetic Skill))": "quantitative-aptitude",
    "Logical Reasoning": "reasoning",
    "General Intelligence & Reasoning": "reasoning",
    "PART-A (General Intelligence and Reasoning)": "reasoning",
    "PART-A (General Intelligence & Reasoning)": "reasoning",
    "PART-A (General Intelligence)": "reasoning",
    "PART-B (General Intelligence)": "reasoning",
    "General Awareness": "general-awareness",
    "PART-B (General Knowledge and General Awareness)": "general-awareness",
    "PART-B (General Awareness)": "general-awareness",
    "PART-D (General Awareness)": "general-awareness",
    "English Language": "english",
    "English Comprehension": "english",
    "English Language & Comprehension": "english",
    "PART-D (English)": "english",
    "PART-C (English Language and Comprehension)": "english",
    "PART-D (English Comprehension)": "english",
    "PART-A (English Language (Basic Knowledge))": "english",
    "PART-D (English Language (Basic Knowledge))": "english",
    "Computer": "computer",
    # Hindi Language / PART-D (Hindi) intentionally unmapped: Hindi content
    # was removed from the site by request, so those questions fall through
    # to "unmapped section" and get skipped rather than imported.
}
# Combined sections resolved per-question via combined_section_splits.json
COMBINED_SECTIONS = {"Maths and Reasoning", "English and GA"}

NEW_SUBJECTS = [
    {"slug": "computer", "name": "Computer", "display_order": 6},
]

MONTHS = (
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|"
    "aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?"
)
DATE_RE = re.compile(
    rf"(\d{{1,2}})(?:st|nd|rd|th)?\s+({MONTHS})\.?\s+(\d{{2,4}})", re.IGNORECASE
)
SLASH_DATE_RE = re.compile(r"(\d{1,2})/(\d{1,2})/(\d{4})")
SHIFT_RE = re.compile(r"shift\s*(\d+)", re.IGNORECASE)
TIME_RANGE_RE = re.compile(r"\(\s*\d{1,2}:\d{2}\s*[AP]M\s*-\s*\d{1,2}:\d{2}\s*[AP]M\s*\)", re.IGNORECASE)

MONTH_NUM = {
    m: i + 1
    for i, m in enumerate(
        ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    )
}


def slugify(text):
    text = re.sub(r"[^a-zA-Z0-9]+", "-", text or "").strip("-").lower()
    return re.sub(r"-{2,}", "-", text) or "x"


def parse_date_bits(series_name, fallback_year=None):
    """Returns (year:int, exam_date:'YYYY-MM-DD'|None, shift:str|None)."""
    shift = None
    m = SHIFT_RE.search(series_name)
    if m:
        shift = f"Shift {m.group(1)}"
    else:
        m = TIME_RANGE_RE.search(series_name)
        if m:
            shift = m.group(0).strip("()")

    m = DATE_RE.search(series_name)
    if m:
        day, month_str, year_str = m.groups()
        month = MONTH_NUM[month_str[:3].lower()]
        year = int(year_str)
        if year < 100:
            year += 2000
        try:
            return year, f"{year:04d}-{month:02d}-{int(day):02d}", shift
        except ValueError:
            return year, None, shift

    m = SLASH_DATE_RE.search(series_name)
    if m:
        day, month, year = (int(x) for x in m.groups())
        try:
            return year, f"{year:04d}-{month:02d}-{day:02d}", shift
        except ValueError:
            return year, None, shift

    if fallback_year:
        return fallback_year, None, shift
    return None, None, shift


class _Sanitizer(HTMLParser):
    """Minimal allowlist HTML sanitizer: keeps a small set of structural/
    formatting tags and a narrow attribute allowlist (img/src/alt/style-free),
    drops everything else (script/iframe/on* handlers/etc.). The scraped
    corpus had zero <script> tags (verified), but this stays defense-in-depth
    for content storage/render into the site."""

    ALLOWED_TAGS = {
        "p", "br", "b", "strong", "i", "em", "u", "sup", "sub", "span", "div",
        "ul", "ol", "li", "table", "thead", "tbody", "tr", "td", "th", "img",
        "var", "code", "pre",
    }
    ALLOWED_ATTRS = {
        "img": {"src", "alt", "width", "height"},
        "span": {"class"},
        "div": {"class"},
        "td": {"colspan", "rowspan"},
        "th": {"colspan", "rowspan"},
    }

    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.out = []

    def handle_starttag(self, tag, attrs):
        if tag not in self.ALLOWED_TAGS:
            return
        allowed = self.ALLOWED_ATTRS.get(tag, set())
        kept = [(k, v) for k, v in attrs if k in allowed and not (v or "").lower().startswith("javascript:")]
        attr_str = "".join(f' {k}="{v}"' for k, v in kept)
        self.out.append(f"<{tag}{attr_str}>")

    def handle_startendtag(self, tag, attrs):
        if tag not in self.ALLOWED_TAGS:
            return
        allowed = self.ALLOWED_ATTRS.get(tag, set())
        kept = [(k, v) for k, v in attrs if k in allowed and not (v or "").lower().startswith("javascript:")]
        attr_str = "".join(f' {k}="{v}"' for k, v in kept)
        self.out.append(f"<{tag}{attr_str} />")

    def handle_endtag(self, tag):
        if tag in self.ALLOWED_TAGS:
            self.out.append(f"</{tag}>")

    def handle_data(self, data):
        self.out.append(data)

    def handle_entityref(self, name):
        self.out.append(f"&{name};")

    def handle_charref(self, name):
        self.out.append(f"&#{name};")


def sanitize(html):
    if not html:
        return html
    s = _Sanitizer()
    try:
        s.feed(html)
        s.close()
        return "".join(s.out)
    except Exception:
        # Malformed fragment: fall back to stripping all tags rather than
        # emitting anything unparsed/unsanitized.
        return re.sub(r"<[^>]+>", "", unescape(html))


def load_splits():
    with open(SPLITS_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    lookup = {}
    for group in data.values():
        for sec in group["sections"]:
            key = (sec["series_id"], sec["section_id"])
            lookup[key] = sec
    return lookup


def main():
    import os
    os.makedirs(OUT_DIR, exist_ok=True)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    splits = load_splits()

    packages = {r["package_id"]: r for r in db.execute("select * from exam_packages where is_available=1")}

    exams = defaultdict(lambda: {"papers": []})
    stats = {"papers": 0, "papers_skipped_no_year": 0, "papers_skipped_not_pyq": 0, "questions": 0, "options": 0, "unmapped_sections": set()}

    for series in db.execute("select * from question_series"):
        pkg = packages.get(series["package_id"])
        if pkg is None:
            continue  # unavailable package, e.g. HTTP 500 upstream
        mapping = PACKAGE_TO_EXAM.get(pkg["package_slug"])
        if mapping is None:
            continue
        exam_slug, tier = mapping

        if "hindi" in (series["series_name"] or "").lower():
            continue  # Hindi-language exam editions excluded by request

        # The site carries previous-year papers only. scrape_pyq.py derives
        # question_series.paper_kind from the verbatim listing name; "mock" means
        # the entry is a memory-based / practice paper, not a real exam sitting.
        # Hard-excluding it here keeps a mock from ever reaching Supabase even if
        # one is scraped later. KIND_UNKNOWN is deliberately NOT excluded: an
        # unrecognised name is not evidence of a mock, and dropping those would
        # throw away real previous-year papers.
        if (series["paper_kind"] or "") == "mock":
            stats["papers_skipped_not_pyq"] += 1
            continue

        year, exam_date, shift = parse_date_bits(series["series_name"] or "", None)
        if year is None:
            stats["papers_skipped_no_year"] += 1
            continue

        base_slug = slugify(f"{exam_date or year}-{shift or ''}")
        slug = f"{base_slug}-s{series['series_id']}"

        sections = {
            r["section_id"]: r["section_name"]
            for r in db.execute(
                "select section_id, section_name from paper_sections where series_id=?",
                (series["series_id"],),
            )
        }

        questions_out = []
        paper_question_number = 0  # position resets to 1 within each section
        # (English/GA/Quant/Reasoning each numbered 1..25 independently in the
        # source), so the paper-wide question_number is a running counter
        # over questions grouped by section, not the raw per-section position.
        for q in db.execute(
            "select * from questions where series_id=? order by cast(section_id as integer), position",
            (series["series_id"],),
        ):
            section_name = sections.get(q["section_id"], "")
            if section_name in COMBINED_SECTIONS:
                split = splits.get((series["series_id"], q["section_id"]))
                if split is None:
                    subject_slug = None
                else:
                    subject_slug = (
                        split["first_subject"] if q["position"] <= split["split_at_position"]
                        else split["second_subject"]
                    )
            else:
                subject_slug = SECTION_TO_SUBJECT.get(section_name)

            if subject_slug is None:
                stats["unmapped_sections"].add(section_name)
                continue

            options_out = []
            for opt in db.execute(
                "select * from question_options where question_uid=? order by option_index",
                (q["question_uid"],),
            ):
                if not opt["raw_option_html"]:
                    continue
                label = opt["option_label"] or chr(ord("A") + opt["option_index"] - 1)
                options_out.append({
                    "label": label,
                    "option_html": sanitize(opt["raw_option_html"]),
                    "is_correct": bool(opt["is_correct"]),
                    "display_order": opt["option_index"],
                })
            if not options_out or not any(o["is_correct"] for o in options_out):
                continue  # data integrity guard - Postgres requires exactly one correct option

            # Shared stimulus (RC passage / chart / cloze paragraph) that the
            # question refers to but doesn't itself contain. Previously
            # dropped entirely, leaving e.g. "Select the option to fill blank
            # number 3" with no paragraph to fill blanks in. Prepended so it
            # renders above the actual question every time it's shown.
            passage = q["raw_comprehensive_html"]
            question_html = sanitize(q["raw_question_html"])
            if passage and passage.strip():
                question_html = f'<div class="shared-passage">{sanitize(passage)}</div>{question_html}'

            paper_question_number += 1
            questions_out.append({
                "source_question_uid": q["question_uid"],
                "subject_slug": subject_slug,
                "question_number": paper_question_number,
                "question_html": question_html,
                "explanation_html": sanitize(q["raw_solution_html"]) if q["raw_solution_html"] else None,
                "options": options_out,
            })
            stats["questions"] += 1
            stats["options"] += len(options_out)

        if not questions_out:
            continue

        exams[exam_slug]["papers"].append({
            "source_series_id": series["series_id"],
            "tier": tier,
            "year": year,
            "exam_date": exam_date,
            "shift": shift,
            "slug": slug,
            "title": series["series_name"],
            "questions": questions_out,
        })
        stats["papers"] += 1

    for exam_slug, payload in exams.items():
        with open(f"{OUT_DIR}/{exam_slug}.json", "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False)

    with open(f"{OUT_DIR}/_new_subjects.json", "w", encoding="utf-8") as f:
        json.dump(NEW_SUBJECTS, f, indent=2)

    print(f"Papers written: {stats['papers']} across {len(exams)} exams")
    print(f"Papers skipped (no parseable year): {stats['papers_skipped_no_year']}")
    print(f"Papers skipped (not a PYQ / memory-based mock): {stats['papers_skipped_not_pyq']}")
    print(f"Questions: {stats['questions']}, Options: {stats['options']}")
    if stats["unmapped_sections"]:
        print(f"Unmapped section names (questions skipped): {sorted(stats['unmapped_sections'])}")
    for exam_slug, payload in sorted(exams.items()):
        print(f"  {exam_slug}: {len(payload['papers'])} papers")


if __name__ == "__main__":
    main()

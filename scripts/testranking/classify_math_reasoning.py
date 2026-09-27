"""Heuristic per-question classifier for the combined "Maths and Reasoning"
section into the two existing subjects (quantitative-aptitude / reasoning).

The source API only labels this as one combined section - there's no
per-question subject field to read. This scores each question's raw HTML
against two keyword/pattern lists and picks the stronger side, with a
documented fallback for ties so every question still lands somewhere.

Read-only: prints a report. Does not touch the database or Supabase.
"""

import json
import re
import sqlite3
from html import unescape

DB_PATH = "data/testranking/testranking_pyq.sqlite3"

MATH_PATTERNS = [
    r"math-tex", r"\\frac", r"\\sqrt", r"\\times", r"\\div", r"\\sum",
    r"\bpercent(age)?\b", r"\bratio\b", r"\bprofit\b", r"\bloss\b",
    r"\bsimple interest\b", r"\bcompound interest\b", r"\bspeed\b",
    r"\bdistance\b", r"\btriangle\b", r"\bcircle\b", r"\barea\b",
    r"\bvolume\b", r"\bequation\b", r"\bHCF\b", r"\bLCM\b", r"\bdiscount\b",
    r"\bC\.?P\.?\b", r"\bS\.?P\.?\b", r"\bmean\b", r"\bmedian\b",
    r"\baverage\b", r"Rs\.?\s*\d", r"\d+\s*%", r"\bkm/hr\b", r"\bsq\.?\s*cm\b",
    r"\bx\s*[+\-*/]\s*y\b", r"\d+\s*:\s*\d+",
]
REASONING_PATTERNS = [
    r"\bseries\b", r"\banalog(y|ies)\b", r"\bcod(e|ing)[\s-]*decod", r"\bcode\b",
    r"\bmirror image\b", r"\bwater image\b", r"\bvenn diagram\b",
    r"\bstatement", r"\bconclusion", r"\bsyllogism\b", r"\bdirection", r"\bblood relation",
    r"\bmatrix\b", r"\bodd one out\b", r"\bclassification\b", r"\barrange", r"\bsequence\b",
    r"\bdice\b", r"\bcube\b", r"\bfigure\b", r"\bpattern\b", r"\bword\b.*\barrange",
]

MATH_RE = re.compile("|".join(MATH_PATTERNS), re.IGNORECASE)
REASONING_RE = re.compile("|".join(REASONING_PATTERNS), re.IGNORECASE)


def classify(html: str) -> tuple[str, int, int]:
    text = unescape(html or "")
    math_score = len(MATH_RE.findall(text))
    reasoning_score = len(REASONING_RE.findall(text))
    if math_score == 0 and reasoning_score == 0:
        # No keyword hit either way. Empirically (see classification report
        # samples) unmatched questions in this section are almost always
        # numeric math word-problems without an explicit math keyword
        # ("divisible by", "litres of milk mixed") rather than reasoning,
        # so the tie-break defaults to quant rather than reasoning.
        return "fallback-quantitative-aptitude", math_score, reasoning_score
    if math_score >= reasoning_score:
        return "quantitative-aptitude", math_score, reasoning_score
    return "reasoning", math_score, reasoning_score


def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    rows = db.execute(
        """
        select q.question_uid, q.raw_question_html
        from questions q
        join paper_sections ps on ps.series_id = q.series_id and ps.section_id = q.section_id
        where ps.section_name = 'Maths and Reasoning'
        """
    ).fetchall()

    counts = {"quantitative-aptitude": 0, "reasoning": 0, "fallback-quantitative-aptitude": 0}
    samples = {"quantitative-aptitude": [], "reasoning": [], "fallback-quantitative-aptitude": []}

    for r in rows:
        label, ms, rs = classify(r["raw_question_html"])
        counts[label] += 1
        if len(samples[label]) < 3:
            snippet = re.sub(r"<[^>]+>", " ", unescape(r["raw_question_html"] or "")).strip()[:100]
            samples[label].append(snippet)

    print(f"Total questions in 'Maths and Reasoning' sections: {len(rows)}")
    for label, c in counts.items():
        pct = (c / len(rows) * 100) if rows else 0
        print(f"\n{label}: {c} ({pct:.1f}%)")
        for s in samples[label]:
            print(f"   - {s}".encode("ascii", errors="replace").decode("ascii"))

    with open("scripts/testranking/.cache/math_reasoning_classification_report.json", "w", encoding="utf-8") as f:
        json.dump({"total": len(rows), "counts": counts}, f, indent=2)


if __name__ == "__main__":
    main()

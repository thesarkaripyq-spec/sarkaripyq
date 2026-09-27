"""Per-series boundary detection for combined sections ("Maths and Reasoning",
"English and GA") that the source API reports as one section but which are
actually two contiguous blocks back to back.

Rather than classifying each question independently (noisy - many GA/Reasoning
questions don't hit any keyword), this finds the single split point per
series+section that best separates the position-ordered questions into a
"mostly signal-A first, mostly signal-B second" step function, matching how
these papers are actually laid out. Read-only: prints a report, writes
nothing to the database.
"""

import json
import re
import sqlite3
from html import unescape

DB_PATH = "data/testranking/testranking_pyq.sqlite3"

MATH_KEYWORDS = re.compile(
    r"math-tex|\\frac|\\sqrt|\\times|\\div|\\sum|percent(age)?|\bratio\b|profit|loss|"
    r"simple interest|compound interest|\bspeed\b|\bdistance\b|\btriangle\b|\bcircle\b|"
    r"\barea\b|\bvolume\b|\bequation\b|\bHCF\b|\bLCM\b|discount|mean\b|median|average|"
    r"Rs\.?\s*\d|\d+\s*%|km/hr|sq\.?\s*cm|\d+\s*:\s*\d+|divisible|litres?\b",
    re.IGNORECASE,
)
REASONING_KEYWORDS = re.compile(
    r"\bseries\b|analog|cod(e|ing)[\s-]*decod|mirror image|water image|venn diagram|"
    r"statement|conclusion|syllogism|direction|blood relation|\bmatrix\b|odd one out|"
    r"classification|\bsequence\b|\bdice\b|\bcube\b|\bfigure\b|\bpattern\b|embedded|"
    r"certain code|letter cluster",
    re.IGNORECASE,
)
ENGLISH_KEYWORDS = re.compile(
    r"synonym|antonym|idiom|spel[lt]|grammatical|\bsentence\b|\bpassage\b|\bparagraph\b|"
    r"active voice|passive voice|narration|fill in the blank|one-word substitut|"
    r"homonym|preposition|conjunction|\btense\b|jumbled|comprehension|underlined",
    re.IGNORECASE,
)
GA_KEYWORDS = re.compile(
    r"which of the following (state|year|act|article|scheme|country|countries)|"
    r"constitution|vitamin|census|ministry|\baward\b|\briver\b|capital of|currency|"
    r"\bGDP\b|\bbudget\b|amendment|freedom fighter|dynasty|\btemple\b|national park|"
    r"\bISRO\b|satellite|chemical formula|\belement\b|\bplanet\b|history|sanctuary",
    re.IGNORECASE,
)


def clean(html):
    return re.sub(r"<[^>]+>", " ", unescape(html or "")).strip()


def signal_pair(text, a_re, b_re):
    """Independent hit flags for keyword-set A and keyword-set B (not mutually
    exclusive - a question can hit both or neither)."""
    return (1 if a_re.search(text) else 0, 1 if b_re.search(text) else 0)


def cost_for_order(sig_a, sig_b, k):
    """Cost of placing questions [0:k] as "A" and [k:] as "B": count of
    A-block questions that hit B's keywords, plus B-block questions that hit
    A's keywords."""
    misplaced_before = sum(b for b in sig_b[:k])
    misplaced_after = sum(a for a in sig_a[k:])
    return misplaced_before + misplaced_after


def best_split(sig_a, sig_b):
    """Try both orderings (A-then-B and B-then-A) and every split point k,
    returning whichever (order, k) minimizes misplaced keyword hits. Does not
    assume which subject comes first - some series run GA-then-English,
    others English-then-GA.
    """
    n = len(sig_a)
    best = None  # (cost, order, k)
    for k in range(0, n + 1):
        cost_ab = cost_for_order(sig_a, sig_b, k)
        if best is None or cost_ab < best[0]:
            best = (cost_ab, "A_then_B", k)
        cost_ba = cost_for_order(sig_b, sig_a, k)
        if cost_ba < best[0]:
            best = (cost_ba, "B_then_A", k)
    return best  # (cost, order, k)


def process(section_name, a_re, b_re, label_a, label_b):
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    sections = db.execute(
        "select series_id, section_id, question_count from paper_sections where section_name = ?",
        (section_name,),
    ).fetchall()

    results = []
    total_a = total_b = 0
    for sec in sections:
        rows = db.execute(
            "select position, raw_question_html from questions where series_id=? and section_id=? order by position",
            (sec["series_id"], sec["section_id"]),
        ).fetchall()
        sig_a, sig_b = [], []
        for r in rows:
            a, b = signal_pair(clean(r["raw_question_html"]), a_re, b_re)
            sig_a.append(a)
            sig_b.append(b)
        cost, order, k = best_split(sig_a, sig_b)
        n = len(rows)
        if order == "A_then_B":
            first_label, first_n, second_label, second_n = label_a, k, label_b, n - k
        else:
            first_label, first_n, second_label, second_n = label_b, k, label_a, n - k
        results.append({
            "series_id": sec["series_id"], "section_id": sec["section_id"], "n": n,
            "order": order, "k": k, "cost": cost,
            "first_label": first_label, "second_label": second_label,
        })
        total_a += first_n if first_label == label_a else second_n
        total_b += first_n if first_label == label_b else second_n

    from collections import Counter

    print(f"\n=== {section_name} ({len(sections)} series) ===")
    print(f"{label_a}: {total_a} questions, {label_b}: {total_b} questions")
    order_counts = Counter(r["order"] for r in results)
    print(f"Order chosen: {dict(order_counts)}")
    high_cost = [r for r in results if r["n"] and r["cost"] / r["n"] > 0.15]
    print(f"Series with >15% keyword-cost (low confidence): {len(high_cost)} / {len(results)}")
    for r in high_cost[:5]:
        print(f"   series {r['series_id']} section {r['section_id']}: cost {r['cost']}/{r['n']}, "
              f"{r['first_label']} then {r['second_label']}, split at {r['k']}")

    return {
        "sections": [
            {
                "series_id": r["series_id"], "section_id": r["section_id"],
                "split_at_position": r["k"], "first_subject": r["first_label"],
                "second_subject": r["second_label"], "confidence_cost": r["cost"], "n": r["n"],
            }
            for r in results
        ]
    }


def main():
    out = {}
    out["maths_and_reasoning"] = process(
        "Maths and Reasoning", MATH_KEYWORDS, REASONING_KEYWORDS,
        "quantitative-aptitude", "reasoning",
    )
    out["english_and_ga"] = process(
        "English and GA", ENGLISH_KEYWORDS, GA_KEYWORDS,
        "english", "general-awareness",
    )
    with open("scripts/testranking/.cache/combined_section_splits.json", "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
    print("\nWrote boundaries to scripts/testranking/.cache/combined_section_splits.json")


if __name__ == "__main__":
    main()

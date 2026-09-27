#!/usr/bin/env python3
"""
TestRanking SSC PYQ (Previous Year Paper) scraper.

Pipeline
--------
1. GET  https://www.testranking.in/user/free-mock-test
      -> authoritative list of exam categories + subcategory slugs.
2. GET  https://www.testranking.in/user/free-mock-test/{package_slug}
      -> package_id (read out of the embedded __NEXT_DATA__ payload).
3. GET  /admin/api/get-tab-package-series-v1/{package_id}/...
      -> series catalogue for that package.
4. GET  /admin/api/questions-solutions-new/{series_id}/en
      -> full question + solution payload for one paper.

Storage
-------
Every response is persisted twice, both losslessly:

  * ``raw_api_responses.response_body``  -- BLOB, the exact bytes off the wire,
    alongside ``body_sha256`` and ``byte_size`` so integrity is verifiable.
  * ``data/testranking/raw/.../*.json``  -- the same bytes written to disk.

The normalised ``questions`` / ``question_options`` / ``image_assets`` tables
are a derived, queryable view over that payload. Nothing in the raw payload is
rewritten, sanitised, trimmed or normalised -- the derived columns are additive
only.

English only
------------
Papers are requested exclusively from the ``/en`` endpoint. ``ENGLISH_ONLY`` is
enforced by :func:`assert_english_endpoint`, which raises on any request URL
that is not an English-language paper endpoint. No Hindi paper is ever fetched.

Usage
-----
    python scripts/testranking/scrape_pyq.py --stage discover
    python scripts/testranking/scrape_pyq.py --stage questions
    python scripts/testranking/scrape_pyq.py --stage all --delay 1.2
    python scripts/testranking/scrape_pyq.py --stage report

Resumable: re-running skips work already recorded as fetched.
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import re
import sqlite3
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "testranking"
DB_PATH = DATA_DIR / "testranking_pyq.sqlite3"
RAW_DIR = DATA_DIR / "raw"
LOG_PATH = DATA_DIR / "scrape.log"

# Sub-directory of RAW_DIR holding the first (original) question corpus.
# Later fetch runs should pass a different --batch so their JSON lands in a
# separate directory and old vs new stays obvious on disk.
BATCH_LEGACY = "questions"

ORIGIN = "https://www.testranking.in"
FREE_MOCK_INDEX_URL = f"{ORIGIN}/user/free-mock-test"
QUESTIONS_API_TEMPLATE = f"{ORIGIN}/admin/api/questions-solutions-new/{{series_id}}/en"

# Path params for the series-listing endpoint. Only the package id varies; the
# tab coordinates are supplied per package because they are not constant across
# the site (``main_tab_id`` is 0 for Prelims packages and 1 for Mains/Tier II
# packages -- assuming 0 makes the endpoint answer {"state":400,"Not Found."}).
#
#   sub_main_tab_id = 1  -> "Previous Year"
#   child_tab_id    = 0  -> "Full Test" (whole-paper PYQs; 1 is Sectional)
#   sub_child_tab_id= -1 -> "All years"
#   page = 0, page_size = 1000
#
# The two trailing opaque tokens (LISTING_TAB_TOKEN, LISTING_CUSTOMER_TOKEN) are
# carried through unchanged from an observed working request, not guessed.
LISTING_TAB_TOKEN = "4643625"
LISTING_CUSTOMER_TOKEN = "561"
LISTING_API_TEMPLATE = (
    f"{ORIGIN}/admin/api/get-tab-package-series-v1/{{package_id}}"
    "/{main_tab_id}/{sub_main_tab_id}/{child_tab_id}/{sub_child_tab_id}"
    f"/{LISTING_TAB_TOKEN}/0/1000/{LISTING_CUSTOMER_TOKEN}"
)

# Fallbacks matching the Prelims layout, used only if a page omits its tab data.
DEFAULT_MAIN_TAB_ID = 0
DEFAULT_SUB_MAIN_TAB_ID = 1      # Previous Year
DEFAULT_CHILD_TAB_ID = 0         # Full Test
DEFAULT_SUB_CHILD_TAB_ID = -1    # All years


def build_listing_api_url(
    package_id: int,
    main_tab_id: int = DEFAULT_MAIN_TAB_ID,
    sub_main_tab_id: int = DEFAULT_SUB_MAIN_TAB_ID,
    child_tab_id: int = DEFAULT_CHILD_TAB_ID,
    sub_child_tab_id: int = DEFAULT_SUB_CHILD_TAB_ID,
) -> str:
    return LISTING_API_TEMPLATE.format(
        package_id=package_id,
        main_tab_id=main_tab_id,
        sub_main_tab_id=sub_main_tab_id,
        child_tab_id=child_tab_id,
        sub_child_tab_id=sub_child_tab_id,
    )

# Listing series types worth collecting. TestRanking does NOT type genuine exam
# papers consistently: a real dated paper such as "CPO - 05 Oct 2023 - Shift 1"
# is published as "Previous Paper", "Free Mock" or "Test Series" depending on the
# package. Filtering to a single type silently dropped ~55% of the catalogue
# (selection-post went to 0, cpo to 1, stenographer to 3), so every type the
# listing returns is collected and the paper is classified by name instead.
PYQ_SERIES_TYPES = ("Previous Paper", "Free Mock", "Test Series")

# Name-based classification, stored as question_series.paper_kind. Used to keep
# real exam papers distinguishable from memory-based mocks without re-fetching.
_MONTH = r"(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*"
_RE_SHIFT = re.compile(r"shift\s*-?\s*(?:[ivx]+|\d+)", re.IGNORECASE)
# The listing spells the same date at least four different ways, and an earlier
# version of this only understood the first one, which mislabelled 105 genuine
# papers as KIND_UNKNOWN ("unknown"). An "unknown" row looks deletable, so that
# mislabelling is not cosmetic: it invites deleting real previous-year papers.
#   "24th July 2025"          ordinal + full month name + 4-digit year
#   "13th Sep. 19"            ordinal + abbreviated month (trailing period) + 2-digit year
#   "09 Sep 2024"             no ordinal
#   "1/12/2016", "30/09/2024" numeric day/month/year
_RE_DATED = re.compile(
    rf"\d{{1,2}}(?:st|nd|rd|th)?\s+{_MONTH}\.?\s*[-–—]?\s*\d{{2,4}}"
    r"|\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    re.IGNORECASE,
)
# "Previous Year", "previous year 1", but also "Prev. Year" and "Prev Year 20".
_RE_PREV_YEAR = re.compile(r"prev(?:ious)?\.?\s*year", re.IGNORECASE)
_RE_MEMORY = re.compile(
    r"memory\s*based|memory\s*test|most\s*expected|guess|revision\s*test"
    r"|practice\s*(?:test|mock)",
    re.IGNORECASE,
)

KIND_REAL = "real-paper"          # dated + shift: a genuine exam-shift paper
KIND_DATED = "dated"              # dated, shift not stated
KIND_PREV_YEAR = "prev-year"      # explicitly labelled a previous-year paper
KIND_MEMORY = "mock"              # memory-based / practice mock
KIND_UNKNOWN = "unknown"          # no date signal; kept, but needs review


def classify_paper_name(series_name: str | None) -> str:
    """Classify a listing entry as a real exam paper or a practice mock.

    Purely local string analysis over the verbatim series name, so it costs no
    network requests and can be re-run over already-stored rows at any time.
    """
    name = (series_name or "").strip()
    if not name:
        return KIND_UNKNOWN
    if _RE_MEMORY.search(name):
        return KIND_MEMORY
    dated = bool(_RE_DATED.search(name))
    if dated and _RE_SHIFT.search(name):
        return KIND_REAL
    if dated:
        return KIND_DATED
    if _RE_PREV_YEAR.search(name):
        return KIND_PREV_YEAR
    return KIND_UNKNOWN

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)
REFERER = f"{ORIGIN}/user/free-mock-test"

DEFAULT_DELAY_SECONDS = 1.2
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BACKOFF_SECONDS = 2.0
REQUEST_TIMEOUT_SECONDS = 60

# Only English paper endpoints may be requested.
ENGLISH_PAPER_PATH = re.compile(r"^/admin/api/questions-solutions-new/\d+/en/?$")

OPTION_LABELS = {1: "A", 2: "B", 3: "C", 4: "D", 5: "E"}


# --------------------------------------------------------------------------- #
# TLS trust store
# --------------------------------------------------------------------------- #
#
# testranking.in is served by Let's Encrypt's current chain:
#     testranking.in -> YE1 -> Root YE -> ISRG Root X2 -> ISRG Root X1
#
# CPython's *default* CA bundle can lag behind that rollout, and when the new
# roots are missing the handshake aborts with a misleading
# "certificate has expired" (OpenSSL verify code 10) even though every
# certificate in the chain is inside its validity window.
#
# ``certifi`` tracks the current Mozilla bundle and verifies the chain cleanly.
# We therefore hand certifi's bundle to OpenSSL as the trust store. This is a
# full, strict verification -- hostname, validity window and signatures are all
# still enforced. Nothing is disabled or downgraded.


def build_ssl_context() -> ssl.SSLContext:
    try:
        import certifi  # noqa: PLC0415 - optional, resolved at runtime

        context = ssl.create_default_context(cafile=certifi.where())
        log(f"tls trust store     : certifi bundle ({certifi.where()})")
        return context
    except ImportError:
        log("tls trust store     : python default bundle (certifi not installed)")
        return ssl.create_default_context()


# --------------------------------------------------------------------------- #
# Small helpers
# --------------------------------------------------------------------------- #


def log(message: str) -> None:
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}"
    print(line, flush=True)
    try:
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        with LOG_PATH.open("a", encoding="utf-8") as handle:
            handle.write(line + "\n")
    except OSError:
        pass  # logging must never abort a run


def sleep_seconds(seconds: float) -> None:
    if seconds > 0:
        time.sleep(seconds)


def slugify(value: str, max_length: int = 80) -> str:
    """Filesystem-safe token: lowercase alphanumerics separated by single dashes."""
    slug = re.sub(r"[^a-z0-9]+", "-", (value or "").lower()).strip("-")
    return (slug[:max_length].rstrip("-")) or "untitled"


def as_bool_int(value: Any) -> int | None:
    """Normalise the API's stringly-typed booleans ("0"/"1"/"true") to 0/1."""
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return int(value)
    if isinstance(value, (int, float)):
        return int(bool(value))
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "y"}:
        return 1
    if text in {"0", "false", "no", "n"}:
        return 0
    return None


def as_int(value: Any) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


def as_text(value: Any) -> str | None:
    if value is None:
        return None
    text = value if isinstance(value, str) else str(value)
    return text if text != "" else None


def as_json_text(value: Any) -> str | None:
    if value is None or value == "":
        return None
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


# --------------------------------------------------------------------------- #
# HTTP client
# --------------------------------------------------------------------------- #


class EnglishEndpointViolation(RuntimeError):
    """Raised when a non-English paper URL is about to be requested."""


def assert_english_endpoint(url: str) -> None:
    """Guard: refuse to request anything that is not an English paper endpoint."""
    path = urllib.parse.urlsplit(url).path
    if not ENGLISH_PAPER_PATH.match(path):
        raise EnglishEndpointViolation(
            f"refusing non-English paper endpoint: {url} "
            "(this scraper fetches English papers only)"
        )


def encode_url_for_request(url: str) -> str:
    """Percent-encode characters that are illegal in a request line.

    The payloads contain image references with literal spaces in the filename
    (e.g. ``.../986 copy.png``). Those are stored verbatim, as they appear
    upstream, but must be percent-encoded to be requestable at all. Without
    this, urllib raises InvalidURL.
    """
    parts = urllib.parse.urlsplit(url)
    if not parts.scheme or not parts.netloc:
        return url
    return urllib.parse.urlunsplit(
        (
            parts.scheme,
            parts.netloc,
            urllib.parse.quote(parts.path, safe="/%:@!$&'()*+,;=~-._"),
            urllib.parse.quote(parts.query, safe="=&?%:@!$'()*+,;~/.-_"),
            parts.fragment,
        )
    )


@dataclass
class HttpResult:
    url: str
    status: int
    body: bytes
    elapsed_ms: int
    headers: dict[str, str]


class Fetcher:
    """Polite HTTP client: fixed spacing, bounded retries, full audit trail."""

    def __init__(
        self,
        db: sqlite3.Connection,
        delay_seconds: float = DEFAULT_DELAY_SECONDS,
        max_retries: int = DEFAULT_MAX_RETRIES,
        backoff_seconds: float = DEFAULT_RETRY_BACKOFF_SECONDS,
    ) -> None:
        self.db = db
        self.delay_seconds = delay_seconds
        self.max_retries = max_retries
        self.backoff_seconds = backoff_seconds
        self._last_request_at = 0.0
        self.ssl_context = build_ssl_context()

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self.delay_seconds:
            sleep_seconds(self.delay_seconds - elapsed)

    def _record_attempt(
        self,
        url: str,
        status: int | None,
        ok: bool,
        error: str | None,
        elapsed_ms: int,
        attempt_number: int,
    ) -> None:
        self.db.execute(
            """
            insert into fetch_attempts
                (request_url, http_status, is_successful, error_message,
                 duration_ms, attempt_number)
            values (?, ?, ?, ?, ?, ?)
            """,
            (url, status, int(ok), error, elapsed_ms, attempt_number),
        )
        self.db.commit()

    def get(self, url: str, *, is_paper_endpoint: bool = False) -> HttpResult:
        if is_paper_endpoint:
            assert_english_endpoint(url)

        last_error: Exception | None = None

        for attempt in range(1, self.max_retries + 1):
            self._throttle()
            started = time.monotonic()
            request_url = encode_url_for_request(url)
            request = urllib.request.Request(
                request_url,
                headers={
                    "User-Agent": USER_AGENT,
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Referer": REFERER,
                },
                method="GET",
            )
            try:
                with urllib.request.urlopen(
                    request, timeout=REQUEST_TIMEOUT_SECONDS, context=self.ssl_context
                ) as response:
                    body = response.read()
                    elapsed_ms = int((time.monotonic() - started) * 1000)
                    self._last_request_at = time.monotonic()
                    status = response.status
                    headers = {k.lower(): v for k, v in response.headers.items()}
                self._record_attempt(url, status, True, None, elapsed_ms, attempt)
                return HttpResult(
                    url=url,
                    status=status,
                    body=body,
                    elapsed_ms=elapsed_ms,
                    headers=headers,
                )

            except urllib.error.HTTPError as exc:
                elapsed_ms = int((time.monotonic() - started) * 1000)
                self._last_request_at = time.monotonic()
                body = b""
                try:
                    body = exc.read()
                except Exception:  # noqa: BLE001 - diagnostics only
                    pass
                error = f"HTTP {exc.code}"
                # 4xx other than 429 will not improve on retry.
                retryable = exc.code == 429 or exc.code >= 500
                self._record_attempt(url, exc.code, False, error, elapsed_ms, attempt)
                if not retryable:
                    return HttpResult(
                        url=url,
                        status=exc.code,
                        body=body,
                        elapsed_ms=elapsed_ms,
                        headers={},
                    )
                last_error = exc

            except Exception as exc:  # noqa: BLE001 - network layer is broad by nature
                elapsed_ms = int((time.monotonic() - started) * 1000)
                self._last_request_at = time.monotonic()
                self._record_attempt(url, None, False, str(exc), elapsed_ms, attempt)
                last_error = exc

            if attempt < self.max_retries:
                sleep_seconds(self.backoff_seconds * attempt)

        raise RuntimeError(f"GET failed after {self.max_retries} attempts: {url} ({last_error})")

    def get_json(self, url: str, *, is_paper_endpoint: bool = False) -> tuple[Any, HttpResult]:
        result = self.get(url, is_paper_endpoint=is_paper_endpoint)
        try:
            payload = json.loads(result.body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise RuntimeError(f"response was not valid JSON: {url} ({exc})") from exc
        return payload, result


# --------------------------------------------------------------------------- #
# Schema
# --------------------------------------------------------------------------- #

SCHEMA_SQL = """
pragma journal_mode = wal;
pragma foreign_keys = on;

-- Top-level exam group, e.g. 'ssc'. Sourced from the free-mock-test index.
create table if not exists exam_categories (
    category_id            integer primary key,
    category_slug          text    not null unique,
    category_name          text    not null,
    previous_paper_count   integer,
    full_test_count        integer,
    created_at             text    not null default (datetime('now'))
);

-- One row per free-mock-test package page (/user/free-mock-test/{slug}).
create table if not exists exam_packages (
    package_id             integer primary key,
    category_id            integer not null references exam_categories (category_id),
    package_slug           text    not null unique,
    package_label          text,
    package_name           text,
    package_url            text    not null,
    -- Tab coordinates the listing endpoint is keyed on. These differ per
    -- package: main_tab_id is 0 for Prelims packages and 1 for Mains (Tier II)
    -- packages, so they are read from each page rather than assumed.
    main_tab_id            integer,
    sub_main_tab_id        integer,   -- 1 = Previous Year
    child_tab_id           integer,   -- 0 = Full Test, 1 = Sectional
    sub_child_tab_id       integer,   -- -1 = All years
    listing_api_url        text,
    is_available           integer not null default 1,
    unavailable_reason     text,
    created_at             text    not null default (datetime('now')),
    updated_at             text    not null default (datetime('now'))
);

create index if not exists idx_exam_packages_category
    on exam_packages (category_id);

-- A series (one paper/test) as advertised by the listing endpoint.
create table if not exists question_series (
    series_id              integer primary key,
    package_id             integer not null references exam_packages (package_id),
    series_name            text,
    series_type            text,
    -- Name-derived classification: real-paper | dated | prev-year | mock | unknown
    paper_kind             text,
    series_category        text,
    total_marks            integer,
    total_question         integer,
    total_time             integer,
    analysis_date          text,
    start_date             text,
    end_date               text,
    start_date_epoch       integer,
    max_attempted_limit    integer,
    is_free                integer,
    is_live                integer,
    is_disabled            integer,
    is_expire              integer,
    is_pause               integer,
    is_schedule            integer,
    is_buy                 integer,
    is_attempted           integer,
    attempted_count        integer,
    questions_api_url      text,
    raw_listing_json       text,          -- the series object exactly as returned
    questions_fetch_status text    not null default 'pending',
    questions_fetch_error  text,
    questions_fetched_at   text,
    raw_batch              text,
    response_sha256        text,
    response_byte_size     integer,
    created_at             text    not null default (datetime('now')),
    updated_at             text    not null default (datetime('now'))
);

create index if not exists idx_question_series_package
    on question_series (package_id);
create index if not exists idx_question_series_type
    on question_series (series_type);
create index if not exists idx_question_series_fetch_status
    on question_series (questions_fetch_status);

-- A named section within a paper (General Awareness, Reasoning, ...).
create table if not exists paper_sections (
    series_id              integer not null references question_series (series_id) on delete cascade,
    section_id             text    not null,
    section_name           text,
    series_time            text,
    is_bilingual           integer,
    is_gujrati             integer,
    is_jee_mains           integer,
    is_partial_correct     integer,
    question_count         integer,
    created_at             text    not null default (datetime('now')),
    primary key (series_id, section_id)
);

create table if not exists topics (
    topic_id               integer primary key,
    created_at             text    not null default (datetime('now'))
);

-- Normalised, queryable projection of one question. ``raw_*`` columns keep the
-- source text verbatim; no rewriting of the payload takes place.
create table if not exists questions (
    question_uid           integer primary key autoincrement,
    series_id              integer not null references question_series (series_id) on delete cascade,
    section_id             text    not null,
    source_qid             text    not null,
    topic_id               integer references topics (topic_id),
    marks                  integer,
    answer_type            text,
    answer_option_index    integer,
    raw_question_html      text,          -- question_en, verbatim
    raw_solution_html      text,          -- solution_en, verbatim
    raw_range_text         text,          -- range_en, verbatim
    raw_comprehensive_html text,          -- comprehensive_en, verbatim
    option_count           integer,
    has_question_image     integer not null default 0,
    has_option_image       integer not null default 0,
    position               integer,
    created_at             text    not null default (datetime('now')),
    unique (series_id, source_qid)
);

create index if not exists idx_questions_series on questions (series_id);
create index if not exists idx_questions_topic on questions (topic_id);
create index if not exists idx_questions_qid on questions (source_qid);

create table if not exists question_options (
    option_uid             integer primary key autoincrement,
    question_uid           integer not null references questions (question_uid) on delete cascade,
    series_id              integer not null references question_series (series_id) on delete cascade,
    option_index           integer not null,
    option_label           text,
    raw_option_html        text,          -- option_en_{n}, verbatim
    is_correct             integer not null default 0,
    has_option_image       integer not null default 0,
    created_at             text    not null default (datetime('now')),
    unique (question_uid, option_index)
);

create index if not exists idx_question_options_question
    on question_options (question_uid);

-- The API's per-option opaque tokens (q1_en..q5_en).
create table if not exists question_tokens (
    question_uid           integer not null references questions (question_uid) on delete cascade,
    option_index           integer not null,
    token_value            text,
    primary key (question_uid, option_index)
);

-- Every image URL surfaced anywhere in a question payload, kept verbatim.
create table if not exists image_assets (
    image_uid              integer primary key autoincrement,
    series_id              integer not null references question_series (series_id) on delete cascade,
    question_uid           integer references questions (question_uid) on delete cascade,
    option_uid             integer references question_options (option_uid) on delete cascade,
    language_code          text    not null default 'en',
    image_role             text    not null,
    source_field           text    not null,
    -- image_url is the value exactly as it appears in the payload, never
    -- rewritten. resolved_url is what you would actually GET.
    image_url              text    not null,
    resolved_url           text,
    -- 'absolute'      -- already a fully qualified http(s) URL
    -- 'site-relative' -- resolved against ORIGIN
    -- 'unresolvable'  -- not a URL at all (e.g. an editor's local file path
    --                    that was never uploaded); nothing to fetch
    url_kind               text    not null default 'absolute',
    local_path             text,
    is_downloaded          integer not null default 0,
    http_status            integer,
    content_type           text,
    byte_size              integer,
    fetched_at             text,
    created_at             text    not null default (datetime('now')),
    unique (series_id, source_field, image_url)
);

create index if not exists idx_image_assets_series on image_assets (series_id);
create index if not exists idx_image_assets_question on image_assets (question_uid);
create index if not exists idx_image_assets_downloaded on image_assets (is_downloaded);

-- Lossless capture of every response body, exactly as received.
create table if not exists raw_api_responses (
    raw_id                 integer primary key autoincrement,
    endpoint_kind          text    not null,
    request_url            text    not null,
    http_status            integer,
    response_body          blob    not null,   -- exact bytes off the wire
    body_sha256            text    not null,
    byte_size              integer not null,
    series_id              integer references question_series (series_id) on delete cascade,
    package_id             integer references exam_packages (package_id) on delete cascade,
    local_path             text,
    fetched_at             text    not null default (datetime('now'))
);

create index if not exists idx_raw_api_responses_series
    on raw_api_responses (series_id);
create index if not exists idx_raw_api_responses_kind
    on raw_api_responses (endpoint_kind);

create table if not exists fetch_attempts (
    log_id                 integer primary key autoincrement,
    request_url            text    not null,
    http_status            integer,
    is_successful          integer not null default 0,
    error_message          text,
    duration_ms            integer,
    attempt_number         integer,
    attempted_at           text    not null default (datetime('now'))
);

create index if not exists idx_fetch_attempts_time
    on fetch_attempts (attempted_at);
"""


def open_database(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path)
    db.row_factory = sqlite3.Row
    db.executescript(SCHEMA_SQL)
    _add_missing_columns(db)
    db.commit()
    return db


# Columns added after the first release, applied in place so an existing
# database upgrades instead of having to be rebuilt.
EXPECTED_COLUMNS: dict[str, dict[str, str]] = {
    "exam_packages": {
        "main_tab_id": "integer",
        "sub_main_tab_id": "integer",
        "child_tab_id": "integer",
        "sub_child_tab_id": "integer",
    },
    "image_assets": {
        "resolved_url": "text",
        "url_kind": "text not null default 'absolute'",
    },
    "question_series": {
        "paper_kind": "text",
        # Which raw/ batch wrote this series' JSON, for old-vs-new provenance.
        "raw_batch": "text",
    },
}


def _add_missing_columns(db: sqlite3.Connection) -> None:
    for table, columns in EXPECTED_COLUMNS.items():
        existing = {
            row["name"] for row in db.execute(f"pragma table_info({table})").fetchall()
        }
        if not existing:
            continue  # table not created yet; CREATE TABLE already has them
        for name, decl_type in columns.items():
            if name not in existing:
                db.execute(f"alter table {table} add column {name} {decl_type}")
                log(f"migrated: {table}.{name} added")
    _backfill_image_url_resolution(db)
    _backfill_paper_kind(db)


def _backfill_image_url_resolution(db: sqlite3.Connection) -> None:
    """Derive resolved_url / url_kind for image rows stored before those columns.

    Purely local: it re-runs :func:`classify_image_url` over the already stored
    verbatim URLs, so upgrading the schema never re-fetches anything.
    """
    pending = db.execute(
        "select count(*) from image_assets "
        "where resolved_url is null and url_kind = 'absolute'"
    ).fetchone()[0]
    if not pending:
        return
    log(f"backfilling image url resolution for {pending} rows")
    for row in db.execute(
        "select image_uid, image_url from image_assets where resolved_url is null"
    ).fetchall():
        url_kind, resolved_url, _note = classify_image_url(row["image_url"])
        db.execute(
            "update image_assets set resolved_url = ?, url_kind = ? where image_uid = ?",
            (resolved_url, url_kind, row["image_uid"]),
        )
    db.commit()


def _backfill_paper_kind(db: sqlite3.Connection) -> None:
    """Classify series stored before question_series.paper_kind existed.

    Purely local: re-runs :func:`classify_paper_name` over the stored verbatim
    series names, so existing rows gain a kind without re-fetching anything.
    """
    pending = db.execute(
        "select count(*) from question_series where paper_kind is null"
    ).fetchone()[0]
    if not pending:
        return
    log(f"backfilling paper_kind for {pending} rows")
    for row in db.execute(
        "select series_id, series_name from question_series where paper_kind is null"
    ).fetchall():
        db.execute(
            "update question_series set paper_kind = ? where series_id = ?",
            (classify_paper_name(row["series_name"]), row["series_id"]),
        )
    db.commit()


def store_raw_response(
    db: sqlite3.Connection,
    *,
    endpoint_kind: str,
    request_url: str,
    http_status: int,
    body: bytes,
    series_id: int | None = None,
    package_id: int | None = None,
) -> tuple[int, str, int]:
    digest = hashlib.sha256(body).hexdigest()
    cursor = db.execute(
        """
        insert into raw_api_responses
            (endpoint_kind, request_url, http_status, response_body,
             body_sha256, byte_size, series_id, package_id)
        values (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            endpoint_kind,
            request_url,
            http_status,
            body,
            digest,
            len(body),
            series_id,
            package_id,
        ),
    )
    db.commit()
    return int(cursor.lastrowid), digest, len(body)


# --------------------------------------------------------------------------- #
# Stage: discover categories + packages + series
# --------------------------------------------------------------------------- #


def parse_next_data(html: str) -> dict[str, Any]:
    match = re.search(
        r'__NEXT_DATA__" type="application/json">(.*?)</script>', html, re.DOTALL
    )
    if not match:
        raise RuntimeError("__NEXT_DATA__ payload not found in page HTML")
    return json.loads(match.group(1))


def discover_categories(
    db: sqlite3.Connection, fetcher: Fetcher
) -> tuple[list[sqlite3.Row], dict[int, dict[str, Any]]]:
    """Stage 1: read the free-mock-test index for the authoritative slug list.

    Returns the persisted category rows plus the raw per-category subcategory
    groups, so later stages do not need to re-fetch the index.
    """
    result = fetcher.get(FREE_MOCK_INDEX_URL)
    payload = parse_next_data(result.body.decode("utf-8", errors="replace"))
    subcategories = payload.get("props", {}).get("pageProps", {}).get(
        "subcategorisList"
    )
    if not isinstance(subcategories, list) or not subcategories:
        raise RuntimeError("subcategorisList missing from free-mock-test index")

    store_raw_response(
        db,
        endpoint_kind="free_mock_index",
        request_url=FREE_MOCK_INDEX_URL,
        http_status=result.status,
        body=result.body,
    )

    groups: dict[int, dict[str, Any]] = {}
    for group in subcategories:
        category_id = as_int(group.get("cat_id"))
        db.execute(
            """
            insert into exam_categories
                (category_id, category_slug, category_name,
                 previous_paper_count, full_test_count)
            values (?, ?, ?, ?, ?)
            on conflict (category_id) do update set
                category_slug = excluded.category_slug,
                category_name = excluded.category_name,
                previous_paper_count = excluded.previous_paper_count,
                full_test_count = excluded.full_test_count
            """,
            (
                category_id,
                group.get("cat_slug"),
                group.get("cat_name"),
                as_int(group.get("previous")),
                as_int(group.get("full_test")),
            ),
        )
        if category_id is not None:
            groups[category_id] = group
    db.commit()

    rows = db.execute("select * from exam_categories order by category_id").fetchall()
    return rows, groups


def discover_packages(
    db: sqlite3.Connection,
    fetcher: Fetcher,
    category: sqlite3.Row,
    group: dict[str, Any],
) -> int:
    """Stage 2: resolve each subcategory slug to a package_id."""
    subcategories = group.get("categories") or []
    log(f"  {len(subcategories)} subcategory slugs for {category['category_slug']}")

    resolved = 0
    for sub in subcategories:
        slug = sub.get("category_name")
        if not slug:
            continue
        page_url = f"{ORIGIN}/user/free-mock-test/{slug}"
        label = sub.get("category_label")

        try:
            page_result = fetcher.get(page_url)
        except Exception as exc:  # noqa: BLE001 - one bad slug must not stop the run
            log(f"  ! {slug}: page fetch failed: {exc}")
            record_unavailable_package(db, category, slug, label, page_url, str(exc))
            continue

        if page_result.status != 200:
            log(f"  ! {slug}: page returned HTTP {page_result.status}")
            record_unavailable_package(
                db, category, slug, label, page_url, f"HTTP {page_result.status}"
            )
            continue

        try:
            page_props = (
                parse_next_data(page_result.body.decode("utf-8", errors="replace"))
                .get("props", {})
                .get("pageProps", {})
            )
        except Exception as exc:  # noqa: BLE001
            log(f"  ! {slug}: could not parse page payload: {exc}")
            record_unavailable_package(db, category, slug, label, page_url, str(exc))
            continue

        package = page_props.get("_packageDetail") or {}
        package_id = as_int(package.get("package_id"))
        if package_id is None:
            log(f"  ! {slug}: no _packageDetail.package_id on page")
            record_unavailable_package(
                db, category, slug, label, page_url, "no package_id on page"
            )
            continue

        # The listing endpoint is keyed on tab coordinates that the page itself
        # publishes; Tier II packages use a different main tab than Prelims.
        main_tab_id = as_int((page_props.get("defaultMainTab") or {}).get("id"))
        sub_main_tab_id = as_int((page_props.get("defaultSubMainTab") or {}).get("id"))
        child_tab_id = as_int((page_props.get("defaultChildTab") or {}).get("id"))
        sub_child_tab_id = as_int(
            (page_props.get("defaultSubChildTab") or {}).get("id")
        )
        main_tab_id = (
            DEFAULT_MAIN_TAB_ID if main_tab_id is None else main_tab_id
        )
        sub_main_tab_id = (
            DEFAULT_SUB_MAIN_TAB_ID if sub_main_tab_id is None else sub_main_tab_id
        )
        child_tab_id = (
            DEFAULT_CHILD_TAB_ID if child_tab_id is None else child_tab_id
        )
        sub_child_tab_id = (
            DEFAULT_SUB_CHILD_TAB_ID if sub_child_tab_id is None else sub_child_tab_id
        )

        # The exam_packages row must exist before raw_api_responses can
        # reference it via its foreign key.
        db.execute(
            """
            insert into exam_packages
                (package_id, category_id, package_slug, package_label,
                 package_name, package_url, main_tab_id, sub_main_tab_id,
                 child_tab_id, sub_child_tab_id, listing_api_url, is_available)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            on conflict (package_id) do update set
                category_id = excluded.category_id,
                package_slug = excluded.package_slug,
                package_label = excluded.package_label,
                package_name = excluded.package_name,
                package_url = excluded.package_url,
                main_tab_id = excluded.main_tab_id,
                sub_main_tab_id = excluded.sub_main_tab_id,
                child_tab_id = excluded.child_tab_id,
                sub_child_tab_id = excluded.sub_child_tab_id,
                listing_api_url = excluded.listing_api_url,
                is_available = 1,
                unavailable_reason = null,
                updated_at = datetime('now')
            """,
            (
                package_id,
                category["category_id"],
                slug,
                label,
                as_text(package.get("package_name")),
                page_url,
                main_tab_id,
                sub_main_tab_id,
                child_tab_id,
                sub_child_tab_id,
                build_listing_api_url(
                    package_id, main_tab_id, sub_main_tab_id, child_tab_id, sub_child_tab_id
                ),
            ),
        )
        db.commit()

        store_raw_response(
            db,
            endpoint_kind="package_page",
            request_url=page_url,
            http_status=page_result.status,
            body=page_result.body,
            package_id=package_id,
        )

        resolved += 1
        log(
            f"  + {slug} -> package_id={package_id} "
            f"tabs={main_tab_id}/{sub_main_tab_id}/{child_tab_id}/{sub_child_tab_id} "
            f"({package.get('package_name') or label})"
        )

    return resolved


def record_unavailable_package(
    db: sqlite3.Connection,
    category: sqlite3.Row,
    slug: str,
    label: str | None,
    page_url: str,
    reason: str,
) -> None:
    """Record a slug whose page could not be resolved, so gaps stay visible.

    Keyed on a synthetic negative package_id derived from the slug to avoid
    colliding with real upstream ids.
    """
    synthetic_id = -abs(int(hashlib.sha1(slug.encode()).hexdigest()[:8], 16))
    db.execute(
        """
        insert into exam_packages
            (package_id, category_id, package_slug, package_label,
             package_url, is_available, unavailable_reason)
        values (?, ?, ?, ?, ?, 0, ?)
        on conflict (package_id) do update set
            is_available = 0,
            unavailable_reason = excluded.unavailable_reason,
            updated_at = datetime('now')
        """,
        (
            synthetic_id,
            category["category_id"],
            slug,
            label,
            page_url,
            reason[:500],
        ),
    )
    db.commit()


def discover_series(
    db: sqlite3.Connection, fetcher: Fetcher, package: sqlite3.Row
) -> int:
    """Stage 3: list the collectable series inside one package."""
    listing_url = package["listing_api_url"] or build_listing_api_url(
        package["package_id"],
        package["main_tab_id"] if "main_tab_id" in package.keys() else DEFAULT_MAIN_TAB_ID,
        package["sub_main_tab_id"] if "sub_main_tab_id" in package.keys() else DEFAULT_SUB_MAIN_TAB_ID,
        package["child_tab_id"] if "child_tab_id" in package.keys() else DEFAULT_CHILD_TAB_ID,
        package["sub_child_tab_id"] if "sub_child_tab_id" in package.keys() else DEFAULT_SUB_CHILD_TAB_ID,
    )

    try:
        payload, result = fetcher.get_json(listing_url)
    except Exception as exc:  # noqa: BLE001
        log(f"  ! {package['package_slug']}: listing failed: {exc}")
        return 0

    if result.status != 200:
        log(f"  ! {package['package_slug']}: listing HTTP {result.status}")
        return 0

    store_raw_response(
        db,
        endpoint_kind="series_listing",
        request_url=listing_url,
        http_status=result.status,
        body=result.body,
        package_id=package["package_id"],
    )

    # The endpoint signals application-level failure in the body, not the status
    # line (e.g. a wrong tab id yields HTTP 200 with {"state":400}).
    if isinstance(payload, dict) and payload.get("state") not in (200, "200", None):
        log(
            f"  ! {package['package_slug']}: listing rejected "
            f"(state={payload.get('state')} msg={payload.get('msg')!r})"
        )
        return 0

    rows = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(rows, list):
        log(f"  ! {package['package_slug']}: listing payload had no data array")
        return 0

    # Accept every series type the listing returns. Whether an entry is a genuine
    # exam paper is decided by its name (paper_kind), not by TestRanking's
    # inconsistent series_type label.
    accepted_types = set(PYQ_SERIES_TYPES)
    pyq_rows = [
        r
        for r in rows
        if isinstance(r, dict) and r.get("series_type") in accepted_types
    ]

    for row in pyq_rows:
        series_id = as_int(row.get("series_id"))
        if series_id is None:
            continue
        db.execute(
            """
            insert into question_series
                (series_id, package_id, series_name, series_type, paper_kind,
                 series_category,
                 total_marks, total_question, total_time, analysis_date,
                 start_date, end_date, start_date_epoch, max_attempted_limit,
                 is_free, is_live, is_disabled, is_expire, is_pause,
                 is_schedule, is_buy, is_attempted, attempted_count,
                 questions_api_url, raw_listing_json)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (series_id) do update set
                package_id = excluded.package_id,
                series_name = excluded.series_name,
                series_type = excluded.series_type,
                paper_kind = excluded.paper_kind,
                series_category = excluded.series_category,
                total_marks = excluded.total_marks,
                total_question = excluded.total_question,
                total_time = excluded.total_time,
                analysis_date = excluded.analysis_date,
                start_date = excluded.start_date,
                end_date = excluded.end_date,
                start_date_epoch = excluded.start_date_epoch,
                max_attempted_limit = excluded.max_attempted_limit,
                is_free = excluded.is_free,
                is_live = excluded.is_live,
                is_disabled = excluded.is_disabled,
                is_expire = excluded.is_expire,
                is_pause = excluded.is_pause,
                is_schedule = excluded.is_schedule,
                is_buy = excluded.is_buy,
                is_attempted = excluded.is_attempted,
                attempted_count = excluded.attempted_count,
                questions_api_url = excluded.questions_api_url,
                raw_listing_json = excluded.raw_listing_json,
                updated_at = datetime('now')
            """,
            (
                series_id,
                package["package_id"],
                as_text(row.get("series_name")),
                as_text(row.get("series_type")),
                classify_paper_name(as_text(row.get("series_name"))),
                as_text(row.get("category")),
                as_int(row.get("total_marks")),
                as_int(row.get("total_question")),
                as_int(row.get("total_time")),
                as_text(row.get("analysis_date")),
                as_text(row.get("start_date")),
                as_text(row.get("end_date")),
                as_int(row.get("start_date_string")),
                as_int(row.get("max_attempted_limit")),
                as_bool_int(row.get("is_free")),
                as_bool_int(row.get("is_live")),
                as_bool_int(row.get("isDisabled")),
                as_bool_int(row.get("is_expire")),
                as_bool_int(row.get("is_pause")),
                as_bool_int(row.get("is_schedule")),
                as_bool_int(row.get("is_buy")),
                as_bool_int(row.get("is_attempted")),
                as_int(row.get("attempted_count")),
                QUESTIONS_API_TEMPLATE.format(series_id=series_id),
                json.dumps(row, ensure_ascii=False, sort_keys=True),
            ),
        )
    db.commit()

    kinds: dict[str, int] = {}
    for row in pyq_rows:
        kind = classify_paper_name(as_text(row.get("series_name")))
        kinds[kind] = kinds.get(kind, 0) + 1

    log(
        f"  + {package['package_slug']}: {len(pyq_rows)}/{len(rows)} series kept "
        f"({', '.join(f'{k}={v}' for k, v in sorted(kinds.items()))})"
    )
    return len(pyq_rows)


# --------------------------------------------------------------------------- #
# Stage: questions + solutions
# --------------------------------------------------------------------------- #


def iter_image_fields(obj: dict[str, Any]) -> Iterator[tuple[str, str]]:
    """Yield (source_field, image_url) for every non-empty dedicated image field.

    Schema-tolerant on purpose: any key containing 'image' whose value is a
    non-empty string is treated as an image URL, so new fields introduced by the
    upstream API are captured without a code change.

    In practice the dedicated ``*_image`` columns are usually empty for these
    papers -- see :func:`extract_img_srcs`, which is where the images actually
    live. Both are captured.
    """
    for key, value in obj.items():
        if "image" not in key.lower():
            continue
        if isinstance(value, str) and value.strip():
            yield key, value.strip()


# Matches the src of an <img> tag inside a content HTML field. The upstream
# content is authored in a rich-text editor, so this is where question and
# solution images actually appear.
IMG_SRC_RE = re.compile(
    r"""<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))""",
    re.IGNORECASE | re.DOTALL,
)


def extract_img_srcs(html: str | None) -> list[str]:
    """Return every ``<img src>`` URL in ``html``, in document order, deduped."""
    if not html:
        return []
    seen: set[str] = set()
    urls: list[str] = []
    for match in IMG_SRC_RE.finditer(html):
        url = (match.group(1) or match.group(2) or match.group(3) or "").strip()
        # Skip inline/data URIs and empty sources: nothing to fetch.
        if not url or url.lower().startswith("data:"):
            continue
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def classify_image_url(url: str) -> tuple[str, str | None, str]:
    """Classify an image reference and derive the URL to actually fetch.

    Returns ``(url_kind, resolved_url, note)``:

    ``absolute``
        Already a fully qualified http(s) URL; used as-is.
    ``site-relative``
        A root- or path-relative reference such as ``assets/uploads/x.png``.
        Resolved against the site origin. Note that some of these arrive
        without a leading slash (``assets/...`` rather than ``/assets/...``);
        they are still resolved against the origin root, which is where the
        site's own uploader writes.
    ``unresolvable``
        Not a URL at all. In practice this is an editor's own local file path
        that was pasted into the content and never uploaded, so there is
        nothing to fetch. Kept verbatim and flagged rather than discarded.
    """
    text = (url or "").strip()
    if not text:
        return "unresolvable", None, "empty reference"

    lowered = text.lower()
    if lowered.startswith(("http://", "https://")):
        return "absolute", text, ""

    # Windows drive path, e.g. C:\Users\... or C:/Users/...
    if re.match(r"^[a-zA-Z]:[\\/]", text):
        return "unresolvable", None, "local filesystem path; never uploaded"

    if text.startswith("//"):
        return "absolute", "https:" + text, "protocol-relative reference"

    if text.startswith("/"):
        return "site-relative", ORIGIN + text, ""

    # Bare relative path (no leading slash) -- resolve against the origin root.
    return "site-relative", f"{ORIGIN}/{text.lstrip('./')}", "resolved against origin root"


def image_role_for_field(source_field: str) -> str:
    """Classify an image source field into a role.

    Handles both forms: dedicated columns (``option_en_image1``) and inline
    ``<img src>`` tags discovered in content HTML (``solution_en#img0``).
    """
    lowered = source_field.lower()
    if lowered.startswith("option"):
        return "option"
    if lowered.startswith("comprehensive"):
        return "comprehensive"
    if lowered.startswith("solution"):
        return "solution"
    return "question"


def raw_json_path(series: sqlite3.Row, batch: str = BATCH_LEGACY) -> Path:
    """Byte-exact question payload path for one series.

    ``batch`` selects the sub-directory under raw/, so a later fetch run can be
    kept physically separate from the original corpus (raw/questions/) and the
    two sets stay distinguishable on disk.
    """
    directory = RAW_DIR / batch / str(series["package_id"])
    name = f"series_{series['series_id']}_{slugify(series['series_name'] or '')}.json"
    return directory / name


def persist_series_payload(
    db: sqlite3.Connection, series: sqlite3.Row, payload: Any, body: bytes
) -> tuple[int, int]:
    """Write the parsed view of one paper payload. Returns (questions, images)."""
    sections = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(sections, list):
        sections = []

    question_total = 0
    image_total = 0

    for section in sections:
        if not isinstance(section, dict):
            continue

        section_id = as_text(section.get("section_id")) or "unknown"
        all_questions = section.get("all_questions")
        if not isinstance(all_questions, dict):
            continue

        db.execute(
            """
            insert into paper_sections
                (series_id, section_id, section_name, series_time, is_bilingual,
                 is_gujrati, is_jee_mains, is_partial_correct, question_count)
            values (?, ?, ?, ?, ?, ?, ?, ?, ?)
            on conflict (series_id, section_id) do update set
                section_name = excluded.section_name,
                series_time = excluded.series_time,
                is_bilingual = excluded.is_bilingual,
                is_gujrati = excluded.is_gujrati,
                is_jee_mains = excluded.is_jee_mains,
                is_partial_correct = excluded.is_partial_correct,
                question_count = excluded.question_count
            """,
            (
                series["series_id"],
                section_id,
                as_text(section.get("section_name")),
                as_text(section.get("series_time")),
                as_bool_int(section.get("is_bi_langual")),
                as_bool_int(section.get("is_gujrati")),
                as_bool_int(section.get("is_jee_mains")),
                as_bool_int(section.get("partial_correct")),
                sum(
                    len(v)
                    for v in all_questions.values()
                    if isinstance(v, list)
                ),
            ),
        )

        for bucket in all_questions.values():
            if not isinstance(bucket, list):
                continue
            for position, question in enumerate(bucket, start=1):
                if not isinstance(question, dict):
                    continue
                q_count, i_count = persist_question(
                    db, series, section_id, position, question
                )
                question_total += q_count
                image_total += i_count

    db.commit()
    return question_total, image_total


def persist_question(
    db: sqlite3.Connection,
    series: sqlite3.Row,
    section_id: str,
    position: int,
    question: dict[str, Any],
) -> tuple[int, int]:
    source_qid = as_text(question.get("qid"))
    if source_qid is None:
        return 0, 0

    topic_id = as_int(question.get("topic_id"))
    if topic_id is not None:
        db.execute(
            "insert or ignore into topics (topic_id) values (?)", (topic_id,)
        )

    # Collect image URLs first so the question row can carry the flags.
    # Two sources: dedicated '*_image' columns, and <img src> tags embedded in
    # the English content HTML (which is where they actually live in practice).
    question_images = list(iter_image_fields(question))
    option_image_fields = [f for f, _ in question_images if f.lower().startswith("option")]

    question_html = as_text(question.get("question_en"))
    solution_html = as_text(question.get("solution_en"))
    comprehensive_html = as_text(question.get("comprehensive_en"))

    inline_images: list[tuple[str, str]] = []
    for source_field, html in (
        ("question_en", question_html),
        ("solution_en", solution_html),
        ("comprehensive_en", comprehensive_html),
    ):
        for index, url in enumerate(extract_img_srcs(html)):
            inline_images.append((f"{source_field}#img{index}", url))

    has_question_image = int(
        any(
            not f.lower().startswith("option")
            for f, _ in question_images
        )
        or any(f.startswith(("question_en#", "comprehensive_en#")) for f, _ in inline_images)
    )
    has_option_image = int(
        bool(option_image_fields)
        or any(f.startswith("option_en_image") for f, _ in question_images)
    )

    answer_index = as_int(question.get("answer_en"))

    option_indices = sorted(
        {
            as_int(k.rsplit("_", 1)[1])
            for k in question
            if k.startswith("option_en_") and as_int(k.rsplit("_", 1)[1])
        }
    )
    if not option_indices:
        option_indices = [1, 2, 3, 4, 5]

    db.execute(
        """
        insert into questions
            (series_id, section_id, source_qid, topic_id, marks, answer_type,
             answer_option_index, raw_question_html, raw_solution_html,
             raw_range_text, raw_comprehensive_html, option_count,
             has_question_image, has_option_image, position)
        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict (series_id, source_qid) do update set
            section_id = excluded.section_id,
            topic_id = excluded.topic_id,
            marks = excluded.marks,
            answer_type = excluded.answer_type,
            answer_option_index = excluded.answer_option_index,
            raw_question_html = excluded.raw_question_html,
            raw_solution_html = excluded.raw_solution_html,
            raw_range_text = excluded.raw_range_text,
            raw_comprehensive_html = excluded.raw_comprehensive_html,
            option_count = excluded.option_count,
            has_question_image = excluded.has_question_image,
            has_option_image = excluded.has_option_image,
            position = excluded.position
        """,
        (
            series["series_id"],
            section_id,
            source_qid,
            topic_id,
            as_int(question.get("marks")),
            as_text(question.get("answer_type")),
            answer_index,
            question_html,
            solution_html,
            as_text(question.get("range_en")),
            comprehensive_html,
            len(option_indices),
            has_question_image,
            has_option_image,
            position,
        ),
    )

    row = db.execute(
        "select question_uid from questions where series_id = ? and source_qid = ?",
        (series["series_id"], source_qid),
    ).fetchone()
    question_uid = int(row["question_uid"])

    # Replace child rows so re-runs stay idempotent.
    db.execute("delete from question_options where question_uid = ?", (question_uid,))
    db.execute("delete from question_tokens where question_uid = ?", (question_uid,))

    option_uids: dict[int, int] = {}
    for index in option_indices:
        raw_html = as_text(question.get(f"option_en_{index}"))
        if raw_html is None and index > 5:
            continue
        has_image = int(bool(question.get(f"option_en_image{index}")))
        db.execute(
            """
            insert into question_options
                (question_uid, series_id, option_index, option_label,
                 raw_option_html, is_correct, has_option_image)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                question_uid,
                series["series_id"],
                index,
                OPTION_LABELS.get(index),
                raw_html,
                int(answer_index == index),
                has_image,
            ),
        )
        inserted = db.execute("select last_insert_rowid() AS uid").fetchone()
        option_uids[index] = int(inserted["uid"])

    for index in range(1, 6):
        token = as_text(question.get(f"q{index}_en"))
        if token is not None:
            db.execute(
                """
                insert into question_tokens (question_uid, option_index, token_value)
                values (?, ?, ?)
                on conflict (question_uid, option_index) do update set
                    token_value = excluded.token_value
                """,
                (question_uid, index, token),
            )

    # Image assets: dedicated columns plus <img src> tags found in the English
    # content HTML. image_url is stored exactly as it appears in the payload;
    # resolved_url is the fetchable form.
    image_count = 0
    for source_field, image_url in [*question_images, *inline_images]:
        match = re.match(r"^option_en_image(\d+)$", source_field)
        option_uid = option_uids.get(as_int(match.group(1))) if match else None
        url_kind, resolved_url, _note = classify_image_url(image_url)
        db.execute(
            """
            insert into image_assets
                (series_id, question_uid, option_uid, language_code,
                 image_role, source_field, image_url, resolved_url, url_kind)
            values (?, ?, ?, 'en', ?, ?, ?, ?, ?)
            on conflict (series_id, source_field, image_url) do update set
                question_uid = excluded.question_uid,
                option_uid = excluded.option_uid,
                resolved_url = excluded.resolved_url,
                url_kind = excluded.url_kind
            """,
            (
                series["series_id"],
                question_uid,
                option_uid,
                image_role_for_field(source_field),
                source_field,
                image_url,
                resolved_url,
                url_kind,
            ),
        )
        image_count += 1

    return 1, image_count


def fetch_series_questions(
    db: sqlite3.Connection,
    fetcher: Fetcher,
    series: sqlite3.Row,
    batch: str = BATCH_LEGACY,
) -> tuple[bool, int, int]:
    url = series["questions_api_url"] or QUESTIONS_API_TEMPLATE.format(
        series_id=series["series_id"]
    )

    try:
        payload, result = fetcher.get_json(url, is_paper_endpoint=True)
    except EnglishEndpointViolation:
        raise
    except Exception as exc:  # noqa: BLE001
        db.execute(
            """
            update question_series
               set questions_fetch_status = 'failed',
                   questions_fetch_error = ?,
                   updated_at = datetime('now')
             where series_id = ?
            """,
            (str(exc)[:500], series["series_id"]),
        )
        db.commit()
        return False, 0, 0

    if result.status != 200:
        db.execute(
            """
            update question_series
               set questions_fetch_status = 'failed',
                   questions_fetch_error = ?,
                   updated_at = datetime('now')
             where series_id = ?
            """,
            (f"HTTP {result.status}", series["series_id"]),
        )
        db.commit()
        return False, 0, 0

    # Replace any prior rows for this series so re-runs are clean.
    db.execute("delete from questions where series_id = ?", (series["series_id"],))
    db.execute("delete from paper_sections where series_id = ?", (series["series_id"],))
    db.execute("delete from image_assets where series_id = ?", (series["series_id"],))
    db.execute(
        "delete from raw_api_responses where series_id = ? and endpoint_kind = 'questions'",
        (series["series_id"],),
    )

    question_count, image_count = persist_series_payload(db, series, payload, result.body)

    # Raw payload to disk, byte-identical, plus a gzip sibling for convenience.
    disk_path = raw_json_path(series, batch)
    disk_path.parent.mkdir(parents=True, exist_ok=True)
    disk_path.write_bytes(result.body)
    gz_path = disk_path.with_suffix(".json.gz")
    gz_path.write_bytes(gzip.compress(result.body, compresslevel=6))

    raw_id, digest, size = store_raw_response(
        db,
        endpoint_kind="questions",
        request_url=url,
        http_status=result.status,
        body=result.body,
        series_id=series["series_id"],
    )
    db.execute(
        "update raw_api_responses set local_path = ? where raw_id = ?",
        (str(disk_path.relative_to(REPO_ROOT)), raw_id),
    )

    db.execute(
        """
        update question_series
           set questions_fetch_status = 'fetched',
               questions_fetch_error = null,
               questions_fetched_at = datetime('now'),
               raw_batch = ?,
               response_sha256 = ?,
               response_byte_size = ?,
               updated_at = datetime('now')
         where series_id = ?
        """,
        (batch, digest, size, series["series_id"]),
    )
    db.commit()

    return True, question_count, image_count


# --------------------------------------------------------------------------- #
# Stage: images
# --------------------------------------------------------------------------- #


def download_images(
    db: sqlite3.Connection,
    fetcher: Fetcher,
    limit: int | None = None,
) -> tuple[int, int, int]:
    """Optionally download the captured image URLs to data/testranking/images/.

    Only rows with a resolvable ``resolved_url`` are attempted; references that
    are not URLs (an editor's local path, say) are counted and skipped.
    Returns (downloaded, failed, skipped_unresolvable).
    """
    sql = (
        "select * from image_assets "
        "where is_downloaded = 0 and resolved_url is not null "
        "order by image_uid"
    )
    if limit:
        sql += f" limit {int(limit)}"
    rows = db.execute(sql).fetchall()

    skipped = db.execute(
        "select count(*) from image_assets where resolved_url is null"
    ).fetchone()[0]

    downloaded = 0
    failed = 0
    for row in rows:
        base = (
            DATA_DIR
            / "images"
            / str(row["series_id"])
            / f"{slugify(row['source_field'])}_{hashlib.sha1(row['image_url'].encode()).hexdigest()[:12]}"
        )
        try:
            result = fetcher.get(row["resolved_url"])
        except Exception:  # noqa: BLE001 - a dead link must not stop the run
            db.execute(
                "update image_assets set http_status = -1, fetched_at = datetime('now') where image_uid = ?",
                (row["image_uid"],),
            )
            failed += 1
            continue

        if result.status == 200 and result.body:
            content_type = result.headers.get("content-type", "")
            suffix = ".bin"
            if "png" in content_type:
                suffix = ".png"
            elif "webp" in content_type:
                suffix = ".webp"
            elif "svg" in content_type:
                suffix = ".svg"
            elif "jpeg" in content_type or "jpg" in content_type:
                suffix = ".jpg"
            elif "gif" in content_type:
                suffix = ".gif"
            target = base.with_suffix(suffix)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(result.body)
            db.execute(
                """
                update image_assets
                   set is_downloaded = 1, local_path = ?, http_status = ?,
                       content_type = ?, byte_size = ?, fetched_at = datetime('now')
                 where image_uid = ?
                """,
                (
                    str(target.relative_to(REPO_ROOT)),
                    result.status,
                    content_type,
                    len(result.body),
                    row["image_uid"],
                ),
            )
            downloaded += 1
        else:
            db.execute(
                "update image_assets set http_status = ?, fetched_at = datetime('now') where image_uid = ?",
                (result.status, row["image_uid"]),
            )
            failed += 1

        if (downloaded + failed) % 25 == 0:
            db.commit()
    db.commit()
    return downloaded, failed, int(skipped)


# --------------------------------------------------------------------------- #
# Reporting
# --------------------------------------------------------------------------- #


def print_report(db: sqlite3.Connection) -> None:
    def scalar(sql: str, params: Sequence[Any] = ()) -> Any:
        row = db.execute(sql, tuple(params)).fetchone()
        return row[0] if row else None

    def status_count(status: str) -> Any:
        return scalar(
            "select count(*) from question_series where questions_fetch_status = ?",
            (status,),
        )

    print("\n" + "=" * 72)
    print("TESTRANKING SSC PYQ -- STORAGE REPORT")
    print("=" * 72)
    print(f"database              : {DB_PATH.relative_to(REPO_ROOT)}")
    print(f"database size         : {DB_PATH.stat().st_size / 1_048_576:.2f} MiB")
    print("-" * 72)
    print(f"raw responses stored  : {scalar('select count(*) from raw_api_responses')}")
    print(f"raw json directory    : {RAW_DIR.relative_to(REPO_ROOT)}")
    print("-" * 72)
    print(f"exam categories       : {scalar('select count(*) from exam_categories')}")
    print(f"exam packages         : {scalar('select count(*) from exam_packages')}")
    print(
        f"  unavailable slugs   : "
        f"{scalar('select count(*) from exam_packages where is_available = 0')}"
    )
    print(
        f"PYQ series discovered : "
        f"{scalar('select count(*) from question_series')}"
    )
    print(f"  fetched ok          : {status_count('fetched')}")
    print(f"  failed              : {status_count('failed')}")
    print(f"  pending             : {status_count('pending')}")
    print("-" * 72)
    print("series by paper_kind:")
    for row in db.execute(
        """
        select coalesce(paper_kind, 'unclassified') as kind,
               count(*)                                   as series,
               sum(coalesce(total_question, 0))           as listed_q
          from question_series
         group by 1
         order by series desc
        """
    ).fetchall():
        print(
            f"  {row['kind']:<14} {row['series']:>5} series  "
            f"{row['listed_q']:>7} listed questions"
        )
    print("-" * 72)
    print(f"paper sections        : {scalar('select count(*) from paper_sections')}")
    print(f"questions             : {scalar('select count(*) from questions')}")
    print(f"question options      : {scalar('select count(*) from question_options')}")
    print(f"question tokens       : {scalar('select count(*) from question_tokens')}")
    print(f"image assets (urls)   : {scalar('select count(*) from image_assets')}")
    print(
        f"  downloaded          : "
        f"{scalar('select count(*) from image_assets where is_downloaded = 1')}"
    )
    print(
        f"distinct image urls   : "
        f"{scalar('select count(distinct image_url) from image_assets')}"
    )
    print("-" * 72)
    print("fetched series by raw batch:")
    for row in db.execute(
        """
        select coalesce(raw_batch, 'unrecorded') as batch,
               count(*)                        as series,
               sum(case when questions_fetch_status = 'fetched' then 1 else 0 end) as fetched
          from question_series
         group by 1
         order by series desc
        """
    ).fetchall():
        print(
            f"  raw/{row['batch']:<24} {row['series']:>5} series  "
            f"{row['fetched']:>5} fetched"
        )
    print("-" * 72)
    print(
        f"raw bytes             : "
        f"{(scalar('select coalesce(sum(byte_size), 0) from raw_api_responses') or 0) / 1_048_576:.2f} MiB"
    )
    print(f"http attempts logged  : {scalar('select count(*) from fetch_attempts')}")
    print("-" * 72)

    image_rows = scalar("select count(*) from image_assets")
    if image_rows:
        print("\nseries carrying the most image urls:")
        for row in db.execute(
            """
            select series_id, count(*) as n
              from image_assets
             group by series_id
             order by n desc
             limit 10
            """
        ):
            print(f"  series {row['series_id']}: {row['n']} image urls")
        print("\nsample image urls:")
        for row in db.execute(
            """
            select series_id, source_field, image_url
              from image_assets
             order by image_uid
             limit 5
            """
        ):
            print(f"  [{row['source_field']}] {row['image_url']}")

    print("\npackages by series count:")
    for row in db.execute(
        """
        select p.package_slug, p.package_id, p.is_available,
               count(s.series_id) as pyq_series,
               sum(case when s.paper_kind = 'real-paper' then 1 else 0 end) as real_papers,
               sum(case when s.questions_fetch_status = 'fetched' then 1 else 0 end) as fetched
          from exam_packages p
          left join question_series s on s.package_id = p.package_id
         group by p.package_id
         order by pyq_series desc, p.package_slug
        """
    ):
        flag = "" if row["is_available"] else "  [UNAVAILABLE]"
        print(
            f"  {row['package_slug']:<40} package={row['package_id']:<8} "
            f"series={row['pyq_series']:<5} real={row['real_papers'] or 0:<5} "
            f"fetched={row['fetched'] or 0}{flag}"
        )
    print("=" * 72)


# --------------------------------------------------------------------------- #
# Orchestration
# --------------------------------------------------------------------------- #


def run_discover(
    db: sqlite3.Connection, fetcher: Fetcher, category_slugs: Sequence[str]
) -> None:
    log("stage: discover -- exam categories")
    categories, groups = discover_categories(db, fetcher)
    log(f"  found {len(categories)} categories")

    wanted = set(category_slugs)
    selected_ids: set[int] = set()
    for category in categories:
        if wanted and category["category_slug"] not in wanted:
            continue
        selected_ids.add(category["category_id"])
        log(f"  == {category['category_slug']} (category_id={category['category_id']})")
        group = groups.get(category["category_id"])
        if group is None:
            log("  no subcategory group found; skipping")
            continue
        discover_packages(db, fetcher, category, group)

    log("stage: discover -- series listings")
    if not selected_ids:
        log("  no categories selected; nothing to list")
        return
    packages = db.execute(
        """
        select * from exam_packages
         where is_available = 1
           and package_id > 0
           and category_id in (%s)
         order by package_id
        """
        % ",".join("?" for _ in selected_ids),
        tuple(sorted(selected_ids)),
    ).fetchall()
    for package in packages:
        discover_series(db, fetcher, package)

    total = db.execute("select count(*) from question_series").fetchone()[0]
    log(f"stage: discover complete -- {total} series known")


def run_questions(
    db: sqlite3.Connection,
    fetcher: Fetcher,
    limit: int | None,
    retry_failed: bool,
    batch: str = BATCH_LEGACY,
    write_manifest: bool = True,
) -> None:
    statuses = ["pending", "failed"] if retry_failed else ["pending"]
    placeholders = ",".join("?" for _ in statuses)
    type_ph = ",".join("?" for _ in PYQ_SERIES_TYPES)
    sql = (
        f"select s.*, p.package_slug from question_series s "
        f"join exam_packages p on p.package_id = s.package_id "
        f"where s.questions_fetch_status in ({placeholders}) "
        f"and s.series_type in ({type_ph}) order by s.series_id"
    )
    rows: list[sqlite3.Row] = db.execute(
        sql, (*statuses, *PYQ_SERIES_TYPES)
    ).fetchall()

    if limit:
        rows = rows[:limit]

    total = len(rows)
    log(f"stage: questions -- {total} series queued, writing JSON to raw/{batch}/")

    fetched = 0
    question_total = 0
    image_total = 0
    written: list[dict[str, Any]] = []
    for position, series in enumerate(rows, start=1):
        ok, q_count, i_count = fetch_series_questions(db, fetcher, series, batch)
        if ok:
            fetched += 1
            question_total += q_count
            image_total += i_count
            written.append(
                {
                    "series_id": series["series_id"],
                    "package_id": series["package_id"],
                    "package_slug": series["package_slug"],
                    "series_name": series["series_name"],
                    "series_type": series["series_type"],
                    "paper_kind": series["paper_kind"],
                    "questions": q_count,
                    "image_urls": i_count,
                    "json": str(
                        raw_json_path(series, batch).relative_to(REPO_ROOT)
                    ).replace("\\", "/"),
                }
            )
        if position % 10 == 0 or position == total:
            log(
                f"  [{position}/{total}] fetched={fetched} questions={question_total} "
                f"images={image_total} last=series_{series['series_id']}"
            )

    log(
        f"stage: questions complete -- {fetched} papers, "
        f"{question_total} questions, {image_total} image urls"
    )
    if write_manifest:
        _write_batch_manifest(batch, written)


def _write_batch_manifest(batch: str, written: list[dict[str, Any]]) -> None:
    """Record exactly what this run wrote, so the batch is self-describing.

    The manifest lets a reader tell the new corpus from the original one without
    consulting the database: every entry is a series fetched by *this* run into
    raw/<batch>/, and series absent from it predate the batch.
    """
    if not written:
        return

    batch_dir = RAW_DIR / batch
    batch_dir.mkdir(parents=True, exist_ok=True)

    by_kind: dict[str, int] = {}
    by_package: dict[str, int] = {}
    for item in written:
        by_kind[item["paper_kind"] or "unknown"] = (
            by_kind.get(item["paper_kind"] or "unknown", 0) + 1
        )
        by_package[item["package_slug"]] = by_package.get(item["package_slug"], 0) + 1

    manifest = {
        "batch": batch,
        "series_count": len(written),
        "question_count": sum(i["questions"] for i in written),
        "image_url_count": sum(i["image_urls"] for i in written),
        "by_paper_kind": by_kind,
        "by_package": by_package,
        "note": (
            "Series listed here were fetched by this batch and their JSON is under "
            f"raw/{batch}/. Series NOT listed here were fetched earlier and live "
            f"under raw/{BATCH_LEGACY}/."
        ),
        "series": written,
    }
    (batch_dir / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    listing = [
        f"{i['series_id']}\t{i['package_slug']}\t{i['paper_kind']}\t"
        f"{i['questions']}q\t{i['series_name']}"
        for i in written
    ]
    (batch_dir / "_series.txt").write_text("\n".join(listing) + "\n", encoding="utf-8")

    log(
        f"manifest: raw/{batch}/_manifest.json "
        f"({len(written)} series, {manifest['question_count']} questions)"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--stage",
        choices=["discover", "questions", "images", "report", "all"],
        default="all",
    )
    parser.add_argument(
        "--category",
        action="append",
        default=[],
        help="limit discovery to these category slugs (e.g. --category ssc)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="cap the number of series processed in the questions stage",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=DEFAULT_DELAY_SECONDS,
        help=f"seconds between requests (default {DEFAULT_DELAY_SECONDS})",
    )
    parser.add_argument(
        "--retry-failed",
        action="store_true",
        help="also re-attempt series previously marked failed",
    )
    parser.add_argument(
        "--download-images",
        action="store_true",
        help="also download captured image URLs to data/testranking/images/",
    )
    parser.add_argument(
        "--batch",
        default=BATCH_LEGACY,
        help=(
            "sub-directory of data/testranking/raw/ for question JSON written by "
            f"this run (default {BATCH_LEGACY!r}). Use a new name such as "
            "'2026-09-recovery' to keep a later fetch physically separate from "
            f"the original corpus in raw/{BATCH_LEGACY}/."
        ),
    )
    parser.add_argument(
        "--no-manifest",
        action="store_true",
        help="skip writing _manifest.json / _series.txt into the batch directory",
    )
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    db = open_database()
    fetcher = Fetcher(db, delay_seconds=args.delay)

    try:
        if args.stage in ("discover", "all"):
            run_discover(db, fetcher, args.category)
        if args.stage in ("questions", "all"):
            run_questions(
                db,
                fetcher,
                args.limit,
                args.retry_failed,
                batch=args.batch,
                write_manifest=not args.no_manifest,
            )

        want_images = args.download_images or args.stage in ("images", "all")
        if want_images:
            log("stage: images -- downloading captured image URLs")
            got, bad, skipped = download_images(db, fetcher, limit=args.limit)
            log(
                f"stage: images complete -- {got} downloaded, {bad} failed, "
                f"{skipped} unresolvable references skipped"
            )

        if args.stage in ("report", "all") or want_images:
            print_report(db)
    finally:
        db.close()

    return 0


if __name__ == "__main__":
    sys.exit(main())

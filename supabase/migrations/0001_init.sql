-- SARKARIPYQ core schema
-- Public read access for catalog/content tables; user-owned tables are private via RLS.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Catalog: exams, subjects, topics, papers (a specific exam sitting/shift)
-- ---------------------------------------------------------------------------

create table exams (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- e.g. 'cgl', 'chsl'
  category text not null default 'ssc',    -- e.g. 'ssc'
  name text not null,                      -- 'SSC CGL'
  full_name text,                          -- 'Combined Graduate Level Examination'
  description text,
  is_active boolean not null default true,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_exams_category on exams (category, is_active, display_order);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,               -- 'quantitative-aptitude'
  name text not null,                      -- 'Quantitative Aptitude'
  display_order int not null default 0
);

create table topics (
  id uuid primary key default gen_random_uuid(),
  subject_id uuid not null references subjects (id) on delete cascade,
  slug text not null,
  name text not null,
  display_order int not null default 0,
  unique (subject_id, slug)
);

create index idx_topics_subject on topics (subject_id);

-- A "paper" is one exam sitting: a specific exam + year + tier + shift/date.
create table papers (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references exams (id) on delete cascade,
  year int not null,
  tier text,                               -- 'Tier 1', 'Tier 2', null if not tiered
  exam_date date,
  shift text,                              -- 'Shift 1', 'Shift 2', null if unknown
  slug text not null,                      -- 'shift-1', used in URLs under /pyq/{year}/{slug}
  title text not null,                     -- 'SSC CGL 2024 Tier 1'
  question_count int not null default 0,   -- denormalized, kept in sync by trigger
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (exam_id, year, tier, slug)
);

create index idx_papers_exam_year on papers (exam_id, year desc, is_published);

-- ---------------------------------------------------------------------------
-- Questions and options
-- ---------------------------------------------------------------------------

create table questions (
  id uuid primary key default gen_random_uuid(),
  paper_id uuid not null references papers (id) on delete cascade,
  subject_id uuid not null references subjects (id),
  topic_id uuid references topics (id),
  question_number int not null,
  question_html text not null,             -- sanitized HTML; may embed LaTeX/img tags
  image_url text,
  explanation_html text,
  difficulty smallint check (difficulty between 1 and 5),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (paper_id, question_number)
);

create index idx_questions_paper on questions (paper_id, question_number);
create index idx_questions_subject on questions (subject_id);
create index idx_questions_topic on questions (topic_id);
-- Full-text search over question content.
alter table questions add column search_vector tsvector
  generated always as (to_tsvector('simple', coalesce(question_html, ''))) stored;
create index idx_questions_search on questions using gin (search_vector);

create table options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  label text not null,                     -- 'A', 'B', 'C', 'D'
  option_html text not null,
  image_url text,
  is_correct boolean not null default false,
  display_order int not null default 0,
  unique (question_id, label)
);

create index idx_options_question on options (question_id);

-- Exactly one correct option per question.
create unique index uniq_options_one_correct
  on options (question_id)
  where is_correct;

-- ---------------------------------------------------------------------------
-- User-owned data (requires auth)
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create index idx_bookmarks_user on bookmarks (user_id);

create table practice_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  question_id uuid not null references questions (id) on delete cascade,
  selected_option_id uuid references options (id),
  is_correct boolean not null,
  attempted_at timestamptz not null default now()
);

create index idx_attempts_user on practice_attempts (user_id, attempted_at desc);
create index idx_attempts_question on practice_attempts (question_id);

-- ---------------------------------------------------------------------------
-- Keep papers.question_count in sync
-- ---------------------------------------------------------------------------

create or replace function sync_paper_question_count() returns trigger as $$
begin
  update papers
    set question_count = (
      select count(*) from questions
      where paper_id = coalesce(new.paper_id, old.paper_id) and is_published
    )
    where id = coalesce(new.paper_id, old.paper_id);
  return null;
end;
$$ language plpgsql;

create trigger trg_sync_paper_question_count
after insert or update of is_published or delete on questions
for each row execute function sync_paper_question_count();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table exams enable row level security;
alter table subjects enable row level security;
alter table topics enable row level security;
alter table papers enable row level security;
alter table questions enable row level security;
alter table options enable row level security;
alter table profiles enable row level security;
alter table bookmarks enable row level security;
alter table practice_attempts enable row level security;

-- Public, read-only catalog/content access (published rows only).
create policy "public read active exams" on exams for select using (is_active);
create policy "public read subjects" on subjects for select using (true);
create policy "public read topics" on topics for select using (true);
create policy "public read published papers" on papers for select using (is_published);
create policy "public read published questions" on questions for select using (is_published);
create policy "public read options of published questions" on options for select using (
  exists (
    select 1 from questions q
    where q.id = options.question_id and q.is_published
  )
);

-- Writes to catalog/content tables happen only via the service role (import
-- pipeline), so no insert/update/delete policies are granted to anon/authenticated.

-- User-owned tables: strictly scoped to the requesting user.
create policy "profile owner read" on profiles for select using (auth.uid() = id);
create policy "profile owner upsert" on profiles for insert with check (auth.uid() = id);
create policy "profile owner update" on profiles for update using (auth.uid() = id);

create policy "bookmarks owner all" on bookmarks for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "attempts owner all" on practice_attempts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

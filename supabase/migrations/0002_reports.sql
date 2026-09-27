-- Question reports ("Report question" action). Inserts are public (reporting a
-- bad question shouldn't require an account); reads are restricted to the
-- service role so reports are only visible to the offline moderation process.

create table question_reports (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) between 1 and 500),
  created_at timestamptz not null default now()
);

create index idx_question_reports_question on question_reports (question_id);

alter table question_reports enable row level security;

create policy "anyone can submit a report" on question_reports for insert
  with check (char_length(reason) between 1 and 500);

-- No select policy: reports are readable only via the service role
-- (the offline moderation/import pipeline), never by anon/authenticated.

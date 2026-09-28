-- Five catalog lookup functions that replace an app-side pattern of
-- fetching one row per question/paper just to dedupe or count down to a
-- handful of distinct values in JS. Caught live (see AUDIT.md H4):
-- get_subjects_for_exam's old form (select subjects/papers joined on
-- questions, dedupe in JS) 57014'd on a real request for a real exam
-- ("steno") while unrelated work was being tested - it fetched every
-- published question row for that exam just to find ~5 distinct subjects.
--
-- All five push the DISTINCT/GROUP BY into Postgres instead, so only the
-- actual distinct rows cross the wire.
--
-- SECURITY INVOKER (the default - written explicitly since it's a
-- security-relevant property worth stating, not leaving implicit),
-- unlike get_leaderboard's SECURITY DEFINER. get_leaderboard needed
-- DEFINER because practice_attempts' RLS is scoped to one user's own
-- rows, and computing a cross-user ranking is impossible without
-- stepping outside that. None of that applies here: exams, subjects,
-- papers, and questions already have public, non-per-user read policies
-- (`using (is_published)` / `using (true)`) - these functions run as
-- whichever role calls them (anon/authenticated) and rely on those same
-- policies, so they can never see anything the equivalent direct query
-- couldn't already see. The explicit is_published filters below match
-- what the RLS policies already enforce - kept for clarity and to mirror
-- exactly what the JS functions filtered on before, not because RLS
-- wouldn't catch it on its own.

create or replace function get_years_for_exam(p_exam_id uuid)
returns table (year int)
language sql
security invoker
stable
as $$
  select distinct p.year
  from papers p
  where p.exam_id = p_exam_id
    and p.is_published
  order by p.year desc;
$$;

grant execute on function get_years_for_exam(uuid) to anon, authenticated;

-- Distinct non-empty tier values with at least one published paper for
-- this exam - drives whether a Tier 1/Tier 2 toggle has anything to show.
create or replace function get_exam_tiers(p_exam_id uuid)
returns table (tier text)
language sql
security invoker
stable
as $$
  select distinct p.tier
  from papers p
  where p.exam_id = p_exam_id
    and p.is_published
    and p.tier is not null
    and p.tier <> ''
  order by p.tier;
$$;

grant execute on function get_exam_tiers(uuid) to anon, authenticated;

create or replace function get_subjects_for_exam(p_exam_id uuid)
returns table (id uuid, slug text, name text, display_order int)
language sql
security invoker
stable
as $$
  select distinct s.id, s.slug, s.name, s.display_order
  from questions q
  join subjects s on s.id = q.subject_id
  join papers p on p.id = q.paper_id
  where p.exam_id = p_exam_id
    and q.is_published
  order by s.display_order;
$$;

grant execute on function get_subjects_for_exam(uuid) to anon, authenticated;

create or replace function get_years_for_subject(p_subject_id uuid)
returns table (year int)
language sql
security invoker
stable
as $$
  select distinct p.year
  from questions q
  join papers p on p.id = q.paper_id
  where q.subject_id = p_subject_id
    and q.is_published
  order by p.year desc;
$$;

grant execute on function get_years_for_subject(uuid) to anon, authenticated;

-- Not caught failing live like the others - papers is a much smaller
-- table than questions, so this is lower-risk - but it's the same
-- "fetch every row just to aggregate in JS" shape (a Map/count loop over
-- every published paper row, instead of asking Postgres to GROUP BY),
-- fixed for consistency while this migration is already touching every
-- other instance of the pattern.
create or replace function get_paper_counts_by_exam()
returns table (exam_id uuid, paper_count bigint)
language sql
security invoker
stable
as $$
  select p.exam_id, count(*) as paper_count
  from papers p
  where p.is_published
  group by p.exam_id;
$$;

grant execute on function get_paper_counts_by_exam() to anon, authenticated;

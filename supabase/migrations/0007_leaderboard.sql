-- Public leaderboard, ranked by correct answers and filterable by exam.
--
-- practice_attempts and profiles are locked to their owning user via RLS
-- ("attempts owner all" / "profile owner read" in 0001_init.sql), which is
-- correct for raw attempt data but makes a cross-user ranking impossible to
-- query directly. Rather than loosening those policies (which would expose
-- every user's individual question/option choices), these SECURITY DEFINER
-- functions return only pre-aggregated, non-sensitive rows: a name, counts,
-- and a rank. Row-level privacy on the underlying tables is untouched.

create or replace function get_leaderboard(p_exam_slug text default null, p_limit int default 50)
returns table (
  user_id uuid,
  display_name text,
  attempted bigint,
  correct bigint,
  accuracy numeric,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with scoped as (
    select pa.user_id, pa.is_correct
    from practice_attempts pa
    join questions q on q.id = pa.question_id
    join papers p on p.id = q.paper_id
    join exams e on e.id = p.exam_id
    where p_exam_slug is null or e.slug = p_exam_slug
  ),
  agg as (
    select
      scoped.user_id,
      count(*) as attempted,
      count(*) filter (where is_correct) as correct
    from scoped
    group by scoped.user_id
    having count(*) >= 5 -- filters out one-off/accidental clicks, not a "real" attempt history yet
  )
  select
    agg.user_id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      'SSC Aspirant'
    ) as display_name,
    agg.attempted,
    agg.correct,
    round(agg.correct::numeric / agg.attempted * 100, 1) as accuracy,
    rank() over (order by agg.correct desc, agg.attempted desc) as rank
  from agg
  join auth.users u on u.id = agg.user_id
  order by rank asc, agg.attempted desc
  limit p_limit;
$$;

grant execute on function get_leaderboard(text, int) to anon, authenticated;

-- Same ranking, scoped to the caller, so their position shows even when it
-- falls outside the top p_limit rows returned by get_leaderboard above.
create or replace function get_my_leaderboard_rank(p_exam_slug text default null)
returns table (
  user_id uuid,
  display_name text,
  attempted bigint,
  correct bigint,
  accuracy numeric,
  rank bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with scoped as (
    select pa.user_id, pa.is_correct
    from practice_attempts pa
    join questions q on q.id = pa.question_id
    join papers p on p.id = q.paper_id
    join exams e on e.id = p.exam_id
    where p_exam_slug is null or e.slug = p_exam_slug
  ),
  agg as (
    select
      scoped.user_id,
      count(*) as attempted,
      count(*) filter (where is_correct) as correct
    from scoped
    group by scoped.user_id
    having count(*) >= 5
  ),
  ranked as (
    select
      agg.*,
      rank() over (order by agg.correct desc, agg.attempted desc) as rnk
    from agg
  )
  select
    ranked.user_id,
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      'SSC Aspirant'
    ),
    ranked.attempted,
    ranked.correct,
    round(ranked.correct::numeric / ranked.attempted * 100, 1),
    ranked.rnk
  from ranked
  join auth.users u on u.id = ranked.user_id
  where ranked.user_id = auth.uid();
$$;

grant execute on function get_my_leaderboard_rank(text) to authenticated;

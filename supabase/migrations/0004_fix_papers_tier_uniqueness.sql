-- Bug: papers.tier is nullable, and a plain UNIQUE constraint treats NULL as
-- distinct from NULL, so (exam_id, year, tier, slug) never actually enforced
-- uniqueness for untiered exams (tier is null there). Every re-run of the
-- import pipeline for those exams inserted a fresh duplicate paper instead
-- of updating the existing one via ON CONFLICT.

-- 1. Deduplicate: within each (exam_id, year, coalesce(tier,''), slug) group,
--    keep the most complete/most recent row, drop the rest (cascades to
--    their questions/options).
with ranked as (
  select
    id,
    row_number() over (
      partition by exam_id, year, coalesce(tier, ''), slug
      order by question_count desc, created_at desc
    ) as rn
  from papers
)
delete from papers where id in (select id from ranked where rn > 1);

-- 2. Normalize tier so this can never happen again: untiered exams get ''
-- instead of null, so the existing unique constraint actually applies.
update papers set tier = '' where tier is null;
alter table papers alter column tier set default '';
alter table papers alter column tier set not null;

-- Remove the topic concept entirely. No source data ever populated topic
-- names (the import pipeline always left questions.topic_id null), and the
-- topic filter added UI complexity with nothing behind it.

drop index if exists idx_questions_topic;
alter table questions drop column if exists topic_id;
drop table if exists topics;

-- ===========================================
-- Additional Performance Indexes Migration
-- ===========================================

-- Covering index for question count queries (used by subject listing)
CREATE INDEX IF NOT EXISTS idx_questions_subject_status ON questions(subject_id, status) INCLUDE (id);

-- Composite index for the main question listing query with ordering
CREATE INDEX IF NOT EXISTS idx_questions_listing_ordered ON questions(exam_id, subject_id, year, created_at DESC, id ASC) WHERE status = 'published';

-- Faster shift + exam_date queries (used by filter options)
CREATE INDEX IF NOT EXISTS idx_questions_exam_date_shift ON questions(exam_id, exam_date, shift) WHERE status = 'published';

-- Index for topic-based queries
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic) WHERE status = 'published' AND topic IS NOT NULL AND topic <> '';

-- Composite index for year + tier + shift combination queries
CREATE INDEX IF NOT EXISTS idx_questions_year_tier_shift_combo ON questions(year, tier, shift, exam_id) WHERE status = 'published';

-- Partial index for distinct exam dates (used by shifts endpoint)
CREATE INDEX IF NOT EXISTS idx_questions_exam_date_filter ON questions(exam_id, exam_date) WHERE status = 'published' AND exam_date IS NOT NULL;

-- Index for the exams JOIN + questions count query
CREATE INDEX IF NOT EXISTS idx_questions_exam_id_status ON questions(exam_id, status);

-- Optimize the random question selection query via TABLESAMPLE
-- Note: For random question selection, use ORDER BY random() with LIMIT or
-- SELECT columns FROM questions TABLESAMPLE SYSTEM(1) WHERE status = 'published'

-- Index for user stats queries (attempts -> questions)
CREATE INDEX IF NOT EXISTS idx_attempts_question_created ON attempts(question_id, created_at DESC);

-- Composite index for sitemap generation queries
CREATE INDEX IF NOT EXISTS idx_questions_sitemap ON questions(exam_id, subject_id, year, topic) WHERE status = 'published';

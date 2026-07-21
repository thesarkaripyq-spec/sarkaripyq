-- ===========================================
-- Performance Migration: Missing Indexes
-- ===========================================

-- Composite index for stats JOIN queries (attempts -> questions -> exams/subjects)
CREATE INDEX IF NOT EXISTS idx_attempts_question_correct ON attempts(question_id, is_correct);
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_subject ON attempts(user_id, subject_id);

-- Index for question filtering by multiple columns used in practice page
CREATE INDEX IF NOT EXISTS idx_questions_exam_subject_year ON questions(exam_id, subject_id, year) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_questions_year_tier_shift ON questions(year, tier, shift) WHERE status = 'published';

-- Covering index for question listing (avoid heap lookups)
CREATE INDEX IF NOT EXISTS idx_questions_listing ON questions(exam_id, subject_id, year, tier, shift, id) WHERE status = 'published';

-- Faster DISTINCT queries for filter options
CREATE INDEX IF NOT EXISTS idx_questions_year_filter ON questions(year) WHERE status = 'published' AND year IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_tier_filter ON questions(tier) WHERE status = 'published' AND tier IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_shift_filter ON questions(shift) WHERE status = 'published' AND shift IS NOT NULL;

-- Index for search queries
CREATE INDEX IF NOT EXISTS idx_questions_search_trgm ON questions USING gin (question_text gin_trgm_ops) WHERE status = 'published';

-- Exam question count index
CREATE INDEX IF NOT EXISTS idx_questions_exam_count ON questions(exam_id) WHERE status = 'published';

-- Leaderboard refresh optimization
CREATE INDEX IF NOT EXISTS idx_attempts_user_correct_created ON attempts(user_id, is_correct, created_at DESC);

-- Subject-wise stats query
CREATE INDEX IF NOT EXISTS idx_attempts_user_question_subject ON attempts(user_id, question_id, subject_id);

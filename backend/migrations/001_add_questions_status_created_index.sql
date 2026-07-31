-- Fix slow question list loading on Vercel serverless.
-- The previous query used COUNT(*) OVER() which forced a full sequential scan
-- of all ~98k question rows (8-15s). This index lets the page query stream rows
-- in created_at order without sorting the whole table.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_questions_status_created
  ON questions (status, created_at DESC, id);

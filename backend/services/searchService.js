const { query } = require('../config/supabase');
const { logger } = require('./logger');

async function fullTextSearch(searchTerm, options = {}) {
  const {
    examId, subjectId, year, difficulty,
    page = 1, limit = 20,
  } = options;

  const sanitized = searchTerm.replace(/[^\w\s\u0900-\u097F-]/g, ' ').trim();
  if (!sanitized || sanitized.length < 2) {
    return { data: [], total: 0, page, limit };
  }

  const tsquery = sanitized.split(/\s+/).filter(Boolean).map(w => `${w}:*`).join(' & ');
  const offset = (page - 1) * limit;

  const conditions = ["q.status = 'published'"];
  const params = [tsquery, limit + 1, offset];
  let paramIdx = 4;

  if (examId) {
    conditions.push(`q.exam_id = $${paramIdx++}`);
    params.push(examId);
  }
  if (subjectId) {
    conditions.push(`q.subject_id = $${paramIdx++}`);
    params.push(subjectId);
  }
  if (year) {
    conditions.push(`q.year = $${paramIdx++}`);
    params.push(parseInt(year));
  }
  if (difficulty) {
    conditions.push(`q.difficulty = $${paramIdx++}`);
    params.push(difficulty);
  }

  const whereClause = conditions.join(' AND ');

  const dataQuery = `
    SELECT
      q.id, q.question_text, q.question_html, q.options, q.correct_answer, q.difficulty,
      q.year, q.shift, q.tier, q.topic, q.exam_id, q.subject_id,
      ts_rank(q.fts, to_tsquery('english', $1)) as rank,
      e.name as exam_name, e.slug as exam_slug, e.short_name as exam_short_name,
      s.name as subject_name, s.slug as subject_slug
    FROM questions q
    LEFT JOIN exams e ON e.id = q.exam_id
    LEFT JOIN subjects s ON s.id = q.subject_id
    WHERE q.fts @@ to_tsquery('english', $1)
    AND ${whereClause}
    ORDER BY rank DESC, q.created_at DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const dataResult = await query(dataQuery, params);
    const rows = dataResult.rows || [];
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      hasMore,
      total: hasMore ? (page * limit) + 1 : (offset + data.length),
      page,
      limit,
    };
  } catch (error) {
    logger.error(`[Search] FTS error: ${error.message}`);
    return { data: [], total: 0, page, limit, error: error.message };
  }
}

async function trigramSearch(searchTerm, options = {}) {
  const { examId, page = 1, limit = 20 } = options;

  const sanitized = searchTerm.replace(/[^\w\s\u0900-\u097F-]/g, ' ').trim();
  if (!sanitized || sanitized.length < 2) {
    return { data: [], total: 0, page, limit };
  }

  const offset = (page - 1) * limit;
  const conditions = ["q.status = 'published'"];
  const params = [sanitized, limit + 1, offset];
  let paramIdx = 4;

  if (examId) {
    conditions.push(`q.exam_id = $${paramIdx++}`);
    params.push(examId);
  }

  const whereClause = conditions.join(' AND ');

  const dataQuery = `
    SELECT
      q.id, q.question_text, q.question_html, q.options, q.correct_answer,
      q.difficulty, q.year, q.shift, q.tier, q.topic, q.exam_id, q.subject_id,
      similarity(q.question_text, $1) as sim,
      e.name as exam_name, e.slug as exam_slug, e.short_name as exam_short_name,
      s.name as subject_name, s.slug as subject_slug
    FROM questions q
    LEFT JOIN exams e ON e.id = q.exam_id
    LEFT JOIN subjects s ON s.id = q.subject_id
    WHERE q.question_text % $1
    AND ${whereClause}
    ORDER BY sim DESC
    LIMIT $2 OFFSET $3
  `;

  try {
    const dataResult = await query(dataQuery, params);
    const rows = dataResult.rows || [];
    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    return {
      data,
      hasMore,
      total: hasMore ? (page * limit) + 1 : (offset + data.length),
      page,
      limit,
    };
  } catch (error) {
    logger.error(`[Search] Trigram error: ${error.message}`);
    return { data: [], total: 0, page, limit, error: error.message };
  }
}

async function hybridSearch(searchTerm, options = {}) {
  const limit = options.limit || 20;
  const start = Date.now();

  // Fast path: only run FTS (uses GIN index, very fast).
  const ftsResults = await fullTextSearch(searchTerm, options);

  // If FTS returned enough results, skip the expensive trigram scan entirely.
  if (ftsResults.data.length >= limit || !ftsResults.hasMore) {
    return {
      data: ftsResults.data,
      total: ftsResults.total,
      hasMore: ftsResults.hasMore,
      ftCount: ftsResults.data.length,
      trigramCount: 0,
      page: ftsResults.page,
      limit,
      elapsedMs: Date.now() - start,
    };
  }

  // Fallback: run trigram only if FTS didn't fill the page.
  const trigramResults = await trigramSearch(searchTerm, options);

  const seen = new Set(ftsResults.data.map((r) => r.id));
  const merged = [...ftsResults.data];

  for (const row of trigramResults.data) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
      if (merged.length >= limit) break;
    }
  }

  return {
    data: merged,
    total: ftsResults.total + trigramResults.total,
    hasMore: ftsResults.hasMore || trigramResults.hasMore || merged.length > limit,
    ftCount: ftsResults.data.length,
    trigramCount: trigramResults.data.length,
    page: options.page || 1,
    limit,
    elapsedMs: Date.now() - start,
  };
}

async function suggestTerms(searchTerm, limit = 5) {
  const sanitized = searchTerm.replace(/[^\w\s]/g, '').trim().toLowerCase();
  if (!sanitized || sanitized.length < 2) return [];

  try {
    const result = await query(`
      SELECT word
      FROM (
        SELECT DISTINCT lower(word) as word
        FROM (
          SELECT unnest(string_to_array(lower(question_text), ' ')) as word
          FROM questions
          WHERE status = 'published'
        ) words
        WHERE length(word) > 2
      ) distinct_words
      WHERE word LIKE $1 || '%'
      ORDER BY word
      LIMIT $2
    `, [sanitized, limit]);

    return (result.rows || []).map(r => r.word);
  } catch (error) {
    logger.error(`[Search] Suggest error: ${error.message}`);
    return [];
  }
}

module.exports = { fullTextSearch, trigramSearch, hybridSearch, suggestTerms };

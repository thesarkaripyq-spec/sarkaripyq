const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { hybridSearch, suggestTerms } = require('../services/searchService');
const { get, set, buildKey, CACHE_PREFIXES } = require('../services/cacheService');
const { searchRateLimiter } = require('../middleware/rateLimiter');

function normalizeRow(row) {
  if (!row) return row;
  const { exam_name, exam_slug, exam_short_name, subject_name, subject_slug, ...rest } = row;
  return {
    ...rest,
    exam: exam_slug ? { name: exam_name, slug: exam_slug, short_name: exam_short_name } : null,
    subject: subject_slug ? { name: subject_name, slug: subject_slug } : null,
  };
}

// @route   GET /api/v1/search
// @desc    Hybrid full-text + trigram search
// @access  Public
router.get('/', [
  searchRateLimiter,
  query('q').trim().isLength({ min: 2, max: 200 }).withMessage('Search query must be 2-200 characters'),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  validate,
], asyncHandler(async (req, res) => {
  const { q, exam, subject, year, difficulty, page = 1, limit = 20 } = req.query;

  const cacheKey = buildKey(CACHE_PREFIXES.SEARCH, q, exam || '', subject || '', year || '', difficulty || '', page, limit);

  const cached = await get(cacheKey, null, 60);
  if (cached) {
    return res.json({ success: true, ...cached, cached: true });
  }

  const results = await hybridSearch(q, { examId: exam, subjectId: subject, year, difficulty, page: parseInt(page), limit: parseInt(limit) });

  const normalized = { ...results, data: (results.data || []).map(normalizeRow) };

  await set(cacheKey, normalized, 60);

  res.json({
    success: true,
    query: q,
    count: normalized.data.length,
    hasMore: !!normalized.hasMore,
    total: normalized.total,
    ftCount: normalized.ftCount,
    trigramCount: normalized.trigramCount,
    data: normalized.data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      hasMore: !!normalized.hasMore,
    },
  });
}));

// @route   GET /api/v1/search/suggest
// @desc    Search suggestions
// @access  Public
router.get('/suggest', [
  query('q').trim().isLength({ min: 2, max: 50 }).withMessage('Query must be 2-50 characters'),
  validate,
], asyncHandler(async (req, res) => {
  const { q, limit = 5 } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.SEARCH, 'suggest', q, limit);

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, query: q, suggestions: cached, cached: true });
  }

  const suggestions = await suggestTerms(q, parseInt(limit));
  await set(cacheKey, suggestions, 3600); // cache search suggestions for 1 hour

  res.json({ success: true, query: q, suggestions });
}));

module.exports = router;

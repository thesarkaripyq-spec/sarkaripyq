const express = require('express');
const router = express.Router();
const { supabase, query } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { ALLOWED_SUBJECTS } = require('../constants/subjects');
const { get, set, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

// ============ PUBLIC ROUTES ============

// @route   GET /api/subjects/allowed/list
// @desc    Get list of allowed subjects
// @access  Public
router.get('/allowed/list', asyncHandler(async (req, res) => {
  res.json({
    success: true,
    count: ALLOWED_SUBJECTS.length,
    data: ALLOWED_SUBJECTS
  });
}));

// @route   GET /api/subjects
// @desc    Get all active subjects
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { exam, limit = 50, page = 1 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const cacheKey = buildKey(CACHE_PREFIXES.SUBJECTS, exam || 'all', limit, page);
  const cached = await get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      ...cached
    });
  }

  let dbQuery = supabase.from('subjects').select('id, name, slug, description, icon, exam_id, sort_order, exam:exams(name, slug)', { count: 'exact' }).eq('is_active', true);

  if (exam) {
    // Note: if exam is a slug, we need to fetch the exam first
    const { data: examDoc } = await supabase.from('exams').select('id').eq('slug', exam).single();
    if (examDoc) {
      dbQuery = dbQuery.eq('exam_id', examDoc.id);
    } else {
      return res.json({ success: true, count: 0, data: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 }});
    }
  }

  const { data: subjects, count, error } = await dbQuery
    .order('name', { ascending: true })
    .range(skip, skip + parseInt(limit) - 1);
    
  if (error) throw error;

  res.set('Cache-Control', 'public, max-age=3600');

  const responseData = {
    count: subjects.length,
    data: subjects.map(s => ({...s, exams: s.exam ? [s.exam] : []})), // Backwards compatibility
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      pages: Math.ceil((count || 0) / parseInt(limit))
    }
  };

  await set(cacheKey, responseData, 600); // Cache active subjects for 10 minutes

  res.json({
    success: true,
    ...responseData
  });
}));

// @route   GET /api/subjects/:id/topics
// @desc    Get topics for a subject
// @access  Public
router.get('/:id/topics', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const cacheKey = buildKey(CACHE_PREFIXES.TOPICS, id);

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  // Optimized topics extraction with SQL GROUP BY instead of loading thousands of raw question rows in Express memory
  const { rows: topics } = await query(`
    SELECT topic as name, COUNT(*)::int as "questionCount"
    FROM questions
    WHERE subject_id = $1 AND status = 'published' AND topic IS NOT NULL AND topic != ''
    GROUP BY topic
    ORDER BY "questionCount" DESC
  `, [id]);

  await set(cacheKey, topics, 600); // Cache topics for 10 minutes

  res.json({
    success: true,
    data: topics
  });
}));

// @route   GET /api/subjects/:examSlug/:subjectSlug
// @desc    Get subject by slugs
// @access  Public
router.get('/:examSlug/:subjectSlug', asyncHandler(async (req, res) => {
  const { examSlug, subjectSlug } = req.params;
  const cacheKey = buildKey(CACHE_PREFIXES.SUBJECTS, examSlug, subjectSlug);

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const { data: exam, error: examError } = await supabase.from('exams').select('id, name, slug').eq('slug', examSlug).eq('is_active', true).single();
  if (examError || !exam) {
    return res.status(404).json({ success: false, message: 'Exam not found' });
  }

  const { data: subject, error: subError } = await supabase.from('subjects').select('id, name, slug, description, icon, exam_id, exam:exams(id, name, slug)').eq('slug', subjectSlug).eq('exam_id', exam.id).eq('is_active', true).single();
  if (subError || !subject) {
    return res.status(404).json({ success: false, message: 'Subject not found' });
  }

  const { rows: yearRows } = await query(`
    SELECT DISTINCT year
    FROM questions
    WHERE subject_id = $1 AND status = 'published' AND year IS NOT NULL
    ORDER BY year DESC
  `, [subject.id]);
  const years = yearRows.map(r => r.year).filter(Boolean);

  const { rows: countRows } = await query(`
    SELECT COUNT(*)::int as count
    FROM questions
    WHERE subject_id = $1 AND status = 'published'
  `, [subject.id]);
  const questionCount = countRows[0]?.count || 0;

  const subjectData = {
    ...subject,
    questionCount: questionCount,
    availableYears: years
  };

  await set(cacheKey, subjectData, 600);

  res.json({
    success: true,
    data: subjectData
  });
}));

module.exports = router;

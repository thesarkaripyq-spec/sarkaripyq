const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { supabase, query } = require('../config/supabase');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { asyncHandler } = require('../middleware/errorHandler');
const { ALLOWED_SUBJECTS } = require('../constants/subjects');
const { get, set, delPattern, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

// ============ ADMIN ROUTES (Must be before parameterized routes) ============

// @route   GET /api/subjects/admin/all
// @desc    Get all subjects including inactive (Admin)
// @access  Private/Admin
router.get('/admin/all', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { exam } = req.query;

  let dbQuery = supabase.from('subjects').select('id, name, slug, description, icon, exam_id, is_active, sort_order, created_at, exam:exams(id, name, slug, short_name)');

  if (exam) {
    dbQuery = dbQuery.eq('exam_id', exam);
  }

  const { data: subjects, error } = await dbQuery.order('created_at', { ascending: false });
  if (error) throw error;

  const subjectIds = (subjects || []).map(s => s.id);
  let countMap = {};
  if (subjectIds.length > 0) {
    const { rows: counts } = await query(`
      SELECT subject_id,
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE status = 'published')::int as published,
        COUNT(*) FILTER (WHERE status = 'draft')::int as draft
      FROM questions
      WHERE subject_id = ANY($1::uuid[])
      GROUP BY subject_id
    `, [subjectIds]);
    (counts || []).forEach(c => { countMap[c.subject_id] = c; });
  }

  const subjectsWithCounts = (subjects || []).map(subject => ({
    ...subject,
    exams: subject.exam ? [subject.exam] : [],
    stats: countMap[subject.id] || { total: 0, published: 0, draft: 0 }
  }));

  res.json({
    success: true,
    count: subjectsWithCounts.length,
    data: subjectsWithCounts
  });
}));

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

// ============ ADMIN ROUTES ============

// @route   POST /api/subjects
// @desc    Create subject (Admin)
// @access  Private/Admin
router.post('/', [
  protect,
  adminOnly,
  body('name').trim().notEmpty().withMessage('Subject name is required'),
  validate
], asyncHandler(async (req, res) => {
  const { name, description, icon, exams } = req.body;

  const allowedSubject = ALLOWED_SUBJECTS.find(s => s.name === name);
  if (!allowedSubject) {
    return res.status(400).json({ success: false, message: `Invalid subject. Allowed subjects are: ${ALLOWED_SUBJECTS.map(s => s.name).join(', ')}` });
  }

  const examId = Array.isArray(exams) && exams.length > 0 ? exams[0] : null;

  const { data: subject, error } = await supabase.from('subjects').insert({
    name: allowedSubject.name,
    slug: allowedSubject.slug,
    icon: allowedSubject.icon || null,
    exam_id: examId,
  }).select('*, exam:exams(name, slug)').single();

  if (error) throw error;

  // Invalidate subject and topic caches
  await delPattern(CACHE_PREFIXES.SUBJECTS);
  await delPattern(CACHE_PREFIXES.TOPICS);

  res.status(201).json({
    success: true,
    message: 'Subject created successfully',
    data: { ...subject, exams: subject.exam ? [subject.exam] : [] }
  });
}));

// @route   PUT /api/subjects/:id
// @desc    Update subject (Admin)
// @access  Private/Admin
router.put('/:id', [
  protect,
  adminOnly,
  validate
], asyncHandler(async (req, res) => {
  const { name, exams, ...updateData } = req.body;
  
  if (name) {
    const allowedSubject = ALLOWED_SUBJECTS.find(s => s.name === name);
    if (!allowedSubject) {
      return res.status(400).json({ success: false, message: `Invalid subject.` });
    }
    updateData.name = allowedSubject.name;
    updateData.slug = allowedSubject.slug;
  }

  if (exams && Array.isArray(exams) && exams.length > 0) {
    updateData.exam_id = exams[0];
  }

  const { data: subject, error } = await supabase.from('subjects').update(updateData).eq('id', req.params.id).select('id, name, slug, description, icon, exam_id, is_active, sort_order, exam:exams(id, name, slug)').single();

  if (error || !subject) {
    return res.status(404).json({ success: false, message: 'Subject not found' });
  }

  // Invalidate subject and topic caches
  await delPattern(CACHE_PREFIXES.SUBJECTS);
  await delPattern(CACHE_PREFIXES.TOPICS);

  res.json({
    success: true,
    message: 'Subject updated successfully',
    data: { ...subject, exams: subject.exam ? [subject.exam] : [] }
  });
}));

// @route   DELETE /api/subjects/:id
// @desc    Delete subject (Admin)
// @access  Private/Admin
router.delete('/:id', [
  protect,
  adminOnly,
  validate
], asyncHandler(async (req, res) => {
  const { count } = await supabase.from('questions').select('id', { count: 'exact', head: true }).eq('subject_id', req.params.id);
  
  if (count > 0) {
    return res.status(400).json({ success: false, message: `Cannot delete subject with ${count} associated questions` });
  }

  const { error } = await supabase.from('subjects').delete().eq('id', req.params.id);

  if (error) throw error;

  // Invalidate subject and topic caches
  await delPattern(CACHE_PREFIXES.SUBJECTS);
  await delPattern(CACHE_PREFIXES.TOPICS);

  res.json({
    success: true,
    message: 'Subject deleted successfully'
  });
}));

module.exports = router;

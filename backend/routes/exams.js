const express = require('express');
const router = express.Router();
const { body, param } = require('express-validator');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { supabase, supabaseAdmin, query } = require('../config/supabase');
const { protect, adminOnly } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { get, set, delPattern, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

function parseShiftParam(shift) {
  if (!shift) return { shiftName: null, examDate: null };
  if (shift.includes('_')) {
    const parts = shift.split('_');
    return {
      examDate: parts[0],
      shiftName: parts.slice(1).join('_')
    };
  }
  return { shiftName: shift, examDate: null };
}
// @route   GET /api/v1/exams
// @desc    Get all active exams
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const { limit = 50 } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.EXAMS, limit);
  
  const cached = await get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      count: cached.length,
      data: cached
    });
  }

  const { data: exams, error } = await supabase
    .from('exams')
    .select('id, name, slug, short_name, description, icon, cover_image, is_active, is_popular, sort_order, total_questions')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(parseInt(limit));

  if (error) throw error;

  // Single bulk SQL query for all question counts instead of N+1 Supabase network calls
  const examIds = (exams || []).map(e => e.id);
  let countMap = {};
  if (examIds.length > 0) {
    const { rows: counts } = await query(`
      SELECT exam_id, COUNT(*)::int as count
      FROM questions
      WHERE status = 'published' AND exam_id = ANY($1::uuid[])
      GROUP BY exam_id
    `, [examIds]);
    
    (counts || []).forEach(c => {
      countMap[c.exam_id] = c.count;
    });
  }

  const examsWithCounts = (exams || []).map(exam => ({
    ...exam,
    questionCount: countMap[exam.id] || exam.total_questions || 0
  }));

  await set(cacheKey, examsWithCounts, 600); // Cache active exams for 10 minutes

  res.json({
    success: true,
    count: examsWithCounts.length,
    data: examsWithCounts
  });
}));

// @route   GET /api/v1/exams/:slug
// @desc    Get exam by slug
// @access  Public
router.get('/:slug', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const cacheKey = buildKey(CACHE_PREFIXES.EXAM, slug);

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      data: cached
    });
  }

  const { data: exam, error } = await supabase
    .from('exams')
    .select('id, name, slug, short_name, description, icon, cover_image, is_active, is_popular, sort_order, total_questions, created_at, updated_at')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !exam) {
    throw new AppError('Exam not found', 404);
  }

  const { count } = await supabase
    .from('questions')
    .select('id', { count: 'exact', head: true })
    .eq('exam_id', exam.id)
    .eq('status', 'published');

  const { rows: yearRows } = await query(`
    SELECT DISTINCT year FROM questions
    WHERE exam_id = $1 AND status = 'published' AND year IS NOT NULL
    ORDER BY year DESC
  `, [exam.id]);

  const uniqueYears = yearRows.map(r => r.year).filter(Boolean);

  const examData = {
    ...exam,
    questionCount: count || 0,
    years: uniqueYears
  };

  await set(cacheKey, examData, 600); // Cache single exam for 10 minutes

  res.json({
    success: true,
    data: examData
  });
}));

// @route   GET /api/v1/exams/:slug/subjects
// @desc    Get subjects for an exam
// @access  Public
router.get('/:slug/subjects', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { tier, year, shift } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.SUBJECTS, slug, tier || '', year || '', shift || '');

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({
      success: true,
      count: cached.length,
      data: cached
    });
  }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (examError || !exam) {
    throw new AppError('Exam not found', 404);
  }

  let sql = `
    SELECT s.id, s.name, s.slug, s.description, s.icon, s.sort_order, COUNT(q.id)::int as "questionCount"
    FROM subjects s
    INNER JOIN questions q ON q.subject_id = s.id
    WHERE s.exam_id = $1 AND s.is_active = true AND q.status = 'published'
  `;
  const params = [exam.id];
  let idx = 2;

  if (tier) {
    sql += ` AND q.tier = $${idx++}`;
    params.push(tier);
  }
  if (year) {
    sql += ` AND q.year = $${idx++}`;
    params.push(parseInt(year));
  }
  if (shift) {
    const { shiftName, examDate } = parseShiftParam(shift);
    if (examDate) {
      sql += ` AND q.exam_date = $${idx++}`;
      params.push(examDate);
    }
    if (shiftName) {
      sql += ` AND q.shift = $${idx++}`;
      params.push(shiftName);
    }
  }

  sql += ` GROUP BY s.id, s.name, s.slug, s.description, s.icon, s.sort_order ORDER BY s.sort_order ASC`;

  const { rows: subjects } = await query(sql, params);

  await set(cacheKey, subjects, 600); // Cache subjects list for 10 minutes

  res.json({
    success: true,
    count: subjects.length,
    data: subjects
  });
}));

// @route   GET /api/v1/exams/:slug/years
// @desc    Get available years for an exam
// @access  Public
router.get('/:slug/years', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { subject, tier, shift } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.YEARS, slug, subject || '', tier || '', shift || '');

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (examError || !exam) {
    throw new AppError('Exam not found', 404);
  }

  let sql = `SELECT q.year, COUNT(*)::int as "questionCount" FROM questions q`;
  const params = [exam.id];
  let idx = 2;

  if (subject) {
    sql += ` INNER JOIN subjects s ON q.subject_id = s.id`;
  }

  sql += ` WHERE q.exam_id = $1 AND q.status = 'published' AND q.year IS NOT NULL`;

  if (subject) {
    sql += ` AND s.slug = $${idx++}`;
    params.push(subject);
  }
  if (tier) {
    sql += ` AND q.tier = $${idx++}`;
    params.push(tier);
  }
  if (shift) {
    const { shiftName, examDate } = parseShiftParam(shift);
    if (examDate) {
      sql += ` AND q.exam_date = $${idx++}`;
      params.push(examDate);
    }
    if (shiftName) {
      sql += ` AND q.shift = $${idx++}`;
      params.push(shiftName);
    }
  }

  sql += ` GROUP BY q.year ORDER BY q.year DESC`;

  const { rows } = await query(sql, params);

  await set(cacheKey, rows, 600); // Cache years list for 10 minutes

  res.json({ success: true, data: rows });
}));

// @route   GET /api/v1/exams/:slug/tiers
// @desc    Get available tiers for an exam
// @access  Public
router.get('/:slug/tiers', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { subject, year, shift } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.TIERS, slug, subject || '', year || '', shift || '');

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (examError || !exam) {
    throw new AppError('Exam not found', 404);
  }

  let sql = `SELECT DISTINCT q.tier FROM questions q`;
  const params = [exam.id];
  let idx = 2;

  if (subject) {
    sql += ` INNER JOIN subjects s ON q.subject_id = s.id`;
  }

  sql += ` WHERE q.exam_id = $1 AND q.status = 'published' AND q.tier IS NOT NULL AND q.tier != ''`;

  if (subject) {
    sql += ` AND s.slug = $${idx++}`;
    params.push(subject);
  }
  if (year) {
    sql += ` AND q.year = $${idx++}`;
    params.push(parseInt(year));
  }
  if (shift) {
    const { shiftName, examDate } = parseShiftParam(shift);
    if (examDate) {
      sql += ` AND q.exam_date = $${idx++}`;
      params.push(examDate);
    }
    if (shiftName) {
      sql += ` AND q.shift = $${idx++}`;
      params.push(shiftName);
    }
  }

  sql += ` ORDER BY q.tier`;

  let tiers = [];
  try {
    const { rows } = await query(sql, params);
    tiers = rows.map(r => r.tier).filter(Boolean);
  } catch (e) {
    // tier column may not exist yet; return fallback
  }

  await set(cacheKey, tiers, 600); // Cache tiers for 10 minutes

  res.json({ success: true, data: tiers });
}));

// @route   GET /api/v1/exams/:slug/shifts
// @desc    Get available shift (date+shift) options for an exam
// @access  Public
router.get('/:slug/shifts', asyncHandler(async (req, res) => {
  const { slug } = req.params;
  const { year, subject, tier } = req.query;
  const cacheKey = buildKey(CACHE_PREFIXES.SHIFTS, slug, year || '', subject || '', tier || '');

  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const { data: exam, error: examError } = await supabase
    .from('exams')
    .select('id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (examError || !exam) {
    throw new AppError('Exam not found', 404);
  }

  let sql = `SELECT DISTINCT q.exam_date::text as exam_date, q.shift FROM questions q`;
  const params = [exam.id];
  let idx = 2;

  if (subject) {
    sql += ` INNER JOIN subjects s ON q.subject_id = s.id`;
  }

  sql += ` WHERE q.exam_id = $1 AND q.status = 'published' AND q.shift IS NOT NULL AND q.shift != '' AND q.exam_date IS NOT NULL`;

  if (year) {
    sql += ` AND q.year = $${idx++}`;
    params.push(parseInt(year));
  }
  if (subject) {
    sql += ` AND s.slug = $${idx++}`;
    params.push(subject);
  }
  if (tier) {
    sql += ` AND q.tier = $${idx++}`;
    params.push(tier);
  }
  sql += ` ORDER BY exam_date ASC, q.shift ASC`;

  const { rows } = await query(sql, params);
  const shifts = rows.map(r => {
    let shiftVal = r.shift;
    if (shiftVal && typeof shiftVal === 'object') {
      shiftVal = shiftVal.name || shiftVal.shift || String(shiftVal);
    }
    return {
      exam_date: r.exam_date,
      shift: shiftVal,
    };
  }).filter(s => s.exam_date && s.shift);

  await set(cacheKey, shifts, 600); // Cache shifts for 10 minutes

  res.json({ success: true, data: shifts });
}));

// ============ ADMIN ROUTES ============

// @route   POST /api/v1/exams
// @desc    Create exam (Admin)
// @access  Private/Admin
router.post('/', [
  protect,
  adminOnly,
  body('name').trim().notEmpty().withMessage('Exam name is required'),
  body('slug').trim().notEmpty().withMessage('Exam slug is required'),
  body('short_name').optional().trim(),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('cover_image').optional().trim(),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_popular').optional().isBoolean(),
  validate
], asyncHandler(async (req, res) => {
  const { name, slug } = req.body;
  if (!name || !slug) {
    throw new AppError('Exam name and slug are required', 400);
  }

  const { data: exam, error } = await supabaseAdmin
    .from('exams')
    .insert({
      name,
      slug,
      short_name: req.body.short_name || name,
      description: req.body.description || '',
      icon: req.body.icon || '',
      cover_image: req.body.cover_image || '',
      sort_order: req.body.sort_order || 0,
      is_popular: req.body.is_popular || false
    })
    .select()
    .single();

  if (error) throw error;

  // Invalidate exam-related caches
  await delPattern(CACHE_PREFIXES.EXAMS);
  await delPattern(CACHE_PREFIXES.EXAM);

  res.status(201).json({
    success: true,
    message: 'Exam created successfully',
    data: exam
  });
}));

// @route   PUT /api/v1/exams/:id
// @desc    Update exam (Admin)
// @access  Private/Admin
router.put('/:id', [
  protect,
  adminOnly,
  body('name').optional().trim().notEmpty(),
  body('slug').optional().trim().notEmpty(),
  body('short_name').optional().trim(),
  body('description').optional().trim(),
  body('icon').optional().trim(),
  body('cover_image').optional().trim(),
  body('sort_order').optional().isInt({ min: 0 }),
  body('is_popular').optional().isBoolean(),
  body('is_active').optional().isBoolean(),
  validate
], asyncHandler(async (req, res) => {
  const allowedFields = ['name', 'slug', 'short_name', 'description', 'icon', 'cover_image', 'sort_order', 'is_popular', 'is_active'];
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  const { data: exam, error } = await supabaseAdmin
    .from('exams')
    .update(updates)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !exam) {
    throw new AppError('Exam not found', 404);
  }

  // Invalidate exam-related caches
  await delPattern(CACHE_PREFIXES.EXAMS);
  await delPattern(CACHE_PREFIXES.EXAM);

  res.json({
    success: true,
    message: 'Exam updated successfully',
    data: exam
  });
}));

// @route   DELETE /api/v1/exams/:id
// @desc    Delete exam (Admin)
// @access  Private/Admin
router.delete('/:id', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { error } = await supabaseAdmin
    .from('exams')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;

  // Invalidate exam-related caches
  await delPattern(CACHE_PREFIXES.EXAMS);
  await delPattern(CACHE_PREFIXES.EXAM);

  res.json({
    success: true,
    message: 'Exam deleted successfully'
  });
}));

module.exports = router;

const express = require('express');
const router = express.Router();
const { body, param, query } = require('express-validator');
const { protect, optionalAuth, adminOnly } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { query: pgQuery } = require('../config/supabase');
const { get: cacheGet, set: cacheSet, delPattern: cacheDelPattern, buildKey, CACHE_PREFIXES } = require('../services/cacheService');
const { logger } = require('../services/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const IMG_SRC_REGEX = /src=["'](img_[a-zA-Z0-9_\.\-]+)["']/gi;
const IMG_URL_REGEX = /^(img_[a-zA-Z0-9_\.\-]+)$/i;
const EXTERNAL_IMG_REGEX = /<img[^>]+src=["']https?:\/\/(?!(?:[^"']*supabase)[^"']*)[^"']+["'][^>]*>/gi;

function resolveImageUrls(html, examSlug) {
  if (!html) return html;
  // First resolve local img_ references to Supabase CDN
  let result = html.replace(IMG_SRC_REGEX, (match, imgName) => {
    const cdnUrl = `${SUPABASE_URL}/storage/v1/object/public/sarkaripyq-images/questions/${examSlug}/${imgName}`;
    return `src="${cdnUrl}"`;
  });
  // Strip any remaining external image URLs (not from Supabase)
  result = result.replace(/<img[^>]+src=["'](https?:\/\/[^"']+)["'][^>]*\/?>/gi, (match, url) => {
    if (url.startsWith(SUPABASE_URL)) return match;
    return '';
  });
  return result;
}

function resolveImageUrl(url, examSlug) {
  if (!url) return '';
  if (url.startsWith('http')) {
    if (url.startsWith(SUPABASE_URL)) return url;
    return '';
  }
  const match = url.match(IMG_URL_REGEX);
  if (!match) return '';
  return `${SUPABASE_URL}/storage/v1/object/public/sarkaripyq-images/questions/${examSlug}/${match[1]}`;
}

function resolveQuestionImages(q) {
  const examSlug = q.exam?.slug || 'ssc-cgl';
  const cleanOptions = (q.options || []).filter(opt => opt.text || opt.html || opt.image);
  return {
    ...q,
    question_html: resolveImageUrls(q.question_html, examSlug),
    question_image: resolveImageUrl(q.question_image, examSlug),
    question_image_url: resolveImageUrl(q.question_image_url, examSlug),
    image_url: resolveImageUrl(q.image_url, examSlug),
    comprehensive_en: resolveImageUrls(q.comprehensive_en, examSlug),
    options: cleanOptions.map(opt => ({
      ...opt,
      text: resolveImageUrls(opt.text, examSlug),
      html: resolveImageUrls(opt.html, examSlug),
      image: resolveImageUrl(opt.image, examSlug),
    })),
    explanation: q.explanation ? {
      ...q.explanation,
      text: resolveImageUrls(q.explanation?.text, examSlug),
      html: resolveImageUrls(q.explanation?.html, examSlug),
    } : q.explanation,
  };
}

async function resolveTopics(questions) {
  if (!questions || questions.length === 0) return questions;

  const topicValues = [...new Set(questions.map(q => q.topic).filter(Boolean))];
  if (topicValues.length === 0) return questions;

  try {
    const { rows: topicRows } = await pgQuery(
      `SELECT name, slug FROM topics WHERE name = ANY($1) OR slug = ANY($1)`,
      [topicValues]
    );

    const topicMap = {};
    for (const row of topicRows) {
      topicMap[row.name.toLowerCase()] = { name: row.name, slug: row.slug };
      topicMap[row.slug.toLowerCase()] = { name: row.name, slug: row.slug };
    }

    return questions.map(q => {
      const key = q.topic?.toLowerCase();
      if (key && topicMap[key]) {
        return { ...q, topic: { ...topicMap[key] } };
      }
      return q;
    });
  } catch (err) {
    logger.error('Error resolving topics: ' + err.message, { stack: err.stack });
    return questions;
  }
}

// @route   GET /api/v1/questions
// @desc    Get published questions with filters
// @access  Public
router.get('/', [optionalAuth], asyncHandler(async (req, res) => {
  const {
    exam, subject, year, tier, shift, exam_date, topic,
    difficulty, search, batch, page = 1, limit = 20, random
  } = req.query;

  // Use memory cache for non-random questions queries to boost speed and avoid duplicate Supabase queries
  const cacheKey = buildKey(
    CACHE_PREFIXES.QUESTIONS,
    exam || '',
    subject || '',
    year || '',
    tier || '',
    shift || '',
    exam_date || '',
    topic || '',
    difficulty || '',
    search || '',
    batch || '',
    page,
    limit,
    random || ''
  );

  if (random !== 'true') {
    const cachedResponse = await cacheGet(cacheKey);
    if (cachedResponse) {
      res.set('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800');
      return res.json(cachedResponse);
    }
  }

  // Resolve slugs to IDs
  let examId, subjectId;
  if (exam) {
    const { rows } = await pgQuery('SELECT id FROM exams WHERE slug = $1 AND is_active = true LIMIT 1', [exam]);
    if (!rows.length) {
      const fallback = { success: true, count: 0, data: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } };
      if (random !== 'true') await cacheSet(cacheKey, fallback, 300);
      return res.json(fallback);
    }
    examId = rows[0].id;
  }
  if (subject) {
    const subQuery = examId
      ? 'SELECT id FROM subjects WHERE slug = $1 AND exam_id = $2 AND is_active = true LIMIT 1'
      : 'SELECT id FROM subjects WHERE slug = $1 AND is_active = true LIMIT 1';
    const subParams = examId ? [subject, examId] : [subject];
    const { rows } = await pgQuery(subQuery, subParams);
    if (!rows.length) {
      const fallback = { success: true, count: 0, data: [], pagination: { page: 1, limit: parseInt(limit), total: 0, pages: 0 } };
      if (random !== 'true') await cacheSet(cacheKey, fallback, 300);
      return res.json(fallback);
    }
    subjectId = rows[0].id;
  }

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
  const offset = (pageNum - 1) * limitNum;

  // Build WHERE clause
  const wheres = ["q.status = 'published'"];
  const params = [];
  let idx = 1;
  if (examId) { wheres.push(`q.exam_id = $${idx++}`); params.push(examId); }
  if (subjectId) { wheres.push(`q.subject_id = $${idx++}`); params.push(subjectId); }
  if (year) { wheres.push(`q.year = $${idx++}`); params.push(parseInt(year)); }
  if (shift) { wheres.push(`(q.shift = $${idx} OR q.shift->>'name' = $${idx})`); params.push(shift); idx++; }
  if (exam_date) { wheres.push(`q.exam_date = $${idx++}`); params.push(exam_date); }
  if (tier) { wheres.push(`q.tier = $${idx++}`); params.push(tier); }
  if (topic) { wheres.push(`q.topic = $${idx++}`); params.push(topic); }
  if (difficulty) { wheres.push(`q.difficulty = $${idx++}`); params.push(difficulty); }
  if (batch) { wheres.push(`q.upload_batch_id = $${idx++}`); params.push(batch); }
  const whereClause = wheres.join(' AND ');

  const COLUMNS = `q.id, q.exam_id, q.subject_id, q.question_text, q.question_html, q.options, q.correct_answer, q.explanation, q.difficulty, q.topic, q.tags, q.year, q.shift, q.exam_date, q.image_url, q.comprehensive_en, e.name as exam_name, e.slug as exam_slug, e.short_name as exam_short, s.name as subject_name, s.slug as subject_slug`;

  const { rows } = await pgQuery(
    random === 'true'
      ? `SELECT ${COLUMNS}, COUNT(*) OVER() as total_count FROM questions q JOIN exams e ON e.id = q.exam_id JOIN subjects s ON s.id = q.subject_id WHERE ${whereClause} ORDER BY random() LIMIT $${idx}`
      : `SELECT ${COLUMNS}, COUNT(*) OVER() as total_count FROM questions q JOIN exams e ON e.id = q.exam_id JOIN subjects s ON s.id = q.subject_id WHERE ${whereClause} ORDER BY q.created_at DESC, q.id ASC OFFSET ${offset} LIMIT ${limitNum}`,
    random === 'true' ? [...params, limitNum] : params
  );

  const count = rows.length > 0 ? parseInt(rows[0].total_count) : 0;

  // Map rows to expected format
  let finalData = rows.map(r => ({
    id: r.id,
    exam_id: r.exam_id,
    subject_id: r.subject_id,
    question_text: r.question_text,
    question_html: r.question_html,
    options: r.options,
    correct_answer: r.correct_answer,
    explanation: r.explanation,
    difficulty: r.difficulty,
    topic: r.topic,
    tags: r.tags,
    year: r.year,
    shift: r.shift,
    exam_date: r.exam_date,
    image_url: r.image_url,
    comprehensive_en: r.comprehensive_en,
    exam: { name: r.exam_name, slug: r.exam_slug, short_name: r.exam_short },
    subject: { name: r.subject_name, slug: r.subject_slug },
  }));

  finalData = finalData.map(resolveQuestionImages);
  finalData = await resolveTopics(finalData);

  res.set('Cache-Control', 'public, max-age=120, s-maxage=600, stale-while-revalidate=1800');

  const responseJson = {
    success: true,
    count: finalData.length,
    data: finalData,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
      pages: Math.ceil((count || 0) / limitNum)
    }
  };

  if (random !== 'true') {
    await cacheSet(cacheKey, responseJson, 300);
  }

  res.json(responseJson);
}));

// @route   GET /api/v1/questions/:id
// @desc    Get single question
// @access  Public/Private
router.get('/:id', [validate, optionalAuth], asyncHandler(async (req, res) => {
  const isUser = !req.user || req.user.role === 'user';
  const cacheKey = buildKey(CACHE_PREFIXES.QUESTION, req.params.id, isUser ? 'public' : 'admin');
  
  const cachedQuestion = await cacheGet(cacheKey);
  if (cachedQuestion) {
    return res.json(cachedQuestion);
  }

  let q = supabase
    .from('questions')
    .select('id, exam_id, subject_id, question_text, question_html, options, correct_answer, explanation, difficulty, topic, tags, year, shift, exam_date, image_url, comprehensive_en, exam:exams(name, slug, short_name), subject:subjects(name, slug)')
    .eq('id', req.params.id);

  if (isUser) {
    q = q.eq('status', 'published');
  }

  const { data: question, error } = await q.single();
  if (error || !question) {
    throw new AppError('Question not found', 404);
  }

  const resolved = await resolveTopics([resolveQuestionImages(question)]);
  const responseJson = { success: true, data: resolved[0] };
  
  await cacheSet(cacheKey, responseJson, 600);

  res.json(responseJson);
}));

// @route   POST /api/v1/questions/:id/attempt
// @desc    Submit answer for a question
// @access  Private
router.post('/:id/attempt', protect, asyncHandler(async (req, res) => {
  const { selectedAnswer, timeSpent = 0, sessionId } = req.body;

  const { data: question, error: qError } = await supabase
    .from('questions')
    .select('id, correct_answer, explanation, exam_id, subject_id')
    .eq('id', req.params.id)
    .eq('status', 'published')
    .single();

  if (qError || !question) {
    throw new AppError('Question not found', 404);
  }

  const isCorrect = selectedAnswer === question.correct_answer;

  const result = await supabaseAdmin
    .from('attempts')
    .insert({
      user_id: req.user.id,
      question_id: question.id,
      exam_id: question.exam_id,
      subject_id: question.subject_id,
      selected_answer: selectedAnswer,
      correct_answer: question.correct_answer,
      is_correct: isCorrect,
      time_spent: timeSpent,
      session_id: sessionId || null
    });

  if (result.error) {
    logger.error('Error saving attempt in database: ' + (result.error.message || JSON.stringify(result.error)));
    throw new AppError('Failed to save attempt: ' + result.error.message, 500);
  }

  res.json({
    success: true,
    data: {
      correct: isCorrect,
      correctAnswer: question.correct_answer,
      explanation: question.explanation
    }
  });
}));

// ============ ADMIN ROUTES ============

// @route   GET /api/v1/questions/admin/all
// @desc    Get all questions (Admin)
// @access  Private/Admin
router.get('/admin/all', [protect, adminOnly], asyncHandler(async (req, res) => {
  const {
    exam, subject, year, shift, status,
    batch, tier, page = 1, limit = 50, search
  } = req.query;

  let q = supabase
    .from('questions')
    .select('*, exam:exams(name, short_name), subject:subjects(name)', { count: 'exact' });

  if (exam) {
    const { data: examDoc } = await supabase.from('exams').select('id').eq('slug', exam).single();
    if (examDoc) q = q.eq('exam_id', examDoc.id);
  }
  if (subject) {
    const { data: subDoc } = await supabase.from('subjects').select('id').eq('slug', subject).single();
    if (subDoc) q = q.eq('subject_id', subDoc.id);
  }
  if (year) q = q.eq('year', parseInt(year));
  if (shift) q = q.eq('shift', shift);
  if (tier) q = q.eq('tier', tier);
  if (status && status !== 'all') q = q.eq('status', status);
  if (batch) q = q.eq('upload_batch_id', batch);
  if (search) {
    const escaped = search.replace(/[%_\\]/g, '\\$&');
    q = q.or(`question_text.ilike.%${escaped}%,question_html.ilike.%${escaped}%`);
  }

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const offset = (pageNum - 1) * limitNum;

  const { data, count, error } = await q
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .range(offset, offset + limitNum - 1);

  if (error) throw error;

  let resolvedData = (data || []).map(resolveQuestionImages);
  resolvedData = await resolveTopics(resolvedData);

  res.json({
    success: true,
    count: resolvedData.length,
    data: resolvedData,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: count || 0,
      pages: Math.ceil((count || 0) / limitNum)
    }
  });
}));

// @route   POST /api/v1/questions
// @desc    Create question (Admin)
// @access  Private/Admin
router.post('/', [
  protect, adminOnly,
  body('question_text').trim().notEmpty().withMessage('Question text is required'),
  body('options').isArray({ min: 2 }).withMessage('At least 2 options required'),
  body('correct_answer').isIn(['A', 'B', 'C', 'D', 'E']).withMessage('Valid correct answer required'),
  body('exam_id').notEmpty().withMessage('Valid exam ID required'),
  body('subject_id').notEmpty().withMessage('Valid subject ID required'),
  body('year').isInt({ min: 2000, max: 2100 }).withMessage('Valid year required'),
  validate
], asyncHandler(async (req, res) => {
  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .insert({
      question_text: req.body.question_text,
      question_html: req.body.question_html || '',
      options: req.body.options,
      correct_answer: req.body.correct_answer,
      explanation: req.body.explanation || { text: '', html: '', image: '' },
      exam_id: req.body.exam_id,
      subject_id: req.body.subject_id,
      year: parseInt(req.body.year),
      tier: req.body.tier || '',
      shift: req.body.shift || 'Shift 1',
      difficulty: req.body.difficulty || 'medium',
      status: req.body.status || 'draft',
      created_by: req.user.id
    })
    .select()
    .single();

  if (error) throw error;

  await cacheDelPattern(CACHE_PREFIXES.QUESTIONS);

  res.status(201).json({
    success: true,
    message: 'Question created successfully',
    data: question
  });
}));

// @route   PUT /api/v1/questions/:id
// @desc    Update question (Admin)
// @access  Private/Admin
router.put('/:id', [protect, adminOnly, validate], asyncHandler(async (req, res) => {
  const updateData = { ...req.body, updated_by: req.user.id };

  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !question) {
    throw new AppError('Question not found', 404);
  }

  await cacheDelPattern(CACHE_PREFIXES.QUESTIONS);
  await cacheDelPattern(buildKey(CACHE_PREFIXES.QUESTION, req.params.id));

  res.json({
    success: true,
    message: 'Question updated successfully',
    data: question
  });
}));

// @route   DELETE /api/v1/questions/:id
// @desc    Delete question (Admin)
// @access  Private/Admin
router.delete('/:id', [protect, adminOnly, validate], asyncHandler(async (req, res) => {
  const { data: question, error: fetchError } = await supabase
    .from('questions')
    .select('id')
    .eq('id', req.params.id)
    .single();

  if (fetchError || !question) {
    throw new AppError('Question not found', 404);
  }

  const { error } = await supabaseAdmin
    .from('questions')
    .delete()
    .eq('id', req.params.id);

  if (error) throw error;

  await cacheDelPattern(CACHE_PREFIXES.QUESTIONS);
  await cacheDelPattern(buildKey(CACHE_PREFIXES.QUESTION, req.params.id));

  res.json({
    success: true,
    message: 'Question deleted successfully'
  });
}));

// @route   PATCH /api/v1/questions/:id/status
// @desc    Update question status (Admin)
// @access  Private/Admin
router.patch('/:id/status', [
  protect, adminOnly,
  body('status').isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
  validate
], asyncHandler(async (req, res) => {
  const { status } = req.body;
  const updateData = { status, updated_by: req.user.id };

  if (status === 'published') {
    updateData.published_at = new Date().toISOString();
    updateData.published_by = req.user.id;
  }

  const { data: question, error } = await supabaseAdmin
    .from('questions')
    .update(updateData)
    .eq('id', req.params.id)
    .select()
    .single();

  if (error || !question) {
    throw new AppError('Question not found', 404);
  }

  await cacheDelPattern(CACHE_PREFIXES.QUESTIONS);
  await cacheDelPattern(buildKey(CACHE_PREFIXES.QUESTION, req.params.id));

  res.json({
    success: true,
    message: `Question ${status}`,
    data: question
  });
}));

// @route   POST /api/v1/questions/bulk-status
// @desc    Bulk update question status (Admin)
// @access  Private/Admin
router.post('/bulk-status', [
  protect, adminOnly,
  body('questionIds').isArray({ min: 1 }).withMessage('Question IDs required'),
  body('status').isIn(['draft', 'published', 'archived']).withMessage('Invalid status'),
  validate
], asyncHandler(async (req, res) => {
  const { questionIds, status } = req.body;
  const updateData = { status, updated_by: req.user.id };

  if (status === 'published') {
    updateData.published_at = new Date().toISOString();
    updateData.published_by = req.user.id;
  }

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update(updateData)
    .in('id', questionIds)
    .select();

  if (error) throw error;

  await cacheDelPattern(CACHE_PREFIXES.QUESTIONS);
  for (const qid of questionIds) {
    await cacheDelPattern(buildKey(CACHE_PREFIXES.QUESTION, qid));
  }

  res.json({
    success: true,
    message: `${(data || []).length} questions updated to ${status}`,
    modifiedCount: (data || []).length
  });
}));

module.exports = router;

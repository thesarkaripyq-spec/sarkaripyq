const express = require('express');
const router = express.Router();
const { body: _body, param: _param } = require('express-validator');
const { optionalAuth } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { query: pgQuery } = require('../config/supabase');
const { get: cacheGet, set: cacheSet, buildKey, CACHE_PREFIXES } = require('../services/cacheService');
const { logger } = require('../services/logger');

const SUPABASE_URL = process.env.SUPABASE_URL;
const IMG_SRC_REGEX = /src=["'](img_[a-zA-Z0-9_.-]+)["']/gi;
const IMG_URL_REGEX = /^(img_[a-zA-Z0-9_.-]+)$/i;
function resolveImageUrls(html, examSlug) {
  if (!html) return html;
  // Resolve local img_ references to Supabase CDN; leave external URLs untouched
  return html.replace(IMG_SRC_REGEX, (match, imgName) => {
    const cdnUrl = `${SUPABASE_URL}/storage/v1/object/public/sarkaripyq-images/questions/${examSlug}/${imgName}`;
    return `src="${cdnUrl}"`;
  });
}

function resolveImageUrl(url, examSlug) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
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

  const baseSelect = `FROM questions q JOIN exams e ON e.id = q.exam_id JOIN subjects s ON s.id = q.subject_id WHERE ${whereClause}`;

  const { rows } = await pgQuery(
    random === 'true'
      ? `SELECT ${COLUMNS} ${baseSelect} ORDER BY random() LIMIT $${idx}`
      : `SELECT ${COLUMNS} ${baseSelect} ORDER BY q.created_at DESC, q.id ASC OFFSET $${idx} LIMIT $${idx+1}`,
    random === 'true' ? [...params, limitNum] : [...params, offset, limitNum]
  );

  const { rows: countRows } = await pgQuery(
    `SELECT count(*)::int AS total_count FROM questions q WHERE ${whereClause}`,
    params
  );
  const count = countRows.length > 0 ? parseInt(countRows[0].total_count) : 0;

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

  const isAuthenticated = !!req.user;
  if (!isAuthenticated) {
    finalData = finalData.map(({ correct_answer: _correct_answer, ...rest }) => rest);
  }

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
  const isAuthenticated = !!req.user;
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
  const questionData = resolved[0];
  if (!isAuthenticated && questionData) {
    delete questionData.correct_answer;
  }
  const responseJson = { success: true, data: questionData };
  
  await cacheSet(cacheKey, responseJson, 600);

  res.json(responseJson);
}));

// @route   POST /api/v1/questions/:id/attempt
// @desc    Submit answer for a question
// @access  Private
router.post('/:id/attempt', optionalAuth, asyncHandler(async (req, res) => {
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

  if (req.user) {
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
    }
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

module.exports = router;

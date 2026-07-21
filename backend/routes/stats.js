const express = require('express');
const router = express.Router();
const { protect, optionalAuth } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { query } = require('../config/supabase');
const { get, set, del, buildKey, CACHE_PREFIXES } = require('../services/cacheService');
const { logger } = require('../services/logger');

let lastLeaderboardRefresh = 0;
const LEADERBOARD_REFRESH_COOLDOWN = 10 * 1000; // 10 seconds cooldown

async function throttleLeaderboardRefresh() {
  const now = Date.now();
  if (now - lastLeaderboardRefresh > LEADERBOARD_REFRESH_COOLDOWN) {
    lastLeaderboardRefresh = now;
    // Concurrently refresh the materialized view in the background
    query('REFRESH MATERIALIZED VIEW CONCURRENTLY user_leaderboard').catch((err) => {
      logger.error('Error refreshing user_leaderboard view concurrently: ' + err.message);
    });
  }
}

// @route   GET /api/stats/overview
// @desc    Get public site statistics
// @access  Public
router.get('/overview', asyncHandler(async (req, res) => {
  const cacheKey = buildKey(CACHE_PREFIXES.STATS, 'overview');
  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

    const { rows: totals } = await query(`
    SELECT 
      (SELECT count(*) FROM questions WHERE status = 'published') as "totalQuestions",
      (SELECT count(*) FROM exams WHERE is_active = true) as "totalExams",
      (SELECT count(*) FROM subjects WHERE is_active = true) as "totalSubjects"
  `);

  const { rows: popularExams } = await query(`
    SELECT e.name, e.slug, count(q.id) as count
    FROM exams e
    JOIN questions q ON q.exam_id = e.id
    WHERE q.status = 'published'
    GROUP BY e.id, e.name, e.slug
    ORDER BY count DESC
    LIMIT 5
  `);

  const overviewData = {
    totalQuestions: parseInt(totals[0].totalQuestions || 0),
    totalExams: parseInt(totals[0].totalExams || 0),
    totalSubjects: parseInt(totals[0].totalSubjects || 0),
    popularExams
  };

  await set(cacheKey, overviewData, 300); // Cache stats overview for 5 minutes

  res.json({
    success: true,
    data: overviewData
  });
}));

// @route   GET /api/stats/user
// @desc    Get user's practice statistics
// @access  Private
router.get('/user', protect, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Overall stats
  const { rows: stats } = await query(`
    WITH latest_attempts AS (
      SELECT DISTINCT ON (question_id) question_id, is_correct
      FROM attempts
      WHERE user_id = $1
      ORDER BY question_id, created_at DESC
    )
    SELECT 
      count(*) as "totalAttempts",
      sum(case when is_correct then 1 else 0 end) as "correctAnswers",
      sum(case when not is_correct then 1 else 0 end) as "wrongAnswers"
    FROM latest_attempts
  `, [userId]);

  // Examwise stats
  const { rows: examwiseStats } = await query(`
    WITH latest_attempts AS (
      SELECT DISTINCT ON (question_id) question_id, is_correct
      FROM attempts
      WHERE user_id = $1
      ORDER BY question_id, created_at DESC
    )
    SELECT 
      e.id as "examId",
      COALESCE(e.name, 'Unknown Exam') as name,
      COALESCE(e.slug, 'unknown') as slug,
      count(la.question_id) as "totalAttempts",
      sum(case when la.is_correct then 1 else 0 end) as "correctAnswers"
    FROM latest_attempts la
    JOIN questions q ON la.question_id = q.id
    LEFT JOIN exams e ON q.exam_id = e.id
    GROUP BY e.id, e.name, e.slug
  `, [userId]);

  // Recent attempts
  const { rows: recentAttempts } = await query(`
    SELECT 
      a.id,
      a.selected_answer,
      a.is_correct,
      a.created_at,
      q.question_text as "questionText",
      e.slug as "examSlug",
      s.name as "subjectName"
    FROM attempts a
    JOIN questions q ON a.question_id = q.id
    LEFT JOIN exams e ON q.exam_id = e.id
    LEFT JOIN subjects s ON q.subject_id = s.id
    WHERE a.user_id = $1
    ORDER BY a.created_at DESC
    LIMIT 10
  `, [userId]);

  // Daily progress
  const { rows: dailyProgress } = await query(`
    WITH latest_attempts AS (
      SELECT DISTINCT ON (question_id) question_id, is_correct, created_at
      FROM attempts
      WHERE user_id = $1
      ORDER BY question_id, created_at DESC
    )
    SELECT 
      TO_CHAR(created_at, 'YYYY-MM-DD') as _id,
      count(*) as total,
      sum(case when is_correct then 1 else 0 end) as correct
    FROM latest_attempts
    WHERE created_at >= NOW() - INTERVAL '7 days'
    GROUP BY TO_CHAR(created_at, 'YYYY-MM-DD')
    ORDER BY _id ASC
  `, [userId]);

  // Subject-wise performance
  const { rows: subjectPerformance } = await query(`
    WITH latest_attempts AS (
      SELECT DISTINCT ON (question_id) question_id, is_correct
      FROM attempts
      WHERE user_id = $1
      ORDER BY question_id, created_at DESC
    )
    SELECT 
      COALESCE(s.name, 'Uncategorized') as name,
      count(la.question_id) as total,
      sum(case when la.is_correct then 1 else 0 end) as correct,
      ROUND((sum(case when la.is_correct then 1 else 0 end)::numeric / nullif(count(la.question_id), 0)) * 100, 2) as accuracy
    FROM latest_attempts la
    JOIN questions q ON la.question_id = q.id
    LEFT JOIN subjects s ON q.subject_id = s.id
    GROUP BY s.id, s.name
    ORDER BY total DESC
  `, [userId]);

  // User's rank (throttled materialized view refresh to prevent high CPU overload)
  await throttleLeaderboardRefresh();
  const { rows: userRank } = await query(`
    SELECT rank FROM (
      SELECT user_id, ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM user_leaderboard
    ) sub WHERE user_id = $1
  `, [userId]);
  const { rows: totalUsers } = await query(`
    SELECT count(*) as count FROM user_leaderboard
  `);

  res.json({
    success: true,
    data: {
      overview: {
        totalAttempts: parseInt(stats[0].totalAttempts || 0),
        correctAnswers: parseInt(stats[0].correctAnswers || 0),
        wrongAnswers: parseInt(stats[0].wrongAnswers || 0),
        accuracy: parseInt(stats[0].totalAttempts || 0) > 0 
          ? ((parseInt(stats[0].correctAnswers || 0) / parseInt(stats[0].totalAttempts || 0)) * 100).toFixed(2)
          : 0
      },
      rank: userRank.length > 0 ? userRank[0].rank : null,
      totalParticipants: parseInt(totalUsers[0].count || 0),
      examwiseStats,
      recentAttempts,
      dailyProgress,
      subjectPerformance
    }
  });
}));

// @route   GET /api/stats/question/:id
// @desc    Get question statistics
// @access  Public
router.get('/question/:id', asyncHandler(async (req, res) => {
  const questionId = req.params.id;

  const { rows: qRows } = await query('SELECT id FROM questions WHERE id = $1', [questionId]);
  if (qRows.length === 0) {
    return res.status(404).json({
      success: false,
      message: 'Question not found'
    });
  }

  const { rows: stats } = await query(`
    SELECT 
      count(*) as "totalAttempts",
      sum(case when is_correct then 1 else 0 end) as "correctAttempts",
      avg(time_spent) as "averageTime"
    FROM attempts
    WHERE question_id = $1
  `, [questionId]);

  const { rows: distribution } = await query(`
    SELECT selected_answer as _id, count(*) as count
    FROM attempts
    WHERE question_id = $1
    GROUP BY selected_answer
    ORDER BY selected_answer ASC
  `, [questionId]);

  const answerDistribution = distribution.reduce((acc, item) => {
    if (item._id) acc[item._id] = parseInt(item.count || 0);
    return acc;
  }, {});

  const total = parseInt(stats[0].totalAttempts || 0);
  const correct = parseInt(stats[0].correctAttempts || 0);

  res.json({
    success: true,
    data: {
      totalAttempts: total,
      correctAttempts: correct,
      accuracyRate: total > 0 ? ((correct / total) * 100).toFixed(2) : 0,
      averageTime: parseFloat(stats[0].averageTime || 0).toFixed(2),
      answerDistribution
    }
  });
}));

// @route   GET /api/stats/leaderboard
// @desc    Get leaderboard with user's rank (optional auth)
// @access  Public (Optional Authentication)
router.get('/leaderboard', optionalAuth, asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  // Refresh the materialized view concurrently in background with a 5-minute cooling cooldown
  await throttleLeaderboardRefresh();

  // Split-cache: retrieve static leaderboard top-50 from memory
  const cacheKey = buildKey(CACHE_PREFIXES.LEADERBOARD, 'top50');
  let leaderboard = await get(cacheKey);
  if (!leaderboard) {
    const { rows } = await query(`
      SELECT 
        user_id,
        name,
        avatar,
        total_attempts,
        correct_answers,
        accuracy,
        score,
        ROW_NUMBER() OVER (ORDER BY score DESC) as rank
      FROM user_leaderboard
      ORDER BY score DESC
      LIMIT 50
    `);
    leaderboard = rows || [];
    await set(cacheKey, leaderboard, 10); // Cache leaderboard top-50 for 10 seconds
  }

  // Current user's rank and entry details (resolved dynamically in SQL via points lookup)
  let userRank = null;
  let userEntry = null;
  if (userId) {
    const { rows: entryRows } = await query(`
      SELECT user_id, name, avatar, total_attempts, correct_answers, accuracy, score, rank FROM (
        SELECT 
          user_id,
          name,
          avatar,
          total_attempts,
          correct_answers,
          accuracy,
          score,
          ROW_NUMBER() OVER (ORDER BY score DESC) as rank
        FROM user_leaderboard
      ) sub WHERE user_id = $1
    `, [userId]);
    if (entryRows.length > 0) {
      userEntry = entryRows[0];
      userRank = entryRows[0].rank;
    }
  }

  res.json({
    success: true,
    data: {
      leaderboard,
      userRank,
      userEntry,
      totalParticipants: leaderboard.length
    }
  });
}));

// @route   POST /api/stats/reset
// @desc    Reset user's score (deletes all attempts)
// @access  Private
router.post('/reset', protect, asyncHandler(async (req, res) => {
  const userId = req.user.id;

  await query('DELETE FROM attempts WHERE user_id = $1', [userId]);

  // Refresh the materialized view concurrently in background so leaderboard is updated
  query('REFRESH MATERIALIZED VIEW CONCURRENTLY user_leaderboard').catch((err) => {
    logger.error('Error refreshing user_leaderboard view concurrently on reset: ' + err.message);
  });

  // Clear top-50 leaderboard cache
  const lbCacheKey = buildKey(CACHE_PREFIXES.LEADERBOARD, 'top50');
  await del(lbCacheKey);

  res.json({
    success: true,
    message: 'Score reset successfully'
  });
}));

module.exports = router;

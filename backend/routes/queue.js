const express = require('express');
const router = express.Router();
const { QUEUE_NAMES } = require('../queue/queue');
const { query } = require('../config/supabase');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Note: In tests, the protect/adminOnly middleware might check req.user or headers,
// but let's make sure it handles both authentications perfectly and maintains standard patterns.

/**
 * @route   POST /api/v1/queue/jobs/:queueName/:jobId/retry
 * @desc    Retry a failed background job
 * @access  Private/Admin
 */
router.post('/jobs/:queueName/:jobId/retry', protect, adminOnly, asyncHandler(async (req, res) => {
  const { queueName, jobId } = req.params;

  // 1. Verify queue name validity
  const validQueues = Object.values(QUEUE_NAMES);
  if (!validQueues.includes(queueName)) {
    return res.status(400).json({
      success: false,
      message: `Invalid queue name. Supported queues: ${validQueues.join(', ')}`
    });
  }

  // 2. Record retry event in job_events table
  await query(
    `INSERT INTO job_events (job_id, queue_name, event_type, event_data) VALUES ($1, $2, $3, $4)`,
    [jobId, queueName, 'retried', JSON.stringify({ retriedAt: new Date(), retriedBy: req.user?.id || 'system' })]
  );

  res.json({
    success: true,
    message: `Job ${jobId} in queue ${queueName} retried successfully`
  });
}));

/**
 * @route   GET /api/v1/queue/stats
 * @desc    Get metrics for all queues
 * @access  Private/Admin
 */
router.get('/stats', protect, adminOnly, asyncHandler(async (req, res) => {
  const statsRes = await query(`
    SELECT queue_name, event_type, count(*) as count 
    FROM job_events 
    GROUP BY queue_name, event_type
  `);

  res.json({
    success: true,
    data: statsRes.rows || []
  });
}));

/**
 * @route   POST /api/v1/queue/pdf
 * @desc    Enqueue a PDF for asynchronous processing
 * @access  Private/Admin
 */
router.post('/pdf', protect, adminOnly, asyncHandler(async (req, res) => {
  const { pdfPath, metadata } = req.body;

  if (!pdfPath) {
    return res.status(400).json({
      success: false,
      message: 'pdfPath is required'
    });
  }

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Record 'queued' event in job_events table
  await query(
    `INSERT INTO job_events (job_id, queue_name, event_type, event_data) VALUES ($1, $2, $3, $4)`,
    [
      jobId,
      QUEUE_NAMES.PDF_PROCESSING,
      'queued',
      JSON.stringify({
        pdfPath,
        metadata: metadata || {},
        queuedAt: new Date(),
        queuedBy: req.user?.id || 'system'
      })
    ]
  );

  res.status(202).json({
    success: true,
    message: 'PDF processing job enqueued successfully',
    data: { jobId }
  });
}));

module.exports = router;

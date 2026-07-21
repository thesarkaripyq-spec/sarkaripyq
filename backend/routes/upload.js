/**
 * Upload Routes — Admin-only PDF upload, parsing, review, and publishing
 * All routes require [protect, adminOnly] authentication
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { protect, adminOnly } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { supabaseAdmin } = require('../config/supabase');
const { logger } = require('../services/logger');
const { uploadRateLimiter } = require('../middleware/rateLimiter');
const {
  extractMetadataFromFilename,
  parsePDF,
  storeDraftQuestions,
  UPLOADS_DIR
} = require('../services/parseService');
const { broadcastLog, broadcastStatus } = require('../services/websocket');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(UPLOADS_DIR)) {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    }
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || path.extname(file.originalname).toLowerCase() === '.pdf') {
      cb(null, true);
    } else {
      cb(new AppError('Only PDF files are allowed', 400));
    }
  }
});

// ============================================================
// POST /api/v1/upload/pdf — Upload one or more PDF files
// ============================================================
router.post('/pdf', [protect, adminOnly, uploadRateLimiter], upload.array('pdfs', 20), asyncHandler(async (req, res) => {
  if (!req.files || req.files.length === 0) {
    throw new AppError('No PDF files uploaded', 400);
  }

  const batches = [];

  for (const file of req.files) {
    const metadata = extractMetadataFromFilename(file.originalname);

    // Override metadata from request body if provided
    const overrides = req.body || {};
    if (overrides.exam) metadata.examSlug = overrides.exam;
    if (overrides.year) metadata.year = parseInt(overrides.year);
    if (overrides.tier) metadata.tier = overrides.tier;
    if (overrides.date) metadata.date = overrides.date;
    if (overrides.shift) metadata.shift = overrides.shift;

    // Create upload batch record
    const { data: batch, error } = await supabaseAdmin
      .from('upload_batches')
      .insert({
        file_name: file.originalname,
        pdf_path: file.path,
        exam_name: metadata.exam || overrides.examName || '',
        batch_name: `Upload ${new Date().toLocaleDateString()}`,
        year: metadata.year,
        tier: metadata.tier,
        shift: metadata.shift ? parseInt(metadata.shift.replace(/\D/g, '')) || 1 : null,
        shift_date: metadata.date ? parseDate(metadata.date) : null,
        parsing_status: 'UPLOADED',
        uploaded_by: req.user.id,
        status: 'pending',
        metadata: {
          originalName: file.originalname,
          size: file.size,
          extractedMetadata: metadata
        }
      })
      .select()
      .single();

    if (error) {
      logger.error(`Failed to create batch: ${error.message}`);
      throw new AppError('Failed to create upload batch', 500);
    }

    batches.push(batch);
    logger.info(`PDF uploaded: ${file.originalname} → Batch ${batch.id.slice(0, 8)}`);
  }

  res.status(201).json({
    success: true,
    message: `${batches.length} PDF(s) uploaded successfully`,
    data: batches
  });
}));

// ============================================================
// POST /api/v1/upload/pdf-url — Import a PDF from a URL
// ============================================================
router.post('/pdf-url', [protect, adminOnly, uploadRateLimiter], asyncHandler(async (req, res) => {
  const { url, exam, examName, year, tier, shift, date } = req.body;

  if (!url) {
    throw new AppError('PDF URL is required', 400);
  }

  // Validate URL format and scheme (prevent SSRF)
  let parsedUrl;
  try {
    parsedUrl = new URL(url);
  } catch (e) {
    throw new AppError('Invalid URL format', 400);
  }

  // SSRF protection: only allow HTTP/HTTPS schemes
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new AppError('Only HTTP and HTTPS URLs are allowed', 400);
  }

  // Block requests to private/internal IP ranges
  const hostname = parsedUrl.hostname.toLowerCase();
  const blockedPatterns = [
    'localhost', '127.0.0.1', '0.0.0.0', '::1',
    '10.', '172.16.', '172.17.', '172.18.', '172.19.',
    '172.20.', '172.21.', '172.22.', '172.23.',
    '172.24.', '172.25.', '172.26.', '172.27.',
    '172.28.', '172.29.', '172.30.', '172.31.',
    '192.168.', '169.254.', 'metadata.google.internal',
    '100.100.100.200' // Aliyun/OSS metadata
  ];
  if (blockedPatterns.some(p => hostname.startsWith(p) || hostname === p)) {
    throw new AppError('URL targeting internal networks is not allowed', 400);
  }

  // Determine a filename from the URL path, fallback if not found
  let originalName = 'downloaded_paper.pdf';
  try {
    const urlObj = new URL(url);
    const basename = path.basename(urlObj.pathname);
    if (basename && basename.toLowerCase().endsWith('.pdf')) {
      originalName = basename;
    }
  } catch (e) {
    // fallback
  }

  const uniqueName = `${Date.now()}_${originalName}`;
  const localPath = path.join(UPLOADS_DIR, uniqueName);

  const metadata = extractMetadataFromFilename(originalName);

  // Apply overrides
  const overrides = req.body || {};
  if (overrides.exam) metadata.examSlug = overrides.exam;
  if (overrides.year) metadata.year = parseInt(overrides.year);
  if (overrides.tier) metadata.tier = overrides.tier;
  if (overrides.date) metadata.date = overrides.date;
  if (overrides.shift) metadata.shift = overrides.shift;

  // Ensure uploads directory exists
  if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  }

  // Create upload batch record in DOWNLOADING status
  const { data: batch, error } = await supabaseAdmin
    .from('upload_batches')
    .insert({
      file_name: originalName,
      pdf_path: localPath,
      exam_name: metadata.exam || overrides.examName || '',
      batch_name: `URL Import ${new Date().toLocaleDateString()}`,
      year: metadata.year,
      tier: metadata.tier,
      shift: metadata.shift ? parseInt(metadata.shift.replace(/\D/g, '')) || 1 : null,
      shift_date: metadata.date ? parseDate(metadata.date) : null,
      parsing_status: 'DOWNLOADING',
      uploaded_by: req.user.id,
      status: 'pending',
      metadata: {
        originalName,
        sourceUrl: url,
        extractedMetadata: metadata
      }
    })
    .select()
    .single();

  if (error) {
    logger.error(`Failed to create URL batch: ${error.message}`);
    throw new AppError('Failed to create upload batch', 500);
  }

  logger.info(`URL batch created: ${originalName} → Batch ${batch.id.slice(0, 8)}`);

  // Respond immediately so user can watch logs
  res.status(201).json({
    success: true,
    message: 'Direct PDF download and import scheduled',
    data: batch
  });

  // Asynchronously trigger the background download and parsing execution
  setImmediate(async () => {
    const batchId = batch.id;
    const logEntry = async (level, message, details = {}) => {
      broadcastLog(batchId, level, message, details);
      try {
        await supabaseAdmin.from('parsing_logs').insert({
          batch_id: batchId,
          level,
          message,
          details
        });
      } catch (err) {
        // ignore log save errors
      }
    };

    try {
      await logEntry('info', `Initiating PDF download from URL: ${url}`);
      broadcastStatus(batchId, 'DOWNLOADING');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 300000); // 5 minute timeout

      let response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      // Enforce maximum download size (100MB)
      const contentLength = response.headers.get('content-length');
      if (contentLength && parseInt(contentLength) > 100 * 1024 * 1024) {
        throw new Error('File exceeds maximum allowed size of 100MB');
      }

      // Read response as arrayBuffer and write to file
      const buffer = Buffer.from(await response.arrayBuffer());

      if (buffer.length > 100 * 1024 * 1024) {
        // Clean up partial download
        try { fs.unlinkSync(localPath); } catch (e) { /* ignore */ }
        throw new Error('File exceeds maximum allowed size of 100MB');
      }

      fs.writeFileSync(localPath, buffer);

      const sizeMB = (buffer.length / (1024 * 1024)).toFixed(2);
      await logEntry('success', `Download completed. File saved successfully (${sizeMB} MB).`);
      
      // Update batch to UPLOADED
      await supabaseAdmin.from('upload_batches')
        .update({
          parsing_status: 'UPLOADED',
          updated_at: new Date().toISOString(),
          metadata: {
            ...batch.metadata,
            size: buffer.length
          }
        })
        .eq('id', batchId);
      
      broadcastStatus(batchId, 'UPLOADED');

      // Now start parsing automatically!
      const finalMetadata = batch.metadata?.extractedMetadata || metadata;
      if (batch.year) finalMetadata.year = batch.year;
      if (batch.tier) finalMetadata.tier = batch.tier;
      if (batch.shift) finalMetadata.shift = `Shift ${batch.shift}`;
      if (batch.shift_date) finalMetadata.date = formatDate(batch.shift_date);
      if (!finalMetadata.examSlug) finalMetadata.examSlug = 'ssc-cgl';

      await logEntry('info', `Starting automatic parsing pipeline...`);

      const result = await parsePDF(batchId, localPath, finalMetadata);

      if (result.questions && result.questions.length > 0) {
        await logEntry('info', `Storing ${result.questions.length} questions as drafts...`);
        const storeResult = await storeDraftQuestions(batchId, result.questions, finalMetadata);
        await logEntry('success', `Storage complete: ${storeResult.stored} stored, ${storeResult.skipped} skipped, ${storeResult.failed} failed`);
      }
    } catch (err) {
      logger.error(`URL Download/Parse failed for batch ${batchId}: ${err.message}`);
      await logEntry('error', `Download or Parse failed: ${err.message}`);
      
      await supabaseAdmin.from('upload_batches')
        .update({
          parsing_status: 'FAILED',
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);
      
      broadcastStatus(batchId, 'FAILED');
    }
    if (!res.headersSent) {
      await supabaseAdmin.from('upload_batches')
        .update({
          parsing_status: 'FAILED',
          status: 'rejected',
          updated_at: new Date().toISOString()
        })
        .eq('id', batchId);
      broadcastStatus(batchId, 'FAILED');
    }
  });
}));

// ============================================================
// GET /api/v1/upload/batches — List all upload batches
// ============================================================
router.get('/batches', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = supabaseAdmin
    .from('upload_batches')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + parseInt(limit) - 1);

  if (status) {
    query = query.eq('parsing_status', status);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  res.json({
    success: true,
    data: data || [],
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count || 0,
      pages: Math.ceil((count || 0) / parseInt(limit))
    }
  });
}));

// ============================================================
// GET /api/v1/upload/batches/:id — Get batch with questions
// ============================================================
router.get('/batches/:id', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { data: batch, error } = await supabaseAdmin
    .from('upload_batches')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !batch) throw new AppError('Batch not found', 404);

  // Get questions for this batch
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('*')
    .eq('upload_batch_id', req.params.id)
    .order('question_order', { ascending: true });

  res.json({
    success: true,
    data: {
      ...batch,
      questions: questions || []
    }
  });
}));

// ============================================================
// POST /api/v1/upload/batches/:id/parse — Trigger parsing
// ============================================================
router.post('/batches/:id/parse', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { data: batch, error } = await supabaseAdmin
    .from('upload_batches')
    .select('*')
    .eq('id', req.params.id)
    .single();

  if (error || !batch) throw new AppError('Batch not found', 404);

  if (!batch.pdf_path || !fs.existsSync(batch.pdf_path)) {
    throw new AppError('PDF file not found on server', 404);
  }

  // Don't re-parse if already in progress
  if (batch.parsing_status === 'PARSING' || batch.parsing_status === 'OCR_RUNNING') {
    throw new AppError('Batch is already being parsed', 409);
  }

  // Send immediate response, process in background
  res.json({
    success: true,
    message: 'Parsing started. Watch logs for progress.',
    data: { batchId: batch.id, status: 'PARSING' }
  });

  // Background processing
  const metadata = batch.metadata?.extractedMetadata || extractMetadataFromFilename(batch.file_name);
  if (batch.year) metadata.year = batch.year;
  if (batch.tier) metadata.tier = batch.tier;
  if (batch.shift) metadata.shift = `Shift ${batch.shift}`;
  if (batch.shift_date) metadata.date = formatDate(batch.shift_date);
  if (!metadata.examSlug) metadata.examSlug = 'ssc-cgl';

  try {
    const result = await parsePDF(batch.id, batch.pdf_path, metadata);

    if (result.questions && result.questions.length > 0) {
      broadcastLog(batch.id, 'info', `Storing ${result.questions.length} questions as drafts...`);
      const storeResult = await storeDraftQuestions(batch.id, result.questions, metadata);
      broadcastLog(batch.id, 'success', `Storage complete: ${storeResult.stored} stored, ${storeResult.skipped} skipped, ${storeResult.failed} failed`);
    }
  } catch (err) {
    logger.error(`Parse failed for batch ${batch.id}: ${err.message}`);
    broadcastLog(batch.id, 'error', `Parse failed: ${err.message}`);
  }
}));

// ============================================================
// PUT /api/v1/upload/batches/:id/questions/:qid — Edit question
// ============================================================
router.put('/batches/:id/questions/:qid', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { question_text, options, correct_answer, explanation, subject, topic, difficulty, review_status } = req.body;

  const updates = { updated_at: new Date().toISOString() };
  if (question_text !== undefined) updates.question_text = question_text;
  if (options !== undefined) updates.options = options;
  if (correct_answer !== undefined) updates.correct_answer = correct_answer;
  if (explanation !== undefined) updates.explanation = explanation;
  if (subject !== undefined) updates.subject = subject;
  if (topic !== undefined) updates.topic = topic;
  if (difficulty !== undefined) updates.difficulty = difficulty;
  if (review_status !== undefined) updates.review_status = review_status;

  const { data, error } = await supabaseAdmin
    .from('questions')
    .update(updates)
    .eq('id', req.params.qid)
    .eq('upload_batch_id', req.params.id)
    .select()
    .single();

  if (error || !data) throw new AppError('Question not found', 404);

  res.json({ success: true, data });
}));

// ============================================================
// POST /api/v1/upload/batches/:id/approve — Approve & publish
// ============================================================
router.post('/batches/:id/approve', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { questionIds } = req.body; // optional: specific question IDs

  let query = supabaseAdmin
    .from('questions')
    .update({
      status: 'published',
      review_status: 'approved',
      updated_at: new Date().toISOString()
    })
    .eq('upload_batch_id', req.params.id);

  if (questionIds && questionIds.length > 0) {
    query = query.in('id', questionIds);
  } else {
    // Approve all pending questions in batch
    query = query.eq('review_status', 'pending');
  }

  const { data, error } = await query.select();

  if (error) throw error;

  const approvedCount = data?.length || 0;

  // Update batch status
  await supabaseAdmin
    .from('upload_batches')
    .update({
      parsing_status: 'APPROVED',
      approved_count: approvedCount,
      status: 'completed',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id);

  broadcastStatus(req.params.id, 'APPROVED', { approvedCount });

  res.json({
    success: true,
    message: `${approvedCount} questions approved and published`,
    data: { approvedCount }
  });
}));

// ============================================================
// POST /api/v1/upload/batches/:id/publish — Publish approved
// ============================================================
router.post('/batches/:id/publish', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('questions')
    .update({
      status: 'published',
      updated_at: new Date().toISOString()
    })
    .eq('upload_batch_id', req.params.id)
    .eq('review_status', 'approved')
    .select();

  if (error) throw error;

  await supabaseAdmin
    .from('upload_batches')
    .update({
      parsing_status: 'PUBLISHED',
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id);

  broadcastStatus(req.params.id, 'PUBLISHED');

  res.json({
    success: true,
    message: `${data?.length || 0} questions published`,
    data: { publishedCount: data?.length || 0 }
  });
}));

// ============================================================
// POST /api/v1/upload/batches/:id/reject — Reject batch
// ============================================================
router.post('/batches/:id/reject', [protect, adminOnly], asyncHandler(async (req, res) => {
  // Mark all questions as rejected
  await supabaseAdmin
    .from('questions')
    .update({ review_status: 'rejected', status: 'draft' })
    .eq('upload_batch_id', req.params.id);

  await supabaseAdmin
    .from('upload_batches')
    .update({
      parsing_status: 'FAILED',
      status: 'rejected',
      updated_at: new Date().toISOString()
    })
    .eq('id', req.params.id);

  broadcastStatus(req.params.id, 'FAILED');

  res.json({ success: true, message: 'Batch rejected' });
}));

// ============================================================
// DELETE /api/v1/upload/batches/:id — Delete batch + files
// ============================================================
router.delete('/batches/:id', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { data: batch } = await supabaseAdmin
    .from('upload_batches')
    .select('pdf_path')
    .eq('id', req.params.id)
    .single();

  // Delete questions
  await supabaseAdmin.from('questions').delete().eq('upload_batch_id', req.params.id);

  // Delete logs
  await supabaseAdmin.from('parsing_logs').delete().eq('batch_id', req.params.id);

  // Delete batch record
  await supabaseAdmin.from('upload_batches').delete().eq('id', req.params.id);

  // Delete PDF file
  if (batch?.pdf_path && fs.existsSync(batch.pdf_path)) {
    try {
      fs.unlinkSync(batch.pdf_path);
      logger.info(`Deleted PDF: ${batch.pdf_path}`);
    } catch (e) {
      logger.warn(`Failed to delete PDF: ${e.message}`);
    }
  }

  res.json({ success: true, message: 'Batch and associated data deleted' });
}));

// ============================================================
// GET /api/v1/upload/batches/:id/logs — Get parsing logs
// ============================================================
router.get('/batches/:id/logs', [protect, adminOnly], asyncHandler(async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('parsing_logs')
    .select('*')
    .eq('batch_id', req.params.id)
    .order('created_at', { ascending: true })
    .limit(500);

  if (error) throw error;

  res.json({ success: true, data: data || [] });
}));

// Helper
function parseDate(dateStr) {
  if (!dateStr) return null;
  const m = String(dateStr).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return dateStr;
}

function formatDate(isoDate) {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

module.exports = router;

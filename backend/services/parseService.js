/**
 * PDF Parse Service
 * Orchestrates the Python pdf_import_pipeline.py as a child process,
 * captures output, and manages the parsing workflow.
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { supabaseAdmin } = require('../config/supabase');
const { logger } = require('./logger');
const { broadcastLog, broadcastStatus } = require('./websocket');

const PYTHON_SCRIPT = path.join(__dirname, '..', 'scripts', 'pdf_import_pipeline.py');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'pdfs');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Extract metadata from PDF filename
 * Pattern: SSC_CGL_2022_TIER1_01-12-2022_SHIFT1.pdf
 */
function extractMetadataFromFilename(filename) {
  const metadata = {
    exam: '',
    examSlug: '',
    year: null,
    tier: '',
    date: '',
    shift: ''
  };

  // Try pattern: SSC_CGL_2022_TIER1_01-12-2022_SHIFT1.pdf
  const m = filename.match(/^(SSC[_\s]*(CGL|CHSL|CPO|GD|MTS|STENO|SELECTION[_\s]*POST))[\s_]*(\d{4})[\s_]*(TIER[\s_-]*[IVX\d]+)?[\s_]*(\d{2}-\d{2}-\d{4})?[\s_]*(SHIFT[\s_]*\d+)?/i);

  if (m) {
    const examName = m[1].replace(/_/g, ' ').trim().toUpperCase();
    metadata.exam = examName;
    metadata.examSlug = examName.toLowerCase().replace(/\s+/g, '-');
    metadata.year = parseInt(m[3]);
    metadata.tier = m[4] ? m[4].replace(/_/g, ' ').replace(/TIER\s*/i, 'Tier ') : '';
    metadata.date = m[5] || '';
    metadata.shift = m[6] ? m[6].replace(/_/g, ' ').replace(/SHIFT\s*/i, 'Shift ') : '';
  }

  return metadata;
}

/**
 * Parse a PDF using the Python pipeline
 * Returns parsed questions as JSON
 */
async function parsePDF(batchId, pdfPath, metadata) {
  return new Promise((resolve, reject) => {
    const logEntry = (level, message, details = {}) => {
      broadcastLog(batchId, level, message, details);
      // Also store in DB
      supabaseAdmin.from('parsing_logs').insert({
        batch_id: batchId,
        level,
        message,
        details
      }).then(() => { }).catch(() => { });
    };

    logEntry('info', `Starting parse: ${path.basename(pdfPath)}`);
    broadcastStatus(batchId, 'PARSING');

    // Update batch status
    supabaseAdmin.from('upload_batches')
      .update({ parsing_status: 'PARSING', updated_at: new Date().toISOString() })
      .eq('id', batchId)
      .then(() => { });

    // Find Python executable
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    const args = [
      PYTHON_SCRIPT,
      pdfPath,
      metadata.date || '01-01-2024',
      metadata.shift || 'Shift 1',
      '--json-output'
    ];

    logEntry('info', `Running: ${pythonCmd} ${path.basename(PYTHON_SCRIPT)}`);

    const child = spawn(pythonCmd, args, {
      cwd: path.dirname(PYTHON_SCRIPT),
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;

      // Parse individual log lines and broadcast
      text.split('\n').filter(Boolean).forEach(line => {
        const trimmed = line.trim();
        if (!trimmed) return;

        // Detect log patterns from the Python script
        if (trimmed.startsWith('[')) {
          logEntry('info', trimmed);
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          // JSON output - don't broadcast as log
        } else {
          logEntry('info', trimmed);
        }
      });
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      text.split('\n').filter(Boolean).forEach(line => {
        if (line.trim()) {
          logEntry('warning', line.trim());
        }
      });
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        logEntry('error', `Parser exited with code ${code}`);
        logEntry('error', stderr || 'Unknown error');

        await supabaseAdmin.from('upload_batches')
          .update({
            parsing_status: 'FAILED',
            errors: [{ message: stderr || `Exit code ${code}` }],
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId);

        broadcastStatus(batchId, 'FAILED');
        return reject(new Error(`Parser failed with code ${code}: ${stderr}`));
      }

      try {
        // Try to extract JSON from stdout
        // The JSON output should be the last complete JSON block
        let jsonStr = '';
        const jsonMatch = stdout.match(/\n(\{[\s\S]*\})\s*$/);
        if (jsonMatch) {
          jsonStr = jsonMatch[1];
        } else {
          // Fallback: try the entire stdout
          jsonStr = stdout.trim();
        }

        let result;
        try {
          result = JSON.parse(jsonStr);
        } catch (parseErr) {
          // If JSON parsing fails, the script ran in normal mode
          // We'll create a minimal result from the logs
          logEntry('warning', 'JSON output not available, using log-based results');
          result = { questions: [], metadata: {}, logs: stdout.split('\n') };
        }

        const questionCount = result.questions ? result.questions.length : 0;
        logEntry('success', `Parsing complete: ${questionCount} questions extracted`);

        await supabaseAdmin.from('upload_batches')
          .update({
            parsing_status: 'REVIEW_PENDING',
            parsed_count: questionCount,
            updated_at: new Date().toISOString()
          })
          .eq('id', batchId);

        broadcastStatus(batchId, 'REVIEW_PENDING', { questionCount });
        resolve(result);

      } catch (err) {
        logEntry('error', `Failed to process results: ${err.message}`);
        reject(err);
      }
    });

    child.on('error', (err) => {
      logEntry('error', `Failed to spawn parser: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Store parsed questions as drafts in the database
 */
async function storeDraftQuestions(batchId, questions, metadata) {
  const results = { stored: 0, skipped: 0, failed: 0 };

  // Get exam ID
  const { data: exam } = await supabaseAdmin
    .from('exams')
    .select('id')
    .eq('slug', metadata.examSlug || 'ssc-cgl')
    .single();

  if (!exam) {
    logger.error(`Exam not found for slug: ${metadata.examSlug}`);
    return results;
  }

  // Pre-fetch all existing subjects for this exam to avoid sequential database queries
  const { data: existingSubjects } = await supabaseAdmin
    .from('subjects')
    .select('id, name')
    .eq('exam_id', exam.id);

  const subjectMap = new Map();
  if (existingSubjects) {
    existingSubjects.forEach(s => subjectMap.set(s.name, s.id));
  }

  // Create any missing subjects in bulk/parallel
  const uniqueSubjectNames = [...new Set(questions.map(q => q.subject_name).filter(Boolean))];
  for (const subjectName of uniqueSubjectNames) {
    if (!subjectMap.has(subjectName)) {
      const slug = subjectName.toLowerCase().replace(/[&\s]+/g, '-').replace(/[^a-z0-9-]/g, '');
      try {
        const { data: newSubject } = await supabaseAdmin
          .from('subjects')
          .insert({
            name: subjectName,
            slug,
            exam_id: exam.id,
            is_active: true
          })
          .select('id')
          .single();
        if (newSubject) {
          subjectMap.set(subjectName, newSubject.id);
        }
      } catch (e) {
        logger.error(`Failed to create subject ${subjectName}: ${e.message}`);
      }
    }
  }

  const questionsToInsert = [];
  for (const q of questions) {
    try {
      const subjectId = subjectMap.get(q.subject_name) || null;

      // Build options JSONB
      let options = q.options;
      if (typeof options === 'string') {
        options = JSON.parse(options);
      }
      if (!Array.isArray(options)) {
        options = Object.entries(options).map(([label, text]) => ({
          label, text: text || '', image: '', html: ''
        }));
      }

      questionsToInsert.push({
        question_text: q.question_text || q.text || '',
        options: options,
        correct_answer: q.correct_answer || q.answer || 'A',
        explanation: { text: q.explanation_text || '', html: '', image: '' },
        exam_id: exam.id,
        subject_id: subjectId,
        topic: q.topic || '',
        year: metadata.year || q.year,
        tier: metadata.tier || q.tier || '',
        shift: metadata.shift || q.shift || '',
        shift_date: metadata.date ? parseDate(metadata.date) : null,
        difficulty: q.difficulty || 'medium',
        question_image: q.question_image || '',
        status: 'draft',
        upload_batch_id: batchId,
        raw_extracted_text: q.raw_text || q.question_text || '',
        ocr_confidence: q.ocr_confidence || null,
        ai_confidence: q.ai_confidence || null,
        review_status: 'pending',
        question_number: q.question_number || null,
        has_equation: q.has_equation || false
      });
    } catch (err) {
      logger.error(`Error preparing question Q${q.question_number}: ${err.message}`);
      results.failed++;
    }
  }

  // Perform optimistic batch insertion
  if (questionsToInsert.length > 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('questions')
        .insert(questionsToInsert)
        .select('id');

      if (!error) {
        results.stored = data ? data.length : questionsToInsert.length;
      } else {
        // Fallback to individual inserts if batch insert fails (e.g. due to duplicate key conflicts)
        logger.info(`Batch insert conflict/error (${error.message}). Falling back to individual inserts...`);
        for (const qData of questionsToInsert) {
          try {
            const { error: indError } = await supabaseAdmin.from('questions').insert(qData);
            if (indError) {
              if (indError.code === '23505') {
                results.skipped++;
              } else {
                results.failed++;
              }
            } else {
              results.stored++;
            }
          } catch (e) {
            results.failed++;
          }
        }
      }
    } catch (err) {
      logger.error(`Batch insert exception: ${err.message}. Falling back to individual inserts...`);
      // Fallback
      for (const qData of questionsToInsert) {
        try {
          const { error: indError } = await supabaseAdmin.from('questions').insert(qData);
          if (indError) {
            if (indError.code === '23505') {
              results.skipped++;
            } else {
              results.failed++;
            }
          } else {
            results.stored++;
          }
        } catch (e) {
          results.failed++;
        }
      }
    }
  }

  // Update batch counts
  await supabaseAdmin.from('upload_batches')
    .update({
      total_questions: results.stored + results.skipped,
      parsed_count: results.stored,
      updated_at: new Date().toISOString()
    })
    .eq('id', batchId);

  return results;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  // Handle DD-MM-YYYY format
  const m = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (m) {
    return `${m[3]}-${m[2]}-${m[1]}`;
  }
  return dateStr;
}

module.exports = {
  extractMetadataFromFilename,
  parsePDF,
  storeDraftQuestions,
  UPLOADS_DIR
};

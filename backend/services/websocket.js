const WebSocket = require('ws');
const { logger } = require('./logger');
let cachedPayload = null;

let wss = null;
const clientsByBatch = new Map();

function initWebSocket(server) {
  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const url = req.url || '';

    if (url.startsWith('/ws/pipeline-stats')) {
      handlePipelineStats(ws);
    } else {
      handleUploadLogs(ws, req);
    }
  });

  // Heartbeat every 30s
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));
  logger.info('[WS] WebSocket server initialized');
}

function handleUploadLogs(ws, req) {
  logger.info('[WS] Admin client connected');

  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'subscribe' && data.batchId) {
        if (!clientsByBatch.has(data.batchId)) {
          clientsByBatch.set(data.batchId, new Set());
        }
        clientsByBatch.get(data.batchId).add(ws);
        ws._batchId = data.batchId;
        logger.info(`[WS] Client subscribed to batch ${data.batchId.slice(0, 8)}`);
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    if (ws._batchId && clientsByBatch.has(ws._batchId)) {
      clientsByBatch.get(ws._batchId).delete(ws);
      if (clientsByBatch.get(ws._batchId).size === 0) {
        clientsByBatch.delete(ws._batchId);
      }
    }
    logger.info('[WS] Admin client disconnected');
  });
}

function handlePipelineStats(ws) {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });
  ws._isPipeline = true;
}

function broadcastLog(batchId, level, message, details = {}) {
  const payload = JSON.stringify({ type: 'log', batchId, level, message, details, timestamp: new Date().toISOString() });
  const clients = clientsByBatch.get(batchId);
  if (clients) {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}

function broadcastStatus(batchId, status, data = {}) {
  const payload = JSON.stringify({ type: 'status', batchId, status, data, timestamp: new Date().toISOString() });
  const clients = clientsByBatch.get(batchId);
  if (clients) {
    clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
  if (wss) {
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });
  }
}

function initPipelineStats() {
  const { pool } = require('../config/database');
  const broadcastInterval = setInterval(async () => {
    if (!wss) return;
    const pipelineClients = Array.from(wss.clients).filter(ws => ws._isPipeline && ws.readyState === WebSocket.OPEN);
    if (pipelineClients.length === 0) return;

    try {
      const { rows: examStats } = await pool.query(`
        SELECT 
          e.short_name as exam,
          e.slug,
          (SELECT COUNT(*)::int FROM source_series ss 
           JOIN source_packages sp ON ss.package_id = sp.package_id 
           WHERE sp.sub_exam = e.slug) as series,
          (SELECT COUNT(*)::int FROM questions WHERE exam_id = e.id AND status = 'published') as questions,
          (SELECT COUNT(*)::int FROM questions WHERE exam_id = e.id AND status = 'published' AND option_images IS NOT NULL AND option_images != '[]'::jsonb) as images,
          (SELECT COUNT(*)::int FROM questions WHERE exam_id = e.id AND status = 'published' AND shift IS NOT NULL AND shift != '') as shifts,
          (SELECT json_agg(json_build_object('year', y, 'count', c) ORDER BY y DESC) FROM (
            SELECT q.year as y, COUNT(*)::int as c FROM questions q WHERE q.exam_id = e.id AND q.status = 'published' GROUP BY q.year
          ) sub) as years,
          (SELECT json_agg(json_build_object('tier', t, 'count', c) ORDER BY t) FROM (
            SELECT COALESCE(q.tier, 'N/A') as t, COUNT(*)::int as c FROM questions q WHERE q.exam_id = e.id AND q.status = 'published' GROUP BY q.tier
          ) sub) as tiers,
          (SELECT json_agg(json_build_object('shift', s, 'year', y, 'tier', t, 'date', d, 'series_id', sid, 'series_name', sn, 'count', c) ORDER BY y DESC, t, s, sn) FROM (
            SELECT q.shift as s, q.year as y, CASE WHEN q.tier IS NULL OR q.tier = '' THEN 'N/A' ELSE q.tier END as t, TO_CHAR(q.shift_date, 'YYYY-MM-DD') as d, COALESCE(ss.series_id, '') as sid, COALESCE(ss.series_name, '') as sn, COUNT(*)::int as c
            FROM questions q
            LEFT JOIN source_series ss ON q.source_series_id = ss.series_id::text
            WHERE q.exam_id = e.id AND q.status = 'published' AND q.shift IS NOT NULL AND q.shift != ''
            GROUP BY q.shift, q.year, q.tier, q.shift_date, ss.series_id, ss.series_name
          ) sub) as shift_breakdown
        FROM exams e ORDER BY e.short_name
      `);
      const { rows: seriesProgress } = await pool.query(`
        SELECT 
          ss.series_id, ss.series_name, ss.total_question as target, ss.imported_question_count as completed,
          ss.import_status, ss.section_name, ss.updated_at,
          sp.sub_exam as exam_slug, sp.package_name, sp.package_id
        FROM source_series ss
        JOIN source_packages sp ON ss.package_id = sp.package_id
        ORDER BY ss.import_status, ss.updated_at DESC
      `);

      const { rows: dbPackages } = await pool.query(`
        SELECT sp.package_id, sp.package_name, sp.sub_exam, sp.total_series,
          COUNT(ss.id)::int as imported_series,
          SUM(CASE WHEN ss.import_status = 'completed' THEN 1 ELSE 0 END)::int as completed_series
        FROM source_packages sp
        LEFT JOIN source_series ss ON ss.package_id = sp.package_id
        GROUP BY sp.package_id, sp.package_name, sp.sub_exam, sp.total_series
        ORDER BY sp.sub_exam, sp.package_name
      `);
      // Merge with known packages so unstarted exams show expected targets
      const KNOWN_PACKAGES = [
        { package_id: '615', package_name: 'SSC CGL 2026 - Tier 1', sub_exam: 'ssc-cgl' },
        { package_id: '973', package_name: 'SSC CGL 2026 - Tier 2', sub_exam: 'ssc-cgl' },
        { package_id: '81',  package_name: 'SSC CHSL 2026 - Tier 1', sub_exam: 'ssc-chsl' },
        { package_id: '975', package_name: 'SSC CHSL 2025 - Tier 2', sub_exam: 'ssc-chsl' },
        { package_id: '62',  package_name: 'SSC CPO 2026 - Tier 1', sub_exam: 'ssc-cpo' },
        { package_id: '978', package_name: 'SSC CPO 2025 - Tier 2', sub_exam: 'ssc-cpo' },
        { package_id: '1050',package_name: 'SSC GD Constable 2026', sub_exam: 'ssc-gd' },
        { package_id: '761', package_name: 'SSC MTS 2026', sub_exam: 'ssc-mts' },
        { package_id: '70',  package_name: 'SSC Stenographer 2026', sub_exam: 'ssc-stenographer' },
        { package_id: '1030',package_name: 'SSC Selection Post 2026', sub_exam: 'ssc-selection-post' },
      ];
      // Hardcoded targets from external API (used when DB total_series is 0)
      // Values extracted from pipeline run_import.js output logs [i/total]
      const KNOWN_TARGETS = {
        '615':  213,  // SSC CGL 2026 - Tier 1
        '973':  0,    // SSC CGL 2026 - Tier 2
        '81':   70,   // SSC CHSL 2026 - Tier 1
        '975':  0,    // SSC CHSL 2025 - Tier 2
        '62':   37,   // SSC CPO 2026 - Tier 1
        '978':  0,    // SSC CPO 2025 - Tier 2
        '1050': 346,  // SSC GD Constable 2026
        '761':  156,  // SSC MTS 2026
        '70':   21,   // SSC Stenographer 2026
        '1030': 0,    // SSC Selection Post 2026
      };
      const dbMap = {};
      dbPackages.forEach(p => { dbMap[p.package_id] = p; });
      const packages = KNOWN_PACKAGES.map(kp => {
        const db = dbMap[kp.package_id];
        const seriesCount = (db?.total_series > 0 ? db.total_series : (KNOWN_TARGETS[kp.package_id] || db?.imported_series || 0));
        return {
          ...kp,
          series_count: seriesCount,
          completed_series: db?.completed_series || 0,
        };
      });

      const totalQuestions = examStats.reduce((s, r) => s + (r.questions || 0), 0);
      const totalTarget = seriesProgress.reduce((s, r) => s + (r.target || 0), 0);
      const totalCompleted = seriesProgress.reduce((s, r) => s + (r.completed || 0), 0);
      const overallPct = totalTarget > 0 ? Math.round((totalCompleted / totalTarget) * 100) : 0;
      const pendingSeries = seriesProgress.filter(r => r.import_status !== 'completed' && r.import_status !== 'empty').length;

      const payload = JSON.stringify({
        type: 'pipeline-stats',
        data: { examStats, seriesProgress, packages, totalQuestions, totalTarget, totalCompleted, overallPct, pendingSeries, timestamp: new Date().toISOString() }
      });
      cachedPayload = payload;
      pipelineClients.forEach(ws => ws.send(payload));
    } catch (err) {
      if (cachedPayload) {
        const cached = JSON.parse(cachedPayload);
        cached.data.timestamp = new Date().toISOString();
        cached.data.cached = true;
        pipelineClients.forEach(ws => ws.send(JSON.stringify(cached)));
      } else {
        logger.error('[WS] Pipeline stats broadcast error: ' + err.message);
      }
    }
  }, 3000);

  if (wss) wss.on('close', () => clearInterval(broadcastInterval));
}

module.exports = { initWebSocket, broadcastLog, broadcastStatus, initPipelineStats };
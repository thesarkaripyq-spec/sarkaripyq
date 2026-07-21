const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const { logger, stream } = require('./services/logger');

const authRoutes = require('./routes/auth');
const examRoutes = require('./routes/exams');
const subjectRoutes = require('./routes/subjects');
const questionRoutes = require('./routes/questions');
const statsRoutes = require('./routes/stats');
const performanceRoutes = require('./routes/performance');
const settingsRoutes = require('./routes/settings');
const booksRoutes = require('./routes/books');
const searchRoutes = require('./routes/search');

const { errorHandler } = require('./middleware/errorHandler');
const { rateLimiter } = require('./middleware/rateLimiter');
const { pool } = require('./config/database');
const promClient = require('prom-client');
const {
  sanitizeInput,
  securityHeaders,
  requestLogger,
  apiKeyAuth
} = require('./middleware/security');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.set('etag', 'strong');

const isProduction = process.env.NODE_ENV === 'production';

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: isProduction
        ? ["'self'", "'unsafe-inline'", "https://accounts.google.com"]
        : ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "https:", "data:", "blob:"],
      connectSrc: ["'self'", "https://*.supabase.co", "https://accounts.google.com"],
      frameSrc: ["'self'", "https://accounts.google.com"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  hsts: isProduction
    ? { maxAge: 63072000, includeSubDomains: true, preload: true }
    : false,
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  crossOriginOpenerPolicy: { policy: 'same-origin' }
}));

app.use(securityHeaders);
app.use(requestLogger);

// Request timeout: 25s
app.use((req, res, next) => {
  res.setTimeout(25000, () => {
    if (!res.headersSent) {
      logger.error(`Request timeout: ${req.method} ${req.path}`);
      res.status(503).json({ success: false, message: 'Request timed out' });
    }
  });
  next();
});

const isDev = !isProduction;

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:3000',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:8081',
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/
];

if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .forEach(o => { if (!allowedOrigins.includes(o)) allowedOrigins.push(o); });
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (isDev) return callback(null, true);
    if (allowedOrigins.some(o => o instanceof RegExp ? o.test(origin) : o === origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-session-id'],
  maxAge: 86400
}));

app.use(compression({
  threshold: 1024,
  level: 6,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

if (process.env.NODE_ENV === 'development') {
  const morgan = require('morgan');
  app.use(morgan('dev', { stream }));
}

const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '2mb';
app.use(express.json({ limit: MAX_BODY_SIZE }));
app.use(express.urlencoded({ extended: false, limit: MAX_BODY_SIZE }));

app.use(rateLimiter);
app.use(sanitizeInput);

// API-wide cache control (GET endpoints only)
app.use('/api', (req, res, next) => {
  res.setHeader('Link', '<https://*.supabase.co>; rel=preconnect');
  if (req.method === 'GET') {
    const privatePatterns = ['/auth', '/stats/user', '/performance', '/queue', '/me'];
    const isPrivate = privatePatterns.some(p => req.path.includes(p));
    if (isPrivate) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
    }
  }
  next();
});

// API v1 routes
const API_PREFIX = '/api/v1';
app.use(API_PREFIX, apiKeyAuth);

app.use(`${API_PREFIX}/auth`, authRoutes);
app.use(`${API_PREFIX}/exams`, examRoutes);
app.use(`${API_PREFIX}/subjects`, subjectRoutes);
app.use(`${API_PREFIX}/questions`, questionRoutes);
app.use(`${API_PREFIX}/settings`, settingsRoutes);
app.use(`${API_PREFIX}/stats`, statsRoutes);
app.use(`${API_PREFIX}/performance`, performanceRoutes);
app.use(`${API_PREFIX}/books`, booksRoutes);
app.use(`${API_PREFIX}/search`, searchRoutes);

app.get(API_PREFIX, (req, res) => {
  res.json({
    success: true,
    message: 'SARKARIPYQ API v1'
  });
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(503).json({
      status: 'ERROR'
    });
  }
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://sarkaripyq.com';
  res.type('text/plain').set('Cache-Control', 'public, max-age=86400').send(`# SARKARIPYQ Robots
User-agent: *
Allow: /
Allow: /ssc/
Allow: /ssc/*
Allow: /ssc-cgl-pyq
Allow: /ssc-chsl-pyq
Allow: /ssc-gd-pyq
Allow: /ssc-cpo-pyq
Allow: /ssc-mts-pyq
Allow: /ssc-selection-post-pyq
Allow: /ssc-stenographer-pyq
Allow: /best-books-for-ssc-exams
Allow: /faq
Allow: /about
Allow: /contact
Allow: /leaderboard

Disallow: /api/
Disallow: /auth/
Disallow: /user/
Disallow: /dashboard/
Disallow: /profile
Disallow: /login
Disallow: /register

# AI crawlers
User-agent: GPTBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Claude-Web
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: Meta-ExternalAgent
Disallow: /

Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/sitemap-index.xml
`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { supabase, query } = require('./config/supabase');
    const baseUrl = process.env.FRONTEND_URL || 'https://sarkaripyq.com';
    const today = new Date().toISOString().split('T')[0];

    // Fetch exams, subjects, distinct years and topics in parallel
    const [examsRes, subjectsRes, yearsRes, topicsRes] = await Promise.all([
      supabase
        .from('exams')
        .select('id, slug, updated_at')
        .eq('is_active', true),
      supabase
        .from('subjects')
        .select('id, slug, exam:exams(slug)')
        .eq('is_active', true),
      query(`
        SELECT DISTINCT q.year, e.slug as exam_slug
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        WHERE q.status = 'published' AND q.year IS NOT NULL
        ORDER BY q.year DESC
      `),
      query(`
        SELECT DISTINCT q.topic, e.slug as exam_slug, s.slug as subject_slug
        FROM questions q
        JOIN exams e ON q.exam_id = e.id
        JOIN subjects s ON q.subject_id = s.id
        WHERE q.status = 'published' AND q.topic IS NOT NULL AND q.topic <> ''
        LIMIT 5000
      `)
    ]);

    const exams = examsRes.data || [];
    const subjects = subjectsRes.data || [];
    const years = yearsRes.rows || [];
    const topics = topicsRes.rows || [];

    const urlEntries = [];
    const pushUrl = (loc, lastmod, changefreq, priority) => {
      urlEntries.push(`  <url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`);
    };

    pushUrl(`${baseUrl}/`, today, 'daily', '1.0');
    pushUrl(`${baseUrl}/best-books-for-ssc-exams`, today, 'weekly', '0.8');
    pushUrl(`${baseUrl}/faq`, today, 'weekly', '0.7');
    pushUrl(`${baseUrl}/about`, today, 'monthly', '0.5');
    pushUrl(`${baseUrl}/contact`, today, 'monthly', '0.5');
    pushUrl(`${baseUrl}/privacy-policy`, today, 'yearly', '0.3');
    pushUrl(`${baseUrl}/terms-and-conditions`, today, 'yearly', '0.3');

    // High volume short-form landing pages
    ['ssc-cgl', 'ssc-chsl', 'ssc-gd', 'ssc-cpo', 'ssc-mts', 'ssc-selection-post', 'ssc-stenographer']
      .forEach(slug => pushUrl(`${baseUrl}/${slug}-pyq`, today, 'daily', '1.0'));

    exams.forEach(exam => {
      const lastmod = exam.updated_at ? exam.updated_at.split('T')[0] : today;
      pushUrl(`${baseUrl}/ssc/${exam.slug}-previous-year-questions`, lastmod, 'daily', '0.9');
    });

    subjects.forEach(sub => {
      if (sub.exam?.slug) {
        pushUrl(`${baseUrl}/ssc/${sub.exam.slug}/${sub.slug}-previous-year-questions`, today, 'daily', '0.8');
      }
    });

    years.forEach(y => {
      if (y.exam_slug && y.year) {
        pushUrl(`${baseUrl}/ssc/${y.exam_slug}/${y.year}-previous-year-questions`, today, 'weekly', '0.7');
      }
    });

    topics.forEach(t => {
      if (t.exam_slug && t.subject_slug && t.topic) {
        const topicSlug = String(t.topic).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        pushUrl(`${baseUrl}/ssc/${t.exam_slug}/${t.subject_slug}/${topicSlug}-previous-year-questions`, today, 'weekly', '0.6');
      }
    });

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries.join('\n')}
</urlset>`;

    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400');
    res.send(sitemap);
  } catch (error) {
    logger.error('Error generating sitemap:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error generating sitemap' });
    }
  }
});

// Sitemap index (helps Google discover multiple sitemaps for huge sites)
app.get('/sitemap-index.xml', (req, res) => {
  const baseUrl = process.env.FRONTEND_URL || 'https://sarkaripyq.com';
  const today = new Date().toISOString().split('T')[0];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>${baseUrl}/sitemap.xml</loc><lastmod>${today}</lastmod></sitemap>
</sitemapindex>`;
  res.set('Content-Type', 'application/xml');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

// Prometheus metrics (protected, internal only)
app.get('/api/metrics', async (req, res) => {
  if (isProduction && !req.isApiKeyAuth) {
    return res.status(403).json({ success: false, message: 'Forbidden' });
  }
  try {
    const metrics = await promClient.register.metrics();
    res.set('Content-Type', promClient.register.contentType);
    res.end(metrics);
  } catch (error) {
    logger.error('Metrics error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Error generating metrics' });
    }
  }
});

// SEO-friendly deep link redirects for high-intent keywords.
// E.g. /ssc-cgl-pyq/2024/shift-1 — sends user to the canonical SPA route.
app.get(/^\/ssc-([a-z-]+)-pyq(?:\/(\d{4}))?(?:\/shift-(\d+))?$/, (req, res) => {
  if (!isProduction) {
    return res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  }
  const examSlug = req.params[0];
  const year = req.params[1];
  const shift = req.params[2];
  const parts = [`/ssc/${examSlug}-previous-year-questions`];
  if (year) parts.push(`/${year}-previous-year-questions`);
  if (shift) parts.push(`?shift=Shift+${shift}`);
  return res.redirect(301, parts.join(''));
});

// In production, serve frontend build as SPA fallback
if (isProduction) {
  const frontendBuild = path.join(__dirname, '../frontend/build');
  app.use((req, res, next) => {
    res.setHeader('Link', '<https://*.supabase.co>; rel=preconnect, <https://fonts.googleapis.com>; rel=preconnect');
    next();
  });
  app.use(express.static(frontendBuild, { maxAge: '1y', immutable: true }));
  app.get('*', (req, res, next) => {
    if (!req.path.startsWith('/api/')) {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(frontendBuild, 'index.html'));
    } else {
      next();
    }
  });
} else {
  app.get('/', (req, res) => {
    res.redirect(process.env.FRONTEND_URL || 'http://localhost:3000');
  });
}

app.use(errorHandler);

app.use((req, res) => {
  logger.warn(`404: ${req.method} ${req.path}`);
  res.status(404).json({ success: false, message: 'Route not found' });
});

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 5000;

const isServerless = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true';

if (!isServerless) {
  const server = app.listen(DEFAULT_PORT, () => {
    logger.info(`SARKARIPYQ API Server started`);
    logger.info(`Port: ${DEFAULT_PORT}`);
    logger.info(`Database: Supabase PostgreSQL`);
    logger.info(`API: http://localhost:${DEFAULT_PORT}${API_PREFIX}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });

  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    server.close(() => process.exit(0));
  });
}

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error.message, { stack: error.stack });
});

module.exports = app;

const { RateLimiterMemory } = require('rate-limiter-flexible');
const { logger } = require('../services/logger');
const { pool } = require('../config/database');

const DISABLE_RATE_LIMIT = process.env.DISABLE_RATE_LIMIT === 'true';
const IS_SERVERLESS = process.env.VERCEL === '1' || process.env.SERVERLESS === 'true';

if (DISABLE_RATE_LIMIT) {
  logger.warn('Rate limiting is DISABLED (non-production or DISABLE_RATE_LIMIT=true).');
}

const RATE_LIMIT_POINTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10);
const RATE_LIMIT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10);

const _ensureRateLimitTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS rate_limits (
        key TEXT PRIMARY KEY,
        count INTEGER DEFAULT 1,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
  } catch (e) {
    // Table creation failed, rate limiting falls back to no-op
  }
};

const pgRateLimit = async (key, maxRequests, windowSeconds) => {
  try {
    const expiresAt = new Date(Date.now() + windowSeconds * 1000);
    const result = await pool.query(
      `INSERT INTO rate_limits (key, count, expires_at)
       VALUES ($1, 1, $2)
       ON CONFLICT (key) DO UPDATE SET
         count = CASE WHEN rate_limits.expires_at < $2 THEN 1 ELSE rate_limits.count + 1 END,
         expires_at = CASE WHEN rate_limits.expires_at < $2 THEN $2 ELSE rate_limits.expires_at END
       RETURNING count`,
      [key, expiresAt]
    );
    return result.rows[0].count <= maxRequests;
  } catch (e) {
    return true;
  }
};

const generalLimiter = new RateLimiterMemory({
  points: Number.isFinite(RATE_LIMIT_POINTS) ? RATE_LIMIT_POINTS : 200,
  duration: (Number.isFinite(RATE_LIMIT_WINDOW) ? RATE_LIMIT_WINDOW : 900000) / 1000,
});

const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 900,
  blockDuration: 900,
});

const searchLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60,
});

const buildLimiter = (limiter, message) => async (req, res, next) => {
  if (DISABLE_RATE_LIMIT) return next();
  if (IS_SERVERLESS) {
    const allowed = await pgRateLimit(req.ip, RATE_LIMIT_POINTS || 200, (RATE_LIMIT_WINDOW || 900000) / 1000);
    if (!allowed) {
      return res.status(429).json({
        success: false,
        message,
        retryAfter: 1
      });
    }
    return next();
  }
  try {
    await limiter.consume(req.ip);
    return next();
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Rate limiter error: ' + err.message);
      return next();
    }
    const msBeforeNext = err.msBeforeNext || 1000;
    res.setHeader('Retry-After', Math.ceil(msBeforeNext / 1000));
    res.status(429).json({
      success: false,
      message,
      retryAfter: Math.ceil(msBeforeNext / 1000)
    });
  }
};

const rateLimiter = buildLimiter(generalLimiter, 'Too many requests, please try again later');
const authRateLimiter = buildLimiter(authLimiter, 'Too many login attempts, please try again later');
const searchRateLimiter = buildLimiter(searchLimiter, 'Search rate limit reached, slow down a moment.');

module.exports = {
  rateLimiter,
  authRateLimiter,
  searchRateLimiter
};

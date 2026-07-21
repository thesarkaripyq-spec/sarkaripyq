const { RateLimiterMemory } = require('rate-limiter-flexible');
const { logger } = require('../services/logger');

if (process.env.NODE_ENV !== 'production') {
  logger.warn('Rate limiting is DISABLED (non-production environment). Enable by setting NODE_ENV=production.');
}

// General rate limiter (per IP, 15-minute window)
const generalLimiter = new RateLimiterMemory({
  points: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 200,
  duration: (parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000) / 1000,
});

// Auth rate limiter (stricter, blocks for 15 minutes after exhaustion)
const authLimiter = new RateLimiterMemory({
  points: 5,
  duration: 60 * 15,
  blockDuration: 60 * 15,
});

// Upload rate limiter
const uploadLimiter = new RateLimiterMemory({
  points: 10,
  duration: 60 * 60,
});

// Search rate limiter (higher cap, lower duration — public search must be fast)
const searchLimiter = new RateLimiterMemory({
  points: 60,
  duration: 60,
});

const buildLimiter = (limiter, message) => async (req, res, next) => {
  if (process.env.NODE_ENV !== 'production') return next();
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
const uploadRateLimiter = buildLimiter(uploadLimiter, 'Upload limit reached, please try again later');
const searchRateLimiter = buildLimiter(searchLimiter, 'Search rate limit reached, slow down a moment.');

module.exports = {
  rateLimiter,
  authRateLimiter,
  uploadRateLimiter,
  searchRateLimiter
};

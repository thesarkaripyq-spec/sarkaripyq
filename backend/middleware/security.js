const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const { logger } = require('../services/logger');

const SANITIZE_OPTIONS = {
  allowedTags: ['b', 'i', 'em', 'strong', 'u', 'p', 'br', 'span', 'div', 'sup', 'sub'],
  allowedAttributes: {
    '*': ['class', 'id'],
    'span': ['class', 'style'],
    'div': ['class', 'style'],
    'p': ['class', 'style']
  }
};

const sanitizeObject = (obj) => {
  if (typeof obj === 'string') {
    return sanitizeHtml(obj, SANITIZE_OPTIONS);
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeHtml(value, SANITIZE_OPTIONS);
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  return obj;
};

exports.sanitizeInput = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};

// CSRF protection is handled by Supabase JWT via the Authorization header.

exports.apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validKey = process.env.API_KEY;

  if (validKey) {
    if (!apiKey) {
      return res.status(401).json({ success: false, message: 'API key required' });
    }
    if (apiKey.length === validKey.length &&
        crypto.timingSafeEqual(Buffer.from(apiKey), Buffer.from(validKey))) {
      req.isApiKeyAuth = true;
      return next();
    }
    logger.warn(`[SECURITY] Invalid API key attempt from ${req.ip}`);
    return res.status(401).json({ success: false, message: 'Invalid API key' });
  }

  next();
};

exports.securityHeaders = (req, res, next) => {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  next();
};

exports.requestLogger = (req, res, next) => {
  const path = req.path || '';
  const queryStr = JSON.stringify(req.query || {});
  const suspicious = [
    path.includes('..'),
    /[<>'"]/.test(path) && !path.startsWith('/api/'),
    /\$where|\$ne|\$gt|\$lt|\$regex/i.test(queryStr),
    /\.\.\//.test(path),
    /%2e%2e/i.test(path),
    path.length > 2048,
    /' OR|UNION SELECT|DROP TABLE|--\s|;\s*DROP/i.test(queryStr),
    /ALTER\s+TABLE|CREATE\s+TABLE|DELETE\s+FROM/i.test(queryStr)
  ];

  if (suspicious.some(Boolean)) {
    logger.warn(`[SECURITY] Blocked suspicious request from ${req.ip}: ${req.method} ${path}`);
    return res.status(400).json({ success: false, message: 'Bad request' });
  }

  const start = Date.now();
  res.on('finish', () => {
    logger.info(`${req.method} ${path} ${res.statusCode} ${Date.now() - start}ms`);
  });

  next();
};

module.exports = exports;

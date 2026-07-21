const crypto = require('crypto');
const { body, query, param } = require('express-validator');

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
// No additional CSRF middleware is needed.

exports.verifyWebhookSignature = (secret) => {
  return (req, res, next) => {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];

    if (!signature || !timestamp) {
      return res.status(401).json({
        success: false,
        message: 'Missing webhook signature'
      });
    }

    const age = Math.floor(Date.now() / 1000) - parseInt(timestamp);
    if (age > 300) {
      return res.status(401).json({
        success: false,
        message: 'Webhook signature expired'
      });
    }

    const payload = JSON.stringify(req.body);
    const signedPayload = `${timestamp}.${payload}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    next();
  };
};

exports.apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.query.api_key;

  if (apiKey) {
    const validKey = process.env.API_KEY;
    if (validKey && apiKey === validKey) {
      req.isApiKeyAuth = true;
    }
  }

  next();
};

exports.validateObjectId = [
  param('id').custom(value => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error('Invalid ID format');
    }
    return true;
  })
];

exports.validateSearchInput = [
  body('search').optional().custom(value => {
    if (typeof value === 'string') {
      if (value.length > 500) {
        throw new Error('Search query too long');
      }
      const dangerous = /<script|javascript:|on\w+=/i;
      if (dangerous.test(value)) {
        throw new Error('Invalid characters in search');
      }
    }
    return true;
  })
];

exports.securityHeaders = (req, res, next) => {
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
  next();
};

exports.requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const path = req.path || '';
    const queryStr = JSON.stringify(req.query || {});
    const suspicious = [
      path.includes('..'),
      /[<>'"]/.test(path) && !path.startsWith('/api/'),
      /\$where|\$ne|\$gt|\$lt|\$regex/i.test(queryStr),
      /\.\.\//.test(path),
      /%2e%2e/i.test(path),
      path.length > 2048
    ];

    if (suspicious.some(Boolean)) {
      logger.warn(`[SECURITY] Suspicious request from ${req.ip}: ${req.method} ${path} (${duration}ms)`);
    }
  });

  next();
};

module.exports = exports;

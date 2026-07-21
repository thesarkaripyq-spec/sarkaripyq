const { logger } = require('../services/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Server Error';

  if (process.env.NODE_ENV === 'development') {
    logger.error(`Error: ${err.message}`, { stack: err.stack, path: req.path, method: req.method });
  } else {
    logger.error(`Error: ${err.message}`, { path: req.path, method: req.method });
  }

  // PostgreSQL error codes
  if (err.code === '23505') {
    statusCode = 409;
    message = 'Duplicate entry. This record already exists.';
  }

  if (err.code === '23503') {
    statusCode = 409;
    message = 'Referenced record not found.';
  }

  if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid input format.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired';
  }

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'File size exceeds limit';
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Unexpected file field';
  }

  // Supabase errors
  if (err.code?.startsWith('PGRST')) {
    statusCode = 400;
    message = 'Database query error';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { errorHandler, asyncHandler, AppError };

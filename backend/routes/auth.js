const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { body } = require('express-validator');
const { supabase, supabaseAdmin } = require('../config/supabase');
const { asyncHandler } = require('../middleware/errorHandler');
const { validate } = require('../middleware/validate');
const { authRateLimiter, rateLimiter } = require('../middleware/rateLimiter');
const crypto = require('crypto');

const failedLoginAttempts = new Map();
const CAPTCHA_THRESHOLD = 3;
const ATTEMPT_TTL = 60 * 60 * 1000; // 1 hour TTL per IP

const isCaptchaRequired = (ip) => {
  const entry = failedLoginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.timestamp > ATTEMPT_TTL) {
    failedLoginAttempts.delete(ip);
    return false;
  }
  return entry.count >= CAPTCHA_THRESHOLD;
};

const recordFailedAttempt = (ip) => {
  const entry = failedLoginAttempts.get(ip);
  if (!entry || Date.now() - entry.timestamp > ATTEMPT_TTL) {
    failedLoginAttempts.set(ip, { count: 1, timestamp: Date.now() });
  } else {
    entry.count++;
  }
};

const clearFailedAttempts = (ip) => {
  failedLoginAttempts.delete(ip);
};

// Prevent unbounded memory growth: purge stale entries every 10 minutes
setInterval(() => {
  const cutoff = Date.now() - ATTEMPT_TTL;
  for (const [ip, entry] of failedLoginAttempts) {
    if (entry.timestamp < cutoff) failedLoginAttempts.delete(ip);
  }
}, 600000);

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d'
  });
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
};

const verifyCaptcha = (token, userInput) => {
  if (!token || !userInput) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [answerHash, expiresAt, signature] = parts;
  
  if (Date.now() > parseInt(expiresAt)) return false;
  
  const payload = `${answerHash}.${expiresAt}`;
  const expectedSignature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  if (!timingSafeEqual(signature, expectedSignature)) return false;
  
  // Hash the user's input with the same method and compare to the stored hash
  const userAnswerHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(parseInt(userInput))).digest('hex');
  return timingSafeEqual(userAnswerHash, answerHash);
};

// @route   GET /api/auth/captcha
// @desc    Generate math captcha
// @access  Public
router.get('/captcha', (req, res) => {
  const num1 = Math.floor(Math.random() * 9) + 1; // 1-9
  const num2 = Math.floor(Math.random() * 9) + 1; // 1-9
  const answer = num1 + num2;
  const question = `What is ${num1} + ${num2}?`;
  
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes expiration
  // Hash the answer so the plaintext is never sent to the client
  const answerHash = crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(answer)).digest('hex');
  const payload = `${answerHash}.${expiresAt}`;
  const signature = crypto.createHmac('sha256', process.env.JWT_SECRET).update(payload).digest('hex');
  const token = `${payload}.${signature}`;

  res.json({
    success: true,
    data: {
      question,
      token
    }
  });
});

// @route   POST /api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
  authRateLimiter,
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('captchaAnswer').trim().notEmpty().withMessage('CAPTCHA answer is required'),
  body('captchaToken').trim().notEmpty().withMessage('CAPTCHA token is required'),
  validate
], asyncHandler(async (req, res) => {
  const { name, email, password, captchaAnswer, captchaToken } = req.body;

  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid or expired CAPTCHA. Please try again.'
    });
  }

  const { data: existingUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User already exists with this email'
    });
  }

  // Create user in Supabase Auth with email auto-confirmed
  const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name }
  });

  if (authError) {
    return res.status(400).json({
      success: false,
      message: authError.message
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const { data: user, error: insertError } = await supabaseAdmin
    .from('users')
    .insert({
      id: authUser.user.id,
      name,
      email,
      password: hashedPassword,
      role: 'user'
    })
    .select()
    .single();

  if (insertError) {
    // Rollback auth user creation if DB insert fails
    await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
    throw insertError;
  }

  const token = generateToken(user.id);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    }
  });
}));

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  authRateLimiter,
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, avatar, is_active, password, created_at')
    .eq('email', email)
    .single();

  if (error || !user) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  if (!user.is_active) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  clearFailedAttempts(req.ip);

  await supabaseAdmin
    .from('users')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', user.id);

  const token = generateToken(user.id);

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      },
      token
    }
  });
}));

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, avatar, created_at')
    .eq('id', decoded.id)
    .single();

  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({
    success: true,
    data: user
  });
}));

// @route   POST /api/auth/admin/login
// @desc    Admin login
// @access  Public
router.post('/admin/login', [
  authRateLimiter,
  body('email').isEmail().withMessage('Please enter a valid email'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, name, email, role, is_active, password')
    .eq('email', email)
    .single();

  if (!user) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    recordFailedAttempt(req.ip);
    return res.status(403).json({
      success: false,
      message: 'Admin access only'
    });
  }

  if (!user.is_active) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Account is deactivated'
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    recordFailedAttempt(req.ip);
    return res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }

  const token = generateToken(user.id);

  res.json({
    success: true,
    message: 'Admin login successful',
    data: {
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    }
  });
}));

module.exports = router;

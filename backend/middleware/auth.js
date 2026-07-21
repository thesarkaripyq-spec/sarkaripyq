const jwt = require('jsonwebtoken');
const { supabaseAdmin } = require('../config/supabase');
const { logger } = require('../services/logger');

// Throttle Map for last_activity updates to avoid global namespace pollution
const lastActivityThrottle = new Map();

// Verify Supabase JWT token
async function verifySupabaseToken(token) {
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return { error: error || 'User not found' };
    }
    return { user };
  } catch (err) {
    return { error: err.message };
  }
}

// Protect routes - verify token
exports.protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    logger.warn('Auth protect: No token provided');
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  try {
    // Try Supabase token first (frontend uses Supabase Auth)
    const result = await verifySupabaseToken(token);
    
    if (result.error) {
      logger.error('Supabase token verification failed: ' + (result.error.message || JSON.stringify(result.error)));
      // Fallback: try custom JWT (for backward compatibility)
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, name, email, role, is_active')
          .eq('id', decoded.id)
          .single();
        
        if (user) {
          req.user = user;
          return next();
        }
      } catch (jwtErr) {
        // Invalid token
      }
      
      logger.warn('Auth protect: Invalid token');
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // Get user data from our users table - match by email
    let { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, role, is_active')
      .eq('email', result.user.email)
      .single();

    // Auto-create user if not exists (first time login)
    if (userError || !user) {
      const isAdmin = result.user.email === process.env.ADMIN_EMAIL;
      const { data: newUser, error: createError } = await supabaseAdmin
        .from('users')
        .insert({
          email: result.user.email,
          name: result.user.user_metadata?.full_name || result.user.user_metadata?.name || result.user.email.split('@')[0],
          role: isAdmin ? 'superadmin' : 'user'
        })
        .select()
        .single();
      
      if (createError || !newUser) {
        if (createError?.code === '23505') {
          // User was concurrently created by another parallel request, fetch it
          const { data: retryUser, error: retryError } = await supabaseAdmin
            .from('users')
            .select('id, name, email, role, is_active')
            .eq('email', result.user.email)
            .single();
          
          if (retryError || !retryUser) {
            return res.status(401).json({
              success: false,
              message: 'Failed to retrieve user after concurrent creation: ' + (retryError?.message || 'Unknown error')
            });
          }
          user = retryUser;
        } else {
          return res.status(401).json({
            success: false,
            message: 'Failed to create user: ' + (createError?.message || 'Unknown error')
          });
        }
      } else {
        user = newUser;
      }
    }

    if (!user.is_active) {
      logger.warn(`Auth protect: User ${user.email} is deactivated`);
      return res.status(401).json({
        success: false,
        message: 'User account is deactivated'
      });
    }

    req.user = user;

    // Fire-and-forget last_activity update (non-blocking, throttled per user)
    const THROTTLE_KEY = user.id;
    const now = Date.now();
    const lastUpdate = lastActivityThrottle.get(THROTTLE_KEY);
    if (!lastUpdate || now - lastUpdate > 60000) {
      lastActivityThrottle.set(THROTTLE_KEY, now);
      supabaseAdmin
        .from('users')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', user.id)
        .then(() => {})
        .catch(err => logger.error('Failed to update user last activity: ' + err.message));
    }

    next();
  } catch (error) {
    logger.error('Auth protect error in catch block: ' + error.stack);
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }
};

// Optional auth - attaches user if token present
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const result = await verifySupabaseToken(token);
      if (result.user) {
        // Match by email
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, name, email, role, is_active')
          .eq('email', result.user.email)
          .single();
        if (user) {
          req.user = user;
        }
      }
    } catch (error) {
      // Token invalid, continue without user
    }
  }

  next();
};

// Authorize roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

// Admin only middleware
exports.adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Super admin only middleware
exports.superAdminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route'
    });
  }

  if (req.user.role !== 'superadmin') {
    return res.status(403).json({
      success: false,
      message: 'Super admin access required'
    });
  }
  next();
};
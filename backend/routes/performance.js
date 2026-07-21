const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');

// Performance monitoring endpoint (authenticated, admin only)
router.get('/', protect, asyncHandler(async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  const memUsage = process.memoryUsage();
  const uptime = process.uptime();

  res.json({
    success: true,
    data: {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      uptime: {
        seconds: Math.floor(uptime),
        minutes: Math.floor(uptime / 60),
        hours: Math.floor(uptime / 3600),
        days: Math.floor(uptime / 86400)
      },
      timestamp: new Date().toISOString()
    }
  });
}));

module.exports = router;
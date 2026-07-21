const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorHandler');
const { supabase } = require('../config/supabase');
const { get, set, buildKey, CACHE_PREFIXES } = require('../services/cacheService');

// @route   GET /api/settings
// @desc    Get public site settings
// @access  Public
router.get('/', asyncHandler(async (req, res) => {
  const cacheKey = buildKey(CACHE_PREFIXES.SETTINGS, 'public');
  const cached = await get(cacheKey);
  if (cached) {
    return res.json({ success: true, data: cached });
  }

  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;

  const settings = {};
  data.forEach(item => {
    try {
      settings[item.key] = typeof item.value === 'string' ? JSON.parse(item.value) : item.value;
    } catch {
      settings[item.key] = item.value;
    }
  });

  await set(cacheKey, settings, 600);

  res.json({
    success: true,
    data: settings
  });
}));

module.exports = router;

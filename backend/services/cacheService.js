const NodeCache = require('node-cache');
const { logger } = require('./logger');

const memoryCache = new NodeCache({ stdTTL: 300, checkperiod: 60, useClones: true });

const CACHE_PREFIXES = {
  EXAMS: 'exams:',
  EXAM: 'exam:',
  SUBJECTS: 'subjects:',
  QUESTIONS: 'questions:',
  QUESTION: 'question:',
  YEARS: 'years:',
  TIERS: 'tiers:',
  SHIFTS: 'shifts:',
  TOPICS: 'topics:',
  STATS: 'stats:',
  LEADERBOARD: 'leaderboard:',
  SEARCH: 'search:',
  SETTINGS: 'settings:',
  BOOKS: 'books:',
  SITEMAP: 'sitemap',
};

function buildKey(prefix, ...parts) {
  return `${prefix}${parts.filter(Boolean).join(':')}`;
}

async function get(key, fetchFn, ttl = 300) {
  const cached = memoryCache.get(key);
  if (cached !== undefined) return cached;

  if (typeof fetchFn === 'function') {
    const data = await fetchFn();
    if (data !== null && data !== undefined) {
      memoryCache.set(key, data, ttl);
    }
    return data;
  }
  return null;
}

async function set(key, data, ttl = 300) {
  memoryCache.set(key, data, ttl);
}

async function del(key) {
  memoryCache.del(key);
}

async function delPattern(pattern) {
  const normalizedPattern = pattern.replace('*', '');
  const keys = memoryCache.keys().filter(k => k.startsWith(normalizedPattern));
  keys.forEach(k => memoryCache.del(k));
}

function getStats() {
  return {
    memory: memoryCache.getStats(),
    redisReady: false,
    memoryKeys: memoryCache.keys().length,
  };
}

module.exports = {
  get, set, del, delPattern, getStats, buildKey, CACHE_PREFIXES, memoryCache,
};

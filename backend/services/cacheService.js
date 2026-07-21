const NodeCache = require('node-cache');

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

module.exports = {
  get, set, del, buildKey, CACHE_PREFIXES,
};

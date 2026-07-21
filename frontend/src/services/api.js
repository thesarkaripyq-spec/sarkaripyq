import { supabase } from '../supabase';
import useAuthStore from '../store/authStore';

const API_BASE_URL = (process.env.REACT_APP_API_URL || '') + '/api/v1';

const cleanParams = (params) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== '' && value !== 'undefined' && value !== 'null') {
      cleaned[key] = value;
    }
  }
  return cleaned;
};

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 100;

const getCached = (key) => {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  cache.delete(key);
  return null;
};

const setCached = (key, data) => {
  if (cache.size >= MAX_CACHE_SIZE) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
  cache.set(key, { data, timestamp: Date.now() });
};

const inflightRequests = new Map();
const MAX_INFLIGHT = 50;
const getInflightKey = (method, url) => `${method || 'GET'}:${url}`;

const getAuthHeaders = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
};

const executeRequest = async (options = {}) => {
  const headers = await getAuthHeaders();
  const isFormData = options.body instanceof FormData;
  const defaultHeaders = isFormData ? {} : { 'Content-Type': 'application/json' };

  return fetch(options.url, {
    ...options,
    headers: { ...defaultHeaders, ...headers, ...options.headers }
  });
};

const dedupFetch = async (url, options = {}) => {
  const dedupKey = getInflightKey(options.method, url);
  
  if (options.method === undefined || options.method === 'GET') {
    const inflight = inflightRequests.get(dedupKey);
    if (inflight) return inflight;
  }

  const promise = executeRequest({ ...options, url });
  
  if (options.method === undefined || options.method === 'GET') {
    if (inflightRequests.size >= MAX_INFLIGHT) {
      inflightRequests.clear();
    }
    inflightRequests.set(dedupKey, promise);
    promise.finally(() => {
      if (inflightRequests.get(dedupKey) === promise) {
        inflightRequests.delete(dedupKey);
      }
    });
  }

  return promise;
};

const fetchFromBackend = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  let response = await dedupFetch(url, options);

  if (response.status === 401) {
    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();

    if (!refreshError && refreshData?.session) {
      response = await dedupFetch(url, options);
      if (response.ok) {
        const data = await response.json();
        return data;
      }
    }

    useAuthStore.getState().logout();
    throw new Error('Your session has expired. Please login again.');
  }

  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `API Error: ${response.status}`);
  return data;
};


// Auth API
export const authAPI = {
  login: async (data) => {
    const { email, password } = data;
    const { data: user, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return { data: user };
  },
  register: async (data) => {
    const url = `${API_BASE_URL}/auth/register`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        password: data.password,
        captchaAnswer: data.captchaAnswer,
        captchaToken: data.captchaToken
      })
    });
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Registration failed');
    return resData;
  },
  getCaptcha: async () => {
    const url = `${API_BASE_URL}/auth/captcha`;
    const response = await fetch(url);
    const resData = await response.json();
    if (!response.ok) throw new Error(resData.message || 'Failed to load CAPTCHA');
    return resData.data;
  },
};

// Exams API
export const examsAPI = {
  getAll: async () => {
    const cacheKey = 'exams_all';
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend('/exams');
    setCached(cacheKey, res);
    return res;
  },
  getBySlug: async (slug) => {
    const cacheKey = `exam_${slug}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/exams/${slug}`);
    setCached(cacheKey, res);
    return res;
  },
  getSubjects: async (examSlug, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    const cacheKey = `subjects_${examSlug}_${qs}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/exams/${examSlug}/subjects?${qs}`);
    setCached(cacheKey, res);
    return res;
  },
  getYears: async (examSlug, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    const cacheKey = `years_${examSlug}_${qs}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/exams/${examSlug}/years?${qs}`);
    setCached(cacheKey, res);
    return res;
  },
  getTiers: async (examSlug, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    const cacheKey = `tiers_${examSlug}_${qs}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/exams/${examSlug}/tiers?${qs}`);
    setCached(cacheKey, res);
    return res;
  },
  getShifts: async (examSlug, params = {}) => {
    const qs = new URLSearchParams(cleanParams(params)).toString();
    const cacheKey = `shifts_${examSlug}_${qs}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/exams/${examSlug}/shifts?${qs}`);
    setCached(cacheKey, res);
    return res;
  }
};

// Questions API
export const questionsAPI = {
  getAll: async (params = {}) => {
    try {
      const sanitized = cleanParams(params);
      const qs = new URLSearchParams();
      if (sanitized.exam) qs.set('exam', sanitized.exam);
      if (sanitized.subject) qs.set('subject', sanitized.subject);
      if (sanitized.year) qs.set('year', sanitized.year);
      if (sanitized.tier) qs.set('tier', sanitized.tier);
      if (sanitized.shift) qs.set('shift', sanitized.shift);
      if (sanitized.exam_date) qs.set('exam_date', sanitized.exam_date);
      if (sanitized.page) qs.set('page', sanitized.page);
      if (sanitized.limit) qs.set('limit', sanitized.limit);
      if (sanitized.random) qs.set('random', sanitized.random);
      if (sanitized.difficulty) qs.set('difficulty', sanitized.difficulty);
      if (sanitized.topic) qs.set('topic', sanitized.topic);
      if (sanitized.search) qs.set('search', sanitized.search);

      const cacheKey = `questions_${qs.toString()}`;
      if (params.random !== 'true') {
        const cached = getCached(cacheKey);
        if (cached) return cached;
      }

      const res = await fetchFromBackend(`/questions?${qs.toString()}`);
      const result = { data: res.data || [], pagination: res.pagination || {} };
      
      if (params.random !== 'true') {
        setCached(cacheKey, result);
      }
      return result;
    } catch (error) {
      console.error('Questions API error:', error);
      return { data: [], pagination: {} };
    }
  },
  getById: async (id) => {
    try {
      const cacheKey = `question_${id}`;
      const cached = getCached(cacheKey);
      if (cached) return cached;

      const res = await fetchFromBackend(`/questions/${id}`);
      const result = { data: res.data };
      setCached(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching question:', error);
      return { data: null };
    }
  },
  submitAttempt: async (questionId, { selectedAnswer, timeSpent, sessionId }) => {
    const res = await fetchFromBackend(`/questions/${questionId}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ selectedAnswer, timeSpent, sessionId })
    });
    return res;
  }
};

// Stats API
export const statsAPI = {
  getUserStats: async () => {
    try { return await fetchFromBackend('/stats/user'); }
    catch { return { data: { overview: { totalAttempts: 0, correctAnswers: 0, wrongAnswers: 0, accuracy: 0 }, dailyProgress: [], subjectPerformance: [], examwiseStats: [], recentAttempts: [] } }; }
  },
  getLeaderboard: async () => {
    try { return await fetchFromBackend('/stats/leaderboard'); }
    catch { return { data: { leaderboard: [], userRank: null, totalParticipants: 0 } }; }
  },
  resetScore: async () => {
    return fetchFromBackend('/stats/reset', { method: 'POST' });
  },
};

// Settings API
export const settingsAPI = {
  getPublic: async () => {
    try {
      return await fetchFromBackend('/settings');
    } catch {
      return { data: {} };
    }
  }
};

// Subjects API
export const subjectsAPI = {
  getBySlug: async (examSlug, subjectSlug) => {
    const cacheKey = `subject_${examSlug}_${subjectSlug}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;
    const res = await fetchFromBackend(`/subjects/${examSlug}/${subjectSlug}`);
    setCached(cacheKey, res);
    return res;
  }
};


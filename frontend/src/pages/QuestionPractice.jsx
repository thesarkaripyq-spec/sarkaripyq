import React, { useEffect, useState, useCallback, useMemo, memo } from 'react';
import { useSearchParams, Link, useNavigate, useParams } from 'react-router-dom';
import { FiFilter, FiX, FiRefreshCw, FiBookmark, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';
import SEOContentSection from '../components/Common/SEOContentSection';
import QuestionCard from '../components/Question/QuestionCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorBoundary from '../components/Common/ErrorBoundary';
import { questionsAPI, examsAPI } from '../services/api';
import { ALLOWED_SUBJECTS } from '../constants/subjects';
import { EXAM_MAPPINGS } from '../constants/examMappings';
import usePracticeStore from '../store/practiceStore';
import useAuthStore from '../store/authStore';
import toast from 'react-hot-toast';


// Skeleton layout displaying elegant pulsing boxes for maximum perceived mobile speed
const QuestionSkeleton = () => (
  <div className="space-y-6">
    {[1, 2, 3].map((n) => (
      <div key={n} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-6 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="w-24 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="space-y-2">
          <div className="w-full h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
          <div className="w-5/6 h-5 bg-slate-200 dark:bg-slate-700 rounded"></div>
        </div>
        <div className="space-y-2.5 pt-2">
          {[1, 2, 3, 4].map((o) => (
            <div key={o} className="w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"></div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

const formatShiftLabel = (s) => {
  if (!s) return '';
  if (typeof s === 'object') {
    if (s.exam_date && s.shift) {
      try {
        const date = new Date(s.exam_date);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        // Normalize shift name: extract number and format consistently
        const shiftStr = String(s.shift);
        const numMatch = shiftStr.match(/(\d+)/);
        const shiftNum = numMatch ? numMatch[1] : shiftStr;
        return `${day}-${month}-${year}  |  Shift ${shiftNum}`;
      } catch (e) {
        return `${s.exam_date}  |  ${s.shift}`;
      }
    }
    return s.shift || '';
  }
  return s;
};

const QuestionPractice = memo(({ examSlug: propExamSlug }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { examSlugWithSuffix, examSlug, secondSlugWithSuffix, subjectSlug, topicSlugWithSuffix } = useParams();
  const { isAuthenticated } = useAuthStore();
  
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [years, setYears] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [solvedToday, setSolvedToday] = useState(() => parseInt(localStorage.getItem('solvedToday') || '0', 10));
  const [bookmarkedIds, setBookmarkedIds] = useState(() => JSON.parse(localStorage.getItem('bookmarkedQuestions') || '[]'));
  const [searchQuery, setSearchQuery] = useState('');
  const [translatedQuestions, setTranslatedQuestions] = useState([]);
  const [translatingQuestions, setTranslatingQuestions] = useState(false);

  const freeAttemptLimit = 10;
  // eslint-disable-next-line no-unused-vars
  const pageSize = 10;

  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState(1);


  // Parse dynamic multi-tier URL slug taxonomy
  const routeParams = useMemo(() => {
    let exam = '';
    let subject = '';
    let year = '';
    let topic = '';

    const stripSuffix = (slug) => {
      if (!slug) return '';
      return slug.replace(/_previous_year_questio(ns|sn|n)?$/, '').replace(/_pyq(s)?$/, '');
    };

    if (propExamSlug) {
      exam = propExamSlug;
    } else if (examSlugWithSuffix) {
      exam = stripSuffix(examSlugWithSuffix);
    } else if (examSlug) {
      exam = examSlug;
      if (subjectSlug && topicSlugWithSuffix) {
        subject = subjectSlug;
        // Decode hyphenated topic slug (e.g. active-passive-voice -> active passive voice)
        topic = stripSuffix(topicSlugWithSuffix).replace(/-/g, ' ');
      } else if (secondSlugWithSuffix) {
        const strippedSecond = stripSuffix(secondSlugWithSuffix);
        if (/^\d{4}$/.test(strippedSecond)) {
          year = strippedSecond;
        } else {
          subject = strippedSecond;
        }
      }
    }

    return { exam, subject, year, topic };
  }, [examSlugWithSuffix, examSlug, secondSlugWithSuffix, subjectSlug, topicSlugWithSuffix, propExamSlug]);

  // Filters from URL/Route
  const [selectedExam, setSelectedExam] = useState(() => routeParams.exam || searchParams.get('exam') || '');
  const [selectedSubject, setSelectedSubject] = useState(() => routeParams.subject || searchParams.get('subject') || '');
  const [selectedTier, setSelectedTier] = useState(searchParams.get('tier') || '');
  const [selectedYear, setSelectedYear] = useState(() => routeParams.year || searchParams.get('year') || '');
  const [selectedShift, setSelectedShift] = useState(searchParams.get('shift') || '');
  const [selectedTopic, setSelectedTopic] = useState(() => routeParams.topic || searchParams.get('topic') || '');
  const [isRandom, setIsRandom] = useState(searchParams.get('random') === 'true');

  // Update URL params
  const updateFilters = useCallback((exam, subject, tier, year, shift, random, topic = '') => {
    const nextPage = 1;
    setSelectedExam(exam);
    setSelectedSubject(subject);
    setSelectedTier(tier);
    setSelectedYear(year);
    setSelectedShift(shift);
    setIsRandom(random);
    setSelectedTopic(topic);
    setCurrentPage(nextPage);

    const params = new URLSearchParams();
    if (tier) params.set('tier', tier);
    if (shift) params.set('shift', shift);
    if (random) params.set('random', 'true');
    params.set('page', String(nextPage));

    const searchStr = params.toString();
    const querySuffix = searchStr ? `?${searchStr}` : '';

    const activeExam = exam || 'ssc-cgl';

    if (subject && topic) {
      const topicSlug = topic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      navigate(`/ssc/${activeExam}/${subject}/${topicSlug}_previous_year_questions${querySuffix}`);
    } else if (subject) {
      navigate(`/ssc/${activeExam}/${subject}_previous_year_questions${querySuffix}`);
    } else if (year) {
      navigate(`/ssc/${activeExam}/${year}_previous_year_questions${querySuffix}`);
    } else {
      navigate(`/ssc/${activeExam}_previous_year_questions${querySuffix}`);
    }
  }, [navigate]);

  const fallbackExams = useMemo(() => [
    { slug: 'ssc-cgl', name: 'SSC CGL', shortName: 'SSC CGL' },
    { slug: 'ssc-chsl', name: 'SSC CHSL', shortName: 'SSC CHSL' },
    { slug: 'ssc-gd', name: 'SSC GD', shortName: 'SSC GD' },
    { slug: 'ssc-cpo', name: 'SSC CPO', shortName: 'SSC CPO' },
    { slug: 'ssc-mts', name: 'SSC MTS', shortName: 'SSC MTS' },
    { slug: 'ssc-stenographer', name: 'SSC Stenographer', shortName: 'SSC Stenographer' },
    { slug: 'ssc-selection-post', name: 'SSC Selection Post', shortName: 'SSC Selection Post' },
  ], []);

  const examList = useMemo(() => {
    return (exams?.length) ? exams : fallbackExams;
  }, [exams, fallbackExams]);

  const getExamMapping = useCallback((examSlug) => {
    const examObj = examList.find((exam) => exam.slug === examSlug);
    const examName = examObj?.shortName || examObj?.name;
    return EXAM_MAPPINGS.find((mapping) => mapping.name === examName);
  }, [examList]);

  const { 
    questions, 
    setQuestions, 
    sessionStats,
    submitAnswer,
    showExplanation,
    toggleExplanation,
    answers,
    resetSession
  } = usePracticeStore();

  // Canonical Redirections to enforce lowercase SEO-friendly URLs and prevent duplicate content
  useEffect(() => {
    const currentPath = window.location.pathname;
    // Check if there are uppercase letters in the path
    if (/[A-Z]/.test(currentPath)) {
      const lowercasePath = currentPath.toLowerCase();
      const searchStr = searchParams.toString();
      const urlSuffix = searchStr ? `?${searchStr}` : '';
      navigate(`${lowercasePath}${urlSuffix}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Sync URL route params to selected filter states + handle legacy redirect
  useEffect(() => {
    const rp = routeParams;
    const hasRouteParams = rp.exam || rp.subject || rp.year || rp.topic;
    
    if (hasRouteParams) {
      setSelectedExam(rp.exam || '');
      setSelectedSubject(rp.subject || '');
      setSelectedYear(rp.year || '');
      setSelectedTopic(rp.topic || '');
    }

    const examParam = searchParams.get('exam');
    const subjectParam = searchParams.get('subject');
    const yearParam = searchParams.get('year');
    const topicParam = searchParams.get('topic');

    if ((examParam || subjectParam || yearParam || topicParam) && !examSlugWithSuffix && !examSlug) {
      const activeExam = examParam || 'ssc-cgl';
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('exam');
      newParams.delete('subject');
      newParams.delete('year');
      newParams.delete('topic');

      const searchStr = newParams.toString();
      const urlSuffix = searchStr ? `?${searchStr}` : '';

      if (subjectParam && topicParam) {
        const topicSlug = topicParam.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
        navigate(`/ssc/${activeExam}/${subjectParam}/${topicSlug}_previous_year_questions${urlSuffix}`, { replace: true });
      } else if (subjectParam) {
        navigate(`/ssc/${activeExam}/${subjectParam}_previous_year_questions${urlSuffix}`, { replace: true });
      } else if (yearParam) {
        navigate(`/ssc/${activeExam}/${yearParam}_previous_year_questions${urlSuffix}`, { replace: true });
      } else {
        navigate(`/ssc/${activeExam}_previous_year_questions${urlSuffix}`, { replace: true });
      }
    }
  }, [routeParams, searchParams, examSlugWithSuffix, examSlug, navigate]);

  const FILTER_FALLBACKS = useMemo(() => ({
    years: [2025, 2024, 2023, 2022],
    tiers: ['Tier-I', 'Tier-II', 'Tier-III', 'Tier-IV'],
    shifts: ['Shift 1', 'Shift 2', 'Shift 3']
  }), []);

  // Fetch exams on mount only
  useEffect(() => {
    let cancelled = false;
    const fetchExams = async () => {
      try {
        const examRes = await examsAPI.getAll();
        if (cancelled) return;
        const examData = examRes?.data || [];
        setExams(Array.isArray(examData) ? examData : []);
      } catch (error) {
        if (cancelled) return;
        console.error('Error fetching exams:', error);
        setExams([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchExams();
    return () => { cancelled = true; };
  }, []);

  // Fetch fallback filter options when no exam selected
  useEffect(() => {
    if (selectedExam) return;
    setYears(FILTER_FALLBACKS.years);
    setTiers(FILTER_FALLBACKS.tiers);
    setShifts(FILTER_FALLBACKS.shifts);
  }, [selectedExam, FILTER_FALLBACKS]);

  // Fetch all filter options dynamically when any filter selection changes
  useEffect(() => {
    if (!selectedExam) {
      setSubjects([]);
      setSelectedSubject('');
      setSelectedTier('');
      setSelectedYear('');
      setSelectedShift('');
      return;
    }

    let cancelled = false;
    const fetchAllFilters = async () => {
      try {
        const mapping = getExamMapping(selectedExam);
        const [subjectsRes, tiersRes, yearsRes, shiftsRes] = await Promise.all([
          examsAPI.getSubjects(selectedExam, {
            tier: selectedTier || undefined,
            year: selectedYear || undefined,
            shift: selectedShift || undefined
          }),
          examsAPI.getTiers(selectedExam, {
            subject: selectedSubject || undefined,
            year: selectedYear || undefined,
            shift: selectedShift || undefined
          }),
          examsAPI.getYears(selectedExam, {
            subject: selectedSubject || undefined,
            tier: selectedTier || undefined,
            shift: selectedShift || undefined
          }),
          examsAPI.getShifts(selectedExam, {
            subject: selectedSubject || undefined,
            tier: selectedTier || undefined,
            year: selectedYear || undefined
          })
        ]);

        if (cancelled) return;

        // --- 1. Process Subjects ---
        const allowedFiltered = (subjectsRes.data || [])?.filter(subject =>
          ALLOWED_SUBJECTS.some(allowed => allowed.slug === subject.slug || allowed.name === subject.name)
        ) || [];
        const mappingFiltered = mapping?.subjects?.length
          ? allowedFiltered.filter(subject => mapping.subjects.includes(subject.name))
          : allowedFiltered;
        const fallbackSubjects = mapping?.subjects?.length
          ? ALLOWED_SUBJECTS.filter(subject => mapping.subjects.includes(subject.name)).map(s => ({ ...s, questionCount: 0 }))
          : [];
        const finalSubjects = mappingFiltered.length ? mappingFiltered : fallbackSubjects;
        setSubjects(finalSubjects);

        // --- 2. Process Tiers ---
        const tierData = Array.isArray(tiersRes.data) ? tiersRes.data : [];
        let filteredTiers = tierData;
        if (mapping?.tiers?.length) {
          filteredTiers = tierData.filter(t => mapping.tiers.includes(t));
          if (!filteredTiers.length) filteredTiers = mapping.tiers;
        }
        setTiers(filteredTiers);

        // --- 3. Process Years ---
        const yearsData = (yearsRes.data || []).map(y => typeof y === 'object' ? y.year : y).filter(Boolean);
        setYears(yearsData.length > 0 ? yearsData : FILTER_FALLBACKS.years);

        // --- 4. Process Shifts ---
        const shiftsData = shiftsRes.data || [];
        setShifts(shiftsData);

        // --- 5. Validate & Clear Invalid Selections ---
        // If current selection is not in the newly fetched valid options, clear it.
        // This prevents combinations returning zero results.
        let updatedSubject = selectedSubject;
        let updatedTier = selectedTier;
        let updatedYear = selectedYear;
        let updatedShift = selectedShift;

        if (selectedSubject && !finalSubjects.some(s => s.slug === selectedSubject)) {
          updatedSubject = '';
        }
        if (selectedTier && !filteredTiers.some(t => (typeof t === 'object' ? t.slug : t) === selectedTier)) {
          updatedTier = '';
        }
        if (selectedYear) {
          const allowedYearsList = yearsData.length > 0 ? yearsData : FILTER_FALLBACKS.years;
          if (!allowedYearsList.includes(Number(selectedYear))) {
            updatedYear = '';
          }
        }
        if (selectedShift) {
          const isValidShift = shiftsData.some(s => {
            const val = typeof s === 'object' 
              ? (s.exam_date ? `${s.exam_date.substring(0, 10)}_${s.shift}` : s.shift) 
              : s;
            return val === selectedShift;
          });
          if (!isValidShift) {
            updatedShift = '';
          }
        }

        // If any selections were cleared, update state and URL to keep things in sync
        if (
          updatedSubject !== selectedSubject ||
          updatedTier !== selectedTier ||
          updatedYear !== selectedYear ||
          updatedShift !== selectedShift
        ) {
          updateFilters(
            selectedExam,
            updatedSubject,
            updatedTier,
            updatedYear,
            updatedShift,
            isRandom,
            selectedTopic
          );
        }
      } catch (error) {
        if (!cancelled) console.error('Error fetching dynamic filters:', error);
      }
    };

    fetchAllFilters();
    return () => { cancelled = true; };
  }, [
    selectedExam,
    selectedSubject,
    selectedTier,
    selectedYear,
    selectedShift,
    getExamMapping,
    FILTER_FALLBACKS,
    isRandom,
    selectedTopic,
    updateFilters
  ]);

  // Fetch questions when filters change
  const fetchQuestions = useCallback(async () => {
    setQuestionsLoading(true);
    try {
      const questionIdParam = searchParams.get('q');
      if (questionIdParam) {
        const response = await questionsAPI.getById(questionIdParam);
        if (response?.data) {
          setQuestions([response.data]);
          setTotalPages(1);
          setQuestionsLoading(false);
          return;
        }
      }

      const params = { limit: 10, page: currentPage };
      if (selectedExam) params.exam = selectedExam;
      if (selectedSubject) params.subject = selectedSubject;
      if (selectedTier) params.tier = selectedTier;
      if (selectedYear) params.year = selectedYear;
      if (selectedShift) {
        if (selectedShift.includes('_')) {
          const [datePart, shiftPart] = selectedShift.split('_');
          params.exam_date = datePart;
          params.shift = shiftPart;
        } else {
          params.shift = selectedShift;
        }
      }
      if (selectedTopic) params.topic = selectedTopic;
      if (isRandom) params.random = 'true';
      if (searchQuery?.trim().length >= 2) {
        params.search = searchQuery.trim();
      }

      const response = await questionsAPI.getAll(params);
      setQuestions(response.data || []);
      setTotalPages(response.pagination?.pages || 1);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error('Failed to load questions');
    } finally {
      setQuestionsLoading(false);
    }
  }, [selectedExam, selectedSubject, selectedTier, selectedYear, selectedShift, selectedTopic, isRandom, currentPage, searchQuery, searchParams, setQuestions]);

  // Debounced fetch to prevent excessive API calls during filter changes
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchQuestions();
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [fetchQuestions, selectedExam, selectedSubject, selectedTier, selectedYear, selectedShift, selectedTopic, isRandom, currentPage, searchQuery]);

  // Prefetch the next page of questions in the background
  useEffect(() => {
    if (currentPage < totalPages && questions.length > 0) {
      const timer = setTimeout(() => {
        const params = { limit: 10, page: currentPage + 1 };
        if (selectedExam) params.exam = selectedExam;
        if (selectedSubject) params.subject = selectedSubject;
        if (selectedTier) params.tier = selectedTier;
        if (selectedYear) params.year = selectedYear;
        if (selectedShift) {
          if (selectedShift.includes('_')) {
            const [datePart, shiftPart] = selectedShift.split('_');
            params.exam_date = datePart;
            params.shift = shiftPart;
          } else {
            params.shift = selectedShift;
          }
        }
        if (selectedTopic) params.topic = selectedTopic;
        if (isRandom) params.random = 'true';
        if (searchQuery?.trim().length >= 2) {
          params.search = searchQuery.trim();
        }
        questionsAPI.getAll(params).catch(err => console.debug('Prefetch failed', err));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, totalPages, questions, selectedExam, selectedSubject, selectedTier, selectedYear, selectedShift, selectedTopic, isRandom, searchQuery]);



  const handleRefresh = useCallback(() => {
    resetSession();
    fetchQuestions();
  }, [resetSession, fetchQuestions]);

  const goToPage = useCallback((page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    setCurrentPage(page);
    const params = new URLSearchParams(searchParams);
    params.set('page', String(page));
    setSearchParams(params);
  }, [searchParams, setSearchParams, totalPages, currentPage]);

  const handleAnswer = useCallback(async (questionId, selectedOption, isCorrect) => {
    if (!isAuthenticated && sessionStats.attempted >= freeAttemptLimit) {
      setShowLoginGate(true);
      return;
    }
    submitAnswer(questionId, selectedOption, isCorrect);

    // Update Streak and Solved Today Counters locally
    const newSolved = solvedToday + 1;
    setSolvedToday(newSolved);
    localStorage.setItem('solvedToday', String(newSolved));
    
    // Update last solved date locally for reference
    const todayStr = new Date().toDateString();
    localStorage.setItem('lastSolvedDate', todayStr);

    // Increment question attempts for local analytics
    try {
      const localAnalytics = JSON.parse(localStorage.getItem('practice_analytics') || '{}');
      localAnalytics.total_solved_count = (localAnalytics.total_solved_count || 0) + 1;
      localStorage.setItem('practice_analytics', JSON.stringify(localAnalytics));
    } catch (e) {
      console.error(e);
    }

    if (isAuthenticated) {
      try {
        await questionsAPI.submitAttempt(questionId, {
          selectedAnswer: selectedOption,
          timeSpent: 30
        });
      } catch (error) {
        console.error('Error submitting answer:', error);
        if (error.message?.includes('session has expired')) {
          useAuthStore.getState().logout();
          toast.error('Session expired. Please login again.');
        } else {
          toast.error('Failed to save your answer. Check your connection and try again.');
        }
      }
    }
  }, [isAuthenticated, sessionStats.attempted, submitAnswer, solvedToday, questions]);

  const handleBookmarkToggle = useCallback((questionId) => {
    let updated;
    if (bookmarkedIds.includes(questionId)) {
      updated = bookmarkedIds.filter(id => id !== questionId);
      toast.success('Removed from bookmarks');
    } else {
      updated = [...bookmarkedIds, questionId];
      toast.success('Question bookmarked successfully!');
    }
    setBookmarkedIds(updated);
    localStorage.setItem('bookmarkedQuestions', JSON.stringify(updated));
  }, [bookmarkedIds]);

  // Reset solved today count daily
  useEffect(() => {
    const todayStr = new Date().toDateString();
    const lastActiveDate = localStorage.getItem('lastActiveDate');

    if (lastActiveDate !== todayStr) {
      localStorage.setItem('lastActiveDate', todayStr);
      setSolvedToday(0);
      localStorage.setItem('solvedToday', '0');
    }
  }, []);

  // Save active practice session details for continuance and programmatic analytics
  useEffect(() => {
    if (loading) return;
    const fullPath = window.location.pathname + window.location.search;
    localStorage.setItem('last_practice_path', fullPath);
    
    // Save attempted exams analytics
    if (selectedExam) {
      try {
        const localAnalytics = JSON.parse(localStorage.getItem('practice_analytics') || '{}');
        const examAttempts = localAnalytics.most_attempted_exams || {};
        examAttempts[selectedExam] = (examAttempts[selectedExam] || 0) + 1;
        localAnalytics.most_attempted_exams = examAttempts;
        localStorage.setItem('practice_analytics', JSON.stringify(localAnalytics));
      } catch (e) {
        console.error('Analytics log error:', e);
      }
    }
  }, [loading, selectedExam, selectedSubject, selectedYear, selectedTier, selectedShift, isRandom, currentPage]);


  // Sync store questions to local display state (translation is no-op for English)
  useEffect(() => {
    setTranslatedQuestions(questions || []);
  }, [questions]);

  const clearFilters = useCallback(() => {
    updateFilters('', '', '', '', '', false);
    resetSession();
  }, [updateFilters, resetSession]);

  const selectedExamName = useMemo(() => {
    if (!selectedExam) return '';
    const examObj = examList.find((exam) => exam.slug === selectedExam);
    return examObj?.name || examObj?.shortName || selectedExam.toUpperCase().replace(/-/g, ' ');
  }, [selectedExam, examList]);

  const selectedSubjectName = useMemo(() => {
    if (!selectedSubject) return '';
    const subObj = subjects.find((sub) => sub.slug === selectedSubject);
    return subObj?.name || selectedSubject.toUpperCase().replace(/-/g, ' ');
  }, [selectedSubject, subjects]);

  const seoTitle = useMemo(() => {
    const parts = [];
    if (selectedExamName) parts.push(selectedExamName);
    if (selectedSubjectName) parts.push(selectedSubjectName);
    if (selectedTopic) parts.push(selectedTopic.replace(/\b\w/g, c => c.toUpperCase()));
    if (selectedYear) parts.push(selectedYear);
    
    if (parts.length > 0) {
      return `${parts.join(' ')} Previous Year Questions - Free PYQ Practice Online`;
    }
    return "SSC Previous Year Questions - Free PYQ Practice Online";
  }, [selectedExamName, selectedSubjectName, selectedTopic, selectedYear]);

  const seoDescription = useMemo(() => {
    const examStr = selectedExamName || 'SSC';
    const subStr = selectedSubjectName ? ` for ${selectedSubjectName}` : '';
    const topicStr = selectedTopic ? ` on ${selectedTopic}` : '';
    const yearStr = selectedYear ? ` asked in ${selectedYear}` : '';
    
    return `Practice real solved ${examStr} Previous Year Questions (PYQs)${subStr}${topicStr}${yearStr} online. Get instant results, detailed bilingual explanations, performance analytics & smart mock tests for free.`;
  }, [selectedExamName, selectedSubjectName, selectedTopic, selectedYear]);

  const seoKeywords = useMemo(() => {
    const base = [
      'SSC PYQ', 'SSC previous year questions', 'SSC exam practice', 
      'SSC online test', 'SSC mock test', 'SSC question bank',
      'SSC practice questions', 'SSC exam preparation', 'SARKARIPYQ'
    ];
    const examKeyword = selectedExamName ? `${selectedExamName} PYQ` : 'SSC CGL PYQ';
    const subjectKeyword = (selectedExamName && selectedSubjectName) ? `${selectedExamName} ${selectedSubjectName} PYQ` : '';
    const yearKeyword = (selectedExamName && selectedYear) ? `${selectedExamName} ${selectedYear} previous year paper` : '';
    const topicKeyword = (selectedSubjectName && selectedTopic) ? `${selectedSubjectName} ${selectedTopic} questions` : '';

    return [examKeyword, subjectKeyword, yearKeyword, topicKeyword, ...base].filter(Boolean);
  }, [selectedExamName, selectedSubjectName, selectedTopic, selectedYear]);

  const canonicalUrl = useMemo(() => {
    const origin = window.location.origin;
    if (propExamSlug) {
      return `${origin}/${propExamSlug}-pyq`;
    }
    const activeExam = selectedExam || 'ssc-cgl';
    if (selectedSubject && selectedTopic) {
      const topicSlug = selectedTopic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      return `${origin}/ssc/${activeExam}/${selectedSubject}/${topicSlug}_previous_year_questions`;
    }
    if (selectedSubject) {
      return `${origin}/ssc/${activeExam}/${selectedSubject}_previous_year_questions`;
    }
    if (selectedYear) {
      return `${origin}/ssc/${activeExam}/${selectedYear}_previous_year_questions`;
    }
    return `${origin}/ssc/${activeExam}_previous_year_questions`;
  }, [selectedExam, selectedSubject, selectedTopic, selectedYear, propExamSlug]);

  const examFaqs = useMemo(() => {
    const examName = selectedExamName || 'SSC Exams';
    return [
      {
        question: `What are ${examName} Previous Year Questions (PYQs)?`,
        answer: `${examName} Previous Year Questions are actual MCQs that were asked in prior administrations of the Staff Selection Commission ${examName} exams. Practicing these is the most effective way to understand the exam pattern, difficulty level, and question types.`
      },
      {
        question: `How many ${examName} PYQs are available for practice on SarkariPYQ?`,
        answer: `SarkariPYQ offers thousands of authentic, full-length ${examName} solved questions spanning major recent years. New question batches are continually uploaded and processed automatically.`
      },
      {
        question: `Are detailed bilingual explanations and solutions provided?`,
        answer: `Yes, every ${examName} question on SarkariPYQ includes comprehensive, step-by-step explanations in both English and Hindi, complete with KaTeX mathematical rendering where applicable.`
      },
      {
        question: `Can I practice ${examName} questions topic-wise or subject-wise?`,
        answer: `Absolutely! You can filter ${examName} questions by subject (e.g. English Language, Quantitative Aptitude), specific years, and even dynamic topics to focus on your weak areas.`
      },
      {
        question: `Is it free to practice ${examName} previous year papers on this platform?`,
        answer: `Yes, SarkariPYQ is a 100% free platform created specifically for SSC aspirants. You can attempt questions online with instant grading and explanations without any charges.`
      }
    ];
  }, [selectedExamName]);

  const structuredData = useMemo(() => {
    const origin = window.location.origin;
    const items = [
      {
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": "SarkariPYQ",
        "url": origin,
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${origin}/ssc/ssc-cgl_previous_year_questions?search={search_term_string}`,
          "query-input": "required name=search_term_string"
        }
      },
      {
        "@context": "https://schema.org",
        "@type": "Organization",
        "name": "SarkariPYQ",
        "url": origin,
        "logo": `${origin}/ssc-logo.webp`
      }
    ];

    // Breadcrumbs
    const breadcrumbs = [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": origin }
    ];
    let currentPath = `${origin}/ssc/${selectedExam || 'ssc-cgl'}_previous_year_questions`;
    breadcrumbs.push({
      "@type": "ListItem",
      "position": 2,
      "name": selectedExamName || "SSC CGL",
      "item": currentPath
    });

    if (selectedSubjectName) {
      currentPath = `${origin}/ssc/${selectedExam || 'ssc-cgl'}/${selectedSubject}_previous_year_questions`;
      breadcrumbs.push({
        "@type": "ListItem",
        "position": 3,
        "name": selectedSubjectName,
        "item": currentPath
      });
    }

    if (selectedTopic) {
      const topicSlug = selectedTopic.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');
      currentPath = `${origin}/ssc/${selectedExam || 'ssc-cgl'}/${selectedSubject}/${topicSlug}_previous_year_questions`;
      breadcrumbs.push({
        "@type": "ListItem",
        "position": 4,
        "name": selectedTopic,
        "item": currentPath
      });
    }

    items.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      "itemListElement": breadcrumbs
    });

    // CollectionPage
    items.push({
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": seoTitle,
      "description": seoDescription,
      "url": canonicalUrl
    });

    // FAQPage schema dynamically generated from examFaqs
    items.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": examFaqs.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer
        }
      }))
    });

    // ItemList for questions if present
    if (translatedQuestions && translatedQuestions.length > 0) {
      items.push({
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": `${seoTitle} - Questions List`,
        "numberOfItems": translatedQuestions.length,
        "itemListElement": translatedQuestions.map((q, idx) => {
          const textVal = q.question_text || q.questionText || '';
          return {
            "@type": "ListItem",
            "position": idx + 1,
            "name": textVal.slice(0, 100) + '...',
            "url": `${origin}/ssc/${selectedExam || 'ssc-cgl'}_previous_year_questions` // Points to search list page
          };
        })
      });
    }

    return items;
  }, [selectedExam, selectedExamName, selectedSubject, selectedSubjectName, selectedTopic, seoTitle, seoDescription, canonicalUrl, questions, examFaqs]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  return (
    <>
      <SEOHead 
        title={seoTitle}
        description={seoDescription}
        keywords={seoKeywords}
        canonicalUrl={canonicalUrl}
        ogImage="/ssc-logo.webp"
        structuredData={structuredData}
      />

      <div className="bg-gray-50 min-h-screen">
        {/* Visual Breadcrumb Navigation */}
        <div className="bg-slate-100 border-b border-slate-200 py-1 sm:py-2">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-xs sm:text-sm text-slate-600 flex flex-nowrap items-center gap-1.5 font-medium overflow-x-auto whitespace-nowrap scroll-x-chips">
            <Link to="/" className="hover:text-blue-600 transition-colors">Home</Link>
            <span>/</span>
            <Link 
              to={`/ssc/${selectedExam || 'ssc-cgl'}_previous_year_questions`} 
              className={`hover:text-blue-600 transition-colors ${(!selectedSubject && !selectedYear && !selectedTopic) ? 'text-slate-900 font-bold' : ''}`}
            >
              {selectedExamName || 'SSC CGL'}
            </Link>
            
            {selectedSubjectName && (
              <>
                <span>/</span>
                <Link 
                  to={`/ssc/${selectedExam || 'ssc-cgl'}/${selectedSubject}_previous_year_questions`}
                  className={`hover:text-blue-600 transition-colors ${!selectedTopic ? 'text-slate-900 font-bold' : ''}`}
                >
                  {selectedSubjectName}
                </Link>
              </>
            )}

            {selectedYear && (
              <>
                <span>/</span>
                <span className="text-slate-900 font-bold">{selectedYear}</span>
              </>
            )}

            {selectedTopic && (
              <>
                <span>/</span>
                <span className="text-slate-900 font-bold truncate max-w-[200px]" title={selectedTopic}>
                  {selectedTopic}
                </span>
              </>
            )}
          </div>
        </div>
        {showLoginGate && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center px-4" role="dialog" aria-modal="true" aria-label="Login required">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-2" id="login-gate-title">Login required</h3>
              <p className="text-gray-600 mb-4">
                You’ve reached the free limit of {freeAttemptLimit} questions. Log in to continue and track your progress.
              </p>
              <div className="flex flex-col gap-3">
                <Link to="/login" className="btn btn-primary">Login</Link>
                <Link to="/register" className="btn btn-outline">Sign Up</Link>
                <button
                  onClick={() => setShowLoginGate(false)}
                  className="btn btn-secondary"
                >
                  Continue later
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Header */}
        <div className="bg-white border-b sticky top-14 lg:top-20 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2.5">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="text-left flex-grow min-w-0 hidden sm:block">
                <h1 className="text-sm sm:text-xl font-bold text-gray-900 leading-tight truncate">
                  {selectedExamName 
                    ? `Practice real ${selectedExamName} PYQs asked in actual exams`
                    : 'Practice real SSC PYQs asked in actual exams'}
                </h1>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0 w-full sm:w-auto justify-between sm:justify-end">
                <button 
                  onClick={handleRefresh}
                  className="btn btn-outline btn-sm min-h-[30px] sm:min-h-[38px] px-2 sm:px-3 flex items-center justify-center"
                  title="Load new questions"
                >
                  <FiRefreshCw className="w-3.5 sm:w-4 h-3.5 sm:h-4" />
                </button>
                
                {/* Mobile Filter Action Button */}
                <button 
                  onClick={() => setIsMobileDrawerOpen(true)}
                  className="btn btn-primary btn-sm md:hidden min-h-[30px] px-2.5 flex items-center gap-1 font-bold text-xs"
                >
                  <FiFilter className="w-4 h-4" />
                  <span>Filters</span>
                  {selectedExam || selectedSubject || selectedTier || selectedYear || selectedShift ? (
                    <span className="w-2.5 h-2.5 bg-yellow-400 rounded-full inline-block"></span>
                  ) : null}
                </button>
              </div>
            </div>

            {/* Desktop Filters Grid (Hidden on Mobile) */}
            <div className="hidden md:grid grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-3 pt-2">
              {!selectedExam && (
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Exam</label>
                  <select
                    value={selectedExam}
                    onChange={(e) => updateFilters(e.target.value, '', '', selectedYear, '', isRandom)}
                    className="w-full form-select text-sm py-2 px-2"
                  >
                    <option value="">All Exams</option>
                    {(exams || []).map((exam) => (
                      <option key={exam.id || exam.slug} value={exam.slug}>
                        {exam.shortName || exam.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Year</label>
                <select
                  value={selectedYear}
                  onChange={(e) => updateFilters(selectedExam, selectedSubject, selectedTier, e.target.value, selectedShift, isRandom)}
                  className="w-full form-select text-sm py-2 px-2"
                >
                  <option value="">All Years</option>
                  {(years || []).map((y) => (
                    <option key={typeof y === 'object' ? y.year : y} value={typeof y === 'object' ? y.year : y}>
                      {typeof y === 'object' ? `${y.year} (${y.questionCount || ''})` : y}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Tier</label>
                <select
                  value={selectedTier}
                  onChange={(e) => updateFilters(selectedExam, selectedSubject, e.target.value, selectedYear, selectedShift, isRandom)}
                  className="w-full form-select text-sm py-2 px-2"
                >
                  <option value="">All Tiers</option>
                  {(tiers || []).map((t) => (
                    <option key={typeof t === 'object' ? t.slug : t} value={typeof t === 'object' ? t.slug : t}>
                      {typeof t === 'object' ? (t.name || t.shortName) : t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Shift</label>
                <select
                  value={selectedShift}
                  onChange={(e) => updateFilters(selectedExam, selectedSubject, selectedTier, selectedYear, e.target.value, isRandom)}
                  className="w-full form-select text-sm py-2 px-2"
                >
                  <option value="">All Shifts</option>
                  {(shifts || []).map((s) => {
                    const shiftVal = typeof s === 'object' 
                      ? (s.exam_date ? `${s.exam_date.substring(0, 10)}_${s.shift}` : s.shift) 
                      : s;
                    const shiftLbl = formatShiftLabel(s);
                    return <option key={shiftVal} value={shiftVal}>{shiftLbl}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Subject</label>
                <select
                  value={selectedSubject}
                  onChange={(e) => updateFilters(selectedExam, e.target.value, selectedTier, selectedYear, selectedShift, isRandom)}
                  className="w-full form-select text-sm py-2 px-2"
                >
                  <option value="">All Subjects</option>
                  {(subjects || []).map((sub) => (
                    <option key={sub.id || sub.slug} value={sub.slug}>{sub.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">&nbsp;</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateFilters(selectedExam, selectedSubject, selectedTier, selectedYear, selectedShift, !isRandom)}
                    className={`flex-1 px-3 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-1.5 transition-colors ${
                      isRandom ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Shuffle
                  </button>
                  <button 
                    onClick={clearFilters} 
                    disabled={!selectedExam && !selectedSubject && !selectedTier && !selectedYear && !selectedShift}
                    className="px-3 py-2 text-sm font-medium text-blue-700 hover:text-blue-800 bg-blue-100 hover:bg-blue-200 rounded-md flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <FiX size={14} />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Horizontal scroll tags (Display active filters) */}
            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap py-1 md:hidden scrollbar-none scroll-x-chips">
              {selectedExam && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 text-xs rounded-full font-medium border border-blue-100">{selectedExam.toUpperCase()}</span>}
              {selectedYear && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 text-xs rounded-full font-medium border border-blue-100">{selectedYear}</span>}
              {selectedTier && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 text-xs rounded-full font-medium border border-blue-100">{selectedTier}</span>}
              {selectedShift && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 text-xs rounded-full font-medium border border-blue-100">{selectedShift}</span>}
              {selectedSubject && <span className="bg-blue-50 text-blue-700 px-2.5 py-1 text-xs rounded-full font-medium border border-blue-100">{selectedSubjectName}</span>}
              {isRandom && <span className="bg-purple-50 text-purple-700 px-2.5 py-1 text-xs rounded-full font-medium border border-purple-100">Shuffle Active</span>}
            </div>
          </div>
        </div>

        {/* Mobile Slide-up Overlay Drawer for Filters */}
        {isMobileDrawerOpen && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Filter practice sets">
            <div className="bg-white rounded-t-3xl shadow-2xl w-full max-h-[85vh] flex flex-col pb-safe">
              {/* Drawer Header */}
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <span className="text-base font-bold text-slate-900">Filter Practice Sets</span>
                <button 
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="p-1 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Selectors list */}
              <div className="p-5 space-y-4 overflow-y-auto flex-grow text-left">
                {!selectedExam && (
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Exam</label>
                    <select
                      value={selectedExam}
                      onChange={(e) => updateFilters(e.target.value, '', '', selectedYear, '', isRandom)}
                      className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none focus:outline-none"
                    >
                      <option value="">All Exams</option>
                      {(exams || []).map((exam) => (
                        <option key={exam.id || exam.slug} value={exam.slug}>
                          {exam.shortName || exam.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => updateFilters(selectedExam, selectedSubject, selectedTier, e.target.value, selectedShift, isRandom)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none focus:outline-none"
                  >
                    <option value="">All Years</option>
                    {(years || []).map((y) => (
                      <option key={typeof y === 'object' ? y.year : y} value={typeof y === 'object' ? y.year : y}>
                        {typeof y === 'object' ? `${y.year} (${y.questionCount || ''})` : y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tier</label>
                  <select
                    value={selectedTier}
                    onChange={(e) => updateFilters(selectedExam, selectedSubject, e.target.value, selectedYear, selectedShift, isRandom)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none focus:outline-none"
                  >
                    <option value="">All Tiers</option>
                    {(tiers || []).map((t) => (
                      <option key={typeof t === 'object' ? t.slug : t} value={typeof t === 'object' ? t.slug : t}>
                        {typeof t === 'object' ? (t.name || t.shortName) : t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Shift</label>
                  <select
                    value={selectedShift}
                    onChange={(e) => updateFilters(selectedExam, selectedSubject, selectedTier, selectedYear, e.target.value, isRandom)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none focus:outline-none"
                  >
                    <option value="">All Shifts</option>
                    {(shifts || []).map((s) => {
                      const shiftVal = typeof s === 'object' 
                        ? (s.exam_date ? `${s.exam_date.substring(0, 10)}_${s.shift}` : s.shift) 
                        : s;
                      const shiftLbl = formatShiftLabel(s);
                      return <option key={shiftVal} value={shiftVal}>{shiftLbl}</option>;
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Subject</label>
                  <select
                    value={selectedSubject}
                    onChange={(e) => updateFilters(selectedExam, e.target.value, selectedTier, selectedYear, selectedShift, isRandom)}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:ring-2 focus:ring-blue-500 appearance-none focus:outline-none"
                  >
                    <option value="">All Subjects</option>
                    {(subjects || []).map((sub) => (
                      <option key={sub.id || sub.slug} value={sub.slug}>{sub.name}</option>
                    ))}
                  </select>
                </div>

                {/* Shuffle toggle */}
                <div className="pt-2">
                  <button
                    onClick={() => updateFilters(selectedExam, selectedSubject, selectedTier, selectedYear, selectedShift, !isRandom)}
                    className={`w-full min-h-[48px] px-4 py-2.5 text-sm font-bold rounded-xl flex items-center justify-center gap-2 border transition-all ${
                      isRandom 
                        ? 'bg-purple-600 text-white border-purple-600' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Shuffle (Randomize Questions)</span>
                  </button>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 border-t border-slate-100 flex gap-3">
                <button
                  onClick={() => {
                    clearFilters();
                    setIsMobileDrawerOpen(false);
                  }}
                  disabled={!selectedExam && !selectedSubject && !selectedTier && !selectedYear && !selectedShift}
                  className="flex-1 min-h-[48px] bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  onClick={() => setIsMobileDrawerOpen(false)}
                  className="flex-1 min-h-[48px] bg-blue-600 text-white hover:bg-blue-700 rounded-xl text-sm font-bold transition-colors shadow-lg shadow-blue-600/20"
                >
              Apply
                </button>
              </div>
            </div>
          </div>
        )}

          {/* Questions */}
          <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-6 pb-24">
            
            {questionsLoading || translatingQuestions ? (
              <QuestionSkeleton />
            ) : (!translatedQuestions || translatedQuestions.length === 0) ? (
              <div className="bg-white dark:bg-slate-900 rounded-xl p-12 text-center border border-slate-200 dark:border-slate-800">
                <p className="text-gray-500 mb-4">
                  No questions found. Try adjusting your filters or select another subject to practice.
                </p>
              </div>
            ) : (
              <div className="space-y-4 sm:space-y-6">
                {translatedQuestions.map((question, index) => {
                  const isBookmarked = bookmarkedIds.includes(question.id);
                  const qid = question.id || index;
                  const absIndex = index + 1 + (currentPage - 1) * 10;
                  const isLast = index === questions.length - 1;
                  return (
                    <div key={qid} className="relative">
                      <button 
                        onClick={() => handleBookmarkToggle(question.id)}
                        className={`absolute top-3 right-3 z-10 p-2 rounded-full border transition-colors ${
                          isBookmarked 
                            ? 'bg-yellow-500 text-white border-yellow-500' 
                            : 'bg-white hover:bg-slate-50 text-slate-400 border-slate-200 dark:bg-slate-800 dark:border-slate-700'
                        }`}
                        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark question'}
                      >
                        <FiBookmark size={15} />
                      </button>
                      <ErrorBoundary>
                        <QuestionCard
                          question={question}
                          index={absIndex}
                          selectedAnswer={answers[question.id]}
                          showExplanation={showExplanation[question.id]}
                          onAnswer={handleAnswer}
                          onToggleExplanation={toggleExplanation}
                        />
                      </ErrorBoundary>
                      {!isLast && <div className="h-[2px] bg-slate-200 dark:bg-slate-800 my-5 rounded-full" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Pagination Controls */}
            {(translatedQuestions && translatedQuestions.length > 0) && !isRandom && (
              <div className="mt-8 flex items-center justify-center">
                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-2 py-1.5 shadow-sm">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[38px] flex items-center justify-center"
                  >
                    <FiChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-1">
                    {(Array.from({ length: totalPages || 0 }, (_, i) => i + 1) || [])
                      .filter((page) => {
                        if (totalPages <= 5) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, index, arr) => {
                        const prev = arr[index - 1];
                        const showEllipsis = prev && page - prev > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsis && (
                              <span className="px-1.5 text-gray-400 text-xs">…</span>
                            )}
                            <button
                              onClick={() => goToPage(page)}
                              className={`w-9 h-9 text-xs font-bold rounded-lg border flex items-center justify-center ${
                                page === currentPage
                                  ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/10'
                                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-2 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-[38px] flex items-center justify-center"
                  >
                    <FiChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Floating Thumb-Friendly One-Handed Control Panel (Fixed Bottom-Right) */}
          <div className="fixed bottom-20 right-4 z-40 flex flex-col gap-2 md:hidden">
            {/* Quick Prev Page Shortcut */}
            {currentPage > 1 && !isRandom && (
              <button
                onClick={() => goToPage(currentPage - 1)}
                className="w-11 h-11 rounded-full bg-white text-slate-700 border border-slate-200 flex items-center justify-center shadow-lg hover:bg-slate-50"
                title="Previous Page"
              >
                <FiChevronLeft size={18} />
              </button>
            )}

            {/* Quick Next Page Shortcut */}
            {currentPage < totalPages && !isRandom && (
              <button
                onClick={() => goToPage(currentPage + 1)}
                className="w-11 h-11 rounded-full bg-white text-slate-700 border border-slate-200 flex items-center justify-center shadow-lg hover:bg-slate-50"
                title="Next Page"
              >
                <FiChevronRight size={18} />
              </button>
            )}
          </div>

          {/* SEO Internal Linking Widget */}
          <div className="mt-10 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-left">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Explore SSC Previous Year Question Papers (PYQs)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="text-sm font-bold text-gray-800 mb-2.5">Other Popular SSC Exams</h4>
                <ul className="space-y-2 text-sm text-blue-600">
                  {(exams || []).filter(e => e.slug !== selectedExam).map(exam => (
                    <li key={exam.slug}>
                      <Link to={`/ssc/${exam.slug}_previous_year_questions`} className="hover:underline hover:text-blue-700 transition-colors">
                        {exam.name || exam.shortName} Previous Year Papers
                      </Link>
                    </li>
                  ))}
                  {/* Keep fallback links for high-volume dedicated pages */}
                  {selectedExam !== 'ssc-cgl' && (
                    <li>
                      <Link to="/ssc-cgl-pyq" className="hover:underline hover:text-blue-700 transition-colors">
                        SSC CGL PYQ Solved Papers
                      </Link>
                    </li>
                  )}
                  {selectedExam !== 'ssc-chsl' && (
                    <li>
                      <Link to="/ssc-chsl-pyq" className="hover:underline hover:text-blue-700 transition-colors">
                        SSC CHSL Solved Questions
                      </Link>
                    </li>
                  )}
                </ul>
              </div>
              
              {selectedExam && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-2.5">Practice by Subject ({selectedExamName})</h4>
                  <ul className="space-y-2 text-sm text-blue-600">
                    {[
                      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude' },
                      { name: 'English Language', slug: 'english-language' },
                      { name: 'General Intelligence', slug: 'general-intelligence' },
                      { name: 'General Awareness', slug: 'general-awareness' }
                    ].map(sub => (
                      <li key={sub.slug}>
                        <Link to={`/ssc/${selectedExam}/${sub.slug}_previous_year_questions`} className="hover:underline hover:text-blue-700 transition-colors">
                          {selectedExamName} {sub.name} PYQs
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {selectedExam && (
                <div>
                  <h4 className="text-sm font-bold text-gray-800 mb-2.5">Solved Questions by Year ({selectedExamName})</h4>
                  <ul className="space-y-2 text-sm text-blue-600">
                    {[2025, 2024, 2023, 2022].map(year => (
                      <li key={year}>
                        <Link to={`/ssc/${selectedExam}/${year}_previous_year_questions`} className="hover:underline hover:text-blue-700 transition-colors">
                          {selectedExamName} {year} Practice Set
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* SEO Content Section for Rich Content */}
          {selectedExam && (
            <SEOContentSection examSlug={selectedExam} examName={selectedExamName} />
          )}

          {/* FAQ Link Section */}
          <div className="mt-10 max-w-4xl mx-auto px-4 text-center">
            <p className="text-gray-600">
              Have questions about SSC PYQ practice? Check our{' '}
              <Link to="/faq" className="text-blue-600 hover:text-blue-700 font-medium">
                Frequently Asked Questions
              </Link>
            </p>
          </div>
        </div>
    </>
  );
});

QuestionPractice.displayName = 'QuestionPractice';

export default QuestionPractice;

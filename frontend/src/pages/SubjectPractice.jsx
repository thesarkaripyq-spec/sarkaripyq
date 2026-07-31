import React, { useEffect, useState, useCallback, useRef, memo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { FiChevronRight, FiFilter, FiX } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';
import QuestionCard from '../components/Question/QuestionCard';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import ErrorBoundary from '../components/Common/ErrorBoundary';
import { subjectsAPI, questionsAPI, examsAPI } from '../services/api';
import { ALLOWED_SUBJECTS } from '../constants/subjects';
import usePracticeStore from '../store/practiceStore';
import useAuthStore from '../store/authStore';
import { FREE_ATTEMPT_LIMIT } from '../constants';
import toast from 'react-hot-toast';

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

const SubjectPractice = memo(() => {
  const { examSlug, subjectSlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [subject, setSubject] = useState(null);
  const [exam, setExam] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [years, setYears] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [shuffle, setShuffle] = useState(false);
  const [loading, setLoading] = useState(true);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [showLoginGate, setShowLoginGate] = useState(false);
  const freeAttemptLimit = FREE_ATTEMPT_LIMIT;
  const tierOptions = tiers.length ? tiers : ['Tier 1', 'Tier 2', 'Tier 3', 'Tier 4'];

  const { isAuthenticated } = useAuthStore();
  const { 
    questions, 
    setQuestions, 
    sessionStats,
    submitAnswer,
    showExplanation,
    toggleExplanation,
    answers,
    correctAnswers
  } = usePracticeStore();

  // Filter states
  const [selectedTier, setSelectedTier] = useState(searchParams.get('tier') || '');
  const [selectedYear, setSelectedYear] = useState(searchParams.get('year') || '');
  const [selectedShift, setSelectedShift] = useState(searchParams.get('shift') || '');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const questionsPerPage = 10;

  const updateFilterParams = (tier, year, shift, shuffleFlag) => {
    const params = new URLSearchParams();
    if (shuffleFlag) params.set('shuffle', 'true');
    if (tier) params.set('tier', tier);
    if (year) params.set('year', year);
    if (shift) params.set('shift', shift);
    // shuffle handled above
    setSearchParams(params);
  };

  // Sync URL query params to state
  useEffect(() => {
    setSelectedTier(searchParams.get('tier') || '');
    setSelectedYear(searchParams.get('year') || '');
    setSelectedShift(searchParams.get('shift') || '');
  }, [searchParams]);

  useEffect(() => {
    const fetchSubjectData = async () => {
      try {
        // First validate that the subject slug is one of the allowed subjects
        const isAllowedSubject = ALLOWED_SUBJECTS.some(s => s.slug === subjectSlug);
        if (!isAllowedSubject) {
          console.error('Subject not in allowed list:', subjectSlug);
          setLoading(false);
          return;
        }

        const [subjectRes, examRes] = await Promise.all([
          subjectsAPI.getBySlug(examSlug, subjectSlug),
          examsAPI.getBySlug(examSlug)
        ]);
        setSubject(subjectRes.data?.data || subjectRes.data);
        setExam(examRes.data?.data || examRes.data);
      } catch (error) {
        console.error('Error fetching subject data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjectData();
  }, [examSlug, subjectSlug]);

  // Fetch all filter options dynamically when selections change
  useEffect(() => {
    if (!examSlug || !subjectSlug) return;
    let cancelled = false;

    const fetchFilters = async () => {
      try {
        const [yearsRes, tiersRes, shiftsRes] = await Promise.all([
          examsAPI.getYears(examSlug, {
            subject: subjectSlug,
            tier: selectedTier || undefined,
            shift: selectedShift || undefined
          }),
          examsAPI.getTiers(examSlug, {
            subject: subjectSlug,
            year: selectedYear || undefined,
            shift: selectedShift || undefined
          }),
          examsAPI.getShifts(examSlug, {
            subject: subjectSlug,
            year: selectedYear || undefined,
            tier: selectedTier || undefined
          })
        ]);

        if (cancelled) return;

        // Years
        const yearsData = (yearsRes.data?.data || yearsRes.data || []).map(y => typeof y === 'object' ? y.year : y).filter(Boolean);
        setYears(yearsData);

        // Tiers
        const tierData = Array.isArray(tiersRes.data?.data || tiersRes.data) ? (tiersRes.data?.data || tiersRes.data) : [];
        setTiers(tierData);

        // Shifts
        const shiftsData = shiftsRes.data || [];
        setShifts(shiftsData);

        // Validate current selections against dynamic options and clear invalid values
        let updatedTier = selectedTier;
        let updatedYear = selectedYear;
        let updatedShift = selectedShift;

        if (selectedTier && !tierData.some(t => (typeof t === 'object' ? t.slug : t) === selectedTier)) {
          updatedTier = '';
        }
        if (selectedYear && !yearsData.includes(Number(selectedYear))) {
          updatedYear = '';
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

        if (updatedTier !== selectedTier || updatedYear !== selectedYear || updatedShift !== selectedShift) {
          setSelectedTier(updatedTier);
          setSelectedYear(updatedYear);
          setSelectedShift(updatedShift);
          updateFilterParams(updatedTier, updatedYear, updatedShift, shuffle);
        }
      } catch (error) {
        if (!cancelled) console.error('Error fetching dynamic filters:', error);
      }
    };

    fetchFilters();
    return () => { cancelled = true; };
  }, [examSlug, subjectSlug, selectedTier, selectedYear, selectedShift, shuffle]);

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!subject) return;
      setQuestionsLoading(true);
      try {
        const params = {
          exam: examSlug,
          subject: subjectSlug,
          page: currentPage,
          limit: questionsPerPage
        };
        
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

        const response = await questionsAPI.getAll(params);
      setQuestions(response.data || []);
      setTotalQuestions(response.pagination?.total || 0);
      } catch (error) {
        console.error('Error fetching questions:', error);
        toast.error('Failed to load questions');
      } finally {
        setQuestionsLoading(false);
      }
    };

    fetchQuestions();
  }, [subject, selectedTier, selectedYear, selectedShift, currentPage, setQuestions, examSlug, subjectSlug, shuffle]);

  // Prefetch the next page of questions in the background
  useEffect(() => {
    const totalP = Math.ceil(totalQuestions / questionsPerPage);
    if (currentPage < totalP && questions.length > 0 && subject) {
      const timer = setTimeout(() => {
        const params = {
          exam: examSlug,
          subject: subjectSlug,
          page: currentPage + 1,
          limit: questionsPerPage
        };
        
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
        
        questionsAPI.getAll(params).catch(err => console.debug('Prefetch failed', err));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [currentPage, totalQuestions, questions, subject, examSlug, subjectSlug, selectedTier, selectedYear, selectedShift]);





  const handleTierChange = (tier) => {
    setSelectedTier(tier);
    setSelectedYear('');
    setSelectedShift('');
    updateFilterParams(tier, '', '', shuffle);
    setCurrentPage(1);
  };

  const handleYearChange = (year) => {
    setSelectedYear(year);
    setSelectedShift('');
    updateFilterParams(selectedTier, year, '', shuffle);
    setCurrentPage(1);
  };

  const handleShiftChange = (shift) => {
    setSelectedShift(shift);
    updateFilterParams(selectedTier, selectedYear, shift, shuffle);
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSelectedTier('');
    setSelectedYear('');
    setSelectedShift('');
    setShuffle(false);
    setSearchParams(new URLSearchParams());
    setCurrentPage(1);
  };

  const sessionStatsRef = useRef(sessionStats);
  sessionStatsRef.current = sessionStats;

  const handleAnswer = useCallback(async (questionId, selectedOption) => {
    if (!isAuthenticated && sessionStatsRef.current.attempted >= freeAttemptLimit) {
      setShowLoginGate(true);
      return;
    }

    let actualIsCorrect = false;
    let actualCorrectAnswer = null;
    try {
      const response = await questionsAPI.submitAttempt(questionId, {
        selectedAnswer: selectedOption,
        timeSpent: 30
      });
      if (response?.data?.correct != null) {
        actualIsCorrect = response.data.correct;
      }
      if (response?.data?.correctAnswer != null) {
        actualCorrectAnswer = response.data.correctAnswer;
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      if (error.message?.includes('session has expired')) {
        toast.error('Session expired. Please login again.');
      } else {
        toast.error('Failed to save your answer. Check your connection and try again.');
      }
    }
    submitAnswer(questionId, selectedOption, actualIsCorrect, actualCorrectAnswer);
  }, [isAuthenticated, submitAnswer]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!subject) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Subject Not Found</h1>
          <Link to="/" className="btn btn-primary">Browse All Exams</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead 
        title={`${exam?.shortName || ''} ${subject.name} Previous Year Questions - Free PYQ Practice`}
        description={`Practice ${subject.name} questions from ${exam?.name || ''} previous year papers with detailed solutions in Hindi & English. Free online practice with instant results.`}
        keywords={[subject.name, exam?.shortName || '', 'PYQ', 'MCQ', 'practice', 'previous year questions', 'SSC exam preparation']}
        canonicalUrl={`${window.location.origin}/exam/${exam?.slug}/${subject.slug}`}
        ogImage="/ssc-logo.webp"
        pageUrl={`/exam/${exam?.slug || examSlug}/${subjectSlug}`}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Course",
          "name": `${subject.name} - ${exam?.name || ''} Previous Year Questions`,
          "description": `Practice ${subject.name} questions from ${exam?.name || ''} previous year papers with detailed solutions.`,
          "url": `${window.location.origin}/exam/${exam?.slug || examSlug}/${subjectSlug}`,
          "provider": {
            "@type": "Organization",
            "name": "SarkariPYQ",
            "sameAs": "https://sarkaripyq.com"
          }
        }}
      />

      <div className="bg-gray-50 min-h-screen">
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-gray-500 mb-2">
              <Link to="/" className="hover:text-primary-600">Home</Link>
              <FiChevronRight />
              <Link to={`/ssc/${examSlug}-previous-year-questions`} className="hover:text-primary-600">{exam?.shortName}</Link>
              <FiChevronRight />
              <span className="text-gray-900">{subject.name}</span>
            </nav>

            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-gray-900">
                {subject.name}
              </h1>

              {/* Filter Toggle */}
              <div className="flex items-center gap-4">
                {/* Shuffle Toggle */}
                <button
                  onClick={() => {
                    setShuffle(prev => !prev);
                    updateFilterParams(selectedTier, selectedYear, selectedShift, !shuffle);
                  }}
                  className={`px-3 py-1 rounded ${shuffle ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-800'} transition-colors`}
                >
                  {shuffle ? 'Shuffle On' : 'Shuffle Off'}
                </button>
                <button 
                  onClick={() => setShowFilters(!showFilters)}
                  className="btn btn-outline sm:hidden"
                >
                  <FiFilter /> Filters
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className={`mt-4 flex flex-wrap items-center gap-2 sm:gap-3 ${showFilters ? 'flex' : 'hidden sm:flex'}`}>
              <select
                value={selectedTier}
                onChange={(e) => handleTierChange(e.target.value)}
                className="form-input w-auto min-w-[100px] sm:w-32 text-sm"
                aria-label="Select tier"
              >
                <option value="">All Tiers</option>
                {tierOptions.map((tier) => (
                  <option key={typeof tier === 'object' ? tier.slug : tier} value={typeof tier === 'object' ? tier.slug : tier}>
                    {typeof tier === 'object' ? (tier.name || tier.shortName) : tier}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => handleYearChange(e.target.value)}
                className="form-input w-auto min-w-[100px] sm:w-32 text-sm"
                aria-label="Select year"
              >
                <option value="">All Years</option>
                {years.map((y) => (
                  <option key={typeof y === 'object' ? y.year : y} value={typeof y === 'object' ? y.year : y}>
                    {typeof y === 'object' ? `${y.year} (${y.questionCount || ''})` : y}
                  </option>
                ))}
              </select>

              <select
                value={selectedShift}
                onChange={(e) => handleShiftChange(e.target.value)}
                className="form-input w-auto min-w-[100px] sm:w-32 text-sm"
                aria-label="Select shift"
              >
                <option value="">All Shifts</option>
                {shifts.map((s) => {
                  const shiftVal = typeof s === 'object' 
                    ? (s.exam_date ? `${s.exam_date.substring(0, 10)}_${s.shift}` : s.shift) 
                    : s;
                  const shiftLbl = formatShiftLabel(s);
                  const shiftCount = typeof s === 'object' ? s.questionCount : '';
                  return (
                    <option key={shiftVal} value={shiftVal}>
                      {shiftLbl}{shiftCount ? ` (${shiftCount})` : ''}
                    </option>
                  );
                })}
              </select>

              {(selectedTier || selectedYear || selectedShift) && (
                <button
                  onClick={clearFilters}
                  className="btn btn-secondary text-sm"
                >
                  <FiX /> Clear
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {questionsLoading ? (
            <QuestionSkeleton />
          ) : questions.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center">
              <p className="text-gray-500 mb-4">No questions found with the selected filters.</p>
              <button 
                onClick={clearFilters}
                className="btn btn-primary"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {questions.map((question, index) => (
                <ErrorBoundary key={question.id}>
                  <QuestionCard
                    question={question}
                    index={index + 1}
                    selectedAnswer={answers[question.id]}
                    correctAnswer={correctAnswers[question.id]}
                    showExplanation={showExplanation[question.id]}
                    onAnswer={handleAnswer}
                    onToggleExplanation={toggleExplanation}
                  />
                </ErrorBoundary>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalQuestions > questionsPerPage && (
            <div className="mt-8 flex items-center justify-center gap-2 flex-wrap">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                Previous
              </button>
              
              {Array.from({ length: Math.ceil(totalQuestions / questionsPerPage) }, (_, i) => {
                const pageNum = i + 1;
                const isNearCurrent = Math.abs(pageNum - currentPage) <= 2;
                const isFirst = pageNum === 1;
                const isLast = pageNum === Math.ceil(totalQuestions / questionsPerPage);
                
                if (isNearCurrent || isFirst || isLast) {
                  return (
                    <button
                      key={pageNum}
                      onClick={() => {
                        setCurrentPage(pageNum);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className={`min-h-[44px] min-w-[44px] px-3 py-2 rounded-lg font-semibold transition-all ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-600 hover:text-blue-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                } else if (Math.abs(pageNum - currentPage) === 3) {
                  return <span key={pageNum} className="px-2 py-2">...</span>;
                }
                return null;
              })}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalQuestions / questionsPerPage), prev + 1))}
                disabled={currentPage >= Math.ceil(totalQuestions / questionsPerPage)}
                className="btn btn-outline disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
              >
                Next
              </button>
              
              <span className="text-sm text-gray-600 dark:text-gray-400 ml-4">
                Page {currentPage} of {Math.ceil(totalQuestions / questionsPerPage)} ({totalQuestions} questions)
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  );
});

SubjectPractice.displayName = 'SubjectPractice';

export default SubjectPractice;

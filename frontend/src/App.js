import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useSearchParams } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import LoadingSpinner from './components/Common/LoadingSpinner';
import ProtectedRoute from './components/Auth/ProtectedRoute';
import ErrorBoundary from './components/Common/ErrorBoundary';
import { supabase } from './supabase';
import Maintenance from './pages/Maintenance';
import useAuthStore from './store/authStore';


// Graceful loader wrapper for lazy imports to catch ChunkLoadErrors (e.g. from hot reloads or new builds)
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    try {
      return await componentImport();
    } catch (error) {
      // Hard refresh to fetch the latest webpack compilation chunk hashes
      window.location.reload();
      return new Promise(() => {}); // Maintain pending state to prevent rendering a broken component tree
    }
  });

// Lazy load pages for better performance
const Home = lazyWithRetry(() => import('./pages/Home'));
const SubjectPractice = lazyWithRetry(() => import('./pages/SubjectPractice'));
const QuestionPractice = lazyWithRetry(() => import('./pages/QuestionPractice'));
const ImportantResources = lazyWithRetry(() => import('./pages/BestBooks'));
const SupportContact = lazyWithRetry(() => import('./pages/SupportContact'));
const Contact = lazyWithRetry(() => import('./pages/Contact'));
const PrivacyPolicy = lazyWithRetry(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazyWithRetry(() => import('./pages/TermsOfService'));
const Disclaimer = lazyWithRetry(() => import('./pages/Disclaimer'));
const AboutUs = lazyWithRetry(() => import('./pages/AboutUs'));
const FAQ = lazyWithRetry(() => import('./pages/FAQ'));
const Login = lazyWithRetry(() => import('./pages/Auth/Login'));
const Register = lazyWithRetry(() => import('./pages/Auth/Register'));
const Profile = lazyWithRetry(() => import('./pages/Profile'));
const Leaderboard = lazyWithRetry(() => import('./pages/Leaderboard'));
const DatabaseStatus = lazyWithRetry(() => import('./pages/DatabaseStatus'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

// Redirect legacy /practice query parameters to dynamic SEO-friendly routes
const PracticeRedirector = () => {
  const [searchParams] = useSearchParams();
  const examParam = searchParams.get('exam');
  const subjectParam = searchParams.get('subject');
  const yearParam = searchParams.get('year');
  const topicParam = searchParams.get('topic');

  // Resume where user left off if they navigate to generic /practice
  if (!examParam && !subjectParam && !yearParam && !topicParam) {
    const lastPath = localStorage.getItem('last_practice_path');
    if (lastPath) {
      return <Navigate to={lastPath} replace />;
    }
  }

  const exam = (examParam || 'ssc-cgl').toLowerCase();
  const subject = subjectParam?.toLowerCase();
  const year = yearParam?.toLowerCase();
  const topic = topicParam?.toLowerCase();

  // Preserving other search params like page, tier, shift, random
  const remainingParams = new URLSearchParams(searchParams);
  remainingParams.delete('exam');
  remainingParams.delete('subject');
  remainingParams.delete('year');
  remainingParams.delete('topic');
  const searchStr = remainingParams.toString();
  const querySuffix = searchStr ? `?${searchStr}` : '';

  if (subject && topic) {
    const topicSlug = topic.trim().replace(/[^a-z0-9]+/g, '-');
    return <Navigate to={`/ssc/${exam}/${subject}/${topicSlug}_previous_year_questions${querySuffix}`} replace />;
  } else if (subject) {
    return <Navigate to={`/ssc/${exam}/${subject}_previous_year_questions${querySuffix}`} replace />;
  } else if (year) {
    return <Navigate to={`/ssc/${exam}/${year}_previous_year_questions${querySuffix}`} replace />;
  } else {
    return <Navigate to={`/ssc/${exam}_previous_year_questions${querySuffix}`} replace />;
  }
};

function App() {
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [loading, setLoading] = useState(true);
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Wait for Supabase session validation before rendering any routes
        await initAuth();

        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'maintenanceMode')
          .maybeSingle();
        
        if (!error && data && data.value !== null && data.value !== undefined) {
          const val = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          setIsMaintenance(!!val);
        }
      } catch (e) {
        console.error('Error during app initialization:', e);
      } finally {
        setLoading(false);
      }
    };

    initializeApp();
  }, [initAuth]);

  if (loading) return <LoadingSpinner fullScreen />;
  if (isMaintenance) {
    return <Maintenance />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingSpinner fullScreen />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="exam/:examSlug/:subjectSlug" element={<SubjectPractice />} />
            <Route path="practice" element={<PracticeRedirector />} />
            <Route path="ssc-cgl-pyq" element={<QuestionPractice examSlug="ssc-cgl" />} />
            <Route path="ssc-chsl-pyq" element={<QuestionPractice examSlug="ssc-chsl" />} />
            <Route path="ssc-gd-pyq" element={<QuestionPractice examSlug="ssc-gd" />} />
            <Route path="ssc-cpo-pyq" element={<QuestionPractice examSlug="ssc-cpo" />} />
            <Route path="ssc-mts-pyq" element={<QuestionPractice examSlug="ssc-mts" />} />
            <Route path="ssc-selection-post-pyq" element={<QuestionPractice examSlug="ssc-selection-post" />} />
            <Route path="ssc-stenographer-pyq" element={<QuestionPractice examSlug="ssc-stenographer" />} />
            <Route path="ssc/:examSlugWithSuffix" element={<QuestionPractice />} />
            <Route path="ssc/:examSlug/:secondSlugWithSuffix" element={<QuestionPractice />} />
            <Route path="ssc/:examSlug/:subjectSlug/:topicSlugWithSuffix" element={<QuestionPractice />} />
            <Route path="best-books-for-ssc-exams" element={<ImportantResources />} />
            <Route path="important-resources" element={<Navigate to="/best-books-for-ssc-exams" replace />} />
            <Route path="support" element={<SupportContact />} />
            <Route path="contact" element={<Contact />} />
            <Route path="faq" element={<FAQ />} />
            <Route path="leaderboard" element={<Leaderboard />} />
            <Route path="database-status" element={<DatabaseStatus />} />
            <Route path="privacy-policy" element={<PrivacyPolicy />} />
            <Route path="terms-and-conditions" element={<TermsOfService />} />
            <Route path="disclaimer" element={<Disclaimer />} />
            <Route path="about" element={<AboutUs />} />
            <Route path="login" element={<Login />} />
            <Route path="register" element={<Register />} />

            {/* Protected User Routes */}
            <Route path="profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />

          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;

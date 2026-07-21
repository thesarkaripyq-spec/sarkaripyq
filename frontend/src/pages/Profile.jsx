import React, { useEffect, useState, useCallback } from 'react';
import SEOHead from '../components/Common/SEOHead';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import useAuthStore from '../store/authStore';
import { statsAPI } from '../services/api';
import { 
  FiMail, FiCalendar, FiTarget, FiCheckCircle, FiXCircle, 
  FiRefreshCw, FiTrendingUp, FiBook, FiAward,
  FiBarChart2, FiStar, FiClock, FiUser, FiThumbsUp,
  FiAlertTriangle, FiMinus, FiCpu, FiUsers
} from 'react-icons/fi';
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar
} from 'recharts';
import toast from 'react-hot-toast';

const COLORS = ['#22c55e', '#ef4444'];

const accuracyStatus = (accuracy) => {
  if (accuracy >= 80) return { label: 'Excellent', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30', bar: 'bg-green-500', icon: FiStar };
  if (accuracy >= 60) return { label: 'Good', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', bar: 'bg-blue-500', icon: FiThumbsUp };
  if (accuracy >= 40) return { label: 'Average', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-900/30', bar: 'bg-yellow-500', icon: FiMinus };
  return { label: 'Needs Work', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', bar: 'bg-red-500', icon: FiAlertTriangle };
};

const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-blue-500';
  if (score >= 40) return 'text-yellow-500';
  return 'text-red-500';
};



const Profile = () => {
  const { user } = useAuthStore();

  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.name || 'User';
  const userEmail = user?.email;
  const userCreatedAt = user?.created_at;
  const userAvatar = user?.user_metadata?.avatar_url || user?.avatar || null;

  const [stats, setStats] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [leaderboardTab, setLeaderboardTab] = useState('global');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const statsRes = await statsAPI.getUserStats();
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const lbRes = await statsAPI.getLeaderboard();
      setLeaderboard(lbRes.data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  const refreshData = useCallback(() => {
    fetchStats();
    fetchLeaderboard();
  }, [fetchStats, fetchLeaderboard]);

  useEffect(() => {
    refreshData();
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshData();
    };
    window.addEventListener('focus', refreshData);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', refreshData);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refreshData]);

  const handleResetScore = async () => {
    setResetting(true);
    try {
      const response = await statsAPI.resetScore();
      if (response.success || response.data?.success) {
        toast.success('Performance reset successfully! All your attempts have been cleared.');
        await fetchStats();
        await fetchLeaderboard();
        setShowResetModal(false);
      }
    } catch (error) {
      console.error('Error resetting score:', error);
      toast.error('Failed to reset. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  const calculateScore = (overview) => {
    if (!overview || overview.totalAttempts === 0) return 0;
    const accuracy = overview.correctAnswers / overview.totalAttempts;
    const totalWeight = Math.min(overview.totalAttempts / 100, 1);
    return Math.round((accuracy * 70 + totalWeight * 30) * 10) / 10;
  };

  const calculateAvgTime = (recentAttempts) => {
    if (!recentAttempts || recentAttempts.length === 0) return 0;
    const withTime = recentAttempts.filter(a => a.time_spent || a.time_taken);
    if (withTime.length === 0) return 0;
    const total = withTime.reduce((sum, a) => sum + (a.time_spent || a.time_taken || 0), 0);
    return Math.round(total / withTime.length);
  };

  if (loading && !stats) {
    return <LoadingSpinner fullScreen />;
  }

  const hasData = stats?.overview?.totalAttempts > 0;
  const score = calculateScore(stats?.overview);
  const avgTime = calculateAvgTime(stats?.recentAttempts);
  const accuracyVal = parseFloat(stats?.overview?.accuracy || 0);

  const pieData = hasData ? [
    { name: 'Correct', value: stats.overview.correctAnswers },
    { name: 'Wrong', value: stats.overview.wrongAnswers }
  ] : [];

  const rankStatus = accuracyStatus(accuracyVal);

  const barData = stats?.subjectPerformance?.map(s => ({
    name: s.name.length > 10 ? s.name.substring(0, 10) + '...' : s.name,
    accuracy: parseFloat(s.accuracy) || 0,
    attempts: s.total || 0
  })) || [];

  const userLBEntry = leaderboard?.leaderboard?.find(e => e.email === userEmail || e.user_id === user?.id) || leaderboard?.userEntry;
  const userRankOverall = leaderboard?.userRank || stats?.rank;

  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <>
      <SEOHead
        title="My Analytics & Performance"
        description="View your detailed practice analytics, performance metrics, leaderboard ranking and progress tracking"
        noIndex
      />

      {/* Reset Confirmation Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6 shadow-2xl">
            <div className="w-14 h-14 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
              <FiAlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white text-center mb-2">Reset Performance?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-2">
              This will permanently delete all your practice attempts, scores, and statistics. Your progress across all subjects and exams will be reset to zero.
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 text-center mb-6 font-medium">
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowResetModal(false)}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleResetScore}
                disabled={resetting}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
              >
                {resetting ? (
                  <><FiRefreshCw className="w-4 h-4 animate-spin" /> Resetting...</>
                ) : (
                  <><FiAlertTriangle className="w-4 h-4" /> Reset Everything</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-4 lg:py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* ===== USER HEADER ===== */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 lg:p-7 mb-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 lg:w-16 lg:h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl lg:text-2xl font-bold shadow-md flex-shrink-0">
                  {userAvatar ? (
                    <img src={userAvatar} alt="" className="w-full h-full rounded-2xl object-cover" />
                  ) : (
                    userName.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">{userName}</h1>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                    <span className="text-slate-500 dark:text-slate-400 text-sm flex items-center gap-1.5">
                      <FiMail className="w-3.5 h-3.5" /> {userEmail}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 text-sm flex items-center gap-1.5">
                      <FiCalendar className="w-3.5 h-3.5" /> Joined {userCreatedAt ? new Date(userCreatedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={() => { fetchStats(); fetchLeaderboard(); }}
                  disabled={loading || leaderboardLoading}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-blue-50 dark:bg-slate-800 text-blue-600 dark:text-blue-400 rounded-xl font-medium hover:bg-blue-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors border border-blue-200 dark:border-slate-700 text-sm"
                >
                  <FiRefreshCw className={`w-4 h-4 ${loading || leaderboardLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
                <button
                  onClick={() => setShowResetModal(true)}
                  disabled={!hasData}
                  className="flex-1 sm:flex-none px-4 py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors border border-red-200 dark:border-red-900/50 text-sm"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          {!hasData ? (
            /* ===== EMPTY STATE ===== */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-5 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center">
                  <FiBarChart2 className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No Practice Data Yet</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Start practicing questions to see your analytics, ranking, and performance tracking here.</p>
                <a
                  href="/ssc/ssc-cgl_previous_year_questions"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md"
                >
                  <FiTarget className="w-4 h-4" />
                  Start Practicing
                </a>
              </div>
            </div>
          ) : (
            <>

              {/* ===== PERFORMANCE SCORE HERO ===== */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 lg:p-8 mb-5 shadow-sm text-slate-900 dark:text-white">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-2xl bg-blue-50 dark:bg-slate-800 flex items-center justify-center border border-blue-100 dark:border-slate-700 flex-shrink-0">
                      <FiStar className="w-8 h-8 lg:w-10 lg:h-10 text-yellow-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Performance Score</p>
                      <p className="text-3xl lg:text-4xl font-extrabold mt-1 text-slate-900 dark:text-white">{score}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-xs text-slate-500 dark:text-slate-400">out of 100</span>
                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold ${rankStatus.bg} ${rankStatus.color}`}>
                          <rankStatus.icon className="w-3 h-3" />
                          {rankStatus.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-6 lg:gap-8 w-full lg:w-auto justify-between lg:justify-end">
                    <div className="text-center lg:text-right">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.overview?.totalAttempts || 0}</p>
                      <p className="text-xs text-slate-400 font-medium">Attempts</p>
                    </div>
                    <div className="w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                    <div className="text-center lg:text-right">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats?.overview?.accuracy || 0}%</p>
                      <p className="text-xs text-slate-400 font-medium">Accuracy</p>
                    </div>
                    <div className="w-px bg-slate-200 dark:bg-slate-800 hidden sm:block" />
                    <div className="text-center lg:text-right">
                      <p className="text-2xl font-bold text-slate-900 dark:text-white">
                        {userRankOverall ? `#${userRankOverall}` : '--'}
                      </p>
                      <p className="text-xs text-slate-400 font-medium">Rank</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== QUICK STATS GRID ===== */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total</span>
                    <div className="w-9 h-9 bg-blue-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-slate-700">
                      <FiTarget className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stats?.overview?.totalAttempts || 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Questions Attempted</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Correct</span>
                    <div className="w-9 h-9 bg-green-50 dark:bg-green-900/20 rounded-xl flex items-center justify-center border border-green-100 dark:border-green-900/50">
                      <FiCheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-green-600 dark:text-green-400">{stats?.overview?.correctAnswers || 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Correct Answers</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Wrong</span>
                    <div className="w-9 h-9 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center border border-red-100 dark:border-red-900/50">
                      <FiXCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-red-600 dark:text-red-400">{stats?.overview?.wrongAnswers || 0}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Wrong Answers</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Accuracy</span>
                    <div className="w-9 h-9 bg-blue-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-slate-700">
                      <FiTrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stats?.overview?.accuracy || 0}%</p>
                  <p className="text-xs text-slate-400 mt-0.5">Accuracy Rate</p>
                </div>
              </div>

              {/* ===== ADVANCED METRICS ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-5">
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Avg Time</span>
                    <div className="w-9 h-9 bg-blue-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-slate-700">
                      <FiClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{formatTime(avgTime)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Per Question</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Score</span>
                    <div className="w-9 h-9 bg-blue-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-slate-700">
                      <FiCpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{score}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Performance Score</p>
                </div>

                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Your Rank</span>
                    <div className="w-9 h-9 bg-blue-50 dark:bg-slate-800 rounded-xl flex items-center justify-center border border-blue-100 dark:border-slate-700">
                      <FiStar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                    {userRankOverall ? `#${userRankOverall}` : '--'}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    of {stats?.totalParticipants || 0} participants
                  </p>
                </div>
              </div>

              {/* ===== CHARTS ROW ===== */}
              <div className="mb-5">

                {/* Accuracy Overview */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                    <FiCheckCircle className="text-green-600 dark:text-green-400" />
                    Accuracy Breakdown
                  </h2>
                  {pieData.length > 0 && (pieData[0].value > 0 || pieData[1].value > 0) ? (
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <div className="w-full sm:w-1/2 h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%" cy="50%"
                              innerRadius={55} outerRadius={85}
                              dataKey="value" paddingAngle={3} stroke="none"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index]} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{ backgroundColor: '#1e293b', borderRadius: '10px', border: 'none', color: '#f8fafc' }}
                              itemStyle={{ color: '#f8fafc' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-col gap-2.5 w-full sm:w-1/2">
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Correct</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{stats?.overview?.correctAnswers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Wrong</span>
                          </div>
                          <span className="font-bold text-slate-900 dark:text-white">{stats?.overview?.wrongAnswers || 0}</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <FiTrendingUp className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">Accuracy</span>
                          </div>
                          <span className="font-bold text-blue-600 dark:text-blue-400">{stats?.overview?.accuracy || 0}%</span>
                        </div>
                        <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 px-4 py-2.5 rounded-xl border border-slate-100 dark:border-slate-700">
                          <div className="flex items-center gap-2.5">
                            <FiAward className="w-3.5 h-3.5 text-blue-500" />
                            <span className="text-sm text-slate-500 dark:text-slate-400">Status</span>
                          </div>
                          <span className={`font-bold ${rankStatus.color}`}>{rankStatus.label}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[220px] flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <FiCheckCircle className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">No data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== SUBJECT BAR CHART ===== */}
              {barData.length > 0 && (
                <div className="mb-5">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                      <FiBarChart2 className="text-blue-600 dark:text-blue-400" />
                      Subject-wise Accuracy
                    </h2>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} opacity={0.4} />
                        <XAxis type="number" domain={[0, 100]} stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} width={90} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1e293b', borderRadius: '10px', border: 'none', color: '#f8fafc' }}
                          itemStyle={{ color: '#f8fafc', fontSize: '13px' }}
                          formatter={(value) => [`${value}%`, 'Accuracy']}
                        />
                        <Bar dataKey="accuracy" fill="#3b82f6" radius={[0, 6, 6, 0]} barSize={20} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ===== LEADERBOARD SECTION ===== */}
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 mb-5">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FiUsers className="text-indigo-600 dark:text-indigo-400" />
                    Leaderboard
                  </h2>
                  <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 border border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() => setLeaderboardTab('global')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${leaderboardTab === 'global' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Global
                    </button>
                    <button
                      onClick={() => setLeaderboardTab('myrank')}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${leaderboardTab === 'myrank' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      My Rank
                    </button>
                  </div>
                </div>

                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <FiRefreshCw className="w-6 h-6 animate-spin text-slate-400" />
                  </div>
                ) : leaderboard?.leaderboard && leaderboard.leaderboard.length > 0 ? (
                  <>
                    {/* User's rank summary bar */}
                    {userLBEntry && (
                      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-100 dark:border-indigo-900/50 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                              #{userLBEntry.rank}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-900 dark:text-white">{userLBEntry.name || userName}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Score: {userLBEntry.score} | {userLBEntry.total_attempts} attempts | {userLBEntry.accuracy}% accuracy
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{userLBEntry.score}</p>
                            <p className="text-xs text-slate-400">Score</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800">
                            <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 w-12">Rank</th>
                            <th className="text-left py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                            <th className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Attempts</th>
                            <th className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Correct</th>
                            <th className="text-center py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Accuracy</th>
                            <th className="text-right py-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(leaderboardTab === 'global' ? leaderboard.leaderboard : leaderboard.leaderboard.filter(e => e.email === userEmail || e.user_id === user?.id)).map((entry, idx) => {
                            const isMe = entry.email === userEmail || entry.user_id === user?.id;
                            const rankNum = leaderboardTab === 'myrank' ? (leaderboard.leaderboard.findIndex(e => e.email === userEmail || e.user_id === user?.id) + 1) : parseInt(entry.rank);

                            return (
                              <tr
                                key={entry.user_id || idx}
                                className={`border-b border-slate-50 dark:border-slate-800/50 transition-colors ${isMe ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'}`}
                              >
                                <td className="py-3 px-2">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${isMe ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}>
                                    {isMe ? `#${userRankOverall || rankNum}` : `#${entry.rank || rankNum}`}
                                  </div>
                                </td>
                                <td className="py-3 px-2">
                                  <div className="flex items-center gap-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${isMe ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                      <FiUser className="w-4 h-4" />
                                    </div>
                                    <span className={`font-medium text-sm ${isMe ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                      {entry.name || 'Unknown'}
                                      {isMe && <span className="text-xs ml-1.5 text-indigo-400 font-normal">(You)</span>}
                                    </span>
                                  </div>
                                </td>
                                <td className="py-3 px-2 text-center text-slate-600 dark:text-slate-400 hidden sm:table-cell">{entry.total_attempts}</td>
                                <td className="py-3 px-2 text-center text-green-600 dark:text-green-400 hidden sm:table-cell">{entry.correct_answers}</td>
                                <td className="py-3 px-2 text-center">
                                  <span className={`text-xs font-bold ${parseFloat(entry.accuracy) >= 70 ? 'text-green-600 dark:text-green-400' : parseFloat(entry.accuracy) >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {entry.accuracy}%
                                  </span>
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <span className={`font-bold text-sm ${getScoreColor(parseFloat(entry.score))}`}>{entry.score}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {leaderboard.leaderboard.length > 10 && leaderboardTab === 'global' && (
                      <p className="text-xs text-center text-slate-400 mt-4">
                        Showing top {leaderboard.leaderboard.length} of {leaderboard.totalParticipants || leaderboard.leaderboard.length} participants
                      </p>
                    )}
                  </>
                ) : (
                  <div className="text-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                    <FiUsers className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-medium">No leaderboard data yet</p>
                    <p className="text-xs mt-1">Be the first to practice and top the charts!</p>
                  </div>
                )}
              </div>

              {/* ===== SUBJECT + EXAM PERFORMANCE ===== */}
              <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-5">

                {/* Subject-wise */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                    <FiAward className="text-blue-600 dark:text-blue-400" />
                    Subject-wise Performance
                  </h2>
                  {stats?.subjectPerformance && stats.subjectPerformance.length > 0 ? (
                    <div className="space-y-3">
                      {stats.subjectPerformance.map((subject, index) => {
                        const accuracy = parseFloat(subject.accuracy) || 0;
                        const st = accuracyStatus(accuracy);
                        const Icon = st.icon;
                        return (
                          <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">{subject.name}</span>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${st.bg} ${st.color}`}>
                                <Icon className="w-3 h-3" /> {st.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                              <span>Total: <strong className="text-slate-700 dark:text-slate-300">{subject.total}</strong></span>
                              <span>Correct: <strong className="text-green-600 dark:text-green-400">{subject.correct}</strong></span>
                              <span>Wrong: <strong className="text-red-600 dark:text-red-400">{subject.total - subject.correct}</strong></span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex-1 h-2.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${accuracy}%` }}></div>
                              </div>
                              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-10 text-right">{accuracy.toFixed(1)}%</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-10 text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                      <FiAward className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">No subject data</p>
                    </div>
                  )}
                </div>

                {/* Exam-wise */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden">
                  <h2 className="text-base font-bold text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                    <FiBook className="text-blue-600 dark:text-blue-400" />
                    Exam-wise Performance
                  </h2>
                  {stats?.examwiseStats && stats.examwiseStats.length > 0 ? (
                    <div className="space-y-3">
                      {stats.examwiseStats.map((exam, index) => {
                        const accuracy = exam.totalAttempts > 0
                          ? ((exam.correctAnswers / exam.totalAttempts) * 100).toFixed(1)
                          : 0;
                        const st = accuracyStatus(parseFloat(accuracy));
                        const Icon = st.icon;
                        return (
                          <div key={index} className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-100 dark:border-slate-700/50">
                            <div className="flex items-center justify-between mb-2.5">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                {exam.name}
                                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-md ${st.bg} ${st.color}`}>
                                  <Icon className="w-3 h-3 inline mr-0.5" /> {st.label}
                                </span>
                              </span>
                              <span className={`text-xs font-bold ${parseFloat(accuracy) >= 70 ? 'text-green-600 dark:text-green-400' : parseFloat(accuracy) >= 40 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400'}`}>
                                {accuracy}%
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 mb-2.5">
                              <span>Attempts: <strong className="text-slate-700 dark:text-slate-300">{exam.totalAttempts}</strong></span>
                              <span>Correct: <strong className="text-green-600 dark:text-green-400">{exam.correctAnswers}</strong></span>
                              <span>Wrong: <strong className="text-red-600 dark:text-red-400">{exam.totalAttempts - exam.correctAnswers}</strong></span>
                            </div>
                            <div className="mt-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full transition-all ${st.bar}`} style={{ width: `${accuracy}%` }}></div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 py-10">
                      <FiBook className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                      <p className="text-sm font-medium">No exam data</p>
                    </div>
                  )}
                </div>

              </div>

              {/* ===== RECENT ACTIVITY ===== */}
              {stats?.recentAttempts && stats.recentAttempts.length > 0 && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 mb-5">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <FiClock className="text-blue-600 dark:text-blue-400" />
                      Recent Activity
                    </h2>
                    <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg font-medium">
                      Last {stats.recentAttempts.length} attempts
                    </span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {stats.recentAttempts.map((attempt, index) => (
                      <div key={attempt.id || index} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          attempt.is_correct
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                          {attempt.is_correct ? 'C' : 'W'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {attempt.questionText || 'Question'}
                          </p>
                          <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{attempt.examSlug || ''}</span>
                            {attempt.subjectName && <><span>·</span><span>{attempt.subjectName}</span></>}
                            {attempt.time_spent ? (
                              <><span>·</span><span>{formatTime(attempt.time_spent)}</span></>
                            ) : null}
                            <span>·</span>
                            <span>{attempt.created_at ? new Date(attempt.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}</span>
                          </p>
                        </div>
                        <span className={`text-xs font-bold ${attempt.is_correct ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {attempt.is_correct ? 'Correct' : 'Wrong'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}

          {/* ===== FOOTER NOTE ===== */}
          <div className="text-center py-6">
            <p className="text-xs text-slate-400">
              Analytics update in real-time as you practice. Keep solving questions to improve your score and ranking.
            </p>
          </div>

        </div>
      </div>
    </>
  );
};

export default Profile;

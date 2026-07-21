import React, { useEffect, useState, useCallback, memo } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiRefreshCw, FiAward, FiLogIn, FiUser, FiLock } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import useAuthStore from '../store/authStore';
import { statsAPI } from '../services/api';

const getScoreColor = (score) => {
  if (score >= 80) return 'text-green-600 dark:text-green-400';
  if (score >= 60) return 'text-blue-600 dark:text-blue-400';
  if (score >= 40) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
};

const Leaderboard = memo(() => {
  const { user, isAuthenticated } = useAuthStore();
  const userName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.name || 'User';
  const userEmail = user?.email;

  const [leaderboardData, setLeaderboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await statsAPI.getLeaderboard();
      if (response && response.data) {
        setLeaderboardData(response.data);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  const list = leaderboardData?.leaderboard || [];
  const top10 = list.slice(0, 10);
  const userRankOverall = leaderboardData?.userRank;
  const userLBEntry = list.find(e => e.email === userEmail || e.user_id === user?.id) || leaderboardData?.userEntry;
  const isMeInTop10 = top10.some(entry => entry.email === userEmail || entry.user_id === user?.id);

  return (
    <>
      <SEOHead
        title="Leaderboard - Top SSC Aspirants"
        description="See the top 10 SSC aspirants on SarkariPYQ based on accuracy and solved questions. Login to view your personal rank."
        canonicalUrl={`${window.location.origin}/leaderboard`}
      />

      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 lg:py-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          
          {/* ===== HEADER ===== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center gap-2.5">
                <FiUsers className="text-blue-600 dark:text-blue-400" />
                Leaderboard
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Top 10 aspirants based on accuracy and solved questions.
              </p>
            </div>
            <button
              onClick={() => fetchLeaderboard(true)}
              disabled={refreshing}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors disabled:opacity-50"
            >
              <FiRefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Banners moved to bottom-pinned rows inside the leaderboard table */}

          {/* ===== TOP 10 LIST ===== */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {top10.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                <FiAward className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium">No leaderboard entries found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10">
                      <th className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 w-16 text-center">Rank</th>
                      <th className="text-left py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Aspirant</th>
                      <th className="text-center py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 hidden sm:table-cell">Solved</th>
                      <th className="text-center py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400">Accuracy</th>
                      <th className="text-right py-3.5 px-4 text-xs font-bold uppercase tracking-wider text-slate-400 pr-6">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map((entry, idx) => {
                      const isMe = entry.email === userEmail || entry.user_id === user?.id;
                      const rankNum = idx + 1;

                      return (
                        <tr
                          key={entry.user_id || idx}
                          className={`border-b border-slate-100 dark:border-slate-800/40 transition-colors ${
                            isMe 
                              ? 'bg-blue-50/30 dark:bg-blue-900/5' 
                              : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/10'
                          }`}
                        >
                          <td className="py-3.5 px-4 text-center">
                            <div className={`w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-bold ${
                              rankNum === 1 
                                ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' 
                                : rankNum === 2 
                                ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' 
                                : rankNum === 3 
                                ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' 
                                : isMe 
                                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                                : 'text-slate-500 dark:text-slate-400'
                            }`}>
                              #{rankNum}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                isMe 
                                  ? 'bg-blue-600 text-white' 
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200/50 dark:border-slate-700'
                              }`}>
                                <FiUser className="w-4 h-4" />
                              </div>
                              <span className={`font-semibold text-sm ${isMe ? 'text-blue-600 dark:text-blue-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                {entry.name || 'Anonymous'}
                                {isMe && <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-normal">You</span>}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-500 dark:text-slate-400 hidden sm:table-cell font-medium">
                            {entry.total_attempts}
                          </td>
                          <td className="py-3.5 px-4 text-center">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                              parseFloat(entry.accuracy) >= 70 
                                ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' 
                                : parseFloat(entry.accuracy) >= 40 
                                ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400' 
                                : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                            }`}>
                              {entry.accuracy}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right pr-6">
                            <span className={`font-bold text-sm ${getScoreColor(parseFloat(entry.score))}`}>
                              {entry.score}
                            </span>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Gap separator and logged-in user rank at bottom if not in top 10 */}
                    {isAuthenticated && !isMeInTop10 && (
                      <>
                        <tr className="border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/10 dark:bg-slate-900/5 select-none">
                          <td colSpan="5" className="py-2 text-center text-slate-400 font-bold tracking-widest">
                            •••
                          </td>
                        </tr>
                        {userLBEntry ? (
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-blue-50/40 dark:bg-blue-900/10 transition-colors">
                            <td className="py-3.5 px-4 text-center">
                              <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                                #{userRankOverall || userLBEntry.rank}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-blue-600 text-white">
                                  <FiUser className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                                  {userLBEntry.name || userName}
                                  <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-normal">You</span>
                                </span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center text-slate-500 dark:text-slate-400 hidden sm:table-cell font-medium">
                              {userLBEntry.total_attempts}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                parseFloat(userLBEntry.accuracy) >= 70 
                                  ? 'bg-green-50 dark:bg-green-950/20 text-green-600 dark:text-green-400' 
                                  : parseFloat(userLBEntry.accuracy) >= 40 
                                  ? 'bg-yellow-50 dark:bg-yellow-950/20 text-yellow-600 dark:text-yellow-400' 
                                  : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400'
                              }`}>
                                {userLBEntry.accuracy}%
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right pr-6">
                              <span className={`font-bold text-sm ${getScoreColor(parseFloat(userLBEntry.score))}`}>
                                {userLBEntry.score}
                              </span>
                            </td>
                          </tr>
                        ) : (
                          <tr className="border-b border-slate-100 dark:border-slate-800 bg-blue-50/10 dark:bg-blue-900/5 transition-colors">
                            <td className="py-3.5 px-4 text-center">
                              <div className="w-8 h-8 mx-auto rounded-lg flex items-center justify-center text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-400">
                                -
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-slate-300 text-white">
                                  <FiUser className="w-4 h-4" />
                                </div>
                                <span className="font-semibold text-sm text-slate-500">
                                  {userName}
                                  <span className="text-[10px] ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 font-normal">Unranked</span>
                                </span>
                              </div>
                            </td>
                            <td colSpan="3" className="py-3.5 px-4 text-center text-slate-400 text-xs italic">
                              Solve questions to see your rank here!
                            </td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Gap separator and blurred mock row with login CTA if guest */}
                    {!isAuthenticated && (
                      <>
                        <tr className="border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/10 dark:bg-slate-900/5 select-none">
                          <td colSpan="5" className="py-2 text-center text-slate-400 font-bold tracking-widest">
                            •••
                          </td>
                        </tr>
                        <tr className="relative border-b border-slate-100 dark:border-slate-800/40 bg-slate-50/10 dark:bg-slate-900/5 h-[56px] overflow-hidden">
                          <td className="py-3.5 px-4 text-center blur-[3px] opacity-25 select-none pointer-events-none">
                            <div className="w-8 h-8 mx-auto rounded-lg bg-slate-200 dark:bg-slate-800" />
                          </td>
                          <td className="py-3.5 px-4 blur-[3px] opacity-25 select-none pointer-events-none">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-slate-200 dark:bg-slate-800" />
                              <span className="font-semibold text-sm">Your Personal Standings</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center hidden sm:table-cell blur-[3px] opacity-25 select-none pointer-events-none">
                            120
                          </td>
                          <td className="py-3.5 px-4 text-center blur-[3px] opacity-25 select-none pointer-events-none">
                            <span className="text-xs font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400">
                              85%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right pr-6 blur-[3px] opacity-25 select-none pointer-events-none">
                            182.5
                          </td>
                          
                          {/* Premium absolute overlay */}
                          <td className="absolute inset-0 flex items-center justify-center bg-white/40 dark:bg-slate-950/40 backdrop-blur-[1.5px] transition-all duration-300">
                            <div className="flex items-center gap-3 bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 rounded-2xl py-2 px-4 shadow-lg hover:scale-[1.02] transition-transform duration-200">
                              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                                <FiLock className="w-4 h-4" />
                              </div>
                              <div className="text-left">
                                <p className="text-xs font-extrabold text-slate-800 dark:text-slate-100 leading-tight">Track Your Rank</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">Solve questions & view your rank</p>
                              </div>
                              <Link 
                                to="/login" 
                                className="ml-2 inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] shadow-sm hover:shadow transition-all"
                              >
                                <FiLogIn className="w-3 h-3" />
                                Login
                              </Link>
                            </div>
                          </td>
                        </tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* ===== FOOTER NOTE ===== */}
          <p className="text-center text-xs text-slate-400 mt-6 leading-relaxed">
            The leaderboard is updated in real-time. Practice solved previous year questions to earn points and improve your rank.
          </p>

        </div>
      </div>
    </>
  );
});

Leaderboard.displayName = 'Leaderboard';

export default Leaderboard;

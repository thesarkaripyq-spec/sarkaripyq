import React, { useEffect, useState, useMemo, useRef, memo } from 'react';
import { FiDatabase, FiWifi, FiSearch } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { statsAPI } from '../services/api';

const WS_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5001').replace(/^http/, 'ws') + '/ws/pipeline-stats';
const WS_TIMEOUT = 8000;

const DatabaseStatus = memo(() => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [restSummary, setRestSummary] = useState(null);
  const [restLoading, setRestLoading] = useState(true);
  const [filterExam, setFilterExam] = useState('All');
  const [filterTier, setFilterTier] = useState('All');
  const [filterYear, setFilterYear] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const wsRef = useRef(null);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    statsAPI.getDbSummary()
      .then(res => { if (res.data) setRestSummary(res.data); })
      .catch(() => {})
      .finally(() => setRestLoading(false));
  }, []);

  useEffect(() => {
    let reconnectTimer;
    let fallbackTimer = setTimeout(() => {
      if (!data) setLoading(false);
    }, WS_TIMEOUT);

    function connect() {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;
      ws.onopen = () => { setConnected(true); setLoading(false); clearTimeout(fallbackTimer); };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'pipeline-stats' && msg.data) { setData(msg.data); clearTimeout(fallbackTimer); }
        } catch (e) {}
      };
      ws.onclose = () => { setConnected(false); reconnectTimer = setTimeout(connect, 3000); };
      ws.onerror = () => ws.close();
    }
    connect();
    return () => { clearTimeout(fallbackTimer); clearTimeout(reconnectTimer); if (wsRef.current) wsRef.current.close(); };
  }, []);

  const {
    examStats, seriesProgress, packages, totalQuestions,
    totalTarget, totalCompleted, overallPct, pendingSeries
  } = data || {};

  // Flatten shifts
  const allShifts = useMemo(() => {
    if (!examStats) return [];
    const list = [];
    examStats.forEach(exam => {
      (exam.shift_breakdown || []).forEach(s => {
        list.push({ exam: exam.exam, shift: s.shift, year: s.year, tier: s.tier, date: s.date || '', series_id: s.series_id || '', series_name: s.series_name || '', count: s.count });
      });
    });
    return list;
  }, [examStats]);

  // Package-level progress (each package = one card)
  const packageProgress = useMemo(() => {
    if (!packages) return [];
    return packages.map(pkg => {
      const sp = seriesProgress?.filter(s => s.package_id === pkg.package_id) || [];
      const qTarget = sp.reduce((s, r) => s + (r.target || 0), 0);
      const qCompleted = sp.reduce((s, r) => s + (r.completed || 0), 0);
      // Find matching examStats for tier/year info
      const exam = examStats?.find(e => (e.slug || 'ssc-' + e.exam.toLowerCase()) === pkg.sub_exam);
      const totalQ = exam?.questions || 0;
      return {
        ...pkg,
        qTarget, qCompleted,
        totalQ,
        tiers: exam?.tiers || [],
        years: exam?.years || [],
        slug: pkg.sub_exam + '-' + pkg.package_id,
        name: pkg.package_name,
        examName: pkg.sub_exam.replace('ssc-', '').toUpperCase(),
      };
    });
  }, [packages, seriesProgress, examStats]);

  // Filter options
  const filterOptions = useMemo(() => {
    const exams = new Set(); const tiers = new Set(); const years = new Set();
    allShifts.forEach(s => { exams.add(s.exam); tiers.add(s.tier); years.add(s.year); });
    return {
      exams: ['All', ...Array.from(exams).sort()],
      tiers: ['All', ...Array.from(tiers).sort()],
      years: ['All', ...Array.from(years).sort((a, b) => b - a)]
    };
  }, [allShifts]);

  // Filtered shifts
  const filteredShifts = useMemo(() => {
    return allShifts.filter(s =>
      (filterExam === 'All' || s.exam === filterExam) &&
      (filterTier === 'All' || s.tier === filterTier) &&
      (filterYear === 'All' || s.year.toString() === filterYear)
    );
  }, [allShifts, filterExam, filterTier, filterYear]);

  const totalFiltered = filteredShifts.reduce((s, r) => s + r.count, 0);

  // Filter series
  const filteredSeries = useMemo(() => {
    if (!seriesProgress) return [];
    let list = seriesProgress;
    if (filterStatus !== 'All') list = list.filter(s => s.import_status === filterStatus);
    if (filterExam !== 'All') list = list.filter(s => s.exam_slug === 'ssc-' + filterExam.toLowerCase());
    return list;
  }, [seriesProgress, filterStatus, filterExam]);

  // Group REST summary by exam for display
  const restByExam = useMemo(() => {
    if (!restSummary) return [];
    const map = {};
    restSummary.forEach(r => {
      const key = r.exam_name;
      if (!map[key]) map[key] = { exam_name: r.exam_name, exam_short: r.exam_short, shifts: [], total: 0 };
      map[key].shifts.push(r);
      map[key].total += r.count;
    });
    return Object.values(map).sort((a, b) => a.exam_name.localeCompare(b.exam_name));
  }, [restSummary]);

  const totalQuestionsFromRest = useMemo(() => {
    return restSummary ? restSummary.reduce((s, r) => s + r.count, 0) : 0;
  }, [restSummary]);

  // Estimated time
  const elapsed = Date.now() - startTimeRef.current;
  const ratePerMs = totalCompleted > 0 ? totalCompleted / elapsed : 0;
  const remaining = totalTarget - totalCompleted;
  const etaMs = ratePerMs > 0 ? remaining / ratePerMs : 0;
  const etaMin = Math.round(etaMs / 60000);

  if (loading) return <LoadingSpinner fullScreen />;

  return (
    <>
      <SEOHead
        title="Database Status - Live Pipeline Monitor"
        description="Real-time pipeline monitoring for SarkariPYQ question database import status. Track SSC CGL, CHSL, GD, MTS, CPO PYQ data ingestion."
        pageUrl="/database-status"
      />
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 lg:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-2.5">
                <FiDatabase className="text-blue-600 dark:text-blue-400" />
                Pipeline Status
              </h1>
              <p className="text-slate-400 text-sm mt-1 flex items-center gap-1.5">
                <FiWifi className={`w-3.5 h-3.5 ${connected ? 'text-emerald-500' : 'text-red-500'}`} />
                {connected ? 'Live' : 'Disconnected'}
                {data?.timestamp && <span className="text-xs">· {new Date(data.timestamp).toLocaleTimeString()}</span>}
              </p>
            </div>
          </div>

          {/* Overall Progress Bar */}
          {totalTarget > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-lg font-extrabold text-blue-600 dark:text-blue-400">{overallPct}%</span>
                  <span className="text-sm text-slate-500 ml-2">complete</span>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <div>{totalCompleted.toLocaleString()} / {totalTarget.toLocaleString()} questions</div>
                  {pendingSeries > 0 && <div>{pendingSeries} series pending · ETA ~{etaMin}m</div>}
                </div>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${overallPct}%` }} />
              </div>
            </div>
          )}

          {/* Currently Importing */}
          {(() => {
            const current = seriesProgress?.filter(s => s.import_status !== 'completed' && s.import_status !== 'empty');
            const now = current?.[0];
            if (!now) return null;
            const idx = seriesProgress.filter(s => s.import_status === 'completed' || s.import_status === 'empty').length + 1;
            const total = seriesProgress.length;
            return (
              <div className="bg-gradient-to-r from-blue-50 to-emerald-50 dark:from-blue-900/10 dark:to-emerald-900/10 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 mb-6 flex items-center gap-4">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                <div className="text-sm">
                  <span className="font-bold text-blue-700 dark:text-blue-300">Now importing: </span>
                  <span className="text-slate-700 dark:text-slate-300">[{idx}/{total}] {now.package_name} — {now.series_name}</span>
                  <span className="text-xs text-slate-400 ml-2">({now.section_name})</span>
                </div>
              </div>
            );
          })()}

          {/* Package-wise progress (sorted by package name) */}
          {packageProgress.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 text-slate-500 font-bold text-xs uppercase tracking-wider">
                      <th className="text-left py-3 px-5">Package</th>
                      <th className="text-center py-3 px-3">Progress</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...packageProgress].sort((a, b) => a.name.localeCompare(b.name)).map(ex => {
                      const pct = ex.series_count > 0 ? Math.round((ex.completed_series / ex.series_count) * 100) : 0;
                      return (
                        <tr key={ex.slug} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-3 px-5 font-semibold">{ex.name}</td>
                          <td className="py-3 px-3">
                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-5 overflow-hidden relative">
                              <div className="bg-emerald-500 h-full rounded-full transition-all duration-1000 ease-out flex items-center justify-end px-2" style={{ width: `${pct}%`, minWidth: pct > 0 ? '2.5rem' : '0' }}>
                                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{pct}%</span>
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* No pipeline data — show REST summary */}
          {!data && restSummary && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
              <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800/40 flex items-center justify-between">
                <h2 className="text-lg font-extrabold">Database Summary</h2>
                <span className="text-sm text-slate-500">{totalQuestionsFromRest.toLocaleString()} total questions</span>
              </div>
              {restByExam.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <FiDatabase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="font-semibold">No data available</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 text-slate-500 font-bold text-xs uppercase tracking-wider">
                        <th className="text-left py-3 px-5">Exam</th>
                        <th className="text-center py-3 px-4">Year</th>
                        <th className="text-center py-3 px-4">Shift</th>
                        <th className="text-center py-3 px-4">Date</th>
                        <th className="text-right py-3 px-5">Questions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {restSummary.map((r, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-2.5 px-5 font-semibold">{r.exam_name}</td>
                          <td className="py-2.5 px-4 text-center">{r.year}</td>
                          <td className="py-2.5 px-4 text-center">{r.shift || '-'}</td>
                          <td className="py-2.5 px-4 text-center text-xs text-slate-500">{r.exam_date || '-'}</td>
                          <td className="py-2.5 px-5 text-right font-extrabold text-blue-600 dark:text-blue-400">{r.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/20 font-bold">
                        <td colSpan="4" className="py-3 px-5 text-right text-slate-500 text-xs uppercase">Total</td>
                        <td className="py-3 px-5 text-right font-extrabold text-blue-600 dark:text-blue-400 text-base">{totalQuestionsFromRest.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Pipeline shift filter bar — only when pipeline data exists */}
          {data && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm mb-4 flex flex-wrap gap-3 items-center">
              <span className="text-xs font-bold text-slate-400 uppercase">Filter</span>
              {[
                { label: 'Exam', value: filterExam, set: setFilterExam, options: filterOptions.exams },
                { label: 'Tier', value: filterTier, set: setFilterTier, options: filterOptions.tiers },
                { label: 'Year', value: filterYear, set: setFilterYear, options: filterOptions.years },
                { label: 'Status', value: filterStatus, set: setFilterStatus, options: ['All', 'completed', 'pending', 'empty', 'failed'] }
              ].map(f => (
                <select key={f.label} value={f.value} onChange={e => f.set(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ))}
              <span className="text-xs text-slate-400 ml-auto">{filteredShifts.length} shifts</span>
            </div>
          )}

          {/* Pipeline shifts table — only when pipeline data exists */}
          {data && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              {filteredShifts.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <FiDatabase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                  <p className="font-semibold">No shifts match your filters</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/10 text-slate-500 font-bold text-xs uppercase tracking-wider">
                        <th className="text-left py-3 px-5">Shift</th>
                        <th className="text-left py-3 px-4">Exam</th>
                        <th className="text-center py-3 px-3">Tier</th>
                        <th className="text-center py-3 px-3">Year</th>
                        <th className="text-center py-3 px-3">Date</th>
                        <th className="text-left py-3 px-4">Series ID</th>
                        <th className="text-left py-3 px-4">Series Name</th>
                        <th className="text-right py-3 px-5">Questions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredShifts.map((s, i) => (
                        <tr key={i} className="border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                          <td className="py-2.5 px-5 font-semibold text-sm">{s.shift}</td>
                          <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-medium">{s.exam}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-md font-semibold">{s.tier}</span>
                          </td>
                          <td className="py-2.5 px-3 text-center font-bold">{s.year}</td>
                          <td className="py-2.5 px-3 text-center text-xs text-slate-500">{s.date || '-'}</td>
                          <td className="py-2.5 px-4 font-mono text-xs text-slate-500">{s.series_id || '-'}</td>
                          <td className="py-2.5 px-4 text-xs text-slate-500 max-w-[200px] truncate" title={s.series_name}>{s.series_name || '-'}</td>
                          <td className="py-2.5 px-5 text-right font-extrabold text-blue-600 dark:text-blue-400">{s.count.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/20 font-bold">
                        <td colSpan="7" className="py-3 px-5 text-right text-slate-500 text-xs uppercase">Total</td>
                        <td className="py-3 px-5 text-right font-extrabold text-blue-600 dark:text-blue-400 text-base">{totalFiltered.toLocaleString()}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* No data at all */}
          {!data && !restSummary && !restLoading && (
            <div className="text-center py-16 text-slate-400">
              <FiDatabase className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
              <p className="font-semibold">Database status unavailable</p>
              <p className="text-sm mt-1">The pipeline server may be offline.</p>
            </div>
          )}

        </div>
      </div>
    </>
  );
});

DatabaseStatus.displayName = 'DatabaseStatus';

export default DatabaseStatus;

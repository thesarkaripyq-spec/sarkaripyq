import React, { useState, useEffect, memo } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiCheckCircle, FiZap, FiShield } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';
import { examsAPI } from '../services/api';

const homeFaqs = [
  { question: 'What is SarkariPYQ and how does it help SSC aspirants?', answer: 'SarkariPYQ is a 100% free online platform designed for SSC aspirants to practice real previous year questions (PYQs) for exams like SSC CGL, CHSL, GD, MTS, and CPO. Every question comes with detailed explanations, helping you understand the exam pattern, improve your speed, and boost your accuracy.' },
  { question: 'Is SarkariPYQ completely free to use? Are there any hidden charges?', answer: 'Yes, SarkariPYQ is entirely free. There are no subscriptions, registration fees, or hidden charges. You can practice unlimited previous year questions (PYQs) online anytime without paying anything.' },
  { question: 'Which SSC exams are covered on SarkariPYQ?', answer: 'We cover all major SSC exams including SSC CGL, SSC CHSL, SSC GD Constable, SSC MTS, SSC CPO, and SSC Stenographer. You can practice questions from 2017 to 2025, filtered by exam, year, subject, and shift.' },
  { question: 'Can I practice SSC previous year questions in both Hindi and English?', answer: 'Yes, all SSC previous year questions on SarkariPYQ are available in both Hindi and English. We provide bilingual questions and explanations so you can study comfortably in your preferred language.' }
];

const Home = memo(() => {
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    examsAPI.getAll()
      .then((res) => {
        const apiExams = res?.data || [];
        setExams(apiExams.map((e) => ({
          name: e.name,
          slug: e.slug,
          description: e.description,
          questionCount: e.questionCount || 0,
          is_popular: e.is_popular || false,
        })));
      })
      .catch(() => setExams([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEOHead
        title="SSC Previous Year Questions 2025 | Free PYQ Practice Online with Answers in Hindi"
        description="Practice 1 Lakh+ SSC Previous Year Questions (PYQ) FREE. SSC CGL PYQ, CHSL PYQ, GD PYQ, MTS PYQ with detailed answers & explanations in Hindi & English."
        keywords={['SSC PYQ', 'SSC Previous Year Questions', 'SSC CGL PYQ', 'SSC CGL Previous Year Papers', 'SSC CHSL PYQ', 'SSC CHSL Previous Year Questions', 'SSC GD PYQ', 'SSC MTS PYQ', 'SSC Mock Test', 'SSC Practice Set', 'SSC Question Bank', 'Government Exam PYQ', 'Banking PYQ', 'Railway PYQ', 'Previous Year Question Papers', 'Free MCQ Practice Hindi']}
        canonicalUrl="https://sarkaripyq.com/"
        ogType="website"
        ogImage="/ssc-logo.webp"
        pageUrl="/"
        faqData={homeFaqs}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "SarkariPYQ - SSC Previous Year Questions Free Practice",
          "description": "Practice 1 Lakh+ SSC CGL, CHSL, GD, MTS Previous Year Questions FREE with answers in Hindi & English.",
          "url": "https://sarkaripyq.com",
          "mainEntity": {
            "@type": "WebApplication",
            "name": "SarkariPYQ",
            "applicationCategory": "EducationApplication",
            "operatingSystem": "Web",
            "offers": { "@type": "Offer", "price": "0", "priceCurrency": "INR" }
          }
        }}
      />

      <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-x-hidden">

        {/* Hero Section */}
        <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 lg:py-16">

            <div className="max-w-3xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <img src="/ssc-logo.webp" alt="SSC Previous Year Questions Practice - SarkariPYQ" className="h-10 sm:h-12 w-auto" width="48" height="48" loading="eager" decoding="async" fetchpriority="high" />
                <span className="text-xs sm:text-sm font-semibold tracking-wide bg-blue-100 text-blue-700 px-3 py-1 rounded-full dark:bg-slate-800 dark:text-blue-300">
                  All SSC Exams Covered
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mb-3 sm:mb-6">
                Master SSC Exams with <span className="text-blue-600 dark:text-blue-400">RealPYQ</span> on <span className="text-blue-600 dark:text-blue-400">SarkariPYQ</span>
              </h1>
              <p className="text-sm sm:text-base md:text-xl text-slate-600 dark:text-slate-300 mb-5 sm:mb-8 leading-relaxed px-2 sm:px-0">
                Select your exam and start practicing with real previous year questions.<br />
                <span className="text-base sm:text-lg font-bold">No PDFs, Only Questions</span>
              </p>

            </div>
          </div>
        </section>

        {/* Features Banner */}
        <section className="py-8 sm:py-14 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
              <div className="group relative bg-white dark:bg-slate-800/80 rounded-2xl p-5 sm:p-7 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-12 h-12 mx-auto mb-3 sm:mb-4 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FiZap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">100% Free</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">No hidden charges, ever</p>
              </div>
              <div className="group relative bg-white dark:bg-slate-800/80 rounded-2xl p-5 sm:p-7 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-12 h-12 mx-auto mb-3 sm:mb-4 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FiShield className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">Built for SSC Aspirants</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">Fast, Clean &amp; Exam-Focused</p>
              </div>
              <div className="group relative bg-white dark:bg-slate-800/80 rounded-2xl p-5 sm:p-7 text-center shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-slate-200/60 dark:border-slate-700/60">
                <div className="w-12 h-12 mx-auto mb-3 sm:mb-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <FiCheckCircle className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-1.5">Practice PYQs Online</h3>
              </div>
            </div>
          </div>
        </section>

        {/* Popular Exams */}
        <section className="py-8 sm:py-12 lg:py-16 bg-white dark:bg-slate-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-12">
              <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-3">
                All SSC Exams Covered
              </h2>
              <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                Choose your exam and start practicing real previous year questions instantly — no PDFs, no signup required.
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {[1,2,3,4,5,6].map((i) => (
                  <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-600 p-4 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-40 mb-3"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-28"></div>
                  </div>
                ))}
              </div>
            ) : exams.length === 0 ? (
              <p className="text-center text-slate-500 dark:text-slate-400 py-8">
                No exams available yet. Check back soon!
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {exams.map((exam) => (
                  <Link
                    key={exam.slug}
                    to={`/ssc/${exam.slug}_previous_year_questions`}
                    className="group relative bg-white dark:bg-slate-800 rounded-xl border-2 border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 p-4 sm:p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                            {exam.name}
                          </h3>
                          {exam.is_popular && (
                            <span className="text-[10px] sm:text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                              Popular
                            </span>
                          )}
                        </div>

                        {exam.description && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                            {exam.description}
                          </p>
                        )}

                        {(exam.questionCount || 0) > 0 ? (
                          <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-slate-700 dark:text-slate-300">
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                            <span>{(exam.questionCount || 0).toLocaleString('en-IN')}+ PYQ Questions</span>
                          </div>
                        ) : (
                          <div className="mt-2 flex items-center gap-1 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            <span>Coming soon</span>
                          </div>
                        )}
                      </div>

                      <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 flex items-center justify-center group-hover:border-slate-300 dark:group-hover:border-slate-500 transition-colors">
                        <svg className="w-5 h-5 text-slate-400 dark:text-slate-500 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* FAQ Section */}
        <section className="py-6 sm:py-10 bg-white dark:bg-slate-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-base sm:text-xl font-bold text-slate-900 dark:text-white text-center mb-5 sm:mb-7">
              Frequently Asked Questions
            </h2>
            <div className="space-y-4">
              {homeFaqs.map((faq, i) => (
                <details key={i} className="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 open:shadow-md transition-all">
                  <summary className="flex items-center justify-between p-4 sm:p-5 cursor-pointer text-sm sm:text-base font-semibold text-slate-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                    <span className="flex items-start gap-2">
                      <span className="text-blue-600 font-extrabold shrink-0">Q.</span>
                      {faq.question}
                    </span>
                    <FiArrowRight className="w-4 h-4 shrink-0 text-slate-400 group-open:rotate-90 transition-transform" />
                  </summary>
                  <div className="px-4 sm:px-5 pb-4 sm:pb-5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed pl-8 sm:pl-9">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>

      </div>
    </>
  );
});

Home.displayName = 'Home';

export default Home;

import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../components/Common/SEOHead';

const FAQ = memo(() => {
  const faqs = [
    {
      q: "How to download SSC previous year questions PDF for free?",
      a: "You can access SSC previous year questions directly on SarkariPYQ without downloading any PDF. Our platform hosts thousands of real PYQs from SSC CGL, CHSL, GD, CPO, MTS and other exams. Simply select your exam, choose subject, and start practicing online with instant results and detailed explanations."
    },
    {
      q: "Which website is best for SSC PYQ practice?",
      a: "SarkariPYQ is among the best free platforms for SSC PYQ practice. We provide authentic previous year questions with accurate answer keys, detailed explanations, and performance analytics. Our question bank covers all major SSC exams including CGL, CHSL, GD, CPO, and MTS with latest questions."
    },
    {
      q: "How to crack SSC CGL in first attempt?",
      a: "Cracking SSC CGL requires smart preparation strategy. Start with understanding exam pattern and syllabus, then practice PYQs consistently. Focus on your weak areas using our analytics, take mock tests regularly, and analyze mistakes. Our platform provides topic-wise PYQs and performance tracking to help you clear SSC CGL in first attempt."
    },
    {
      q: "How many questions are asked from PYQ in SSC exams?",
      a: "SSC exams frequently repeat questions from previous years. Our analysis shows 15-25% of questions in SSC CGL, CHSL, and GD exams are either same or similar to PYQs. Regular practice with our question bank gives you direct advantage. We update our PYQ collection annually to include latest exam questions."
    },
    {
      q: "Is SSC PYQ enough for SSC CGL Tier-1 preparation?",
      a: "Previous year questions are essential for SSC CGL preparation but not sufficient alone. PYQs help you understand exam pattern, difficulty level, and important topics. Combine PYQ practice with conceptual study, current affairs, and mock tests for best results. Our platform tracks your progress and suggests areas needing improvement."
    },
    {
      q: "What makes SarkariPYQ different from other SSC PYQ websites?",
      a: "SarkariPYQ stands out with: Real SSC exam questions (not mock questions), Detailed explanations for every answer, Performance analytics to track improvement, Questions organized by exam, year, subject, and topic, Free access to all features, Mobile-friendly practice platform, Regular updates with latest exam questions."
    }
  ];

  return (
    <div className='min-h-screen bg-white dark:bg-slate-950'>
      <SEOHead
        title='SSC PYQ FAQ - Frequently Asked Questions | SarkariPYQ'
        description='Find answers to common SSC PYQ questions. Learn about SSC CGL, CHSL, GD PYQ practice, free PDF downloads, exam strategies, and more at SarkariPYQ.'
        faqData={faqs.map(f => ({ question: f.q, answer: f.a }))}
        pageUrl="/faq"
        ogImage="/ssc-logo.webp"
      />
      
      <div className='max-w-4xl mx-auto px-4 py-16'>
        <div className='text-center mb-12'>
          <h1 className='text-4xl font-bold text-gray-900 dark:text-white mb-4'>
            SSC PYQ FAQ
          </h1>
          <p className='text-lg text-gray-600 dark:text-gray-400'>
            Frequently asked questions about SSC previous year questions and exam preparation
          </p>
        </div>

        <div className='space-y-4'>
          {faqs.map((faq, idx) => (
            <details 
              key={idx} 
              className='group bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 overflow-hidden'
            >
              <summary className='flex items-center justify-between cursor-pointer p-5 font-medium text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-slate-800'>
                <span className='pr-4'>{faq.q}</span>
                <span className='transition group-open:rotate-180 flex-shrink-0'>
                  <svg fill='none' height='24' shapeRendering='geometricPrecision' stroke='currentColor' strokeLinecap='round' strokeLinejoin='round' strokeWidth='1.5' viewBox='0 0 24 24' width='24'>
                    <path d='M6 9l6 6 6-6'></path>
                  </svg>
                </span>
              </summary>
              <div className='p-5 text-gray-600 dark:text-gray-400 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800'>
                {faq.a}
              </div>
            </details>
          ))}
        </div>

        <div className='mt-16 text-center'>
          <p className='text-gray-600 dark:text-gray-400 mb-4'>
            Still have questions? Contact our support team
          </p>
          <Link
            to='/contact'
            className='inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors'
          >
            Contact Us
          </Link>
        </div>
      </div>
    </div>
  );
});

FAQ.displayName = 'FAQ';

export default FAQ;
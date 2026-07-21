import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const AboutUs = memo(() => {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <SEOHead
        title="About SarkariPYQ - Free SSC Previous Year Questions Practice Platform"
        description="SarkariPYQ provides free SSC Previous Year Questions (PYQ) practice online. Built by an SSC aspirant for SSC aspirants. Trusted by thousands for SSC CGL, CHSL, GD, MTS, CPO practice."
        pageUrl="/about"
        ogImage="/ssc-logo.webp"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "AboutPage",
          "name": "About SarkariPYQ",
          "description": "Free SSC Previous Year Questions practice platform built by an SSC aspirant for SSC aspirants.",
          "mainEntity": {
            "@type": "Organization",
            "name": "SarkariPYQ",
            "url": "https://sarkaripyq.com",
            "logo": "https://sarkaripyq.com/ssc-logo.webp",
            "description": "Free SSC Previous Year Questions practice platform for SSC CGL, CHSL, GD, MTS, CPO, JE exams.",
            "foundingDate": "2024",
            "founder": {
              "@type": "Person",
              "name": "SarkariPYQ Founder"
            },
            "knowsAbout": ["SSC CGL", "SSC CHSL", "SSC GD Constable", "SSC MTS", "SSC CPO", "SSC JE", "SSC Selection Post", "SSC Stenographer", "SSC Exam Preparation", "Government Job Exams in India"],
            "sameAs": [
              "https://www.facebook.com/sarkaripyq",
              "https://twitter.com/sarkaripyq"
            ]
          }
        }}
      />
      
      <div className="max-w-2xl mx-auto px-4 py-10">
        
        <h1 className="text-3xl font-bold mb-6">
          About <span className="text-blue-600">SarkariPYQ</span>
        </h1>

        <div className="space-y-5 text-slate-600 dark:text-slate-400 text-justify">

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">Our Mission</h2>
            <p>
              SarkariPYQ is a <strong>free online platform</strong> dedicated to helping SSC aspirants practice <strong>real previous year questions (PYQs)</strong>. Our mission is to make PYQ practice accessible to every student in India — regardless of their background, location, or financial situation. No PDFs, no downloads, no hidden charges. Just questions, answers, and explanations — instantly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">What We Offer</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>1 Lakh+ SSC PYQs</strong> from CGL, CHSL, GD, MTS, CPO, JE, Selection Post, and Stenographer exams</li>
              <li><strong>Bilingual explanations</strong> in English and Hindi for every question</li>
              <li><strong>Instant answers</strong> and performance analytics after every practice attempt</li>
              <li><strong>Topic-wise, year-wise, and shift-wise</strong> filtering for focused practice</li>
              <li><strong>100% free</strong> — no subscriptions, no ads, no registration required to practice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">Our Story</h2>
            <p>
              SarkariPYQ was built by an SSC aspirant who experienced firsthand the struggle of finding quality PYQ practice material. After spending countless hours searching through scattered PDFs, lengthy videos, and expensive books — the idea was simple: build a clean, fast, and free platform where anyone can practice real SSC questions with instant answers.
            </p>
            <p className="mt-3">
              What started as a personal project during late nights and weekends grew into a platform serving thousands of SSC aspirants across India. Every feature is designed with a single question in mind: <em>"Does this help the aspirant practice better?"</em>
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">Why Trust SarkariPYQ?</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Questions are sourced from real SSC previous year papers</li>
              <li>Each question includes detailed, step-by-step explanations</li>
              <li>Platform is continuously updated with new questions and improvements</li>
              <li>No personal data is required to start practicing</li>
              <li>Transparent about our independent status — we are not affiliated with SSC or ssc.gov.in</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200">Join Our Community</h2>
            <p>
              SarkariPYQ is built for SSC aspirants, by SSC aspirants. Whether you are preparing for SSC CGL, CHSL, GD, MTS, CPO, or any other SSC exam — you are welcome here. Start practicing today, track your progress, and take one step closer to your government job dream.
            </p>
          </section>

        </div>

      </div>
    </div>
  );
});

AboutUs.displayName = 'AboutUs';

export default AboutUs;

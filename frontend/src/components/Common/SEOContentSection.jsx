import React, { memo } from 'react';
import { Link } from 'react-router-dom';

const EXAM_CONTENT = {
  'ssc-cgl': {
    name: 'SSC CGL',
    fullName: 'Staff Selection Commission Combined Graduate Level',
    intro: 'SSC CGL (Combined Graduate Level) is one of the most competitive government exams in India, conducted annually by the Staff Selection Commission (SSC) to recruit candidates for Group B and Group C posts in various government departments and ministries. Practicing SSC CGL Previous Year Questions (PYQs) is the most effective strategy to understand the exam pattern, difficulty level, and question trends across all tiers.',
    benefits: [
      { title: 'Understand Exam Pattern', text: 'SSC CGL PYQs reveal the exact question format, marking scheme, and section-wise weightage for Tier-I and Tier-II exams.' },
      { title: 'Identify Important Topics', text: 'Analyzing previous year papers helps you focus on high-weightage topics that appear frequently in Quantitative Aptitude, Reasoning, English, and General Awareness.' },
      { title: 'Gauge Difficulty Level', text: 'Solve real exam questions to understand the actual difficulty range — from easy to hard — across different shifts and years.' },
      { title: 'Improve Time Management', text: 'Practice with real SSC CGL questions under timed conditions to build speed and accuracy for the actual exam.' },
    ],
    subjects: [
      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude', description: 'Arithmetic, Algebra, Geometry, Trigonometry, Data Interpretation' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Logical Reasoning, Analytical Reasoning, Puzzles, Coding-Decoding' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal and Non-Verbal Reasoning, Analogies, Classification' },
      { name: 'English Language', slug: 'english-language', description: 'Reading Comprehension, Grammar, Vocabulary, Idioms & Phrases' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Current Affairs, History, Geography, Polity, Economics, Science' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021', '2020'],
  },
  'ssc-chsl': {
    name: 'SSC CHSL',
    fullName: 'Staff Selection Commission Combined Higher Secondary Level',
    intro: 'SSC CHSL (Combined Higher Secondary Level) is a popular government exam conducted by SSC for recruitment of Lower Division Clerk (LDC), Postal Assistant (PA), Sorting Assistant (SA), and Data Entry Operator (DEO) posts. Solving SSC CHSL previous year questions is the best way to prepare effectively for Tier-I CBT and Tier-II descriptive paper.',
    benefits: [
      { title: 'Master the Exam Pattern', text: 'SSC CHSL PYQs help you understand the 60-minute CBT format, marking scheme, and section-wise distribution of questions.' },
      { title: 'Focus on Scoring Topics', text: 'Identify the most frequently asked topics in General Intelligence, English, Quantitative Aptitude, and General Awareness.' },
      { title: 'Build Speed and Accuracy', text: 'Regular practice with real CHSL questions improves your solving speed and accuracy for the time-bound exam.' },
      { title: 'Boost Confidence', text: 'Solving actual previous year papers builds familiarity and reduces exam-day anxiety.' },
    ],
    subjects: [
      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude', description: 'Number Systems, Algebra, Mensuration, Statistics, Data Interpretation' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Logical Reasoning, Verbal Reasoning, Figural Reasoning' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Analogy, Classification, Series, Coding-Decoding' },
      { name: 'English Language', slug: 'english-language', description: 'Reading Comprehension, Fill in the Blanks, Sentence Improvement, Cloze Test' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Static GK, Current Affairs, Indian Polity, Economy, Science & Technology' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021', '2020'],
  },
  'ssc-gd': {
    name: 'SSC GD',
    fullName: 'Staff Selection Commission General Duty',
    intro: 'SSC GD Constable exam is conducted by SSC for recruitment of General Duty (GD) constables in CAPFs, NIA, SSF, and Assam Rifles. Practicing SSC GD previous year questions is essential to crack the Computer-Based Test (CBT) which covers Reasoning, General Knowledge, Elementary Mathematics, and English/Hindi.',
    benefits: [
      { title: 'Understand the CBT Pattern', text: 'SSC GD PYQs give you a clear picture of the question format, marking scheme, and subject-wise weightage.' },
      { title: 'Identify Repeated Topics', text: 'Many topics repeat across years — PYQs help you spot them and prioritize your preparation.' },
      { title: 'Practice Under Real Conditions', text: 'Solve past questions in timed mode to prepare for the actual exam pressure.' },
      { title: 'Track Your Progress', text: 'Regular practice with real GD questions helps measure your improvement across subjects.' },
    ],
    subjects: [
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Analogy, Classification, Series, Coding-Decoding, Logical Reasoning' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal Reasoning, Non-Verbal Reasoning, Puzzles' },
      { name: 'English Language', slug: 'english-language', description: 'Comprehension, Grammar, Vocabulary, Sentence Correction' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Current Affairs, Indian History, Geography, Science, Polity' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021'],
  },
  'ssc-cpo': {
    name: 'SSC CPO',
    fullName: 'Staff Selection Commission Central Police Organisation',
    intro: 'SSC CPO exam is conducted for recruitment of Sub-Inspectors (SI) in Delhi Police, CAPFs, and Assistant Sub-Inspectors (ASI) in CISF. Solving SSC CPO previous year questions is the most reliable way to prepare for Paper-I (CBT) and Paper-II (English Language and Comprehension).',
    benefits: [
      { title: 'Learn the Exam Structure', text: 'SSC CPO PYQs reveal the exact format, marking scheme, and sectional timing for both Tier-I and Tier-II papers.' },
      { title: 'High-Weightage Topics', text: 'Identify topics that carry the most marks in Reasoning, Quantitative Aptitude, English, and General Awareness.' },
      { title: 'Real Exam Difficulty', text: 'Experience the actual difficulty level of SSC CPO questions across different years and shifts.' },
      { title: 'Physical + Written Prep', text: 'Balance your preparation — PYQs help you manage time between written practice and physical endurance training.' },
    ],
    subjects: [
      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude', description: 'Arithmetic, Algebra, Geometry, Trigonometry, Statistics' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Analogies, Puzzles, Syllogism, Statement-Conclusion' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal, Non-Verbal, Analytical Reasoning' },
      { name: 'English Language', slug: 'english-language', description: 'Spotting Errors, Sentence Improvement, Comprehension, Fillers' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Indian Polity, History, Geography, Science, Current Affairs' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021'],
  },
  'ssc-mts': {
    name: 'SSC MTS',
    fullName: 'Staff Selection Commission Multi Tasking Staff',
    intro: 'SSC MTS (Multi Tasking Staff) exam is conducted by SSC for recruitment of non-ministerial, non-gazetted posts in various government departments. Practicing SSC MTS previous year questions is the most effective way to prepare for the CBT and Physical Efficiency Test (PET).',
    benefits: [
      { title: 'CBT Pattern Mastery', text: 'SSC MTS PYQs help you understand the question format, time allocation, and marking scheme for the computer-based test.' },
      { title: 'Target Scoring Subjects', text: 'Focus on high-scoring areas like Numerical Aptitude, English/Hindi, Reasoning, and General Awareness based on past trends.' },
      { title: 'Build Exam Stamina', text: 'Regular timed practice with PYQs improves your speed and accuracy for the 90-minute exam.' },
      { title: 'Track Improvement', text: 'Solve year-wise papers to measure your preparation progress and identify weak areas.' },
    ],
    subjects: [
      { name: 'Quantitative Aptitude', slug: 'quantitative-aptitude', description: 'Number System, LCM & HCF, Ratio & Proportion, Percentage, Average' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Analogy, Classification, Series, Venn Diagram, Direction Test' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Logical Reasoning, Verbal Reasoning, Non-Verbal Reasoning' },
      { name: 'English Language', slug: 'english-language', description: 'Comprehension, Grammar, Vocabulary, Synonyms, Antonyms' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Current Affairs, Indian Constitution, Geography, Science in Daily Life' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021'],
  },
  'ssc-je': {
    name: 'SSC JE',
    fullName: 'Staff Selection Commission Junior Engineer',
    intro: 'SSC JE (Junior Engineer) exam is conducted by SSC for recruitment of Junior Engineers in Civil, Mechanical, Electrical, and Quantity Surveying disciplines in various government departments. Solving SSC JE previous year questions is the most effective strategy to master Paper-I (CBT) covering General Awareness, Reasoning, and Technical subjects.',
    benefits: [
      { title: 'Understand the Exam Pattern', text: 'SSC JE PYQs reveal the exact structure of Paper-I CBT and Paper-II conventional paper, including the marking scheme and time allocation.' },
      { title: 'Master Technical Subjects', text: 'With discipline-specific technical questions, PYQs help you focus on the most important topics in Civil, Mechanical, and Electrical Engineering.' },
      { title: 'Identify Repeated Questions', text: 'Many SSC JE general awareness and reasoning questions repeat from previous years — PYQs help you spot these patterns.' },
      { title: 'Build Exam Confidence', text: 'Regular practice with real JE questions reduces exam anxiety and improves time management.' },
    ],
    subjects: [
      { name: 'General Awareness', slug: 'general-awareness', description: 'Current Affairs, Indian History, Geography, Polity, Science, Economics' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Analogies, Classification, Puzzles, Syllogism, Logical Reasoning' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal Reasoning, Non-Verbal Reasoning, Analytical Reasoning' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021', '2020'],
  },
  'ssc-selection-post': {
    name: 'SSC Selection Post',
    fullName: 'Staff Selection Commission Selection Post',
    intro: 'SSC Selection Post examination is conducted for recruitment of various posts across different government ministries and departments. Practicing SSC Selection Post previous year questions is the best way to prepare for Phase-VIII and upcoming phases, covering General Intelligence, General Awareness, and English.',
    benefits: [
      { title: 'Understand Selection Post Pattern', text: 'SSC Selection Post PYQs help you understand the unique exam pattern with multiple phases and post-specific requirements.' },
      { title: 'Focus on High-Weightage Topics', text: 'Analyze past papers to identify the most frequently asked topics in General Intelligence, English, and General Awareness.' },
      { title: 'Practice Across Different Phases', text: 'With multiple phases and shifting syllabi, PYQs give you broad exposure to the types of questions asked historically.' },
      { title: 'Build Speed and Accuracy', text: 'Timed practice with real Selection Post questions improves your solving speed for the competitive exam.' },
    ],
    subjects: [
      { name: 'General Awareness', slug: 'general-awareness', description: 'History, Geography, Polity, Economy, Science, Current Affairs' },
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Logical Reasoning, Analogies, Classification, Series, Puzzles' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal and Non-Verbal Reasoning, Analytical Ability' },
      { name: 'English Language', slug: 'english-language', description: 'Comprehension, Grammar, Vocabulary, Sentence Correction, Fillers' },
      { name: 'English Comprehension', slug: 'english-comprehension', description: 'Reading Comprehension, Cloze Test, Para Jumbles' },
    ],
    years: ['2025', '2024', '2023'],
  },
  'ssc-stenographer': {
    name: 'SSC Stenographer',
    fullName: 'Staff Selection Commission Stenographer',
    intro: 'SSC Stenographer exam is conducted for recruitment of Grade C and Grade D Stenographers in various government ministries and departments. Solving SSC Stenographer previous year questions is essential for cracking the CBT covering General Intelligence, General Awareness, and English.',
    benefits: [
      { title: 'Master the CBT Pattern', text: 'SSC Stenographer PYQs reveal the exact question format, marking scheme, and time allocation for the computer-based test.' },
      { title: 'Focus on English & GK', text: 'Identify frequently tested topics in English Language and General Awareness that form the core of the exam.' },
      { title: 'Prepare for Skill Test', text: 'While PYQs focus on CBT, regular practice helps you manage time effectively for the subsequent skill test.' },
      { title: 'Track Your Progress', text: 'Solve year-wise papers to measure improvement and identify weak areas in your preparation.' },
    ],
    subjects: [
      { name: 'Reasoning Ability', slug: 'reasoning-ability', description: 'Analogies, Classification, Coding-Decoding, Series, Logical Reasoning' },
      { name: 'General Intelligence & Reasoning', slug: 'general-intelligence-and-reasoning', description: 'Verbal Reasoning, Non-Verbal Reasoning, Analytical Ability' },
      { name: 'English Language', slug: 'english-language', description: 'Comprehension, Grammar, Vocabulary, Idioms, Sentence Improvement' },
      { name: 'General Awareness', slug: 'general-awareness', description: 'Current Affairs, Indian History, Geography, Politics, Science & Technology' },
    ],
    years: ['2025', '2024', '2023', '2022', '2021'],
  },
};

const RELATED_EXAMS = [
  { name: 'SSC CGL PYQ', slug: 'ssc-cgl', path: '/ssc/ssc-cgl_previous_year_questions' },
  { name: 'SSC CHSL PYQ', slug: 'ssc-chsl', path: '/ssc/ssc-chsl_previous_year_questions' },
  { name: 'SSC GD PYQ', slug: 'ssc-gd', path: '/ssc/ssc-gd_previous_year_questions' },
  { name: 'SSC MTS PYQ', slug: 'ssc-mts', path: '/ssc/ssc-mts_previous_year_questions' },
  { name: 'SSC CPO PYQ', slug: 'ssc-cpo', path: '/ssc/ssc-cpo_previous_year_questions' },
  { name: 'SSC JE PYQ', slug: 'ssc-je', path: '/ssc/ssc-je_previous_year_questions' },
  { name: 'SSC Selection Post PYQ', slug: 'ssc-selection-post', path: '/ssc/ssc-selection-post_previous_year_questions' },
  { name: 'SSC Stenographer PYQ', slug: 'ssc-stenographer', path: '/ssc/ssc-stenographer_previous_year_questions' },
];

const SEOContentSection = memo(({ examSlug, examName }) => {
  const content = EXAM_CONTENT[examSlug];
  if (!content || !examSlug) return null;

  const relatedExams = RELATED_EXAMS.filter(e => e.slug !== examSlug);

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8 py-8">
      {/* Introduction */}
      <section className="mb-8">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {content.name} Previous Year Questions — Free Online Practice
        </h2>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
          {content.intro}
        </p>
      </section>

      {/* Why Solve PYQs */}
      <section className="mb-8">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          Why Solve {content.name} Previous Year Questions?
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {content.benefits.map((benefit, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h4 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">{benefit.title}</h4>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Topic-wise PYQs */}
      <section className="mb-8">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          Topic-wise {content.name} Previous Year Questions
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {content.subjects.map((subject) => (
            <Link
              key={subject.slug}
              to={`/ssc/${examSlug}/${subject.slug}_previous_year_questions`}
              className="block bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-3 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
            >
              <h4 className="font-semibold text-sm text-blue-600 dark:text-blue-400">{subject.name}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subject.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Year-wise PYQs */}
      <section className="mb-8">
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          Year-wise {content.name} Previous Year Question Papers
        </h3>
        <div className="flex flex-wrap gap-2">
          {content.years.map((year) => (
            <Link
              key={year}
              to={`/ssc/${examSlug}/${year}_previous_year_questions`}
              className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
            >
              {content.name} {year} Paper
            </Link>
          ))}
        </div>
      </section>

      {/* Related Exams */}
      <section>
        <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-4">
          Explore Other SSC Exam PYQs
        </h3>
        <div className="flex flex-wrap gap-2">
          {relatedExams.map((exam) => (
            <Link
              key={exam.slug}
              to={exam.path}
              className="inline-block bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors"
            >
              {exam.name}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
});

SEOContentSection.displayName = 'SEOContentSection';

export default SEOContentSection;

import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const BestBooks = memo(() => {
  const subjectsByExam = {
    'SSC CGL': [
      {
        title: 'Lucent General Knowledge',
        author: 'Vinay Karna, Manwendra Mukul',
        why: 'The go-to book for static GK. Covers history, geography, polity, economics & science.',
        link: 'https://www.amazon.in/s?k=lucent+general+knowledge+book&tag=sarkaripyq-21',
        price: '₹180',
        image: 'https://m.media-amazon.com/images/I/71Y9oN3WPLL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Kiran SSC Mathematics',
        author: 'Kiran Institute',
        why: '1100+ questions with detailed solutions. Best for extensive math practice.',
        link: 'https://www.amazon.in/s?k=kiran+ssc+mathematics+book&tag=sarkaripyq-21',
        price: '₹340',
        image: 'https://m.media-amazon.com/images/I/61H4IuPoRXL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Objective General English (Arihant)',
        author: 'S. P. Bakshi',
        why: 'Complete grammar, vocabulary & comprehension. Best for Tier-I & II English.',
        link: 'https://www.amazon.in/s?k=sp+bakshi+objective+english&tag=sarkaripyq-21',
        price: '₹250',
        image: 'https://m.media-amazon.com/images/I/61zNdqJoR3L._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Lucent Reasoning',
        author: 'Sandip Kumar',
        why: 'Covers all reasoning topics with shortcut approaches. Easy to understand.',
        link: 'https://www.amazon.in/s?k=lucent+reasoning+book&tag=sarkaripyq-21',
        price: '₹160',
        image: 'https://m.media-amazon.com/images/I/61R8fQ6rSML._AC_UF1000,1000_QL80_.jpg'
      }
    ],
    'SSC CHSL': [
      {
        title: 'SSC CHSL Chapterwise (Arihant)',
        author: 'Arihant Experts',
        why: 'Chapterwise solved papers as per latest CHSL pattern.',
        link: 'https://www.amazon.in/s?k=ssc+chsl+previous+year+question+book+arihant&tag=sarkaripyq-21',
        price: '₹280',
        image: 'https://m.media-amazon.com/images/I/71H5S8bFaXL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'General Intelligence & Reasoning (CHSL)',
        author: 'Kiran Institute',
        why: 'CHSL-specific reasoning questions with solutions.',
        link: 'https://www.amazon.in/s?k=kiran+ssc+chsl+reasoning&tag=sarkaripyq-21',
        price: '₹195',
        image: 'https://m.media-amazon.com/images/I/61R8fQ6rSML._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'English Vol. 1 & 2 (SP Bakshi)',
        author: 'S. P. Bakshi',
        why: 'Complete English grammar & vocabulary for Tier-I.',
        link: 'https://www.amazon.in/s?k=sp+bakshi+english+vol+1+2&tag=sarkaripyq-21',
        price: '₹320',
        image: 'https://m.media-amazon.com/images/I/61zNdqJoR3L._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Quantitative Aptitude (CHSL)',
        author: 'Arihant Experts',
        why: 'Basic to intermediate math covering all topics.',
        link: 'https://www.amazon.in/s?k=quantitative+aptitude+ssc+chsl+arihant&tag=sarkaripyq-21',
        price: '₹210',
        image: 'https://m.media-amazon.com/images/I/61YpO9jKaOL._AC_UF1000,1000_QL80_.jpg'
      }
    ],
    'SSC GD': [
      {
        title: 'General Knowledge (Lucent)',
        author: 'Vinay Karna',
        why: 'Static GK with all important facts. Most weightage in GD exam.',
        link: 'https://www.amazon.in/s?k=lucent+gk&tag=sarkaripyq-21',
        price: '₹180',
        image: 'https://m.media-amazon.com/images/I/71Y9oN3WPLL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'SSC Constable GD (Arihant)',
        author: 'Arihant Experts',
        why: 'Complete book covering all 4 subjects for GD.',
        link: 'https://www.amazon.in/s?k=ssc+gd+constable+book+arihant&tag=sarkaripyq-21',
        price: '₹350',
        image: 'https://m.media-amazon.com/images/I/71H5S8bFaXL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Reasoning & IQ (GD)',
        author: 'Kiran Institute',
        why: 'Basic reasoning questions. Perfect for GD level.',
        link: 'https://www.amazon.in/s?k=kiran+reasoning+ssc+gd&tag=sarkaripyq-21',
        price: '₹150',
        image: 'https://m.media-amazon.com/images/I/61R8fQ6rSML._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Maths & English (Basic)',
        author: 'Arihant',
        why: 'Simple concepts for Tier-1 basics.',
        link: 'https://www.amazon.in/s?k=ssc+gd+maths+english+book&tag=sarkaripyq-21',
        price: '₹220',
        image: 'https://m.media-amazon.com/images/I/61YpO9jKaOL._AC_UF1000,1000_QL80_.jpg'
      }
    ],
    'SSC MTS': [
      {
        title: 'SSC MTS Book (Arihant)',
        author: 'Arihant Experts',
        why: 'Complete book with all 4 subjects for MTS.',
        link: 'https://www.amazon.in/s?k=ssc+mts+book+arihant&tag=sarkaripyq-21',
        price: '₹380',
        image: 'https://m.media-amazon.com/images/I/71H5S8bFaXL._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'General Intelligence (MTS)',
        author: 'Kiran Institute',
        why: 'Basic reasoning questions for Tier-1.',
        link: 'https://www.amazon.in/s?k=kiran+mts+reasoning&tag=sarkaripyq-21',
        price: '₹140',
        image: 'https://m.media-amazon.com/images/I/61R8fQ6rSML._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'English (MTS)',
        author: 'SP Bakshi',
        why: 'Basic grammar & vocabulary for Tier-I.',
        link: 'https://www.amazon.in/s?k=sp+bakshi+english&tag=sarkaripyq-21',
        price: '₹190',
        image: 'https://m.media-amazon.com/images/I/61zNdqJoR3L._AC_UF1000,1000_QL80_.jpg'
      },
      {
        title: 'Numerical Aptitude (MTS)',
        author: 'Arihant',
        why: 'Simple math concepts for Tier-1.',
        link: 'https://www.amazon.in/s?k=ssc+mts+maths+book&tag=sarkaripyq-21',
        price: '₹170',
        image: 'https://m.media-amazon.com/images/I/61YpO9jKaOL._AC_UF1000,1000_QL80_.jpg'
      }
    ]
  };

  const examColors = {
    'SSC CGL': 'bg-blue-600 dark:bg-blue-500 shadow-sm shadow-blue-500/20',
    'SSC CHSL': 'bg-green-600 dark:bg-green-500 shadow-sm shadow-green-500/20',
    'SSC GD': 'bg-orange-600 dark:bg-orange-500 shadow-sm shadow-orange-500/20',
    'SSC MTS': 'bg-purple-600 dark:bg-purple-500 shadow-sm shadow-purple-500/20'
  };

  const BookCard = ({ book }) => {
    const subjectTag = book.title.includes('Math') || book.title.includes('Numerical') || book.title.includes('Quant') ? 'Maths' : 
           book.title.includes('English') ? 'English' : 
           book.title.includes('Reasoning') || book.title.includes('IQ') ? 'Reasoning' : 
           book.title.includes('GK') || book.title.includes('General') ? 'GK' : 'General';
    
    const subjectColors = {
      Maths: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-100 dark:border-blue-900/20',
      English: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-100 dark:border-green-900/20',
      Reasoning: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-100 dark:border-purple-900/20',
      GK: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-100 dark:border-amber-900/20',
      General: 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-100 dark:border-slate-700/50'
    };

    const tagColor = subjectColors[subjectTag] || subjectColors.General;

    return (
      <a
        href={book.link}
        target="_blank"
        rel="noreferrer"
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md transition-all duration-300 group"
      >
        <div className="flex-1 min-w-0 w-full">
          <div className="flex items-center justify-between sm:justify-start gap-2 mb-1.5">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${tagColor}`}>
              {subjectTag}
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">Approx:</span>
              <span className="text-xs font-bold text-slate-900 dark:text-white">
                {book.price}
              </span>
            </div>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-800 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
            {book.title}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{book.author}</p>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed line-clamp-2">
            {book.why}
          </p>
        </div>
        
        <div className="w-full sm:w-auto flex-shrink-0 mt-4 sm:mt-0 pt-3 sm:pt-0 border-t border-slate-100 dark:border-slate-800/80 sm:border-none flex justify-end">
          <span className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-xl bg-blue-600 dark:bg-blue-500 text-white text-xs font-bold hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors shadow-sm">
            Check Price
          </span>
        </div>
      </a>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 py-8 sm:py-12">
      <SEOHead
        title="Best Books for SSC Preparation | Exam & Subject Wise Recommendations"
        description="Curated SSC exam book recommendations for CGL, CHSL, GD, MTS by subject. Find the best books for Quantitative Aptitude, Reasoning, English, General Awareness."
        pageUrl="/best-books-for-ssc-exams"
        ogImage="/ssc-logo.webp"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "ItemList",
          "name": "Best Books for SSC Preparation",
          "description": "Curated book recommendations for SSC CGL, CHSL, GD, and MTS exams organized by subject.",
          "numberOfItems": Object.values(subjectsByExam).flat().length,
          "itemListElement": Object.entries(subjectsByExam).flatMap(([exam, books], examIdx) =>
            books.map((book, bookIdx) => ({
              "@type": "ListItem",
              "position": examIdx * 4 + bookIdx + 1,
              "item": {
                "@type": "Book",
                "name": book.title,
                "author": book.author,
                "offers": {
                  "@type": "Offer",
                  "price": book.price.replace('₹', ''),
                  "priceCurrency": "INR"
                }
              }
            }))
          )
        }}
      />
      
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* ===== HEADER ===== */}
        <header className="text-center mb-10 sm:mb-12">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400 mb-2">SSC 2026–2027</p>
          <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Best Books for SSC Preparation
          </h1>
          <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-xl mx-auto mt-2 leading-relaxed">
            Curated book recommendations <span className="font-semibold text-slate-950 dark:text-white">exam-wise & subject-wise</span>, so you pick the right book for your exam.
          </p>
        </header>

        {/* ===== EXAM SECTIONS ===== */}
        <div className="space-y-10 sm:space-y-12">
          {Object.entries(subjectsByExam).map(([exam, books], idx) => (
            <section key={exam} className="bg-white dark:bg-slate-900/40 rounded-2xl p-5 sm:p-6 border border-slate-200 dark:border-slate-800/80 shadow-sm">
              <div className="flex items-center gap-3.5 mb-6">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-sm ${
                  examColors[exam] || 'bg-slate-500'
                }`}>
                  #{idx + 1}
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                    {exam} Books
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {exam === 'SSC CGL' && 'Graduate Level - Tier-I & Tier-II Resources'}
                    {exam === 'SSC CHSL' && 'Higher Secondary - LDC, DEO, PSA Resources'}
                    {exam === 'SSC GD' && 'Constable in CAPFs and Rifleman Resources'}
                    {exam === 'SSC MTS' && 'Multi-Tasking Staff Resources'}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {books.map((book) => (
                  <BookCard 
                    key={book.title} 
                    book={book}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="text-center mt-12 pb-6 border-t border-slate-200/60 dark:border-slate-800/80 pt-8 max-w-md mx-auto">
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            Focus more on <span className="font-semibold text-slate-600 dark:text-slate-300">practice & solving PYQs</span> than collecting excessive resources.
          </p>
        </div>

      </div>
    </div>
  );
});

BestBooks.displayName = 'BestBooks';

export default BestBooks;
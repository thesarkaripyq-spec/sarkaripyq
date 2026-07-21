import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const SupportContact = memo(() => {
  return (
    <div className='bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'>
      <SEOHead
        title="SSC PYQ Support & Contact | Get Help with SarkariPYQ"
        description="Get support for SarkariPYQ - SSC CGL, CHSL, GD, MTS, CPO PYQ practice platform. Help with account, exams, or technical issues. Contact our support team."
        pageUrl="/support"
        ogImage="/ssc-logo.webp"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": "Support & Contact - SarkariPYQ",
          "description": "Get support for SarkariPYQ platform.",
          "mainEntity": {
            "@type": "Organization",
            "name": "SarkariPYQ",
            "url": "https://sarkaripyq.com",
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "thesarkaripyq@gmail.com",
              "contactType": "technical support",
              "availableLanguage": ["English", "Hindi"]
            }
          }
        }}
      />
      <div className='max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10'>
        <h1 className='text-3xl font-bold mb-3'>Support & Contact</h1>
        <div className='space-y-3 text-slate-700 dark:text-slate-300'>
          <p>Need help with practice, exams, or your account? We are here to assist you.</p>
          <p>For faster support, include your registered email, exam name, and a short description of the issue.</p>
          <ul className='list-disc pl-5 space-y-1'>
            <li>Email: thesarkaripyq@gmail.com</li>
            <li>Phone: +91-1234567890</li>
            <li>Hours: Mon to Sat, 9:00 AM to 6:00 PM IST</li>
            <li>Response time: 24 to 48 hours</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

SupportContact.displayName = 'SupportContact';

export default SupportContact;
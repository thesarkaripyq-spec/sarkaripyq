import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const Contact = memo(() => {
  return (
    <div className='min-h-screen bg-white dark:bg-slate-950'>
      <SEOHead
        title='Contact SarkariPYQ - Support, Feedback & Inquiries'
        description='Contact SarkariPYQ for support, feedback, or partnerships. We reply within 24 hours. Email: thesarkaripyq@gmail.com'
        pageUrl="/contact"
        ogImage="/ssc-logo.webp"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          "name": "Contact SarkariPYQ",
          "description": "Contact SarkariPYQ support team for help with SSC previous year questions practice.",
          "mainEntity": {
            "@type": "Organization",
            "name": "SarkariPYQ",
            "url": "https://sarkaripyq.com",
            "contactPoint": {
              "@type": "ContactPoint",
              "email": "thesarkaripyq@gmail.com",
              "contactType": "customer support",
              "availableLanguage": ["English", "Hindi"]
            }
          }
        }}
      />
      <div className='max-w-2xl mx-auto px-6 py-16'>
        <h1 className='text-4xl font-bold text-slate-900 dark:text-white mb-8 text-center'>Contact Us</h1>
        
        <div className='bg-slate-50 dark:bg-slate-900 rounded-2xl p-8 mb-8'>
          <p className='text-lg text-slate-700 dark:text-slate-300 mb-6 text-center'>
            For any issue, feedback, or query, drop us a mail. We typically reply within <span className='font-semibold text-primary-600'>24 hours</span>.
          </p>
          
          <div className='space-y-4'>
            <div className='flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl'>
              <div className='w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-full flex items-center justify-center'>
                <svg className='w-5 h-5 text-primary-600 dark:text-primary-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' />
                </svg>
              </div>
              <div>
                <p className='text-sm text-slate-500 dark:text-slate-400'>Email</p>
                <p className='text-sm sm:text-lg font-semibold text-slate-900 dark:text-white break-all sm:break-normal'>thesarkaripyq@gmail.com</p>
              </div>
            </div>
            
            <div className='flex items-center gap-4 p-4 bg-white dark:bg-slate-800 rounded-xl'>
              <div className='w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center'>
                <svg className='w-5 h-5 text-slate-600 dark:text-slate-300' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z' />
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 11a3 3 0 11-6 0 3 3 0 016 0z' />
                </svg>
              </div>
              <div>
                <p className='text-sm text-slate-500 dark:text-slate-400'>Location</p>
                <p className='text-lg font-semibold text-slate-900 dark:text-white'>Dehradun, Uttarakhand</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className='space-y-4 text-slate-600 dark:text-slate-400'>
          <h2 className='text-xl font-semibold text-slate-900 dark:text-white mb-4'>Tips for Faster Response</h2>
          <ul className='space-y-3 list-disc pl-5'>
            <li>Include your registered email address</li>
            <li>Mention the exam name you're preparing for</li>
            <li>Describe the issue briefly</li>
            <li>For question errors, share question ID and screenshot if possible</li>
            <li>For technical issues, include your device type and browser version</li>
          </ul>
        </div>
      </div>
    </div>
  );
});

Contact.displayName = 'Contact';

export default Contact;
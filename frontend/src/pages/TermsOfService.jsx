import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const TermsOfService = memo(() => {
  return (
    <div className='bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'>
      <SEOHead
        title='Terms of Service - SarkariPYQ'
        description='SarkariPYQ Terms of Service - Please read carefully before using our SSC previous year questions practice platform.'
        pageUrl="/terms-and-conditions"
        ogImage="/ssc-logo.webp"
      />
      <div className='max-w-3xl mx-auto px-4 py-10'>
        <h1 className='text-3xl font-bold mb-6'>Terms of Service</h1>
        
        <div className='space-y-6 text-slate-600 dark:text-slate-400 text-justify'>
          
          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>1. Acceptance of Terms</h2>
            <p>By accessing and using SarkariPYQ, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this service.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>2. Description of Service</h2>
            <p>SarkariPYQ provides a free online platform for practicing SSC (Staff Selection Commission) Previous Year Questions. Our service includes access to MCQ questions, answers, explanations, and related educational content.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>3. User Responsibilities</h2>
            <p>As a user of SarkariPYQ, you agree to:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li>Use the platform only for lawful purposes and in a way that does not infringe on the rights of others</li>
              <li>Not copy, reproduce, distribute, or scrape content from the platform</li>
              <li>Not attempt to gain unauthorized access to any part of the website</li>
              <li>Not use automated bots or scripts to access the service</li>
              <li>Not modify, adapt, or hack the website or reverse engineer the source code</li>
              <li>Maintain the accuracy and confidentiality of your account information</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>4. Intellectual Property</h2>
            <p>All content on SarkariPYQ, including but not limited to questions, answers, explanations, text, graphics, logos, and software, is the property of SarkariPYQ or its content suppliers and is protected by copyright laws.</p>
            <p className='mt-2'>You may not use, copy, reproduce, modify, or distribute any content from this platform without prior written permission.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>5. Disclaimer of Warranties</h2>
            <p>SarkariPYQ is provided on an "AS IS" and "AS AVAILABLE" basis. We make no warranties, expressed or implied, and hereby disclaims all such warranties, including without limitation, implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</p>
            <p className='mt-2'>We do not guarantee that the content provided is accurate, complete, or up-to-date. Users are advised to verify information from official SSC sources.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>6. Limitation of Liability</h2>
            <p>In no event shall SarkariPYQ, its founders, developers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li>Your access to or use of (or inability to access or use) the service</li>
              <li>Any content obtained from the service</li>
              <li>Unauthorized access, use, or alteration of your transmissions or content</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>7. Accuracy of Content</h2>
            <p>While we strive to provide accurate questions and explanations, SarkariPYQ does not guarantee the accuracy, reliability, or completeness of any content. The questions and answers provided are for practice purposes only. Please refer to official SSC notifications and answer keys for official information.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>8. Account Termination</h2>
            <p>We reserve the right to terminate or suspend your account immediately, without prior notice or liability, for any reason, including without limitation if you breach the Terms of Service.</p>
            <p className='mt-2'>Upon termination, your right to use the service will cease immediately.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>9. Changes to Terms</h2>
            <p>We reserve the right to modify or replace these terms at any time. We will provide notice of significant changes by posting the updated terms on this page with a new "Last updated" date.</p>
            <p className='mt-2'>Your continued use of the service after any changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>10. Governing Law</h2>
            <p>These terms shall be governed by and construed in accordance with the laws of India, without regard to its conflict of law provisions. Any disputes shall be subject to the exclusive jurisdiction of the courts in India.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>11. Contact Us</h2>
            <p>If you have any questions about these Terms of Service, please contact us at:</p>
            <p className='mt-2'>
              <strong>Email:</strong> thesarkaripyq@gmail.com<br />
              <strong>Website:</strong> https://sarkaripyq.com
            </p>
          </section>

        </div>
      </div>
    </div>
  );
});

TermsOfService.displayName = 'TermsOfService';

export default TermsOfService;

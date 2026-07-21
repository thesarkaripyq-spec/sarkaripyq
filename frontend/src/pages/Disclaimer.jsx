import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import SEOHead from '../components/Common/SEOHead';

const Disclaimer = memo(() => {
  return (
    <div className='bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'>
      <SEOHead
        title='Disclaimer - SarkariPYQ'
        description='SarkariPYQ Disclaimer - Important information about our independent SSC previous year questions practice platform. SarkariPYQ is not affiliated with SSC.'
        pageUrl="/disclaimer"
        ogImage="/ssc-logo.webp"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          "name": "Disclaimer - SarkariPYQ",
          "description": "Important information about our independent SSC previous year questions practice platform."
        }}
      />
      <div className='max-w-3xl mx-auto px-4 py-10'>
        <h1 className='text-3xl font-bold mb-6'>Disclaimer</h1>

        <div className='space-y-6 text-slate-600 dark:text-slate-400 text-justify'>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>1. Independent Platform</h2>
            <p>SarkariPYQ is an <strong>independent</strong> online platform for SSC exam preparation. We are <strong>not affiliated</strong> with, endorsed by, or connected to the Staff Selection Commission (SSC), Government of India, or ssc.gov.in in any official capacity.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>2. Accuracy of Content</h2>
            <p>The previous year questions, answers, and explanations provided on SarkariPYQ are for <strong>practice and educational purposes only</strong>. While we strive for accuracy, we do not guarantee that all questions, answers, or explanations are error-free or match the official SSC answer keys.</p>
            <p className='mt-2'>Users are advised to verify critical information from official SSC notifications and answer keys published on the official SSC website (ssc.gov.in).</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>3. No Guarantee of Results</h2>
            <p>Practicing on SarkariPYQ does <strong>not guarantee</strong> selection, passing, or any specific score in SSC examinations. Exam success depends on various factors including consistent preparation, understanding of concepts, and actual exam performance.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>4. Third-Party Links</h2>
            <p>Our platform may contain links to third-party websites, books, or resources. These are provided for reference only. SarkariPYQ does not endorse or take responsibility for the content, accuracy, or availability of these external resources.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>5. Limitation of Liability</h2>
            <p>SarkariPYQ and its team shall not be held liable for any direct, indirect, incidental, or consequential damages arising from the use of this platform or reliance on its content. This includes but is not limited to loss of marks, exam failure, or any other outcomes.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>6. User Responsibility</h2>
            <p>Users are responsible for verifying the accuracy of questions and answers. If you find any errors, please <Link to="/contact" className="text-blue-600 hover:underline">contact us</Link> so we can review and correct them promptly.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>7. Changes</h2>
            <p>We reserve the right to update or modify this disclaimer at any time. Changes will be posted on this page with an updated date.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>8. Contact Us</h2>
            <p>If you have any questions about this disclaimer, please <Link to="/contact" className="text-blue-600 hover:underline">contact us</Link>.</p>
          </section>

        </div>
      </div>
    </div>
  );
});

Disclaimer.displayName = 'Disclaimer';

export default Disclaimer;

import React, { memo } from 'react';
import SEOHead from '../components/Common/SEOHead';

const PrivacyPolicy = memo(() => {
  return (
    <div className='bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100'>
      <SEOHead
        title='Privacy Policy - SarkariPYQ'
        description='SarkariPYQ Privacy Policy - Learn how we collect, use, and protect your personal information when you use our SSC PYQ practice platform.'
        pageUrl="/privacy-policy"
        ogImage="/ssc-logo.webp"
      />
      <div className='max-w-3xl mx-auto px-4 py-10'>
        <h1 className='text-3xl font-bold mb-6'>Privacy Policy</h1>
        
        <div className='space-y-6 text-slate-600 dark:text-slate-400 text-justify'>
          
          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>1. Introduction</h2>
            <p>At SarkariPYQ, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website and services. Please read this privacy policy carefully. By using SarkariPYQ, you consent to the practices described in this policy.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>2. Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li><strong>Account Information:</strong> Name, email address, and password when you register</li>
              <li><strong>Practice Data:</strong> Your answers, scores, accuracy, and performance statistics</li>
              <li><strong>Usage Data:</strong> Pages visited, time spent, browser type, and device information</li>
              <li><strong>Cookies:</strong> Small data files stored on your device to remember preferences</li>
              <li><strong>Google OAuth Data:</strong> If you sign in with Google, we receive your name, email, and profile picture</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>3. How We Use Your Information</h2>
            <p>We use the information we collect for the following purposes:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li>To provide and maintain our service</li>
              <li>To track your practice progress and generate performance reports</li>
              <li>To improve and personalize your experience</li>
              <li>To send important updates and notifications</li>
              <li>To detect and prevent technical issues and abuse</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>4. Data Storage and Security</h2>
            <p>Your data is stored securely on our servers located in India. We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
            <p className='mt-2'>However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your personal data, we cannot guarantee its absolute security.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>5. Cookies and Tracking Technologies</h2>
            <p>We use cookies and similar tracking technologies to track activity on SarkariPYQ and hold certain information. Cookies are files with small amount of data which may include an anonymous unique identifier.</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li><strong>Essential Cookies:</strong> Required for the service to function properly</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
              <li><strong>Analytics Cookies:</strong> Help us understand how visitors use our site</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>6. Third-Party Services</h2>
            <p>We may employ third-party companies and individuals to facilitate our service, provide service on our behalf, perform service-related services, or assist us in analyzing how our service is used. These third parties have access to your Personal Data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li><strong>Google Analytics:</strong> To analyze website traffic and usage</li>
              <li><strong>Google OAuth:</strong> For sign-in functionality</li>
              <li><strong>Google Fonts:</strong> For typography</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>7. Data Sharing and Disclosure</h2>
            <p>We do not sell, trade, or rent your personal information to third parties. We may share your information in the following situations:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li><strong>With Your Consent:</strong> When you have given us permission to share your data</li>
              <li><strong>For Legal Compliance:</strong> When required by law or to protect our rights</li>
              <li><strong>Service Providers:</strong> With trusted third parties who assist in operating our website</li>
            </ul>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>8. Your Data Rights</h2>
            <p>You have the following rights regarding your personal data:</p>
            <ul className='list-disc pl-6 mt-2 space-y-1'>
              <li><strong>Access:</strong> Request a copy of the data we hold about you</li>
              <li><strong>Correction:</strong> Request correction of inaccurate data</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Export:</strong> Request export of your data in a machine-readable format</li>
              <li><strong>Withdraw Consent:</strong> Withdraw consent for data processing where applicable</li>
            </ul>
            <p className='mt-2'>To exercise any of these rights, please contact us at contact@sarkaripyq.com.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>9. Data Retention</h2>
            <p>We will retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including to satisfy any legal, accounting, or reporting requirements.</p>
            <p className='mt-2'>To determine the appropriate retention period, we consider the amount, nature, and sensitivity of the personal data, the potential risk of harm from unauthorized use or disclosure, and the applicable legal requirements.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>10. Childrens Privacy</h2>
            <p>Our service is not intended for individuals under the age of 13. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and you are aware that your child has provided us with personal data, please contact us so that we can take necessary action to remove that information.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>11. Changes to This Privacy Policy</h2>
            <p>We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date at the top.</p>
            <p className='mt-2'>You are advised to review this Privacy Policy periodically for any changes. Changes to this Privacy Policy are effective when they are posted on this page.</p>
          </section>

          <section>
            <h2 className='text-xl font-semibold mb-3 text-slate-800 dark:text-slate-200'>12. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us:</p>
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

PrivacyPolicy.displayName = 'PrivacyPolicy';

export default PrivacyPolicy;

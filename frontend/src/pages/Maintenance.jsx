import React from 'react';
import SEOHead from '../components/Common/SEOHead';

const Maintenance = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gray-50">
      <SEOHead
        title="Under Maintenance"
        description="SarkariPYQ is temporarily under maintenance. We'll be back soon with improvements."
        noIndex
      />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-blue-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          Maintenance Mode
        </h1>

        <p className="text-lg text-gray-500 mb-6">
          SarkariPYQ
        </p>

        <p className="text-gray-600 mb-6">
          We are fixing some bugs and adding new features to give you a better experience.
        </p>

        <p className="text-sm text-gray-500 mb-8">
          The site will be back online in a few hours.
        </p>

        <div className="border-t border-gray-100 pt-6">
          <p className="text-sm font-medium text-gray-700 mb-2">Want updates?</p>

          <div className="flex gap-3">
            <a
              href="https://t.me/sarkaripyq"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Telegram
            </a>
            <a
              href="mailto:thesarkaripyq@gmail.com"
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
            >
              Email
            </a>
          </div>
        </div>

        <p className="mt-6 text-sm text-gray-400">
          Thank you for your patience 🙏
        </p>
      </div>
    </div>
  );
};

export default Maintenance;

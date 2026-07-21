import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiSearch } from 'react-icons/fi';
import SEOHead from '../components/Common/SEOHead';

const NotFound = memo(() => {
  return (
    <>
      <SEOHead 
        title="Page Not Found"
        description="The page you are looking for does not exist at SarkariPYQ. Browse SSC CGL, CHSL, GD, MTS, CPO previous year questions for free practice."
        noIndex
      />

      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="text-8xl font-bold text-primary-600 mb-4">404</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Page Not Found</h1>
          <p className="text-gray-600 mb-8 max-w-md">
            Sorry, the page you're looking for doesn't exist or has been moved.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link to="/" className="btn btn-primary">
              <FiHome /> Go Home
            </Link>
            <Link to="/ssc/ssc-cgl_previous_year_questions" className="btn btn-outline">
              <FiSearch /> Browse Exams
            </Link>
          </div>
        </div>
      </div>
    </>
  );
});

NotFound.displayName = 'NotFound';

export default NotFound;

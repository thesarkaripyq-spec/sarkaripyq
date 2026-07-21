import React, { memo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiHome, FiBookOpen, FiUser, FiAward } from 'react-icons/fi';

const MobileBottomNavigation = memo(() => {
  const location = useLocation();

  const navItems = [
    {
      name: 'Home',
      path: '/',
      icon: FiHome,
    },
    {
      name: 'Practice',
      path: '/ssc/ssc-cgl_previous_year_questions',
      icon: FiAward,
      // Active for any practice subroutes as well
      match: (path) => path.startsWith('/ssc/') || path === '/practice' || path.startsWith('/ssc-'),
    },
    {
      name: 'Books',
      path: '/best-books-for-ssc-exams',
      icon: FiBookOpen,
    },
    {
      name: 'Profile',
      path: '/profile',
      icon: FiUser,
    },
  ];

  const isActive = (item) => {
    if (item.match) {
      return item.match(location.pathname);
    }
    return location.pathname === item.path;
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className="fixed bottom-0 left-0 right-0 z-30 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 lg:hidden shadow-[0_-2px_8px_rgba(0,0,0,0.06)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="flex justify-around items-center h-14 px-1">
        {navItems.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;

          return (
            <li key={item.name} className="flex-1">
              <Link
                to={item.path}
                aria-current={active ? 'page' : undefined}
                aria-label={item.name}
                className={`flex flex-col items-center justify-center h-full py-1.5 min-h-[44px] transition-colors ${
                  active
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" aria-hidden="true" />
                <span className="text-[10px] sm:text-xs tracking-tight">{item.name}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
});

MobileBottomNavigation.displayName = 'MobileBottomNavigation';

export default MobileBottomNavigation;

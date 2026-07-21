import React, { useState, useEffect, useRef, memo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiX, FiUser, FiLogOut, FiChevronDown, FiMoon, FiSun, FiSearch, FiBook, FiGrid, FiUsers } from 'react-icons/fi';
import useAuthStore from '../../store/authStore';

const Header = memo(({ settings }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(false);
  const userMenuRef = useRef(null);
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  
  const registrationEnabled = settings?.enableRegistration !== false;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    // Prefer the class already set by the inline pre-paint script in index.html
    const fromDom = document.documentElement.classList.contains('dark');
    setIsDark(storedTheme ? storedTheme === 'dark' : (fromDom || prefersDark));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [location.pathname, isAuthenticated]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSearch = () => {
    navigate('/ssc/ssc-cgl-previous-year-questions');
  };

  const isActive = (path) => {
    if (path === '/ssc/ssc-cgl-previous-year-questions') {
      return location.pathname.startsWith('/ssc/') || location.pathname === '/practice' || location.pathname.startsWith('/ssc-');
    }
    return location.pathname === path;
  };

  const navLinks = [
    { name: 'Home', path: '/', icon: FiGrid },
    { name: 'SSC CGL PYQ', path: '/ssc/ssc-cgl-previous-year-questions', icon: null },
    { name: 'SSC CHSL PYQ', path: '/ssc/ssc-chsl-previous-year-questions', icon: null },
    { name: 'Books', path: '/best-books-for-ssc-exams', icon: FiBook },
    { name: 'Leaderboard', path: '/leaderboard', icon: FiUsers },
  ];

  const examQuickLinks = [
    { name: 'SSC CGL PYQ', path: '/ssc/ssc-cgl-previous-year-questions' },
    { name: 'SSC CHSL PYQ', path: '/ssc/ssc-chsl-previous-year-questions' },
    { name: 'SSC GD PYQ', path: '/ssc/ssc-gd-previous-year-questions' },
    { name: 'SSC MTS PYQ', path: '/ssc/ssc-mts-previous-year-questions' },
    { name: 'SSC CPO PYQ', path: '/ssc/ssc-cpo-previous-year-questions' },
    { name: 'SSC JE PYQ', path: '/ssc/ssc-je-previous-year-questions' },
    { name: 'SSC Selection Post PYQ', path: '/ssc/ssc-selection-post-previous-year-questions' },
    { name: 'SSC Stenographer PYQ', path: '/ssc/ssc-stenographer-previous-year-questions' },
  ];

  return (
    <>
      <header
        className={`sticky top-0 transition-all duration-300 ${
          mobileMenuOpen ? 'z-[100]' : 'z-50'
        } ${
          scrolled
            ? 'bg-white/95 dark:bg-slate-950/95 backdrop-blur-lg shadow-lg border-b border-slate-100 dark:border-slate-800'
            : 'bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800'
        }`}
      >
        <nav className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 lg:h-20">
            
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group">
              <span className="text-xl sm:text-2xl font-bold tracking-tight">
                <span className="text-slate-800 dark:text-white group-hover:text-blue-600 transition-colors">Sarkari</span>
                <span className="text-blue-600">PYQ</span>
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    isActive(link.path)
                      ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {link.icon && <link.icon className="w-4 h-4" aria-hidden="true" />}
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Right Section */}
            <div className="flex items-center gap-2 lg:gap-4">
              
              {/* Dark Mode Toggle */}
              <button
                onClick={() => setIsDark(!isDark)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Toggle theme"
              >
                {isDark ? <FiSun size={20} aria-hidden="true" /> : <FiMoon size={20} aria-hidden="true" />}
              </button>

              {/* Search Button */}
              <button
                onClick={handleSearch}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors lg:hidden"
                aria-label="Search"
              >
                <FiSearch size={20} aria-hidden="true" />
              </button>

              {/* Auth Section - Desktop */}
              <div className="hidden lg:flex items-center gap-3">
                {isAuthenticated ? (
                  <div className="relative" ref={userMenuRef}>
                    <button
                      onClick={() => setUserMenuOpen(!userMenuOpen)}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <div className="text-left">
                        <p className="text-sm font-semibold text-slate-800 dark:text-white">
                          {(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.name || 'User').split(' ')[0]}
                        </p>
                      </div>
                      <FiChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${userMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                    </button>

                    {userMenuOpen && (
                      <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 py-2 z-[70] animate-in fade-in slide-in-from-top-2">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                          <p className="font-semibold text-slate-800 dark:text-white">{user?.user_metadata?.full_name || user?.user_metadata?.name || user?.name || 'User'}</p>
                          <p className="text-sm text-slate-500 dark:text-slate-400">{user?.email}</p>
                        </div>
                        <div className="py-2">
                          <Link
                            to="/profile"
                            className="flex items-center gap-3 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <FiUser className="w-4 h-4" aria-hidden="true" />
                            <span>My Profile</span>
                          </Link>
                          <Link
                            to="/leaderboard"
                            className="flex items-center gap-3 px-4 py-2.5 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            onClick={() => setUserMenuOpen(false)}
                          >
                            <FiUsers className="w-4 h-4" aria-hidden="true" />
                            <span>Leaderboard</span>
                          </Link>
                        </div>
                        <div className="border-t border-slate-100 dark:border-slate-700 pt-2">
                          <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          >
                            <FiLogOut className="w-4 h-4" aria-hidden="true" />
                            <span>Logout</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <Link
                      to="/login"
                      className="px-5 py-2.5 text-slate-700 dark:text-slate-200 font-semibold hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      Login
                    </Link>
                    {registrationEnabled && (
                      <Link
                        to="/register"
                        className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 shadow-md hover:shadow-lg transition-all"
                      >
                        Sign Up Free
                      </Link>
                    )}
                  </>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <FiX size={22} aria-hidden="true" /> : <FiMenu size={22} aria-hidden="true" />}
              </button>
            </div>
          </div>
        </nav>
      </header>

      {/* Mobile Slide-in Menu (Rendered outside the header for perfect viewport alignment & z-index execution) */}
      {/* Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[90] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          onKeyDown={(e) => { if (e.key === 'Escape') setMobileMenuOpen(false); }}
          aria-hidden="true"
        />
      )}
      
      {/* Slide-in Panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        onKeyDown={(e) => { if (e.key === 'Escape') setMobileMenuOpen(false); }}
        className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] bg-white dark:bg-slate-900 z-[100] transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl ${
        mobileMenuOpen ? 'translate-x-0 visible' : 'translate-x-full invisible'
      }`}>
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <span className="font-bold text-lg text-slate-900 dark:text-white" id="mobile-menu-title">Menu</span>
          <button 
            onClick={() => setMobileMenuOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <FiX size={24} aria-hidden="true" />
          </button>
        </div>
        
        <div className="flex flex-col gap-1 p-4 overflow-y-auto h-[calc(100%-65px)]">
          {navLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-4 min-h-[44px] rounded-xl font-medium transition-all ${
                isActive(link.path)
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {link.icon && <link.icon className="w-5 h-5" aria-hidden="true" />}
              {!link.icon && <span className="w-5 h-5 flex items-center justify-center text-xs font-bold text-blue-600">Q</span>}
              {link.name}
            </Link>
          ))}

          {/* Exam Quick Links in Mobile Menu */}
          <div className="mt-2 mb-1 px-4">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">All SSC Exams</p>
          </div>
          {examQuickLinks.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 min-h-[40px] rounded-xl text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              {link.name}
            </Link>
          ))}
          
          <hr className="my-3 border-slate-200 dark:border-slate-700" />
          
          {isAuthenticated ? (
            <>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 min-h-[44px] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
              >
                <FiUser className="w-5 h-5" aria-hidden="true" />
                My Profile
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 min-h-[44px] text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-medium"
              >
                <FiLogOut className="w-5 h-5" aria-hidden="true" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 min-h-[44px] px-4 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl font-medium"
              >
                Login
              </Link>
              {registrationEnabled && (
                <Link
                  to="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="mx-0 mt-2 min-h-[44px] flex items-center justify-center bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-center font-semibold shadow-md"
                >
                  Sign Up Free
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
});

Header.displayName = 'Header';

export default Header;

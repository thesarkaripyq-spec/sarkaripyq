import React, { memo } from 'react';
import { Link } from 'react-router-dom';
import { FiFacebook, FiTwitter, FiInstagram } from 'react-icons/fi';
import { FaTelegram, FaYoutube, FaHeart } from 'react-icons/fa';

const Footer = memo(({ settings }) => {
  const currentYear = new Date().getFullYear();
  const socialLinks = settings?.socialLinks || {};
  const normalizeUrl = (url) => {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return `https://${trimmed}`;
  };

  const facebookUrl = normalizeUrl(socialLinks.facebook);
  const twitterUrl = normalizeUrl(socialLinks.twitter);
  const instagramUrl = normalizeUrl(socialLinks.instagram);
  const telegramUrl = normalizeUrl(socialLinks.telegram);
  const youtubeUrl = normalizeUrl(socialLinks.youtube);

  const quickLinks = [
    { name: 'SSC CGL PYQ', path: '/ssc/ssc-cgl-previous-year-questions' },
    { name: 'SSC CHSL PYQ', path: '/ssc/ssc-chsl-previous-year-questions' },
    { name: 'SSC GD PYQ', path: '/ssc/ssc-gd-previous-year-questions' },
    { name: 'SSC MTS PYQ', path: '/ssc/ssc-mts-previous-year-questions' },
    { name: 'SSC CPO PYQ', path: '/ssc/ssc-cpo-previous-year-questions' },
    { name: 'SSC JE PYQ', path: '/ssc/ssc-je-previous-year-questions' },
  ];

  const resourceLinks = [
    { name: 'SSC Stenographer PYQ', path: '/ssc/ssc-stenographer-previous-year-questions' },
    { name: 'SSC Selection Post PYQ', path: '/ssc/ssc-selection-post-previous-year-questions' },
    { name: 'Leaderboard', path: '/leaderboard' },
    { name: 'Recommended Books', path: '/best-books-for-ssc-exams' },
    { name: 'Frequently Asked Questions', path: '/faq' },
  ];

  const supportLinks = [
    { name: 'About Us', path: '/about' },
    { name: 'Contact Us', path: '/contact' },
    { name: 'Privacy Policy', path: '/privacy-policy' },
    { name: 'Terms of Service', path: '/terms-and-conditions' },
    { name: 'Disclaimer', path: '/disclaimer' },
  ];

  return (
    <footer className="bg-black text-gray-300 relative overflow-hidden pb-20 lg:pb-0">
      <div className="relative max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 pt-6 sm:pt-8 pb-4 sm:pb-8">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Brand Section */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="flex items-center mb-3 group">
              <span className="text-xl sm:text-2xl font-bold text-white">
                <span className="group-hover:text-blue-400 transition-colors">Sarkari</span>
                <span className="text-blue-400">PYQ</span>
              </span>
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed mb-3 text-justify">
              SarkariPYQ is an independent platform for SSC exam preparation. We are not affiliated with, endorsed by, or connected to the Staff Selection Commission (SSC) or ssc.gov.in in any way.
            </p>

            {/* Social Media */}
            <div className="flex flex-wrap gap-2">
              {facebookUrl && (
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="min-h-[44px] min-w-[44px] rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-blue-400 transition-colors duration-200 hover:bg-gray-800"
                >
                  <FiFacebook size={16} aria-hidden="true" />
                </a>
              )}
              {twitterUrl && (
                <a
                  href={twitterUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Twitter"
                  className="min-h-[44px] min-w-[44px] rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-sky-400 transition-colors duration-200 hover:bg-gray-800"
                >
                  <FiTwitter size={16} aria-hidden="true" />
                </a>
              )}
              {instagramUrl && (
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="min-h-[44px] min-w-[44px] rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-pink-400 transition-colors duration-200 hover:bg-gray-800"
                >
                  <FiInstagram size={16} aria-hidden="true" />
                </a>
              )}
              {telegramUrl && (
                <a
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Telegram"
                  className="min-h-[44px] min-w-[44px] rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-cyan-400 transition-colors duration-200 hover:bg-gray-800"
                >
                  <FaTelegram size={16} aria-hidden="true" />
                </a>
              )}
              {youtubeUrl && (
                <a
                  href={youtubeUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="YouTube"
                  className="min-h-[44px] min-w-[44px] rounded-full border border-gray-700 bg-gray-900 flex items-center justify-center text-red-400 transition-colors duration-200 hover:bg-gray-800"
                >
                  <FaYoutube size={16} aria-hidden="true" />
                </a>
              )}
            </div>
          </div>

          {/* Popular Exams */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-base">Popular Exams</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-primary-400 transition-colors duration-200 text-sm flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-base">Resources</h4>
            <ul className="space-y-2">
              {resourceLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-primary-400 transition-colors duration-200 text-sm flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="text-white font-semibold mb-3 text-base">Contact</h4>
            <ul className="space-y-2">
              {supportLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-gray-400 hover:text-primary-400 transition-colors duration-200 text-sm flex items-center group"
                  >
                    <span className="w-1.5 h-1.5 bg-primary-500 rounded-full mr-2 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true"></span>
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="mt-4 pt-4 border-t border-gray-800">
          <div className="bg-black rounded-lg p-3 text-center">
            <div className="space-y-1">
              <div className="text-sm text-gray-400">
                <span>© {currentYear} SarkariPYQ. All rights reserved.</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gray-400">
                <span>Made with</span>
                <FaHeart className="text-red-500 text-xs" aria-hidden="true" />
                <span>for SSC Aspirants</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
});

Footer.displayName = 'Footer';

export default Footer;

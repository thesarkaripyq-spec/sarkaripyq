import React, { useEffect, useState, memo } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import MobileBottomNavigation from './MobileBottomNavigation';
import { settingsAPI } from '../../services/api';

const Layout = memo(() => {
  const location = useLocation();
  const [settingsData, setSettingsData] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    settingsAPI.getPublic()
      .then((response) => {
        if (!controller.signal.aborted) {
          setSettingsData(response.data || {});
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const gaId = settingsData?.googleAnalyticsId;
    if (!gaId) return;

    if (!document.querySelector(`script[data-ga-id="${gaId}"]`)) {
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
      script.setAttribute('data-ga-id', gaId);
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function(){window.dataLayer.push(arguments);};
      window.gtag('js', new Date());
      window.gtag('config', gaId);
    }
  }, [settingsData]);

  useEffect(() => {
    const gaId = settingsData?.googleAnalyticsId;
    if (!gaId || !window.gtag) return;
    window.gtag('event', 'page_view', {
      page_path: location.pathname + location.search,
      page_title: document.title
    });
  }, [location.pathname, location.search, settingsData]);

  return (
    <div className="min-h-screen flex flex-col pb-16 lg:pb-0 overflow-x-hidden">
      <a
        href="#main-content"
        className="skip-link"
      >
        Skip to main content
      </a>
      <Header settings={settingsData} />
      <main id="main-content" className="flex-grow" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer settings={settingsData} />
      <MobileBottomNavigation />
    </div>
  );
});

Layout.displayName = 'Layout';

export default Layout;


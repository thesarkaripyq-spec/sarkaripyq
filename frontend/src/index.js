import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { supabase } from './supabase';
import useAuthStore from './store/authStore';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Listen for auth state changes (session expiry, logout from other tabs, etc.)
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'SIGNED_OUT') {
    useAuthStore.setState({ user: null, isAuthenticated: false });
  } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (session?.user) {
      const currentUser = useAuthStore.getState().user;
      let role = currentUser?.role;
      if (!role) {
        const { data: dbUser } = await supabase
          .from('users')
          .select('role')
          .eq('email', session.user.email)
          .maybeSingle();
        role = dbUser?.role || 'user';
      }
      const mergedUser = { ...session.user, role };
      useAuthStore.setState({ user: mergedUser, isAuthenticated: true });
    }
  }
});

const router = createBrowserRouter([{ path: '*', element: <App /> }], { future: { v7_relativeSplatPath: true, v7_startTransition: true } });

const toastOptions = {
  duration: 3000,
  style: { background: '#333', color: '#fff' },
  success: { iconTheme: { primary: '#22c55e', secondary: '#fff' } },
  error: { iconTheme: { primary: '#ef4444', secondary: '#fff' } }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID || 'placeholder'}>
      <HelmetProvider>
        <RouterProvider router={router} />
        <Toaster position="top-right" toastOptions={toastOptions} />
      </HelmetProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>
);

// Register PWA service worker for low-latency offline caching
if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then((reg) => {
        // SW registered successfully
      })
      .catch(() => {/* swallow in prod */});
  });
}


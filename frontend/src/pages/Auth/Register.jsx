import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import SEOHead from '../../components/Common/SEOHead';
import useAuthStore from '../../store/authStore';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');

  const { register, googleLogin, isLoading, clearError } = useAuthStore();
  const navigate = useNavigate();

  const loadCaptcha = async () => {
    try {
      const data = await authAPI.getCaptcha();
      setCaptchaQuestion(data.question);
      setCaptchaToken(data.token);
      setCaptchaAnswer('');
    } catch (err) {
      toast.error('Failed to load CAPTCHA. Please refresh.');
    }
  };

  useEffect(() => {
    loadCaptcha();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    if (!name.trim()) {
      toast.error('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    if (!password || password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!captchaAnswer) {
      toast.error('Please answer the security question');
      return;
    }

    try {
      const result = await register(name, email, password, captchaAnswer, captchaToken);
      if (result.success) {
        toast.success('Account created!');
        navigate('/');
      } else {
        toast.error(result.error || result.message || 'Registration failed');
        loadCaptcha();
      }
    } catch (err) {
      toast.error('An unexpected error occurred. Please try again.');
      loadCaptcha();
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    clearError();
    const result = await googleLogin(credentialResponse.credential);
    if (result.success) {
      toast.success('Account created!');
      navigate('/');
    } else {
      toast.error(result.error || result.message || 'Signup failed');
    }
  };

  const handleGoogleError = () => {
    toast.error('Google signup failed');
  };

  return (
    <>
    <SEOHead title="Register" description="Create your account" noIndex ogImage="/ssc-logo.webp" />
      
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
                Register
              </h1>
              <p className="text-center text-gray-500 text-sm mb-5">
                Practice anytime • Track scores • Compete with others
              </p>

              <div className="mb-5">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  theme="filled_blue"
                  size="large"
                  width="100%"
                  logo_alignment="left"
                  text="signup_with"
                />
              </div>

              <div className="flex items-center gap-4 mb-5">
                <div className="flex-1 h-px bg-gray-200"></div>
                <span className="text-sm text-gray-400">or</span>
                <div className="flex-1 h-px bg-gray-200"></div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3" noValidate>
                <div>
                  <label htmlFor="reg-name" className="sr-only">Full name</label>
                  <input
                    id="reg-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    autoComplete="name"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="Full name"
                  />
                </div>
                
                <div>
                  <label htmlFor="reg-email" className="sr-only">Email address</label>
                  <input
                    id="reg-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                    placeholder="Email address"
                  />
                </div>
                
                <div className="relative">
                  <label htmlFor="reg-password" className="sr-only">Password</label>
                  <input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition pr-12"
                    placeholder="Password (min 6 characters)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 p-1"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>

                <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
                  <span className="text-gray-600 font-medium select-none" id="captcha-question">{captchaQuestion}</span>
                  <label htmlFor="reg-captcha" className="sr-only">Answer</label>
                  <input
                    id="reg-captcha"
                    type="number"
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    required
                    aria-labelledby="captcha-question"
                    className="w-20 px-2 py-1 bg-white border border-gray-200 rounded-lg text-center font-bold focus:outline-none focus:border-blue-500"
                    placeholder="?"
                  />
                  <button
                    type="button"
                    onClick={loadCaptcha}
                    className="text-xs text-blue-600 hover:text-blue-700 ml-auto font-medium"
                    title="Refresh CAPTCHA"
                  >
                    Refresh
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  {isLoading ? 'Signing up...' : 'Continue'}
                </button>
            </form>
          </div>
        </div>
      </main>
    </div>
    </>
  );
};

export default Register;
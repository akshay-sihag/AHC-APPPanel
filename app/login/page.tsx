'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn, useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';

function LoginPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secretToken, setSecretToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSecretTokenStep, setShowSecretTokenStep] = useState(false);
  const [storedPassword, setStoredPassword] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [tokenError, setTokenError] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();
  
  // Get callback URL from query params
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';

  // Redirect to dashboard if user is already logged in
  useEffect(() => {
    if (status === 'authenticated' && session) {
      router.push(callbackUrl);
      router.refresh();
    }
  }, [status, session, router, callbackUrl]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Check if user requires secret token
      const checkResponse = await fetch('/api/auth/check-secret-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const checkData = await checkResponse.json();
      const requiresSecretToken = checkData.requiresSecretToken;

      if (requiresSecretToken) {
        // Store password temporarily and show secret token step
        setStoredPassword(password);
        setShowSecretTokenStep(true);
        setIsLoading(false);
        return;
      }

      // No secret key required, sign in directly
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
        callbackUrl: callbackUrl,
      });

      if (result?.error) {
        // Trigger shake animation for password error
        setPasswordError(true);
        setTimeout(() => setPasswordError(false), 600);
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        // Small delay to ensure session is created
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh(); // Refresh to get latest session
        }, 100);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleSecretTokenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      // Sign in with credentials including secret token
      const result = await signIn('credentials', {
        email,
        password: storedPassword || password,
        secretToken,
        redirect: false,
        callbackUrl: callbackUrl,
      });

      if (result?.error) {
        // Trigger shake animation for token error
        setTokenError(true);
        setTimeout(() => setTokenError(false), 600);
        setIsLoading(false);
        return;
      }

      if (result?.ok) {
        // Small delay to ensure session is created
        setTimeout(() => {
          router.push(callbackUrl);
          router.refresh(); // Refresh to get latest session
        }, 100);
      }
    } catch (error) {
      console.error('Secret token verification error:', error);
      alert('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setShowSecretTokenStep(false);
    setSecretToken('');
    setStoredPassword('');
  };

  // Show loading state while checking session
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Loading...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if user is authenticated (will redirect)
  if (status === 'authenticated') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Weight Loss Image */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#dfedfb] items-center justify-center overflow-hidden rounded-tr-3xl rounded-br-3xl">
        <div className="w-full h-full relative">
          {/* Weight Loss Image - Add your image to public folder as weightloss.jpg */}
          <Image
            src="/images/ablogin.jpg"
            alt="Weight Loss"
            fill
            className="object-cover rounded-tr-3xl rounded-br-3xl"
            priority
            unoptimized
          />
          {/* Dark Overlay - Stronger at bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/20 to-black/70 rounded-tr-3xl rounded-br-3xl"></div>
          {/* Copyright Text */}
          <div className="absolute bottom-6 left-0 right-0 text-center px-2">
            <p className="text-white text-sm">© 2026 Alternate Health Club. All Rights Reserved.</p>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center bg-white p-8 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-[#435970]">
              {showSecretTokenStep ? 'Enter Secret Token' : 'Welcome Back'}
            </h1>
            <p className="text-[#7895b3] text-lg">
              {showSecretTokenStep ? 'Please enter your secret token to continue' : 'Sign in to your account to continue'}
            </p>
          </div>

          {/* Secret Token Form */}
          {showSecretTokenStep ? (
            <form onSubmit={handleSecretTokenSubmit} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="secretToken" className="block text-sm font-medium text-[#435970]">
                  Secret Token
                </label>
                <input
                  id="secretToken"
                  type="text"
                  value={secretToken}
                  onChange={(e) => {
                    setSecretToken(e.target.value);
                    setTokenError(false);
                  }}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all text-[#435970] placeholder:text-[#7895b3] bg-white text-center text-lg tracking-widest font-mono ${
                    tokenError 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 animate-shake' 
                      : 'border-[#dfedfb] focus:ring-[#7895b3] focus:border-transparent'
                  }`}
                  placeholder="Enter secret token"
                  autoFocus
                />
                {tokenError ? (
                  <p className="text-sm text-red-600 mt-1 text-center flex items-center justify-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Invalid secret token
                  </p>
                ) : (
                  <p className="text-xs text-[#7895b3] text-center">Enter your secret token to complete login</p>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex-1 border border-[#dfedfb] text-[#435970] py-3 rounded-lg font-semibold hover:bg-[#dfedfb] transition-all duration-300"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 bg-[#435970] text-white py-3 rounded-lg font-semibold hover:bg-[#7895b3] transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Sign In'
                  )}
                </button>
              </div>
            </form>
          ) : (
            /* Credentials Form */
            <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-[#435970]">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-[#dfedfb] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7895b3] focus:border-transparent transition-all text-[#435970] placeholder:text-[#7895b3] bg-white"
                placeholder="you@example.com"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-[#435970]">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setPasswordError(false);
                  }}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition-all text-[#435970] placeholder:text-[#7895b3] pr-12 bg-white ${
                    passwordError 
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500 animate-shake' 
                      : 'border-[#dfedfb] focus:ring-[#7895b3] focus:border-transparent'
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#7895b3] hover:text-[#435970] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.29 3.29m3.29 3.29L3 3m0 0l18 18m0 0l-3.29-3.29m-3.29-3.29l3.29 3.29M12 12l-3.29-3.29m3.29 3.29l3.29 3.29" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.522 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.478 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {passwordError && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Invalid email or password
                </p>
              )}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-[#7895b3] border-[#dfedfb] rounded focus:ring-[#7895b3] focus:ring-2"
                />
                <span className="text-sm text-[#435970]">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-[#7895b3] hover:text-[#435970] transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#435970] text-white py-3 rounded-lg font-semibold hover:bg-[#7895b3] transition-all duration-300 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
          )}

          {/* Terms & Conditions and Privacy Policy Links */}
          {!showSecretTokenStep && (
            <p className="text-center text-xs text-[#7895b3] mt-4">
              By signing in, you agree to our{' '}
              <Link href="/terms-conditions" className="text-[#435970] hover:text-[#7895b3] transition-colors font-medium">
                Terms & Conditions
              </Link>
              {' '}and{' '}
              <Link href="/privacy-policy" className="text-[#435970] hover:text-[#7895b3] transition-colors font-medium">
                Privacy Policy
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#435970] mx-auto"></div>
          <p className="mt-4 text-[#7895b3]">Loading...</p>
        </div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}

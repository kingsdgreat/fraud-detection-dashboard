'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#0d0e17]">
        <div className="animate-spin h-6 w-6 border-2 border-indigo-500 border-t-transparent rounded-full" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      <path d="M9.2 12l2 2 3.6-3.8" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function SignInForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/prod';

  const [googleLoading, setGoogleLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'CredentialsSignin'
      ? 'Invalid email or password'
      : searchParams.get('error') === 'AccessDenied'
        ? 'Access denied. Your email domain is not authorized.'
        : searchParams.get('error')
          ? 'An error occurred. Please try again.'
          : null
  );

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    await signIn('google', { callbackUrl });
  }

  async function handleSsoSignIn() {
    setSsoLoading(true);
    setError(null);
    // SSO provider - falls back to Google for now
    await signIn('google', { callbackUrl });
  }

  return (
    <div className="min-h-screen flex bg-[#0d0e17]">
      {/* Left panel - branding */}
      <div
        className="hidden lg:flex flex-1 min-w-0 flex-col justify-between relative overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #0d0e17 0%, #141528 60%, var(--brand-d, #4338ca) 160%)',
          padding: '56px 60px',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="w-[34px] h-[34px] rounded-[9px] flex items-center justify-center"
            style={{
              background: 'var(--brand, #4f46e5)',
              boxShadow: '0 4px 14px -2px var(--brand, #4f46e5)',
            }}
          >
            <ShieldIcon className="text-white" />
          </div>
          <span className="text-white text-lg font-semibold tracking-tight">Relecom</span>
        </div>

        {/* Tagline */}
        <div className="relative z-10 max-w-[440px]">
          <p className="text-white text-[32px] leading-[1.25] font-semibold tracking-tight mb-4" style={{ textWrap: 'balance' } as React.CSSProperties}>
            Self-learning fraud detection for telecom service orders.
          </p>
          <p className="text-[#9aa0b5] text-[14.5px] leading-[1.65]">
            Five ML layers score every incoming order, surface disconnect-reconnect fraud, and learn from every resolved case.
          </p>
        </div>

        {/* Stats */}
        <div className="relative z-10 flex gap-10">
          <div>
            <p className="text-white text-[22px] font-semibold font-mono">99.98%</p>
            <p className="text-[#777d93] text-xs mt-1">Uptime</p>
          </div>
          <div>
            <p className="text-white text-[22px] font-semibold font-mono">1.2M</p>
            <p className="text-[#777d93] text-xs mt-1">Orders scored</p>
          </div>
          <div>
            <p className="text-white text-[22px] font-semibold font-mono">91.7%</p>
            <p className="text-[#777d93] text-xs mt-1">F1 score</p>
          </div>
        </div>

        {/* Decorative radial gradient */}
        <div
          className="absolute -right-[120px] top-1/2 w-[420px] h-[420px] rounded-full -translate-y-1/2"
          style={{
            background: 'radial-gradient(circle, var(--brand, #4f46e5) 0%, transparent 70%)',
            opacity: 0.18,
          }}
        />
      </div>

      {/* Right panel - sign-in form */}
      <div className="w-full lg:w-[480px] lg:flex-none bg-[#fbfbfd] flex items-center justify-center p-12">
        <div className="w-full max-w-[340px]">
          <h1 className="text-[22px] font-semibold text-[#11131a] tracking-tight mb-1.5">
            Sign in to Relecom
          </h1>
          <p className="text-[13.5px] text-[#6b7180] mb-[30px] leading-relaxed">
            Use your organization account to continue to the fraud review workspace.
          </p>

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 mb-5">
              <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Google OAuth button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
            className="flex items-center justify-center gap-[11px] w-full py-[13px] px-4 border border-[#e1e3ea] rounded-[11px] bg-white cursor-pointer text-sm font-medium text-[#2b2f3a] transition-all duration-100 hover:border-[#cfd2db] hover:shadow-md disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 1px 2px rgba(16,18,30,0.04)' }}
          >
            {googleLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#2b2f3a]" />
                Redirecting to Google...
              </>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-[22px]">
            <div className="flex-1 h-px bg-[#ebedf2]" />
            <span className="text-[11.5px] text-[#9aa0ad]">or</span>
            <div className="flex-1 h-px bg-[#ebedf2]" />
          </div>

          {/* SSO button */}
          <button
            onClick={handleSsoSignIn}
            disabled={ssoLoading}
            className="flex items-center justify-center gap-[9px] w-full py-[13px] px-4 rounded-[11px] cursor-pointer text-sm font-semibold text-white transition-all duration-100 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: 'var(--brand, #4f46e5)',
              boxShadow: '0 4px 14px -4px var(--brand, #4f46e5)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--brand-d, #4338ca)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--brand, #4f46e5)')}
          >
            {ssoLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Redirecting to SSO...
              </>
            ) : (
              <>
                <LockIcon />
                Continue with SSO
              </>
            )}
          </button>

          {/* Footer */}
          <div className="mt-[34px] flex items-center gap-2 justify-center">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9aa0ad" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
            </svg>
            <span className="text-[11.5px] text-[#9aa0ad]">
              SOC 2 Type II &middot; SSO-only &middot; audit logged
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

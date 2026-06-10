'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Shield, AlertCircle } from 'lucide-react';
import Link from 'next/link';

const errorMessages: Record<string, string> = {
  Configuration: 'There is a problem with the server configuration. Check the server logs for more details.',
  AccessDenied: 'Access denied. Your email domain is not authorized to use this application.',
  Verification: 'The verification link has expired or has already been used.',
  OAuthSignin: 'Error constructing the OAuth authorization URL.',
  OAuthCallback: 'Error handling the response from the OAuth provider.',
  OAuthCreateAccount: 'Could not create OAuth provider user in the database.',
  EmailCreateAccount: 'Could not create email provider user in the database.',
  Callback: 'Error in the OAuth callback handler.',
  OAuthAccountNotLinked: 'This email is already associated with another sign-in method.',
  Default: 'An unexpected authentication error occurred.',
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get('error') || 'Default';
  const message = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-sm text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-600/20 mb-4">
          <Shield className="h-8 w-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Authentication Error</h1>

        <div className="flex items-start gap-2 bg-red-900/30 border border-red-800 rounded-lg p-4 mb-6 text-left">
          <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-300 mb-1">{error}</p>
            <p className="text-sm text-red-300/80">{message}</p>
          </div>
        </div>

        <Link
          href="/auth/signin"
          className="inline-block w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors"
        >
          Back to Sign In
        </Link>

        <p className="text-xs text-slate-600 text-center mt-6">FraudShield v1.0</p>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-950">
          <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}

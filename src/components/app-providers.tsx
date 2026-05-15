'use client';

import React from 'react';
import { DataProvider } from '@/lib/data-context';
import { ProductionDataProvider } from '@/lib/production-data-context';
import { SessionProvider } from 'next-auth/react';

/**
 * Root provider component that switches between demo and production modes.
 *
 * Demo mode: Uses client-side synthetic data generation (DataProvider)
 * Production mode: Uses API-backed data with auth (SessionProvider + ProductionDataProvider)
 */
export function AppProviders({ children }: { children: React.ReactNode }) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  if (isDemo) {
    // Demo mode: synthetic data, no auth needed
    return <DataProvider>{children}</DataProvider>;
  }

  // Production mode: real database + auth
  return (
    <SessionProvider>
      <ProductionDataProvider>
        {children}
      </ProductionDataProvider>
    </SessionProvider>
  );
}

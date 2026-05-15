import type { Metadata } from 'next';
import './globals.css';
import { AppProviders } from '@/components/app-providers';
import { LayoutShell } from '@/components/layout-shell';

export const metadata: Metadata = {
  title: 'Fraud Review Dashboard',
  description: 'Disconnect-Reconnect Fraud Detection System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AppProviders>
          <LayoutShell>{children}</LayoutShell>
        </AppProviders>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { AppProviders } from '@/components/app-providers';

export const metadata: Metadata = {
  title: 'Fraud Review Dashboard',
  description: 'Disconnect-Reconnect Fraud Detection System',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <AppProviders>
          <Sidebar />
          <main className="flex-1 overflow-auto bg-gray-50">
            <div className="max-w-7xl mx-auto px-6 py-6">
              {children}
            </div>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}

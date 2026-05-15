'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';

/**
 * Conditionally renders the demo sidebar + main wrapper.
 * - /auth/* pages: no sidebar, full-screen layout
 * - /prod/* pages: no demo sidebar (prod has its own layout)
 * - Everything else (demo pages): show demo sidebar
 */
export function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Auth pages: full-screen, no sidebar
  if (pathname.startsWith('/auth')) {
    return <div className="flex-1">{children}</div>;
  }

  // Prod pages: they have their own layout with sidebar
  if (pathname.startsWith('/prod')) {
    return <div className="flex-1">{children}</div>;
  }

  // Demo pages: show sidebar + main content area
  return (
    <>
      <Sidebar />
      <main className="flex-1 overflow-auto bg-gray-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </>
  );
}

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

  // Auth pages and prod pages get a clean layout (no demo sidebar)
  if (pathname.startsWith('/auth') || pathname.startsWith('/prod')) {
    return <>{children}</>;
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

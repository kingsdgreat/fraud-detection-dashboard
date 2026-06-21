'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Sidebar } from '@/components/sidebar';
export const dynamic = 'force-dynamic';

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const sessionResult = useSession() || {};
  const session = (sessionResult as any).data;
  const [slaOverdue, setSlaOverdue] = useState(0);

  // Fetch SLA overdue count for badge
  useEffect(() => {
    fetch('/api/v1/dashboard')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSlaOverdue(data.slaOverdue || 0); })
      .catch(() => {});
  }, [pathname]);

  const user = session?.user;
  const role = (user as any)?.role || 'analyst';

  return (
    <div className="flex min-h-screen">
      <Sidebar
        mode="prod"
        pendingCount={slaOverdue}
        user={user ? { name: user.name, email: user.email } : undefined}
        role={role}
        onSignOut={() => signOut({ callbackUrl: '/auth/signin' })}
      />

      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

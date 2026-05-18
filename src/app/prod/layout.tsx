'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { cn } from '@/lib/utils';
export const dynamic = 'force-dynamic';
import {
  LayoutDashboard, ListChecks, Upload, Settings, Shield,
  LogOut, User, AlertCircle, ChevronDown, SearchCheck,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/prod', icon: LayoutDashboard },
  { name: 'Case Queue', href: '/prod/queue', icon: ListChecks, badge: true },
  { name: 'Test Order', href: '/prod/test', icon: SearchCheck },
  { name: 'Data Ingestion', href: '/prod/ingest', icon: Upload },
  { name: 'Settings', href: '/prod/settings', icon: Settings },
];

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
      {/* Sidebar */}
      <div className="flex flex-col w-64 bg-slate-950 text-white min-h-screen">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-800">
          <div className="p-1.5 bg-blue-600 rounded-lg">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-sm">Fraud Detection</p>
            <p className="text-xs text-slate-400">Spectrum Systems</p>
          </div>
        </div>

        {/* Production badge */}
        <div className="mx-3 mt-3 px-3 py-1.5 bg-emerald-900/30 border border-emerald-800/50 rounded-lg">
          <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Production</p>
          <p className="text-[10px] text-emerald-500/70 mt-0.5">Live database connected</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navigation.map(item => {
            const isActive = pathname === item.href
              || (item.href !== '/prod' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
                {item.badge && slaOverdue > 0 && (
                  <span className="ml-auto flex items-center gap-1 px-1.5 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded-full">
                    <AlertCircle className="h-2.5 w-2.5" />
                    {slaOverdue}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-slate-800">
          {user ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center flex-shrink-0">
                  <User className="h-4 w-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 font-medium truncate">{user.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide',
                  role === 'admin' ? 'bg-purple-900/50 text-purple-300' :
                  role === 'manager' ? 'bg-blue-900/50 text-blue-300' :
                  'bg-slate-800 text-slate-400'
                )}>
                  {role}
                </span>
                <button
                  onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  <LogOut className="h-3 w-3" />
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Not signed in</p>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {children}
        </div>
      </main>
    </div>
  );
}

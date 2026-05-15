'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ListChecks, FlaskConical, Settings, Shield, SearchCheck,
  Upload, LogOut, User,
} from 'lucide-react';

const demoNavigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Review Queue', href: '/queue', icon: ListChecks },
  { name: 'Test an Order', href: '/test', icon: SearchCheck },
  { name: 'Validation', href: '/validation', icon: FlaskConical },
  { name: 'Settings', href: '/settings', icon: Settings },
];

const productionNavigation = [
  { name: 'Overview', href: '/', icon: LayoutDashboard },
  { name: 'Review Queue', href: '/queue', icon: ListChecks },
  { name: 'Data Ingestion', href: '/ingest', icon: Upload },
  { name: 'Test an Order', href: '/test', icon: SearchCheck },
  { name: 'Validation', href: '/validation', icon: FlaskConical },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';
  const navigation = isDemo ? demoNavigation : productionNavigation;

  return (
    <div className="flex flex-col w-64 bg-gray-950 text-white min-h-screen">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <div className="p-1.5 bg-blue-600 rounded-lg">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="font-bold text-sm">Fraud Review</p>
          <p className="text-xs text-gray-400">Disconnect-Reconnect</p>
        </div>
      </div>

      {/* Mode badge */}
      {isDemo && (
        <div className="mx-3 mt-3 px-3 py-1.5 bg-amber-900/30 border border-amber-800/50 rounded-lg">
          <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">Demo Mode</p>
          <p className="text-[10px] text-amber-500/70 mt-0.5">Synthetic data · No database</p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map(item => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        {isDemo ? (
          <>
            <p className="text-xs text-gray-500">Synthetic Data · v1.0 MVP</p>
            <p className="text-xs text-gray-600 mt-0.5">1,500 orders · DEMO_SEED</p>
          </>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center">
                <User className="h-3 w-3 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-300 font-medium truncate">Production</p>
                <p className="text-[10px] text-gray-500 truncate">v1.0</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, ListChecks, SearchCheck, Upload, ShieldCheck,
  Settings, LogOut,
} from 'lucide-react';

/* ── Navigation structure ── */

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
}

interface NavSection {
  label?: string;          // omit for the first unlabelled group
  items: NavItem[];
}

const demoSections: NavSection[] = [
  {
    items: [
      { name: 'Overview', href: '/', icon: LayoutDashboard },
      { name: 'Review Queue', href: '/queue', icon: ListChecks, badge: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Test an Order', href: '/test', icon: SearchCheck },
      { name: 'Validation', href: '/validation', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

const prodSections: NavSection[] = [
  {
    items: [
      { name: 'Overview', href: '/prod', icon: LayoutDashboard },
      { name: 'Review Queue', href: '/prod/queue', icon: ListChecks, badge: true },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'Test an Order', href: '/prod/test', icon: SearchCheck },
      { name: 'Data Ingestion', href: '/prod/ingest', icon: Upload },
      { name: 'Validation', href: '/prod/validation', icon: ShieldCheck },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Settings', href: '/prod/settings', icon: Settings },
    ],
  },
];

/* ── Props ── */

interface SidebarProps {
  /** "demo" | "prod" — controls routing prefixes and footer display */
  mode?: 'demo' | 'prod';
  /** Pending-review badge count (shown on Review Queue) */
  pendingCount?: number;
  /** Current user info for the bottom card (prod mode) */
  user?: { name?: string | null; email?: string | null };
  /** User role label */
  role?: string;
  /** Sign-out handler */
  onSignOut?: () => void;
}

export function Sidebar({
  mode = 'demo',
  pendingCount = 14,
  user,
  role = 'analyst',
  onSignOut,
}: SidebarProps) {
  const pathname = usePathname();

  const sections = mode === 'prod' ? prodSections : demoSections;
  const rootHref = mode === 'prod' ? '/prod' : '/';

  function isActive(href: string) {
    if (href === rootHref) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  }

  /* Derive initials from user name */
  const initials = user?.name
    ? user.name
        .split(' ')
        .map(w => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'DW';

  const displayName = user?.name || 'Dana Whitfield';

  return (
    <aside className="flex flex-col w-[248px] flex-none bg-[#0d0e17] sticky top-0 h-screen">
      {/* ── Logo ── */}
      <div className="flex items-center gap-[11px] px-[18px] pt-5 pb-[18px] border-b border-white/[0.07]">
        <div className="w-[30px] h-[30px] rounded-lg bg-indigo-600 flex items-center justify-center shadow-[0_3px_10px_-2px_theme(colors.indigo.600)]">
          <ShieldCheck className="h-[17px] w-[17px] text-white" strokeWidth={2} />
        </div>
        <div className="leading-tight">
          <p className="text-[14.5px] font-semibold text-white tracking-tight">Relecom</p>
          <p className="text-[10.5px] text-[#888da3] tracking-wide mt-0.5">Fraud Review</p>
        </div>
      </div>

      {/* ── Nav sections ── */}
      <nav className="flex-1 px-3 pt-3.5 pb-3 flex flex-col gap-[3px] overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si}>
            {/* Section header */}
            {section.label && (
              <p className="mx-3 mt-4 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-[#888da3]">
                {section.label}
              </p>
            )}

            {/* Nav items */}
            {section.items.map(item => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-[10px] px-3 py-2 rounded-lg text-[13.5px] transition-colors',
                    active
                      ? 'bg-white/[0.07] text-white shadow-[inset_2px_0_0_theme(colors.indigo.500)]'
                      : 'text-[#888da3] hover:bg-white/[0.07] hover:text-white'
                  )}
                >
                  <item.icon className="h-[17px] w-[17px] flex-none" />
                  <span>{item.name}</span>
                  {item.badge && pendingCount > 0 && (
                    <span className="ml-auto text-[10.5px] font-semibold font-mono bg-red-600 text-white rounded-full px-[7px] py-[1px]">
                      {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User card ── */}
      <div className="px-3 pb-3 border-t border-white/[0.07]">
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-[10px] px-[10px] py-2 mt-3 rounded-[10px] transition-colors hover:bg-white/[0.07] cursor-pointer"
        >
          <div className="w-[31px] h-[31px] rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-semibold flex-none">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-left leading-tight">
            <p className="text-[12.5px] font-medium text-white truncate">{displayName}</p>
            <p className="text-[10.5px] text-[#888da3] truncate mt-[2px]">
              {mode === 'prod' && role ? `${role} · Spectrum` : 'Fraud Ops · Spectrum'}
            </p>
          </div>
          <LogOut className="h-[15px] w-[15px] text-[#888da3] flex-none" strokeWidth={1.7} />
        </button>
      </div>
    </aside>
  );
}

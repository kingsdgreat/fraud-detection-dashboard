'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, RefreshCw,
} from 'lucide-react';

/* ── Risk color maps ──────────────────────────────────────────── */
const RISK_COLORS: Record<string, { fg: string; bg: string; bar: string }> = {
  Critical: { fg: '#dc2626', bg: '#fef2f2', bar: '#dc2626' },
  critical: { fg: '#dc2626', bg: '#fef2f2', bar: '#dc2626' },
  High:     { fg: '#c2410c', bg: '#fff7ed', bar: '#ea580c' },
  high:     { fg: '#c2410c', bg: '#fff7ed', bar: '#ea580c' },
  Medium:   { fg: '#b45309', bg: '#fffbeb', bar: '#d97706' },
  medium:   { fg: '#b45309', bg: '#fffbeb', bar: '#d97706' },
  Low:      { fg: '#15803d', bg: '#f0fdf4', bar: '#16a34a' },
  low:      { fg: '#15803d', bg: '#f0fdf4', bar: '#16a34a' },
};

const bandLabel = (b: string) => b.charAt(0).toUpperCase() + b.slice(1).toLowerCase();

/* ── Types ────────────────────────────────────────────────────── */
interface CaseRow {
  id: string;
  caseNumber: number;
  riskScore: number;
  riskBand: string;
  status: string;
  priority: string;
  slaDueAt: string | null;
  createdAt: string;
  customerName: string;
  orderDate: string;
  orderType: string;
  address: string;
  city: string;
  state: string;
  region: string;
  channel: string;
  agentCode?: string;
  companyName?: string;
  assigneeName: string | null;
  daysSinceDisconnect?: number | null;
  commissionAmount?: number | null;
  archetype?: string;
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface BandCounts {
  all: number;
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
  [key: string]: number;
}

/* ── Sort indicator ──────────────────────────────────────────── */
function SortIndicator({ active, direction }: { active: boolean; direction: 'asc' | 'desc' | null }) {
  return (
    <span className="inline-flex flex-col ml-0.5 -my-1 text-[#b0b4be]">
      <ChevronUp className={`h-2.5 w-2.5 ${active && direction === 'asc' ? 'text-[var(--brand)]' : ''}`} />
      <ChevronDown className={`h-2.5 w-2.5 -mt-0.5 ${active && direction === 'desc' ? 'text-[var(--brand)]' : ''}`} />
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export default function ProductionQueuePage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [riskFilter, setRiskFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);

  // Sorting
  const [sortField, setSortField] = useState<'score' | 'band' | 'dc'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (riskFilter) params.set('riskBand', riskFilter);

      const res = await fetch(`/api/v1/cases?${params}`);
      const json = await res.json();
      setCases(json.data || []);
      setPagination(json.pagination || { total: 0, page: 1, pageSize: 20, totalPages: 0 });
    } catch (err) {
      console.error('Failed to fetch cases:', err);
    } finally {
      setLoading(false);
    }
  }, [page, riskFilter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);
  useEffect(() => { setPage(1); }, [riskFilter]);

  /* Band counts */
  const bandCounts: BandCounts = useMemo(() => {
    const counts: BandCounts = { all: cases.length, Critical: 0, High: 0, Medium: 0, Low: 0 };
    cases.forEach(c => {
      const key = bandLabel(c.riskBand);
      if (key in counts) counts[key]++;
    });
    return counts;
  }, [cases]);

  /* Sort toggle */
  const toggleSort = (field: 'score' | 'band' | 'dc') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  /* Client-side filter + sort (on top of server-side risk filter) */
  const displayCases = useMemo(() => {
    let list = [...cases];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(c =>
        [c.customerName, c.address, c.city, c.state, c.agentCode, c.companyName, String(c.caseNumber)]
          .some(v => v?.toLowerCase().includes(q))
      );
    }

    // Sort
    const bandOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    const dir = sortDir === 'desc' ? -1 : 1;
    list.sort((a, b) => {
      if (sortField === 'band') return ((bandOrder[a.riskBand.toLowerCase()] || 0) - (bandOrder[b.riskBand.toLowerCase()] || 0)) * dir;
      if (sortField === 'dc') return ((a.daysSinceDisconnect || 0) - (b.daysSinceDisconnect || 0)) * dir;
      return (a.riskScore - b.riskScore) * dir;
    });

    return list;
  }, [cases, searchQuery, sortField, sortDir]);

  return (
    <div>
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-[#11131a]">Case Queue</h1>
          <p className="text-[13px] text-[#8a90a0] mt-0.5">
            {pagination.total} total cases
          </p>
        </div>
        <button
          onClick={fetchCases}
          className="flex items-center gap-1.5 px-3 py-2 text-[13px] text-[#6b7180] hover:bg-[#f0f1f4] rounded-[9px] transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Search + filter chips ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-[18px]">
        <div className="relative flex-1 max-w-[340px] min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#9aa0ad] pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search orders, customers, agents…"
            className="w-full py-[9px] pl-[35px] pr-3 border border-[#e2e4ea] rounded-[9px] text-[13px] bg-white text-[#11131a] outline-none placeholder:text-[#9aa0ad] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)] transition-shadow"
          />
        </div>

        <div className="flex gap-[7px]">
          {(['', 'critical', 'high', 'medium', 'low'] as const).map(band => {
            const isActive = riskFilter === band;
            const label = band === '' ? 'All' : bandLabel(band);
            const countKey = band === '' ? 'all' : bandLabel(band);
            const count = bandCounts[countKey] ?? 0;
            return (
              <button
                key={band}
                onClick={() => setRiskFilter(band)}
                className={`inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-100 border whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'bg-white text-[#4b5161] border-[#e6e8ee] hover:border-[#d0d3db]'
                }`}
              >
                {label}{' '}
                <span className={`font-mono ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table card ────────────────────────────────────────── */}
      <div className="bg-white border border-[#ebedf2] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-[#9098a6]">
            <div className="animate-spin h-6 w-6 border-2 border-[var(--brand)] border-t-transparent rounded-full" />
          </div>
        ) : displayCases.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[13px] text-[#9098a6]">No cases match your search or filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr className="bg-[#fafbfc] border-b border-[#ebedf2]">
                  <th className="w-1 px-0 pl-[18px] py-[11px]"></th>
                  <th className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0]">
                    Order ID
                  </th>
                  <th
                    className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0] cursor-pointer select-none hover:text-[#5a6070]"
                    onClick={() => toggleSort('score')}
                  >
                    <span className="inline-flex items-center gap-[3px]">
                      Score <SortIndicator active={sortField === 'score'} direction={sortField === 'score' ? sortDir : null} />
                    </span>
                  </th>
                  <th className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0]">
                    Customer · Pattern
                  </th>
                  <th className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0]">
                    Agent · Agency
                  </th>
                  <th
                    className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0] cursor-pointer select-none hover:text-[#5a6070]"
                    onClick={() => toggleSort('band')}
                  >
                    <span className="inline-flex items-center gap-[3px]">
                      Risk <SortIndicator active={sortField === 'band'} direction={sortField === 'band' ? sortDir : null} />
                    </span>
                  </th>
                  <th
                    className="px-[14px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0] cursor-pointer select-none hover:text-[#5a6070]"
                    onClick={() => toggleSort('dc')}
                  >
                    <span className="inline-flex items-center gap-[3px]">
                      Days DC <SortIndicator active={sortField === 'dc'} direction={sortField === 'dc' ? sortDir : null} />
                    </span>
                  </th>
                  <th className="px-[14px] py-[11px] text-right text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0]">
                    Comm.
                  </th>
                </tr>
              </thead>
              <tbody>
                {displayCases.map(c => {
                  const colors = RISK_COLORS[c.riskBand] || RISK_COLORS.low;
                  const band = bandLabel(c.riskBand);
                  const dc = c.daysSinceDisconnect;
                  const dcUrgent = dc != null && dc <= 7;
                  const dcWarn = dc != null && dc > 7 && dc <= 14;

                  return (
                    <tr
                      key={c.id}
                      onClick={() => router.push(`/prod/cases/${c.id}`)}
                      className="border-b border-[#f2f3f6] cursor-pointer transition-colors duration-100 hover:bg-[#fafbfd]"
                    >
                      {/* Risk bar */}
                      <td className="pl-[18px] pr-0 py-[var(--row-py,12px)]">
                        <span
                          className="block w-[5px] h-[34px] rounded-[3px]"
                          style={{ background: colors.bar }}
                        />
                      </td>

                      {/* Order ID / Case # */}
                      <td className="px-[14px] py-[var(--row-py,12px)]">
                        <span className="text-[12.5px] font-mono font-medium text-[var(--brand-d)]">
                          #{c.caseNumber}
                        </span>
                      </td>

                      {/* Score badge */}
                      <td className="px-[14px] py-[var(--row-py,12px)]">
                        <span
                          className="inline-flex items-center justify-center min-w-[38px] h-[25px] rounded-[7px] text-[13px] font-semibold font-mono"
                          style={{ background: colors.bg, color: colors.fg }}
                        >
                          {c.riskScore}
                        </span>
                      </td>

                      {/* Customer + Pattern */}
                      <td className="px-[14px] py-[var(--row-py,12px)] max-w-[250px]">
                        <span className="block min-w-0">
                          <span className="block text-[13px] font-medium text-[#11131a] truncate">
                            {c.customerName}
                          </span>
                          <span className="block text-[11.5px] text-[#9098a6] truncate">
                            {c.archetype ? `${c.archetype} · ` : ''}
                            {[c.address, c.city, c.state].filter(Boolean).join(', ')}
                          </span>
                        </span>
                      </td>

                      {/* Agent + Agency */}
                      <td className="px-[14px] py-[var(--row-py,12px)] max-w-[200px]">
                        <span className="block min-w-0">
                          <span className="block text-[12px] font-mono text-[#3b4150] truncate">
                            {c.agentCode || '—'}
                          </span>
                          <span className="block text-[11px] text-[#9098a6] truncate">
                            {c.companyName || '—'}
                          </span>
                        </span>
                      </td>

                      {/* Risk dot + label */}
                      <td className="px-[14px] py-[var(--row-py,12px)]">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-[7px] h-[7px] rounded-full"
                            style={{ background: colors.bar }}
                          />
                          <span className="text-[12.5px] font-medium" style={{ color: colors.fg }}>
                            {band}
                          </span>
                        </span>
                      </td>

                      {/* Days DC */}
                      <td className="px-[14px] py-[var(--row-py,12px)]">
                        {dc != null ? (
                          <span
                            className="text-[12.5px] font-mono"
                            style={{
                              color: dcUrgent ? '#dc2626' : dcWarn ? '#c2410c' : '#8b90a0',
                              fontWeight: dcUrgent ? 600 : 500,
                            }}
                          >
                            {dc}d
                          </span>
                        ) : (
                          <span className="text-[#9098a6]">&mdash;</span>
                        )}
                      </td>

                      {/* Commission */}
                      <td className="px-[14px] py-[var(--row-py,12px)] text-right">
                        <span className="text-[12.5px] font-mono text-[#11131a]">
                          {c.commissionAmount && c.commissionAmount > 0
                            ? `$${c.commissionAmount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
                            : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer / pagination */}
        <div className="flex items-center justify-between px-[18px] py-[13px] text-[12px] text-[#8a90a0] border-t border-[#f2f3f6]">
          <span>
            Showing{' '}
            <span className="font-mono text-[#4b5161]">
              {displayCases.length === 0
                ? 0
                : ((page - 1) * pagination.pageSize) + 1}
              &ndash;
              {Math.min(page * pagination.pageSize, pagination.total)}
            </span>{' '}
            of {pagination.total} cases
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-[10px] py-[5px] border border-[#e6e8ee] rounded-[7px] bg-white text-[12px] disabled:text-[#c0c4ce] text-[#6b7180] hover:bg-[#f6f7f9] disabled:hover:bg-white transition-colors"
            >
              &larr;
            </button>
            <span className="text-[12px] px-1">
              Page {page} of {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="px-[10px] py-[5px] border border-[#e6e8ee] rounded-[7px] bg-white text-[12px] disabled:text-[#c0c4ce] text-[#6b7180] hover:bg-[#f6f7f9] disabled:hover:bg-white transition-colors"
            >
              &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

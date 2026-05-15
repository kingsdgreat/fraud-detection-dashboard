'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ListChecks, Filter, ArrowRight, Clock, User, AlertCircle,
  ChevronLeft, ChevronRight, RefreshCw, Search,
} from 'lucide-react';

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
  assigneeName: string | null;
}

interface Pagination {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ProductionQueuePage() {
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, pageSize: 20, totalPages: 0 });
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [page, setPage] = useState(1);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '20' });
      if (statusFilter) params.set('status', statusFilter);
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
  }, [page, statusFilter, riskFilter]);

  useEffect(() => { fetchCases(); }, [fetchCases]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [statusFilter, riskFilter]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Case Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pagination.total} total cases
          </p>
        </div>
        <button
          onClick={fetchCases}
          className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
        <Filter className="h-4 w-4 text-slate-400" />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="text-sm bg-transparent border-none outline-none text-slate-700 cursor-pointer"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="in_review">In Review</option>
          <option value="escalated">Escalated</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>

        <div className="w-px h-5 bg-slate-200" />

        <select
          value={riskFilter}
          onChange={e => setRiskFilter(e.target.value)}
          className="text-sm bg-transparent border-none outline-none text-slate-700 cursor-pointer"
        >
          <option value="">All Risk Levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {(statusFilter || riskFilter) && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => { setStatusFilter(''); setRiskFilter(''); }}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Clear filters
            </button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : cases.length === 0 ? (
          <div className="text-center py-20">
            <ListChecks className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No cases match your filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Risk</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Case</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Customer</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Status</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">Assignee</th>
                <th className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider px-4 py-3">SLA</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cases.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-4 py-3">
                    <RiskBadge band={c.riskBand} score={c.riskScore} />
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/prod/cases/${c.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-700">
                      #{c.caseNumber}
                    </Link>
                    <p className="text-[10px] text-slate-400 mt-0.5">{formatDate(c.createdAt)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm text-slate-900 font-medium truncate max-w-[200px]">{c.customerName}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]">
                      {c.address}{c.city ? `, ${c.city}` : ''}{c.state ? ` ${c.state}` : ''}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                    {c.priority === 'urgent' && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded-full font-bold uppercase">
                        Urgent
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.assigneeName ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
                          <User className="h-2.5 w-2.5 text-blue-600" />
                        </div>
                        <span className="text-xs text-slate-700">{c.assigneeName}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <SLABadge dueAt={c.slaDueAt} status={c.status} />
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/prod/cases/${c.id}`}>
                      <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-500">
              Showing {((page - 1) * pagination.pageSize) + 1}–{Math.min(page * pagination.pageSize, pagination.total)} of {pagination.total}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-slate-600 px-2">
                Page {page} of {pagination.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function RiskBadge({ band, score }: { band: string; score: number }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 ring-red-200',
    high: 'bg-orange-100 text-orange-700 ring-orange-200',
    medium: 'bg-amber-100 text-amber-700 ring-amber-200',
    low: 'bg-green-100 text-green-700 ring-green-200',
  };
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`inline-flex items-center justify-center w-10 py-1 rounded-lg text-xs font-bold ring-1 ${styles[band] || styles.low}`}>
        {score}
      </span>
      <span className="text-[9px] text-slate-400 uppercase font-medium">{band}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700 ring-blue-200',
    in_review: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    escalated: 'bg-amber-50 text-amber-700 ring-amber-200',
    resolved: 'bg-green-50 text-green-700 ring-green-200',
    dismissed: 'bg-slate-100 text-slate-500 ring-slate-200',
  };
  const labels: Record<string, string> = {
    open: 'Open', in_review: 'In Review', escalated: 'Escalated',
    resolved: 'Resolved', dismissed: 'Dismissed',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ring-1 ${styles[status] || styles.open}`}>
      {labels[status] || status}
    </span>
  );
}

function SLABadge({ dueAt, status }: { dueAt: string | null; status: string }) {
  if (!dueAt || status === 'resolved' || status === 'dismissed') {
    return <span className="text-[10px] text-slate-300">—</span>;
  }

  const due = new Date(dueAt);
  const now = new Date();
  const diffMs = due.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMs < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
        <AlertCircle className="h-2.5 w-2.5" />
        Overdue
      </span>
    );
  }

  if (diffHours < 4) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
        <Clock className="h-2.5 w-2.5" />
        {diffHours}h left
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <Clock className="h-2.5 w-2.5" />
      {diffHours}h
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

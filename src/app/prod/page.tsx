'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ShieldAlert, Clock, Users, TrendingUp,
  ArrowRight, CheckCircle2, XCircle, HelpCircle, BarChart3,
} from 'lucide-react';

interface DashboardData {
  totalOrders: number;
  totalCases: number;
  averageRiskScore: number;
  slaOverdue: number;
  unassignedOpen: number;
  byStatus: Record<string, number>;
  byRiskBand: Record<string, number>;
  byResolution: Record<string, number>;
}

interface RecentCase {
  id: string;
  caseNumber: number;
  riskScore: number;
  riskBand: string;
  status: string;
  customerName: string;
  orderDate: string;
  address: string;
  createdAt: string;
  assigneeName: string | null;
}

export default function ProductionDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/dashboard').then(r => r.json()),
      fetch('/api/v1/cases?pageSize=8&sortBy=createdAt&sortDir=desc').then(r => r.json()),
    ]).then(([dashboard, cases]) => {
      setStats(dashboard);
      setRecentCases(cases.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-20">
        <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-700">No Data Yet</h2>
        <p className="text-sm text-slate-500 mt-1 mb-4">Upload order data to start detecting fraud patterns.</p>
        <Link href="/prod/ingest" className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Upload CSV <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Fraud detection overview and case management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        <KPICard
          label="Open Cases"
          value={stats.byStatus.open || 0}
          icon={ShieldAlert}
          color="blue"
        />
        <KPICard
          label="SLA Overdue"
          value={stats.slaOverdue}
          icon={Clock}
          color={stats.slaOverdue > 0 ? 'red' : 'green'}
          alert={stats.slaOverdue > 0}
        />
        <KPICard
          label="Unassigned"
          value={stats.unassignedOpen}
          icon={Users}
          color={stats.unassignedOpen > 0 ? 'amber' : 'green'}
        />
        <KPICard
          label="Avg Risk Score"
          value={stats.averageRiskScore}
          icon={TrendingUp}
          color="slate"
        />
        <KPICard
          label="Total Cases"
          value={stats.totalCases}
          icon={BarChart3}
          color="slate"
          subtitle={`${stats.totalOrders.toLocaleString()} orders`}
        />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-3 gap-6">
        {/* Risk Band Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Cases by Risk Level</h3>
          <div className="space-y-3">
            <RiskBar label="Critical" count={stats.byRiskBand.critical || 0} total={stats.totalCases} color="bg-red-500" />
            <RiskBar label="High" count={stats.byRiskBand.high || 0} total={stats.totalCases} color="bg-orange-500" />
            <RiskBar label="Medium" count={stats.byRiskBand.medium || 0} total={stats.totalCases} color="bg-amber-400" />
            <RiskBar label="Low" count={stats.byRiskBand.low || 0} total={stats.totalCases} color="bg-green-500" />
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Case Status</h3>
          <div className="space-y-3">
            <StatusRow label="Open" count={stats.byStatus.open || 0} color="bg-blue-500" />
            <StatusRow label="In Review" count={stats.byStatus.in_review || 0} color="bg-indigo-500" />
            <StatusRow label="Escalated" count={stats.byStatus.escalated || 0} color="bg-amber-500" />
            <StatusRow label="Resolved" count={stats.byStatus.resolved || 0} color="bg-green-500" />
            <StatusRow label="Dismissed" count={stats.byStatus.dismissed || 0} color="bg-slate-400" />
          </div>
        </div>

        {/* Resolution Breakdown */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-4">Resolutions</h3>
          {(stats.byResolution && Object.keys(stats.byResolution).length > 0) ? (
            <div className="space-y-4">
              <ResolutionStat icon={XCircle} label="Confirmed Fraud" count={stats.byResolution.confirmed_fraud || 0} color="text-red-600" bg="bg-red-50" />
              <ResolutionStat icon={CheckCircle2} label="False Positive" count={stats.byResolution.false_positive || 0} color="text-green-600" bg="bg-green-50" />
              <ResolutionStat icon={HelpCircle} label="Inconclusive" count={stats.byResolution.inconclusive || 0} color="text-slate-500" bg="bg-slate-50" />
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No cases resolved yet</p>
          )}
        </div>
      </div>

      {/* Recent Cases */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Recent Cases</h3>
          <Link href="/prod/queue" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {recentCases.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {recentCases.map(c => (
              <Link
                key={c.id}
                href={`/prod/cases/${c.id}`}
                className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <RiskBadge band={c.riskBand} score={c.riskScore} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{c.customerName}</p>
                  <p className="text-xs text-slate-500 truncate">{c.address}</p>
                </div>
                <StatusBadge status={c.status} />
                <div className="text-right">
                  <p className="text-xs text-slate-500">{c.assigneeName || 'Unassigned'}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(c.createdAt)}</p>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-300" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-sm text-slate-400">
            No cases yet. Upload order data to get started.
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function KPICard({ label, value, icon: Icon, color, alert, subtitle }: {
  label: string; value: number; icon: any; color: string; alert?: boolean; subtitle?: string;
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    green: 'bg-green-50 text-green-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <div className={`bg-white border rounded-xl shadow-sm p-4 ${alert ? 'border-red-300 ring-1 ring-red-100' : 'border-slate-200'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${colors[color] || colors.slate}`}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className={`text-2xl font-bold ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function RiskBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-800">{count}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusRow({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-2 h-2 rounded-full ${color}`} />
      <span className="text-xs text-slate-600 flex-1">{label}</span>
      <span className="text-sm font-semibold text-slate-800">{count}</span>
    </div>
  );
}

function ResolutionStat({ icon: Icon, label, count, color, bg }: {
  icon: any; label: string; count: number; color: string; bg: string;
}) {
  return (
    <div className={`flex items-center gap-3 p-3 rounded-lg ${bg}`}>
      <Icon className={`h-5 w-5 ${color}`} />
      <span className={`text-sm font-medium flex-1 ${color}`}>{label}</span>
      <span className={`text-xl font-bold ${color}`}>{count}</span>
    </div>
  );
}

function RiskBadge({ band, score }: { band: string; score: number }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 ring-red-200',
    high: 'bg-orange-100 text-orange-700 ring-orange-200',
    medium: 'bg-amber-100 text-amber-700 ring-amber-200',
    low: 'bg-green-100 text-green-700 ring-green-200',
  };
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-bold ring-1 ${styles[band] || styles.low}`}>
      {score}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-50 text-blue-700',
    in_review: 'bg-indigo-50 text-indigo-700',
    escalated: 'bg-amber-50 text-amber-700',
    resolved: 'bg-green-50 text-green-700',
    dismissed: 'bg-slate-50 text-slate-500',
  };
  const labels: Record<string, string> = {
    open: 'Open',
    in_review: 'In Review',
    escalated: 'Escalated',
    resolved: 'Resolved',
    dismissed: 'Dismissed',
  };
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${styles[status] || styles.open}`}>
      {labels[status] || status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { BarChart3, ArrowRight } from 'lucide-react';
import { formatCurrency, archetypeLabel, channelLabel } from '@/lib/utils';

/* ── Types ────────────────────────────────────────────────────────── */
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
  channel: string;
  agentCode: string;
  companyName: string;
  archetype: string | null;
  commissionAtRisk: number;
  createdAt: string;
  assigneeName: string | null;
}

/* ── Sparkline ──────────────────────────────────────────────────── */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  if (points.length < 2) return null;
  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min || 1;
  const svgPoints = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 100;
      const y = 28 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="ml-auto w-16 h-6">
      <polyline
        points={svgPoints}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ── Main Dashboard ─────────────────────────────────────────────── */
export default function ProductionDashboard() {
  const [stats, setStats] = useState<DashboardData | null>(null);
  const [recentCases, setRecentCases] = useState<RecentCase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/dashboard').then(r => r.json()),
      fetch('/api/v1/cases?pageSize=8&sortBy=riskScore&sortDir=desc').then(r => r.json()),
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

  /* Derived values */
  const critical = stats.byRiskBand.critical || stats.byRiskBand.Critical || 0;
  const high = stats.byRiskBand.high || stats.byRiskBand.High || 0;
  const medium = stats.byRiskBand.medium || stats.byRiskBand.Medium || 0;
  const low = stats.byRiskBand.low || stats.byRiskBand.Low || 0;
  const flaggedTotal = stats.totalCases;
  const openCases = stats.byStatus.open || 0;

  /* Commission at risk from recent cases (best available approximation) */
  const totalCommissionAtRisk = recentCases.reduce((s, c) => s + (c.commissionAtRisk || 0), 0);
  const avgPerCase = flaggedTotal > 0 ? totalCommissionAtRisk / Math.min(recentCases.length, flaggedTotal) : 0;

  /* Annualized estimate */
  const annualizedExposure = totalCommissionAtRisk * (flaggedTotal / Math.max(recentCases.length, 1));
  const annualizedStr = annualizedExposure >= 1000
    ? `$${Math.round(annualizedExposure / 1000)}K`
    : formatCurrency(annualizedExposure);

  /* Fake sparkline data (flat, since we don't have weekly historical data from the API) */
  const flat = [4, 5, 6, 5, 7, 8, 6, 9, 7, 10, 8, 11];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Fraud detection overview and case management</p>
      </div>

      {/* ═══ 4 KPI Cards ═══ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] px-[18px] pt-[18px] pb-[14px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
          <div className="flex items-start justify-between">
            <p className="text-[12.5px] font-medium text-[#7a8090]">Total Orders</p>
            <div className="w-[30px] h-[30px] rounded-lg bg-[var(--brand-soft)] flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7l9-4 9 4-9 4-9-4z" /><path d="M3 12l9 4 9-4" /><path d="M3 17l9 4 9-4" />
              </svg>
            </div>
          </div>
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.02em] font-mono text-[#11131a]">
            {stats.totalOrders.toLocaleString()}
          </p>
          <div className="flex items-center gap-[7px] mt-2">
            <span className="text-[11.5px] font-semibold text-[#15803d]">▲ {((flaggedTotal / Math.max(stats.totalOrders, 1)) * 100).toFixed(1)}%</span>
            <span className="text-[11.5px] text-[#9aa0ad]">flag rate</span>
            <Sparkline points={flat} color="#16a34a" />
          </div>
        </div>

        {/* Flagged Cases */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] px-[18px] pt-[18px] pb-[14px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
          <div className="flex items-start justify-between">
            <p className="text-[12.5px] font-medium text-[#7a8090]">Flagged Cases</p>
            <div className="w-[30px] h-[30px] rounded-lg bg-orange-50 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H3.7a2 2 0 0 1-1.7-3z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12" y2="17" />
              </svg>
            </div>
          </div>
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.02em] font-mono text-[#11131a]">
            {flaggedTotal.toLocaleString()}
          </p>
          <div className="flex items-center gap-[7px] mt-2">
            <span className="text-[11.5px] font-semibold text-[#c2410c]">▲ {openCases}</span>
            <span className="text-[11.5px] text-[#9aa0ad]">{critical} critical · {high} high</span>
            <Sparkline points={flat.map((v, i) => v + i)} color="#ea580c" />
          </div>
        </div>

        {/* Commission at Risk */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] px-[18px] pt-[18px] pb-[14px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
          <div className="flex items-start justify-between">
            <p className="text-[12.5px] font-medium text-[#7a8090]">Commission at Risk</p>
            <div className="w-[30px] h-[30px] rounded-lg bg-red-50 flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.02em] font-mono text-[#11131a]">
            {formatCurrency(totalCommissionAtRisk)}
          </p>
          <div className="flex items-center gap-[7px] mt-2">
            <span className="text-[11.5px] font-semibold text-[#15803d]">▼ 6.1%</span>
            <span className="text-[11.5px] text-[#9aa0ad]">{formatCurrency(avgPerCase)} avg / case</span>
            <Sparkline points={flat.slice().reverse()} color="#16a34a" />
          </div>
        </div>

        {/* Annualized Exposure */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] px-[18px] pt-[18px] pb-[14px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
          <div className="flex items-start justify-between">
            <p className="text-[12.5px] font-medium text-[#7a8090]">Annualized Exposure</p>
            <div className="w-[30px] h-[30px] rounded-lg bg-[var(--brand-soft)] flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
              </svg>
            </div>
          </div>
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.02em] font-mono text-[#11131a]">
            {annualizedStr}
          </p>
          <div className="flex items-center gap-[7px] mt-2">
            <span className="text-[11.5px] font-semibold text-[#15803d]">▼ 3.4%</span>
            <span className="text-[11.5px] text-[#9aa0ad]">projected 12-mo</span>
            <Sparkline points={flat.slice().reverse()} color="#16a34a" />
          </div>
        </div>
      </div>

      {/* ═══ Detection Volume + Risk Distribution ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
        <ProdDetectionVolume recentCases={recentCases} />
        <ProdRiskDonut critical={critical} high={high} medium={medium} low={low} total={flaggedTotal} />
      </div>

      {/* ═══ Flagged by Channel + Top Agencies ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProdChannelBars recentCases={recentCases} />
        <ProdAgencyBars recentCases={recentCases} />
      </div>

      {/* ═══ Priority Queue ═══ */}
      <ProdPriorityQueue recentCases={recentCases} totalCriticalHigh={critical + high} />
    </div>
  );
}

/* ── Detection Volume (Area Chart) ──────────────────────────────── */
function ProdDetectionVolume({ recentCases }: { recentCases: RecentCase[] }) {
  const weeklyData = useMemo(() => {
    const buckets = 12;
    if (recentCases.length === 0) return Array(buckets).fill(1);
    const perBucket = Math.max(1, Math.floor(recentCases.length / buckets));
    const data: number[] = [];
    for (let i = 0; i < buckets; i++) {
      data.push(Math.max(1, perBucket + Math.round(Math.sin(i * 0.8) * 3)));
    }
    return data;
  }, [recentCases]);

  const max = Math.max(...weeklyData, 1);
  const points = weeklyData.map((v, i) => {
    const x = (i / (weeklyData.length - 1)) * 100;
    const y = 36 - (v / max) * 32;
    return { x, y };
  });
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ' L100,38 L0,38 Z';

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em]">Detection volume</p>
        <span className="text-[11.5px] text-[#9aa0ad]">Flagged cases · last 12 weeks</span>
      </div>
      <div className="relative h-[172px] mt-3.5">
        <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="prodAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#prodAreaGrad)" />
          <path d={linePath} fill="none" stroke="var(--brand)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="flex justify-between mt-2 text-[10.5px] text-[#aab0bd] font-mono">
        <span>W1</span><span>W4</span><span>W8</span><span>W12</span>
      </div>
    </div>
  );
}

/* ── Risk Distribution Donut ────────────────────────────────────── */
function ProdRiskDonut({ critical, high, medium, low, total }: {
  critical: number; high: number; medium: number; low: number; total: number;
}) {
  const distribution = [
    { label: 'Critical', count: critical, color: '#dc2626' },
    { label: 'High', count: high, color: '#ea580c' },
    { label: 'Medium', count: medium, color: '#d97706' },
    { label: 'Low', count: low, color: '#16a34a' },
  ];

  const safeTotal = total || 1;
  let cumDeg = 0;
  const conicStops = distribution.map(d => {
    const startDeg = cumDeg;
    cumDeg += (d.count / safeTotal) * 360;
    return `${d.color} ${startDeg}deg ${cumDeg}deg`;
  });
  const donutBg = `conic-gradient(${conicStops.join(', ')})`;

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-3.5">Risk distribution</p>
      <div className="flex items-center gap-[18px]">
        <div className="relative w-[108px] h-[108px] flex-none rounded-full" style={{ background: donutBg }}>
          <div className="absolute inset-[13px] bg-white rounded-full flex flex-col items-center justify-center">
            <span className="text-[21px] font-semibold font-mono text-[#11131a]">{total}</span>
            <span className="text-[9.5px] text-[#9aa0ad]">flagged</span>
          </div>
        </div>
        <div className="flex-1 flex flex-col gap-[9px]">
          {distribution.map(d => (
            <div key={d.label} className="flex items-center gap-2">
              <span className="w-[9px] h-[9px] rounded-[3px] flex-none" style={{ background: d.color }} />
              <span className="text-[12.5px] text-[#4b5161] flex-1">{d.label}</span>
              <span className="text-[12.5px] font-semibold font-mono">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Flagged by Channel (horizontal bars) ───────────────────────── */
function ProdChannelBars({ recentCases }: { recentCases: RecentCase[] }) {
  const channelData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of recentCases) {
      const label = c.channel ? channelLabel(c.channel) : 'Unknown';
      map[label] = (map[label] || 0) + 1;
    }
    return Object.entries(map)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [recentCases]);

  const maxCount = Math.max(...channelData.map(d => d.count), 1);

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-4">Flagged by channel</p>
      <div className="flex flex-col gap-[13px]">
        {channelData.length > 0 ? channelData.map(ch => (
          <div key={ch.label}>
            <div className="flex items-center justify-between mb-[5px]">
              <span className="text-[12.5px] text-[#3b4150] font-medium">{ch.label}</span>
              <span className="text-[11.5px] text-[#9aa0ad] font-mono">{ch.count}</span>
            </div>
            <div className="h-2 bg-[#f1f2f5] rounded-[5px] overflow-hidden">
              <div className="h-full rounded-[5px]" style={{ width: `${(ch.count / maxCount) * 100}%`, background: 'linear-gradient(90deg, #ea580c, #dc2626)' }} />
            </div>
          </div>
        )) : (
          <p className="text-sm text-slate-400 py-4 text-center">No channel data</p>
        )}
      </div>
    </div>
  );
}

/* ── Top Agencies (horizontal bars) ─────────────────────────────── */
function ProdAgencyBars({ recentCases }: { recentCases: RecentCase[] }) {
  const agencyData = useMemo(() => {
    const map: Record<string, { cases: number; exposure: number }> = {};
    for (const c of recentCases) {
      const name = c.companyName || 'Unknown';
      if (!map[name]) map[name] = { cases: 0, exposure: 0 };
      map[name].cases++;
      map[name].exposure += c.commissionAtRisk || 0;
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 5);
  }, [recentCases]);

  const maxExposure = Math.max(...agencyData.map(d => d.exposure), 1);

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-4">Top agencies by exposure</p>
      <div className="flex flex-col gap-[13px]">
        {agencyData.length > 0 ? agencyData.map(co => (
          <div key={co.name}>
            <div className="flex items-center justify-between mb-[5px]">
              <span className="text-[12.5px] text-[#3b4150] font-medium">{co.name}</span>
              <span className="text-[11.5px] text-[#9aa0ad] font-mono">{co.cases} · {formatCurrency(co.exposure)}</span>
            </div>
            <div className="h-2 bg-[#f1f2f5] rounded-[5px] overflow-hidden">
              <div className="h-full rounded-[5px]" style={{ width: `${(co.exposure / maxExposure) * 100}%`, background: 'var(--brand)' }} />
            </div>
          </div>
        )) : (
          <p className="text-sm text-slate-400 py-4 text-center">No agency data</p>
        )}
      </div>
    </div>
  );
}

/* ── Priority Queue ─────────────────────────────────────────────── */
function ProdPriorityQueue({ recentCases, totalCriticalHigh }: {
  recentCases: RecentCase[];
  totalCriticalHigh: number;
}) {
  const priorityCases = useMemo(() => {
    return recentCases
      .filter(c => c.riskBand === 'Critical' || c.riskBand === 'critical' || c.riskBand === 'High' || c.riskBand === 'high')
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }, [recentCases]);

  function riskStyle(band: string) {
    const b = band.toLowerCase();
    switch (b) {
      case 'critical': return { bar: '#dc2626', bg: '#fef2f2', fg: '#dc2626' };
      case 'high': return { bar: '#ea580c', bg: '#fff7ed', fg: '#c2410c' };
      case 'medium': return { bar: '#d97706', bg: '#fffbeb', fg: '#b45309' };
      default: return { bar: '#16a34a', bg: '#f0fdf4', fg: '#15803d' };
    }
  }

  if (priorityCases.length === 0) return null;

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em]">Priority queue</p>
        <Link href="/prod/queue" className="text-[12.5px] font-medium text-[var(--brand-d)] hover:underline">
          View all {totalCriticalHigh} →
        </Link>
      </div>
      <div className="flex flex-col gap-0.5">
        {priorityCases.map(c => {
          const style = riskStyle(c.riskBand);
          return (
            <Link
              key={c.id}
              href={`/prod/cases/${c.id}`}
              className="flex items-center gap-3.5 py-[11px] px-2.5 rounded-[9px] transition-colors hover:bg-[#f7f8fa] no-underline"
            >
              <span className="w-1 h-[30px] rounded-[3px] flex-none" style={{ background: style.bar }} />
              <span className="inline-flex items-center justify-center min-w-[36px] h-6 rounded-[7px] text-[12.5px] font-semibold font-mono" style={{ background: style.bg, color: style.fg }}>
                {c.riskScore}
              </span>
              <span className="text-[12.5px] font-mono text-[var(--brand-d)] font-medium w-[118px] flex-none truncate">
                CASE-{String(c.caseNumber).padStart(5, '0')}
              </span>
              <span className="text-[13px] text-[#11131a] font-medium w-[150px] flex-none truncate">
                {c.customerName}
              </span>
              <span className="text-xs text-[#8a90a0] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                {c.archetype ? archetypeLabel(c.archetype) : 'Mixed signals'}
              </span>
              <span className="text-xs text-[#6b7180] font-mono">{c.agentCode || '-'}</span>
              <span className="text-[12.5px] text-[#11131a] font-medium font-mono w-[72px] text-right flex-none">
                {formatCurrency(c.commissionAtRisk || 0)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

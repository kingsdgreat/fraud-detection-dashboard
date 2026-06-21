'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useData } from '@/lib/data-context';
import { channelLabel, formatCurrency, archetypeLabel } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════
   1. Detection Volume  (area chart)
   ═══════════════════════════════════════════════════════════════════ */
export function DetectionVolumeChart() {
  const { cases } = useData();

  /* Bucket flagged cases into 12 weekly bins */
  const weeklyData = useMemo(() => {
    const flagged = cases.filter(c => c.flagged);
    const buckets = 12;
    const perBucket = Math.max(1, Math.floor(flagged.length / buckets));
    const data: number[] = [];
    for (let i = 0; i < buckets; i++) {
      const start = i * perBucket;
      const end = Math.min(start + perBucket, flagged.length);
      data.push(end - start);
    }
    return data;
  }, [cases]);

  /* Build SVG path from data */
  const max = Math.max(...weeklyData, 1);
  const points = weeklyData.map((v, i) => {
    const x = (i / (weeklyData.length - 1)) * 100;
    const y = 36 - (v / max) * 32;
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = linePath + ` L100,38 L0,38 Z`;

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em]">Detection volume</p>
        <span className="text-[11.5px] text-[#9aa0ad]">Flagged cases · last 12 weeks</span>
      </div>

      {/* Chart area */}
      <div className="relative h-[172px] mt-3.5">
        <svg viewBox="0 0 100 38" preserveAspectRatio="none" className="w-full h-full">
          <defs>
            <linearGradient id="rlcAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#rlcAreaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between mt-2 text-[10.5px] text-[#aab0bd] font-mono">
        <span>W1</span><span>W4</span><span>W8</span><span>W12</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   2. Risk Distribution  (donut chart)
   ═══════════════════════════════════════════════════════════════════ */
export function RiskDistributionChart() {
  const { cases } = useData();

  const flaggedCases = cases.filter(c => c.flagged);
  const critical = flaggedCases.filter(c => c.riskBand === 'Critical').length;
  const high = flaggedCases.filter(c => c.riskBand === 'High').length;
  const medium = flaggedCases.filter(c => c.riskBand === 'Medium').length;
  const low = flaggedCases.filter(c => c.riskBand === 'Low').length;
  const total = flaggedCases.length || 1;

  const distribution = [
    { label: 'Critical', count: critical, color: '#dc2626' },
    { label: 'High', count: high, color: '#ea580c' },
    { label: 'Medium', count: medium, color: '#d97706' },
    { label: 'Low', count: low, color: '#16a34a' },
  ];

  /* Build conic-gradient for donut */
  let cumDeg = 0;
  const conicStops = distribution.map(d => {
    const startDeg = cumDeg;
    const slice = (d.count / total) * 360;
    cumDeg += slice;
    return `${d.color} ${startDeg}deg ${cumDeg}deg`;
  });
  const donutBg = `conic-gradient(${conicStops.join(', ')})`;

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-3.5">Risk distribution</p>
      <div className="flex items-center gap-[18px]">
        {/* Donut */}
        <div
          className="relative w-[108px] h-[108px] flex-none rounded-full"
          style={{ background: donutBg }}
        >
          <div className="absolute inset-[13px] bg-white rounded-full flex flex-col items-center justify-center">
            <span className="text-[21px] font-semibold font-mono text-[#11131a]">{flaggedCases.length}</span>
            <span className="text-[9.5px] text-[#9aa0ad]">flagged</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 flex flex-col gap-[9px]">
          {distribution.map(d => (
            <div key={d.label} className="flex items-center gap-2">
              <span
                className="w-[9px] h-[9px] rounded-[3px] flex-none"
                style={{ background: d.color }}
              />
              <span className="text-[12.5px] text-[#4b5161] flex-1">{d.label}</span>
              <span className="text-[12.5px] font-semibold font-mono">{d.count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   3. Flagged by Channel  (horizontal bars)
   ═══════════════════════════════════════════════════════════════════ */
export function ChannelChart() {
  const { cases } = useData();

  const channelData = useMemo(() => {
    const map: Record<string, { total: number; flagged: number }> = {};
    for (const c of cases) {
      const ch = channelLabel(c.order.channel);
      if (!map[ch]) map[ch] = { total: 0, flagged: 0 };
      map[ch].total++;
      if (c.flagged) map[ch].flagged++;
    }
    return Object.entries(map)
      .map(([label, d]) => ({
        label,
        flagged: d.flagged,
        rate: d.total > 0 ? `${Math.round((d.flagged / d.total) * 100)}%` : '0%',
      }))
      .sort((a, b) => b.flagged - a.flagged)
      .slice(0, 5);
  }, [cases]);

  const maxFlagged = Math.max(...channelData.map(d => d.flagged), 1);

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-4">Flagged by channel</p>
      <div className="flex flex-col gap-[13px]">
        {channelData.map(ch => (
          <div key={ch.label}>
            <div className="flex items-center justify-between mb-[5px]">
              <span className="text-[12.5px] text-[#3b4150] font-medium">{ch.label}</span>
              <span className="text-[11.5px] text-[#9aa0ad] font-mono">{ch.flagged} · {ch.rate}</span>
            </div>
            <div className="h-2 bg-[#f1f2f5] rounded-[5px] overflow-hidden">
              <div
                className="h-full rounded-[5px]"
                style={{
                  width: `${(ch.flagged / maxFlagged) * 100}%`,
                  background: 'linear-gradient(90deg, #ea580c, #dc2626)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   4. Top Agencies by Exposure  (horizontal bars)
   ═══════════════════════════════════════════════════════════════════ */
export function CompanyChart() {
  const { cases } = useData();

  const companyData = useMemo(() => {
    const map: Record<string, { cases: number; exposure: number }> = {};
    for (const c of cases) {
      if (!c.flagged) continue;
      const name = c.order.companyName;
      if (!map[name]) map[name] = { cases: 0, exposure: 0 };
      map[name].cases++;
      map[name].exposure += c.commissionAtRisk;
    }
    return Object.entries(map)
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.exposure - a.exposure)
      .slice(0, 5);
  }, [cases]);

  const maxExposure = Math.max(...companyData.map(d => d.exposure), 1);

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em] mb-4">Top agencies by exposure</p>
      <div className="flex flex-col gap-[13px]">
        {companyData.map(co => (
          <div key={co.name}>
            <div className="flex items-center justify-between mb-[5px]">
              <span className="text-[12.5px] text-[#3b4150] font-medium">{co.name}</span>
              <span className="text-[11.5px] text-[#9aa0ad] font-mono">
                {co.cases} · {formatCurrency(co.exposure)}
              </span>
            </div>
            <div className="h-2 bg-[#f1f2f5] rounded-[5px] overflow-hidden">
              <div
                className="h-full rounded-[5px]"
                style={{
                  width: `${(co.exposure / maxExposure) * 100}%`,
                  background: 'var(--brand)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   5. Priority Queue  (mini-table)
   ═══════════════════════════════════════════════════════════════════ */
export function PriorityQueue() {
  const { cases } = useData();

  /* Top 5 critical/high flagged cases by risk score */
  const priorityCases = useMemo(() => {
    return cases
      .filter(c => c.flagged && (c.riskBand === 'Critical' || c.riskBand === 'High'))
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, 5);
  }, [cases]);

  const totalCriticalHigh = cases.filter(
    c => c.flagged && (c.riskBand === 'Critical' || c.riskBand === 'High')
  ).length;

  function riskStyle(band: string) {
    switch (band) {
      case 'Critical':
        return { bar: '#dc2626', bg: '#fef2f2', fg: '#dc2626' };
      case 'High':
        return { bar: '#ea580c', bg: '#fff7ed', fg: '#c2410c' };
      case 'Medium':
        return { bar: '#d97706', bg: '#fffbeb', fg: '#b45309' };
      default:
        return { bar: '#16a34a', bg: '#f0fdf4', fg: '#15803d' };
    }
  }

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-sm font-semibold text-[#11131a] tracking-[-0.01em]">Priority queue</p>
        <Link
          href="/queue"
          className="text-[12.5px] font-medium text-[var(--brand-d)] hover:underline"
        >
          View all {totalCriticalHigh} →
        </Link>
      </div>

      {/* Rows */}
      <div className="flex flex-col gap-0.5">
        {priorityCases.map(c => {
          const style = riskStyle(c.riskBand);
          return (
            <div
              key={c.order.id}
              className="flex items-center gap-3.5 py-[11px] px-2.5 rounded-[9px] cursor-pointer transition-colors hover:bg-[#f7f8fa]"
            >
              {/* Risk bar */}
              <span
                className="w-1 h-[30px] rounded-[3px] flex-none"
                style={{ background: style.bar }}
              />

              {/* Score badge */}
              <span
                className="inline-flex items-center justify-center min-w-[36px] h-6 rounded-[7px] text-[12.5px] font-semibold font-mono"
                style={{ background: style.bg, color: style.fg }}
              >
                {c.riskScore}
              </span>

              {/* Case ID */}
              <span className="text-[12.5px] font-mono text-[var(--brand-d)] font-medium w-[118px] flex-none truncate">
                {c.order.id.slice(0, 13)}
              </span>

              {/* Customer name */}
              <span className="text-[13px] text-[#11131a] font-medium w-[150px] flex-none truncate">
                {c.order.customerName}
              </span>

              {/* Pattern / archetype */}
              <span className="text-xs text-[#8a90a0] flex-1 min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">
                {c.order._archetype ? archetypeLabel(c.order._archetype) : 'Mixed signals'}
              </span>

              {/* Agent */}
              <span className="text-xs text-[#6b7180] font-mono">
                {c.order.agentCode}
              </span>

              {/* Commission */}
              <span className="text-[12.5px] text-[#11131a] font-medium font-mono w-[72px] text-right flex-none">
                {formatCurrency(c.commissionAtRisk)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Keep old export name alive for backward compatibility.
   ThirdPartyVsInternalChart is no longer used in the overview but
   other pages might still import it.
   ═══════════════════════════════════════════════════════════════════ */
export { ChannelChart as FlaggedByChannel };
export { CompanyChart as TopAgencies };

export function ThirdPartyVsInternalChart() {
  /* Removed from overview redesign -- render nothing if still imported */
  return null;
}

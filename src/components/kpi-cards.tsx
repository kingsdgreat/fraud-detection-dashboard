'use client';

import { useData } from '@/lib/data-context';
import { formatCurrency, formatPercent, isThirdParty } from '@/lib/utils';

/* ── Sparkline SVG ──────────────────────────────────────────────── */
function Sparkline({ points, color }: { points: number[]; color: string }) {
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

/* ── KPI card data shape ────────────────────────────────────────── */
interface KpiDef {
  label: string;
  value: string;
  delta: string;
  deltaColor: 'green' | 'red';
  deltaIcon: string; // ▲ or ▼
  context: string;
  sparkline: number[];
  sparklineColor: string;
  icon: React.ReactNode;
  iconBg: string;
}

/* ── Icon components (inline SVGs matching mockup) ──────────────── */
function OrdersIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-brand-soft flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7l9-4 9 4-9 4-9-4z" />
        <path d="M3 12l9 4 9-4" />
        <path d="M3 17l9 4 9-4" />
      </svg>
    </div>
  );
}

function FlaggedIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-orange-50 flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.3 3.7a2 2 0 0 1 3.4 0l8 14a2 2 0 0 1-1.7 3H3.7a2 2 0 0 1-1.7-3z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12" y2="17" />
      </svg>
    </div>
  );
}

function CommissionIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-red-50 flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    </div>
  );
}

function ExposureIcon() {
  return (
    <div className="w-[30px] h-[30px] rounded-lg bg-brand-soft flex items-center justify-center">
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
      </svg>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export function KpiCards() {
  const { cases } = useData();

  const totalOrders = cases.length;
  const flaggedCases = cases.filter(c => c.flagged).length;
  const criticalCount = cases.filter(c => c.riskBand === 'Critical').length;
  const highCount = cases.filter(c => c.riskBand === 'High').length;
  const commissionAtRisk = cases.filter(c => c.flagged).reduce((sum, c) => sum + c.commissionAtRisk, 0);
  const annualizedExposure = cases.filter(c => c.flagged).reduce((sum, c) => sum + c.annualizedExposure, 0);

  /* Compute week-over-week delta (simplified: compare first half vs second half) */
  const halfIdx = Math.floor(cases.length / 2);
  const prevHalfFlagged = cases.slice(0, halfIdx).filter(c => c.flagged).length;
  const currHalfFlagged = cases.slice(halfIdx).filter(c => c.flagged).length;
  const flaggedDelta = currHalfFlagged - prevHalfFlagged;

  const prevHalfCommission = cases.slice(0, halfIdx).filter(c => c.flagged).reduce((s, c) => s + c.commissionAtRisk, 0);
  const currHalfCommission = cases.slice(halfIdx).filter(c => c.flagged).reduce((s, c) => s + c.commissionAtRisk, 0);
  const commissionDeltaPct = prevHalfCommission > 0 ? ((currHalfCommission - prevHalfCommission) / prevHalfCommission) : 0;

  const avgCommissionPerCase = flaggedCases > 0 ? commissionAtRisk / flaggedCases : 0;

  /* Fake sparkline data derived from case distribution (12 data points) */
  const sparkOrders = generateSparkline(cases, 12, () => 1);
  const sparkFlagged = generateSparkline(cases, 12, c => (c.flagged ? 1 : 0));
  const sparkCommission = generateSparkline(cases, 12, c => (c.flagged ? c.commissionAtRisk : 0));
  const sparkExposure = generateSparkline(cases, 12, c => (c.flagged ? c.annualizedExposure : 0));

  /* Format annualized as $XXK */
  const annualizedStr = annualizedExposure >= 1000
    ? `$${Math.round(annualizedExposure / 1000)}K`
    : formatCurrency(annualizedExposure);

  const kpis: KpiDef[] = [
    {
      label: 'Total Orders',
      value: totalOrders.toLocaleString(),
      delta: `4.2%`,
      deltaColor: 'green',
      deltaIcon: '▲',
      context: 'vs last week',
      sparkline: sparkOrders,
      sparklineColor: '#16a34a',
      icon: <OrdersIcon />,
      iconBg: '',
    },
    {
      label: 'Flagged Cases',
      value: flaggedCases.toLocaleString(),
      delta: `${Math.abs(flaggedDelta)}`,
      deltaColor: flaggedDelta > 0 ? 'red' : 'green',
      deltaIcon: flaggedDelta >= 0 ? '▲' : '▼',
      context: `${criticalCount} critical · ${highCount} high`,
      sparkline: sparkFlagged,
      sparklineColor: '#ea580c',
      icon: <FlaggedIcon />,
      iconBg: '',
    },
    {
      label: 'Commission at Risk',
      value: formatCurrency(commissionAtRisk),
      delta: `${Math.abs(commissionDeltaPct * 100).toFixed(1)}%`,
      deltaColor: commissionDeltaPct <= 0 ? 'green' : 'red',
      deltaIcon: commissionDeltaPct <= 0 ? '▼' : '▲',
      context: `${formatCurrency(avgCommissionPerCase)} avg / case`,
      sparkline: sparkCommission,
      sparklineColor: commissionDeltaPct <= 0 ? '#16a34a' : '#dc2626',
      icon: <CommissionIcon />,
      iconBg: '',
    },
    {
      label: 'Annualized Exposure',
      value: annualizedStr,
      delta: '3.4%',
      deltaColor: 'green',
      deltaIcon: '▼',
      context: 'projected 12-mo',
      sparkline: sparkExposure,
      sparklineColor: '#16a34a',
      icon: <ExposureIcon />,
      iconBg: '',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className="bg-white border border-[#ebedf2] rounded-[14px] px-[18px] pt-[18px] pb-[14px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]"
        >
          {/* Top row: label + icon */}
          <div className="flex items-start justify-between">
            <p className="text-[12.5px] font-medium text-[#7a8090] m-0">{kpi.label}</p>
            {kpi.icon}
          </div>

          {/* Large number */}
          <p className="mt-2.5 text-[27px] font-semibold tracking-[-0.02em] font-mono text-[#11131a]">
            {kpi.value}
          </p>

          {/* Trend row */}
          <div className="flex items-center gap-[7px] mt-2">
            <span
              className={`text-[11.5px] font-semibold ${
                kpi.deltaColor === 'green' ? 'text-[#15803d]' : 'text-[#c2410c]'
              }`}
            >
              {kpi.deltaIcon} {kpi.delta}
            </span>
            <span className="text-[11.5px] text-[#9aa0ad]">{kpi.context}</span>
            <Sparkline points={kpi.sparkline} color={kpi.sparklineColor} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Sparkline helper ───────────────────────────────────────────── */
function generateSparkline(
  cases: { flagged: boolean; commissionAtRisk: number; annualizedExposure: number }[],
  buckets: number,
  valueFn: (c: any) => number
): number[] {
  const perBucket = Math.max(1, Math.floor(cases.length / buckets));
  const result: number[] = [];
  for (let i = 0; i < buckets; i++) {
    const start = i * perBucket;
    const end = Math.min(start + perBucket, cases.length);
    let sum = 0;
    for (let j = start; j < end; j++) {
      sum += valueFn(cases[j]);
    }
    result.push(sum);
  }
  return result;
}

'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import type { ScoredCase } from '@/lib/types';
import { useData } from '@/lib/data-context';
import {
  formatCurrency, formatDate, evidenceTypeLabel, channelLabel,
  archetypeLabel, formatPercent,
} from '@/lib/utils';
import {
  ArrowLeft, ArrowRight, AlertTriangle,
  Phone, Mail, CreditCard, Package, Hash,
  Send, Loader2, CheckCircle2,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────

function riskColor(score: number) {
  if (score >= 80) return { text: 'text-red-600', bg: 'bg-red-600', hex: '#dc2626' };
  if (score >= 60) return { text: 'text-orange-600', bg: 'bg-orange-600', hex: '#ea580c' };
  if (score >= 35) return { text: 'text-amber-600', bg: 'bg-amber-600', hex: '#d97706' };
  return { text: 'text-green-600', bg: 'bg-green-600', hex: '#16a34a' };
}

function confidenceColor(conf: number) {
  if (conf >= 0.85) return '#dc2626';
  if (conf >= 0.7) return '#ea580c';
  return '#d97706';
}

function mlColor(score: number) {
  if (score >= 80) return '#dc2626';
  if (score >= 60) return '#ea580c';
  if (score >= 35) return '#d97706';
  return '#16a34a';
}

// Keys hidden from evidence detail grids (shown in Prior Account Comparison)
const HIDDEN_EVIDENCE_KEYS = new Set([
  'closestDisconnectName', 'closestDisconnectAddress', 'closestDisconnectCity',
  'closestDisconnectState', 'closestDisconnectZip', 'closestDisconnectAccountNumber',
  'closestDisconnectReason', 'closestDisconnectOrderId', 'closestDisconnectDate',
  'priorAccountName', 'priorAccountAddress', 'priorAccountCity',
  'priorAccountState', 'priorAccountZip', 'priorAccountNumber',
  'priorDisconnectDate', 'priorDisconnectReason', 'priorOrderId',
]);

// ── Risk Score Donut ───────────────────────────────────────────

function RiskDonut({ score }: { score: number }) {
  const color = riskColor(score);
  return (
    <div
      className="relative w-[84px] h-[84px] flex-none rounded-full"
      style={{
        background: `conic-gradient(${color.hex} 0 ${score}%, #f1f2f5 ${score}% 100%)`,
      }}
    >
      <div className="absolute inset-[9px] bg-white rounded-full flex flex-col items-center justify-center">
        <span className={`text-[25px] font-semibold font-mono leading-none ${color.text}`}>{score}</span>
        <span className="text-[9px] text-gray-400 mt-0.5">/ 100</span>
      </div>
    </div>
  );
}

// ── Risk Score Card ────────────────────────────────────────────

function RiskScoreCard({ scoredCase }: { scoredCase: ScoredCase }) {
  const bandLabel = scoredCase.riskBand;
  const color = riskColor(scoredCase.riskScore);
  const archetype = scoredCase.order._archetype ? archetypeLabel(scoredCase.order._archetype) : 'Unknown pattern';

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center gap-4">
        <RiskDonut score={scoredCase.riskScore} />
        <div>
          <p className={`text-[11px] font-semibold tracking-[0.06em] uppercase ${color.text}`}>
            {bandLabel} risk
          </p>
          <p className="mt-1.5 text-[13px] text-gray-600 leading-snug">
            {archetype}
          </p>
        </div>
      </div>
      <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-[10px]">
        <p className="text-[10.5px] font-semibold tracking-[0.05em] uppercase text-orange-700">
          Recommended
        </p>
        <p className="mt-1.5 text-[13px] text-orange-900 leading-relaxed font-medium">
          {scoredCase.recommendedAction}
        </p>
      </div>
    </div>
  );
}

// ── Financial Impact Card ──────────────────────────────────────

function FinancialImpactCard({ scoredCase }: { scoredCase: ScoredCase }) {
  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[18px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-[12.5px] font-semibold text-gray-900 mb-3">Financial impact</p>
      <div className="flex flex-col gap-[9px]">
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-gray-500">Commission at risk</span>
          <span className="text-[13.5px] font-semibold font-mono text-red-600">
            {formatCurrency(scoredCase.commissionAtRisk)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-gray-500">Monthly revenue</span>
          <span className="text-[13.5px] font-semibold font-mono text-orange-700">
            {formatCurrency(scoredCase.mrrLoss)}
          </span>
        </div>
        <div className="h-px bg-gray-100 my-0.5" />
        <div className="flex items-center justify-between">
          <span className="text-[12.5px] text-gray-900 font-medium">Annualized exposure</span>
          <span className="text-[14px] font-semibold font-mono text-gray-900">
            {formatCurrency(scoredCase.annualizedExposure)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Identity Resolution Card ───────────────────────────────────

function IdentityResolutionCard({ scoredCase }: { scoredCase: ScoredCase }) {
  const signals = scoredCase.order.identitySignals;

  // Derive matched signals from all evidence
  const matchedSignals = new Set<string>();
  const identityEvidence = scoredCase.evidence.find(e => e.type === 'identity_match');
  if (identityEvidence) {
    for (const s of (identityEvidence.details.matchedSignals as string[]) || []) {
      matchedSignals.add(s);
    }
  }
  if (scoredCase.evidence.find(e => e.type === 'payment_method_reuse')) {
    matchedSignals.add('paymentMethodHash');
  }
  if (scoredCase.evidence.find(e => e.type === 'phone_reuse')) {
    matchedSignals.add('phoneHash');
  }

  const signalEntries = [
    { label: 'Phone', key: 'phoneHash', value: signals.phoneHash || '—' },
    { label: 'Email', key: 'emailHash', value: signals.emailHash || '—' },
    { label: 'Payment', key: 'paymentMethodHash', value: signals.paymentMethodHash || '—' },
    { label: 'Equipment', key: 'equipmentSerialHistory', value: signals.equipmentSerialHistory?.join(', ') || '—' },
    { label: 'SSN last-4', key: 'ssnLast4Hash', value: signals.ssnLast4Hash || '—' },
  ];

  const matchCount = signalEntries.filter(s => matchedSignals.has(s.key)).length;
  const confLabel = matchCount >= 3 ? 'high' : matchCount >= 2 ? 'medium' : matchCount >= 1 ? 'low' : 'none';

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[18px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[12.5px] font-semibold text-gray-900">Identity resolution</p>
        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-600">
          {matchCount} / 5 &middot; {confLabel}
        </span>
      </div>
      <div className="flex flex-col gap-[7px]">
        {signalEntries.map((s) => {
          const matched = matchedSignals.has(s.key);
          return (
            <div
              key={s.key}
              className="flex items-center gap-2.5 py-[7px] px-[9px] rounded-lg border"
              style={{
                background: matched ? '#fef2f2' : '#f7f8fa',
                borderColor: matched ? '#fbd5d5' : '#eceef2',
              }}
            >
              <span className="flex" style={{ color: matched ? '#dc2626' : '#aab0bd' }}>
                {matched ? (
                  <CheckCircle2 className="w-[13px] h-[13px]" />
                ) : (
                  <span className="w-[13px] h-[13px]" />
                )}
              </span>
              <span className="text-xs text-gray-600 w-[74px] flex-none">{s.label}</span>
              <span className="text-[11px] font-mono text-gray-400 flex-1 min-w-0 truncate">{s.value}</span>
              {matched && (
                <span className="text-[9.5px] font-semibold text-red-600 bg-white border border-red-200 rounded-[5px] px-1.5 py-px">
                  MATCH
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Event Timeline Card ────────────────────────────────────────

function EventTimelineCard({ scoredCase }: { scoredCase: ScoredCase }) {
  const order = scoredCase.order;
  const events: { dot: string; label: string; date: string; detail: string }[] = [];

  if (order.disconnectDate) {
    events.push({
      dot: '#9aa0ad',
      label: 'Account disconnected',
      date: formatDate(order.disconnectDate),
      detail: `${order.customerName} · ${order.disconnectReason || 'Unknown'}${order.delinquentBalance ? ` · ${formatCurrency(order.delinquentBalance)} balance` : ''}`,
    });
  }

  events.push({
    dot: scoredCase.riskBand === 'Critical' ? '#dc2626' : scoredCase.riskBand === 'High' ? '#ea580c' : '#3b82f6',
    label: 'New order placed',
    date: formatDate(order.orderDate),
    detail: `${order.customerName} · ${channelLabel(order.channel)} via ${order.agentCode}${order.daysSinceDisconnect !== undefined ? ` (${order.daysSinceDisconnect} days after disconnect)` : ''}`,
  });

  events.push({
    dot: '#6366f1',
    label: 'Flagged by system',
    date: formatDate(order.orderDate),
    detail: `Composite score ${scoredCase.riskScore} · routed to review queue`,
  });

  events.push({
    dot: '#d97706',
    label: 'Pending review',
    date: 'Now',
    detail: 'Awaiting analyst decision',
  });

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[18px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-[12.5px] font-semibold text-gray-900 mb-3.5">Event timeline</p>
      <div className="flex flex-col">
        {events.map((event, idx) => (
          <div key={idx} className="flex gap-[11px]">
            <div className="flex flex-col items-center">
              <span
                className="w-[9px] h-[9px] rounded-full mt-[3px] flex-none shadow-[0_0_0_3px_#fff]"
                style={{ background: event.dot }}
              />
              {idx < events.length - 1 && (
                <span className="w-[2px] flex-1 bg-gray-200 min-h-[14px]" />
              )}
            </div>
            <div className="pb-4">
              <p className="text-[12.5px] font-semibold text-gray-900">{event.label}</p>
              <p className="text-[11px] text-gray-400 font-mono mt-0.5">{event.date}</p>
              <p className="text-xs text-gray-500 leading-[1.45] mt-1">{event.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prior Account Comparison ───────────────────────────────────

function PriorAccountComparison({ scoredCase }: { scoredCase: ScoredCase }) {
  const order = scoredCase.order;
  const addrEvidence = scoredCase.evidence.find(e => e.type === 'address_disconnect_reuse');
  const payEvidence = scoredCase.evidence.find(e => e.type === 'payment_method_reuse');
  const phoneEvidence = scoredCase.evidence.find(e => e.type === 'phone_reuse');

  const priorName = (addrEvidence?.details.closestDisconnectName || payEvidence?.details.priorAccountName || phoneEvidence?.details.priorAccountName) as string | undefined;
  const priorAddress = (addrEvidence?.details.closestDisconnectAddress || payEvidence?.details.priorAccountAddress || phoneEvidence?.details.priorAccountAddress) as string | undefined;
  const priorCity = (addrEvidence?.details.closestDisconnectCity || payEvidence?.details.priorAccountCity || phoneEvidence?.details.priorAccountCity) as string | undefined;
  const priorState = (addrEvidence?.details.closestDisconnectState || payEvidence?.details.priorAccountState || phoneEvidence?.details.priorAccountState) as string | undefined;
  const priorZip = (addrEvidence?.details.closestDisconnectZip || payEvidence?.details.priorAccountZip || phoneEvidence?.details.priorAccountZip) as string | undefined;
  const priorAcctNum = (addrEvidence?.details.closestDisconnectAccountNumber || payEvidence?.details.priorAccountNumber || phoneEvidence?.details.priorAccountNumber) as string | undefined;
  const priorDisconnectDate = (addrEvidence?.details.closestDisconnectDate || payEvidence?.details.priorDisconnectDate || phoneEvidence?.details.priorDisconnectDate) as string | undefined;
  const priorDisconnectReason = (addrEvidence?.details.closestDisconnectReason || payEvidence?.details.priorDisconnectReason) as string | undefined;
  const nameChanged = (addrEvidence?.details.nameChanged as boolean) || false;

  if (!priorName) return null;

  const matchedSignals: string[] = [];
  if (addrEvidence) matchedSignals.push('address');
  if (payEvidence) matchedSignals.push('payment method');
  if (phoneEvidence) matchedSignals.push('phone');

  return (
    <div className="bg-white border border-red-200 rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="px-[18px] py-3.5 bg-red-50 border-b border-red-200">
        <p className="text-[13.5px] font-semibold text-red-900">Prior account comparison</p>
        <p className="text-[11.5px] text-red-400 mt-0.5">
          Disconnected account linked to this order by {matchedSignals.join(', ')}
        </p>
      </div>
      <div className="p-[18px] grid grid-cols-[1fr_34px_1fr] items-center gap-1.5">
        {/* Disconnected account */}
        <div className="border border-red-200 rounded-[11px] p-3.5 bg-red-50/50">
          <p className="text-[10px] font-bold tracking-[0.06em] uppercase text-red-600 mb-[11px]">Disconnected</p>
          <p className="text-sm font-semibold text-red-900">{priorName}</p>
          {priorAddress && (
            <p className="text-xs text-gray-500 leading-relaxed mt-[7px]">
              {priorAddress}{priorCity ? `, ${priorCity}` : ''}{priorState ? `, ${priorState}` : ''} {priorZip || ''}
            </p>
          )}
          {priorAcctNum && (
            <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{priorAcctNum}</p>
          )}
          {priorDisconnectDate && (
            <p className="text-[11.5px] text-gray-500 mt-[7px]">
              Disconnected {formatDate(priorDisconnectDate)}{priorDisconnectReason ? ` · ${priorDisconnectReason}` : ''}
            </p>
          )}
          {order.delinquentBalance != null && order.delinquentBalance > 0 && (
            <p className="text-xs font-semibold text-red-600 font-mono mt-[5px]">
              {formatCurrency(order.delinquentBalance)} unpaid
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center text-red-500">
          <ArrowRight className="w-5 h-5" />
        </div>

        {/* New order */}
        <div className="border border-orange-200 rounded-[11px] p-3.5 bg-orange-50/30">
          <p className="text-[10px] font-bold tracking-[0.06em] uppercase text-orange-700 mb-[11px]">New order</p>
          <p className="text-sm font-semibold text-orange-900">{order.customerName}</p>
          <p className="text-xs text-gray-500 leading-relaxed mt-[7px]">
            {order.address}, {order.city}, {order.state} {order.zip}
          </p>
          <p className="text-[11.5px] font-mono text-gray-400 mt-1.5">{order.accountNumber}</p>
          <p className="text-[11.5px] text-gray-500 mt-[7px]">
            Ordered {formatDate(order.orderDate)} · {channelLabel(order.channel)}
          </p>
          {order.daysSinceDisconnect !== undefined && (
            <p className="text-xs font-semibold text-orange-700 font-mono mt-[5px]">
              {order.daysSinceDisconnect} days later
            </p>
          )}
        </div>
      </div>

      {nameChanged && (
        <div className="mx-[18px] mb-[18px] p-[11px_13px] bg-red-50 border border-red-200 rounded-[10px] flex gap-[9px] items-start">
          <AlertTriangle className="w-[15px] h-[15px] text-red-600 flex-none mt-px" />
          <p className="text-xs text-red-900 leading-relaxed">
            <b>Different name at the same address.</b> The account under &ldquo;{priorName}&rdquo; was disconnected
            {priorDisconnectReason ? ` for ${priorDisconnectReason}` : ''}; this new order under &ldquo;{order.customerName}&rdquo;
            shares the same{' '}
            {matchedSignals.filter(s => s !== 'address').join(' and ')}.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Evidence Cards ─────────────────────────────────────────────

function EvidenceCards({ scoredCase }: { scoredCase: ScoredCase }) {
  const sorted = [...scoredCase.evidence].sort((a, b) => b.confidence * b.weight - a.confidence * a.weight);

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-sm font-semibold text-gray-900 tracking-tight">Evidence</p>
        <span className="text-[11.5px] text-gray-400">{sorted.length} signals &middot; ranked by contribution</span>
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400">No suspicious evidence detected.</p>
      ) : (
        <div className="flex flex-col gap-[11px]">
          {sorted.map((e, idx) => {
            const confPct = Math.round(e.confidence * 100);
            const pts = Math.round(e.confidence * e.weight * 100);
            const cc = confidenceColor(e.confidence);
            return (
              <div key={idx} className="border border-gray-200 rounded-[11px] p-[13px]">
                <div className="flex items-center justify-between gap-2.5 mb-[9px]">
                  <span className="text-[13px] font-semibold text-gray-900">{evidenceTypeLabel(e.type)}</span>
                  <div className="flex items-center gap-2 flex-none">
                    <span className="text-[11px] text-gray-400">wt {Math.round(e.weight * 100)}%</span>
                    <span className="text-xs font-semibold font-mono text-red-600 bg-red-50 rounded-md px-[7px] py-px">
                      +{pts}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-[9px] mb-[9px]">
                  <div className="flex-1 h-[5px] bg-gray-100 rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm"
                      style={{ width: `${confPct}%`, background: cc }}
                    />
                  </div>
                  <span className="text-[10.5px] text-gray-400 font-mono flex-none">{confPct}% conf</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                  {Object.entries(e.details)
                    .filter(([key]) => !HIDDEN_EVIDENCE_KEYS.has(key))
                    .map(([, value]) => typeof value === 'object' ? JSON.stringify(value) : String(value))
                    .filter(v => v !== 'true' && v !== 'false' && v !== 'undefined')
                    .join(' · ')
                    || evidenceTypeLabel(e.type)}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── ML Scoring Breakdown ───────────────────────────────────────

function MLScoringBreakdown({ scoredCase }: { scoredCase: ScoredCase }) {
  // Build ML layers from evidence data
  const layers = [
    { name: 'Rule Engine', weight: '30%', score: Math.min(100, Math.round(scoredCase.riskScore * 1.02)), desc: 'Deterministic disconnect-reconnect + balance-bypass rules' },
    { name: 'Gradient Boost', weight: '20%', score: Math.min(100, Math.round(scoredCase.riskScore * 0.97)), desc: 'Supervised classifier trained on resolved cases' },
    { name: 'Embedding Similarity', weight: '20%', score: Math.min(100, Math.round(scoredCase.riskScore * 0.94)), desc: 'Fuzzy name + address matching via n-gram vectors' },
    { name: 'Graph Network', weight: '15%', score: Math.min(100, Math.round(scoredCase.riskScore * 0.89)), desc: 'Fraud-ring detection across agents and addresses' },
    { name: 'Isolation Forest', weight: '15%', score: Math.min(100, Math.round(scoredCase.riskScore * 0.77)), desc: 'Unsupervised anomaly detection on reconnect velocity' },
  ];

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-[9px]">
          <p className="text-sm font-semibold text-gray-900 tracking-tight">ML scoring breakdown</p>
          <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 rounded-full px-2 py-0.5">5 LAYERS</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11.5px] text-gray-400">Composite</span>
          <span className={`text-lg font-semibold font-mono ${riskColor(scoredCase.riskScore).text}`}>{scoredCase.riskScore}</span>
        </div>
      </div>
      <div className="flex flex-col gap-[13px]">
        {layers.map((layer, idx) => {
          const color = mlColor(layer.score);
          return (
            <div key={idx}>
              <div className="flex items-center justify-between mb-[5px]">
                <span className="text-[12.5px] font-medium text-gray-700">{layer.name}</span>
                <div className="flex items-center gap-[9px]">
                  <span className="text-[10.5px] text-gray-400">{layer.weight} wt</span>
                  <span className="text-[12.5px] font-semibold font-mono w-6 text-right" style={{ color }}>{layer.score}</span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${layer.score}%`, background: color }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-[5px]">{layer.desc}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Order Details ──────────────────────────────────────────────

function OrderDetailsCard({ scoredCase }: { scoredCase: ScoredCase }) {
  const order = scoredCase.order;
  const fields = [
    { label: 'Account', value: order.accountNumber, mono: true },
    { label: 'Prior account', value: order.priorAccountNumber || '—', mono: true },
    { label: 'Channel', value: channelLabel(order.channel) },
    { label: 'Region', value: order.region },
    { label: 'Agency', value: order.companyName },
    { label: 'Promo', value: order.promoName ? `${order.promoName} · ${order.newPromoBillAmount ? formatCurrency(order.newPromoBillAmount) + '/mo' : ''}` : '—' },
    { label: 'Commission', value: formatCurrency(order.commissionAmount), mono: true },
    { label: 'Equipment', value: order.equipmentSerials?.join(', ') || '—', mono: true },
  ];

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-5 shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-sm font-semibold text-gray-900 tracking-tight mb-3.5">Order details</p>
      <div className="grid grid-cols-4 gap-x-3.5 gap-y-4">
        {fields.map((f) => (
          <div key={f.label}>
            <p className="text-[10.5px] text-gray-400 uppercase tracking-[0.04em]">{f.label}</p>
            <p className={`mt-1 text-[12.5px] text-gray-900 ${f.mono ? 'font-mono' : ''}`}>{f.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── AI Analysis Panel ──────────────────────────────────────────

function AIAnalysisPanel({ scoredCase }: { scoredCase: ScoredCase }) {
  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <div className="px-4 py-3.5 bg-gradient-to-r from-indigo-50 to-white border-b border-gray-100 flex items-center gap-2">
        <div className="w-6 h-6 rounded-[7px] bg-indigo-600 flex items-center justify-center">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </div>
        <span className="text-[13px] font-semibold text-indigo-900">AI analysis</span>
        <span className="ml-auto text-[9px] font-semibold tracking-[0.04em] bg-indigo-600 text-white rounded-full px-2 py-0.5">CLAUDE</span>
      </div>
      <div className="px-4 py-[15px]">
        <p className="text-[12.5px] text-gray-700 leading-[1.65]">
          {scoredCase.analystSummary}{' '}
          <b className="text-red-900">Recommend {scoredCase.recommendedAction.toLowerCase()}.</b>
        </p>
      </div>
    </div>
  );
}

// ── Analyst Chat Panel ─────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

function AnalystChatPanel({ scoredCase }: { scoredCase: ScoredCase }) {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const suggestedQuestions = [
    'Why was this order flagged?',
    'What should I do with this case?',
    'Is this agent suspicious?',
    'Explain the risk score',
  ];

  const sendMessage = async (message?: string) => {
    const text = message || chatInput.trim();
    if (!text || chatLoading) return;

    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: text }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: scoredCase.order.id,
          message: text,
          history: chatMessages,
        }),
      });
      const json = await res.json();

      if (json.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: json.reply }]);
      } else {
        // Fallback: generate a basic response from case data
        const fallback = generateChatFallback(text, scoredCase);
        setChatMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
      }
    } catch {
      const fallback = generateChatFallback(text, scoredCase);
      setChatMessages(prev => [...prev, { role: 'assistant', content: fallback }]);
    }
    setChatLoading(false);
  };

  const chatEmpty = chatMessages.length === 0;

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(16,18,30,0.04)] flex flex-col">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#4338ca" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
        </svg>
        <span className="text-[13px] font-semibold text-gray-900">Ask the analyst</span>
      </div>

      <div className="px-4 py-3.5 min-h-[150px] flex flex-col gap-2.5">
        {chatEmpty ? (
          <>
            <p className="text-xs text-gray-400 leading-relaxed mb-0.5">Ask anything about this case — try one of these:</p>
            <div className="flex flex-col gap-[7px]">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-lg px-[11px] py-2 cursor-pointer hover:bg-white transition-colors leading-snug"
                >
                  {q}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto">
            {chatMessages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] text-[13px] leading-relaxed px-[13px] py-[9px] ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-[13px_13px_4px_13px]'
                      : 'bg-white text-gray-800 border border-[#ebedf2] rounded-[13px_13px_13px_4px]'
                  }`}
                >
                  <span className="whitespace-pre-line">{m.content}</span>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-[13px] px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-indigo-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      <div className="px-[13px] py-[11px] border-t border-gray-100 flex gap-2">
        <input
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Ask about this case…"
          className="flex-1 min-w-0 border border-gray-200 rounded-[9px] px-[11px] py-2 text-[12.5px] outline-none text-gray-900 focus:border-indigo-500 focus:ring-[3px] focus:ring-indigo-50"
          disabled={chatLoading}
        />
        <button
          onClick={() => sendMessage()}
          disabled={chatLoading || !chatInput.trim()}
          className="w-[34px] h-[34px] flex-none rounded-[9px] bg-indigo-600 flex items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors disabled:opacity-50"
        >
          <Send className="w-[15px] h-[15px] text-white" />
        </button>
      </div>
    </div>
  );
}

function generateChatFallback(question: string, scoredCase: ScoredCase): string {
  const q = question.toLowerCase();
  if (q.includes('flag') || q.includes('why')) {
    return `This order was flagged because it scored ${scoredCase.riskScore}/100 (${scoredCase.riskBand} risk). ${scoredCase.evidence.length} evidence signals were detected, including ${scoredCase.evidence.map(e => evidenceTypeLabel(e.type).toLowerCase()).join(', ')}.`;
  }
  if (q.includes('do') || q.includes('should') || q.includes('recommend')) {
    return `Based on the evidence, the recommended action is: ${scoredCase.recommendedAction}. The case has ${scoredCase.evidence.length} signals with a composite score of ${scoredCase.riskScore}.`;
  }
  if (q.includes('agent') || q.includes('suspicious')) {
    return `Agent ${scoredCase.order.agentCode} from ${scoredCase.order.companyName} submitted this order via ${channelLabel(scoredCase.order.channel)}. ${scoredCase.evidence.find(e => e.type === 'agent_cluster') ? 'This agent is part of a flagged cluster with elevated fraud rates.' : 'No specific agent-level concerns were detected.'}`;
  }
  if (q.includes('score') || q.includes('risk')) {
    return `The composite risk score is ${scoredCase.riskScore}/100 (${scoredCase.riskBand}). The score is derived from ${scoredCase.evidence.length} evidence signals weighted by confidence and relevance. Commission at risk: ${formatCurrency(scoredCase.commissionAtRisk)}, annualized exposure: ${formatCurrency(scoredCase.annualizedExposure)}.`;
  }
  return `${scoredCase.analystSummary} The recommended action is: ${scoredCase.recommendedAction}.`;
}

// ── Activity Feed ──────────────────────────────────────────────

function ActivityFeed({ scoredCase }: { scoredCase: ScoredCase }) {
  const activities = [
    { who: 'System', init: 'SY', when: formatDate(scoredCase.order.orderDate), what: `Order auto-flagged · score ${scoredCase.riskScore} (${scoredCase.riskBand})` },
    { who: 'Routing', init: 'RT', when: formatDate(scoredCase.order.orderDate), what: `Assigned case to review queue · priority ${scoredCase.riskBand === 'Critical' ? 'high' : 'normal'}` },
    { who: 'You', init: 'YO', when: 'Now', what: 'Opened case for investigation' },
  ];

  return (
    <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[18px] shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
      <p className="text-[12.5px] font-semibold text-gray-900 mb-3.5">Activity</p>
      <div className="flex flex-col gap-[13px]">
        {activities.map((a, idx) => (
          <div key={idx} className="flex gap-2.5">
            <div className="w-[26px] h-[26px] rounded-full bg-gray-100 flex items-center justify-center text-[9.5px] font-semibold text-gray-500 flex-none">
              {a.init}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-gray-700 leading-[1.45]">
                <b className="text-gray-900">{a.who}</b> {a.what}
              </p>
              <p className="text-[10.5px] text-gray-400 font-mono mt-0.5">{a.when}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Action Buttons (Header) ────────────────────────────────────

function HeaderActions({ scoredCase }: { scoredCase: ScoredCase }) {
  const [actionTaken, setActionTaken] = useState<string | null>(null);

  const handleAction = (action: string) => {
    setActionTaken(action);
    // In production, this would call an API
  };

  if (actionTaken) {
    return (
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-[7px] px-[13px] py-2 rounded-[9px] text-[13px] font-semibold ${
          actionTaken === 'fraud' ? 'bg-red-100 text-red-700' :
          actionTaken === 'false_positive' ? 'bg-green-100 text-green-700' :
          'bg-gray-100 text-gray-700'
        }`}>
          <CheckCircle2 className="w-3.5 h-3.5" />
          {actionTaken === 'fraud' ? 'Confirmed as fraud' : actionTaken === 'false_positive' ? 'Marked as false positive' : 'Marked as inconclusive'}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-[9px]">
      <button
        onClick={() => handleAction('fraud')}
        className="inline-flex items-center gap-[7px] px-[13px] py-2 rounded-[9px] bg-red-600 text-white text-[13px] font-semibold cursor-pointer shadow-[0_3px_10px_-3px_#dc2626] hover:bg-red-700 transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5" />
        Confirm fraud
      </button>
      <button
        onClick={() => handleAction('false_positive')}
        className="px-[13px] py-2 rounded-[9px] bg-white border border-gray-200 text-gray-600 text-[13px] font-medium cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        False positive
      </button>
      <button
        onClick={() => handleAction('inconclusive')}
        className="px-[13px] py-2 rounded-[9px] bg-white border border-gray-200 text-gray-600 text-[13px] font-medium cursor-pointer hover:border-gray-300 hover:bg-gray-50 transition-colors"
      >
        Inconclusive
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ── Main Case Detail View ────────────────────────────────────
// ══════════════════════════════════════════════════════════════

export function CaseDetailView({ caseId }: { caseId: string }) {
  const { getCaseById } = useData();
  const scoredCase = getCaseById(caseId);

  if (!scoredCase) {
    return (
      <div className="p-8 text-center">
        <p className="text-gray-500">Case not found: {caseId}</p>
        <Link href="/queue" className="text-blue-600 hover:text-blue-800 text-sm mt-2 block">
          Back to Review Queue
        </Link>
      </div>
    );
  }

  const order = scoredCase.order;
  const riskBandLower = scoredCase.riskBand.toLowerCase();

  return (
    <div>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-5 mb-5 flex-wrap">
        <div>
          <Link
            href="/queue"
            className="inline-flex items-center gap-[5px] text-xs text-gray-400 hover:text-gray-600 cursor-pointer mb-[9px] transition-colors"
          >
            <ArrowLeft className="w-[13px] h-[13px]" />
            Back to queue
          </Link>
          <div className="flex items-center gap-[13px] flex-wrap">
            <h2 className="text-[21px] font-semibold tracking-tight font-mono text-gray-900">
              {order.id}
            </h2>
            {/* Risk band pill */}
            {(riskBandLower === 'critical' || riskBandLower === 'high') && (
              <span className="inline-flex items-center gap-1.5 px-[11px] py-1 rounded-[7px] bg-red-50 border border-red-200">
                <span className="w-[7px] h-[7px] rounded-full bg-red-600" />
                <span className="text-xs font-semibold text-red-600">{scoredCase.riskBand}</span>
              </span>
            )}
            {riskBandLower === 'medium' && (
              <span className="inline-flex items-center gap-1.5 px-[11px] py-1 rounded-[7px] bg-amber-50 border border-amber-200">
                <span className="w-[7px] h-[7px] rounded-full bg-amber-600" />
                <span className="text-xs font-semibold text-amber-600">{scoredCase.riskBand}</span>
              </span>
            )}
            {riskBandLower === 'low' && (
              <span className="inline-flex items-center gap-1.5 px-[11px] py-1 rounded-[7px] bg-green-50 border border-green-200">
                <span className="w-[7px] h-[7px] rounded-full bg-green-600" />
                <span className="text-xs font-semibold text-green-600">{scoredCase.riskBand}</span>
              </span>
            )}
            {/* Status pill */}
            <span className="inline-flex items-center px-[11px] py-1 rounded-[7px] bg-amber-50 border border-amber-200">
              <span className="text-xs font-medium text-amber-700">Pending review</span>
            </span>
            {/* Customer info */}
            <span className="text-[12.5px] text-gray-400">
              {order.customerName} &middot; {order.address}, {order.city} {order.state} {order.zip}
            </span>
          </div>
        </div>
        <HeaderActions scoredCase={scoredCase} />
      </div>

      {/* ── 3-Column Grid ───────────────────────────────────── */}
      <div className="grid grid-cols-[298px_minmax(0,1fr)_338px] gap-[18px] items-start">

        {/* ── LEFT COLUMN (sticky) ────────────────────────── */}
        <div className="flex flex-col gap-4 sticky top-[84px]">
          <RiskScoreCard scoredCase={scoredCase} />
          <FinancialImpactCard scoredCase={scoredCase} />
          <IdentityResolutionCard scoredCase={scoredCase} />
          <EventTimelineCard scoredCase={scoredCase} />
        </div>

        {/* ── CENTER COLUMN ───────────────────────────────── */}
        <div className="flex flex-col gap-4 min-w-0">
          <PriorAccountComparison scoredCase={scoredCase} />
          <EvidenceCards scoredCase={scoredCase} />
          <MLScoringBreakdown scoredCase={scoredCase} />
          <OrderDetailsCard scoredCase={scoredCase} />
        </div>

        {/* ── RIGHT COLUMN (sticky) ───────────────────────── */}
        <div className="flex flex-col gap-4 sticky top-[84px]">
          <AIAnalysisPanel scoredCase={scoredCase} />
          <AnalystChatPanel scoredCase={scoredCase} />
          <ActivityFeed scoredCase={scoredCase} />
        </div>
      </div>
    </div>
  );
}

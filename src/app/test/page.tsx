'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useData } from '@/lib/data-context';
import type { Order, ScoredCase, Channel } from '@/lib/types';
import { normalizeAddress, normalizeName, formatCurrency, formatDate, formatPercent, evidenceTypeLabel, hashCode } from '@/lib/utils';
import {
  SearchCheck, RotateCcw, AlertTriangle, Shield,
  DollarSign, Fingerprint, Phone, Mail, CreditCard, Package, Hash,
  ChevronDown, ChevronUp, ArrowRight, User, MapPin, Calendar,
} from 'lucide-react';

// ── Channel Options ─────────────────────────────────────────────
const CHANNEL_OPTIONS: { value: Channel; label: string }[] = [
  { value: 'third_party_door_to_door', label: '3P Door-to-Door' },
  { value: 'third_party_retail', label: '3P Retail' },
  { value: 'third_party_telemarketing', label: '3P Telemarketing' },
  { value: 'internal_online', label: 'Internal Online' },
  { value: 'internal_call_center', label: 'Internal Call Center' },
  { value: 'retention', label: 'Retention' },
];

// ── Styled Input ────────────────────────────────────────────────
const fieldInputClass = 'w-full py-[9px] px-[11px] border border-[#e2e4ea] rounded-lg text-[13px] font-sans text-[#11131a] outline-none placeholder:text-[#aab0bd] focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand-soft)] transition-shadow';
const monoInputClass = `${fieldInputClass} font-mono`;
const selectClass = 'w-full py-[9px] px-[11px] border border-[#e2e4ea] rounded-lg text-[13px] font-sans text-[#11131a] outline-none bg-white appearance-none focus:border-[var(--brand)] focus:ring-[3px] focus:ring-[var(--brand-soft)] transition-shadow';

// ── Form Field Component ────────────────────────────────────────
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium text-[#6b7180] mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-[11px] text-[#9aa0ad] mt-1">{hint}</p>}
    </div>
  );
}

// ── Section Toggle ──────────────────────────────────────────────
function Section({ title, description, defaultOpen, children }: { title: string; description?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border border-[#ebedf2] rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#fafbfc] hover:bg-[#f3f4f7] transition-colors text-left"
      >
        <div>
          <p className="text-[13px] font-semibold text-[#11131a]">{title}</p>
          {description && <p className="text-[11.5px] text-[#8a90a0]">{description}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-[#8a90a0]" /> : <ChevronDown className="h-4 w-4 text-[#8a90a0]" />}
      </button>
      {open && <div className="p-4 space-y-3.5">{children}</div>}
    </div>
  );
}

// ── Default Form State ──────────────────────────────────────────
interface FormState {
  customerName: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  region: string;
  channel: Channel;
  agentCode: string;
  companyCode: string;
  companyName: string;
  orderDate: string;
  accountNumber: string;
  priorAccountNumber: string;
  disconnectDate: string;
  disconnectReason: string;
  priorBillAmount: string;
  newPromoBillAmount: string;
  promoName: string;
  commissionAmount: string;
  delinquentBalance: string;
  phoneHash: string;
  emailHash: string;
  paymentMethodHash: string;
  equipmentSerials: string;
}

// ── Prior Account Simulation State ─────────────────────────────
interface PriorAccountState {
  enabled: boolean;
  customerName: string;
  sameAddress: boolean;
  address: string;
  city: string;
  state: string;
  zip: string;
  disconnectDate: string;
  disconnectReason: string;
  accountNumber: string;
  delinquentBalance: string;
  // Shared signal toggles
  samePhone: boolean;
  samePayment: boolean;
  sameEmail: boolean;
  sameEquipment: boolean;
}

const EMPTY_FORM: FormState = {
  customerName: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  region: 'Southeast',
  channel: 'third_party_retail',
  agentCode: '',
  companyCode: '',
  companyName: '',
  orderDate: new Date().toISOString().split('T')[0],
  accountNumber: '',
  priorAccountNumber: '',
  disconnectDate: '',
  disconnectReason: '',
  priorBillAmount: '',
  newPromoBillAmount: '',
  promoName: '',
  commissionAmount: '150',
  delinquentBalance: '',
  phoneHash: '',
  emailHash: '',
  paymentMethodHash: '',
  equipmentSerials: '',
};

const EMPTY_PRIOR: PriorAccountState = {
  enabled: false,
  customerName: '',
  sameAddress: true,
  address: '',
  city: '',
  state: '',
  zip: '',
  disconnectDate: '',
  disconnectReason: 'Non-payment',
  accountNumber: '',
  delinquentBalance: '',
  samePhone: true,
  samePayment: true,
  sameEmail: false,
  sameEquipment: false,
};

// ── Example Presets (form + prior account) ─────────────────────
interface ExamplePreset {
  form: FormState;
  prior: PriorAccountState;
}

const EXAMPLE_SUSPICIOUS: ExamplePreset = {
  form: {
    customerName: 'Robert Martinez',
    address: '4521 Oak St',
    city: 'Charlotte',
    state: 'NC',
    zip: '28202',
    region: 'Southeast',
    channel: 'third_party_door_to_door',
    agentCode: 'PDS-007',
    companyCode: 'PDS',
    companyName: 'Premier Door Sales',
    orderDate: '2024-04-15',
    accountNumber: 'ACCT900000001',
    priorAccountNumber: 'ACCT800000055',
    disconnectDate: '2024-04-08',
    disconnectReason: 'Non-payment',
    priorBillAmount: '189',
    newPromoBillAmount: '49.99',
    promoName: 'New Connect $49.99/mo',
    commissionAmount: '195',
    delinquentBalance: '425',
    phoneHash: '',
    emailHash: '',
    paymentMethodHash: '',
    equipmentSerials: 'EQ887712,EQ991234',
  },
  prior: {
    enabled: true,
    customerName: 'Robert Martinez',
    sameAddress: true,
    address: '', city: '', state: '', zip: '',
    disconnectDate: '2024-04-08',
    disconnectReason: 'Non-payment',
    accountNumber: 'ACCT800000055',
    delinquentBalance: '425',
    samePhone: true,
    samePayment: true,
    sameEmail: true,
    sameEquipment: true,
  },
};

const EXAMPLE_FAKE_NAME: ExamplePreset = {
  form: {
    customerName: 'Maria Rodriguez',
    address: '269 24th St',
    city: 'Oakland',
    state: 'CA',
    zip: '94612',
    region: 'West',
    channel: 'third_party_door_to_door',
    agentCode: 'PDS-007',
    companyCode: 'PDS',
    companyName: 'Premier Door Sales',
    orderDate: '2024-04-15',
    accountNumber: 'ACCT900000099',
    priorAccountNumber: '',
    disconnectDate: '',
    disconnectReason: '',
    priorBillAmount: '',
    newPromoBillAmount: '49.99',
    promoName: 'New Connect $49.99/mo',
    commissionAmount: '195',
    delinquentBalance: '',
    phoneHash: '',
    emailHash: '',
    paymentMethodHash: '',
    equipmentSerials: '',
  },
  prior: {
    enabled: true,
    customerName: 'James Rodriguez',
    sameAddress: true,
    address: '', city: '', state: '', zip: '',
    disconnectDate: '2024-04-10',
    disconnectReason: 'Non-payment',
    accountNumber: 'ACCT800000066',
    delinquentBalance: '310',
    samePhone: true,
    samePayment: true,
    sameEmail: false,
    sameEquipment: false,
  },
};

const EXAMPLE_CLEAN: ExamplePreset = {
  form: {
    customerName: 'Sarah Thompson',
    address: '782 Birch Rd APT 4',
    city: 'Columbus',
    state: 'OH',
    zip: '43215',
    region: 'Midwest',
    channel: 'internal_online',
    agentCode: 'ONL-045',
    companyCode: 'ONL',
    companyName: 'Spectrum Online',
    orderDate: '2024-05-20',
    accountNumber: 'ACCT900000002',
    priorAccountNumber: '',
    disconnectDate: '',
    disconnectReason: '',
    priorBillAmount: '',
    newPromoBillAmount: '59.99',
    promoName: 'Triple Play Intro $59.99/mo',
    commissionAmount: '120',
    delinquentBalance: '',
    phoneHash: '',
    emailHash: '',
    paymentMethodHash: '',
    equipmentSerials: '',
  },
  prior: { ...EMPTY_PRIOR },
};

// ── Score Ring ──────────────────────────────────────────────────
function ScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 80 ? '#dc2626' : pct >= 60 ? '#ea580c' : pct >= 40 ? '#d97706' : '#16a34a';
  return (
    <div
      className="relative w-[78px] h-[78px] flex-none rounded-full"
      style={{ background: `conic-gradient(${color} 0 ${pct}%, #f1f2f5 ${pct}% 100%)` }}
    >
      <div className="absolute inset-[8px] bg-white rounded-full flex flex-col items-center justify-center">
        <span className="text-[23px] font-semibold font-mono" style={{ color }}>{score}</span>
        <span className="text-[8.5px] text-[#9aa0ad]">/ 100</span>
      </div>
    </div>
  );
}

// ── Risk label helpers ─────────────────────────────────────────
function riskBadgeConfig(band: string) {
  const b = band.toLowerCase();
  if (b === 'critical') return { bg: '#fef2f2', border: '#fbd5d5', dot: '#dc2626', text: '#dc2626', label: 'Critical risk' };
  if (b === 'high')     return { bg: '#fff7ed', border: '#fcdcc0', dot: '#ea580c', text: '#c2410c', label: 'High risk' };
  if (b === 'medium')   return { bg: '#fffbeb', border: '#fbe6bd', dot: '#d97706', text: '#b45309', label: 'Medium risk' };
  return                       { bg: '#f0fdf4', border: '#c4ebcf', dot: '#16a34a', text: '#15803d', label: 'Low risk' };
}

// ── Layer Contribution Bars ────────────────────────────────────
function layerContributions(result: ScoredCase) {
  const colorForConf = (c: number) => c >= 0.8 ? '#dc2626' : c >= 0.6 ? '#ea580c' : c >= 0.4 ? '#d97706' : '#16a34a';
  const byType = new Map<string, { totalWeight: number; maxConf: number }>();
  for (const e of result.evidence) {
    const existing = byType.get(e.type);
    if (!existing || e.confidence * e.weight > existing.maxConf * existing.totalWeight) {
      byType.set(e.type, { totalWeight: e.weight, maxConf: e.confidence });
    }
  }
  const entries = [...byType.entries()]
    .sort((a, b) => b[1].maxConf * b[1].totalWeight - a[1].maxConf * a[1].totalWeight)
    .slice(0, 5);
  return entries.map(([type, { maxConf }]) => ({
    name: evidenceTypeLabel(type),
    score: Math.round(maxConf * 100),
    barWidth: `${Math.round(maxConf * 100)}%`,
    color: colorForConf(maxConf),
  }));
}

// ── Results Display ─────────────────────────────────────────────
function ResultsPanel({ result, onReset }: { result: ScoredCase; onReset: () => void }) {
  const { assumptions } = useData();
  const order = result.order;
  const badge = riskBadgeConfig(result.riskBand);
  const layers = layerContributions(result);

  return (
    <div>
      {/* Score header */}
      <div className="flex items-center gap-4 pb-[18px] border-b border-[#f1f2f5]">
        <ScoreRing score={result.riskScore} />
        <div>
          <span
            className="inline-flex items-center gap-1.5 py-[3px] px-[10px] rounded-[7px] border text-[12px] font-semibold"
            style={{ background: badge.bg, borderColor: badge.border, color: badge.text }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: badge.dot }} />
            {badge.label}
          </span>
          <p className="mt-2 text-[13px] text-[#4b5161] leading-relaxed max-w-[230px]">
            {result.analystSummary || result.recommendedAction}
          </p>
        </div>
      </div>

      {/* Layer contribution bars */}
      {layers.length > 0 && (
        <div className="mt-[18px]">
          <p className="mb-3 text-[12px] font-semibold tracking-[.04em] uppercase text-[#8a90a0]">Layer contribution</p>
          <div className="flex flex-col gap-[13px]">
            {layers.map((m, i) => (
              <div key={i}>
                <div className="flex items-center justify-between mb-[5px]">
                  <span className="text-[12.5px] font-medium text-[#3b4150]">{m.name}</span>
                  <span className="text-[12.5px] font-semibold font-mono" style={{ color: m.color }}>{m.score}</span>
                </div>
                <div className="h-1.5 bg-[#f1f2f5] rounded overflow-hidden">
                  <div className="h-full rounded" style={{ width: m.barWidth, background: m.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Run another link */}
      <button
        onClick={onReset}
        className="mt-[18px] w-full text-center text-[12.5px] text-[#8a90a0] hover:text-[#4b5161] cursor-pointer transition-colors"
      >
        Run another &rarr;
      </button>

      {/* Detailed tabs below the summary card */}
      <div className="mt-5 border-t border-[#f1f2f5] pt-5">
        <Tabs defaultValue="evidence">
          <TabsList>
            <TabsTrigger value="evidence">Evidence ({result.evidence.length})</TabsTrigger>
            <TabsTrigger value="identity">Identity</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          <TabsContent value="evidence">
            <div className="space-y-4">
              {/* Prior Account Comparison */}
              {(() => {
                const addrEvidence = result.evidence.find(e => e.type === 'address_disconnect_reuse');
                const payEvidence = result.evidence.find(e => e.type === 'payment_method_reuse');
                const phoneEvidence = result.evidence.find(e => e.type === 'phone_reuse');
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

                return (
                  <Card className="border-red-200 bg-red-50/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <User className="h-4 w-4 text-red-600" />
                        Prior Account Comparison
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Disconnected account linked to this new order by address, payment method, or phone
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                        <div className="bg-white rounded-lg border border-red-200 p-3 space-y-2">
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-wider">Disconnected Account</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className={`text-sm font-semibold ${nameChanged ? 'text-red-700' : 'text-gray-900'}`}>{priorName}</span>
                            </div>
                            {priorAddress && (
                              <div className="flex items-start gap-2">
                                <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                                <span className="text-xs text-gray-700">{priorAddress}{priorCity ? `, ${priorCity}` : ''}{priorState ? `, ${priorState}` : ''} {priorZip || ''}</span>
                              </div>
                            )}
                            {priorAcctNum && (
                              <div className="flex items-center gap-2">
                                <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="text-xs font-mono text-gray-600">{priorAcctNum}</span>
                              </div>
                            )}
                            {priorDisconnectDate && (
                              <div className="flex items-center gap-2">
                                <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                                <span className="text-xs text-gray-600">Disconnected {formatDate(priorDisconnectDate)}{priorDisconnectReason ? ` (${priorDisconnectReason})` : ''}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-center pt-8">
                          <ArrowRight className="h-5 w-5 text-red-400" />
                        </div>
                        <div className="bg-white rounded-lg border border-orange-200 p-3 space-y-2">
                          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">New Order</p>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className={`text-sm font-semibold ${nameChanged ? 'text-orange-700' : 'text-gray-900'}`}>{order.customerName}</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
                              <span className="text-xs text-gray-700">{order.address}, {order.city}, {order.state} {order.zip}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Hash className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs font-mono text-gray-600">{order.accountNumber}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-3 w-3 text-gray-400 flex-shrink-0" />
                              <span className="text-xs text-gray-600">Ordered {formatDate(order.orderDate)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {nameChanged && (
                        <div className="mt-3 p-2 bg-red-100 border border-red-200 rounded-lg flex items-start gap-2">
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-red-800">
                            <span className="font-semibold">Different name at the same address.</span> The prior account under &ldquo;{priorName}&rdquo; was disconnected, and this new order under &ldquo;{order.customerName}&rdquo; shares the same payment method and/or phone number.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Evidence Signals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base"><Shield className="h-4 w-4" /> Evidence Signals</CardTitle>
                </CardHeader>
                <CardContent>
                  {result.evidence.length === 0 ? (
                    <div className="text-center py-6">
                      <p className="text-sm text-[#4b5161]">No suspicious evidence detected.</p>
                      <p className="text-xs text-[#9aa0ad] mt-1">This order appears clean based on available signals.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {[...result.evidence]
                        .sort((a, b) => b.confidence * b.weight - a.confidence * a.weight)
                        .map((e, idx) => {
                        const hiddenKeys = new Set([
                          'closestDisconnectName', 'closestDisconnectAddress', 'closestDisconnectCity',
                          'closestDisconnectState', 'closestDisconnectZip', 'closestDisconnectAccountNumber',
                          'closestDisconnectReason', 'closestDisconnectOrderId',
                          'priorAccountName', 'priorAccountAddress', 'priorAccountCity',
                          'priorAccountState', 'priorAccountZip', 'priorAccountNumber',
                          'priorDisconnectDate', 'priorDisconnectReason', 'priorOrderId',
                        ]);
                        const visibleDetails = Object.entries(e.details).filter(([key]) => !hiddenKeys.has(key));

                        return (
                          <div key={idx} className="border border-[#ebedf2] rounded-[11px] p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-[12.5px] text-[#3b4150]">{evidenceTypeLabel(e.type)}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-[#8a90a0]">Confidence: {Math.round(e.confidence * 100)}%</span>
                                <span className="text-[11px] text-[#8a90a0]">Weight: {Math.round(e.weight * 100)}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-[#f1f2f5] rounded-full h-1.5 mb-2">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${e.confidence * 100}%`,
                                  background: e.confidence >= 0.8 ? '#dc2626' : e.confidence >= 0.6 ? '#ea580c' : '#d97706',
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-1">
                              {visibleDetails.map(([key, value]) => (
                                <div key={key} className="text-[11px]">
                                  <span className="text-[#8a90a0]">{key}: </span>
                                  <span className="text-[#4b5161]">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Fingerprint className="h-4 w-4" /> Identity Resolution</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const signals = order.identitySignals;
                  const matchedSignals = new Set<string>();
                  const matchSources = new Map<string, string>();

                  const identityEvidence = result.evidence.find(e => e.type === 'identity_match');
                  if (identityEvidence) {
                    for (const s of (identityEvidence.details.matchedSignals as string[]) || []) {
                      matchedSignals.add(s);
                      matchSources.set(s, 'Identity Match');
                    }
                  }
                  if (result.evidence.find(e => e.type === 'payment_method_reuse')) {
                    matchedSignals.add('paymentMethodHash');
                    if (!matchSources.has('paymentMethodHash')) matchSources.set('paymentMethodHash', 'Payment Method Reuse');
                  }
                  if (result.evidence.find(e => e.type === 'phone_reuse')) {
                    matchedSignals.add('phoneHash');
                    if (!matchSources.has('phoneHash')) matchSources.set('phoneHash', 'Phone Reuse');
                  }

                  const effectiveCount = matchedSignals.size;
                  const confidenceLabel = effectiveCount >= 3 ? 'high' : effectiveCount >= 2 ? 'medium' : effectiveCount >= 1 ? 'low' : 'none';

                  const entries = [
                    { icon: <Phone className="h-3 w-3" />, label: 'Phone', key: 'phoneHash', value: signals.phoneHash },
                    { icon: <Mail className="h-3 w-3" />, label: 'Email', key: 'emailHash', value: signals.emailHash },
                    { icon: <CreditCard className="h-3 w-3" />, label: 'Payment', key: 'paymentMethodHash', value: signals.paymentMethodHash },
                    { icon: <Package className="h-3 w-3" />, label: 'Equipment', key: 'equipmentSerialHistory', value: signals.equipmentSerialHistory?.join(', ') },
                  ];

                  return (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-[#6b7180]">{effectiveCount} of 5 signals matched —</span>
                        <Badge variant={confidenceLabel === 'high' ? 'critical' : confidenceLabel === 'medium' ? 'medium' : confidenceLabel === 'low' ? 'low' : 'outline'}>
                          {confidenceLabel} confidence
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {entries.map((s, idx) => {
                          const matched = matchedSignals.has(s.key);
                          const source = matchSources.get(s.key);
                          return (
                            <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${matched ? 'bg-red-50 border border-red-200' : 'bg-[#fafbfc]'}`}>
                              <div className={matched ? 'text-red-600' : 'text-[#9aa0ad]'}>{s.icon}</div>
                              <span className="w-20 text-[#6b7180] font-medium">{s.label}</span>
                              <span className="font-mono text-xs text-[#8a90a0] flex-1 truncate">{s.value || '—'}</span>
                              {matched && (
                                <div className="flex items-center gap-1.5">
                                  <Badge variant="critical">Match</Badge>
                                  {source && <span className="text-[10px] text-red-500">{source}</span>}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><DollarSign className="h-4 w-4" /> Financial Impact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="border border-[#fbd5d5] bg-[#fef2f2] rounded-[11px] p-3.5">
                    <p className="text-[22px] font-semibold font-mono text-[#dc2626]">{formatCurrency(result.commissionAtRisk)}</p>
                    <p className="text-[12px] text-[#4b5161] mt-1">Commission at Risk</p>
                  </div>
                  <div className="border border-[#fbe6bd] bg-[#fffbeb] rounded-[11px] p-3.5">
                    <p className="text-[22px] font-semibold font-mono text-[#b45309]">{formatCurrency(result.mrrLoss)}</p>
                    <p className="text-[12px] text-[#4b5161] mt-1">MRR Loss /mo</p>
                  </div>
                  <div className="border border-[#eceef2] bg-[#fafbfc] rounded-[11px] p-3.5">
                    <p className="text-[22px] font-semibold font-mono text-[#11131a]">{formatCurrency(result.annualizedExposure)}</p>
                    <p className="text-[12px] text-[#4b5161] mt-1">Annualized</p>
                  </div>
                </div>
                <div className="text-xs text-[#8a90a0] font-mono bg-[#fafbfc] p-3 rounded-lg space-y-1">
                  <p>Commission at risk = {formatCurrency(order.commissionAmount)} x (1 - {formatPercent(assumptions.recoveryProbability)}) = {formatCurrency(result.commissionAtRisk)}</p>
                  <p>MRR loss = ({formatCurrency(order.priorBillAmount || assumptions.avgMonthlyBill)} - {formatCurrency(order.newPromoBillAmount || assumptions.avgPromoBill)}) x {formatPercent(assumptions.recoveryProbability)} = {formatCurrency(result.mrrLoss)}</p>
                  <p>Annualized = {formatCurrency(result.mrrLoss)} x {assumptions.annualizationMonths} = {formatCurrency(result.annualizedExposure)}</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ── Shared Signal Toggle ───────────────────────────────────────
function SignalToggle({ label, icon, checked, onChange }: { label: string; icon: React.ReactNode; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors ${checked ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="rounded border-gray-300 text-red-600 focus:ring-red-500" />
      <span className={checked ? 'text-red-600' : 'text-gray-400'}>{icon}</span>
      <span className={`text-sm ${checked ? 'text-red-800 font-medium' : 'text-gray-600'}`}>{label}</span>
    </label>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function TestOrderPage() {
  const { testOrder } = useData();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [prior, setPrior] = useState<PriorAccountState>(EMPTY_PRIOR);
  const [result, setResult] = useState<ScoredCase | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const update = useCallback((field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const updatePrior = useCallback((field: keyof PriorAccountState, value: string | boolean) => {
    setPrior(prev => ({ ...prev, [field]: value }));
  }, []);

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.customerName.trim()) errs.push('Customer name is required');
    if (!form.address.trim()) errs.push('Address is required');
    if (!form.city.trim()) errs.push('City is required');
    if (!form.state.trim()) errs.push('State is required');
    if (!form.zip.trim()) errs.push('ZIP code is required');
    if (!form.orderDate) errs.push('Order date is required');
    return errs;
  };

  const handleScore = () => {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);

    // Build the Order object from form state
    const daysSinceDisconnect = form.disconnectDate && form.orderDate
      ? Math.round((new Date(form.orderDate).getTime() - new Date(form.disconnectDate).getTime()) / 86400000)
      : undefined;

    const nameBase = hashCode(form.customerName);
    const orderPhoneHash = form.phoneHash || `ph_${nameBase.slice(0, 8)}`;
    const orderEmailHash = form.emailHash || `em_${nameBase.slice(0, 8)}`;
    const orderPaymentHash = form.paymentMethodHash || `pm_${nameBase.slice(0, 8)}`;
    const orderEquipment = form.equipmentSerials
      ? form.equipmentSerials.split(',').map(s => s.trim()).filter(Boolean)
      : [`EQ${Date.now().toString().slice(-6)}`];

    const order: Order = {
      id: `TEST-${Date.now().toString(36).toUpperCase()}`,
      orderDate: form.orderDate,
      customerName: form.customerName,
      normalizedName: normalizeName(form.customerName),
      address: form.address,
      normalizedAddress: normalizeAddress(form.address),
      city: form.city,
      state: form.state,
      zip: form.zip,
      region: form.region,
      channel: form.channel,
      agentCode: form.agentCode || 'UNKNOWN',
      companyCode: form.companyCode || 'UNK',
      companyName: form.companyName || 'Unknown',
      accountNumber: form.accountNumber || `ACCT${Date.now()}`,
      priorAccountNumber: form.priorAccountNumber || undefined,
      priorBillAmount: form.priorBillAmount ? parseFloat(form.priorBillAmount) : undefined,
      newPromoBillAmount: form.newPromoBillAmount ? parseFloat(form.newPromoBillAmount) : undefined,
      promoName: form.promoName || undefined,
      disconnectDate: form.disconnectDate || undefined,
      disconnectReason: form.disconnectReason || undefined,
      daysSinceDisconnect,
      delinquentBalance: form.delinquentBalance ? parseFloat(form.delinquentBalance) : undefined,
      equipmentSerials: form.equipmentSerials ? form.equipmentSerials.split(',').map(s => s.trim()).filter(Boolean) : undefined,
      commissionAmount: parseFloat(form.commissionAmount) || 150,
      monthlyRecurring: form.newPromoBillAmount ? parseFloat(form.newPromoBillAmount) : 49.99,
      identitySignals: {
        phoneHash: orderPhoneHash,
        emailHash: orderEmailHash,
        paymentMethodHash: orderPaymentHash,
        equipmentSerialHistory: orderEquipment,
      },
      _isFraud: false,
      _archetype: undefined,
      _legitEdgeCase: undefined,
    };

    // Build companion prior account order if enabled
    let companionOrders: Order[] | undefined;
    if (prior.enabled && prior.customerName && prior.disconnectDate) {
      const priorNameBase = hashCode(prior.customerName);
      const priorAddr = prior.sameAddress
        ? { address: form.address, normalizedAddress: normalizeAddress(form.address), city: form.city, state: form.state, zip: form.zip }
        : { address: prior.address, normalizedAddress: normalizeAddress(prior.address), city: prior.city, state: prior.state, zip: prior.zip };

      const companionOrder: Order = {
        id: `PRIOR-${Date.now().toString(36).toUpperCase()}`,
        orderDate: new Date(new Date(prior.disconnectDate).getTime() - 90 * 86400000).toISOString().split('T')[0],
        customerName: prior.customerName,
        normalizedName: normalizeName(prior.customerName),
        ...priorAddr,
        region: form.region,
        channel: 'internal_call_center',
        agentCode: 'INT-000',
        companyCode: 'INT',
        companyName: 'Spectrum Internal',
        accountNumber: prior.accountNumber || `ACCT${Date.now() - 1}`,
        disconnectDate: prior.disconnectDate,
        disconnectReason: prior.disconnectReason || 'Non-payment',
        daysSinceDisconnect: 0,
        delinquentBalance: prior.delinquentBalance ? parseFloat(prior.delinquentBalance) : undefined,
        commissionAmount: 0,
        monthlyRecurring: 120,
        identitySignals: {
          phoneHash: prior.samePhone ? orderPhoneHash : `ph_${priorNameBase.slice(0, 8)}`,
          emailHash: prior.sameEmail ? orderEmailHash : `em_${priorNameBase.slice(0, 8)}`,
          paymentMethodHash: prior.samePayment ? orderPaymentHash : `pm_${priorNameBase.slice(0, 8)}`,
          equipmentSerialHistory: prior.sameEquipment ? orderEquipment : [`EQ${Date.now().toString().slice(-6)}X`],
        },
        _isFraud: false,
        _isCompanion: true,
        _archetype: undefined,
        _legitEdgeCase: undefined,
      };
      companionOrders = [companionOrder];
    }

    const scored = testOrder(order, companionOrders);
    setResult(scored);
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setPrior(EMPTY_PRIOR);
    setResult(null);
    setErrors([]);
  };

  const loadExample = (example: ExamplePreset) => {
    setForm(example.form);
    setPrior(example.prior);
    setResult(null);
    setErrors([]);
  };

  return (
    <div className="space-y-5">
      {/* Quick-fill row */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11.5px] text-[#8a90a0]">Quick fill:</span>
        <Button variant="outline" size="sm" onClick={() => loadExample(EXAMPLE_SUSPICIOUS)}>
          Suspicious Example
        </Button>
        <Button variant="outline" size="sm" onClick={() => loadExample(EXAMPLE_FAKE_NAME)}>
          Fake Name Example
        </Button>
        <Button variant="outline" size="sm" onClick={() => loadExample(EXAMPLE_CLEAN)}>
          Clean Example
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px] items-start">
        {/* ── Left: Order Details Card ──────────────────── */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)]">
          <p className="text-[14px] font-semibold text-[#11131a] tracking-[-0.01em] mb-1">Order details</p>
          <p className="text-[12.5px] text-[#8a90a0] mb-[18px]">Submit a hypothetical order to see how it scores.</p>

          <div className="flex flex-col gap-3.5">
            {errors.length > 0 && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                {errors.map((e, i) => (
                  <p key={i} className="text-[12.5px] text-red-700">{e}</p>
                ))}
              </div>
            )}

            {/* Customer name — full width */}
            <Field label="Customer name" required>
              <input value={form.customerName} onChange={e => update('customerName', e.target.value)} placeholder="John Smith" className={fieldInputClass} />
            </Field>

            {/* Address / City / ZIP — 3 col */}
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-[10px]">
              <Field label="Address" required>
                <input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Oak St" className={fieldInputClass} />
              </Field>
              <Field label="City" required>
                <input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Charlotte" className={fieldInputClass} />
              </Field>
              <Field label="ZIP" required>
                <input value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="28202" className={monoInputClass} />
              </Field>
            </div>

            {/* Channel + Agent code — 2 col */}
            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Channel">
                <select value={form.channel} onChange={e => update('channel', e.target.value)} className={selectClass}>
                  {CHANNEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="Agent code">
                <input value={form.agentCode} onChange={e => update('agentCode', e.target.value)} placeholder="PDS-007" className={monoInputClass} />
              </Field>
            </div>

            {/* Prior account # + Disconnect date — 2 col */}
            <div className="grid grid-cols-2 gap-[10px]">
              <Field label="Prior account #">
                <input value={form.priorAccountNumber} onChange={e => update('priorAccountNumber', e.target.value)} placeholder="ACCT..." className={monoInputClass} />
              </Field>
              <Field label="Disconnect date">
                <input type="date" value={form.disconnectDate} onChange={e => update('disconnectDate', e.target.value)} className={monoInputClass} />
              </Field>
            </div>

            {/* Run fraud check button */}
            <button
              onClick={handleScore}
              className="mt-1 flex items-center justify-center gap-2 py-[11px] rounded-[10px] bg-[var(--brand)] text-white text-[13.5px] font-semibold cursor-pointer shadow-[0_4px_14px_-4px_var(--brand)] hover:bg-[var(--brand-d)] transition-colors"
            >
              <SearchCheck className="h-[15px] w-[15px]" />
              Run fraud check
            </button>

            {/* Collapsible advanced sections */}
            <div className="mt-1 space-y-3">
              <Section title="State & Region" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="State" required>
                    <input value={form.state} onChange={e => update('state', e.target.value)} placeholder="NC" maxLength={2} className={fieldInputClass} />
                  </Field>
                  <Field label="Region">
                    <select value={form.region} onChange={e => update('region', e.target.value)} className={selectClass}>
                      {['Northeast','Southeast','Midwest','West','Southwest'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                </div>
              </Section>

              <Section title="Dates & Disconnect" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Date" required>
                    <input type="date" value={form.orderDate} onChange={e => update('orderDate', e.target.value)} className={monoInputClass} />
                  </Field>
                  <Field label="Disconnect Reason">
                    <select value={form.disconnectReason} onChange={e => update('disconnectReason', e.target.value)} className={selectClass}>
                      <option value="">-- None --</option>
                      {['Non-payment','Customer request','Seasonal','Moved','Service issue','Price'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Account Number">
                    <input value={form.accountNumber} onChange={e => update('accountNumber', e.target.value)} placeholder="ACCT..." className={monoInputClass} />
                  </Field>
                  <Field label="Delinquent Balance ($)">
                    <input type="number" value={form.delinquentBalance} onChange={e => update('delinquentBalance', e.target.value)} placeholder="0" className={monoInputClass} />
                  </Field>
                </div>
              </Section>

              <Section title="Company Info" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company Code" hint="e.g. PDS">
                    <input value={form.companyCode} onChange={e => update('companyCode', e.target.value)} placeholder="PDS" className={fieldInputClass} />
                  </Field>
                  <Field label="Company Name">
                    <input value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Premier Door Sales" className={fieldInputClass} />
                  </Field>
                </div>
              </Section>

              <Section title="Billing & Commission" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prior Bill ($/mo)">
                    <input type="number" value={form.priorBillAmount} onChange={e => update('priorBillAmount', e.target.value)} placeholder="120" className={monoInputClass} />
                  </Field>
                  <Field label="New Promo Bill ($/mo)">
                    <input type="number" value={form.newPromoBillAmount} onChange={e => update('newPromoBillAmount', e.target.value)} placeholder="49.99" className={monoInputClass} />
                  </Field>
                  <Field label="Promo Name">
                    <input value={form.promoName} onChange={e => update('promoName', e.target.value)} placeholder="New Connect $49.99/mo" className={fieldInputClass} />
                  </Field>
                  <Field label="Commission ($)">
                    <input type="number" value={form.commissionAmount} onChange={e => update('commissionAmount', e.target.value)} placeholder="150" className={monoInputClass} />
                  </Field>
                </div>
              </Section>

              <Section title="Identity Signals" description="Optional -- auto-generated if left blank" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Hash">
                    <input value={form.phoneHash} onChange={e => update('phoneHash', e.target.value)} placeholder="Auto-generated" className={`${monoInputClass} text-xs`} />
                  </Field>
                  <Field label="Email Hash">
                    <input value={form.emailHash} onChange={e => update('emailHash', e.target.value)} placeholder="Auto-generated" className={`${monoInputClass} text-xs`} />
                  </Field>
                  <Field label="Payment Method Hash">
                    <input value={form.paymentMethodHash} onChange={e => update('paymentMethodHash', e.target.value)} placeholder="Auto-generated" className={`${monoInputClass} text-xs`} />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Equipment Serials" hint="Comma-separated.">
                      <input value={form.equipmentSerials} onChange={e => update('equipmentSerials', e.target.value)} placeholder="EQ123456, EQ789012" className={`${monoInputClass} text-xs`} />
                    </Field>
                  </div>
                </div>
              </Section>

              {/* ── Prior Account Simulation ─────────────────── */}
              <Section
                title="Prior Account (Demo Simulation)"
                description="Simulate a disconnected account to show how cross-referencing works"
                defaultOpen={prior.enabled}
              >
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    This creates a simulated prior account in the scoring pool. Toggle the shared signals below to control which
                    identity markers match between the old and new account.
                  </p>
                </div>

                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prior.enabled}
                    onChange={e => updatePrior('enabled', e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-[13px] font-medium text-[#11131a]">Enable prior account simulation</span>
                </label>

                {prior.enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Prior Customer Name" required hint="Use a different name to test fake-name detection">
                          <input value={prior.customerName} onChange={e => updatePrior('customerName', e.target.value)} placeholder="e.g. James Rodriguez" className={fieldInputClass} />
                        </Field>
                      </div>
                      <Field label="Disconnect Date" required>
                        <input type="date" value={prior.disconnectDate} onChange={e => updatePrior('disconnectDate', e.target.value)} className={monoInputClass} />
                      </Field>
                      <Field label="Disconnect Reason">
                        <select value={prior.disconnectReason} onChange={e => updatePrior('disconnectReason', e.target.value)} className={selectClass}>
                          {['Non-payment','Customer request','Seasonal','Moved','Service issue','Price'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Prior Account #">
                        <input value={prior.accountNumber} onChange={e => updatePrior('accountNumber', e.target.value)} placeholder="ACCT..." className={monoInputClass} />
                      </Field>
                      <Field label="Delinquent Balance ($)">
                        <input type="number" value={prior.delinquentBalance} onChange={e => updatePrior('delinquentBalance', e.target.value)} placeholder="0" className={monoInputClass} />
                      </Field>
                    </div>

                    <div className="border border-[#ebedf2] rounded-lg p-3">
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prior.sameAddress}
                          onChange={e => updatePrior('sameAddress', e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-[13px] font-medium text-[#11131a]">Same service address as new order</span>
                      </label>
                      {!prior.sameAddress && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div className="col-span-2">
                            <Field label="Prior Address">
                              <input value={prior.address} onChange={e => updatePrior('address', e.target.value)} placeholder="123 Main St" className={fieldInputClass} />
                            </Field>
                          </div>
                          <Field label="City">
                            <input value={prior.city} onChange={e => updatePrior('city', e.target.value)} className={fieldInputClass} />
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="State">
                              <input value={prior.state} onChange={e => updatePrior('state', e.target.value)} maxLength={2} className={fieldInputClass} />
                            </Field>
                            <Field label="ZIP">
                              <input value={prior.zip} onChange={e => updatePrior('zip', e.target.value)} className={fieldInputClass} />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-[11px] font-semibold text-[#6b7180] uppercase tracking-[.04em] mb-2">Shared Signals</p>
                      <p className="text-[11.5px] text-[#8a90a0] mb-3">Check which identity markers the prior account shares with the new order.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <SignalToggle label="Same Phone" icon={<Phone className="h-3.5 w-3.5" />} checked={prior.samePhone} onChange={v => updatePrior('samePhone', v)} />
                        <SignalToggle label="Same Payment Method" icon={<CreditCard className="h-3.5 w-3.5" />} checked={prior.samePayment} onChange={v => updatePrior('samePayment', v)} />
                        <SignalToggle label="Same Email" icon={<Mail className="h-3.5 w-3.5" />} checked={prior.sameEmail} onChange={v => updatePrior('sameEmail', v)} />
                        <SignalToggle label="Same Equipment" icon={<Package className="h-3.5 w-3.5" />} checked={prior.sameEquipment} onChange={v => updatePrior('sameEquipment', v)} />
                      </div>
                    </div>
                  </div>
                )}
              </Section>
            </div>
          </div>
        </div>

        {/* ── Right: Score Report Card ──────────────────── */}
        <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)] min-h-[300px]">
          {result ? (
            <ResultsPanel result={result} onReset={handleReset} />
          ) : (
            <div className="h-full min-h-[260px] flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-[13px] bg-[var(--brand-soft)] flex items-center justify-center mb-3.5">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="14" x2="15" y2="14"/><line x1="9" y1="18" x2="13" y2="18"/></svg>
              </div>
              <p className="text-[14px] font-semibold text-[#11131a]">Score report</p>
              <p className="mt-1.5 text-[12.5px] text-[#9aa0ad] max-w-[240px] leading-relaxed">
                Fill in the order and run the check -- results appear here as a scored report.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

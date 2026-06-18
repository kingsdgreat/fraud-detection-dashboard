'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge, RiskBadge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { Order, ScoredCase, Channel } from '@/lib/types';
import { normalizeAddress, normalizeName, formatCurrency, formatDate, formatPercent, evidenceTypeLabel, hashCode } from '@/lib/utils';
import {
  SearchCheck, Play, RotateCcw, AlertTriangle, Shield, Loader2,
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

// ── Financial Assumptions (matching engine defaults) ────────────
const ASSUMPTIONS = {
  avgCommission: 150,
  recoveryProbability: 0.15,
  avgMonthlyBill: 120,
  avgPromoBill: 49.99,
  annualizationMonths: 12,
};

// ── Form Field Component ────────────────────────────────────────
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ── Section Toggle ──────────────────────────────────────────────
function Section({ title, description, defaultOpen, children }: { title: string; description?: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div>
          <p className="text-sm font-semibold text-gray-800">{title}</p>
          {description && <p className="text-xs text-gray-500">{description}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
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

// ── Example Presets ─────────────────────────────────────────────
const EXAMPLE_SUSPICIOUS: FormState = {
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
};

const EXAMPLE_CLEAN: FormState = {
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
};

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
  samePhone: boolean;
  samePayment: boolean;
  sameEmail: boolean;
  sameEquipment: boolean;
}

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

interface ExamplePreset {
  form: FormState;
  prior: PriorAccountState;
}

const PRESET_SUSPICIOUS: ExamplePreset = {
  form: EXAMPLE_SUSPICIOUS,
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

const PRESET_FAKE_NAME: ExamplePreset = {
  form: {
    ...EXAMPLE_SUSPICIOUS,
    customerName: 'Maria Rodriguez',
    address: '269 24th St',
    city: 'Oakland',
    state: 'CA',
    zip: '94612',
    region: 'West',
    accountNumber: 'ACCT900000099',
    priorAccountNumber: '',
    disconnectDate: '',
    disconnectReason: '',
    delinquentBalance: '',
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

const PRESET_CLEAN: ExamplePreset = {
  form: EXAMPLE_CLEAN,
  prior: { ...EMPTY_PRIOR },
};

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

// ── Results Display ─────────────────────────────────────────────
function ResultsPanel({ result }: { result: ScoredCase }) {
  const order = result.order;

  return (
    <div className="space-y-4">
      {/* Risk Header */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-200">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <RiskBadge band={result.riskBand} />
            <span className="text-2xl font-bold text-gray-900">Score: {result.riskScore}</span>
          </div>
          <p className="text-sm text-gray-600">{result.recommendedAction}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Commission at Risk</p>
          <p className="text-lg font-bold text-red-700">{formatCurrency(result.commissionAtRisk)}</p>
        </div>
      </div>

      {/* Analyst Summary */}
      <Card className="border-l-4 border-l-orange-400">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-gray-900 mb-1">Analyst Summary</p>
              <p className="text-sm text-gray-700">{result.analystSummary}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Details */}
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
                      {/* Prior Account */}
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

                      {/* Arrow */}
                      <div className="flex items-center justify-center pt-8">
                        <ArrowRight className="h-5 w-5 text-red-400" />
                      </div>

                      {/* New Order */}
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
                          <span className="font-semibold">Different name at the same address.</span> The prior account was disconnected, and this new order shares the same payment method and/or phone number.
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
                    <p className="text-sm text-gray-500">No suspicious evidence detected.</p>
                    <p className="text-xs text-gray-400 mt-1">This order appears clean based on available signals.</p>
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
                        <div key={idx} className="border border-gray-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{evidenceTypeLabel(e.type)}</span>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Confidence: {Math.round(e.confidence * 100)}%</span>
                              <span className="text-xs text-gray-500">Weight: {Math.round(e.weight * 100)}%</span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 mb-2">
                            <div
                              className={`h-full rounded-full ${e.confidence >= 0.8 ? 'bg-red-500' : e.confidence >= 0.6 ? 'bg-orange-500' : 'bg-yellow-500'}`}
                              style={{ width: `${e.confidence * 100}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1">
                            {visibleDetails.map(([key, value]) => (
                              <div key={key} className="text-xs">
                                <span className="text-gray-500">{key}: </span>
                                <span className="text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
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
                      <span className="text-gray-600">{effectiveCount} of 5 signals matched —</span>
                      <Badge variant={confidenceLabel === 'high' ? 'critical' : confidenceLabel === 'medium' ? 'medium' : confidenceLabel === 'low' ? 'low' : 'outline'}>
                        {confidenceLabel} confidence
                      </Badge>
                    </div>
                    <div className="space-y-2">
                      {entries.map((s, idx) => {
                        const matched = matchedSignals.has(s.key);
                        const source = matchSources.get(s.key);
                        return (
                          <div key={idx} className={`flex items-center gap-3 p-2 rounded-lg text-sm ${matched ? 'bg-red-50 border border-red-200' : 'bg-gray-50'}`}>
                            <div className={matched ? 'text-red-600' : 'text-gray-400'}>{s.icon}</div>
                            <span className="w-20 text-gray-600 font-medium">{s.label}</span>
                            <span className="font-mono text-xs text-gray-500 flex-1 truncate">{s.value || '—'}</span>
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
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Commission at Risk</p>
                  <p className="text-xl font-bold text-red-700">{formatCurrency(result.commissionAtRisk)}</p>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">MRR Loss</p>
                  <p className="text-xl font-bold text-orange-700">{formatCurrency(result.mrrLoss)}/mo</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Annualized</p>
                  <p className="text-xl font-bold text-purple-700">{formatCurrency(result.annualizedExposure)}</p>
                </div>
              </div>
              <div className="text-xs text-gray-500 font-mono bg-gray-50 p-3 rounded-lg space-y-1">
                <p>Commission at risk = {formatCurrency(order.commissionAmount)} x (1 - {formatPercent(ASSUMPTIONS.recoveryProbability)}) = {formatCurrency(result.commissionAtRisk)}</p>
                <p>MRR loss = ({formatCurrency(order.priorBillAmount || ASSUMPTIONS.avgMonthlyBill)} - {formatCurrency(order.newPromoBillAmount || ASSUMPTIONS.avgPromoBill)}) x {formatPercent(ASSUMPTIONS.recoveryProbability)} = {formatCurrency(result.mrrLoss)}</p>
                <p>Annualized = {formatCurrency(result.mrrLoss)} x {ASSUMPTIONS.annualizationMonths} = {formatCurrency(result.annualizedExposure)}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Main Page ───────────────────────────────────────────────────
export default function ProductionTestOrderPage() {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [prior, setPrior] = useState<PriorAccountState>(EMPTY_PRIOR);
  const [result, setResult] = useState<ScoredCase | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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

  const handleScore = async () => {
    const errs = validate();
    if (errs.length > 0) {
      setErrors(errs);
      return;
    }
    setErrors([]);
    setLoading(true);

    try {
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

      // Call the production scoring API
      const response = await fetch('/api/v1/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, companionOrders }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const scored: ScoredCase = await response.json();
      setResult(scored);
    } catch (err: any) {
      setErrors([`Scoring failed: ${err.message}`]);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setForm(EMPTY_FORM);
    setPrior(EMPTY_PRIOR);
    setResult(null);
    setErrors([]);
  };

  const loadPreset = (preset: ExamplePreset) => {
    setForm(preset.form);
    setPrior(preset.prior);
    setResult(null);
    setErrors([]);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <SearchCheck className="h-6 w-6" /> Test an Order
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Enter order details to score against the live database. The engine cross-references against all existing orders.
        </p>
      </div>

      {/* Example Buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Quick fill:</span>
        <Button variant="outline" size="sm" onClick={() => loadPreset(PRESET_SUSPICIOUS)}>
          Suspicious Example
        </Button>
        <Button variant="outline" size="sm" onClick={() => loadPreset(PRESET_FAKE_NAME)}>
          Fake Name Example
        </Button>
        <Button variant="outline" size="sm" onClick={() => loadPreset(PRESET_CLEAN)}>
          Clean Example
        </Button>
        <Button variant="ghost" size="sm" onClick={handleReset}>
          <RotateCcw className="h-3 w-3 mr-1" /> Clear
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Column */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Details</CardTitle>
              <CardDescription>Fields marked with * are required. The engine will cross-reference against the live database.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.length > 0 && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  {errors.map((e, i) => (
                    <p key={i} className="text-sm text-red-700">{e}</p>
                  ))}
                </div>
              )}

              <Section title="Customer & Address" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <Field label="Customer Name" required>
                      <Input value={form.customerName} onChange={e => update('customerName', e.target.value)} placeholder="John Smith" />
                    </Field>
                  </div>
                  <div className="col-span-2">
                    <Field label="Service Address" required>
                      <Input value={form.address} onChange={e => update('address', e.target.value)} placeholder="123 Oak St" />
                    </Field>
                  </div>
                  <Field label="City" required>
                    <Input value={form.city} onChange={e => update('city', e.target.value)} placeholder="Charlotte" />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="State" required>
                      <Input value={form.state} onChange={e => update('state', e.target.value)} placeholder="NC" maxLength={2} />
                    </Field>
                    <Field label="ZIP" required>
                      <Input value={form.zip} onChange={e => update('zip', e.target.value)} placeholder="28202" />
                    </Field>
                  </div>
                </div>
              </Section>

              <Section title="Channel & Agent" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Channel" required>
                    <select
                      value={form.channel}
                      onChange={e => update('channel', e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      {CHANNEL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Region">
                    <select
                      value={form.region}
                      onChange={e => update('region', e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      {['Northeast','Southeast','Midwest','West','Southwest'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Agent Code" hint="e.g. PDS-007">
                    <Input value={form.agentCode} onChange={e => update('agentCode', e.target.value)} placeholder="PDS-007" />
                  </Field>
                  <Field label="Company Code" hint="e.g. PDS">
                    <Input value={form.companyCode} onChange={e => update('companyCode', e.target.value)} placeholder="PDS" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Company Name">
                      <Input value={form.companyName} onChange={e => update('companyName', e.target.value)} placeholder="Premier Door Sales" />
                    </Field>
                  </div>
                </div>
              </Section>

              <Section title="Dates & Prior Account" defaultOpen={true}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Order Date" required>
                    <Input type="date" value={form.orderDate} onChange={e => update('orderDate', e.target.value)} />
                  </Field>
                  <Field label="Disconnect Date" hint="Leave blank if no prior disconnect">
                    <Input type="date" value={form.disconnectDate} onChange={e => update('disconnectDate', e.target.value)} />
                  </Field>
                  <Field label="Disconnect Reason">
                    <select
                      value={form.disconnectReason}
                      onChange={e => update('disconnectReason', e.target.value)}
                      className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                    >
                      <option value="">— None —</option>
                      {['Non-payment','Customer request','Seasonal','Moved','Service issue','Price'].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Prior Account #" hint="Previous account at this or another address">
                    <Input value={form.priorAccountNumber} onChange={e => update('priorAccountNumber', e.target.value)} placeholder="ACCT..." />
                  </Field>
                  <Field label="Account Number">
                    <Input value={form.accountNumber} onChange={e => update('accountNumber', e.target.value)} placeholder="ACCT..." />
                  </Field>
                  <Field label="Delinquent Balance ($)" hint="Outstanding balance on prior account">
                    <Input type="number" value={form.delinquentBalance} onChange={e => update('delinquentBalance', e.target.value)} placeholder="0" />
                  </Field>
                </div>
              </Section>

              <Section title="Billing & Commission" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prior Bill ($/mo)">
                    <Input type="number" value={form.priorBillAmount} onChange={e => update('priorBillAmount', e.target.value)} placeholder="120" />
                  </Field>
                  <Field label="New Promo Bill ($/mo)">
                    <Input type="number" value={form.newPromoBillAmount} onChange={e => update('newPromoBillAmount', e.target.value)} placeholder="49.99" />
                  </Field>
                  <Field label="Promo Name">
                    <Input value={form.promoName} onChange={e => update('promoName', e.target.value)} placeholder="New Connect $49.99/mo" />
                  </Field>
                  <Field label="Commission ($)">
                    <Input type="number" value={form.commissionAmount} onChange={e => update('commissionAmount', e.target.value)} placeholder="150" />
                  </Field>
                </div>
              </Section>

              <Section title="Identity Signals" description="Optional — auto-generated if left blank" defaultOpen={false}>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone Hash">
                    <Input value={form.phoneHash} onChange={e => update('phoneHash', e.target.value)} placeholder="Auto-generated" className="font-mono text-xs" />
                  </Field>
                  <Field label="Email Hash">
                    <Input value={form.emailHash} onChange={e => update('emailHash', e.target.value)} placeholder="Auto-generated" className="font-mono text-xs" />
                  </Field>
                  <Field label="Payment Method Hash">
                    <Input value={form.paymentMethodHash} onChange={e => update('paymentMethodHash', e.target.value)} placeholder="Auto-generated" className="font-mono text-xs" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Equipment Serials" hint="Comma-separated.">
                      <Input value={form.equipmentSerials} onChange={e => update('equipmentSerials', e.target.value)} placeholder="EQ123456, EQ789012" className="font-mono text-xs" />
                    </Field>
                  </div>
                </div>
              </Section>

              {/* ── Prior Account Simulation ─────────────────── */}
              <Section
                title="Prior Account Simulation"
                description="Simulate a disconnected account to show how cross-referencing works"
                defaultOpen={prior.enabled}
              >
                <div className="flex items-start gap-2 p-2 bg-amber-50 border border-amber-200 rounded-lg mb-3">
                  <AlertTriangle className="h-3 w-3 text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    This creates a simulated prior account in the scoring pool. Toggle the shared signals below to control which
                    identity markers match between the old and new account — the engine will detect them automatically.
                  </p>
                </div>

                <label className="flex items-center gap-2 mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prior.enabled}
                    onChange={e => updatePrior('enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-800">Enable prior account simulation</span>
                </label>

                {prior.enabled && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <Field label="Prior Customer Name" required hint="Use a different name to test fake-name detection">
                          <Input value={prior.customerName} onChange={e => updatePrior('customerName', e.target.value)} placeholder="e.g. James Rodriguez" />
                        </Field>
                      </div>
                      <Field label="Disconnect Date" required>
                        <Input type="date" value={prior.disconnectDate} onChange={e => updatePrior('disconnectDate', e.target.value)} />
                      </Field>
                      <Field label="Disconnect Reason">
                        <select
                          value={prior.disconnectReason}
                          onChange={e => updatePrior('disconnectReason', e.target.value)}
                          className="flex h-10 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                          {['Non-payment','Customer request','Seasonal','Moved','Service issue','Price'].map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Prior Account #">
                        <Input value={prior.accountNumber} onChange={e => updatePrior('accountNumber', e.target.value)} placeholder="ACCT..." />
                      </Field>
                      <Field label="Delinquent Balance ($)">
                        <Input type="number" value={prior.delinquentBalance} onChange={e => updatePrior('delinquentBalance', e.target.value)} placeholder="0" />
                      </Field>
                    </div>

                    {/* Address */}
                    <div className="border border-gray-200 rounded-lg p-3">
                      <label className="flex items-center gap-2 mb-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={prior.sameAddress}
                          onChange={e => updatePrior('sameAddress', e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-800">Same service address as new order</span>
                      </label>
                      {!prior.sameAddress && (
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          <div className="col-span-2">
                            <Field label="Prior Address">
                              <Input value={prior.address} onChange={e => updatePrior('address', e.target.value)} placeholder="123 Main St" />
                            </Field>
                          </div>
                          <Field label="City">
                            <Input value={prior.city} onChange={e => updatePrior('city', e.target.value)} />
                          </Field>
                          <div className="grid grid-cols-2 gap-2">
                            <Field label="State">
                              <Input value={prior.state} onChange={e => updatePrior('state', e.target.value)} maxLength={2} />
                            </Field>
                            <Field label="ZIP">
                              <Input value={prior.zip} onChange={e => updatePrior('zip', e.target.value)} />
                            </Field>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Shared Signal Toggles */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-2">Shared Signals</p>
                      <p className="text-xs text-gray-500 mb-3">Check which identity markers the prior account shares with the new order. Each match adds evidence.</p>
                      <div className="grid grid-cols-2 gap-2">
                        <SignalToggle
                          label="Same Phone"
                          icon={<Phone className="h-3.5 w-3.5" />}
                          checked={prior.samePhone}
                          onChange={v => updatePrior('samePhone', v)}
                        />
                        <SignalToggle
                          label="Same Payment Method"
                          icon={<CreditCard className="h-3.5 w-3.5" />}
                          checked={prior.samePayment}
                          onChange={v => updatePrior('samePayment', v)}
                        />
                        <SignalToggle
                          label="Same Email"
                          icon={<Mail className="h-3.5 w-3.5" />}
                          checked={prior.sameEmail}
                          onChange={v => updatePrior('sameEmail', v)}
                        />
                        <SignalToggle
                          label="Same Equipment"
                          icon={<Package className="h-3.5 w-3.5" />}
                          checked={prior.sameEquipment}
                          onChange={v => updatePrior('sameEquipment', v)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </Section>

              <Button onClick={handleScore} className="w-full" size="lg" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scoring...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" /> Score This Order
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Results Column */}
        <div>
          {result ? (
            <ResultsPanel result={result} />
          ) : (
            <div className="flex flex-col items-center justify-center h-96 text-center border-2 border-dashed border-gray-200 rounded-lg">
              <SearchCheck className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-500">Fill in the order details and click Score</p>
              <p className="text-xs text-gray-400 mt-1">
                The engine will check for address matches, identity overlaps,<br />
                agent clusters, promo resets, and more against the live database.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

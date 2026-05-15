'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Shield, MapPin, Calendar, Phone, CreditCard,
  Mail, Fingerprint, Monitor, User, Clock, AlertTriangle,
  FileText, Activity, UserCheck,
} from 'lucide-react';
import { CaseActions } from '@/components/case-actions';
import { ActivityTimeline } from '@/components/activity-timeline';

interface CaseDetail {
  case: any;
  order: any;
  assignee: any;
  comments: any[];
}

export default function ProductionCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'activity' | 'order'>('evidence');

  const fetchCase = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/cases/${caseId}`);
      if (!res.ok) { router.push('/prod/queue'); return; }
      const json = await res.json();
      setData(json);
    } catch { router.push('/prod/queue'); }
    finally { setLoading(false); }
  }, [caseId, router]);

  useEffect(() => { fetchCase(); }, [fetchCase]);

  // Action handlers
  const handleAssign = async (id: string, analystId: string) => {
    const res = await fetch(`/api/v1/cases/${id}/assign`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analystId }),
    });
    return res.ok;
  };
  const handleEscalate = async (id: string, reason: string) => {
    const res = await fetch(`/api/v1/cases/${id}/escalate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    return res.ok;
  };
  const handleResolve = async (id: string, resolution: string, note: string) => {
    const res = await fetch(`/api/v1/cases/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution, note }),
    });
    return res.ok;
  };
  const handleComment = async (id: string, content: string) => {
    const res = await fetch(`/api/v1/cases/${id}/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    return res.ok;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data) return null;

  const { case: caseData, order, assignee, comments } = data;
  const evidence = Array.isArray(caseData.evidence) ? caseData.evidence : [];

  return (
    <div className="space-y-5">
      {/* Back nav + Header */}
      <div>
        <Link href="/prod/queue" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-3">
          <ArrowLeft className="h-4 w-4" />
          Back to Queue
        </Link>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <RiskBadgeLarge band={caseData.riskBand} score={caseData.riskScore} />
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Case #{caseData.caseNumber}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">{order.customerName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={caseData.status} />
            {assignee && (
              <div className="flex items-center gap-1.5 text-xs text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full">
                <UserCheck className="h-3 w-3" />
                {assignee.name}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Actions */}
      <CaseActions
        caseId={caseId}
        currentStatus={caseData.status}
        currentAssignee={caseData.assignedTo}
        onAssign={handleAssign}
        onEscalate={handleEscalate}
        onResolve={handleResolve}
        onComment={handleComment}
        onActionComplete={fetchCase}
      />

      {/* Quick info cards */}
      <div className="grid grid-cols-4 gap-3">
        <InfoCard icon={MapPin} label="Address" value={order.address} sub={`${order.city || ''} ${order.state || ''} ${order.zip || ''}`} />
        <InfoCard icon={Calendar} label="Order Date" value={formatDate(order.orderDate)} sub={`Type: ${order.orderType}`} />
        <InfoCard icon={User} label="Agent" value={order.agentId || 'N/A'} sub={`Channel: ${order.channel || 'N/A'}`} />
        <InfoCard icon={Shield} label="Region" value={order.region || 'N/A'} sub={`Account: ${order.accountNumber || 'N/A'}`} />
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex border-b border-slate-200">
          <TabButton active={activeTab === 'evidence'} onClick={() => setActiveTab('evidence')} icon={FileText} label="Evidence" count={evidence.length} />
          <TabButton active={activeTab === 'activity'} onClick={() => setActiveTab('activity')} icon={Activity} label="Activity" count={comments.length} />
          <TabButton active={activeTab === 'order'} onClick={() => setActiveTab('order')} icon={FileText} label="Order Details" />
        </div>

        <div className="p-5">
          {activeTab === 'evidence' && <EvidencePanel evidence={evidence} />}
          {activeTab === 'activity' && <ActivityTimeline entries={comments} />}
          {activeTab === 'order' && <OrderDetailPanel order={order} />}
        </div>
      </div>
    </div>
  );
}

// ── Evidence Panel ──────────────────────────────────────────

function EvidencePanel({ evidence }: { evidence: any[] }) {
  if (evidence.length === 0) {
    return <p className="text-sm text-slate-400 py-8 text-center">No evidence signals detected</p>;
  }

  return (
    <div className="space-y-3">
      {evidence.map((e, i) => (
        <div key={i} className="border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <EvidenceIcon type={e.type} />
              <span className="text-sm font-semibold text-slate-800">{formatEvidenceType(e.type)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-slate-500">
                Confidence: <span className="font-semibold">{(e.confidence * 100).toFixed(0)}%</span>
              </span>
              <span className="text-[10px] text-slate-500">
                Weight: <span className="font-semibold">{(e.weight * 100).toFixed(0)}%</span>
              </span>
            </div>
          </div>
          {e.details && Object.keys(e.details).length > 0 && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 pt-2 border-t border-slate-100">
              {Object.entries(e.details).map(([key, val]) => (
                <div key={key} className="flex items-baseline gap-2">
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{formatKey(key)}:</span>
                  <span className="text-xs text-slate-700 truncate">{String(val)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Order Detail Panel ──────────────────────────────────────

function OrderDetailPanel({ order }: { order: any }) {
  const fields = [
    ['External ID', order.externalId],
    ['Order Date', formatDate(order.orderDate)],
    ['Order Type', order.orderType],
    ['Customer Name', order.customerName],
    ['Address', order.address],
    ['City', order.city],
    ['State', order.state],
    ['ZIP', order.zip],
    ['Region', order.region],
    ['Channel', order.channel],
    ['Agent ID', order.agentId],
    ['Account Number', order.accountNumber],
    ['Promo Code', order.promoCode],
    ['Disconnect Reason', order.disconnectReason],
    ['Delinquent Balance', order.delinquentBalance ? `$${order.delinquentBalance}` : null],
  ].filter(([, v]) => v);

  return (
    <div className="grid grid-cols-2 gap-4">
      {fields.map(([label, value]) => (
        <div key={label as string}>
          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</p>
          <p className="text-sm text-slate-800 mt-0.5">{value as string}</p>
        </div>
      ))}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function RiskBadgeLarge({ band, score }: { band: string; score: number }) {
  const styles: Record<string, string> = {
    critical: 'bg-red-100 text-red-700 ring-red-300',
    high: 'bg-orange-100 text-orange-700 ring-orange-300',
    medium: 'bg-amber-100 text-amber-700 ring-amber-300',
    low: 'bg-green-100 text-green-700 ring-green-300',
  };
  return (
    <div className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl ring-2 ${styles[band] || styles.low}`}>
      <span className="text-xl font-bold">{score}</span>
      <span className="text-[9px] uppercase font-semibold">{band}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    in_review: 'bg-indigo-100 text-indigo-700',
    escalated: 'bg-amber-100 text-amber-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-slate-100 text-slate-500',
  };
  const labels: Record<string, string> = {
    open: 'Open', in_review: 'In Review', escalated: 'Escalated',
    resolved: 'Resolved', dismissed: 'Dismissed',
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${styles[status] || styles.open}`}>
      {labels[status] || status}
    </span>
  );
}

function InfoCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="h-3 w-3 text-slate-400" />
        <span className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-800 truncate">{value}</p>
      {sub && <p className="text-[10px] text-slate-400 mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label, count }: {
  active: boolean; onClick: () => void; icon: any; label: string; count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
        active
          ? 'text-blue-600 border-blue-600'
          : 'text-slate-500 border-transparent hover:text-slate-700'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
      {count !== undefined && (
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

function EvidenceIcon({ type }: { type: string }) {
  const icons: Record<string, any> = {
    address_match: MapPin, address_disconnect_reuse: MapPin,
    identity_match: Fingerprint, phone_reuse: Phone,
    payment_method_reuse: CreditCard, equipment_swap: Monitor,
    rapid_reconnect: Clock, promo_reset: CreditCard,
    agent_cluster: User, delinquency_bypass: AlertTriangle,
    same_customer_new_address: MapPin,
  };
  const Icon = icons[type] || Shield;
  return <Icon className="h-4 w-4 text-slate-500" />;
}

function formatEvidenceType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatKey(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

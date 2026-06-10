'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Shield, MapPin, Calendar, Phone, CreditCard,
  Mail, Fingerprint, Monitor, User, Clock, AlertTriangle,
  FileText, Activity, UserCheck, Sparkles, MessageSquare,
  Send, ChevronDown, ChevronUp, BarChart3, Loader2, Brain,
  TrendingUp, AlertCircle, RefreshCw,
} from 'lucide-react';
import { CaseActions } from '@/components/case-actions';
import { ActivityTimeline } from '@/components/activity-timeline';

interface CaseDetail {
  case: any;
  order: any;
  assignee: any;
  comments: any[];
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnomalySignal {
  feature: string;
  value: number;
  populationMean: number;
  zScore: number;
  description: string;
}

interface AnomalyResult {
  anomalyScore: number;
  signals: AnomalySignal[];
  isAnomalous: boolean;
}

export default function ProductionCaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const [data, setData] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'evidence' | 'activity' | 'order'>('evidence');

  // AI state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [anomalyData, setAnomalyData] = useState<AnomalyResult | null>(null);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [mlData, setMlData] = useState<any>(null);
  const [mlLoading, setMlLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  // Check AI status
  useEffect(() => {
    fetch('/api/v1/ai/status')
      .then(r => r.json())
      .then(data => setAiEnabled(data.enabled))
      .catch(() => setAiEnabled(false));
  }, []);

  // Auto-fetch AI summary when case loads
  useEffect(() => {
    if (data && caseId) {
      fetchAiSummary();
      fetchAnomalyData();
      fetchMlScore();
    }
  }, [data, caseId]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchAiSummary = async () => {
    setAiSummaryLoading(true);
    try {
      const res = await fetch('/api/v1/ai/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json();
      if (json.summary) {
        setAiSummary(json.summary);
      } else if (json.fallback) {
        // Generate a basic rule-based summary as fallback
        setAiSummary(generateFallbackSummary(data!));
      }
    } catch {
      if (data) setAiSummary(generateFallbackSummary(data));
    }
    setAiSummaryLoading(false);
  };

  const fetchAnomalyData = async () => {
    setAnomalyLoading(true);
    try {
      const res = await fetch('/api/v1/ai/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json();
      setAnomalyData(json);
    } catch { /* ignore */ }
    setAnomalyLoading(false);
  };

  const fetchMlScore = async () => {
    setMlLoading(true);
    try {
      const res = await fetch('/api/v1/ai/ml-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caseId }),
      });
      const json = await res.json();
      setMlData(json);
    } catch { /* ignore */ }
    setMlLoading(false);
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          message: userMessage,
          history: chatMessages,
        }),
      });
      const json = await res.json();

      if (json.reply) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: json.reply }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: json.message || 'AI features are not configured. Add your ANTHROPIC_API_KEY to Vercel environment variables to enable the AI analyst.',
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
      }]);
    }
    setChatLoading(false);
  };

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

      {/* AI Summary Panel */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-7 h-7 bg-indigo-100 rounded-lg">
              <Brain className="h-4 w-4 text-indigo-600" />
            </div>
            <h3 className="text-sm font-semibold text-indigo-900">AI Analysis</h3>
            {aiEnabled && (
              <span className="text-[9px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">
                CLAUDE POWERED
              </span>
            )}
            {!aiEnabled && (
              <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                RULE-BASED
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchAiSummary}
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
              disabled={aiSummaryLoading}
            >
              <RefreshCw className={`h-3 w-3 ${aiSummaryLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded-lg border border-indigo-200 hover:border-indigo-300 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Ask AI
            </button>
          </div>
        </div>

        {aiSummaryLoading ? (
          <div className="flex items-center gap-2 text-sm text-indigo-500 py-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Analyzing case evidence and order history...
          </div>
        ) : aiSummary ? (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {aiSummary}
          </div>
        ) : (
          <p className="text-sm text-indigo-400 py-2">No analysis available yet.</p>
        )}
      </div>

      {/* AI Chat Panel (collapsible) */}
      {chatOpen && (
        <div className="bg-white border border-indigo-200 rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-200">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-900">AI Analyst Chat</span>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-indigo-400 hover:text-indigo-600">
              <ChevronUp className="h-4 w-4" />
            </button>
          </div>

          {/* Chat messages */}
          <div className="h-72 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Brain className="h-8 w-8 text-indigo-200 mx-auto mb-3" />
                <p className="text-sm text-slate-400 mb-3">Ask me anything about this case</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {[
                    'Why was this order flagged?',
                    'What should I do with this case?',
                    'Is this agent suspicious?',
                    'Explain the risk score',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setChatInput(q); }}
                      className="text-xs bg-white border border-indigo-200 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-50 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-slate-200 text-slate-700'
                }`}>
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Sparkles className="h-3 w-3 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-indigo-500">AI ANALYST</span>
                    </div>
                  )}
                  <div className="whitespace-pre-line leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-indigo-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Analyzing...
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat input */}
          <div className="border-t border-slate-200 p-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                placeholder="Ask about this case..."
                className="flex-1 text-sm border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                disabled={chatLoading}
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="flex items-center justify-center w-9 h-9 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Anomaly Detection Panel */}
      {anomalyData && anomalyData.isAnomalous && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center w-7 h-7 bg-amber-100 rounded-lg">
              <TrendingUp className="h-4 w-4 text-amber-600" />
            </div>
            <h3 className="text-sm font-semibold text-amber-900">Statistical Anomalies Detected</h3>
            <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">
              Score: {anomalyData.anomalyScore}
            </span>
          </div>
          <div className="space-y-2">
            {anomalyData.signals.map((signal, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-slate-700">{signal.description}</span>
                  <span className="text-[10px] text-amber-500 ml-2">z={signal.zScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ML Scoring Breakdown */}
      {mlData && mlData.composite && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-7 h-7 bg-blue-100 rounded-lg">
                  <BarChart3 className="h-4 w-4 text-blue-600" />
                </div>
                <h3 className="text-sm font-semibold text-slate-900">ML Scoring Breakdown</h3>
                <span className="text-[9px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                  {mlData.composite.activeLayers} LAYERS ACTIVE
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Composite Score:</span>
                <span className={`text-lg font-bold ${
                  mlData.composite.finalScore >= 80 ? 'text-red-600' :
                  mlData.composite.finalScore >= 60 ? 'text-orange-600' :
                  mlData.composite.finalScore >= 35 ? 'text-amber-600' :
                  'text-green-600'
                }`}>
                  {mlData.composite.finalScore}
                </span>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4">
            {/* Layer scores */}
            <div className="space-y-3">
              {mlData.composite.layers.map((layer: any, i: number) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-36 flex-shrink-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700">{layer.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        layer.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
                      }`}>
                        {layer.active ? `${layer.score}` : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        !layer.active ? 'bg-slate-200' :
                        layer.score >= 80 ? 'bg-red-500' :
                        layer.score >= 60 ? 'bg-orange-500' :
                        layer.score >= 35 ? 'bg-amber-500' :
                        layer.score > 0 ? 'bg-blue-500' :
                        'bg-slate-200'
                      }`}
                      style={{ width: `${layer.active ? layer.score : 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 w-12 text-right flex-shrink-0">
                    {(layer.weight * 100).toFixed(0)}% wt
                  </span>
                </div>
              ))}
            </div>

            {/* ML Evidence */}
            {mlData.composite.mlEvidence.length > 0 && (
              <div className="border-t border-slate-100 pt-4">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">ML-Generated Evidence</h4>
                <div className="space-y-2">
                  {mlData.composite.mlEvidence.map((e: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${
                        e.source === 'embeddings' ? 'bg-purple-500' :
                        e.source === 'isolation_forest' ? 'bg-amber-500' :
                        e.source === 'gradient_boost' ? 'bg-blue-500' :
                        e.source === 'graph_analysis' ? 'bg-cyan-500' :
                        'bg-slate-400'
                      }`} />
                      <div>
                        <span className="text-slate-700">{e.description}</span>
                        <span className="text-[10px] text-slate-400 ml-2">
                          {e.source.replace('_', ' ')} · {(e.confidence * 100).toFixed(0)}% confidence
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {mlLoading && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center gap-3 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Running ML scoring layers...</span>
        </div>
      )}

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

// ── Fallback Summary Generator ────────────────────────────────

function generateFallbackSummary(data: CaseDetail): string {
  const { case: caseData, order } = data;
  const evidence = Array.isArray(caseData.evidence) ? caseData.evidence : [];
  const financialImpact = caseData.financialImpact || {};

  const evidenceTypes = evidence.map((e: any) => e.type);
  const patterns: string[] = [];

  if (evidenceTypes.includes('address_disconnect_reuse') || evidenceTypes.includes('rapid_reconnect')) {
    patterns.push('disconnect-reconnect fraud');
  }
  if (evidenceTypes.includes('identity_match')) {
    patterns.push('identity signal reuse across accounts');
  }
  if (evidenceTypes.includes('payment_method_reuse')) {
    patterns.push('payment method linked to prior disconnected account');
  }
  if (evidenceTypes.includes('phone_reuse')) {
    patterns.push('phone number linked to prior disconnected account');
  }
  if (evidenceTypes.includes('same_customer_new_address')) {
    patterns.push('same customer identity at a new address');
  }
  if (evidenceTypes.includes('agent_cluster')) {
    patterns.push('agent with elevated fraud rate');
  }

  const patternStr = patterns.length > 0
    ? `This case exhibits patterns consistent with ${patterns.join(', ')}.`
    : 'No specific fraud patterns detected by the rule engine.';

  const channelRisk = ['third_party_door_to_door', 'third_party_telemarketing'].includes(order.channel)
    ? ` The order came through a ${order.channel?.replace(/_/g, ' ')} channel, which carries higher fraud risk.`
    : '';

  const financialStr = financialImpact.commissionAtRisk
    ? ` Financial exposure: $${financialImpact.commissionAtRisk} commission at risk, $${financialImpact.annualizedExposure} annualized.`
    : '';

  const disconnectStr = order.disconnectReason
    ? ` The prior account at this address was disconnected for ${order.disconnectReason}${order.delinquentBalance ? ` with $${order.delinquentBalance} outstanding balance` : ''}.`
    : '';

  const recommendation = caseData.riskScore >= 80
    ? 'Recommendation: Place an immediate hold on this order and escalate for supervisor review.'
    : caseData.riskScore >= 60
    ? 'Recommendation: Review the identity signals carefully before approving. Consider contacting the customer for verification.'
    : caseData.riskScore >= 35
    ? 'Recommendation: Standard review. Check identity documents if available.'
    : 'Recommendation: Low risk — proceed with standard processing.';

  return `${order.customerName}'s connect order at ${order.address} scored ${caseData.riskScore}/100 (${caseData.riskBand} risk). ${patternStr}${channelRisk}${disconnectStr}${financialStr}\n\n${recommendation}`;
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

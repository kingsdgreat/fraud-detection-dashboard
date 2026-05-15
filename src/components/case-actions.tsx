'use client';

import React, { useState } from 'react';
import {
  UserPlus, AlertTriangle, CheckCircle2, MessageSquarePlus,
  Send, X, Loader2, ChevronDown,
} from 'lucide-react';

interface CaseActionsProps {
  caseId: string;
  currentStatus: string;
  currentAssignee?: string | null;
  onAssign: (caseId: string, analystId: string) => Promise<boolean>;
  onEscalate: (caseId: string, reason: string) => Promise<boolean>;
  onResolve: (caseId: string, resolution: string, note: string) => Promise<boolean>;
  onComment: (caseId: string, content: string) => Promise<boolean>;
  onActionComplete?: () => void;
  analysts?: Array<{ id: string; name: string; email: string }>;
}

type ActivePanel = 'none' | 'assign' | 'escalate' | 'resolve' | 'comment';

export function CaseActions({
  caseId,
  currentStatus,
  currentAssignee,
  onAssign,
  onEscalate,
  onResolve,
  onComment,
  onActionComplete,
  analysts = [],
}: CaseActionsProps) {
  const [activePanel, setActivePanel] = useState<ActivePanel>('none');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = currentStatus === 'resolved' || currentStatus === 'dismissed';

  const handleAction = async (action: () => Promise<boolean>) => {
    setLoading(true);
    setError(null);
    try {
      const success = await action();
      if (success) {
        setActivePanel('none');
        onActionComplete?.();
      } else {
        setError('Action failed. Please try again.');
      }
    } catch {
      setError('An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
      {/* Action buttons bar */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-100">
        <span className="text-xs font-medium text-gray-500 mr-2">Actions:</span>

        {!isClosed && (
          <>
            <ActionButton
              icon={UserPlus}
              label="Assign"
              active={activePanel === 'assign'}
              onClick={() => setActivePanel(activePanel === 'assign' ? 'none' : 'assign')}
            />
            <ActionButton
              icon={AlertTriangle}
              label="Escalate"
              active={activePanel === 'escalate'}
              onClick={() => setActivePanel(activePanel === 'escalate' ? 'none' : 'escalate')}
              variant="warning"
            />
            <ActionButton
              icon={CheckCircle2}
              label="Resolve"
              active={activePanel === 'resolve'}
              onClick={() => setActivePanel(activePanel === 'resolve' ? 'none' : 'resolve')}
              variant="success"
            />
          </>
        )}

        <ActionButton
          icon={MessageSquarePlus}
          label="Add Note"
          active={activePanel === 'comment'}
          onClick={() => setActivePanel(activePanel === 'comment' ? 'none' : 'comment')}
        />

        {isClosed && (
          <span className="ml-auto text-xs text-gray-400 italic">
            Case is {currentStatus} — reopen to take actions
          </span>
        )}
      </div>

      {/* Expandable panels */}
      {activePanel !== 'none' && (
        <div className="p-4 bg-gray-50 border-t border-gray-100">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {activePanel === 'assign' && (
            <AssignPanel
              analysts={analysts}
              currentAssignee={currentAssignee}
              loading={loading}
              onSubmit={(analystId) => handleAction(() => onAssign(caseId, analystId))}
              onCancel={() => setActivePanel('none')}
            />
          )}

          {activePanel === 'escalate' && (
            <EscalatePanel
              loading={loading}
              onSubmit={(reason) => handleAction(() => onEscalate(caseId, reason))}
              onCancel={() => setActivePanel('none')}
            />
          )}

          {activePanel === 'resolve' && (
            <ResolvePanel
              loading={loading}
              onSubmit={(resolution, note) => handleAction(() => onResolve(caseId, resolution, note))}
              onCancel={() => setActivePanel('none')}
            />
          )}

          {activePanel === 'comment' && (
            <CommentPanel
              loading={loading}
              onSubmit={(content) => handleAction(() => onComment(caseId, content))}
              onCancel={() => setActivePanel('none')}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function ActionButton({
  icon: Icon,
  label,
  active,
  onClick,
  variant = 'default',
}: {
  icon: any;
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: 'default' | 'warning' | 'success';
}) {
  const baseStyles = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all';
  const variants = {
    default: active
      ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
      : 'text-gray-600 hover:bg-gray-100',
    warning: active
      ? 'bg-amber-100 text-amber-700 ring-1 ring-amber-300'
      : 'text-gray-600 hover:bg-amber-50 hover:text-amber-700',
    success: active
      ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
      : 'text-gray-600 hover:bg-green-50 hover:text-green-700',
  };

  return (
    <button className={`${baseStyles} ${variants[variant]}`} onClick={onClick}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function AssignPanel({
  analysts,
  currentAssignee,
  loading,
  onSubmit,
  onCancel,
}: {
  analysts: Array<{ id: string; name: string; email: string }>;
  currentAssignee?: string | null;
  loading: boolean;
  onSubmit: (analystId: string) => void;
  onCancel: () => void;
}) {
  const [selectedAnalyst, setSelectedAnalyst] = useState('');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Assign to Analyst</h4>
      {analysts.length > 0 ? (
        <select
          value={selectedAnalyst}
          onChange={(e) => setSelectedAnalyst(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select an analyst...</option>
          {analysts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.email}){a.id === currentAssignee ? ' — current' : ''}
            </option>
          ))}
        </select>
      ) : (
        <input
          type="text"
          value={selectedAnalyst}
          onChange={(e) => setSelectedAnalyst(e.target.value)}
          placeholder="Enter analyst user ID"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}
      <div className="flex gap-2">
        <SubmitButton loading={loading} disabled={!selectedAnalyst} onClick={() => onSubmit(selectedAnalyst)} label="Assign" />
        <CancelButton onClick={onCancel} />
      </div>
    </div>
  );
}

function EscalatePanel({
  loading,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-amber-700">Escalate to Manager</h4>
      <p className="text-xs text-gray-500">
        This will set the case to urgent priority and notify the management team.
      </p>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason for escalation (required)..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500"
      />
      <div className="flex gap-2">
        <SubmitButton loading={loading} disabled={!reason.trim()} onClick={() => onSubmit(reason)} label="Escalate" variant="warning" />
        <CancelButton onClick={onCancel} />
      </div>
    </div>
  );
}

function ResolvePanel({
  loading,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (resolution: string, note: string) => void;
  onCancel: () => void;
}) {
  const [resolution, setResolution] = useState('');
  const [note, setNote] = useState('');

  const resolutionOptions = [
    { value: 'confirmed_fraud', label: 'Confirmed Fraud', color: 'text-red-700' },
    { value: 'false_positive', label: 'False Positive', color: 'text-green-700' },
    { value: 'inconclusive', label: 'Inconclusive', color: 'text-gray-700' },
  ];

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-green-700">Resolve Case</h4>
      <div className="flex gap-2">
        {resolutionOptions.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setResolution(opt.value)}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-all ${
              resolution === opt.value
                ? 'bg-white ring-2 ring-blue-500 border-blue-300'
                : 'bg-white border-gray-200 hover:border-gray-300'
            } ${opt.color}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Resolution notes (required)..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <div className="flex gap-2">
        <SubmitButton loading={loading} disabled={!resolution || !note.trim()} onClick={() => onSubmit(resolution, note)} label="Resolve" variant="success" />
        <CancelButton onClick={onCancel} />
      </div>
    </div>
  );
}

function CommentPanel({
  loading,
  onSubmit,
  onCancel,
}: {
  loading: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}) {
  const [content, setContent] = useState('');

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-gray-700">Add Investigation Note</h4>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Type your note here..."
        rows={3}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex gap-2">
        <SubmitButton loading={loading} disabled={!content.trim()} onClick={() => onSubmit(content)} label="Add Note" />
        <CancelButton onClick={onCancel} />
      </div>
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
  onClick,
  label,
  variant = 'default',
}: {
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
  variant?: 'default' | 'warning' | 'success';
}) {
  const variants = {
    default: 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300',
    warning: 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300',
    success: 'bg-green-600 hover:bg-green-700 disabled:bg-green-300',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white transition-colors ${variants[variant]}`}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function CancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100 transition-colors"
    >
      <X className="h-3.5 w-3.5" />
      Cancel
    </button>
  );
}

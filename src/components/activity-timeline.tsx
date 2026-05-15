'use client';

import React from 'react';
import {
  MessageSquare, UserPlus, AlertTriangle, CheckCircle2,
  ArrowUpCircle, Settings, Clock,
} from 'lucide-react';

interface ActivityEntry {
  id: string;
  type: 'note' | 'status_change' | 'assignment' | 'escalation' | 'system';
  content: string | null;
  metadata: any;
  createdAt: string;
  authorName: string | null;
  authorEmail: string | null;
}

interface ActivityTimelineProps {
  entries: ActivityEntry[];
  loading?: boolean;
}

const typeConfig: Record<string, { icon: any; color: string; bgColor: string; label: string }> = {
  note: { icon: MessageSquare, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Note' },
  status_change: { icon: Settings, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Status Change' },
  assignment: { icon: UserPlus, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Assignment' },
  escalation: { icon: AlertTriangle, color: 'text-amber-600', bgColor: 'bg-amber-100', label: 'Escalation' },
  system: { icon: Settings, color: 'text-gray-500', bgColor: 'bg-gray-100', label: 'System' },
};

export function ActivityTimeline({ entries, loading }: ActivityTimelineProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
        <Clock className="h-4 w-4 mr-2 animate-spin" />
        Loading activity...
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        No activity yet. Add a note to start the investigation trail.
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => {
        const config = typeConfig[entry.type] || typeConfig.system;
        const Icon = config.icon;
        const isLast = idx === entries.length - 1;

        return (
          <div key={entry.id} className="flex gap-3">
            {/* Timeline connector */}
            <div className="flex flex-col items-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${config.bgColor}`}>
                <Icon className={`h-3.5 w-3.5 ${config.color}`} />
              </div>
              {!isLast && <div className="w-px flex-1 bg-gray-200 my-1" />}
            </div>

            {/* Content */}
            <div className={`flex-1 pb-4 ${isLast ? '' : ''}`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-sm font-medium text-gray-900">
                  {entry.authorName || 'System'}
                </span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${config.bgColor} ${config.color}`}>
                  {config.label}
                </span>
                <span className="text-xs text-gray-400 ml-auto">
                  {formatDate(entry.createdAt)}
                </span>
              </div>
              {entry.content && (
                <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                  {entry.content}
                </p>
              )}
              {entry.metadata && renderMetadata(entry.type, entry.metadata)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function renderMetadata(type: string, metadata: any) {
  if (!metadata) return null;

  if (type === 'status_change' && metadata.resolution) {
    const resolutionLabels: Record<string, string> = {
      confirmed_fraud: 'Confirmed Fraud',
      false_positive: 'False Positive',
      inconclusive: 'Inconclusive',
    };
    return (
      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-gray-50 border border-gray-200 rounded text-xs text-gray-600">
        <CheckCircle2 className="h-3 w-3" />
        Resolution: <span className="font-medium">{resolutionLabels[metadata.resolution] || metadata.resolution}</span>
      </div>
    );
  }

  if (type === 'assignment' && metadata.analystName) {
    return (
      <div className="mt-1.5 inline-flex items-center gap-1.5 px-2 py-1 bg-indigo-50 border border-indigo-200 rounded text-xs text-indigo-700">
        <UserPlus className="h-3 w-3" />
        Assigned to: <span className="font-medium">{metadata.analystName}</span>
      </div>
    );
  }

  return null;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Loader2, RotateCcw, Clock, ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface UploadResult {
  batchId: string;
  filename: string;
  totalRows: number;
  processed: number;
  failed: number;
  errors?: Array<{ row: number; error: string; data?: string }>;
  status: string;
}

interface BatchHistory {
  id: string;
  filename: string;
  totalRecords: number;
  processedRecords: number;
  failedRecords: number;
  status: string;
  createdAt: string;
}

export default function ProductionIngestPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batches, setBatches] = useState<BatchHistory[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch recent batch history
  useEffect(() => {
    fetch('/api/v1/orders/batches')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.batches) setBatches(data.batches); })
      .catch(() => {});
  }, [result]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSetFile(file);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSetFile(file);
  }, []);

  const validateAndSetFile = (file: File) => {
    setError(null);
    setResult(null);
    if (!file.name.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      setError('File size must be under 50MB');
      return;
    }
    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const res = await fetch('/api/v1/orders/upload', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Upload failed');
        return;
      }

      setResult(json);
      setSelectedFile(null);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Data Ingestion</h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload order data via CSV to run through the fraud scoring engine
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Upload className="h-4 w-4 text-blue-600" />
            CSV Upload
          </h2>
        </div>

        <div className="p-6">
          {!result ? (
            <>
              {/* Drop zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${isDragging
                    ? 'border-blue-500 bg-blue-50'
                    : selectedFile
                      ? 'border-green-300 bg-green-50'
                      : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {selectedFile ? (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-green-100">
                      <FileSpreadsheet className="h-7 w-7 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{selectedFile.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-slate-100">
                      <Upload className={`h-7 w-7 ${isDragging ? 'text-blue-500' : 'text-slate-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        Drop your CSV file here, or <span className="text-blue-600">browse</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        Supports .csv files up to 50MB
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error message */}
              {error && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              {/* Upload button */}
              {selectedFile && (
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Upload &amp; Process
                      </>
                    )}
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center gap-2 px-4 py-2.5 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              )}

              {/* Expected format */}
              <div className="mt-6 p-4 bg-slate-50 rounded-lg">
                <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                  Expected CSV Format
                </h3>
                <p className="text-xs text-slate-500 mb-2">
                  Required columns: <span className="font-mono text-slate-700">external_id, order_date, order_type, customer_name, address</span>
                </p>
                <p className="text-xs text-slate-500">
                  Optional columns: city, state, zip, phone_hash, email_hash, payment_method_hash, equipment_id, channel, agent_id, region, promo_code, account_number, disconnect_reason, delinquent_balance
                </p>
              </div>
            </>
          ) : (
            /* Results panel */
            <UploadResults result={result} onReset={reset} />
          )}
        </div>
      </div>

      {/* Recent Batches */}
      {batches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-500" />
              Recent Uploads
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {batches.map(b => (
              <div key={b.id} className="flex items-center gap-4 px-5 py-3">
                <FileSpreadsheet className="h-4 w-4 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{b.filename || 'Upload'}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(b.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-700">{b.processedRecords} processed</p>
                  {b.failedRecords > 0 && (
                    <p className="text-[10px] text-red-500">{b.failedRecords} failed</p>
                  )}
                </div>
                <BatchStatusBadge status={b.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UploadResults({ result, onReset }: { result: UploadResult; onReset: () => void }) {
  const successRate = result.totalRows > 0
    ? ((result.processed / result.totalRows) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className={`flex items-center gap-3 p-4 rounded-xl ${
        result.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'
      }`}>
        {result.status === 'completed' ? (
          <CheckCircle2 className="h-6 w-6 text-green-600 flex-shrink-0" />
        ) : (
          <AlertCircle className="h-6 w-6 text-amber-600 flex-shrink-0" />
        )}
        <div>
          <p className="text-sm font-semibold text-slate-900">
            {result.status === 'completed' ? 'Upload Complete' : 'Upload Completed with Errors'}
          </p>
          <p className="text-xs text-slate-600 mt-0.5">
            {result.filename} — {result.processed} of {result.totalRows} rows processed ({successRate}%)
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Rows" value={result.totalRows} />
        <StatCard label="Processed" value={result.processed} color="text-green-600" />
        <StatCard label="Failed" value={result.failed} color={result.failed > 0 ? 'text-red-600' : 'text-slate-400'} />
      </div>

      {/* Error details */}
      {result.errors && result.errors.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
            Errors ({result.errors.length})
          </h4>
          <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Row</th>
                  <th className="text-left px-3 py-2 text-slate-500 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.errors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-slate-700 font-mono">{err.row}</td>
                    <td className="px-3 py-2 text-red-600">{err.error}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Upload className="h-4 w-4" />
          Upload Another File
        </button>
        <Link
          href="/prod/queue"
          className="flex items-center gap-2 px-4 py-2 text-slate-600 hover:bg-slate-100 text-sm font-medium rounded-lg transition-colors"
        >
          View Case Queue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-slate-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

function BatchStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    completed: 'bg-green-50 text-green-700',
    processing: 'bg-blue-50 text-blue-700',
    failed: 'bg-red-50 text-red-700',
    pending: 'bg-slate-100 text-slate-500',
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${styles[status] || styles.pending}`}>
      {status}
    </span>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

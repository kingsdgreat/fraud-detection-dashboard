'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Loader2, RotateCcw, Clock,
} from 'lucide-react';

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
    <div className="max-w-[920px] space-y-4">
      {/* ── Step 1: Upload File ────────────────────────── */}
      <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)]">
        <div className="flex items-center gap-[10px] mb-4">
          <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-[12px] font-semibold">1</span>
          <p className="text-[14px] font-semibold text-[#11131a]">Upload file</p>
        </div>

        {/* Drop zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-[1.5px] border-dashed rounded-[13px] py-[30px] px-6 flex flex-col items-center text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-[var(--brand)] bg-[var(--brand-soft)]'
              : 'border-[#d3d7e0] bg-[#fbfbfd] hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="w-[46px] h-[46px] rounded-[13px] bg-[var(--brand-soft)] flex items-center justify-center mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--brand-d)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4"/><path d="M7 9l5-5 5 5"/><path d="M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2"/></svg>
          </div>
          <p className="text-[13.5px] font-medium text-[#11131a]">
            Drag a CSV here, or <span className="text-[var(--brand-d)]">browse</span>
          </p>
          <p className="text-[12px] text-[#9aa0ad] mt-1.5">Up to 50,000 rows &middot; UTF-8 &middot; max 25 MB</p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-[10px]">
            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
            <p className="text-[12.5px] text-red-700">{error}</p>
          </div>
        )}

        {/* Selected file indicator */}
        {selectedFile && !result && (
          <div className="mt-3 flex items-center gap-3 py-3 px-3.5 border border-[#ebedf2] rounded-[11px] bg-[#fafbfc]">
            <div className="w-[34px] h-[34px] rounded-lg bg-[#16a34a14] flex items-center justify-center flex-none">
              <FileSpreadsheet className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#11131a] truncate">{selectedFile.name}</p>
              <p className="text-[11px] text-[#9aa0ad] mt-0.5">{(selectedFile.size / 1024).toFixed(1)} KB</p>
            </div>
            <div className="flex items-center gap-2 flex-none">
              <button
                onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                disabled={uploading}
                className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[9px] bg-[var(--brand)] text-white text-[13px] font-semibold shadow-[0_4px_14px_-4px_var(--brand)] hover:bg-[var(--brand-d)] disabled:opacity-60 transition-colors"
              >
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploading ? 'Processing...' : 'Upload'}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); reset(); }}
                className="px-3 py-[7px] rounded-[9px] border border-[#e2e4ea] bg-white text-[13px] font-medium text-[#4b5161] hover:bg-[#fafbfc] transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Upload result row */}
        {result && (
          <div className="mt-3 flex items-center gap-3 py-3 px-3.5 border border-[#ebedf2] rounded-[11px] bg-[#fafbfc]">
            <div className="w-[34px] h-[34px] rounded-lg bg-[#16a34a14] flex items-center justify-center flex-none">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium text-[#11131a] truncate">{result.filename}</p>
              <div className="mt-1.5 h-[5px] bg-[#eceef2] rounded-[3px] overflow-hidden">
                <div className="h-full bg-green-600 rounded-[3px]" style={{ width: '100%' }} />
              </div>
            </div>
            <span className="text-[11.5px] text-green-600 font-semibold font-mono flex-none">
              {result.totalRows} rows &middot; done
            </span>
          </div>
        )}
      </div>

      {/* ── Step 2: Map Columns (shown after upload) ──── */}
      {result && (
        <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)]">
          <div className="flex items-center gap-[10px] mb-3.5">
            <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-[12px] font-semibold">2</span>
            <p className="text-[14px] font-semibold text-[#11131a]">Map columns</p>
            <span className="ml-auto text-[11.5px] text-green-600 font-medium">
              Auto-detected
            </span>
          </div>
          <div className="flex flex-col gap-[1px] border border-[#eceef2] rounded-[11px] overflow-hidden">
            <div className="grid grid-cols-[1fr_30px_1fr_90px] gap-3 items-center py-[9px] px-3.5 bg-[#fafbfc] text-[10.5px] font-semibold tracking-[.04em] uppercase text-[#8a90a0]">
              <span>CSV column</span>
              <span />
              <span>System field</span>
              <span className="text-right">Status</span>
            </div>
            {[
              { csv: 'external_id', field: 'Order ID', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'customer_name', field: 'Customer Name', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'address', field: 'Service Address', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'channel', field: 'Channel', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'agent_id', field: 'Agent Code', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'order_date', field: 'Order Date', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
              { csv: 'disconnect_reason', field: 'Disconnect Reason', status: 'Matched', color: '#15803d', bg: '#f0fdf4' },
            ].map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_30px_1fr_90px] gap-3 items-center py-[10px] px-3.5 bg-white border-t border-[#f2f3f6]">
                <span className="text-[12px] font-mono text-[#4b5161]">{row.csv}</span>
                <span className="text-[#c0c4ce] text-center">&rarr;</span>
                <span className="text-[12.5px] text-[#11131a]">{row.field}</span>
                <span className="text-right">
                  <span className="text-[10px] font-semibold rounded-[5px] py-[2px] px-[7px]" style={{ color: row.color, background: row.bg }}>{row.status}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Validate & Import (shown after upload) ── */}
      {result && (
        <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)]">
          <div className="flex items-center gap-[10px] mb-3.5">
            <span className="w-6 h-6 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-[12px] font-semibold">3</span>
            <p className="text-[14px] font-semibold text-[#11131a]">Validate &amp; import</p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-[#c4ebcf] bg-[#f0fdf4] rounded-[11px] p-3.5">
              <p className="text-[22px] font-semibold font-mono text-[#15803d]">{result.processed}</p>
              <p className="text-[12px] text-[#4b5161] mt-1">Valid rows</p>
            </div>
            <div className="border border-[#fbe6bd] bg-[#fffbeb] rounded-[11px] p-3.5">
              <p className="text-[22px] font-semibold font-mono text-[#b45309]">{result.failed > 0 ? result.failed : 0}</p>
              <p className="text-[12px] text-[#4b5161] mt-1">Warnings</p>
            </div>
            <div className="border border-[#eceef2] bg-[#fafbfc] rounded-[11px] p-3.5">
              <p className="text-[22px] font-semibold font-mono text-[#11131a]">{result.errors?.length || 0}</p>
              <p className="text-[12px] text-[#4b5161] mt-1">Errors</p>
            </div>
          </div>

          {/* Warning callout */}
          {result.errors && result.errors.length > 0 && (
            <div className="mt-3 py-[11px] px-[13px] bg-[#fffbeb] border border-[#fbe6bd] rounded-[10px] flex gap-[9px] items-start">
              <AlertCircle className="h-3.5 w-3.5 text-[#b45309] flex-none mt-0.5" />
              <p className="text-[12px] text-[#92580a] leading-relaxed">
                {result.errors.slice(0, 3).map((err, i) => (
                  <span key={i}>Row {err.row}: {err.error}{i < Math.min(result.errors!.length, 3) - 1 ? '. ' : ''}</span>
                ))}
                {result.errors.length > 3 && <span> ...and {result.errors.length - 3} more</span>}
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-4 flex justify-end gap-[9px]">
            <button
              onClick={reset}
              className="py-[9px] px-4 rounded-[9px] border border-[#e2e4ea] bg-white text-[13px] font-medium text-[#4b5161] hover:bg-[#fafbfc] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={reset}
              className="py-[9px] px-4 rounded-[9px] bg-[var(--brand)] text-white text-[13px] font-semibold shadow-[0_4px_14px_-4px_var(--brand)] hover:bg-[var(--brand-d)] transition-colors cursor-pointer"
            >
              Import {result.processed} orders
            </button>
          </div>
        </div>
      )}

      {/* Recent Batches */}
      {batches.length > 0 && (
        <div className="bg-white border border-[#ebedf2] rounded-[14px] p-[22px] shadow-[0_1px_2px_rgba(16,18,30,.04)]">
          <div className="flex items-center gap-[10px] mb-3">
            <Clock className="h-4 w-4 text-[#8a90a0]" />
            <p className="text-[14px] font-semibold text-[#11131a]">Recent uploads</p>
          </div>
          <div className="border border-[#eceef2] rounded-[11px] overflow-hidden divide-y divide-[#f2f3f6]">
            {batches.map(b => (
              <div key={b.id} className="flex items-center gap-3.5 px-3.5 py-[10px]">
                <FileSpreadsheet className="h-4 w-4 text-[#9aa0ad] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[12.5px] font-medium text-[#11131a] truncate">{b.filename || 'Upload'}</p>
                  <p className="text-[10px] text-[#9aa0ad]">{formatDate(b.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11.5px] text-[#4b5161]">{b.processedRecords} processed</p>
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

// (UploadResults and StatCard removed — now inline in the 3-step flow above)

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

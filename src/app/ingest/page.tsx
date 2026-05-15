'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
  Upload, FileSpreadsheet, CheckCircle2, XCircle, AlertCircle,
  Loader2, RotateCcw, FileText, Clock,
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

export default function IngestPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    } catch (err) {
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
        <h1 className="text-2xl font-bold text-gray-900">Data Ingestion</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload order data via CSV to run through the fraud scoring engine
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
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
                      : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100'
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
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {(selectedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gray-100">
                      <Upload className={`h-7 w-7 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-700">
                        Drop your CSV file here, or <span className="text-blue-600">browse</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
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
                    className="flex items-center gap-2 px-4 py-2.5 text-gray-600 hover:bg-gray-100 text-sm font-medium rounded-lg transition-colors"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Clear
                  </button>
                </div>
              )}

              {/* Expected format */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Expected CSV Format
                </h3>
                <p className="text-xs text-gray-500 mb-2">
                  Required columns: <span className="font-mono text-gray-700">external_id, order_date, order_type, customer_name, address</span>
                </p>
                <p className="text-xs text-gray-500">
                  Optional columns: city, state, zip, phone_hash, email_hash, payment_method_hash, ssn_last4_hash, equipment_id, channel, agent_id, region, promo_code, account_number, disconnect_reason, delinquent_balance
                </p>
              </div>
            </>
          ) : (
            /* Results panel */
            <UploadResults result={result} onReset={reset} />
          )}
        </div>
      </div>
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
          <p className="text-sm font-semibold text-gray-900">
            {result.status === 'completed' ? 'Upload Complete' : 'Upload Completed with Errors'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">
            {result.filename} — {result.processed} of {result.totalRows} rows processed ({successRate}%)
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Rows" value={result.totalRows} />
        <StatCard label="Processed" value={result.processed} color="text-green-600" />
        <StatCard label="Failed" value={result.failed} color={result.failed > 0 ? 'text-red-600' : 'text-gray-400'} />
      </div>

      {/* Error details */}
      {result.errors && result.errors.length > 0 && (
        <div className="mt-2">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">
            Errors ({result.errors.length})
          </h4>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Row</th>
                  <th className="text-left px-3 py-2 text-gray-500 font-medium">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {result.errors.map((err, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-gray-700 font-mono">{err.row}</td>
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
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-900' }: { label: string; value: number; color?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

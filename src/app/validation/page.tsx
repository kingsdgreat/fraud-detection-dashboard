'use client';

import { ValidationView } from '@/components/validation-view';

export default function ValidationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Synthetic Validation</h1>
        <p className="text-sm text-gray-500 mt-1">Scoring engine performance against generator labels</p>
      </div>
      <ValidationView />
    </div>
  );
}

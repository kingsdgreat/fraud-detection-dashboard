'use client';

import { ReviewQueueTable } from '@/components/review-queue-table';

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Review Queue</h1>
        <p className="text-sm text-gray-500 mt-1">Flagged cases requiring analyst review</p>
      </div>
      <ReviewQueueTable />
    </div>
  );
}

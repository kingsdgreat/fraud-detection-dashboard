'use client';

import { ReviewQueueTable } from '@/components/review-queue-table';

export default function QueuePage() {
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-[#11131a]">Review Queue</h1>
        <p className="text-[13px] text-[#8a90a0] mt-1">Flagged cases requiring analyst review</p>
      </div>
      <ReviewQueueTable />
    </div>
  );
}

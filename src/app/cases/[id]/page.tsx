'use client';

export const dynamic = 'force-dynamic';

import { use } from 'react';
import { CaseDetailView } from '@/components/case-detail-view';

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CaseDetailView caseId={id} />;
}

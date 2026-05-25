'use client';

import { use } from 'react';
import { RunDetail } from '@/components/runs/run-detail';

export default function RunDetailsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);
  return <RunDetail runId={runId} />;
}

'use client';

import { KpiCards } from '@/components/kpi-cards';
import {
  DetectionVolumeChart,
  RiskDistributionChart,
  ChannelChart,
  CompanyChart,
  PriorityQueue,
} from '@/components/overview-charts';
import { GeneratorControls } from '@/components/generator-controls';

export default function OverviewPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Disconnect-reconnect fraud detection summary</p>
      </div>

      <GeneratorControls />

      {/* 4 KPI cards */}
      <KpiCards />

      {/* Detection volume (1.7fr) + Risk distribution donut (1fr) */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-4">
        <DetectionVolumeChart />
        <RiskDistributionChart />
      </div>

      {/* Flagged by channel + Top agencies (50/50) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChannelChart />
        <CompanyChart />
      </div>

      {/* Priority queue mini-table */}
      <PriorityQueue />
    </div>
  );
}

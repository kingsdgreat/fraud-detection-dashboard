'use client';

import { KpiCards } from '@/components/kpi-cards';
import { ChannelChart, CompanyChart, RiskDistributionChart, ThirdPartyVsInternalChart } from '@/components/overview-charts';
import { GeneratorControls } from '@/components/generator-controls';

export default function OverviewPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500 mt-1">Disconnect-reconnect fraud detection summary</p>
      </div>

      <GeneratorControls />
      <KpiCards />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChannelChart />
        <RiskDistributionChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CompanyChart />
        <ThirdPartyVsInternalChart />
      </div>
    </div>
  );
}

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { useData } from '@/lib/data-context';
import { formatCurrency, formatPercent, isThirdParty } from '@/lib/utils';
import { ShieldAlert, AlertTriangle, DollarSign, TrendingUp } from 'lucide-react';

export function KpiCards() {
  const { cases } = useData();

  const totalOrders = cases.length;
  const flaggedCases = cases.filter(c => c.flagged).length;
  const commissionAtRisk = cases.filter(c => c.flagged).reduce((sum, c) => sum + c.commissionAtRisk, 0);
  const annualizedExposure = cases.filter(c => c.flagged).reduce((sum, c) => sum + c.annualizedExposure, 0);

  const thirdPartyCases = cases.filter(c => isThirdParty(c.order.channel));
  const thirdPartyFlagged = thirdPartyCases.filter(c => c.flagged).length;
  const thirdPartyRate = thirdPartyCases.length > 0 ? thirdPartyFlagged / thirdPartyCases.length : 0;

  const internalCases = cases.filter(c => !isThirdParty(c.order.channel));
  const internalFlagged = internalCases.filter(c => c.flagged).length;
  const internalRate = internalCases.length > 0 ? internalFlagged / internalCases.length : 0;

  const kpis = [
    {
      label: 'Total Orders',
      value: totalOrders.toLocaleString(),
      sub: `${flaggedCases} flagged (${formatPercent(flaggedCases / totalOrders)})`,
      icon: ShieldAlert,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Flagged Cases',
      value: flaggedCases.toLocaleString(),
      sub: `${cases.filter(c => c.riskBand === 'Critical').length} critical, ${cases.filter(c => c.riskBand === 'High').length} high`,
      icon: AlertTriangle,
      iconColor: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      label: 'Commission at Risk',
      value: formatCurrency(commissionAtRisk),
      sub: `Avg ${formatCurrency(flaggedCases > 0 ? commissionAtRisk / flaggedCases : 0)} per case`,
      icon: DollarSign,
      iconColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      label: 'Annualized Exposure',
      value: formatCurrency(annualizedExposure),
      sub: `3P: ${formatPercent(thirdPartyRate)} flag rate vs Internal: ${formatPercent(internalRate)}`,
      icon: TrendingUp,
      iconColor: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
                <p className="text-xs text-gray-500">{kpi.sub}</p>
              </div>
              <div className={`p-2.5 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

'use client';

import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { useData } from '@/lib/data-context';
import { channelLabel, isThirdParty, formatCurrency } from '@/lib/utils';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export function ChannelChart() {
  const { cases } = useData();

  const channelData = Object.entries(
    cases.reduce((acc, c) => {
      const ch = channelLabel(c.order.channel);
      if (!acc[ch]) acc[ch] = { total: 0, flagged: 0 };
      acc[ch].total++;
      if (c.flagged) acc[ch].flagged++;
      return acc;
    }, {} as Record<string, { total: number; flagged: number }>)
  ).map(([channel, data]) => ({
    channel,
    total: data.total,
    flagged: data.flagged,
    rate: Math.round((data.flagged / data.total) * 100),
  }))
  .sort((a, b) => b.flagged - a.flagged);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fraud Flags by Channel</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={channelData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" />
              <YAxis dataKey="channel" type="category" width={130} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: any, name: any) => [value, name === 'flagged' ? 'Flagged' : 'Clean']}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="flagged" fill="#ef4444" name="Flagged" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="total" fill="#e5e7eb" name="Total" stackId="b" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function CompanyChart() {
  const { cases } = useData();

  const companyData = Object.entries(
    cases.filter(c => c.flagged).reduce((acc, c) => {
      const name = c.order.companyName;
      if (!acc[name]) acc[name] = { count: 0, exposure: 0 };
      acc[name].count++;
      acc[name].exposure += c.commissionAtRisk;
      return acc;
    }, {} as Record<string, { count: number; exposure: number }>)
  )
  .map(([name, data]) => ({ name, ...data }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 8);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Companies by Flagged Cases</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={companyData} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={60} />
              <YAxis />
              <Tooltip
                formatter={(value: any, name: any) =>
                  name === 'exposure' ? [formatCurrency(value), 'Commission at Risk'] : [value, 'Cases']
                }
                contentStyle={{ fontSize: 12 }}
              />
              <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function RiskDistributionChart() {
  const { cases } = useData();

  const distribution = [
    { name: 'Critical', value: cases.filter(c => c.riskBand === 'Critical').length, color: '#ef4444' },
    { name: 'High', value: cases.filter(c => c.riskBand === 'High').length, color: '#f97316' },
    { name: 'Medium', value: cases.filter(c => c.riskBand === 'Medium').length, color: '#eab308' },
    { name: 'Low', value: cases.filter(c => c.riskBand === 'Low').length, color: '#22c55e' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Risk Distribution</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distribution}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {distribution.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ThirdPartyVsInternalChart() {
  const { cases } = useData();

  const thirdParty = cases.filter(c => isThirdParty(c.order.channel));
  const internal = cases.filter(c => !isThirdParty(c.order.channel));

  const data = [
    {
      segment: 'Third-Party',
      total: thirdParty.length,
      flagged: thirdParty.filter(c => c.flagged).length,
      exposure: thirdParty.filter(c => c.flagged).reduce((s, c) => s + c.commissionAtRisk, 0),
    },
    {
      segment: 'Internal',
      total: internal.length,
      flagged: internal.filter(c => c.flagged).length,
      exposure: internal.filter(c => c.flagged).reduce((s, c) => s + c.commissionAtRisk, 0),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Third-Party vs Internal</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {data.map(d => (
            <div key={d.segment} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{d.segment}</span>
                <span className="text-gray-500">{d.flagged} of {d.total} flagged ({Math.round(d.flagged / d.total * 100)}%)</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all"
                  style={{ width: `${(d.flagged / d.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-gray-500">Commission at risk: {formatCurrency(d.exposure)}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

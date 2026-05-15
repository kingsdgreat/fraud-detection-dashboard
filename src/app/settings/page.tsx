'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData } from '@/lib/data-context';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { Save, RotateCcw } from 'lucide-react';
import { DEFAULT_ASSUMPTIONS } from '@/lib/engine/scorer';

export default function SettingsPage() {
  const { assumptions, updateAssumptions } = useData();
  const [local, setLocal] = useState(assumptions);

  const handleSave = () => {
    updateAssumptions(local);
  };

  const handleReset = () => {
    setLocal(DEFAULT_ASSUMPTIONS);
    updateAssumptions(DEFAULT_ASSUMPTIONS);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Configure financial assumptions for exposure calculations</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Financial Assumptions</CardTitle>
          <CardDescription>
            These values are used to calculate commission at risk, MRR loss, and annualized exposure for each flagged case.
            Changes apply to all cases immediately.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium text-gray-700">Average Commission ($)</label>
              <Input
                type="number"
                value={local.avgCommission}
                onChange={e => setLocal(p => ({ ...p, avgCommission: parseFloat(e.target.value) || 150 }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Default commission per new connect order</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Recovery Probability</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                value={local.recoveryProbability}
                onChange={e => setLocal(p => ({ ...p, recoveryProbability: parseFloat(e.target.value) || 0.15 }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Likelihood of recovering revenue from a fraud case ({formatPercent(local.recoveryProbability)})</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Average Monthly Bill ($)</label>
              <Input
                type="number"
                value={local.avgMonthlyBill}
                onChange={e => setLocal(p => ({ ...p, avgMonthlyBill: parseFloat(e.target.value) || 120 }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Fallback when prior bill is unknown</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Average Promo Bill ($)</label>
              <Input
                type="number"
                value={local.avgPromoBill}
                onChange={e => setLocal(p => ({ ...p, avgPromoBill: parseFloat(e.target.value) || 49.99 }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Fallback when new promo bill is unknown</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Annualization Period (months)</label>
              <Input
                type="number"
                value={local.annualizationMonths}
                onChange={e => setLocal(p => ({ ...p, annualizationMonths: parseInt(e.target.value) || 12 }))}
                className="mt-1"
              />
              <p className="text-xs text-gray-500 mt-1">Months used to annualize MRR loss</p>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <p className="text-xs font-semibold text-gray-600 mb-2">Formula Preview</p>
              <div className="space-y-1 text-xs text-gray-600 font-mono">
                <p>Commission at risk = commission × (1 - {formatPercent(local.recoveryProbability)})</p>
                <p>MRR loss = (prior_bill - promo_bill) × {formatPercent(local.recoveryProbability)}</p>
                <p>Annualized exposure = MRR_loss × {local.annualizationMonths}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} size="sm">
                <Save className="h-3 w-3 mr-1" /> Apply Changes
              </Button>
              <Button variant="outline" size="sm" onClick={handleReset}>
                <RotateCcw className="h-3 w-3 mr-1" /> Reset to Defaults
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

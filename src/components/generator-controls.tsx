'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useData } from '@/lib/data-context';
import { Sliders, RotateCcw } from 'lucide-react';

export function GeneratorControls() {
  const { config, regenerate, isDemo } = useData();
  const [localConfig, setLocalConfig] = useState(config);

  if (isDemo) return null;

  const handleRegenerate = () => {
    regenerate(localConfig);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sliders className="h-4 w-4" /> Generator Controls
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500">Order Count</label>
            <Input
              type="number"
              value={localConfig.orderCount}
              onChange={e => setLocalConfig(p => ({ ...p, orderCount: parseInt(e.target.value) || 1500 }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Seed</label>
            <Input
              value={localConfig.seed}
              onChange={e => setLocalConfig(p => ({ ...p, seed: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">3P Fraud Rate</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={localConfig.thirdPartyFraudRate}
              onChange={e => setLocalConfig(p => ({ ...p, thirdPartyFraudRate: parseFloat(e.target.value) || 0.5 }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Internal Fraud Rate</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="1"
              value={localConfig.internalFraudRate}
              onChange={e => setLocalConfig(p => ({ ...p, internalFraudRate: parseFloat(e.target.value) || 0.02 }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Agent Count</label>
            <Input
              type="number"
              value={localConfig.agentCount}
              onChange={e => setLocalConfig(p => ({ ...p, agentCount: parseInt(e.target.value) || 80 }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Company Count</label>
            <Input
              type="number"
              value={localConfig.companyCount}
              onChange={e => setLocalConfig(p => ({ ...p, companyCount: parseInt(e.target.value) || 15 }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date Start</label>
            <Input
              type="date"
              value={localConfig.dateRangeStart}
              onChange={e => setLocalConfig(p => ({ ...p, dateRangeStart: e.target.value }))}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Date End</label>
            <Input
              type="date"
              value={localConfig.dateRangeEnd}
              onChange={e => setLocalConfig(p => ({ ...p, dateRangeEnd: e.target.value }))}
              className="mt-1"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button onClick={handleRegenerate} size="sm">
            <RotateCcw className="h-3 w-3 mr-1" /> Regenerate Data
          </Button>
          <Button variant="outline" size="sm" onClick={() => setLocalConfig(config)}>
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

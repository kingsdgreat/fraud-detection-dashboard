'use client';

import React, { createContext, useContext, useState, useMemo, useCallback } from 'react';
import type { ScoredCase, GeneratorConfig, FinancialAssumptions, ValidationMetrics, Order } from './types';
import { generateOrders } from './engine/generator';
import { scoreOrders, scoreOneOrder, computeValidationMetrics, DEFAULT_ASSUMPTIONS } from './engine/scorer';

interface DataState {
  cases: ScoredCase[];
  orders: Order[];
  config: GeneratorConfig;
  assumptions: FinancialAssumptions;
  validationMetrics: ValidationMetrics | null;
  isDemo: boolean;
  regenerate: (config?: Partial<GeneratorConfig>) => void;
  updateAssumptions: (a: Partial<FinancialAssumptions>) => void;
  getCaseById: (id: string) => ScoredCase | undefined;
  testOrder: (order: Order, companionOrders?: Order[]) => ScoredCase;
}

const DataContext = createContext<DataState | null>(null);

const DEFAULT_CONFIG: GeneratorConfig = {
  orderCount: 1500,
  seed: 'DEMO_SEED',
  overallFraudRate: 0.10,
  thirdPartyFraudRate: 0.50,
  internalFraudRate: 0.02,
  dateRangeStart: '2024-01-01',
  dateRangeEnd: '2024-06-30',
  regions: ['Northeast', 'Southeast', 'Midwest', 'West', 'Southwest'],
  agentCount: 80,
  companyCount: 15,
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const isDemo = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

  const [config, setConfig] = useState<GeneratorConfig>(DEFAULT_CONFIG);
  const [assumptions, setAssumptions] = useState<FinancialAssumptions>(DEFAULT_ASSUMPTIONS);

  const generatedOrders = useMemo(() => generateOrders(config), [config]);

  const cases = useMemo(() => {
    return scoreOrders(generatedOrders, assumptions);
  }, [generatedOrders, assumptions]);

  const validationMetrics = useMemo(() => computeValidationMetrics(cases), [cases]);

  const regenerate = useCallback((newConfig?: Partial<GeneratorConfig>) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  const updateAssumptions = useCallback((a: Partial<FinancialAssumptions>) => {
    setAssumptions(prev => ({ ...prev, ...a }));
  }, []);

  const getCaseById = useCallback(
    (id: string) => cases.find(c => c.order.id === id),
    [cases]
  );

  const testOrder = useCallback(
    (order: Order, companionOrders?: Order[]) => {
      const pool = companionOrders
        ? [...generatedOrders, ...companionOrders]
        : generatedOrders;
      return scoreOneOrder(order, pool, assumptions);
    },
    [generatedOrders, assumptions]
  );

  return (
    <DataContext.Provider
      value={{ cases, orders: generatedOrders, config, assumptions, validationMetrics, isDemo, regenerate, updateAssumptions, getCaseById, testOrder }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { ScoredCase, FinancialAssumptions, ValidationMetrics } from './types';
import { DEFAULT_ASSUMPTIONS } from './engine/scorer';

/**
 * Production case — a flattened version of what the API returns,
 * adapted to work with the same components that use the demo ScoredCase type.
 */
export interface ProductionCase {
  id: string;
  caseNumber: number;
  orderId: string;
  riskScore: number;
  riskBand: string;
  status: string;
  priority: string;
  resolution: string | null;
  evidence: any[];
  identitySignals: any;
  financialImpact: any;
  slaDueAt: string | null;
  createdAt: string;
  assigneeName: string | null;
  assigneeEmail: string | null;
  // Order data
  customerName: string;
  orderDate: string;
  orderType: string;
  address: string;
  city: string;
  state: string;
  region: string;
  channel: string;
}

export interface ProductionCaseDetail {
  case: any;
  order: any;
  assignee: any;
  comments: any[];
}

interface ProductionDataState {
  // Case list
  cases: ProductionCase[];
  totalCases: number;
  casesLoading: boolean;
  casesPage: number;
  casesPageSize: number;
  setCasesPage: (page: number) => void;
  setCasesFilters: (filters: CaseFilters) => void;
  refreshCases: () => void;

  // Single case detail
  getCaseDetail: (id: string) => Promise<ProductionCaseDetail | null>;

  // Dashboard stats
  dashboardStats: DashboardStats | null;
  statsLoading: boolean;
  refreshStats: () => void;

  // Case actions
  assignCase: (caseId: string, analystId: string) => Promise<boolean>;
  escalateCase: (caseId: string, reason: string) => Promise<boolean>;
  resolveCase: (caseId: string, resolution: string, note: string) => Promise<boolean>;
  addComment: (caseId: string, content: string) => Promise<boolean>;

  // Mode
  isDemo: false;
}

interface CaseFilters {
  status?: string;
  riskBand?: string;
  assignedTo?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface DashboardStats {
  totalOrders: number;
  totalCases: number;
  averageRiskScore: number;
  slaOverdue: number;
  unassignedOpen: number;
  byStatus: Record<string, number>;
  byRiskBand: Record<string, number>;
  byResolution: Record<string, number>;
}

const ProductionDataContext = createContext<ProductionDataState | null>(null);

export function ProductionDataProvider({ children }: { children: React.ReactNode }) {
  const [cases, setCases] = useState<ProductionCase[]>([]);
  const [totalCases, setTotalCases] = useState(0);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesPage, setCasesPage] = useState(1);
  const [casesPageSize] = useState(25);
  const [casesFilters, setCasesFiltersState] = useState<CaseFilters>({});
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Fetch cases
  const fetchCases = useCallback(async () => {
    setCasesLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(casesPage),
        pageSize: String(casesPageSize),
      });
      if (casesFilters.status) params.set('status', casesFilters.status);
      if (casesFilters.riskBand) params.set('riskBand', casesFilters.riskBand);
      if (casesFilters.assignedTo) params.set('assignedTo', casesFilters.assignedTo);
      if (casesFilters.dateFrom) params.set('dateFrom', casesFilters.dateFrom);
      if (casesFilters.dateTo) params.set('dateTo', casesFilters.dateTo);

      const res = await fetch(`/api/v1/cases?${params}`);
      if (!res.ok) throw new Error('Failed to fetch cases');
      const json = await res.json();
      setCases(json.data);
      setTotalCases(json.pagination.total);
    } catch (err) {
      console.error('Error fetching cases:', err);
    } finally {
      setCasesLoading(false);
    }
  }, [casesPage, casesPageSize, casesFilters]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch('/api/v1/dashboard');
      if (!res.ok) throw new Error('Failed to fetch stats');
      const json = await res.json();
      setDashboardStats(json);
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Get single case detail
  const getCaseDetail = useCallback(async (id: string): Promise<ProductionCaseDetail | null> => {
    try {
      const res = await fetch(`/api/v1/cases/${id}`);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  // Case actions
  const assignCase = useCallback(async (caseId: string, analystId: string) => {
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analystId }),
      });
      if (res.ok) { fetchCases(); return true; }
      return false;
    } catch { return false; }
  }, [fetchCases]);

  const escalateCase = useCallback(async (caseId: string, reason: string) => {
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) { fetchCases(); return true; }
      return false;
    } catch { return false; }
  }, [fetchCases]);

  const resolveCase = useCallback(async (caseId: string, resolution: string, note: string) => {
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution, note }),
      });
      if (res.ok) { fetchCases(); return true; }
      return false;
    } catch { return false; }
  }, [fetchCases]);

  const addComment = useCallback(async (caseId: string, content: string) => {
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      return res.ok;
    } catch { return false; }
  }, []);

  const setCasesFilters = useCallback((filters: CaseFilters) => {
    setCasesFiltersState(filters);
    setCasesPage(1);
  }, []);

  return (
    <ProductionDataContext.Provider
      value={{
        cases,
        totalCases,
        casesLoading,
        casesPage,
        casesPageSize,
        setCasesPage,
        setCasesFilters,
        refreshCases: fetchCases,
        getCaseDetail,
        dashboardStats,
        statsLoading,
        refreshStats: fetchStats,
        assignCase,
        escalateCase,
        resolveCase,
        addComment,
        isDemo: false,
      }}
    >
      {children}
    </ProductionDataContext.Provider>
  );
}

export function useProductionData() {
  const ctx = useContext(ProductionDataContext);
  if (!ctx) throw new Error('useProductionData must be used within ProductionDataProvider');
  return ctx;
}

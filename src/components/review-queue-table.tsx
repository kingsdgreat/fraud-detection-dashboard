'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
} from '@tanstack/react-table';
import type { ScoredCase } from '@/lib/types';
import { useData } from '@/lib/data-context';
import { formatCurrency, archetypeLabel } from '@/lib/utils';
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

/* ── Risk color maps ─────────────────────────────────────────── */
const RISK_COLORS: Record<string, { fg: string; bg: string; bar: string }> = {
  Critical: { fg: '#dc2626', bg: '#fef2f2', bar: '#dc2626' },
  High:     { fg: '#c2410c', bg: '#fff7ed', bar: '#ea580c' },
  Medium:   { fg: '#b45309', bg: '#fffbeb', bar: '#d97706' },
  Low:      { fg: '#15803d', bg: '#f0fdf4', bar: '#16a34a' },
};

const BAND_ORDER: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };

/* ── Column helper ───────────────────────────────────────────── */
const columnHelper = createColumnHelper<ScoredCase>();

const columns = [
  /* Color risk bar */
  columnHelper.display({
    id: 'riskBar',
    header: '',
    cell: ({ row }) => {
      const colors = RISK_COLORS[row.original.riskBand] || RISK_COLORS.Low;
      return (
        <span
          className="block rounded-[3px]"
          style={{ width: 5, height: 34, background: colors.bar }}
        />
      );
    },
    size: 4,
  }),

  /* Order ID */
  columnHelper.accessor('order.id', {
    header: 'Order ID',
    cell: info => (
      <span className="text-[12.5px] font-mono font-medium text-[var(--brand-d)]">
        {info.getValue()}
      </span>
    ),
    size: 110,
  }),

  /* Score badge */
  columnHelper.accessor('riskScore', {
    header: 'Score',
    cell: ({ row }) => {
      const colors = RISK_COLORS[row.original.riskBand] || RISK_COLORS.Low;
      return (
        <span
          className="inline-flex items-center justify-center min-w-[38px] h-[25px] rounded-[7px] text-[13px] font-semibold font-mono"
          style={{ background: colors.bg, color: colors.fg }}
        >
          {row.original.riskScore}
        </span>
      );
    },
    size: 52,
    enableSorting: true,
  }),

  /* Customer + Pattern (two lines) */
  columnHelper.accessor('order.customerName', {
    id: 'customerPattern',
    header: 'Customer · Pattern',
    cell: ({ row }) => {
      const o = row.original.order;
      const archetype = o._archetype ? archetypeLabel(o._archetype) : '';
      const addrShort = [o.address, o.city, o.state].filter(Boolean).join(', ');
      return (
        <span className="block min-w-0">
          <span className="block text-[13px] font-medium text-[#11131a] truncate">
            {o.customerName}
          </span>
          <span className="block text-[11.5px] text-[#9098a6] truncate">
            {archetype}{archetype && addrShort ? ' · ' : ''}{addrShort}
          </span>
        </span>
      );
    },
    enableSorting: false,
  }),

  /* Agent + Agency (two lines) */
  columnHelper.accessor('order.agentCode', {
    id: 'agentAgency',
    header: 'Agent · Agency',
    cell: ({ row }) => {
      const o = row.original.order;
      return (
        <span className="block min-w-0">
          <span className="block text-[12px] font-mono text-[#3b4150] truncate">
            {o.agentCode}
          </span>
          <span className="block text-[11px] text-[#9098a6] truncate">
            {o.companyName}
          </span>
        </span>
      );
    },
    enableSorting: false,
  }),

  /* Risk band (dot + label) */
  columnHelper.accessor('riskBand', {
    header: 'Risk',
    cell: ({ row }) => {
      const band = row.original.riskBand;
      const colors = RISK_COLORS[band] || RISK_COLORS.Low;
      return (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-[7px] h-[7px] rounded-full"
            style={{ background: colors.bar }}
          />
          <span className="text-[12.5px] font-medium" style={{ color: colors.fg }}>
            {band}
          </span>
        </span>
      );
    },
    sortingFn: (a, b) =>
      (BAND_ORDER[a.original.riskBand] || 0) - (BAND_ORDER[b.original.riskBand] || 0),
  }),

  /* Days since disconnect */
  columnHelper.accessor(row => row.order.daysSinceDisconnect ?? null, {
    id: 'daysDC',
    header: 'Days DC',
    cell: info => {
      const val = info.getValue();
      if (val === null || val === undefined) return <span className="text-[#9098a6]">&mdash;</span>;
      const isUrgent = val <= 7;
      const isWarn = val > 7 && val <= 14;
      return (
        <span
          className="text-[12.5px] font-mono"
          style={{
            color: isUrgent ? '#dc2626' : isWarn ? '#c2410c' : '#8b90a0',
            fontWeight: isUrgent ? 600 : 500,
          }}
        >
          {val}d
        </span>
      );
    },
  }),

  /* Commission */
  columnHelper.accessor('commissionAtRisk', {
    header: 'Comm.',
    cell: info => {
      const val = info.getValue();
      return (
        <span className="text-[12.5px] font-mono text-[#11131a] text-right block">
          {val > 0 ? formatCurrency(val) : '—'}
        </span>
      );
    },
  }),
];

/* ── Sort indicator ──────────────────────────────────────────── */
function SortIndicator({ column }: { column: any }) {
  const sorted = column.getIsSorted();
  if (!column.getCanSort()) return null;
  return (
    <span className="inline-flex flex-col ml-0.5 -my-1 text-[#b0b4be]">
      <ChevronUp className={`h-2.5 w-2.5 ${sorted === 'asc' ? 'text-[var(--brand)]' : ''}`} />
      <ChevronDown className={`h-2.5 w-2.5 -mt-0.5 ${sorted === 'desc' ? 'text-[var(--brand)]' : ''}`} />
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────── */
export function ReviewQueueTable() {
  const { cases } = useData();
  const router = useRouter();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'riskScore', desc: true }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  /* Filter by risk band */
  const filteredCases = useMemo(() => {
    let filtered = cases.filter(c => c.flagged);
    if (riskFilter !== 'all') {
      filtered = filtered.filter(c => c.riskBand === riskFilter);
    }
    return filtered;
  }, [cases, riskFilter]);

  /* Band counts (always based on all flagged) */
  const bandCounts = useMemo(() => {
    const flagged = cases.filter(c => c.flagged);
    return {
      all: flagged.length,
      Critical: flagged.filter(c => c.riskBand === 'Critical').length,
      High: flagged.filter(c => c.riskBand === 'High').length,
      Medium: flagged.filter(c => c.riskBand === 'Medium').length,
      Low: flagged.filter(c => c.riskBand === 'Low').length,
    };
  }, [cases]);

  const table = useReactTable({
    data: filteredCases,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = filterValue.toLowerCase();
      const o = row.original.order;
      return [o.id, o.customerName, o.agentCode, o.companyName, o.address, o.city, o.state]
        .some(v => v?.toLowerCase().includes(q));
    },
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalRows = table.getFilteredRowModel().rows.length;
  const pageCount = table.getPageCount();

  return (
    <div>
      {/* ── Search + filter chips ─────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-[18px]">
        {/* Search input */}
        <div className="relative flex-1 max-w-[340px] min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-[15px] w-[15px] text-[#9aa0ad] pointer-events-none" />
          <input
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            placeholder="Search orders, customers, agents…"
            className="w-full py-[9px] pl-[35px] pr-3 border border-[#e2e4ea] rounded-[9px] text-[13px] bg-white text-[#11131a] outline-none placeholder:text-[#9aa0ad] focus:border-[var(--brand)] focus:shadow-[0_0_0_3px_var(--brand-soft)] transition-shadow"
          />
        </div>

        {/* Risk band chips */}
        <div className="flex gap-[7px]">
          {(['all', 'Critical', 'High', 'Medium', 'Low'] as const).map(band => {
            const isActive = riskFilter === band;
            const label = band === 'all' ? 'All' : band;
            const count = bandCounts[band];
            return (
              <button
                key={band}
                onClick={() => setRiskFilter(band)}
                className={`inline-flex items-center gap-1.5 px-3 py-[6px] rounded-lg text-[12.5px] font-medium cursor-pointer transition-all duration-100 border whitespace-nowrap ${
                  isActive
                    ? 'bg-[var(--brand)] text-white border-[var(--brand)]'
                    : 'bg-white text-[#4b5161] border-[#e6e8ee] hover:border-[#d0d3db]'
                }`}
              >
                {label}{' '}
                <span className={`font-mono ${isActive ? 'opacity-80' : 'opacity-60'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Table card ────────────────────────────────────────── */}
      <div className="bg-white border border-[#ebedf2] rounded-[14px] overflow-hidden shadow-[0_1px_2px_rgba(16,18,30,0.04)]">
        {/* Header row */}
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-[#fafbfc] border-b border-[#ebedf2]">
                  {headerGroup.headers.map(header => {
                    const canSort = header.column.getCanSort();
                    return (
                      <th
                        key={header.id}
                        className={`px-[18px] py-[11px] text-left text-[10.5px] font-semibold tracking-[0.05em] uppercase text-[#8a90a0] select-none ${
                          canSort ? 'cursor-pointer hover:text-[#5a6070]' : ''
                        } ${header.id === 'commissionAtRisk' ? 'text-right' : ''}`}
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        style={
                          header.id === 'riskBar' ? { width: 4, padding: '11px 0 11px 18px' } : undefined
                        }
                      >
                        <span className="inline-flex items-center gap-[3px]">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                          {canSort && <SortIndicator column={header.column} />}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  onClick={() => router.push(`/cases/${row.original.order.id}`)}
                  className="border-b border-[#f2f3f6] cursor-pointer transition-colors duration-100 hover:bg-[#fafbfd]"
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      className={`px-[18px] py-[var(--row-py,12px)] ${
                        cell.column.id === 'riskBar' ? '!pl-[18px] !pr-0 w-1' : ''
                      }`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
              {table.getRowModel().rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="text-center py-16 text-[13px] text-[#9098a6]">
                    No cases match your search or filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer / pagination */}
        <div className="flex items-center justify-between px-[18px] py-[13px] text-[12px] text-[#8a90a0] border-t border-[#f2f3f6]">
          <span>
            Showing{' '}
            <span className="font-mono text-[#4b5161]">
              {totalRows === 0 ? 0 : pageIndex * pageSize + 1}
              &ndash;
              {Math.min((pageIndex + 1) * pageSize, totalRows)}
            </span>{' '}
            of {totalRows} flagged cases
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-[10px] py-[5px] border border-[#e6e8ee] rounded-[7px] bg-white text-[12px] disabled:text-[#c0c4ce] text-[#6b7180] hover:bg-[#f6f7f9] disabled:hover:bg-white transition-colors"
            >
              &larr;
            </button>
            <span className="text-[12px] px-1">
              Page {pageIndex + 1} of {pageCount || 1}
            </span>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-[10px] py-[5px] border border-[#e6e8ee] rounded-[7px] bg-white text-[12px] disabled:text-[#c0c4ce] text-[#6b7180] hover:bg-[#f6f7f9] disabled:hover:bg-white transition-colors"
            >
              &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

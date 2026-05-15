'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  createColumnHelper,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import type { ScoredCase } from '@/lib/types';
import { useData } from '@/lib/data-context';
import { RiskBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCurrency, channelLabel, archetypeLabel, formatDate } from '@/lib/utils';
import { ArrowUpDown, ChevronLeft, ChevronRight, Search, ExternalLink } from 'lucide-react';

const columnHelper = createColumnHelper<ScoredCase>();

const columns = [
  columnHelper.accessor('riskBand', {
    header: 'Risk',
    cell: info => <RiskBadge band={info.getValue()} />,
    sortingFn: (a, b) => {
      const order = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      return (order[a.original.riskBand] || 0) - (order[b.original.riskBand] || 0);
    },
  }),
  columnHelper.accessor('riskScore', {
    header: 'Score',
    cell: info => <span className="font-mono text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('order.id', {
    header: 'Order ID',
    cell: info => (
      <Link href={`/cases/${info.getValue()}`} className="text-blue-600 hover:text-blue-800 font-medium text-sm flex items-center gap-1">
        {info.getValue()} <ExternalLink className="h-3 w-3" />
      </Link>
    ),
  }),
  columnHelper.accessor(row => row.order._archetype || '', {
    id: 'archetype',
    header: 'Archetype',
    cell: info => info.getValue() ? (
      <span className="text-xs text-gray-600">{archetypeLabel(info.getValue())}</span>
    ) : <span className="text-xs text-gray-400">—</span>,
  }),
  columnHelper.accessor('order.customerName', {
    header: 'Customer',
    cell: info => <span className="text-sm">{info.getValue()}</span>,
  }),
  columnHelper.accessor('order.agentCode', {
    header: 'Agent',
    cell: info => <span className="font-mono text-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor('order.companyName', {
    header: 'Company',
    cell: info => <span className="text-xs">{info.getValue()}</span>,
  }),
  columnHelper.accessor('order.channel', {
    header: 'Channel',
    cell: info => <span className="text-xs">{channelLabel(info.getValue())}</span>,
  }),
  columnHelper.accessor(row => row.order.daysSinceDisconnect ?? null, {
    id: 'daysSinceDisconnect',
    header: 'Days Since DC',
    cell: info => {
      const val = info.getValue();
      if (val === null || val === undefined) return <span className="text-gray-400">—</span>;
      return <span className={`text-sm font-mono ${val <= 7 ? 'text-red-600 font-bold' : val <= 14 ? 'text-orange-600' : ''}`}>{val}d</span>;
    },
  }),
  columnHelper.accessor('commissionAtRisk', {
    header: 'Commission Risk',
    cell: info => <span className="text-sm font-medium">{formatCurrency(info.getValue())}</span>,
  }),
  columnHelper.accessor('recommendedAction', {
    header: 'Action',
    cell: info => <span className="text-xs text-gray-600 max-w-[200px] truncate block">{info.getValue()}</span>,
  }),
];

export function ReviewQueueTable() {
  const { cases } = useData();
  const [sorting, setSorting] = useState<SortingState>([{ id: 'riskScore', desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState<string>('all');

  const filteredCases = useMemo(() => {
    let filtered = cases.filter(c => c.flagged);
    if (riskFilter !== 'all') {
      filtered = filtered.filter(c => c.riskBand === riskFilter);
    }
    return filtered;
  }, [cases, riskFilter]);

  const table = useReactTable({
    data: filteredCases,
    columns,
    state: { sorting, columnFilters, globalFilter },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search orders, agents, companies..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'Critical', 'High', 'Medium'].map(band => (
            <Button
              key={band}
              variant={riskFilter === band ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRiskFilter(band)}
            >
              {band === 'all' ? 'All' : band}
              {band !== 'all' && (
                <span className="ml-1 text-xs opacity-70">
                  ({cases.filter(c => c.flagged && c.riskBand === band).length})
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id} className="bg-gray-50 border-b border-gray-200">
                  {headerGroup.headers.map(header => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center gap-1">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        <ArrowUpDown className="h-3 w-3 text-gray-400" />
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="px-3 py-2.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
          {Math.min(
            (table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize,
            filteredCases.length
          )}{' '}
          of {filteredCases.length} flagged cases
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
          <Button variant="outline" size="sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

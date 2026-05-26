import React, { useMemo, useState } from 'react';
import { ArrowUp, ArrowDown, Download } from 'lucide-react';
import { KPI_LINES } from '../utils/trendData';
import { getTableColumns, formatCellValue } from '../utils/trendTable';
import { motion } from 'framer-motion';

interface Props {
  trendData: Record<string, any>[];
  compareData: Record<string, any>[];
  selectedKpis: Set<string>;
  compareEnabled: boolean;
}

export default function TrendDataTable({ trendData, compareData, selectedKpis, compareEnabled }: Props) {
  const [sortKey, setSortKey] = useState<string>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const columns = useMemo(() => getTableColumns(selectedKpis), [selectedKpis]);
  const compareColumns = useMemo(() => {
    if (!compareEnabled) return [];
    return columns.filter(c => c.key !== 'date').map(c => ({
      ...c, key: c.key + '_prev', label: c.label + '(上期)',
    }));
  }, [columns, compareEnabled]);

  const sortedData = useMemo(() => {
    const data = [...trendData];
    const key = sortKey === 'date' ? 'date' : sortKey;
    return data.sort((a, b) => {
      const va = a[key] ?? 0; const vb = b[key] ?? 0;
      if (key === 'date') return sortDir === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      return sortDir === 'asc' ? (Number(va) - Number(vb)) : (Number(vb) - Number(va));
    });
  }, [trendData, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.label);
    const rows = sortedData.map(d => columns.map(c => formatCellValue(d[c.key], c)));
    const csv = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `趋势明细_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!trendData.length) return null;

  const isNumeric = (key: string) => key !== 'date';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      className="bg-pdd-card rounded-xl border border-pdd-border p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pdd-text">
          趋势明细 <span className="text-xs font-normal text-[var(--pdd-text-secondary)]">({sortedData.length}条)</span>
        </h3>
        <button onClick={exportCSV}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-primary)] transition-colors">
          <Download size={12} />导出CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-pdd-text-secondary border-b border-pdd-border">
              {columns.map(c => (
                <th key={c.key}
                  onClick={() => handleSort(c.key)}
                  className={`py-1.5 px-2 font-medium cursor-pointer hover:text-pdd-primary-light whitespace-nowrap ${c.key === 'date' ? 'sticky left-0 bg-pdd-card z-10' : ''}`}
                  style={c.key === 'date' ? { boxShadow: '1px 0 3px rgba(0,0,0,0.06)' } : undefined}
                >
                  <div className={`flex items-center gap-1 ${isNumeric(c.key) ? 'justify-end' : 'justify-start'}`}>
                    {c.key !== 'date' && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.color }} />}
                    {c.label}
                    {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </div>
                </th>
              ))}
              {compareColumns.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)}
                  className="py-1.5 px-2 font-medium cursor-pointer hover:text-pdd-primary-light whitespace-nowrap text-[var(--pdd-text-muted)] opacity-60"
                >
                  <div className="flex items-center gap-1 justify-end">
                    {c.label}
                    {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />)}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, i) => (
              <tr key={i} className={`${i % 2 === 1 ? 'bg-[var(--pdd-bg)]/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 border-b border-[var(--pdd-border)]/50`}>
                {columns.map(c => (
                  <td key={c.key}
                    className={`py-1.5 px-2 whitespace-nowrap ${isNumeric(c.key) ? 'text-right tabular-nums' : 'text-left'} ${c.key === 'date' ? 'sticky left-0 bg-pdd-card font-medium text-[var(--pdd-text-secondary)] z-10' : 'text-pdd-text'}`}
                    style={c.key === 'date' ? { boxShadow: '1px 0 3px rgba(0,0,0,0.06)' } : undefined}
                  >
                    {formatCellValue(row[c.key], c)}
                  </td>
                ))}
                {compareColumns.map(c => (
                  <td key={c.key} className="py-1.5 px-2 whitespace-nowrap text-right tabular-nums text-[var(--pdd-text-muted)] opacity-60">
                    {formatCellValue(row[c.key], c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

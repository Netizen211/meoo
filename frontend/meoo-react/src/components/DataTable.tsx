import React, { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ChevronUp, ChevronDown, Search, Download, Settings, ChevronLeft, ChevronRight } from 'lucide-react';

interface Column<T> {
  key: string;
  title: string;
  width?: number;
  render?: (row: T) => React.ReactNode;
  sorter?: (a: T, b: T) => number;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: keyof T;
  title?: string;
  exportFileName?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  rowKey,
  title,
  exportFileName = 'data',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);

  const visibleColumns = useMemo(() => columns.filter(c => !hiddenCols.has(c.key)), [columns, hiddenCols]);

  const filteredData = useMemo(() => {
    if (!search) return data;
    const s = search.toLowerCase();
    return data.filter(row =>
      visibleColumns.some(col => {
        const val = row[col.key];
        return val != null && String(val).toLowerCase().includes(s);
      })
    );
  }, [data, search, visibleColumns]);

  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const col = columns.find(c => c.key === sortKey);
    if (!col?.sorter) return filteredData;
    return [...filteredData].sort((a, b) => {
      const r = col.sorter!(a, b);
      return sortOrder === 'asc' ? r : -r;
    });
  }, [filteredData, sortKey, sortOrder, columns]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  }, [sortKey]);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const pageIds = pagedData.map(row => String(row[rowKey]));
    const allSelected = pageIds.every(id => selected.has(id));
    setSelected(prev => {
      const next = new Set(prev);
      pageIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
      return next;
    });
  }, [pagedData, selected, rowKey]);

  const exportCSV = useCallback(() => {
    const headers = visibleColumns.map(c => c.title).join(',');
    const rows = sortedData.map(row =>
      visibleColumns.map(c => {
        const val = row[c.key];
        return val == null ? '' : String(val).replace(/,/g, ';');
      }).join(',')
    );
    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${exportFileName}.csv`;
    link.click();
  }, [sortedData, visibleColumns, exportFileName]);

  const toggleCol = useCallback((key: string) => {
    setHiddenCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  return (
    <div className="pdd-card overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 border-b border-[var(--pdd-border)] flex-wrap">
        {title && <h3 className="text-sm font-semibold mr-auto">{title}</h3>}
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <Search size={14} className="text-[var(--pdd-text-secondary)]" />
          <input
            type="text"
            placeholder="搜索..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="flex-1 text-xs bg-transparent outline-none"
          />
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--pdd-border)] text-xs hover:border-pdd-primary hover:text-pdd-primary">
          <Download size={12} />导出
        </button>
        <div className="relative">
          <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1 px-2 py-1 rounded border border-[var(--pdd-border)] text-xs hover:border-pdd-primary">
            <Settings size={12} />列
          </button>
          {showSettings && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="absolute right-0 top-full mt-1 w-40 bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-lg shadow-lg z-20 p-2">
              {columns.map(c => (
                <div key={c.key} className="flex items-center gap-2 py-1 text-xs cursor-pointer" onClick={() => toggleCol(c.key)}>
                  <input type="checkbox" checked={!hiddenCols.has(c.key)} readOnly className="accent-pdd-primary" />
                  <span className="truncate">{c.title}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-[var(--pdd-bg)]">
            <tr>
              <th className="py-2 px-2 w-8">
                <input type="checkbox" checked={pagedData.length > 0 && pagedData.every(r => selected.has(String(r[rowKey])))} onChange={toggleSelectAll} className="accent-pdd-primary" />
              </th>
              {visibleColumns.map(col => (
                <th key={col.key} className="py-2 px-2 text-left font-medium cursor-pointer hover:bg-pdd-bg" onClick={() => col.sorter && handleSort(col.key)} style={{ width: col.width }}>
                  <div className="flex items-center gap-1">
                    {col.title}
                    {col.sorter && sortKey === col.key && (
                      sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pagedData.map((row, i) => {
              const id = String(row[rowKey]);
              return (
                <tr key={id} className={`border-b border-pdd-border ${i % 2 ? 'bg-pdd-bg' : ''} hover:bg-pdd-primary-light/10`}>
                  <td className="py-2 px-2">
                    <input type="checkbox" checked={selected.has(id)} onChange={() => toggleSelect(id)} className="accent-pdd-primary" />
                  </td>
                  {visibleColumns.map(col => (
                    <td key={col.key} className="py-2 px-2 truncate" style={{ maxWidth: col.width }}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between p-3 border-t border-[var(--pdd-border)] text-xs">
        <div className="flex items-center gap-2">
          <span className="text-[var(--pdd-text-secondary)]">每页</span>
          <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }} className="bg-[var(--pdd-bg)] border border-[var(--pdd-border)] rounded px-1 py-0.5">
            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <span className="text-[var(--pdd-text-secondary)]">条，共{sortedData.length}条</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-[var(--pdd-bg)] disabled:opacity-30">
            <ChevronLeft size={14} />
          </button>
          <span className="px-2">{page}/{Math.max(1, totalPages)}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="p-1 rounded hover:bg-[var(--pdd-bg)] disabled:opacity-30">
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
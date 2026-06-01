import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Filter, Download, MoreHorizontal, Check, X, GripVertical } from 'lucide-react';

interface Column {
  key: string;
  label: string;
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
  fixed?: 'left' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

interface DataGridProps {
  columns: Column[];
  data: any[];
  rowKey?: string;
  selectable?: boolean;
  expandable?: boolean;
  virtualScroll?: boolean;
  rowHeight?: number;
  maxHeight?: number;
  onRowClick?: (row: any) => void;
  batchActions?: { label: string; onClick: (selected: any[]) => void }[];
}

export default function DataGrid({
  columns,
  data,
  rowKey = 'id',
  selectable = true,
  expandable = false,
  virtualScroll = false,
  rowHeight = 40,
  maxHeight = 400,
  onRowClick,
  batchActions = []
}: DataGridProps) {
  const [sortConfig, setSortConfig] = useState<{ key: string; desc: boolean } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(columns.map(c => c.key)));
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    let result = [...data];
    Object.entries(filters).forEach(([key, value]) => {
      if (value) {
        result = result.filter(row => String(row[key] || '').toLowerCase().includes(value.toLowerCase()));
      }
    });
    if (sortConfig) {
      result.sort((a, b) => {
        const av = a[sortConfig.key], bv = b[sortConfig.key];
        if (typeof av === 'number' && typeof bv === 'number') {
          return sortConfig.desc ? bv - av : av - bv;
        }
        return sortConfig.desc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
      });
    }
    return result;
  }, [data, filters, sortConfig]);

  const virtualData = useMemo(() => {
    if (!virtualScroll) return filteredData;
    const startIdx = Math.floor(scrollTop / rowHeight);
    const visibleCount = Math.ceil(maxHeight / rowHeight) + 2;
    return filteredData.slice(startIdx, startIdx + visibleCount);
  }, [filteredData, scrollTop, virtualScroll, rowHeight, maxHeight]);

  const toggleSort = (key: string) => {
    setSortConfig(prev => prev?.key === key ? { key, desc: !prev.desc } : { key, desc: true });
  };

  const toggleSelect = (id: string) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedRows(prev => prev.size === filteredData.length ? new Set() : new Set(filteredData.map(r => r[rowKey])));
  };

  const toggleExpand = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportCSV = () => {
    const headers = columns.filter(c => visibleCols.has(c.key)).map(c => c.label);
    const rows = filteredData.map(row => columns.filter(c => visibleCols.has(c.key)).map(c => row[c.key]));
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const fixedLeftCols = columns.filter(c => c.fixed === 'left' && visibleCols.has(c.key));
  const fixedRightCols = columns.filter(c => c.fixed === 'right' && visibleCols.has(c.key));
  const scrollCols = columns.filter(c => !c.fixed && visibleCols.has(c.key));

  return (
    <div className="bg-pdd-card rounded border border-pdd-border overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-pdd-border bg-pdd-bg">
        <div className="flex items-center gap-2">
          {selectable && (
            <>
              <button onClick={toggleSelectAll} className="flex items-center gap-1 px-2 py-1 text-xs border border-pdd-border rounded hover:border-pdd-primary">
                <Check size={12} /> 全选
              </button>
              {selectedRows.size > 0 && (
                <span className="text-xs text-pdd-text-secondary">已选 {selectedRows.size} 项</span>
              )}
            </>
          )}
          {batchActions.length > 0 && selectedRows.size > 0 && (
            <div className="flex items-center gap-1">
              {batchActions.map((action, i) => (
                <button key={i} onClick={() => action.onClick(filteredData.filter(r => selectedRows.has(r[rowKey])))}
                  className="px-2 py-1 text-xs bg-pdd-primary text-white rounded hover:bg-pdd-primary-dark">
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 text-xs border border-pdd-border rounded hover:border-pdd-primary">
            <Download size={12} /> 导出
          </button>
        </div>
      </div>

      {/* Table */}
      <div ref={containerRef} className="overflow-auto" style={{ maxHeight }} onScroll={e => setScrollTop(e.currentTarget.scrollTop)}>
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-pdd-bg z-10">
            <tr className="border-b border-pdd-border">
              {selectable && <th className="py-2 px-2 w-8"><input type="checkbox" checked={selectedRows.size === filteredData.length && filteredData.length > 0} onChange={toggleSelectAll} /></th>}
              {expandable && <th className="py-2 px-2 w-8"></th>}
              {fixedLeftCols.map(col => (
                <th key={col.key} className="py-2 px-2 text-left font-medium text-pdd-text-secondary sticky left-0 bg-pdd-bg" style={{ width: col.width }}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <button onClick={() => toggleSort(col.key)}><ChevronDown size={12} className={sortConfig?.key === col.key ? 'text-pdd-primary' : ''} /></button>}
                  </div>
                </th>
              ))}
              {scrollCols.map(col => (
                <th key={col.key} className="py-2 px-2 text-left font-medium text-pdd-text-secondary" style={{ width: col.width }}>
                  <div className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && <button onClick={() => toggleSort(col.key)}><ChevronDown size={12} className={sortConfig?.key === col.key ? 'text-pdd-primary' : ''} /></button>}
                    {col.filterable && (
                      <input type="text" placeholder="筛选" value={filters[col.key] || ''} onChange={e => setFilters(p => ({ ...p, [col.key]: e.target.value }))}
                        className="w-16 px-1 py-0.5 text-[10px] border border-pdd-border rounded" />
                    )}
                  </div>
                </th>
              ))}
              {fixedRightCols.map(col => (
                <th key={col.key} className="py-2 px-2 text-left font-medium text-pdd-text-secondary sticky right-0 bg-pdd-bg" style={{ width: col.width }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {virtualData.map((row, idx) => (
              <React.Fragment key={row[rowKey]}>
                <tr className={`border-b border-pdd-border hover:bg-pdd-bg ${selectedRows.has(row[rowKey]) ? 'bg-pdd-primary-light/10' : ''} ${idx % 2 === 1 ? 'bg-pdd-bg' : ''}`}
                  onClick={() => onRowClick?.(row)}>
                  {selectable && <td className="py-2 px-2"><input type="checkbox" checked={selectedRows.has(row[rowKey])} onChange={() => toggleSelect(row[rowKey])} /></td>}
                  {expandable && (
                    <td className="py-2 px-2">
                      <button onClick={() => toggleExpand(row[rowKey])}>
                        {expandedRows.has(row[rowKey]) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </button>
                    </td>
                  )}
                  {fixedLeftCols.map(col => (
                    <td key={col.key} className="py-2 px-2 sticky left-0 bg-pdd-card" style={{ width: col.width }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {scrollCols.map(col => (
                    <td key={col.key} className="py-2 px-2" style={{ width: col.width }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  {fixedRightCols.map(col => (
                    <td key={col.key} className="py-2 px-2 sticky right-0 bg-pdd-card" style={{ width: col.width }}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                </tr>
                {expandable && expandedRows.has(row[rowKey]) && (
                  <tr className="bg-pdd-bg">
                    <td colSpan={columns.length + (selectable ? 1 : 0) + (expandable ? 1 : 0)} className="py-3 px-4">
                      <div className="text-xs text-pdd-text-secondary">展开详情: {JSON.stringify(row)}</div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {virtualScroll && <div style={{ height: filteredData.length * rowHeight }} />}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-pdd-border text-xs text-pdd-text-secondary">
        <span>共 {filteredData.length} 条</span>
        <div className="flex items-center gap-2">
          <span>显示列:</span>
          {columns.map(col => (
            <button key={col.key} onClick={() => setVisibleCols(p => { const n = new Set(p); n.has(col.key) ? n.delete(col.key) : n.add(col.key); return n; })}
              className={`px-1.5 py-0.5 rounded text-[10px] ${visibleCols.has(col.key) ? 'bg-pdd-primary text-white' : 'bg-pdd-border'}`}>
              {col.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

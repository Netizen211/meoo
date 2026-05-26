import React from 'react';
import { motion } from 'framer-motion';
import { Eye, EyeOff, ChevronLeft, ChevronRight, Pin, Move, Search } from 'lucide-react';

interface ColumnDef { key: string; label: string; width: number; }

interface Props {
  tableData: any[]; paginatedData: any[]; columns: ColumnDef[];
  visibleColumns: ColumnDef[]; pinnedColumns: ColumnDef[]; unpinnedColumns: ColumnDef[];
  hiddenCols: Set<string>; pinnedCols: Set<string>;
  sortField: string; sortDesc: boolean; currentPage: number; totalPages: number;
  setCurrentPage: (p: number) => void; toggleCol: (col: string) => void; togglePin: (col: string) => void;
  setSortField: (f: string) => void; setSortDesc: (v: boolean) => void;
  draggedPanel: string | null;
  onDragStart: (p: string) => void; onDragOver: (e: React.DragEvent, p: string) => void; onDragEnd: () => void;
  onRowClick?: (row: any) => void;
  searchQuery: string; onSearchChange: (q: string) => void;
}

export default function DashboardTablePanel({
  tableData, paginatedData, columns, visibleColumns, pinnedColumns, unpinnedColumns,
  hiddenCols, pinnedCols, sortField, sortDesc, currentPage, totalPages,
  setCurrentPage, toggleCol, togglePin, setSortField, setSortDesc,
  draggedPanel, onDragStart, onDragOver, onDragEnd, onRowClick,
  searchQuery, onSearchChange
}: Props) {
  const isNumeric = (key: string) => ['paid', 'merchant', 'qty'].includes(key);
  const alignClass = (key: string) => isNumeric(key) ? 'text-right' : 'text-left';
  const headerJustify = (key: string) => isNumeric(key) ? 'justify-end' : 'justify-start';

  const highlight = (text: string): React.ReactNode => {
    if (!searchQuery || !text) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} className="bg-yellow-300/50 rounded-sm text-inherit">{part}</mark>
        : part
    );
  };

  return (
    <motion.div key="table" layoutId="table" draggable onDragStart={() => onDragStart('table')} onDragOver={e => onDragOver(e, 'table')} onDragEnd={onDragEnd}
      className={`bg-pdd-card rounded-xl border border-pdd-border p-3 cursor-move transition-all ${draggedPanel === 'table' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-pdd-text">订单明细 ({tableData.length}条)</h3>
          <div className="flex items-center gap-1 bg-[var(--pdd-gray-100)] rounded-lg px-2 py-1 border border-pdd-border">
            <Search size={12} className="text-pdd-text-secondary" />
            <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="搜索..." className="w-36 text-xs outline-none bg-transparent text-pdd-text placeholder-pdd-text-secondary" />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="text-[10px] text-pdd-text-secondary hover:text-pdd-danger">清除</button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {columns.map(c => (
              <button key={c.key} onClick={() => toggleCol(c.key)}
                className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${hiddenCols.has(c.key) ? 'bg-[var(--pdd-gray-200)] text-pdd-text-secondary' : 'bg-pdd-primary/10 text-pdd-primary-light'}`}>
                {hiddenCols.has(c.key) ? <EyeOff size={10} /> : <Eye size={10} />}{c.label}
              </button>
            ))}
          </div>
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
            className="p-1 rounded hover:bg-[var(--pdd-gray-200)] disabled:opacity-30 text-pdd-text-secondary"><ChevronLeft size={14} /></button>
          <span className="text-xs text-pdd-text-secondary">{currentPage}/{totalPages || 1}</span>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
            className="p-1 rounded hover:bg-[var(--pdd-gray-200)] disabled:opacity-30 text-pdd-text-secondary"><ChevronRight size={14} /></button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
            {pinnedColumns.map(col => (
              <th key={col.key} className={`py-1.5 font-medium bg-pdd-bg sticky left-0 z-10`} style={{ width: col.width }}>
                <div className={`flex items-center gap-1 ${headerJustify(col.key)}`}>
                  <button onClick={() => togglePin(col.key)} className="text-pdd-primary-light flex-shrink-0"><Pin size={10} fill="#818cf8" /></button>
                  {col.label}
                </div>
              </th>
            ))}
            {unpinnedColumns.map(col => (
              <th key={col.key} onClick={() => { setSortField(col.key); setSortDesc(sortField === col.key ? !sortDesc : true); }}
                className={`py-1.5 font-medium cursor-pointer hover:text-pdd-primary-light relative group`} style={{ width: col.width }}>
                <div className={`flex items-center gap-1 ${headerJustify(col.key)}`}>
                  <button onClick={(e) => { e.stopPropagation(); togglePin(col.key); }} className="text-pdd-text-muted hover:text-pdd-primary-light flex-shrink-0"><Pin size={10} /></button>
                  {col.label} {sortField === col.key && (sortDesc ? '↓' : '↑')}
                </div>
              </th>
            ))}
          </tr></thead>
          <tbody>{paginatedData.map((r, i) => (
            <tr key={i} onClick={() => onRowClick?.(r)} className={`${i % 2 === 1 ? 'bg-pdd-bg/50' : ''} hover:bg-[var(--pdd-gray-200)]/50 cursor-pointer`}>
              {visibleColumns.map(col => (
                <td key={col.key} className={`py-1.5 ${alignClass(col.key)} ${pinnedCols.has(col.key) ? 'bg-pdd-bg sticky left-0 z-10' : ''}`} style={{ width: col.width }}>
                  {col.key === 'orderNo' ? <span className="font-mono text-[10px] text-pdd-text-secondary truncate block" title={r[col.key]}>{highlight(r[col.key])}</span> :
                   col.key === 'product' ? <span className="truncate max-w-[120px] block">{highlight(r[col.key])}</span> :
                   col.key === 'category' ? <span>{highlight(r[col.key])}</span> :
                   col.key === 'province' ? <span>{highlight(r[col.key])}</span> :
                   col.key === 'status' ? <span className="px-1.5 py-0.5 rounded text-[10px] bg-[var(--pdd-gray-200)] text-pdd-text-secondary">{highlight(r[col.key])}</span> :
                   col.key === 'paid' ? <span className="text-pdd-text tabular-nums">¥{r[col.key].toFixed(0)}</span> :
                   col.key === 'merchant' ? <span className="text-pdd-primary-light font-medium tabular-nums">¥{r[col.key].toFixed(0)}</span> :
                   col.key === 'qty' ? <span className="text-pdd-text tabular-nums">{r[col.key]}</span> :
                   col.key === 'time' ? <span className="font-mono text-[10px] text-pdd-text-secondary">{highlight(r[col.key])}</span> :
                   highlight(String(r[col.key] || ''))}
                </td>
              ))}
            </tr>
          ))}</tbody>
        </table>
      </div>
    </motion.div>
  );
}

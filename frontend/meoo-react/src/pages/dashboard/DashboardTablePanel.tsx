import React from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface ColumnDef { key: string; label: string; width: number; }

interface Props {
  tableData: any[]; paginatedData: any[]; columns: ColumnDef[];
  visibleColumns: ColumnDef[];
  sortField: string; sortDesc: boolean; currentPage: number; totalPages: number;
  setCurrentPage: (p: number) => void; setSortField: (f: string) => void; setSortDesc: (v: boolean) => void;
  onRowClick?: (row: any) => void;
  searchQuery: string; onSearchChange: (q: string) => void;
  toggleCol?: (col: string) => void; hiddenCols?: Set<string>;
  pinnedColumns?: ColumnDef[]; unpinnedColumns?: ColumnDef[];
  pinnedCols?: Set<string>; togglePin?: (col: string) => void;
  draggedPanel?: string | null; onDragStart?: (p: string) => void;
  onDragOver?: (e: React.DragEvent, p: string) => void; onDragEnd?: () => void;
}

export default function DashboardTablePanel({
  tableData, paginatedData, columns, visibleColumns,
  sortField, sortDesc, currentPage, totalPages,
  setCurrentPage, setSortField, setSortDesc, onRowClick,
  searchQuery, onSearchChange
}: Props) {
  const isNumeric = (key: string) => ['paid', 'merchant', 'qty'].includes(key);
  const alignClass = (key: string) => isNumeric(key) ? 'text-right' : 'text-left';

  const highlight = (text: string): React.ReactNode => {
    if (!searchQuery || !text) return text;
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    if (parts.length === 1) return text;
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} className="bg-yellow-300/40 rounded-sm text-inherit">{part}</mark>
        : part
    );
  };

  return (
    <div className="bg-pdd-card rounded-lg border border-pdd-border">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold text-gray-700">订单明细</h3>
          <span className="text-[11px] text-pdd-text-secondary">{tableData.length} 条</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-pdd-gray-100 rounded-md px-2 py-1">
            <Search size={11} className="text-pdd-text-secondary" />
            <input type="text" value={searchQuery} onChange={e => onSearchChange(e.target.value)} placeholder="搜索订单/商品..." className="w-28 text-[11px] outline-none bg-transparent text-pdd-text placeholder-pdd-text-secondary" />
            {searchQuery && (
              <button onClick={() => onSearchChange('')} className="text-[10px] text-pdd-text-secondary hover:text-pdd-danger px-1">✕</button>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
              className="p-0.5 rounded hover:bg-pdd-gray-200 disabled:opacity-30 text-pdd-text-secondary"><ChevronLeft size={13} /></button>
            <span className="text-[11px] text-pdd-text-secondary tabular-nums">{currentPage}/{totalPages || 1}</span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
              className="p-0.5 rounded hover:bg-pdd-gray-200 disabled:opacity-30 text-pdd-text-secondary"><ChevronRight size={13} /></button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto border-t border-pdd-border">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-pdd-text-secondary bg-pdd-gray-50">
              {visibleColumns.map(col => (
                <th key={col.key} onClick={() => { setSortField(col.key); setSortDesc(sortField === col.key ? !sortDesc : true); }}
                  className="py-2 px-2 font-medium cursor-pointer hover:text-pdd-text whitespace-nowrap" style={{ width: col.width }}>
                  <div className={`flex items-center gap-0.5 ${isNumeric(col.key) ? 'justify-end' : 'justify-start'}`}>
                    {col.label}
                    {sortField === col.key && <span className="text-[10px]">{sortDesc ? '↓' : '↑'}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((r, i) => (
              <tr key={i} onClick={() => onRowClick?.(r)} className="hover:bg-pdd-gray-50 cursor-pointer border-t border-pdd-border/50">
                {visibleColumns.map(col => (
                  <td key={col.key} className={`py-1.5 px-2 ${alignClass(col.key)}`} style={{ width: col.width }}>
                    {col.key === 'orderNo' ? <span className="font-mono text-[10px] text-pdd-text-secondary truncate block max-w-[130px]" title={r[col.key]}>{highlight(r[col.key])}</span> :
                     col.key === 'product' ? <span className="truncate block max-w-[130px]">{highlight(r[col.key])}</span> :
                     col.key === 'category' ? <span>{highlight(r[col.key])}</span> :
                     col.key === 'province' ? <span>{highlight(r[col.key])}</span> :
                     col.key === 'status' ? <span className="text-pdd-text-secondary text-[10px]">{highlight(r[col.key])}</span> :
                     col.key === 'paid' ? <span className="text-pdd-text tabular-nums">¥{r[col.key]?.toFixed(0)}</span> :
                     col.key === 'merchant' ? <span className="text-pdd-primary-light font-medium tabular-nums">¥{r[col.key]?.toFixed(0)}</span> :
                     col.key === 'qty' ? <span className="text-pdd-text tabular-nums">{r[col.key]}</span> :
                     col.key === 'time' ? <span className="font-mono text-[10px] text-pdd-text-secondary">{highlight(r[col.key])}</span> :
                     highlight(String(r[col.key] || ''))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

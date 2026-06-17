import React, { useState, useMemo, useCallback } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Download, RefreshCw } from 'lucide-react';

export interface Column<T = any> {
  key: string;
  title: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  fixed?: 'left' | 'right';
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onRefresh?: () => void;
  onExport?: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  onSearch?: (keyword: string) => void;
  rowKey?: string | ((record: T) => string);
  emptyText?: string;
  className?: string;
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  loading = false,
  total = 0,
  page = 1,
  pageSize = 20,
  onPageChange,
  onPageSizeChange,
  onRefresh,
  onExport,
  searchable = false,
  searchPlaceholder = '搜索...',
  onSearch,
  rowKey = 'id',
  emptyText = '暂无数据',
  className = '',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [searchValue, setSearchValue] = useState('');
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const handleSearchInput = useCallback((value: string) => {
    setSearchValue(value);
    if (onSearch) {
      const timer = setTimeout(() => onSearch(value), 300);
      return () => clearTimeout(timer);
    }
  }, [onSearch]);

  const getRowKey = (record: T, idx: number): string => {
    if (typeof rowKey === 'function') return rowKey(record);
    return String(record[rowKey] ?? idx);
  };

  return (
    <div className={`bg-pdd-card rounded-xl border shadow-sm ${className}`} style={{ borderColor: 'var(--pdd-border)' }}>
      {/* Toolbar */}
      {(searchable || onRefresh || onExport) && (
        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 flex-1">
            {searchable && (
              <div className="relative max-w-xs w-full">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--pdd-gray-400)' }} />
                <input
                  value={searchValue}
                  onChange={e => handleSearchInput(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-pdd-bg border rounded-lg outline-none transition-colors"
                  style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--pdd-primary)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--pdd-border)'; }}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {onRefresh && (
              <button onClick={onRefresh} className="p-1.5 rounded-lg hover:bg-gray-50 transition-colors" style={{ color: 'var(--pdd-text-secondary)' }} title="刷新">
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
            )}
            {onExport && (
              <button onClick={onExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg hover:bg-pdd-gray-100 transition-colors" style={{ color: 'var(--pdd-primary)' }}>
                <Download size={13} />
                导出
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ background: 'var(--pdd-gray-50)' }}>
              {columns.map(col => (
                <th
                  key={col.key}
                  className={`text-xs font-medium px-4 py-3 whitespace-nowrap ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  style={{ color: 'var(--pdd-text-secondary)', textAlign: col.align || 'left', width: col.width }}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <div className="flex items-center gap-1" style={{ justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                    {col.title}
                    {col.sortable && sortKey === col.key && (
                      sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <RefreshCw size={16} className="animate-spin" style={{ color: 'var(--pdd-primary)' }} />
                    <span className="text-sm" style={{ color: 'var(--pdd-text-secondary)' }}>加载中...</span>
                  </div>
                </td>
              </tr>
            ) : sortedData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center">
                  <div className="text-sm" style={{ color: 'var(--pdd-gray-400)' }}>{emptyText}</div>
                </td>
              </tr>
            ) : (
              sortedData.map((record, idx) => (
                <tr key={getRowKey(record, idx)} className="border-t transition-colors hover:bg-pdd-bg" style={{ borderColor: 'var(--pdd-gray-100)' }}>
                  {columns.map(col => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm whitespace-nowrap"
                      style={{ color: 'var(--pdd-text)', textAlign: col.align || 'left' }}
                    >
                      {col.render ? col.render(record[col.key], record, idx) : record[col.key] ?? '-'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>
            <span>共 {total} 条</span>
            {onPageSizeChange && (
              <select
                value={pageSize}
                onChange={e => onPageSizeChange(Number(e.target.value))}
                className="border rounded px-2 py-1 text-xs outline-none"
                style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)', background: 'white' }}
              >
                {[10, 20, 50, 100].map(s => (
                  <option key={s} value={s}>{s}条/页</option>
                ))}
              </select>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
              className="p-1.5 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
              style={{ color: 'var(--pdd-text-secondary)' }}
            >
              <ChevronLeft size={15} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 3, totalPages - 6));
              const p = start + i;
              if (p > totalPages) return null;
              return (
                <button
                  key={p}
                  onClick={() => onPageChange?.(p)}
                  className="min-w-[28px] h-7 rounded text-xs font-medium transition-colors"
                  style={{
                    background: p === page ? 'var(--pdd-primary)' : 'transparent',
                    color: p === page ? 'white' : 'var(--pdd-text-secondary)',
                  }}
                >
                  {p}
                </button>
              );
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
              className="p-1.5 rounded hover:bg-gray-50 disabled:opacity-30 transition-colors"
              style={{ color: 'var(--pdd-text-secondary)' }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

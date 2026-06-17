import React from 'react';
import { Calendar, X } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

interface FilterPanelProps {
  dateRange?: { start: string; end: string };
  onDateRangeChange?: (range: { start: string; end: string }) => void;
  status?: string;
  onStatusChange?: (status: string) => void;
  statusOptions?: FilterOption[];
  extraFilters?: React.ReactNode;
  onReset?: () => void;
}

export default function FilterPanel({
  dateRange,
  onDateRangeChange,
  status,
  onStatusChange,
  statusOptions,
  extraFilters,
  onReset,
}: FilterPanelProps) {
  const hasFilters = dateRange?.start || dateRange?.end || status;

  return (
    <div className="bg-pdd-card rounded-xl border p-4 mb-4" style={{ borderColor: 'var(--pdd-border)' }}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        {onDateRangeChange && (
          <div className="flex items-center gap-2">
            <Calendar size={14} style={{ color: 'var(--pdd-gray-400)' }} />
            <input
              type="date"
              value={dateRange?.start || ''}
              onChange={e => onDateRangeChange({ start: e.target.value, end: dateRange?.end || '' })}
              className="px-2.5 py-1.5 text-xs border rounded-lg outline-none transition-colors"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)', background: 'var(--pdd-gray-50)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--pdd-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--pdd-border)'; }}
            />
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>至</span>
            <input
              type="date"
              value={dateRange?.end || ''}
              onChange={e => onDateRangeChange({ start: dateRange?.start || '', end: e.target.value })}
              className="px-2.5 py-1.5 text-xs border rounded-lg outline-none transition-colors"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)', background: 'var(--pdd-gray-50)' }}
              onFocus={e => { e.target.style.borderColor = 'var(--pdd-primary)'; }}
              onBlur={e => { e.target.style.borderColor = 'var(--pdd-border)'; }}
            />
          </div>
        )}

        {/* Status filter */}
        {statusOptions && onStatusChange && (
          <select
            value={status || ''}
            onChange={e => onStatusChange(e.target.value)}
            className="px-3 py-1.5 text-xs border rounded-lg outline-none transition-colors"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text)', background: 'var(--pdd-gray-50)' }}
          >
            <option value="">全部状态</option>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}

        {/* Extra filters */}
        {extraFilters}

        {/* Reset */}
        {hasFilters && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg hover:bg-gray-50 transition-colors"
            style={{ color: 'var(--pdd-text-secondary)' }}
          >
            <X size={13} />
            重置
          </button>
        )}
      </div>
    </div>
  );
}

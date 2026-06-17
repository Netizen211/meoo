import React, { useCallback, useMemo } from 'react';
import { Calendar } from 'lucide-react';

interface DateRangeResult {
  startDate: string;
  endDate: string;
}

interface AdminDateRangePickerProps {
  value: string;
  onChange: (range: string) => void;
  startDate?: string;
  endDate?: string;
  onStartChange?: (d: string) => void;
  onEndChange?: (d: string) => void;
}

const RANGE_OPTIONS = [
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '近90天', value: '90d' },
  { label: '自定义', value: 'custom' },
];

export function getDateRange(range: string, start?: string, end?: string): DateRangeResult {
  const now = new Date();
  let s = new Date();
  if (range === '7d') s.setDate(now.getDate() - 7);
  else if (range === '30d') s.setDate(now.getDate() - 30);
  else if (range === '90d') s.setDate(now.getDate() - 90);
  else if (range === 'custom' && start) return { startDate: start, endDate: end || now.toISOString().split('T')[0] };
  return {
    startDate: s.toISOString().split('T')[0],
    endDate: now.toISOString().split('T')[0],
  };
}

export default function AdminDateRangePicker({
  value,
  onChange,
  startDate,
  endDate,
  onStartChange,
  onEndChange,
}: AdminDateRangePickerProps) {
  const handlePreset = useCallback((v: string) => {
    onChange(v);
    if (v !== 'custom' && onStartChange && onEndChange) {
      const { startDate: s, endDate: e } = getDateRange(v);
      onStartChange(s);
      onEndChange(e);
    }
  }, [onChange, onStartChange, onEndChange]);

  return (
    <div className="flex items-center gap-2">
      <Calendar size={14} className="text-pdd-gray-400 shrink-0" />
      <div className="flex items-center gap-0.5 bg-pdd-gray-50 rounded-lg p-0.5 border border-pdd-border">
        {RANGE_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handlePreset(opt.value)}
            className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
              value === opt.value
                ? 'bg-pdd-primary/10 text-pdd-text shadow-sm'
                : 'text-pdd-text-secondary hover:text-pdd-text'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {value === 'custom' && onStartChange && onEndChange && (
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={startDate || ''}
            onChange={e => { onStartChange(e.target.value); onChange('custom'); }}
            className="px-2 py-1 text-xs border border-pdd-border rounded-lg bg-pdd-card text-pdd-text outline-none focus:border-pdd-primary"
          />
          <span className="text-xs text-pdd-gray-400">至</span>
          <input
            type="date"
            value={endDate || ''}
            onChange={e => { onEndChange(e.target.value); onChange('custom'); }}
            className="px-2 py-1 text-xs border border-pdd-border rounded-lg bg-pdd-card text-pdd-text outline-none focus:border-pdd-primary"
          />
        </div>
      )}
    </div>
  );
}

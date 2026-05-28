/**
 * 通用 TOP/BOTTOM 排行组件 — 每个图表区域自动附带
 */
import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface RankItem {
  id: string;
  label: string;
  value: number;
  sub?: string;       // 副指标
  change?: number;    // 环比变化%
}

interface Props {
  title: string;
  items: RankItem[];
  valueFormat?: 'money' | 'pct' | 'number';
  direction: 'top' | 'bottom';
  maxItems?: number;
  onItemClick?: (id: string) => void;
}

function fmtVal(v: number, format?: string): string {
  if (format === 'money') return '¥' + v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (format === 'pct') return v.toFixed(1) + '%';
  return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v.toFixed(0);
}

export default function MiniRanking({ title, items, valueFormat, direction, maxItems = 5, onItemClick }: Props) {
  const display = items.slice(0, maxItems);
  if (!display.length) return null;

  const isUp = direction === 'top';

  return (
    <div className="mt-3 pt-3 border-t border-pdd-border/50">
      <div className="flex items-center gap-1.5 mb-2">
        {isUp ? <TrendingUp size={12} className="text-green-500" /> : <TrendingDown size={12} className="text-red-500" />}
        <span className="text-[10px] font-medium text-pdd-text-secondary uppercase tracking-wide">{title}</span>
      </div>
      <div className="space-y-1">
        {display.map((item, i) => (
          <div
            key={item.id}
            onClick={() => onItemClick?.(item.id)}
            className={`flex items-center justify-between text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
              onItemClick ? 'hover:bg-pdd-bg' : ''
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 ${
                i === 0 ? (isUp ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')
                : i === 1 ? 'bg-orange-50 text-orange-600'
                : 'bg-gray-100 text-gray-500'
              }`}>{i + 1}</span>
              <span className="truncate text-pdd-text">{item.label}</span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className={`font-mono font-medium ${isUp ? 'text-green-600' : 'text-red-500'}`}>
                {fmtVal(item.value, valueFormat)}
              </span>
              {item.change !== undefined && (
                <span className={`text-[9px] ${item.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

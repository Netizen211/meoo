/**
 * 多商品同屏对比面板 — P0-1
 */
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ProductRow {
  id: string; name: string; gmv: number; orders: number; revenue: number;
  profitRate: number; refundRate: number; roi: number; avgPrice: number; profit: number;
}

interface Props {
  products: { id: string; name: string; stats: any }[];
  selectedIds: string[];
  onRemove: (id: string) => void;
}

function fmtMoney(n: number) {
  const v = isNaN(n) ? 0 : n;
  return '¥' + v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtPct(n: number) {
  if (isNaN(n)) return '--';
  return n.toFixed(1) + '%';
}

export default function MultiProductCompare({ products, selectedIds, onRemove }: Props) {
  const rows: ProductRow[] = useMemo(() => {
    return selectedIds.map(id => {
      const p = products.find(x => x.id === id);
      const s = p?.stats || {};
      return {
        id, name: p?.name || id,
        gmv: s.gmv || 0, orders: s.orders || 0, revenue: s.revenue || 0,
        profitRate: s.profitRate || 0, refundRate: s.refundRate || 0,
        roi: s.roi || 0, avgPrice: s.avgOrderValue || 0, profit: s.netProfit || 0,
      };
    });
  }, [products, selectedIds]);

  if (selectedIds.length < 2) return null;

  const metrics = [
    { key: 'gmv' as const, label: 'GMV', fmt: (v: number) => fmtMoney(v), highGood: true },
    { key: 'orders' as const, label: '订单', fmt: (v: number) => String(v), highGood: true },
    { key: 'revenue' as const, label: '实收', fmt: (v: number) => fmtMoney(v), highGood: true },
    { key: 'profit' as const, label: '利润', fmt: (v: number) => fmtMoney(v), highGood: true },
    { key: 'profitRate' as const, label: '利润率', fmt: (v: number) => fmtPct(v), highGood: true },
    { key: 'refundRate' as const, label: '退款率', fmt: (v: number) => fmtPct(v), highGood: false },
    { key: 'roi' as const, label: 'ROI', fmt: (v: number) => v > 0 && !isNaN(v) ? v.toFixed(2) : '--', highGood: true },
    { key: 'avgPrice' as const, label: '客单价', fmt: (v: number) => fmtMoney(v), highGood: true },
  ];

  // Find best/worst for each metric
  const extremes = useMemo(() => {
    const result: Record<string, { best: string; worst: string }> = {};
    metrics.forEach(m => {
      const vals = rows.map(r => r[m.key]).filter(v => v > 0);
      result[m.key] = {
        best: m.highGood ? String(Math.max(...vals)) : String(Math.min(...vals)),
        worst: m.highGood ? String(Math.min(...vals)) : String(Math.max(...vals)),
      };
    });
    return result;
  }, [rows]);

  return (
    <div className="pdd-card rounded-xl border border-pdd-border p-4" id="kpi-compare">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5">
        <TrendingUp size={13} color="#7c3aed" />多商品对比
        <span className="text-pdd-gray-400 font-normal ml-1">({selectedIds.length}个)</span>
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-pdd-border">
              <th className="text-left py-2 px-2 sticky left-0 bg-pdd-card z-10">商品</th>
              {metrics.map(m => <th key={m.key} className="text-right py-2 px-2">{m.label}</th>)}
              <th className="text-center py-2 px-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pdd-border/30">
            {rows.map(r => (
              <tr key={r.id} className="hover:bg-pdd-bg/50">
                <td className="py-2 px-2 font-medium text-pdd-text truncate max-w-[120px] sticky left-0 bg-pdd-card">{r.name}</td>
                {metrics.map(m => {
                  const val = r[m.key];
                  const isBest = String(val) === extremes[m.key]?.best;
                  const isWorst = String(val) === extremes[m.key]?.worst && rows.length > 1;
                  return (
                    <td key={m.key} className={`py-2 px-2 text-right font-mono tabular-nums ${isBest ? 'text-green-600 font-bold' : isWorst ? 'text-red-500' : 'text-pdd-text'}`}>
                      {m.fmt(val)}
                      {isBest && <TrendingUp size={10} className="inline ml-1 text-green-500" />}
                      {isWorst && <TrendingDown size={10} className="inline ml-1 text-red-500" />}
                    </td>
                  );
                })}
                <td className="py-2 px-2 text-center">
                  <button onClick={() => onRemove(r.id)} className="text-pdd-gray-400 hover:text-red-500 text-xs">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

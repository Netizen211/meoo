import React from 'react';
import { motion } from 'framer-motion';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Target, Eye, Percent, Users, Mail, Star, BarChart3 } from 'lucide-react';

interface ProductKpiData {
  totalCost: number; promoOrders: number; promoGMV: number; roi: number;
  totalImpressions: number; totalClicks: number; ctr: number; cvr: number; cpc: number; cpa: number;
  inquiryCount: number; favoriteCount: number; followCount: number;
}

interface TrendItem { date: string; cost: number; roi: number; }
interface TopProduct { pid: string; name: string; code: string; cost: number; orders: number; gmv: number; roi: number; cvr: number; }

interface Props {
  productKpiData: ProductKpiData | null;
  trendData: TrendItem[];
  topProducts: TopProduct[];
  rangeLabel: string;
}

export default function PromotionProductTab({ productKpiData, trendData, topProducts, rangeLabel }: Props) {
  if (!productKpiData) return <div className="pdd-card text-center py-8 text-[var(--pdd-text-secondary)]">暂无商品推广数据</div>;

  const kpiCards = [
    { label: '推广花费', value: productKpiData.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
    { label: '推广订单数', value: productKpiData.promoOrders, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-primary)' },
    { label: '推广GMV', value: productKpiData.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广ROI', value: productKpiData.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: 'var(--pdd-purple)' },
    { label: '曝光量', value: productKpiData.totalImpressions, fmt: (v: number) => v.toFixed(0), icon: Eye, color: 'var(--pdd-primary)' },
    { label: '点击量', value: productKpiData.totalClicks, fmt: (v: number) => v.toFixed(0), icon: Target, color: 'var(--pdd-success)' },
    { label: '点击率', value: productKpiData.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, color: 'var(--pdd-warning)' },
    { label: '转化率', value: productKpiData.cvr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Percent, color: 'var(--pdd-cyan)' },
    { label: '平均点击成本', value: productKpiData.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-pink)' },
    { label: '平均获客成本', value: productKpiData.cpa, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Users, color: 'var(--pdd-purple)' },
    { label: '询单量', value: productKpiData.inquiryCount, fmt: (v: number) => v.toFixed(0), icon: Mail, color: 'var(--pdd-purple)' },
    { label: '收藏量', value: productKpiData.favoriteCount, fmt: (v: number) => v.toFixed(0), icon: Star, color: 'var(--pdd-warning)' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {kpiCards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-2.5 flex items-center gap-2">
            <c.icon size={16} color={c.color} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--pdd-text-secondary)]">{c.label}</span>
              <span className="text-sm font-bold block" style={{ color: c.color }}>{c.value != null ? c.fmt(c.value) : '--'}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {trendData.length > 0 && (
        <div className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><BarChart3 size={14} color="var(--pdd-danger)" />推广花费与ROI趋势({rangeLabel})</h3>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="cost" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="roi" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="cost" dataKey="cost" fill="var(--pdd-primary-light)" name="花费(元)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="roi" type="monotone" dataKey="roi" stroke="#8b5cf6" strokeWidth={2} name="ROI" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {topProducts.length > 0 && (
        <div className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><Star size={14} color="var(--pdd-danger)" />推广商品TOP10({rangeLabel})</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                <th className="py-1.5 text-left font-medium w-6">#</th>
                <th className="py-1.5 text-left font-medium">商品</th>
                <th className="py-1.5 text-left font-medium">商品ID</th>
                <th className="py-1.5 text-left font-medium">商家编码</th>
                <th className="py-1.5 text-right font-medium">花费</th>
                <th className="py-1.5 text-right font-medium">订单</th>
                <th className="py-1.5 text-right font-medium">ROI</th>
              </tr></thead>
              <tbody>{topProducts.map((p, i) => (
                <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                  <td className="py-1.5 text-[var(--pdd-text-secondary)]">{i + 1}</td>
                  <td className="py-1.5 truncate max-w-[160px]">{p.name}</td>
                  <td className="py-1.5 font-mono text-pdd-text">{p.pid}</td>
                  <td className="py-1.5 text-pdd-text">{p.code || '-'}</td>
                  <td className="py-1.5 text-right">¥{p.cost.toFixed(0)}</td>
                  <td className="py-1.5 text-right">{p.orders}</td>
                  <td className="py-1.5 text-right font-medium" style={{ color: p.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{p.roi.toFixed(2)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

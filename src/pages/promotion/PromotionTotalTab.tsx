import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { DollarSign, ShoppingCart, TrendingUp, Target, Eye, Percent, Users, Mail, Star } from 'lucide-react';

const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-purple)', 'var(--pdd-danger)', 'var(--pdd-cyan)', 'var(--pdd-pink)'];

interface TotalKpiData {
  totalCost: number; promoOrders: number; promoGMV: number; roi: number; avgOrder: number; promoRatio: number;
  totalImpressions: number; totalClicks: number; ctr: number; cvr: number; cpc: number; cpa: number;
  inquiryCost: number; inquiryCount: number; favoriteCost: number; favoriteCount: number; followCost: number; followCount: number;
  avgInquiryCost: number; avgFavoriteCost: number; avgFollowCost: number;
}

interface ChannelItem { name: string; cost: number; gmv: number; roi: number; }
interface ProfitData { merchantIncome: number; promoCost: number; insuranceCost: number; rawCost: number; netProfit: number; }

interface Props {
  totalKpiData: TotalKpiData | null;
  channelData: ChannelItem[];
  profitData: ProfitData | null;
  rangeLabel: string;
}

export default function PromotionTotalTab({ totalKpiData, channelData, profitData, rangeLabel }: Props) {
  if (!totalKpiData) return <div className="pdd-card text-center py-8 text-[var(--pdd-text-secondary)]">暂无推广数据</div>;

  const kpiCards = [
    { label: '总推广花费', value: totalKpiData.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
    { label: '推广订单数', value: totalKpiData.promoOrders, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-primary)' },
    { label: '推广GMV', value: totalKpiData.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广ROI', value: totalKpiData.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: 'var(--pdd-purple)' },
    { label: '曝光量', value: totalKpiData.totalImpressions, fmt: (v: number) => v.toFixed(0), icon: Eye, color: 'var(--pdd-primary)' },
    { label: '点击量', value: totalKpiData.totalClicks, fmt: (v: number) => v.toFixed(0), icon: Target, color: 'var(--pdd-success)' },
    { label: '点击率', value: totalKpiData.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, color: 'var(--pdd-warning)' },
    { label: '转化率', value: totalKpiData.cvr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Percent, color: 'var(--pdd-cyan)' },
    { label: '平均点击成本', value: totalKpiData.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-pink)' },
    { label: '平均获客成本', value: totalKpiData.cpa, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Users, color: 'var(--pdd-purple)' },
    { label: '询单量', value: totalKpiData.inquiryCount, fmt: (v: number) => v.toFixed(0), icon: Mail, color: 'var(--pdd-purple)' },
    { label: '收藏量', value: totalKpiData.favoriteCount, fmt: (v: number) => v.toFixed(0), icon: Star, color: 'var(--pdd-warning)' },
    { label: '关注量', value: totalKpiData.followCount, fmt: (v: number) => v.toFixed(0), icon: Users, color: 'var(--pdd-pink)' },
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
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold" style={{ color: c.color }}>{c.value != null ? c.fmt(c.value) : '--'}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">推广渠道分布({rangeLabel})</h3>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={channelData.map(c => ({ name: c.name, value: c.cost }))} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {channelData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => `¥${v.toFixed(0)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">渠道花费与ROI({rangeLabel})</h3>
          <table className="w-full text-xs">
            <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
              <th className="py-1.5 text-left font-medium">渠道</th><th className="py-1.5 text-right font-medium">花费</th><th className="py-1.5 text-right font-medium">GMV</th><th className="py-1.5 text-right font-medium">ROI</th>
            </tr></thead>
            <tbody>{channelData.map((c, i) => (
              <tr key={c.name} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                <td className="py-1.5"><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ background: COLORS[i] }} />{c.name}</td>
                <td className="py-1.5 text-right">¥{c.cost.toFixed(0)}</td>
                <td className="py-1.5 text-right">¥{c.gmv.toFixed(0)}</td>
                <td className="py-1.5 text-right font-medium" style={{ color: c.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{c.roi.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      {profitData && (
        <div className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><DollarSign size={14} color="var(--pdd-danger)" />推广利润计算({rangeLabel})</h3>
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <span className="font-medium">商家实收 ¥{profitData.merchantIncome.toFixed(0)}</span>
            <span className="text-[var(--pdd-danger)]">-</span>
            <span>推广 ¥{profitData.promoCost.toFixed(0)}</span>
            <span className="text-[var(--pdd-danger)]">-</span>
            <span>运费险 ¥{profitData.insuranceCost.toFixed(0)}</span>
            <span className="text-[var(--pdd-danger)]">-</span>
            <span>裸货成本 ¥{profitData.rawCost.toFixed(0)}</span>
            <span className="text-[var(--pdd-danger)]">=</span>
            <span className="font-bold text-sm" style={{ color: profitData.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>净利润 ¥{profitData.netProfit.toFixed(0)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

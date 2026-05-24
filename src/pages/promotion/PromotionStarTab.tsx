import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, TrendingUp, Target, Eye, Users, Star } from 'lucide-react';

interface StarKpiData {
  totalCost: number; promoOrders: number; promoGMV: number; roi: number;
  totalImpressions: number; totalClicks: number; ctr: number; cpc: number;
  followCount: number; favoriteCount: number;
}

interface Props {
  starKpiData: StarKpiData | null;
}

export default function PromotionStarTab({ starKpiData }: Props) {
  if (!starKpiData) return <div className="pdd-card text-center py-8 text-[var(--pdd-text-secondary)]">暂无明星店铺数据</div>;

  const kpiCards = [
    { label: '推广花费', value: starKpiData.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
    { label: '推广订单数', value: starKpiData.promoOrders, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-primary)' },
    { label: '推广GMV', value: starKpiData.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广ROI', value: starKpiData.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: '#722ed1' },
    { label: '曝光量', value: starKpiData.totalImpressions, fmt: (v: number) => v.toFixed(0), icon: Eye, color: 'var(--pdd-primary)' },
    { label: '点击量', value: starKpiData.totalClicks, fmt: (v: number) => v.toFixed(0), icon: Target, color: 'var(--pdd-success)' },
    { label: '点击率', value: starKpiData.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, color: 'var(--pdd-warning)' },
    { label: '平均点击成本', value: starKpiData.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: '#eb2f96' },
    { label: '店铺关注量', value: starKpiData.followCount, fmt: (v: number) => v.toFixed(0), icon: Users, color: '#722ed1' },
    { label: '商品收藏量', value: starKpiData.favoriteCount, fmt: (v: number) => v.toFixed(0), icon: Star, color: 'var(--pdd-warning)' },
  ];

  return (
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
  );
}

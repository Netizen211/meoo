import React from 'react';
import { motion } from 'framer-motion';
import { DollarSign, ShoppingCart, TrendingUp, Target, Eye, Users, Star, Mail } from 'lucide-react';

interface LiveKpiData {
  totalCost: number; promoOrders: number; promoGMV: number; roi: number;
  totalImpressions: number; followCount: number; favoriteCount: number; commentCount: number; deepViewCount: number;
}

interface Props {
  liveKpiData: LiveKpiData | null;
}

export default function PromotionLiveTab({ liveKpiData }: Props) {
  if (!liveKpiData) return <div className="pdd-card text-center py-8 text-[var(--pdd-text-secondary)]">暂无直播推广数据</div>;

  const kpiCards = [
    { label: '推广花费', value: liveKpiData.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
    { label: '推广订单数', value: liveKpiData.promoOrders, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-primary)' },
    { label: '推广GMV', value: liveKpiData.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广ROI', value: liveKpiData.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: 'var(--pdd-purple)' },
    { label: '曝光量', value: liveKpiData.totalImpressions, fmt: (v: number) => v.toFixed(0), icon: Eye, color: 'var(--pdd-primary)' },
    { label: '关注量', value: liveKpiData.followCount, fmt: (v: number) => v.toFixed(0), icon: Users, color: 'var(--pdd-purple)' },
    { label: '商品收藏量', value: liveKpiData.favoriteCount, fmt: (v: number) => v.toFixed(0), icon: Star, color: 'var(--pdd-warning)' },
    { label: '直播评论量', value: liveKpiData.commentCount, fmt: (v: number) => v.toFixed(0), icon: Mail, color: 'var(--pdd-cyan)' },
    { label: '深度观看', value: liveKpiData.deepViewCount, fmt: (v: number) => v.toFixed(0), icon: Eye, color: '#eb2f96' },
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

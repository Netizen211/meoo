import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, BarChart3, Package } from 'lucide-react';

interface LinkStat {
  name: string;
  gmv: number;
  cost: number;
  revenue: number;
  roi: number;
  netProfit: number;
}

interface Props {
  linkStats: LinkStat[];
}

export default function ProductLinkChart({ linkStats }: Props) {
  if (!linkStats || linkStats.length === 0) {
    return (
      <div className="pdd-card p-8 text-center">
        <Package size={40} className="mx-auto text-pdd-text-secondary mb-3 opacity-50" />
        <p className="text-sm text-pdd-text-secondary">暂无商品数据，请先上传订单或推广数据</p>
      </div>
    );
  }

  const maxVal = Math.max(
    ...linkStats.map(s => Math.max(s.cost, s.revenue, Math.abs(s.netProfit))),
    1
  );

  const sorted = [...linkStats].sort((a, b) => b.roi - a.roi);

  const getRankBadge = (idx: number) => {
    if (idx === 0) return { bg: 'bg-gradient-to-r from-pdd-primary to-pdd-primary-light', text: 'text-white', label: 'TOP 1' };
    if (idx === 1) return { bg: 'bg-gradient-to-r from-pdd-warning to-amber-300', text: 'text-white', label: 'TOP 2' };
    if (idx === 2) return { bg: 'bg-gradient-to-r from-pdd-info to-sky-300', text: 'text-white', label: 'TOP 3' };
    return null;
  };

  return (
    <div className="pdd-card p-5 mb-4">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pdd-primary to-pdd-primary-light flex items-center justify-center">
            <BarChart3 size={14} color="white" />
          </div>
          ROI对比分析
        </h3>
        <div className="flex items-center gap-3 text-xs text-pdd-text-secondary">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-pdd-success to-green-400" /> 实收
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-pdd-danger to-red-400" /> 成本
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-gradient-to-r from-pdd-info to-sky-400" /> 净利润
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {sorted.map((stat, idx) => {
          const costPct = Math.min((stat.cost / maxVal) * 100, 100);
          const revenuePct = Math.min((stat.revenue / maxVal) * 100, 100);
          const profitPct = Math.min((Math.abs(stat.netProfit) / maxVal) * 100, 100);
          const isProfit = stat.roi >= 1;
          const rankBadge = getRankBadge(idx);

          return (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.4 }}
              className="group rounded-lg hover:bg-pdd-bg transition-colors duration-200 py-2 px-2"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-[28px] flex items-center justify-center">
                  {rankBadge ? (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${rankBadge.bg} ${rankBadge.text}`}>
                      {rankBadge.label}
                    </span>
                  ) : (
                    <span className="text-[10px] text-pdd-text-secondary font-mono">{idx + 1}</span>
                  )}
                </div>

                <span className="text-xs font-medium truncate w-[90px] group-hover:text-pdd-primary transition-colors">{stat.name}</span>

                <div className="flex-1 relative h-7 bg-pdd-bg rounded-md overflow-hidden border border-pdd-border">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${revenuePct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.04, ease: 'easeOut' }}
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-pdd-success to-green-400 opacity-70 rounded-l-md"
                    title={`实收: ¥${stat.revenue.toFixed(0)}`}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${costPct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.04 + 0.1, ease: 'easeOut' }}
                    className="absolute left-0 top-0 h-full bg-gradient-to-r from-pdd-danger to-red-400 opacity-70 rounded-l-md"
                    style={{ zIndex: 2 }}
                    title={`成本: ¥${stat.cost.toFixed(0)}`}
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${profitPct}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.04 + 0.2, ease: 'easeOut' }}
                    className={`absolute left-0 top-0 h-full rounded-l-md ${stat.netProfit >= 0 ? 'bg-gradient-to-r from-pdd-info to-sky-400 opacity-60' : 'bg-gradient-to-r from-pdd-warning to-amber-400 opacity-60'}`}
                    style={{ zIndex: 3 }}
                    title={`净利润: ¥${stat.netProfit.toFixed(0)}`}
                  />
                  {revenuePct > 15 && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-mono text-white/80 z-[4] pointer-events-none">
                      ¥{stat.revenue.toFixed(0)}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 w-[80px] justify-end">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isProfit ? 'bg-pdd-success/10' : 'bg-pdd-danger/10'}`}>
                    {isProfit ? <TrendingUp size={12} className="text-pdd-success" /> : <TrendingDown size={12} className="text-pdd-danger" />}
                  </div>
                  <span className={`text-xs font-mono font-bold ${isProfit ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                    {stat.roi.toFixed(2)}x
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pl-[28px] mt-1">
                <span className="w-[90px]" />
                <div className="flex-1 flex items-center gap-2 text-[10px] text-pdd-text-secondary">
                  <span className="font-mono">实收 ¥{stat.revenue.toFixed(0)}</span>
                  <span className="text-pdd-border">|</span>
                  <span className="font-mono">成本 ¥{stat.cost.toFixed(0)}</span>
                  <span className="text-pdd-border">|</span>
                  <span className={`font-mono ${stat.netProfit >= 0 ? 'text-pdd-info' : 'text-pdd-warning'}`}>利润 ¥{stat.netProfit.toFixed(0)}</span>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-pdd-border flex items-center justify-between text-xs text-pdd-text-secondary">
        <span className="font-mono">共 {linkStats.length} 个商品 · 按 ROI 降序排列</span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pdd-success" /> 盈利 {sorted.filter(s => s.roi >= 1).length}
          <span className="w-2 h-2 rounded-full bg-pdd-danger ml-1" /> 亏损 {sorted.filter(s => s.roi < 1).length}
        </span>
      </div>
    </div>
  );
}

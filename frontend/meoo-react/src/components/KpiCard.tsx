import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, TrendingUp, TrendingDown, X, Info } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  change?: number | null;
  changeLabel?: string;
  icon: React.ElementType;
  color?: string;
  trend?: 'up' | 'down' | 'neutral';
  detailData?: { label: string; value: string | number }[];
  onClick?: () => void;
  className?: string;
}

export default function KpiCard({
  label,
  value,
  subValue,
  change,
  changeLabel = '环比',
  icon: Icon,
  color = 'var(--pdd-primary)',
  trend = 'neutral',
  detailData,
  onClick,
  className = ''
}: KpiCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const getTrendIcon = () => {
    if (trend === 'up') return <TrendingUp size={14} className="text-pdd-success" />;
    if (trend === 'down') return <TrendingDown size={14} className="text-pdd-danger" />;
    return null;
  };

  const getChangeColor = () => {
    if (change === null || change === undefined) return '';
    return change > 0 ? 'text-pdd-success' : change < 0 ? 'text-pdd-danger' : 'text-pdd-text-secondary';
  };

  const getChangeIcon = () => {
    if (change === null || change === undefined) return null;
    return change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />;
  };

  return (
    <>
      <div
        onClick={() => detailData ? setShowDetail(true) : onClick?.()}
        className={`pdd-card px-4 py-3 cursor-pointer transition-all hover:border-pdd-primary/30 ${className}`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1.5">
              <div className="p-1 rounded-md" style={{ backgroundColor: `${color}15` }}>
                <Icon size={14} style={{ color }} />
              </div>
              <span className="text-xs text-pdd-text-secondary truncate font-medium">{label}</span>
              {detailData && <Info size={12} className="text-pdd-text-secondary opacity-50" />}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-pdd-text">{value}</span>
              {getTrendIcon()}
            </div>
            {subValue && (
              <span className="text-xs text-pdd-text-secondary mt-0.5 block">{subValue}</span>
            )}
          </div>
        </div>

        {change !== null && change !== undefined && (
          <div className={`flex items-center gap-0.5 mt-2 text-xs font-medium ${getChangeColor()}`}>
            {getChangeIcon()}
            <span>{Math.abs(change).toFixed(1)}%</span>
            <span className="text-pdd-text-secondary ml-1">{changeLabel}</span>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {showDetail && detailData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetail(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-pdd-card border border-pdd-border rounded-lg p-5 max-w-sm w-full shadow-lg"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md" style={{ backgroundColor: `${color}15` }}>
                    <Icon size={18} style={{ color }} />
                  </div>
                  <span className="font-semibold text-pdd-text">{label}详情</span>
                </div>
                <button onClick={() => setShowDetail(false)} className="text-pdd-text-secondary hover:text-pdd-text transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="text-2xl font-bold mb-4 text-pdd-text">{value}</div>
              <div className="space-y-2">
                {detailData.map((item, i) => (
                  <div key={i} className="flex justify-between py-2 border-b border-pdd-border last:border-0">
                    <span className="text-sm text-pdd-text-secondary">{item.label}</span>
                    <span className="text-sm font-medium text-pdd-text">{item.value}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

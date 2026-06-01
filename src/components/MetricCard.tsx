import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, MoreHorizontal, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip } from 'recharts';

interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  change?: number;
  changeLabel?: string;
  trend?: { date: string; value: number }[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'highlight' | 'subtle';
  icon?: React.ReactNode;
  color?: string;
  onClick?: () => void;
  onDrillDown?: () => void;
  onCompare?: () => void;
  configurable?: boolean;
  visible?: boolean;
  onToggleVisibility?: () => void;
}

export default function MetricCard({
  title,
  value,
  unit = '',
  change,
  changeLabel = '环比',
  trend = [],
  size = 'md',
  variant = 'default',
  icon,
  color = '#6366f1',
  onClick,
  onDrillDown,
  onCompare,
  configurable = false,
  visible = true,
  onToggleVisibility,
}: MetricCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showTrend, setShowTrend] = useState(false);

  const sizeClasses = {
    sm: 'px-3 py-2',
    md: 'px-4 py-3',
    lg: 'px-5 py-4',
  };

  const valueSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl',
  };

  const variantClasses = {
    default: 'bg-pdd-card border-pdd-border',
    highlight: 'bg-pdd-primary/5 border-pdd-primary/20',
    subtle: 'bg-transparent border-pdd-border',
  };

  const formatValue = (v: number | string) => {
    if (typeof v === 'string') return v;
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return v.toFixed(v % 1 === 0 ? 0 : 2);
  };

  if (!visible) return null;

  return (
    <motion.div
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className={`relative rounded-xl border ${variantClasses[variant]} ${sizeClasses[size]} cursor-pointer transition-all hover:border-pdd-border`}
    >
      {/* Top accent line */}
      <div className="absolute top-0 left-4 right-4 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${color}40, transparent)` }} />

      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon && <span style={{ color }}>{icon}</span>}
          <span className="text-xs text-pdd-text-secondary font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {trend.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowTrend(!showTrend); }}
              className={`p-1 rounded-md transition-colors ${showTrend ? 'bg-pdd-primary/20' : 'hover:bg-pdd-bg'}`}
            >
              <TrendingUp size={12} className={showTrend ? 'text-pdd-primary-light' : 'text-pdd-text-secondary'} />
            </button>
          )}
          {configurable && (
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 rounded-md hover:bg-pdd-bg"
            >
              <MoreHorizontal size={12} className="text-pdd-text-secondary" />
            </button>
          )}
        </div>
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1">
        <span className={`${valueSizes[size]} font-semibold text-pdd-text tracking-tight`}>
          {formatValue(value)}
        </span>
        {unit && <span className="text-xs text-pdd-text-secondary">{unit}</span>}
      </div>

      {/* Change */}
      {change !== undefined && (
        <div className="flex items-center gap-1 mt-1">
          <span className={`text-xs flex items-center gap-0.5 ${change >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
            {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-pdd-text-secondary">{changeLabel}</span>
        </div>
      )}

      {/* Trend Chart */}
      <AnimatePresence>
        {showTrend && trend.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 60, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-2 overflow-hidden"
          >
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={trend}>
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--pdd-card)',
                    border: '1px solid var(--pdd-border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: 'var(--pdd-text)',
                  }}
                  labelStyle={{ color: 'var(--pdd-text-secondary)' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Context Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-8 right-0 z-20 bg-pdd-card border border-pdd-border rounded-xl shadow-2xl min-w-[140px]"
          >
            {onDrillDown && (
              <button
                onClick={(e) => { e.stopPropagation(); onDrillDown(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-xs text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-text flex items-center gap-2 first:rounded-t-xl"
              >
                <ArrowRight size={12} /> 下钻分析
              </button>
            )}
            {onCompare && (
              <button
                onClick={(e) => { e.stopPropagation(); onCompare(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-xs text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-text flex items-center gap-2"
              >
                <TrendingUp size={12} /> 对比分析
              </button>
            )}
            {onToggleVisibility && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleVisibility(); setShowMenu(false); }}
                className="w-full px-3 py-2 text-left text-xs text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-text flex items-center gap-2 last:rounded-b-xl"
              >
                <EyeOff size={12} /> 隐藏卡片
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

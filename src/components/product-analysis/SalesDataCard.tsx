import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  RotateCcw,
  ArrowRight,
  BarChart3,
} from 'lucide-react';

interface SalesData {
  gmv: number;
  revenue: number;
  orders: number;
  sales: number;
  avgOrderValue: number;
  refund: number;
  refundRate: number;
  // 环比数据
  gmvChange?: number;
  revenueChange?: number;
  ordersChange?: number;
  salesChange?: number;
  avgOrderValueChange?: number;
  refundChange?: number;
  refundRateChange?: number;
}

interface SalesDataCardProps {
  salesData: SalesData;
  onDrillDown?: () => void;
}

interface MetricItemProps {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  change?: number;
  icon: React.ElementType;
  color: string;
  isCurrency?: boolean;
  isPercentage?: boolean;
}

import { getColor } from '../../utils/colorMap';

function MetricItem({ label, value, prefix = '', suffix = '', change, icon: Icon, color, isCurrency, isPercentage }: MetricItemProps) {
  const formatValue = (v: number) => {
    if (isCurrency) {
      if (v >= 10000) return `${prefix}${(v / 10000).toFixed(1)}万`;
      return `${prefix}${v.toFixed(2)}`;
    }
    if (isPercentage) return `${v.toFixed(2)}${suffix}`;
    if (v >= 10000) return `${prefix}${(v / 10000).toFixed(1)}万${suffix}`;
    return `${prefix}${v.toFixed(0)}${suffix}`;
  };

  const getChangeColor = () => {
    if (change === undefined) return '';
    // 对于退款率，下降是好的
    if (label.includes('退款')) {
      return change < 0 ? 'text-pdd-success' : change > 0 ? 'text-pdd-danger' : 'text-pdd-text-secondary';
    }
    return change > 0 ? 'text-pdd-success' : change < 0 ? 'text-pdd-danger' : 'text-pdd-text-secondary';
  };

  const getChangeIcon = () => {
    if (change === undefined) return null;
    if (label.includes('退款')) {
      return change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />;
    }
    return change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  };

  const hexColor = getColor(color);

  return (
    <div className="bg-pdd-bg rounded-xl p-4 hover:bg-pdd-bg transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${hexColor}15` }}>
          <Icon size={14} style={{ color: hexColor }} />
        </div>
        <span className="text-xs text-pdd-text-secondary font-medium">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-bold text-pdd-text">{formatValue(value)}</span>
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${getChangeColor()}`}>
          {getChangeIcon()}
          <span>{Math.abs(change).toFixed(1)}%</span>
          <span className="text-pdd-text-secondary ml-1">环比</span>
        </div>
      )}
    </div>
  );
}

export default function SalesDataCard({ salesData, onDrillDown }: SalesDataCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const metrics: MetricItemProps[] = [
    {
      label: 'GMV',
      value: salesData.gmv,
      prefix: '¥',
      change: salesData.gmvChange,
      icon: DollarSign,
      color: 'var(--pdd-primary)',
      isCurrency: true,
    },
    {
      label: '实收金额',
      value: salesData.revenue,
      prefix: '¥',
      change: salesData.revenueChange,
      icon: DollarSign,
      color: 'var(--pdd-success)',
      isCurrency: true,
    },
    {
      label: '订单数',
      value: salesData.orders,
      suffix: '单',
      change: salesData.ordersChange,
      icon: ShoppingCart,
      color: 'var(--pdd-purple)',
    },
    {
      label: '销量',
      value: salesData.sales,
      suffix: '件',
      change: salesData.salesChange,
      icon: Package,
      color: 'var(--pdd-warning)',
    },
    {
      label: '客单价',
      value: salesData.avgOrderValue,
      prefix: '¥',
      change: salesData.avgOrderValueChange,
      icon: Users,
      color: '#13c2c2',
      isCurrency: true,
    },
    {
      label: '退款金额',
      value: salesData.refund,
      prefix: '¥',
      change: salesData.refundChange,
      icon: RotateCcw,
      color: 'var(--pdd-danger)',
      isCurrency: true,
    },
  ];

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-pdd-bg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
            <BarChart3 size={20} className="text-pdd-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-pdd-text text-sm">销售数据</h3>
            <p className="text-xs text-pdd-text-secondary mt-0.5">
              退款率: <span className={salesData.refundRate > 10 ? 'text-pdd-danger' : 'text-pdd-success'}>{salesData.refundRate.toFixed(2)}%</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDrillDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDrillDown();
              }}
              className="px-3 py-1.5 text-xs font-medium text-pdd-primary bg-pdd-info/10 rounded-lg hover:bg-pdd-info/10 transition-colors flex items-center gap-1"
            >
              查看明细
              <ArrowRight size={12} />
            </button>
          )}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            {isExpanded ? (
              <ChevronUp size={18} className="text-pdd-text-secondary" />
            ) : (
              <ChevronDown size={18} className="text-pdd-text-secondary" />
            )}
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <div className="px-5 pb-5">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {metrics.map((metric) => (
                  <MetricItem key={metric.label} {...metric} />
                ))}
              </div>

              {/* Summary Stats */}
              <div className="mt-4 bg-gradient-to-r from-pdd-gray-50 to-pdd-gray-100 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RotateCcw size={14} className="text-pdd-text-secondary" />
                    <span className="text-xs text-pdd-text font-medium">退款率</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className="text-lg font-bold"
                      style={{ color: salesData.refundRate > 10 ? 'var(--pdd-primary-light)' : 'var(--pdd-success)' }}
                    >
                      {salesData.refundRate.toFixed(2)}%
                    </span>
                    {salesData.refundRateChange !== undefined && (
                      <span
                        className={`text-xs flex items-center gap-1 ${
                          salesData.refundRateChange < 0 ? 'text-pdd-success' : 'text-pdd-danger'
                        }`}
                      >
                        {salesData.refundRateChange < 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                        {Math.abs(salesData.refundRateChange).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 h-2 bg-pdd-bg rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(salesData.refundRate, 100)}%`,
                      backgroundColor: salesData.refundRate > 10 ? 'var(--pdd-primary-light)' : 'var(--pdd-success)',
                    }}
                  />
                </div>
                <p className="text-xs text-pdd-text-secondary mt-2">
                  {salesData.refundRate > 10
                    ? '退款率偏高，建议关注商品质量和描述准确性'
                    : '退款率处于健康水平'}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

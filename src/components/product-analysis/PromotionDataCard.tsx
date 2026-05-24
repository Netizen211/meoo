import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  Zap,
  TrendingUp,
  TrendingDown,
  Eye,
  MousePointer,
  ShoppingCart,
  DollarSign,
  Target,
  BarChart3,
  ArrowRight,
  Star,
  AlertCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

interface PromotionData {
  promoCost: number;
  promoTransaction: number;
  roi: number;
  ctr: number;
  cvr: number;
  promoImpressions: number;
  promoClicks: number;
  promoOrders: number;
  // 环比数据
  promoCostChange?: number;
  promoTransactionChange?: number;
  roiChange?: number;
  ctrChange?: number;
  cvrChange?: number;
  // 数据质量
  dataQualityScore?: number;
  hasPromoData: boolean;
}

interface PromotionDataCardProps {
  data: PromotionData;
  onDrillDown?: () => void;
}

interface MetricCardProps {
  label: string;
  value: number;
  change?: number;
  prefix?: string;
  suffix?: string;
  icon: React.ElementType;
  color: string;
  isPercentage?: boolean;
  isRatio?: boolean;
}

function MetricCard({
  label,
  value,
  change,
  prefix = '',
  suffix = '',
  icon: Icon,
  color,
  isPercentage,
  isRatio,
}: MetricCardProps) {
  const formatValue = (v: number) => {
    if (isRatio) return `${v.toFixed(2)}x`;
    if (isPercentage) return `${v.toFixed(2)}%`;
    if (prefix === '¥') {
      if (v >= 10000) return `${prefix}${(v / 10000).toFixed(1)}万`;
      return `${prefix}${v.toFixed(2)}`;
    }
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万${suffix}`;
    return `${v.toFixed(0)}${suffix}`;
  };

  const getChangeColor = () => {
    if (change === undefined) return '';
    // ROI、CTR、CVR 上升是好的
    if (label.includes('花费')) {
      return change < 0 ? 'text-pdd-success' : 'text-pdd-danger';
    }
    return change > 0 ? 'text-pdd-success' : change < 0 ? 'text-pdd-danger' : 'text-pdd-text-secondary';
  };

  const getChangeIcon = () => {
    if (change === undefined) return null;
    if (label.includes('花费')) {
      return change < 0 ? <TrendingDown size={12} /> : <TrendingUp size={12} />;
    }
    return change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />;
  };

  return (
    <div className="bg-pdd-bg rounded-xl p-4 hover:bg-pdd-bg transition-colors">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon size={14} style={{ color }} />
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

function DataQualityBadge({ score }: { score: number }) {
  let color = 'text-pdd-text-secondary';
  let bgColor = 'bg-pdd-bg';
  let borderColor = 'border-pdd-border';
  let label = '暂无数据';

  if (score >= 80) {
    color = 'text-pdd-success';
    bgColor = 'bg-pdd-success/10';
    borderColor = 'border-green-200';
    label = '数据完整';
  } else if (score >= 60) {
    color = 'text-yellow-600';
    bgColor = 'bg-pdd-warning/10';
    borderColor = 'border-yellow-200';
    label = '数据部分缺失';
  } else if (score > 0) {
    color = 'text-pdd-danger';
    bgColor = 'bg-pdd-danger/10';
    borderColor = 'border-red-200';
    label = '数据严重缺失';
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border ${bgColor} ${color} ${borderColor}`}>
      {score > 0 ? <Star size={10} /> : <AlertCircle size={10} />}
      {label}
      {score > 0 && <span className="font-mono">{score}分</span>}
    </span>
  );
}

export default function PromotionDataCard({ data, onDrillDown }: PromotionDataCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showFunnel, setShowFunnel] = useState(true);

  const metrics: MetricCardProps[] = [
    {
      label: '推广花费',
      value: data.promoCost,
      prefix: '¥',
      change: data.promoCostChange,
      icon: DollarSign,
      color: 'var(--pdd-danger)',
    },
    {
      label: '推广成交',
      value: data.promoTransaction,
      prefix: '¥',
      change: data.promoTransactionChange,
      icon: DollarSign,
      color: 'var(--pdd-success)',
    },
    {
      label: 'ROI',
      value: data.roi,
      change: data.roiChange,
      icon: Target,
      color: 'var(--pdd-primary)',
      isRatio: true,
    },
    {
      label: '点击率',
      value: data.ctr,
      change: data.ctrChange,
      suffix: '%',
      icon: MousePointer,
      color: 'var(--pdd-warning)',
      isPercentage: true,
    },
    {
      label: '转化率',
      value: data.cvr,
      change: data.cvrChange,
      suffix: '%',
      icon: ShoppingCart,
      color: 'var(--pdd-purple)',
      isPercentage: true,
    },
  ];

  const funnelData = [
    { name: '曝光', value: data.promoImpressions, color: 'var(--pdd-primary)' },
    { name: '点击', value: data.promoClicks, color: 'var(--pdd-warning)' },
    { name: '成交', value: data.promoOrders, color: 'var(--pdd-success)' },
  ];

  const maxFunnelValue = Math.max(...funnelData.map((d) => d.value), 1);

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-pdd-bg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-50 to-purple-100 flex items-center justify-center">
            <Zap size={20} className="text-[var(--pdd-purple)]" />
          </div>
          <div>
            <h3 className="font-semibold text-pdd-text text-sm">推广数据</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-pdd-text-secondary">
                ROI: <span className={data.roi >= 1 ? 'text-pdd-success' : 'text-pdd-danger'}>{data.roi.toFixed(2)}x</span>
              </p>
              {data.dataQualityScore !== undefined && (
                <DataQualityBadge score={data.dataQualityScore} />
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onDrillDown && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDrillDown();
              }}
              className="px-3 py-1.5 text-xs font-medium text-[var(--pdd-purple)] bg-pdd-primary/10 rounded-lg hover:bg-pdd-primary/10 transition-colors flex items-center gap-1"
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
            <div className="px-5 pb-5 space-y-4">
              {/* Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {metrics.map((metric) => (
                  <MetricCard key={metric.label} {...metric} />
                ))}
              </div>

              {/* Traffic Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Eye size={12} className="text-pdd-info" />
                    <span className="text-xs text-blue-700 font-medium">曝光量</span>
                  </div>
                  <span className="text-lg font-bold text-blue-800">{data.promoImpressions.toLocaleString()}</span>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 border border-yellow-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <MousePointer size={12} className="text-yellow-600" />
                    <span className="text-xs text-yellow-700 font-medium">点击量</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-800">{data.promoClicks.toLocaleString()}</span>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <ShoppingCart size={12} className="text-pdd-success" />
                    <span className="text-xs text-green-700 font-medium">成交单</span>
                  </div>
                  <span className="text-lg font-bold text-green-800">{data.promoOrders.toLocaleString()}</span>
                </div>
              </div>

              {/* Funnel Chart */}
              <button
                onClick={() => setShowFunnel(!showFunnel)}
                className="w-full flex items-center justify-between p-3 bg-pdd-bg rounded-xl hover:bg-pdd-bg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 size={14} className="text-pdd-text-secondary" />
                  <span className="text-xs font-medium text-pdd-text">推广漏斗</span>
                </div>
                <motion.div animate={{ rotate: showFunnel ? 180 : 0 }}>
                  <ChevronDown size={16} className="text-pdd-text-secondary" />
                </motion.div>
              </button>

              <AnimatePresence>
                {showFunnel && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-3"
                  >
                    {funnelData.map((step, index) => {
                      const percentage = maxFunnelValue > 0 ? (step.value / maxFunnelValue) * 100 : 0;
                      const prevStep = index > 0 ? funnelData[index - 1] : null;
                      const conversionRate =
                        prevStep && prevStep.value > 0 ? (step.value / prevStep.value) * 100 : 100;

                      return (
                        <div key={step.name} className="bg-pdd-bg rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                                style={{ backgroundColor: step.color }}
                              >
                                {index + 1}
                              </span>
                              <span className="text-sm font-medium text-pdd-text">{step.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold text-pdd-text">{step.value.toLocaleString()}</span>
                              {index > 0 && (
                                <span className="text-xs text-pdd-text-secondary">转化率: {conversionRate.toFixed(1)}%</span>
                              )}
                            </div>
                          </div>
                          <div className="h-2.5 bg-pdd-bg rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              transition={{ duration: 0.5, delay: index * 0.1 }}
                              className="h-full rounded-full"
                              style={{ backgroundColor: step.color }}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Summary */}
                    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-100">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <span className="text-xs text-pdd-text-secondary block mb-1">总点击率 (CTR)</span>
                          <span className="text-lg font-bold text-purple-700">{data.ctr.toFixed(2)}%</span>
                        </div>
                        <div>
                          <span className="text-xs text-pdd-text-secondary block mb-1">总转化率 (CVR)</span>
                          <span className="text-lg font-bold text-pink-700">{data.cvr.toFixed(2)}%</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

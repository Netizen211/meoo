import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown,
  ChevronUp,
  DollarSign,
  Package,
  Box,
  Truck,
  Zap,
  Building2,
  Receipt,
  Settings,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  PieChart,
} from 'lucide-react';
import { PieChart as RePieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface CostBreakdown {
  productCost: number;
  packagingFee: number;
  shippingFee: number;
  promoCost: number;
  platformFee: number;
  insuranceFee: number;
  penaltyFee: number;
  marketingFee: number;
  taxes: number;
  customDeductions: number;
}

interface CostSource {
  productCost: 'real' | 'estimated' | 'missing';
  taxes: 'configured' | 'default';
  customDeductions: 'configured' | 'none';
}

interface CostProfitData {
  costBreakdown: CostBreakdown;
  costSource: CostSource;
  grossProfit: number;
  preTaxProfit: number;
  netProfit: number;
  profitRate: number;
  gmv: number;
}

interface CostProfitCardProps {
  data: CostProfitData;
  onDrillDown?: () => void;
}

import { getColor, chartColors } from '../../utils/colorMap';

const COLORS = {
  productCost: chartColors.danger,
  packagingFee: chartColors.warning,
  shippingFee: chartColors.primary,
  promoCost: chartColors.purple,
  platformFee: chartColors.cyan,
  insuranceFee: '#ffc53d',
  penaltyFee: '#f5222d',
  marketingFee: '#eb2f96',
  taxes: chartColors.pink,
  customDeductions: chartColors.orange,
};

const LABELS: Record<keyof CostBreakdown, string> = {
  productCost: '商品成本',
  packagingFee: '包装费',
  shippingFee: '邮费',
  promoCost: '推广费',
  platformFee: '平台扣点',
  insuranceFee: '运费险',
  penaltyFee: '罚款/扣款',
  marketingFee: '营销费用',
  taxes: '税费',
  customDeductions: '自定义扣费',
};

const ICONS: Record<keyof CostBreakdown, React.ElementType> = {
  productCost: Package,
  packagingFee: Box,
  shippingFee: Truck,
  promoCost: Zap,
  platformFee: Building2,
  insuranceFee: Settings,
  penaltyFee: AlertCircle,
  marketingFee: TrendingDown,
  taxes: Receipt,
  customDeductions: Settings,
};

function CostSourceBadge({ type, label }: { type: 'real' | 'estimated' | 'missing' | 'configured' | 'default' | 'none'; label: string }) {
  const styles = {
    real: 'bg-pdd-success/10 text-pdd-success border-green-200',
    estimated: 'bg-pdd-warning/10 text-yellow-600 border-yellow-200',
    missing: 'bg-pdd-danger/10 text-pdd-danger border-red-200',
    configured: 'bg-pdd-info/10 text-pdd-info border-blue-200',
    default: 'bg-pdd-bg text-pdd-text border-pdd-border',
    none: 'bg-pdd-bg text-pdd-text-secondary border-pdd-border',
  };

  const icons = {
    real: CheckCircle2,
    estimated: HelpCircle,
    missing: AlertCircle,
    configured: CheckCircle2,
    default: HelpCircle,
    none: AlertCircle,
  };

  const Icon = icons[type];

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${styles[type]}`}>
      <Icon size={10} />
      {label}
    </span>
  );
}

export default function CostProfitCard({ data, onDrillDown }: CostProfitCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showCostDetail, setShowCostDetail] = useState(false);

  const totalCost = useMemo(() => {
    return Object.values(data.costBreakdown).reduce((sum, v) => sum + v, 0);
  }, [data.costBreakdown]);

  const pieData = useMemo(() => {
    return Object.entries(data.costBreakdown)
      .filter(([_, value]) => value > 0)
      .map(([key, value]) => ({
        name: LABELS[key as keyof CostBreakdown],
        value,
        key,
      }));
  }, [data.costBreakdown]);

  const profitTrend = data.netProfit >= 0 ? 'up' : 'down';
  const profitColor = data.netProfit >= 0 ? chartColors.success : chartColors.danger;

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-pdd-bg transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center">
            <DollarSign size={20} className="text-pdd-success" />
          </div>
          <div>
            <h3 className="font-semibold text-pdd-text text-sm">成本利润</h3>
            <p className="text-xs text-pdd-text-secondary mt-0.5">
              净利润: <span style={{ color: profitColor }}>¥{data.netProfit.toFixed(2)}</span>
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
              className="px-3 py-1.5 text-xs font-medium text-pdd-success bg-pdd-success/10 rounded-lg hover:bg-pdd-success/10 transition-colors flex items-center gap-1"
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
              {/* Profit Overview */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign size={12} className="text-pdd-success" />
                    <span className="text-xs text-green-700 font-medium">毛利润</span>
                  </div>
                  <span className="text-lg font-bold text-green-800">¥{data.grossProfit.toFixed(2)}</span>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                  <div className="flex items-center gap-1.5 mb-2">
                    <DollarSign size={12} className="text-pdd-info" />
                    <span className="text-xs text-blue-700 font-medium">税前利润</span>
                  </div>
                  <span className="text-lg font-bold text-blue-800">¥{data.preTaxProfit.toFixed(2)}</span>
                </div>
                <div
                  className="rounded-xl p-4 border"
                  style={{
                    background: `linear-gradient(135deg, ${profitColor}15, ${profitColor}25)`,
                    borderColor: `${profitColor}30`,
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    {profitTrend === 'up' ? (
                      <TrendingUp size={12} style={{ color: profitColor }} />
                    ) : (
                      <TrendingDown size={12} style={{ color: profitColor }} />
                    )}
                    <span className="text-xs font-medium" style={{ color: profitColor }}>净利润</span>
                  </div>
                  <span className="text-lg font-bold" style={{ color: profitColor }}>
                    ¥{data.netProfit.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Profit Rate */}
              <div className="bg-pdd-bg rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-pdd-text font-medium">利润率</span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: data.profitRate >= 0 ? chartColors.success : chartColors.danger }}
                  >
                    {data.profitRate.toFixed(2)}%
                  </span>
                </div>
                <div className="h-3 bg-pdd-bg rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(Math.abs(data.profitRate), 100)}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: data.profitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)',
                      marginLeft: data.profitRate < 0 ? 'auto' : 0,
                      marginRight: data.profitRate < 0 ? 0 : 'auto',
                    }}
                  />
                </div>
                <p className="text-xs text-pdd-text-secondary mt-2">
                  基于GMV ¥{data.gmv.toFixed(2)} 计算
                </p>
              </div>

              {/* Cost Breakdown Toggle */}
              <button
                onClick={() => setShowCostDetail(!showCostDetail)}
                className="w-full flex items-center justify-between p-3 bg-pdd-bg rounded-xl hover:bg-pdd-bg transition-colors"
              >
                <div className="flex items-center gap-2">
                  <PieChart size={14} className="text-pdd-text-secondary" />
                  <span className="text-xs font-medium text-pdd-text">成本构成</span>
                  <span className="text-xs text-pdd-text-secondary">¥{totalCost.toFixed(2)}</span>
                </div>
                <motion.div animate={{ rotate: showCostDetail ? 180 : 0 }}>
                  <ChevronDown size={16} className="text-pdd-text-secondary" />
                </motion.div>
              </button>

              {/* Cost Detail */}
              <AnimatePresence>
                {showCostDetail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-4"
                  >
                    {/* Cost Pie Chart */}
                    {pieData.length > 0 && (
                      <div className="bg-pdd-bg rounded-xl p-4">
                        <ResponsiveContainer width="100%" height={180}>
                          <RePieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="50%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {pieData.map((entry) => (
                                <Cell key={entry.key} fill={COLORS[entry.key as keyof typeof COLORS]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => [`¥${value.toFixed(2)}`, '金额']}
                              contentStyle={{
                                borderRadius: '8px',
                                border: 'none',
                                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                              }}
                            />
                          </RePieChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Cost Items */}
                    <div className="space-y-2">
                      {Object.entries(data.costBreakdown).map(([key, value]) => {
                        const k = key as keyof CostBreakdown;
                        const Icon = ICONS[k];
                        const percentage = totalCost > 0 ? (value / totalCost) * 100 : 0;

                        return (
                          <div key={key} className="bg-pdd-bg rounded-xl p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-6 h-6 rounded-lg flex items-center justify-center"
                                  style={{ backgroundColor: `${COLORS[k]}15` }}
                                >
                                  <Icon size={12} style={{ color: COLORS[k] }} />
                                </div>
                                <span className="text-xs font-medium text-pdd-text">{LABELS[k]}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-pdd-text">¥{value.toFixed(2)}</span>
                                <span className="text-xs text-pdd-text-secondary">({percentage.toFixed(1)}%)</span>
                              </div>
                            </div>
                            <div className="h-1.5 bg-pdd-bg rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${percentage}%`,
                                  backgroundColor: COLORS[k],
                                }}
                              />
                            </div>
                            {/* Cost Source Tags */}
                            <div className="flex items-center gap-2 mt-2">
                              {k === 'productCost' && (
                                <CostSourceBadge
                                  type={data.costSource.productCost}
                                  label={
                                    data.costSource.productCost === 'real'
                                      ? '真实成本'
                                      : data.costSource.productCost === 'estimated'
                                      ? '估算成本'
                                      : '成本缺失'
                                  }
                                />
                              )}
                              {k === 'taxes' && (
                                <CostSourceBadge
                                  type={data.costSource.taxes}
                                  label={data.costSource.taxes === 'configured' ? '已配置' : '默认'}
                                />
                              )}
                              {k === 'customDeductions' && (
                                <CostSourceBadge
                                  type={data.costSource.customDeductions}
                                  label={data.costSource.customDeductions === 'configured' ? '已配置' : '无'}
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
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

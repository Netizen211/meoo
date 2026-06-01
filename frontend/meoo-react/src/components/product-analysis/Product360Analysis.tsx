import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, RotateCcw,
  Target, BarChart3, Link2, Layers, Zap, Clock, MapPin, Users, ChevronDown,
  ChevronUp, Download, Eye, FileText, Info, CheckCircle, XCircle, ArrowRight,
  Activity, PieChart as PieChartIcon, TrendingDown, Percent, Filter, Share2,
  ChevronRight, MoreHorizontal, Calendar, Tag, Hash, Box, Truck, Receipt,
  CreditCard, Wallet, Calculator, Globe, UserPlus, RefreshCw, Shield, AlertCircle
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, AreaChart, Area, ComposedChart,
  ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { ProductStat } from '../ProductLinkStats';

// 展开/折叠卡片组件
interface CollapsibleCardProps {
  title: string;
  icon: React.ReactNode;
  iconColor: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string | number;
  badgeColor?: string;
  action?: React.ReactNode;
}

function CollapsibleCard({
  title, icon, iconColor, children, defaultExpanded = true,
  badge, badgeColor = '#e02e24', action
}: CollapsibleCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden"
    >
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-pdd-bg/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${iconColor}15` }}>
            {icon}
          </div>
          <span className="font-semibold text-pdd-text text-sm">{title}</span>
          {badge !== undefined && (
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium"
              style={{ backgroundColor: `${badgeColor}15`, color: badgeColor }}
            >
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {action}
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown size={18} className="text-pdd-text-secondary" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="px-4 pb-4 border-t border-pdd-border">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// 指标卡片组件
interface MetricCardProps {
  label: string;
  value: string | number;
  subValue?: string;
  trend?: number;
  trendLabel?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
  showDetail?: boolean;
  detailContent?: React.ReactNode;
}

function MetricCard({
  label, value, subValue, trend, trendLabel, color = 'var(--pdd-info)',
  icon, onClick, clickable = false, showDetail, detailContent
}: MetricCardProps) {
  const [showDetailModal, setShowDetailModal] = useState(false);

  const handleClick = () => {
    if (showDetail && detailContent) {
      setShowDetailModal(true);
    }
    onClick?.();
  };

  return (
    <>
      <motion.div
        whileHover={clickable || showDetail ? { scale: 1.02, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' } : {}}
        onClick={handleClick}
        className={`bg-pdd-bg rounded-xl p-3.5 ${clickable || showDetail ? 'cursor-pointer' : ''} relative`}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="text-xs text-pdd-text-secondary font-medium">{label}</span>
          <div className="flex items-center gap-1">
            {showDetail && (
              <Eye size={12} className="text-pdd-border" />
            )}
            {icon && <div className="text-pdd-text-secondary">{icon}</div>}
          </div>
        </div>
        <div className="text-lg font-bold font-mono" style={{ color }}>
          {value}
        </div>
        {subValue && (
          <div className="text-xs text-pdd-text-secondary mt-1">{subValue}</div>
        )}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1.5 text-xs ${trend >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
            {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            <span>{Math.abs(trend).toFixed(1)}%</span>
            {trendLabel && <span className="text-pdd-text-secondary ml-1">{trendLabel}</span>}
          </div>
        )}
      </motion.div>

      {/* 明细弹窗 */}
      <AnimatePresence>
        {showDetailModal && detailContent && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDetailModal(false)}
          >
            <div className="absolute inset-0 bg-pdd-text/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-pdd-card rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-pdd-border">
                <span className="font-semibold text-pdd-text">{label} - 数据明细</span>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text"
                >
                  <XCircle size={18} />
                </button>
              </div>
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {detailContent}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// 数据链路展示组件
function DataChainVisualization() {
  const steps = [
    { label: '订单数据', icon: ShoppingCart, color: '#1890ff', desc: '原始交易记录' },
    { label: '商品聚合', icon: Package, color: '#52c41a', desc: '按商品ID汇总' },
    { label: '成本匹配', icon: DollarSign, color: '#faad14', desc: 'SKU/编码匹配' },
    { label: '利润计算', icon: Calculator, color: '#722ed1', desc: '多维度扣减' },
    { label: '指标展示', icon: BarChart3, color: '#e02e24', desc: '可视化呈现' },
  ];

  return (
    <div className="bg-gradient-to-r from-pdd-gray-50 to-pdd-gray-100 rounded-xl p-4">
      <div className="flex items-center gap-0">
        {steps.map((step, index) => (
          <div key={step.label} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: `${step.color}15`, border: `2px solid ${step.color}` }}
              >
                <step.icon size={16} color={step.color} />
              </div>
              <span className="text-[11px] font-medium text-pdd-text mt-1.5 whitespace-nowrap">{step.label}</span>
              <span className="text-[10px] text-pdd-text-secondary mt-0.5 whitespace-nowrap">{step.desc}</span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 flex items-center justify-center min-w-[24px] mx-1">
                <div className="h-[2px] w-full bg-pdd-gray-300 rounded-full" />
                <ArrowRight size={12} className="text-pdd-text-secondary shrink-0 -ml-1" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 数据质量评分组件
function DataQualityScore({ score, issues }: { score: number; issues: string[] }) {
  const getColor = (s: number) => {
    if (s >= 90) return 'var(--pdd-success)';
    if (s >= 70) return 'var(--pdd-warning)';
    return 'var(--pdd-danger)';
  };

  return (
    <div className="flex items-center gap-3 bg-pdd-bg rounded-lg px-3 py-2">
      <div className="relative w-12 h-12">
        <svg className="w-12 h-12 transform -rotate-90">
          <circle cx="24" cy="24" r="20" stroke="var(--pdd-gray-200)" strokeWidth="4" fill="none" />
          <circle
            cx="24" cy="24" r="20"
            stroke={getColor(score)}
            strokeWidth="4"
            fill="none"
            strokeDasharray={`${score * 1.26} 126`}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-xs font-bold" style={{ color: getColor(score) }}>{score}</span>
        </div>
      </div>
      <div className="flex-1">
        <div className="text-xs font-medium text-pdd-text">数据质量评分</div>
        <div className="text-[10px] text-pdd-text-secondary">
          {issues.length === 0 ? '数据完整度良好' : `${issues.length}项待完善`}
        </div>
      </div>
      {issues.length > 0 && (
        <div className="group relative">
          <AlertCircle size={16} className="text-pdd-warning cursor-help" />
          <div className="absolute right-0 top-full mt-2 w-48 bg-pdd-card rounded-lg shadow-lg border border-pdd-border p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {issues.map((issue, i) => (
              <div key={i} className="text-[10px] text-pdd-text py-0.5">• {issue}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 商品基础信息区
function BasicInfoSection({ product }: { product: ProductStat }) {
  const getLifecycleStage = (days: number) => {
    if (days < 7) return { label: '新品期', color: 'var(--pdd-info)', bg: '#e6f7ff' };
    if (days < 30) return { label: '成长期', color: 'var(--pdd-success)', bg: '#f6ffed' };
    if (days < 90) return { label: '成熟期', color: 'var(--pdd-warning)', bg: '#fffbe6' };
    return { label: '衰退期', color: 'var(--pdd-text-secondary)', bg: 'var(--pdd-bg)' };
  };

  const stage = getLifecycleStage(product.activeDays);

  return (
    <div className="space-y-4 pt-4">
      {/* 商品标题和ID */}
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center shrink-0">
          <Package size={28} color="var(--pdd-primary)" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-pdd-text leading-tight mb-1 line-clamp-2">
            {product.productName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-pdd-bg text-pdd-text text-xs font-mono">
              ID: {product.productId}
            </span>
            {product.productCode && (
              <span className="px-2 py-0.5 rounded-md bg-pdd-info/10 text-pdd-info text-xs font-mono">
                编码: {product.productCode}
              </span>
            )}
            <span
              className="px-2 py-0.5 rounded-md text-xs font-medium"
              style={{ backgroundColor: stage.bg, color: stage.color }}
            >
              {stage.label}
            </span>
          </div>
        </div>
      </div>

      {/* 基础指标网格 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="类目层级"
          value="-"
          color="var(--pdd-info)"
          icon={<Tag size={14} />}
        />
        <MetricCard
          label="价格带"
          value={`¥${product.avgOrderValue.toFixed(0)}`}
          subValue="平均客单价"
          color="var(--pdd-success)"
          icon={<DollarSign size={14} />}
        />
        <MetricCard
          label="上架天数"
          value={`${product.activeDays}天`}
          subValue={`${product.firstOrderDate} 首单`}
          color="var(--pdd-warning)"
          icon={<Calendar size={14} />}
        />
        <MetricCard
          label="数据完整度"
          value={product.hasOrderData && product.hasPromoData ? '100%' : product.hasOrderData ? '60%' : '40%'}
          color="#722ed1"
          icon={<CheckCircle size={14} />}
        />
      </div>
    </div>
  );
}

// 销售数据明细组件
function GMVDetailContent({ product }: { product: ProductStat }) {
  return (
    <div className="space-y-4">
      <div className="bg-pdd-info/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">计算公式</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-blue-100">
          GMV = Σ(订单金额)
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">数据来源链路</div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-pdd-info/10 flex items-center justify-center text-pdd-info font-bold">1</div>
            <span className="text-pdd-text">订单数据文件 (CSV)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-pdd-info/10 flex items-center justify-center text-pdd-info font-bold">2</div>
            <span className="text-pdd-text">筛选该商品ID的所有订单</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-pdd-info/10 flex items-center justify-center text-pdd-info font-bold">3</div>
            <span className="text-pdd-text">累加订单金额列</span>
          </div>
        </div>
      </div>
      <div className="border-t border-pdd-border pt-3">
        <div className="text-xs text-pdd-text-secondary mb-2">关键数据项</div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-pdd-bg rounded p-2">
            <span className="text-pdd-text-secondary">订单数</span>
            <div className="font-mono font-medium">{product.orders}</div>
          </div>
          <div className="bg-pdd-bg rounded p-2">
            <span className="text-pdd-text-secondary">平均订单金额</span>
            <div className="font-mono font-medium">¥{(product.gmv / Math.max(product.orders, 1)).toFixed(2)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevenueDetailContent({ product }: { product: ProductStat }) {
  const otherFees = product.gmv - product.discount - product.refund - product.revenue;
  return (
    <div className="space-y-4">
      <div className="bg-pdd-success/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">数据来源</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-green-100">
          商家实收 = 订单「商家实收金额」字段直接读取
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">费用构成（仅供参考）</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">GMV</span>
            <span className="font-mono">¥{product.gmv.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 优惠总额</span>
            <span className="font-mono text-pdd-danger">-¥{product.discount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 退款金额</span>
            <span className="font-mono text-pdd-danger">-¥{product.refund.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 平台服务费等</span>
            <span className="font-mono text-pdd-danger">-¥{otherFees.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 font-medium bg-pdd-success/10 rounded px-2">
            <span className="text-green-700">= 商家实收</span>
            <span className="font-mono text-green-700">¥{product.revenue.toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-pdd-text-secondary">
        折扣率: {product.discountRatio.toFixed(2)}%
      </div>
    </div>
  );
}

function OrdersDetailContent({ product }: { product: ProductStat }) {
  return (
    <div className="space-y-4">
      <div className="bg-pdd-warning/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">统计口径</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-amber-100">
          订单数 = 该商品ID的去重订单数量
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">数据明细</div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-pdd-bg rounded-lg p-3 text-center">
            <div className="text-xs text-pdd-text-secondary mb-1">订单数</div>
            <div className="text-lg font-bold text-pdd-warning">{product.orders}</div>
          </div>
          <div className="bg-pdd-bg rounded-lg p-3 text-center">
            <div className="text-xs text-pdd-text-secondary mb-1">销量</div>
            <div className="text-lg font-bold text-pdd-info">{product.sales}</div>
          </div>
        </div>
        <div className="text-xs text-pdd-text-secondary text-center">
          平均件数: {(product.sales / Math.max(product.orders, 1)).toFixed(2)} 件/单
        </div>
      </div>
    </div>
  );
}

// 销售数据区
function SalesDataSection({ product, gmvTrend, refundRateTrend }: { product: ProductStat; gmvTrend?: number; refundRateTrend?: number }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="GMV"
          value={`¥${product.gmv.toFixed(0)}`}
          trend={gmvTrend}
          trendLabel="环比"
          color="var(--pdd-info)"
          icon={<ShoppingCart size={14} />}
          showDetail
          detailContent={<GMVDetailContent product={product} />}
        />
        <MetricCard
          label="实收金额"
          value={`¥${product.revenue.toFixed(0)}`}
          subValue={`折扣率 ${product.discountRatio.toFixed(1)}%`}
          color="var(--pdd-success)"
          icon={<DollarSign size={14} />}
          showDetail
          detailContent={<RevenueDetailContent product={product} />}
        />
        <MetricCard
          label="订单数"
          value={product.orders.toLocaleString()}
          subValue={`销量 ${product.sales.toLocaleString()}件`}
          color="var(--pdd-warning)"
          icon={<FileText size={14} />}
          showDetail
          detailContent={<OrdersDetailContent product={product} />}
        />
        <MetricCard
          label="客单价"
          value={`¥${product.avgOrderValue.toFixed(2)}`}
          color="#722ed1"
          icon={<Target size={14} />}
          showDetail
          detailContent={
            <div className="space-y-3">
              <div className="bg-pdd-primary/10 rounded-lg p-3">
                <div className="text-xs text-pdd-text">计算公式</div>
                <div className="text-sm font-mono mt-1">客单价 = GMV ÷ 订单数</div>
              </div>
              <div className="text-xs text-pdd-text">
                ¥{product.gmv.toFixed(2)} ÷ {product.orders} = ¥{product.avgOrderValue.toFixed(2)}
              </div>
            </div>
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <MetricCard
          label="退款金额"
          value={`¥${product.refund.toFixed(0)}`}
          color="var(--pdd-danger)"
          icon={<RotateCcw size={14} />}
        />
        <MetricCard
          label="退款率"
          value={`${product.refundRate.toFixed(2)}%`}
          trend={refundRateTrend}
          trendLabel="环比"
          color={product.refundRate > 10 ? 'var(--pdd-danger)' : 'var(--pdd-success)'}
          icon={<AlertTriangle size={14} />}
        />
        <MetricCard
          label="售后率"
          value={`${product.afterSaleRate.toFixed(2)}%`}
          color={product.afterSaleRate > 5 ? 'var(--pdd-danger)' : 'var(--pdd-success)'}
          icon={<Shield size={14} />}
        />
      </div>
    </div>
  );
}

// 成本利润明细组件
function GrossProfitDetailContent({ product }: { product: ProductStat }) {
  return (
    <div className="space-y-4">
      <div className="bg-pdd-info/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">计算公式</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-blue-100">
          毛利润 = 实收金额 - 推广费 - 包装费 - 快递费 - 运费险 - 罚款 - 营销费
        </div>
        <div className="text-xs text-pdd-text-secondary mt-2">注意：商品成本在税前利润中扣除，不计入毛利</div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">计算明细</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">实收金额</span>
            <span className="font-mono text-pdd-success">+¥{product.revenue.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 推广费</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.promoCost || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 包装费</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.packagingFee || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 快递费</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.shippingFee || 0).toFixed(2)}</span>
          </div>
          {(product.costBreakdown?.insuranceFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 运费险</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.insuranceFee || 0).toFixed(2)}</span>
          </div>
          )}
          {(product.costBreakdown?.penaltyFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 罚款</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.penaltyFee || 0).toFixed(2)}</span>
          </div>
          )}
          {(product.costBreakdown?.marketingFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">- 营销费</span>
            <span className="font-mono text-pdd-danger">-¥{(product.costBreakdown?.marketingFee || 0).toFixed(2)}</span>
          </div>
          )}
          <div className="flex justify-between items-center py-2 font-medium bg-pdd-info/10 rounded px-2">
            <span className="text-blue-700">= 毛利润</span>
            <span className="font-mono text-blue-700">¥{(product.grossProfit || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-pdd-text-secondary">
        成本来源: {product.costSource?.productCost === 'real' ? '实际成本' : product.costSource?.productCost === 'estimated' ? '估算成本' : '未设置'}
      </div>
    </div>
  );
}

function NetProfitDetailContent({ product }: { product: ProductStat }) {
  const netProfit = product.netProfitAfterTax || product.netProfit;
  return (
    <div className="space-y-4">
      <div className="bg-pdd-success/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">计算公式</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-green-100">
          净利润 = 实收金额 - 总成本
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">成本构成明细</div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">商品成本</span>
            <span className="font-mono">¥{(product.costBreakdown?.productCost || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">包装费</span>
            <span className="font-mono">¥{(product.costBreakdown?.packagingFee || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">快递费</span>
            <span className="font-mono">¥{(product.costBreakdown?.shippingFee || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">推广费</span>
            <span className="font-mono">¥{(product.costBreakdown?.promoCost || 0).toFixed(2)}</span>
          </div>
          {(product.costBreakdown?.insuranceFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">运费险</span>
            <span className="font-mono">¥{(product.costBreakdown?.insuranceFee || 0).toFixed(2)}</span>
          </div>
          )}
          {(product.costBreakdown?.penaltyFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">罚款</span>
            <span className="font-mono">¥{(product.costBreakdown?.penaltyFee || 0).toFixed(2)}</span>
          </div>
          )}
          {(product.costBreakdown?.marketingFee ?? 0) > 0 && (
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">营销费</span>
            <span className="font-mono">¥{(product.costBreakdown?.marketingFee || 0).toFixed(2)}</span>
          </div>
          )}
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">税费</span>
            <span className="font-mono">¥{(product.costBreakdown?.taxes || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-1 border-b border-pdd-border">
            <span className="text-pdd-text">其他扣费</span>
            <span className="font-mono">¥{(product.costBreakdown?.customDeductions || 0).toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center py-2 font-medium bg-pdd-danger/10 rounded px-2">
            <span className="text-red-700">总成本</span>
            <span className="font-mono text-red-700">¥{(product.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="border-t border-pdd-border pt-3">
        <div className="flex justify-between items-center py-2 font-medium bg-pdd-success/10 rounded px-2">
          <span className="text-green-700">净利润</span>
          <span className={`font-mono ${netProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>¥{netProfit.toFixed(2)}</span>
        </div>
        <div className="text-xs text-pdd-text-secondary mt-2">
          利润率: {product.profitRate.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

function TotalCostDetailContent({ product }: { product: ProductStat }) {
  return (
    <div className="space-y-4">
      <div className="bg-pdd-danger/10 rounded-lg p-3">
        <div className="text-xs text-pdd-text mb-2">计算公式</div>
        <div className="text-sm font-mono bg-pdd-card rounded p-2 border border-red-100">
          总成本 = 商品成本 + 包装费 + 快递费 + 推广费 + 运费险 + 罚款 + 营销费 + 税费 + 其他扣费
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-xs font-medium text-pdd-text">成本明细</div>
        <div className="space-y-2">
          {[
            { label: '商品成本', value: product.costBreakdown?.productCost || 0, source: product.costSource?.productCost },
            { label: '包装费', value: product.costBreakdown?.packagingFee || 0 },
            { label: '快递费', value: product.costBreakdown?.shippingFee || 0 },
            { label: '推广费', value: product.costBreakdown?.promoCost || 0 },
            { label: '运费险', value: product.costBreakdown?.insuranceFee || 0 },
            { label: '罚款', value: product.costBreakdown?.penaltyFee || 0 },
            { label: '营销费', value: product.costBreakdown?.marketingFee || 0 },
            { label: '税费', value: product.costBreakdown?.taxes || 0 },
            { label: '其他扣费', value: product.costBreakdown?.customDeductions || 0 },
          ].filter(item => item.value > 0).map((item) => (
            <div key={item.label} className="flex items-center justify-between text-xs py-1 border-b border-pdd-border">
              <span className="text-pdd-text flex items-center gap-1">
                {item.label}
                {item.source === 'real' && <CheckCircle size={10} className="text-pdd-success" />}
                {item.source === 'estimated' && <Info size={10} className="text-pdd-warning" />}
              </span>
              <span className="font-mono">¥{item.value.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between items-center py-2 font-medium bg-pdd-danger/10 rounded px-2 mt-2">
            <span className="text-red-700">总成本</span>
            <span className="font-mono text-red-700">¥{(product.totalCost || 0).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <div className="text-xs text-pdd-text-secondary">
        成本占实收比例: {((product.totalCost || 0) / Math.max(product.revenue, 1) * 100).toFixed(1)}%
      </div>
    </div>
  );
}

// 成本利润区
function CostProfitSection({ product }: { product: ProductStat }) {
  const { costBreakdown, costSource, taxDetails, deductionDetails } = product;

  const profitData = [
    { name: '商品成本', value: costBreakdown?.productCost || 0, color: 'var(--pdd-primary-light)' },
    { name: '包装费', value: costBreakdown?.packagingFee || 0, color: 'var(--pdd-warning)' },
    { name: '邮费', value: costBreakdown?.shippingFee || 0, color: 'var(--pdd-info)' },
    { name: '推广费', value: costBreakdown?.promoCost || 0, color: '#722ed1' },
    { name: '平台扣点(已含实收)', value: costBreakdown?.platformFee || 0, color: '#ff7a45' },
    { name: '运费险', value: costBreakdown?.insuranceFee || 0, color: '#ffc53d' },
    { name: '罚款', value: costBreakdown?.penaltyFee || 0, color: '#f5222d' },
    { name: '营销费', value: costBreakdown?.marketingFee || 0, color: '#eb2f96' },
    { name: '税费', value: costBreakdown?.taxes || 0, color: '#13c2c2' },
    { name: '其他扣费', value: costBreakdown?.customDeductions || 0, color: 'var(--pdd-text-secondary)' },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-4 pt-4">
      {/* 利润概览 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          label="毛利润"
          value={`¥${(product.grossProfit || 0).toFixed(0)}`}
          color="var(--pdd-info)"
          icon={<Wallet size={14} />}
          showDetail
          detailContent={<GrossProfitDetailContent product={product} />}
        />
        <MetricCard
          label="税前利润"
          value={`¥${(product.preTaxProfit || 0).toFixed(0)}`}
          color="var(--pdd-success)"
          icon={<Calculator size={14} />}
          showDetail
          detailContent={
            <div className="space-y-3">
              <div className="bg-pdd-success/10 rounded-lg p-3">
                <div className="text-xs text-pdd-text">计算公式</div>
                <div className="text-sm font-mono mt-1">税前利润 = 毛利润 - 商品成本</div>
              </div>
              <div className="text-xs text-pdd-text">
                ¥{(product.grossProfit || 0).toFixed(2)} - ¥{(product.costBreakdown?.productCost || 0).toFixed(2)} = ¥{(product.preTaxProfit || 0).toFixed(2)}
              </div>
            </div>
          }
        />
        <MetricCard
          label="净利润"
          value={`¥${(product.netProfitAfterTax || product.netProfit).toFixed(0)}`}
          trend={product.profitRate}
          trendLabel="利润率"
          color={product.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)'}
          icon={<TrendingUp size={14} />}
          showDetail
          detailContent={<NetProfitDetailContent product={product} />}
        />
        <MetricCard
          label="总成本"
          value={`¥${(product.totalCost || 0).toFixed(0)}`}
          color="var(--pdd-danger)"
          icon={<TrendingDown size={14} />}
          showDetail
          detailContent={<TotalCostDetailContent product={product} />}
        />
      </div>

      {/* 成本明细 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
            <PieChartIcon size={14} color="#722ed1" />
            成本构成
          </h4>
          {profitData.length > 0 ? (
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={profitData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {profitData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`¥${value.toFixed(0)}`, '金额']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-40 flex items-center justify-center text-pdd-text-secondary text-xs">
              暂无成本数据
            </div>
          )}
        </div>

        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
            <Receipt size={14} color="var(--pdd-info)" />
            成本明细
          </h4>
          <div className="space-y-2">
            {[
              { label: '商品成本', value: costBreakdown?.productCost || 0, source: costSource?.productCost },
              { label: '包装费', value: costBreakdown?.packagingFee || 0 },
              { label: '邮费', value: costBreakdown?.shippingFee || 0 },
              { label: '推广费', value: costBreakdown?.promoCost || 0 },
              { label: '平台扣点(已含实收)', value: costBreakdown?.platformFee || 0 },
              { label: '运费险', value: costBreakdown?.insuranceFee || 0 },
              { label: '罚款/扣款', value: costBreakdown?.penaltyFee || 0 },
              { label: '营销费用', value: costBreakdown?.marketingFee || 0 },
              { label: '税费', value: costBreakdown?.taxes || 0 },
              { label: '自定义扣费', value: costBreakdown?.customDeductions || 0 },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-pdd-text flex items-center gap-1">
                  {item.label}
                  {item.source === 'real' && <CheckCircle size={10} className="text-pdd-success" />}
                  {item.source === 'estimated' && <Info size={10} className="text-pdd-warning" />}
                </span>
                <span className="font-mono font-medium">¥{item.value.toFixed(0)}</span>
              </div>
            ))}
            <div className="border-t border-pdd-border pt-2 mt-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-pdd-text">总成本</span>
                <span className="font-mono text-pdd-danger">¥{product.totalCost.toFixed(0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 税费明细 */}
      {taxDetails && taxDetails.length > 0 && (
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-2">税费明细</h4>
          <div className="grid grid-cols-3 gap-2">
            {taxDetails.map((tax, i) => (
              <div key={i} className="bg-pdd-card rounded-lg p-2">
                <div className="text-[10px] text-pdd-text-secondary">{tax.name}</div>
                <div className="text-xs font-mono font-medium">¥{tax.amount.toFixed(0)}</div>
                <div className="text-[10px] text-pdd-text-secondary">{tax.rate}%</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 推广数据区
function PromotionDataSection({ product }: { product: ProductStat }) {
  if (!product.hasPromoData) {
    return (
      <div className="pt-4">
        <div className="bg-pdd-bg rounded-xl p-8 text-center">
          <Target size={32} className="mx-auto mb-2 text-pdd-border" />
          <p className="text-sm text-pdd-text-secondary">暂无推广数据</p>
          <p className="text-xs text-pdd-text-secondary mt-1">请上传推广数据文件以查看详细推广分析</p>
        </div>
      </div>
    );
  }

  const funnelData = [
    { label: '曝光', value: product.promoImpressions, color: 'var(--pdd-info)' },
    { label: '点击', value: product.promoClicks, rate: product.ctr, color: 'var(--pdd-warning)' },
    { label: '成交', value: product.promoOrders, rate: product.cvr, color: 'var(--pdd-success)' },
  ];

  return (
    <div className="space-y-4 pt-4">
      {/* 推广核心指标 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="推广花费"
          value={`¥${product.promoCost.toFixed(0)}`}
          subValue={`占比 ${product.promoCostRatio.toFixed(1)}%`}
          color="#722ed1"
          icon={<Zap size={14} />}
        />
        <MetricCard
          label="推广成交"
          value={`¥${product.promoTransaction.toFixed(0)}`}
          color="var(--pdd-success)"
          icon={<TrendingUp size={14} />}
        />
        <MetricCard
          label="ROI"
          value={`${product.roi.toFixed(2)}x`}
          color={product.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)'}
          icon={<BarChart3 size={14} />}
        />
        <MetricCard
          label="点击率 CTR"
          value={`${product.ctr.toFixed(2)}%`}
          color="var(--pdd-info)"
          icon={<Percent size={14} />}
        />
      </div>

      {/* 推广漏斗 */}
      <div className="bg-pdd-bg rounded-xl p-4">
        <h4 className="text-xs font-semibold text-pdd-text mb-3">推广转化漏斗</h4>
        <div className="space-y-3">
          {funnelData.map((step, index) => (
            <div key={step.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-pdd-text">{step.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-medium">{step.value.toLocaleString()}</span>
                  {step.rate !== undefined && (
                    <span className="text-[10px] text-pdd-text-secondary">{step.rate.toFixed(2)}%</span>
                  )}
                </div>
              </div>
              <div className="h-2 bg-pdd-bg rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (step.value / Math.max(product.promoImpressions, 1)) * 100)}%` }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className="h-full rounded-full"
                  style={{ backgroundColor: step.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 推广来源明细 */}
      {product.promoSourceDetails && product.promoSourceDetails.length > 0 && (
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-2">推广来源明细</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-pdd-text-secondary border-b border-pdd-border">
                  <th className="py-2 text-left font-medium">来源</th>
                  <th className="py-2 text-right font-medium">花费</th>
                  <th className="py-2 text-right font-medium">点击</th>
                  <th className="py-2 text-right font-medium">曝光</th>
                  <th className="py-2 text-right font-medium">成交</th>
                </tr>
              </thead>
              <tbody>
                {product.promoSourceDetails.slice(0, 5).map((detail, i) => (
                  <tr key={i} className="border-b border-pdd-border last:border-0">
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        detail.source === '商品推广' ? 'bg-pdd-danger/10 text-pdd-danger' :
                        detail.source === '明星店铺' ? 'bg-pdd-warning/10 text-orange-600' :
                        detail.source === '直播推广' ? 'bg-pdd-primary/10 text-pdd-primary-dark' :
                        'bg-pdd-bg text-pdd-text'
                      }`}>
                        {detail.source}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono">¥{detail.cost.toFixed(0)}</td>
                    <td className="py-2 text-right font-mono">{detail.clicks.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{detail.impressions.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{detail.orders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// 售后数据区
function AfterSaleSection({ product }: { product: ProductStat }) {
  const afterSaleData = Object.entries(product.afterSaleBreakdown || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const COLORS = ['var(--pdd-danger)', 'var(--pdd-warning)', 'var(--pdd-info)', 'var(--pdd-success)', '#722ed1'];

  return (
    <div className="space-y-4 pt-4">
      {/* 售后核心指标 */}
      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="售后率"
          value={`${product.afterSaleRate.toFixed(2)}%`}
          color={product.afterSaleRate > 5 ? 'var(--pdd-danger)' : 'var(--pdd-success)'}
          icon={<AlertTriangle size={14} />}
        />
        <MetricCard
          label="退款率"
          value={`${product.refundRate.toFixed(2)}%`}
          color={product.refundRate > 10 ? 'var(--pdd-danger)' : 'var(--pdd-success)'}
          icon={<RotateCcw size={14} />}
        />
        <MetricCard
          label="售后订单"
          value={product.afterSaleCount.toString()}
          subValue={`共 ${product.orders} 单`}
          color="var(--pdd-warning)"
          icon={<Shield size={14} />}
        />
      </div>

      {/* 售后状态分布 */}
      {afterSaleData.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-pdd-bg rounded-xl p-4">
            <h4 className="text-xs font-semibold text-pdd-text mb-3">售后状态分布</h4>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={afterSaleData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {afterSaleData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}单`, '数量']}
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-pdd-bg rounded-xl p-4">
            <h4 className="text-xs font-semibold text-pdd-text mb-3">售后原因分析</h4>
            <div className="space-y-2">
              {afterSaleData.map((item, index) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span className="text-xs text-pdd-text flex-1">{item.name}</span>
                  <span className="text-xs font-mono font-medium">{item.value}单</span>
                  <span className="text-[10px] text-pdd-text-secondary">
                    {((item.value / product.afterSaleCount) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 时间趋势区
function TrendSection({ product }: { product: ProductStat }) {
  const hasDailyData = product.dailySales && product.dailySales.length > 0;

  if (!hasDailyData) {
    return (
      <div className="pt-4">
        <div className="bg-pdd-bg rounded-xl p-8 text-center">
          <TrendingUp size={32} className="mx-auto mb-2 text-pdd-border" />
          <p className="text-sm text-pdd-text-secondary">暂无趋势数据</p>
        </div>
      </div>
    );
  }

  const chartData = product.dailySales.map(d => ({
    date: d.date.slice(5),
    sales: d.sales,
    gmv: d.gmv,
    orders: d.orders,
  }));

  return (
    <div className="space-y-4 pt-4">
      {/* 趋势图表 */}
      <div className="bg-pdd-bg rounded-xl p-4">
        <h4 className="text-xs font-semibold text-pdd-text mb-3">销售趋势（近{chartData.length}天）</h4>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-gray-200)" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '8px',
                border: 'none',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                fontSize: '11px'
              }}
            />
            <Bar
              yAxisId="left"
              dataKey="sales"
              name="销量"
              fill="var(--pdd-info)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="gmv"
              name="GMV"
              stroke="var(--pdd-success)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 趋势指标 */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          label="日均销量"
          value={product.avgDailySales.toFixed(1)}
          color="var(--pdd-info)"
          icon={<Activity size={14} />}
        />
        <MetricCard
          label="周转天数"
          value={`${product.turnoverDays}天`}
          color={product.turnoverDays > 30 ? 'var(--pdd-danger)' : 'var(--pdd-success)'}
          icon={<Clock size={14} />}
        />
        <MetricCard
          label="售罄率"
          value={`${(product.sellThroughRate || 0).toFixed(1)}%`}
          color="var(--pdd-warning)"
          icon={<Percent size={14} />}
        />
        <MetricCard
          label="预估库存"
          value={product.inventoryEstimate.toString()}
          color="#722ed1"
          icon={<Box size={14} />}
        />
      </div>
    </div>
  );
}

// 关联分析区
function RelationSection({ product }: { product: ProductStat }) {
  const hasRelated = product.relatedProducts && product.relatedProducts.length > 0;

  return (
    <div className="space-y-4 pt-4">
      {/* 关联商品 */}
      {hasRelated ? (
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
            <Link2 size={14} color="var(--pdd-info)" />
            关联购买 TOP5
          </h4>
          <div className="space-y-2">
            {product.relatedProducts.map((rp, i) => (
              <div
                key={rp.productId}
                className="flex items-center justify-between p-2.5 bg-pdd-card rounded-lg hover:bg-pdd-bg transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      i === 0 ? 'bg-pdd-danger/100 text-white' :
                      i === 1 ? 'bg-orange-400 text-white' :
                      i === 2 ? 'bg-yellow-400 text-white' :
                      'bg-pdd-bg text-pdd-text'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="text-xs text-pdd-text truncate flex-1">{rp.productName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[10px] text-pdd-text-secondary">{rp.coOccurrenceCount}次同购</span>
                  <ChevronRight size={14} className="text-pdd-border" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-pdd-bg rounded-xl p-6 text-center">
          <Link2 size={24} className="mx-auto mb-2 text-pdd-border" />
          <p className="text-xs text-pdd-text-secondary">暂无关联商品数据</p>
        </div>
      )}

      {/* 复购分析 */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1.5">
            <RefreshCw size={14} color="var(--pdd-success)" />
            复购率
          </h4>
          <div className="text-2xl font-bold text-pdd-text">--</div>
          <div className="text-[10px] text-pdd-text-secondary mt-1">功能开发中</div>
        </div>
        <div className="bg-pdd-bg rounded-xl p-4">
          <h4 className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1.5">
            <UserPlus size={14} color="#722ed1" />
            新老客占比
          </h4>
          <div className="text-2xl font-bold text-pdd-text">--</div>
          <div className="text-[10px] text-pdd-text-secondary mt-1">功能开发中</div>
        </div>
      </div>
    </div>
  );
}

// 地域分布区
function RegionSection({ product }: { product: ProductStat }) {
  return (
    <div className="space-y-4 pt-4">
      <div className="bg-pdd-bg rounded-xl p-6 text-center">
        <Globe size={32} className="mx-auto mb-2 text-pdd-border" />
        <p className="text-sm text-pdd-text-secondary">地域分布数据</p>
        <p className="text-xs text-pdd-text-secondary mt-1">请在订单数据中包含省份信息以查看地域分析</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricCard
          label="销售省份"
          value="--"
          color="var(--pdd-info)"
          icon={<MapPin size={14} />}
        />
        <MetricCard
          label="TOP省份"
          value="--"
          color="var(--pdd-success)"
          icon={<TrendingUp size={14} />}
        />
        <MetricCard
          label="偏远地区率"
          value="--"
          color="var(--pdd-warning)"
          icon={<Truck size={14} />}
        />
      </div>
    </div>
  );
}

// 订单字段提取辅助函数（模块级，避免每次渲染重复创建）
function fv(o: any, fields: string[]): string {
  for (const f of fields) { const v = o[f]; if (v !== undefined && v !== null && v !== '') return String(v).trim(); }
  return '-';
}
function fn(o: any, fields: string[]): number {
  for (const f of fields) { const v = o[f]; if (v !== undefined && v !== null && v !== '') { const n = parseFloat(String(v).replace(/[^\d.\-]/g, '')); if (!isNaN(n)) return n; } }
  return 0;
}

// 订单明细表格（memoized 避免切换卡顿）
const OrderDetailTable = React.memo(function OrderDetailTable({
  orders, costConfig
}: {
  orders: any[];
  costConfig?: { productCosts?: Record<string, number>; defaultCostRatio: number; packagingFeePerOrder: number; shippingFeePerOrder: number };
}) {
  const rows = useMemo(() => {
    return orders.slice(0, 200).map((o, i) => {
      const orderNo = fv(o, ['订单号']);
      const date = (fv(o, ['支付时间'])).split(' ')[0];
      const qty = fn(o, ['商品数量(件)', '商品数量', '数量']);
      const productTotal = fn(o, ['商品总价(元)', '商品总价']);
      const merchantReceived = fn(o, ['商家实收金额(元)', '商家实收金额', '商家实收', '实收金额']);
      const pid = fv(o, ['商品id', '商品ID', 'productId']);
      const skuId = fv(o, ['规格id', '规格ID', 'sku_id', 'style_id', '商品规格ID']);
      let unitCost = 0;
      const pcs = costConfig?.productCosts;
      if (pcs) {
        const skuKey = `${pid}_${skuId}`;
        if (skuId && pcs[skuKey] !== undefined && pcs[skuKey] > 0) {
          unitCost = pcs[skuKey];
        } else if (pid && pcs[pid] !== undefined && pcs[pid] > 0) {
          unitCost = pcs[pid];
        }
      }
      const productCost = unitCost > 0 ? unitCost * qty : productTotal * ((costConfig?.defaultCostRatio ?? 30) / 100);
      const totalCosts = productCost + (costConfig?.packagingFeePerOrder || 0) + (costConfig?.shippingFeePerOrder || 0);
      const netProfit = merchantReceived - totalCosts;
      const profitRate = merchantReceived > 0 ? (netProfit / merchantReceived) * 100 : 0;
      return { key: i, orderNo, date, qty, productTotal, merchantReceived, totalCosts, netProfit, profitRate };
    });
  }, [orders, costConfig]);

  if (orders.length === 0) return <div className="text-center py-8 text-pdd-text-secondary text-xs">暂无订单数据</div>;

  return (
    <div className="max-h-[400px] overflow-y-auto">
      <table className="w-full text-[10px]">
        <thead>
          <tr className="text-pdd-gray-400 border-b border-pdd-gray-100 sticky top-0 bg-pdd-card">
            <th className="py-1.5 text-left font-medium">订单号</th>
            <th className="py-1.5 text-left font-medium">日期</th>
            <th className="py-1.5 text-right font-medium">数量</th>
            <th className="py-1.5 text-right font-medium">商品总价</th>
            <th className="py-1.5 text-right font-medium">实收</th>
            <th className="py-1.5 text-right font-medium">成本</th>
            <th className="py-1.5 text-right font-medium">利润</th>
            <th className="py-1.5 text-right font-medium">利润率</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-pdd-gray-50">
          {rows.map(r => (
            <tr key={r.key} className="hover:bg-pdd-gray-50 transition-colors">
              <td className="py-1 font-mono text-pdd-gray-600 max-w-[80px] truncate" title={r.orderNo}>{r.orderNo.length > 8 ? r.orderNo.slice(-8) : r.orderNo}</td>
              <td className="py-1 text-pdd-gray-500">{r.date.length > 5 ? r.date.slice(5) : r.date}</td>
              <td className="py-1 text-right tabular-nums">{r.qty}</td>
              <td className="py-1 text-right font-mono tabular-nums">¥{r.productTotal.toFixed(0)}</td>
              <td className="py-1 text-right font-mono tabular-nums">¥{r.merchantReceived.toFixed(0)}</td>
              <td className="py-1 text-right font-mono tabular-nums">¥{r.totalCosts.toFixed(0)}</td>
              <td className="py-1 text-right font-mono tabular-nums font-medium" style={{ color: r.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{r.netProfit.toFixed(0)}</td>
              <td className="py-1 text-right tabular-nums" style={{ color: r.profitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{r.profitRate.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length > 200 && (
        <p className="text-[10px] text-pdd-gray-400 text-center mt-2">仅显示前 200 笔，共 {orders.length} 笔订单</p>
      )}
    </div>
  );
});

// 主组件
interface Product360AnalysisProps {
  product: ProductStat | null;
  compareProducts?: ProductStat[];
  onExport?: () => void;
  onClose?: () => void;
  orders?: any[];
  costConfig?: {
    productCosts?: Record<string, number>;
    defaultCostRatio: number;
    packagingFeePerOrder: number;
    shippingFeePerOrder: number;
  };
  gmvTrend?: number;
  refundRateTrend?: number;
}

export default function Product360Analysis({
  product,
  compareProducts = [],
  onExport,
  onClose,
  orders = [],
  costConfig,
  gmvTrend,
  refundRateTrend
}: Product360AnalysisProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'detail'>('overview');
  const [compareMode, setCompareMode] = useState(false);
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-pdd-text-secondary">
        <Target size={48} className="mb-4 opacity-30" />
        <p className="text-sm">选择商品查看360度分析</p>
      </div>
    );
  }

  // 计算数据质量评分
  const calculateDataQuality = () => {
    let score = 0;
    const issues: string[] = [];

    if (product.hasOrderData) score += 40;
    else issues.push('缺少订单数据');

    if (product.hasPromoData) score += 30;
    else issues.push('缺少推广数据');

    if (product.costSource?.productCost === 'real') score += 20;
    else if (product.costSource?.productCost === 'estimated') {
      score += 10;
      issues.push('成本为估算值');
    } else {
      issues.push('缺少成本数据');
    }

    return { score, issues };
  };

  const dataQuality = calculateDataQuality();

  // 导出报表
  const handleExport = () => {
    const data = {
      商品名称: product.productName,
      商品ID: product.productId,
      商家编码: product.productCode,
      GMV: product.gmv,
      实收金额: product.revenue,
      订单数: product.orders,
      销量: product.sales,
      客单价: product.avgOrderValue,
      退款金额: product.refund,
      退款率: product.refundRate,
      售后率: product.afterSaleRate,
      推广花费: product.promoCost,
      推广成交: product.promoTransaction,
      ROI: product.roi,
      CTR: product.ctr,
      CVR: product.cvr,
      毛利润: product.grossProfit,
      税前利润: product.preTaxProfit,
      净利润: product.netProfitAfterTax,
      利润率: product.profitRate,
      总成本: product.totalCost,
    };

    const headers = Object.keys(data);
    const values = Object.values(data);
    const csv = [headers.join(','), values.join(',')].join('\n');

    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `商品360分析_${product.productName}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    onExport?.();
  };

  return (
    <div className="space-y-4">
      {/* 顶部工具栏 */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 bg-pdd-bg rounded-lg p-1">
              <button
                onClick={() => { setActiveTab('overview'); setShowFullAnalysis(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'overview'
                    ? 'bg-pdd-card text-pdd-text shadow-sm'
                    : 'text-pdd-text-secondary hover:text-pdd-text'
                }`}
              >
                概览
              </button>
              <button
                onClick={() => { setActiveTab('detail'); setShowFullAnalysis(false); }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  activeTab === 'detail'
                    ? 'bg-pdd-card text-pdd-text shadow-sm'
                    : 'text-pdd-text-secondary hover:text-pdd-text'
                }`}
              >
                明细
              </button>
            </div>
            {compareProducts.length > 0 && (
              <button
                onClick={() => setCompareMode(!compareMode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  compareMode
                    ? 'bg-pdd-primary/10 text-purple-700'
                    : 'bg-pdd-bg text-pdd-text hover:bg-pdd-bg'
                }`}
              >
                <BarChart3 size={14} />
                对比({compareProducts.length})
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-pdd-bg text-pdd-text hover:bg-pdd-bg transition-colors text-xs font-medium"
            >
              <Download size={14} />
              导出
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text transition-colors"
              >
                <XCircle size={18} />
              </button>
            )}
          </div>
        </div>
        <div className="mt-2">
          <DataQualityScore score={dataQuality.score} issues={dataQuality.issues} />
        </div>
      </div>

      {/* 数据链路可视化 */}
      <DataChainVisualization />

      {/* 对比模式 */}
      {compareMode && compareProducts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-pdd-card rounded-xl border border-pdd-border p-4"
        >
          <h4 className="text-sm font-semibold text-pdd-text mb-3">商品对比</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-pdd-text-secondary border-b border-pdd-border">
                  <th className="py-2 text-left font-medium">指标</th>
                  <th className="py-2 text-right font-medium text-pdd-danger">{product.productName.slice(0, 10)}</th>
                  {compareProducts.map(p => (
                    <th key={p.productId} className="py-2 text-right font-medium">{p.productName.slice(0, 10)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'GMV', key: 'gmv', fmt: (v: number) => `¥${v.toFixed(0)}` },
                  { label: '实收', key: 'revenue', fmt: (v: number) => `¥${v.toFixed(0)}` },
                  { label: '净利润', key: 'netProfit', fmt: (v: number) => `¥${v.toFixed(0)}` },
                  { label: '利润率', key: 'profitRate', fmt: (v: number) => `${v.toFixed(1)}%` },
                  { label: 'ROI', key: 'roi', fmt: (v: number) => `${v.toFixed(2)}x` },
                  { label: '退款率', key: 'refundRate', fmt: (v: number) => `${v.toFixed(1)}%` },
                ].map(row => (
                  <tr key={row.key} className="border-b border-pdd-border">
                    <td className="py-2 text-pdd-text">{row.label}</td>
                    <td className="py-2 text-right font-mono font-medium text-pdd-danger">
                      {row.fmt(product[row.key as keyof ProductStat] as number)}
                    </td>
                    {compareProducts.map(p => (
                      <td key={p.productId} className="py-2 text-right font-mono">
                        {row.fmt(p[row.key as keyof ProductStat] as number)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* 概览模式：只展示核心指标卡片 */}
      {activeTab === 'overview' && (
        <div className="space-y-3">
          {/* 核心数据概览 - 重构为现代化卡片 */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center">
                    <BarChart3 size={14} className="text-white" />
                  </div>
                  核心指标概览
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                    ID: {product.productId}
                  </span>
                  <button
                    onClick={() => setShowFullAnalysis(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-600 text-white hover:from-indigo-600 hover:to-indigo-700 transition-all text-xs font-medium shadow-sm shadow-indigo-200"
                  >
                    <Zap size={13} />
                    深度解析
                  </button>
                </div>
              </div>
            </div>

            {/* KPI Grid */}
            <div className="p-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'GMV', value: `¥${product.gmv.toFixed(0)}`, sub: `${product.orders}笔订单`, color: '#6366f1', bg: 'from-indigo-50 to-indigo-100', icon: '📦', trend: gmvTrend },
                  { label: '实收金额', value: `¥${product.revenue.toFixed(0)}`, sub: `客单价 ¥${product.avgOrderValue.toFixed(0)}`, color: '#10b981', bg: 'from-emerald-50 to-emerald-100', icon: '💰', trend: undefined },
                  { label: '净利润', value: `¥${product.netProfit.toFixed(0)}`, sub: `利润率 ${product.profitRate.toFixed(1)}%`, color: product.netProfit >= 0 ? '#8b5cf6' : '#ef4444', bg: product.netProfit >= 0 ? 'from-purple-50 to-purple-100' : 'from-red-50 to-red-100', icon: product.netProfit >= 0 ? '📈' : '📉', trend: undefined },
                  { label: 'ROI', value: `${product.roi.toFixed(2)}x`, sub: `花费 ¥${product.promoCost.toFixed(0)}`, color: product.roi >= 1 ? '#f59e0b' : '#ef4444', bg: product.roi >= 1 ? 'from-amber-50 to-amber-100' : 'from-red-50 to-red-100', icon: '🎯', trend: undefined },
                ].map(card => (
                  <motion.div
                    key={card.label}
                    whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(0,0,0,0.08)' }}
                    className="relative overflow-hidden rounded-xl border border-gray-100 bg-white p-4 transition-all cursor-default group"
                  >
                    {/* Background gradient accent */}
                    <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl ${card.bg} rounded-bl-full opacity-30 group-hover:opacity-50 transition-opacity`} />

                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{card.label}</span>
                        <span className="text-lg">{card.icon}</span>
                      </div>
                      <div className="text-xl font-bold font-mono tracking-tight" style={{ color: card.color }}>
                        {card.value}
                      </div>
                      <div className="text-[11px] text-gray-400 mt-1">{card.sub}</div>
                      {card.trend !== undefined && (
                        <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${card.trend >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {card.trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {Math.abs(card.trend).toFixed(1)}% vs 上期
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* 关键运营指标 - 三列卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 销售数据 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-blue-50 to-white">
                <h4 className="text-xs font-bold text-blue-700 flex items-center gap-2">
                  <ShoppingCart size={13} /> 销售数据
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: '订单数', value: product.orders, unit: '笔' },
                  { label: '销量', value: product.sales, unit: '件' },
                  { label: '客单价', value: `¥${product.avgOrderValue.toFixed(0)}`, unit: '' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className="text-sm font-semibold font-mono text-gray-800">{row.value}<span className="text-[10px] text-gray-400 ml-0.5">{row.unit}</span></span>
                  </div>
                ))}
              </div>
            </div>

            {/* 成本利润 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-purple-50 to-white">
                <h4 className="text-xs font-bold text-purple-700 flex items-center gap-2">
                  <DollarSign size={13} /> 成本利润
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: '总成本', value: `¥${(product.totalCost || 0).toFixed(0)}`, color: 'text-red-500' },
                  { label: '毛利润', value: `¥${(product.grossProfit || 0).toFixed(0)}`, color: (product.grossProfit || 0) >= 0 ? 'text-emerald-500' : 'text-red-500' },
                  { label: '净利润', value: `¥${product.netProfit.toFixed(0)}`, color: product.netProfit >= 0 ? 'text-purple-600' : 'text-red-500' },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className={`text-sm font-bold font-mono ${row.color}`}>{row.value}</span>
                  </div>
                ))}
                <div className="pt-2 border-t border-gray-100">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${product.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {product.netProfit >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {product.netProfit >= 0 ? '盈利' : '亏损'}
                  </span>
                </div>
              </div>
            </div>

            {/* 售后质量 */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-50 bg-gradient-to-r from-orange-50 to-white">
                <h4 className="text-xs font-bold text-orange-700 flex items-center gap-2">
                  <Shield size={13} /> 售后质量
                </h4>
              </div>
              <div className="p-4 space-y-3">
                {[
                  { label: '退款率', value: `${product.refundRate.toFixed(1)}%`, alert: product.refundRate > 10 },
                  { label: '售后率', value: `${product.afterSaleRate.toFixed(1)}%`, alert: product.afterSaleRate > 10 },
                  { label: '售后订单', value: `${product.afterSaleCount}单`, alert: false },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <span className="text-xs text-gray-500">{row.label}</span>
                    <span className={`text-sm font-bold font-mono ${row.alert ? 'text-red-500' : 'text-gray-800'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 推广数据（如有） */}
          {product.hasPromoData && (
            <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
              <h4 className="text-sm font-semibold text-pdd-text mb-3">推广效果</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center">
                  <div className="text-xs text-pdd-text-secondary mb-1">花费</div>
                  <div className="text-sm font-bold text-pdd-primary-dark">¥{product.promoCost.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-pdd-text-secondary mb-1">成交</div>
                  <div className="text-sm font-bold text-pdd-success">¥{product.promoTransaction.toFixed(0)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-pdd-text-secondary mb-1">ROI</div>
                  <div className={`text-sm font-bold ${product.roi >= 1 ? 'text-pdd-success' : 'text-pdd-danger'}`}>{product.roi.toFixed(2)}x</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-pdd-text-secondary mb-1">CTR</div>
                  <div className="text-sm font-bold text-pdd-info">{product.ctr.toFixed(2)}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 明细模式：订单列表 */}
      {activeTab === 'detail' && (
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-pdd-text flex items-center gap-1.5">
              <FileText size={14} color="var(--pdd-primary)" />
              订单明细 ({orders.length}笔)
            </h4>
          </div>
          <OrderDetailTable orders={orders} costConfig={costConfig} />
        </div>
      )}

      {/* 完整分析弹窗 */}
      {showFullAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 背景遮罩 */}
          <div
            className="absolute inset-0 bg-pdd-text/50 backdrop-blur-sm"
            onClick={() => setShowFullAnalysis(false)}
          />

          {/* 弹窗内容 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-6xl max-h-[90vh] bg-pdd-card rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* 弹窗头部 */}
            <div className="shrink-0 bg-gradient-to-r from-red-50 to-orange-50 border-b border-pdd-border px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pdd-danger/10 flex items-center justify-center">
                  <Target size={20} color="var(--pdd-primary)" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-pdd-text">商品360°完整分析报告</h2>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">{product.productName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowFullAnalysis(false)}
                className="p-2 rounded-xl hover:bg-pdd-card/80 transition-colors group"
              >
                <XCircle size={24} className="text-pdd-text-secondary group-hover:text-pdd-text" />
              </button>
            </div>

            {/* 弹窗内容区 - 可滚动 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              <CollapsibleCard
                title="商品基础信息"
                icon={<Package size={18} color="#1890ff" />}
                iconColor="#1890ff"
                defaultExpanded={true}
              >
                <BasicInfoSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="销售数据"
                icon={<ShoppingCart size={18} color="#52c41a" />}
                iconColor="#52c41a"
                defaultExpanded={true}
              >
                <SalesDataSection product={product} gmvTrend={gmvTrend} refundRateTrend={refundRateTrend} />
              </CollapsibleCard>

              <CollapsibleCard
                title="成本利润分析"
                icon={<DollarSign size={18} color="#722ed1" />}
                iconColor="#722ed1"
                defaultExpanded={true}
              >
                <CostProfitSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="推广数据分析"
                icon={<Zap size={18} color="#faad14" />}
                iconColor="#faad14"
                badge={product.hasPromoData ? '有数据' : '无数据'}
                badgeColor={product.hasPromoData ? '#52c41a' : '#8c8c8c'}
                defaultExpanded={true}
              >
                <PromotionDataSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="售后质量分析"
                icon={<Shield size={18} color="#ff4d4f" />}
                iconColor="#ff4d4f"
                badge={product.afterSaleCount > 0 ? `${product.afterSaleCount}单` : '正常'}
                badgeColor={product.afterSaleCount > 0 ? '#ff4d4f' : '#52c41a'}
                defaultExpanded={true}
              >
                <AfterSaleSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="时间趋势"
                icon={<TrendingUp size={18} color="#13c2c2" />}
                iconColor="#13c2c2"
                defaultExpanded={false}
              >
                <TrendSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="关联分析"
                icon={<Link2 size={18} color="#eb2f96" />}
                iconColor="#eb2f96"
                defaultExpanded={false}
              >
                <RelationSection product={product} />
              </CollapsibleCard>

              <CollapsibleCard
                title="地域分布"
                icon={<MapPin size={18} color="#fa541c" />}
                iconColor="#fa541c"
                defaultExpanded={false}
              >
                <RegionSection product={product} />
              </CollapsibleCard>
            </div>

            {/* 弹窗底部 */}
            <div className="shrink-0 bg-pdd-bg border-t border-pdd-border px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-pdd-text-secondary">数据截止日期: {product.lastOrderDate || '--'}</span>
              <button
                onClick={() => setShowFullAnalysis(false)}
                className="px-4 py-2 rounded-lg bg-pdd-bg text-pdd-text hover:bg-pdd-gray-300 transition-colors text-sm font-medium"
              >
                关闭
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* 数据更新时间 */}
      <div className="flex items-center justify-between text-xs text-pdd-text-secondary px-2">
        <div className="flex items-center gap-1">
          <Clock size={12} />
          <span>数据截止日期: {product.lastOrderDate || '--'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className="text-pdd-success" />
            订单数据: {product.hasOrderData ? '已同步' : '未同步'}
          </span>
          <span className="flex items-center gap-1">
            <CheckCircle size={12} className={product.hasPromoData ? 'text-pdd-success' : 'text-pdd-border'} />
            推广数据: {product.hasPromoData ? '已同步' : '未同步'}
          </span>
        </div>
      </div>
    </div>
  );
}

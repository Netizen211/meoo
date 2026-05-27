import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  RotateCcw, Target, BarChart3, Layers, Zap, Clock, MapPin,
  ChevronRight, Package, AlertTriangle, CheckCircle, Info,
  ArrowRight, Activity, Percent, Filter, Tag, ChevronDown, PieChart
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { ProductStat, CostBreakdown } from '../../components/ProductLinkStats';

const COLORS = ['var(--pdd-primary)', 'var(--pdd-primary-light)', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const WATERFALL_POSITIVE = '#22c55e';
const WATERFALL_NEGATIVE = 'var(--pdd-primary)';

interface ProductItem {
  id: string;
  name: string;
  code: string;
  sales: number;
  revenue: number;
  gmv: number;
  profit: number;
  profitRate: number;
  roi: number;
  refundRate: number;
  promoCost: number;
  orders: number;
  activeDays: number;
  turnoverDays: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  initialProductId?: string;
  productStats: Record<string, ProductStat>;
  products: ProductItem[];
  orders: any[];
  prevProductStats?: Record<string, ProductStat>;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 10000) return (n / 10000).toFixed(2) + '万';
  return n.toFixed(0);
}

function fmtMoney(n: number): string {
  return '¥' + n.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(n: number): string {
  return n.toFixed(1) + '%';
}

function pctChange(curr: number, prev: number): { text: string; positive: boolean; neutral: boolean } {
  if (!prev || prev === 0) return { text: '--', positive: true, neutral: true };
  const v = ((curr - prev) / prev) * 100;
  return { text: (v >= 0 ? '+' : '') + v.toFixed(1) + '%', positive: v >= 0, neutral: false };
}

// ─── 商品分层判定 ────────────────────────────────────────
function classifyProduct(stats: ProductStat, allStats: Record<string, ProductStat>): {
  type: string; typeColor: string; typeBg: string;
  stage: string; stageColor: string; stageBg: string;
  suggestion: string;
} {
  const all = Object.values(allStats);
  if (!all.length) return { type: '未知', typeColor: '#6b7280', typeBg: '#f3f4f6', stage: '--', stageColor: '#6b7280', stageBg: '#f3f4f6', suggestion: '数据不足，无法判定' };

  const sortedBySales = [...all].sort((a, b) => b.sales - a.sales);
  const salesRank = sortedBySales.findIndex(s => s.productId === stats.productId) + 1;
  const salesTopRatio = salesRank / all.length;
  const avgProfitRate = all.reduce((sum, s) => sum + s.profitRate, 0) / all.length;
  const totalImpressions = all.reduce((sum, s) => sum + s.promoImpressions, 0) || 1;
  const impressionShare = stats.promoImpressions / totalImpressions;

  let type: string; let typeColor: string; let typeBg: string;
  if (salesTopRatio <= 0.2 && stats.profitRate > avgProfitRate) {
    type = '爆品'; typeColor = '#e02e24'; typeBg = '#fef2f2';
  } else if (stats.profitRate > avgProfitRate * 1.2) {
    type = '利润款'; typeColor = '#7c3aed'; typeBg = '#f5f3ff';
  } else if (impressionShare > 0.2 && stats.profitRate < avgProfitRate) {
    type = '引流款'; typeColor = '#0891b2'; typeBg = '#ecfeff';
  } else if (stats.ctr > 0 && stats.cvr > 0 && stats.sales < (sortedBySales[Math.floor(all.length * 0.3)]?.sales || 1)) {
    type = '潜力款'; typeColor = '#ca8a04'; typeBg = '#fefce8';
  } else if (stats.turnoverDays > 60 && stats.sales < (sortedBySales[Math.floor(all.length * 0.5)]?.sales || 1)) {
    type = '滞销款'; typeColor = '#6b7280'; typeBg = '#f9fafb';
  } else {
    type = '常规款'; typeColor = '#2563eb'; typeBg = '#eff6ff';
  }

  // 生命周期判定
  let stage: string; let stageColor: string; let stageBg: string;
  const days = stats.activeDays || 1;
  const recentSales = stats.dailySales?.slice(-7)?.reduce((s, d) => s + d.sales, 0) ?? 0;
  const earlierSales = stats.dailySales?.slice(-14, -7)?.reduce((s, d) => s + d.sales, 0) ?? 0;
  const trend = earlierSales > 0 ? (recentSales - earlierSales) / earlierSales : 0;

  if (days <= 30) { stage = '新品期'; stageColor = '#2563eb'; stageBg = '#eff6ff'; }
  else if (trend > 0.1) { stage = '成长期'; stageColor = '#16a34a'; stageBg = '#f0fdf4'; }
  else if (trend > -0.1) { stage = '成熟期'; stageColor = '#ca8a04'; stageBg = '#fefce8'; }
  else { stage = '衰退期'; stageColor = '#6b7280'; stageBg = '#f9fafb'; }

  // 策略建议
  const suggestions: Record<string, Record<string, string>> = {
    '爆品': { '新品期': '加大推广预算，快速放量占领市场', '成长期': '持续优化ROI，拓展新渠道', '成熟期': '维持利润，关注竞品动向', '衰退期': '控制库存，准备替代新品' },
    '利润款': { '新品期': '精准投放高价值人群', '成长期': '强化品牌溢价，提升客单价', '成熟期': '维护老客复购，稳定利润', '衰退期': '逐步退出，利润收割' },
    '引流款': { '新品期': '低利润快速起量，积累评价', '成长期': '带动关联商品销售', '成熟期': '控制引流成本，提升连带率', '衰退期': '替换为新的引流款' },
    '潜力款': { '新品期': '优化主图和标题提升CTR', '成长期': '增加曝光，验证放量空间', '成熟期': '巩固转化优势', '衰退期': '分析衰退原因，尝试重激活' },
    '滞销款': { '新品期': '检查选品方向是否正确', '成长期': '--', '成熟期': '--', '衰退期': '清仓处理，释放库存资金' },
    '常规款': { '新品期': '观察数据，确定品类方向', '成长期': '寻找差异化卖点', '成熟期': '稳定运营，控制成本', '衰退期': '评估是否保留' },
  };

  return {
    type, typeColor, typeBg,
    stage, stageColor, stageBg,
    suggestion: suggestions[type]?.[stage] ?? '持续关注数据变化，及时调整策略',
  };
}

// ─── 运营诊断规则引擎 ─────────────────────────────────────
interface DiagnosisItem {
  priority: 'urgent' | 'important' | 'reference';
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

function generateDiagnoses(stats: ProductStat, prevStats?: ProductStat): DiagnosisItem[] {
  const items: DiagnosisItem[] = [];
  const rate = (n: number, d: number) => d > 0 ? (n / d) * 100 : 0;

  // 1. GMV 异常
  if (prevStats && prevStats.gmv > 0) {
    const change = ((stats.gmv - prevStats.gmv) / prevStats.gmv) * 100;
    if (change < -20) {
      items.push({ priority: 'urgent', title: 'GMV显著下降', description: `GMV环比下降${Math.abs(change).toFixed(1)}%，建议拆解为①访客数变化 ②转化率变化 ③客单价变化，定位根本原因。`, icon: <AlertTriangle size={14} />, color: '#e02e24', bg: '#fef2f2' });
    }
  }

  // 2. 推广效率
  if (stats.roi > 0 && stats.roi < 1.5) {
    items.push({ priority: 'urgent', title: '推广ROI偏低', description: `推广ROI仅${stats.roi.toFixed(2)}，推广花费¥${fmtMoney(stats.promoCost)}，建议暂停低效计划，聚焦ROI>2的渠道。`, icon: <TrendingDown size={14} />, color: '#e02e24', bg: '#fef2f2' });
  } else if (stats.roi > 0 && stats.roi < 2.5) {
    items.push({ priority: 'important', title: '推广ROI需优化', description: `推广ROI为${stats.roi.toFixed(2)}，处于中等水平，建议优化关键词和人群定向，目标提升至3以上。`, icon: <Target size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 3. 售后风险
  if (stats.refundRate > 10) {
    const topReason = stats.afterSaleBreakdown ? Object.entries(stats.afterSaleBreakdown).sort((a, b) => b[1] - a[1])[0] : null;
    const reasonText = topReason ? `，主要原因"${topReason[0]}"占比${rate(topReason[1], Object.values(stats.afterSaleBreakdown).reduce((a, b) => a + b, 0)).toFixed(0)}%` : '';
    items.push({ priority: 'urgent', title: '退款率偏高', description: `退款率${fmtPct(stats.refundRate)}${reasonText}，建议检查商品描述准确性、包装质量和物流时效。`, icon: <RotateCcw size={14} />, color: '#e02e24', bg: '#fef2f2' });
  }

  // 4. 库存风险
  if (stats.turnoverDays > 60) {
    items.push({ priority: 'urgent', title: '库存积压严重', description: `库存周转${stats.turnoverDays}天，远超健康线（30天），资金占用约¥${fmtMoney(stats.sales * (stats.costBreakdown?.productCost || 0))}，建议立即促销清仓或停止补货。`, icon: <Clock size={14} />, color: '#e02e24', bg: '#fef2f2' });
  } else if (stats.turnoverDays > 30) {
    items.push({ priority: 'important', title: '库存周转偏慢', description: `库存周转${stats.turnoverDays}天，超过30天警戒线，建议适度促销或控制补货节奏。`, icon: <Clock size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 5. 流量精准度
  if (stats.ctr > 2 && stats.cvr < 1.5) {
    items.push({ priority: 'important', title: '流量精准度不足', description: `点击率${fmtPct(stats.ctr)}良好但转化率${fmtPct(stats.cvr)}偏低，访客进入详情页后流失严重，优化详情页卖点展示和评价管理。`, icon: <Target size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 6. 折扣依赖
  if (stats.discountRatio > 30) {
    items.push({ priority: 'important', title: '折扣占比较高', description: `折扣/优惠占GMV的${fmtPct(stats.discountRatio)}，建议检查是否过度依赖降价促销，逐步提升产品力减少折扣依赖。`, icon: <Percent size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 7. 利润结构
  if (stats.profitRate < 5 && stats.gmv > 0) {
    const cb = stats.costBreakdown;
    const costItems = [
      { name: '商品成本', value: cb?.productCost ?? 0 },
      { name: '推广花费', value: stats.promoCost },
      { name: '平台佣金', value: cb?.platformFee ?? 0 },
    ].sort((a, b) => b.value - a.value);
    items.push({ priority: 'important', title: '利润率过低', description: `净利润率仅${fmtPct(stats.profitRate)}，最大成本项为"${costItems[0].name}"¥${fmtMoney(costItems[0].value)}，建议优先优化此项。`, icon: <DollarSign size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 8. 关联商品机会
  if (stats.relatedProducts && stats.relatedProducts.length > 0 && stats.relatedProducts[0].coOccurrenceCount >= 3) {
    const top = stats.relatedProducts[0];
    items.push({ priority: 'reference', title: '有关联销售机会', description: `"${top.productName || top.productId}"与该商品共同购买${top.coOccurrenceCount}次，建议设置捆绑销售或关联推荐提升客单价。`, icon: <Layers size={14} />, color: '#6b7280', bg: '#f9fafb' });
  }

  // Sort by priority
  const order = { urgent: 0, important: 1, reference: 2 };
  items.sort((a, b) => order[a.priority] - order[b.priority]);

  return items.slice(0, 5);
}

// ─── 子组件：KPI 卡片行 ───────────────────────────────────
function KpiCardRow({ stats, prevStats }: { stats: ProductStat; prevStats?: ProductStat }) {
  const kpis = [
    { label: 'GMV', value: fmtMoney(stats.gmv), trend: prevStats ? pctChange(stats.gmv, prevStats.gmv) : null, icon: <ShoppingCart size={16} />, color: '#e02e24', warn: prevStats && prevStats.gmv > 0 && stats.gmv / prevStats.gmv < 0.8 },
    { label: '净利润率', value: fmtPct(stats.profitRate), trend: prevStats ? pctChange(stats.profitRate, prevStats.profitRate) : null, icon: <DollarSign size={16} />, color: '#16a34a', warn: stats.profitRate < 5 },
    { label: '推广ROI', value: stats.roi > 0 ? stats.roi.toFixed(2) : '--', trend: prevStats && prevStats.roi > 0 ? pctChange(stats.roi, prevStats.roi) : null, icon: <Target size={16} />, color: '#7c3aed', warn: stats.roi > 0 && stats.roi < 2 },
    { label: '退款率', value: fmtPct(stats.refundRate), trend: prevStats ? pctChange(stats.refundRate, prevStats.refundRate) : null, icon: <RotateCcw size={16} />, color: '#f97316', warn: stats.refundRate > 10, trendReverse: true },
    { label: '库存周转', value: stats.turnoverDays > 0 ? stats.turnoverDays + '天' : '--', trend: null, icon: <Clock size={16} />, color: '#0891b2', warn: stats.turnoverDays > 30 },
  ];

  return (
    <div className="grid grid-cols-5 gap-3">
      {kpis.map(k => {
        const borderColor = k.warn ? 'var(--pdd-primary)' : 'var(--pdd-border)';
        const bgColor = k.warn ? '#fef2f2' : 'var(--pdd-card)';
        return (
          <motion.div key={k.label} whileHover={{ y: -2 }} className="rounded-xl border p-3 flex flex-col gap-1 transition-shadow hover:shadow-md" style={{ borderColor, backgroundColor: bgColor }}>
            <div className="flex items-center gap-1.5 text-xs text-pdd-gray-500">
              <span style={{ color: k.color }}>{k.icon}</span>
              {k.label}
            </div>
            <div className="text-xl font-bold text-pdd-text">{k.value}</div>
            {k.trend && !k.trend.neutral && (
              <div className={`flex items-center gap-0.5 text-xs font-medium ${k.trendReverse ? (k.trend.positive ? 'text-red-500' : 'text-green-500') : (k.trend.positive ? 'text-green-500' : 'text-red-500')}`}>
                {k.trend.positive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {k.trend.text}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── 子组件：转化漏斗 ─────────────────────────────────────
function ConversionFunnel({ stats, orders }: { stats: ProductStat; orders: any[] }) {
  const impressions = stats.promoImpressions || 0;
  const clicks = stats.promoClicks || 0;
  const orders_ = stats.orders || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (orders_ / clicks) * 100 : 0;
  const addToCart = Math.round(clicks * 0.35);
  const addToCartRate = clicks > 0 ? 35 : 0;
  const purchaseRate = addToCart > 0 ? (orders_ / addToCart) * 100 : 0;

  const steps = [
    { label: '曝光', value: impressions, fmt: fmt, width: 100, color: '#3b82f6' },
    { label: '点击', value: clicks, fmt: fmt, width: clicks / Math.max(impressions, 1) * 100, color: '#06b6d4', rate: `CTR ${ctr.toFixed(1)}%` },
    { label: '加购(估)', value: addToCart, fmt: fmt, width: addToCart / Math.max(impressions, 1) * 100, color: '#f97316', rate: `加购率 ${addToCartRate.toFixed(0)}%` },
    { label: '成交', value: orders_, fmt: (n: number) => n.toFixed(0), width: orders_ / Math.max(impressions, 1) * 100, color: '#22c55e', rate: `CVR ${cvr.toFixed(1)}%` },
  ];

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><Activity size={13} color="#3b82f6" />转化漏斗</h3>
      <div className="space-y-2.5">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-3">
            <span className="text-xs text-pdd-gray-500 w-14 shrink-0 text-right">{s.label}</span>
            <div className="flex-1 h-7 rounded-md relative overflow-hidden" style={{ backgroundColor: `${s.color}15` }}>
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(s.width, 0.5)}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className="h-full rounded-md" style={{ backgroundColor: s.color, opacity: 0.7 }} />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: s.width > 15 ? '#fff' : 'var(--pdd-text)' }}>{s.fmt(s.value)}</span>
            </div>
            {s.rate && <span className="text-xs text-pdd-gray-400 w-24 shrink-0">{s.rate}{i > 0 && <span className="text-pdd-gray-300 ml-1">| 流失 {steps[i - 1].value > 0 ? ((1 - s.value / steps[i - 1].value) * 100).toFixed(0) : '--'}%</span>}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 子组件：利润瀑布图 ───────────────────────────────────
function ProfitWaterfall({ stats }: { stats: ProductStat }) {
  const cb = stats.costBreakdown || {} as CostBreakdown;
  interface WaterfallItem { label: string; value: number; color: string; pct: string; }
  const gmv = stats.gmv || 0;
  const items: WaterfallItem[] = [
    { label: 'GMV', value: gmv, color: '#22c55e', pct: '100%' },
    { label: '折扣优惠', value: -(stats.discount || 0), color: 'var(--pdd-primary)', pct: gmv ? (Math.abs(stats.discount || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '推广花费', value: -(stats.promoCost || 0), color: 'var(--pdd-primary)', pct: gmv ? (Math.abs(stats.promoCost || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '商品成本', value: -(cb.productCost || 0), color: 'var(--pdd-primary)', pct: gmv ? (Math.abs(cb.productCost || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '平台佣金', value: -(cb.platformFee || 0), color: 'var(--pdd-primary-light)', pct: gmv ? (Math.abs(cb.platformFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '运费险', value: -(cb.insuranceFee || 0), color: 'var(--pdd-primary-light)', pct: gmv ? (Math.abs(cb.insuranceFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '罚款/扣款', value: -(cb.penaltyFee || 0), color: '#f5222d', pct: gmv ? (Math.abs(cb.penaltyFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '营销费用', value: -(cb.marketingFee || 0), color: '#eb2f96', pct: gmv ? (Math.abs(cb.marketingFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '包装快递', value: -((cb.packagingFee || 0) + (cb.shippingFee || 0)), color: 'var(--pdd-primary-light)', pct: gmv ? (Math.abs((cb.packagingFee || 0) + (cb.shippingFee || 0)) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '税费', value: -(cb.taxes || 0), color: '#f97316', pct: gmv ? (Math.abs(cb.taxes || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '其他扣费', value: -(cb.customDeductions || 0), color: '#f97316', pct: gmv ? (Math.abs(cb.customDeductions || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '净利润', value: stats.netProfit || 0, color: (stats.netProfit || 0) >= 0 ? '#22c55e' : 'var(--pdd-primary)', pct: gmv ? (Math.abs(stats.netProfit || 0) / gmv * 100).toFixed(0) + '%' : '--' },
  ];
  const maxVal = Math.max(...items.map(i => Math.abs(i.value)), 1);

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><BarChart3 size={13} color="#7c3aed" />利润拆解</h3>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.label} className="flex items-center gap-3">
            <span className={`text-xs w-16 shrink-0 text-right ${item.label === '净利润' ? 'font-bold text-pdd-text' : 'text-pdd-gray-500'}`}>{item.label}</span>
            <div className="flex-1 h-6 bg-pdd-gray-100 rounded-sm overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${(Math.abs(item.value) / maxVal) * 100}%` }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className="h-full rounded-sm"
                style={{ backgroundColor: item.color }}
              />
            </div>
            <span className={`text-xs font-mono w-20 shrink-0 text-right ${item.value >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {item.value >= 0 ? '+' : ''}{fmtMoney(Math.abs(item.value))}
            </span>
            <span className="text-xs text-pdd-gray-400 w-10 shrink-0 text-right">{item.pct}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 子组件：SKU 排行表 ───────────────────────────────────
function SkuRankingTable({ orders, stats }: { orders: any[]; stats: ProductStat }) {
  const skuData = useMemo(() => {
    const map: Record<string, { sku: string; qty: number; revenue: number; count: number }> = {};
    orders.forEach(o => {
      const sku = o['商家编码-SKU维度'] || o['规格编码'] || o['SKU编码'] || '';
      if (!sku) return;
      if (!map[sku]) map[sku] = { sku, qty: 0, revenue: 0, count: 0 };
      map[sku].qty += Number(o['商品数量'] || o['交易数量'] || 1) || 1;
      map[sku].revenue += Number(o['商家实收金额(元)'] || o['成交金额'] || o['支付金额'] || 0) || 0;
      map[sku].count++;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [orders]);

  if (!skuData.length) return <div className="p-4 text-xs text-pdd-gray-400 text-center">暂无SKU数据</div>;

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Layers size={13} color="#f97316" />SKU 销量排行 TOP10</h3>
      <table className="w-full" style={{ fontSize: '10px' }}>
        <thead><tr className="text-pdd-gray-400 border-b border-pdd-gray-100"><th className="py-1 text-left font-medium">SKU编码</th><th className="py-1 text-right font-medium">销量</th><th className="py-1 text-right font-medium">收入</th></tr></thead>
        <tbody className="divide-y divide-pdd-gray-50">
          {skuData.map((s, i) => (
            <tr key={s.sku} className="hover:bg-pdd-gray-50">
              <td className="py-1 text-pdd-gray-700 font-mono truncate max-w-[120px]">{s.sku}</td>
              <td className="py-1 text-right font-mono text-pdd-gray-700">{s.qty}</td>
              <td className="py-1 text-right font-mono text-pdd-gray-700">{fmtMoney(s.revenue)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── 子组件：商品分层判定卡片 ──────────────────────────────
function ProductPositioningCard({ stats, allStats }: { stats: ProductStat; allStats: Record<string, ProductStat> }) {
  const pos = useMemo(() => classifyProduct(stats, allStats), [stats, allStats]);
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: pos.typeColor, backgroundColor: pos.typeBg }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white" style={{ backgroundColor: pos.typeColor }}>{pos.type}</div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold" style={{ color: pos.typeColor }}>{pos.type}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: pos.stageBg, color: pos.stageColor }}>{pos.stage}</span>
          </div>
          <p className="text-xs text-pdd-gray-500">{pos.suggestion}</p>
        </div>
      </div>
    </div>
  );
}

// ─── 主组件 ───────────────────────────────────────────────
export default function ProductDeepAnalysis({ isOpen, onClose, initialProductId, productStats, products, orders, prevProductStats }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialProductId || null);
  const [search, setSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(!initialProductId);
  const [filter, setFilter] = useState<'all' | 'champion' | 'profit' | 'hidden' | 'dead'>('all');

  // 选中的商品统计
  const selectedStats = selectedId ? productStats[selectedId] : null;
  const prevStats = selectedId && prevProductStats ? prevProductStats[selectedId] : undefined;

  // 筛选该商品的订单
  const productOrders = useMemo(() => {
    if (!selectedId) return [];
    return orders.filter(o => {
      const oId = String(o['商品ID'] || o['商品id'] || o['productId'] || '');
      return oId === selectedId;
    });
  }, [orders, selectedId]);

  // 商品列表（含分类筛选）
  const categorizedProducts = useMemo(() => {
    const all = Object.values(productStats);
    const sortedBySales = [...all].sort((a, b) => b.sales - a.sales);
    const salesThreshold = sortedBySales[Math.floor(all.length * 0.2)]?.sales || 1;
    const avgProfitRate = all.reduce((sum, s) => sum + s.profitRate, 0) / (all.length || 1);

    return products.map(p => {
      const stats = productStats[p.id];
      if (!stats) return { ...p, category: 'unknown' as const };
      if (p.sales >= salesThreshold && p.profitRate > avgProfitRate) return { ...p, category: 'champion' as const };
      if (p.profitRate > avgProfitRate * 1.2) return { ...p, category: 'profit' as const };
      if (stats.ctr > 0 && stats.cvr > 0 && p.sales < salesThreshold) return { ...p, category: 'hidden' as const };
      if (stats.turnoverDays > 60 && p.sales < salesThreshold) return { ...p, category: 'dead' as const };
      return { ...p, category: 'normal' as const };
    });
  }, [products, productStats]);

  const filteredProducts = useMemo(() => {
    let list = categorizedProducts;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }
    if (filter !== 'all') {
      list = list.filter(p => p.category === filter);
    }
    return list;
  }, [categorizedProducts, search, filter]);

  const diagnoses = useMemo(() => selectedStats ? generateDiagnoses(selectedStats, prevStats) : [], [selectedStats, prevStats]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.25 }}
          onClick={e => e.stopPropagation()}
          className="absolute inset-4 bg-pdd-gray-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ❶ 顶部导航栏 */}
          <div className="shrink-0 h-14 bg-pdd-card border-b border-pdd-border flex items-center gap-3 px-4">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-pdd-gray-100 transition-colors text-pdd-gray-500 hover:text-pdd-text">
              <ArrowRight size={18} style={{ transform: 'rotate(180deg)' }} />
            </button>
            <div className="relative flex-1 max-w-md">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-gray-400" />
              <input
                type="text" placeholder="搜索商品ID / 名称 / 编码..."
                value={search} onChange={e => { setSearch(e.target.value); setShowSidebar(true); }}
                onFocus={() => setShowSidebar(true)}
                className="w-full pl-8 pr-3 py-1.5 border border-pdd-gray-200 rounded-lg text-xs focus:outline-none focus:border-cyan-400 bg-pdd-gray-50 focus:bg-pdd-card transition-colors"
              />
            </div>
            {selectedStats && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-pdd-text truncate max-w-[200px]">{selectedStats.productName}</span>
                {selectedStats.productCode && <span className="text-xs text-pdd-gray-400 font-mono">{selectedStats.productCode}</span>}
              </div>
            )}
            {!selectedStats && <span className="text-sm text-pdd-gray-400">搜索或选择商品开始分析</span>}
            <div className="flex-1" />
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-pdd-gray-100 transition-colors text-pdd-gray-400 hover:text-pdd-text"><X size={18} /></button>
          </div>

          {/* ❷ 主内容区 */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧商品面板 */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="shrink-0 border-r border-pdd-border bg-pdd-card flex flex-col overflow-hidden">
                  <div className="p-3 border-b border-pdd-gray-100">
                    <div className="flex items-center gap-1 bg-pdd-gray-50 rounded-lg p-0.5">
                      {(['all', 'champion', 'profit', 'hidden', 'dead'] as const).map(k => (
                        <button key={k} onClick={() => setFilter(k)}
                          className={`flex-1 py-1 text-xs rounded-md font-medium transition-all ${filter === k ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-gray-400 hover:text-pdd-gray-600'}`}>
                          {{ all: '全部', champion: '爆品', profit: '利润款', hidden: '潜力款', dead: '滞销' }[k]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button key={p.id} onClick={() => { setSelectedId(p.id); setShowSidebar(false); }}
                        className={`w-full text-left px-3 py-2.5 border-b border-pdd-gray-50 hover:bg-cyan-50/30 transition-colors ${selectedId === p.id ? 'bg-cyan-50/50 border-l-2 border-l-cyan-400' : ''}`}>
                        <div className="text-xs font-medium text-pdd-text truncate">{p.name || p.id}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-pdd-gray-400" style={{ fontSize: '9px' }}>
                          <span className="font-mono text-blue-500">{p.id}</span>
                          <span>GMV {fmtMoney(p.gmv)}</span>
                          {p.roi > 0 && <span className={p.roi >= 2 ? 'text-green-500' : 'text-red-400'}>ROI {p.roi.toFixed(1)}</span>}
                        </div>
                      </button>
                    ))}
                    {filteredProducts.length === 0 && <div className="p-4 text-xs text-pdd-gray-400 text-center">无匹配商品</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 右侧分析内容 */}
            <div className="flex-1 overflow-y-auto">
              {!selectedStats ? (
                <div className="h-full flex flex-col items-center justify-center text-pdd-gray-400 gap-3">
                  <Search size={40} className="opacity-20" />
                  <span className="text-sm">搜索商品ID或从左侧列表选择商品开始分析</span>
                  {!showSidebar && <button onClick={() => setShowSidebar(true)} className="text-xs text-cyan-500 hover:text-cyan-600 underline">展开商品列表</button>}
                </div>
              ) : (
                <div className="p-4 space-y-4 max-w-7xl mx-auto">
                  {/* A. KPI 卡片行 */}
                  <KpiCardRow stats={selectedStats} prevStats={prevStats} />

                  {/* B. 转化漏斗 + 销售趋势 */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5 pdd-card rounded-xl border border-pdd-gray-200">
                      <ConversionFunnel stats={selectedStats} orders={productOrders} />
                    </div>
                    <div className="col-span-7 pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><TrendingUp size={13} color="#16a34a" />销售趋势</h3>
                      {selectedStats.dailySales && selectedStats.dailySales.length > 0 ? (
                        <ResponsiveContainer width="100%" height={220}>
                          <ComposedChart data={selectedStats.dailySales}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} />
                            <Tooltip />
                            <Bar dataKey="sales" fill="var(--pdd-primary-light)" opacity={0.6} name="销售额" />
                            <Line type="monotone" dataKey="gmv" stroke="var(--pdd-primary)" strokeWidth={2} dot={false} name="GMV" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : <div className="h-[220px] flex items-center justify-center text-xs text-pdd-gray-400">暂无每日销售数据</div>}
                    </div>
                  </div>

                  {/* C. 利润瀑布图 */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200">
                    <ProfitWaterfall stats={selectedStats} />
                  </div>

                  {/* D. 推广渠道 + E. 流量来源 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Target size={13} color="#7c3aed" />推广渠道 ROI</h3>
                      {selectedStats.promoSourceDetails && selectedStats.promoSourceDetails.length > 0 ? (
                        <div className="space-y-2">
                          {selectedStats.promoSourceDetails.map((src, i) => {
                            const roi = src.cost > 0 ? src.transaction / src.cost : 0;
                            return (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <span className="w-20 shrink-0 text-pdd-gray-600 truncate">{src.source}</span>
                                <div className="flex-1 h-5 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(roi / 5 * 100, 100)}%` }} transition={{ duration: 0.5, delay: i * 0.05 }}
                                    className="h-full rounded-sm" style={{ backgroundColor: roi < 1 ? 'var(--pdd-primary)' : roi < 2 ? '#f97316' : roi < 3 ? '#eab308' : '#22c55e' }} />
                                </div>
                                <span className="w-14 text-right font-mono font-medium" style={{ color: roi < 1 ? 'var(--pdd-primary)' : roi >= 3 ? '#16a34a' : 'var(--pdd-text)' }}>ROI {roi.toFixed(1)}</span>
                                <span className="text-pdd-gray-400 w-20 text-right">花费 ¥{src.cost.toFixed(0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : <div className="h-[150px] flex items-center justify-center text-xs text-pdd-gray-400">暂无推广数据</div>}
                    </div>
                    <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><PieChart size={13} color="#06b6d4" />流量来源占比</h3>
                      {selectedStats.promoSourceDetails && selectedStats.promoSourceDetails.length > 0 ? (
                        <ResponsiveContainer width="100%" height={180}>
                          <RechartsPieChart>
                            <Pie data={selectedStats.promoSourceDetails.map(s => ({ name: s.source, value: s.impressions }))} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value">
                              {selectedStats.promoSourceDetails.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Pie>
                            <Tooltip formatter={(v: number) => v.toLocaleString()} />
                          </RechartsPieChart>
                        </ResponsiveContainer>
                      ) : <div className="h-[180px] flex items-center justify-center text-xs text-pdd-gray-400">暂无流量数据</div>}
                    </div>
                  </div>

                  {/* F. SKU排行 + 价格带分布 */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-7 pdd-card rounded-xl border border-pdd-gray-200">
                      <SkuRankingTable orders={productOrders} stats={selectedStats} />
                    </div>
                    <div className="col-span-5 pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><DollarSign size={13} color="#f97316" />价格-销量分布</h3>
                      {selectedStats.priceDistribution && selectedStats.priceDistribution.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={selectedStats.priceDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                            <XAxis dataKey="range" tick={{ fontSize: 8, fill: 'var(--pdd-text-secondary)' }} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} />
                            <Tooltip />
                            <Bar dataKey="count" fill="var(--pdd-primary)" opacity={0.7} name="销量" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="h-[200px] flex items-center justify-center text-xs text-pdd-gray-400">暂无价格分布数据</div>}
                      <p className="text-xs text-pdd-gray-500 mt-2">当前均价 ¥{selectedStats.avgOrderValue.toFixed(0)}，{selectedStats.priceDistribution && selectedStats.priceDistribution.length > 0 ? `主要成交区间 ${selectedStats.priceDistribution.sort((a, b) => b.count - a.count)[0]?.range || '--'}` : ''}</p>
                    </div>
                  </div>

                  {/* G. 售后质量分析 */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                    <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><AlertTriangle size={13} color="#f97316" />售后质量分析</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-pdd-gray-500 mb-1">退款原因分布</div>
                        {selectedStats.afterSaleBreakdown && Object.keys(selectedStats.afterSaleBreakdown).length > 0 ? (
                          <div className="space-y-1.5">
                            {Object.entries(selectedStats.afterSaleBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => {
                              const total = Object.values(selectedStats.afterSaleBreakdown).reduce((s, x) => s + x, 0);
                              const pct = total > 0 ? (v / total) * 100 : 0;
                              return (
                                <div key={k} className="flex items-center gap-2 text-xs">
                                  <span className="w-16 shrink-0 text-pdd-gray-600 truncate">{k}</span>
                                  <div className="flex-1 h-4 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                    <div className="h-full rounded-sm bg-orange-400" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-pdd-gray-400">{v}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : <div className="text-xs text-pdd-gray-400">暂无售后数据</div>}
                      </div>
                      <div>
                        <div className="text-xs text-pdd-gray-500 mb-1">售后率趋势</div>
                        <div className="flex items-end gap-1 h-24">
                          {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                            const h = 20 + Math.random() * 60;
                            return <div key={m} className="flex-1 rounded-t-sm bg-orange-200" style={{ height: h }} title={`${m}月`} />;
                          })}
                        </div>
                        <div className="text-xs text-pdd-gray-400 text-center mt-1">月度趋势（示意）</div>
                      </div>
                      <div>
                        <div className="text-xs text-pdd-gray-500 mb-1">质量指标</div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">退款率</span><span className={`font-mono font-semibold ${selectedStats.refundRate > 10 ? 'text-red-500' : 'text-green-500'}`}>{fmtPct(selectedStats.refundRate)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">售后率</span><span className="font-mono font-semibold">{fmtPct(selectedStats.afterSaleRate)}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">售后笔数</span><span className="font-mono">{selectedStats.afterSaleCount}</span></div>
                          <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">退款笔数</span><span className="font-mono">{selectedStats.refundCount || 0}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* H. 关联商品 + I. 地域 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Layers size={13} color="#0891b2" />关联商品推荐</h3>
                      {selectedStats.relatedProducts && selectedStats.relatedProducts.length > 0 ? (
                        <div className="space-y-1.5">
                          {selectedStats.relatedProducts.slice(0, 5).map((rp, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-pdd-gray-50 last:border-0">
                              <span className="text-pdd-gray-700 truncate max-w-[140px]">{rp.productName || rp.productId}</span>
                              <span className="text-pdd-gray-400">共购 {rp.coOccurrenceCount} 次</span>
                            </div>
                          ))}
                        </div>
                      ) : <div className="h-[100px] flex items-center justify-center text-xs text-pdd-gray-400">暂无关联商品数据</div>}
                    </div>
                    <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><MapPin size={13} color="#e02e24" />地域分布 TOP5</h3>
                      <div className="space-y-1.5">
                        {(() => {
                          const provinceMap: Record<string, number> = {};
                          productOrders.forEach(o => {
                            const p = o['收货省'] || o['省份'] || o['收货地址省'] || '';
                            if (p) provinceMap[p] = (provinceMap[p] || 0) + 1;
                          });
                          const sorted = Object.entries(provinceMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
                          if (!sorted.length) return <div className="h-[100px] flex items-center justify-center text-xs text-pdd-gray-400">暂无地域数据</div>;
                          const max = sorted[0][1];
                          return sorted.map(([prov, count], i) => (
                            <div key={i} className="flex items-center gap-2 text-xs">
                              <span className="w-14 shrink-0 text-pdd-gray-600">{prov}</span>
                              <div className="flex-1 h-4 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                <div className="h-full rounded-sm" style={{ width: `${(count / max) * 100}%`, backgroundColor: COLORS[i] }} />
                              </div>
                              <span className="text-pdd-gray-400 w-8 text-right">{count}</span>
                            </div>
                          ));
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* J. 商品分层判定 */}
                  <ProductPositioningCard stats={selectedStats} allStats={productStats} />

                  {/* K. 运营诊断建议 */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4">
                    <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><Info size={13} color="#7c3aed" />运营诊断建议</h3>
                    {diagnoses.length > 0 ? (
                      <div className="space-y-2">
                        {diagnoses.map((d, i) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                            className="flex items-start gap-2.5 p-3 rounded-lg" style={{ backgroundColor: d.bg }}>
                            <div className="shrink-0 mt-0.5" style={{ color: d.color }}>{d.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-semibold" style={{ color: d.color }}>{d.title}</span>
                                <span className="px-1.5 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    color: d.priority === 'urgent' ? '#e02e24' : d.priority === 'important' ? '#f97316' : '#6b7280',
                                    backgroundColor: d.priority === 'urgent' ? '#fef2f2' : d.priority === 'important' ? '#fff7ed' : '#f9fafb'
                                  }}>
                                  {{ urgent: '紧急', important: '重要', reference: '参考' }[d.priority]}
                                </span>
                              </div>
                              <p className="text-xs text-pdd-gray-600 leading-relaxed">{d.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs text-green-600 p-3 rounded-lg bg-green-50">
                        <CheckCircle size={14} />
                        当前指标表现正常，未触发任何预警，继续保持！
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ❸ 底部状态栏 */}
          <div className="shrink-0 h-8 bg-pdd-card border-t border-pdd-border flex items-center justify-between px-4 text-pdd-gray-400" style={{ fontSize: '9px' }}>
            <span>数据更新时间：{selectedStats?.lastOrderDate || '--'}</span>
            <span>数据质量：
              <span className={selectedStats && selectedStats.hasOrderData ? 'text-green-500 font-medium' : 'text-red-400'}>{selectedStats?.hasOrderData ? '有订单数据' : '无订单数据'}</span>
              {' | '}
              <span className={selectedStats && selectedStats.hasPromoData ? 'text-green-500 font-medium' : 'text-pdd-gray-400'}>{selectedStats?.hasPromoData ? '有推广数据' : '无推广数据'}</span>
            </span>
            <span>活跃天数：{selectedStats?.activeDays || 0} 天</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Search, TrendingUp, TrendingDown, DollarSign, ShoppingCart,
  RotateCcw, Target, BarChart3, Layers, Zap, Clock, MapPin,
  ChevronRight, Package, AlertTriangle, CheckCircle, Info,
  ArrowRight, Activity, Percent, Filter, Tag, ChevronDown, PieChart,
  Shield, Star, Hash, Gauge, Heart,
  ThumbsDown, Truck, Users
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, ComposedChart, Area
} from 'recharts';
import { ProductStat, CostBreakdown } from '../../components/ProductLinkStats';
import { useData } from '../../App';
import { findField } from '../../utils';

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
function KpiCardRow({ stats, prevStats, benchmark, getBenchmark, comparisonMode, healthScore, cm3, allProductStats }: {
  stats: ProductStat; prevStats?: ProductStat;
  benchmark: any; getBenchmark: (m: string, v: number) => any; comparisonMode: string;
  healthScore: any; cm3: number; allProductStats: Record<string, ProductStat>;
}) {
  const diffBadge = (current: number, bm: any) => {
    if (!bm || comparisonMode === 'none') return null;
    const delta = current - bm.value;
    const better = bm.lowIsGood ? delta < 0 : delta > 0;
    const cls = better ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600';
    const arrow = better ? '↑' : '↓';
    const absDelta = Math.abs(delta);
    // 百分比类指标显示 pp，绝对值类显示金额/数字
    const suffix = Math.abs(bm.value) < 100 ? 'pp' : '';
    return <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{arrow} {absDelta.toFixed(1)}{suffix}</span>;
  };

  const percentileBadge = (val: number, key: string, lowIsGood?: boolean) => {
    if (!benchmark || comparisonMode === 'none') return null;
    const all = Object.values(allProductStats);
    const arr = all.map((s: any) => s[key] ?? 0);
    const better = lowIsGood ? arr.filter((v: number) => v < val).length : arr.filter((v: number) => v > val).length;
    const pct = arr.length > 0 ? Math.round((better / arr.length) * 100) : 0;
    return <span className="text-xs text-pdd-gray-400">优于 {pct}% 商品</span>;
  };

  const renderSpark = (dailyData: any[], key: string) => {
    if (!dailyData || dailyData.length < 2) return null;
    const vals = dailyData.map(d => d[key] || 0);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${100 - ((v - min) / range) * 40}`).join(' ');
    return (
      <svg width="56" height="20" className="shrink-0 opacity-40">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const kpiDefs = [
    { label: 'GMV', key: 'gmv', value: stats.gmv, display: fmtMoney(stats.gmv), icon: <ShoppingCart size={14} />, color: '#e02e24', spark: renderSpark(stats.dailySales, 'gmv'), section: 'kpi-gmv' },
    { label: '净利润率', key: 'profitRate', value: stats.profitRate, display: fmtPct(stats.profitRate), icon: <DollarSign size={14} />, color: '#16a34a', spark: renderSpark(stats.dailySales, 'sales'), section: 'kpi-profit' },
    { label: '推广ROI', key: 'roi', value: stats.roi, display: stats.roi > 0 ? stats.roi.toFixed(2) : '--', icon: <Target size={14} />, color: '#7c3aed', spark: null, section: 'kpi-roi' },
    { label: '退款率', key: 'refundRate', value: stats.refundRate, display: fmtPct(stats.refundRate), icon: <RotateCcw size={14} />, color: '#f97316', spark: null, section: 'kpi-refund', lowIsGood: true },
    { label: '库存周转', key: 'turnoverDays', value: stats.turnoverDays ?? 0, display: (stats.turnoverDays ?? 0) > 0 ? stats.turnoverDays + '天' : '--', icon: <Clock size={14} />, color: '#0891b2', spark: null, section: 'kpi-turnover', lowIsGood: true },
    { label: 'CM3 利润', key: '', value: cm3, display: fmtMoney(cm3), icon: <BarChart3 size={14} />, color: cm3 >= 0 ? '#16a34a' : '#e02e24', spark: null, section: 'kpi-cm3' },
    { label: '健康分', key: '', value: healthScore?.score ?? 0, display: healthScore ? `${healthScore.score}分` : '--', icon: <Gauge size={14} />, color: (healthScore?.score ?? 0) >= 60 ? '#16a34a' : '#f97316', spark: null, section: 'kpi-health' },
  ];

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid grid-cols-7 gap-2">
      {kpiDefs.map(k => {
        const bm = k.key ? getBenchmark(k.key, k.value) : null;
        const isGood = bm ? (bm.lowIsGood ? k.value < bm.value : k.value > bm.value) : null;
        const borderColor = comparisonMode !== 'none' && bm ? (isGood ? '#22c55e40' : 'var(--pdd-primary)40') : 'var(--pdd-border)';
        return (
          <motion.div key={k.label} whileHover={{ y: -2 }} onClick={() => scrollTo(k.section)}
            className="rounded-xl border p-2.5 flex flex-col gap-1 transition-all hover:shadow-md cursor-pointer" style={{ borderColor, backgroundColor: 'var(--pdd-card)' }}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-pdd-gray-500">
                <span style={{ color: k.color }}>{k.icon}</span>
                {k.label}
              </div>
              {k.spark}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-lg font-bold text-pdd-text">{k.display}</span>
              {bm && k.key && diffBadge(k.value, bm)}
            </div>
            <div className="flex items-center justify-between">
              {k.key ? percentileBadge(k.value, k.key, (k as any).lowIsGood) : <span />}
              {bm && <span className="text-xs text-pdd-gray-400">vs {bm.label}</span>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// ─── 子组件：双列对比转化漏斗 ─────────────────────────────
function ConversionFunnel({ stats, orders, allProductStats, comparisonMode }: {
  stats: ProductStat; orders: any[];
  allProductStats: Record<string, ProductStat>; comparisonMode: string;
}) {
  const impressions = stats.promoImpressions || 0;
  const clicks = stats.promoClicks || 0;
  const orders_ = stats.orders || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const cvr = clicks > 0 ? (orders_ / clicks) * 100 : 0;
  const addToCart = Math.round(clicks * 0.35);

  // 店铺均值漏斗
  const storeFunnel = useMemo(() => {
    const all = Object.values(allProductStats);
    if (all.length < 2) return null;
    const n = all.length;
    const avgImpr = all.reduce((s, p) => s + (p.promoImpressions || 0), 0) / n;
    const avgClicks = all.reduce((s, p) => s + (p.promoClicks || 0), 0) / n;
    const avgOrders = all.reduce((s, p) => s + (p.orders || 0), 0) / n;
    const avgCart = avgClicks * 0.35;
    const sCtr = avgImpr > 0 ? (avgClicks / avgImpr) * 100 : 0;
    const sCvr = avgClicks > 0 ? (avgOrders / avgClicks) * 100 : 0;
    return { impressions: avgImpr, clicks: avgClicks, addToCart: avgCart, orders: avgOrders, ctr: sCtr, cvr: sCvr };
  }, [allProductStats]);

  const showStore = comparisonMode !== 'none' && storeFunnel;

  const diffBadge = (curr: number, store: number, isRate?: boolean) => {
    if (!showStore) return null;
    const delta = curr - store;
    const suffix = isRate ? 'pp' : '%';
    if (Math.abs(delta) < 0.01) return <span className="text-xs text-pdd-gray-400">≈持平</span>;
    const better = delta > 0;
    const cls = better ? 'text-green-600' : 'text-red-500';
    const sign = better ? '+' : '';
    return <span className={`text-xs font-mono font-medium ${cls}`}>{sign}{delta.toFixed(1)}{suffix}</span>;
  };

  const steps = [
    { label: '曝光', value: impressions, storeVal: storeFunnel?.impressions ?? 0, fmt, color: '#3b82f6', isRate: false },
    { label: '点击', value: clicks, storeVal: storeFunnel?.clicks ?? 0, fmt, color: '#06b6d4', isRate: false },
    { label: '加购(估)', value: addToCart, storeVal: storeFunnel?.addToCart ?? 0, fmt, color: '#f97316', isRate: false },
    { label: '成交', value: orders_, storeVal: storeFunnel?.orders ?? 0, fmt: (n: number) => n.toFixed(0), color: '#22c55e', isRate: false },
  ];

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><Activity size={13} color="#3b82f6" />转化漏斗{showStore && <span className="text-pdd-gray-400 font-normal ml-1">· 左当前 / 右店铺均值</span>}</h3>
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const maxVal = showStore ? Math.max(s.value, s.storeVal, 1) : Math.max(s.value, 1);
          const currW = (s.value / maxVal) * 100;
          const storeW = showStore ? (s.storeVal / maxVal) * 100 : 0;
          const lossRate = i > 0 ? (steps[i - 1].value > 0 ? ((1 - s.value / steps[i - 1].value) * 100) : 0) : 0;
          const storeLossRate = i > 0 && showStore && steps[i-1].storeVal > 0 ? ((1 - s.storeVal / steps[i-1].storeVal) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-xs text-pdd-gray-500 w-14 shrink-0 text-right">{s.label}</span>
              {/* 当前商品条 */}
              <div className="flex-1 flex gap-1">
                <div className="flex-1 h-7 rounded-md relative overflow-hidden" style={{ backgroundColor: `${s.color}15` }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(currW, 0.5)}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className="h-full rounded-md" style={{ backgroundColor: s.color, opacity: 0.8 }} />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: currW > 15 ? '#fff' : 'var(--pdd-text)' }}>{s.fmt(s.value)}</span>
                </div>
                {/* 店铺均值条 */}
                {showStore && (
                  <div className="flex-1 h-7 rounded-md relative overflow-hidden" style={{ backgroundColor: `${s.color}08` }}>
                    <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(storeW, 0.5)}%` }} transition={{ duration: 0.6, delay: i * 0.1 }} className="h-full rounded-md border border-dashed" style={{ backgroundColor: `${s.color}30`, borderColor: `${s.color}50` }} />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-pdd-gray-500">{s.fmt(s.storeVal)}</span>
                  </div>
                )}
              </div>
              {/* 差量 */}
              <span className="text-xs w-16 shrink-0 text-right">{diffBadge(s.value, s.storeVal, s.isRate)}</span>
              {/* 流失率对比 */}
              {i > 0 && (
                <span className="text-xs text-pdd-gray-400 w-24 shrink-0">
                  流失 {lossRate.toFixed(0)}%
                  {showStore && <span className="text-pdd-gray-300"> | {storeLossRate.toFixed(0)}%</span>}
                </span>
              )}
              {i === 0 && <span className="w-24 shrink-0" />}
            </div>
          );
        })}
      </div>
      {/* CTR / CVR 对比 */}
      {showStore && (
        <div className="mt-3 flex items-center gap-4 text-xs border-t border-pdd-gray-100 pt-2.5">
          <span className="text-pdd-gray-500">CTR：<span className="font-mono font-semibold text-pdd-text">{ctr.toFixed(1)}%</span>{diffBadge(ctr, storeFunnel!.ctr, true)}</span>
          <span className="text-pdd-gray-500">CVR：<span className="font-mono font-semibold text-pdd-text">{cvr.toFixed(1)}%</span>{diffBadge(cvr, storeFunnel!.cvr, true)}</span>
        </div>
      )}
    </div>
  );
}

// ─── 子组件：对照式利润瀑布图 ─────────────────────────────
function ProfitWaterfall({ stats, allProductStats, comparisonMode }: {
  stats: ProductStat; allProductStats: Record<string, ProductStat>; comparisonMode: string;
}) {
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

  // 店铺均值各成本占比
  const storeAvgPcts = useMemo(() => {
    if (comparisonMode === 'none') return null;
    const all = Object.values(allProductStats);
    if (all.length < 2) return null;
    const n = all.length;
    const calcAvg = (fn: (s: ProductStat, cb: CostBreakdown) => number) => {
      return all.reduce((sum, s) => sum + fn(s, s.costBreakdown || {} as CostBreakdown), 0) / n;
    };
    const avgGmv = all.reduce((s, p) => s + (p.gmv || 0), 0) / n;
    return {
      discount: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(s.discount || 0)) / avgGmv) * 100 : 0,
      promo: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(s.promoCost || 0)) / avgGmv) * 100 : 0,
      productCost: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.productCost || 0)) / avgGmv) * 100 : 0,
      platform: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.platformFee || 0)) / avgGmv) * 100 : 0,
      insurance: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.insuranceFee || 0)) / avgGmv) * 100 : 0,
      penalty: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.penaltyFee || 0)) / avgGmv) * 100 : 0,
      marketing: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.marketingFee || 0)) / avgGmv) * 100 : 0,
      packaging: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs((cb.packagingFee || 0) + (cb.shippingFee || 0))) / avgGmv) * 100 : 0,
      taxes: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.taxes || 0)) / avgGmv) * 100 : 0,
      other: avgGmv > 0 ? (calcAvg((s, cb) => Math.abs(cb.customDeductions || 0)) / avgGmv) * 100 : 0,
      netProfit: avgGmv > 0 ? (calcAvg((s, cb) => {
        const c = s.netProfit || 0;
        return Math.abs(c);
      }) / avgGmv) * 100 : 0,
      gmv: avgGmv,
    };
  }, [allProductStats, comparisonMode]);

  // 映射 item.label 到 storeAvgPcts key
  const labelToKey: Record<string, string> = {
    'GMV': 'gmv', '折扣优惠': 'discount', '推广花费': 'promo', '商品成本': 'productCost',
    '平台佣金': 'platform', '运费险': 'insurance', '罚款/扣款': 'penalty', '营销费用': 'marketing',
    '包装快递': 'packaging', '税费': 'taxes', '其他扣费': 'other', '净利润': 'netProfit',
  };

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5">
        <BarChart3 size={13} color="#7c3aed" />利润拆解
        {storeAvgPcts && <span className="text-pdd-gray-400 font-normal ml-1">· vs 店铺均值</span>}
      </h3>
      <div className="space-y-2">
        {items.map((item, i) => {
          const storeKey = labelToKey[item.label];
          const storePct = storeAvgPcts && storeKey ? (storeAvgPcts as any)[storeKey] : undefined;
          const itemPct = item.pct !== '--' ? parseFloat(item.pct) : 0;
          const deltaPct = storePct != null && item.pct !== '--' ? itemPct - storePct : null;
          const isWorse = deltaPct != null && item.value < 0 && deltaPct < 0; // 扣费项占比更高=更差
          return (
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
            <span className="text-xs font-mono text-pdd-gray-500 w-10 shrink-0 text-right">{item.pct}</span>
            {storeAvgPcts && storeKey && storeKey !== 'gmv' && (
              <span className={`text-xs font-mono w-16 shrink-0 text-right ${isWorse ? 'text-red-500' : deltaPct != null && item.value < 0 ? 'text-green-500' : 'text-pdd-gray-400'}`}>
                vs {storePct.toFixed(0)}%
                {deltaPct != null && deltaPct !== 0 && <span className="ml-0.5">{deltaPct > 0 ? '↑' : '↓'}{Math.abs(deltaPct).toFixed(0)}pp</span>}
              </span>
            )}
            {storeAvgPcts && storeKey === 'gmv' && <span className="text-xs text-pdd-gray-400 w-16">全店均 ¥{fmt(storeAvgPcts.gmv)}</span>}
          </div>
        )})}
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

// ─── 新子组件：CM 层级联卡片（嵌入对比） ──────────────────
function CmLayerCascade({ layers, allProductStats, comparisonMode }: {
  layers: { cm1: any; cm2: any; cm3: any } | null;
  allProductStats: Record<string, ProductStat>; comparisonMode: string;
}) {
  const rankings = useMemo(() => {
    if (comparisonMode === 'none' || !layers) return null;
    const all = Object.values(allProductStats);
    if (all.length < 2) return null;
    // 计算每个商品的CM1/CM2/CM3
    const allCm: { cm1: number; cm2: number; cm3: number }[] = all.map(s => {
      const cb = s.costBreakdown || {} as CostBreakdown;
      const cm1 = (s.revenue || 0) - (cb.productCost || 0) - (s.discount || 0) - (s.refund || 0);
      const cm2 = cm1 - (cb.platformFee || 0) - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0));
      const cm3 = cm2 - (s.promoCost || 0);
      return { cm1, cm2, cm3 };
    });
    const rank = (key: 'cm1' | 'cm2' | 'cm3', val: number) => {
      const sorted = [...allCm].sort((a, b) => b[key] - a[key]);
      const idx = sorted.findIndex(v => v[key] <= val);
      const rankVal = idx === -1 ? allCm.length : idx + 1;
      return { rank: rankVal, total: allCm.length, topPct: ((1 - (rankVal - 1) / allCm.length) * 100).toFixed(0) };
    };
    return {
      cm1: rank('cm1', layers.cm1.value),
      cm2: rank('cm2', layers.cm2.value),
      cm3: rank('cm3', layers.cm3.value),
    };
  }, [allProductStats, layers, comparisonMode]);

  if (!layers) return <div className="p-4 text-xs text-pdd-gray-400 text-center">暂无CM分层数据</div>;
  const items = [layers.cm1, layers.cm2, layers.cm3];
  const rankKeys: Array<'cm1' | 'cm2' | 'cm3'> = ['cm1', 'cm2', 'cm3'];
  return (
    <div className="p-4">
      <div className="flex items-center gap-0">
        {items.map((layer, i) => {
          const rk = rankings ? (rankings as any)[rankKeys[i]] : null;
          return (
          <React.Fragment key={layer.name}>
            <div className={`flex-1 rounded-xl border p-3 text-center ${layer.positive ? 'bg-green-50/30' : 'bg-red-50/30'}`} style={{ borderColor: layer.positive ? '#22c55e40' : 'var(--pdd-primary)40' }}>
              <div className="text-xs text-pdd-gray-500 mb-1">{layer.name}</div>
              <div className={`text-lg font-bold font-mono ${layer.positive ? 'text-green-600' : 'text-red-500'}`}>
                {layer.positive ? '+' : ''}{fmtMoney(Math.abs(layer.value))}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${layer.positive ? 'text-green-500' : 'text-red-400'}`}>
                占GMV {layer.pct >= 0 ? '+' : ''}{layer.pct.toFixed(1)}%
              </div>
              {rk && (
                <div className="text-pdd-gray-500 mt-1" style={{ fontSize: '9px' }}>
                  贡献度排第 <span className="font-semibold text-pdd-text">{rk.rank}</span>/{rk.total} · 优于 {rk.topPct}% 商品
                </div>
              )}
              <div className="text-pdd-gray-400 mt-1" style={{ fontSize: '9px' }}>{layer.desc}</div>
            </div>
            {i < 2 && (
              <div className="shrink-0 w-8 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-pdd-gray-300 relative">
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-pdd-gray-300" style={{ borderLeftColor: 'var(--pdd-border)' }} />
                </div>
              </div>
            )}
          </React.Fragment>
        )})}
      </div>
    </div>
  );
}

// ─── 新子组件：SKU 深度矩阵表 ──────────────────────────────
function SkuDeepTable({ matrix }: { matrix: any[] }) {
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string>('sales');
  const [sortDir, setSortDir] = useState<number>(-1);
  if (!matrix.length) return <div className="p-4 text-xs text-pdd-gray-400 text-center">暂无SKU数据（请确认订单数据包含SKU维度字段）</div>;

  const handleSort = (key: string) => {
    if (sortBy === key) setSortDir(-sortDir); else { setSortBy(key); setSortDir(-1); }
  };
  const sorted = [...matrix].sort((a, b) => ((a[sortBy] ?? 0) - (b[sortBy] ?? 0)) * sortDir);

  // 每行颜色编码
  const rowColor = (s: any) => {
    if (s.isHighRefund) return 'bg-red-50/40 border-l-2 border-l-red-400';
    if (s.profitRate != null && s.profitRate > 20) return 'bg-green-50/30 border-l-2 border-l-green-400';
    if (s.isMainSku) return 'bg-blue-50/20';
    return '';
  };

  const cols = [
    { key: 'skuId', label: 'SKU编码', cls: 'text-left' },
    { key: 'spec', label: '规格', cls: 'text-left' },
    { key: 'sales', label: '销量', cls: 'text-right' },
    { key: 'revenue', label: '实收', cls: 'text-right', fmt: (v: number) => fmtMoney(v) },
    { key: 'salesRatio', label: '占比', cls: 'text-right', fmt: (v: number) => v.toFixed(0) + '%' },
    { key: 'refundRate', label: '退款率', cls: 'text-right', fmt: (v: number) => v.toFixed(1) + '%' },
    { key: 'refundAmount', label: '退款额', cls: 'text-right', fmt: (v: number) => fmtMoney(v) },
    { key: 'profitRate', label: '利润率', cls: 'text-right', fmt: (v: number | undefined) => v != null ? v.toFixed(0) + '%' : '--' },
  ];

  return (
    <div className="p-4 overflow-x-auto" id="sku-deep">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Layers size={13} color="#f97316" />SKU深度对比 · 点击展开查看明细</h3>
      <table className="w-full" style={{ fontSize: '10px' }}>
        <thead>
          <tr className="text-pdd-gray-400 border-b border-pdd-gray-100">
            <th className="py-1.5 w-5" />
            {cols.map(c => (
              <th key={c.key} onClick={() => handleSort(c.key)} className={`py-1.5 ${c.cls} font-medium cursor-pointer hover:text-pdd-text transition-colors`}>
                {c.label}{sortBy === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pdd-gray-50">
          {sorted.map((s, i) => {
            const isExpanded = expandedSku === s.skuId;
            return (
              <React.Fragment key={s.skuId || i}>
                <tr onClick={() => setExpandedSku(isExpanded ? null : s.skuId)}
                  className={`cursor-pointer transition-colors hover:bg-pdd-gray-50 ${rowColor(s)}`}>
                  <td className="py-1.5 text-pdd-gray-400">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</td>
                  <td className={`py-1.5 text-pdd-gray-700 font-mono truncate max-w-[80px] ${s.isMainSku ? 'font-bold' : ''}`} title={s.skuId}>{s.skuId}</td>
                  <td className="py-1.5 text-pdd-gray-600 truncate max-w-[60px]">{s.spec || '--'}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.isMainSku ? 'text-blue-600' : 'text-pdd-gray-700'}`}>{s.sales}</td>
                  <td className="py-1.5 text-right font-mono text-pdd-gray-700">{fmtMoney(s.revenue)}</td>
                  <td className="py-1.5 text-right font-mono">{s.salesRatio.toFixed(0)}%</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.isHighRefund ? 'text-red-500' : 'text-pdd-gray-600'}`}>
                    {s.refundRate.toFixed(1)}%
                    {s.isHighRefund && <AlertTriangle size={10} className="inline ml-0.5 text-red-400" />}
                  </td>
                  <td className="py-1.5 text-right font-mono text-pdd-gray-600">{fmtMoney(s.refundAmount)}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.profitRate != null ? (s.profitRate >= 0 ? 'text-green-600' : 'text-red-500') : 'text-pdd-gray-400'}`}>
                    {s.profitRate != null ? s.profitRate.toFixed(0) + '%' : '--'}
                  </td>
                </tr>
                {/* 展开行 */}
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-gray-50/50 border-b border-pdd-gray-100 px-4 py-3 overflow-hidden">
                        <div className="grid grid-cols-3 gap-4">
                          {/* SKU 诊断 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-gray-600 mb-1.5 flex items-center gap-1"><Info size={11} color="#7c3aed" />SKU 诊断</div>
                            <div className="space-y-1 text-xs">
                              {s.isHighRefund && <div className="text-red-500 flex items-center gap-1"><AlertTriangle size={10} />高退款SKU — 退款率是均值 2 倍以上</div>}
                              {s.isMainSku && <div className="text-blue-500 flex items-center gap-1"><Star size={10} />主力SKU — 占销量 {s.salesRatio.toFixed(0)}%</div>}
                              {s.profitRate != null && s.profitRate < 0 && <div className="text-red-500 flex items-center gap-1"><TrendingDown size={10} />亏损SKU — 利润率 {s.profitRate.toFixed(0)}%</div>}
                              {s.profitRate != null && s.profitRate > 25 && <div className="text-green-500 flex items-center gap-1"><TrendingUp size={10} />高利润SKU — 利润率 {s.profitRate.toFixed(0)}%</div>}
                              {!s.isHighRefund && !s.isMainSku && (s.profitRate == null || (s.profitRate >= 0 && s.profitRate <= 25)) && <div className="text-pdd-gray-400">该 SKU 指标正常，无明显异常</div>}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs"><span className="text-pdd-gray-400">均价</span><span className="font-mono">{fmtMoney(s.avgPrice)}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-pdd-gray-400">平均退款天数</span><span className="font-mono">{s.avgRefundDays > 0 ? s.avgRefundDays.toFixed(0) + '天' : '--'}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-pdd-gray-400">订单数</span><span className="font-mono">{s.orderCount}</span></div>
                            </div>
                          </div>
                          {/* 退款原因 TOP1 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-gray-600 mb-1.5 flex items-center gap-1"><ThumbsDown size={11} color="#f97316" />退款主因</div>
                            {s.topRefundReason ? (
                              <div className="text-xs">
                                <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded font-medium">{s.topRefundReason}</span>
                                <p className="text-pdd-gray-400 mt-1">该原因是此 SKU 退款的首要原因，退款 {s.refundAmount > 0 ? fmtMoney(s.refundAmount) : ''} 共 {s.refundRate.toFixed(1)}%</p>
                              </div>
                            ) : <div className="text-xs text-pdd-gray-400">暂无退款原因数据</div>}
                          </div>
                          {/* 利润贡献 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-gray-600 mb-1.5 flex items-center gap-1"><DollarSign size={11} color="#16a34a" />利润贡献</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-pdd-gray-400">实收</span><span className="font-mono">{fmtMoney(s.revenue)}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-gray-400">退款</span><span className="font-mono text-red-500">-{fmtMoney(s.refundAmount)}</span></div>
                              <div className="flex justify-between font-semibold border-t border-pdd-gray-200 pt-1 mt-1">
                                <span className="text-pdd-gray-600">净贡献</span>
                                <span className={`font-mono ${s.revenue - s.refundAmount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{fmtMoney(s.revenue - s.refundAmount)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <div className="mt-2 flex items-center gap-4 text-pdd-gray-400" style={{ fontSize: '9px' }}>
        <span><span className="inline-block w-3 h-2 rounded-sm mr-1 bg-red-50/40 border-l-2 border-red-400" />高退款</span>
        <span><span className="inline-block w-3 h-2 rounded-sm mr-1 bg-green-50/30 border-l-2 border-green-400" />高利润</span>
        <span><span className="inline-block w-3 h-2 rounded-sm mr-1 bg-blue-50/20" />主力SKU</span>
        <span>点击行展开明细 | 点击表头排序</span>
      </div>
    </div>
  );
}

// ─── 新子组件：双列对比退款原因条形图 ──────────────────────
function RefundReasonBarChart({ data, storeData }: { data: any[]; storeData: any[] }) {
  const hasStore = storeData.length > 0;
  if (!data.length && !hasStore) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><ThumbsDown size={13} color="#f97316" />退款原因TOP10</h3><div className="text-xs text-pdd-gray-400 text-center h-[200px] flex items-center justify-center">暂无退款原因数据（请上传售后数据）</div></div>;

  const qualityReasons = ['质量问题', '品质问题', '质量不好', '商品破损', '商品瑕疵', '与描述不符', '描述不符', '颜色/款式/型号不符', '做工粗糙', '质量差'];

  // 取两边的最大count做统一比例尺
  const maxCount = Math.max(data[0]?.count || 1, storeData[0]?.count || 1);

  // 合并两边的原因名（保持两边各自顺序，交错显示）
  const allReasons = new Set<string>();
  data.forEach(d => allReasons.add(d.reason));
  storeData.forEach(d => allReasons.add(d.reason));
  const merged = Array.from(allReasons).map(reason => {
    const curr = data.find(d => d.reason === reason);
    const store = storeData.find(d => d.reason === reason);
    return {
      reason,
      currCount: curr?.count || 0,
      currRatio: curr?.ratio || 0,
      storeCount: store?.count || 0,
      storeRatio: store?.ratio || 0,
    };
  }).sort((a, b) => Math.max(b.currCount, b.storeCount) - Math.max(a.currCount, a.storeCount)).slice(0, 12);

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5">
        <ThumbsDown size={13} color="#f97316" />退款原因对比
        {hasStore && <span className="text-pdd-gray-400 font-normal ml-1">· 深=当前 / 浅=全店</span>}
      </h3>
      <div className="space-y-1.5">
        {merged.map((d, i) => {
          const isQuality = qualityReasons.some(q => d.reason.includes(q));
          const barColor = isQuality ? 'var(--pdd-primary)' : '#9ca3af';
          const delta = d.currRatio - d.storeRatio;
          const onlyCurr = d.currCount > 0 && d.storeCount === 0;
          const onlyStore = d.storeCount > 0 && d.currCount === 0;
          return (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`w-14 shrink-0 truncate ${onlyStore ? 'text-pdd-gray-400' : 'text-pdd-gray-600'}`} title={d.reason}>{d.reason}</span>
              <div className="flex-1 flex gap-0.5">
                {/* 当前商品条 */}
                {d.currCount > 0 && (
                  <div className="flex-1 h-5 bg-pdd-gray-100 rounded-sm overflow-hidden relative">
                    <div className="h-full rounded-sm" style={{ width: `${(d.currCount / maxCount) * 100}%`, backgroundColor: barColor, opacity: 0.8 }} />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-pdd-text font-mono" style={{ fontSize: '8px' }}>{d.currCount}笔</span>
                  </div>
                )}
                {/* 全店条 */}
                {hasStore && (
                  <div className="flex-1 h-5 bg-pdd-gray-100 rounded-sm overflow-hidden relative">
                    <div className="h-full rounded-sm border border-dashed" style={{ width: `${(d.storeCount / maxCount) * 100}%`, backgroundColor: barColor, opacity: 0.25, borderColor: `${barColor}4d` }} />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-pdd-gray-500 font-mono" style={{ fontSize: '8px' }}>{d.storeCount}笔</span>
                  </div>
                )}
              </div>
              <span className={`w-12 text-right font-mono shrink-0 ${onlyCurr ? 'text-red-500' : onlyStore ? 'text-pdd-gray-400' : 'text-pdd-gray-600'}`}>
                {d.currRatio.toFixed(0)}%
              </span>
              {hasStore && (
                <span className={`w-16 text-right shrink-0 ${delta > 3 ? 'text-red-500' : delta < -3 ? 'text-green-500' : 'text-pdd-gray-400'}`} style={{ fontSize: '9px' }}>
                  {onlyCurr ? '仅该品' : onlyStore ? '仅全店' : delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}pp` : '持平'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-pdd-gray-400" style={{ fontSize: '9px' }}>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: 'var(--pdd-primary)', opacity: 0.8 }} />品质类</span>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: '#9ca3af', opacity: 0.8 }} />买家类</span>
        {hasStore && <span><span className="inline-block w-3 h-3 rounded-sm mr-1 border border-dashed" style={{ backgroundColor: 'var(--pdd-primary)', opacity: 0.25 }} />全店</span>}
      </div>
    </div>
  );
}

// ─── 新子组件：时间窗口堆叠柱状图 ──────────────────────────
function TimeWindowStackedBar({ data, skippedNoPay, skippedNoApply }: { data: any[]; skippedNoPay: number; skippedNoApply: number }) {
  if (!data.length || data.every(w => w.count === 0)) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Clock size={13} color="#0891b2" />退款时间窗口</h3><div className="text-xs text-pdd-gray-400 text-center h-[200px] flex items-center justify-center">暂无退款时间数据（请上传售后数据）</div></div>;
  const maxCount = Math.max(...data.map(w => w.count), 1);
  const total = data.reduce((s: number, w: any) => s + w.count, 0);
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Clock size={13} color="#0891b2" />退款时间窗口 (支付→申请)</h3>
      <div className="space-y-2">
        {data.map(w => (
          <div key={w.label}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-pdd-gray-600 font-medium">{w.label}</span>
              <span className="text-pdd-gray-400">{w.count}笔 | {w.ratio.toFixed(0)}% | ¥{w.amount.toFixed(0)}</span>
            </div>
            <div className="h-6 bg-pdd-gray-100 rounded-sm overflow-hidden flex">
              {w.onlyRefund > 0 && (
                <div className="h-full bg-blue-400 flex items-center justify-center text-white font-mono" style={{ width: `${(w.onlyRefund / maxCount) * 100}%`, fontSize: '8px' }} title="仅退款">
                  {((w.onlyRefund / Math.max(w.count, 1)) * 100) > 15 ? `仅退款${w.onlyRefund}` : ''}
                </div>
              )}
              {w.returnRefund > 0 && (
                <div className="h-full bg-orange-400 flex items-center justify-center text-white font-mono" style={{ width: `${(w.returnRefund / maxCount) * 100}%`, fontSize: '8px' }} title="退货退款">
                  {((w.returnRefund / Math.max(w.count, 1)) * 100) > 15 ? `退货${w.returnRefund}` : ''}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-4 text-pdd-gray-400" style={{ fontSize: '9px' }}>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1 bg-blue-400" />仅退款</span>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1 bg-orange-400" />退货退款</span>
        {(skippedNoPay > 0 || skippedNoApply > 0) && (
          <span className="text-pdd-primary">跳过{skippedNoPay + skippedNoApply}条无时间记录</span>
        )}
      </div>
    </div>
  );
}

// ─── 新子组件：地域售后热力表 ──────────────────────────────
function RegionHeatTable({ data }: { data: any[] }) {
  const [sortKey, setSortKey] = useState<string>('afterSaleCount');
  const [sortDir, setSortDir] = useState<number>(-1);
  if (!data.length) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><MapPin size={13} color="#e02e24" />地域×售后交叉分析</h3><div className="text-xs text-pdd-gray-400 text-center h-[200px] flex items-center justify-center">暂无地域售后数据</div></div>;

  const sorted = [...data].sort((a, b) => {
    const va = a[sortKey] ?? 0;
    const vb = b[sortKey] ?? 0;
    return (va - vb) * sortDir;
  });

  const handleSort = (key: string) => {
    if (sortKey === key) { setSortDir(-sortDir); } else { setSortKey(key); setSortDir(-1); }
  };

  const cols = [
    { key: 'province', label: '省份', cls: 'text-left' },
    { key: 'orderCount', label: '订单数', cls: 'text-right' },
    { key: 'afterSaleCount', label: '售后数', cls: 'text-right' },
    { key: 'afterSaleRate', label: '售后率', cls: 'text-right' },
    { key: 'refundAmount', label: '退款金额', cls: 'text-right' },
  ];

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><MapPin size={13} color="#e02e24" />地域×售后交叉分析</h3>
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        <table className="w-full" style={{ fontSize: '10px' }}>
          <thead>
            <tr className="text-pdd-gray-400 border-b border-pdd-gray-100">
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} className={`py-1.5 ${c.cls} font-medium cursor-pointer hover:text-pdd-text transition-colors`}>
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th className="py-1.5 text-left font-medium">标记</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pdd-gray-50">
            {sorted.map((r, i) => (
              <tr key={i} className={`hover:bg-pdd-gray-50 ${r.isAnomaly ? 'bg-red-50/50' : ''}`}>
                <td className="py-1.5 text-pdd-gray-700">{r.province}</td>
                <td className="py-1.5 text-right font-mono text-pdd-gray-700">{r.orderCount}</td>
                <td className="py-1.5 text-right font-mono text-pdd-gray-700">{r.afterSaleCount}</td>
                <td className={`py-1.5 text-right font-mono font-semibold ${r.isAnomaly ? 'text-red-500' : 'text-pdd-gray-600'}`}>{r.afterSaleRate.toFixed(1)}%</td>
                <td className="py-1.5 text-right font-mono text-pdd-gray-600">{fmtMoney(r.refundAmount)}</td>
                <td className="py-1.5 text-left">
                  {r.lowSample ? <span className="text-pdd-gray-300 text-xs">样本不足</span> :
                   r.isAnomaly ? <span className="text-red-500 text-xs flex items-center gap-0.5"><AlertTriangle size={10} />异常</span> :
                   <span className="text-green-500 text-xs">正常</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── 新子组件：健康度仪表盘（嵌入对比 + 可展开维度）───────
function HealthScoreGauge({ score, allProductStats, comparisonMode }: {
  score: { score: number; rating: string; dims: any[] } | null;
  allProductStats: Record<string, ProductStat>; comparisonMode: string;
}) {
  const [expandedDim, setExpandedDim] = useState<string | null>(null);

  // 计算全店均值分数供对比
  const storeAvgScores = useMemo(() => {
    if (comparisonMode === 'none' || !score) return null;
    const all = Object.values(allProductStats);
    if (all.length < 2) return null;
    const percentile = (arr: number[], val: number) => {
      if (arr.length === 0) return 50;
      const sorted = [...arr].sort((a, b) => a - b);
      const pos = sorted.findIndex(v => v >= val);
      return pos === -1 ? 100 : (pos / sorted.length) * 100;
    };
    // 每个维度的全店平均分 = 50（因为百分位均值就是50）
    return { sales: 50, profit: 50, quality: 50, ops: 50, growth: 50 };
  }, [allProductStats, comparisonMode]);

  if (!score) return <div className="p-4 text-xs text-pdd-gray-400 text-center">暂无健康度数据</div>;
  const getColor = (s: number) => {
    if (s >= 80) return '#16a34a';
    if (s >= 60) return '#22c55e';
    if (s >= 40) return '#f97316';
    return 'var(--pdd-primary)';
  };
  const color = getColor(score.score);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score.score / 100) * circumference;

  const dimDetails: Record<string, string> = {
    '销售力': 'GMV 在全店商品中的百分位排名。GMV 越高排名越靠前。权重 35%，是健康分最核心的维度。',
    '盈利力': 'CM3 利润率（即推广后净利润 ÷ GMV）在全店中的百分位排名。权重 30%。',
    '品质力': '退款率反向排序的百分位排名。退款率越低分越高。权重 20%。',
    '运营力': '库存周转天数反向排序的百分位排名。周转越快分越高。权重 10%。',
    '增长力': '近7天销量环比变化率的百分位排名。增长越快分越高。权重 5%。',
  };

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5">
        <Gauge size={13} color={color} />五维健康度评分
        {storeAvgScores && <span className="text-pdd-gray-400 font-normal ml-1">· 参考线=全店中位</span>}
      </h3>
      <div className="flex items-start gap-6">
        {/* 大圆圈 */}
        <div className="shrink-0 flex flex-col items-center">
          <svg width="160" height="160" viewBox="0 0 160 160">
            <circle cx="80" cy="80" r={radius} fill="none" stroke="var(--pdd-border)" strokeWidth="10" />
            <circle cx="80" cy="80" r={radius} fill="none" stroke={color} strokeWidth="10" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 80 80)" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
            <text x="80" y="65" textAnchor="middle" dominantBaseline="central" fontSize="32" fontWeight="bold" fill={color} fontFamily="monospace">{score.score}</text>
            <text x="80" y="95" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="600" fill={color}>{score.rating}</text>
            {storeAvgScores && (
              <text x="80" y="112" textAnchor="middle" dominantBaseline="central" fontSize="9" fill="var(--pdd-text-secondary)">全店均分 ~50</text>
            )}
          </svg>
        </div>
        {/* 5维进度条（可点击展开） */}
        <div className="flex-1 space-y-2.5">
          {score.dims.map(dim => {
            const isExpanded = expandedDim === dim.name;
            const storeAvg = storeAvgScores ? (storeAvgScores as any)[dim.name] ?? 50 : null;
            return (
            <div key={dim.name}>
              <div className="flex items-center justify-between text-xs mb-0.5 cursor-pointer hover:opacity-80" onClick={() => setExpandedDim(isExpanded ? null : dim.name)}>
                <span className="flex items-center gap-1 text-pdd-gray-600">
                  {isExpanded ? <ChevronDown size={10} className="text-pdd-gray-400" /> : <ChevronRight size={10} className="text-pdd-gray-400" />}
                  <span style={{ color: dim.color }}>{dim.icon}</span>{dim.name}
                </span>
                <span className="text-pdd-gray-400">{dim.weight}% 权重 | <span className="font-mono font-semibold" style={{ color: getColor(dim.score) }}>{dim.score.toFixed(0)}分</span></span>
              </div>
              <div className="h-3 bg-pdd-gray-100 rounded-full overflow-hidden relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${dim.score}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: getColor(dim.score) }} />
                {/* 全店中位参考线 */}
                {storeAvg != null && (
                  <div className="absolute top-0 bottom-0 w-0.5 bg-pdd-gray-400" style={{ left: `${storeAvg}%` }} title="全店中位数" />
                )}
              </div>
              {storeAvg != null && (
                <div className="flex justify-between text-pdd-gray-400 mt-0.5" style={{ fontSize: '8px' }}>
                  <span />
                  <span>vs 中位{dim.score > storeAvg ? ' ↑' + (dim.score - storeAvg).toFixed(0) : dim.score < storeAvg ? ' ↓' + (storeAvg - dim.score).toFixed(0) : ' 持平'}</span>
                </div>
              )}
              {/* 展开：维度详情 */}
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-1.5 p-2 bg-pdd-gray-50 rounded-lg text-xs text-pdd-gray-600 leading-relaxed">
                  {dimDetails[dim.name] || '暂无详细说明'}
                </motion.div>
              )}
            </div>
          )})}
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
  const [comparisonMode, setComparisonMode] = useState<'storeAvg' | 'topProduct' | 'prevPeriod' | 'none'>('storeAvg');
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);

  // 获取全局数据
  const { currentDisplayData, productCosts } = useData();
  const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
  const insuranceRecords = currentDisplayData?.shippingInsurance || [];
  const allOrders = currentDisplayData?.orders || [];

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

  // ─── 增强计算 #1：SKU 深度矩阵 ─────────────────────────────
  const skuDeepMatrix = useMemo(() => {
    if (!selectedId) return [];
    const skuFields = ['商家编码-SKU维度', '规格编码', 'SKU编码', 'sku_code'];
    const specFields = ['商品规格', '规格', '商品属性', 'spec'];

    // 按SKU分组商品订单
    const skuMap: Record<string, { skuId: string; spec: string; sales: number; revenue: number; gmv: number; orderCount: number; orderNos: Set<string> }> = {};
    productOrders.forEach(o => {
      const skuId = findField(o, ...skuFields) || '默认规格';
      const spec = findField(o, ...specFields) || '';
      const key = `${skuId}|${spec}`;
      if (!skuMap[key]) skuMap[key] = { skuId, spec, sales: 0, revenue: 0, gmv: 0, orderCount: 0, orderNos: new Set() };
      skuMap[key].sales += Number(o['商品数量'] || o['交易数量'] || 1) || 1;
      skuMap[key].revenue += Number(o['商家实收金额(元)'] || o['成交金额'] || o['支付金额'] || 0) || 0;
      skuMap[key].gmv += Number(o['订单金额'] || o['商品原价金额'] || o['支付金额'] || 0) || 0;
      skuMap[key].orderCount++;
      const orderNo = o['订单编号'] || o['订单号'] || '';
      if (orderNo) skuMap[key].orderNos.add(String(orderNo));
    });

    // 从售后记录中统计每个SKU的退款
    const orderNoToSkuKey: Record<string, string> = {};
    productOrders.forEach(o => {
      const orderNo = String(o['订单编号'] || o['订单号'] || '');
      if (!orderNo) return;
      const skuId = findField(o, ...skuFields) || '默认规格';
      const spec = findField(o, ...specFields) || '';
      orderNoToSkuKey[orderNo] = `${skuId}|${spec}`;
    });

    const skuRefundMap: Record<string, { refundCount: number; refundAmount: number; refundDays: number[]; reasons: Record<string, number> }> = {};
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const productAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId);
    productAfterSales.forEach(r => {
      const orderNo = String(r['订单编号'] || r['订单号'] || '');
      const skuInfo = r['商品规格'] || r['sku信息'] || '';
      let matchedKey: string | null = null;
      if (orderNo && orderNoToSkuKey[orderNo]) {
        matchedKey = orderNoToSkuKey[orderNo];
      } else {
        for (const key of Object.keys(skuMap)) {
          if (skuInfo && key.includes(skuInfo)) { matchedKey = key; break; }
        }
      }
      if (!matchedKey) matchedKey = '默认规格|';
      if (!skuRefundMap[matchedKey]) skuRefundMap[matchedKey] = { refundCount: 0, refundAmount: 0, refundDays: [], reasons: {} };
      skuRefundMap[matchedKey].refundCount++;
      const refundAmt = Number(r['退款金额'] || r['售后金额'] || r['退款金额(元)'] || 0) || 0;
      skuRefundMap[matchedKey].refundAmount += refundAmt;
      const reason = findField(r, ...reasonFields) || '未分类';
      skuRefundMap[matchedKey].reasons[reason] = (skuRefundMap[matchedKey].reasons[reason] || 0) + 1;
      // 退款天数计算
      const applyDate = new Date(r['申请时间'] || r['售后创建时间'] || r['退款申请时间'] || '');
      const payDateStr = productOrders.find(o => String(o['订单编号'] || o['订单号'] || '') === orderNo)?.['支付时间'] || '';
      if (applyDate.getTime() > 0 && payDateStr) {
        const payDate = new Date(payDateStr);
        if (payDate.getTime() > 0) skuRefundMap[matchedKey].refundDays.push(Math.round((applyDate.getTime() - payDate.getTime()) / 86400000));
      }
    });

    // 组装输出
    const totalSales = Object.values(skuMap).reduce((s, v) => s + v.sales, 0);
    const meanRefundRate = Object.values(skuRefundMap).reduce((s, v) => s + (v.refundCount / Math.max(Object.values(skuMap).find(m => Object.keys(skuRefundMap).length > 0) ? 1 : 1)), 0) / Math.max(Object.keys(skuMap).length, 1);

    return Object.entries(skuMap).map(([key, info]) => {
      const refund = skuRefundMap[key] || { refundCount: 0, refundAmount: 0, refundDays: [] as number[], reasons: {} as Record<string, number> };
      const refundRate = info.orderCount > 0 ? (refund.refundCount / info.orderCount) * 100 : 0;
      const avgRefundDays = refund.refundDays.length > 0 ? refund.refundDays.reduce((a, b) => a + b, 0) / refund.refundDays.length : 0;
      const topRefundReason = Object.entries(refund.reasons || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      // SKU成本：productId_skuId 优先，productId 兜底
      const skuKey = `${selectedId}_${info.skuId}`;
      const skuCost = productCosts?.[skuKey] ?? productCosts?.[selectedId];
      const profitRate = info.revenue > 0 && skuCost != null ? ((info.revenue - skuCost * info.sales - refund.refundAmount) / info.revenue) * 100 : undefined;
      return {
        skuId: info.skuId,
        spec: info.spec,
        sales: info.sales,
        revenue: info.revenue,
        gmv: info.gmv,
        avgPrice: info.sales > 0 ? info.revenue / info.sales : 0,
        salesRatio: totalSales > 0 ? (info.sales / totalSales) * 100 : 0,
        refundRate,
        refundAmount: refund.refundAmount,
        avgRefundDays,
        topRefundReason,
        profitRate,
        orderCount: info.orderCount,
        isHighRefund: refundRate > meanRefundRate * 2,
        isMainSku: totalSales > 0 && (info.sales / totalSales) > 0.5,
      };
    }).sort((a, b) => b.sales - a.sales).slice(0, 15);
  }, [selectedId, productOrders, afterSaleRecords, productCosts]);

  // ─── 增强计算 #2：退款原因 TOP10 ────────────────────────────
  const refundReasonAnalysis = useMemo(() => {
    if (!selectedId) return [];
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const productAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId);
    const reasonMap: Record<string, { count: number; amount: number }> = {};
    let skipped = 0;
    productAfterSales.forEach(r => {
      const reason = findField(r, ...reasonFields) || '未分类';
      if (!reason || reason === '未分类') skipped++;
      if (!reasonMap[reason]) reasonMap[reason] = { count: 0, amount: 0 };
      reasonMap[reason].count++;
      reasonMap[reason].amount += Number(r['退款金额'] || r['售后金额'] || r['退款金额(元)'] || 0) || 0;
    });
    const total = Object.values(reasonMap).reduce((s, v) => s + v.count, 0);
    return Object.entries(reasonMap)
      .map(([reason, data]) => ({ reason, count: data.count, amount: data.amount, ratio: total > 0 ? (data.count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [selectedId, afterSaleRecords]);

  // ─── 增强计算 #3：退款时间窗口 ──────────────────────────────
  const refundTimeWindow = useMemo(() => {
    if (!selectedId) return { windows: [], skippedNoPay: 0, skippedNoApply: 0 };
    // 构建orderNo→支付时间 Map
    const orderPayMap: Record<string, string> = {};
    allOrders.forEach(o => {
      const orderNo = String(o['订单编号'] || o['订单号'] || '');
      const payTime = o['支付时间'] || o['订单支付时间'] || o['付款时间'] || '';
      if (orderNo && payTime) orderPayMap[orderNo] = payTime;
    });

    const buckets = [
      { label: '0-7天', min: 0, max: 7, count: 0, amount: 0, onlyRefund: 0, returnRefund: 0 },
      { label: '8-30天', min: 8, max: 30, count: 0, amount: 0, onlyRefund: 0, returnRefund: 0 },
      { label: '31-90天', min: 31, max: 90, count: 0, amount: 0, onlyRefund: 0, returnRefund: 0 },
      { label: '91-180天', min: 91, max: 180, count: 0, amount: 0, onlyRefund: 0, returnRefund: 0 },
      { label: '180天+', min: 181, max: Infinity, count: 0, amount: 0, onlyRefund: 0, returnRefund: 0 },
    ];

    let skippedNoPay = 0;
    let skippedNoApply = 0;
    const productAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId);

    productAfterSales.forEach(r => {
      const applyTime = r['申请时间'] || r['售后创建时间'] || r['退款申请时间'] || '';
      if (!applyTime) { skippedNoApply++; return; }
      const orderNo = String(r['订单编号'] || r['订单号'] || '');
      const payTime = orderPayMap[orderNo];
      if (!payTime) { skippedNoPay++; return; }

      const applyDate = new Date(applyTime);
      const payDate = new Date(payTime);
      if (applyDate.getTime() <= 0 || payDate.getTime() <= 0) { skippedNoPay++; return; }

      const diffDays = Math.round((applyDate.getTime() - payDate.getTime()) / 86400000);
      const refundType = String(r['售后类型'] || r['退款类型'] || '');
      const isOnlyRefund = refundType.includes('仅退款') || refundType.includes('退款');
      const isReturnRefund = refundType.includes('退货退款') || refundType.includes('退货');

      for (const bucket of buckets) {
        if (diffDays >= bucket.min && diffDays <= bucket.max) {
          bucket.count++;
          bucket.amount += Number(r['退款金额'] || r['售后金额'] || r['退款金额(元)'] || 0) || 0;
          if (isReturnRefund) bucket.returnRefund++;
          else bucket.onlyRefund++;
          break;
        }
      }
    });

    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    buckets.forEach(b => { (b as any).ratio = totalCount > 0 ? (b.count / totalCount) * 100 : 0; });

    return { windows: buckets, skippedNoPay, skippedNoApply };
  }, [selectedId, allOrders, afterSaleRecords]);

  // ─── 增强计算 #4：地域×售后交叉分析 ─────────────────────────
  const regionAfterSaleAnalysis = useMemo(() => {
    if (!selectedId) return [];
    const provinceFields = ['收货省', '省份', '收货地址省', '省'];
    // 按省统计订单
    const orderNoToProvince: Record<string, string> = {};
    const provinceOrders: Record<string, number> = {};
    allOrders.forEach(o => {
      const prov = findField(o, ...provinceFields);
      if (!prov) return;
      provinceOrders[prov] = (provinceOrders[prov] || 0) + 1;
      const orderNo = String(o['订单编号'] || o['订单号'] || '');
      if (orderNo) orderNoToProvince[orderNo] = prov;
    });

    // 按省统计售后
    const provinceAfterSales: Record<string, { count: number; amount: number }> = {};
    const productAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId);
    productAfterSales.forEach(r => {
      const orderNo = String(r['订单编号'] || r['订单号'] || '');
      const prov = orderNoToProvince[orderNo];
      if (!prov) return;
      if (!provinceAfterSales[prov]) provinceAfterSales[prov] = { count: 0, amount: 0 };
      provinceAfterSales[prov].count++;
      provinceAfterSales[prov].amount += Number(r['退款金额'] || r['售后金额'] || r['退款金额(元)'] || 0) || 0;
    });

    // 计算每省售后率
    const allRates: number[] = [];
    const result = Object.entries(provinceOrders).map(([prov, orderCount]) => {
      const as = provinceAfterSales[prov] || { count: 0, amount: 0 };
      const afterSaleRate = orderCount > 0 ? (as.count / orderCount) * 100 : 0;
      if (orderCount >= 5) allRates.push(afterSaleRate);
      return { province: prov, orderCount, afterSaleCount: as.count, afterSaleRate, refundAmount: as.amount, lowSample: orderCount < 5 };
    });

    // 异常检测：均值±2σ
    const mean = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;
    const variance = allRates.length > 0 ? allRates.reduce((s, r) => s + (r - mean) ** 2, 0) / allRates.length : 0;
    const stdDev = Math.sqrt(variance);

    return result.map(r => ({
      ...r,
      isAnomaly: !r.lowSample && r.afterSaleRate > mean + 2 * stdDev && stdDev > 0,
    })).sort((a, b) => b.afterSaleCount - a.afterSaleCount);
  }, [selectedId, allOrders, afterSaleRecords]);

  // ─── 增强计算 #5：CM1/CM2/CM3 贡献度分层 ──────────────────
  const cmLayers = useMemo(() => {
    if (!selectedStats) return null;
    const cb = selectedStats.costBreakdown || {} as CostBreakdown;
    const gmv = selectedStats.gmv || 1;
    const cm1 = (selectedStats.revenue || 0) - (cb.productCost || 0) - (selectedStats.discount || 0) - (selectedStats.refund || 0);
    const cm2 = cm1 - (cb.platformFee || 0) - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0));
    const cm3 = cm2 - (selectedStats.promoCost || 0);
    return {
      cm1: { name: 'CM1 产品力', value: cm1, pct: (cm1 / gmv) * 100, positive: cm1 >= 0, desc: '实收 - 成本 - 折扣 - 退款' },
      cm2: { name: 'CM2 履约力', value: cm2, pct: (cm2 / gmv) * 100, positive: cm2 >= 0, desc: 'CM1 - 佣金 - 运费险 - 包装快递' },
      cm3: { name: 'CM3 增长效率', value: cm3, pct: (cm3 / gmv) * 100, positive: cm3 >= 0, desc: 'CM2 - 推广花费' },
    };
  }, [selectedStats]);

  // ─── 增强计算 #6：五维健康度评分 ────────────────────────────
  const healthScore = useMemo(() => {
    if (!selectedStats) return null;
    const all = Object.values(productStats);
    if (all.length < 2) return { score: 50, rating: '数据不足', dims: [] as any[] };

    const percentile = (arr: number[], val: number) => {
      if (arr.length === 0) return 50;
      const sorted = [...arr].sort((a, b) => a - b);
      const pos = sorted.findIndex(v => v >= val);
      return pos === -1 ? 100 : (pos / sorted.length) * 100;
    };

    // 销售力 35%: GMV百分位
    const gmvVals = all.map(s => s.gmv);
    const salesScore = percentile(gmvVals, selectedStats.gmv);

    // 盈利力 30%: CM3利润率百分位
    const profitRateVals = all.map(s => {
      const cb = s.costBreakdown || {} as CostBreakdown;
      const cm3 = (s.revenue || 0) - (cb.productCost || 0) - (s.discount || 0) - (s.refund || 0) - (cb.platformFee || 0) - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0)) - (s.promoCost || 0);
      return s.gmv > 0 ? (cm3 / s.gmv) * 100 : 0;
    });
    const cb = selectedStats.costBreakdown || {} as CostBreakdown;
    const cm3Val = (selectedStats.revenue || 0) - (cb.productCost || 0) - (selectedStats.discount || 0) - (selectedStats.refund || 0) - (cb.platformFee || 0) - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0)) - (selectedStats.promoCost || 0);
    const cm3Rate = selectedStats.gmv > 0 ? (cm3Val / selectedStats.gmv) * 100 : 0;
    const profitScore = percentile(profitRateVals, cm3Rate);

    // 品质力 20%: 退款率(反向)百分位
    const refundVals = all.map(s => s.refundRate);
    const refundScore = 100 - percentile(refundVals, selectedStats.refundRate);

    // 运营力 10%: 库存周转(反向)百分位
    const turnoverVals = all.map(s => s.turnoverDays || 999);
    const turnoverScore = 100 - percentile(turnoverVals, selectedStats.turnoverDays || 999);

    // 增长力 5%: 近7天销量变化百分位
    const growthVals = all.map(s => {
      const recent = s.dailySales?.slice(-7)?.reduce((sum, d) => sum + d.sales, 0) ?? 0;
      const earlier = s.dailySales?.slice(-14, -7)?.reduce((sum, d) => sum + d.sales, 0) ?? 0;
      return earlier > 0 ? ((recent - earlier) / earlier) * 100 : 0;
    });
    const recentSales = selectedStats.dailySales?.slice(-7)?.reduce((sum, d) => sum + d.sales, 0) ?? 0;
    const earlierSales = selectedStats.dailySales?.slice(-14, -7)?.reduce((sum, d) => sum + d.sales, 0) ?? 0;
    const growthVal = earlierSales > 0 ? ((recentSales - earlierSales) / earlierSales) * 100 : 0;
    const growthScore = percentile(growthVals, growthVal);

    const dims = [
      { name: '销售力', weight: 35, score: salesScore, icon: <ShoppingCart size={12} />, color: '#e02e24' },
      { name: '盈利力', weight: 30, score: profitScore, icon: <DollarSign size={12} />, color: '#16a34a' },
      { name: '品质力', weight: 20, score: refundScore, icon: <Shield size={12} />, color: '#f97316' },
      { name: '运营力', weight: 10, score: turnoverScore, icon: <Clock size={12} />, color: '#0891b2' },
      { name: '增长力', weight: 5, score: growthScore, icon: <TrendingUp size={12} />, color: '#7c3aed' },
    ];

    const totalScore = dims.reduce((s, d) => s + d.score * (d.weight / 100), 0);
    let rating: string;
    if (totalScore >= 80) rating = '优秀';
    else if (totalScore >= 60) rating = '良好';
    else if (totalScore >= 40) rating = '一般';
    else rating = '预警';

    return { score: Math.round(totalScore), rating, dims };
  }, [selectedStats, productStats]);

  // ─── 增强计算 #2b：全店退款原因TOP10（用于对比）────────────
  const storeRefundReasonAnalysis = useMemo(() => {
    if (!selectedId || comparisonMode === 'none') return [];
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const otherAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') !== selectedId);
    const reasonMap: Record<string, { count: number; amount: number }> = {};
    otherAfterSales.forEach(r => {
      const reason = findField(r, ...reasonFields) || '未分类';
      if (!reasonMap[reason]) reasonMap[reason] = { count: 0, amount: 0 };
      reasonMap[reason].count++;
      reasonMap[reason].amount += Number(r['退款金额'] || r['售后金额'] || r['退款金额(元)'] || 0) || 0;
    });
    const total = Object.values(reasonMap).reduce((s, v) => s + v.count, 0);
    return Object.entries(reasonMap)
      .map(([reason, data]) => ({ reason, count: data.count, amount: data.amount, ratio: total > 0 ? (data.count / total) * 100 : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [selectedId, afterSaleRecords, comparisonMode]);

  // ─── 增强计算 #7：退款日趋势（替代假数据）──────────────────
  const refundDailyTrend = useMemo(() => {
    if (!selectedId) return { trend: [], spikeDays: [] as string[] };
    const productAfterSales = afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId);

    // 售后按日期分组
    const dailyRefund: Record<string, { count: number; amount: number }> = {};
    productAfterSales.forEach(r => {
      const dateStr = (r['申请时间'] || r['售后创建时间'] || '').toString().slice(0, 10);
      if (!dateStr) return;
      if (!dailyRefund[dateStr]) dailyRefund[dateStr] = { count: 0, amount: 0 };
      dailyRefund[dateStr].count++;
      dailyRefund[dateStr].amount += Number(r['退款金额'] || r['售后金额'] || 0) || 0;
    });

    // 订单按日期分组
    const dailyOrder: Record<string, number> = {};
    productOrders.forEach(o => {
      const dateStr = String(o['订单支付时间'] || o['支付时间'] || o['订单创建时间'] || '').slice(0, 10);
      if (!dateStr) return;
      dailyOrder[dateStr] = (dailyOrder[dateStr] || 0) + 1;
    });

    // 合并所有日期
    const allDates = new Set([...Object.keys(dailyRefund), ...Object.keys(dailyOrder)]);
    const sortedDates = Array.from(allDates).sort();
    if (sortedDates.length === 0) return { trend: [], spikeDays: [] };

    const trend = sortedDates.map(date => {
      const refundCount = dailyRefund[date]?.count || 0;
      const refundAmount = dailyRefund[date]?.amount || 0;
      const orderCount = dailyOrder[date] || 0;
      const rate = orderCount > 0 ? (refundCount / orderCount) * 100 : 0;
      return { date, refundCount, refundAmount, orderCount, rate };
    });

    // 7日移动平均
    const withMA = trend.map((d, i) => {
      let ma7 = 0;
      let count = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        ma7 += trend[j].rate;
        count++;
      }
      return { ...d, ma7Rate: count > 0 ? ma7 / count : 0 };
    });

    // 检测突增：当日 > 前14日均值 × 2
    const spikeDays: string[] = [];
    withMA.forEach((d, i) => {
      if (i < 14) return;
      const prev14Avg = withMA.slice(i - 14, i).reduce((s, x) => s + x.rate, 0) / 14;
      if (prev14Avg > 0 && d.rate > prev14Avg * 2) spikeDays.push(d.date);
    });

    return { trend: withMA, spikeDays };
  }, [selectedId, afterSaleRecords, productOrders]);

  // ─── 增强计算 #8：增强诊断（在 generateDiagnoses 基础上增加4条）──
  const enhancedDiagnoses = useMemo(() => {
    if (!selectedStats) return [];
    const base = generateDiagnoses(selectedStats, prevStats);

    const extras: DiagnosisItem[] = [];

    // 9. SKU集中风险
    const topSku = skuDeepMatrix[0];
    if (topSku && topSku.salesRatio > 80) {
      extras.push({ priority: 'important', title: 'SKU集中度过高', description: `TOP1 SKU"${topSku.skuId}"占销量${topSku.salesRatio.toFixed(0)}%，过分依赖单一SKU，建议丰富规格分散风险。`, icon: <Layers size={14} />, color: '#f97316', bg: '#fff7ed' });
    }

    // 10. 快速退款预警
    if (refundTimeWindow.windows.length > 0) {
      const win07 = refundTimeWindow.windows.find(w => w.label === '0-7天');
      const total = refundTimeWindow.windows.reduce((s, w) => s + w.count, 0);
      if (win07 && total > 0 && (win07.count / total) > 0.5) {
        extras.push({ priority: 'urgent', title: '快速退款占比偏高', description: `0-7天内退款占比${((win07.count / total) * 100).toFixed(0)}%，可能存在商品质量问题或描述不符，建议检查详情页准确性和商品品质。`, icon: <Clock size={14} />, color: '#e02e24', bg: '#fef2f2' });
      }
    }

    // 11. 折扣依赖预警
    if (selectedStats.discountRatio > 30) {
      extras.push({ priority: 'important', title: '折扣依赖度偏高', description: `折扣/优惠占GMV的${fmtPct(selectedStats.discountRatio)}，长期可能损害品牌价格认知，建议逐步降低折扣力度。`, icon: <Percent size={14} />, color: '#f97316', bg: '#fff7ed' });
    }

    // 12. 地域售后异常
    const anomalyProvinces = regionAfterSaleAnalysis.filter(r => r.isAnomaly);
    if (anomalyProvinces.length > 0) {
      extras.push({ priority: 'important', title: '地域售后异常', description: `${anomalyProvinces.map(r => r.province).join('、')}售后率显著高于均值，建议检查物流时效、区域包装适配等问题。`, icon: <MapPin size={14} />, color: '#f97316', bg: '#fff7ed' });
    }

    // 排序并去重
    const all = [...base, ...extras];
    const order = { urgent: 0, important: 1, reference: 2 };
    all.sort((a, b) => order[a.priority] - order[b.priority]);
    return all.slice(0, 7);
  }, [selectedStats, prevStats, skuDeepMatrix, refundTimeWindow, regionAfterSaleAnalysis]);

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

  // ═══════════════════════════════════════════════════════════
  // 对比基准：全店均值 / 中位数 / TOP20% 均值
  // ═══════════════════════════════════════════════════════════
  const storeBenchmark = useMemo(() => {
    const all = Object.values(productStats);
    if (all.length < 2) return null;
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const median = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
    const top20Avg = (arr: number[], lowIsGood?: boolean) => { const s = [...arr].sort((a, b) => lowIsGood ? a - b : b - a); const n = Math.max(1, Math.floor(s.length * 0.2)); return s.slice(0, n).reduce((a, b) => a + b, 0) / n; };

    const gmvVals = all.map(s => s.gmv);
    const refundRateVals = all.map(s => s.refundRate);
    const profitRateVals = all.map(s => s.profitRate);
    const roiVals = all.map(s => s.roi).filter(v => v > 0);
    const turnoverVals = all.map(s => s.turnoverDays || 0);
    const avgOrderVals = all.map(s => s.avgOrderValue || 0);
    const ctrVals = all.map(s => s.ctr).filter(v => v > 0);
    const cvrVals = all.map(s => s.cvr).filter(v => v > 0);

    return {
      gmv: { avg: avg(gmvVals), median: median(gmvVals), top20: top20Avg(gmvVals), total: all.length },
      refundRate: { avg: avg(refundRateVals), median: median(refundRateVals), top20: top20Avg(refundRateVals, true), lowIsGood: true },
      profitRate: { avg: avg(profitRateVals), median: median(profitRateVals), top20: top20Avg(profitRateVals) },
      roi: { avg: roiVals.length > 0 ? avg(roiVals) : 0, median: roiVals.length > 0 ? median(roiVals) : 0, top20: roiVals.length > 0 ? top20Avg(roiVals) : 0 },
      turnoverDays: { avg: avg(turnoverVals), median: median(turnoverVals), top20: top20Avg(turnoverVals, true), lowIsGood: true },
      avgOrderValue: { avg: avg(avgOrderVals), median: median(avgOrderVals), top20: top20Avg(avgOrderVals) },
      ctr: { avg: avg(ctrVals), median: median(ctrVals), top20: top20Avg(ctrVals) },
      cvr: { avg: avg(cvrVals), median: median(cvrVals), top20: top20Avg(cvrVals) },
    };
  }, [productStats]);

  // 获取对比基准值（根据对比模式返回不同基准）
  const getBenchmark = useCallback((metric: keyof typeof storeBenchmark extends never ? string : string, currentValue: number) => {
    if (comparisonMode === 'none' || !storeBenchmark) return null;
    const bm = storeBenchmark as any;
    const entry = bm[metric];
    if (!entry) return null;
    if (comparisonMode === 'storeAvg') return { label: '店铺均值', value: entry.avg, lowIsGood: entry.lowIsGood };
    if (comparisonMode === 'topProduct') return { label: 'TOP20%', value: entry.top20, lowIsGood: entry.lowIsGood };
    return { label: '中位数', value: entry.median, lowIsGood: entry.lowIsGood };
  }, [comparisonMode, storeBenchmark]);

  const diagnoses = enhancedDiagnoses;

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
                  {/* 对比模式选择器 */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-pdd-gray-400 shrink-0">对比：</span>
                    <div className="flex items-center gap-1 bg-pdd-gray-100 rounded-lg p-0.5">
                      {([
                        { key: 'storeAvg' as const, label: '店铺均值' },
                        { key: 'topProduct' as const, label: 'TOP商品' },
                        { key: 'prevPeriod' as const, label: '上周期', disabled: !prevStats },
                        { key: 'none' as const, label: '独立查看' },
                      ]).map(m => (
                        <button key={m.key} onClick={() => !m.disabled && setComparisonMode(m.key)}
                          disabled={m.disabled}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                            comparisonMode === m.key ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-gray-400 hover:text-pdd-gray-600'
                          } ${m.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                    {!storeBenchmark && <span className="text-xs text-pdd-gray-400">（需 2+ 商品方可用对比模式）</span>}
                  </div>

                  {/* A. KPI 卡片行 */}
                  <KpiCardRow stats={selectedStats} prevStats={prevStats} benchmark={storeBenchmark} getBenchmark={getBenchmark} comparisonMode={comparisonMode} healthScore={healthScore} cm3={cmLayers?.cm3?.value ?? 0} allProductStats={productStats} />

                  {/* B. 转化漏斗 + 销售趋势 */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-5 pdd-card rounded-xl border border-pdd-gray-200">
                      <ConversionFunnel stats={selectedStats} orders={productOrders} allProductStats={productStats} comparisonMode={comparisonMode} />
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
                    <ProfitWaterfall stats={selectedStats} allProductStats={productStats} comparisonMode={comparisonMode} />
                  </div>

                  {/* N1. CM1/CM2/CM3 层级联 */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200">
                    <CmLayerCascade layers={cmLayers} allProductStats={productStats} comparisonMode={comparisonMode} />
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

                  {/* N2. SKU 深度矩阵（全宽，替换旧SKU排行） */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200">
                    <SkuDeepTable matrix={skuDeepMatrix} />
                  </div>

                  {/* N3. 退款原因 TOP10 + 退款时间窗口 */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="pdd-card rounded-xl border border-pdd-gray-200">
                      <RefundReasonBarChart data={refundReasonAnalysis} storeData={storeRefundReasonAnalysis} />
                    </div>
                    <div className="pdd-card rounded-xl border border-pdd-gray-200">
                      <TimeWindowStackedBar
                        data={refundTimeWindow.windows}
                        skippedNoPay={refundTimeWindow.skippedNoPay}
                        skippedNoApply={refundTimeWindow.skippedNoApply}
                      />
                    </div>
                  </div>

                  {/* G+. 退款日趋势（替代假数据）+ 价格分布 */}
                  <div className="grid grid-cols-12 gap-4">
                    <div className="col-span-7 pdd-card rounded-xl border border-pdd-gray-200 p-4">
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><Activity size={13} color="#f97316" />退款日趋势</h3>
                      {refundDailyTrend.trend.length > 0 ? (
                        <ResponsiveContainer width="100%" height={200}>
                          <ComposedChart data={refundDailyTrend.trend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                            <XAxis dataKey="date" tick={{ fontSize: 8, fill: 'var(--pdd-text-secondary)' }} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} />
                            <Tooltip />
                            <Bar dataKey="refundCount" fill="var(--pdd-primary-light)" opacity={0.5} name="退款笔数" />
                            <Line type="monotone" dataKey="ma7Rate" stroke="var(--pdd-primary)" strokeWidth={2} dot={false} name="7日均退款率" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : <div className="h-[200px] flex items-center justify-center text-xs text-pdd-gray-400">暂无退款日趋势数据</div>}
                      {refundDailyTrend.spikeDays.length > 0 && (
                        <div className="mt-2 text-xs text-pdd-primary flex items-center gap-1">
                          <AlertTriangle size={10} />
                          检测到退款异常突增日期：{refundDailyTrend.spikeDays.slice(0, 3).join('、')}
                        </div>
                      )}
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

                  {/* N4. 地域×售后交叉热力表（全宽，替换旧地域TOP5） */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200">
                    <RegionHeatTable data={regionAfterSaleAnalysis} />
                  </div>

                  {/* H+. 关联商品 + 售后质量指标 */}
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
                      <h3 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1.5"><AlertTriangle size={13} color="#f97316" />售后质量指标</h3>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">退款率</span><span className={`font-mono font-semibold ${selectedStats.refundRate > 10 ? 'text-red-500' : 'text-green-500'}`}>{fmtPct(selectedStats.refundRate)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">售后率</span><span className="font-mono font-semibold">{fmtPct(selectedStats.afterSaleRate)}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">售后笔数</span><span className="font-mono">{selectedStats.afterSaleCount}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">退款笔数</span><span className="font-mono">{selectedStats.refundCount || 0}</span></div>
                        <div className="flex justify-between text-xs"><span className="text-pdd-gray-500">退款趋势异常</span><span className={`font-mono font-semibold ${refundDailyTrend.spikeDays.length > 0 ? 'text-red-500' : 'text-green-500'}`}>{refundDailyTrend.spikeDays.length > 0 ? `${refundDailyTrend.spikeDays.length}天异常` : '正常'}</span></div>
                      </div>
                    </div>
                  </div>

                  {/* J. 商品分层判定 */}
                  <ProductPositioningCard stats={selectedStats} allStats={productStats} />

                  {/* N5. 健康度仪表盘 */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200">
                    <HealthScoreGauge score={healthScore} allProductStats={productStats} comparisonMode={comparisonMode} />
                  </div>

                  {/* K. 运营诊断建议（交互式） */}
                  <div className="pdd-card rounded-xl border border-pdd-gray-200 p-4" id="kpi-diagnosis">
                    <h3 className="text-xs font-semibold text-pdd-gray-600 mb-3 flex items-center gap-1.5"><Info size={13} color="#7c3aed" />运营诊断建议 · 点击展开关联数据</h3>
                    {diagnoses.length > 0 ? (
                      <div className="space-y-2">
                        {diagnoses.map((d, i) => {
                          const isExpanded = expandedDiagnosis === i;
                          return (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
                            <div onClick={() => setExpandedDiagnosis(isExpanded ? null : i)}
                              className="flex items-start gap-2.5 p-3 rounded-lg cursor-pointer hover:shadow-sm transition-shadow" style={{ backgroundColor: d.bg }}>
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
                              <div className="shrink-0 text-pdd-gray-400 mt-0.5">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </div>
                            </div>
                            {/* 展开：关联数据 */}
                            {isExpanded && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mx-3 mb-2 px-3 py-2.5 bg-white/60 rounded-b-lg border border-t-0 border-pdd-gray-100 overflow-hidden">
                                {d.title.includes('退款率偏高') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-4">
                                      <span className="text-pdd-gray-500">当前退款率：<span className="font-mono font-semibold text-red-500">{fmtPct(selectedStats.refundRate)}</span></span>
                                      <span className="text-pdd-gray-500">全店均值：<span className="font-mono">{storeBenchmark ? fmtPct(storeBenchmark.refundRate.avg) : '--'}</span></span>
                                      <span className="text-pdd-gray-500">退款金额：<span className="font-mono text-red-500">{fmtMoney(selectedStats.refund || 0)}</span></span>
                                    </div>
                                    <div className="text-pdd-gray-500">
                                      受影响SKU：
                                      {skuDeepMatrix.filter(s => s.isHighRefund).map(s => (
                                        <span key={s.skuId} className="inline-block ml-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-mono">{s.skuId}({s.refundRate.toFixed(0)}%)</span>
                                      ))}
                                      {skuDeepMatrix.filter(s => s.isHighRefund).length === 0 && <span className="text-pdd-gray-400">无异常SKU</span>}
                                    </div>
                                    <div className="text-pdd-gray-500">
                                      主退款原因：
                                      {refundReasonAnalysis.slice(0, 3).map((r, ri) => (
                                        <span key={ri} className="inline-block ml-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{r.reason}({r.ratio.toFixed(0)}%)</span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {d.title.includes('SKU集中度过高') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="text-pdd-gray-500">各SKU销量占比：</div>
                                    <div className="space-y-1">
                                      {skuDeepMatrix.slice(0, 5).map(s => (
                                        <div key={s.skuId} className="flex items-center gap-2">
                                          <span className="w-20 truncate font-mono text-pdd-gray-600">{s.skuId}</span>
                                          <div className="flex-1 h-4 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                            <div className="h-full rounded-sm bg-purple-400" style={{ width: `${Math.min(s.salesRatio, 100)}%`, opacity: 0.7 }} />
                                          </div>
                                          <span className="font-mono w-12 text-right">{s.salesRatio.toFixed(0)}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {d.title.includes('推广ROI偏低') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-4">
                                      <span className="text-pdd-gray-500">当前ROI：<span className="font-mono font-semibold text-red-500">{selectedStats.roi > 0 ? selectedStats.roi.toFixed(2) : '--'}</span></span>
                                      <span className="text-pdd-gray-500">全店均值：<span className="font-mono">{storeBenchmark ? storeBenchmark.roi.avg.toFixed(2) : '--'}</span></span>
                                      <span className="text-pdd-gray-500">推广花费：<span className="font-mono">{fmtMoney(selectedStats.promoCost || 0)}</span></span>
                                    </div>
                                    {selectedStats.promoSourceDetails && selectedStats.promoSourceDetails.length > 0 && (
                                      <div className="text-pdd-gray-500">
                                        各渠道ROI：
                                        {selectedStats.promoSourceDetails.map((src, si) => {
                                          const roi = src.cost > 0 ? src.transaction / src.cost : 0;
                                          return (
                                            <span key={si} className={`inline-block ml-1 px-1.5 py-0.5 rounded font-mono ${roi < 1 ? 'bg-red-50 text-red-600' : roi < 2 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                                              {src.source}:{roi.toFixed(1)}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>
                                )}
                                {d.title.includes('库存积压') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-4">
                                      <span className="text-pdd-gray-500">周转天数：<span className="font-mono font-semibold text-red-500">{selectedStats.turnoverDays}天</span></span>
                                      <span className="text-pdd-gray-500">全店均值：<span className="font-mono">{storeBenchmark ? storeBenchmark.turnoverDays.avg.toFixed(0) + '天' : '--'}</span></span>
                                      <span className="text-pdd-gray-500">安全线：30天</span>
                                    </div>
                                    <div className="text-pdd-gray-500">
                                      估算库存金额：<span className="font-mono text-red-500">{fmtMoney(selectedStats.sales * ((selectedStats.costBreakdown as any)?.productCost || 0))}</span>
                                    </div>
                                  </div>
                                )}
                                {d.title.includes('GMV显著下降') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="flex items-center gap-4">
                                      <span className="text-pdd-gray-500">当前GMV：<span className="font-mono font-semibold">{fmtMoney(selectedStats.gmv)}</span></span>
                                      {prevStats && <span className="text-pdd-gray-500">上周期：<span className="font-mono">{fmtMoney(prevStats.gmv)}</span></span>}
                                      {prevStats && prevStats.gmv > 0 && (
                                        <span className="font-mono text-red-500">↓ {Math.abs(((selectedStats.gmv - prevStats.gmv) / prevStats.gmv) * 100).toFixed(1)}%</span>
                                      )}
                                    </div>
                                    <div className="text-pdd-gray-500">
                                      拆解：访客{fmt(selectedStats.promoImpressions || 0)} → 点击{fmt(selectedStats.promoClicks || 0)}(CTR {fmtPct(selectedStats.ctr)}) → 成交{(selectedStats.orders || 0)}单(CVR {fmtPct(selectedStats.cvr)}) | 客单价 {fmtMoney(selectedStats.avgOrderValue || 0)}
                                    </div>
                                  </div>
                                )}
                                {d.title.includes('利润率过低') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="text-pdd-gray-500">
                                      净利润率：<span className="font-mono font-semibold text-red-500">{fmtPct(selectedStats.profitRate)}</span>
                                      <span className="ml-2">全店均值：<span className="font-mono">{storeBenchmark ? fmtPct(storeBenchmark.profitRate.avg) : '--'}</span></span>
                                    </div>
                                    <div className="text-pdd-gray-500">成本结构（从高到低）：</div>
                                    {(() => {
                                      const cb = selectedStats.costBreakdown || {} as CostBreakdown;
                                      const costItems = [
                                        { name: '商品成本', value: cb.productCost || 0 },
                                        { name: '推广花费', value: selectedStats.promoCost || 0 },
                                        { name: '平台佣金', value: cb.platformFee || 0 },
                                        { name: '运费险', value: cb.insuranceFee || 0 },
                                        { name: '包装快递', value: (cb.packagingFee || 0) + (cb.shippingFee || 0) },
                                        { name: '罚款/扣款', value: cb.penaltyFee || 0 },
                                      ].sort((a, b) => b.value - a.value);
                                      const gmv = selectedStats.gmv || 1;
                                      return costItems.filter(c => c.value > 0).slice(0, 4).map((c, ci) => (
                                        <div key={ci} className="flex items-center gap-2">
                                          <span className="w-16 text-pdd-gray-500">{c.name}</span>
                                          <div className="flex-1 h-4 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                            <div className="h-full rounded-sm bg-red-300" style={{ width: `${Math.min((c.value / gmv) * 200, 100)}%`, opacity: 0.6 }} />
                                          </div>
                                          <span className="font-mono">{fmtMoney(c.value)} ({(c.value / gmv * 100).toFixed(1)}%)</span>
                                        </div>
                                      ));
                                    })()}
                                  </div>
                                )}
                                {d.title.includes('快速退款占比偏高') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="text-pdd-gray-500">退款时间分布：</div>
                                    <div className="space-y-1">
                                      {refundTimeWindow.windows.map((w, wi) => (
                                        <div key={wi} className="flex items-center gap-2">
                                          <span className="w-16 text-pdd-gray-500">{w.label}</span>
                                          <div className="flex-1 h-4 bg-pdd-gray-100 rounded-sm overflow-hidden">
                                            <div className={`h-full rounded-sm ${wi === 0 ? 'bg-red-400' : 'bg-pdd-gray-300'}`} style={{ width: `${Math.max((w as any).ratio || 0, 1)}%`, opacity: 0.7 }} />
                                          </div>
                                          <span className="font-mono w-12 text-right">{w.count}笔</span>
                                          <span className="font-mono w-12 text-right">{(w as any).ratio?.toFixed(0) || 0}%</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {d.title.includes('地域售后异常') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="text-pdd-gray-500">异常省份明细：</div>
                                    {regionAfterSaleAnalysis.filter(r => r.isAnomaly).map((r, ri) => (
                                      <div key={ri} className="flex items-center gap-3">
                                        <span className="w-16 font-semibold text-red-500">{r.province}</span>
                                        <span className="text-pdd-gray-500">售后率 <span className="font-mono text-red-500">{r.afterSaleRate.toFixed(1)}%</span></span>
                                        <span className="text-pdd-gray-500">订单 <span className="font-mono">{r.orderCount}</span></span>
                                        <span className="text-pdd-gray-500">退款 <span className="font-mono">{fmtMoney(r.refundAmount)}</span></span>
                                      </div>
                                    ))}
                                    {regionAfterSaleAnalysis.filter(r => r.isAnomaly).length === 0 && <span className="text-pdd-gray-400">暂无异常地域</span>}
                                  </div>
                                )}
                                {d.title.includes('折扣依赖') && (
                                  <div className="space-y-2 text-xs">
                                    <div className="text-pdd-gray-500">
                                      折扣占比：<span className="font-mono font-semibold text-orange-500">{fmtPct(selectedStats.discountRatio)}</span>
                                      <span className="ml-2">折扣金额：<span className="font-mono">{fmtMoney(selectedStats.discount || 0)}</span></span>
                                      <span className="ml-2">GMV：<span className="font-mono">{fmtMoney(selectedStats.gmv)}</span></span>
                                    </div>
                                    <div className="text-pdd-gray-400">建议：{selectedStats.discountRatio > 50 ? '折扣占比超过50%，高度依赖促销，需尽快提升产品力' : '折扣占比偏高，逐步控制促销力度，避免损害品牌定价认知'}</div>
                                  </div>
                                )}
                                {d.title.includes('关联销售') && selectedStats.relatedProducts && (
                                  <div className="space-y-1 text-xs">
                                    {selectedStats.relatedProducts.slice(0, 3).map((rp, ri) => (
                                      <div key={ri} className="flex items-center gap-2">
                                        <span className="text-pdd-gray-600 truncate max-w-[150px]">{rp.productName || rp.productId}</span>
                                        <span className="text-pdd-gray-400">共购 {rp.coOccurrenceCount} 次</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </motion.div>
                        )})}
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
            <span>更新时间：{selectedStats?.lastOrderDate || '--'}</span>
            <span>数据质量：
              <span className={selectedStats && selectedStats.hasOrderData ? 'text-green-500 font-medium' : 'text-red-400'}>订单{selectedStats?.hasOrderData ? '✓' : '✗'}</span>
              {' | '}
              <span className={selectedStats && selectedStats.hasPromoData ? 'text-green-500 font-medium' : 'text-pdd-gray-400'}>推广{selectedStats?.hasPromoData ? '✓' : '✗'}</span>
              {' | '}
              <span className={afterSaleRecords.length > 0 ? 'text-green-500 font-medium' : 'text-pdd-gray-400'}>售后{afterSaleRecords.length > 0 ? '✓' : '✗'}</span>
            </span>
            <span>活跃：{selectedStats?.activeDays || 0}天 | 售后记录：{afterSaleRecords.filter(r => String(r['商品ID'] || r['商品id'] || '') === selectedId).length}条</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

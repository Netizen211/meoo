import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  BarChart, Bar, PieChart as RechartsPieChart, Pie, Cell, ComposedChart, Area, ReferenceLine
} from 'recharts';
import { ProductStat, CostBreakdown } from '../../components/ProductLinkStats';
import { useData } from '../../App';
import { findField } from '../../utils';
import { useAnalysis } from '../../context/analysisContext';
import { useStore } from '../../App';
import { apiClient } from '../../../api/client';
import AnalysisControlBar from '../../components/analysis/AnalysisControlBar';
import AnomalyBanner from '../../components/analysis/AnomalyBanner';
import PromoChannelROI from '../../components/analysis/PromoChannelROI';
import ProfitBreakdownDrawer from '../../components/analysis/ProfitBreakdownDrawer';
import { detectAnomalies } from '../../utils/anomalyDetector';
// ★ shadcn/ui 组件
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../../components/ui/select';
import { SEMANTIC, CHART } from '../../ui/tokens/colors';

const COLORS = [CHART.all[0], CHART.all[1], '#f97316', '#eab308', SEMANTIC.profit, '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const WATERFALL_POSITIVE = SEMANTIC.profit;
const WATERFALL_NEGATIVE = CHART.all[0];

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

function safeN(v: number): number {
  return isNaN(v) ? 0 : v;
}

function fmt(n: number): string {
  const v = safeN(n);
  if (Math.abs(v) >= 10000) return (v / 10000).toFixed(2) + '万';
  return v.toFixed(0);
}

function fmtMoney(n: number): string {
  const v = safeN(n);
  return '¥' + v.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function fmtPct(n: number): string {
  if (isNaN(n)) return '--';
  return n.toFixed(1) + '%';
}

function pctChange(curr: number, prev: number): { text: string; positive: boolean; neutral: boolean } {
  if (!prev || prev === 0 || isNaN(curr) || isNaN(prev)) return { text: '--', positive: true, neutral: true };
  const v = ((curr - prev) / prev) * 100;
  if (isNaN(v)) return { text: '--', positive: true, neutral: true };
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
    type = '爆品'; typeColor = SEMANTIC.loss; typeBg = '#fef2f2';
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
      items.push({ priority: 'urgent', title: 'GMV显著下降', description: `GMV环比下降${Math.abs(change).toFixed(1)}%，建议拆解为①访客数变化 ②转化率变化 ③客单价变化，定位根本原因。`, icon: <AlertTriangle size={14} />, color: SEMANTIC.loss, bg: 'rgba(239,68,68,0.08)' });
    }
  }

  // 2. 推广效率
  if (stats.roi > 0 && stats.roi < 1.5) {
    items.push({ priority: 'urgent', title: '推广ROI偏低', description: `推广ROI仅${(stats.roi||0).toFixed(2)}，推广花费¥${fmtMoney(stats.promoCost)}，建议暂停低效计划，聚焦ROI>2的渠道。`, icon: <TrendingDown size={14} />, color: SEMANTIC.loss, bg: 'rgba(239,68,68,0.08)' });
  } else if (stats.roi > 0 && stats.roi < 2.5) {
    items.push({ priority: 'important', title: '推广ROI需优化', description: `推广ROI为${(stats.roi||0).toFixed(2)}，处于中等水平，建议优化关键词和人群定向，目标提升至3以上。`, icon: <Target size={14} />, color: '#f97316', bg: '#fff7ed' });
  }

  // 3. 售后风险
  if (stats.refundRate > 10) {
    const topReason = stats.afterSaleBreakdown ? Object.entries(stats.afterSaleBreakdown).sort((a, b) => b[1] - a[1])[0] : null;
    const reasonText = topReason ? `，主要原因"${topReason[0]}"占比${rate(topReason[1], Object.values(stats.afterSaleBreakdown).reduce((a, b) => a + b, 0)).toFixed(0)}%` : '';
    items.push({ priority: 'urgent', title: '退款率偏高', description: `退款率${fmtPct(stats.refundRate)}${reasonText}，建议检查商品描述准确性、包装质量和物流时效。`, icon: <RotateCcw size={14} />, color: SEMANTIC.loss, bg: 'rgba(239,68,68,0.08)' });
  }

  // 4. 库存风险
  if (stats.turnoverDays > 60) {
    items.push({ priority: 'urgent', title: '库存积压严重', description: `库存周转${stats.turnoverDays}天，远超健康线（30天），资金占用约¥${fmtMoney(stats.sales * (stats.costBreakdown?.productCost || 0))}，建议立即促销清仓或停止补货。`, icon: <Clock size={14} />, color: SEMANTIC.loss, bg: 'rgba(239,68,68,0.08)' });
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
    if (Math.abs(delta) < 0.01) return <span className="text-xs text-pdd-text-secondary/50">≈持平</span>;
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
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5"><Activity size={13} color="#3b82f6" />转化漏斗{showStore && <span className="text-pdd-text-secondary/50 font-normal ml-1">· 左当前 / 右店铺均值</span>}</h3>
      <div className="space-y-2.5">
        {steps.map((s, i) => {
          const maxVal = showStore ? Math.max(s.value, s.storeVal, 1) : Math.max(s.value, 1);
          const currW = (s.value / maxVal) * 100;
          const storeW = showStore ? (s.storeVal / maxVal) * 100 : 0;
          const lossRate = i > 0 ? (steps[i - 1].value > 0 ? ((1 - s.value / steps[i - 1].value) * 100) : 0) : 0;
          const storeLossRate = i > 0 && showStore && steps[i-1].storeVal > 0 ? ((1 - s.storeVal / steps[i-1].storeVal) * 100) : 0;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <span className="text-xs text-pdd-text-secondary w-14 shrink-0 text-right">{s.label}</span>
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
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-pdd-text-secondary">{s.fmt(s.storeVal)}</span>
                  </div>
                )}
              </div>
              {/* 差量 */}
              <span className="text-xs w-16 shrink-0 text-right">{diffBadge(s.value, s.storeVal, s.isRate)}</span>
              {/* 流失率对比 */}
              {i > 0 && (
                <span className="text-xs text-pdd-text-secondary/50 w-24 shrink-0">
                  流失 {(lossRate||0).toFixed(0)}%
                  {showStore && <span className="text-pdd-text-secondary/50"> | {(storeLossRate||0).toFixed(0)}%</span>}
                </span>
              )}
              {i === 0 && <span className="w-24 shrink-0" />}
            </div>
          );
        })}
      </div>
      {/* CTR / CVR 对比 */}
      {showStore && (
        <div className="mt-3 flex items-center gap-4 text-xs border-t border-pdd-border pt-2.5">
          <span className="text-pdd-text-secondary">CTR：<span className="font-mono font-semibold text-pdd-text">{(ctr||0).toFixed(1)}%</span>{diffBadge(ctr, storeFunnel!.ctr, true)}</span>
          <span className="text-pdd-text-secondary">CVR：<span className="font-mono font-semibold text-pdd-text">{(cvr||0).toFixed(1)}%</span>{diffBadge(cvr, storeFunnel!.cvr, true)}</span>
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
    { label: '折扣优惠', value: -(stats.discount || 0), color: CHART.all[0], pct: gmv ? (Math.abs(stats.discount || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '推广花费', value: -(stats.promoCost || 0), color: CHART.all[0], pct: gmv ? (Math.abs(stats.promoCost || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '商品成本', value: -(cb.productCost || 0), color: CHART.all[0], pct: gmv ? (Math.abs(cb.productCost || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '平台佣金', value: -(cb.platformFee || 0), color: CHART.all[0], pct: gmv ? (Math.abs(cb.platformFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '运费险', value: -(cb.insuranceFee || 0), color: CHART.all[0], pct: gmv ? (Math.abs(cb.insuranceFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '罚款/扣款', value: -(cb.penaltyFee || 0), color: '#f5222d', pct: gmv ? (Math.abs(cb.penaltyFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '营销费用', value: -(cb.marketingFee || 0), color: '#eb2f96', pct: gmv ? (Math.abs(cb.marketingFee || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '包装快递', value: -((cb.packagingFee || 0) + (cb.shippingFee || 0)), color: CHART.all[0], pct: gmv ? (Math.abs((cb.packagingFee || 0) + (cb.shippingFee || 0)) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '税费', value: -(cb.taxes || 0), color: '#f97316', pct: gmv ? (Math.abs(cb.taxes || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '其他扣费', value: -(cb.customDeductions || 0), color: '#f97316', pct: gmv ? (Math.abs(cb.customDeductions || 0) / gmv * 100).toFixed(0) + '%' : '--' },
    { label: '净利润', value: stats.netProfit || 0, color: (stats.netProfit || 0) >= 0 ? '#22c55e' : CHART.all[0], pct: gmv ? (Math.abs(stats.netProfit || 0) / gmv * 100).toFixed(0) + '%' : '--' },
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
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
        <BarChart3 size={13} color="#7c3aed" />利润拆解
        {storeAvgPcts && <span className="text-pdd-text-secondary/50 font-normal ml-1">· vs 店铺均值</span>}
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
            <span className={`text-xs w-16 shrink-0 text-right ${item.label === '净利润' ? 'font-bold text-pdd-text' : 'text-pdd-text-secondary'}`}>{item.label}</span>
            <div className="flex-1 h-6 bg-pdd-bg/80 rounded-sm overflow-hidden">
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
            <span className="text-xs font-mono text-pdd-text-secondary w-10 shrink-0 text-right">{item.pct}</span>
            {storeAvgPcts && storeKey && storeKey !== 'gmv' && (
              <span className={`text-xs font-mono w-16 shrink-0 text-right ${isWorse ? 'text-red-500' : deltaPct != null && item.value < 0 ? 'text-green-500' : 'text-pdd-text-secondary/50'}`}>
                vs {(storePct||0).toFixed(0)}%
                {deltaPct != null && deltaPct !== 0 && <span className="ml-0.5">{deltaPct > 0 ? '↑' : '↓'}{Math.abs(deltaPct).toFixed(0)}pp</span>}
              </span>
            )}
            {storeAvgPcts && storeKey === 'gmv' && <span className="text-xs text-pdd-text-secondary/50 w-16">全店均 ¥{fmt(storeAvgPcts.gmv)}</span>}
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
      const sku = findField(o, '商家编码-SKU维度', '商品规格', 'SKU编码', '规格编码') || '';
      if (!sku) return;
      if (!map[sku]) map[sku] = { sku, qty: 0, revenue: 0, count: 0 };
      map[sku].qty += Number(findField(o, '商品数量(件)', '商品数量', '交易数量', '数量') ?? 1) || 1;
      map[sku].revenue += Number(findField(o, '商家实收金额(元)', '商家实收', '实收金额', '成交金额', '支付金额') ?? 0) || 0;
      map[sku].count++;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, 10);
  }, [orders]);

  if (!skuData.length) return <div className="p-4 text-xs text-pdd-text-secondary/50 text-center">暂无SKU数据</div>;

  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><Layers size={13} color="#f97316" />SKU 销量排行 TOP10</h3>
      <table className="w-full" style={{ fontSize: '10px' }}>
        <thead><tr className="text-pdd-text-secondary/50 border-b border-pdd-border"><th className="py-1 text-left font-medium">SKU编码</th><th className="py-1 text-right font-medium">销量</th><th className="py-1 text-right font-medium">收入</th></tr></thead>
        <tbody className="divide-y divide-pdd-border/30">
          {skuData.map((s, i) => (
            <tr key={s.sku} className="hover:bg-pdd-bg/50">
              <td className="py-1 text-pdd-text font-mono truncate max-w-[120px]">{s.sku}</td>
              <td className="py-1 text-right font-mono text-pdd-text">{s.qty}</td>
              <td className="py-1 text-right font-mono text-pdd-text">{fmtMoney(s.revenue)}</td>
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
          <p className="text-xs text-pdd-text-secondary">{pos.suggestion}</p>
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
      // 注意：商家实收已扣平台费，CM 公式不含 platformFee
      const cm1 = (s.revenue || 0) - (cb.productCost || 0) - (s.discount || 0) - (s.refund || 0);
      const cm2 = cm1 - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0));
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

  if (!layers) return <div className="p-4 text-xs text-pdd-text-secondary/50 text-center">暂无CM分层数据</div>;
  const items = [layers.cm1, layers.cm2, layers.cm3];
  const rankKeys: Array<'cm1' | 'cm2' | 'cm3'> = ['cm1', 'cm2', 'cm3'];
  return (
    <div className="p-4">
      <div className="flex items-center gap-0">
        {items.map((layer, i) => {
          const rk = rankings ? (rankings as any)[rankKeys[i]] : null;
          return (
          <React.Fragment key={layer.name}>
            <div className={`flex-1 rounded-xl border p-3 text-center ${layer.positive ? 'bg-green-50/30' : 'bg-red-50/30'}`} style={{ borderColor: layer.positive ? '#22c55e40' : `${CHART.all[0]}40` }}>
              <div className="text-xs text-pdd-text-secondary mb-1">{layer.name}</div>
              <div className={`text-lg font-bold font-mono ${layer.positive ? 'text-green-600' : 'text-red-500'}`}>
                {layer.positive ? '+' : ''}{fmtMoney(Math.abs(layer.value))}
              </div>
              <div className={`text-xs font-mono mt-0.5 ${layer.positive ? 'text-green-500' : 'text-red-400'}`}>
                占GMV {layer.pct >= 0 ? '+' : ''}{layer.pct.toFixed(1)}%
              </div>
              {rk && (
                <div className="text-pdd-text-secondary mt-1" style={{ fontSize: '9px' }}>
                  贡献度排第 <span className="font-semibold text-pdd-text">{rk.rank}</span>/{rk.total} · 优于 {rk.topPct}% 商品
                </div>
              )}
              <div className="text-pdd-text-secondary/50 mt-1" style={{ fontSize: '9px' }}>{layer.desc}</div>
            </div>
            {i < 2 && (
              <div className="shrink-0 w-8 flex items-center justify-center">
                <div className="w-6 h-0.5 bg-pdd-text-secondary/30 relative">
                  <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-0 h-0 border-t-4 border-b-4 border-l-6 border-transparent border-l-pdd-text-secondary/50" style={{ borderLeftColor: 'var(--pdd-border)' }} />
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
  if (!matrix.length) return <div className="p-4 text-xs text-pdd-text-secondary/50 text-center">暂无SKU数据（请确认订单数据包含SKU维度字段）</div>;

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
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><Layers size={13} color="#f97316" />SKU深度对比 · 点击展开查看明细</h3>
      <table className="w-full" style={{ fontSize: '10px' }}>
        <thead>
          <tr className="text-pdd-text-secondary/50 border-b border-pdd-border">
            <th className="py-1.5 w-5" />
            {cols.map(c => (
              <th key={c.key} onClick={() => handleSort(c.key)} className={`py-1.5 ${c.cls} font-medium cursor-pointer hover:text-pdd-text transition-colors`}>
                {c.label}{sortBy === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-pdd-border/30">
          {sorted.map((s, i) => {
            const isExpanded = expandedSku === s.skuId;
            return (
              <React.Fragment key={s.skuId || i}>
                <tr onClick={() => setExpandedSku(isExpanded ? null : s.skuId)}
                  className={`cursor-pointer transition-colors hover:bg-pdd-bg/50 ${rowColor(s)}`}>
                  <td className="py-1.5 text-pdd-text-secondary/50">{isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}</td>
                  <td className={`py-1.5 text-pdd-text font-mono truncate max-w-[80px] ${s.isMainSku ? 'font-bold' : ''}`} title={s.skuId}>{s.skuId}</td>
                  <td className="py-1.5 text-pdd-text-secondary truncate max-w-[60px]">{s.spec || '--'}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.isMainSku ? 'text-blue-600' : 'text-pdd-text'}`}>{s.sales}</td>
                  <td className="py-1.5 text-right font-mono text-pdd-text">{fmtMoney(s.revenue)}</td>
                  <td className="py-1.5 text-right font-mono">{(s.salesRatio||0).toFixed(0)}%</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.isHighRefund ? 'text-red-500' : 'text-pdd-text-secondary'}`}>
                    {(s.refundRate||0).toFixed(1)}%
                    {s.isHighRefund && <AlertTriangle size={10} className="inline ml-0.5 text-red-400" />}
                  </td>
                  <td className="py-1.5 text-right font-mono text-pdd-text-secondary">{fmtMoney(s.refundAmount)}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${s.profitRate != null ? (s.profitRate >= 0 ? 'text-green-600' : 'text-red-500') : 'text-pdd-text-secondary/50'}`}>
                    {s.profitRate != null ? s.profitRate.toFixed(0) + '%' : '--'}
                  </td>
                </tr>
                {/* 展开行 */}
                {isExpanded && (
                  <tr>
                    <td colSpan={9} className="p-0">
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-bg/50/50 border-b border-pdd-border px-4 py-3 overflow-hidden">
                        <div className="grid grid-cols-3 gap-4">
                          {/* SKU 诊断 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-text-secondary mb-1.5 flex items-center gap-1"><Info size={11} color="#7c3aed" />SKU 诊断</div>
                            <div className="space-y-1 text-xs">
                              {s.isHighRefund && <div className="text-red-500 flex items-center gap-1"><AlertTriangle size={10} />高退款SKU — 退款率是均值 2 倍以上</div>}
                              {s.isMainSku && <div className="text-blue-500 flex items-center gap-1"><Star size={10} />主力SKU — 占销量 {(s.salesRatio||0).toFixed(0)}%</div>}
                              {s.profitRate != null && s.profitRate < 0 && <div className="text-red-500 flex items-center gap-1"><TrendingDown size={10} />亏损SKU — 利润率 {s.profitRate.toFixed(0)}%</div>}
                              {s.profitRate != null && s.profitRate > 25 && <div className="text-green-500 flex items-center gap-1"><TrendingUp size={10} />高利润SKU — 利润率 {s.profitRate.toFixed(0)}%</div>}
                              {!s.isHighRefund && !s.isMainSku && (s.profitRate == null || (s.profitRate >= 0 && s.profitRate <= 25)) && <div className="text-pdd-text-secondary/50">该 SKU 指标正常，无明显异常</div>}
                            </div>
                            <div className="mt-2 space-y-1">
                              <div className="flex justify-between text-xs"><span className="text-pdd-text-secondary/50">均价</span><span className="font-mono">{fmtMoney(s.avgPrice)}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-pdd-text-secondary/50">平均退款天数</span><span className="font-mono">{s.avgRefundDays > 0 ? s.avgRefundDays.toFixed(0) + '天' : '--'}</span></div>
                              <div className="flex justify-between text-xs"><span className="text-pdd-text-secondary/50">订单数</span><span className="font-mono">{s.orderCount}</span></div>
                            </div>
                          </div>
                          {/* 退款原因 TOP1 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-text-secondary mb-1.5 flex items-center gap-1"><ThumbsDown size={11} color="#f97316" />退款主因</div>
                            {s.topRefundReason ? (
                              <div className="text-xs">
                                <span className="inline-block px-2 py-1 bg-orange-100 text-orange-700 rounded font-medium">{s.topRefundReason}</span>
                                <p className="text-pdd-text-secondary/50 mt-1">该原因是此 SKU 退款的首要原因，退款 {s.refundAmount > 0 ? fmtMoney(s.refundAmount) : ''} 共 {(s.refundRate||0).toFixed(1)}%</p>
                              </div>
                            ) : <div className="text-xs text-pdd-text-secondary/50">暂无退款原因数据</div>}
                          </div>
                          {/* 利润贡献 */}
                          <div>
                            <div className="text-xs font-semibold text-pdd-text-secondary mb-1.5 flex items-center gap-1"><DollarSign size={11} color="#16a34a" />利润贡献</div>
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">实收</span><span className="font-mono">{fmtMoney(s.revenue)}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">退款</span><span className="font-mono text-red-500">-{fmtMoney(s.refundAmount)}</span></div>
                              <div className="flex justify-between font-semibold border-t border-pdd-border/70 pt-1 mt-1">
                                <span className="text-pdd-text-secondary">净贡献</span>
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
      <div className="mt-2 flex items-center gap-4 text-pdd-text-secondary/50" style={{ fontSize: '9px' }}>
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
  if (!data.length && !hasStore) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><ThumbsDown size={13} color="#f97316" />退款原因TOP10</h3><div className="text-xs text-pdd-text-secondary/50 text-center h-[200px] flex items-center justify-center">暂无退款原因数据（请上传售后数据）</div></div>;

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
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5">
        <ThumbsDown size={13} color="#f97316" />退款原因对比
        {hasStore && <span className="text-pdd-text-secondary/50 font-normal ml-1">· 深=当前 / 浅=全店</span>}
      </h3>
      <div className="space-y-1.5">
        {merged.map((d, i) => {
          const isQuality = qualityReasons.some(q => d.reason.includes(q));
          const barColor = isQuality ? CHART.all[0] : '#9ca3af';
          const delta = d.currRatio - d.storeRatio;
          const onlyCurr = d.currCount > 0 && d.storeCount === 0;
          const onlyStore = d.storeCount > 0 && d.currCount === 0;
          return (
            <div key={i} className="flex items-center gap-1.5 text-xs">
              <span className={`w-14 shrink-0 truncate ${onlyStore ? 'text-pdd-text-secondary/50' : 'text-pdd-text-secondary'}`} title={d.reason}>{d.reason}</span>
              <div className="flex-1 flex gap-0.5">
                {/* 当前商品条 */}
                {d.currCount > 0 && (
                  <div className="flex-1 h-5 bg-pdd-bg/80 rounded-sm overflow-hidden relative">
                    <div className="h-full rounded-sm" style={{ width: `${(d.currCount / maxCount) * 100}%`, backgroundColor: barColor, opacity: 0.8 }} />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-pdd-text font-mono" style={{ fontSize: '8px' }}>{d.currCount}笔</span>
                  </div>
                )}
                {/* 全店条 */}
                {hasStore && (
                  <div className="flex-1 h-5 bg-pdd-bg/80 rounded-sm overflow-hidden relative">
                    <div className="h-full rounded-sm border border-dashed" style={{ width: `${(d.storeCount / maxCount) * 100}%`, backgroundColor: barColor, opacity: 0.25, borderColor: `${barColor}4d` }} />
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-pdd-text-secondary font-mono" style={{ fontSize: '8px' }}>{d.storeCount}笔</span>
                  </div>
                )}
              </div>
              <span className={`w-12 text-right font-mono shrink-0 ${onlyCurr ? 'text-red-500' : onlyStore ? 'text-pdd-text-secondary/50' : 'text-pdd-text-secondary'}`}>
                {d.currRatio.toFixed(0)}%
              </span>
              {hasStore && (
                <span className={`w-16 text-right shrink-0 ${delta > 3 ? 'text-red-500' : delta < -3 ? 'text-green-500' : 'text-pdd-text-secondary/50'}`} style={{ fontSize: '9px' }}>
                  {onlyCurr ? '仅该品' : onlyStore ? '仅全店' : delta !== 0 ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}pp` : '持平'}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex items-center gap-4 text-pdd-text-secondary/50" style={{ fontSize: '9px' }}>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: CHART.all[0], opacity: 0.8 }} />品质类</span>
        <span><span className="inline-block w-3 h-3 rounded-sm mr-1" style={{ backgroundColor: SEMANTIC.neutral, opacity: 0.8 }} />买家类</span>
        {hasStore && <span><span className="inline-block w-3 h-3 rounded-sm mr-1 border border-dashed" style={{ backgroundColor: CHART.all[0], opacity: 0.25 }} />全店</span>}
      </div>
    </div>
  );
}

// ─── 新子组件：时间窗口堆叠柱状图 ──────────────────────────
function TimeWindowStackedBar({ data, skippedNoPay, skippedNoApply }: { data: any[]; skippedNoPay: number; skippedNoApply: number }) {
  if (!data.length || data.every(w => w.count === 0)) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><Clock size={13} color="#0891b2" />退款时间窗口</h3><div className="text-xs text-pdd-text-secondary/50 text-center h-[200px] flex items-center justify-center">暂无退款时间数据（请上传售后数据）</div></div>;
  const maxCount = Math.max(...data.map(w => w.count), 1);
  const total = data.reduce((s: number, w: any) => s + w.count, 0);
  return (
    <div className="p-4">
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><Clock size={13} color="#0891b2" />退款时间窗口 (支付→申请)</h3>
      <div className="space-y-2">
        {data.map(w => (
          <div key={w.label}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-pdd-text-secondary font-medium">{w.label}</span>
              <span className="text-pdd-text-secondary/50">{w.count}笔 | {w.ratio.toFixed(0)}% | ¥{w.amount.toFixed(0)}</span>
            </div>
            <div className="h-6 bg-pdd-bg/80 rounded-sm overflow-hidden flex">
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
      <div className="mt-2 flex items-center gap-4 text-pdd-text-secondary/50" style={{ fontSize: '9px' }}>
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
  if (!data.length) return <div className="p-4"><h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><MapPin size={13} color={SEMANTIC.loss} />地域×售后交叉分析</h3><div className="text-xs text-pdd-text-secondary/50 text-center h-[200px] flex items-center justify-center">暂无地域售后数据</div></div>;

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
      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5"><MapPin size={13} color={SEMANTIC.loss} />地域×售后交叉分析</h3>
      <div className="overflow-y-auto" style={{ maxHeight: '320px' }}>
        <table className="w-full" style={{ fontSize: '10px' }}>
          <thead>
            <tr className="text-pdd-text-secondary/50 border-b border-pdd-border">
              {cols.map(c => (
                <th key={c.key} onClick={() => handleSort(c.key)} className={`py-1.5 ${c.cls} font-medium cursor-pointer hover:text-pdd-text transition-colors`}>
                  {c.label}{sortKey === c.key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
              <th className="py-1.5 text-left font-medium">标记</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pdd-border/30">
            {sorted.map((r, i) => (
              <tr key={i} className={`hover:bg-pdd-bg/50 ${r.isAnomaly ? 'bg-red-50/50' : ''}`}>
                <td className="py-1.5 text-pdd-text">{r.province}</td>
                <td className="py-1.5 text-right font-mono text-pdd-text">{r.orderCount}</td>
                <td className="py-1.5 text-right font-mono text-pdd-text">{r.afterSaleCount}</td>
                <td className={`py-1.5 text-right font-mono font-semibold ${r.isAnomaly ? 'text-red-500' : 'text-pdd-text-secondary'}`}>{r.afterSaleRate.toFixed(1)}%</td>
                <td className="py-1.5 text-right font-mono text-pdd-text-secondary">{fmtMoney(r.refundAmount)}</td>
                <td className="py-1.5 text-left">
                  {r.lowSample ? <span className="text-pdd-text-secondary/50 text-xs">样本不足</span> :
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

// ─── 健康度仪表盘已移除 ───

// ─── 核心组件：扣费明细表（运营必看）────────────────────────
function DeductionDetailTable({ stats, allProductStats, comparisonMode, onViewFullDetail }: {
  stats: ProductStat; allProductStats: Record<string, ProductStat>; comparisonMode: string;
  onViewFullDetail: () => void;
}) {
  const cb = stats.costBreakdown || {} as CostBreakdown;
  const gmv = stats.gmv || 1;

  // 店铺均值占比
  const storeAvgPcts = useMemo(() => {
    if (comparisonMode === 'none') return null;
    const all = Object.values(allProductStats);
    if (all.length < 2) return null;
    const n = all.length;
    const avgGmv = all.reduce((s, p) => s + (p.gmv || 0), 0) / n;
    if (avgGmv <= 0) return null;
    const calcPct = (fn: (s: ProductStat, cb: CostBreakdown) => number) =>
      (all.reduce((sum, s) => sum + fn(s, s.costBreakdown || {} as CostBreakdown), 0) / n / avgGmv) * 100;
    return {
      discount: calcPct((s, cb) => Math.abs(s.discount || 0)),
      promo: calcPct((s, cb) => Math.abs(s.promoCost || 0)),
      productCost: calcPct((s, cb) => Math.abs(cb.productCost || 0)),
      platform: calcPct((s, cb) => Math.abs(cb.platformFee || 0)),
      insurance: calcPct((s, cb) => Math.abs(cb.insuranceFee || 0)),
      penalty: calcPct((s, cb) => Math.abs(cb.penaltyFee || 0)),
      marketing: calcPct((s, cb) => Math.abs(cb.marketingFee || 0)),
      packaging: calcPct((s, cb) => Math.abs((cb.packagingFee || 0) + (cb.shippingFee || 0))),
      taxes: calcPct((s, cb) => Math.abs(cb.taxes || 0)),
      other: calcPct((s, cb) => Math.abs(cb.customDeductions || 0)),
    };
  }, [allProductStats, comparisonMode]);

  interface FeeItem {
    key: string; label: string; value: number; icon: string;
    pct: string; storePctKey?: string; severity: 'revenue' | 'neutral' | 'warning' | 'danger' | 'profit';
    detail: string;
  }
  const pkgShipTotal = (cb.packagingFee || 0) + (cb.shippingFee || 0);
  const items: FeeItem[] = [
    { key: 'gmv', label: 'GMV（商品总价）', value: gmv, icon: '📦', pct: '100%', severity: 'revenue', detail: '所有订单的商品总价合计，含优惠前原价' },
    { key: 'discount', label: '折扣优惠', value: -(stats.discount || 0), icon: '🏷️', pct: gmv ? (Math.abs(stats.discount || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'discount', severity: 'warning', detail: '店铺优惠+平台优惠+多多支付立减+优惠券' },
    { key: 'promoCost', label: '推广花费', value: -(stats.promoCost || 0), icon: '🎯', pct: gmv ? (Math.abs(stats.promoCost || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'promo', severity: stats.promoCost > gmv * 0.3 ? 'danger' : 'warning', detail: '商品推广+明星店铺+直播推广全渠道总花费' },
    { key: 'productCost', label: '商品成本', value: -(cb.productCost || 0), icon: '📦', pct: gmv ? (Math.abs(cb.productCost || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'productCost', severity: 'neutral', detail: 'SKU成本合计（成本管理页配置），成本未知时使用30%估算' },
    { key: 'platformFee', label: '平台佣金/技术服务费', value: -(cb.platformFee || 0), icon: '💳', pct: gmv ? (Math.abs(cb.platformFee || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'platform', severity: 'neutral', detail: '平台技术服务费（佣金），已包含在商家实收中扣除' },
    { key: 'insurance', label: '运费险', value: -(cb.insuranceFee || 0), icon: '🛡️', pct: gmv ? (Math.abs(cb.insuranceFee || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'insurance', severity: (cb.insuranceFee || 0) > gmv * 0.05 ? 'warning' : 'neutral', detail: '退换货运费险保费，按已发货订单逐笔计算' },
    { key: 'penalty', label: '罚款/扣款', value: -(cb.penaltyFee || 0), icon: '⚡', pct: gmv ? (Math.abs(cb.penaltyFee || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'penalty', severity: (cb.penaltyFee || 0) > 0 ? 'danger' : 'neutral', detail: '平台违规罚款、延迟发货罚款、客服罚款等' },
    { key: 'marketing', label: '营销费用', value: -(cb.marketingFee || 0), icon: '📢', pct: gmv ? (Math.abs(cb.marketingFee || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'marketing', severity: 'neutral', detail: '平台活动报名费、营销工具费用等' },
    { key: 'packaging', label: '包装+快递费', value: -(pkgShipTotal), icon: '🚚', pct: gmv ? (Math.abs(pkgShipTotal) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'packaging', severity: 'neutral', detail: '包装材料+快递运费，可通过成本管理页配置精确值' },
    { key: 'taxes', label: '税费', value: -(cb.taxes || 0), icon: '🏛️', pct: gmv ? (Math.abs(cb.taxes || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'taxes', severity: 'neutral', detail: '增值税、附加税等预估税费（可配置精确税率）' },
    { key: 'other', label: '其他扣费', value: -(cb.customDeductions || 0), icon: '📋', pct: gmv ? (Math.abs(cb.customDeductions || 0) / gmv * 100).toFixed(1) + '%' : '--', storePctKey: 'other', severity: 'neutral', detail: '自定义扣费项合计' },
    { key: 'netProfit', label: '净利润', value: stats.netProfit || 0, icon: '💰', pct: gmv ? (Math.abs(stats.netProfit || 0) / gmv * 100).toFixed(1) + '%' : '--', severity: 'profit', detail: 'GMV − 所有扣费项 = 净利润（实收−各项费用后的最终利润）' },
  ];

  // 颜色映射
  const severityColors: Record<string, string> = {
    revenue: '#16a34a', neutral: 'var(--pdd-text-secondary)', warning: '#f97316', danger: CHART.all[0], profit: '#16a34a'
  };
  const severityBgs: Record<string, string> = {
    revenue: '#f0fdf4', neutral: '#f9fafb', warning: '#fff7ed', danger: '#fef2f2', profit: '#f0fdf4'
  };

  return (
    <div className="p-4" id="deduction-detail">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-pdd-text flex items-center gap-2">
          <span className="text-base">💰</span> 扣费明细 · 运营必看
          <span className="text-xs text-pdd-text-secondary font-normal ml-1">每一笔费用去向清楚</span>
        </h3>
        <button
          onClick={onViewFullDetail}
          className="text-xs text-pdd-primary hover:text-pdd-primary-dark font-medium flex items-center gap-1 transition-colors"
        >
          查看利润核算明细 <ArrowRight size={12} />
        </button>
      </div>

      {/* 表头 */}
      <div className="flex items-center gap-2 mb-1.5 px-2 py-1 text-[10px] text-pdd-text-secondary font-medium border-b border-pdd-border">
        <span className="w-40 shrink-0">扣费项目</span>
        <span className="w-24 shrink-0 text-right">金额</span>
        <span className="w-20 shrink-0 text-right">占GMV</span>
        <span className="w-24 shrink-0 text-right">vs 店铺均值</span>
        <span className="w-28 shrink-0 text-right">状态/建议</span>
        <span className="flex-1" />
      </div>

      {items.map((item, i) => {
        const itemPctNum = item.pct !== '--' ? parseFloat(item.pct) : 0;
        const storePct = item.storePctKey && storeAvgPcts ? (storeAvgPcts as any)[item.storePctKey] : undefined;
        const deltaPct = storePct != null && item.pct !== '--' ? itemPctNum - storePct : null;
        const isWorse = deltaPct != null && item.value < 0 && deltaPct > 0; // 扣费项占比更高=更差
        const isBetter = deltaPct != null && item.value < 0 && deltaPct < 0; // 扣费项占比更低=更好
        const sev = item.severity;

        // 判断优化建议
        let suggestion = '';
        if (item.key === 'promoCost' && itemPctNum > 25) suggestion = '🔴 推广占比偏高，建议优化ROI';
        else if (item.key === 'promoCost' && itemPctNum > 15) suggestion = '🟡 推广占比适中，关注ROI';
        else if (item.key === 'promoCost') suggestion = '🟢 推广占比健康';
        else if (item.key === 'penalty' && Math.abs(item.value) > 0) suggestion = '🔴 存在罚款，需处理';
        else if (item.key === 'penalty') suggestion = '🟢 无罚款';
        else if (item.key === 'insurance' && itemPctNum > 5) suggestion = '🟡 运费险占比较高，关注退款率';
        else if (item.key === 'insurance') suggestion = '🟢 运费险占比正常';
        else if (item.key === 'discount' && itemPctNum > 15) suggestion = '🔴 折扣力度偏大，影响利润';
        else if (item.key === 'discount') suggestion = itemPctNum > 0 ? '🟢 折扣占比正常' : '';
        else if (item.key === 'productCost' && storePct != null && itemPctNum > storePct + 5) suggestion = '🟡 成本高于店铺均值';
        else if (item.key === 'productCost') suggestion = '⚪ 可手动调整成本';
        else if (item.key === 'gmv' || item.key === 'netProfit') suggestion = '';
        else suggestion = '🟢 正常';

        const isProfitRow = item.key === 'netProfit';
        const isGmvRow = item.key === 'gmv';

        return (
          <div key={item.key}
            className={`flex items-center gap-2 px-2 py-2 rounded-lg transition-colors hover:bg-pdd-bg/50/50 ${isProfitRow ? 'border-t-2 border-dashed border-pdd-border mt-0.5 pt-2.5 font-bold' : ''} ${isGmvRow ? 'pb-2' : ''}`}
            style={{ backgroundColor: isProfitRow ? '#f0fdf4' : isGmvRow ? '#f9fafb' : 'transparent' }}
          >
            {/* 项目名 */}
            <div className="w-40 shrink-0 flex items-center gap-1.5">
              <span className="text-sm">{item.icon}</span>
              <div>
                <span className={`text-xs ${isProfitRow ? 'font-bold text-green-700' : isGmvRow ? 'font-semibold text-pdd-text' : 'text-pdd-text'}`}>
                  {item.label}
                </span>
                {!isGmvRow && !isProfitRow && (
                  <span className="block text-[9px] text-pdd-text-secondary leading-tight" title={item.detail}>
                    {item.detail.length > 28 ? item.detail.slice(0, 28) + '…' : item.detail}
                  </span>
                )}
              </div>
            </div>

            {/* 金额 */}
            <span className={`w-24 shrink-0 text-right text-xs font-mono font-semibold ${item.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {item.value >= 0 ? '+' : ''}{fmtMoney(Math.abs(item.value))}
            </span>

            {/* 占GMV% */}
            <span className="w-20 shrink-0 text-right text-xs font-mono text-pdd-text-secondary">
              {item.pct}
            </span>

            {/* vs 店铺均值 */}
            <span className="w-24 shrink-0 text-right text-xs">
              {storePct != null && !isGmvRow ? (
                <span className={`font-mono ${isWorse ? 'text-red-500' : isBetter ? 'text-green-500' : 'text-pdd-text-secondary'}`}>
                  均值 {storePct.toFixed(1)}%
                  {deltaPct != null && Math.abs(deltaPct) > 0.5 && (
                    <span className="ml-0.5">{deltaPct > 0 ? '↑' : '↓'}{Math.abs(deltaPct).toFixed(1)}pp</span>
                  )}
                </span>
              ) : isGmvRow && storeAvgPcts ? (
                <span className="text-pdd-text-secondary">全店均 ¥{fmt(0)}</span>
              ) : (
                <span className="text-pdd-text-secondary">--</span>
              )}
            </span>

            {/* 状态/建议 */}
            <span className="w-28 shrink-0 text-right text-[10px] font-medium text-pdd-text-secondary">
              {suggestion}
            </span>

            <span className="flex-1" />
          </div>
        );
      })}

      {/* 底部提示 */}
      <div className="mt-3 px-2 py-1.5 bg-blue-50/50 rounded-lg text-[10px] text-pdd-text-secondary flex items-center gap-1.5">
        <Info size={11} color="#3b82f6" />
        <span>提示：商品成本和包装快递费可在"成本管理"页面精确配置。平台佣金已含在商家实收中（不需要额外扣减）。</span>
      </div>
    </div>
  );
}

// ─── 操作时间线 Operation Timeline ───────────────────────────
function OperationTimeline({ productOrders, productAfterSales, financialRecords, selectedStats }: {
  productOrders: any[]; productAfterSales: any[];
  financialRecords: any[]; selectedStats: ProductStat | null;
}) {
  const timelineEvents = useMemo(() => {
    interface TimelineEvent {
      date: string;
      type: 'order' | 'price' | 'refund' | 'finance' | 'milestone';
      label: string;
      desc: string;
      icon: React.ReactNode;
      color: string;
      bg: string;
    }
    const events: TimelineEvent[] = [];

    if (!selectedStats || productOrders.length === 0) return events;

    // ① 订单时间分布：按日期聚合
    const dateMap: Record<string, number> = {};
    const priceMap: Record<string, { total: number; count: number }> = {};

    productOrders.forEach(o => {
      const d = String(findField(o, '支付时间', '付款时间', '支付日期') || '').slice(0, 10);
      if (!d) return;
      dateMap[d] = (dateMap[d] || 0) + 1;

      // 检测价格变化
      const price = parseFloat(findField(o, '商品总价(元)', '商品总价', '商品金额') || '0') || 0;
      if (price > 0) {
        if (!priceMap[d]) priceMap[d] = { total: 0, count: 0 };
        priceMap[d].total += price;
        priceMap[d].count++;
      }
    });

    // ② 首单事件
    const dateKeys = Object.keys(dateMap).sort();
    if (dateKeys.length > 0) {
      events.push({
        date: dateKeys[0],
        type: 'milestone',
        label: '首单成交',
        desc: `商品在 ${dateKeys[0]} 完成首单销售，当日共 ${dateMap[dateKeys[0]]} 单`,
        icon: <Star size={12} />,
        color: '#16a34a',
        bg: '#f0fdf4',
      });

      // 日订单量里程碑
      let maxOrders = 0, maxDate = '';
      Object.entries(dateMap).forEach(([d, c]) => {
        if (c > maxOrders) { maxOrders = c; maxDate = d; }
      });
      if (maxOrders >= 5) {
        events.push({
          date: maxDate,
          type: 'milestone',
          label: `日销峰值 ${maxOrders} 单`,
          desc: `${maxDate} 达到单日销量峰值 ${maxOrders} 单`,
          icon: <TrendingUp size={12} />,
          color: '#0891b2',
          bg: '#ecfeff',
        });
      }
    }

    // ③ 价格变动检测
    let prevAvgPrice = 0;
    const sortedDates = dateKeys.sort();
    sortedDates.forEach(d => {
      const entry = priceMap[d];
      if (!entry || entry.count === 0) return;
      const avgPrice = entry.total / entry.count;
      if (prevAvgPrice > 0 && Math.abs(avgPrice - prevAvgPrice) / prevAvgPrice > 0.05) {
        const direction = avgPrice > prevAvgPrice ? '上涨' : '下降';
        const pct = Math.abs((avgPrice - prevAvgPrice) / prevAvgPrice * 100);
        events.push({
          date: d,
          type: 'price',
          label: `价格${direction} ${pct.toFixed(0)}%`,
          desc: `均价 ¥${prevAvgPrice.toFixed(0)} → ¥${avgPrice.toFixed(0)}（${direction}${pct.toFixed(0)}%）`,
          icon: avgPrice > prevAvgPrice ? <TrendingUp size={12} /> : <TrendingDown size={12} />,
          color: avgPrice > prevAvgPrice ? '#f97316' : '#3b82f6',
          bg: avgPrice > prevAvgPrice ? '#fff7ed' : '#eff6ff',
        });
      }
      prevAvgPrice = avgPrice;
    });

    // ④ 退款事件
    const refundDates = new Set<string>();
    productAfterSales.forEach((r: any) => {
      const d = String(findField(r, '创建时间', '售后申请时间', '申请时间') || '').slice(0, 10);
      if (d) refundDates.add(d);
    });
    if (refundDates.size > 0) {
      const firstRefund = [...refundDates].sort()[0];
      const refundCount = refundDates.size;
      events.push({
        date: firstRefund,
        type: 'refund',
        label: `出现退款（共${refundCount}天有退款）`,
        desc: `首笔退款发生在 ${firstRefund}，期间共 ${refundCount} 天出现退款`,
        icon: <RotateCcw size={12} />,
        color: SEMANTIC.loss,
        bg: 'rgba(239,68,68,0.08)',
      });
    }

    // ⑤ 财务事件（罚款/扣款）
    const productOrderIds = new Set(productOrders.map((o: any) => String(findField(o, '订单号') || '')));
    const finEvents = financialRecords.filter((rec: any) => {
      const orderId = String(findField(rec, '商户订单号', '订单号', '订单编号') || '');
      return productOrderIds.has(orderId) && (String(findField(rec, '业务描述', '费用类型') || '').includes('罚款') || String(findField(rec, '业务描述', '费用类型') || '').includes('扣款') || String(findField(rec, '业务描述', '费用类型') || '').includes('违约金'));
    });
    const finByDate: Record<string, number> = {};
    finEvents.forEach((rec: any) => {
      const d = String(findField(rec, '记账时间', '发生时间', '日期') || '').slice(0, 10);
      if (d) finByDate[d] = (finByDate[d] || 0) + (parseFloat(findField(rec, '扣款金额(元)', '金额', '扣款金额') || '0') || 0);
    });
    Object.entries(finByDate).forEach(([d, amt]) => {
      events.push({
        date: d,
        type: 'finance',
        label: `罚款/扣款 ¥${fmtMoney(amt)}`,
        desc: `${d} 发生罚款/扣款 ¥${fmtMoney(amt)}`,
        icon: <AlertTriangle size={12} />,
        color: SEMANTIC.loss,
        bg: 'rgba(239,68,68,0.08)',
      });
    });

    // 按日期排序
    events.sort((a, b) => a.date.localeCompare(b.date));

    // 去重：同一天同类型只保留一条
    const seen = new Set<string>();
    return events.filter(e => {
      const key = `${e.date}-${e.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(-30); // 最多显示30条
  }, [productOrders, productAfterSales, financialRecords, selectedStats]);

  if (!selectedStats || productOrders.length === 0) {
    return (
      <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-8 text-center">
        <Clock size={24} className="mx-auto mb-2 text-pdd-text-secondary/50 opacity-40" />
        <p className="text-xs text-pdd-text-secondary/50">暂无订单数据，无法生成操作时间线</p>
      </div>
    );
  }

  const totalOrders = productOrders.length;
  const dateRange = timelineEvents.length >= 2
    ? `${timelineEvents[0].date} 至 ${timelineEvents[timelineEvents.length - 1].date}`
    : '--';

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
      {/* 统计概要 */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-pdd-border">
        {[
          { label: '总订单', val: `${totalOrders} 单`, color: '#0891b2' },
          { label: '时间跨度', val: dateRange, color: '#16a34a' },
          { label: '关键事件', val: `${timelineEvents.length} 件`, color: '#7c3aed' },
          { label: '退款天数', val: `${new Set(productAfterSales.map((r: any) => String(findField(r, '创建时间', '售后申请时间', '申请时间') || '').slice(0, 10))).size} 天`, color: SEMANTIC.loss },
        ].map((stat, i) => (
          <div key={i} className="text-center p-2 rounded-lg bg-pdd-bg/50">
            <div className="text-[10px] text-pdd-text-secondary/50 mb-1">{stat.label}</div>
            <div className="text-sm font-bold font-mono" style={{ color: stat.color }}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* 时间线 */}
      <div className="p-4 max-h-[400px] overflow-y-auto">
        {timelineEvents.length === 0 ? (
          <div className="text-xs text-pdd-text-secondary/50 text-center py-4">暂无关键事件</div>
        ) : (
          <div className="relative">
            {/* 竖线 */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-pdd-text-secondary/20" />
            <div className="space-y-0">
              {timelineEvents.map((evt, i) => (
                <div key={i} className="flex items-start gap-3 py-2 relative">
                  {/* 时间点圆点 */}
                  <div className="shrink-0 w-[30px] flex justify-center relative z-10">
                    <div className="w-[22px] h-[22px] rounded-full flex items-center justify-center" style={{ backgroundColor: evt.bg, color: evt.color }}>
                      {evt.icon}
                    </div>
                  </div>
                  {/* 内容 */}
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-pdd-text-secondary/50">{evt.date}</span>
                      <span className="text-xs font-semibold text-pdd-text">{evt.label}</span>
                    </div>
                    <p className="text-[10px] text-pdd-text-secondary mt-0.5">{evt.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 订单追溯 Order Traceability ────────────────────────────
function OrderTraceability({ productOrders, productAfterSales, financialRecords, selectedStats }: {
  productOrders: any[]; productAfterSales: any[];
  financialRecords: any[]; selectedStats: ProductStat | null;
}) {
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [traceSortBy, setTraceSortBy] = useState<string>('date');
  const [traceSortDir, setTraceSortDir] = useState<-1 | 1>(-1);

  // 构建追溯数据
  const traceData = useMemo(() => {
    if (!selectedStats || productOrders.length === 0) return [];

    const afterSaleByOrder: Record<string, any[]> = {};
    productAfterSales.forEach((r: any) => {
      const oid = String(findField(r, '订单编号', '订单号') || '');
      if (!oid) return;
      if (!afterSaleByOrder[oid]) afterSaleByOrder[oid] = [];
      afterSaleByOrder[oid].push(r);
    });

    const finByOrder: Record<string, any[]> = {};
    financialRecords.forEach((rec: any) => {
      const oid = String(findField(rec, '商户订单号', '订单号', '订单编号') || '');
      if (!oid) return;
      if (!finByOrder[oid]) finByOrder[oid] = [];
      finByOrder[oid].push(rec);
    });

    return productOrders.map(o => {
      const orderId = String(findField(o, '订单号') || '') || '--';
      const payTime = String(findField(o, '支付时间', '付款时间', '支付日期') || '') || '--';
      const sku = String(findField(o, '商家编码-SKU维度', '商品规格', 'SKU编码', '规格编码') || '') || '--';
      const qty = parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1;
      const gmv = parseFloat(findField(o, '商品总价(元)', '商品总价', '商品金额') || '0') || 0;
      const revenue = parseFloat(findField(o, '商家实收金额(元)', '商家实收', '实收金额') || '0') || 0;
      const refund = parseFloat(findField(o, '退款金额(元)', '退款金额', '退款') || '0') || 0;
      const status = refund > 0 ? '已退款' : '正常';
      const afterSales = afterSaleByOrder[orderId] || [];
      const finEvents = finByOrder[orderId] || [];

      return {
        orderId, payTime, sku, qty, gmv, revenue, refund, status,
        afterSaleCount: afterSales.length,
        finCount: finEvents.length,
        afterSales,
        finEvents,
        hasIssue: refund > 0 || afterSales.length > 0 || finEvents.length > 0,
      };
    });
  }, [productOrders, productAfterSales, financialRecords, selectedStats]);

  // 排序
  const sortedData = useMemo(() => {
    const sorted = [...traceData];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (traceSortBy === 'date') cmp = a.payTime.localeCompare(b.payTime);
      else if (traceSortBy === 'orderId') cmp = a.orderId.localeCompare(b.orderId);
      else if (traceSortBy === 'gmv') cmp = a.gmv - b.gmv;
      else if (traceSortBy === 'revenue') cmp = a.revenue - b.revenue;
      else if (traceSortBy === 'qty') cmp = a.qty - b.qty;
      else if (traceSortBy === 'status') cmp = a.status.localeCompare(b.status);
      return cmp * traceSortDir;
    });
    return sorted;
  }, [traceData, traceSortBy, traceSortDir]);

  const handleSort = (key: string) => {
    if (traceSortBy === key) setTraceSortDir(d => (d === 1 ? -1 : 1) as -1 | 1);
    else { setTraceSortBy(key); setTraceSortDir(-1); }
  };

  const sortIcon = (key: string) => {
    if (traceSortBy !== key) return null;
    return traceSortDir === 1 ? ' ↑' : ' ↓';
  };

  if (!selectedStats || productOrders.length === 0) {
    return (
      <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-8 text-center">
        <Search size={24} className="mx-auto mb-2 text-pdd-text-secondary/50 opacity-40" />
        <p className="text-xs text-pdd-text-secondary/50">暂无订单数据</p>
      </div>
    );
  }

  const totalGmv = traceData.reduce((s, o) => s + o.gmv, 0);
  const totalRevenue = traceData.reduce((s, o) => s + o.revenue, 0);
  const totalOrders = traceData.length;
  const issueOrders = traceData.filter(o => o.hasIssue).length;

  return (
    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden">
      {/* 头部统计 */}
      <div className="grid grid-cols-4 gap-3 p-4 border-b border-pdd-border bg-pdd-bg/50/50">
        {[
          { label: '订单总数', val: `${totalOrders} 单`, color: '#0891b2' },
          { label: 'GMV合计', val: `¥${fmtMoney(totalGmv)}`, color: SEMANTIC.loss },
          { label: '实收合计', val: `¥${fmtMoney(totalRevenue)}`, color: '#16a34a' },
          { label: '异常订单', val: `${issueOrders} 单`, color: issueOrders > 0 ? SEMANTIC.loss : '#16a34a' },
        ].map((stat, i) => (
          <div key={i} className="text-center">
            <div className="text-[10px] text-pdd-text-secondary/50">{stat.label}</div>
            <div className="text-sm font-bold font-mono" style={{ color: stat.color }}>{stat.val}</div>
          </div>
        ))}
      </div>

      {/* 表格 */}
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full" style={{ fontSize: '10px' }}>
          <thead className="sticky top-0 bg-pdd-card z-10">
            <tr className="text-pdd-text-secondary/50 border-b border-pdd-border">
              <th className="py-2 px-2 w-5" />
              <th className="py-2 px-2 text-left font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('orderId')}>订单号{sortIcon('orderId')}</th>
              <th className="py-2 px-2 text-left font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('date')}>支付时间{sortIcon('date')}</th>
              <th className="py-2 px-2 text-left font-medium">SKU</th>
              <th className="py-2 px-2 text-right font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('qty')}>数量{sortIcon('qty')}</th>
              <th className="py-2 px-2 text-right font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('gmv')}>GMV{sortIcon('gmv')}</th>
              <th className="py-2 px-2 text-right font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('revenue')}>实收{sortIcon('revenue')}</th>
              <th className="py-2 px-2 text-center font-medium cursor-pointer hover:text-pdd-text" onClick={() => handleSort('status')}>状态{sortIcon('status')}</th>
              <th className="py-2 px-2 text-center font-medium">售后</th>
              <th className="py-2 px-2 text-center font-medium">财务</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pdd-border/30">
            {sortedData.slice(0, 200).map((o, i) => {
              const isExpanded = expandedOrder === o.orderId;
              return (
                <React.Fragment key={o.orderId || i}>
                  <tr onClick={() => setExpandedOrder(isExpanded ? null : o.orderId)}
                    className={`cursor-pointer transition-colors hover:bg-pdd-bg/50 ${o.hasIssue ? 'bg-red-50/20' : ''}`}>
                    <td className="py-1.5 px-2 text-pdd-text-secondary/50">{isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}</td>
                    <td className="py-1.5 px-2 font-mono text-pdd-text truncate max-w-[100px]" title={o.orderId}>{o.orderId}</td>
                    <td className="py-1.5 px-2 text-pdd-text-secondary">{o.payTime !== '--' ? o.payTime.slice(5, 10) : '--'}</td>
                    <td className="py-1.5 px-2 font-mono text-pdd-text-secondary/50 truncate max-w-[60px]" title={o.sku}>{o.sku}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{o.qty}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{fmtMoney(o.gmv)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{fmtMoney(o.revenue)}</td>
                    <td className="py-1.5 px-2 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${o.status === '正常' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>{o.status}</span>
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {o.afterSaleCount > 0
                        ? <span className="px-1.5 py-0.5 rounded text-[9px] bg-orange-100 text-orange-600">{o.afterSaleCount}</span>
                        : <span className="text-pdd-text-secondary/50">--</span>}
                    </td>
                    <td className="py-1.5 px-2 text-center">
                      {o.finCount > 0
                        ? <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-100 text-red-600">{o.finCount}</span>
                        : <span className="text-pdd-text-secondary/50">--</span>}
                    </td>
                  </tr>
                  {/* 展开行：订单详情 */}
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="bg-pdd-bg/50 p-3">
                        <div className="grid grid-cols-2 gap-3 text-[10px]">
                          {/* 基本信息 */}
                          <div className="bg-pdd-card rounded-lg p-2.5 border border-pdd-border">
                            <h4 className="font-semibold text-pdd-text mb-1.5 text-[10px]">订单信息</h4>
                            <div className="space-y-1">
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">订单号</span><span className="font-mono text-pdd-text">{o.orderId}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">支付时间</span><span className="text-pdd-text">{o.payTime}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">SKU</span><span className="font-mono text-pdd-text">{o.sku}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">数量</span><span className="font-mono text-pdd-text">{o.qty}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">GMV</span><span className="font-mono text-pdd-text">{fmtMoney(o.gmv)}</span></div>
                              <div className="flex justify-between"><span className="text-pdd-text-secondary/50">实收</span><span className="font-mono text-green-600">{fmtMoney(o.revenue)}</span></div>
                              {o.refund > 0 && <div className="flex justify-between"><span className="text-pdd-text-secondary/50">退款</span><span className="font-mono text-red-500">{fmtMoney(o.refund)}</span></div>}
                            </div>
                          </div>
                          {/* 售后信息 */}
                          <div className="bg-pdd-card rounded-lg p-2.5 border border-pdd-border">
                            <h4 className="font-semibold text-pdd-text mb-1.5 text-[10px]">售后记录 <span className="text-pdd-text-secondary/50">({o.afterSaleCount})</span></h4>
                            {o.afterSales.length > 0 ? (
                              <div className="space-y-1.5">
                                {o.afterSales.slice(0, 5).map((r: any, ri: number) => (
                                  <div key={ri} className="border-b border-pdd-border pb-1 last:border-0">
                                    <div className="flex justify-between">
                                      <span className="font-mono text-pdd-text-secondary">{String(findField(r, '售后编号', '售后单号') || '').slice(-8)}</span>
                                      <span className="text-red-500 font-mono">{fmtMoney(parseFloat(findField(r, '退款金额(元)', '金额') || '0') || 0)}</span>
                                    </div>
                                    <div className="text-pdd-text-secondary/50 mt-0.5">{String(findField(r, '售后类型', '退款类型') || '') || '--'} · {String(findField(r, '原因', '退款原因') || '') || '--'}</div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-pdd-text-secondary/50 text-center py-2">无售后记录</div>
                            )}
                          </div>
                          {/* 财务事件 */}
                          {o.finEvents.length > 0 && (
                            <div className="col-span-2 bg-pdd-card rounded-lg p-2.5 border border-pdd-border">
                              <h4 className="font-semibold text-pdd-text mb-1.5 text-[10px]">财务扣款 <span className="text-pdd-text-secondary/50">({o.finCount})</span></h4>
                              <div className="space-y-1">
                                {o.finEvents.map((rec: any, ri: number) => (
                                  <div key={ri} className="flex justify-between items-center border-b border-pdd-border pb-1 last:border-0">
                                    <div>
                                      <span className="text-pdd-text-secondary">{String(findField(rec, '业务描述', '费用类型') || '') || '--'}</span>
                                      <span className="text-pdd-text-secondary/50 ml-1 text-[9px]">{String(findField(rec, '记账时间', '发生时间', '日期') || '').slice(0, 10)}</span>
                                    </div>
                                    <span className="font-mono text-red-500">{fmtMoney(parseFloat(findField(rec, '扣款金额(元)', '金额', '扣款金额') || '0') || 0)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {traceData.length > 200 && (
          <div className="p-2 text-center text-[10px] text-pdd-text-secondary/50 border-t border-pdd-border">
            仅显示前 200 条，共 {traceData.length} 条
          </div>
        )}
      </div>
      <div className="px-3 py-1.5 bg-pdd-bg/50/50 border-t border-pdd-border text-[9px] text-pdd-text-secondary/50 flex items-center justify-between">
        <span>点击行展开查看完整追溯 · 点击表头排序</span>
        <span>异常订单标红</span>
      </div>
    </div>
  );
}

// 导航锚点配置（模块级常量，不依赖组件 state）
const SECTIONS = [
  { id: 'sec-overview', label: '趋势', icon: <TrendingUp size={12} /> },
  { id: 'sec-profit', label: '利润', icon: <DollarSign size={12} /> },
  { id: 'sec-traffic', label: '流量', icon: <Target size={12} /> },
  { id: 'sec-sku', label: 'SKU', icon: <Layers size={12} /> },
  { id: 'sec-aftersale', label: '售后', icon: <Shield size={12} /> },
  { id: 'sec-timeline', label: '时间线', icon: <Clock size={12} /> },
  { id: 'sec-traceability', label: '追溯', icon: <Search size={12} /> },
  { id: 'sec-diagnosis', label: '诊断', icon: <Gauge size={12} /> },
];

// ─── 主组件：商品指挥中心（全新设计·单页滚动仪表盘）────────────────
export default function ProductDeepAnalysis({ isOpen, onClose, initialProductId, productStats, products, orders, prevProductStats }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(initialProductId || null);
  const [search, setSearch] = useState('');
  const [showSidebar, setShowSidebar] = useState(!initialProductId);
  const [filter, setFilter] = useState<'all' | 'champion' | 'profit' | 'hidden' | 'dead'>('all');
  const [comparisonMode, setComparisonMode] = useState<'storeAvg' | 'topProduct' | 'prevPeriod' | 'none'>('storeAvg');
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<number | null>(null);
  const [showProfitDrawer, setShowProfitDrawer] = useState(false);
  const [timeGranularity, setTimeGranularity] = useState<'hour' | 'day' | 'week'>('day');
  const [detailChartPoint, setDetailChartPoint] = useState<{date: string; data: any} | null>(null);
  const [activeSection, setActiveSection] = useState<string>('sec-overview');

  // ★ 当 initialProductId 属性变化时同步到内部 selectedId（props→state）
  useEffect(() => {
    if (isOpen && initialProductId) {
      setSelectedId(initialProductId);
      setShowSidebar(false);
    }
  }, [initialProductId, isOpen]);

  // 读取全局分析上下文（时间筛选、面包屑等）
  const analysis = useAnalysis();
  const { timeFilter } = analysis;

  // 获取全局数据
  const { currentDisplayData, productCosts, platformCommissionRate } = useData();
  const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
  const insuranceRecords = currentDisplayData?.shippingInsurance || [];
  const allOrders = currentDisplayData?.orders || [];

  // ★ 服务端数据：单品深度分析（替代浏览器端所有 useMemo 计算链）
  const { currentStore } = useStore();
  const [serverDeepData, setServerDeepData] = useState<any>(null);
  const [serverLoading, setServerLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !selectedId || !currentStore?.id) return;
    setServerLoading(true);
    apiClient.get(`/analytics/product/deep/${encodeURIComponent(selectedId)}?storeId=${encodeURIComponent(currentStore.id)}`)
      .then(res => { if (res.success) setServerDeepData(res.data); })
      .catch(e => console.error('[PDA] server fetch error:', e))
      .finally(() => setServerLoading(false));
  }, [isOpen, selectedId, currentStore?.id]);

  // 选中的商品统计（优先使用服务器数据）
  const selectedStats = serverDeepData?.stats || (selectedId ? productStats[selectedId] : null);
  const prevStats = serverDeepData?.prevStats || (selectedId && prevProductStats ? prevProductStats[selectedId] : undefined);

  // ★ 滚动监听 — 高亮当前可见的锚点
  useEffect(() => {
    if (!selectedStats) return;
    const obs = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      }
    }, { rootMargin: '-80px 0% -60% 0%' });
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [selectedStats, selectedId]);

  // 按时间范围过滤订单（基于 AnalysisContext 的 timeFilter）
  const timeFilteredOrders = useMemo(() => {
    const { rangeA } = timeFilter;
    return orders.filter(o => {
      const payTime = String(findField(o, '支付时间', '付款时间', '支付日期') || '').trim();
      if (!payTime) return true;
      const datePart = payTime.split(' ')[0];
      return datePart >= rangeA.start && datePart <= rangeA.end;
    });
  }, [orders, timeFilter]);

  // 时间过滤后的推广产品数据（必须先于 timeFilteredDailySales 声明）
  const timeFilteredPromoProducts = useMemo(() => {
    const allPromo = currentDisplayData?.promotionProducts || [];
    const { rangeA } = timeFilter;
    return allPromo.filter((p: any) => {
      const d = String(p['日期'] || '').slice(0, 10);
      return d >= rangeA.start && d <= rangeA.end;
    });
  }, [currentDisplayData, timeFilter]);

  // 时间过滤后的每日销售数据（从timeFilteredOrders聚合所有指标）
  const timeFilteredDailySales = useMemo(() => {
    if (!selectedId) return [];
    const { rangeA } = timeFilter;
    const productOrds = timeFilteredOrders.filter(o =>
      String(findField(o, '商品ID', '商品编号') || '') === selectedId
    );
    const daily: Record<string, any> = {};
    productOrds.forEach(o => {
      const d = String(findField(o, '支付时间', '付款时间', '支付日期') || '').slice(0, 10);
      if (!d || d < rangeA.start || d > rangeA.end) return;
      if (!daily[d]) daily[d] = { date: d, sales: 0, gmv: 0, revenue: 0, profit: 0, refund: 0, orders: 0 };
      daily[d].sales += parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1;
      daily[d].gmv += parseFloat(findField(o, '商品总价(元)', '商品总价', '商品金额') || '0') || 0;
      daily[d].revenue += parseFloat(findField(o, '商家实收金额(元)', '商家实收', '实收金额') || '0') || 0;
      daily[d].refund += parseFloat(findField(o, '退款金额(元)', '退款金额', '退款') || '0') || 0;
      daily[d].orders++;
    });
    const promoForProduct = timeFilteredPromoProducts.filter((p: any) => String(findField(p, '商品ID', '商品编号') || '') === selectedId);
    const promoByDate: Record<string, number> = {};
    promoForProduct.forEach((p: any) => {
      const d = String(findField(p, '日期') || '').slice(0, 10);
      promoByDate[d] = (promoByDate[d] || 0) + (parseFloat(findField(p, '成交花费(元)', '总花费(元)', '花费(元)') || '0') || 0);
    });
    // 估算每日商品成本 = GMV × 30%（默认成本比例）
    Object.values(daily).forEach((d: any) => {
      const promo = promoByDate[d.date] || 0;
      const estProductCost = d.gmv * 0.30;
      d.profit = d.revenue - d.refund - promo - estProductCost;
    });
    return Object.values(daily).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [selectedId, timeFilteredOrders, timeFilteredPromoProducts, timeFilter]);

  // ─── 小时级数据 ───────────────────────────────────
  const hourlyData = useMemo(() => {
    if (!selectedId || timeGranularity !== 'hour') return [];
    const productOrds = timeFilteredOrders.filter(o =>
      String(findField(o, '商品ID', '商品编号') || '') === selectedId
    );
    const hourly: Record<string, { hour: string; orders: number; gmv: number; sales: number; revenue: number; refund: number }> = {};
    productOrds.forEach(o => {
      const payTime = String(findField(o, '支付时间', '付款时间', '支付日期') || '');
      const hour = payTime.slice(11, 13) || '00';
      if (!/^\d{2}$/.test(hour)) return;
      if (!hourly[hour]) hourly[hour] = { hour: hour + ':00', orders: 0, gmv: 0, sales: 0, revenue: 0, refund: 0 };
      hourly[hour].orders++;
      hourly[hour].gmv += parseFloat(findField(o, '商品总价(元)', '商品总价', '商品金额') || '0') || 0;
      hourly[hour].sales += parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1;
      hourly[hour].revenue += parseFloat(findField(o, '商家实收金额(元)', '商家实收', '实收金额') || '0') || 0;
      hourly[hour].refund += parseFloat(findField(o, '退款金额(元)', '退款金额', '退款') || '0') || 0;
    });
    return Object.values(hourly).sort((a: any, b: any) => a.hour.localeCompare(b.hour));
  }, [selectedId, timeFilteredOrders, timeGranularity]);

  // ─── 按时间粒度聚合趋势数据 ─────────────────────
  const localTrendData = useMemo(() => {
    if (!selectedId) return [];
    if (timeGranularity === 'hour') return hourlyData.map((h: any) => ({ ...h, date: h.hour }));
    if (timeGranularity === 'week') {
      const weekly: Record<string, any> = {};
      timeFilteredDailySales.forEach((d: any) => {
        const dt = new Date(d.date);
        const monday = new Date(dt);
        monday.setDate(dt.getDate() - dt.getDay() + 1);
        const wk = monday.toISOString().slice(0, 10);
        if (!weekly[wk]) weekly[wk] = { date: wk, sales: 0, gmv: 0, revenue: 0, profit: 0, refund: 0, orders: 0 };
        weekly[wk].sales += d.sales;
        weekly[wk].gmv += d.gmv;
        weekly[wk].revenue += d.revenue;
        weekly[wk].profit += d.profit;
        weekly[wk].refund += d.refund;
        weekly[wk].orders += d.orders;
      });
      return Object.values(weekly).sort((a: any, b: any) => a.date.localeCompare(b.date));
    }
    return timeFilteredDailySales;
  }, [selectedId, timeFilteredDailySales, hourlyData, timeGranularity]);

  // 从时间过滤订单重新计算 KPI 汇总
  const timeFilteredKpis = useMemo(() => {
    if (!selectedId) return null;
    const ords = timeFilteredOrders.filter(o =>
      String(findField(o, '商品ID', '商品编号') || '') === selectedId
    );
    const sum = (key: string) => ords.reduce((s, o) => s + (parseFloat(o[key]) || 0), 0);
    const cnt = (key: string) => ords.filter(o => {
      const v = o[key]; return v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim() !== '0';
    }).length;
    const totalGmv = sum('商品总价(元)');
    const totalRevenue = sum('商家实收金额(元)');
    const totalOrders = ords.length;
    const totalSales = ords.reduce((s, o) => s + (parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1), 0);
    const totalRefund = sum('退款金额(元)');
    const refundCnt = ords.filter(o => parseFloat(findField(o, '退款金额(元)', '退款金额', '退款') || '0') > 0).length;
    const promoCost = timeFilteredPromoProducts
      .filter((p: any) => String(p['商品ID'] || '') === selectedId)
      .reduce((s: number, p: any) => s + (parseFloat(p['总花费(元)'] || p['花费(元)'] || '0')), 0);
    const promoGmv = timeFilteredPromoProducts
      .filter((p: any) => String(p['商品ID'] || '') === selectedId)
      .reduce((s: number, p: any) => s + (parseFloat(p['交易额(元)'] || '0')), 0);
    return {
      gmv: totalGmv, revenue: totalRevenue, orders: totalOrders, sales: totalSales,
      refund: totalRefund, refundCount: refundCnt,
      refundRate: totalOrders > 0 ? (refundCnt / totalOrders) * 100 : 0,
      profitRate: totalRevenue > 0 ? ((totalRevenue - promoCost - totalRefund) / totalRevenue) * 100 : 0,
      roi: promoCost > 0 ? promoGmv / promoCost : 0,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      promoCost, promoGmv,
      turnoverDays: selectedStats?.turnoverDays ?? 0,
    };
  }, [selectedId, timeFilteredOrders, timeFilteredPromoProducts, selectedStats]);

  // 筛选该商品的订单（加上时间过滤）
  const productOrders = useMemo(() => {
    if (!selectedId) return [];
    return timeFilteredOrders.filter(o => {
      const oId = String(findField(o, '商品ID', '商品编号', 'productId') || '');
      return oId === selectedId;
    });
  }, [timeFilteredOrders, selectedId]);

  // 时间过滤后的售后数据
  const timeFilteredAfterSales = useMemo(() => {
    const { rangeA } = timeFilter;
    return afterSaleRecords.filter(r => {
      const dateStr = String(r['申请时间'] || r['售后创建时间'] || '').slice(0, 10);
      if (!dateStr) return true;
      return dateStr >= rangeA.start && dateStr <= rangeA.end;
    });
  }, [afterSaleRecords, timeFilter]);

  // ─── 增强计算 #1：SKU 深度矩阵 ─────────────────────────────
  const skuDeepMatrix = useMemo(() => {
    if (!selectedId) return [];
    const skuFields = ['商家编码-规格维度', '商家编码-SKU维度', '规格编码', 'SKU编码', '规格id', 'sku_code'];
    const specFields = ['商品规格', '规格', '商品属性', 'spec'];

    // 按SKU分组商品订单
    const skuMap: Record<string, { skuId: string; spec: string; sales: number; revenue: number; gmv: number; orderCount: number; orderNos: Set<string> }> = {};
    productOrders.forEach(o => {
      const skuId = findField(o, ...skuFields) || '默认规格';
      const spec = findField(o, ...specFields) || '';
      const key = `${skuId}|${spec}`;
      if (!skuMap[key]) skuMap[key] = { skuId, spec, sales: 0, revenue: 0, gmv: 0, orderCount: 0, orderNos: new Set() };
      skuMap[key].sales += Number(findField(o, '商品数量(件)', '商品数量', '交易数量', '数量') ?? 1) || 1;
      skuMap[key].revenue += Number(findField(o, '商家实收金额(元)', '商家实收', '实收金额', '成交金额', '支付金额') || 0) || 0;
      skuMap[key].gmv += Number(findField(o, '订单金额', '商品总价(元)', '商品原价金额', '支付金额') || 0) || 0;
      skuMap[key].orderCount++;
      const orderNo = findField(o, '订单号', '订单编号') || '';
      if (orderNo) skuMap[key].orderNos.add(String(orderNo));
    });

    // 从售后记录中统计每个SKU的退款
    const orderNoToSkuKey: Record<string, string> = {};
    productOrders.forEach(o => {
      const orderNo = String(findField(o, '订单号', '订单编号') || '');
      if (!orderNo) return;
      const skuId = findField(o, ...skuFields) || '默认规格';
      const spec = findField(o, ...specFields) || '';
      orderNoToSkuKey[orderNo] = `${skuId}|${spec}`;
    });

    const skuRefundMap: Record<string, { refundCount: number; refundAmount: number; refundDays: number[]; reasons: Record<string, number> }> = {};
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const productAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId);
    productAfterSales.forEach(r => {
      const orderNo = String(findField(r, '订单号', '订单编号') || '');
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
      const payDateStr = productOrders.find(o => String(findField(o, '订单号', '订单编号') || '') === orderNo)?.['支付时间'] || '';
      if (applyDate.getTime() > 0 && payDateStr) {
        const payDate = new Date(payDateStr);
        if (payDate.getTime() > 0) skuRefundMap[matchedKey].refundDays.push(Math.round((applyDate.getTime() - payDate.getTime()) / 86400000));
      }
    });

    // 组装输出
    const totalSales = Object.values(skuMap).reduce((s, v) => s + v.sales, 0);
    const totalRevenue = Object.values(skuMap).reduce((s, v) => s + v.revenue, 0);
    // 推广费汇总（按商品匹配）
    const totalPromoCost = timeFilteredPromoProducts
      .filter((p: any) => String(p['商品ID'] || '') === selectedId)
      .reduce((s: number, p: any) => s + (parseFloat(p['总花费(元)'] || p['花费(元)'] || '0') || 0), 0);
    const meanRefundRate = Object.values(skuRefundMap).reduce((s, v) => s + (v.refundCount / Math.max(Object.values(skuMap).find(m => Object.keys(skuRefundMap).length > 0) ? 1 : 1)), 0) / Math.max(Object.keys(skuMap).length, 1);

    return Object.entries(skuMap).map(([key, info]) => {
      const refund = skuRefundMap[key] || { refundCount: 0, refundAmount: 0, refundDays: [] as number[], reasons: {} as Record<string, number> };
      const refundRate = info.orderCount > 0 ? (refund.refundCount / info.orderCount) * 100 : 0;
      const avgRefundDays = refund.refundDays.length > 0 ? refund.refundDays.reduce((a, b) => a + b, 0) / refund.refundDays.length : 0;
      const topRefundReason = Object.entries(refund.reasons || {}).sort((a, b) => b[1] - a[1])[0]?.[0];
      // SKU成本：productId_skuId 优先，productId 兜底
      const skuKey = `${selectedId}_${info.skuId}`;
      const skuCost = productCosts?.[skuKey] ?? productCosts?.[selectedId];
      // 推广费按SKU销量占比分摊
      const skuPromoCost = totalPromoCost > 0 ? (info.sales / Math.max(totalSales, 1)) * totalPromoCost : 0;
      // 订单级费用按订单数分摊（平台佣金+运费险按实收比例）
      const totalPlatformFee = (currentDisplayData?.financialRecords || [])
        .filter((f: any) => String(f['业务描述'] || '').includes('技术服务费'))
        .reduce((s: number, f: any) => s + (parseFloat(f['支出金额（-元）'] || f['支出金额(元)'] || '0') || 0), 0);
      const skuPlatformFee = info.revenue > 0 && totalRevenue > 0 ? (info.revenue / totalRevenue) * totalPlatformFee : 0;
      const totalProfit = info.revenue > 0 && skuCost != null
        ? info.revenue - skuCost * info.sales - refund.refundAmount - skuPromoCost - skuPlatformFee - (info.orderCount * 1.5) - (info.orderCount * 3.0)
        : undefined;
      const profitRate = info.revenue > 0 && totalProfit != null ? (totalProfit / info.revenue) * 100 : undefined;
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
        totalProfit,
        orderCount: info.orderCount,
        isHighRefund: refundRate > meanRefundRate * 2,
        isMainSku: totalSales > 0 && (info.sales / totalSales) > 0.5,
      };
    }).sort((a, b) => b.sales - a.sales).slice(0, 15);
  }, [selectedId, productOrders, timeFilteredAfterSales, productCosts]);

  // ─── 增强计算 #2：退款原因 TOP10 ────────────────────────────
  const refundReasonAnalysis = useMemo(() => {
    if (!selectedId) return [];
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const productAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId);
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
  }, [selectedId, timeFilteredAfterSales]);

  // ─── 增强计算 #3：退款时间窗口 ──────────────────────────────
  const refundTimeWindow = useMemo(() => {
    if (!selectedId) return { windows: [], skippedNoPay: 0, skippedNoApply: 0 };
    // 构建orderNo→支付时间 Map
    const orderPayMap: Record<string, string> = {};
    allOrders.forEach(o => {
      const orderNo = String(findField(o, '订单号', '订单编号') || '');
      const payTime = findField(o, '支付时间', '订单支付时间', '付款时间', '支付日期') || '';
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
    const productAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId);

    productAfterSales.forEach(r => {
      const applyTime = r['申请时间'] || r['售后创建时间'] || r['退款申请时间'] || '';
      if (!applyTime) { skippedNoApply++; return; }
      const orderNo = String(findField(r, '订单号', '订单编号') || '');
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
  }, [selectedId, allOrders, timeFilteredAfterSales]);

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
      const orderNo = String(findField(o, '订单号', '订单编号') || '');
      if (orderNo) orderNoToProvince[orderNo] = prov;
    });

    // 按省统计售后
    const provinceAfterSales: Record<string, { count: number; amount: number }> = {};
    const productAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId);
    productAfterSales.forEach(r => {
      const orderNo = String(findField(r, '订单号', '订单编号') || '');
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
  }, [selectedId, allOrders, timeFilteredAfterSales]);

  // ─── 增强计算 #5：CM1/CM2/CM3 贡献度分层 ──────────────────
  const cmLayers = useMemo(() => {
    if (!selectedStats) return null;
    const cb = selectedStats.costBreakdown || {} as CostBreakdown;
    const gmv = selectedStats.gmv || 1;
    // 注意：商家实收已扣平台费，CM 公式不含 platformFee
    const cm1 = (selectedStats.revenue || 0) - (cb.productCost || 0) - (selectedStats.discount || 0) - (selectedStats.refund || 0);
    const cm2 = cm1 - (cb.insuranceFee || 0) - ((cb.packagingFee || 0) + (cb.shippingFee || 0));
    const cm3 = cm2 - (selectedStats.promoCost || 0);
    return {
      cm1: { name: 'CM1 产品力', value: cm1, pct: (cm1 / gmv) * 100, positive: cm1 >= 0, desc: '实收 - 成本 - 折扣 - 退款' },
      cm2: { name: 'CM2 履约力', value: cm2, pct: (cm2 / gmv) * 100, positive: cm2 >= 0, desc: 'CM1 - 运费险 - 包装快递' },
      cm3: { name: 'CM3 增长效率', value: cm3, pct: (cm3 / gmv) * 100, positive: cm3 >= 0, desc: 'CM2 - 推广花费' },
    };
  }, [selectedStats]);

  // ─── 增强计算 #2b：全店退款原因TOP10（用于对比）────────────
  const storeRefundReasonAnalysis = useMemo(() => {
    if (!selectedId || comparisonMode === 'none') return [];
    const reasonFields = ['退款原因', '售后原因', '售后类型', '原因', 'reason'];
    const otherAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') !== selectedId);
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
  }, [selectedId, timeFilteredAfterSales, comparisonMode]);

  // ─── 增强计算 #7a：运营事件节点检测 ──────────────────────
  const eventMarkers = useMemo(() => {
    const markers: { date: string; label: string; color: string; type: string }[] = [];
    if (!selectedId || productOrders.length === 0) return markers;

    // 1. 推广开始日：从 promotionProducts 中找该商品最早有花费的日期
    const promoData = (currentDisplayData?.promotionProducts || []);
    const productPromo = promoData.filter((p: any) =>
      String(p['商品ID'] || p['商品id'] || '') === selectedId && parseFloat(p['总花费(元)'] || p['花费(元)'] || '0') > 0
    );
    if (productPromo.length > 0) {
      const promoDates = productPromo.map((p: any) => String(p['日期'] || '').slice(0, 10)).filter(Boolean).sort();
      if (promoDates[0]) markers.push({ date: promoDates[0], label: '推广开始', color: '#7c3aed', type: 'promo' });
    }

    // 2. SKU级价格变动检测：按SKU分组取单价，任意SKU价格变化>15%标记
    const skuPrices: Record<string, Record<string, number[]>> = {}; // skuId -> date -> prices[]
    productOrders.forEach(o => {
      const date = String(findField(o, '支付时间', '付款时间', '支付日期') || '').slice(0, 10);
      if (!date) return;
      const skuId = findField(o, '商家编码-SKU维度', '规格编码', 'SKU编码') || '默认';
      const price = parseFloat(findField(o, '商品单价(元)', '商品单价') || '0') || (parseFloat(findField(o, '商家实收金额(元)', '商家实收', '实收金额') || '0') / Math.max(1, parseFloat(findField(o, '商品数量(件)', '商品数量', '数量') || '1')));
      if (!price || price <= 0) return;
      if (!skuPrices[skuId]) skuPrices[skuId] = {};
      if (!skuPrices[skuId][date]) skuPrices[skuId][date] = [];
      skuPrices[skuId][date].push(price);
    });
    const markedDates = new Set<string>();
    Object.entries(skuPrices).forEach(([skuId, datePrices]) => {
      const sortedDates = Object.keys(datePrices).sort();
      for (let i = 1; i < sortedDates.length; i++) {
        const prevPrices = datePrices[sortedDates[i-1]];
        const currPrices = datePrices[sortedDates[i]];
        const prevAvg = prevPrices.reduce((a,b) => a+b, 0) / prevPrices.length;
        const currAvg = currPrices.reduce((a,b) => a+b, 0) / currPrices.length;
        const pctChange = ((currAvg - prevAvg) / prevAvg) * 100;
        if (Math.abs(pctChange) > 15 && !markedDates.has(sortedDates[i])) {
          markedDates.add(sortedDates[i]);
          const dir = pctChange > 0 ? '↑' : '↓';
          markers.push({
            date: sortedDates[i],
            label: `${skuId.length>8?skuId.slice(-6):skuId}调价${dir}${Math.abs(pctChange).toFixed(0)}%`,
            color: pctChange > 0 ? '#16a34a' : SEMANTIC.loss,
            type: 'price'
          });
        }
      }
    });

    // 3. 百亿补贴检测：从货款明细中找 0030002/0030003 扣费发生的日期
    const financials = currentDisplayData?.financialRecords || [];
    let subsidyDate = '';
    for (const f of financials) {
      const desc = String(f['业务描述'] || '');
      if (desc.startsWith('0030002') || desc.startsWith('0030003')) {
        const finDate = String(f['发生时间'] || '').slice(0, 10);
        if (finDate && (!subsidyDate || finDate < subsidyDate)) subsidyDate = finDate;
      }
    }
    if (subsidyDate) markers.push({ date: subsidyDate, label: '百亿补贴', color: '#f97316', type: 'subsidy' });

    return markers.sort((a, b) => a.date.localeCompare(b.date));
  }, [selectedId, productOrders, currentDisplayData]);

  // 利润核算数据（用于 ProfitBreakdownDrawer）
  const profitBreakdownData = useMemo(() => {
    if (!selectedId) return null;
    const ords = productOrders;
    const totalGmv = ords.reduce((s, o) => s + (parseFloat(findField(o, '商品总价(元)', '商品总价', '商品金额') || '0') || 0), 0);
    const totalRevenue = ords.reduce((s, o) => s + (parseFloat(findField(o, '商家实收金额(元)', '商家实收', '实收金额') || '0') || 0), 0);
    const totalItems = ords.reduce((s, o) => s + (parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1), 0);
    const totalOrders = ords.length;
    // 从 SKU 成本配置汇总商品成本
    let totalProductCost = 0;
    ords.forEach(o => {
      const skuId = findField(o, '商家编码-SKU维度', '规格编码', 'SKU编码') || '';
      const pid = String(findField(o, '商品ID', '商品编号') || '');
      const skuKey = skuId ? `${pid}_${skuId}` : pid;
      const qty = parseInt(findField(o, '商品数量(件)', '商品数量', '数量') || '1') || 1;
      const unitCost = productCosts?.[skuKey] ?? productCosts?.[pid] ?? 0;
      totalProductCost += unitCost * qty;
    });
    // 推广费
    const promoForProduct = timeFilteredPromoProducts.filter((p: any) => String(p['商品ID'] || '') === selectedId);
    const totalPromoCost = promoForProduct.reduce((s: number, p: any) => s + (parseFloat(p['总花费(元)'] || '0') || 0), 0);
    // 运费险
    const totalInsurance = (currentDisplayData?.shippingInsurance || [])
      .filter((r: any) => ords.some(o => String(findField(o, '订单号') || '') === String(findField(r, '订单号', '订单编号') || '')))
      .reduce((s: number, r: any) => s + (parseFloat(r['服务费用（元）'] || r['服务费用(元)'] || r['保费（元）'] || '0') || 0), 0);
    // 平台佣金统计（仅供参考，已含在商家实收中）
    const estPlatformFee = totalRevenue * ((platformCommissionRate || 0) / 100);
    const actualPlatformFee = (currentDisplayData?.financialRecords || [])
      .filter((f: any) => ords.some(o => String(findField(o, '订单号') || '') === String(findField(f, '商户订单号', '订单号', '订单编号') || '')))
      .filter((f: any) => String(f['业务描述'] || '').includes('技术服务费'))
      .reduce((s: number, f: any) => s + (parseFloat(f['支出金额（-元）'] || f['支出金额(元)'] || '0') || 0), 0);
    // 罚款
    const totalPenalties = (currentDisplayData?.financialRecords || [])
      .filter((f: any) => ords.some(o => String(findField(o, '订单号') || '') === String(findField(f, '商户订单号', '订单号', '订单编号') || '')))
      .filter((f: any) => { const d = String(f['业务描述'] || ''); return d.startsWith('004') || d.startsWith('006'); })
      .reduce((s: number, f: any) => s + (parseFloat(f['支出金额（-元）'] || f['支出金额(元)'] || '0') || 0), 0);
    // 包装费+快递费（按配置估算）
    const pkgFee = totalOrders * 1.5;
    const shipFee = totalOrders * 3.0;

    return { gmv: totalGmv, revenue: totalRevenue, productCost: totalProductCost, packagingFee: pkgFee, shippingFee: shipFee,
      promoCost: totalPromoCost, platformFee: actualPlatformFee || estPlatformFee, insuranceFee: totalInsurance,
      penaltyFee: totalPenalties, orderCount: totalOrders, itemCount: totalItems };
  }, [selectedId, productOrders, productCosts, timeFilteredPromoProducts, currentDisplayData]);

  // 异常检测
  const anomalyAlerts = useMemo(() => {
    if (!timeFilteredDailySales?.length) return [];
    const gmvData = timeFilteredDailySales.map((d: any) => ({ date: d.date, value: d.gmv || 0 }));
    return detectAnomalies(gmvData, 'GMV', 14);
  }, [timeFilteredDailySales]);

  // ─── 选中指标驱动图表（★ 必须在所有早期 return 之前声明）────
  const [activeMetrics, setActiveMetrics] = useState<string[]>(['gmv', 'revenue', 'profit']);

  const toggleMetric = (key: string) => {
    setActiveMetrics(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // ─── 增强计算 #7：退款日趋势（替代假数据）──────────────────
  const refundDailyTrend = useMemo(() => {
    if (!selectedId) return { trend: [], spikeDays: [] as string[] };
    const productAfterSales = timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId);

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
      const dateStr = String(findField(o, '支付时间', '订单支付时间', '付款时间', '订单创建时间') || '').slice(0, 10);
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
  }, [selectedId, timeFilteredAfterSales, productOrders]);

  // ★★★ 服务端数据覆盖：当服务器返回数据时，优先使用服务器计算结果（必须放在 enhancedDiagnoses 之前，因为 enhancedDiagnoses 引用了 finalRefundWindows）
  const finalTrendData = serverDeepData?.trendData?.length ? serverDeepData.trendData : localTrendData;
  const finalHourlyData = serverDeepData?.hourlyData?.length ? serverDeepData.hourlyData : hourlyData;
  const finalSkuMatrix = serverDeepData?.skuMatrix?.length ? serverDeepData.skuMatrix : skuDeepMatrix;
  const finalRefundReasons = serverDeepData?.refundAnalysis?.byReason?.length ? serverDeepData.refundAnalysis.byReason : refundReasonAnalysis;
  const finalRefundWindows = serverDeepData?.refundAnalysis?.timeWindow?.length
    ? { windows: serverDeepData.refundAnalysis.timeWindow, skippedNoPay: 0, skippedNoApply: 0 }
    : refundTimeWindow;
  const finalAnomalies = serverDeepData?.anomalies?.length ? serverDeepData.anomalies : anomalyAlerts;
  const finalProfitWaterfall = serverDeepData?.profitWaterfall?.length ? serverDeepData.profitWaterfall : profitBreakdownData;

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
    if (finalRefundWindows.windows.length > 0) {
      const win07 = finalRefundWindows.windows.find((w: any) => w.label === '0-7天');
      const total = finalRefundWindows.windows.reduce((s: number, w: any) => s + w.count, 0);
      if (win07 && total > 0 && (win07.count / total) > 0.5) {
        extras.push({ priority: 'urgent', title: '快速退款占比偏高', description: `0-7天内退款占比${((win07.count / total) * 100).toFixed(0)}%，可能存在商品质量问题或描述不符，建议检查详情页准确性和商品品质。`, icon: <Clock size={14} />, color: SEMANTIC.loss, bg: 'rgba(239,68,68,0.08)' });
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
    if (comparisonMode === 'none') return null;
    if (comparisonMode === 'prevPeriod' && prevStats) {
      const pv = (prevStats as any)[metric];
      if (pv != null) return { label: '上周期', value: pv, lowIsGood: false };
      return null;
    }
    if (!storeBenchmark) return null;
    const bm = storeBenchmark as any;
    const entry = bm[metric];
    if (!entry) return null;
    if (comparisonMode === 'storeAvg') return { label: '店铺均值', value: entry.avg, lowIsGood: entry.lowIsGood };
    if (comparisonMode === 'topProduct') return { label: 'TOP20%', value: entry.top20, lowIsGood: entry.lowIsGood };
    return null;
  }, [comparisonMode, storeBenchmark, prevStats]);

  const diagnoses = enhancedDiagnoses;

  if (!isOpen) return null;

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + el.closest('.overflow-y-auto')?.scrollTop! - 20;
    el.closest('.overflow-y-auto')?.scrollTo({ top: y, behavior: 'smooth' });
  };

  // ★ 服务端数据覆盖（其余 final* 已在 enhancedDiagnoses 前定义）
  const finalStoreBenchmark = serverDeepData?.storeBenchmark ? serverDeepData.storeBenchmark : storeBenchmark;
  const finalClassification = serverDeepData?.productClassification ? serverDeepData.productClassification : null;
  const finalRankings = serverDeepData?.rankings ? serverDeepData.rankings : null;
  const finalFunnel = serverDeepData?.funnel ? serverDeepData.funnel : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.2 }}
          onClick={e => e.stopPropagation()}
          className="absolute inset-3 bg-pdd-bg/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* ═══════════════════════════════════════ 顶栏 ═══════════════════════════════════════ */}
          <div className="shrink-0 bg-pdd-card border-b border-pdd-border px-4 py-2.5 flex items-center gap-3">
            <Button variant="ghost" size="sm" className="p-1.5 h-auto shrink-0" onClick={onClose}>
              <X size={16} />
            </Button>

            <div className="relative flex-1 max-w-[240px]">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pdd-text-secondary/50" />
              <Input type="text" placeholder="搜索商品..."
                value={search} onChange={e => { setSearch(e.target.value); setShowSidebar(true); }}
                onFocus={() => setShowSidebar(true)}
                className="pl-7 h-8 text-xs" />
            </div>

            {serverLoading && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-pdd-primary border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium" style={{ color: CHART.all[0] }}>正在从服务器加载数据...</span>
              </div>
            )}
            {!serverLoading && selectedStats && (
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-bold text-pdd-text truncate max-w-[200px]">{selectedStats.productName}</span>
                <span className="text-[10px] font-mono bg-pdd-bg/80 px-1.5 py-0.5 rounded" style={{ color: SEMANTIC.neutral }}>{selectedStats.productCode || selectedId}</span>
              </div>
            )}
            {!serverLoading && !selectedStats && selectedId && (
              <span className="text-xs font-medium" style={{ color: SEMANTIC.warning }}>⏳ 正在计算商品数据，请稍候...</span>
            )}
            {!serverLoading && !selectedStats && !selectedId && (
              <span className="text-xs italic" style={{ color: SEMANTIC.neutral }}>← 从左侧列表选择商品开始深度分析</span>
            )}

            <div className="flex-1" />

            {/* 时间粒度 */}
            <div className="flex items-center bg-pdd-bg rounded-lg p-0.5 gap-0.5">
              {(['hour', 'day', 'week'] as const).map(g => (
                <Badge key={g} variant={timeGranularity === g ? 'default' : 'outline'}
                  className="px-2.5 py-1 text-[10px] cursor-pointer rounded-md"
                  onClick={() => setTimeGranularity(g)}>
                  {{ hour: '时', day: '日', week: '周' }[g]}
                </Badge>
              ))}
            </div>

            {/* 对比模式 */}
            <Select value={comparisonMode} onValueChange={v => setComparisonMode(v as any)}>
              <SelectTrigger className="w-[110px] h-7 text-[10px] rounded-lg">
                <SelectValue placeholder="对比模式" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="storeAvg" className="text-xs">vs 店铺均值</SelectItem>
                <SelectItem value="topProduct" className="text-xs">vs TOP20%</SelectItem>
                <SelectItem value="prevPeriod" className="text-xs">vs 上周期</SelectItem>
                <SelectItem value="none" className="text-xs">无对比</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="ghost" size="sm" className="p-1.5 h-auto shrink-0 text-pdd-text-secondary/50" onClick={() => setShowSidebar(!showSidebar)}>
              <Layers size={14} />
            </Button>
          </div>

          {/* ═══════════════════════════════════════ 主体 ═══════════════════════════════════════ */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左侧商品面板 */}
            <AnimatePresence>
              {showSidebar && (
                <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 260, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                  className="shrink-0 border-r border-pdd-border bg-pdd-card flex flex-col overflow-hidden">
                  <div className="p-2.5 border-b border-pdd-border">
                    <div className="flex items-center gap-0.5 bg-pdd-bg/50 rounded-lg p-0.5">
                      {(['all', 'champion', 'profit', 'hidden', 'dead'] as const).map(k => (
                        <Badge key={k} variant={filter === k ? 'default' : 'outline'}
                          className="flex-1 py-1 text-[10px] cursor-pointer rounded-md text-center"
                          onClick={() => setFilter(k)}>
                          {{ all: '全部', champion: '爆品', profit: '利润', hidden: '潜力', dead: '滞销' }[k]}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {filteredProducts.map(p => {
                      const pos = productStats[p.id] ? classifyProduct(productStats[p.id], productStats) : null;
                      return (
                        <button key={p.id} onClick={() => { setSelectedId(p.id); setShowSidebar(false); }}
                          className={`w-full text-left px-3 py-2.5 border-b border-pdd-border hover:bg-indigo-50/30 transition-colors ${
                            selectedId === p.id ? 'bg-indigo-50/50 border-l-2 border-l-indigo-400' : ''}`}>
                          <div className="flex items-center gap-1.5">
                            {pos && <span className="text-[10px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: pos.typeBg, color: pos.typeColor }}>{pos.type}</span>}
                            <span className="text-xs font-medium text-pdd-text truncate flex-1">{p.name || p.id}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-pdd-text-secondary/50" style={{ fontSize: '9px' }}>
                            <span className="font-mono">{p.id}</span>
                            <span>GMV ¥{fmt(p.gmv)}</span>
                            {p.roi > 0 && <span className={p.roi >= 2 ? 'text-green-500' : 'text-red-400'}>ROI {p.roi.toFixed(1)}</span>}
                          </div>
                        </button>
                      );
                    })}
                    {filteredProducts.length === 0 && <div className="p-4 text-xs text-pdd-text-secondary/50 text-center">无匹配商品</div>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 右侧分析主内容 — 单页滚动 */}
            <div className="flex-1 overflow-y-auto relative">
              {serverLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-pdd-text-secondary/50 gap-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <BarChart3 size={36} className="text-indigo-300" />
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 border-3 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-semibold text-indigo-600 mb-1">服务器计算中</div>
                    <div className="text-xs text-pdd-text-secondary/50">正在拉取商品深度数据，请稍候...</div>
                  </div>
                  <div className="flex gap-1.5">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-2 h-2 rounded-full bg-indigo-300 animate-bounce" style={{animationDelay: `${i*0.15}s`}} />
                    ))}
                  </div>
                </div>
              ) : !selectedStats ? (
                <div className="h-full flex flex-col items-center justify-center text-pdd-text-secondary/50 gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-pdd-bg/80 flex items-center justify-center">
                    <Search size={28} className="opacity-30" />
                  </div>
                  <div className="text-center">
                    <div className="text-sm font-medium text-pdd-text-secondary mb-1">{selectedId ? '暂无该商品数据' : '选择商品开始分析'}</div>
                    <div className="text-xs text-pdd-text-secondary/50">{selectedId ? '请确认该商品有订单数据，或刷新页面重试' : '搜索或从左侧列表选择'}</div>
                  </div>
                  {!showSidebar && <button onClick={() => setShowSidebar(true)} className="text-xs text-indigo-500 hover:text-indigo-600 underline">打开商品列表</button>}
                </div>
              ) : (
                <div className="p-5 space-y-5 max-w-[1280px] mx-auto pb-20">
                  <AnalysisControlBar />

                  {/* ═══════════ ① 数据驾驶舱：指标选择器 + 主趋势图 ═══════════ */}
                  <section id="sec-overview">
                    {finalAnomalies.length > 0 && <div className="mb-3"><AnomalyBanner anomalies={finalAnomalies} /></div>}

                    {/* ── 交互式指标选择器（替代静态KPI卡片）── */}
                    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4 mb-4">
                      <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-bold text-pdd-text flex items-center gap-2">
                          <TrendingUp size={14} color="#16a34a" />
                          指标趋势 · 点击指标切换图表数据
                        </h2>
                        <div className="flex items-center gap-1.5 text-[10px] text-pdd-text-secondary/50">
                          <Info size={11} />
                          点击数据点看当天明细
                        </div>
                      </div>

                      {/* 指标选择芯片 */}
                      <div className="flex flex-wrap items-center gap-2 mb-3">
                        {[
                          { key: 'gmv', label: 'GMV', val: fmtMoney(selectedStats.gmv), formula: '商品总价(元) 求和', color: SEMANTIC.loss, icon: <ShoppingCart size={11} /> },
                          { key: 'revenue', label: '商家实收', val: fmtMoney(selectedStats.revenue), formula: '商家实收金额(元) 求和 · 已扣平台佣金', color: '#16a34a', icon: <DollarSign size={11} /> },
                          { key: 'profit', label: '净利润(估)', val: fmtMoney(selectedStats.netProfit), formula: '实收 − 商品成本 − 推广 − 退款 − 运费险 − 包装快递 − 税费', color: '#7c3aed', icon: <BarChart3 size={11} /> },
                          { key: 'sales', label: '销量', val: fmt(selectedStats.sales), formula: '商品数量(件) 求和', color: '#f97316', icon: <Package size={11} /> },
                          { key: 'orders', label: '订单数', val: fmt(selectedStats.orders), formula: '订单行数 COUNT', color: '#0891b2', icon: <Hash size={11} /> },
                          { key: 'refund', label: '退款', val: fmtMoney(selectedStats.refund), formula: '退款金额(元) 求和 + 售后退款(去重)', color: '#ef4444', icon: <RotateCcw size={11} /> },
                          { key: 'refundRate', label: '退款率', val: fmtPct(selectedStats.refundRate), formula: '退款笔数 ÷ 订单数 × 100', color: '#f59e0b', icon: <Percent size={11} /> },
                        ].map(m => {
                          const isActive = activeMetrics.includes(m.key);
                          return (
                            <button key={m.key}
                              onClick={() => toggleMetric(m.key)}
                              className={`group relative flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-left ${
                                isActive
                                  ? 'border-current shadow-sm'
                                  : 'border-pdd-border hover:border-pdd-border opacity-60 hover:opacity-100'
                              }`}
                              style={isActive ? { borderColor: m.color, backgroundColor: m.color + '08' } : {}}>
                              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: m.color + '18' }}>
                                <span style={{ color: m.color }}>{m.icon}</span>
                              </span>
                              <div>
                                <div className="text-[10px] text-pdd-text-secondary/50">{m.label}</div>
                                <div className="text-xs font-bold font-mono" style={{ color: isActive ? m.color : 'var(--pdd-text)' }}>{m.val}</div>
                              </div>
                              {isActive && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full" style={{ backgroundColor: m.color }} />}
                            </button>
                          );
                        })}
                      </div>

                      {/* 主趋势图：只显示选中的指标 */}
                      {finalTrendData.length > 0 ? (
                        <div>
                          <ResponsiveContainer width="100%" height={320}>
                            {timeGranularity === 'hour' ? (
                              <BarChart data={finalTrendData} onClick={(d: any) => d?.activePayload && setDetailChartPoint({ date: d.activePayload[0]?.payload?.date, data: d.activePayload[0]?.payload })}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                                {activeMetrics.includes('gmv') && <Bar dataKey="gmv" fill={SEMANTIC.loss} opacity={0.7} name="GMV" radius={[4, 4, 0, 0]} />}
                                {activeMetrics.includes('sales') && <Bar dataKey="sales" fill="#f97316" opacity={0.5} name="销量" radius={[4, 4, 0, 0]} />}
                                {activeMetrics.includes('revenue') && <Bar dataKey="revenue" fill="#16a34a" opacity={0.5} name="实收" radius={[4, 4, 0, 0]} />}
                              </BarChart>
                            ) : (
                              <ComposedChart data={finalTrendData} onClick={(d: any) => d?.activePayload && setDetailChartPoint({ date: d.activePayload[0]?.payload?.date, data: d.activePayload[0]?.payload })}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }} />
                                {activeMetrics.includes('sales') && <Bar dataKey="sales" fill="#f97316" opacity={0.3} name="销量" radius={[4, 4, 0, 0]} />}
                                {activeMetrics.includes('gmv') && <Line type="monotone" dataKey="gmv" stroke={SEMANTIC.loss} strokeWidth={2.5} dot={false} name="GMV" />}
                                {activeMetrics.includes('revenue') && <Line type="monotone" dataKey="revenue" stroke="#16a34a" strokeWidth={2} dot={false} name="实收" />}
                                {activeMetrics.includes('profit') && <Line type="monotone" dataKey="profit" stroke="#7c3aed" strokeWidth={2.5} dot={false} name="利润(估)" />}
                                {activeMetrics.includes('refund') && <Line type="monotone" dataKey="refund" stroke="#ef4444" strokeWidth={1.5} dot={false} name="退款" />}
                                {eventMarkers.slice(0, 8).map((m: any, i: number) => (
                                  <ReferenceLine key={i} x={m.date} stroke={m.color} strokeWidth={1.5} strokeDasharray="4 3"
                                    label={{ value: m.label, position: 'top', fill: m.color, fontSize: 9 }} />
                                ))}
                              </ComposedChart>
                            )}
                          </ResponsiveContainer>

                          {/* 图例 */}
                          <div className="flex items-center gap-4 mt-2 text-[10px] text-pdd-text-secondary/50 flex-wrap">
                            {[
                              { key: 'gmv', color: SEMANTIC.loss, label: 'GMV' },
                              { key: 'revenue', color: '#16a34a', label: '实收' },
                              { key: 'profit', color: '#7c3aed', label: '利润(估)' },
                              { key: 'sales', color: '#f97316', label: '销量' },
                              { key: 'refund', color: '#ef4444', label: '退款' },
                            ].filter(l => activeMetrics.includes(l.key)).map(l => (
                              <span key={l.key} style={{ color: l.color }}>● {l.label}</span>
                            ))}
                            {activeMetrics.length === 0 && <span className="text-pdd-text-secondary/50 italic">← 请在上方选择要查看的指标</span>}
                          </div>

                          {/* 选中指标的计算公式说明 */}
                          <div className="mt-3 pt-3 border-t border-pdd-border flex flex-wrap gap-2">
                            {[
                              { key: 'gmv', label: 'GMV', formula: '商品总价(元) 求和（缺省时用 用户实付金额）' },
                              { key: 'revenue', label: '实收', formula: '商家实收金额(元) 求和（已扣除平台服务费/佣金）' },
                              { key: 'profit', label: '利润(估)', formula: '实收 − 商品成本(配置) − 当日推广费 − 退款 − 运费险 − 包装快递 − 税费' },
                              { key: 'sales', label: '销量', formula: '商品数量(件) 求和' },
                              { key: 'orders', label: '订单数', formula: '该商品订单行数 COUNT' },
                              { key: 'refund', label: '退款', formula: '订单退款金额 + 售后退款（自动去重订单退款）' },
                              { key: 'refundRate', label: '退款率', formula: '退款笔数(订单+售后) ÷ 总订单数 × 100' },
                            ].filter(f => activeMetrics.includes(f.key)).map(f => (
                              <div key={f.key} className="flex items-center gap-1.5 px-2 py-1 bg-pdd-bg/50 rounded text-[10px] text-pdd-text-secondary">
                                <span className="font-medium text-pdd-text">{f.label}</span>
                                <span className="text-pdd-text-secondary/50">=</span>
                                <span className="font-mono">{f.formula}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="h-[320px] flex items-center justify-center text-xs text-pdd-text-secondary/50">
                          暂无{timeGranularity === 'hour' ? '分时' : '趋势'}数据
                        </div>
                      )}

                      {/* 数据点详情弹窗 */}
                      <AnimatePresence>
                        {detailChartPoint && (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                            className="mt-3 p-3 bg-pdd-bg/50 rounded-xl border border-pdd-border">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-pdd-text">{detailChartPoint.date} 原始数据明细</span>
                              <button onClick={() => setDetailChartPoint(null)} className="text-pdd-text-secondary/50 hover:text-pdd-text"><X size={12} /></button>
                            </div>
                            <div className="grid grid-cols-6 gap-2 text-xs">
                              {[
                                { label: 'GMV', val: fmtMoney(detailChartPoint.data?.gmv || 0), color: SEMANTIC.loss },
                                { label: '实收', val: fmtMoney(detailChartPoint.data?.revenue || 0), color: '#16a34a' },
                                { label: '销量', val: fmt(detailChartPoint.data?.sales || 0), color: '#f97316' },
                                { label: '利润(估)', val: fmtMoney(detailChartPoint.data?.profit || 0), color: '#7c3aed' },
                                { label: '退款', val: fmtMoney(detailChartPoint.data?.refund || 0), color: '#ef4444' },
                                { label: '订单数', val: fmt(detailChartPoint.data?.orders || 0), color: '#0891b2' },
                              ].map(m => (
                                <div key={m.label} className="text-center p-2 bg-pdd-card rounded-lg">
                                  <div className="text-pdd-text-secondary/50 mb-0.5">{m.label}</div>
                                  <div className="font-mono font-bold" style={{ color: m.color }}>{m.val}</div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* 商品定位 + CM概览（放在趋势图下方，紧凑） */}
                    <div className="grid grid-cols-4 gap-3">
                      <ProductPositioningCard stats={selectedStats} allStats={productStats} />
                      {cmLayers && [cmLayers.cm1, cmLayers.cm2, cmLayers.cm3].map(layer => (
                        <div key={layer.name} className={`rounded-xl border p-3 flex flex-col items-center justify-center gap-1 ${
                          layer.positive ? 'bg-green-50/30 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                          <span className="text-[10px] text-pdd-text-secondary">{layer.name}</span>
                          <span className={`text-base font-bold font-mono ${layer.positive ? 'text-green-600' : 'text-red-500'}`}>
                            {layer.positive ? '+' : ''}¥{fmt(Math.abs(layer.value))}
                          </span>
                          <span className="text-[9px] text-pdd-text-secondary/50">{layer.desc}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* ═══════════ ③ 利润 — 扣费明细 + 瀑布 + CM ═══════════ */}
                  <section id="sec-profit">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <DollarSign size={14} color="#16a34a" />💰 利润拆解
                      <span className="text-[10px] font-normal text-pdd-text-secondary/50">每一笔费用清楚可见</span>
                    </h2>

                    <div className="grid grid-cols-12 gap-4">
                      {/* 扣费明细表 */}
                      <div className="col-span-7 bg-pdd-card rounded-xl border border-pdd-border shadow-sm overflow-hidden">
                        <DeductionDetailTable stats={selectedStats} allProductStats={productStats}
                          comparisonMode={comparisonMode} onViewFullDetail={() => setShowProfitDrawer(true)} />
                      </div>
                      {/* CM 层级 + 瀑布 */}
                      <div className="col-span-5 space-y-4">
                        <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                          <CmLayerCascade layers={cmLayers} allProductStats={productStats} comparisonMode={comparisonMode} />
                        </div>
                        <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                          <ProfitWaterfall stats={selectedStats} allProductStats={productStats} comparisonMode={comparisonMode} />
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* ═══════════ ④ 流量 — 漏斗 + 渠道 ═══════════ */}
                  <section id="sec-traffic">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <Target size={14} color="#7c3aed" />📈 流量 & 转化
                      <span className="text-[10px] font-normal text-pdd-text-secondary/50">曝光 → 点击 → 成交</span>
                    </h2>

                    <div className="grid grid-cols-12 gap-4">
                      {/* 转化漏斗 */}
                      <div className="col-span-5 bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                        <ConversionFunnel stats={selectedStats} orders={productOrders}
                          allProductStats={productStats} comparisonMode={comparisonMode} />
                      </div>
                      {/* 日销售趋势（小时级） */}
                      <div className="col-span-7 bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                        {finalHourlyData.length > 0 ? (
                          <>
                            <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5">
                              <Clock size={12} color="#0891b2" />24小时销售分布
                            </h3>
                            <ResponsiveContainer width="100%" height={220}>
                              <ComposedChart data={hourlyData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                                <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                                <Bar dataKey="gmv" fill={SEMANTIC.loss} opacity={0.5} name="GMV" radius={[3, 3, 0, 0]} />
                                <Line type="monotone" dataKey="orders" stroke="#7c3aed" strokeWidth={2} dot={{ r: 2 }} name="订单" />
                              </ComposedChart>
                            </ResponsiveContainer>
                            <div className="flex items-center gap-3 text-[10px] text-pdd-text-secondary/50 mt-1">
                              <span>🔴 GMV</span><span>🟣 订单数</span>
                              <span className="ml-auto">峰值时段：{
                                [...hourlyData].sort((a: any, b: any) => b.gmv - a.gmv)[0]?.hour || '--'
                              }</span>
                            </div>
                          </>
                        ) : (
                          <div className="h-[220px] flex items-center justify-center text-xs text-pdd-text-secondary/50">
                            <div className="text-center">
                              <Clock size={24} className="mx-auto mb-1 opacity-30" />
                              <span>按「时」切换查看24小时分布</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 推广渠道 */}
                    {selectedStats.promoSourceDetails && selectedStats.promoSourceDetails.length > 0 && (
                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                          <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3">推广渠道 ROI</h3>
                          <div className="space-y-2.5">
                            {(() => {
                              const grouped = selectedStats.promoSourceDetails.reduce((acc: Record<string, { cost: number; transaction: number; clicks: number; impressions: number }>, s: any) => {
                                if (!acc[s.source]) acc[s.source] = { cost: 0, transaction: 0, clicks: 0, impressions: 0 };
                                acc[s.source].cost += s.cost;
                                acc[s.source].transaction += s.transaction;
                                acc[s.source].clicks += s.clicks;
                                acc[s.source].impressions += s.impressions;
                                return acc;
                              }, {});
                              return Object.entries(grouped).map(([source, data]: [string, any], i) => {
                                const roi = data.cost > 0 ? data.transaction / data.cost : 0;
                                return (
                                  <div key={source} className="flex items-center gap-2 text-xs">
                                    <span className="w-16 shrink-0 text-pdd-text-secondary font-medium">{source}</span>
                                    <div className="flex-1 h-6 bg-pdd-bg/80 rounded-sm overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(roi / 5 * 100, 100)}%` }}
                                        transition={{ duration: 0.4, delay: i * 0.04 }}
                                        className="h-full rounded-sm flex items-center text-[9px] text-white font-mono px-1.5"
                                        style={{ backgroundColor: roi < 1 ? SEMANTIC.loss : roi < 2 ? '#f97316' : roi < 3 ? '#eab308' : '#22c55e' }}>
                                        {roi.toFixed(1)}
                                      </motion.div>
                                    </div>
                                    <span className="w-24 text-right text-pdd-text-secondary/50">花费 ¥{fmt(data.cost)}</span>
                                    <span className="w-20 text-right text-pdd-text-secondary/50">{fmt(data.clicks)} 点击</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                        <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                          <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3">流量来源分布</h3>
                          <ResponsiveContainer width="100%" height={180}>
                            <RechartsPieChart>
                              <Pie data={
                                Object.entries(
                                  selectedStats.promoSourceDetails.reduce((acc: Record<string, number>, s: any) => {
                                    acc[s.source] = (acc[s.source] || 0) + s.impressions;
                                    return acc;
                                  }, {})
                                ).map(([name, value]) => ({ name, value }))
                              } cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value">
                                {Object.keys(selectedStats.promoSourceDetails.reduce((acc: Record<string, number>, s: any) => { acc[s.source] = 1; return acc; }, {})).map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: number) => v.toLocaleString() + ' 曝光'} />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ═══════════ ⑤ SKU — 深度对比表 ═══════════ */}
                  <section id="sec-sku">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <Layers size={14} color="#f97316" />🏷️ SKU 表现对比
                    </h2>
                    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                      <SkuDeepTable matrix={skuDeepMatrix} />
                    </div>
                  </section>

                  {/* ═══════════ ⑥ 售后 — 退款分析 ═══════════ */}
                  <section id="sec-aftersale">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <Shield size={14} color="#f97316" />🛡️ 售后 & 质量分析
                    </h2>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                        <RefundReasonBarChart data={refundReasonAnalysis} storeData={storeRefundReasonAnalysis} />
                      </div>
                      <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                        <TimeWindowStackedBar data={finalRefundWindows.windows}
                          skippedNoPay={finalRefundWindows.skippedNoPay} skippedNoApply={finalRefundWindows.skippedNoApply} />
                      </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                      <div className="col-span-7 bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                        <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2">退款日趋势 & 异常检测</h3>
                        {refundDailyTrend.trend.length > 0 ? (
                          <ResponsiveContainer width="100%" height={180}>
                            <ComposedChart data={refundDailyTrend.trend}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="date" tick={{ fontSize: 8, fill: '#9ca3af' }} />
                              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                              <Bar dataKey="refundCount" fill="#f97316" opacity={0.4} name="退款笔数" radius={[3, 3, 0, 0]} />
                              <Line type="monotone" dataKey="ma7Rate" stroke={SEMANTIC.loss} strokeWidth={2} dot={false} name="7日均退款率%" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        ) : <div className="h-[180px] flex items-center justify-center text-xs text-pdd-text-secondary/50">暂无数据</div>}
                        {refundDailyTrend.spikeDays.length > 0 && (
                          <div className="mt-2 text-xs text-red-500 flex items-center gap-1 bg-red-50 px-2 py-1 rounded">
                            <AlertTriangle size={10} /> 异常突增：{refundDailyTrend.spikeDays.slice(0, 5).join('、')}
                          </div>
                        )}
                      </div>
                      <div className="col-span-5 bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                        <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2">价格带 × 销量分布</h3>
                        {selectedStats.priceDistribution && selectedStats.priceDistribution.length > 0 ? (
                          <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={selectedStats.priceDistribution}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                              <XAxis dataKey="range" tick={{ fontSize: 8, fill: '#9ca3af' }} />
                              <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} />
                              <Tooltip contentStyle={{ borderRadius: 10, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: 11 }} />
                              <Bar dataKey="count" fill="#0891b2" opacity={0.7} name="销量" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : <div className="h-[180px] flex items-center justify-center text-xs text-pdd-text-secondary/50">暂无</div>}
                        <div className="text-[10px] text-pdd-text-secondary/50 mt-1.5">
                          均价 ¥{(selectedStats.avgOrderValue || 0).toFixed(0)}
                          {selectedStats.priceDistribution?.length ? ` · 热销 ${selectedStats.priceDistribution.sort((a: any, b: any) => b.count - a.count)[0]?.range || ''}` : ''}
                        </div>
                      </div>
                    </div>

                    {/* 地域售后交叉 */}
                    <div className="mt-4 bg-pdd-card rounded-xl border border-pdd-border shadow-sm">
                      <RegionHeatTable data={regionAfterSaleAnalysis} />
                    </div>

                    {/* 关联商品 */}
                    {selectedStats.relatedProducts?.length > 0 && (
                      <div className="mt-4 bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                        <h3 className="text-xs font-semibold text-pdd-text-secondary mb-2 flex items-center gap-1.5">
                          <Layers size={12} color="#0891b2" />关联购买 TOP5
                        </h3>
                        <div className="grid grid-cols-5 gap-2">
                          {selectedStats.relatedProducts.slice(0, 5).map((rp: any, i: number) => (
                            <div key={i} className="text-center p-2 bg-pdd-bg/50 rounded-lg">
                              <div className="text-xs text-pdd-text-secondary truncate">{rp.productName || rp.productId}</div>
                              <div className="text-[10px] text-pdd-text-secondary/50">共购 {rp.coOccurrenceCount} 次</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>

                  {/* ═══════════ ⑦ 操作时间线 Operation Timeline ═══════════ */}
                  <section id="sec-timeline">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <Clock size={14} color="#0891b2" />📋 操作时间线
                      <span className="text-[10px] font-normal text-pdd-text-secondary/50">商品全生命周期事件回溯</span>
                    </h2>

                    <OperationTimeline
                      productOrders={productOrders}
                      productAfterSales={timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId)}
                      financialRecords={currentDisplayData?.financialRecords || []}
                      selectedStats={selectedStats}
                    />
                  </section>

                  {/* ═══════════ ⑧ 订单追溯 Order Traceability ═══════════ */}
                  <section id="sec-traceability">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      <Search size={14} color="#16a34a" />🔍 订单追溯
                      <span className="text-[10px] font-normal text-pdd-text-secondary/50">从商品到订单到明细的完整追溯</span>
                    </h2>

                    <OrderTraceability
                      productOrders={productOrders}
                      productAfterSales={timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId)}
                      financialRecords={currentDisplayData?.financialRecords || []}
                      selectedStats={selectedStats}
                    />
                  </section>

                  {/* ═══════════ ⑨ 诊断 — 建议 ═══════════ */}
                  <section id="sec-diagnosis">
                    <h2 className="text-sm font-bold text-pdd-text mb-3 flex items-center gap-2">
                      💡 诊断 & 建议
                    </h2>

                    {/* 诊断建议列表 */}
                    <div className="bg-pdd-card rounded-xl border border-pdd-border shadow-sm p-4">
                      <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3">运营诊断建议 · 点击展开详情</h3>
                      {diagnoses.length > 0 ? (
                        <div className="space-y-2">
                          {diagnoses.map((d, i) => {
                            const isExpanded = expandedDiagnosis === i;
                            return (
                              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                                <div onClick={() => setExpandedDiagnosis(isExpanded ? null : i)}
                                  className="flex items-start gap-2.5 p-3 rounded-lg cursor-pointer hover:shadow-sm transition-shadow"
                                  style={{ backgroundColor: d.bg }}>
                                  <div className="shrink-0 mt-0.5" style={{ color: d.color }}>{d.icon}</div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className="text-xs font-semibold" style={{ color: d.color }}>{d.title}</span>
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ color: d.priority === 'urgent' ? SEMANTIC.loss : d.priority === 'important' ? '#f97316' : SEMANTIC.neutral,
                                          backgroundColor: d.priority === 'urgent' ? '#fef2f2' : d.priority === 'important' ? '#fff7ed' : '#F3F4F6' }}>
                                        {{ urgent: '紧急', important: '重要', reference: '参考' }[d.priority]}
                                      </span>
                                    </div>
                                    <p className="text-xs text-pdd-text-secondary leading-relaxed">{d.description}</p>
                                  </div>
                                  <div className="shrink-0 text-pdd-text-secondary/50 mt-0.5">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </div>
                                </div>
                                {isExpanded && (
                                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                                    className="mx-3 mb-2 px-3 py-2.5 bg-pdd-card/60 rounded-b-lg border border-t-0 border-pdd-border overflow-hidden">
                                    {d.title.includes('退款率偏高') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-4">
                                          <span className="text-pdd-text-secondary">退款率：<span className="font-mono font-semibold text-red-500">{fmtPct(selectedStats.refundRate)}</span></span>
                                          <span className="text-pdd-text-secondary">全店均：<span className="font-mono">{storeBenchmark ? fmtPct(storeBenchmark.refundRate.avg) : '--'}</span></span>
                                          <span className="text-pdd-text-secondary">退款额：<span className="font-mono text-red-500">{fmtMoney(selectedStats.refund || 0)}</span></span>
                                        </div>
                                        <div className="text-pdd-text-secondary">
                                          受影响SKU：{skuDeepMatrix.filter(s => s.isHighRefund).map(s => (
                                            <span key={s.skuId} className="inline-block ml-1 px-1.5 py-0.5 bg-red-50 text-red-600 rounded font-mono">{s.skuId}({s.refundRate.toFixed(0)}%)</span>
                                          ))}
                                          {skuDeepMatrix.filter(s => s.isHighRefund).length === 0 && <span className="text-pdd-text-secondary/50">无异常</span>}
                                        </div>
                                        <div className="text-pdd-text-secondary">
                                          主原因：{refundReasonAnalysis.slice(0, 3).map((r, ri) => (
                                            <span key={ri} className="inline-block ml-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 rounded">{r.reason}({r.ratio.toFixed(0)}%)</span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {d.title.includes('SKU集中度过高') && (
                                      <div className="space-y-1 text-xs">
                                        <div className="text-pdd-text-secondary mb-1">各SKU销量占比：</div>
                                        {skuDeepMatrix.slice(0, 5).map(s => (
                                          <div key={s.skuId} className="flex items-center gap-2">
                                            <span className="w-20 truncate font-mono text-pdd-text-secondary">{s.skuId}</span>
                                            <div className="flex-1 h-4 bg-pdd-bg/80 rounded-sm overflow-hidden">
                                              <div className="h-full rounded-sm bg-purple-400" style={{ width: `${Math.min(s.salesRatio, 100)}%`, opacity: 0.7 }} />
                                            </div>
                                            <span className="font-mono w-12 text-right">{(s.salesRatio||0).toFixed(0)}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {d.title.includes('推广ROI偏低') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-4">
                                          <span className="text-pdd-text-secondary">ROI：<span className="font-mono font-semibold text-red-500">{selectedStats.roi > 0 ? selectedStats.roi.toFixed(2) : '--'}</span></span>
                                          <span className="text-pdd-text-secondary">全店均：<span className="font-mono">{storeBenchmark ? storeBenchmark.roi.avg.toFixed(2) : '--'}</span></span>
                                          <span className="text-pdd-text-secondary">花费：<span className="font-mono">{fmtMoney(selectedStats.promoCost || 0)}</span></span>
                                        </div>
                                        {selectedStats.promoSourceDetails?.length > 0 && (
                                          <div className="text-pdd-text-secondary">
                                            渠道ROI：{selectedStats.promoSourceDetails.map((src: any, si: number) => {
                                              const roi = src.cost > 0 ? src.transaction / src.cost : 0;
                                              return <span key={si} className={`inline-block ml-1 px-1.5 py-0.5 rounded font-mono ${roi < 1 ? 'bg-red-50 text-red-600' : roi < 2 ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>{src.source}:{roi.toFixed(1)}</span>;
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                    {d.title.includes('库存积压') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-4">
                                          <span className="text-pdd-text-secondary">周转：<span className="font-mono font-semibold text-red-500">{selectedStats.turnoverDays}天</span></span>
                                          <span className="text-pdd-text-secondary">全店均：<span className="font-mono">{storeBenchmark ? storeBenchmark.turnoverDays.avg.toFixed(0) + '天' : '--'}</span></span>
                                          <span className="text-pdd-text-secondary">安全线：30天</span>
                                        </div>
                                      </div>
                                    )}
                                    {d.title.includes('GMV显著下降') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="flex items-center gap-4">
                                          <span className="text-pdd-text-secondary">GMV：<span className="font-mono font-semibold">{fmtMoney(selectedStats.gmv)}</span></span>
                                          {prevStats && <span className="text-pdd-text-secondary">上周期：<span className="font-mono">{fmtMoney(prevStats.gmv)}</span></span>}
                                          {prevStats && prevStats.gmv > 0 && (
                                            <span className="font-mono text-red-500">↓ {Math.abs(((selectedStats.gmv - prevStats.gmv) / prevStats.gmv) * 100).toFixed(1)}%</span>
                                          )}
                                        </div>
                                        <div className="text-pdd-text-secondary">
                                          访客{fmt(selectedStats.promoImpressions || 0)} → 点击{fmt(selectedStats.promoClicks || 0)}(CTR {fmtPct(selectedStats.ctr)}) → 成交{(selectedStats.orders || 0)}单(CVR {fmtPct(selectedStats.cvr)}) | 客单价 {fmtMoney(selectedStats.avgOrderValue || 0)}
                                        </div>
                                      </div>
                                    )}
                                    {d.title.includes('利润率过低') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="text-pdd-text-secondary">
                                          利润率：<span className="font-mono font-semibold text-red-500">{fmtPct(selectedStats.profitRate)}</span>
                                          <span className="ml-2">全店均：<span className="font-mono">{storeBenchmark ? fmtPct(storeBenchmark.profitRate.avg) : '--'}</span></span>
                                        </div>
                                      </div>
                                    )}
                                    {d.title.includes('快速退款占比偏高') && (
                                      <div className="space-y-1 text-xs">
                                        <div className="text-pdd-text-secondary">退款时间分布：</div>
                                        {finalRefundWindows.windows.map((w: any, wi: number) => (
                                          <div key={wi} className="flex items-center gap-2">
                                            <span className="w-16 text-pdd-text-secondary">{w.label}</span>
                                            <div className="flex-1 h-4 bg-pdd-bg/80 rounded-sm overflow-hidden">
                                              <div className={`h-full rounded-sm ${wi === 0 ? 'bg-red-400' : 'bg-pdd-text-secondary/30'}`}
                                                style={{ width: `${Math.max((w as any).ratio || 0, 1)}%`, opacity: 0.7 }} />
                                            </div>
                                            <span className="font-mono w-12 text-right">{w.count}笔</span>
                                            <span className="font-mono w-12 text-right">{(w as any).ratio?.toFixed(0) || 0}%</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {d.title.includes('地域售后异常') && (
                                      <div className="space-y-2 text-xs">
                                        {regionAfterSaleAnalysis.filter(r => r.isAnomaly).map((r, ri) => (
                                          <div key={ri} className="flex items-center gap-3">
                                            <span className="w-16 font-semibold text-red-500">{r.province}</span>
                                            <span className="text-pdd-text-secondary">售后率 <span className="font-mono text-red-500">{r.afterSaleRate.toFixed(1)}%</span></span>
                                            <span className="text-pdd-text-secondary">退款 <span className="font-mono">{fmtMoney(r.refundAmount)}</span></span>
                                          </div>
                                        ))}
                                        {regionAfterSaleAnalysis.filter(r => r.isAnomaly).length === 0 && <span className="text-pdd-text-secondary/50">无异常</span>}
                                      </div>
                                    )}
                                    {d.title.includes('折扣依赖') && (
                                      <div className="space-y-2 text-xs">
                                        <div className="text-pdd-text-secondary">
                                          折扣占比：<span className="font-mono font-semibold text-orange-500">{fmtPct(selectedStats.discountRatio)}</span>
                                          <span className="ml-2">折扣额：<span className="font-mono">{fmtMoney(selectedStats.discount || 0)}</span></span>
                                        </div>
                                      </div>
                                    )}
                                    {d.title.includes('关联销售') && selectedStats.relatedProducts && (
                                      <div className="space-y-1 text-xs">
                                        {selectedStats.relatedProducts.slice(0, 3).map((rp: any, ri: number) => (
                                          <div key={ri} className="flex items-center gap-2">
                                            <span className="text-pdd-text-secondary truncate max-w-[150px]">{rp.productName || rp.productId}</span>
                                            <span className="text-pdd-text-secondary/50">共购 {rp.coOccurrenceCount} 次</span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-green-600 p-3 rounded-lg bg-green-50">
                          <CheckCircle size={14} />当前指标正常，未触发任何预警，继续保持！
                        </div>
                      )}
                    </div>
                  </section>
                </div>
              )}
            </div>

            {/* 右侧导航锚点 */}
            {selectedStats && (
              <div className="shrink-0 w-11 bg-pdd-card border-l border-pdd-border flex flex-col items-center py-3 gap-1">
                {SECTIONS.map(s => {
                  const isActive = activeSection === s.id;
                  return (
                    <button key={s.id} onClick={() => scrollTo(s.id)}
                      className={`p-1.5 rounded-lg transition-colors tooltip-left ${
                        isActive
                          ? 'bg-pdd-primary/10 text-pdd-primary shadow-sm'
                          : 'text-pdd-text-secondary/50 hover:text-pdd-text hover:bg-pdd-bg/80'
                      }`}
                      title={s.label}>
                      {s.icon}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部状态栏 */}
          <div className="shrink-0 h-7 bg-pdd-card border-t border-pdd-border flex items-center justify-between px-4 text-pdd-text-secondary/50" style={{ fontSize: '9px' }}>
            <span>数据更新：{selectedStats?.lastOrderDate || '--'}</span>
            <span>
              数据质量：
              <span className={selectedStats?.hasOrderData ? 'text-green-500' : 'text-red-400'}>订单{selectedStats?.hasOrderData ? '✓' : '✗'}</span>
              {' · '}
              <span className={selectedStats?.hasPromoData ? 'text-green-500' : 'text-pdd-text-secondary/50'}>推广{selectedStats?.hasPromoData ? '✓' : '✗'}</span>
              {' · '}
              <span className={timeFilteredAfterSales.length > 0 ? 'text-green-500' : 'text-pdd-text-secondary/50'}>售后{timeFilteredAfterSales.length > 0 ? '✓' : '✗'}</span>
              {' · '}
              <span className={selectedStats?.profitConfidence === 'high' ? 'text-green-500' : selectedStats?.profitConfidence === 'medium' ? 'text-yellow-500' : 'text-pdd-text-secondary/50'}>
                利润置信度：{{ high: '高', medium: '中', low: '低' }[(selectedStats?.profitConfidence || 'low') as 'high' | 'medium' | 'low']}
              </span>
            </span>
            <span>{selectedStats?.activeDays || 0}天活跃 · {timeFilteredAfterSales.filter(r => String(findField(r, '商品ID', '商品编号') || '') === selectedId).length}条售后</span>
          </div>
        </motion.div>
      </motion.div>

      {/* 利润核算抽屉 */}
      {profitBreakdownData && (
        <ProfitBreakdownDrawer isOpen={showProfitDrawer} onClose={() => setShowProfitDrawer(false)}
          {...profitBreakdownData} otherFees={[]} />
      )}
    </AnimatePresence>
  );
}

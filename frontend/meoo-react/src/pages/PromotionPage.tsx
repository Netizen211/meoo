import React, { useMemo, useState, useCallback, useRef } from 'react';
import { Megaphone, BarChart3, Package, Star, Video, DollarSign, TrendingUp, Target, Filter, ArrowUp, ArrowDown, Download, Search, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { useData } from '../App';
import { motion } from 'framer-motion';
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, filterPromoByTimeRange, changePct } from '../components/TimeFilter';
import { findField, safeField, safeFieldNum } from '../utils/fieldAccess';
import { PROMO_FIELDS } from '../utils/promotionFields';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, ScatterChart, Scatter, ZAxis } from 'recharts';

const COLORS = ['var(--pdd-danger)', 'var(--pdd-warning)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-purple)', '#13c2c2', '#8c8c8c'];

// 零值安全的字段读取：字段存在且值为0时不跳过（修复 FATAL-2）
function safeFieldVal(row: any, fields: readonly string[]): number {
  for (const f of fields) {
    const v = findField(row, f);
    if (v != null && v !== '') return safeFloat(v);
  }
  return 0;
}

function safeFieldInt(row: any, fields: readonly string[]): number {
  for (const f of fields) {
    const v = findField(row, f);
    if (v != null && v !== '') {
      const n = parseInt(String(v));
      return isNaN(n) ? 0 : n;
    }
  }
  return 0;
}

type TabKey = 'overview' | 'product' | 'star' | 'live' | 'profit' | 'keyword' | 'funnel' | 'report';

// 通用 KPI 卡片（组件提取到模块级别，避免每次render重建）
function KpiCard({ label, value, fmt, change, reverse }: {
  label: string; value: number; fmt: (v: number) => string; change?: number | null; reverse?: boolean;
}) {
  return (
    <div className="pdd-card px-3 py-2.5">
      <p className="text-[10px] text-[var(--pdd-text-secondary)] mb-0.5">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="text-base font-bold">{fmt(value)}</span>
        {change != null && (
          <span className={`flex items-center text-[10px] font-medium ${reverse ? (change > 0 ? 'text-pdd-danger' : 'text-pdd-success') : (change > 0 ? 'text-pdd-success' : 'text-pdd-danger')}`}>
            {change > 0 ? <ArrowUp size={10} /> : change < 0 ? <ArrowDown size={10} /> : null}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function PromotionPage() {
  const { currentDisplayData, productCosts, defaultCostRatio, insuranceFeePerOrder } = useData();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
  const [topSortBy, setTopSortBy] = useState<'cost' | 'roi' | 'orders' | 'grossProfit'>('cost');
  // AI报告状态
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  const [aiError, setAiError] = useState('');
  const [aiReportDate, setAiReportDate] = useState('');
  const aiAbortRef = useRef<AbortController | null>(null);

  const hasPromo = (currentDisplayData?.promotionSummary?.length ?? 0) > 0 || (currentDisplayData?.promotionProducts?.length ?? 0) > 0;
  const hasStar = (currentDisplayData?.starStoreSummary?.length ?? 0) > 0;
  const hasLive = (currentDisplayData?.liveStreamSummary?.length ?? 0) > 0;
  const hasAnyPromo = hasPromo || hasStar || hasLive;

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(findField(o, '订单状态') || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => {
    const dateGroups = getAllDateGroups(orders);
    // 如果订单日期为空，从推广数据中提取日期
    if (dateGroups.length === 0) {
      const dateMap: Record<string, any[]> = {};
      const extractDates = (records: any[], dateField: string = '日期') => {
        records.forEach((r: any) => {
          const d = String(findField(r, dateField) || '').trim().replace(/\//g, '-');
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) (dateMap[d] = dateMap[d] || []).push(r);
        });
      };
      extractDates(currentDisplayData?.promotionSummary || []);
      extractDates(currentDisplayData?.promotionProducts || []);
      extractDates(currentDisplayData?.starStoreSummary || []);
      extractDates(currentDisplayData?.liveStreamSummary || []);
      return Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0]));
    }
    return dateGroups;
  }, [orders, currentDisplayData]);

  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange), [orders, allDates, timeRange, customStart, customEnd, quickRange]);

  const filteredPromoSummary = useMemo(() =>
    filterPromoByTimeRange(currentDisplayData?.promotionSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
    [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredStarSummary = useMemo(() =>
    filterPromoByTimeRange(currentDisplayData?.starStoreSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
    [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredLiveSummary = useMemo(() =>
    filterPromoByTimeRange(currentDisplayData?.liveStreamSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
    [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredPromoProducts = useMemo(() =>
    filterPromoByTimeRange(currentDisplayData?.promotionProducts || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
    [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);

  // 当 promotionSummary 为空但 promotionProducts 有数据时，从 promotionProducts 按日期聚合
  const effectivePromoSummary = useMemo(() => {
    const summary = currentDisplayData?.promotionSummary;
    if (summary && summary.length > 0) return summary;
    const products = currentDisplayData?.promotionProducts;
    if (!products || products.length === 0) return [];
    // 按日期聚合：同一天多条记录合并为一条汇总
    const dateMap: Record<string, any> = {};
    products.forEach((p: any) => {
      const d = safeField(p, ...PROMO_FIELDS.date).replace(/\//g, '-');
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!dateMap[d]) {
        dateMap[d] = { '日期': d, '花费(元)': 0, '成交花费(元)': 0, '总花费(元)': 0, '成交笔数': 0, '交易额(元)': 0, '成交金额(元)': 0, '曝光量': 0, '点击量': 0 };
      }
      const entry = dateMap[d];
      entry['花费(元)'] += safeFieldVal(p, PROMO_FIELDS.cost);
      entry['成交花费(元)'] += safeFieldVal(p, PROMO_FIELDS.cost);
      entry['总花费(元)'] += safeFieldVal(p, PROMO_FIELDS.cost);
      entry['成交笔数'] += safeFieldInt(p, PROMO_FIELDS.orders);
      entry['交易额(元)'] += safeFieldVal(p, PROMO_FIELDS.gmv);
      entry['成交金额(元)'] += safeFieldVal(p, PROMO_FIELDS.gmv);
      entry['曝光量'] += safeFieldInt(p, PROMO_FIELDS.impressions);
      entry['点击量'] += safeFieldInt(p, PROMO_FIELDS.clicks);
    });
    return Object.values(dateMap).sort((a: any, b: any) => a['日期'].localeCompare(b['日期']));
  }, [currentDisplayData]);

  // 使用 effectivePromoSummary 重新计算 filteredPromoSummary
  const effectiveFilteredPromoSummary = useMemo(() => {
    if ((currentDisplayData?.promotionSummary?.length ?? 0) > 0) {
      return filteredPromoSummary;
    }
    return filterPromoByTimeRange(effectivePromoSummary, allDates, timeRange, undefined, customStart, customEnd, quickRange);
  }, [currentDisplayData, effectivePromoSummary, filteredPromoSummary, allDates, timeRange, customStart, customEnd, quickRange]);

  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : timeRange === '90' ? '近90天' : '全部';

  // 上一周期（环比）——修复 FATAL-6
  const comparePromoSummary = useMemo(() => {
    if (!compareEnabled || !effectiveFilteredPromoSummary.length) return [];
    const dates = effectiveFilteredPromoSummary.map((r: any) => safeField(r, ...PROMO_FIELDS.date).replace(/\//g, '-')).sort();
    if (!dates.length) return [];
    const firstDate = new Date(dates[0]);
    const lastDate = new Date(dates[dates.length - 1]);
    const rangeDays = Math.round((lastDate.getTime() - firstDate.getTime()) / 86400000) + 1;
    const prevStart = new Date(firstDate);
    prevStart.setDate(prevStart.getDate() - rangeDays);
    const prevEnd = new Date(firstDate);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStartStr = prevStart.toISOString().slice(0, 10);
    const prevEndStr = prevEnd.toISOString().slice(0, 10);
    const allRecords = ((currentDisplayData?.promotionSummary?.length ?? 0) > 0)
      ? (currentDisplayData?.promotionSummary || [])
      : effectivePromoSummary;
    return allRecords.filter((r: any) => {
      const d = safeField(r, ...PROMO_FIELDS.date).replace(/\//g, '-');
      return d >= prevStartStr && d <= prevEndStr;
    });
  }, [compareEnabled, effectiveFilteredPromoSummary, effectivePromoSummary, currentDisplayData]);

  // 辅助函数：计算渠道KPI
  const calcKpi = (records: any[], channel: 'promo' | 'star' | 'live') => {
    let cost = 0, orders = 0, gmv = 0, impressions = 0, clicks = 0;
    let inquiry = 0, favorite = 0, follow = 0;
    records.forEach((r: any) => {
      if (channel === 'promo') {
        cost += safeFieldVal(r, PROMO_FIELDS.cost);
        orders += safeFieldInt(r, PROMO_FIELDS.orders);
        gmv += safeFieldVal(r, PROMO_FIELDS.gmv);
        impressions += safeFieldInt(r, PROMO_FIELDS.impressions);
        clicks += safeFieldInt(r, PROMO_FIELDS.clicks);
        inquiry += safeFieldInt(r, PROMO_FIELDS.inquiry);
        favorite += safeFieldInt(r, PROMO_FIELDS.favorite);
        follow += safeFieldInt(r, PROMO_FIELDS.follow);
      } else if (channel === 'star') {
        cost += safeFieldVal(r, PROMO_FIELDS.cost);
        gmv += safeFieldVal(r, PROMO_FIELDS.gmv);
        orders += safeFieldInt(r, PROMO_FIELDS.orders);
        impressions += safeFieldInt(r, PROMO_FIELDS.impressions);
        clicks += safeFieldInt(r, PROMO_FIELDS.clicks);
        follow += safeFieldInt(r, PROMO_FIELDS.storeFollow);
        favorite += safeFieldInt(r, PROMO_FIELDS.favorite);
      } else {
        cost += safeFieldVal(r, PROMO_FIELDS.cost);
        gmv += safeFieldVal(r, PROMO_FIELDS.gmv);
        orders += safeFieldInt(r, PROMO_FIELDS.orders);
        impressions += safeFieldInt(r, PROMO_FIELDS.impressions);
        clicks += safeFieldInt(r, PROMO_FIELDS.clicks);
        follow += safeFieldInt(r, PROMO_FIELDS.follow);
        favorite += safeFieldInt(r, PROMO_FIELDS.favorite);
      }
    });
    const roi = cost > 0 ? gmv / cost : 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cvr = clicks > 0 ? (orders / clicks) * 100 : 0;
    const cpc = clicks > 0 ? cost / clicks : 0;
    const cpa = orders > 0 ? cost / orders : 0;
    return { cost, orders, gmv, roi, impressions, clicks, ctr, cvr, cpc, cpa, inquiry, favorite, follow };
  };

  // KPI 计算
  const totalKpi = useMemo(() => {
    if (!hasAnyPromo) return null;
    const p = hasPromo ? calcKpi(effectiveFilteredPromoSummary, 'promo') : { cost: 0, orders: 0, gmv: 0, impressions: 0, clicks: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0, inquiry: 0, favorite: 0, follow: 0 };
    const s = hasStar ? calcKpi(filteredStarSummary, 'star') : { cost: 0, orders: 0, gmv: 0, impressions: 0, clicks: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0, inquiry: 0, favorite: 0, follow: 0 };
    const l = hasLive ? calcKpi(filteredLiveSummary, 'live') : { cost: 0, orders: 0, gmv: 0, impressions: 0, clicks: 0, ctr: 0, cvr: 0, cpc: 0, cpa: 0, inquiry: 0, favorite: 0, follow: 0 };
    const totalCost = p.cost + s.cost + l.cost;
    const totalGmv = p.gmv + s.gmv + l.gmv;
    const totalOrders = p.orders + s.orders + l.orders;
    const totalImpr = p.impressions + s.impressions + l.impressions;
    const totalClicks = p.clicks + s.clicks + l.clicks;
    const roi = totalCost > 0 ? totalGmv / totalCost : 0;
    const merchantIncome = filteredOrders.reduce((s: number, o: any) => s + safeFieldNum(o, '商家实收金额(元)', '商家实收金额', '商家实收'), 0);
    const promoRatio = merchantIncome > 0 ? (totalCost / merchantIncome) * 100 : 0;
    const ctr = totalImpr > 0 ? (totalClicks / totalImpr) * 100 : 0;
    const cvr = totalClicks > 0 ? (totalOrders / totalClicks) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const cpa = totalOrders > 0 ? totalCost / totalOrders : 0;

    // 环比
    let compareCost = 0, compareGmv = 0, compareOrders = 0;
    if (compareEnabled && comparePromoSummary.length) {
      const cp = calcKpi(comparePromoSummary, 'promo');
      compareCost = cp.cost;
      compareGmv = cp.gmv;
      compareOrders = cp.orders;
    }

    return { totalCost, totalGmv, totalOrders, totalImpr, totalClicks, roi, merchantIncome, promoRatio, ctr, cvr, cpc, cpa, p, s, l, compareCost, compareGmv, compareOrders };
  }, [effectiveFilteredPromoSummary, filteredStarSummary, filteredLiveSummary, filteredOrders, hasPromo, hasStar, hasLive, compareEnabled, comparePromoSummary]);

  const productKpi = useMemo(() => hasPromo ? calcKpi(effectiveFilteredPromoSummary, 'promo') : null, [effectiveFilteredPromoSummary, hasPromo]);
  const starKpi = useMemo(() => hasStar ? calcKpi(filteredStarSummary, 'star') : null, [filteredStarSummary, hasStar]);
  const liveKpi = useMemo(() => hasLive ? calcKpi(filteredLiveSummary, 'live') : null, [filteredLiveSummary, hasLive]);

  // 趋势数据（商品推广）
  const trendData = useMemo(() => {
    if (!hasPromo) return [];
    const byDate: Record<string, { cost: number; gmv: number; orders: number }> = {};
    effectiveFilteredPromoSummary.forEach((r: any) => {
      const d = safeField(r, ...PROMO_FIELDS.date).replace(/\//g, '-');
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, orders: 0 };
      byDate[d].cost += safeFieldVal(r, PROMO_FIELDS.cost);
      byDate[d].gmv += safeFieldVal(r, PROMO_FIELDS.gmv);
      byDate[d].orders += safeFieldInt(r, PROMO_FIELDS.orders);
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date: date.slice(5), cost: Math.round(v.cost), roi: v.cost > 0 ? Math.round((v.gmv / v.cost) * 100) / 100 : 0, orders: v.orders }));
  }, [effectiveFilteredPromoSummary, hasPromo]);

  // 渠道对比
  // 明星店铺、直播推广趋势 (MEDIUM-2修复)
  const starTrend = useMemo(() => {
    if (!hasStar) return [];
    const byDate: Record<string, number> = {};
    filteredStarSummary.forEach((r: any) => {
      const d = safeField(r, ...PROMO_FIELDS.date).replace(/\//g, '-');
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      byDate[d] = (byDate[d] || 0) + safeFieldVal(r, ['花费(元)']);
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cost]) => ({ date: date.slice(5), cost: Math.round(cost) }));
  }, [filteredStarSummary, hasStar]);

  const liveTrend = useMemo(() => {
    if (!hasLive) return [];
    const byDate: Record<string, number> = {};
    filteredLiveSummary.forEach((r: any) => {
      const d = safeField(r, ...PROMO_FIELDS.date).replace(/\//g, '-');
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      byDate[d] = (byDate[d] || 0) + safeFieldVal(r, PROMO_FIELDS.cost);
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, cost]) => ({ date: date.slice(5), cost: Math.round(cost) }));
  }, [filteredLiveSummary, hasLive]);

  // 花费异常检测 (SEVERE-6) —— 注意：依赖 topProducts，必须放在 topProducts 之后

  const channelData = useMemo(() => {
    const ch: { name: string; cost: number; gmv: number; roi: number; key: string }[] = [];
    if (hasPromo && productKpi) ch.push({ name: '商品推广', key: 'product', cost: productKpi.cost, gmv: productKpi.gmv, roi: productKpi.roi });
    if (hasStar && starKpi) ch.push({ name: '明星店铺', key: 'star', cost: starKpi.cost, gmv: starKpi.gmv, roi: starKpi.roi });
    if (hasLive && liveKpi) ch.push({ name: '直播推广', key: 'live', cost: liveKpi.cost, gmv: liveKpi.gmv, roi: liveKpi.roi });
    return ch;
  }, [hasPromo, hasStar, hasLive, productKpi, starKpi, liveKpi]);

  // 商品推广TOP商品
  const productInfoMap = useMemo(() => {
    const map: Record<string, { name: string; code: string }> = {};
    orders.forEach((o: any) => {
      const pid = safeField(o, '商品id', '商品ID').replace(/\t$/, '');
      const name = safeField(o, '商品', '商品名称');
      const code = safeField(o, '商家编码-商品维度', '商家编码');
      if (pid && !map[pid]) map[pid] = { name: name.slice(0, 25), code };
    });
    // 从推广产品数据补充 orders 中没有的商品名（MEDIUM-4修复）
    (currentDisplayData?.promotionProducts || []).forEach((r: any) => {
      const pid = safeField(r, '商品ID', '商品id');
      const name = safeField(r, ...PROMO_FIELDS.productName);
      if (pid && !map[pid]) map[pid] = { name: name.slice(0, 25), code: '' };
    });
    return map;
  }, [orders, currentDisplayData]);

  const topProducts = useMemo(() => {
    if (!filteredPromoProducts.length) return [];
    return filteredPromoProducts
      .map((r: any) => {
        const pid = safeField(r, '商品ID', '商品id');
        const info = productInfoMap[pid] || { name: '', code: '' };
        const name = (safeField(r, ...PROMO_FIELDS.productName) || info.name).slice(0, 25);
        const cost = safeFieldVal(r, PROMO_FIELDS.cost);
        const orders = safeFieldInt(r, PROMO_FIELDS.orders);
        const gmv = safeFieldVal(r, PROMO_FIELDS.gmv);
        const roi = cost > 0 ? gmv / cost : 0;
        const ctr = safeFieldVal(r, PROMO_FIELDS.ctr);
        const cvr = safeFieldVal(r, PROMO_FIELDS.cvr);
        // 盈利分析 — 使用 useData() 上下文的真实 productCosts/defaultCostRatio
        const unitCost = (productCosts && productCosts[pid]) || 0;
        const estimatedCost = unitCost > 0 ? unitCost * orders : gmv * ((defaultCostRatio ?? 30) / 100);
        const grossProfit = gmv - estimatedCost - cost;
        const profitMargin = gmv > 0 ? (grossProfit / gmv) * 100 : 0;
        return { pid, name, code: info.code, cost, orders, gmv, roi, ctr, cvr, unitCost, estimatedCost, grossProfit, profitMargin };
      })
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 15);
  }, [filteredPromoProducts, productInfoMap, currentDisplayData]);

  // sortable topProducts (MEDIUM-3修复)
  const sortedTopProducts = useMemo(() => {
    return [...topProducts].sort((a, b) => {
      if (topSortBy === 'cost') return b.cost - a.cost;
      if (topSortBy === 'roi') return b.roi - a.roi;
      if (topSortBy === 'orders') return b.orders - a.orders;
      if (topSortBy === 'grossProfit') return b.grossProfit - a.grossProfit;
      return 0;
    });
  }, [topProducts, topSortBy]);

  // 花费异常检测 (SEVERE-6) —— 依赖 topProducts，必须放在 topProducts 定义之后
  const spendWarnings = useMemo(() => {
    if (trendData.length < 4) return null;
    const warnings: string[] = [];
    const last3 = trendData.slice(-3);
    if (last3.every((d, i) => i === 0 || d.cost > last3[i - 1].cost)) {
      const pct = last3[0].cost > 0 ? ((last3[2].cost - last3[0].cost) / last3[0].cost * 100) : 0;
      warnings.push(`花费连续3天上涨(${pct > 0 ? '+' : ''}${pct.toFixed(0)}%)，请关注是否异常`);
    }
    if (topProducts.length > 0) {
      const totalCost = topProducts.reduce((s, p) => s + p.cost, 0);
      const topShare = totalCost > 0 ? (topProducts[0].cost / totalCost) * 100 : 0;
      if (topShare > 50) warnings.push(`${topProducts[0].name || '某商品'}推广花费占比${topShare.toFixed(0)}%，集中度风险较高`);
    }
    return warnings.length > 0 ? warnings : null;
  }, [trendData, topProducts]);

  // ========== 盈利分析数据（修复 FATAL-4）==========
  const profitAnalysis = useMemo(() => {
    if (!filteredOrders.length || !hasAnyPromo) return null;
    const productCosts = (currentDisplayData as any)?.productCosts || {};
    const defaultRatio = (currentDisplayData as any)?.defaultCostRatio ?? 30;
    const merchantIncome = filteredOrders.reduce((s: number, o: any) => s + safeFieldNum(o, '商家实收金额(元)', '商家实收金额', '商家实收'), 0);
    const totalPromoCost = totalKpi?.totalCost ?? 0;
    const shippingInsurance = currentDisplayData?.shippingInsurance || [];
    const filteredInsurance = filterPromoByTimeRange(shippingInsurance, allDates, timeRange, ['日期'], customStart, customEnd, quickRange);
    const insuranceCost = filteredInsurance.reduce((s: number, r: any) => s + safeFieldVal(r, ['服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)']), 0);
    let rawCost = 0;
    filteredOrders.forEach((o: any) => {
      const pid = safeField(o, '商品id', '商品ID');
      const qty = safeFieldNum(o, '商品数量(件)', '商品数量', '数量') || 1;
      const productTotal = safeFieldNum(o, '商品总价(元)', '商品总价');
      const unitCost = (productCosts && productCosts[pid]) || 0;
      rawCost += unitCost > 0 ? unitCost * qty : productTotal * ((defaultCostRatio ?? 30) / 100);
    });
    const netProfit = merchantIncome - totalPromoCost - insuranceCost - rawCost;
    const grossMargin = merchantIncome > 0 ? ((merchantIncome - rawCost) / merchantIncome) * 100 : 0;

    // 商品级盈利明细
    const productProfits = topProducts.map(p => ({
      ...p,
      isProfitable: p.grossProfit > 0,
      breakEvenRoi: p.estimatedCost > 0 ? p.estimatedCost / p.gmv + 1 : 999,
    })).sort((a, b) => b.grossProfit - a.grossProfit);

    return { merchantIncome, totalPromoCost, insuranceCost, rawCost, netProfit, grossMargin, productProfits };
  }, [filteredOrders, hasAnyPromo, totalKpi, currentDisplayData, allDates, timeRange, topProducts]);

  // ========== 关键词分析 ==========
  const keywordData = useMemo(() => {
    if (!filteredPromoProducts.length) return [];
    const kwMap: Record<string, { cost: number; gmv: number; orders: number; clicks: number; impressions: number }> = {};
    filteredPromoProducts.forEach((r: any) => {
      const kw = safeField(r, ...PROMO_FIELDS.keyword) || '(未命名)';
      if (!kwMap[kw]) kwMap[kw] = { cost: 0, gmv: 0, orders: 0, clicks: 0, impressions: 0 };
      kwMap[kw].cost += safeFieldVal(r, PROMO_FIELDS.cost);
      kwMap[kw].gmv += safeFieldVal(r, PROMO_FIELDS.gmv);
      kwMap[kw].orders += safeFieldInt(r, PROMO_FIELDS.orders);
      kwMap[kw].clicks += safeFieldInt(r, PROMO_FIELDS.clicks);
      kwMap[kw].impressions += safeFieldInt(r, PROMO_FIELDS.impressions);
    });
    return Object.entries(kwMap)
      .map(([kw, v]) => ({
        keyword: kw, cost: v.cost, gmv: v.gmv, orders: v.orders,
        roi: v.cost > 0 ? v.gmv / v.cost : 0,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
        cvr: v.clicks > 0 ? (v.orders / v.clicks) * 100 : 0,
        cpa: v.orders > 0 ? v.cost / v.orders : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [filteredPromoProducts]);

  // ========== 导出CSV (修复 SEVERE-8)==========
  const exportPromoCSV = () => {
    if (!filteredPromoProducts.length) return;
    const headers = ['商品ID', '商品名称', '推广名称', '花费', '成交笔数', 'GMV', '曝光量', '点击量', '点击率', '转化率', 'ROI'];
    const rows = topProducts.map(p => [p.pid, p.name, '', p.cost.toFixed(2), p.orders.toString(), p.gmv.toFixed(2), '', '', p.ctr.toFixed(2) + '%', p.cvr.toFixed(2) + '%', p.roi.toFixed(2)]);
    const csv = '﻿' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `推广数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  // 空状态
  if (!hasAnyPromo) {
    return (
      <div className="p-4">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2"><Megaphone size={18} color="var(--pdd-danger)" />推广数据</h2>
        <TimeFilter state={tf} />
        <div className="pdd-card text-center py-12 text-[var(--pdd-text-secondary)] mt-3">
          <p>请上传推广数据文件（商品推广/明星店铺/直播推广）</p>
          {currentDisplayData && (
            <p className="text-xs mt-2 text-[var(--pdd-text-secondary)]">
              当前数据：订单 {currentDisplayData.orders?.length || 0} 条
              {(currentDisplayData.promotionSummary?.length ?? 0) > 0 && ` | 推广汇总 ${currentDisplayData.promotionSummary.length} 条`}
            </p>
          )}
        </div>
      </div>
    );
  }

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: '推广概览', icon: TrendingUp },
    { key: 'product', label: '商品推广', icon: Package },
    { key: 'star', label: '明星店铺', icon: Star },
    { key: 'live', label: '直播推广', icon: Video },
    { key: 'profit', label: '盈利分析', icon: DollarSign },
    { key: 'keyword', label: '关键词', icon: Target },
    { key: 'funnel', label: '转化漏斗', icon: Filter },
    { key: 'report', label: 'AI报告', icon: BarChart3 },
  ];

  // ============ Tab渲染 ============

  const renderOverview = () => {
    if (!totalKpi) return null;
    const compareRoi = totalKpi.compareCost > 0 ? (totalKpi.compareGmv / totalKpi.compareCost) : 0;
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-5 gap-2">
          <KpiCard label="总推广花费" value={totalKpi.totalCost} fmt={v => `¥${v.toFixed(0)}`} change={compareEnabled ? changePct(totalKpi.totalCost, totalKpi.compareCost) : null} reverse />
          <KpiCard label="推广GMV" value={totalKpi.totalGmv} fmt={v => `¥${v.toFixed(0)}`} change={compareEnabled ? changePct(totalKpi.totalGmv, totalKpi.compareGmv) : null} />
          <KpiCard label="综合ROI" value={totalKpi.roi} fmt={v => v.toFixed(2)} change={compareEnabled ? changePct(totalKpi.roi, compareRoi) : null} />
          <KpiCard label="推广订单数" value={totalKpi.totalOrders} fmt={v => v.toString()} change={compareEnabled ? changePct(totalKpi.totalOrders, totalKpi.compareOrders) : null} />
          <KpiCard label="CPA" value={totalKpi.cpa} fmt={v => `¥${v.toFixed(2)}`} reverse />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <KpiCard label="曝光量" value={totalKpi.totalImpr} fmt={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toString()} />
          <KpiCard label="点击量" value={totalKpi.totalClicks} fmt={v => v.toString()} />
          <KpiCard label="CTR" value={totalKpi.ctr} fmt={v => v.toFixed(2) + '%'} />
          <KpiCard label="CVR" value={totalKpi.cvr} fmt={v => v.toFixed(2) + '%'} />
          <KpiCard label="CPC" value={totalKpi.cpc} fmt={v => `¥${v.toFixed(2)}`} reverse />
        </div>
        <div className="grid grid-cols-5 gap-2">
          <KpiCard label="CPM(千次曝光成本)" value={totalKpi.totalImpr > 0 ? (totalKpi.totalCost / totalKpi.totalImpr) * 1000 : 0} fmt={v => `¥${v.toFixed(2)}`} reverse />
          <KpiCard label="成交花费占比" value={totalKpi.totalGmv > 0 ? (totalKpi.totalCost / totalKpi.totalGmv) * 100 : 0} fmt={v => v.toFixed(1) + '%'} reverse />
          <KpiCard label="推广占GMV比" value={totalKpi.promoRatio} fmt={v => v.toFixed(1) + '%'} reverse />
          <KpiCard label="询单量" value={totalKpi.p.inquiry} fmt={v => v.toString()} />
          <KpiCard label="收藏/关注" value={totalKpi.p.favorite + totalKpi.s.follow} fmt={v => v.toString()} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {channelData.map(ch => (
            <div key={ch.key} className="pdd-card px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-[var(--pdd-text-secondary)]">{ch.name}</p>
                <p className="text-lg font-bold">¥{ch.cost.toFixed(0)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-[var(--pdd-text-secondary)]">ROI</p>
                <p className={`text-lg font-bold ${ch.roi >= 2 ? 'text-pdd-success' : ch.roi >= 1 ? 'text-pdd-warning' : 'text-pdd-danger'}`}>{ch.roi.toFixed(2)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">推广花费 & ROI 趋势</h4>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 9 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line yAxisId="left" type="monotone" dataKey="cost" stroke="var(--pdd-danger)" strokeWidth={2} name="花费 ¥" dot={{ r: 1 }} />
                  <Line yAxisId="right" type="monotone" dataKey="roi" stroke="var(--pdd-primary)" strokeWidth={2} name="ROI" dot={{ r: 1 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : <div className="h-[200px] flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div>}
          </div>
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">渠道花费占比</h4>
            {channelData.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={channelData} dataKey="cost" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                    {channelData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `¥${v.toFixed(0)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </div>
        {/* 渠道趋势对比 */}
        {(starTrend.length > 0 || liveTrend.length > 0) && (
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">各渠道花费趋势对比</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="cost" stroke="var(--pdd-danger)" strokeWidth={2} name="商品推广" dot={{ r: 1 }} />
                {starTrend.length > 0 && <Line type="monotone" data={starTrend.slice(-30)} dataKey="cost" stroke="var(--pdd-warning)" strokeWidth={2} name="明星店铺" dot={{ r: 1 }} />}
                {liveTrend.length > 0 && <Line type="monotone" data={liveTrend.slice(-30)} dataKey="cost" stroke="var(--pdd-primary)" strokeWidth={2} name="直播推广" dot={{ r: 1 }} />}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* 预警条 */}
        {(spendWarnings || channelData.some(ch => ch.roi < 1)) && (
          <div className="space-y-1">
            {channelData.some(ch => ch.roi < 1) && (
              <div className="pdd-card px-3 py-2 text-xs text-pdd-danger bg-pdd-danger/5 border border-pdd-danger/20 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                {channelData.filter(ch => ch.roi < 1).map(ch => ch.name).join('、')} ROI低于1.0，推广处于亏损状态，建议优化或暂停。
              </div>
            )}
            {spendWarnings?.map((w, i) => (
              <div key={i} className="pdd-card px-3 py-2 text-xs text-pdd-warning bg-pdd-warning/5 border border-pdd-warning/20 flex items-center gap-1.5">
                <AlertTriangle size={12} />{w}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderProduct = () => (
    <div className="space-y-3">
      {productKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="推广花费" value={productKpi.cost} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广GMV" value={productKpi.gmv} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广ROI" value={productKpi.roi} fmt={v => v.toFixed(2)} />
          <KpiCard label="推广订单" value={productKpi.orders} fmt={v => v.toString()} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2">花费趋势</h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData.slice(-30)}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 9 }} />
                <YAxis tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: number) => `¥${v}`} />
                <Bar dataKey="cost" fill="var(--pdd-danger)" radius={[4, 4, 0, 0]} name="花费" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
        <div className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2">商品TOP10 按花费</h4>
          {topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={sortedTopProducts.slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 8 }} width={70} />
                <Tooltip formatter={(v: number) => `¥${v.toFixed(0)}`} contentStyle={{ fontSize: 10 }} />
                <Bar dataKey="cost" fill="var(--pdd-danger)" radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
      </div>
      <div className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold">推广商品盈利表</h4>
          <button onClick={exportPromoCSV} className="flex items-center gap-1 px-2 py-1 bg-pdd-success text-white rounded text-[10px]"><Download size={12} />导出CSV</button>
        </div>
        {topProducts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                <th className="py-1.5 text-left">商品</th>
                <th className="py-1.5 text-right cursor-pointer hover:text-pdd-text" onClick={() => setTopSortBy('cost')}>花费{topSortBy === 'cost' ? ' ▼' : ''}</th>
                <th className="py-1.5 text-right">GMV</th>
                <th className="py-1.5 text-right cursor-pointer hover:text-pdd-text" onClick={() => setTopSortBy('roi')}>ROI{topSortBy === 'roi' ? ' ▼' : ''}</th>
                <th className="py-1.5 text-right cursor-pointer hover:text-pdd-text" onClick={() => setTopSortBy('orders')}>订单{topSortBy === 'orders' ? ' ▼' : ''}</th>
                <th className="py-1.5 text-right">CVR</th>
                <th className="py-1.5 text-right cursor-pointer hover:text-pdd-text" onClick={() => setTopSortBy('grossProfit')}>毛利{topSortBy === 'grossProfit' ? ' ▼' : ''}</th>
                <th className="py-1.5 text-center">盈利</th>
              </tr></thead>
              <tbody>
                {sortedTopProducts.map((p, i) => (
                  <tr key={i} className={`border-b border-[var(--pdd-border)] ${p.grossProfit > 0 ? 'bg-pdd-success/5' : p.grossProfit < 0 ? 'bg-pdd-danger/5' : ''}`}>
                    <td className="py-1.5 max-w-[120px] truncate" title={p.name}>{p.name || p.pid}</td>
                    <td className="py-1.5 text-right font-mono">¥{p.cost.toFixed(0)}</td>
                    <td className="py-1.5 text-right font-mono">¥{p.gmv.toFixed(0)}</td>
                    <td className="py-1.5 text-right font-mono">{p.roi.toFixed(2)}</td>
                    <td className="py-1.5 text-right">{p.orders}</td>
                    <td className="py-1.5 text-right">{p.cvr.toFixed(1)}%</td>
                    <td className="py-1.5 text-right font-mono">¥{p.grossProfit.toFixed(0)}</td>
                    <td className="py-1.5 text-center">{p.grossProfit > 0 ? <span className="text-pdd-success">✓</span> : p.grossProfit < -1 ? <span className="text-pdd-danger">✗</span> : <span className="text-pdd-warning">⚠</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="py-6 text-center text-xs text-[var(--pdd-text-secondary)]">暂无商品级推广数据</div>}
      </div>
    </div>
  );

  const renderStar = () => (
    <div className="space-y-3">
      {starKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="推广花费" value={starKpi.cost} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广GMV" value={starKpi.gmv} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广ROI" value={starKpi.roi} fmt={v => v.toFixed(2)} />
          <KpiCard label="推广订单" value={starKpi.orders} fmt={v => v.toString()} />
        </div>
      )}
      {starKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="曝光量" value={starKpi.impressions} fmt={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toString()} />
          <KpiCard label="点击量" value={starKpi.clicks} fmt={v => v.toString()} />
          <KpiCard label="CTR" value={starKpi.ctr} fmt={v => v.toFixed(2) + '%'} />
          <KpiCard label="CPC" value={starKpi.cpc} fmt={v => `¥${v.toFixed(2)}`} />
        </div>
      )}
      {starKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="店铺关注" value={starKpi.follow} fmt={v => v.toString()} />
          <KpiCard label="商品收藏" value={starKpi.favorite} fmt={v => v.toString()} />
          <KpiCard label="成交笔数" value={starKpi.orders} fmt={v => v.toString()} />
          <KpiCard label="CPA" value={starKpi.cpa} fmt={v => `¥${v.toFixed(2)}`} reverse />
        </div>
      )}
      {!hasStar && <div className="pdd-card text-center py-8 text-sm text-[var(--pdd-text-secondary)]">请上传明星店铺推广数据</div>}
    </div>
  );

  const renderLive = () => (
    <div className="space-y-3">
      {liveKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="推广花费" value={liveKpi.cost} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广GMV" value={liveKpi.gmv} fmt={v => `¥${v.toFixed(0)}`} />
          <KpiCard label="推广ROI" value={liveKpi.roi} fmt={v => v.toFixed(2)} />
          <KpiCard label="推广订单" value={liveKpi.orders} fmt={v => v.toString()} />
        </div>
      )}
      {liveKpi && (
        <div className="grid grid-cols-4 gap-2">
          <KpiCard label="曝光量" value={liveKpi.impressions} fmt={v => v >= 1000 ? `${(v/1000).toFixed(1)}K` : v.toString()} />
          <KpiCard label="关注量" value={liveKpi.follow} fmt={v => v.toString()} />
          <KpiCard label="商品收藏" value={liveKpi.favorite} fmt={v => v.toString()} />
          <KpiCard label="CPA" value={liveKpi.cpa} fmt={v => `¥${v.toFixed(2)}`} reverse />
        </div>
      )}
      {!hasLive && <div className="pdd-card text-center py-8 text-sm text-[var(--pdd-text-secondary)]">请上传直播推广数据</div>}
    </div>
  );

  const renderProfit = () => (
    <div className="space-y-3">
      {profitAnalysis ? (
        <>
          <div className="grid grid-cols-4 gap-2">
            <KpiCard label="商家实收" value={profitAnalysis.merchantIncome} fmt={v => `¥${v.toFixed(0)}`} />
            <KpiCard label="推广花费" value={profitAnalysis.totalPromoCost} fmt={v => `¥${v.toFixed(0)}`} reverse />
            <KpiCard label="推广净利润" value={profitAnalysis.netProfit} fmt={v => `¥${v.toFixed(0)}`} />
            <KpiCard label="毛利率" value={profitAnalysis.grossMargin} fmt={v => v.toFixed(1) + '%'} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <KpiCard label="裸货成本" value={profitAnalysis.rawCost} fmt={v => `¥${v.toFixed(0)}`} reverse />
            <KpiCard label="运费险" value={profitAnalysis.insuranceCost} fmt={v => `¥${v.toFixed(0)}`} reverse />
            <KpiCard label="推广费占比" value={profitAnalysis.totalPromoCost > 0 && profitAnalysis.merchantIncome > 0 ? (profitAnalysis.totalPromoCost / profitAnalysis.merchantIncome) * 100 : 0} fmt={v => v.toFixed(1) + '%'} reverse />
          </div>
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">商品盈利排行榜（毛利 = GMV - 成本 - 推广费）</h4>
            {profitAnalysis.productProfits.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-[10px]">
                  <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-1.5 text-left">商品</th><th className="py-1.5 text-right">推广花费</th><th className="py-1.5 text-right">GMV</th><th className="py-1.5 text-right">ROI</th><th className="py-1.5 text-right">估算成本</th><th className="py-1.5 text-right">毛利</th><th className="py-1.5 text-right">利润率</th><th className="py-1.5 text-center">盈亏平衡ROI</th>
                  </tr></thead>
                  <tbody>
                    {profitAnalysis.productProfits.map((p, i) => (
                      <tr key={i} className={`border-b border-[var(--pdd-border)] ${p.isProfitable ? 'bg-pdd-success/5' : 'bg-pdd-danger/5'}`}>
                        <td className="py-1.5 max-w-[120px] truncate" title={p.name}>{p.name || p.pid}</td>
                        <td className="py-1.5 text-right font-mono">¥{p.cost.toFixed(0)}</td>
                        <td className="py-1.5 text-right font-mono">¥{p.gmv.toFixed(0)}</td>
                        <td className="py-1.5 text-right font-mono">{p.roi.toFixed(2)}</td>
                        <td className="py-1.5 text-right font-mono">¥{p.estimatedCost.toFixed(0)}</td>
                        <td className="py-1.5 text-right font-mono" style={{ color: p.grossProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{p.grossProfit.toFixed(0)}</td>
                        <td className="py-1.5 text-right">{p.profitMargin.toFixed(1)}%</td>
                        <td className="py-1.5 text-center">{(p.breakEvenRoi < 20 ? p.breakEvenRoi.toFixed(2) : 'N/A')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        </>
      ) : (
        <div className="pdd-card text-center py-8 text-sm text-[var(--pdd-text-secondary)]">暂无足够数据计算推广盈利。请确保已上传订单数据和推广数据。</div>
      )}
    </div>
  );

  const renderKeyword = () => (
    <div className="space-y-3">
      {keywordData.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="pdd-card p-3">
              <h4 className="text-sm font-semibold mb-2">关键词CTR vs CVR 四象限</h4>
              <ResponsiveContainer width="100%" height={300}>
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                  <XAxis type="number" dataKey="ctr" name="CTR" unit="%" tick={{ fontSize: 9 }} />
                  <YAxis type="number" dataKey="cvr" name="CVR" unit="%" tick={{ fontSize: 9 }} />
                  <ZAxis dataKey="cost" range={[30, 200]} />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ fontSize: 10 }}
                    formatter={(v: number, name: string) => [name === 'ctr' ? v.toFixed(2) + '%' : name === 'cvr' ? v.toFixed(2) + '%' : `¥${v.toFixed(0)}`, name === 'ctr' ? 'CTR' : name === 'cvr' ? 'CVR' : '花费']} />
                  <Scatter data={keywordData.slice(0, 30)} fill="var(--pdd-danger)" />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
            <div className="pdd-card p-3">
              <h4 className="text-sm font-semibold mb-2">关键词效果TOP10</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={[...keywordData].sort((a, b) => b.gmv - a.gmv).slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 9 }} />
                  <YAxis type="category" dataKey="keyword" tick={{ fontSize: 8 }} width={80} />
                  <Tooltip contentStyle={{ fontSize: 10 }} />
                  <Bar dataKey="gmv" fill="var(--pdd-primary)" radius={[0, 4, 4, 0]} barSize={14} name="GMV" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">关键词效果排名</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-1.5 text-left">关键词</th><th className="py-1.5 text-right">花费</th><th className="py-1.5 text-right">GMV</th><th className="py-1.5 text-right">ROI</th><th className="py-1.5 text-right">订单</th><th className="py-1.5 text-right">CTR</th><th className="py-1.5 text-right">CVR</th><th className="py-1.5 text-right">CPA</th>
                </tr></thead>
                <tbody>
                  {keywordData.slice(0, 20).map((k, i) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-1.5 max-w-[150px] truncate" title={k.keyword}>{k.keyword}</td>
                      <td className="py-1.5 text-right font-mono">¥{k.cost.toFixed(0)}</td>
                      <td className="py-1.5 text-right font-mono">¥{k.gmv.toFixed(0)}</td>
                      <td className="py-1.5 text-right font-mono">{k.roi.toFixed(2)}</td>
                      <td className="py-1.5 text-right">{k.orders}</td>
                      <td className="py-1.5 text-right">{k.ctr.toFixed(2)}%</td>
                      <td className="py-1.5 text-right">{k.cvr.toFixed(2)}%</td>
                      <td className="py-1.5 text-right">¥{k.cpa.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className="pdd-card text-center py-8 text-sm text-[var(--pdd-text-secondary)]">暂无关键词级推广数据。请上传包含推广名称/关键词的商品推广数据。</div>
      )}
    </div>
  );

  const renderFunnel = () => {
    if (!totalKpi) return <div className="pdd-card text-center py-8 text-sm text-[var(--pdd-text-secondary)]">暂无推广数据</div>;
    const steps = [
      { name: '曝光量', value: totalKpi.totalImpr, pct: 100 },
      { name: '点击量', value: totalKpi.totalClicks, pct: totalKpi.totalImpr > 0 ? (totalKpi.totalClicks / totalKpi.totalImpr) * 100 : 0 },
      { name: '成交笔数', value: totalKpi.totalOrders, pct: totalKpi.totalClicks > 0 ? (totalKpi.totalOrders / totalKpi.totalClicks) * 100 : 0 },
    ];
    const maxVal = Math.max(...steps.map(s => s.value), 1);
    return (
      <div className="space-y-3">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-4">推广转化漏斗</h4>
          <div className="space-y-4">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-20 text-xs font-medium text-right text-[var(--pdd-text-secondary)]">{step.name}</div>
                <div className="flex-1 relative h-10 bg-[var(--pdd-bg)] rounded-lg overflow-hidden">
                  <div className="absolute inset-y-0 left-0 rounded-lg flex items-center px-3 transition-all" style={{ width: `${(step.value / maxVal) * 100}%`, backgroundColor: COLORS[i] }}>
                    <span className="text-xs font-bold text-white">{step.value >= 1000 ? `${(step.value / 1000).toFixed(1)}K` : step.value}</span>
                  </div>
                </div>
                <div className="w-16 text-xs text-[var(--pdd-text-secondary)]">{step.pct.toFixed(2)}%</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-[var(--pdd-text-secondary)]">
            整体转化率: {totalKpi.cvr.toFixed(2)}% | 曝光→成交: {totalKpi.totalImpr > 0 ? ((totalKpi.totalOrders / totalKpi.totalImpr) * 100).toFixed(3) : 0}%
          </div>
        </div>
        {/* 分渠道漏斗对比 */}
        {channelData.length > 1 && (
          <div className="pdd-card p-3">
            <h4 className="text-sm font-semibold mb-2">分渠道漏斗对比</h4>
            <div className="grid grid-cols-3 gap-3">
              {channelData.map(ch => (
                <div key={ch.key} className="text-center">
                  <p className="text-xs font-medium mb-1" style={{ color: COLORS[channelData.indexOf(ch) % COLORS.length] }}>{ch.name}</p>
                  <div className="space-y-1">
                    <div className="text-[10px]"><span className="text-[var(--pdd-text-secondary)]">花费</span> ¥{ch.cost.toFixed(0)}</div>
                    <div className="text-[10px]"><span className="text-[var(--pdd-text-secondary)]">GMV</span> ¥{ch.gmv.toFixed(0)}</div>
                    <div className="text-[10px]"><span className="text-[var(--pdd-text-secondary)]">ROI</span> {ch.roi.toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // AI报告生成 (FATAL-3修复)
  const buildReportPrompt = useCallback(() => {
    const summary: any = {
      timeRange: rangeLabel,
      channels: channelData,
      total: totalKpi ? {
        cost: totalKpi.totalCost, gmv: totalKpi.totalGmv, roi: totalKpi.roi,
        orders: totalKpi.totalOrders, ctr: totalKpi.ctr, cvr: totalKpi.cvr, cpc: totalKpi.cpc, cpa: totalKpi.cpa,
        promoRatio: totalKpi.promoRatio
      } : null,
      profit: profitAnalysis ? {
        merchantIncome: profitAnalysis.merchantIncome, netProfit: profitAnalysis.netProfit,
        grossMargin: profitAnalysis.grossMargin, promoCostRatio: profitAnalysis.totalPromoCost > 0 && profitAnalysis.merchantIncome > 0 ? (profitAnalysis.totalPromoCost / profitAnalysis.merchantIncome) * 100 : 0
      } : null,
      topProducts: sortedTopProducts.slice(0, 10).map(p => ({ name: p.name, cost: p.cost, gmv: p.gmv, roi: p.roi, orders: p.orders, grossProfit: p.grossProfit })),
      bottomProducts: [...sortedTopProducts].sort((a, b) => a.grossProfit - b.grossProfit).slice(0, 5).map(p => ({ name: p.name, cost: p.cost, roi: p.roi, grossProfit: p.grossProfit })),
      topKeywords: keywordData.slice(0, 5).map(k => ({ keyword: k.keyword, cost: k.cost, roi: k.roi, ctr: k.ctr, cvr: k.cvr })),
      warnings: spendWarnings,
    };
    return JSON.stringify(summary, null, 2);
  }, [rangeLabel, channelData, totalKpi, profitAnalysis, sortedTopProducts, keywordData, spendWarnings]);

  const generateAiReport = useCallback(async () => {
    const configStr = localStorage.getItem('dianfx_ai_config');
    if (!configStr) { setAiError('请先在会员中心 → AI设置中配置 API Key'); return; }
    let config: any;
    try { config = JSON.parse(configStr); } catch { setAiError('AI配置解析失败，请重新配置'); return; }
    if (!config.apiKey || !config.enabled) { setAiError('AI功能未启用或API Key未配置'); return; }
    setAiLoading(true); setAiError(''); setAiReport(null);
    const controller = new AbortController();
    aiAbortRef.current = controller;
    try {
      const response = await fetch(config.model === 'gemini' ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.apiKey}` : 'https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: config.model !== 'gemini' ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey}` } : { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.model === 'gemini' ? {
          contents: [{ role: 'user', parts: [{ text: `你是一个拼多多电商数据分析专家。基于提供的推广数据统计，生成专业的推广分析报告。报告需包含: 整体表现摘要、关键发现(正面和需关注的)、商品盈利诊断(逐商品分析)、渠道效率评估、优化建议(按优先级排序)、预测展望。使用中文，用数据说话，给出具体可执行的建议。\n\n推广数据:\n${buildReportPrompt()}` }] }],
        } : {
          model: config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: '你是一个拼多多电商数据分析专家。基于提供的推广数据统计，生成专业的推广分析报告。报告需包含: 整体表现摘要、关键发现(正面和需关注的)、商品盈利诊断(逐商品分析)、渠道效率评估、优化建议(按优先级)、预测展望。使用中文，用数据说话，给出具体可执行的建议。用Markdown格式输出。' },
            { role: 'user', content: `请基于以下推广数据生成分析报告:\n${buildReportPrompt()}` },
          ],
          max_tokens: 3000,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`API请求失败: ${response.status}`);
      const data = await response.json();
      let text = '';
      if (config.model === 'gemini') {
        text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '未获取到报告内容';
      } else {
        text = data?.choices?.[0]?.message?.content || '未获取到报告内容';
      }
      setAiReport(text);
      setAiReportDate(new Date().toLocaleString('zh-CN'));
    } catch (e: any) {
      if (e.name === 'AbortError') { setAiError('报告生成已取消'); }
      else { setAiError(`报告生成失败: ${e.message}`); }
    } finally { setAiLoading(false); aiAbortRef.current = null; }
  }, [buildReportPrompt]);

  const cancelAiReport = useCallback(() => { if (aiAbortRef.current) { aiAbortRef.current.abort(); } }, []);

  // 将AI报告Markdown渲染为简单的React元素
  const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
      if (line.startsWith('### ')) return <h4 key={i} className="text-sm font-semibold mt-4 mb-1">{line.slice(4)}</h4>;
      if (line.startsWith('## ')) return <h3 key={i} className="text-base font-bold mt-5 mb-2">{line.slice(3)}</h3>;
      if (line.startsWith('# ')) return <h2 key={i} className="text-lg font-bold mt-5 mb-2">{line.slice(2)}</h2>;
      if (line.startsWith('- **') || line.startsWith('* **')) {
        const cleaned = line.replace(/^[-*]\s*\*\*/, '').replace(/\*\*/, '：');
        return <p key={i} className="text-xs ml-4 my-0.5">{cleaned}</p>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) return <p key={i} className="text-xs ml-4 my-0.5">{line.slice(2)}</p>;
      if (line.match(/^\d+\.\s/)) return <p key={i} className="text-xs ml-4 my-0.5">{line}</p>;
      if (line.trim() === '') return <div key={i} className="h-2" />;
      return <p key={i} className="text-xs my-0.5">{line}</p>;
    });
  };

  const renderReport = () => {
    const configStr = localStorage.getItem('dianfx_ai_config');
    const hasConfig = configStr && (() => { try { const c = JSON.parse(configStr); return c.apiKey && c.enabled; } catch { return false; } })();
    return (
      <div className="space-y-3">
        {aiReport ? (
          <div className="pdd-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2"><Sparkles size={18} color="var(--pdd-warning)" />推广数据AI分析报告</h3>
                <p className="text-[10px] text-[var(--pdd-text-secondary)]">生成时间: {aiReportDate}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => { setAiReport(null); setAiError(''); }} className="px-2 py-1 text-[10px] border border-[var(--pdd-border)] rounded-lg hover:bg-[var(--pdd-bg)]">清除</button>
                <button onClick={generateAiReport} disabled={aiLoading} className="flex items-center gap-1 px-3 py-1.5 bg-pdd-success text-white rounded-lg text-xs disabled:opacity-50">
                  {aiLoading ? <RefreshCw size={13} className="animate-spin" /> : <RefreshCw size={13} />}重新生成
                </button>
              </div>
            </div>
            {aiError && <div className="pdd-card px-3 py-2 text-xs text-pdd-danger bg-pdd-danger/5 mb-3">{aiError}</div>}
            <div className="prose prose-sm max-w-none">{renderMarkdown(aiReport)}</div>
          </div>
        ) : (
          <div className="pdd-card p-6 text-center space-y-4">
            <Sparkles size={48} className="mx-auto text-[var(--pdd-warning)]" />
            <div>
              <h4 className="text-sm font-semibold mb-1">AI 推广分析报告</h4>
              <p className="text-xs text-[var(--pdd-text-secondary)] max-w-md mx-auto">
                AI将基于当前推广数据，自动生成包含整体表现摘要、商品盈利诊断、渠道效率评估、优化建议、预测展望的专业分析报告。
              </p>
            </div>
            {aiLoading ? (
              <div className="flex flex-col items-center gap-2">
                <RefreshCw size={24} className="animate-spin text-[var(--pdd-primary)]" />
                <p className="text-xs text-[var(--pdd-text-secondary)]">正在生成报告，请稍候...</p>
                <button onClick={cancelAiReport} className="text-[10px] text-[var(--pdd-text-secondary)] hover:text-pdd-danger underline">取消</button>
              </div>
            ) : hasConfig ? (
              <button onClick={generateAiReport} className="inline-flex items-center gap-2 px-6 py-2.5 text-white rounded-xl text-sm font-medium" style={{ background: 'linear-gradient(to right, var(--pdd-primary), var(--pdd-danger))' }}>
                <Sparkles size={16} />生成报告
              </button>
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--pdd-bg)] rounded-lg text-xs text-[var(--pdd-text-secondary)]">
                  <span>需要配置 OpenAI 或 Gemini API Key</span>
                </div>
                <p className="text-[10px] text-[var(--pdd-text-secondary)]">请前往 会员中心 → AI设置 配置</p>
              </div>
            )}
            {aiError && !aiLoading && <div className="pdd-card px-3 py-2 text-xs text-pdd-danger bg-pdd-danger/5">{aiError}</div>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 space-y-3">
      <h2 className="text-lg font-semibold flex items-center gap-2"><Megaphone size={18} color="var(--pdd-danger)" />推广数据</h2>
      <TimeFilter state={tf} />

      <div className="flex gap-1 bg-pdd-card rounded-xl px-1.5 py-1 border border-pdd-border shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'text-white shadow-md' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg'
            }`}
            style={activeTab === tab.key ? { background: 'linear-gradient(to right, var(--pdd-danger), #ff6b5b)' } : {}}>
            <tab.icon size={13} />{tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'product' && renderProduct()}
      {activeTab === 'star' && (hasStar ? renderStar() : (
        <div className="pdd-card text-center py-10 text-sm text-[var(--pdd-text-secondary)] space-y-2">
          <Star size={32} className="mx-auto opacity-30" />
          <p>请上传明星店铺推广数据</p>
          <p className="text-[10px]">PDD推广后台 → 推广工具 → 明星店铺 → 导出数据</p>
          <p className="text-[10px]">上传时将文件类型选择为"明星店铺数据"</p>
        </div>
      ))}
      {activeTab === 'live' && (hasLive ? renderLive() : (
        <div className="pdd-card text-center py-10 text-sm text-[var(--pdd-text-secondary)] space-y-2">
          <Video size={32} className="mx-auto opacity-30" />
          <p>请上传直播推广数据</p>
          <p className="text-[10px]">PDD推广后台 → 推广工具 → 直播推广 → 导出数据</p>
          <p className="text-[10px]">上传时将文件类型选择为"直播推广数据"</p>
        </div>
      ))}
      {activeTab === 'profit' && renderProfit()}
      {activeTab === 'keyword' && renderKeyword()}
      {activeTab === 'funnel' && renderFunnel()}
      {activeTab === 'report' && renderReport()}
    </div>
  );
}

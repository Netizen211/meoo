import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { ShieldCheck, RotateCcw, AlertTriangle, Clock, Lock, Crown, ArrowUp, ArrowDown, Download, Search, TrendingUp, DollarSign, Package, Star, Filter, ChevronLeft, ChevronRight, Truck, Users, Tag, FileText, PieChart as PieChartIcon, BarChart3, Bell, X } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { useTimeFilter, TimeRange, safeFloat, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange, changePct, getCompareOrders } from '../components/TimeFilter';
import { findField, safeField, safeFieldNum } from '../utils/fieldAccess';

const COLORS = ['var(--pdd-danger)', '#ff6b5b', 'var(--pdd-warning)', 'var(--pdd-success)', 'var(--pdd-primary)', '#8c8c8c', 'var(--pdd-purple)', '#13c2c2'];

// 精确状态分类
const STATUS_GROUPS: Record<string, string[]> = {
  pending: ['待处理', '待审核', '待买家退货', '待商家收货', '等待'],
  processing: ['处理中', '审核中', '退款中'],
  success: ['退款成功', '已完成', '售后成功'],
  closed: ['已关闭', '已取消', '已驳回'],
};

function classifyStatus(status: string): string {
  const s = status.trim();
  if (!s) return 'other';
  for (const kw of STATUS_GROUPS.pending) if (s.includes(kw)) return 'pending';
  for (const kw of STATUS_GROUPS.processing) if (s.includes(kw)) return 'processing';
  for (const kw of STATUS_GROUPS.success) if (s.includes(kw)) return 'success';
  for (const kw of STATUS_GROUPS.closed) if (s.includes(kw)) return 'closed';
  return 'other';
}

function getProductId(row: any): string {
  return safeField(row, '商品ID', '商品id', '商品编号', '商品Id');
}

function getOrderNo(row: any): string {
  return safeField(row, '订单编号', '订单号');
}

function getRefundAmount(row: any): number {
  return safeFieldNum(row, '买家退款金额', '退款金额', '退款金额(元)', '退款(元)');
}

function getSkuInfo(row: any): string {
  return safeField(row, 'sku信息', 'SKU信息', '商品规格', '规格');
}

type TabKey = 'overview' | 'refund' | 'timeWindow' | 'efficiency' | 'logistics' | 'promoCross' | 'region' | 'productRisk' | 'warning' | 'detail';

export default function AfterSalePage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [productRiskSub, setProductRiskSub] = useState<'sku' | 'risk' | 'timeline'>('sku');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [detailRecord, setDetailRecord] = useState<any>(null);
  const pageSize = 20;

  // 数据源
  const afterSaleRecords = useMemo(() => currentDisplayData?.afterSaleRecords || [], [currentDisplayData]);
  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(findField(o, '订单状态') || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const promotionProducts = useMemo(() => currentDisplayData?.promotionProducts || [], [currentDisplayData]);
  const promotionSummary = useMemo(() => currentDisplayData?.promotionSummary || [], [currentDisplayData]);
  const starStoreSummary = useMemo(() => currentDisplayData?.starStoreSummary || [], [currentDisplayData]);
  const liveStreamSummary = useMemo(() => currentDisplayData?.liveStreamSummary || [], [currentDisplayData]);
  const allPromo = useMemo(() => [...promotionProducts, ...promotionSummary, ...starStoreSummary, ...liveStreamSummary], [promotionProducts, promotionSummary, starStoreSummary, liveStreamSummary]);
  const hasPromoData = allPromo.length > 0;

  const hasIndependentData = afterSaleRecords.length > 0;
  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);

  // 时间过滤
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange), [orders, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredAfterSaleRecords = useMemo(() => {
    if (!hasIndependentData) return [];
    return filterPromoByTimeRange(afterSaleRecords, allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange);
  }, [afterSaleRecords, allDates, timeRange, hasIndependentData, customStart, customEnd, quickRange]);

  // 上一周期数据（用于环比）
  const compareOrders = useMemo(() => {
    if (!compareEnabled) return [];
    return getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange);
  }, [compareEnabled, orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange]);

  // ========== 双数据源合并 unifiedRecords (FATAL-5) ==========
  const unifiedRecords = useMemo(() => {
    const records: any[] = [];
    const seenOrders = new Set<string>();

    // 源 A: 独立售后数据（字段丰富）
    for (const r of filteredAfterSaleRecords) {
      const orderNo = getOrderNo(r);
      records.push({ ...r, _source: 'afterSale' as const });
      if (orderNo) seenOrders.add(orderNo);
    }

    // 源 B: 订单CSV中含售后状态的订单（字段有限）
    let fromOrderCount = 0;
    for (const o of filteredOrders) {
      const orderNo = safeField(o, '订单号', '订单编号');
      const asStatus = safeField(o, '售后状态');
      if (!orderNo || seenOrders.has(orderNo)) continue;
      if (!asStatus || asStatus === '无售后或售后取消' || asStatus === '无') continue;
      records.push({ ...o, _source: 'order' as const });
      fromOrderCount++;
    }

    return { records, fromOrderCount };
  }, [filteredAfterSaleRecords, filteredOrders]);

  const records = unifiedRecords.records;

  // ========== KPI 计算 (FATAL-2 修复：不回落用户实付) ==========
  const kpiData = useMemo(() => {
    const totalOrders = filteredOrders.length;
    let afterSaleCount = records.length;
    let refundAmount = 0;
    let returnRefundCount = 0;
    let processTimes: number[] = [];
    let overlongCount = 0;

    records.forEach((r: any) => {
      refundAmount += getRefundAmount(r);
      const type = safeField(r, '退款类型', '售后类型');
      if (type.includes('退货')) returnRefundCount++;

      const applyTime = safeField(r, '申请时间');
      const agreeTime = safeField(r, '同意退款时间', '同意退货时间');
      if (applyTime && agreeTime) {
        const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
        if (hours > 0 && hours < 720) {
          processTimes.push(hours);
        } else if (hours >= 720) {
          overlongCount++;
          processTimes.push(hours); // 不静默排除，但单独计数
        }
      }
    });

    const afterSaleRate = totalOrders > 0 ? (afterSaleCount / totalOrders) * 100 : 0;
    const avgProcessTime = processTimes.length > 0 ? processTimes.reduce((a, b) => a + b, 0) / processTimes.length : 0;
    const returnRefundRate = afterSaleCount > 0 ? (returnRefundCount / afterSaleCount) * 100 : 0;

    // 环比计算 (SEVERE-5)
    let compareAfterSaleCount = 0;
    let compareRefundAmount = 0;
    let compareAfterSaleRate = 0;
    if (compareEnabled && compareOrders.length) {
      compareOrders.forEach((o: any) => {
        const asStatus = safeField(o, '售后状态');
        if (asStatus && asStatus !== '无售后或售后取消' && asStatus !== '无') {
          compareAfterSaleCount++;
          compareRefundAmount += getRefundAmount(o);
        }
      });
      compareAfterSaleRate = compareOrders.length > 0 ? (compareAfterSaleCount / compareOrders.length) * 100 : 0;
    }

    return {
      afterSaleCount, afterSaleRate, refundAmount, avgProcessTime,
      returnRefundRate, totalOrders, overlongCount,
      compareAfterSaleCount, compareRefundAmount, compareAfterSaleRate,
    };
  }, [records, filteredOrders, compareEnabled, compareOrders]);

  // ========== 售后趋势（精确状态分类 SEVERE-2）==========
  const trendData = useMemo(() => {
    const dateMap: Record<string, { success: number; pending: number; processing: number; closed: number; other: number }> = {};
    records.forEach((r: any) => {
      const date = safeField(r, '申请时间', '售后申请时间').split(' ')[0];
      if (!date || !/^\d{4}[-\/]\d{2}[-\/]\d{2}$/.test(date)) return;
      const nd = date.replace(/\//g, '-');
      if (!dateMap[nd]) dateMap[nd] = { success: 0, pending: 0, processing: 0, closed: 0, other: 0 };
      const cls = classifyStatus(safeField(r, '售后状态'));
      dateMap[nd][cls as keyof typeof dateMap['']]++;
    });
    return Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [records]);

  // ========== 退款原因分布 ==========
  const reasonData = useMemo(() => {
    const reasonMap: Record<string, number> = {};
    records.forEach((r: any) => {
      const reason = safeField(r, '退款原因', '售后原因') || '其他';
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });
    return Object.entries(reasonMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [records]);

  // ========== 退款分析数据（新增 Tab）==========
  const refundAnalysis = useMemo(() => {
    const dateMap: Record<string, { onlyRefund: number; returnRefund: number; amount: number }> = {};
    let totalRefundAmt = 0;
    const amountBuckets = { '<¥10': 0, '¥10-50': 0, '¥50-100': 0, '¥100-200': 0, '¥200-500': 0, '>¥500': 0 };

    records.forEach((r: any) => {
      const date = safeField(r, '申请时间').split(' ')[0].replace(/\//g, '-');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (!dateMap[date]) dateMap[date] = { onlyRefund: 0, returnRefund: 0, amount: 0 };
        const type = safeField(r, '退款类型');
        const amt = getRefundAmount(r);
        if (type.includes('退货')) dateMap[date].returnRefund++;
        else dateMap[date].onlyRefund++;
        dateMap[date].amount += amt;
      }
      totalRefundAmt += getRefundAmount(r);
      const amt = getRefundAmount(r);
      if (amt < 10) amountBuckets['<¥10']++;
      else if (amt < 50) amountBuckets['¥10-50']++;
      else if (amt < 100) amountBuckets['¥50-100']++;
      else if (amt < 200) amountBuckets['¥100-200']++;
      else if (amt < 500) amountBuckets['¥200-500']++;
      else amountBuckets['>¥500']++;
    });

    const trend = Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));
    const distribution = Object.entries(amountBuckets).map(([name, value]) => ({ name, value }));

    return { trend, totalRefundAmt, distribution };
  }, [records]);

  // ========== 处理时效分析（SEVERE-1修复：不静默排除）==========
  const efficiencyData = useMemo(() => {
    let totalHours = 0, validCount = 0, overtimeCount = 0, overlongCount = 0;
    const handlerMap: Record<string, { count: number; totalHours: number; onlyRefund: number; returnRefund: number }> = {};
    const buckets = { '0-2h': 0, '2-6h': 0, '6-24h': 0, '24-72h': 0, '>72h': 0 };

    records.forEach((r: any) => {
      const applyTime = safeField(r, '申请时间');
      const agreeTime = safeField(r, '同意退款时间', '同意退货时间');
      const handler = safeField(r, '同意退款人', '处理人');
      const type = safeField(r, '退款类型');
      if (applyTime && agreeTime) {
        const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
        if (hours > 0) {
          totalHours += hours;
          validCount++;
          if (hours > 24) overtimeCount++;
          if (hours >= 720) overlongCount++;
          if (hours <= 2) buckets['0-2h']++;
          else if (hours <= 6) buckets['2-6h']++;
          else if (hours <= 24) buckets['6-24h']++;
          else if (hours <= 72) buckets['24-72h']++;
          else buckets['>72h']++;
          if (handler) {
            if (!handlerMap[handler]) handlerMap[handler] = { count: 0, totalHours: 0, onlyRefund: 0, returnRefund: 0 };
            handlerMap[handler].count++;
            handlerMap[handler].totalHours += hours;
            if (type.includes('退货')) handlerMap[handler].returnRefund++;
            else handlerMap[handler].onlyRefund++;
          }
        }
      }
    });

    const avgHours = validCount > 0 ? totalHours / validCount : 0;
    const overtimeRate = validCount > 0 ? (overtimeCount / validCount) * 100 : 0;
    const slaRate = validCount > 0 ? ((validCount - overtimeCount) / validCount) * 100 : 0;
    const handlerRank = Object.entries(handlerMap)
      .map(([name, d]) => ({ name: name.slice(0, 15), count: d.count, avgHours: d.totalHours / d.count, onlyRefund: d.onlyRefund, returnRefund: d.returnRefund }))
      .sort((a, b) => a.avgHours - b.avgHours);
    const durationDist = Object.entries(buckets).map(([name, value]) => ({ name, value }));

    return { avgHours, overtimeCount, overtimeRate, slaRate, overlongCount, handlerRank, durationDist };
  }, [records]);

  // ========== 退货物流追踪 ==========
  const logisticsData = useMemo(() => {
    const statusMap: Record<string, number> = {};
    const courierMap: Record<string, number> = {};
    let interceptTotal = 0, interceptSuccess = 0;
    let returnDaysSum = 0, returnDaysCount = 0;
    let totalReturns = 0;
    let abnormalLogistics = 0;

    records.forEach((r: any) => {
      const trackingNo = safeField(r, '退货运单号');
      const logisticsStatus = safeField(r, '退货物流状态');
      const interceptStatus = safeField(r, '快递拦截状态');
      const courier = safeField(r, '快递公司', '物流公司');

      if (trackingNo) {
        totalReturns++;
        if (logisticsStatus) statusMap[logisticsStatus] = (statusMap[logisticsStatus] || 0) + 1;
        if (courier) courierMap[courier] = (courierMap[courier] || 0) + 1;

        const agreeTime = safeField(r, '同意退款时间', '同意退货时间');
        const logisticsTime = safeField(r, '退货物流状态对应时间');
        if (agreeTime && logisticsTime) {
          const days = (new Date(logisticsTime).getTime() - new Date(agreeTime).getTime()) / 86400000;
          if (days > 0 && days < 60) { returnDaysSum += days; returnDaysCount++; }
        }
        // 异常物流：有运单号但超过7天无物流更新
        if (logisticsTime) {
          const daysSinceUpdate = (Date.now() - new Date(logisticsTime).getTime()) / 86400000;
          if (daysSinceUpdate > 7 && !safeField(r, '退货物流状态').includes('签收')) abnormalLogistics++;
        }
      }
      if (interceptStatus) {
        interceptTotal++;
        if (interceptStatus.includes('成功') || interceptStatus.includes('已拦截')) interceptSuccess++;
      }
    });

    const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const courierDist = Object.entries(courierMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const interceptRate = interceptTotal > 0 ? (interceptSuccess / interceptTotal) * 100 : 0;
    const avgReturnDays = returnDaysCount > 0 ? returnDaysSum / returnDaysCount : 0;

    return { statusDist, interceptRate, avgReturnDays, totalReturns, courierDist, abnormalLogistics };
  }, [records]);

  // ========== SKU级售后拆解（FATAL-7修复）==========
  const skuBreakdown = useMemo(() => {
    const skuMap: Record<string, { count: number; refundAmount: number; orderCount: number }> = {};
    // 统计SKU销量
    const skuOrderCounts: Record<string, number> = {};
    filteredOrders.forEach((o: any) => {
      const sku = getSkuInfo(o);
      if (sku) {
        const skuKey = sku.length > 40 ? sku.slice(0, 40) + '...' : sku;
        skuOrderCounts[skuKey] = (skuOrderCounts[skuKey] || 0) + 1;
      }
    });

    records.forEach((r: any) => {
      const sku = getSkuInfo(r);
      if (!sku) return;
      const skuKey = sku.length > 40 ? sku.slice(0, 40) + '...' : sku;
      if (!skuMap[skuKey]) skuMap[skuKey] = { count: 0, refundAmount: 0, orderCount: skuOrderCounts[skuKey] || 0 };
      skuMap[skuKey].count++;
      skuMap[skuKey].refundAmount += getRefundAmount(r);
    });
    return Object.entries(skuMap)
      .map(([name, d]) => ({ name, count: d.count, refundAmount: d.refundAmount, orderCount: d.orderCount, afterSaleRate: d.orderCount > 0 ? (d.count / d.orderCount) * 100 : 0 }))
      .sort((a, b) => b.refundAmount - a.refundAmount);
  }, [records, filteredOrders]);

  // ========== 高风险商品（FATAL-4修复 + 多因子评分）==========
  const highRiskProducts = useMemo(() => {
    const productMap: Record<string, { name: string; productId: string; afterSaleCount: number; orderCount: number; refundAmount: number; revenue: number }> = {};

    records.forEach((r: any) => {
      const pid = getProductId(r);
      if (!pid) return;
      if (!productMap[pid]) {
        productMap[pid] = { name: getSkuInfo(r).split(',')[0] || pid, productId: pid, afterSaleCount: 0, orderCount: 0, refundAmount: 0, revenue: 0 };
      }
      productMap[pid].afterSaleCount++;
      productMap[pid].refundAmount += getRefundAmount(r);
    });

    // 统计商品总销量
    filteredOrders.forEach((o: any) => {
      const pid = getProductId(o);
      if (productMap[pid]) {
        productMap[pid].orderCount++;
        productMap[pid].revenue += safeFloat(findField(o, '商家实收金额(元)', '商家实收'));
      }
    });

    // 计算全店平均售后率
    const allProducts = Object.values(productMap);
    const avgAfterSaleRate = allProducts.length > 0
      ? allProducts.reduce((s, p) => s + (p.orderCount > 0 ? p.afterSaleCount / p.orderCount : 0), 0) / allProducts.length
      : 0;
    const avgRefundAmt = allProducts.length > 0
      ? allProducts.reduce((s, p) => s + p.refundAmount, 0) / allProducts.length
      : 0;

    return allProducts
      .map(p => {
        const afterSaleRate = p.orderCount > 0 ? (p.afterSaleCount / p.orderCount) * 100 : 0;
        const rateDeviation = avgAfterSaleRate > 0 ? (afterSaleRate / avgAfterSaleRate) * 100 : 100;
        const amtDeviation = avgRefundAmt > 0 ? (p.refundAmount / avgRefundAmt) * 100 : 100;
        const refundRevenueRatio = p.revenue > 0 ? (p.refundAmount / p.revenue) * 100 : 0;
        const riskScore = rateDeviation * 0.4 + amtDeviation * 0.3 + (p.afterSaleCount * 5) * 0.2 + refundRevenueRatio * 0.1;
        return { ...p, afterSaleRate, refundRevenueRatio, riskScore };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }, [records, filteredOrders]);

  // ========== 退款时间窗口分析 ==========
  const timeWindowAnalysis = useMemo(() => {
    const orderMap = new Map<string, any>();
    filteredOrders.forEach((o: any) => {
      const orderNo = safeField(o, '订单号', '订单编号');
      if (orderNo) orderMap.set(orderNo, o);
    });

    const windows = [
      { key: '0-7天', label: '0-7天', min: 0, max: 7 },
      { key: '8-30天', label: '8-30天', min: 8, max: 30 },
      { key: '31-90天', label: '31-90天', min: 31, max: 90 },
      { key: '91-180天', label: '91-180天', min: 91, max: 180 },
      { key: '180天+', label: '180天+', min: 181, max: Infinity },
    ];

    interface WindowBucket { count: number; refundAmount: number; onlyRefund: number; returnRefund: number; reasons: Record<string, number>; }
    const windowData: Record<string, WindowBucket> = {};
    windows.forEach(w => { windowData[w.key] = { count: 0, refundAmount: 0, onlyRefund: 0, returnRefund: 0, reasons: {} }; });

    let unmatchedPayTime = 0;
    let negativeDays = 0;
    let totalWithPayTime = 0;

    records.forEach((r: any) => {
      const orderNo = getOrderNo(r);
      if (!orderNo) return;
      const order = orderMap.get(orderNo);
      if (!order) return;
      const payTime = safeField(order, '支付时间');
      const applyTime = safeField(r, '申请时间');
      if (!payTime || !applyTime) { unmatchedPayTime++; return; }
      const days = (new Date(applyTime).getTime() - new Date(payTime).getTime()) / 86400000;
      if (days < 0) { negativeDays++; return; }
      totalWithPayTime++;

      const w = windows.find(w => days >= w.min && days <= w.max);
      if (!w) return;
      const bucket = windowData[w.key];
      bucket.count++;
      const amt = getRefundAmount(r);
      bucket.refundAmount += amt;
      const type = safeField(r, '退款类型');
      if (type.includes('退货')) bucket.returnRefund++;
      else bucket.onlyRefund++;

      const reason = safeField(r, '退款原因', '售后原因') || '其他';
      bucket.reasons[reason] = (bucket.reasons[reason] || 0) + 1;
    });

    const windowList = windows.map(w => ({
      ...w,
      ...windowData[w.key],
      pct: totalWithPayTime > 0 ? (windowData[w.key].count / totalWithPayTime) * 100 : 0,
    }));

    const topReasons = new Set<string>();
    windowList.forEach(w => {
      Object.entries(w.reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([r]) => topReasons.add(r));
    });

    return { windowList, topReasons: [...topReasons], unmatchedPayTime, negativeDays, totalWithPayTime };
  }, [records, filteredOrders]);

  // ========== 推广与售后交叉分析 ==========
  const promoCrossAnalysis = useMemo(() => {
    if (!hasPromoData || filteredOrders.length === 0) {
      return { hasData: false, promoOrders: 0, nonPromoOrders: 0, promoAfterSaleRate: 0, nonPromoAfterSaleRate: 0, promoRefundAmount: 0, nonPromoRefundAmount: 0, trueRoi: 0, nominalRoi: 0, totalPromoCost: 0, totalPromoGmv: 0, channelBreakdown: [] as any[] };
    }

    // Step 1: 构建 商品ID×日期 → 推广订单数 的映射
    // 推广明细中的"成交笔数"已剔除秒拍秒退，是推广带来的稳定订单
    const promoStats: Record<string, { promoOrders: number; promoGmv: number; promoCost: number; channelCosts: Record<string, number> }> = {};

    let totalPromoCost = 0;
    let totalPromoGmv = 0;
    let totalPromoOrders = 0;

    allPromo.forEach((p: any) => {
      const productId = String(findField(p, '商品ID', '商品id', '商品编号') || '').trim();
      const date = String(findField(p, '日期') || '').trim().split(' ')[0].replace(/\//g, '-');
      if (!productId || !date) return;

      const cost = safeFloat(findField(p, '总花费(元)', '花费(元)', '成交花费(元)', '推广花费'));
      const gmv = safeFloat(findField(p, '交易额(元)', '成交金额(元)', '推广GMV'));
      const orders = safeFloat(findField(p, '成交笔数', '推广订单数', '订单数'));

      const key = `${productId}_${date}`;
      if (!promoStats[key]) promoStats[key] = { promoOrders: 0, promoGmv: 0, promoCost: 0, channelCosts: {} };
      promoStats[key].promoOrders += orders;
      promoStats[key].promoGmv += gmv;
      promoStats[key].promoCost += cost;

      const source = p._source || 'search';
      const chKey = source === 'starStore' ? '明星店铺' : source === 'liveStream' ? '直播推广' : '搜索推广';
      promoStats[key].channelCosts[chKey] = (promoStats[key].channelCosts[chKey] || 0) + cost;

      totalPromoCost += cost;
      totalPromoGmv += gmv;
      totalPromoOrders += orders;
    });

    // Step 2: 统计每个 商品ID×日期 的总订单数（排除已取消）
    const totalStats: Record<string, number> = {};
    filteredOrders.forEach((o: any) => {
      const productId = String(safeField(o, '商品ID', '商品id', '商品编号') || '').trim();
      const payDate = (safeField(o, '支付时间') || '').split(' ')[0].replace(/\//g, '-');
      if (!productId || !payDate) return;
      const key = `${productId}_${payDate}`;
      totalStats[key] = (totalStats[key] || 0) + 1;
    });

    // Step 3: 计算每个 key 的推广占比
    // promoRatio = 推广订单数 / 总订单数（cap at 1.0）
    const ratioMap: Record<string, number> = {};
    let totalWithPromo = 0; // 有推广数据的商品×日期 的总订单
    let promoOrderEstimate = 0; // 按比例分摊后的推广订单估算
    Object.keys(promoStats).forEach(key => {
      const total = totalStats[key] || 0;
      if (total > 0) {
        const ratio = Math.min(promoStats[key].promoOrders / total, 1.0);
        ratioMap[key] = ratio;
        totalWithPromo += total;
        promoOrderEstimate += total * ratio;
      }
    });

    // 无推广数据的商品×日期：自然订单
    const totalAllOrders = filteredOrders.length;
    const nonPromoOrderEstimate = totalAllOrders - promoOrderEstimate;

    // Step 4: 按比例分摊售后
    let promoAfterSaleCount = 0;
    let nonPromoAfterSaleCount = 0;
    let promoRefundAmount = 0;
    let nonPromoRefundAmount = 0;
    // 渠道统计
    const channelStats: Record<string, { cost: number; gmv: number; promoOrders: number; afterSaleCount: number; refundAmount: number }> = {};

    records.forEach((r: any) => {
      const orderNo = getOrderNo(r);
      const amt = getRefundAmount(r);
      if (!orderNo) return;

      // 从 unifiedRecords 中找对应的 order 获取 productId + payDate
      const productId = String(getProductId(r) || '').trim();
      const applyDate = (safeField(r, '申请时间') || '').split(' ')[0].replace(/\//g, '-');

      // 尝试用订单号反查订单数据获取支付日期
      let payDate = applyDate; // fallback: 用申请日期近似
      const order = filteredOrders.find((o: any) => safeField(o, '订单号', '订单编号') === orderNo);
      if (order) {
        payDate = (safeField(order, '支付时间') || '').split(' ')[0].replace(/\//g, '-');
      }

      const key = `${productId}_${payDate}`;
      const promoRatio = ratioMap[key] ?? 0; // 查不到推广数据 → 全算自然

      const pCount = promoRatio;
      const nCount = 1 - promoRatio;
      promoAfterSaleCount += pCount;
      nonPromoAfterSaleCount += nCount;
      promoRefundAmount += amt * promoRatio;
      nonPromoRefundAmount += amt * (1 - promoRatio);

      // 按渠道花费比例分摊到各渠道
      if (promoRatio > 0 && promoStats[key]) {
        const chCosts = promoStats[key].channelCosts;
        const totalChCost = Object.values(chCosts).reduce((a, b) => a + b, 0);
        if (totalChCost > 0) {
          Object.entries(chCosts).forEach(([ch, cost]) => {
            const chShare = cost / totalChCost;
            if (!channelStats[ch]) channelStats[ch] = { cost: 0, gmv: 0, promoOrders: 0, afterSaleCount: 0, refundAmount: 0 };
            channelStats[ch].afterSaleCount += pCount * chShare;
            channelStats[ch].refundAmount += amt * promoRatio * chShare;
          });
        }
      }
    });

    // 汇总渠道统计
    Object.keys(promoStats).forEach(key => {
      const { promoOrders, promoGmv, promoCost, channelCosts } = promoStats[key];
      const totalChCost = Object.values(channelCosts).reduce((a, b) => a + b, 0);
      Object.entries(channelCosts).forEach(([ch, cost]) => {
        const chShare = totalChCost > 0 ? cost / totalChCost : 1;
        if (!channelStats[ch]) channelStats[ch] = { cost: 0, gmv: 0, promoOrders: 0, afterSaleCount: 0, refundAmount: 0 };
        channelStats[ch].cost += cost;
        channelStats[ch].gmv += promoGmv * chShare;
        channelStats[ch].promoOrders += promoOrders * chShare;
      });
    });

    const promoAfterSaleRate = promoOrderEstimate > 0 ? (promoAfterSaleCount / promoOrderEstimate) * 100 : 0;
    const nonPromoAfterSaleRate = nonPromoOrderEstimate > 0 ? (nonPromoAfterSaleCount / nonPromoOrderEstimate) * 100 : 0;
    const nominalRoi = totalPromoCost > 0 ? totalPromoGmv / totalPromoCost : 0;
    const trueRoi = totalPromoCost > 0 ? (totalPromoGmv - promoRefundAmount) / totalPromoCost : 0;

    const channelBreakdown = Object.entries(channelStats).map(([channel, d]) => {
      const chAfterSaleRate = d.promoOrders > 0 ? (d.afterSaleCount / d.promoOrders) * 100 : 0;
      const chNominalRoi = d.cost > 0 ? d.gmv / d.cost : 0;
      const chTrueRoi = d.cost > 0 ? (d.gmv - d.refundAmount) / d.cost : 0;
      return { channel, cost: d.cost, gmv: d.gmv, afterSaleCount: d.afterSaleCount, refundAmount: d.refundAmount, orderCount: Math.round(d.promoOrders), afterSaleRate: chAfterSaleRate, nominalRoi: chNominalRoi, trueRoi: chTrueRoi };
    }).filter(c => c.cost > 0);

    return { hasData: true, promoOrderEst: Math.round(promoOrderEstimate), nonPromoOrderEst: Math.round(nonPromoOrderEstimate), promoOrders: Math.round(promoOrderEstimate), nonPromoOrders: Math.round(nonPromoOrderEstimate), promoAfterSaleRate, nonPromoAfterSaleRate, promoRefundAmount, nonPromoRefundAmount, trueRoi, nominalRoi, totalPromoCost, totalPromoGmv, channelBreakdown, promoAfterSaleCount: Math.round(promoAfterSaleCount), nonPromoAfterSaleCount: Math.round(nonPromoAfterSaleCount) };
  }, [records, filteredOrders, allPromo, hasPromoData]);

  // ========== 地域售后分析 ==========
  const regionAnalysis = useMemo(() => {
    const provinceMap: Record<string, { orders: number; afterSale: number; refundAmount: number; reasons: Record<string, number> }> = {};
    const orderProvinceMap = new Map<string, string>();

    filteredOrders.forEach((o: any) => {
      const orderNo = safeField(o, '订单号', '订单编号');
      const province = safeField(o, '省', '省份');
      if (orderNo && province) {
        orderProvinceMap.set(orderNo, province);
        if (!provinceMap[province]) provinceMap[province] = { orders: 0, afterSale: 0, refundAmount: 0, reasons: {} };
        provinceMap[province].orders++;
      }
    });

    records.forEach((r: any) => {
      const orderNo = getOrderNo(r);
      if (!orderNo) return;
      const province = orderProvinceMap.get(orderNo);
      if (!province) return;
      if (!provinceMap[province]) provinceMap[province] = { orders: 0, afterSale: 0, refundAmount: 0, reasons: {} };
      provinceMap[province].afterSale++;
      provinceMap[province].refundAmount += getRefundAmount(r);
      const reason = safeField(r, '退款原因', '售后原因') || '其他';
      provinceMap[province].reasons[reason] = (provinceMap[province].reasons[reason] || 0) + 1;
    });

    const list = Object.entries(provinceMap)
      .map(([name, d]) => ({ province: name, ...d, afterSaleRate: d.orders >= 10 ? (d.afterSale / d.orders) * 100 : null, sufficient: d.orders >= 10 }))
      .sort((a, b) => (b.afterSaleRate ?? 0) - (a.afterSaleRate ?? 0));

    const sufficientList = list.filter(p => p.sufficient);
    const avgRate = sufficientList.length > 0 ? sufficientList.reduce((s, p) => s + (p.afterSaleRate ?? 0), 0) / sufficientList.length : 0;
    const stdRate = sufficientList.length > 1 ? Math.sqrt(sufficientList.reduce((s, p) => s + ((p.afterSaleRate ?? 0) - avgRate) ** 2, 0) / sufficientList.length) : 0;

    const topReasons = new Set<string>();
    list.forEach(p => {
      Object.entries(p.reasons).sort((a, b) => b[1] - a[1]).slice(0, 5).forEach(([r]) => topReasons.add(r));
    });

    return { list, avgRate, stdRate, topReasons: [...topReasons].slice(0, 5) };
  }, [records, filteredOrders]);

  // ========== 商品退款时效（合并到 productRisk Tab）==========
  const productAfterSaleTimeline = useMemo(() => {
    const orderMap = new Map<string, any>();
    filteredOrders.forEach((o: any) => {
      const orderNo = safeField(o, '订单号', '订单编号');
      if (orderNo) orderMap.set(orderNo, o);
    });

    const productMap: Record<string, { productId: string; name: string; afterSaleCount: number; refundAmount: number; totalDays: number; dayCount: number; fastRefund: number; longTailRefund: number }> = {};

    records.forEach((r: any) => {
      const pid = getProductId(r);
      if (!pid) return;
      if (!productMap[pid]) {
        productMap[pid] = { productId: pid, name: getSkuInfo(r).split(',')[0] || pid, afterSaleCount: 0, refundAmount: 0, totalDays: 0, dayCount: 0, fastRefund: 0, longTailRefund: 0 };
      }
      const p = productMap[pid];
      p.afterSaleCount++;
      p.refundAmount += getRefundAmount(r);

      const orderNo = getOrderNo(r);
      if (orderNo) {
        const order = orderMap.get(orderNo);
        if (order) {
          const payTime = safeField(order, '支付时间');
          const applyTime = safeField(r, '申请时间');
          if (payTime && applyTime) {
            const days = (new Date(applyTime).getTime() - new Date(payTime).getTime()) / 86400000;
            if (days >= 0 && days < 365) {
              p.totalDays += days;
              p.dayCount++;
              if (days <= 7) p.fastRefund++;
              if (days > 90) p.longTailRefund++;
            }
          }
        }
      }
    });

    return Object.values(productMap)
      .filter(p => p.afterSaleCount >= 2)
      .map(p => ({
        ...p,
        avgRefundDays: p.dayCount > 0 ? p.totalDays / p.dayCount : 0,
        fastRefundRate: p.afterSaleCount > 0 ? (p.fastRefund / p.afterSaleCount) * 100 : 0,
        longTailRate: p.afterSaleCount > 0 ? (p.longTailRefund / p.afterSaleCount) * 100 : 0,
      }))
      .sort((a, b) => b.refundAmount - a.refundAmount);
  }, [records, filteredOrders]);

  // ========== 预警中心数据 ==========
  const warningData = useMemo(() => {
    // 超时未处理（待处理 >48h）
    const overdueList: any[] = [];
    // 异常飙升检测：日售后率超过7日移动均线2倍标准差
    const dailyRates: { date: string; rate: number; avg7: number; isAnomaly: boolean }[] = [];

    const now = Date.now();
    records.forEach((r: any) => {
      const status = classifyStatus(safeField(r, '售后状态'));
      const applyTime = safeField(r, '申请时间');
      if (status === 'pending' && applyTime) {
        const hours = (now - new Date(applyTime).getTime()) / 3600000;
        if (hours > 48) {
          overdueList.push({ orderNo: getOrderNo(r), hours, ...r });
        }
      }
    });

    // 日售后率计算
    const dateCounts: Record<string, { asCount: number; total: number }> = {};
    records.forEach((r: any) => {
      const date = safeField(r, '申请时间').split(' ')[0].replace(/\//g, '-');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
        if (!dateCounts[date]) dateCounts[date] = { asCount: 0, total: 0 };
        dateCounts[date].asCount++;
      }
    });
    filteredOrders.forEach((o: any) => {
      const date = safeField(o, '支付时间').split(' ')[0].replace(/\//g, '-');
      if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && dateCounts[date]) {
        dateCounts[date].total++;
      }
    });

    const sortedDates = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));
    sortedDates.forEach(([date, v], i) => {
      const rate = v.total > 0 ? (v.asCount / v.total) * 100 : 0;
      if (i >= 7) {
        const window = sortedDates.slice(i - 7, i).map(([, v2]) => v2.total > 0 ? (v2.asCount / v2.total) * 100 : 0);
        const avg7 = window.reduce((a, b) => a + b, 0) / 7;
        const std = Math.sqrt(window.reduce((s, r) => s + (r - avg7) ** 2, 0) / 7);
        dailyRates.push({ date: date.slice(5), rate, avg7, isAnomaly: rate > avg7 + 2 * std });
      }
    });

    return { overdueList, dailyRates };
  }, [records, filteredOrders]);

  // ========== 明细列表（SEVERE-3修复：动态过滤器选项 + 精确匹配）==========
  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r: any) => {
      const s = safeField(r, '售后状态');
      if (s) set.add(s);
    });
    return Array.from(set).sort();
  }, [records]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    records.forEach((r: any) => {
      const t = safeField(r, '退款类型');
      if (t) set.add(t);
    });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() => {
    let result = records;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r: any) => {
        const fields = [getOrderNo(r), getProductId(r), getSkuInfo(r), safeField(r, '售后编号'), safeField(r, '备注')];
        return fields.some(f => f.toLowerCase().includes(q));
      });
    }
    if (statusFilter !== 'all') {
      result = result.filter((r: any) => safeField(r, '售后状态') === statusFilter);
    }
    if (typeFilter !== 'all') {
      result = result.filter((r: any) => safeField(r, '退款类型') === typeFilter);
    }
    return result;
  }, [records, searchQuery, statusFilter, typeFilter]);

  // timeRange 变更时重置页码 (MEDIUM-4)
  const changeTimeRange = (v: TimeRange) => { tf.setTimeRange(v); setCurrentPage(1); };

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getProcessHours = (r: any): { text: string; isAbnormal: boolean } => {
    const applyTime = safeField(r, '申请时间');
    const agreeTime = safeField(r, '同意退款时间', '同意退货时间');
    if (!applyTime || !agreeTime) return { text: '-', isAbnormal: false };
    const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
    if (hours < 0) return { text: '数据异常', isAbnormal: true };
    if (hours > 720) return { text: `${(hours / 24).toFixed(0)}天(超长)`, isAbnormal: true };
    return { text: hours < 1 ? `${Math.round(hours * 60)}分钟` : `${hours.toFixed(1)}h`, isAbnormal: false };
  };

  const exportCSV = () => {
    const headers = ['售后编号', '订单编号', '商品ID', 'SKU信息', '退款金额', '售后状态', '退款类型', '退款原因', '订单状态', '申请时间', '同意退款人', '退货物流状态', '备注', '处理时长'];
    const rows = filteredRecords.map((r: any) => [
      safeField(r, '售后编号'), getOrderNo(r), getProductId(r), getSkuInfo(r),
      getRefundAmount(r).toFixed(2), safeField(r, '售后状态'), safeField(r, '退款类型'), safeField(r, '退款原因'),
      safeField(r, '订单状态'), safeField(r, '申请时间'), safeField(r, '同意退款人'), safeField(r, '退货物流状态'),
      safeField(r, '备注'), getProcessHours(r).text
    ]);
    const csv = '﻿' + [headers.join(','), ...rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `售后数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const riskLevel = (score: number) => score >= 80 ? { cls: 'bg-pdd-danger/10 text-red-700', label: '高风险' }
    : score >= 50 ? { cls: 'bg-pdd-warning/10 text-yellow-700', label: '中风险' }
    : { cls: 'bg-pdd-success/10 text-green-700', label: '低风险' };

  // 空状态判断
  const isNoData = unifiedRecords.fromOrderCount === 0 && records.length === 0;
  const fromOrderOnly = !hasIndependentData && unifiedRecords.fromOrderCount > 0;

  if (!hasIndependentData && orders.length === 0) {
    return <div className="p-4"><div className="pdd-card text-center py-12"><p className="text-[var(--pdd-text-secondary)]">请先上传订单数据或售后数据</p></div></div>;
  }

  const kpis = [
    { label: '售后订单数', value: kpiData.afterSaleCount, fmt: (v: number) => v.toString(), icon: ShieldCheck, color: 'var(--pdd-danger)', change: compareEnabled ? changePct(kpiData.afterSaleCount, kpiData.compareAfterSaleCount) : null, reverse: true },
    { label: '售后率', value: kpiData.afterSaleRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-warning)', change: compareEnabled ? changePct(kpiData.afterSaleRate, kpiData.compareAfterSaleRate) : null, reverse: true },
    { label: '退款总金额', value: kpiData.refundAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)', change: compareEnabled ? changePct(kpiData.refundAmount, kpiData.compareRefundAmount) : null, reverse: true },
    { label: '平均处理时长', value: kpiData.avgProcessTime, fmt: (v: number) => v > 0 ? `${v.toFixed(1)}h` : '-', icon: Clock, color: 'var(--pdd-primary)', change: null },
    { label: '退货退款率', value: kpiData.returnRefundRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-purple)', change: null },
    { label: '超长处理', value: kpiData.overlongCount, fmt: (v: number) => v.toString(), icon: AlertTriangle, color: 'var(--pdd-danger)', change: null },
    { label: '仅退款单', value: kpiData.afterSaleCount - (() => { let c = 0; records.forEach((r: any) => { if (safeField(r, '退款类型').includes('退货')) c++; }); return c; })(), fmt: (v: number) => v.toString(), icon: FileText, color: 'var(--pdd-primary)', change: null },
    { label: '退货退款单', value: (() => { let c = 0; records.forEach((r: any) => { if (safeField(r, '退款类型').includes('退货')) c++; }); return c; })(), fmt: (v: number) => v.toString(), icon: Truck, color: 'var(--pdd-warning)', change: null },
  ];

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: '概览', icon: TrendingUp },
    { key: 'refund', label: '退款分析', icon: BarChart3 },
    { key: 'timeWindow', label: '时间窗口', icon: Clock },
    { key: 'efficiency', label: '处理时效', icon: Clock },
    { key: 'logistics', label: '退货物流', icon: Truck },
    { key: 'promoCross', label: '推广关联', icon: TrendingUp },
    { key: 'region', label: '地域分析', icon: Users },
    { key: 'productRisk', label: '商品售后', icon: Tag },
    { key: 'warning', label: '预警中心', icon: Bell },
    { key: 'detail', label: '明细列表', icon: FileText },
  ];

  // ========== 概览 ==========
  const renderOverview = () => {
    // 累计退款占比（用于概览卡片）
    const cumulativePct = (maxDays: number) => {
      if (!timeWindowAnalysis.totalWithPayTime) return null;
      const windows = timeWindowAnalysis.windowList;
      if (maxDays <= 7) return windows.find(w => w.key === '0-7天')?.pct ?? 0;
      if (maxDays <= 30) return (windows.find(w => w.key === '0-7天')?.pct ?? 0) + (windows.find(w => w.key === '8-30天')?.pct ?? 0);
      if (maxDays <= 60) {
        let sum = 0;
        windows.filter(w => w.min <= 60).forEach(w => sum += w.pct);
        return sum;
      }
      if (maxDays <= 90) {
        let sum = 0;
        windows.filter(w => w.min <= 90).forEach(w => sum += w.pct);
        return sum;
      }
      return 100;
    };
    const cumulativeCount = (maxDays: number) => {
      if (!timeWindowAnalysis.totalWithPayTime) return 0;
      let count = 0;
      timeWindowAnalysis.windowList.filter(w => w.min <= maxDays).forEach(w => count += w.count);
      return count;
    };

    const anomalyProvinceCount = regionAnalysis.list.filter(p => p.sufficient && (p.afterSaleRate ?? 0) > regionAnalysis.avgRate + 2 * regionAnalysis.stdRate).length;
    const interceptRecovery = logisticsData.interceptRate > 0 ? (logisticsData.interceptRate / 100) * kpiData.refundAmount : 0;

    const hasTimeData = timeWindowAnalysis.totalWithPayTime > 0;

    return (
    <div className="space-y-4">
      {fromOrderOnly && (
        <div className="pdd-card px-4 py-2 text-xs text-[var(--pdd-warning)] bg-pdd-warning/5 border border-[var(--pdd-warning)]/20">
          以下分析基于订单数据中的售后字段，信息可能不完整。建议上传售后数据Excel文件以获得完整分析。
        </div>
      )}
      {/* 交叉分析摘要卡片 */}
      <div className="grid grid-cols-4 gap-3">
        <div className="pdd-card px-4 py-3 cursor-pointer hover:bg-[var(--pdd-bg)] transition-colors" onClick={() => setActiveTab('promoCross')}>
          <p className="text-xs text-[var(--pdd-text-secondary)]">推广 vs 自然售后率</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-lg font-bold text-[var(--pdd-danger)]">{hasPromoData ? `${promoCrossAnalysis.promoAfterSaleRate.toFixed(1)}%` : '-'}</span>
            <span className="text-xs text-[var(--pdd-text-secondary)]">/</span>
            <span className="text-lg font-bold text-[var(--pdd-primary)]">{hasPromoData ? `${promoCrossAnalysis.nonPromoAfterSaleRate.toFixed(1)}%` : '-'}</span>
          </div>
          <p className="text-xs text-[var(--pdd-text-secondary)]">点击查看明细对比</p>
        </div>
        <div className="pdd-card px-4 py-3 cursor-pointer hover:bg-[var(--pdd-bg)] transition-colors border-t-2 border-t-[var(--pdd-warning)]" onClick={() => setActiveTab('timeWindow')}>
          <p className="text-xs text-[var(--pdd-text-secondary)]">退款时间分布</p>
          {hasTimeData ? (
            <>
              <div className="grid grid-cols-3 gap-1 mt-1">
                <div><span className="text-xs text-[var(--pdd-text-secondary)]">≤30天</span><p className="text-base font-bold text-[var(--pdd-warning)]">{cumulativePct(30)!.toFixed(0)}%</p><p className="text-[10px] text-[var(--pdd-text-secondary)]">{cumulativeCount(30)}单</p></div>
                <div><span className="text-xs text-[var(--pdd-text-secondary)]">≤60天</span><p className="text-base font-bold text-[var(--pdd-primary)]">{cumulativePct(60)!.toFixed(0)}%</p><p className="text-[10px] text-[var(--pdd-text-secondary)]">{cumulativeCount(60)}单</p></div>
                <div><span className="text-xs text-[var(--pdd-text-secondary)]">≤90天</span><p className="text-base font-bold text-[var(--pdd-success)]">{cumulativePct(90)!.toFixed(0)}%</p><p className="text-[10px] text-[var(--pdd-text-secondary)]">{cumulativeCount(90)}单</p></div>
              </div>
              <p className="text-[10px] text-right text-[var(--pdd-text-secondary)] mt-1">点击查看完整窗口</p>
            </>
          ) : (
            <p className="text-lg font-bold text-[var(--pdd-text-secondary)] mt-1">-</p>
          )}
        </div>
        <div className="pdd-card px-4 py-3 cursor-pointer hover:bg-[var(--pdd-bg)] transition-colors" onClick={() => setActiveTab('region')}>
          <p className="text-xs text-[var(--pdd-text-secondary)]">异常省份</p>
          <p className="text-2xl font-bold text-[var(--pdd-danger)]">{regionAnalysis.list.length > 0 ? anomalyProvinceCount : '-'}</p>
          <p className="text-xs text-[var(--pdd-text-secondary)]">{regionAnalysis.list.length > 0 ? '售后率超2σ' : '点击查看地域分析'}</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">拦截恢复(估)</p>
          <p className="text-2xl font-bold text-[var(--pdd-success)]">{logisticsData.interceptRate > 0 ? `¥${interceptRecovery.toFixed(0)}` : '-'}</p>
          <p className="text-xs text-[var(--pdd-text-secondary)]">拦截率 {logisticsData.interceptRate > 0 ? `${logisticsData.interceptRate.toFixed(1)}%` : '-'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-[var(--pdd-danger)]" />售后趋势</h4>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="success" stroke="var(--pdd-success)" strokeWidth={2} name="退款成功" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="processing" stroke="var(--pdd-warning)" strokeWidth={2} name="处理中" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="pending" stroke="var(--pdd-danger)" strokeWidth={2} name="待处理" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="closed" stroke="#8c8c8c" strokeWidth={2} name="已关闭" dot={{ r: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无趋势数据</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieChartIcon size={16} className="text-[var(--pdd-danger)]" />退款原因分布</h4>
          {reasonData.length > 0 ? (
            <div className="flex items-start gap-4">
              <div className="w-1/2">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={reasonData.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name.slice(0, 6)} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                      {reasonData.slice(0, 8).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 space-y-1 max-h-[200px] overflow-y-auto">
                {reasonData.map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-[var(--pdd-border)]">
                    <span className="truncate max-w-[100px]" title={r.name}>{r.name}</span>
                    <span className="font-mono text-[var(--pdd-text-secondary)]">{r.value}次</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-[200px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无原因数据</div>}
        </div>
      </div>
    </div>
    );
  };

  // ========== 退款分析 ==========
  const renderRefund = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">退款总金额</p><p className="text-2xl font-bold text-[var(--pdd-danger)]">¥{refundAnalysis.totalRefundAmt.toFixed(0)}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">仅退款笔数</p><p className="text-2xl font-bold text-[var(--pdd-primary)]">{records.filter((r: any) => !safeField(r, '退款类型').includes('退货')).length}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">退货退款笔数</p><p className="text-2xl font-bold text-[var(--pdd-warning)]">{records.filter((r: any) => safeField(r, '退款类型').includes('退货')).length}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-[var(--pdd-danger)]" />退款金额趋势</h4>
          {refundAnalysis.trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={refundAnalysis.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="onlyRefund" stackId="a" fill="var(--pdd-primary)" name="仅退款" />
                <Bar dataKey="returnRefund" stackId="a" fill="var(--pdd-danger)" name="退货退款" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign size={16} className="text-[var(--pdd-danger)]" />退款金额分布</h4>
          {refundAnalysis.distribution.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={refundAnalysis.distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {refundAnalysis.distribution.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
      </div>
      <div className="pdd-card p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-[var(--pdd-danger)]" />退款原因排行 TOP10</h4>
        {reasonData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={reasonData.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
              <Tooltip formatter={(v: number) => [v, '笔数']} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="value" fill="var(--pdd-danger)" radius={[0, 4, 4, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        ) : <div className="h-[280px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
      </div>
    </div>
  );

  // ========== 时间窗口分析 ==========
  const renderTimeWindow = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {timeWindowAnalysis.windowList.map(w => (
          <div key={w.key} className="pdd-card px-4 py-3">
            <p className="text-xs text-[var(--pdd-text-secondary)]">{w.label}</p>
            <p className="text-xl font-bold text-[var(--pdd-danger)]">{w.count}<span className="text-sm font-normal text-[var(--pdd-text-secondary)]"> 单</span></p>
            <p className="text-xs text-[var(--pdd-text-secondary)]">¥{w.refundAmount.toFixed(0)} ({w.pct.toFixed(1)}%)</p>
          </div>
        ))}
        {timeWindowAnalysis.windowList.length === 0 && (
          <div className="col-span-4 py-8 text-center text-sm text-[var(--pdd-text-secondary)]">暂无时间窗口数据</div>
        )}
      </div>
      {timeWindowAnalysis.unmatchedPayTime > 0 && (
        <div className="text-xs text-[var(--pdd-warning)] bg-pdd-warning/5 px-3 py-1.5 rounded-lg border border-[var(--pdd-warning)]/20">
          有 {timeWindowAnalysis.unmatchedPayTime} 条售后记录因缺少支付时间/申请时间未纳入窗口统计
          {timeWindowAnalysis.negativeDays > 0 && `，${timeWindowAnalysis.negativeDays} 条申请时间早于支付时间（数据异常）`}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-[var(--pdd-danger)]" />退款类型 × 时间窗口</h4>
          {timeWindowAnalysis.windowList.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={timeWindowAnalysis.windowList}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="onlyRefund" stackId="a" fill="var(--pdd-primary)" name="仅退款" />
                <Bar dataKey="returnRefund" stackId="a" fill="var(--pdd-danger)" name="退货退款" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><PieChartIcon size={16} className="text-[var(--pdd-danger)]" />时间窗口分布</h4>
          {timeWindowAnalysis.windowList.some(w => w.count > 0) ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={timeWindowAnalysis.windowList.filter(w => w.count > 0)} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={90} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {timeWindowAnalysis.windowList.filter(w => w.count > 0).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
      </div>
      {timeWindowAnalysis.topReasons.length > 0 && (
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star size={16} className="text-[var(--pdd-warning)]" />退款原因 × 时间窗口交叉表</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                <th className="py-2 text-left">时间窗口</th>
                <th className="py-2 text-right">笔数</th>
                {timeWindowAnalysis.topReasons.map(r => <th key={r} className="py-2 text-right">{r.length > 8 ? r.slice(0, 8) + '...' : r}</th>)}
              </tr></thead>
              <tbody>
                {timeWindowAnalysis.windowList.map(w => (
                  <tr key={w.key} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                    <td className="py-2 font-medium">{w.label}</td>
                    <td className="py-2 text-right font-mono">{w.count}</td>
                    {timeWindowAnalysis.topReasons.map(reason => (
                      <td key={reason} className="py-2 text-right font-mono text-[var(--pdd-text-secondary)]">{w.reasons[reason] || 0}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );

  // ========== 处理时效 ==========
  const renderEfficiency = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">平均处理时长</p><p className="text-2xl font-bold text-[var(--pdd-primary)]">{efficiencyData.avgHours > 0 ? `${efficiencyData.avgHours.toFixed(1)}h` : '-'}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">SLA达标率(&lt;24h)</p><p className="text-2xl font-bold text-[var(--pdd-success)]">{efficiencyData.slaRate.toFixed(1)}%</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">超时(&gt;24h)</p><p className="text-2xl font-bold text-pdd-danger">{efficiencyData.overtimeCount}<span className="text-sm font-normal text-[var(--pdd-text-secondary)] ml-1">({efficiencyData.overtimeRate.toFixed(1)}%)</span></p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">超长(&gt;30天)</p><p className="text-2xl font-bold text-[var(--pdd-danger)]">{efficiencyData.overlongCount}<span className="text-sm font-normal text-[var(--pdd-text-secondary)]"> 单</span></p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock size={16} className="text-[var(--pdd-danger)]" />处理时长分布</h4>
          {efficiencyData.durationDist.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={efficiencyData.durationDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {efficiencyData.durationDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-[var(--pdd-danger)]" />处理人效率排名</h4>
          {efficiencyData.handlerRank.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-2 text-left">处理人</th><th className="py-2 text-right">处理数量</th><th className="py-2 text-right">仅退款</th><th className="py-2 text-right">退货退款</th><th className="py-2 text-right">平均时长</th><th className="py-2 text-center">效率</th>
                </tr></thead>
                <tbody>
                  {efficiencyData.handlerRank.slice(0, 10).map((h, i) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-2 truncate max-w-[100px]">{h.name}</td>
                      <td className="py-2 text-right font-mono">{h.count}</td>
                      <td className="py-2 text-right font-mono">{h.onlyRefund}</td>
                      <td className="py-2 text-right font-mono">{h.returnRefund}</td>
                      <td className="py-2 text-right font-mono">{h.avgHours.toFixed(1)}h</td>
                      <td className="py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${h.avgHours <= 2 ? 'bg-pdd-success/10 text-green-700' : h.avgHours <= 6 ? 'bg-pdd-info/10 text-blue-700' : h.avgHours <= 24 ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-danger/10 text-red-700'}`}>{h.avgHours <= 2 ? '极快' : h.avgHours <= 6 ? '正常' : h.avgHours <= 24 ? '偏慢' : '超时'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="h-[220px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无处理人数据</div>}
        </div>
      </div>
    </div>
  );

  // ========== 退货物流 ==========
  const renderLogistics = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">退货包裹数</p><p className="text-2xl font-bold text-[var(--pdd-primary)]">{logisticsData.totalReturns}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">快递拦截成功率</p><p className="text-2xl font-bold text-[var(--pdd-success)]">{logisticsData.interceptRate > 0 ? `${logisticsData.interceptRate.toFixed(1)}%` : '-'}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">平均退货物流时效</p><p className="text-2xl font-bold text-[var(--pdd-warning)]">{logisticsData.avgReturnDays > 0 ? `${logisticsData.avgReturnDays.toFixed(1)}天` : '-'}</p></div>
        <div className="pdd-card px-4 py-3"><p className="text-xs text-[var(--pdd-text-secondary)]">异常物流</p><p className="text-2xl font-bold text-[var(--pdd-danger)]">{logisticsData.abnormalLogistics}</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Truck size={16} className="text-[var(--pdd-danger)]" />退货物流状态分布</h4>
          {logisticsData.statusDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={logisticsData.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                  {logisticsData.statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无物流数据</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-[var(--pdd-danger)]" />快递公司分布</h4>
          {logisticsData.courierDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={logisticsData.courierDist.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={60} />
                <Tooltip contentStyle={{ fontSize: 11 }} />
                <Bar dataKey="value" fill="var(--pdd-primary)" radius={[0, 4, 4, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无快递数据</div>}
        </div>
      </div>
    </div>
  );

  // ========== 推广关联分析 ==========
  const renderPromoCross = () => {
    const a = promoCrossAnalysis;
    const gap = a.promoAfterSaleRate - a.nonPromoAfterSaleRate;
    const promoAvgRefund = a.promoOrderEst > 0 ? a.promoRefundAmount / a.promoOrderEst : 0;
    const nonPromoAvgRefund = a.nonPromoOrderEst > 0 ? a.nonPromoRefundAmount / a.nonPromoOrderEst : 0;
    const refundErosion = a.nominalRoi - a.trueRoi;

    return (
    <div className="space-y-4">
      {!hasPromoData ? (
        <div className="pdd-card py-12 text-center text-sm text-[var(--pdd-text-secondary)]">
          <Package size={32} className="mx-auto mb-3 text-[var(--pdd-text-secondary)] opacity-50" />
          <p>请先上传推广数据（搜索推广/明星店铺/直播推广）以进行售后关联分析</p>
        </div>
      ) : !a.hasData ? (
        <div className="pdd-card py-12 text-center text-sm text-[var(--pdd-text-secondary)]">当前时间范围内无推广数据</div>
      ) : (
        <>
          {/* ===== 核心结论横幅 ===== */}
          <div className={`pdd-card px-5 py-4 border-2 ${gap > 1 ? 'border-red-200 bg-red-50/30' : gap < -1 ? 'border-green-200 bg-green-50/30' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between gap-8">
              <div className="text-center flex-1">
                <p className="text-xs text-[var(--pdd-text-secondary)] mb-1">推广订单售后率</p>
                <p className="text-3xl font-bold text-[var(--pdd-danger)]">{a.promoAfterSaleRate.toFixed(1)}%</p>
                <p className="text-xs text-[var(--pdd-text-secondary)]">{a.promoOrderEst} 单推广订单 · {a.promoAfterSaleCount} 笔售后</p>
              </div>
              <div className="text-center flex-shrink-0">
                {Math.abs(gap) < 0.5 ? (
                  <div className="flex flex-col items-center">
                    <span className="text-lg font-bold text-[var(--pdd-text-secondary)]">≈</span>
                    <span className="text-xs text-[var(--pdd-text-secondary)] bg-gray-100 px-2 py-0.5 rounded-full">基本持平</span>
                  </div>
                ) : gap > 0 ? (
                  <div className="flex flex-col items-center">
                    <ArrowUp size={24} className="text-[var(--pdd-danger)]" />
                    <span className="text-lg font-bold text-[var(--pdd-danger)]">{gap.toFixed(1)}%</span>
                    <span className="text-xs text-[var(--pdd-danger)] bg-red-100 px-2 py-0.5 rounded-full">推广更高</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <ArrowDown size={24} className="text-[var(--pdd-success)]" />
                    <span className="text-lg font-bold text-[var(--pdd-success)]">{Math.abs(gap).toFixed(1)}%</span>
                    <span className="text-xs text-[var(--pdd-success)] bg-green-100 px-2 py-0.5 rounded-full">自然更高</span>
                  </div>
                )}
              </div>
              <div className="text-center flex-1">
                <p className="text-xs text-[var(--pdd-text-secondary)] mb-1">非推广订单售后率</p>
                <p className="text-3xl font-bold text-[var(--pdd-primary)]">{a.nonPromoAfterSaleRate.toFixed(1)}%</p>
                <p className="text-xs text-[var(--pdd-text-secondary)]">{a.nonPromoOrderEst} 单自然订单 · {a.nonPromoAfterSaleCount} 笔售后</p>
              </div>
            </div>
            {gap > 1 && (
              <p className="mt-3 text-xs text-center text-[var(--pdd-danger)] bg-red-100/50 px-3 py-1.5 rounded-lg">
                推广带来的订单售后率比自然流量高 {gap.toFixed(1)} 个百分点，建议排查推广素材是否过度承诺、推广人群是否匹配
              </p>
            )}
            {gap < -1 && (
              <p className="mt-3 text-xs text-center text-[var(--pdd-success)] bg-green-100/50 px-3 py-1.5 rounded-lg">
                推广带来的订单质量优于自然流量，售后率低 {Math.abs(gap).toFixed(1)} 个百分点
              </p>
            )}
          </div>

          {/* ===== 对比明细表 ===== */}
          <div className="pdd-card p-4">
            <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><BarChart3 size={16} className="text-[var(--pdd-danger)]" />推广 vs 自然流量 售后对比</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <th className="py-2 text-left text-[var(--pdd-text-secondary)] font-medium">指标</th>
                    <th className="py-2 text-right text-[var(--pdd-text-secondary)] font-medium">推广订单</th>
                    <th className="py-2 text-right text-[var(--pdd-text-secondary)] font-medium">自然订单</th>
                    <th className="py-2 text-right text-[var(--pdd-text-secondary)] font-medium">差值</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <td className="py-2.5 font-medium">订单总量</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-danger)]">{a.promoOrderEst}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-primary)]">{a.nonPromoOrderEst}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-text-secondary)]">{a.promoOrderEst + a.nonPromoOrderEst > 0 ? (a.promoOrderEst / (a.promoOrderEst + a.nonPromoOrderEst) * 100).toFixed(0) : '-'}% 来自推广</td>
                  </tr>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <td className="py-2.5 font-medium">售后笔数（估算）</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-danger)]">{a.promoAfterSaleCount}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-primary)]">{a.nonPromoAfterSaleCount}</td>
                    <td className="py-2.5 text-right font-mono">{gap > 0 ? '+' : ''}{a.promoAfterSaleCount - a.nonPromoAfterSaleCount}</td>
                  </tr>
                  <tr className="border-b border-[var(--pdd-border)] bg-[var(--pdd-bg)]">
                    <td className="py-2.5 font-semibold">售后率</td>
                    <td className="py-2.5 text-right font-bold text-sm text-[var(--pdd-danger)]">{a.promoAfterSaleRate.toFixed(2)}%</td>
                    <td className="py-2.5 text-right font-bold text-sm text-[var(--pdd-primary)]">{a.nonPromoAfterSaleRate.toFixed(2)}%</td>
                    <td className={`py-2.5 text-right font-bold text-sm ${gap > 0 ? 'text-[var(--pdd-danger)]' : gap < 0 ? 'text-[var(--pdd-success)]' : 'text-[var(--pdd-text-secondary)]'}`}>
                      {gap > 0 ? '+' : ''}{gap.toFixed(2)}%
                    </td>
                  </tr>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <td className="py-2.5 font-medium">退款金额</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-danger)]">¥{a.promoRefundAmount.toFixed(0)}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-primary)]">¥{a.nonPromoRefundAmount.toFixed(0)}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-text-secondary)]">¥{(a.promoRefundAmount - a.nonPromoRefundAmount).toFixed(0)}</td>
                  </tr>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <td className="py-2.5 font-medium">平均每单退款</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-danger)]">¥{promoAvgRefund.toFixed(2)}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-primary)]">¥{nonPromoAvgRefund.toFixed(2)}</td>
                    <td className="py-2.5 text-right font-mono text-[var(--pdd-text-secondary)]">¥{(promoAvgRefund - nonPromoAvgRefund).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== ROI 侵蚀 ===== */}
          <div className="grid grid-cols-2 gap-4">
            <div className="pdd-card p-4">
              <h4 className="text-sm font-semibold mb-4 flex items-center gap-2"><DollarSign size={16} className="text-[var(--pdd-success)]" />推广ROI 退款侵蚀</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--pdd-text-secondary)]">推广总花费</span>
                  <span className="text-sm font-mono font-bold">¥{a.totalPromoCost.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--pdd-text-secondary)]">推广GMV</span>
                  <span className="text-sm font-mono font-bold">¥{a.totalPromoGmv.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--pdd-text-secondary)]">退款金额（推广部分）</span>
                  <span className="text-sm font-mono font-bold text-[var(--pdd-danger)]">- ¥{a.promoRefundAmount.toFixed(0)}</span>
                </div>
                <div className="border-t border-[var(--pdd-border)] pt-2 flex items-center justify-between">
                  <span className="text-xs font-semibold">退款后GMV</span>
                  <span className="text-sm font-mono font-bold text-[var(--pdd-success)]">¥{(a.totalPromoGmv - a.promoRefundAmount).toFixed(0)}</span>
                </div>
                <div className="bg-[var(--pdd-bg)] rounded-lg p-3 flex items-center justify-between">
                  <span className="text-xs font-semibold">名义ROI → 真实ROI</span>
                  <div className="flex items-center gap-2 font-mono text-sm">
                    <span className="text-[var(--pdd-primary)]">{a.nominalRoi.toFixed(2)}</span>
                    <span className="text-[var(--pdd-text-secondary)]">→</span>
                    <span className={`font-bold ${a.trueRoi < a.nominalRoi ? 'text-[var(--pdd-danger)]' : 'text-[var(--pdd-success)]'}`}>{a.trueRoi.toFixed(2)}</span>
                    <span className="text-xs text-[var(--pdd-danger)]">(-{refundErosion.toFixed(2)})</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== 渠道ROI对比 ===== */}
            <div className="pdd-card p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><TrendingUp size={16} className="text-[var(--pdd-danger)]" />各渠道真实ROI vs 名义ROI</h4>
              {a.channelBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={a.channelBreakdown} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                    <XAxis dataKey="channel" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: number) => [v.toFixed(2), '']} contentStyle={{ fontSize: 11 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="nominalRoi" fill="var(--pdd-primary)" name="名义ROI" barSize={22} />
                    <Bar dataKey="trueRoi" fill="var(--pdd-success)" name="真实ROI(扣退款)" barSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无渠道数据</div>}
            </div>
          </div>

          {/* ===== 渠道售后率排行 ===== */}
          {a.channelBreakdown.length > 0 && (
            <div className="pdd-card p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-[var(--pdd-danger)]" />各渠道推广订单售后率</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                    <th className="py-2 text-left">推广渠道</th>
                    <th className="py-2 text-right">推广花费</th>
                    <th className="py-2 text-right">推广订单</th>
                    <th className="py-2 text-right">退款金额</th>
                    <th className="py-2 text-right">名义ROI</th>
                    <th className="py-2 text-right">真实ROI</th>
                    <th className="py-2 text-right">ROI侵蚀</th>
                  </tr></thead>
                  <tbody>
                    {a.channelBreakdown.sort((a, b) => b.afterSaleRate - a.afterSaleRate).map((ch, i) => {
                      const chErosion = ch.nominalRoi - ch.trueRoi;
                      return (
                      <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                        <td className="py-2 font-medium">{ch.channel}</td>
                        <td className="py-2 text-right font-mono">¥{ch.cost.toFixed(0)}</td>
                        <td className="py-2 text-right font-mono">{ch.orderCount}</td>
                        <td className="py-2 text-right font-mono text-[var(--pdd-danger)]">¥{ch.refundAmount.toFixed(0)}</td>
                        <td className="py-2 text-right font-mono">{ch.nominalRoi.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono text-[var(--pdd-success)]">{ch.trueRoi.toFixed(2)}</td>
                        <td className="py-2 text-right font-mono text-[var(--pdd-danger)]">{chErosion > 0.01 ? `-${chErosion.toFixed(2)}` : '≈0'}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
    );
  };

  // ========== 地域分析 ==========
  const renderRegion = () => (
    <div className="space-y-4">
      {regionAnalysis.list.length === 0 ? (
        <div className="pdd-card py-12 text-center text-sm text-[var(--pdd-text-secondary)]">订单数据中无省份信息，无法进行地域分析</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">有数据省份</p>
              <p className="text-2xl font-bold text-[var(--pdd-primary)]">{regionAnalysis.list.length}</p>
            </div>
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">全店平均售后率</p>
              <p className="text-2xl font-bold text-[var(--pdd-warning)]">{regionAnalysis.avgRate.toFixed(1)}%</p>
            </div>
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">异常省份（超2σ）</p>
              <p className="text-2xl font-bold text-[var(--pdd-danger)]">{regionAnalysis.list.filter(p => p.sufficient && (p.afterSaleRate ?? 0) > regionAnalysis.avgRate + 2 * regionAnalysis.stdRate).length}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="pdd-card p-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-[var(--pdd-danger)]" />省份售后率排行（≥10单）</h4>
              {regionAnalysis.list.filter(p => p.sufficient).length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={regionAnalysis.list.filter(p => p.sufficient).slice(0, 15)} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10 }} unit="%" />
                    <YAxis type="category" dataKey="province" tick={{ fontSize: 10 }} width={60} />
                    <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '售后率']} contentStyle={{ fontSize: 11 }} />
                    <Bar dataKey="afterSaleRate" radius={[0, 4, 4, 0]} barSize={18}>
                      {regionAnalysis.list.filter(p => p.sufficient).slice(0, 15).map((p, i) => {
                        const isAnomaly = (p.afterSaleRate ?? 0) > regionAnalysis.avgRate + 2 * regionAnalysis.stdRate;
                        return <Cell key={i} fill={isAnomaly ? 'var(--pdd-danger)' : 'var(--pdd-primary)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-[400px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">样本不足（需≥10单的省份）</div>}
            </div>
            {regionAnalysis.topReasons.length > 0 && (
              <div className="pdd-card p-4">
                <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star size={16} className="text-[var(--pdd-warning)]" />退款原因 × 省份（Top8）</h4>
                <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)] sticky top-0 bg-[var(--pdd-card)] z-10">
                      <th className="py-2 text-left">省份</th><th className="py-2 text-right">售后率</th>
                      {regionAnalysis.topReasons.map(r => <th key={r} className="py-2 text-right">{r.length > 6 ? r.slice(0, 6) + '..' : r}</th>)}
                    </tr></thead>
                    <tbody>
                      {regionAnalysis.list.filter(p => p.sufficient).sort((a, b) => (b.afterSaleRate ?? 0) - (a.afterSaleRate ?? 0)).slice(0, 8).map((p, i) => (
                        <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                          <td className="py-2 font-medium">{p.province}</td>
                          <td className={`py-2 text-right font-mono ${(p.afterSaleRate ?? 0) > regionAnalysis.avgRate + 2 * regionAnalysis.stdRate ? 'text-pdd-danger' : ''}`}>{(p.afterSaleRate ?? 0).toFixed(1)}%</td>
                          {regionAnalysis.topReasons.map(reason => (
                            <td key={reason} className="py-2 text-right text-[var(--pdd-text-secondary)]">{p.reasons[reason] || 0}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  // ========== 商品售后（合并 SKU拆解 + 高风险商品 + 退款时效）==========
  const renderProductRisk = () => (
    <div className="space-y-4">
      {/* 子 Tab 导航 */}
      <div className="flex gap-1 bg-[var(--pdd-card)] rounded-lg px-1.5 py-1 border border-[var(--pdd-border)] w-fit">
        {([
          { key: 'sku' as const, label: 'SKU拆解', icon: Tag },
          { key: 'risk' as const, label: '高风险商品', icon: AlertTriangle },
          { key: 'timeline' as const, label: '退款时效', icon: Clock },
        ]).map(st => (
          <button key={st.key} onClick={() => setProductRiskSub(st.key)}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              productRiskSub === st.key ? 'text-white shadow-sm' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)] hover:bg-[var(--pdd-bg)]'
            }`}
            style={productRiskSub === st.key ? { background: 'linear-gradient(to right, var(--pdd-danger), #ff6b5b)' } : {}}>
            <st.icon size={12} />{st.label}
          </button>
        ))}
      </div>

      {/* SKU拆解 */}
      {productRiskSub === 'sku' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="pdd-card p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Tag size={16} className="text-[var(--pdd-danger)]" />SKU退款金额TOP10</h4>
            {skuBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={skuBreakdown.slice(0, 10)} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                  <Tooltip formatter={(v: number) => [`¥${v.toFixed(0)}`, '退款金额']} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="refundAmount" fill="var(--pdd-danger)" radius={[0, 4, 4, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-[300px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无SKU数据</div>}
          </div>
          <div className="pdd-card p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-[var(--pdd-danger)]" />SKU售后次数排名</h4>
            {skuBreakdown.length > 0 ? (
              <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)] sticky top-0 bg-[var(--pdd-card)] z-10">
                    <th className="py-2 text-left">SKU信息</th><th className="py-2 text-right">售后次数</th><th className="py-2 text-right">退款金额</th><th className="py-2 text-right">售后率</th>
                  </tr></thead>
                  <tbody>
                    {[...skuBreakdown].sort((a, b) => b.count - a.count).slice(0, 15).map((s, i) => (
                      <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                        <td className="py-2 truncate max-w-[200px]" title={s.name}>{s.name}</td>
                        <td className="py-2 text-right font-mono text-pdd-danger">{s.count}</td>
                        <td className="py-2 text-right font-mono">¥{s.refundAmount.toFixed(0)}</td>
                        <td className="py-2 text-right font-mono">{s.orderCount > 0 ? `${s.afterSaleRate.toFixed(1)}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="h-[300px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无SKU数据</div>}
          </div>
        </div>
      )}

      {/* 高风险商品 */}
      {productRiskSub === 'risk' && (
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-pdd-danger" />高售后商品预警（多因子风险评分）</h4>
          {highRiskProducts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-2 text-left">商品名称</th><th className="py-2 text-left">商品ID</th><th className="py-2 text-right">订单数</th><th className="py-2 text-right">售后数</th><th className="py-2 text-right">售后率</th><th className="py-2 text-right">退款金额</th><th className="py-2 text-right">退款占营收</th><th className="py-2 text-right">风险分数</th><th className="py-2 text-center">风险等级</th>
                </tr></thead>
                <tbody>
                  {highRiskProducts.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-2 truncate max-w-[200px]" title={p.name}>{p.name}</td>
                      <td className="py-2 font-mono text-[10px]">{p.productId}</td>
                      <td className="py-2 text-right">{p.orderCount}</td>
                      <td className="py-2 text-right text-pdd-danger">{p.afterSaleCount}</td>
                      <td className="py-2 text-right font-mono">{p.afterSaleRate.toFixed(1)}%</td>
                      <td className="py-2 text-right font-mono">¥{p.refundAmount.toFixed(0)}</td>
                      <td className="py-2 text-right font-mono">{p.refundRevenueRatio.toFixed(1)}%</td>
                      <td className="py-2 text-right font-mono">{p.riskScore.toFixed(0)}</td>
                      <td className="py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${riskLevel(p.riskScore).cls}`}>{riskLevel(p.riskScore).label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="py-8 text-center text-sm text-[var(--pdd-text-secondary)]">暂无高售后商品</div>}
        </div>
      )}

      {/* 商品退款时效 */}
      {productRiskSub === 'timeline' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">有退款时效数据的商品</p>
              <p className="text-2xl font-bold text-[var(--pdd-primary)]">{productAfterSaleTimeline.length}</p>
            </div>
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">平均快速退款率(≤7天)</p>
              <p className="text-2xl font-bold text-[var(--pdd-warning)]">{productAfterSaleTimeline.length > 0 ? (productAfterSaleTimeline.reduce((s, p) => s + p.fastRefundRate, 0) / productAfterSaleTimeline.length).toFixed(1) : '-'}%</p>
            </div>
            <div className="pdd-card px-4 py-3">
              <p className="text-xs text-[var(--pdd-text-secondary)]">平均长尾退款率({'>'}90天)</p>
              <p className="text-2xl font-bold text-[var(--pdd-danger)]">{productAfterSaleTimeline.length > 0 ? (productAfterSaleTimeline.reduce((s, p) => s + p.longTailRate, 0) / productAfterSaleTimeline.length).toFixed(1) : '-'}%</p>
            </div>
          </div>
          <div className="pdd-card p-4">
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock size={16} className="text-[var(--pdd-danger)]" />商品快速退款率 vs 长尾退款率</h4>
            {productAfterSaleTimeline.length > 0 ? (
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)] sticky top-0 bg-[var(--pdd-card)] z-10">
                    <th className="py-2 text-left">商品</th><th className="py-2 text-right">售后数</th><th className="py-2 text-right">退款金额</th><th className="py-2 text-right">平均退款天数</th><th className="py-2 text-right">快速退款率(≤7天)</th><th className="py-2 text-right">长尾退款率({'>'}90天)</th><th className="py-2 text-center">特征</th>
                  </tr></thead>
                  <tbody>
                    {productAfterSaleTimeline.slice(0, 20).map((p, i) => (
                      <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                        <td className="py-2 truncate max-w-[160px]" title={p.name}>{p.name}</td>
                        <td className="py-2 text-right font-mono">{p.afterSaleCount}</td>
                        <td className="py-2 text-right font-mono">¥{p.refundAmount.toFixed(0)}</td>
                        <td className="py-2 text-right font-mono">{p.avgRefundDays.toFixed(1)}天</td>
                        <td className="py-2 text-right font-mono text-[var(--pdd-warning)]">{p.fastRefundRate.toFixed(1)}%</td>
                        <td className="py-2 text-right font-mono text-pdd-danger">{p.longTailRate.toFixed(1)}%</td>
                        <td className="py-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${p.fastRefundRate > 60 ? 'bg-pdd-danger/10 text-red-700' : p.longTailRate > 20 ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-success/10 text-green-700'}`}>
                            {p.fastRefundRate > 60 ? '疑似质量/描述问题' : p.longTailRate > 20 ? '关注长尾风险' : '正常'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div className="py-8 text-center text-sm text-[var(--pdd-text-secondary)]">暂无退款时效数据（需≥2条售后记录的商品）</div>}
          </div>
        </div>
      )}
    </div>
  );

  // ========== 预警中心 ==========
  const renderWarning = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Bell size={16} className="text-pdd-danger" />异常飙升检测</h4>
          {warningData.dailyRates.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={warningData.dailyRates}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="rate" stroke="var(--pdd-danger)" strokeWidth={2} name="日售后率%" dot={{ r: 2 }} />
                <Line type="monotone" dataKey="avg7" stroke="var(--pdd-primary)" strokeWidth={2} name="7日均线%" strokeDasharray="5 5" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">数据不足（至少需要7天数据）</div>}
        </div>
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock size={16} className="text-pdd-danger" />超时未处理清单（&gt;48h）</h4>
          {warningData.overdueList.length > 0 ? (
            <div className="overflow-x-auto max-h-[250px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-2 text-left">订单编号</th><th className="py-2 text-right">等待时长</th><th className="py-2 text-left">售后状态</th>
                </tr></thead>
                <tbody>
                  {warningData.overdueList.slice(0, 20).map((item: any, i: number) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-2 font-mono text-[10px]">{item.orderNo}</td>
                      <td className="py-2 text-right text-pdd-danger">{(item.hours / 24).toFixed(0)}天</td>
                      <td className="py-2 text-[10px]">{safeField(item, '售后状态')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">无超时未处理单</div>}
        </div>
      </div>
    </div>
  );

  // ========== 明细列表（SEVERE-4修复：去除slice截断）==========
  const renderDetail = () => (
    <div className="pdd-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold flex items-center gap-2"><FileText size={16} className="text-[var(--pdd-danger)]" />售后明细（{filteredRecords.length}条）</h4>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-[var(--pdd-bg)] rounded-lg px-3 py-1.5 border border-[var(--pdd-border)]">
            <Search size={14} className="text-[var(--pdd-text-secondary)]" />
            <input type="text" value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="搜索订单号/商品ID/SKU/备注" className="bg-transparent text-xs outline-none w-48" />
          </div>
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="text-xs border border-[var(--pdd-border)] rounded-lg px-2 py-1.5">
            <option value="all">全部状态</option>
            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }} className="text-xs border border-[var(--pdd-border)] rounded-lg px-2 py-1.5">
            <option value="all">全部类型</option>
            {typeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-pdd-success text-white rounded-lg text-xs hover:bg-pdd-success transition-colors"><Download size={14} />导出</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
            <th className="py-2 text-left">售后编号</th><th className="py-2 text-left">订单编号</th><th className="py-2 text-left">商品ID</th><th className="py-2 text-left">SKU信息</th><th className="py-2 text-right">退款金额</th><th className="py-2 text-center">售后状态</th><th className="py-2 text-left">退款原因</th><th className="py-2 text-left">申请时间</th><th className="py-2 text-left">处理人</th><th className="py-2 text-right">处理时长</th>
          </tr></thead>
          <tbody>
            {paginatedRecords.map((r: any, i: number) => (
              <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)] cursor-pointer" onClick={() => setDetailRecord(r)}>
                <td className="py-2 font-mono text-[10px] max-w-[100px] truncate" title={safeField(r, '售后编号')}>{safeField(r, '售后编号') || '-'}</td>
                <td className="py-2 font-mono text-[10px] max-w-[110px] truncate" title={getOrderNo(r)}>{getOrderNo(r) || '-'}</td>
                <td className="py-2 font-mono text-[10px] max-w-[100px] truncate" title={getProductId(r)}>{getProductId(r) || '-'}</td>
                <td className="py-2 max-w-[120px] truncate" title={getSkuInfo(r)}>{getSkuInfo(r) || '-'}</td>
                <td className="py-2 text-right font-mono text-pdd-danger whitespace-nowrap">¥{getRefundAmount(r).toFixed(2)}</td>
                <td className="py-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] bg-[var(--pdd-bg)]">{safeField(r, '售后状态') || '-'}</span></td>
                <td className="py-2 text-[10px] max-w-[100px] truncate" title={safeField(r, '退款原因')}>{safeField(r, '退款原因') || '-'}</td>
                <td className="py-2 text-[10px] whitespace-nowrap">{safeField(r, '申请时间') || '-'}</td>
                <td className="py-2 text-[10px] max-w-[80px] truncate" title={safeField(r, '同意退款人')}>{safeField(r, '同意退款人') || '-'}</td>
                <td className="py-2 text-right text-[10px] whitespace-nowrap">{getProcessHours(r).text}</td>
              </tr>
            ))}
            {paginatedRecords.length === 0 && (
              <tr><td colSpan={10} className="py-8 text-center text-[var(--pdd-text-secondary)]">暂无匹配记录</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--pdd-border)]">
        <span className="text-xs text-[var(--pdd-text-secondary)]">第 {currentPage}/{totalPages || 1} 页，共 {filteredRecords.length} 条</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg hover:bg-[var(--pdd-bg)] disabled:opacity-30 transition-colors"><ChevronLeft size={16} /></button>
          <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg hover:bg-[var(--pdd-bg)] disabled:opacity-30 transition-colors"><ChevronRight size={16} /></button>
        </div>
      </div>

      {/* 行详情弹窗 (SEVERE-8) */}
      {detailRecord && (() => {
        const o = detailRecord;
        const fv = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return String(v).trim(); } return '-'; };
        const fn = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return safeFloat(v); } return 0; };
        const sections = [
          { title: '基本信息', rows: [['售后编号', fv(['售后编号'])], ['订单编号', getOrderNo(o)], ['商品ID', getProductId(o)], ['SKU信息', getSkuInfo(o)], ['退款金额', `¥${fn(['买家退款金额', '退款金额', '退款金额(元)']).toFixed(2)}`], ['退款类型', fv(['退款类型', '售后类型'])], ['退款原因', fv(['退款原因', '售后原因'])], ['售后状态', fv(['售后状态'])], ['订单状态', fv(['订单状态'])]] },
          { title: '处理信息', rows: [['处理人', fv(['同意退款人', '处理人'])], ['申请时间', fv(['申请时间', '售后申请时间'])], ['同意退款时间', fv(['同意退款时间', '同意退货时间'])], ['处理时长', getProcessHours(o).text]] },
          { title: '物流信息', rows: [['退货运单号', fv(['退货运单号'])], ['退货物流状态', fv(['退货物流状态'])], ['快递公司', fv(['快递公司', '物流公司'])], ['快递拦截状态', fv(['快递拦截状态'])], ['退货物流状态时间', fv(['退货物流状态对应时间'])]] },
        ];
        const shownKeys = new Set(['售后编号', '订单编号', '商品ID', '商品id', '商品编号', 'sku信息', 'SKU信息', '商品规格', '买家退款金额', '退款金额', '退款金额(元)', '退款类型', '售后类型', '退款原因', '售后原因', '售后状态', '订单状态', '同意退款人', '处理人', '申请时间', '售后申请时间', '同意退款时间', '同意退货时间', '退货运单号', '退货物流状态', '快递公司', '物流公司', '快递拦截状态', '退货物流状态对应时间', '备注']);
        const otherFields = Object.keys(o).filter(k => !shownKeys.has(k) && o[k] != null && String(o[k]).trim() !== '');
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDetailRecord(null)}>
            <div className="bg-[var(--pdd-card)] rounded-xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto mx-4" onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 bg-[var(--pdd-card)] border-b border-[var(--pdd-border)] px-5 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-sm">售后详情</h3>
                <button onClick={() => setDetailRecord(null)} className="p-1 rounded-lg hover:bg-[var(--pdd-bg)]"><X size={18} /></button>
              </div>
              <div className="p-5 space-y-4">
                {sections.map((sec, i) => (
                  <div key={i}>
                    <h4 className="text-xs font-semibold text-[var(--pdd-text-secondary)] mb-2">{sec.title}</h4>
                    <table className="w-full text-xs"><tbody>
                      {sec.rows.map(([label, value], j) => (
                        <tr key={j} className="border-b border-[var(--pdd-border)]">
                          <td className="py-2 text-[var(--pdd-text-secondary)] w-1/3">{label}</td>
                          <td className="py-2 font-medium">{value}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                ))}
                {otherFields.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold text-[var(--pdd-text-secondary)] mb-2">其他字段</h4>
                    <table className="w-full text-xs"><tbody>
                      {otherFields.map((k, j) => (
                        <tr key={j} className="border-b border-[var(--pdd-border)]">
                          <td className="py-2 text-[var(--pdd-text-secondary)] w-1/3">{k}</td>
                          <td className="py-2 font-medium">{String(o[k] || '-')}</td>
                        </tr>
                      ))}
                    </tbody></table>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  // ========== 高频退款原因（替代伪造满意度面板 FATAL-3）==========
  const topReasons = reasonData.slice(0, 5);

  return (
    <div className="p-4 space-y-4">
      <TimeFilter state={{ ...tf, setTimeRange: changeTimeRange }} />

      {/* KPI 卡片 (SEVERE-5: 含环比) */}
      <div className="grid grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="pdd-card px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${k.color}15` }}>
              <k.icon size={20} color={k.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--pdd-text-secondary)]">{k.label}</p>
              <div className="flex items-center gap-1.5">
                <p className="text-lg font-bold truncate" style={{ color: k.color }}>{k.fmt(k.value)}</p>
                {k.change != null && (
                  <span className={`flex items-center text-[10px] font-medium ${k.reverse ? (k.change > 0 ? 'text-pdd-danger' : 'text-pdd-success') : (k.change > 0 ? 'text-pdd-success' : 'text-pdd-danger')}`}>
                    {k.change > 0 ? <ArrowUp size={10} /> : k.change < 0 ? <ArrowDown size={10} /> : null}
                    {Math.abs(k.change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tab 导航 */}
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

      {/* Tab 内容 */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'refund' && renderRefund()}
      {activeTab === 'timeWindow' && renderTimeWindow()}
      {activeTab === 'efficiency' && renderEfficiency()}
      {activeTab === 'logistics' && renderLogistics()}
      {activeTab === 'promoCross' && renderPromoCross()}
      {activeTab === 'region' && renderRegion()}
      {activeTab === 'productRisk' && renderProductRisk()}
      {activeTab === 'warning' && renderWarning()}
      {activeTab === 'detail' && renderDetail()}

      {/* 高频退款原因（替代伪造满意度面板）*/}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star size={16} className="text-[var(--pdd-warning)]" />高频退款原因 Top 5</h4>
        {topReasons.length > 0 ? (
          <div className="flex items-center gap-6">
            {topReasons.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: COLORS[i % COLORS.length] }}>{i + 1}</div>
                <div>
                  <p className="text-sm font-medium truncate max-w-[120px]" title={r.name}>{r.name}</p>
                  <p className="text-xs text-[var(--pdd-text-secondary)]">{r.value}次</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-[var(--pdd-text-secondary)]">暂无退款原因数据</div>
        )}
      </motion.div>
    </div>
  );
}

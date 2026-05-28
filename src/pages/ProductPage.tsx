import React, { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Package, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Ban, ArrowUp, ArrowDown, Calendar, Filter, ChevronDown, ChevronLeft, ChevronRight, X, Check, Tag, BarChart3, Link2, RotateCcw, Layers, Clock, Target, Zap, Box, GripVertical, Eye, Activity, Hash, Download, Percent, Search } from 'lucide-react';
import { useData, useAuth } from '../App';
import { findField } from '../utils';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, safeFloat, filterByTimeRange, filterPromoByTimeRange, getCompareOrders, getAllDateGroups, changePct, getQuickRangeDates } from '../components/TimeFilter';
import ProductFullLinkTab from './product/ProductFullLinkTab';
import ProductDetailDrawer from './product/ProductDetailDrawer';
import ProfitDiagnosisPanel from './product/ProfitDiagnosisPanel';
import Product360Analysis from '../components/product-analysis/Product360Analysis';
import { useProductStats, useProductDetail, ProductStat } from '../components/ProductLinkStats';
import ProfitTooltip from '../components/ProfitTooltip';
import ProductDeepAnalysis from './product/ProductDeepAnalysis';
import { AnalysisProvider } from '../context/analysisContext';

const COLORS = ['var(--pdd-primary)', 'var(--pdd-primary-light)', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

interface SortableItemProps {
  id: string;
  children: React.ReactNode;
}

function SortableItem({ id, children }: SortableItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="relative group">
      <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-grab active:cursor-grabbing">
        <GripVertical size={16} className="text-slate-400" />
      </div>
      {children}
    </div>
  );
}

export default function ProductPage() {
  const { currentDisplayData, productCosts, customDeductions, taxConfigs, defaultCostRatio, packagingFeePerOrder, shippingFeePerOrder, platformCommissionRate, insuranceFeePerOrder, orderFinancialActuals, abnormalOrders } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange, setCustomRange, setQuickRange, savedRanges, saveCurrentRange, deleteSavedRange, applySavedRange } = tf;
  const [activeView, setActiveView] = useState<'overview' | 'lifecycle' | 'sku' | 'price' | 'fulllink' | 'profit'>('overview');
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [afterSaleFilter, setAfterSaleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [sortField, setSortField] = useState<string>('gmv');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [productTags, setProductTags] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_product_tags');
      if (saved) { const parsed = JSON.parse(saved); if (parsed && typeof parsed === 'object') return parsed; }
    } catch {}
    return {};
  });
  const [tagInput, setTagInput] = useState('');
  const [taggingProduct, setTaggingProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dianfx_product_panel_order');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length > 0) return arr; }
    } catch {}
    return ['kpi', 'overview', 'lifecycle', 'sku', 'price', 'fulllink', 'profit'];
  });
  useEffect(() => {
    localStorage.setItem('dianfx_product_tags', JSON.stringify(productTags));
  }, [productTags]);
  useEffect(() => {
    localStorage.setItem('dianfx_product_panel_order', JSON.stringify(panelOrder));
  }, [panelOrder]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deepAnalysisOpen, setDeepAnalysisOpen] = useState(false);
  const [deepAnalysisProductId, setDeepAnalysisProductId] = useState<string | undefined>(undefined);

  const pageSize = 10;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const prevOrders = useMemo(() => getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange), [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange]);
  const prevFilteredOrders = useMemo(() => {
    let result = prevOrders;
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    return result;
  }, [prevOrders, abnormalOrders]);
  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange);
    // 剔除用户标记为排除的异常订单
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    return result;
  }, [orders, allDates, timeRange, customStart, customEnd, quickRange, abnormalOrders]);

  // 构建时间过滤后的 displayData 供 useProductStats 使用
  const filteredDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    return {
      ...currentDisplayData,
      orders: filteredOrders,
      afterSaleRecords: filterPromoByTimeRange(currentDisplayData.afterSaleRecords || [], allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange),
      promotionProducts: filterPromoByTimeRange(currentDisplayData.promotionProducts || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      promotionSummary: filterPromoByTimeRange(currentDisplayData.promotionSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      starStoreSummary: filterPromoByTimeRange(currentDisplayData.starStoreSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      liveStreamSummary: filterPromoByTimeRange(currentDisplayData.liveStreamSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      shippingInsurance: filterPromoByTimeRange(currentDisplayData.shippingInsurance || [], allDates, timeRange, ['日期'], customStart, customEnd, quickRange),
    };
  }, [currentDisplayData, filteredOrders, allDates, timeRange, customStart, customEnd, quickRange]);

  // 上一周期日期范围（用于过滤非订单数据）
  const prevPeriodDates = useMemo(() => {
    if (!allDates.length || timeRange === 'all') return null;

    let currentStart: Date;
    let currentEnd: Date;

    if (timeRange === 'custom' && quickRange) {
      const dates = getQuickRangeDates(quickRange);
      currentStart = new Date(dates.start);
      currentEnd = new Date(dates.end);
    } else if (timeRange === 'custom' && customStart && customEnd) {
      currentStart = new Date(customStart);
      currentEnd = new Date(customEnd);
    } else if (timeRange === 'custom' || isNaN(parseInt(timeRange))) {
      return null;
    } else {
      const lastDate = allDates[allDates.length - 1][0];
      const lastD = new Date(lastDate);
      const rangeDays = parseInt(timeRange) || 7;
      currentEnd = lastD;
      currentStart = new Date(lastD);
      currentStart.setDate(currentStart.getDate() - rangeDays + 1);
    }

    if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) return null;

    const periodDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1;
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodDays + 1);

    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0],
    };
  }, [allDates, timeRange, customStart, customEnd, quickRange]);

  // 按指定日期范围过滤非订单数据
  const filterByDateRange = (data: any[], dateField: string, startDate: string, endDate: string) => {
    if (!data || !data.length) return data || [];
    return data.filter(item => {
      const dateStr = dateField ? item[dateField] : (item['日期'] || item['申请时间'] || item['支付时间'] || '');
      if (!dateStr) return true;
      const d = String(dateStr).trim().split(' ')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true;
      return d >= startDate && d <= endDate;
    });
  };

  // 上一周期数据（用于同比/环比）
  const prevDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    if (!prevPeriodDates) {
      return {
        ...currentDisplayData,
        orders: prevFilteredOrders,
      };
    }
    const { start, end } = prevPeriodDates;
    return {
      ...currentDisplayData,
      orders: prevFilteredOrders,
      afterSaleRecords: filterByDateRange(currentDisplayData.afterSaleRecords || [], '申请时间', start, end),
      promotionProducts: filterByDateRange(currentDisplayData.promotionProducts || [], '日期', start, end),
      promotionSummary: filterByDateRange(currentDisplayData.promotionSummary || [], '日期', start, end),
      starStoreSummary: filterByDateRange(currentDisplayData.starStoreSummary || [], '日期', start, end),
      liveStreamSummary: filterByDateRange(currentDisplayData.liveStreamSummary || [], '日期', start, end),
      shippingInsurance: filterByDateRange(currentDisplayData.shippingInsurance || [], '日期', start, end),
    };
  }, [currentDisplayData, prevFilteredOrders, prevPeriodDates]);

  // Use enhanced product stats from ProductLinkStats with filtered data and cost configs
  const productStats = useProductStats(
    filteredDisplayData,
    productCosts,
    taxConfigs,
    customDeductions,
    defaultCostRatio,
    packagingFeePerOrder,
    shippingFeePerOrder,
    platformCommissionRate,
    insuranceFeePerOrder,
    orderFinancialActuals
  );
  const prevProductStats = useProductStats(
    prevDisplayData,
    productCosts,
    taxConfigs,
    customDeductions,
    defaultCostRatio,
    packagingFeePerOrder,
    shippingFeePerOrder,
    platformCommissionRate,
    insuranceFeePerOrder,
    orderFinancialActuals
  );
  const drawerProduct = useProductDetail(productStats, drawerProductId);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange, compareEnabled]);

  // Convert productStats to list format for table display
  const products = useMemo(() => {
    return Object.values(productStats).map(s => ({
      id: s.productId,
      name: s.productName,
      code: s.productCode,
      sales: s.sales,
      revenue: s.revenue,
      orders: s.orders,
      afterSale: s.afterSaleCount,
      refund: s.refund,
      refundCount: s.refundCount || 0,
      costs: s.totalCost,
      avgPrice: s.avgOrderValue,
      afterSaleRate: s.afterSaleRate,
      refundRate: s.refundRate,
      profit: s.netProfit,
      profitRate: s.profitRate,
      gmv: s.gmv,
      promoCost: s.promoCost,
      promoTransaction: s.promoTransaction,
      promoClicks: s.promoClicks,
      promoImpressions: s.promoImpressions,
      roi: s.roi,
      grossProfit: s.grossProfit || 0,
      preTaxProfit: s.preTaxProfit || 0,
      netProfitAfterTax: s.netProfitAfterTax || s.netProfit,
      costBreakdown: s.costBreakdown || { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, taxes: 0, customDeductions: 0 },
      costSource: s.costSource || { productCost: 'missing', taxes: 'default', customDeductions: 'none' },
      taxDetails: s.taxDetails || [],
      deductionDetails: s.deductionDetails || [],
      profitConfidence: s.profitConfidence || 'low',
      discountRatio: s.discountRatio,
      promoCostRatio: s.promoCostRatio,
      firstDate: s.firstOrderDate,
      lastDate: s.lastOrderDate,
      tags: productTags[s.productId] || [],
      inventory: s.inventoryEstimate,
      inventoryStatus: s.sales > 0 && s.sales < 5 ? 'low' : s.sales === 0 ? 'out' : 'normal',
      activeDays: s.activeDays,
      avgDailySales: s.avgDailySales,
      turnoverDays: s.turnoverDays,
      sellThroughRate: s.sellThroughRate,
    }));
  }, [productStats, productTags]);

  // 上一周期商品列表（用于环比计算）
  const prevProducts = useMemo(() => {
    return Object.values(prevProductStats).map(s => ({
      id: s.productId,
      name: s.productName,
      code: s.productCode,
      sales: s.sales,
      revenue: s.revenue,
      orders: s.orders,
      afterSale: s.afterSaleCount,
      refund: s.refund,
      refundCount: s.refundCount || 0,
      costs: s.totalCost,
      avgPrice: s.avgOrderValue,
      afterSaleRate: s.afterSaleRate,
      refundRate: s.refundRate,
      profit: s.netProfit,
      profitRate: s.profitRate,
      gmv: s.gmv,
      promoCost: s.promoCost,
      promoTransaction: s.promoTransaction,
      promoClicks: s.promoClicks,
      promoImpressions: s.promoImpressions,
      roi: s.roi,
      grossProfit: s.grossProfit || 0,
      preTaxProfit: s.preTaxProfit || 0,
      netProfitAfterTax: s.netProfitAfterTax || s.netProfit,
      discountRatio: s.discountRatio,
      promoCostRatio: s.promoCostRatio,
      firstDate: s.firstOrderDate,
      lastDate: s.lastOrderDate,
      inventory: s.inventoryEstimate,
      inventoryStatus: s.sales > 0 && s.sales < 5 ? 'low' : s.sales === 0 ? 'out' : 'normal',
      activeDays: s.activeDays,
      avgDailySales: s.avgDailySales,
      turnoverDays: s.turnoverDays,
      sellThroughRate: s.sellThroughRate,
    }));
  }, [prevProductStats]);

  const filteredProducts = useMemo(() => {
    let result = products;
    // 搜索过滤：支持商品ID、商品名称、商家编码
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(p =>
        (p.id && p.id.toLowerCase().includes(kw)) ||
        (p.name && p.name.toLowerCase().includes(kw)) ||
        (p.code && p.code.toLowerCase().includes(kw))
      );
    }
    if (priceFilter !== 'all') {
      const [min, max] = priceFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.avgPrice >= min && p.avgPrice < (max || Infinity));
    }
    if (salesFilter !== 'all') {
      const [min, max] = salesFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.sales >= min && p.sales < (max || Infinity));
    }
    if (afterSaleFilter !== 'all') {
      const [min, max] = afterSaleFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.afterSaleRate >= min && p.afterSaleRate < (max || Infinity));
    }
    return result;
  }, [products, priceFilter, salesFilter, afterSaleFilter, searchKeyword]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a: any, b: any) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') return sortDesc ? bv - av : av - bv;
      return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return sorted;
  }, [filteredProducts, sortField, sortDesc]);

  const paginatedProducts = useMemo(() => sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedProducts, currentPage]);
  const totalPages = Math.ceil(sortedProducts.length / pageSize);

  const kpiMetrics = useMemo(() => {
    if (!filteredProducts.length) return null;
    const productIds = new Set(filteredProducts.map(p => p.id));
    const totalSales = filteredProducts.reduce((s, p) => s + p.sales, 0);
    const totalRevenue = filteredProducts.reduce((s, p) => s + p.revenue, 0);
    const totalProfit = filteredProducts.reduce((s, p) => s + p.profit, 0);
    const totalGmv = filteredProducts.reduce((s, p) => s + p.gmv, 0);
    const avgPrice = filteredProducts.length > 0 ? totalRevenue / filteredProducts.reduce((s, p) => s + p.orders, 0) : 0;
    const afterSaleCount = filteredProducts.reduce((s, p) => s + p.afterSale, 0);
    const totalOrders = filteredProducts.reduce((s, p) => s + p.orders, 0);
    const afterSaleRate = totalOrders > 0 ? (afterSaleCount / totalOrders) * 100 : 0;
    const zeroSales = filteredProducts.filter(p => p.sales <= 0).length;
    const lowInventory = filteredProducts.filter(p => p.inventoryStatus === 'low').length;
    const activeProducts = filteredProducts.filter(p => p.sales > 0).length;
    const sellThroughRate = filteredProducts.length > 0 ? (activeProducts / filteredProducts.length) * 100 : 0;
    const avgTurnover = filteredProducts.reduce((s, p) => s + (p.turnoverDays < 999 ? p.turnoverDays : 0), 0) / (filteredProducts.filter(p => p.turnoverDays < 999).length || 1);
    const avgPromoRatio = filteredProducts.reduce((s, p) => s + p.promoCostRatio, 0) / (filteredProducts.length || 1);
    const totalRefundOrders = filteredProducts.reduce((s, p) => s + (p.refundCount || 0), 0);
    const refundRate = totalOrders > 0 ? (totalRefundOrders / totalOrders) * 100 : 0;

    // 计算环比变化
    const diffs: Record<string, number | null> = {};
    const prevMatched = prevProducts.filter(p => productIds.has(p.id));
    if (prevMatched.length > 0) {
      const prevSales = prevMatched.reduce((s, p) => s + p.sales, 0);
      const prevRevenue = prevMatched.reduce((s, p) => s + p.revenue, 0);
      const prevProfit = prevMatched.reduce((s, p) => s + p.profit, 0);
      const prevGmv = prevMatched.reduce((s, p) => s + p.gmv, 0);
      const prevOrders = prevMatched.reduce((s, p) => s + p.orders, 0);
      const prevActive = prevMatched.filter(p => p.sales > 0).length;
      const prevAvgPrice = prevOrders > 0 ? prevRevenue / prevOrders : 0;
      const prevSellThrough = prevMatched.length > 0 ? (prevActive / prevMatched.length) * 100 : 0;
      diffs.productCount = changePct(productIds.size, prevMatched.length);
      diffs.totalGmv = changePct(totalGmv, prevGmv);
      diffs.totalRevenue = changePct(totalRevenue, prevRevenue);
      diffs.totalProfit = changePct(totalProfit, prevProfit);
      diffs.avgPrice = changePct(avgPrice, prevAvgPrice);
      diffs.sellThroughRate = changePct(sellThroughRate, prevSellThrough);
    } else {
      diffs.productCount = null; diffs.totalGmv = null; diffs.totalRevenue = null;
      diffs.totalProfit = null; diffs.avgPrice = null; diffs.sellThroughRate = null;
    }
    return { productCount: productIds.size, totalSales, totalRevenue, totalProfit, totalGmv, avgPrice, afterSaleRate, zeroSales, lowInventory, sellThroughRate, avgTurnover, avgPromoRatio, refundRate, diffs };
  }, [filteredProducts, prevProducts]);

  const radarData = useMemo(() => {
    if (!selectedProduct) return [];
    const p = products.find(x => x.id === selectedProduct);
    if (!p) return [];
    return [
      { subject: '销量', A: Math.min(100, p.sales / 10), fullMark: 100 },
      { subject: '收入', A: Math.min(100, p.revenue / 100), fullMark: 100 },
      { subject: '利润', A: Math.min(100, p.profit / 50), fullMark: 100 },
      { subject: '售后率', A: 100 - p.afterSaleRate, fullMark: 100 },
      { subject: '动销', A: p.sales > 0 ? 100 : 0, fullMark: 100 },
    ];
  }, [selectedProduct, products]);

  // 选中商品的订单明细（融合订单级数据）
  const selectedProductOrders = useMemo(() => {
    if (!selectedProduct) return [];
    return filteredOrders.filter(o => {
      const pid = String(o['商品id'] || o['商品ID'] || '').trim();
      return pid === selectedProduct;
    });
  }, [selectedProduct, filteredOrders]);

  const lifecycleData = useMemo(() => {
    if (!filteredProducts.length) return [];
    return filteredProducts.map(p => {
      if (!p.firstDate) return { ...p, days: 0, stage: '无数据', stageColor: 'var(--pdd-gray-400)' };
      const first = new Date(p.firstDate);
      const last = new Date(p.lastDate || p.firstDate);
      const days = Math.max(1, (last.getTime() - first.getTime()) / 86400000);
      const stage = days < 7 ? '新品期' : days < 30 ? '成长期' : days < 90 ? '成熟期' : '衰退期';
      const stockStatus = p.inventoryStatus === 'out' ? '缺货' : p.inventoryStatus === 'low' ? '低库存' : '正常';
      return { id: p.id, name: p.name, days, sales: p.sales, revenue: p.revenue, stage, profit: p.profit, turnoverDays: p.turnoverDays, inventory: p.inventory, avgDailySales: p.avgDailySales, sellThroughRate: p.sellThroughRate || 0, stockStatus, afterSaleRate: p.afterSaleRate };
    }).sort((a, b) => b.days - a.days);
  }, [filteredProducts]);

  // 生命周期摘要
  const lifecycleSummary = useMemo(() => {
    if (!lifecycleData.length) return null;
    const stages = { '新品期': 0, '成长期': 0, '成熟期': 0, '衰退期': 0 };
    lifecycleData.forEach(p => { stages[p.stage as keyof typeof stages]++; });
    const outOfStock = lifecycleData.filter(p => p.stockStatus === '缺货').length;
    const slowTurnover = lifecycleData.filter(p => p.turnoverDays > 30 && p.sales > 0).length;
    return { ...stages, total: lifecycleData.length, outOfStock, slowTurnover };
  }, [lifecycleData]);

  // SKU 辅助：从订单行查找字段值
  const fv = (o: any, fields: string[]): string => {
    const keys = Object.keys(o);
    for (const f of fields) {
      const fClean = f.toLowerCase().replace(/[\s\-_()（）\[\]【】]/g, '');
      for (const k of keys) {
        const kClean = k.replace(/[﻿ \t\r\n\s\-_()（）\[\]【】]/g, '').toLowerCase();
        if (kClean === fClean || kClean.includes(fClean)) { const v = o[k]; if (v != null && v !== '') return String(v).trim(); }
      }
    }
    return '';
  };
  const fn = (o: any, fields: string[]): number => {
    for (const f of fields) {
      const v = fv(o, [f]); if (v) { const n = parseFloat(v.replace(/[^\d.\-]/g, '')); if (!isNaN(n)) return n; }
    }
    return 0;
  };

  // 真正的 SKU 级别统计（按 productId + skuId 分组）
  const skuData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const skuMap: Record<string, {
      productId: string; productName: string; skuId: string; skuName: string;
      sales: number; revenue: number; gmv: number; orders: number; refund: number;
      prices: number[];
    }> = {};
    const productSalesMap: Record<string, number> = {}; // 商品总销量，用于计算占比

    filteredOrders.forEach((o: any) => {
      const pid = fv(o, ['商品id', '商品ID', 'productId']);
      if (!pid) return;
      const skuId = fv(o, ['规格id', '规格ID', 'sku_id', 'style_id', '商品规格ID', 'spec_id']) || pid;
      const skuName = fv(o, ['规格名称', '商品规格', '规格', 'sku_name', 'spec_name']) || '-';
      const key = `${pid}_${skuId}`;

      if (!skuMap[key]) {
        skuMap[key] = { productId: pid, productName: fv(o, ['商品名称', '商品']), skuId, skuName, sales: 0, revenue: 0, gmv: 0, orders: 0, refund: 0, prices: [] };
      }
      const qty = fn(o, ['商品数量(件)', '商品数量', '数量']) || 1;
      skuMap[key].sales += qty;
      skuMap[key].revenue += fn(o, ['商家实收金额(元)', '商家实收', '实收金额']);
      skuMap[key].gmv += fn(o, ['商品总价(元)', '商品总价']) || fn(o, ['用户实付金额(元)', '用户实付']);
      skuMap[key].orders += 1;
      skuMap[key].refund += fn(o, ['退款金额(元)', '退款金额']);
      const price = fn(o, ['用户实付金额(元)', '用户实付']);
      if (price > 0) skuMap[key].prices.push(price);

      productSalesMap[pid] = (productSalesMap[pid] || 0) + qty;
    });

    return Object.values(skuMap).map(s => {
      const avgPrice = s.orders > 0 ? s.revenue / s.orders : 0;
      const productTotalSales = productSalesMap[s.productId] || s.sales;
      const salesShare = productTotalSales > 0 ? (s.sales / productTotalSales) * 100 : 100;
      // SKU 成本：优先匹配精确 SKU key，其次商品ID，最后用默认成本比例
      const skuKey = `${s.productId}_${s.skuId}`;
      let skuUnitCost = 0;
      if (productCosts) {
        if (productCosts[skuKey] !== undefined && productCosts[skuKey] > 0) {
          skuUnitCost = productCosts[skuKey];
        } else if (productCosts[s.productId] !== undefined && productCosts[s.productId] > 0) {
          skuUnitCost = productCosts[s.productId];
        }
      }
      const productCostTotal = skuUnitCost > 0
        ? skuUnitCost * s.sales
        : (defaultCostRatio ?? 30) / 100 * s.gmv;
      const perOrderFees = ((packagingFeePerOrder || 0) + (shippingFeePerOrder || 0)) * s.orders;
      const totalCost = productCostTotal + perOrderFees;
      const netProfit = s.revenue - totalCost - s.refund;
      const profitRate = s.revenue > 0 ? (netProfit / s.revenue) * 100 : 0;
      return {
        ...s,
        avgPrice,
        salesShare,
        netProfit,
        profitRate,
        skuCode: s.skuId !== s.productId ? s.skuId : (s.productId.slice(-6)),
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [filteredOrders, productCosts, defaultCostRatio, packagingFeePerOrder, shippingFeePerOrder]);

  const priceElasticity = useMemo(() => {
    if (!filteredProducts.length) return [];
    const data = filteredProducts.slice(0, 30).map(p => ({
      price: p.avgPrice, sales: p.sales, name: p.name.slice(0, 10), profit: p.profit, discountRatio: p.discountRatio, profitRate: p.profitRate
    }));
    // 价格带分层统计
    const bands: Record<string, { min: number; max: number; count: number; totalSales: number; totalProfit: number; avgProfitRate: number }> = {};
    data.forEach(p => {
      const bandKey = p.price < 20 ? '¥0-20' : p.price < 50 ? '¥20-50' : p.price < 100 ? '¥50-100' : p.price < 200 ? '¥100-200' : '¥200+';
      const band = bands[bandKey] || (bands[bandKey] = { min: 0, max: 0, count: 0, totalSales: 0, totalProfit: 0, avgProfitRate: 0 });
      band.count++;
      band.totalSales += p.sales;
      band.totalProfit += p.profit;
      const [lo, hi] = bandKey.replace('¥', '').replace('+', '-99999').split('-').map(Number);
      band.min = lo;
      band.max = hi === 99999 ? Infinity : hi;
    });
    Object.values(bands).forEach(b => { b.avgProfitRate = b.totalSales > 0 ? (b.totalProfit / b.totalSales) * 100 : 0; });
    return { scatter: data, bands: Object.entries(bands).map(([k, v]) => ({ label: k, ...v })).sort((a, b) => a.min - b.min) };
  }, [filteredProducts]);

  const compareData = useMemo(() => products.filter(p => compareProducts.includes(p.id)), [compareProducts, products]);

  const toggleCompare = (id: string) => {
    setCompareProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  };

  const addTag = (productId: string) => {
    if (!tagInput.trim()) return;
    setProductTags(prev => ({ ...prev, [productId]: [...(prev[productId] || []), tagInput.trim()] }));
    setTagInput('');
    setTaggingProduct(null);
  };

  const removeTag = (productId: string, tag: string) => {
    setProductTags(prev => ({ ...prev, [productId]: (prev[productId] || []).filter(t => t !== tag) }));
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setPanelOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
    setActiveId(null);
  };

  const noData = !filteredOrders.length;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  // 导出 CSV
  const handleExportCSV = () => {
    const headers = ['商品名称', '商品ID', '商家编码', 'GMV', '实收', '利润', '利润率(%)', '推广花费', '推广成交', '推广ROI', '退款率(%)', '售后率(%)'];
    const rows = filteredProducts.map(p => [
      p.name, p.id, p.code,
      p.gmv.toFixed(0), p.revenue.toFixed(0), p.profit.toFixed(0), p.profitRate.toFixed(1),
      p.promoCost > 0 ? p.promoCost.toFixed(0) : '0',
      p.promoTransaction > 0 ? p.promoTransaction.toFixed(0) : '0',
      p.promoCost > 0 && p.promoTransaction > 0 ? (p.promoTransaction / p.promoCost).toFixed(2) : '-',
      p.refundRate > 0 ? p.refundRate.toFixed(1) : '0',
      p.afterSaleRate.toFixed(1),
    ]);
    const csv = '﻿' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `商品分析_导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Smart alert tags
  const getAlertTags = (p: any) => {
    const tags: { label: string; color: string; bg: string }[] = [];
    if (p.refundRate > 15) tags.push({ label: '高退款', color: 'var(--pdd-danger)', bg: 'var(--pdd-danger-bg)' });
    if (p.sales <= 0) tags.push({ label: '零动销', color: 'var(--pdd-text-secondary)', bg: 'var(--pdd-bg)' });
    if (p.inventoryStatus === 'low') tags.push({ label: '低库存', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning-bg)' });
    if (p.promoCostRatio > 30) tags.push({ label: '高推广依赖', color: 'var(--pdd-primary)', bg: 'var(--pdd-primary-bg)' });
    if (p.turnoverDays > 30) tags.push({ label: '周转慢', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning-bg)' });
    return tags;
  };

  // 计算总利润可信度（基于商品利润可信度的加权平均）
  const totalProfitConfidence = useMemo(() => {
    if (!filteredProducts.length) return 'low';
    const profits = filteredProducts.map(p => p.profit || 0);
    const totalProfit = profits.reduce((s, p) => s + p, 0);
    if (totalProfit === 0) return 'low';

    // 根据利润贡献加权计算可信度
    let highWeight = 0, mediumWeight = 0, lowWeight = 0;
    filteredProducts.forEach(p => {
      const weight = Math.abs(p.profit || 0) / totalProfit;
      const confidence = p.profitConfidence || 'low';
      if (confidence === 'high') highWeight += weight;
      else if (confidence === 'medium') mediumWeight += weight;
      else lowWeight += weight;
    });

    if (highWeight > 0.5) return 'high';
    if (mediumWeight > 0.3 || highWeight > 0.3) return 'medium';
    return 'low';
  }, [filteredProducts]);

  const kpiCards = [
    { label: '在售商品', value: kpiMetrics?.productCount, diffKey: 'productCount' as const, fmt: (v: number) => v.toFixed(0), icon: Package, color: 'var(--pdd-primary)', bg: 'var(--pdd-card)' },
    { label: '总GMV', value: kpiMetrics?.totalGmv, diffKey: 'totalGmv' as const, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: ShoppingCart, color: '#1890ff', bg: 'var(--pdd-card)' },
    { label: '总实收', value: kpiMetrics?.totalRevenue, diffKey: 'totalRevenue' as const, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-success)', bg: 'var(--pdd-card)' },
    { label: '总利润', value: kpiMetrics?.totalProfit, diffKey: 'totalProfit' as const, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: '#722ed1', bg: 'var(--pdd-card)', confidence: totalProfitConfidence },
    { label: '客单价', value: kpiMetrics?.avgPrice, diffKey: 'avgPrice' as const, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Target, color: '#faad14', bg: 'var(--pdd-card)' },
    { label: '动销率', value: kpiMetrics?.sellThroughRate, diffKey: 'sellThroughRate' as const, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Activity, color: '#13c2c2', bg: 'var(--pdd-card)' },
    { label: '均周转天数', value: kpiMetrics?.avgTurnover, fmt: (v: number) => `${v.toFixed(0)}天`, icon: Clock, color: '#fa541c', bg: 'var(--pdd-card)' },
    { label: '推广占比', value: kpiMetrics?.avgPromoRatio, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Zap, color: '#722ed1', bg: 'var(--pdd-card)' },
    { label: '售后率', value: kpiMetrics?.afterSaleRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-primary)', bg: 'var(--pdd-card)' },
    { label: '退款率', value: kpiMetrics?.refundRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-primary-light)', bg: 'var(--pdd-card)' },
    { label: '零动销', value: kpiMetrics?.zeroSales, fmt: (v: number) => v.toFixed(0), icon: Ban, color: 'var(--pdd-gray-400)', bg: 'var(--pdd-bg)' },
    { label: '库存预警', value: kpiMetrics?.lowInventory, fmt: (v: number) => v.toFixed(0), icon: Box, color: '#fa541c', bg: 'var(--pdd-card)' },
  ];

  const renderKpiPanel = () => {
    const coreCards = kpiCards;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {coreCards.map((c, i) => {
          const diff = c.diffKey ? kpiMetrics?.diffs?.[c.diffKey] : undefined;
          const diffNum = diff != null ? diff : undefined;
          const negativeMetric = c.label === '退款率' || c.label === '售后率';
          const isGood = diffNum != null ? (negativeMetric ? diffNum <= 0 : diffNum >= 0) : null;
          const diffColor = c.label === '客单价'
            ? 'text-pdd-gray-400'
            : isGood === true ? 'text-pdd-success' : isGood === false ? 'text-pdd-danger' : 'text-pdd-gray-400';
          const diffArrow = c.label === '客单价'
            ? ''
            : diffNum != null ? (diffNum > 0 ? '↑' : diffNum < 0 ? '↓' : '') : '';
          return (
          <motion.div key={c.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}
            className="pdd-card px-4 py-3.5 flex flex-col gap-2 border border-pdd-gray-100 hover:border-pdd-gray-200 transition-all cursor-default bg-pdd-card">
            <div className="flex items-center justify-between">
              <span className="text-xs text-pdd-gray-500 font-medium">{c.label}</span>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.bg }}>
                <c.icon size={14} color={c.color} />
              </div>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-xl font-bold tracking-tight" style={{ color: c.color }}>{noData ? '--' : c.value != null ? c.fmt(c.value) : '--'}</span>
              {c.confidence && !noData && c.value != null && (
                <span className={`font-bold mb-1 ${
                  c.confidence === 'high' ? 'text-pdd-success' :
                  c.confidence === 'medium' ? 'text-yellow-500' : 'text-pdd-primary'
                }`}>
                  {c.confidence === 'high' ? '✓' : c.confidence === 'medium' ? '⚠' : '!'}
                </span>
              )}
            </div>
            {diffNum != null && (
              <div className={`flex items-center gap-0.5 text-xs font-medium ${diffColor}`}>
                {diffArrow && <span>{diffArrow}</span>}
                <span>{Math.abs(diffNum).toFixed(1)}%</span>
              </div>
            )}
            {diffNum == null && !noData && c.diffKey && (
              <div className="text-xs text-pdd-gray-400">--</div>
            )}
          </motion.div>
        )})}
      </div>
    );
  };

  const renderOverviewPanel = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card lg:col-span-2 border border-pdd-gray-100 shadow-sm bg-pdd-card overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-pdd-gray-100 gap-2">
          <h3 className="text-xs font-bold text-pdd-gray-800 flex items-center gap-1.5 flex-shrink-0"><Package size={13} color="var(--pdd-primary)" />商品概览 <span className="font-normal text-pdd-gray-400 ml-0.5" style={{ fontSize: '10px' }}>{filteredProducts.length}款</span></h3>
          <div className="flex items-center gap-1.5 flex-1 max-w-xs">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="搜索ID/名称/编码..."
                value={searchKeyword}
                onChange={(e) => { setSearchKeyword(e.target.value); setCurrentPage(1); }}
                className="w-full pl-6 pr-2 py-1 border border-pdd-gray-200 rounded-md focus:outline-none focus:border-pdd-primary transition-all bg-pdd-gray-50 focus:bg-pdd-card" style={{ fontSize: '10px' }}
              />
              <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-pdd-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              {searchKeyword && (
                <button onClick={() => { setSearchKeyword(''); setCurrentPage(1); }} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-pdd-gray-400 hover:text-pdd-gray-600"><X size={10} /></button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {!noData && (
              <button onClick={handleExportCSV} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-600 hover:bg-green-100 transition-colors" title="导出CSV">
                <Download size={12} />导出
              </button>
            )}
            <div className="flex items-center gap-1 bg-pdd-gray-50 rounded-md px-1.5 py-0.5">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-pdd-card disabled:opacity-30 transition-colors text-pdd-gray-500"><ChevronLeft size={12} /></button>
              <span className="text-pdd-gray-600 font-medium min-w-[2.5rem] text-center" style={{ fontSize: '10px' }}>{currentPage}/{totalPages || 1}</span>
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-0.5 rounded hover:bg-pdd-card disabled:opacity-30 transition-colors text-pdd-gray-500"><ChevronRight size={12} /></button>
            </div>
          </div>
        </div>
        {noData ? <div className="h-32 flex flex-col items-center justify-center text-xs text-pdd-gray-400 gap-1"><Package size={20} className="opacity-20" /><span>请先上传订单数据</span></div> : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '11px' }}>
              <thead><tr className="text-pdd-gray-500 font-semibold border-b border-pdd-gray-100 bg-pdd-gray-50/50 sticky top-0 z-10" style={{ fontSize: '10px' }}>
                <th className="py-2 px-2 text-left w-8">对比</th>
                <th className="py-2 px-2 text-left cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('name'); setSortDesc(sortField === 'name' ? !sortDesc : true); }}>
                  商品信息{sortField === 'name' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('gmv'); setSortDesc(sortField === 'gmv' ? !sortDesc : true); }}>
                  GMV{sortField === 'gmv' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('revenue'); setSortDesc(sortField === 'revenue' ? !sortDesc : true); }}>
                  实收{sortField === 'revenue' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('profit'); setSortDesc(sortField === 'profit' ? !sortDesc : true); }}>
                  利润{sortField === 'profit' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('promoCost'); setSortDesc(sortField === 'promoCost' ? !sortDesc : true); }}>
                  推广花费{sortField === 'promoCost' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('promoTransaction'); setSortDesc(sortField === 'promoTransaction' ? !sortDesc : true); }}>
                  推广成交{sortField === 'promoTransaction' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('roi'); setSortDesc(sortField === 'roi' ? !sortDesc : true); }}>
                  推广ROI{sortField === 'roi' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('refundRate'); setSortDesc(sortField === 'refundRate' ? !sortDesc : true); }}>
                  退款率{sortField === 'refundRate' && <span style={{ color: 'var(--pdd-primary)' }}>{sortDesc ? ' ▼' : ' ▲'}</span>}
                </th>
                <th className="py-2 px-2 text-left">状态</th>
                <th className="py-2 px-2 text-center">操作</th>
              </tr></thead>
              <tbody className="divide-y divide-pdd-gray-50">{paginatedProducts.map((p, i) => {
                const alerts = getAlertTags(p);
                return (
                  <tr key={p.id} className={`group transition-colors ${alerts.length > 0 ? 'bg-orange-50/30' : i % 2 === 1 ? 'bg-pdd-gray-50/30' : ''} hover:bg-blue-50/40`}>
                    <td className="py-1.5 px-2"><button onClick={() => toggleCompare(p.id)} className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${compareProducts.includes(p.id) ? 'bg-purple-600 border-purple-600 text-white' : 'border-pdd-gray-300 hover:border-purple-400 text-transparent'}`}><Check size={10} /></button></td>
                    <td className="py-1.5 px-2 max-w-[160px]">
                      <div className="truncate font-medium text-pdd-gray-800 cursor-pointer hover:text-red-600 transition-colors" onClick={() => setSelectedProduct(p.id)}>{p.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {p.id && <span className="text-blue-600 font-mono bg-blue-50 px-1 py-0 rounded" style={{ fontSize: '9px' }}>{p.id}</span>}
                        {p.code && <span className="text-pdd-gray-400 font-mono" style={{ fontSize: '9px' }}>{p.code}</span>}
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">¥{p.gmv.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">¥{p.revenue.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right">
                      <ProfitTooltip
                        netProfit={p.profit}
                        grossProfit={p.grossProfit || 0}
                        preTaxProfit={p.preTaxProfit || 0}
                        netProfitAfterTax={p.netProfitAfterTax || p.profit}
                        revenue={p.revenue}
                        costBreakdown={p.costBreakdown || { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, taxes: 0, customDeductions: 0 }}
                        costSource={p.costSource || { productCost: 'missing', taxes: 'default', customDeductions: 'none' }}
                        taxDetails={p.taxDetails || []}
                        deductionDetails={p.deductionDetails || []}
                        profitConfidence={p.profitConfidence || 'low'}
                        hasRealCost={p.costSource?.productCost === 'real' || p.costSource?.productCost === 'estimated'}
                        onGoToCostManagement={() => window.location.hash = '#/cost-management'}
                      />
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">{p.promoCost > 0 ? `¥${p.promoCost.toFixed(0)}` : '-'}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">{p.promoTransaction > 0 ? `¥${p.promoTransaction.toFixed(0)}` : '-'}</td>
<td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">{p.promoCost > 0 && p.promoTransaction > 0 ? (p.promoTransaction / p.promoCost).toFixed(2) : '-'}</td>
                <td className="py-1.5 px-2 text-right font-mono text-pdd-gray-700">{p.refundRate > 0 ? `${p.refundRate.toFixed(1)}%` : '-'}</td>
                    <td className="py-1.5 px-2">
                      <div className="flex flex-wrap gap-0.5">
                        {alerts.length === 0 && <span className="text-pdd-gray-300" style={{ fontSize: '9px' }}>正常</span>}
                        {alerts.map(a => (
                          <span key={a.label} className="px-1 py-0 rounded font-medium" style={{ fontSize: '9px', color: a.color, backgroundColor: a.bg }}>{a.label}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-1.5 px-2">
                      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* 查看详情按钮 - 选中商品并显示完整360分析 */}
                        <button onClick={() => { setSelectedProduct(p.id); setTimeout(() => { const el = document.getElementById('product-360-analysis'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100); }} className="p-1.5 rounded-lg hover:bg-blue-100 text-pdd-gray-400 hover:text-blue-600 transition-colors" title="查看完整360分析"><Eye size={14} /></button>
                        {/* 快速编辑成本 */}
                        <button onClick={() => window.location.hash = '#/cost-management'} className="p-1.5 rounded-lg hover:bg-green-100 text-pdd-gray-400 hover:text-green-600 transition-colors" title="编辑成本"><DollarSign size={14} /></button>
                        {/* 添加标签 */}
                        <button onClick={() => setTaggingProduct(p.id)} className="p-1.5 rounded-lg hover:bg-purple-100 text-pdd-gray-400 hover:text-purple-600 transition-colors" title="添加标签"><Tag size={14} /></button>
                        {/* 复制商品ID */}
                        <button onClick={() => { navigator.clipboard.writeText(p.id); }} className="p-1.5 rounded-lg hover:bg-pdd-gray-100 text-pdd-gray-400 hover:text-pdd-gray-700 transition-colors" title="复制商品ID"><Hash size={14} /></button>
                        {/* 一键导入深度解析 */}
                        <button onClick={() => { setDeepAnalysisProductId(p.id); setDeepAnalysisOpen(true); }} className="p-1.5 rounded-lg hover:bg-cyan-100 text-pdd-gray-400 hover:text-cyan-600 transition-colors" title="一键导入深度解析"><Zap size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* 商品360度分析区域 */}
      <motion.div id="product-360-analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="pdd-card border border-pdd-gray-100 shadow-sm bg-pdd-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-pdd-gray-100 bg-pdd-gray-50/30">
          <h3 className="text-sm font-bold text-pdd-gray-800 flex items-center gap-2">
            <Target size={15} color="var(--pdd-primary)" />
            商品360°分析
            {selectedProduct && compareProducts.length > 0 && (
              <span className="text-xs text-pdd-gray-500 font-normal">
                (已选{compareProducts.length + 1}个商品对比)
              </span>
            )}
          </h3>
        </div>
        {/* 迷你雷达图 - 点击联动排序 */}
        {selectedProduct && radarData.length > 0 && (
          <div className="px-3 pt-3 border-b border-pdd-gray-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-medium text-pdd-gray-500">雷达筛选</span>
              <span className="text-pdd-gray-400" style={{ fontSize: '9px' }}>点击维度排序</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <RadarChart data={radarData} onClick={(e: any) => {
                if (!e || !e.activePayload || !e.activePayload.length) return;
                const subject = e.activePayload[0]?.payload?.subject;
                const mapping: Record<string, { field: string; desc: boolean }> = {
                  '销量': { field: 'sales', desc: true },
                  '收入': { field: 'revenue', desc: true },
                  '利润': { field: 'profit', desc: true },
                  '售后率': { field: 'afterSaleRate', desc: false },
                  '动销': { field: 'orders', desc: true },
                };
                const m = mapping[subject];
                if (m) {
                  setSortField(m.field);
                  setSortDesc(m.desc);
                }
              }} style={{ cursor: 'pointer' }}>
                <PolarGrid stroke="var(--pdd-border)" />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 8, fill: 'var(--pdd-text-secondary)' }} />
                <Radar dataKey="A" stroke="var(--pdd-primary)" fill="var(--pdd-primary)" fillOpacity={0.2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}
        <div className="flex-1 overflow-y-auto max-h-[700px] custom-scrollbar">
          <Product360Analysis
            product={selectedProduct ? productStats[selectedProduct] : null}
            compareProducts={compareProducts.map(id => productStats[id]).filter(Boolean)}
            onExport={() => {}}
            orders={selectedProductOrders}
            costConfig={{ productCosts, defaultCostRatio: defaultCostRatio ?? 30, packagingFeePerOrder, shippingFeePerOrder }}
            gmvTrend={selectedProduct && prevProductStats[selectedProduct] && prevProductStats[selectedProduct].gmv > 0 ? ((productStats[selectedProduct].gmv - prevProductStats[selectedProduct].gmv) / prevProductStats[selectedProduct].gmv) * 100 : undefined}
            refundRateTrend={selectedProduct && prevProductStats[selectedProduct] ? productStats[selectedProduct].refundRate - prevProductStats[selectedProduct].refundRate : undefined}
          />
        </div>
      </motion.div>
    </div>
  );

  const renderLifecyclePanel = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card border border-pdd-gray-200">
      <div className="px-4 py-3 border-b border-pdd-gray-200">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Clock size={14} color="var(--pdd-primary)" />动销分析</h3>
      </div>
      {noData ? <div className="h-40 flex items-center justify-center text-xs text-pdd-gray-500">请先上传数据</div> : (
        <div>
          {/* 生命周期摘要卡片 */}
          {lifecycleSummary && (
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 p-3">
              <div className="bg-blue-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-blue-600 font-medium">新品期</div>
                <div className="text-lg font-bold text-blue-700">{lifecycleSummary['新品期']}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-green-600 font-medium">成长期</div>
                <div className="text-lg font-bold text-green-700">{lifecycleSummary['成长期']}</div>
              </div>
              <div className="bg-yellow-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-yellow-600 font-medium">成熟期</div>
                <div className="text-lg font-bold text-yellow-700">{lifecycleSummary['成熟期']}</div>
              </div>
              <div className="bg-gray-100 rounded-lg p-2 text-center">
                <div className="text-[10px] text-gray-500 font-medium">衰退期</div>
                <div className="text-lg font-bold text-gray-600">{lifecycleSummary['衰退期']}</div>
              </div>
              <div className="bg-red-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-red-500 font-medium">缺货</div>
                <div className="text-lg font-bold text-red-600">{lifecycleSummary.outOfStock}</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2 text-center">
                <div className="text-[10px] text-orange-500 font-medium">周转慢</div>
                <div className="text-lg font-bold text-orange-600">{lifecycleSummary.slowTurnover}</div>
              </div>
            </div>
          )}
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-gray-500 border-b border-pdd-gray-200 bg-pdd-gray-50 sticky top-0 z-10">
                <th className="py-2 px-3 text-left">商品</th><th className="py-2 px-2 text-left">阶段</th><th className="py-2 px-2 text-right">上架天数</th><th className="py-2 px-2 text-right">日销</th><th className="py-2 px-2 text-right">销量</th><th className="py-2 px-2 text-right">实收</th><th className="py-2 px-2 text-right">利润</th><th className="py-2 px-2 text-right">售罄率</th><th className="py-2 px-2 text-right">周转天</th><th className="py-2 px-2">库存</th>
              </tr></thead>
              <tbody>{lifecycleData.slice(0, 30).map((p: any, i: number) => (
                <tr key={i} className="border-b border-pdd-gray-200 hover:bg-pdd-gray-50 transition-colors">
                  <td className="py-2 px-3 font-medium max-w-[100px] truncate" title={p.name}>{p.name}</td>
                  <td className="py-2 px-2"><span className={`px-1.5 py-0.5 rounded font-medium whitespace-nowrap ${p.stage === '新品期' ? 'bg-blue-100 text-blue-700' : p.stage === '成长期' ? 'bg-green-100 text-green-700' : p.stage === '成熟期' ? 'bg-yellow-100 text-yellow-700' : 'bg-pdd-gray-100 text-pdd-gray-700'}`} style={{ fontSize: '10px' }}>{p.stage}</span></td>
                  <td className="py-2 px-2 text-right">{p.days.toFixed(0)}天</td>
                  <td className="py-2 px-2 text-right tabular-nums">{p.avgDailySales.toFixed(1)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{p.sales}</td>
                  <td className="py-2 px-2 text-right tabular-nums">¥{p.revenue.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ color: p.profit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{p.profit.toFixed(0)}</td>
                  <td className="py-2 px-2 text-right tabular-nums">{p.sellThroughRate.toFixed(1)}%</td>
                  <td className="py-2 px-2 text-right tabular-nums" style={{ color: p.turnoverDays > 30 ? 'var(--pdd-danger)' : p.turnoverDays > 14 ? '#faad14' : 'var(--pdd-success)' }}>{p.turnoverDays < 999 ? `${p.turnoverDays}天` : '-'}</td>
                  <td className="py-2 px-2"><span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    p.stockStatus === '缺货' ? 'bg-red-100 text-red-600' : p.stockStatus === '低库存' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'
                  }`}>{p.stockStatus}</span><span className="ml-1 tabular-nums">{p.inventory}</span></td>
                </tr>
              ))}</tbody>
            </table>
            {lifecycleData.length > 30 && <p className="text-[10px] text-pdd-gray-400 text-center py-2">显示前30款，共{lifecycleData.length}款商品</p>}
          </div>
        </div>
      )}
    </motion.div>
  );

  const renderSkuPanel = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card border border-pdd-gray-200">
      <div className="px-4 py-3 border-b border-pdd-gray-200">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Layers size={14} color="var(--pdd-primary)" />SKU矩阵 <span className="text-xs font-normal text-pdd-gray-400">({skuData.length}个规格)</span></h3>
      </div>
      {skuData.length === 0 ? <div className="h-40 flex items-center justify-center text-xs text-pdd-gray-500">请先上传订单数据</div> : (
        <div className="overflow-x-auto max-h-[400px]">
          <table className="w-full text-xs">
            <thead><tr className="text-pdd-gray-500 border-b border-pdd-gray-200 bg-pdd-gray-50 sticky top-0 z-10">
              <th className="py-2 px-3 text-left">SKU编码</th><th className="py-2 px-3 text-left">商品</th><th className="py-2 px-2 text-left">规格</th><th className="py-2 px-2 text-right">销量</th><th className="py-2 px-2 text-right">占商品比</th><th className="py-2 px-2 text-right">实收</th><th className="py-2 px-2 text-right">均价</th><th className="py-2 px-2 text-right">利润率</th>
            </tr></thead>
            <tbody className="divide-y divide-pdd-gray-50">{skuData.slice(0, 50).map((s: any, i: number) => (
              <tr key={i} className="hover:bg-pdd-gray-50 transition-colors">
                <td className="py-2 px-3 font-mono text-pdd-gray-500 max-w-[80px] truncate" style={{ fontSize: '10px' }} title={s.skuCode}>{s.skuCode.slice(-8)}</td>
                <td className="py-2 px-3 font-medium max-w-[100px] truncate" title={s.productName}>{s.productName}</td>
                <td className="py-2 px-2 text-pdd-gray-600 max-w-[80px] truncate" title={s.skuName}>{s.skuName}</td>
                <td className="py-2 px-2 text-right tabular-nums font-medium">{s.sales}</td>
                <td className="py-2 px-2 text-right tabular-nums">
                  <div className="w-full bg-pdd-gray-100 rounded-full h-1.5 min-w-[40px]">
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, s.salesShare)}%`, backgroundColor: s.salesShare > 50 ? 'var(--pdd-primary)' : s.salesShare > 20 ? '#faad14' : 'var(--pdd-gray-400)' }} />
                  </div>
                  <span className="text-[10px] mt-0.5">{s.salesShare.toFixed(0)}%</span>
                </td>
                <td className="py-2 px-2 text-right tabular-nums">¥{s.revenue.toFixed(0)}</td>
                <td className="py-2 px-2 text-right tabular-nums">¥{s.avgPrice.toFixed(0)}</td>
                <td className="py-2 px-2 text-right tabular-nums" style={{ color: s.profitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{s.profitRate.toFixed(1)}%</td>
              </tr>
            ))}</tbody>
          </table>
          {skuData.length > 50 && <p className="text-[10px] text-pdd-gray-400 text-center py-2">显示前50个，共{skuData.length}个规格</p>}
        </div>
      )}
    </motion.div>
  );

  const renderPricePanel = () => {
    const { scatter, bands } = priceElasticity as { scatter: any[]; bands: any[] };
    return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card border border-pdd-gray-200">
      <div className="px-4 py-3 border-b border-pdd-gray-200">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Zap size={14} color="var(--pdd-primary)" />定价洞察</h3>
      </div>
      {noData ? <div className="h-40 flex items-center justify-center text-xs text-pdd-gray-500">请先上传数据</div> : (
        <div className="p-3 space-y-4">
          {/* 价格带分布 */}
          {bands.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1"><BarChart3 size={12} color="var(--pdd-primary)" />价格带销售分布</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={bands}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }} formatter={(v: number, n: string) => [n === 'count' ? `${v}款` : `${v}件`, n === 'count' ? '商品数' : '销量']} />
                    <Bar dataKey="count" name="商品数" fill="var(--pdd-primary)" radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-1.5">
                  {bands.map((b: any) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs">
                      <span className="w-16 text-pdd-text-secondary font-mono text-[10px]">{b.label}</span>
                      <span className="flex-1 text-pdd-text">{b.count}款</span>
                      <span className="text-pdd-text tabular-nums">{b.totalSales}件</span>
                      <span className="w-16 text-right tabular-nums" style={{ color: b.avgProfitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{b.avgProfitRate.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          {/* 价格 vs 销量散点图 */}
          <div>
            <h4 className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1"><Activity size={12} color="#722ed1" />价格-销量关系 (前30款)</h4>
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis type="number" dataKey="price" name="客单价" tick={{ fontSize: 10 }} unit="元" />
                <YAxis type="number" dataKey="sales" name="销量" tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '11px' }}
                  formatter={(v: number, n: string, p: any) => [v, p?.payload?.name || n]} />
                <Scatter data={scatter} fill="var(--pdd-primary)">
                  {scatter.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.profit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)'} fillOpacity={0.6} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 text-[10px] text-pdd-text-secondary justify-center mt-1">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pdd-success/60" />盈利</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pdd-danger/60" />亏损</span>
            </div>
          </div>
          {/* 折扣率分析 */}
          <div>
            <h4 className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1"><Percent size={12} color="#faad14" />折扣率与利润关系</h4>
            <div className="max-h-[120px] overflow-y-auto space-y-1">
              {[...scatter].sort((a: any, b: any) => b.discountRatio - a.discountRatio).slice(0, 10).map((p: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs py-1 px-2 bg-pdd-gray-50 rounded">
                  <span className="w-20 truncate text-pdd-text text-[10px]" title={p.name}>{p.name}</span>
                  <div className="flex-1 h-1.5 bg-pdd-gray-200 rounded-full">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, p.discountRatio)}%`, backgroundColor: p.discountRatio > 20 ? 'var(--pdd-danger)' : p.discountRatio > 10 ? '#faad14' : 'var(--pdd-success)' }} />
                  </div>
                  <span className="w-12 text-right font-mono text-[10px]">{p.discountRatio.toFixed(1)}%</span>
                  <span className="w-16 text-right tabular-nums text-[10px]" style={{ color: p.profit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{p.profit.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );};

  const renderPanel = (panelId: string) => {
    switch (panelId) {
      case 'kpi': return renderKpiPanel();
      case 'overview': return activeView === 'overview' ? renderOverviewPanel() : null;
      case 'lifecycle': return activeView === 'lifecycle' ? renderLifecyclePanel() : null;
      case 'sku': return activeView === 'sku' ? renderSkuPanel() : null;
      case 'price': return activeView === 'price' ? renderPricePanel() : null;
      case 'fulllink': return activeView === 'fulllink' ? <ProductFullLinkTab productStats={productStats} /> : null;
      case 'profit': return activeView === 'profit' ? <ProfitDiagnosisPanel productStats={productStats} /> : null;
      default: return null;
    }
  };

  return (
    <div className="p-4 space-y-4 min-h-screen bg-gradient-to-b from-pdd-gray-50 to-pdd-gray-100">
      {/* 时间筛选 */}
      <TimeFilter state={tf} />

      {/* 工具栏：Tab + 筛选 + 对比 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-0.5 bg-pdd-card rounded-xl px-1.5 py-1 border border-pdd-gray-200 shadow-sm">
          {[{k:'overview',l:'商品概览'}, {k:'lifecycle',l:'动销分析'}, {k:'sku',l:'SKU矩阵'}, {k:'price',l:'定价洞察'}, {k:'fulllink',l:'全链路追踪'}, {k:'profit',l:'盈利诊断'}].map(v => (
            <motion.button key={v.k} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setActiveView(v.k as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${activeView === v.k ? 'text-white shadow-md' : 'text-pdd-gray-500 hover:text-pdd-gray-900 hover:bg-pdd-gray-100'}`}
              style={activeView === v.k ? { background: 'linear-gradient(to right, var(--pdd-primary), var(--pdd-primary-light))', boxShadow: '0 4px 6px -1px rgba(224, 46, 36, 0.2)' } : {}}>{v.l}</motion.button>
          ))}
        </div>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shadow-sm ${showFilters ? 'text-white border-pdd-primary shadow-md' : 'border-pdd-gray-300 text-pdd-gray-500 hover:border-pdd-primary hover:text-pdd-primary'}`}
          style={showFilters ? { background: 'linear-gradient(to right, var(--pdd-primary), var(--pdd-primary-light))', boxShadow: '0 4px 6px -1px rgba(224, 46, 36, 0.2)' } : {}}>
          <Filter size={12} />筛选
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCompare(!showCompare)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shadow-sm ${showCompare ? 'text-white border-purple-600 shadow-md' : 'border-pdd-gray-300 text-pdd-gray-500 hover:border-purple-600 hover:text-purple-600'}`}
          style={showCompare ? { background: 'linear-gradient(to right, #722ed1, #b37feb)', boxShadow: '0 4px 6px -1px rgba(114, 46, 209, 0.2)' } : {}}>
          <BarChart3 size={12} />对比{compareProducts.length > 0 && `(${compareProducts.length})`}
        </motion.button>
        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setDeepAnalysisProductId(undefined); setDeepAnalysisOpen(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition-all shadow-sm border-cyan-400 text-cyan-600 hover:bg-cyan-50"
          title="单商品深度解析">
          <Search size={12} />单商品深度解析
        </motion.button>
      </div>

      {/* 筛选面板 */}
      <AnimatePresence>{showFilters && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
          className="pdd-card p-3 space-y-2 border border-pdd-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-xs"><span className="text-pdd-gray-500 w-14 shrink-0">价格带:</span>
            {['all','0-50','50-100','100-200','200-500','500-max'].map(k => (
              <motion.button key={k} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setPriceFilter(k)}
                className={`px-2.5 py-1 rounded-lg transition-all ${priceFilter === k ? 'text-white shadow-sm' : 'bg-pdd-gray-100 text-pdd-gray-500 hover:text-pdd-gray-900'}`}
                style={priceFilter === k ? { background: 'linear-gradient(to right, var(--pdd-primary), var(--pdd-primary-light))' } : {}}>{k === 'all' ? '全部' : k === '500-max' ? '500+' : k}</motion.button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs"><span className="text-pdd-gray-500 w-14 shrink-0">销量:</span>
            {['all','0-10','10-50','50-100','100-500','500-max'].map(k => (
              <motion.button key={k} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setSalesFilter(k)}
                className={`px-2.5 py-1 rounded-lg transition-all ${salesFilter === k ? 'text-white shadow-sm' : 'bg-pdd-gray-100 text-pdd-gray-500 hover:text-pdd-gray-900'}`}
                style={salesFilter === k ? { background: 'linear-gradient(to right, #1890ff, #69c0ff)' } : {}}>{k === 'all' ? '全部' : k === '500-max' ? '500+' : k}</motion.button>
            ))}
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* 可拖拽面板区域 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={panelOrder} strategy={verticalListSortingStrategy}>
          <div className="space-y-4">
            {panelOrder.map((panelId) => {
              const content = renderPanel(panelId);
              if (!content) return null;
              return (
                <SortableItem key={panelId} id={panelId}>
                  {content}
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeId ? (
            <div className="bg-pdd-card rounded-lg shadow-2xl border-2 border-pdd-primary p-4 opacity-90">
              <div className="text-sm font-medium text-pdd-primary">拖动中...</div>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* 商品对比面板 */}
      <AnimatePresence>{showCompare && compareData.length > 0 && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="pdd-card border border-pdd-gray-200">
          <div className="px-4 py-3 border-b border-pdd-gray-200">
            <h4 className="text-sm font-semibold flex items-center gap-1.5"><BarChart3 size={14} color="var(--pdd-primary)" />商品对比({compareData.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-gray-500 border-b border-pdd-gray-200 bg-pdd-gray-50">
                <th className="py-2 px-3 text-left">商品</th><th className="py-2 px-3 text-right">GMV</th><th className="py-2 px-3 text-right">实收</th><th className="py-2 px-3 text-right">利润</th><th className="py-2 px-3 text-right">利润率</th><th className="py-2 px-3 text-right">推广花费</th><th className="py-2 px-3 text-right">推广成交</th><th className="py-2 px-3 text-right">售后率</th>
              </tr></thead>
              <tbody>{compareData.map(p => (
                <tr key={p.id} className="border-b border-pdd-gray-200 hover:bg-pdd-gray-50 transition-colors">
                  <td className="py-2 px-3 truncate max-w-[120px] font-medium">{p.name}</td>
                  <td className="py-2 px-3 text-right">¥{p.gmv.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right">¥{p.revenue.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right">¥{p.profit.toFixed(0)}</td>
                  <td className="py-2 px-3 text-right">{p.profitRate.toFixed(1)}%</td>
                  <td className="py-2 px-3 text-right">{p.promoCost > 0 ? `¥${p.promoCost.toFixed(0)}` : '-'}</td>
                  <td className="py-2 px-3 text-right">{p.promoTransaction > 0 ? `¥${p.promoTransaction.toFixed(0)}` : '-'}</td>
                  <td className="py-2 px-3 text-right">{p.afterSaleRate.toFixed(1)}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </motion.div>
      )}</AnimatePresence>

      {/* 商品详情抽屉 */}
      <ProductDetailDrawer
        product={drawerProduct}
        isOpen={!!drawerProductId}
        onClose={() => setDrawerProductId(null)}
      />

      {/* 单商品深度解析全屏模态框 */}
      <AnalysisProvider>
        <ProductDeepAnalysis
          isOpen={deepAnalysisOpen}
          onClose={() => setDeepAnalysisOpen(false)}
          initialProductId={deepAnalysisProductId}
          productStats={productStats}
          products={products}
          orders={filteredOrders}
          prevProductStats={prevProductStats}
        />
      </AnalysisProvider>
    </div>
  );
}

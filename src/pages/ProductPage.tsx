import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, DragEndEvent, DragOverlay, DragStartEvent, useSensor, useSensors, PointerSensor } from '@dnd-kit/core';
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line, ScatterChart, Scatter, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Package, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Ban, ArrowUp, ArrowDown, Calendar, Filter, ChevronDown, ChevronLeft, ChevronRight, X, Check, Tag, BarChart3, Link2, RotateCcw, Layers, Clock, Target, Zap, Box, GripVertical, Eye, Activity, Hash } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct } from '../components/TimeFilter';
import AmountFilterPanel, { FilterField, FilterValues, createEmptyFilters, applyAmountFilters } from '../components/AmountFilterPanel';
import ProductFullLinkTab from './product/ProductFullLinkTab';
import ProductDetailDrawer from './product/ProductDetailDrawer';
import ProfitDiagnosisPanel from './product/ProfitDiagnosisPanel';
import Product360Analysis from '../components/product-analysis/Product360Analysis';
import { useProductStats, useProductDetail, ProductStat } from '../components/ProductLinkStats';
import ProfitTooltip from '../components/ProfitTooltip';

const PRODUCT_FILTER_FIELDS: FilterField[] = [
  { key: 'actualPay', label: '买家实付金额', hint: '用户实付', group: 'basic', compute: (o) => safeFloat(o['用户实付金额(元)']) },
  { key: 'actualReceive', label: '商家实收金额', hint: '含退款', group: 'basic', compute: (o) => safeFloat(o['商家实收金额(元)']) },
  { key: 'productTotal', label: '商品总价', group: 'basic', compute: (o) => safeFloat(o['商品总价(元)']) },
  { key: 'postage', label: '邮费金额', group: 'basic', compute: (o) => safeFloat(o['邮费(元)']) },
  { key: 'discountTotal', label: '优惠总额', hint: '三项合计', group: 'discount', compute: (o) => safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)']) },
  { key: 'discountRate', label: '优惠率', hint: '%', group: 'discount', compute: (o) => { const pt = safeFloat(o['商品总价(元)']); if (!pt) return 0; return ((safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)'])) / pt) * 100; } },
  { key: 'profit', label: '利润金额', hint: '实收-成本-邮费', group: 'cost', compute: (o) => safeFloat(o['商家实收金额(元)']) - safeFloat(o['商品总价(元)']) * 0.6 - safeFloat(o['邮费(元)']) },
  { key: 'recvRate', label: '实收率', hint: '%', group: 'cost', compute: (o) => { const pt = safeFloat(o['商品总价(元)']); if (!pt) return 0; return (safeFloat(o['商家实收金额(元)']) / pt) * 100; } },
  { key: 'productQty', label: '商品数量', hint: '件', group: 'quantity', compute: (o) => safeFloat(o['商品数量(件)'] || o['商品数量']) },
  { key: 'unitPrice', label: '客单价', hint: '实付/件数', group: 'quantity', compute: (o) => { const qty = safeFloat(o['商品数量(件)'] || o['商品数量']); if (!qty) return 0; return safeFloat(o['用户实付金额(元)']) / qty; } },
];

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
  const { currentDisplayData, productCosts, customDeductions, taxConfigs, defaultCostRatio, packagingFeePerOrder, shippingFeePerOrder } = useData();
  const { isPaid } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
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
  const [productTags, setProductTags] = useState<Record<string, string[]>>({});
  const [tagInput, setTagInput] = useState('');
  const [taggingProduct, setTaggingProduct] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  const [panelOrder, setPanelOrder] = useState<string[]>(['kpi', 'overview', 'lifecycle', 'sku', 'price']);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [amountFilters, setAmountFilters] = useState<FilterValues>(createEmptyFilters(PRODUCT_FILTER_FIELDS));
  const [searchKeyword, setSearchKeyword] = useState('');
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
  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(orders, allDates, timeRange);
    result = applyAmountFilters(result, PRODUCT_FILTER_FIELDS, amountFilters);
    return result;
  }, [orders, allDates, timeRange, amountFilters]);

  // 构建时间过滤后的 displayData 供 useProductStats 使用
  const filteredDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    // 对非订单数据也应用时间过滤
    const filterPromoData = (data: any[], dateField?: string) => {
      if (!data || !data.length || timeRange === 'all') return data || [];
      const now = new Date();
      const days = parseInt(timeRange) || 7;
      const cutoff = new Date(now.getTime() - days * 86400000);
      return data.filter(item => {
        const dateStr = dateField ? item[dateField] : (item['日期'] || item['申请时间'] || item['支付时间'] || '');
        if (!dateStr) return true; // 无日期字段的行保留
        const d = String(dateStr).trim().split(' ')[0]; // 取日期部分
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true; // 非标准日期格式保留
        const itemDate = new Date(d);
        return !isNaN(itemDate.getTime()) && itemDate >= cutoff;
      });
    };
    return {
      ...currentDisplayData,
      orders: filteredOrders,
      afterSaleRecords: filterPromoData(currentDisplayData.afterSaleRecords || [], '申请时间'),
      promotionProducts: filterPromoData(currentDisplayData.promotionProducts || []),
      promotionSummary: filterPromoData(currentDisplayData.promotionSummary || []),
      starStoreSummary: filterPromoData(currentDisplayData.starStoreSummary || []),
      liveStreamSummary: filterPromoData(currentDisplayData.liveStreamSummary || []),
      shippingInsurance: filterPromoData(currentDisplayData.shippingInsurance || [], '日期'),
    };
  }, [currentDisplayData, filteredOrders, timeRange]);

  // Use enhanced product stats from ProductLinkStats with filtered data and cost configs
  const productStats = useProductStats(
    filteredDisplayData,
    productCosts,
    taxConfigs,
    customDeductions,
    defaultCostRatio,
    packagingFeePerOrder,
    shippingFeePerOrder
  );
  const drawerProduct = useProductDetail(productStats, drawerProductId);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange) : [], [orders, allDates, timeRange, compareEnabled]);

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
    }));
  }, [productStats, productTags]);

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
    const refundRate = totalGmv > 0 ? (filteredProducts.reduce((s, p) => s + p.refund, 0) / totalGmv) * 100 : 0;
    return { productCount: productIds.size, totalSales, totalRevenue, totalProfit, totalGmv, avgPrice, afterSaleRate, zeroSales, lowInventory, sellThroughRate, avgTurnover, avgPromoRatio, refundRate };
  }, [filteredProducts]);

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

  const lifecycleData = useMemo(() => {
    if (!filteredProducts.length) return [];
    return filteredProducts.slice(0, 15).map(p => {
      const first = new Date(p.firstDate || Date.now());
      const last = new Date(p.lastDate || Date.now());
      const days = Math.max(1, (last.getTime() - first.getTime()) / 86400000);
      const stage = days < 7 ? '新品期' : days < 30 ? '成长期' : days < 90 ? '成熟期' : '衰退期';
      return { name: p.name.slice(0, 8), days, sales: p.sales, revenue: p.revenue, stage, profit: p.profit, turnoverDays: p.turnoverDays, inventory: p.inventory };
    }).sort((a, b) => b.days - a.days);
  }, [filteredProducts]);

  const skuData = useMemo(() => {
    if (!filteredProducts.length) return [];
    return filteredProducts.slice(0, 10).map(p => ({
      name: p.name.slice(0, 10),
      sku: p.code || 'SKU-' + p.id.slice(-4),
      sales: p.sales,
      revenue: p.revenue,
      profit: p.profit,
      inventory: p.inventory,
      turnover: p.inventory > 0 ? p.sales / p.inventory : 0,
      avgPrice: p.avgPrice,
      discountRatio: p.discountRatio
    }));
  }, [filteredProducts]);

  const priceElasticity = useMemo(() => {
    if (!filteredProducts.length) return [];
    return filteredProducts.slice(0, 30).map(p => ({
      price: p.avgPrice, sales: p.sales, name: p.name.slice(0, 10), profit: p.profit, discountRatio: p.discountRatio
    }));
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
    { label: '在售商品', value: kpiMetrics?.productCount, fmt: (v: number) => v.toFixed(0), icon: Package, color: 'var(--pdd-primary)', bg: 'var(--pdd-card)' },
    { label: '总GMV', value: kpiMetrics?.totalGmv, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: ShoppingCart, color: '#1890ff', bg: 'var(--pdd-card)' },
    { label: '总实收', value: kpiMetrics?.totalRevenue, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-success)', bg: 'var(--pdd-card)' },
    { label: '总利润', value: kpiMetrics?.totalProfit, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: '#722ed1', bg: 'var(--pdd-card)', confidence: totalProfitConfidence },
    { label: '客单价', value: kpiMetrics?.avgPrice, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Target, color: '#faad14', bg: 'var(--pdd-card)' },
    { label: '动销率', value: kpiMetrics?.sellThroughRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Activity, color: '#13c2c2', bg: 'var(--pdd-card)' },
    { label: '均周转天数', value: kpiMetrics?.avgTurnover, fmt: (v: number) => `${v.toFixed(0)}天`, icon: Clock, color: '#fa541c', bg: 'var(--pdd-card)' },
    { label: '推广占比', value: kpiMetrics?.avgPromoRatio, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Zap, color: '#722ed1', bg: 'var(--pdd-card)' },
    { label: '售后率', value: kpiMetrics?.afterSaleRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-primary)', bg: 'var(--pdd-card)' },
    { label: '退款率', value: kpiMetrics?.refundRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-primary-light)', bg: 'var(--pdd-card)' },
    { label: '零动销', value: kpiMetrics?.zeroSales, fmt: (v: number) => v.toFixed(0), icon: Ban, color: 'var(--pdd-gray-400)', bg: 'var(--pdd-bg)' },
    { label: '库存预警', value: kpiMetrics?.lowInventory, fmt: (v: number) => v.toFixed(0), icon: Box, color: '#fa541c', bg: 'var(--pdd-card)' },
  ];

  const renderKpiPanel = () => {
    // 只展示核心6个指标，其余折叠或移除，减少视觉噪音
    const coreCards = kpiCards.slice(0, 6);
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {coreCards.map((c, i) => (
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
              {c.label === '总利润' && c.confidence && !noData && c.value != null && (
                <span className={`font-bold mb-1 ${
                  c.confidence === 'high' ? 'text-pdd-success' :
                  c.confidence === 'medium' ? 'text-yellow-500' : 'text-pdd-primary'
                }`}>
                  {c.confidence === 'high' ? '✓' : c.confidence === 'medium' ? '⚠' : '!'}
                </span>
              )}
            </div>
          </motion.div>
        ))}
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
          <div className="flex items-center gap-1 bg-pdd-gray-50 rounded-md px-1.5 py-0.5 flex-shrink-0">
            <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-0.5 rounded hover:bg-pdd-card disabled:opacity-30 transition-colors text-pdd-gray-500"><ChevronLeft size={12} /></button>
            <span className="text-pdd-gray-600 font-medium min-w-[2.5rem] text-center" style={{ fontSize: '10px' }}>{currentPage}/{totalPages || 1}</span>
            <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-0.5 rounded hover:bg-pdd-card disabled:opacity-30 transition-colors text-pdd-gray-500"><ChevronRight size={12} /></button>
          </div>
        </div>
        {noData ? <div className="h-32 flex flex-col items-center justify-center text-xs text-pdd-gray-400 gap-1"><Package size={20} className="opacity-20" /><span>请先上传订单数据</span></div> : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: '11px' }}>
              <thead><tr className="text-pdd-gray-500 font-semibold border-b border-pdd-gray-100 bg-pdd-gray-50/50 sticky top-0 z-10" style={{ fontSize: '10px' }}>
                <th className="py-2 px-2 text-left w-8">对比</th>
                <th className="py-2 px-2 text-left cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('name'); setSortDesc(sortField === 'name' ? !sortDesc : true); }}>商品信息</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('gmv'); setSortDesc(sortField === 'gmv' ? !sortDesc : true); }}>GMV</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('revenue'); setSortDesc(sortField === 'revenue' ? !sortDesc : true); }}>实收</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('profit'); setSortDesc(sortField === 'profit' ? !sortDesc : true); }}>利润</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('promoCost'); setSortDesc(sortField === 'promoCost' ? !sortDesc : true); }}>推广花费</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('promoTransaction'); setSortDesc(sortField === 'promoTransaction' ? !sortDesc : true); }}>推广成交</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('promoRoi'); setSortDesc(sortField === 'promoRoi' ? !sortDesc : true); }}>推广ROI</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-red-600 transition-colors" onClick={() => { setSortField('refundRate'); setSortDesc(sortField === 'refundRate' ? !sortDesc : true); }}>退款率</th>
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
        <div className="flex-1 overflow-y-auto max-h-[700px] custom-scrollbar">
          <Product360Analysis
            product={selectedProduct ? productStats[selectedProduct] : null}
            compareProducts={compareProducts.map(id => productStats[id]).filter(Boolean)}
            onExport={() => {}}
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
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-pdd-gray-500 border-b border-pdd-gray-200 bg-pdd-gray-50">
              <th className="py-2 px-3 text-left">商品</th><th className="py-2 px-3 text-left">阶段</th><th className="py-2 px-3 text-right">销售天数</th><th className="py-2 px-3 text-right">销量</th><th className="py-2 px-3 text-right">实收</th><th className="py-2 px-3 text-right">利润</th><th className="py-2 px-3 text-right">周转天数</th><th className="py-2 px-3 text-right">库存</th>
            </tr></thead>
            <tbody>{lifecycleData.map((p, i) => (
              <tr key={i} className="border-b border-pdd-gray-200 hover:bg-pdd-gray-50 transition-colors">
                <td className="py-2 px-3 font-medium">{p.name}</td>
                <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded font-medium ${p.stage === '新品期' ? 'bg-blue-100 text-blue-700' : p.stage === '成长期' ? 'bg-green-100 text-green-700' : p.stage === '成熟期' ? 'bg-yellow-100 text-yellow-700' : 'bg-pdd-gray-100 text-pdd-gray-700'}`} style={{ fontSize: '10px' }}>{p.stage}</span></td>
                <td className="py-2 px-3 text-right">{p.days.toFixed(0)}天</td>
                <td className="py-2 px-3 text-right">{p.sales}</td>
                <td className="py-2 px-3 text-right">¥{p.revenue.toFixed(0)}</td>
                <td className="py-2 px-3 text-right">¥{p.profit.toFixed(0)}</td>
                <td className="py-2 px-3 text-right" style={{ color: p.turnoverDays > 30 ? 'var(--pdd-primary)' : p.turnoverDays > 14 ? '#faad14' : 'var(--pdd-success)' }}>{p.turnoverDays < 999 ? `${p.turnoverDays}天` : '-'}</td>
                <td className="py-2 px-3 text-right">{p.inventory}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </motion.div>
  );

  const renderSkuPanel = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card border border-pdd-gray-200">
      <div className="px-4 py-3 border-b border-pdd-gray-200">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Layers size={14} color="var(--pdd-primary)" />SKU矩阵</h3>
      </div>
      {noData ? <div className="h-40 flex items-center justify-center text-xs text-pdd-gray-500">请先上传数据</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-pdd-gray-500 border-b border-pdd-gray-200 bg-pdd-gray-50">
              <th className="py-2 px-3 text-left">商品</th><th className="py-2 px-3 text-left">SKU</th><th className="py-2 px-3 text-right">销量</th><th className="py-2 px-3 text-right">实收</th><th className="py-2 px-3 text-right">利润</th><th className="py-2 px-3 text-right">均价</th><th className="py-2 px-3 text-right">折扣率</th><th className="py-2 px-3 text-right">库存</th><th className="py-2 px-3 text-right">周转率</th>
            </tr></thead>
            <tbody>{skuData.map((p, i) => (
              <tr key={i} className="border-b border-pdd-gray-200 hover:bg-pdd-gray-50 transition-colors">
                <td className="py-2 px-3 font-medium">{p.name}</td>
                <td className="py-2 px-3 font-mono text-pdd-gray-500" style={{ fontSize: '10px' }}>{p.sku}</td>
                <td className="py-2 px-3 text-right">{p.sales}</td>
                <td className="py-2 px-3 text-right">¥{p.revenue.toFixed(0)}</td>
                <td className="py-2 px-3 text-right">¥{p.profit.toFixed(0)}</td>
                <td className="py-2 px-3 text-right">¥{p.avgPrice.toFixed(0)}</td>
                <td className="py-2 px-3 text-right">{p.discountRatio.toFixed(1)}%</td>
                <td className="py-2 px-3 text-right">{p.inventory}</td>
                <td className="py-2 px-3 text-right">{p.turnover.toFixed(2)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </motion.div>
  );

  const renderPricePanel = () => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card border border-pdd-gray-200">
      <div className="px-4 py-3 border-b border-pdd-gray-200">
        <h3 className="text-sm font-semibold flex items-center gap-1.5"><Zap size={14} color="var(--pdd-primary)" />定价洞察</h3>
      </div>
      {noData ? <div className="h-40 flex items-center justify-center text-xs text-pdd-gray-500">请先上传数据</div> : (
        <div className="p-3">
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis type="number" dataKey="price" name="客单价" tick={{ fontSize: 10 }} unit="元" />
              <YAxis type="number" dataKey="sales" name="销量" tick={{ fontSize: 10 }} />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(v: number, n: string, p: any) => [v, p?.payload?.name || n]} />
              <Scatter data={priceElasticity} fill="var(--pdd-primary)" />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );

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
      <TimeFilter state={{ timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled }} />
      
      {/* 金额筛选 */}
      <AmountFilterPanel fields={PRODUCT_FILTER_FIELDS} filters={amountFilters} onFiltersChange={setAmountFilters} />

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
    </div>
  );
}

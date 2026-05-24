import React, { useMemo, useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, AlertTriangle, RotateCcw, Package, Users, Clock, Truck, Tag, BarChart3, Search, Download, FileSpreadsheet, RefreshCw, Calendar, Target, Megaphone, Percent, Mail, Database } from 'lucide-react';
import { useData } from '../App';
import { importSampleData, hasSampleData } from '../utils/dataImporter';
import { DEFAULT_AMOUNT_FIELDS, FilterValues, createEmptyFilters, applyAmountFilters } from '../components/AmountFilterPanel';
import { safeFloat, filterPromoByTimeRange } from '../components/TimeFilter';
import DashboardKpiPanel from './dashboard/DashboardKpiPanel';
import DashboardPromoPanel from './dashboard/DashboardPromoPanel';
import DashboardTrendPanel from './dashboard/DashboardTrendPanel';
import DashboardStatusPanel from './dashboard/DashboardStatusPanel';
import DashboardTablePanel from './dashboard/DashboardTablePanel';
import DashboardDetailModal from './dashboard/DashboardDetailModal';

export default function DashboardPage() {
  const { currentDisplayData } = useData();
  const [timeRange, setTimeRange] = useState<'7' | '30' | '90'>('7');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailModal, setDetailModal] = useState<{ open: boolean; title: string; data: any[]; columns?: { key: string; label: string }[] }>({ open: false, title: '', data: [], columns: [] });
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [pinnedCols, setPinnedCols] = useState<Set<string>>(new Set());
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const [panelOrder, setPanelOrder] = useState<string[]>(['kpi', 'promo', 'trend', 'status', 'table']);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleKpis, setVisibleKpis] = useState<Set<string>>(new Set(['商家实收GMV', '有效订单量', '客单价', '售后率', '退款率', '邮费总额', '买家数', '商品数', '平均件数', '退款金额', '优惠总额', '发货率', '平均发货时长', '用户实付', '推广花费', '推广GMV', '推广ROI', '点击率', '转化率', '平均点击成本', '平均获客成本', '推广占比', '全店投产']));
  const [kpiCardOrder, setKpiCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dianfx_kpi_card_order');
    return saved ? JSON.parse(saved) : [];
  });
  const [showKpiSelector, setShowKpiSelector] = useState(false);

  // 保存 KPI 卡片顺序到 localStorage
  useEffect(() => {
    localStorage.setItem('dianfx_kpi_card_order', JSON.stringify(kpiCardOrder));
  }, [kpiCardOrder]);
  const [amountFilters, setAmountFilters] = useState<FilterValues>(createEmptyFilters(DEFAULT_AMOUNT_FIELDS));
  const pageSize = 10;

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const noData = !orders.length;

  const allDates = useMemo(() => {
    const m: Record<string, any[]> = {};
    orders.forEach(o => { const d = String(o['支付时间'] || '').split(' ')[0]; if (d) (m[d] = m[d] || []).push(o); });
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders]);

  const filteredOrders = useMemo(() => {
    if (!allDates.length) return [];
    const lastDate = allDates[allDates.length - 1][0];
    const lastD = new Date(lastDate);
    const rangeDays = parseInt(timeRange);
    const cutoff = new Date(lastD);
    cutoff.setDate(cutoff.getDate() - rangeDays + 1);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    let result = orders.filter(o => {
      const d = String(o['支付时间'] || '').split(' ')[0];
      return d >= cutoffStr;
    });
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => (String(o['订单号'] || '').toLowerCase().includes(q) || String(o['商品'] || '').toLowerCase().includes(q)));
    }
    if (selectedCategory !== 'all') result = result.filter(o => String(o['商品一级类目'] || '').trim() === selectedCategory);
    if (selectedProvince !== 'all') result = result.filter(o => String(o['省'] || '').trim() === selectedProvince);
    result = applyAmountFilters(result, DEFAULT_AMOUNT_FIELDS, amountFilters);
    return result;
  }, [orders, allDates, timeRange, searchQuery, selectedCategory, selectedProvince, amountFilters]);

  const compareOrders = useMemo(() => {
    if (!compareEnabled || !allDates.length) return [];
    const lastDate = allDates[allDates.length - 1][0];
    const lastD = new Date(lastDate);
    const rangeDays = parseInt(timeRange);
    const currentStart = new Date(lastD);
    currentStart.setDate(currentStart.getDate() - rangeDays + 1);
    const compareStart = new Date(currentStart);
    compareStart.setDate(compareStart.getDate() - rangeDays);
    const compareEnd = new Date(currentStart);
    compareEnd.setDate(compareEnd.getDate() - 1);
    const csStr = compareStart.toISOString().split('T')[0];
    const ceStr = compareEnd.toISOString().split('T')[0];
    return orders.filter(o => {
      const d = String(o['支付时间'] || '').split(' ')[0];
      return d >= csStr && d <= ceStr;
    });
  }, [orders, allDates, timeRange, compareEnabled]);

  const categories = useMemo(() => Array.from(new Set(orders.map(o => String(o['商品一级类目'] || '').trim()).filter(Boolean))), [orders]);
  const provinces = useMemo(() => Array.from(new Set(orders.map(o => String(o['省'] || '').trim()).filter(Boolean))), [orders]);

  const kpi = useMemo(() => {
    if (!filteredOrders.length) return null;
    const gmv = filteredOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const cnt = filteredOrders.length;
    const paid = filteredOrders.reduce((s, o) => s + safeFloat(o['用户实付金额(元)']), 0);
    const avg = cnt > 0 ? paid / cnt : 0;
    // 优先使用独立售后数据，降级使用订单中的售后字段
    const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
    let asCnt: number, rfCnt: number, rfAmount: number;
    if (afterSaleRecords.length > 0) {
      asCnt = afterSaleRecords.length;
      rfCnt = afterSaleRecords.filter((r: any) => String(r['售后状态'] || '').includes('退款')).length;
      rfAmount = afterSaleRecords.reduce((s: number, r: any) => s + safeFloat(r['退款金额']), 0);
    } else {
      asCnt = filteredOrders.filter(o => { const st = String(o['售后状态'] || '').trim(); return st && st !== '无售后或售后取消' && st !== '无'; }).length;
      rfCnt = filteredOrders.filter(o => String(o['售后状态'] || '').includes('退款')).length;
      rfAmount = filteredOrders.filter(o => String(o['售后状态'] || '').includes('退款')).reduce((s, o) => s + safeFloat(o['用户实付金额(元)']), 0);
    }
    const asRate = cnt > 0 ? (asCnt / cnt) * 100 : 0;
    const rfRate = cnt > 0 ? (rfCnt / cnt) * 100 : 0;
    const postage = filteredOrders.reduce((s, o) => s + safeFloat(o['邮费(元)']), 0);
    const discount = filteredOrders.reduce((s, o) => s + safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)']), 0);
    const shipped = filteredOrders.filter(o => String(o['发货时间'] || '').trim() !== '').length;
    const conversionRate = cnt > 0 ? (shipped / cnt) * 100 : 0;
    const avgShipHours = shipped > 0 ? filteredOrders.filter(o => String(o['发货时间'] || '').trim() !== '').reduce((s, o) => {
      const payT = new Date(String(o['支付时间'] || ''));
      const shipT = new Date(String(o['发货时间'] || ''));
      return s + (shipT.getTime() - payT.getTime()) / 3600000;
    }, 0) / shipped : 0;
    return { gmv, cnt, avg, paid, asRate, rfRate, rfAmount, postage, discount, conversionRate, avgShipHours };
  }, [filteredOrders]);

  const compareKpi = useMemo(() => {
    if (!compareOrders.length) return null;
    const gmv = compareOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const cnt = compareOrders.length;
    const paid = compareOrders.reduce((s, o) => s + safeFloat(o['用户实付金额(元)']), 0);
    const avg = cnt > 0 ? paid / cnt : 0;
    return { gmv, cnt, avg };
  }, [compareOrders]);

  const changePct = (cur: number, prev: number) => { if (!prev || prev === 0) return null; return ((cur - prev) / prev) * 100; };

  const revenueTrend = useMemo(() => {
    if (!filteredOrders.length) return [];
    const byDate: Record<string, { income: number; orders: number }> = {};
    filteredOrders.forEach(o => {
      const d = String(o['支付时间'] || '').split(' ')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = { income: 0, orders: 0 };
      byDate[d].income += safeFloat(o['商家实收金额(元)']);
      byDate[d].orders += 1;
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-7).map(([d, v]) => ({ date: d.slice(5), ...v }));
  }, [filteredOrders]);

  const statusDist = useMemo(() => {
    if (!filteredOrders.length) return [];
    const m: Record<string, number> = {};
    filteredOrders.forEach(o => { const st = String(o['订单状态'] || '').trim() || '未知'; m[st] = (m[st] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredOrders]);

  const tableData = useMemo(() => {
    let data = filteredOrders.map((o: any) => ({
      orderNo: String(o['订单号'] || ''),
      product: String(o['商品'] || '').slice(0, 30),
      category: String(o['商品一级类目'] || ''),
      province: String(o['省'] || ''),
      status: String(o['订单状态'] || ''),
      paid: safeFloat(o['用户实付金额(元)']),
      merchant: safeFloat(o['商家实收金额(元)']),
      qty: safeFloat(o['商品数量(件)']),
      time: String(o['支付时间'] || '').slice(0, 16),
    }));
    if (sortField) {
      data.sort((a: any, b: any) => {
        const av = a[sortField], bv = b[sortField];
        if (typeof av === 'number' && typeof bv === 'number') return sortDesc ? bv - av : av - bv;
        return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
      });
    }
    return data;
  }, [filteredOrders, sortField, sortDesc]);

  const totalPages = Math.ceil(tableData.length / pageSize);
  const paginatedData = tableData.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => { setLastRefresh(new Date()); setIsRefreshing(false); }, 1000);
  };

  const exportCSV = () => {
    const headers = ['订单号', '商品', '类目', '省份', '状态', '实付金额', '商家实收', '数量', '时间'];
    const rows = tableData.map(r => [r.orderNo, r.product, r.category, r.province, r.status, r.paid, r.merchant, r.qty, r.time]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `订单数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(tableData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `订单数据_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
  };

  const toggleCol = (col: string) => {
    const next = new Set(hiddenCols);
    if (next.has(col)) next.delete(col); else next.add(col);
    setHiddenCols(next);
  };

  const togglePin = (col: string) => {
    const next = new Set(pinnedCols);
    if (next.has(col)) next.delete(col); else next.add(col);
    setPinnedCols(next);
  };

  const handleDragStart = (panel: string) => setDraggedPanel(panel);
  const handleDragOver = (e: React.DragEvent, targetPanel: string) => {
    e.preventDefault();
    if (draggedPanel && draggedPanel !== targetPanel) {
      const newOrder = [...panelOrder];
      const fromIdx = newOrder.indexOf(draggedPanel);
      const toIdx = newOrder.indexOf(targetPanel);
      newOrder.splice(fromIdx, 1);
      newOrder.splice(toIdx, 0, draggedPanel);
      setPanelOrder(newOrder);
      setDraggedPanel(targetPanel);
    }
  };
  const handleDragEnd = () => setDraggedPanel(null);

  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  const filteredPromoSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.promotionSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);
  const filteredStarSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.starStoreSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);
  const filteredLiveSummary = useMemo(() => filterPromoByTimeRange(currentDisplayData?.liveStreamSummary || [], allDates, timeRange), [currentDisplayData, allDates, timeRange]);

  const promoKpi = useMemo(() => {
    if (!filteredPromoSummary.length) return null;
    let totalCost = 0, promoGMV = 0, promoOrders = 0, totalImpressions = 0, totalClicks = 0;
    let inquiryCost = 0, inquiryCount = 0, favoriteCost = 0, favoriteCount = 0, followCost = 0, followCount = 0;
    filteredPromoSummary.forEach((r: any) => {
      totalCost += safeFloat(r['总花费(元)'] || r['花费(元)'] || r['成交花费(元)']);
      promoGMV += safeFloat(r['交易额(元)'] || r['成交金额(元)']);
      promoOrders += parseInt(r['成交笔数'] || '0') || 0;
      totalImpressions += parseInt(r['曝光量'] || '0') || 0;
      totalClicks += parseInt(r['点击量'] || '0') || 0;
      inquiryCost += safeFloat(r['询单花费(元)']);
      inquiryCount += parseInt(r['询单量'] || '0') || 0;
      favoriteCost += safeFloat(r['收藏花费(元)']);
      favoriteCount += parseInt(r['收藏量'] || '0') || 0;
      followCost += safeFloat(r['关注花费(元)']);
      followCount += parseInt(r['关注量'] || '0') || 0;
    });
    const roi = totalCost > 0 ? promoGMV / totalCost : 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
    const cvr = totalClicks > 0 ? (promoOrders / totalClicks) * 100 : 0;
    const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;
    const cpa = promoOrders > 0 ? totalCost / promoOrders : 0;
    const avgInquiryCost = inquiryCount > 0 ? inquiryCost / inquiryCount : 0;
    const avgFavoriteCost = favoriteCount > 0 ? favoriteCost / favoriteCount : 0;
    const avgFollowCost = followCount > 0 ? followCost / followCount : 0;
    return {
      totalCost, promoGMV, promoOrders, roi, ctr, cvr, cpc, cpa,
      totalImpressions, totalClicks,
      inquiryCost, inquiryCount, avgInquiryCost,
      favoriteCost, favoriteCount, avgFavoriteCost,
      followCost, followCount, avgFollowCost
    };
  }, [filteredPromoSummary]);

  const promoTrendData = useMemo(() => {
    if (!filteredPromoSummary.length) return [];
    const byDate: Record<string, { cost: number; gmv: number; orders: number }> = {};
    filteredPromoSummary.forEach((r: any) => {
      const d = String(r['日期'] || '').trim();
      if (!d) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, orders: 0 };
      byDate[d].cost += safeFloat(r['总花费(元)'] || r['花费(元)']);
      byDate[d].gmv += safeFloat(r['交易额(元)'] || r['成交金额(元)']);
      byDate[d].orders += parseInt(r['成交笔数'] || '0') || 0;
    });
    return Object.entries(byDate)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([d, v]) => ({
        date: d.slice(5),
        cost: Math.round(v.cost),
        gmv: Math.round(v.gmv),
        roi: v.cost > 0 ? parseFloat((v.gmv / v.cost).toFixed(2)) : 0
      }));
  }, [currentDisplayData]);

  const topPromoProducts = useMemo(() => {
    if (!currentDisplayData?.promotionProducts?.length) return [];
    return currentDisplayData.promotionProducts
      .map((r: any) => ({
        name: String(r['商品名称'] || '').slice(0, 15),
        cost: safeFloat(r['总花费(元)'] || r['花费(元)']),
        gmv: safeFloat(r['交易额(元)'] || r['成交金额(元)']),
        orders: parseInt(r['成交笔数'] || '0') || 0,
        roi: safeFloat(r['总花费(元)'] || r['花费(元)']) > 0
          ? safeFloat(r['交易额(元)'] || r['成交金额(元)']) / safeFloat(r['总花费(元)'] || r['花费(元)'])
          : 0
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [currentDisplayData]);

  const allKpiCards = [
    { label: '商家实收GMV', value: kpi?.gmv, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-primary)', change: compareEnabled ? changePct(kpi?.gmv || 0, compareKpi?.gmv || 0) : null },
    { label: '有效订单量', value: kpi?.cnt, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-info)', change: compareEnabled ? changePct(kpi?.cnt || 0, compareKpi?.cnt || 0) : null },
    { label: '客单价', value: kpi?.avg, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: TrendingUp, color: 'var(--pdd-success)', change: compareEnabled ? changePct(kpi?.avg || 0, compareKpi?.avg || 0) : null },
    { label: '售后率', value: kpi?.asRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-warning)', change: null },
    { label: '退款率', value: kpi?.rfRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-danger)', change: null },
    { label: '邮费总额', value: kpi?.postage, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: Mail, color: '#13c2c2', change: null },
    { label: '买家数', value: new Set(filteredOrders.map(o => { const no = String(o['订单号'] || '').trim(); return no.length >= 4 ? no.slice(-4) : no; }).filter(Boolean)).size || (filteredOrders.length > 0 ? 1 : 0), fmt: (v: number) => v.toFixed(0), icon: Users, color: '#722ed1', change: null },
    { label: '商品数', value: filteredOrders.reduce((s, o) => s + safeFloat(o['商品数量']), 0), fmt: (v: number) => v.toFixed(0), icon: Package, color: '#eb2f96', change: null },
    { label: '平均件数', value: (kpi?.cnt || 0) > 0 ? filteredOrders.reduce((s, o) => s + safeFloat(o['商品数量']), 0) / (kpi?.cnt || 1) : 0, fmt: (v: number) => v.toFixed(1), icon: Tag, color: '#fa8c16', change: null },
    { label: '退款金额', value: kpi?.rfAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: RotateCcw, color: '#ff7875', change: null },
    { label: '优惠总额', value: kpi?.discount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: Percent, color: '#ffc53d', change: null },
    { label: '发货率', value: kpi?.conversionRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Truck, color: '#36cfc9', change: null },
    { label: '平均发货时长', value: kpi?.avgShipHours, fmt: (v: number) => `${v.toFixed(1)}h`, icon: Clock, color: '#597ef7', change: null },
    { label: '用户实付', value: kpi?.paid, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: '#73d13d', change: null },
    { label: '推广花费', value: promoKpi?.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: BarChart3, color: 'var(--pdd-primary)', change: null },
    { label: '推广GMV', value: promoKpi?.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: '#722ed1', change: null },
    { label: '推广ROI', value: promoKpi?.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: 'var(--pdd-success)', change: null },
    { label: '点击率', value: promoKpi?.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, color: 'var(--pdd-warning)', change: null },
    { label: '转化率', value: promoKpi?.cvr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Percent, color: '#13c2c2', change: null },
    { label: '平均点击成本', value: promoKpi?.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: '#eb2f96', change: null },
    { label: '平均获客成本', value: promoKpi?.cpa, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Users, color: '#722ed1', change: null },
    { label: '推广占比', value: (kpi?.gmv || 0) > 0 && (promoKpi?.totalCost || 0) > 0 ? ((promoKpi!.totalCost / kpi!.gmv) * 100) : 0, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Target, color: '#fa541c', change: null },
    { label: '全店投产', value: (promoKpi?.totalCost || 0) > 0 && (kpi?.gmv || 0) > 0 ? (kpi!.gmv / promoKpi!.totalCost) : 0, fmt: (v: number) => v.toFixed(2), icon: TrendingUp, color: 'var(--pdd-success)', change: null },
  ];
  const kpiCards = useMemo(() => {
    const filtered = allKpiCards.filter(c => visibleKpis.has(c.label));
    if (kpiCardOrder.length === 0) return filtered;
    // 根据保存的顺序排序
    const orderMap = new Map(kpiCardOrder.map((label, idx) => [label, idx]));
    return filtered.sort((a, b) => {
      const orderA = orderMap.get(a.label) ?? 999;
      const orderB = orderMap.get(b.label) ?? 999;
      return orderA - orderB;
    });
  }, [allKpiCards, visibleKpis, kpiCardOrder]);

  const columns = [
    { key: 'orderNo', label: '订单号', width: colWidths['orderNo'] || 120 },
    { key: 'product', label: '商品', width: colWidths['product'] || 150 },
    { key: 'category', label: '类目', width: colWidths['category'] || 80 },
    { key: 'province', label: '省份', width: colWidths['province'] || 60 },
    { key: 'status', label: '状态', width: colWidths['status'] || 80 },
    { key: 'paid', label: '实付', width: colWidths['paid'] || 70 },
    { key: 'merchant', label: '实收', width: colWidths['merchant'] || 70 },
    { key: 'qty', label: '数量', width: colWidths['qty'] || 50 },
    { key: 'time', label: '时间', width: colWidths['time'] || 100 },
  ];

  const visibleColumns = columns.filter(c => !hiddenCols.has(c.key));
  const pinnedColumns = columns.filter(c => pinnedCols.has(c.key));
  const unpinnedColumns = columns.filter(c => !pinnedCols.has(c.key) && !hiddenCols.has(c.key));

  const renderPanel = (panelId: string) => {
    switch (panelId) {
      case 'kpi':
        return <DashboardKpiPanel key="kpi" kpiCards={kpiCards} allKpiCards={allKpiCards} visibleKpis={visibleKpis} setVisibleKpis={setVisibleKpis} showKpiSelector={showKpiSelector} setShowKpiSelector={setShowKpiSelector} amountFilters={amountFilters} setAmountFilters={setAmountFilters} filteredOrders={orders} noData={noData} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onCardClick={(title, data, cols) => setDetailModal({ open: true, title, data, columns: cols })} onCardReorder={(newOrder) => setKpiCardOrder(newOrder.map(c => c.label))} />;
      case 'promo':
        return <DashboardPromoPanel key="promo" promoTrendData={promoTrendData} topPromoProducts={topPromoProducts} rangeLabel={rangeLabel} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      case 'trend':
        return <DashboardTrendPanel key="trend" revenueTrend={revenueTrend} noData={noData} rangeLabel={rangeLabel} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      case 'status':
        return <DashboardStatusPanel key="status" statusDist={statusDist} noData={noData} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      case 'table':
        return <DashboardTablePanel key="table" tableData={tableData} paginatedData={paginatedData} columns={columns} visibleColumns={visibleColumns} pinnedColumns={pinnedColumns} unpinnedColumns={unpinnedColumns} hiddenCols={hiddenCols} pinnedCols={pinnedCols} sortField={sortField} sortDesc={sortDesc} currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} toggleCol={toggleCol} togglePin={togglePin} setSortField={setSortField} setSortDesc={setSortDesc} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      default: return null;
    }
  };

  return (
    <div className="p-3 space-y-3 min-h-screen">
      <div className="flex items-center justify-between bg-pdd-card rounded-xl border border-pdd-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-pdd-bg rounded-lg px-2 py-1 border border-pdd-border">
            <Search size={14} className="text-pdd-text-secondary" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索订单号/商品..." className="flex-1 text-xs outline-none bg-transparent w-48 text-pdd-text placeholder-pdd-text-secondary" />
          </div>
          <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-2 py-1 rounded-lg text-xs border border-pdd-border bg-pdd-bg text-pdd-text">
            <option value="all">全部类目</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} className="px-2 py-1 rounded-lg text-xs border border-pdd-border bg-pdd-bg text-pdd-text">
            <option value="all">全部省份</option>
            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-pdd-bg rounded-lg px-1 py-0.5 border border-pdd-border">
            {(['7', '30', '90'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)} className={`px-2 py-1 rounded-md text-xs transition-all ${timeRange === r ? 'bg-pdd-primary text-white shadow-lg shadow-pdd-primary/20' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>{r}天</button>
            ))}
          </div>
          <button onClick={() => setCompareEnabled(!compareEnabled)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all ${compareEnabled ? 'bg-pdd-primary/20 text-pdd-primary border-pdd-primary/30' : 'border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/30'}`}><Calendar size={12} />对比</button>
          <button onClick={handleRefresh} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/30 hover:text-pdd-text transition-all ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={12} /></button>
          <div className="flex items-center gap-1">
            <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-pdd-success/20 text-pdd-success border border-pdd-success/20 hover:bg-pdd-success/30 transition-all"><FileSpreadsheet size={12} />CSV</button>
            <button onClick={exportJSON} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-pdd-info/20 text-pdd-info border border-pdd-info/20 hover:bg-pdd-info/30 transition-all"><Download size={12} />JSON</button>
          </div>
          <span className="text-xs text-pdd-text-secondary">更新于 {lastRefresh.toLocaleTimeString()}</span>
        </div>
      </div>

      <div className="space-y-3">
        {(() => {
          const elements: React.ReactNode[] = [];
          let i = 0;
          while (i < panelOrder.length) {
            const pid = panelOrder[i];
            if (pid === 'trend' && panelOrder[i + 1] === 'status') {
              elements.push(
                <div key="trend-status-row" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderPanel('trend')}
                  {renderPanel('status')}
                </div>
              );
              i += 2;
            } else {
              elements.push(<div key={pid}>{renderPanel(pid)}</div>);
              i++;
            }
          }
          return elements;
        })()}
      </div>

      <DashboardDetailModal open={detailModal.open} title={detailModal.title} data={detailModal.data} columns={detailModal.columns} onClose={() => setDetailModal({ open: false, title: '', data: [] })} />
    </div>
  );
}

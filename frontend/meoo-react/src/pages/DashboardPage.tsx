import React, { useMemo, useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, AlertTriangle, RotateCcw, Package, Users, Clock, Truck, Tag, BarChart3, Search, Download, FileSpreadsheet, RefreshCw, Target, Megaphone, Percent, Mail, Database, X, Settings } from 'lucide-react';
import { useData } from '../App';
import { findField, safeField } from '../utils/fieldAccess';
import { getBestPlatformFee, getBestInsuranceFee, getPenaltyFees, getMarketingFees } from '../utils/financialActuals';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, safeFloat, filterByTimeRange, filterPromoByTimeRange, getCompareOrders } from '../components/TimeFilter';
import { evaluateFormula, FormulaContext } from '../utils/formulaEngine';
import { buildTrendData, buildCompareTrendData } from '../utils/trendData';
import DashboardKpiPanel from './dashboard/DashboardKpiPanel';
import DashboardTrendPanel from './dashboard/DashboardTrendPanel';
import DashboardStatusPanel from './dashboard/DashboardStatusPanel';
import DashboardTablePanel from './dashboard/DashboardTablePanel';
import DashboardDetailModal from './dashboard/DashboardDetailModal';

export default function DashboardPage() {
  const {
    currentDisplayData,
    productCosts, packagingFeePerOrder, shippingFeePerOrder,
    laborFeePerOrder, insuranceFeePerOrder, platformCommissionRate,
    defaultCostRatio, taxConfigs, customDeductions,
    abnormalOrders, orderFinancialActuals,
    serverDashboard, serverPromotion, serverAfterSale,
    analyticsLoading, analyticsError, dataFilter,
  } = useData();
  const [localDashboard, setLocalDashboard] = useState<any>(null);
  const dashData = serverDashboard || localDashboard;
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange, setCustomRange, setQuickRange, savedRanges, saveCurrentRange, deleteSavedRange, applySavedRange } = tf;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedProvince, setSelectedProvince] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [detailModal, setDetailModal] = useState<{ open: boolean; title: string; data: any[]; columns?: { key: string; label: string }[] }>({ open: false, title: '', data: [] });
  const [selectedTrendKpis, setSelectedTrendKpis] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_selected_trend_kpis');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    return new Set(['gmv', 'orderCount']);
  });
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_hidden_cols');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr)) return new Set(arr); }
    } catch {}
    return new Set(['province']);
  });
  const [pinnedCols, setPinnedCols] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_pinned_cols');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr)) return new Set(arr); }
    } catch {}
    return new Set();
  });
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [draggedPanel, setDraggedPanel] = useState<string | null>(null);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [orderCustomCosts, setOrderCustomCosts] = useState<Record<string, { name: string; amount: number }[]>>(() => {
    try { const s = localStorage.getItem('dianfx_order_custom_costs'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [panelOrder, setPanelOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dianfx_dashboard_panel_order');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length > 0) return arr; }
    } catch {}
    return ['kpi', 'trend', 'status', 'table'];
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleKpis, setVisibleKpis] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_visible_kpis');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    return new Set(['GMV（商品总价）', '有效订单量', '自然单', '自然销售额', '客单价', '售后率', '退款率', '买家数', '商品数', '罚款金额', '退款金额', '优惠总额', '利润金额', '平均发货时长', '用户实付', '推广花费', '推广GMV', '推广ROI', '点击率', '转化率', '平均点击成本', '平均获客成本', '推广占比', '全店投产']);
  });
  const [kpiCardOrder, setKpiCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dianfx_kpi_card_order');
    return saved ? JSON.parse(saved) : [];
  });
  const [showKpiSelector, setShowKpiSelector] = useState(false);

  // 保存 KPI 卡片顺序到 localStorage
  useEffect(() => {
    localStorage.setItem('dianfx_kpi_card_order', JSON.stringify(kpiCardOrder));
  }, [kpiCardOrder]);
  // 持久化 KPI 可见性
  useEffect(() => {
    localStorage.setItem('dianfx_visible_kpis', JSON.stringify([...visibleKpis]));
  }, [visibleKpis]);
  // 持久化趋势图选中 KPI
  useEffect(() => {
    localStorage.setItem('dianfx_selected_trend_kpis', JSON.stringify([...selectedTrendKpis]));
  }, [selectedTrendKpis]);
  // 持久化隐藏列
  useEffect(() => {
    localStorage.setItem('dianfx_hidden_cols', JSON.stringify([...hiddenCols]));
  }, [hiddenCols]);
  // 持久化固定列
  useEffect(() => {
    localStorage.setItem('dianfx_pinned_cols', JSON.stringify([...pinnedCols]));
  }, [pinnedCols]);
  // 持久化面板排序
  useEffect(() => {
    localStorage.setItem('dianfx_dashboard_panel_order', JSON.stringify(panelOrder));
  }, [panelOrder]);

  // ★ 确保有数据：如果全局状态为空，直接拉取
  useEffect(() => {
    if (dashData || !dataFilter) return;
    import('../../api/analyticsApi').then(({ analyticsApi }) => {
      analyticsApi.getDashboard(dataFilter).then(d => { if (d) setLocalDashboard(d); });
    });
  }, [dataFilter, dashData]);
  const [kpiActiveFilter, setKpiActiveFilter] = useState<string | null>(null);
  const pageSize = 10;

  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(findField(o, '订单状态', '状态') || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const noData = !orders.length && !((currentDisplayData?.promotionSummary?.length ?? 0) > 0) && !((currentDisplayData?.promotionProducts?.length ?? 0) > 0) && !((currentDisplayData?.starStoreSummary?.length ?? 0) > 0) && !((currentDisplayData?.liveStreamSummary?.length ?? 0) > 0);

  const allDates = useMemo(() => {
    const m: Record<string, any[]> = {};
    orders.forEach(o => { const d = String(findField(o, '支付时间') || '').split(' ')[0]; if (d) (m[d] = m[d] || []).push(o); });
    // 如果订单日期为空，从推广数据中提取日期
    if (Object.keys(m).length === 0) {
      const extractDates = (records: any[], dateField: string = '日期') => {
        records.forEach(r => {
          const d = String(findField(r, dateField) || '').trim().replace(/\//g, '-');
          if (/^\d{4}-\d{2}-\d{2}$/.test(d)) (m[d] = m[d] || []).push(r);
        });
      };
      extractDates(currentDisplayData?.promotionSummary || []);
      extractDates(currentDisplayData?.promotionProducts || []);
      extractDates(currentDisplayData?.starStoreSummary || []);
      extractDates(currentDisplayData?.liveStreamSummary || []);
    }
    return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
  }, [orders, currentDisplayData]);

  // 统一时间截断点 — 订单和推广数据共用，保证"近N天"口径一致（已迁移到 filterByTimeRange / filterPromoByTimeRange）
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : timeRange === '90' ? '近90天' : timeRange === 'all' ? '全部' : customStart && customEnd ? `${customStart}~${customEnd}` : '自定义';

  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(o => (
        String(findField(o, '订单号') || '').toLowerCase().includes(q) ||
        String(findField(o, '商品', '商品名称') || '').toLowerCase().includes(q) ||
        String(findField(o, '商品id', '商品ID') || '').toLowerCase().includes(q) ||
        String(findField(o, '商家编码-商品维度') || '').toLowerCase().includes(q) ||
        String(findField(o, '商家编码-规格维度') || '').toLowerCase().includes(q) ||
        String(findField(o, '商品规格') || '').toLowerCase().includes(q) ||
        String(findField(o, '省', '省份') || '').toLowerCase().includes(q) ||
        String(findField(o, '市', '城市') || '').toLowerCase().includes(q) ||
        String(findField(o, '快递单号') || '').toLowerCase().includes(q) ||
        String(findField(o, '收货人', '收件人', '收货人姓名') || '').toLowerCase().includes(q) ||
        String(findField(o, '买家留言') || '').toLowerCase().includes(q) ||
        String(findField(o, '商家备注') || '').toLowerCase().includes(q)
      ));
    }
    if (selectedCategory !== 'all') result = result.filter(o => String(findField(o, '商品一级类目', '一级类目', '类目') || '').trim() === selectedCategory);
    if (selectedProvince !== 'all') result = result.filter(o => String(findField(o, '省', '省份') || '').trim() === selectedProvince);
    // 剔除用户标记为排除的异常订单
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    // KPI 联动筛选
    if (kpiActiveFilter === '退款率' || kpiActiveFilter === '退款金额') {
      result = result.filter(o => String(findField(o, '售后状态') || '').includes('退款'));
    } else if (kpiActiveFilter === '售后率') {
      result = result.filter(o => { const st = String(findField(o, '售后状态') || '').trim(); return st && st !== '无售后或售后取消' && st !== '无'; });
    }
    return result;
  }, [orders, allDates, timeRange, customStart, customEnd, quickRange, searchQuery, selectedCategory, selectedProvince, abnormalOrders, kpiActiveFilter]);

  const compareOrders = useMemo(() => {
    if (!compareEnabled) return [];
    let result = getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange);
    // 剔除异常订单
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    return result;
  }, [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange, compareEnabled, abnormalOrders]);

  const categories = useMemo(() => Array.from(new Set(orders.map(o => String(findField(o, '商品一级类目', '一级类目', '类目') || '').trim()).filter(Boolean))), [orders]);
  const provinces = useMemo(() => Array.from(new Set(orders.map(o => String(findField(o, '省', '省份') || '').trim()).filter(Boolean))), [orders]);

  // KPI 始终基于 filteredOrders 计算（保证与时间筛选联动），服务端数据仅作兜底
  const kpi = useMemo(() => {
    // 主力：从时间筛选后的订单直接计算
    if (filteredOrders.length) {
      const gmv = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
      const cnt = filteredOrders.length;
      const paid = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), 0);
      const avg = cnt > 0 ? paid / cnt : 0;
      const asCnt = filteredOrders.filter(o => { const st = String(findField(o, '售后状态') || '').trim(); return st && st !== '无售后或售后取消' && st !== '无'; }).length;
      const rfCnt = filteredOrders.filter(o => String(findField(o, '售后状态') || '').includes('退款')).length;
      const rfAmount = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)')), 0);
      const asRate = cnt > 0 ? (asCnt / cnt) * 100 : 0;
      const rfRate = cnt > 0 ? (rfCnt / cnt) * 100 : 0;
      const postage = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费')), 0);
      const discount = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减')) + safeFloat(findField(o, '拼多多优惠券(元)', '拼多多优惠券', '优惠券')), 0);
      const shipped = filteredOrders.filter(o => { const v = findField(o, '发货时间'); return v != null && String(v).trim() !== ''; }).length;
      const conversionRate = cnt > 0 ? (shipped / cnt) * 100 : 0;
      const avgShipHours = shipped > 0 ? filteredOrders.filter(o => { const v = findField(o, '发货时间'); return v != null && String(v).trim() !== ''; }).reduce((s, o) => {
        const payT = new Date(String(findField(o, '支付时间') || ''));
        const shipT = new Date(String(findField(o, '发货时间') || ''));
        return s + (shipT.getTime() - payT.getTime()) / 3600000;
      }, 0) / shipped : 0;
      return { gmv, cnt, avg, paid, asRate, rfRate, rfAmount, postage, discount, conversionRate, avgShipHours };
    }
    // 兜底：订单为空时尝试服务端数据
    if (dashData?.kpi) {
      const sk = dashData.kpi;
      const refundAmount = (serverAfterSale?.refundAmount && serverAfterSale.refundAmount > 0)
        ? serverAfterSale.refundAmount
        : sk.refund;
      return {
        gmv: sk.gmv, cnt: sk.orders, avg: sk.avgOrder, paid: sk.paid,
        asRate: sk.afterSaleRate, rfRate: sk.refundRate, rfAmount: refundAmount,
        postage: sk.postage ?? 0, discount: sk.discount,
        conversionRate: sk.conversionRate ?? 0, avgShipHours: sk.avgShipHours ?? 0,
      };
    }
    return null;
  }, [dashData, serverAfterSale, filteredOrders]);

  const compareKpi = useMemo(() => {
    if (!compareOrders.length) return null;
    const gmv = compareOrders.reduce((s, o) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
    const cnt = compareOrders.length;
    const paid = compareOrders.reduce((s, o) => s + safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), 0);
    const avg = cnt > 0 ? paid / cnt : 0;
    return { gmv, cnt, avg };
  }, [compareOrders]);

  const changePct = (cur: number, prev: number) => { if (!prev || prev === 0) return null; return ((cur - prev) / prev) * 100; };

  const revenueTrend = useMemo(() => {
    if (!filteredOrders.length) return [];
    const byDate: Record<string, { income: number; orders: number; refund: number }> = {};
    filteredOrders.forEach(o => {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = { income: 0, orders: 0, refund: 0 };
      byDate[d].income += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
      byDate[d].orders += 1;
      byDate[d].refund += safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)'));
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).map(([d, v]) => ({ date: d.slice(5), ...v }));
  }, [filteredOrders]);

  const statusDist = useMemo(() => {
    if (dashData?.status?.length) return dashData.status;
    if (!filteredOrders.length) return [];
    const m: Record<string, number> = {};
    filteredOrders.forEach(o => { const st = String(findField(o, '订单状态', '状态') || '').trim() || '未知'; m[st] = (m[st] || 0) + 1; });
    return Object.entries(m).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [dashData, filteredOrders]);

  const fmtTime = (raw: string): string => {
    // Input: "2026-05-24 14:30:00" or "2026-05-24 14:30"
    // Output: "05-24 14:30"
    const m = raw.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (m) return `${m[2]}-${m[3]} ${m[4]}:${m[5]}`;
    return raw.slice(0, 16);
  };

  const tableData = useMemo(() => {
    let data = filteredOrders.map((o: any) => ({
      orderNo: String(findField(o, '订单号') || ''),
      product: String(findField(o, '商品', '商品名称') || '').slice(0, 30),
      category: String(findField(o, '商品一级类目', '一级类目', '类目') || ''),
      province: String(findField(o, '省', '省份') || ''),
      status: String(findField(o, '订单状态', '状态') || ''),
      paid: safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')),
      merchant: safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')),
      qty: safeFloat(findField(o, '商品数量(件)', '商品数量', '数量', 'qty')),
      time: fmtTime(String(findField(o, '支付时间') || '')),
      _raw: o,
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
    const headers = ['订单号', '时间', '商品', '数量', '实付金额', '商家实收', '状态', '类目', '省份'];
    const rows = tableData.map(r => [r.orderNo, r.time, r.product, r.qty, r.paid, r.merchant, r.status, r.category, r.province]);
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

  const filteredPromoSummary = useMemo(() => {
    const records = currentDisplayData?.promotionSummary || [];
    return filterPromoByTimeRange(records, allDates, timeRange, undefined, customStart, customEnd, quickRange);
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredStarSummary = useMemo(() => {
    const records = currentDisplayData?.starStoreSummary || [];
    return filterPromoByTimeRange(records, allDates, timeRange, undefined, customStart, customEnd, quickRange);
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);
  const filteredLiveSummary = useMemo(() => {
    const records = currentDisplayData?.liveStreamSummary || [];
    return filterPromoByTimeRange(records, allDates, timeRange, undefined, customStart, customEnd, quickRange);
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);

  const filteredPromoProducts = useMemo(() => {
    const records = currentDisplayData?.promotionProducts || [];
    return filterPromoByTimeRange(records, allDates, timeRange, undefined, customStart, customEnd, quickRange);
  }, [currentDisplayData, allDates, timeRange, customStart, customEnd, quickRange]);

  const promoKpi = useMemo(() => {
    // 主力：始终从时间筛选后的推广数据计算
    const promoSummaryOrProducts = filteredPromoSummary.length > 0
      ? filteredPromoSummary
      : filteredPromoProducts;
    const allPromoRecords = [
      ...promoSummaryOrProducts,
      ...filteredStarSummary,
      ...filteredLiveSummary,
    ];
    if (allPromoRecords.length) {
      let totalCost = 0, promoGMV = 0, promoOrders = 0, totalImpressions = 0, totalClicks = 0;
      let inquiryCost = 0, inquiryCount = 0, favoriteCost = 0, favoriteCount = 0, followCost = 0, followCount = 0;
      promoSummaryOrProducts.forEach((r: any) => {
        totalCost += safeFloat(findField(r, '总花费(元)', '花费(元)', '成交花费(元)'));
        promoGMV += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoOrders += parseInt(findField(r, '成交笔数') || '0') || 0;
        totalImpressions += parseInt(findField(r, '曝光量') || '0') || 0;
        totalClicks += parseInt(findField(r, '点击量') || '0') || 0;
        inquiryCost += safeFloat(findField(r, '询单花费(元)'));
        inquiryCount += parseInt(findField(r, '询单量') || '0') || 0;
        favoriteCost += safeFloat(findField(r, '收藏花费(元)'));
        favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
        followCost += safeFloat(findField(r, '关注花费(元)'));
        followCount += parseInt(findField(r, '关注量') || '0') || 0;
      });
      filteredStarSummary.forEach((r: any) => {
        totalCost += safeFloat(findField(r, '花费(元)', '总花费(元)'));
        promoGMV += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
        totalImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        totalClicks += parseInt(findField(r, '点击量') || '0') || 0;
        favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
        followCount += parseInt(findField(r, '店铺关注量', '关注量') || '0') || 0;
      });
      filteredLiveSummary.forEach((r: any) => {
        totalCost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
        promoGMV += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
        totalImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        followCount += parseInt(findField(r, '关注量') || '0') || 0;
        favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
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
    }
    // 兜底：推广数据为空时尝试服务端数据
    if (serverPromotion?.summary?.cost > 0) {
      const s = serverPromotion.summary;
      return {
        totalCost: s.cost, promoGMV: s.gmv, promoOrders: s.orders,
        roi: s.roi, ctr: s.ctr, cvr: s.cvr,
        cpc: s.clicks > 0 ? s.cost / s.clicks : 0,
        cpa: s.orders > 0 ? s.cost / s.orders : 0,
        totalImpressions: s.impressions, totalClicks: s.clicks,
        inquiryCost: 0, inquiryCount: 0, avgInquiryCost: 0,
        favoriteCost: 0, favoriteCount: 0, avgFavoriteCost: 0,
        followCost: 0, followCount: 0, avgFollowCost: 0,
      };
    }
    return null;
  }, [serverPromotion, filteredPromoSummary, filteredPromoProducts, filteredStarSummary, filteredLiveSummary]);

  // 罚款汇总（从财务货款明细中提取 004xxxx 罚款记录）
  const penaltySummary = useMemo(() => {
    const financialRecords = currentDisplayData?.financialRecords || [];
    let penaltyAmount = 0;
    let penaltyCount = 0;
    financialRecords.forEach((r: any) => {
      const desc = String(findField(r, '业务描述', '描述') || '').trim();
      if (desc.startsWith('004')) {
        const amount = Math.abs(safeFloat(findField(r, '支出金额（-元）', '支出金额(元)', '支出金额', '发生金额')));
        penaltyAmount += amount;
        penaltyCount++;
      }
    });
    return { penaltyAmount, penaltyCount };
  }, [currentDisplayData]);

  // 运费险汇总
  const insuranceSummary = useMemo(() => {
    const insurance = currentDisplayData?.shippingInsurance || [];
    let totalFee = 0;
    insurance.forEach((r: any) => {
      totalFee += safeFloat(findField(r, '服务费用（元）', '服务费用(元)', '保费', '保费(元)', 'insuaceFee'));
    });
    return totalFee;
  }, [currentDisplayData]);

  // 自然单 / 自然销售额 + 利润（始终基于 filteredOrders 计算，服务端仅兜底）
  const organicAndProfit = useMemo(() => {
    // 主力：从筛选后订单直接计算
    if (filteredOrders.length) {
      const totalGmv = kpi?.gmv ?? 0;
      const totalOrders = kpi?.cnt ?? 0;
      const promoOrders = promoKpi?.promoOrders ?? 0;
      const promoGmv = promoKpi?.promoGMV ?? 0;
      const organicOrders = Math.max(0, totalOrders - promoOrders);
      const organicGmv = Math.max(0, totalGmv - promoGmv);
      const totalMerchantReceived = filteredOrders.reduce((s, o) =>
        s + safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), 0);
      const totalPlatformFee = filteredOrders.reduce((s, o) =>
        s + safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费')), 0);
      const totalRefund = filteredOrders.reduce((s, o) =>
        s + safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)')), 0);
      const promoCost = promoKpi?.totalCost ?? 0;
      const profit = totalMerchantReceived - totalRefund - promoCost - penaltySummary.penaltyAmount - insuranceSummary - totalPlatformFee;
      return { organicOrders, organicGmv, profit, totalMerchantReceived, totalPlatformFee };
    }
    // 兜底：订单为空时尝试服务端数据
    if (dashData?.kpi) {
      const sk = dashData.kpi;
      return {
        organicOrders: sk.organicOrders ?? Math.max(0, sk.orders - (sk.promoOrders ?? 0)),
        organicGmv: sk.organicGmv ?? Math.max(0, sk.gmv - (sk.promoGmv ?? 0)),
        profit: sk.profit,
        totalMerchantReceived: sk.revenue,
        totalPlatformFee: sk.platformFee,
      };
    }
    return { organicOrders: 0, organicGmv: 0, profit: 0, totalMerchantReceived: 0, totalPlatformFee: 0 };
  }, [dashData, kpi, promoKpi, filteredOrders, penaltySummary, insuranceSummary]);

  const promoTrendData = useMemo(() => {
    const promoSummaryFallback = filteredPromoSummary.length > 0 ? filteredPromoSummary : filteredPromoProducts;
    const allPromo = [...promoSummaryFallback, ...filteredStarSummary, ...filteredLiveSummary];
    if (!allPromo.length) return [];
    const byDate: Record<string, { cost: number; gmv: number; orders: number }> = {};
    promoSummaryFallback.forEach((r: any) => {
      const d = safeField(r, '日期');
      if (!d) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, orders: 0 };
      byDate[d].cost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
      byDate[d].gmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
      byDate[d].orders += parseInt(findField(r, '成交笔数') || '0') || 0;
    });
    filteredStarSummary.forEach((r: any) => {
      const d = safeField(r, '日期');
      if (!d) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, orders: 0 };
      byDate[d].cost += safeFloat(findField(r, '花费(元)', '总花费(元)'));
      byDate[d].gmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
      byDate[d].orders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
    });
    filteredLiveSummary.forEach((r: any) => {
      const d = safeField(r, '日期');
      if (!d) return;
      if (!byDate[d]) byDate[d] = { cost: 0, gmv: 0, orders: 0 };
      byDate[d].cost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
      byDate[d].gmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
      byDate[d].orders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
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
  }, [filteredPromoSummary, filteredPromoProducts, filteredStarSummary, filteredLiveSummary]);

  // 趋势图数据（按 granularity 聚合：日/周/月）
  const dailyKpiData = useMemo(() => buildTrendData(filteredOrders, filteredPromoSummary.length > 0 ? filteredPromoSummary : filteredPromoProducts, granularity, filteredStarSummary, filteredLiveSummary), [filteredOrders, filteredPromoSummary, filteredPromoProducts, filteredStarSummary, filteredLiveSummary, granularity]);

  const compareDailyKpiData = useMemo(() => {
    if (!compareEnabled || !compareOrders.length) return [];
    return buildCompareTrendData(compareOrders, granularity);
  }, [compareOrders, compareEnabled, granularity]);

  const topPromoProducts = useMemo(() => {
    if (!filteredPromoProducts.length) return [];
    return filteredPromoProducts
      .map((r: any) => ({
        name: String(findField(r, '商品名称') || '').slice(0, 15),
        cost: safeFloat(findField(r, '总花费(元)', '花费(元)')),
        gmv: safeFloat(findField(r, '交易额(元)', '成交金额(元)')),
        orders: parseInt(findField(r, '成交笔数') || '0') || 0,
        roi: safeFloat(findField(r, '总花费(元)', '花费(元)')) > 0
          ? safeFloat(findField(r, '交易额(元)', '成交金额(元)')) / safeFloat(findField(r, '总花费(元)', '花费(元)'))
          : 0
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [filteredPromoProducts]);

  const allKpiCards = [
    { label: 'GMV（商品总价）', value: kpi?.gmv, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-primary)', change: compareEnabled ? changePct(kpi?.gmv || 0, compareKpi?.gmv || 0) : null, source: '订单·商品总价(元) SUM' },
    { label: '有效订单量', value: kpi?.cnt, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, color: 'var(--pdd-info)', change: compareEnabled ? changePct(kpi?.cnt || 0, compareKpi?.cnt || 0) : null, source: '订单·COUNT 排除已取消' },
    { label: '自然单', value: organicAndProfit.organicOrders, fmt: (v: number) => v.toFixed(0), icon: TrendingUp, color: 'var(--pdd-success)', change: null, source: '总订单 − 推广订单' },
    { label: '自然销售额', value: organicAndProfit.organicGmv, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: '#73d13d', change: null, source: '总GMV − 推广GMV' },
    { label: '客单价', value: kpi?.avg, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: TrendingUp, color: 'var(--pdd-success)', change: compareEnabled ? changePct(kpi?.avg || 0, compareKpi?.avg || 0) : null, source: '用户实付 ÷ 订单数' },
    { label: '售后率', value: kpi?.asRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-warning)', change: null, source: '售后记录 ÷ 订单数' },
    { label: '退款率', value: kpi?.rfRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-danger)', change: null, source: '订单·售后状态含退款 / 订单数' },
    { label: '买家数', value: (dashData?.kpi?.buyers != null) ? dashData!.kpi!.buyers : (new Set(filteredOrders.map(o => { const no = String(findField(o, '订单号') || '').trim(); return no;}).filter(Boolean)).size || (filteredOrders.length > 0 ? 1 : 0)), fmt: (v: number) => v.toFixed(0), icon: Users, color: '#722ed1', change: null, source: '订单·订单号 DISTINCT COUNT' },
    { label: '商品数', value: (dashData?.kpi?.productCount != null) ? dashData!.kpi!.productCount : new Set(filteredOrders.map(o => String(findField(o, '商品id', '商品ID') || '').trim()).filter(id => id && id !== '-' && id !== '')).size, fmt: (v: number) => v.toFixed(0), icon: Package, color: '#eb2f96', change: null, source: '订单·商品ID DISTINCT COUNT' },
    { label: '罚款金额', value: (dashData?.kpi?.penalties != null) ? dashData!.kpi!.penalties : penaltySummary.penaltyAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: AlertTriangle, color: 'var(--pdd-danger)', change: null, source: '货款明细·004开头账务 SUM' },
    { label: '退款金额', value: kpi?.rfAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: RotateCcw, color: '#ff7875', change: null, source: '订单·退款金额(元) SUM' },
    { label: '优惠总额', value: kpi?.discount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: Percent, color: '#ffc53d', change: null, source: '订单·店铺+平台+立减+优惠券 SUM' },
    { label: '利润金额', value: organicAndProfit.profit, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: organicAndProfit.profit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)', change: null, source: '实收−退款−推广−运费险−罚款' },
    { label: '平均发货时长', value: kpi?.avgShipHours, fmt: (v: number) => `${v.toFixed(1)}h`, icon: Clock, color: '#597ef7', change: null, source: '订单·发货时间−支付时间 AVG' },
    { label: '用户实付', value: kpi?.paid, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: '#73d13d', change: null, source: '订单·用户实付金额(元) SUM' },
    { label: '推广花费', value: promoKpi?.totalCost, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: BarChart3, color: 'var(--pdd-primary)', change: null, source: '推广·成交花费(元) SUM' },
    { label: '推广GMV', value: promoKpi?.promoGMV, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: TrendingUp, color: '#722ed1', change: null, source: '推广·交易额(元) SUM' },
    { label: '推广ROI', value: promoKpi?.roi, fmt: (v: number) => v.toFixed(2), icon: Target, color: 'var(--pdd-success)', change: null, source: '推广GMV ÷ 推广花费' },
    { label: '点击率', value: promoKpi?.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, color: 'var(--pdd-warning)', change: null, source: '推广·点击量÷曝光量' },
    { label: '转化率', value: promoKpi?.cvr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Percent, color: '#13c2c2', change: null, source: '推广·成交笔数÷点击量' },
    { label: '平均点击成本', value: promoKpi?.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, color: '#eb2f96', change: null, source: '推广花费 ÷ 点击量' },
    { label: '平均获客成本', value: promoKpi?.cpa, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Users, color: '#722ed1', change: null, source: '推广花费 ÷ 成交笔数' },
    { label: '推广占比', value: (kpi?.gmv || 0) > 0 && (promoKpi?.totalCost || 0) > 0 ? ((promoKpi!.totalCost / kpi!.gmv) * 100) : 0, fmt: (v: number) => `${v.toFixed(1)}%`, icon: Target, color: '#fa541c', change: null, source: '推广花费 ÷ 总GMV' },
    { label: '全店投产', value: (promoKpi?.totalCost || 0) > 0 && (kpi?.gmv || 0) > 0 ? (kpi!.gmv / promoKpi!.totalCost) : 0, fmt: (v: number) => v.toFixed(2), icon: TrendingUp, color: 'var(--pdd-success)', change: null, source: '总GMV ÷ 推广花费' },
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
    { key: 'orderNo', label: '订单号', width: colWidths['orderNo'] || 140 },
    { key: 'time', label: '时间', width: colWidths['time'] || 125 },
    { key: 'product', label: '商品', width: colWidths['product'] || 150 },
    { key: 'qty', label: '数量', width: colWidths['qty'] || 60 },
    { key: 'paid', label: '实付', width: colWidths['paid'] || 90 },
    { key: 'merchant', label: '实收', width: colWidths['merchant'] || 90 },
    { key: 'status', label: '状态', width: colWidths['status'] || 80 },
    { key: 'category', label: '类目', width: colWidths['category'] || 80 },
    { key: 'province', label: '省份', width: colWidths['province'] || 60 },
  ];

  const visibleColumns = columns.filter(c => !hiddenCols.has(c.key));
  const pinnedColumns = columns.filter(c => pinnedCols.has(c.key));
  const unpinnedColumns = columns.filter(c => !pinnedCols.has(c.key) && !hiddenCols.has(c.key));

  const handleKpiClick = (label: string) => {
    // 退款类KPI：同时切换趋势图折线（详情弹窗通过卡片上的"详情"按钮打开）
    setKpiActiveFilter(null);
    const kpiKeyMap: Record<string, string> = {
      'GMV（商品总价）': 'gmv', '有效订单量': 'orderCount', '自然单': 'orderCount', '自然销售额': 'gmv',
      '客单价': 'avgPrice',
      '用户实付': 'paid', '退款金额': 'refundAmount',
      '优惠总额': 'discount', '售后率': 'asRate', '退款率': 'rfRate',
      '推广花费': 'promoCost', '推广GMV': 'promoGmv', '推广ROI': 'promoRoi',
      '买家数': 'buyerCount', '商品数': 'productCount', '罚款金额': 'penaltyAmount', '利润金额': 'profit',
      '平均发货时长': 'avgShipHours', '点击率': 'ctr', '转化率': 'cvr',
      '平均点击成本': 'cpc', '平均获客成本': 'cpa', '推广占比': 'promoRatio', '全店投产': 'shopRoi',
    };
    const key = kpiKeyMap[label];
    if (key) {
      setSelectedTrendKpis(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
    }
  };

  const handleKpiDetailClick = (label: string) => {
    const kpiColMap: Record<string, { key: string; label: string }[]> = {
      'GMV（商品总价）': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: 'GMV', label: 'GMV(元)' }],
      '有效订单量': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '实付', label: '实付(元)' }],
      '客单价': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '实付', label: '实付(元)' }],
      '退款率': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '售后状态', label: '售后状态' }, { key: '退款金额', label: '退款金额(元)' }],
      '退款金额': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '退款金额', label: '退款金额(元)' }],
      '售后率': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '售后状态', label: '售后状态' }],
      '优惠总额': [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '优惠', label: '优惠(元)' }],
    };
    const defaultCols = [{ key: '订单号', label: '订单号' }, { key: '时间', label: '支付时间' }, { key: '商品', label: '商品' }, { key: '实付', label: '实付(元)' }];
    const cols = kpiColMap[label] || defaultCols;

    // 退款/售后类KPI：详情弹窗仅展示相关订单
    let detailOrders = filteredOrders;
    if (label === '退款率' || label === '退款金额') {
      detailOrders = filteredOrders.filter(o => String(findField(o, '售后状态') || '').includes('退款'));
    } else if (label === '售后率') {
      detailOrders = filteredOrders.filter(o => { const st = String(findField(o, '售后状态') || '').trim(); return st && st !== '无售后或售后取消' && st !== '无'; });
    }

    const data = detailOrders.map((o: any) => ({
      '订单号': String(findField(o, '订单号') || ''),
      '时间': String(findField(o, '支付时间') || '').split(' ')[0],
      '商品': String(findField(o, '商品', '商品名称') || '').slice(0, 30),
      'GMV': safeFloat(findField(o, '商品总价(元)', '商品总价')).toFixed(2),
      '实付': safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')).toFixed(2),
      '退款金额': safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)')).toFixed(2),
      '售后状态': String(findField(o, '售后状态') || ''),
      '发货时间': String(findField(o, '发货时间') || ''),
      '优惠': (safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减')) + safeFloat(findField(o, '拼多多优惠券(元)', '拼多多优惠券', '优惠券'))).toFixed(2),
    }));
    setDetailModal({ open: true, title: `${label}详情 (${data.length}条)`, data, columns: cols });
  };

  const renderPanel = (panelId: string) => {
    switch (panelId) {
      case 'kpi':
        return <DashboardKpiPanel key="kpi" kpiCards={kpiCards} allKpiCards={allKpiCards} visibleKpis={visibleKpis} setVisibleKpis={setVisibleKpis} showKpiSelector={showKpiSelector} setShowKpiSelector={setShowKpiSelector} filteredOrders={orders} noData={noData} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onCardClick={(label) => { handleKpiClick(label); }} onDetailClick={(label) => { handleKpiDetailClick(label); }} onCardReorder={(newOrder) => setKpiCardOrder(newOrder.map(c => c.label))} dailyKpiData={dailyKpiData} compareData={compareDailyKpiData} selectedTrendKpis={selectedTrendKpis} rangeLabel={rangeLabel} compareEnabled={compareEnabled} />;
      case 'trend':
        return <DashboardTrendPanel key="trend" revenueTrend={revenueTrend} noData={noData} rangeLabel={rangeLabel} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      case 'status':
        return <DashboardStatusPanel key="status" statusDist={statusDist} noData={noData} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} />;
      case 'table':
        return <React.Fragment key="table">
          {kpiActiveFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-pdd-primary/10 border border-pdd-primary/20 rounded-lg text-xs">
              <span className="text-pdd-text-secondary">筛选：</span>
              <span className="font-medium text-pdd-primary">{kpiActiveFilter}</span>
              <button onClick={() => setKpiActiveFilter(null)} className="text-pdd-text-secondary hover:text-pdd-danger"><X size={12} /></button>
            </div>
          )}
          <DashboardTablePanel key="table" tableData={tableData} paginatedData={paginatedData} columns={columns} visibleColumns={visibleColumns} pinnedColumns={pinnedColumns} unpinnedColumns={unpinnedColumns} hiddenCols={hiddenCols} pinnedCols={pinnedCols} sortField={sortField} sortDesc={sortDesc} currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} toggleCol={toggleCol} togglePin={togglePin} setSortField={setSortField} setSortDesc={setSortDesc} draggedPanel={draggedPanel} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd} onRowClick={(row) => setOrderDetail(row._raw)} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        </React.Fragment>;
      default: return null;
    }
  };

  return (
    <div className="p-3 space-y-3 min-h-screen">
      {/* 数据状态指示 */}
      {!dashData && !analyticsLoading && (
        <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-300">
          正在从服务器加载数据...如果长时间无数据请刷新页面。
        </div>
      )}
      {/* ★ 数据加载错误 */}
      {analyticsError && !analyticsLoading && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-red-400 shrink-0" />
            <span className="text-sm text-red-300">{analyticsError}</span>
          </div>
          <button onClick={() => window.location.reload()} className="px-3 py-1 text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg transition-colors">
            刷新页面
          </button>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap bg-pdd-card rounded-xl border border-pdd-border px-3 py-2">
        <div className="flex items-center gap-1 bg-pdd-bg rounded-lg px-2.5 py-1.5 border border-pdd-border w-[280px]">
          <Search size={14} className="text-pdd-text-secondary shrink-0" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索订单号/商品/编码..." className="flex-1 text-xs outline-none bg-transparent text-pdd-text placeholder-pdd-text-secondary" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger bg-[var(--pdd-gray-200)] hover:bg-[var(--pdd-gray-300)] px-1.5 py-0.5 rounded transition-colors">清除</button>
          )}
        </div>
        <select value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)} className="px-2 py-1 rounded-lg text-xs border border-pdd-border bg-pdd-bg text-pdd-text">
          <option value="all">全部类目</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedProvince} onChange={e => setSelectedProvince(e.target.value)} className="px-2 py-1 rounded-lg text-xs border border-pdd-border bg-pdd-bg text-pdd-text">
          <option value="all">全部省份</option>
          {provinces.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <TimeFilter state={tf} compact />
        <span className="flex-1" />
        <button onClick={handleRefresh} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/30 hover:text-pdd-text transition-all ${isRefreshing ? 'animate-spin' : ''}`}><RefreshCw size={12} /></button>
        <button onClick={exportCSV} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-pdd-success/20 text-pdd-success border border-pdd-success/20 hover:bg-pdd-success/30 transition-all"><FileSpreadsheet size={12} />CSV</button>
        <button onClick={exportJSON} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-pdd-info/20 text-pdd-info border border-pdd-info/20 hover:bg-pdd-info/30 transition-all"><Download size={12} />JSON</button>
        <button onClick={() => setShowKpiSelector(!showKpiSelector)} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-all ${showKpiSelector ? 'bg-pdd-primary/20 text-pdd-primary border-pdd-primary/30' : 'border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/30'}`}><Settings size={12} />筛选</button>
        <span className="text-xs text-pdd-text-secondary whitespace-nowrap">更新于 {lastRefresh.toLocaleTimeString()}</span>
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
            } else if (pid === 'kpi') {
              elements.push(<div key={pid}>{renderPanel(pid)}</div>);
              i++;
            } else {
              elements.push(<div key={pid}>{renderPanel(pid)}</div>);
              i++;
            }
          }
          return elements;
        })()}
      </div>

      {/* KPI 明细弹窗 */}
      <DashboardDetailModal open={detailModal.open} title={detailModal.title} data={detailModal.data} columns={detailModal.columns} onClose={() => setDetailModal({ open: false, title: '', data: [] })} />

      {/* 订单详情弹窗 */}
      {orderDetail && (() => {
        const o = orderDetail;
        const fv = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return String(v).trim(); } return '-'; };
        const fn = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return safeFloat(v); } return 0; };
        const orderNo = fv(['订单号']);
        const productId = fv(['商品id', '商品ID']);
        const payDate = (fv(['支付时间']) || '').split(' ')[0];

        // 金额字段
        const productTotal = fn(['商品总价(元)', '商品总价']);
        const userPaid = fn(['用户实付金额(元)', '用户实付金额', '用户实付', '实付金额']);
        const merchantReceived = fn(['商家实收金额(元)', '商家实收金额', '商家实收', '实收金额']);
        const postage = fn(['邮费(元)', '邮费', '快递费(元)']);
        const shopDiscount = fn(['店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠']);
        const platDiscount = fn(['平台优惠折扣(元)', '平台优惠折扣', '平台优惠']);
        const payDiscount = fn(['多多支付立减金额(元)', '多多支付立减金额', '支付立减']);
        const pddCoupon = fn(['拼多多优惠券(元)', '拼多多优惠券', '优惠券(元)', '优惠券']);
        const installFee = fn(['上门安装费(元)', '上门安装费']);
        const deliverFee1 = fn(['送货入户费(元)', '送货入户费']);
        const deliverFee2 = fn(['送货入户并安装费(元)', '送货入户并安装费']);

        // 商品成本查表（与 ProductLinkStats 同等优先级: SKU > productId > productCode > defaultRatio）
        const productId2 = fv(['商品id', '商品ID']);
        const styleId = fv(['样式ID']);
        const skuKey = styleId !== '-' ? `${productId2}_${styleId}` : productId2;
        const productCode = fv(['商家编码-商品维度']);
        const qty = fn(['商品数量(件)', '商品数量', '数量']);

        let rawCost = 0;
        let costSourceType: 'real' | 'estimated' | 'missing' = 'missing';
        if (productCosts && skuKey && productCosts[skuKey] !== undefined && productCosts[skuKey] > 0) {
          rawCost = productCosts[skuKey]; costSourceType = 'real';
        } else if (productCosts && productId2 !== '-' && productCosts[productId2] !== undefined && productCosts[productId2] > 0) {
          rawCost = productCosts[productId2]; costSourceType = 'real';
        } else if (productCosts && productCode && productCode !== '-' && productCosts[productCode] !== undefined && productCosts[productCode] > 0) {
          rawCost = productCosts[productCode]; costSourceType = 'real';
        } else if (defaultCostRatio && defaultCostRatio > 0) {
          rawCost = productTotal * (defaultCostRatio / 100); costSourceType = 'estimated';
        }
        const productCost = rawCost * qty;

        // 运费险数据
        const insurance = currentDisplayData?.shippingInsurance || [];
        const insRecord = insurance.find((r: any) => {
          const rno = String(findField(r, '订单编号', '订单号') || '');
          return rno && rno === orderNo;
        });
        const insFeeFromActuals = getBestInsuranceFee(orderNo, 0, orderFinancialActuals);
        const insFeeFromRecord = insRecord ? safeFloat(findField(insRecord, '服务费用（元）', '服务费用(元)', '服务费用', '保费（元）', '保费(元)', '保费')) : 0;
        const insFee = insFeeFromActuals > 0 ? insFeeFromActuals : insFeeFromRecord;
        const insStatus = insRecord ? String(findField(insRecord, '理赔状态', '运费补偿状态', '补偿状态') || '-') : '-';
        const insChargeStatus = insRecord ? String(findField(insRecord, '收费状态') || '-') : '-';

        // 推广费用估算（按商品ID + 日期匹配）
        const promoProducts = currentDisplayData?.promotionProducts || [];
        let promoCost = 0;
        let promoMatchInfo = '';
        if (productId !== '-' && payDate) {
          const matchingPromos = promoProducts.filter((r: any) => {
            const pid = String(findField(r, '商品ID', '商品id') || '');
            const pd = String(findField(r, '日期') || '').trim();
            return pid === productId && pd === payDate;
          });
          if (matchingPromos.length > 0) {
            promoCost = matchingPromos.reduce((s: number, r: any) => s + safeFloat(findField(r, '花费(元)', '总花费(元)', '成交花费(元)')), 0);
            // 当天该商品订单数，用于分摊
            const sameDayOrders = (currentDisplayData?.orders || []).filter((ord: any) => {
                const oD = String(findField(ord, '支付时间') || '').split(' ')[0];
                const oPid = String(findField(ord, '商品id', '商品ID') || '');
                return oD === payDate && oPid === productId;
              }).length;
            const shareCount = sameDayOrders > 0 ? sameDayOrders : 1;
            promoCost = promoCost / shareCount;
            promoMatchInfo = `当日该商品${shareCount}单，推广费${promoCost.toFixed(2)}/单`;
          }
        }

        // 平台服务费：优先直接字段，否则用 用户实付-商家实收 的差额（商家实收已扣除平台费）
        const techServiceFeeDirect = fn(['平台技术服务费(元)', '技术服务费(元)', '技术服务费']);
        const platformFee = techServiceFeeDirect > 0 ? techServiceFeeDirect : Math.max(0, userPaid - merchantReceived);

        // 配置固定费用（与 ProductLinkStats 同步）
        const packagingFee = packagingFeePerOrder || 0;
        const shippingFeePerOrderCost = shippingFeePerOrder || 0;
        const laborFee = laborFeePerOrder || 0;
        const platformCommission = getBestPlatformFee(orderNo, userPaid, platformCommissionRate, orderFinancialActuals);

        // 明星店铺 & 直播推广分摊（按订单日期 + 商品当日 GMV 占比）
        let starLivePromoCost = 0;
        let starLiveMatchInfo = '';
        if (payDate) {
          const allOrders = currentDisplayData?.orders || [];
          const dayOrders = allOrders.filter((ord: any) => {
            const oD = String(findField(ord, '支付时间') || '').split(' ')[0];
            return oD === payDate;
          });
          const dayTotalGmv = dayOrders.reduce((s: number, ord: any) => {
            const ap = safeFloat(findField(ord, '用户实付金额(元)', '用户实付', '实付金额'));
            const pt = safeFloat(findField(ord, '商品总价(元)', '商品总价'));
            return s + (ap || pt);
          }, 0);
          if (dayTotalGmv > 0) {
            const productDayGmv = dayOrders
              .filter((ord: any) => String(findField(ord, '商品id', '商品ID') || '') === productId2)
              .reduce((s: number, ord: any) => {
                const ap = safeFloat(findField(ord, '用户实付金额(元)', '用户实付', '实付金额'));
                const pt = safeFloat(findField(ord, '商品总价(元)', '商品总价'));
                return s + (ap || pt);
              }, 0);
            const gmvRatio = productDayGmv / dayTotalGmv;
            const starStoreSummary = currentDisplayData?.starStoreSummary || [];
            const dayStarRows = starStoreSummary.filter((r: any) =>
              String(findField(r, '日期') || '').trim() === payDate);
            const dayStarCost = dayStarRows.reduce((s: number, r: any) =>
              s + safeFloat(findField(r, '花费(元)', '总花费(元)')), 0);
            const starAlloc = dayStarCost * gmvRatio;
            const liveStreamSummary = currentDisplayData?.liveStreamSummary || [];
            const dayLiveRows = liveStreamSummary.filter((r: any) =>
              String(findField(r, '日期') || '').trim() === payDate);
            const dayLiveCost = dayLiveRows.reduce((s: number, r: any) =>
              s + safeFloat(findField(r, '总花费(元)', '花费(元)')), 0);
            const liveAlloc = dayLiveCost * gmvRatio;
            starLivePromoCost = starAlloc + liveAlloc;
            if (starLivePromoCost > 0) {
              starLiveMatchInfo = `明星店铺¥${starAlloc.toFixed(2)} + 直播¥${liveAlloc.toFixed(2)}`;
            }
          }
        }
        const totalPromoCost = promoCost + starLivePromoCost;

        // 税费计算（单订单适配 ProductLinkStats 税务引擎）
        const taxDetails: { name: string; amount: number; rate: number; base: number }[] = [];
        let totalTax = 0;
        let vatAmount = 0;
        const preTaxProfitForTax = merchantReceived - productCost - totalPromoCost - packagingFee - shippingFeePerOrderCost - laborFee;
        if (taxConfigs && taxConfigs.length > 0) {
          const enabledTaxes = taxConfigs.filter((t: any) => t.enabled);
          enabledTaxes.filter((t: any) => t.taxType !== 'surcharge').forEach((tax: any) => {
            let base = 0;
            switch (tax.base) {
              case 'revenue': base = merchantReceived; break;
              case 'profit': base = preTaxProfitForTax; break;
              case 'gmv': base = userPaid; break;
              case 'orders': base = 1; break;
              default: base = merchantReceived;
            }
            const amount = Math.max(0, base * (tax.rate / 100));
            if (tax.taxType === 'vat') vatAmount = amount;
            taxDetails.push({ name: tax.name, amount, rate: tax.rate, base });
            totalTax += amount;
          });
          enabledTaxes.filter((t: any) => t.taxType === 'surcharge').forEach((tax: any) => {
            const amount = Math.max(0, vatAmount * (tax.rate / 100));
            taxDetails.push({ name: tax.name, amount, rate: tax.rate, base: vatAmount });
            totalTax += amount;
          });
        }

        // 公式扣费（单订单适配 ProductLinkStats 公式引擎）
        const formulaDeductionDetails: { name: string; amount: number; formula: string }[] = [];
        let totalFormulaDeductions = 0;
        if (customDeductions && customDeductions.length > 0) {
          const formulaCtx: FormulaContext = {
            gmv: userPaid, revenue: merchantReceived, orders: 1, sales: qty,
            productCost, packagingFee, shippingFee: shippingFeePerOrderCost,
            promoCost: totalPromoCost, discount: shopDiscount + platDiscount + payDiscount + pddCoupon,
            profit: preTaxProfitForTax - totalTax, grossProfit: merchantReceived - totalPromoCost - packagingFee - shippingFeePerOrderCost,
            netProfit: preTaxProfitForTax - totalTax, refund: 0, refundRate: 0,
            afterSaleCount: 0, afterSaleRate: 0, promoOrders: 0, promoTransaction: 0,
            promoClicks: 0, promoImpressions: 0, ctr: 0, cvr: 0, roi: 0,
            avgOrderValue: userPaid, activeDays: 1, avgDailySales: qty,
            platformFee: 0, taxes: totalTax
          };
          const sorted = [...customDeductions]
            .filter((d: any) => d.enabled)
            .sort((a: any, b: any) => a.sortOrder - b.sortOrder);
          sorted.forEach((ded: any) => {
            if (ded.scope === 'product' && ded.scopeTarget && ded.scopeTarget !== productId2) return;
            const today = new Date().toISOString().slice(0, 10);
            if (ded.effectiveFrom && today < ded.effectiveFrom) return;
            if (ded.effectiveTo && today > ded.effectiveTo) return;
            if (ded.condition) { const cr = evaluateFormula(ded.condition, formulaCtx); if (!cr) return; }
            const amount = evaluateFormula(ded.formula, formulaCtx);
            formulaDeductionDetails.push({ name: ded.name, amount, formula: ded.formula });
            totalFormulaDeductions += amount;
          });
        }

        // 自定义费用（手动）
        const customCosts = orderCustomCosts[orderNo] || [];
        const customTotal = customCosts.reduce((s, c) => s + (c.amount || 0), 0);

        const penaltyFees = getPenaltyFees(orderNo, orderFinancialActuals);
        const marketingFees = getMarketingFees(orderNo, orderFinancialActuals);
        const subTechFee = orderFinancialActuals[orderNo]?.subTechFee ?? 0;

        // 费用合计（与 ProductLinkStats 计算模型一致）
        // 注意：商家实收已扣平台费，totalCosts 不含 platformCommission
        const totalCosts =
          productCost + packagingFee + shippingFeePerOrderCost + laborFee +
          postage + insFee + totalPromoCost +
          installFee + deliverFee1 + deliverFee2 +
          totalTax + totalFormulaDeductions + customTotal + penaltyFees + marketingFees;
        const netProfit = merchantReceived - totalCosts;
        const profitRate = merchantReceived > 0 ? (netProfit / merchantReceived) * 100 : 0;
        const grossProfit = merchantReceived - totalPromoCost - packagingFee - shippingFeePerOrderCost;
        const preTaxProfit = merchantReceived - productCost - totalPromoCost - packagingFee - shippingFeePerOrderCost - laborFee;

        // 可信度评估
        let profitConfidence: 'high' | 'medium' | 'low' = 'low';
        if (costSourceType === 'real') {
          profitConfidence = totalPromoCost > 0 ? 'high' : 'medium';
        } else if (costSourceType === 'estimated') {
          profitConfidence = 'medium';
        }
        const confidenceLabel = { high: '高可信', medium: '中可信', low: '低可信' }[profitConfidence];
        const confidenceColor = profitConfidence === 'high' ? 'text-pdd-success' : profitConfidence === 'medium' ? 'text-pdd-warning' : 'text-pdd-danger';

        const updateCustomCost = (idx: number, field: 'name' | 'amount', value: string | number) => {
          const costs = [...customCosts];
          if (!costs[idx]) costs[idx] = { name: '', amount: 0 };
          costs[idx] = { ...costs[idx], [field]: field === 'amount' ? (parseFloat(value as string) || 0) : value };
          const next = { ...orderCustomCosts, [orderNo]: costs.filter(c => c.name || c.amount) };
          setOrderCustomCosts(next);
          localStorage.setItem('dianfx_order_custom_costs', JSON.stringify(next));
        };
        const addCustomCost = () => {
          const costs = [...customCosts, { name: '', amount: 0 }];
          setOrderCustomCosts({ ...orderCustomCosts, [orderNo]: costs });
        };

        const CostRow = ({ label, value, color }: { label: string; value: string; color?: string }) => (
          <div className="flex justify-between text-xs py-1 border-b border-[var(--pdd-gray-100)]">
            <span className="text-pdd-text-secondary">{label}</span>
            <span className={color || 'text-pdd-text'}>{value}</span>
          </div>
        );

        const sections = [
          { title: '基本信息', rows: [
            ['订单号', orderNo], ['订单状态', fv(['订单状态', '状态'])],
            ['支付时间', fv(['支付时间'])], ['发货时间', fv(['发货时间'])],
            ['确认收货时间', fv(['确认收货时间'])], ['订单成交时间', fv(['订单成交时间'])],
            ['承诺发货时间', fv(['承诺发货时间'])],
          ]},
          { title: '商品信息', rows: [
            ['商品名称', fv(['商品', '商品名称'])], ['商品ID', productId],
            ['商品规格', fv(['商品规格'])], ['样式ID', fv(['样式ID'])],
            ['一级类目', fv(['商品一级类目', '一级类目'])], ['二级类目', fv(['商品二级类目', '二级类目'])],
            ['三级类目', fv(['商品三级类目', '三级类目'])], ['四级类目', fv(['商品四级类目', '四级类目'])],
            ['商品数量', fv(['商品数量(件)', '商品数量', '数量'])],
            ['商家编码(规格)', fv(['商家编码-规格维度', '商家编码'])],
            ['商家编码(商品)', fv(['商家编码-商品维度'])],
          ]},
          { title: '金额明细', rows: [
            ['商品总价（原价）', `¥${productTotal.toFixed(2)}`],
            ...(shopDiscount > 0 ? [['店铺优惠折扣', <span className="text-pdd-danger">-¥{shopDiscount.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(platDiscount > 0 ? [['平台优惠折扣', <span className="text-pdd-danger">-¥{platDiscount.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(payDiscount > 0 ? [['多多支付立减', <span className="text-pdd-danger">-¥{payDiscount.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(pddCoupon > 0 ? [['拼多多优惠券', <span className="text-pdd-danger">-¥{pddCoupon.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ['用户实付金额', <span className="font-semibold" style={{color: 'var(--pdd-primary)'}}>¥{userPaid.toFixed(2)}</span>],
            ...(platformFee > 0 ? [['平台服务费', <span className="text-pdd-danger">-¥{platformFee.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ['商家实收金额', <span className="text-pdd-primary-light font-semibold">¥{merchantReceived.toFixed(2)}</span>],
          ]},
          { title: '商品成本', rows: [
            ['裸货成本', <span className="text-pdd-danger">-¥{productCost.toFixed(2)}</span>],
            ...(productCost > 0 ? [['计算方式', <span className={`text-[10px] ${costSourceType === 'real' ? 'text-pdd-success' : 'text-pdd-warning'}`}>{costSourceType === 'real' ? `真实成本 ¥${rawCost.toFixed(2)}/件 × ${qty}件` : `估算(默认比例${defaultCostRatio}%)`}</span>]] as [string, React.ReactNode][] : []),
            ...(costSourceType === 'missing' ? [['状态', <span className="text-pdd-danger text-[10px]">未配置，请在成本管理填写</span>]] as [string, React.ReactNode][] : []),
          ]},
          { title: '固定费用(配置)', rows: [
            ...(packagingFee > 0 ? [['包装费', `-¥${packagingFee.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(shippingFeePerOrderCost > 0 ? [['快递费(配置)', `-¥${shippingFeePerOrderCost.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(laborFee > 0 ? [['人工费', `-¥${laborFee.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(platformCommission > 0 ? [['平台佣金', `-¥${platformCommission.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(subTechFee > 0 ? [['百亿补贴技术服务费', <span className="text-pdd-danger font-medium">-¥{subTechFee.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(packagingFee + shippingFeePerOrderCost + laborFee + platformCommission + subTechFee === 0 ? [['状态', <span className="text-pdd-text-secondary text-[10px]">未配置，请在成本管理设置</span>]] as [string, React.ReactNode][] : []),
          ]},
          { title: '物流费用(实际)', rows: [
            ['邮费', `-¥${postage.toFixed(2)}`],
            ...(installFee > 0 ? [['上门安装费', `-¥${installFee.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(deliverFee1 > 0 ? [['送货入户费', `-¥${deliverFee1.toFixed(2)}`]] as [string, React.ReactNode][] : []),
            ...(deliverFee2 > 0 ? [['送货入户并安装费', `-¥${deliverFee2.toFixed(2)}`]] as [string, React.ReactNode][] : []),
          ]},
          { title: '营销费用', rows: [
            ...(promoCost > 0 ? [['推广费(商品)', <span className="text-pdd-danger">-¥{promoCost.toFixed(2)}</span>]] as [string, React.ReactNode][] : (promoMatchInfo ? [['推广费(商品)', promoMatchInfo]] as [string, React.ReactNode][] : [])),
            ...(starLivePromoCost > 0 ? [['推广费(明星+直播)', <span className="text-pdd-danger">-¥{starLivePromoCost.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(starLiveMatchInfo && starLivePromoCost > 0 ? [['分摊明细', <span className="text-[10px] text-pdd-text-secondary">{starLiveMatchInfo}</span>]] as [string, React.ReactNode][] : []),
            ['运费险', insFee > 0 ? <span className="text-pdd-danger">-¥{insFee.toFixed(2)}</span> : '未参保'],
            ...(penaltyFees > 0 ? [['罚款/扣款', <span className="text-pdd-danger font-medium">-¥{penaltyFees.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
            ...(marketingFees > 0 ? [['营销费用(实际)', <span className="text-pdd-danger font-medium">-¥{marketingFees.toFixed(2)}</span>]] as [string, React.ReactNode][] : []),
          ]},
          ...(taxDetails.length > 0 ? [{ title: '税费', rows: [
            ...taxDetails.filter((t: any) => t.amount > 0).map((t: any) => [`${t.name}(${t.rate}%)`, <span className="text-pdd-danger">-¥{t.amount.toFixed(2)}</span>] as [string, React.ReactNode]),
            ['税费合计', <span className="font-semibold text-pdd-danger">-¥{totalTax.toFixed(2)}</span>],
          ] as [string, React.ReactNode][] }] : []),
          ...(formulaDeductionDetails.length > 0 ? [{ title: '公式扣费', rows: [
            ...formulaDeductionDetails.filter((d: any) => d.amount !== 0).map((d: any) => [d.name, <span className="text-pdd-danger">-¥{d.amount.toFixed(2)}</span>] as [string, React.ReactNode]),
            ['公式扣费合计', <span className="font-semibold text-pdd-danger">-¥{totalFormulaDeductions.toFixed(2)}</span>],
          ] as [string, React.ReactNode][] }] : []),
          { title: '手动费用', rows: customCosts.length > 0 ? [
            ...customCosts.map((c, i) => [c.name || `自定义费用${i + 1}`, <span className="text-pdd-danger">-¥{(c.amount || 0).toFixed(2)}</span>] as [string, React.ReactNode]),
          ] : [['状态', <span className="text-pdd-text-secondary text-[10px]">未添加手动扣费</span>]] },
          { title: '费用合计', rows: [
            ['费用总计', <span className="font-semibold text-pdd-danger">-¥{totalCosts.toFixed(2)}</span>],
          ]},
          { title: '利润分析', rows: [
            ['商家实收', `¥${merchantReceived.toFixed(2)}`],
            ['- 费用合计', `-¥${totalCosts.toFixed(2)}`],
            ['= 净利润', <span className={`text-sm font-bold ${netProfit >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>¥{netProfit.toFixed(2)}</span>],
            ['利润率', <span className={`font-semibold ${profitRate >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>{profitRate.toFixed(2)}%</span>],
            ['毛利(实收-推广-包装-快递)', <span className={`text-xs ${grossProfit >= 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>¥{grossProfit.toFixed(2)}</span>],
          ]},
          { title: '运费险详情', rows: insRecord ? [
            ['服务费用', `¥${insFee.toFixed(2)}`],
            ['收费状态', insChargeStatus],
            ['理赔/补偿状态', insStatus],
            ['收费编号', fvCall(insRecord, ['收费编号'])],
          ] : [['状态', '此订单未参保运费险']] },
          { title: '物流信息', rows: [
            ['快递公司', fv(['快递公司'])], ['快递单号', fv(['快递单号'])],
            ['省', fv(['省', '省份'])], ['市', fv(['市'])], ['区', fv(['区'])],
            ['街道/镇', fv(['街道/镇', '街道', '镇'])],
            ['配送状态', fv(['配送状态'])],
          ]},
          { title: '其他信息', rows: [
            ['售后状态', fv(['售后状态'])], ['订单来源', fv(['订单来源'])],
            ['是否直播间成交', fv(['是否直播间成交'])], ['是否直播间引导成交', fv(['是否直播间引导成交'])],
            ['是否门店自提', fv(['是否门店自提'])], ['门店名称', fv(['门店名称'])],
            ['支付方式', fv(['支付方式', '支付ID'])], ['是否分期', fv(['是否分期'])],
            ['分期期数', fv(['分期期数'])], ['手续费承担方', fv(['手续费承担方'])],
            ['是否顺丰加价', fv(['是否顺丰加价'])], ['是否抽奖/0元试用', fv(['是否抽奖或0元试用', '是否抽奖'])],
            ['是否社区团购', fv(['是否社区团购'])], ['是否无痕发货', fv(['是否无痕发货'])],
            ['是否节能补贴', fv(['是否节能补贴'])], ['买家留言', fv(['买家留言'])],
            ['商家备注', fv(['商家备注'])], ['集运类型', fv(['集运类型'])],
            ['订单来源', fv(['订单来源'])],
          ]},
        ];

        // 辅助函数：从任意对象查找字段
        function fvCall(row: any, labels: string[]) { return labels.map(l => findField(row, l)).find(v => v != null && String(v).trim() !== '') || '-'; }

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-4 pb-4" onClick={() => setOrderDetail(null)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-pdd-card rounded-xl border border-pdd-border shadow-2xl w-full max-w-lg max-h-full overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-pdd-border flex-shrink-0 bg-gradient-to-r from-gray-50 to-white">
                <div>
                  <h2 className="text-sm font-bold text-pdd-text">订单详情</h2>
                  <p className="text-[10px] text-pdd-text-secondary font-mono">{orderNo}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${netProfit >= 0 ? 'bg-pdd-success/20 text-pdd-success' : 'bg-pdd-danger/20 text-pdd-danger'}`}>
                    {netProfit >= 0 ? '盈利' : '亏损'} ¥{Math.abs(netProfit).toFixed(2)} · {confidenceLabel}
                  </span>
                  <button onClick={() => setOrderDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--pdd-gray-200)] text-pdd-text-secondary hover:text-pdd-text transition-colors">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
              <div className="overflow-y-auto px-4 py-3 space-y-3 flex-1">
                {sections.map((sec, si) => (
                  <div key={si}>
                    <h3 className="text-[11px] font-semibold text-pdd-primary-light mb-1.5 border-b border-pdd-border pb-0.5">{sec.title}</h3>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0">
                      {sec.rows.map(([label, value], ri) => (
                        <div key={ri} className="flex justify-between text-[11px] py-0.5 border-b border-[var(--pdd-gray-100)]">
                          <span className="text-pdd-text-secondary flex-shrink-0">{label}</span>
                          <span className="text-pdd-text text-right ml-2 truncate max-w-[160px]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* 自定义费用编辑区 */}
                <div>
                  <h3 className="text-[11px] font-semibold text-pdd-primary-light mb-1.5 border-b border-pdd-border pb-0.5 flex items-center justify-between">
                    自定义费用
                    <button onClick={addCustomCost} className="text-[10px] px-1.5 py-0.5 rounded bg-pdd-primary/10 text-pdd-primary-light hover:bg-pdd-primary/20">+添加</button>
                  </h3>
                  {(customCosts.length === 0 ? [{ name: '', amount: 0 }] : customCosts).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <input type="text" placeholder="名称" value={c.name} onChange={e => updateCustomCost(i, 'name', e.target.value)}
                        className="flex-1 text-[11px] px-1.5 py-1 rounded border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary-light" />
                      <input type="number" placeholder="金额" step="0.01" value={c.amount || ''} onChange={e => updateCustomCost(i, 'amount', e.target.value)}
                        className="w-20 text-[11px] px-1.5 py-1 rounded border border-pdd-border bg-pdd-bg text-pdd-text text-right outline-none focus:border-pdd-primary-light" />
                      <span className="text-[10px] text-pdd-text-secondary w-14 text-right">-¥{(c.amount || 0).toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

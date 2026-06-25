import React, { useMemo, useState, useEffect } from 'react';
import { TrendingUp, ShoppingCart, DollarSign, AlertTriangle, RotateCcw, Package, Users, Clock, Truck, Tag, BarChart3, Download, FileSpreadsheet, RefreshCw, Target, Megaphone, Percent, Mail, Database, X, Shield, Eye, MousePointerClick, MessageCircle, Heart, UserPlus } from 'lucide-react';
import { useData } from '../App';
import { findField, safeField } from '../utils/fieldAccess';
import { getBestPlatformFee, getBestInsuranceFee, getPenaltyFees, getMarketingFees } from '../utils/financialActuals';
import TimeFilter, { useTimeFilter, TimeRange, TimeGranularity, safeFloat, filterByTimeRange, filterPromoByTimeRange, getCompareOrders } from '../components/TimeFilter';
import { UnifiedFilterBar } from '../components/FilterToolbar';
import { evaluateFormula, FormulaContext } from '../utils/formulaEngine';
import { buildTrendData, buildCompareTrendData } from '../utils/trendData';
import { computeAllKpis, UnifiedKpis } from '../utils/computeKpis';
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
    return new Set(['merchantReceived', 'orderCount', 'promoCost', 'profit']);
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
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [orderCustomCosts, setOrderCustomCosts] = useState<Record<string, { name: string; amount: number }[]>>(() => {
    try { const s = localStorage.getItem('dianfx_order_custom_costs'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [visibleKpis, setVisibleKpis] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_visible_kpis');
      if (saved) { const arr = JSON.parse(saved); if (Array.isArray(arr) && arr.length > 0) return new Set(arr); }
    } catch {}
    // 默认 28 个核心指标，其他在"指标"面板里选
    return new Set([
      '商家实收', '客单价', '有效订单量', '退款金额',
      '退款单数', '转化率', '推广花费', 'GMV（商品总价）',
      '推广ROI', '推广订单量', '平均订单花费', '利润金额',
      'SKU数量', '退款金额(按同意退款时间)', '退款单数(按同意退款时间)', '退款成功快递发货成本', '退货退回成本',
      '净GMV(GMV-退款)', '单均GMV', '单均实收', '净利润率', '毛利率',
      '推广费用率', '推广订单占比', '退款侵蚀率', '毛利润', '总运营成本',
      '点击转化率', '千次曝光成本', '人均订单数', '每单件数'
    ]);
  });
  const [kpiCardOrder, setKpiCardOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dianfx_kpi_card_order');
    if (saved) {
      try { const parsed = JSON.parse(saved); if (Array.isArray(parsed) && parsed.length > 0) return parsed; } catch {}
    }
    // 首次访问：与默认 visibleKpis 顺序一致
    return ['商家实收', '客单价', '有效订单量', '退款金额',
      '退款单数', '转化率', '推广花费', 'GMV（商品总价）',
      '推广ROI', '推广订单量', '平均订单花费', '利润金额',
      '净GMV(GMV-退款)', '单均GMV', '单均实收', '净利润率', '毛利率',
      '推广费用率', '推广订单占比', '退款侵蚀率', '毛利润', '总运营成本',
      '点击转化率', '千次曝光成本', '人均订单数', '每单件数'];
  });
  const [showKpiSelector, setShowKpiSelector] = useState(false);
  // KPI 卡片格式化函数（不四舍五入，有小数点保留2位）
  const _money = (v: number) => `¥${v.toFixed(2)}`;
  const _pct = (v: number) => `${v.toFixed(2)}%`;
  const _int = (v: number) => `${Math.trunc(v)}`;
  const _ratio = (v: number) => v.toFixed(2);

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
    return currentDisplayData.orders.filter((o: any) => {
      const st = String(findField(o, '订单状态', '状态') || '').trim();
      // ★ 排除未付款/已取消等无效订单
      if (['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st)) return false;
      return true;
    });
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

  // ── 统一 KPI 计算容器（移到 filteredPromo* 变量之后） ──
  // 见下方 kpiDateRange / kpiValues 定义

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

  // ── 统一 KPI 计算容器 ────────────────────────────────
  const todayStr = () => new Date().toISOString().split('T')[0];
  const kpiDateRange = useMemo(() => {
    let asStart = '', asEnd = '';
    if (timeRange === 'custom') {
      if (quickRange) {
        const now = new Date();
        if (quickRange === 'last7') { asEnd = todayStr(); const d = new Date(now); d.setDate(d.getDate()-6); asStart = d.toISOString().split('T')[0]; }
        else if (quickRange === 'last30') { asEnd = todayStr(); const d = new Date(now); d.setDate(d.getDate()-29); asStart = d.toISOString().split('T')[0]; }
        else if (quickRange === 'thisMonth') { asStart = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-01'; asEnd = todayStr(); }
        else if (quickRange === 'lastMonth') { const d = new Date(now); d.setMonth(d.getMonth()-1); asStart = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-01'; asEnd = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().split('T')[0]; }
        else if (quickRange === 'thisYear') { asStart = now.getFullYear()+'-01-01'; asEnd = todayStr(); }
      } else if (customStart) {
        asStart = customStart; asEnd = customEnd || customStart;
      }
    } else if (timeRange !== 'all') {
      const days = parseInt(timeRange);
      if (!isNaN(days) && days > 0) {
        asEnd = todayStr();
        const d = new Date(); d.setDate(d.getDate() - (days - 1));
        asStart = d.toISOString().split('T')[0];
      }
    }
    return { asStart, asEnd };
  }, [timeRange, quickRange, customStart, customEnd]);

  const kpiValues = useMemo(() => {
    if (!filteredOrders.length) return null;
    // ★ 从 filteredOrders 提取订单号集合，用此过滤售后/财务/保险（保证与筛选日期一致）
    const orderNoSet = new Set(filteredOrders.map((o: any) => String(findField(o, '订单号') || '').trim()).filter(Boolean));
    const { asStart, asEnd } = kpiDateRange;
    const afterSales = (currentDisplayData?.afterSaleRecords || []).filter((r: any) => {
      const rNo = String(r['订单编号'] || r['订单号'] || '').trim();
      return rNo && orderNoSet.has(rNo);
    });
    const financialRecords = (currentDisplayData?.financialRecords || []).filter((r: any) => {
      const rOrderNo = String(r['商户订单号'] || r['订单号'] || '').trim();
      const rDate = String(r['发生时间'] || '').trim().split(' ')[0];
      if (rOrderNo && orderNoSet.has(rOrderNo)) return true;
      if (rDate && asStart && rDate >= asStart && (!asEnd || rDate <= asEnd)) return true;
      return false;
    });
    const insuranceRecords = (currentDisplayData?.shippingInsurance || []).filter((r: any) => {
      const rNo = String(r['订单编号'] || r['订单号'] || '').trim();
      return rNo && orderNoSet.has(rNo);
    });
    const promoRecords = filteredPromoSummary.length > 0 ? filteredPromoSummary : (filteredPromoProducts || []);
    const starRecords = filteredStarSummary || [];
    const liveRecords = filteredLiveSummary || [];

    console.error('[KPI] filteredPromoProducts count:', filteredPromoProducts.length, 'first row keys:', filteredPromoProducts.length > 0 ? Object.keys(filteredPromoProducts[0]).slice(0, 10) : 'none');
    const result = computeAllKpis({
      orders: filteredOrders,
      afterSales,
      promoRecords,
      promoDetailRecords: filteredPromoProducts.length > 0 ? filteredPromoProducts : undefined,
      starRecords,
      liveRecords,
      financialRecords,
      insuranceRecords,
      config: {
        shippingFeePerOrder: shippingFeePerOrder || 4,
        returnShippingFeePerOrder: 10,
        insuranceFeePerOrder: insuranceFeePerOrder || undefined,
      },
      approvalDateStart: asStart || undefined,
      approvalDateEnd: asEnd || undefined,
      allAfterSaleRecords: currentDisplayData?.afterSaleRecords || undefined,
    });
    console.error('[KPI] result inquiryCost:', result.inquiryCost, 'favoriteCost:', result.favoriteCost, 'followCost:', result.followCost);
    return result;
  }, [filteredOrders, currentDisplayData,
      filteredPromoSummary, filteredPromoProducts, filteredStarSummary, filteredLiveSummary,
      kpiDateRange, shippingFeePerOrder, insuranceFeePerOrder]);

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
  const dailyKpiData = useMemo(() => buildTrendData(
    filteredOrders,
    filteredPromoSummary.length > 0 ? filteredPromoSummary : filteredPromoProducts,
    granularity,
    filteredStarSummary,
    filteredLiveSummary,
    currentDisplayData?.afterSaleRecords,
    shippingFeePerOrder || 4,
    10,
    insuranceFeePerOrder || undefined,
    currentDisplayData?.financialRecords,
    filteredPromoProducts.length > 0 ? filteredPromoProducts : undefined,
  ), [filteredOrders, filteredPromoSummary, filteredPromoProducts, filteredStarSummary, filteredLiveSummary, granularity, currentDisplayData?.afterSaleRecords, currentDisplayData?.financialRecords, shippingFeePerOrder, insuranceFeePerOrder]);

  const compareDailyKpiData = useMemo(() => {
    if (!compareEnabled || !compareOrders.length) return [];
    return buildCompareTrendData(compareOrders, granularity, currentDisplayData?.afterSaleRecords);
  }, [compareOrders, compareEnabled, granularity, currentDisplayData?.afterSaleRecords]);

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

  // ── 所有 KPI 统一从 kpiValues 读取 ──────────────────
      const allKpiCards = [
{ label: '平均退款额', value: kpiValues && kpiValues.rfCnt > 0 && kpiValues.rfAmount != null ? kpiValues.rfAmount / kpiValues.rfCnt : undefined, fmt: _money, icon: RotateCcw, change: null, source: '退款金额/退款单数' },
    { label: '总询单成本', value: kpiValues?.inquiryCost ?? 0, fmt: _money, icon: MessageCircle, change: null, source: '推广明细-询单花费 SUM' },
    { label: '总收藏成本', value: kpiValues?.favoriteCost ?? 0, fmt: _money, icon: Heart, change: null, source: '推广明细-收藏花费 SUM' },
    { label: '总关注成本', value: kpiValues?.followCost ?? 0, fmt: _money, icon: UserPlus, change: null, source: '推广明细-关注花费 SUM' },
    { label: '毛利率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.platformFee != null && kpiValues.postage != null && kpiValues.insuranceFee != null ? (kpiValues.merchantReceived - kpiValues.platformFee - kpiValues.postage - kpiValues.insuranceFee) / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '(商家实收-平台费-快递-运费险)/商家实收' },
    { label: '净利润率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.profit != null ? kpiValues.profit / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '利润金额/商家实收' },
    { label: '单均利润', value: kpiValues && kpiValues.cnt > 0 && kpiValues.profit != null ? kpiValues.profit / kpiValues.cnt : undefined, fmt: _money, icon: TrendingUp, change: null, source: '利润金额/有效订单量' },
    { label: '推广费用率', value: kpiValues && kpiValues.gmv > 0 && kpiValues.promoCost != null ? kpiValues.promoCost / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '推广花费/GMV' },
    { label: 'GMV（商品总价）', value: kpiValues?.gmv, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, change: compareEnabled ? changePct(kpiValues?.gmv || 0, compareKpi?.gmv || 0) : null, source: '订单·商品总价(元) SUM' },
    { label: '有效订单量', value: kpiValues?.cnt, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, change: compareEnabled ? changePct(kpiValues?.cnt || 0, compareKpi?.cnt || 0) : null, source: '订单·COUNT 排除已取消' },
    { label: '商家实收', value: kpiValues?.merchantReceived, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, change: null, source: '订单·商家实收金额(元) SUM' },
    { label: '用户实付', value: kpiValues?.paid, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, change: null, source: '订单·用户实付金额(元) SUM' },
    { label: '客单价', value: kpiValues?.avg, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: TrendingUp, change: compareEnabled ? changePct(kpiValues?.avg || 0, compareKpi?.avg || 0) : null, source: '用户实付 ÷ 订单数' },
    { label: '利润金额', value: kpiValues?.profit, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, change: null, source: '实收−退款−推广−运费险−罚款' },
    { label: '退款金额(按同意退款时间)', value: kpiValues?.refundApprovalAmount ?? 0, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: RotateCcw, change: null, source: '售后记录·同意退款时间金额 SUM' },
    { label: '退款金额', value: kpiValues?.rfAmount, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: RotateCcw, change: null, source: '订单·退款金额(元) SUM' },
    { label: '退款单数', value: kpiValues?.rfCnt, fmt: (v: number) => v.toFixed(0), icon: RotateCcw, change: null, source: '订单·售后状态含退款 COUNT' },

    { label: '退款单数(按同意退款时间)', value: kpiValues?.refundApprovalOrders ?? 0, fmt: (v: number) => v.toFixed(0), icon: RotateCcw, change: null, source: '售后记录·同意退款时间 COUNT' },
    { label: '退款成功快递发货成本', value: kpiValues?.refundedShippingCost ?? 0, fmt: (v: number) => '¥' + v.toFixed(2), icon: Truck, change: null, source: '退款成功订单数 × 每单快递费' },
    { label: '退货退回成本', value: kpiValues?.returnShippingCost ?? 0, fmt: (v: number) => '¥' + v.toFixed(2), icon: RotateCcw, change: null, source: '退货退款单数 × 每单退货费(¥10)' },
    { label: '退款率', value: kpiValues?.rfRate, fmt: (v: number) => `${v.toFixed(2)}%`, icon: RotateCcw, change: null, source: '订单·售后状态含退款 / 订单数' },
    { label: '售后率', value: kpiValues?.asRate, fmt: (v: number) => `${v.toFixed(2)}%`, icon: AlertTriangle, change: null, source: '售后记录 ÷ 订单数' },
    { label: '自然单', value: kpiValues?.organicOrders, fmt: (v: number) => v.toFixed(0), icon: TrendingUp, change: null, source: '总订单 − 推广订单' },
    { label: '自然销售额', value: kpiValues?.organicGmv, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: TrendingUp, change: null, source: '总GMV − 推广GMV' },
    { label: '买家数', value: kpiValues?.buyers ?? 0, fmt: (v: number) => v.toFixed(0), icon: Users, change: null, source: '订单·订单号 DISTINCT COUNT' },
    { label: '商品数', value: kpiValues?.productCount ?? 0, fmt: (v: number) => v.toFixed(0), icon: Package, change: null, source: '订单·商品ID DISTINCT COUNT' },
    { label: 'SKU数量', value: kpiValues?.skuQty ?? 0, fmt: (v: number) => v.toFixed(0), icon: Package, change: null, source: '订单·商品数量(件) SUM' },
    { label: '罚款金额', value: kpiValues?.penalties ?? 0, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: AlertTriangle, change: null, source: '货款明细·004开头账务 SUM' },
    { label: '罚款次数', value: kpiValues?.penaltyCount ?? 0, fmt: (v: number) => v.toFixed(0), icon: AlertTriangle, change: null, source: '货款明细·004开头 COUNT' },
    { label: '优惠总额', value: kpiValues?.discount, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Percent, change: null, source: '订单·店铺+平台+立减+优惠券 SUM' },
    { label: '平均发货时长', value: kpiValues?.avgShipHours, fmt: (v: number) => `${v.toFixed(2)}h`, icon: Clock, change: null, source: '订单·发货时间−支付时间 AVG' },
    { label: '发货率', value: kpiValues?.conversionRate, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Truck, change: null, source: '已发货 ÷ 总订单' },
    { label: '平台服务费', value: kpiValues?.platformFee, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Percent, change: null, source: '订单·平台技术服务费 SUM' },
    { label: '快递成本', value: kpiValues?.postage, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Truck, change: null, source: '订单·邮费(元) SUM' },
    { label: '运费险', value: kpiValues?.insuranceFee, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Shield, change: null, source: '运费险·服务费用 SUM' },
    { label: '推广花费', value: kpiValues?.promoCost, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: BarChart3, change: null, source: '推广·成交花费(元) SUM' },
    { label: '推广GMV', value: kpiValues?.promoGmv, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: TrendingUp, change: null, source: '推广·交易额(元) SUM' },
    { label: '推广ROI', value: kpiValues?.promoRoi, fmt: (v: number) => v.toFixed(2), icon: Target, change: null, source: '推广GMV ÷ 推广花费' },
    { label: '推广订单量', value: kpiValues?.promoOrders, fmt: (v: number) => v.toFixed(0), icon: ShoppingCart, change: null, source: '推广·成交笔数 SUM' },
    { label: '点击率', value: kpiValues?.ctr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, change: null, source: '推广·点击量÷曝光量' },
    { label: '转化率', value: kpiValues?.cvr, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Percent, change: null, source: '推广·成交笔数÷点击量' },
    { label: '平均点击成本', value: kpiValues?.cpc, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: DollarSign, change: null, source: '推广花费 ÷ 点击量' },
    { label: '平均订单花费', value: kpiValues?.cpa, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Users, change: null, source: '推广花费 ÷ 成交笔数' },
    { label: '曝光量', value: kpiValues?.totalImpressions, fmt: (v: number) => v.toFixed(0), icon: Eye, change: null, source: '推广·曝光量 SUM' },
    { label: '点击量', value: kpiValues?.totalClicks, fmt: (v: number) => v.toFixed(0), icon: MousePointerClick, change: null, source: '推广·点击量 SUM' },
    { label: '推广占比', value: kpiValues?.promoRatio ?? 0, fmt: (v: number) => `${v.toFixed(2)}%`, icon: Target, change: null, source: '推广花费 ÷ 总GMV' },
    { label: '全店投产', value: kpiValues?.shopRoi ?? 0, fmt: (v: number) => v.toFixed(2), icon: TrendingUp, change: null, source: '总GMV ÷ 推广花费' },
    { label: '平均询单成本', value: kpiValues?.avgInquiryCost, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: MessageCircle, change: null, source: '推广·询单花费÷询单量' },
    { label: '平均收藏成本', value: kpiValues?.avgFavoriteCost, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: Heart, change: null, source: '推广·收藏花费÷收藏量' },
    { label: '平均关注成本', value: kpiValues?.avgFollowCost, fmt: (v: number) => `¥${v.toFixed(2)}`, icon: UserPlus, change: null, source: '推广·关注花费÷关注量' },

    { label: '净GMV(GMV-退款)', value: kpiValues && kpiValues.gmv != null && kpiValues.rfAmount != null ? Math.max(0, kpiValues.gmv - kpiValues.rfAmount) : undefined, fmt: _money, icon: DollarSign, change: null, source: 'GMV-退款金额(商家实收维度)' },
    { label: '净实收(实收-退款)', value: kpiValues && kpiValues.merchantReceived != null && kpiValues.rfAmount != null ? Math.max(0, kpiValues.merchantReceived - kpiValues.rfAmount) : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收-退款金额(商家实收维度)' },
    { label: '单均GMV', value: kpiValues && kpiValues.cnt > 0 && kpiValues.gmv != null ? kpiValues.gmv / kpiValues.cnt : undefined, fmt: _money, icon: TrendingUp, change: null, source: 'GMV/有效订单量' },
    { label: '单均实收', value: kpiValues && kpiValues.cnt > 0 && kpiValues.merchantReceived != null ? kpiValues.merchantReceived / kpiValues.cnt : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收/有效订单量' },
    { label: '实收/GMV比', value: kpiValues && kpiValues.gmv > 0 && kpiValues.merchantReceived != null ? kpiValues.merchantReceived / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '商家实收/GMV' },
    { label: '实付/GMV比', value: kpiValues && kpiValues.gmv > 0 && kpiValues.paid != null ? kpiValues.paid / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '用户实付/GMV' },
    { label: '自然占比', value: kpiValues && kpiValues.gmv > 0 && kpiValues.organicGmv != null ? kpiValues.organicGmv / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '自然销售额/GMV' },
    { label: '折扣率', value: kpiValues && kpiValues.gmv > 0 && kpiValues.discount != null ? kpiValues.discount / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '优惠总额/GMV' },
    { label: '单均优惠', value: kpiValues && kpiValues.cnt > 0 && kpiValues.discount != null ? kpiValues.discount / kpiValues.cnt : undefined, fmt: _money, icon: Percent, change: null, source: '优惠总额/有效订单量' },
    { label: '人均订单数', value: kpiValues && kpiValues.buyers > 0 && kpiValues.cnt != null ? kpiValues.cnt / kpiValues.buyers : undefined, fmt: _ratio, icon: Users, change: null, source: '有效订单量/买家数' },
    { label: '每单件数', value: kpiValues && kpiValues.cnt > 0 && kpiValues.skuQty != null ? kpiValues.skuQty / kpiValues.cnt : undefined, fmt: _ratio, icon: Package, change: null, source: 'SKU数量/有效订单量' },
{ label: '退款侵蚀率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.rfAmount != null ? kpiValues.rfAmount / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: RotateCcw, change: null, source: '退款金额/商家实收' },
    { label: '同意退款率', value: kpiValues && kpiValues.cnt > 0 && kpiValues.refundApprovalOrders != null ? kpiValues.refundApprovalOrders / kpiValues.cnt * 100 : undefined, fmt: _pct, icon: RotateCcw, change: null, source: '退款单数(按同意退款时间)/有效订单量' },
    { label: '退款后实收', value: kpiValues && kpiValues.merchantReceived != null && kpiValues.rfAmount != null ? kpiValues.merchantReceived - kpiValues.rfAmount : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收-退款金额(商家实收维度)' },
    { label: '退款成本合计', value: (kpiValues?.refundedShippingCost ?? 0) + (kpiValues?.returnShippingCost ?? 0), fmt: _money, icon: Truck, change: null, source: '退款成功快递发货成本+退货退回成本' },
{ label: '毛利润', value: kpiValues && kpiValues.merchantReceived != null && kpiValues.platformFee != null && kpiValues.postage != null && kpiValues.insuranceFee != null ? kpiValues.merchantReceived - kpiValues.platformFee - kpiValues.postage - kpiValues.insuranceFee : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收-平台服务费-快递成本-运费险' },
    { label: '人均利润', value: kpiValues && kpiValues.buyers > 0 && kpiValues.profit != null ? kpiValues.profit / kpiValues.buyers : undefined, fmt: _money, icon: Users, change: null, source: '利润金额/买家数' },
    { label: '单商品利润', value: kpiValues && kpiValues.productCount > 0 && kpiValues.profit != null ? kpiValues.profit / kpiValues.productCount : undefined, fmt: _money, icon: Package, change: null, source: '利润金额/商品数' },
    { label: '单SKU利润', value: kpiValues && kpiValues.skuQty > 0 && kpiValues.profit != null ? kpiValues.profit / kpiValues.skuQty : undefined, fmt: _money, icon: Package, change: null, source: '利润金额/SKU数量' },
    { label: '调整后利润(去罚款)', value: kpiValues && kpiValues.profit != null ? kpiValues.profit + (kpiValues.penalties ?? 0) : undefined, fmt: _money, icon: DollarSign, change: null, source: '利润金额+罚款金额' },
    { label: '平台费率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.platformFee != null ? kpiValues.platformFee / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '平台服务费/商家实收' },
    { label: '快递费率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.postage != null ? kpiValues.postage / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '快递成本/商家实收' },
    { label: '运费险率', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.insuranceFee != null ? kpiValues.insuranceFee / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '运费险/商家实收' },
    { label: '总成本率', value: kpiValues && kpiValues.merchantReceived > 0 ? ((kpiValues.platformFee ?? 0) + (kpiValues.postage ?? 0) + (kpiValues.insuranceFee ?? 0) + (kpiValues.promoCost ?? 0)) / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '(平台费+快递+运费险+推广)/商家实收' },
    { label: '总运营成本', value: (kpiValues?.platformFee ?? 0) + (kpiValues?.postage ?? 0) + (kpiValues?.insuranceFee ?? 0) + (kpiValues?.promoCost ?? 0), fmt: _money, icon: DollarSign, change: null, source: '平台服务费+快递成本+运费险+推广花费' },
    { label: '单均运营成本', value: kpiValues && kpiValues.cnt > 0 ? ((kpiValues?.platformFee ?? 0) + (kpiValues?.postage ?? 0) + (kpiValues?.insuranceFee ?? 0) + (kpiValues?.promoCost ?? 0)) / kpiValues.cnt : undefined, fmt: _money, icon: TrendingUp, change: null, source: '总运营成本/有效订单量' },
    { label: '退款单均成本', value: kpiValues && kpiValues.rfCnt > 0 ? ((kpiValues?.refundedShippingCost ?? 0) + (kpiValues?.returnShippingCost ?? 0)) / kpiValues.rfCnt : undefined, fmt: _money, icon: RotateCcw, change: null, source: '退款成本合计/退款单数' },
    { label: '推广订单占比', value: kpiValues && kpiValues.cnt > 0 && kpiValues.promoOrders != null ? kpiValues.promoOrders / kpiValues.cnt * 100 : undefined, fmt: _pct, icon: Target, change: null, source: '推广订单量/有效订单量' },
    { label: '推广GMV占比', value: kpiValues && kpiValues.gmv > 0 && kpiValues.promoGmv != null ? kpiValues.promoGmv / kpiValues.gmv * 100 : undefined, fmt: _pct, icon: Target, change: null, source: '推广GMV/GMV' },
    { label: '单均推广费', value: kpiValues && kpiValues.cnt > 0 && kpiValues.promoCost != null ? kpiValues.promoCost / kpiValues.cnt : undefined, fmt: _money, icon: BarChart3, change: null, source: '推广花费/有效订单量' },
    { label: '单品均推广费', value: kpiValues && kpiValues.productCount > 0 && kpiValues.promoCost != null ? kpiValues.promoCost / kpiValues.productCount : undefined, fmt: _money, icon: Package, change: null, source: '推广花费/商品数' },
    { label: '自然单占比', value: kpiValues && kpiValues.cnt > 0 && kpiValues.organicOrders != null ? kpiValues.organicOrders / kpiValues.cnt * 100 : undefined, fmt: _pct, icon: TrendingUp, change: null, source: '自然单/有效订单量' },
    { label: '推广收入比', value: kpiValues && kpiValues.merchantReceived > 0 && kpiValues.promoCost != null ? kpiValues.promoCost / kpiValues.merchantReceived * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '推广花费/商家实收' },
    { label: '点击转化率', value: kpiValues && kpiValues.totalClicks > 0 && kpiValues.promoOrders != null ? kpiValues.promoOrders / kpiValues.totalClicks * 100 : undefined, fmt: _pct, icon: Target, change: null, source: '推广订单量/点击量' },
    { label: '千次曝光成本', value: kpiValues && kpiValues.totalImpressions > 0 && kpiValues.promoCost != null ? kpiValues.promoCost / kpiValues.totalImpressions * 1000 : undefined, fmt: _money, icon: DollarSign, change: null, source: '推广花费/曝光量*1000' },
    { label: '每点击GMV', value: kpiValues && kpiValues.totalClicks > 0 && kpiValues.promoGmv != null ? kpiValues.promoGmv / kpiValues.totalClicks : undefined, fmt: _money, icon: TrendingUp, change: null, source: '推广GMV/点击量' },
    { label: '每点击收入', value: kpiValues && kpiValues.totalClicks > 0 && kpiValues.merchantReceived != null ? kpiValues.merchantReceived / kpiValues.totalClicks : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收/点击量' },
    { label: '总互动成本', value: (kpiValues?.inquiryCost ?? 0) + (kpiValues?.favoriteCost ?? 0) + (kpiValues?.followCost ?? 0), fmt: _money, icon: MessageCircle, change: null, source: '询单+收藏+关注花费 SUM' },
    { label: '互动成本率', value: kpiValues && kpiValues.promoCost > 0 ? ((kpiValues?.inquiryCost ?? 0) + (kpiValues?.favoriteCost ?? 0) + (kpiValues?.followCost ?? 0)) / kpiValues.promoCost * 100 : undefined, fmt: _pct, icon: Percent, change: null, source: '总互动成本/推广花费' },
    { label: '单次互动成本', value: kpiValues && ((kpiValues?.inquiryCount ?? 0) + (kpiValues?.favoriteCount ?? 0) + (kpiValues?.followCount ?? 0)) > 0 ? ((kpiValues?.inquiryCost ?? 0) + (kpiValues?.favoriteCost ?? 0) + (kpiValues?.followCost ?? 0)) / ((kpiValues?.inquiryCount ?? 0) + (kpiValues?.favoriteCount ?? 0) + (kpiValues?.followCount ?? 0)) : undefined, fmt: _money, icon: MessageCircle, change: null, source: '总互动成本/(询单+收藏+关注)次数' },
    { label: '单商品收入', value: kpiValues && kpiValues.productCount > 0 && kpiValues.merchantReceived != null ? kpiValues.merchantReceived / kpiValues.productCount : undefined, fmt: _money, icon: DollarSign, change: null, source: '商家实收/商品数' },
    { label: '单商品订单', value: kpiValues && kpiValues.productCount > 0 && kpiValues.cnt != null ? kpiValues.cnt / kpiValues.productCount : undefined, fmt: _ratio, icon: ShoppingCart, change: null, source: '有效订单量/商品数' },
    { label: '人均消费', value: kpiValues && kpiValues.buyers > 0 && kpiValues.paid != null ? kpiValues.paid / kpiValues.buyers : undefined, fmt: _money, icon: Users, change: null, source: '用户实付/买家数' },
{ label: '人均SKU数', value: kpiValues && kpiValues.buyers > 0 && kpiValues.skuQty != null ? kpiValues.skuQty / kpiValues.buyers : undefined, fmt: _ratio, icon: Package, change: null, source: 'SKU数量/买家数' },
    { label: '百亿补贴', value: kpiValues?.subsidyFee ?? 0, fmt: _money, icon: DollarSign, change: null, source: '货款明细-百亿补贴支出 SUM' },
    { label: '罚款占利润比', value: kpiValues && kpiValues.profit != null && kpiValues.profit !== 0 ? (kpiValues.penalties ?? 0) / Math.abs(kpiValues.profit) * 100 : undefined, fmt: _pct, icon: AlertTriangle, change: null, source: '罚款金额/|利润金额|' },
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
    // 趋势图切换 — 全部42个指标与 KPI_LINES 一一对应
    setKpiActiveFilter(null);
            const kpiKeyMap: Record<string, string> = {
      'GMV（商品总价）': 'gmv',
      '商家实收': 'merchantReceived',
      '用户实付': 'paid',
      '自然销售额': 'organicGmv',
      '优惠总额': 'discount',
      '有效订单量': 'orderCount',
      '客单价': 'avgPrice',
      '买家数': 'buyerCount',
      '商品数': 'productCount',
      '自然单': 'organicOrders',
      '平均发货时长': 'avgShipHours',
      '发货率': 'shipRate',
      'SKU数量': 'skuQty',
      '退款金额': 'refundAmount',
      '退款单数': 'rfCount',
      '退款率': 'rfRate',
      '售后率': 'asRate',
      '退款金额(按同意退款时间)': 'refundApprovalAmount',
      '退款单数(按同意退款时间)': 'refundApprovalOrders',
      '利润金额': 'profit',
      '罚款金额': 'penaltyAmount',
      '罚款次数': 'penaltyCount',
      '推广花费': 'promoCost',
      '推广GMV': 'promoGmv',
      '推广ROI': 'promoRoi',
      '推广订单量': 'promoOrders',
      '推广占比': 'promoRatio',
      '全店投产': 'shopRoi',
      '曝光量': 'totalImpressions',
      '点击量': 'totalClicks',
      '点击率': 'ctr',
      '转化率': 'cvr',
      '平均点击成本': 'cpc',
      '平均订单花费': 'cpa',
      '平均询单成本': 'avgInquiryCost',
      '平均收藏成本': 'avgFavoriteCost',
      '平均关注成本': 'avgFollowCost',
      '总询单成本': 'inquiryCost',
      '总收藏成本': 'favoriteCost',
      '总关注成本': 'followCost',
      '退款成功快递发货成本': 'refundedShippingCost',
      '退货退回成本': 'returnShippingCost',
      '平台服务费': 'platformFee',
      '快递成本': 'postage',
      '运费险': 'insurance',
      '毛利率': 'grossProfitRate',
      '净利润率': 'netProfitRate',
      '单均利润': 'profitPerOrder',
      '平均退款额': 'avgRefundAmount',
      '推广费用率': 'promoCostRate',
      '净GMV(GMV-退款)': 'netGmv',
      '净实收(实收-退款)': 'netRevenue',
      '单均GMV': 'gmvPerOrder',
      '单均实收': 'mrPerOrder',
      '实收/GMV比': 'merchantTakeRate',
      '实付/GMV比': 'paidTakeRate',
      '自然占比': 'organicRatio',
      '折扣率': 'discRate',
      '单均优惠': 'discPerOrder',
      '人均订单数': 'ordersPerBuyer',
      '每单件数': 'itemsPerOrder',
      '退款侵蚀率': 'refundErosionRate',
      '同意退款率': 'refundApprovalRate',
      '退款后实收': 'mrAfterRefund',
      '毛利润': 'grossProfit',
      '推广订单占比': 'promoOrderRatio',
      '推广GMV占比': 'promoGmvRatio',
      '单均推广费': 'promoCostPerOrder',
      '千次曝光成本': 'cpm',
      '点击转化率': 'promoCvr',
      '总互动成本': 'totalInteractionCost',
      '互动成本率': 'interactionCostRate',
      '单次互动成本': 'avgInteractionCost',
      '平台费率': 'platformFeeRate',
      '快递费率': 'postageRate',
      '运费险率': 'insuranceRate',
      '总成本率': 'totalCostRate',
      '人均SKU数': 'skuPerBuyer',
      '人均利润': 'profitPerBuyer',
      '人均消费': 'spendingPerBuyer',
      '单SKU利润': 'profitPerSku',
      '单品均推广费': 'promoCostPerProduct',
      '单商品利润': 'profitPerProduct',
      '单商品收入': 'revenuePerProduct',
      '单商品订单': 'ordersPerProduct',
      '单均运营成本': 'opCostPerOrder',
      '总运营成本': 'totalOpCost',
      '推广收入比': 'promoToRevenue',
      '每点击GMV': 'gmvPerClick',
      '每点击收入': 'revenuePerClick',
      '百亿补贴': 'subsidyFee',
      '罚款占利润比': 'penaltyProfitRatio',
      '自然单占比': 'organicOrderRatio',
      '调整后利润(去罚款)': 'adjustedProfit',
      '退款单均成本': 'refundCostPerOrder',
      '退款成本合计': 'totalRefundCost',
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

  /** 指标选择面板中勾选时添加到末尾 */
  const handleKpiSelect = (label: string) => {
    setKpiCardOrder(prev => {
      const filtered = prev.filter(l => l !== label);
      return [...filtered, label];
    });
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
        return <DashboardKpiPanel key="kpi" kpiCards={kpiCards} allKpiCards={allKpiCards} visibleKpis={visibleKpis} setVisibleKpis={setVisibleKpis} showKpiSelector={showKpiSelector} setShowKpiSelector={setShowKpiSelector} filteredOrders={orders} noData={noData} onCardClick={(label) => { handleKpiClick(label); }} onDetailClick={(label) => { handleKpiDetailClick(label); }} onCardReorder={(newOrder) => setKpiCardOrder(newOrder.map(c => c.label))} onKpiSelect={handleKpiSelect} dailyKpiData={dailyKpiData} compareData={compareDailyKpiData} selectedTrendKpis={selectedTrendKpis} rangeLabel={rangeLabel} compareEnabled={compareEnabled} onClearLines={() => setSelectedTrendKpis(new Set())} />;
      case 'trend':
        return <DashboardTrendPanel key="trend" revenueTrend={revenueTrend} noData={noData} rangeLabel={rangeLabel} />;
      case 'status':
        return <DashboardStatusPanel key="status" statusDist={statusDist} noData={noData} totalOrders={kpiValues?.cnt} />;
      case 'table':
        return <React.Fragment key="table">
          {kpiActiveFilter && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-pdd-primary/10 border border-pdd-primary/20 rounded-lg text-xs mb-2">
              <span className="text-pdd-text-secondary">筛选：</span>
              <span className="font-medium text-pdd-primary">{kpiActiveFilter}</span>
              <button onClick={() => setKpiActiveFilter(null)} className="text-pdd-text-secondary hover:text-pdd-danger"><X size={12} /></button>
            </div>
          )}
          <DashboardTablePanel key="table" tableData={tableData} paginatedData={paginatedData} columns={columns} visibleColumns={visibleColumns} sortField={sortField} sortDesc={sortDesc} currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} setSortField={setSortField} setSortDesc={setSortDesc} onRowClick={(row) => setOrderDetail(row._raw)} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        </React.Fragment>;
      default: return null;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-4 min-h-screen">
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
      <UnifiedFilterBar
        timeFilter={tf}
        dropdowns={[
          { value: selectedCategory, onChange: setSelectedCategory, options: categories.map(c => ({ value: c, label: c })), placeholder: '全部类目' },
          { value: selectedProvince, onChange: setSelectedProvince, options: provinces.map(p => ({ value: p, label: p })), placeholder: '全部省份' },
        ]}
        actions={[
          { label: '指标', onClick: () => setShowKpiSelector(!showKpiSelector), active: showKpiSelector },
          { label: 'JSON', onClick: exportJSON },
        ]}
        onExportCSV={exportCSV}
        onRefresh={handleRefresh}
        refreshing={isRefreshing}
        lastRefresh={lastRefresh}
      />

      <div className="space-y-4">
        {renderPanel('kpi')}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderPanel('trend')}
          {renderPanel('status')}
        </div>
        {renderPanel('table')}
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
                    <h3 className="text-xs font-bold text-gray-700 mb-1.5 border-b border-pdd-border pb-0.5">{sec.title}</h3>
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
                  <h3 className="text-xs font-bold text-gray-700 mb-1.5 border-b border-pdd-border pb-0.5 flex items-center justify-between">
                    自定义费用
                    <button onClick={addCustomCost} className="text-[10px] px-1.5 py-0.5 rounded bg-pdd-primary/10 text-pdd-primary-light hover:bg-pdd-primary/20">+添加</button>
                  </h3>
                  {(customCosts.length === 0 ? [{ name: '', amount: 0 }] : customCosts).map((c, i) => (
                    <div key={i} className="flex items-center gap-1.5 mb-1">
                      <input type="text" placeholder="名称" value={c.name} onChange={e => updateCustomCost(i, 'name', e.target.value)}
                        className="flex-1 text-[11px] px-1.5 py-1 rounded border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary-light" />
                      <input type="number" placeholder="金额" step="0.01" value={c.amount || ''} onChange={e => updateCustomCost(i, 'amount', e.target.value)}
                        className="w-20 text-[11px] px-1.5 py-1 rounded border border-pdd-border bg-pdd-bg text-pdd-text text-right outline-none focus:border-pdd-primary-light" />
                      <span className="text-[10px] text-pdd-text-secondary w-14 text-right">-¥{(c.amount || 0).toFixed(2)}</span>
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

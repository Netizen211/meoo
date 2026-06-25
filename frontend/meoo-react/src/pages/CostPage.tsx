import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area } from 'recharts';
import { DollarSign, Percent, TrendingUp, AlertTriangle, ArrowUp, ArrowDown, Search, BarChart3, Download, X, Package } from 'lucide-react';
import { useData, useAuth } from '../App';
import { findField } from '../utils';
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct, formatLabel } from '../components/TimeFilter';
import AmountFilterPanel, { FilterField, FilterValues, createEmptyFilters, applyAmountFilters } from '../components/AmountFilterPanel';

const COST_FILTER_FIELDS: FilterField[] = [
  { key: 'actualPay', label: '买家实付金额', hint: '用户实付', group: 'basic', compute: (o) => safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')) },
  { key: 'actualReceive', label: '实收金额(剔除退款)', hint: '仅非退款', group: 'basic', compute: (o) => safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), filterLogic: 'exclude_refund' },
  { key: 'refundAmount', label: '买家退款金额', hint: '仅退款单', group: 'basic', compute: (o) => safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), filterLogic: 'only_refund' },
  { key: 'productTotal', label: '商品总价', group: 'basic', compute: (o) => safeFloat(findField(o, '商品总价(元)', '商品总价')) },
  { key: 'postage', label: '邮费金额', group: 'basic', compute: (o) => safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)')) },
  { key: 'discountTotal', label: '优惠总额', hint: '三项合计', group: 'discount', compute: (o) => safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减')) },
  { key: 'shopDiscount', label: '店铺优惠折扣', group: 'discount', compute: (o) => safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) },
  { key: 'platDiscount', label: '平台优惠折扣', group: 'discount', compute: (o) => safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) },
  { key: 'discountRate', label: '优惠率', hint: '%', group: 'discount', compute: (o) => { const pt = safeFloat(findField(o, '商品总价(元)', '商品总价')); if (!pt) return 0; return ((safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'))) / pt) * 100; } },
  { key: 'recvRate', label: '实收率', hint: '%', group: 'cost', compute: (o) => { const pt = safeFloat(findField(o, '商品总价(元)', '商品总价')); if (!pt) return 0; return (safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')) / pt) * 100; } },
];

const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-purple)', 'var(--pdd-danger)'];

type CostTab = 'overview' | 'discount' | 'anomaly' | 'detail';

export default function CostPage() {
  const { currentDisplayData, productCosts, defaultCostRatio, packagingFeePerOrder } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('all', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
  const [activeTab, setActiveTab] = useState<CostTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [amountFilters, setAmountFilters] = useState<FilterValues>(createEmptyFilters(COST_FILTER_FIELDS));
  const [anomalyDetail, setAnomalyDetail] = useState<any>(null);

  const validOrders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => { const st = String(findField(o, '订单状态', '状态') || '').trim(); return !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st); });
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(validOrders), [validOrders]);
  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(validOrders, allDates, timeRange, customStart, customEnd, quickRange);
    result = applyAmountFilters(result, COST_FILTER_FIELDS, amountFilters);
    return result;
  }, [validOrders, allDates, timeRange, amountFilters, customStart, customEnd, quickRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(validOrders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [validOrders, allDates, timeRange, compareEnabled, compareStart, compareEnd, customStart, customEnd, quickRange]);

  const kpi = useMemo(() => {
    if (!filteredOrders.length) return null;
    const totalProduct = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
    const totalPostage = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)')), 0);
    const totalShopDisc = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')), 0);
    const totalPlatDisc = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')), 0);
    const totalDuoDuo = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减')), 0);
    const totalUserPay = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), 0);
    const totalMerchant = filteredOrders.reduce((s, o) => s + safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), 0);
    const totalDisc = totalShopDisc + totalPlatDisc + totalDuoDuo;
    const discRate = totalProduct > 0 ? (totalDisc / totalProduct) * 100 : 0;
    const recvRate = totalProduct > 0 ? (totalMerchant / totalProduct) * 100 : 0;
    const freePostRate = filteredOrders.length > 0 ? (filteredOrders.filter(o => safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)')) === 0).length / filteredOrders.length) * 100 : 0;
    const avgDisc = filteredOrders.length > 0 ? totalDisc / filteredOrders.length : 0;
    const highDiscCount = filteredOrders.filter(o => (safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))) / safeFloat(findField(o, '商品总价(元)', '商品总价')) > 0.3).length;
    return { totalProduct, totalPostage, totalShopDisc, totalPlatDisc, totalDuoDuo, totalUserPay, totalMerchant, totalDisc, discRate, recvRate, freePostRate, avgDisc, highDiscCount };
  }, [filteredOrders]);

  const compareKpi = useMemo(() => {
    if (!compareOrders.length) return null;
    const totalMerchant = compareOrders.reduce((s, o) => s + safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), 0);
    const totalDisc = compareOrders.reduce((s, o) => s + safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠')) + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减')), 0);
    const totalProduct = compareOrders.reduce((s, o) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
    return { totalMerchant, totalDisc, recvRate: totalProduct > 0 ? (totalMerchant / totalProduct) * 100 : 0 };
  }, [compareOrders]);

  const dailyData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const byDate: Record<string, any> = {};
    filteredOrders.forEach(o => {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = { date: d.slice(5), product: 0, postage: 0, shopDisc: 0, platDisc: 0, duoDuo: 0, userPay: 0, merchant: 0, count: 0 };
      byDate[d].product += safeFloat(findField(o, '商品总价(元)', '商品总价'));
      byDate[d].postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)'));
      byDate[d].shopDisc += safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'));
      byDate[d].platDisc += safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'));
      byDate[d].duoDuo += safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
      byDate[d].userPay += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
      byDate[d].merchant += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
      byDate[d].count++;
    });
    return Object.values(byDate).sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredOrders]);

  const discPie = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: '店铺优惠', value: Math.round(kpi.totalShopDisc) },
      { name: '平台优惠', value: Math.round(kpi.totalPlatDisc) },
      { name: '多多立减', value: Math.round(kpi.totalDuoDuo) },
    ].filter(d => d.value > 0);
  }, [kpi]);

  const discSensitivity = useMemo(() => {
    if (!filteredOrders.length) return [];
    const ranges = ['0%', '0-10%', '10-20%', '20-30%', '30%+'];
    const counts = [0, 0, 0, 0, 0];
    filteredOrders.forEach(o => {
      const product = safeFloat(findField(o, '商品总价(元)', '商品总价'));
      const disc = safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠')) + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'));
      const rate = product > 0 ? disc / product : 0;
      if (rate === 0) counts[0]++;
      else if (rate <= 0.1) counts[1]++;
      else if (rate <= 0.2) counts[2]++;
      else if (rate <= 0.3) counts[3]++;
      else counts[4]++;
    });
    return ranges.map((r, i) => ({ range: r, count: counts[i], rate: filteredOrders.length > 0 ? (counts[i] / filteredOrders.length * 100).toFixed(2) : 0 }));
  }, [filteredOrders]);

  const costStructure = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: '商家实收', value: kpi.totalMerchant, color: 'var(--pdd-success)' },
      { name: '优惠总额', value: kpi.totalDisc, color: 'var(--pdd-warning)' },
      { name: '邮费成本', value: kpi.totalPostage, color: 'var(--pdd-primary)' },
    ];
  }, [kpi]);

  const anomalyOrders = useMemo(() => {
    if (!filteredOrders.length) return { highDisc: [], highPostage: [], loss: [] };
    const highDisc: any[] = [];
    const highPostage: any[] = [];
    const loss: any[] = [];
    filteredOrders.forEach(o => {
      const product = safeFloat(findField(o, '商品总价(元)', '商品总价'));
      const shopDisc = safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'));
      const platDisc = safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'));
      const duoDuo = safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
      const postage = safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)'));
      const merchant = safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
      const discRate = product > 0 ? (shopDisc + platDisc + duoDuo) / product : 0;
      const info = {
        orderNo: String(findField(o, '订单号') || ''),
        product: String(findField(o, '商品', '商品名称') || '').slice(0, 30),
        productTotal: product,
        shopDisc,
        platDisc,
        duoDuo,
        postage,
        merchant,
        discRate: (discRate * 100),
        recvRate: product > 0 ? (merchant / product) * 100 : 0,
        _raw: o,
      };
      if (discRate > 0.5) highDisc.push(info);
      if (postage > 20) highPostage.push(info);
      // 亏损检测：考虑商品成本+包装费+邮费，未填成本时用默认比例估算
      const skuKey = (String(findField(o, '样式ID') || '').trim())
        ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}`
        : String(findField(o, '商品id', '商品ID') || '').trim();
      const knownCost = productCosts[skuKey] || 0;
      const itemQty = parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1;
      const estimatedRawCost = knownCost > 0 ? knownCost * itemQty : (product * (defaultCostRatio / 100));
      const estimatedTotalCost = estimatedRawCost + (packagingFeePerOrder || 0) + postage;
      if (merchant <= 0 || (product > 0 && merchant < estimatedTotalCost)) loss.push({ ...info, estimatedCost: estimatedTotalCost, knownCost });
    });
    return { highDisc, highPostage, loss };
  }, [filteredOrders]);

  const filteredTableData = useMemo(() => {
    let data = dailyData;
    if (searchQuery) {
      data = data.filter((d: any) => d.date.includes(searchQuery));
    }
    data.sort((a: any, b: any) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDesc ? bv - av : av - bv;
      }
      return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return data;
  }, [dailyData, searchQuery, sortField, sortDesc]);

  const noData = !filteredOrders.length;
  const fmt = (v: number) => v >= 10000 ? `¥${(v / 10000).toFixed(2)}万` : `¥${v.toFixed(2)}`;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  const exportCSV = () => {
    const headers = ['日期', '商品总价', '优惠总额', '邮费', '商家实收', '实收率', '订单数'];
    const rows = filteredTableData.map((d: any) => [
      d.date,
      d.product.toFixed(2),
      (d.shopDisc + d.platDisc + d.duoDuo).toFixed(2),
      d.postage.toFixed(2),
      d.merchant.toFixed(2),
      (d.product > 0 ? (d.merchant / d.product) * 100 : 0).toFixed(2) + '%',
      d.count,
    ]);
    const csv = ['﻿' + headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `成本明细_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: CostTab; label: string; icon: any }[] = [
    { key: 'overview', label: '成本概览', icon: DollarSign },
    { key: 'discount', label: '优惠分析', icon: Percent },
    { key: 'anomaly', label: '异常检测', icon: AlertTriangle },
    { key: 'detail', label: '成本明细', icon: BarChart3 },
  ];

  // ========== KPI 卡片组件 ==========
  const KpiCard = ({ label, value, icon: Icon, color, change, isRate, bgColor }: {
    label: string; value: number | undefined; icon: any; color: string; change?: number | null; isRate?: boolean; bgColor: string;
  }) => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="pdd-card px-3 py-2.5 flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: bgColor }}>
        <Icon size={16} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[11px] text-[var(--pdd-text-secondary)]">{label}</span>
        <div className="flex items-center gap-1">
          <span className="text-sm font-bold text-pdd-text">
            {noData ? '--' : value != null ? (isRate ? `${value.toFixed(2)}%` : fmt(value)) : '--'}
          </span>
          {change != null && Math.abs(change) > 0.01 && (
            <span className={`text-[11px] ${change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
              {change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(change).toFixed(2)}%
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );

  // ========== Tab 1: 成本概览 ==========
  const renderOverview = () => (
    <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="商品总价" value={kpi?.totalProduct} icon={DollarSign} color="var(--pdd-text)" bgColor="#F8FAFD" />
        <KpiCard label="优惠总额" value={kpi?.totalDisc} icon={Percent} color="var(--pdd-danger)" bgColor="#FFF1F2" />
        <KpiCard label="商家实收" value={kpi?.totalMerchant} icon={TrendingUp} color="var(--pdd-success)" bgColor="#ECFDF3"
          change={compareEnabled ? changePct(kpi?.totalMerchant || 0, compareKpi?.totalMerchant || 0) : null} />
        <KpiCard label="实收率" value={kpi?.recvRate} icon={Percent} color="var(--pdd-primary)" bgColor="#EEF5FF" isRate />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><TrendingUp size={15} className="text-pdd-primary" />成本瀑布流</h4>
          {noData ? <div className="h-48 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(2)}万` : v} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="product" stackId="1" stroke="var(--pdd-text)" fill="#F0F2F5" name="商品总价" />
                <Area type="monotone" dataKey="merchant" stackId="2" stroke="var(--pdd-success)" fill="#D1FADF" name="商家实收" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><DollarSign size={15} className="text-pdd-success" />收入构成</h4>
          {noData ? <div className="h-48 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={costStructure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={45}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(2)}%`}>
                  {costStructure.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '店铺优惠', value: kpi?.totalShopDisc, color: 'var(--pdd-danger)' },
          { label: '平台优惠', value: kpi?.totalPlatDisc, color: 'var(--pdd-primary)' },
          { label: '多多立减', value: kpi?.totalDuoDuo, color: 'var(--pdd-warning)' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.05 }}
            className="pdd-card px-3 py-2 text-center">
            <span className="text-[11px] text-[var(--pdd-text-secondary)]">{item.label}</span>
            <div className="text-sm font-bold" style={{ color: item.color }}>
              {noData ? '--' : item.value != null ? fmt(item.value) : '--'}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );

  // ========== Tab 2: 优惠分析 ==========
  const renderDiscount = () => (
    <motion.div key="discount" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <KpiCard label="优惠总额" value={kpi?.totalDisc} icon={Percent} color="var(--pdd-danger)" bgColor="#FFF1F2" />
        <KpiCard label="优惠率" value={kpi?.discRate} icon={Percent} color="var(--pdd-warning)" bgColor="#FFFAEB" isRate />
        <KpiCard label="平均每单优惠" value={kpi?.avgDisc} icon={DollarSign} color="var(--pdd-primary)" bgColor="#EEF5FF" />
        <KpiCard label="高优惠订单" value={kpi?.highDiscCount} icon={AlertTriangle} color="#722ed1" bgColor="#F5F3FF" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="pdd-card p-3">
        <h4 className="text-sm font-semibold mb-2">每日优惠趋势</h4>
        {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => v >= 10000 ? `${(v / 10000).toFixed(2)}万` : v} />
              <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="shopDisc" stroke="var(--pdd-danger)" strokeWidth={2} name="店铺优惠" dot={false} />
              <Line type="monotone" dataKey="platDisc" stroke="var(--pdd-primary)" strokeWidth={2} name="平台优惠" dot={false} />
              <Line type="monotone" dataKey="duoDuo" stroke="var(--pdd-warning)" strokeWidth={2} name="多多立减" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2">优惠敏感度分布</h4>
          {noData ? <div className="h-36 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={discSensitivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number, name: string) => [name === 'count' ? `${v}单` : `${v}%`, name === 'count' ? '订单数' : '占比']} />
                <Bar dataKey="count" fill="var(--pdd-primary-light)" radius={[3, 3, 0, 0]} name="订单数" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2">优惠类型占比</h4>
          {noData || !discPie.length ? <div className="h-36 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={discPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(2)}%`}>
                  {discPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>
    </motion.div>
  );

  // ========== Tab 3: 异常检测 ==========
  const renderAnomaly = () => (
    <motion.div key="anomaly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: '高优惠率', count: anomalyOrders.highDisc.length, color: 'var(--pdd-danger)', bgColor: '#FFF1F2', desc: '优惠率 > 50%' },
          { label: '高邮费', count: anomalyOrders.highPostage.length, color: 'var(--pdd-warning)', bgColor: '#FFFAEB', desc: '邮费 > ¥20' },
          { label: '亏损/零利润', count: anomalyOrders.loss.length, color: 'var(--pdd-purple)', bgColor: 'var(--pdd-purple)', desc: '实收 ≤ 0' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-2.5 text-center">
            <span className="text-[11px] text-[var(--pdd-text-secondary)]">{item.label}</span>
            <div className="text-lg font-bold" style={{ color: item.color }}>{item.count}</div>
            <span className="text-[10px] text-[var(--pdd-text-secondary)]">{item.desc}</span>
          </motion.div>
        ))}
      </div>

      {[
        { title: '高优惠率订单', data: anomalyOrders.highDisc, color: 'var(--pdd-danger)', borderColor: '#FFC2C2', bgColor: '#FFF1F2' },
        { title: '高邮费订单', data: anomalyOrders.highPostage, color: 'var(--pdd-warning)', borderColor: '#FFEBA6', bgColor: '#FFFAEB' },
        { title: '亏损/零利润订单', data: anomalyOrders.loss, color: 'var(--pdd-purple)', borderColor: '#D3C4F5', bgColor: 'var(--pdd-purple)' },
      ].map((group, gi) => (
        <motion.div key={group.title} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 + gi * 0.05 }}
          className="pdd-card p-3" style={{ borderColor: group.borderColor }}>
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: group.color }}>
            <AlertTriangle size={14} />{group.title} <span className="text-[11px] text-[var(--pdd-text-secondary)]">({group.data.length}条)</span>
          </h4>
          {group.data.length === 0 ? (
            <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">暂无异常</div>
          ) : (
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {group.data.slice(0, 15).map((a: any, idx: number) => (
                <div key={idx} onClick={() => setAnomalyDetail(a)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-[var(--pdd-bg)] transition-colors text-xs"
                  style={{ backgroundColor: idx % 2 === 0 ? group.bgColor : 'transparent' }}>
                  <span className="font-mono text-[var(--pdd-text-secondary)] shrink-0">{a.orderNo.slice(-8)}</span>
                  <span className="flex-1 truncate text-pdd-text">{a.product}</span>
                  <span className="shrink-0 font-semibold" style={{ color: group.color }}>
                    {group.title.includes('优惠') ? `${a.discRate.toFixed(2)}%` : group.title.includes('邮费') ? `¥${a.postage.toFixed(2)}` : `¥${a.merchant.toFixed(2)}`}
                  </span>
                  <span className="text-[var(--pdd-text-secondary)] text-[10px] shrink-0">实收 ¥{a.merchant.toFixed(2)}</span>
                </div>
              ))}
              {group.data.length > 15 && (
                <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-1">还有 {group.data.length - 15} 条...</div>
              )}
            </div>
          )}
        </motion.div>
      ))}

      {(anomalyOrders.highDisc.length === 0 && anomalyOrders.highPostage.length === 0 && anomalyOrders.loss.length === 0) && (
        <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-8">未检测到异常订单</div>
      )}
    </motion.div>
  );

  // ========== Tab 4: 成本明细 ==========
  const renderDetail = () => (
    <motion.div key="detail" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1 bg-[var(--pdd-bg)] rounded-lg px-2 py-1">
          <Search size={13} className="text-[var(--pdd-text-secondary)]" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索日期..." className="text-xs outline-none bg-transparent w-28" />
        </div>
        <button onClick={exportCSV} disabled={noData}
          className="text-xs text-pdd-primary-light hover:text-white border border-pdd-primary-light hover:bg-pdd-primary-light rounded-lg px-2 py-1 flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <Download size={12} />导出 CSV
        </button>
      </div>
      {noData ? <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
        <div className="overflow-x-auto max-h-[50vh] overflow-y-auto rounded-xl border border-pdd-border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-pdd-card z-10">
              <tr className="border-b border-pdd-border">
                {[
                  { key: 'date', label: '日期' },
                  { key: 'product', label: '商品总价' },
                  { key: 'disc', label: '优惠' },
                  { key: 'postage', label: '邮费' },
                  { key: 'merchant', label: '实收' },
                  { key: 'recvRate', label: '实收率' },
                  { key: 'count', label: '订单数' },
                ].map(f => (
                  <th key={f.key} onClick={() => { if (f.key !== 'recvRate') { setSortField(f.key); setSortDesc(sortField === f.key ? !sortDesc : true); } }}
                    className={`py-2 px-2 font-medium text-[var(--pdd-text-secondary)] ${f.key !== 'recvRate' ? 'cursor-pointer hover:text-pdd-danger' : ''} ${f.key === 'date' ? 'text-left' : 'text-right'}`}>
                    {f.label}{sortField === f.key && (sortDesc ? ' ↓' : ' ↑')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTableData.map((d: any, i: number) => {
                const totalDisc = d.shopDisc + d.platDisc + d.duoDuo;
                const recvRate = d.product > 0 ? (d.merchant / d.product) * 100 : 0;
                const maxProduct = Math.max(...filteredTableData.map((x: any) => x.product), 1);
                return (
                  <tr key={i} className="border-b border-pdd-border hover:bg-[var(--pdd-bg)] transition-colors">
                    <td className="py-1.5 px-2 text-left text-pdd-text">{d.date}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">
                      <div className="flex items-center justify-end gap-1.5">
                        <span>{fmt(d.product)}</span>
                        <div className="w-10 h-1 rounded-full bg-[var(--pdd-bg)] shrink-0">
                          <div className="h-full rounded-full bg-pdd-primary-light/30" style={{ width: `${(d.product / maxProduct) * 100}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-[var(--pdd-warning)]">{fmt(totalDisc)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{fmt(d.postage)}</td>
                    <td className="py-1.5 px-2 text-right font-mono font-semibold text-pdd-text">{fmt(d.merchant)}</td>
                    <td className="py-1.5 px-2 text-right font-mono">
                      <span className={`${recvRate >= 80 ? 'text-pdd-success' : recvRate >= 50 ? 'text-pdd-warning' : 'text-pdd-danger'}`}>
                        {recvRate.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-1.5 px-2 text-right text-[var(--pdd-text-secondary)]">{d.count}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tf} />
      <AmountFilterPanel fields={COST_FILTER_FIELDS} filters={amountFilters} onFiltersChange={setAmountFilters} />

      {/* Tab 导航 */}
      <div className="flex gap-1 bg-pdd-card rounded-xl px-1.5 py-1 border border-pdd-border shadow-sm overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'text-white shadow-md' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-[var(--pdd-bg)]'
            }`}
            style={activeTab === tab.key ? { background: 'linear-gradient(to right, var(--pdd-primary), #6366f1)' } : {}}>
            <tab.icon size={13} />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容 */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'discount' && renderDiscount()}
      {activeTab === 'anomaly' && renderAnomaly()}
      {activeTab === 'detail' && renderDetail()}

      {/* 异常订单详情弹窗 */}
      <AnimatePresence>
        {anomalyDetail && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setAnomalyDetail(null)}>
            <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} exit={{ scale: 0.92 }}
              className="bg-pdd-card border border-pdd-border rounded-2xl p-4 max-w-lg w-full max-h-[80vh] overflow-auto shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-pdd-text flex items-center gap-2">
                  <Package size={15} className="text-pdd-primary" />订单成本详情
                </h3>
                <button onClick={() => setAnomalyDetail(null)} className="p-1 hover:bg-[var(--pdd-bg)] rounded-lg text-pdd-text-secondary hover:text-pdd-text transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="pdd-card px-3 py-2">
                    <span className="text-[10px] text-[var(--pdd-text-secondary)]">订单号</span>
                    <div className="text-xs font-mono text-pdd-text font-semibold">{anomalyDetail.orderNo}</div>
                  </div>
                  <div className="pdd-card px-3 py-2">
                    <span className="text-[10px] text-[var(--pdd-text-secondary)]">商品名称</span>
                    <div className="text-xs text-pdd-text truncate" title={anomalyDetail.product}>{anomalyDetail.product}</div>
                  </div>
                </div>
                <div className="pdd-card p-3 space-y-2">
                  <h4 className="text-xs font-semibold text-pdd-text">成本拆解</h4>
                  {[
                    { label: '商品总价', value: anomalyDetail.productTotal, color: 'var(--pdd-text)' },
                    { label: '店铺优惠', value: anomalyDetail.shopDisc, color: 'var(--pdd-danger)' },
                    { label: '平台优惠', value: anomalyDetail.platDisc, color: 'var(--pdd-primary)' },
                    { label: '多多立减', value: anomalyDetail.duoDuo, color: 'var(--pdd-warning)' },
                    { label: '邮费', value: anomalyDetail.postage, color: 'var(--pdd-primary-light)' },
                    { label: '商家实收', value: anomalyDetail.merchant, color: 'var(--pdd-success)', bold: true },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between">
                      <span className="text-xs text-[var(--pdd-text-secondary)]">{row.label}</span>
                      <span className={`text-xs ${row.bold ? 'font-bold' : ''}`} style={{ color: row.color }}>
                        ¥{row.value.toFixed(2)}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-pdd-border pt-2 flex items-center justify-between">
                    <span className="text-xs text-[var(--pdd-text-secondary)]">优惠率</span>
                    <span className={`text-xs font-bold ${anomalyDetail.discRate > 30 ? 'text-pdd-danger' : 'text-pdd-warning'}`}>
                      {anomalyDetail.discRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--pdd-text-secondary)]">实收率</span>
                    <span className={`text-xs font-bold ${anomalyDetail.recvRate >= 80 ? 'text-pdd-success' : anomalyDetail.recvRate >= 50 ? 'text-pdd-warning' : 'text-pdd-danger'}`}>
                      {anomalyDetail.recvRate.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--pdd-text-secondary)]">预估利润</span>
                    {(() => {
                      const estCost = (anomalyDetail as any).estimatedCost ?? anomalyDetail.postage;
                      const profit = anomalyDetail.merchant - estCost;
                      return <span className={`text-xs font-bold ${profit > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>¥{profit.toFixed(2)}</span>;
                    })()}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

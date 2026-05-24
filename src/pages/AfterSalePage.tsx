import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend } from 'recharts';
import { ShieldCheck, RotateCcw, AlertTriangle, Clock, Lock, Crown, ArrowUp, ArrowDown, Download, Search, TrendingUp, DollarSign, Package, Star, Filter, ChevronLeft, ChevronRight, Truck, Users, Tag, FileText, PieChart as PieChartIcon } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange } from '../components/TimeFilter';

const COLORS = ['var(--pdd-danger)', '#ff6b5b', 'var(--pdd-warning)', 'var(--pdd-success)', 'var(--pdd-primary)', '#8c8c8c', 'var(--pdd-purple)', '#13c2c2'];

type TabKey = 'overview' | 'efficiency' | 'logistics' | 'sku' | 'risk' | 'detail';

export default function AfterSalePage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

  // 数据源
  const afterSaleRecords = useMemo(() => currentDisplayData?.afterSaleRecords || [], [currentDisplayData]);
  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const hasIndependentData = afterSaleRecords.length > 0;
  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);

  // 时间过滤
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
  const filteredAfterSaleRecords = useMemo(() => {
    if (!hasIndependentData) return [];
    return filterPromoByTimeRange(afterSaleRecords, allDates, timeRange, '申请时间');
  }, [afterSaleRecords, allDates, timeRange, hasIndependentData]);

  // ========== KPI 计算 ==========
  const kpiData = useMemo(() => {
    const totalOrders = filteredOrders.length;
    let afterSaleCount = 0;
    let refundAmount = 0;
    let returnRefundCount = 0;
    let processTimes: number[] = [];

    if (hasIndependentData) {
      afterSaleCount = filteredAfterSaleRecords.length;
      filteredAfterSaleRecords.forEach((r: any) => {
        refundAmount += safeFloat(r['退款金额']);
        const type = String(r['退款类型'] || '');
        if (type.includes('退货')) returnRefundCount++;
        const applyTime = String(r['申请时间'] || '');
        const agreeTime = String(r['同意退款时间'] || '');
        if (applyTime && agreeTime) {
          const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
          if (hours > 0 && hours < 720) processTimes.push(hours);
        }
      });
    } else {
      const asCheck = (o: any) => { const s = String(o['售后状态'] || '').trim(); return s !== '' && s !== '无售后或售后取消' && s !== '无'; };
      const asOrders = filteredOrders.filter(asCheck);
      afterSaleCount = asOrders.length;
      asOrders.forEach((o: any) => {
        refundAmount += safeFloat(o['用户实付金额(元)']);
        if (String(o['售后状态'] || '').includes('退货退款')) returnRefundCount++;
      });
    }

    const afterSaleRate = totalOrders > 0 ? (afterSaleCount / totalOrders) * 100 : 0;
    const avgProcessTime = processTimes.length > 0 ? processTimes.reduce((a, b) => a + b, 0) / processTimes.length : 0;
    const returnRefundRate = afterSaleCount > 0 ? (returnRefundCount / afterSaleCount) * 100 : 0;

    return { afterSaleCount, afterSaleRate, refundAmount, avgProcessTime, returnRefundRate, totalOrders };
  }, [filteredAfterSaleRecords, filteredOrders, hasIndependentData]);

  // ========== 售后趋势 ==========
  const trendData = useMemo(() => {
    if (!hasIndependentData) return [];
    const dateMap: Record<string, { success: number; pending: number; processing: number }> = {};
    filteredAfterSaleRecords.forEach((r: any) => {
      const date = String(r['申请时间'] || '').split(' ')[0];
      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!dateMap[date]) dateMap[date] = { success: 0, pending: 0, processing: 0 };
      const status = String(r['售后状态'] || '');
      if (status.includes('成功') || status.includes('完成')) dateMap[date].success++;
      else if (status.includes('待') || status.includes('等待')) dateMap[date].pending++;
      else dateMap[date].processing++;
    });
    return Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [filteredAfterSaleRecords, hasIndependentData]);

  // ========== 退款原因分布 ==========
  const reasonData = useMemo(() => {
    if (!hasIndependentData) return [];
    const reasonMap: Record<string, number> = {};
    filteredAfterSaleRecords.forEach((r: any) => {
      const reason = String(r['退款原因'] || '其他').trim() || '其他';
      reasonMap[reason] = (reasonMap[reason] || 0) + 1;
    });
    return Object.entries(reasonMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredAfterSaleRecords, hasIndependentData]);

  // ========== 处理时效分析 ==========
  const efficiencyData = useMemo(() => {
    if (!hasIndependentData) return { avgHours: 0, overtimeCount: 0, overtimeRate: 0, handlerRank: [], durationDist: [] };
    let totalHours = 0, validCount = 0, overtimeCount = 0;
    const handlerMap: Record<string, { count: number; totalHours: number }> = {};
    const buckets = { '0-2h': 0, '2-6h': 0, '6-24h': 0, '24h+': 0 };

    filteredAfterSaleRecords.forEach((r: any) => {
      const applyTime = String(r['申请时间'] || '');
      const agreeTime = String(r['同意退款时间'] || '');
      const handler = String(r['同意退款人'] || '').trim();
      if (applyTime && agreeTime) {
        const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
        if (hours > 0 && hours < 720) {
          totalHours += hours;
          validCount++;
          if (hours > 24) overtimeCount++;
          if (hours <= 2) buckets['0-2h']++;
          else if (hours <= 6) buckets['2-6h']++;
          else if (hours <= 24) buckets['6-24h']++;
          else buckets['24h+']++;
          if (handler) {
            if (!handlerMap[handler]) handlerMap[handler] = { count: 0, totalHours: 0 };
            handlerMap[handler].count++;
            handlerMap[handler].totalHours += hours;
          }
        }
      }
    });

    const avgHours = validCount > 0 ? totalHours / validCount : 0;
    const overtimeRate = validCount > 0 ? (overtimeCount / validCount) * 100 : 0;
    const handlerRank = Object.entries(handlerMap)
      .map(([name, d]) => ({ name: name.slice(0, 15), count: d.count, avgHours: d.totalHours / d.count }))
      .sort((a, b) => a.avgHours - b.avgHours);
    const durationDist = Object.entries(buckets).map(([name, value]) => ({ name, value }));

    return { avgHours, overtimeCount, overtimeRate, handlerRank, durationDist };
  }, [filteredAfterSaleRecords, hasIndependentData]);

  // ========== 退货物流追踪 ==========
  const logisticsData = useMemo(() => {
    if (!hasIndependentData) return { statusDist: [], interceptRate: 0, avgReturnDays: 0, totalReturns: 0 };
    const statusMap: Record<string, number> = {};
    let interceptTotal = 0, interceptSuccess = 0;
    let returnDaysSum = 0, returnDaysCount = 0;
    let totalReturns = 0;

    filteredAfterSaleRecords.forEach((r: any) => {
      const trackingNo = String(r['退货运单号'] || '').trim();
      const logisticsStatus = String(r['退货物流状态'] || '').trim();
      const interceptStatus = String(r['快递拦截状态'] || '').trim();

      if (trackingNo) {
        totalReturns++;
        if (logisticsStatus) {
          statusMap[logisticsStatus] = (statusMap[logisticsStatus] || 0) + 1;
        }
        // 计算退货物流时效：同意退款时间 → 退货物流状态对应时间
        const agreeTime = String(r['同意退款时间'] || r['同意退货时间'] || '');
        const logisticsTime = String(r['退货物流状态对应时间'] || '');
        if (agreeTime && logisticsTime) {
          const days = (new Date(logisticsTime).getTime() - new Date(agreeTime).getTime()) / 86400000;
          if (days > 0 && days < 60) {
            returnDaysSum += days;
            returnDaysCount++;
          }
        }
      }
      if (interceptStatus && interceptStatus !== '') {
        interceptTotal++;
        if (interceptStatus.includes('成功') || interceptStatus.includes('已拦截')) interceptSuccess++;
      }
    });

    const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
    const interceptRate = interceptTotal > 0 ? (interceptSuccess / interceptTotal) * 100 : 0;
    const avgReturnDays = returnDaysCount > 0 ? returnDaysSum / returnDaysCount : 0;

    return { statusDist, interceptRate, avgReturnDays, totalReturns };
  }, [filteredAfterSaleRecords, hasIndependentData]);

  // ========== SKU级售后拆解 ==========
  const skuBreakdown = useMemo(() => {
    if (!hasIndependentData) return [];
    const skuMap: Record<string, { count: number; refundAmount: number }> = {};
    filteredAfterSaleRecords.forEach((r: any) => {
      const sku = String(r['sku信息'] || '').trim();
      if (!sku) return;
      // 取SKU的关键部分（去掉过长的描述）
      const skuKey = sku.length > 40 ? sku.slice(0, 40) + '...' : sku;
      if (!skuMap[skuKey]) skuMap[skuKey] = { count: 0, refundAmount: 0 };
      skuMap[skuKey].count++;
      skuMap[skuKey].refundAmount += safeFloat(r['退款金额']);
    });
    return Object.entries(skuMap)
      .map(([name, d]) => ({ name, count: d.count, refundAmount: d.refundAmount }))
      .sort((a, b) => b.refundAmount - a.refundAmount);
  }, [filteredAfterSaleRecords, hasIndependentData]);

  // ========== 高售后商品预警 ==========
  const highRiskProducts = useMemo(() => {
    if (!hasIndependentData) return [];
    const productMap: Record<string, { name: string; productId: string; afterSaleCount: number; orderCount: number; refundAmount: number }> = {};
    filteredAfterSaleRecords.forEach((r: any) => {
      const pid = String(r['商品ID'] || '').trim();
      if (!pid) return;
      if (!productMap[pid]) {
        const sku = String(r['sku信息'] || '').split(',')[0] || pid;
        productMap[pid] = { name: sku.slice(0, 25), productId: pid, afterSaleCount: 0, orderCount: 0, refundAmount: 0 };
      }
      productMap[pid].afterSaleCount++;
      productMap[pid].refundAmount += safeFloat(r['退款金额']);
    });
    filteredOrders.forEach((o: any) => {
      const pid = String(o['商品id'] || o['商品ID'] || '').trim();
      if (productMap[pid]) productMap[pid].orderCount++;
    });
    return Object.values(productMap)
      .map(p => ({ ...p, afterSaleRate: p.orderCount > 0 ? (p.afterSaleCount / p.orderCount) * 100 : 0 }))
      .filter(p => p.afterSaleRate > 10)
      .sort((a, b) => b.afterSaleRate - a.afterSaleRate);
  }, [filteredAfterSaleRecords, filteredOrders, hasIndependentData]);

  // ========== 售后明细列表 ==========
  const filteredRecords = useMemo(() => {
    if (!hasIndependentData) return [];
    return filteredAfterSaleRecords.filter((r: any) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const fields = ['订单编号', '商品ID', 'sku信息', '售后编号', '备注'].map(k => String(r[k] || '').toLowerCase());
        if (!fields.some(f => f.includes(q))) return false;
      }
      if (statusFilter !== 'all' && !String(r['售后状态'] || '').includes(statusFilter)) return false;
      if (typeFilter !== 'all' && !String(r['退款类型'] || '').includes(typeFilter)) return false;
      return true;
    });
  }, [filteredAfterSaleRecords, hasIndependentData, searchQuery, statusFilter, typeFilter]);

  const totalPages = Math.ceil(filteredRecords.length / pageSize);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const getProcessHours = (r: any): string => {
    const applyTime = String(r['申请时间'] || '');
    const agreeTime = String(r['同意退款时间'] || '');
    if (!applyTime || !agreeTime) return '-';
    const hours = (new Date(agreeTime).getTime() - new Date(applyTime).getTime()) / 3600000;
    if (hours < 0 || hours > 720) return '-';
    return hours < 1 ? `${Math.round(hours * 60)}分钟` : `${hours.toFixed(1)}h`;
  };

  const exportCSV = () => {
    const headers = ['售后编号', '订单编号', '商品ID', 'SKU信息', '退款金额', '售后状态', '退款类型', '退款原因', '订单状态', '申请时间', '同意退款人', '退货物流状态', '备注', '订单标记', '处理时长'];
    const rows = filteredRecords.map((r: any) => [
      r['售后编号'], r['订单编号'], r['商品ID'], r['sku信息'],
      r['退款金额'], r['售后状态'], r['退款类型'], r['退款原因'],
      r['订单状态'], r['申请时间'], r['同意退款人'], r['退货物流状态'],
      r['备注'], r['订单标记'], getProcessHours(r)
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.map(v => `"${String(v || '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `售后数据_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const badgeColor = (rate: number) => rate > 30 ? 'bg-pdd-danger/10 text-red-700' : rate > 15 ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-success/10 text-green-700';
  const badgeLabel = (rate: number) => rate > 30 ? '高风险' : rate > 15 ? '中风险' : '低风险';

  if (!hasIndependentData && orders.length === 0) {
    return <div className="p-4"><div className="pdd-card text-center py-12"><p className="text-[var(--pdd-text-secondary)]">请先上传订单数据或售后数据</p></div></div>;
  }

  const kpis = [
    { label: '售后订单数', value: kpiData.afterSaleCount, fmt: (v: number) => v.toString(), icon: ShieldCheck, color: 'var(--pdd-danger)' },
    { label: '售后率', value: kpiData.afterSaleRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: AlertTriangle, color: 'var(--pdd-warning)' },
    { label: '退款总金额', value: kpiData.refundAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
    { label: '平均处理时长', value: kpiData.avgProcessTime, fmt: (v: number) => v > 0 ? `${v.toFixed(1)}h` : '-', icon: Clock, color: 'var(--pdd-primary)' },
    { label: '退货退款率', value: kpiData.returnRefundRate, fmt: (v: number) => `${v.toFixed(1)}%`, icon: RotateCcw, color: 'var(--pdd-purple)' },
  ];

  const tabs: { key: TabKey; label: string; icon: any }[] = [
    { key: 'overview', label: '概览', icon: TrendingUp },
    { key: 'efficiency', label: '处理时效', icon: Clock },
    { key: 'logistics', label: '退货物流', icon: Truck },
    { key: 'sku', label: 'SKU拆解', icon: Tag },
    { key: 'risk', label: '高风险商品', icon: AlertTriangle },
    { key: 'detail', label: '明细列表', icon: FileText },
  ];

  // ========== Tab: 概览 ==========
  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-4">
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
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无趋势数据</div>}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-4">
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
                    <span className="truncate max-w-[100px]">{r.name}</span>
                    <span className="font-mono text-[var(--pdd-text-secondary)]">{r.value}次</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-[200px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无原因数据</div>}
        </motion.div>
      </div>
    </div>
  );

  // ========== Tab: 处理时效 ==========
  const renderEfficiency = () => (
    <div className="space-y-4">
      {/* 时效KPI */}
      <div className="grid grid-cols-3 gap-3">
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">平均处理时长</p>
          <p className="text-2xl font-bold text-[var(--pdd-primary)]">{efficiencyData.avgHours > 0 ? `${efficiencyData.avgHours.toFixed(1)}h` : '-'}</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">超时未处理（&gt;24h）</p>
          <p className="text-2xl font-bold text-pdd-danger">{efficiencyData.overtimeCount}<span className="text-sm font-normal text-[var(--pdd-text-secondary)] ml-1">({efficiencyData.overtimeRate.toFixed(1)}%)</span></p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">有效处理记录</p>
          <p className="text-2xl font-bold text-[var(--pdd-success)]">{efficiencyData.handlerRank.reduce((s, h) => s + h.count, 0)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* 处理时长分布 */}
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock size={16} className="text-[var(--pdd-danger)]" />处理时长分布</h4>
          {efficiencyData.durationDist.some(d => d.value > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={efficiencyData.durationDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                  {efficiencyData.durationDist.map((_, i) => <Cell key={i} fill={['var(--pdd-success)', 'var(--pdd-primary)', 'var(--pdd-warning)', 'var(--pdd-danger)'][i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : <div className="h-[220px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无数据</div>}
        </div>

        {/* 处理人效率排名 */}
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users size={16} className="text-[var(--pdd-danger)]" />处理人效率排名</h4>
          {efficiencyData.handlerRank.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                  <th className="py-2 text-left">处理人</th>
                  <th className="py-2 text-right">处理数量</th>
                  <th className="py-2 text-right">平均时长</th>
                  <th className="py-2 text-center">效率</th>
                </tr></thead>
                <tbody>
                  {efficiencyData.handlerRank.slice(0, 10).map((h, i) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-2 truncate max-w-[120px]">{h.name}</td>
                      <td className="py-2 text-right font-mono">{h.count}</td>
                      <td className="py-2 text-right font-mono">{h.avgHours.toFixed(1)}h</td>
                      <td className="py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] ${h.avgHours <= 2 ? 'bg-pdd-success/10 text-green-700' : h.avgHours <= 6 ? 'bg-pdd-info/10 text-blue-700' : h.avgHours <= 24 ? 'bg-pdd-warning/10 text-yellow-700' : 'bg-pdd-danger/10 text-red-700'}`}>
                          {h.avgHours <= 2 ? '极快' : h.avgHours <= 6 ? '正常' : h.avgHours <= 24 ? '偏慢' : '超时'}
                        </span>
                      </td>
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

  // ========== Tab: 退货物流 ==========
  const renderLogistics = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">退货包裹数</p>
          <p className="text-2xl font-bold text-[var(--pdd-primary)]">{logisticsData.totalReturns}</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">快递拦截成功率</p>
          <p className="text-2xl font-bold text-[var(--pdd-success)]">{logisticsData.interceptRate > 0 ? `${logisticsData.interceptRate.toFixed(1)}%` : '-'}</p>
        </div>
        <div className="pdd-card px-4 py-3">
          <p className="text-xs text-[var(--pdd-text-secondary)]">平均退货物流时效</p>
          <p className="text-2xl font-bold text-[var(--pdd-warning)]">{logisticsData.avgReturnDays > 0 ? `${logisticsData.avgReturnDays.toFixed(1)}天` : '-'}</p>
        </div>
      </div>

      <div className="pdd-card p-4">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Truck size={16} className="text-[var(--pdd-danger)]" />退货物流状态分布</h4>
        {logisticsData.statusDist.length > 0 ? (
          <div className="flex items-start gap-6">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={logisticsData.statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name.slice(0, 8)} ${(percent * 100).toFixed(0)}%`} fontSize={10}>
                    {logisticsData.statusDist.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-1 max-h-[250px] overflow-y-auto">
              {logisticsData.statusDist.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-[var(--pdd-border)]">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span>{s.name}</span>
                  </div>
                  <span className="font-mono text-[var(--pdd-text-secondary)]">{s.value}件</span>
                </div>
              ))}
            </div>
          </div>
        ) : <div className="h-[250px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无退货物流数据</div>}
      </div>
    </div>
  );

  // ========== Tab: SKU拆解 ==========
  const renderSku = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {/* SKU退款金额TOP10 */}
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

        {/* SKU售后次数表格 */}
        <div className="pdd-card p-4">
          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-[var(--pdd-danger)]" />SKU售后次数排名</h4>
          {skuBreakdown.length > 0 ? (
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)] sticky top-0 bg-pdd-card z-10">
                  <th className="py-2 text-left">SKU信息</th>
                  <th className="py-2 text-right">售后次数</th>
                  <th className="py-2 text-right">退款金额</th>
                </tr></thead>
                <tbody>
                  {[...skuBreakdown].sort((a, b) => b.count - a.count).slice(0, 15).map((s, i) => (
                    <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                      <td className="py-2 truncate max-w-[200px]" title={s.name}>{s.name}</td>
                      <td className="py-2 text-right font-mono text-pdd-danger">{s.count}</td>
                      <td className="py-2 text-right font-mono">¥{s.refundAmount.toFixed(0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <div className="h-[300px] flex items-center justify-center text-sm text-[var(--pdd-text-secondary)]">暂无SKU数据</div>}
        </div>
      </div>
    </div>
  );

  // ========== Tab: 高风险商品 ==========
  const renderRisk = () => (
    <div className="pdd-card p-4">
      <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle size={16} className="text-pdd-danger" />高售后商品预警（售后率 &gt; 10%）</h4>
      {highRiskProducts.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
              <th className="py-2 text-left">商品名称</th>
              <th className="py-2 text-left">商品ID</th>
              <th className="py-2 text-right">订单数</th>
              <th className="py-2 text-right">售后数</th>
              <th className="py-2 text-right">售后率</th>
              <th className="py-2 text-right">退款金额</th>
              <th className="py-2 text-center">风险等级</th>
            </tr></thead>
            <tbody>
              {highRiskProducts.slice(0, 20).map((p, i) => (
                <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                  <td className="py-2 truncate max-w-[200px]">{p.name}</td>
                  <td className="py-2 font-mono text-[10px]">{p.productId}</td>
                  <td className="py-2 text-right">{p.orderCount}</td>
                  <td className="py-2 text-right text-pdd-danger">{p.afterSaleCount}</td>
                  <td className="py-2 text-right font-mono">{p.afterSaleRate.toFixed(1)}%</td>
                  <td className="py-2 text-right font-mono">¥{p.refundAmount.toFixed(0)}</td>
                  <td className="py-2 text-center"><span className={`px-2 py-0.5 rounded text-[10px] ${badgeColor(p.afterSaleRate)}`}>{badgeLabel(p.afterSaleRate)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <div className="py-8 text-center text-sm text-[var(--pdd-text-secondary)]">暂无高售后商品</div>}
    </div>
  );

  // ========== Tab: 明细列表 ==========
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
            <option value="退款成功">退款成功</option>
            <option value="待处理">待处理</option>
            <option value="处理中">处理中</option>
          </select>
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setCurrentPage(1); }} className="text-xs border border-[var(--pdd-border)] rounded-lg px-2 py-1.5">
            <option value="all">全部类型</option>
            <option value="退款">仅退款</option>
            <option value="退货退款">退货退款</option>
          </select>
          <button onClick={exportCSV} className="flex items-center gap-1 px-3 py-1.5 bg-pdd-success text-white rounded-lg text-xs hover:bg-pdd-success transition-colors"><Download size={14} />导出</button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
            <th className="py-2 text-left">售后编号</th>
            <th className="py-2 text-left">订单编号</th>
            <th className="py-2 text-left">商品ID</th>
            <th className="py-2 text-left">SKU信息</th>
            <th className="py-2 text-right">退款金额</th>
            <th className="py-2 text-center">售后状态</th>
            <th className="py-2 text-left">退款原因</th>
            <th className="py-2 text-left">订单状态</th>
            <th className="py-2 text-left">申请时间</th>
            <th className="py-2 text-left">同意退款人</th>
            <th className="py-2 text-left">退货物流</th>
            <th className="py-2 text-left">备注</th>
            <th className="py-2 text-right">处理时长</th>
          </tr></thead>
          <tbody>
            {paginatedRecords.map((r: any, i: number) => (
              <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                <td className="py-2 font-mono text-[10px]">{String(r['售后编号'] || '').slice(-8)}</td>
                <td className="py-2 font-mono text-[10px]">{String(r['订单编号'] || '').slice(-10)}</td>
                <td className="py-2 font-mono text-[10px]">{r['商品ID']}</td>
                <td className="py-2 truncate max-w-[120px]" title={r['sku信息']}>{String(r['sku信息'] || '-').slice(0, 25)}</td>
                <td className="py-2 text-right font-mono text-pdd-danger">¥{safeFloat(r['退款金额']).toFixed(2)}</td>
                <td className="py-2 text-center"><span className="px-2 py-0.5 rounded text-[10px] bg-[var(--pdd-bg)] text-pdd-danger">{String(r['售后状态'] || '-').slice(0, 6)}</span></td>
                <td className="py-2 text-[10px] truncate max-w-[80px]">{r['退款原因'] || '-'}</td>
                <td className="py-2 text-[10px]">{String(r['订单状态'] || '-').slice(0, 6)}</td>
                <td className="py-2 text-[10px]">{String(r['申请时间'] || '-').slice(0, 16)}</td>
                <td className="py-2 text-[10px] truncate max-w-[80px]">{String(r['同意退款人'] || '-').slice(0, 12)}</td>
                <td className="py-2 text-[10px] truncate max-w-[80px]">{String(r['退货物流状态'] || '-').slice(0, 10)}</td>
                <td className="py-2 text-[10px] truncate max-w-[80px]" title={r['备注']}>{String(r['备注'] || '-').slice(0, 15)}</td>
                <td className="py-2 text-right text-[10px]">{getProcessHours(r)}</td>
              </tr>
            ))}
            {paginatedRecords.length === 0 && (
              <tr><td colSpan={13} className="py-8 text-center text-[var(--pdd-text-secondary)]">暂无匹配记录</td></tr>
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
    </div>
  );

  return (
    <div className="p-4 space-y-4">
      <TimeFilter state={tfState} />

      {/* KPI 卡片 */}
      <div className="grid grid-cols-5 gap-3">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="pdd-card px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${k.color}15` }}>
              <k.icon size={20} color={k.color} />
            </div>
            <div>
              <p className="text-xs text-[var(--pdd-text-secondary)]">{k.label}</p>
              <p className="text-xl font-bold" style={{ color: k.color }}>{k.fmt(k.value)}</p>
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
      {activeTab === 'efficiency' && renderEfficiency()}
      {activeTab === 'logistics' && renderLogistics()}
      {activeTab === 'sku' && renderSku()}
      {activeTab === 'risk' && renderRisk()}
      {activeTab === 'detail' && renderDetail()}

      {/* 付费功能 */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-4 relative">
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2"><Star size={16} />售后满意度分析 {!isPaid && <Lock size={14} className="text-[var(--pdd-text-secondary)]" />}</h4>
        {!isPaid ? (
          <div className="h-24 flex items-center justify-center bg-[rgba(248,250,252,0.8)] rounded-lg">
            <div className="text-center"><Crown size={24} color="var(--pdd-danger)" className="mx-auto mb-2" /><p className="text-sm text-[var(--pdd-text-secondary)]">升级会员解锁满意度分析</p></div>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 text-center">
            <div><p className="text-2xl font-bold text-[var(--pdd-success)]">4.8</p><p className="text-xs text-[var(--pdd-text-secondary)]">满意度评分</p></div>
            <div><p className="text-2xl font-bold text-[var(--pdd-primary)]">92%</p><p className="text-xs text-[var(--pdd-text-secondary)]">解决率</p></div>
            <div><p className="text-2xl font-bold text-[var(--pdd-warning)]">24h</p><p className="text-xs text-[var(--pdd-text-secondary)]">平均响应</p></div>
            <div><p className="text-2xl font-bold text-[var(--pdd-danger)]">98%</p><p className="text-xs text-[var(--pdd-text-secondary)]">好评率</p></div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

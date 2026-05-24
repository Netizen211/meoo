import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ComposedChart, Area, AreaChart } from 'recharts';
import { DollarSign, Percent, Truck, TrendingUp, AlertTriangle, Filter, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { useData, useAuth } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, changePct, formatLabel } from '../components/TimeFilter';
import AmountFilterPanel, { FilterField, FilterValues, createEmptyFilters, applyAmountFilters } from '../components/AmountFilterPanel';

const COST_FILTER_FIELDS: FilterField[] = [
  { key: 'actualPay', label: '买家实付金额', hint: '用户实付', group: 'basic', compute: (o) => safeFloat(o['用户实付金额(元)']) },
  { key: 'actualReceive', label: '实收金额(剔除退款)', hint: '仅非退款', group: 'basic', compute: (o) => safeFloat(o['商家实收金额(元)']), filterLogic: 'exclude_refund' },
  { key: 'refundAmount', label: '买家退款金额', hint: '仅退款单', group: 'basic', compute: (o) => safeFloat(o['用户实付金额(元)']), filterLogic: 'only_refund' },
  { key: 'productTotal', label: '商品总价', group: 'basic', compute: (o) => safeFloat(o['商品总价(元)']) },
  { key: 'postage', label: '邮费金额', group: 'basic', compute: (o) => safeFloat(o['邮费(元)']) },
  { key: 'discountTotal', label: '优惠总额', hint: '三项合计', group: 'discount', compute: (o) => safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)']) },
  { key: 'shopDiscount', label: '店铺优惠折扣', group: 'discount', compute: (o) => safeFloat(o['店铺优惠折扣(元)']) },
  { key: 'platDiscount', label: '平台优惠折扣', group: 'discount', compute: (o) => safeFloat(o['平台优惠折扣(元)']) },
  { key: 'discountRate', label: '优惠率', hint: '%', group: 'discount', compute: (o) => { const pt = safeFloat(o['商品总价(元)']); if (!pt) return 0; return ((safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)'])) / pt) * 100; } },
  { key: 'recvRate', label: '实收率', hint: '%', group: 'cost', compute: (o) => { const pt = safeFloat(o['商品总价(元)']); if (!pt) return 0; return (safeFloat(o['商家实收金额(元)']) / pt) * 100; } },
];

const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', '#722ed1', 'var(--pdd-danger)'];

export default function CostPage() {
  const { currentDisplayData } = useData();
  const { isPaid } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState('date');
  const [sortDesc, setSortDesc] = useState(true);
  const [amountFilters, setAmountFilters] = useState<FilterValues>(createEmptyFilters(COST_FILTER_FIELDS));
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

  const validOrders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(validOrders), [validOrders]);
  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(validOrders, allDates, timeRange);
    result = applyAmountFilters(result, COST_FILTER_FIELDS, amountFilters);
    return result;
  }, [validOrders, allDates, timeRange, amountFilters]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(validOrders, allDates, timeRange) : [], [validOrders, allDates, timeRange, compareEnabled]);

  const kpi = useMemo(() => {
    if (!filteredOrders.length) return null;
    const totalProduct = filteredOrders.reduce((s, o) => s + safeFloat(o['商品总价(元)']), 0);
    const totalPostage = filteredOrders.reduce((s, o) => s + safeFloat(o['邮费(元)']), 0);
    const totalShopDisc = filteredOrders.reduce((s, o) => s + safeFloat(o['店铺优惠折扣(元)']), 0);
    const totalPlatDisc = filteredOrders.reduce((s, o) => s + safeFloat(o['平台优惠折扣(元)']), 0);
    const totalDuoDuo = filteredOrders.reduce((s, o) => s + safeFloat(o['多多支付立减金额(元)']), 0);
    const totalUserPay = filteredOrders.reduce((s, o) => s + safeFloat(o['用户实付金额(元)']), 0);
    const totalMerchant = filteredOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const totalDisc = totalShopDisc + totalPlatDisc + totalDuoDuo;
    const discRate = totalProduct > 0 ? (totalDisc / totalProduct) * 100 : 0;
    const recvRate = totalProduct > 0 ? (totalMerchant / totalProduct) * 100 : 0;
    const freePostRate = filteredOrders.length > 0 ? (filteredOrders.filter(o => safeFloat(o['邮费(元)']) === 0).length / filteredOrders.length) * 100 : 0;
    const avgDisc = filteredOrders.length > 0 ? totalDisc / filteredOrders.length : 0;
    const highDiscCount = filteredOrders.filter(o => (safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)'])) / safeFloat(o['商品总价(元)']) > 0.3).length;
    return { totalProduct, totalPostage, totalShopDisc, totalPlatDisc, totalDuoDuo, totalUserPay, totalMerchant, totalDisc, discRate, recvRate, freePostRate, avgDisc, highDiscCount };
  }, [filteredOrders]);

  const compareKpi = useMemo(() => {
    if (!compareOrders.length) return null;
    const totalMerchant = compareOrders.reduce((s, o) => s + safeFloat(o['商家实收金额(元)']), 0);
    const totalDisc = compareOrders.reduce((s, o) => s + safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) + safeFloat(o['多多支付立减金额(元)']), 0);
    const totalProduct = compareOrders.reduce((s, o) => s + safeFloat(o['商品总价(元)']), 0);
    return { totalMerchant, totalDisc, recvRate: totalProduct > 0 ? (totalMerchant / totalProduct) * 100 : 0 };
  }, [compareOrders]);

  const dailyData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const byDate: Record<string, any> = {};
    filteredOrders.forEach(o => {
      const d = String(o['支付时间'] || '').split(' ')[0];
      if (!d) return;
      if (!byDate[d]) byDate[d] = { date: d.slice(5), product: 0, postage: 0, shopDisc: 0, platDisc: 0, duoDuo: 0, userPay: 0, merchant: 0, count: 0 };
      byDate[d].product += safeFloat(o['商品总价(元)']);
      byDate[d].postage += safeFloat(o['邮费(元)']);
      byDate[d].shopDisc += safeFloat(o['店铺优惠折扣(元)']);
      byDate[d].platDisc += safeFloat(o['平台优惠折扣(元)']);
      byDate[d].duoDuo += safeFloat(o['多多支付立减金额(元)']);
      byDate[d].userPay += safeFloat(o['用户实付金额(元)']);
      byDate[d].merchant += safeFloat(o['商家实收金额(元)']);
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
      const product = safeFloat(o['商品总价(元)']);
      const disc = safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']);
      const rate = product > 0 ? disc / product : 0;
      if (rate === 0) counts[0]++;
      else if (rate <= 0.1) counts[1]++;
      else if (rate <= 0.2) counts[2]++;
      else if (rate <= 0.3) counts[3]++;
      else counts[4]++;
    });
    return ranges.map((r, i) => ({ range: r, count: counts[i], rate: filteredOrders.length > 0 ? (counts[i] / filteredOrders.length * 100).toFixed(1) : 0 }));
  }, [filteredOrders]);

  const costStructure = useMemo(() => {
    if (!kpi) return [];
    return [
      { name: '商家实收', value: kpi.totalMerchant, color: 'var(--pdd-success)' },
      { name: '优惠总额', value: kpi.totalDisc, color: 'var(--pdd-warning)' },
      { name: '邮费成本', value: kpi.totalPostage, color: 'var(--pdd-primary)' },
    ];
  }, [kpi]);

  const anomalies = useMemo(() => {
    if (!filteredOrders.length) return [];
    return filteredOrders.filter(o => {
      const discRate = safeFloat(o['商品总价(元)']) > 0 ? (safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)'])) / safeFloat(o['商品总价(元)']) : 0;
      return discRate > 0.5 || safeFloat(o['邮费(元)']) > 20;
    }).slice(0, 10).map(o => ({
      orderNo: String(o['订单号'] || '').slice(-8),
      product: String(o['商品'] || '').slice(0, 15),
      discRate: safeFloat(o['商品总价(元)']) > 0 ? ((safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)'])) / safeFloat(o['商品总价(元)']) * 100).toFixed(1) : 0,
      postage: safeFloat(o['邮费(元)']),
      merchant: safeFloat(o['商家实收金额(元)']),
    }));
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
  const fmt = (v: number) => v >= 10000 ? `¥${(v / 10000).toFixed(1)}万` : `¥${v.toFixed(0)}`;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tfState} />
      <AmountFilterPanel fields={COST_FILTER_FIELDS} filters={amountFilters} onFiltersChange={setAmountFilters} />

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: '商品总价', value: kpi?.totalProduct, icon: DollarSign, color: 'var(--pdd-text)' },
          { label: '优惠总额', value: kpi?.totalDisc, icon: Percent, color: 'var(--pdd-danger)' },
          { label: '商家实收', value: kpi?.totalMerchant, icon: TrendingUp, color: 'var(--pdd-success)', change: compareEnabled ? changePct(kpi?.totalMerchant || 0, compareKpi?.totalMerchant || 0) : null },
          { label: '实收率', value: kpi?.recvRate, icon: Percent, color: 'var(--pdd-primary)', isRate: true },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="pdd-card px-3 py-2 flex items-center gap-2">
            <c.icon size={14} color={c.color} />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-[var(--pdd-text-secondary)]">{c.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold" style={{ color: c.color }}>
                  {noData ? '--' : c.value != null ? (c.isRate ? `${c.value.toFixed(1)}%` : fmt(c.value)) : '--'}
                </span>
                {c.change != null && Math.abs(c.change) > 0.01 && (
                  <span className={`text-xs ${c.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                    {c.change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(c.change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">成本结构分布</h3>
          {noData ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={costStructure} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {costStructure.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => fmt(v)} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="pdd-card p-3">
          <h3 className="text-sm font-semibold mb-2">优惠类型占比</h3>
          {noData || !discPie.length ? <div className="h-40 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={discPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {discPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2">优惠敏感度分析</h3>
        {noData ? <div className="h-32 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={discSensitivity}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="range" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--pdd-primary-light)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pdd-card p-3">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1"><AlertTriangle size={14} color="var(--pdd-danger)" />成本异常检测</h3>
        {noData || !anomalies.length ? <div className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">无异常订单</div> : (
          <table className="w-full text-xs">
            <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
              <th className="py-1.5 text-left">订单</th><th className="py-1.5 text-left">商品</th><th className="py-1.5 text-right">优惠率</th><th className="py-1.5 text-right">邮费</th><th className="py-1.5 text-right">实收</th>
            </tr></thead>
            <tbody>{anomalies.map((a, i) => (
              <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                <td className="py-1.5 font-mono">{a.orderNo}</td>
                <td className="py-1.5 truncate max-w-[120px]">{a.product}</td>
                <td className="py-1.5 text-right text-[var(--pdd-danger)]">{a.discRate}%</td>
                <td className="py-1.5 text-right">¥{a.postage.toFixed(0)}</td>
                <td className="py-1.5 text-right">¥{a.merchant.toFixed(0)}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">成本明细</h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-[var(--pdd-bg)] rounded-lg px-2 py-1">
              <Search size={12} className="text-[var(--pdd-text-secondary)]" />
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索日期..." className="text-xs outline-none bg-transparent w-24" />
            </div>
          </div>
        </div>
        {noData ? <div className="h-20 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">无数据</div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-[var(--pdd-text-secondary)] border-b border-[var(--pdd-border)]">
                {['date', 'product', 'disc', 'postage', 'merchant', 'recvRate'].map(f => (
                  <th key={f} onClick={() => { setSortField(f); setSortDesc(sortField === f ? !sortDesc : true); }} className="py-1.5 px-2 text-left cursor-pointer hover:text-[var(--pdd-danger)]">
                    {f === 'date' ? '日期' : f === 'product' ? '商品价' : f === 'disc' ? '优惠' : f === 'postage' ? '邮费' : f === 'merchant' ? '实收' : '实收率'}
                    {sortField === f && (sortDesc ? '↓' : '↑')}
                  </th>
                ))}
              </tr></thead>
              <tbody>{filteredTableData.map((d: any, i: number) => (
                <tr key={i} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]">
                  <td className="py-1.5 px-2">{d.date}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(d.product)}</td>
                  <td className="py-1.5 px-2 text-right text-[var(--pdd-warning)]">{fmt(d.shopDisc + d.platDisc + d.duoDuo)}</td>
                  <td className="py-1.5 px-2 text-right">{fmt(d.postage)}</td>
                  <td className="py-1.5 px-2 text-right font-semibold">{fmt(d.merchant)}</td>
                  <td className="py-1.5 px-2 text-right">{d.product > 0 ? ((d.merchant / d.product) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ShieldCheck, Percent, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../App';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, aggregateByGranularity, changePct, formatLabel } from '../components/TimeFilter';

const cardV = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1 } }) };

export default function InsurancePage() {
  const { currentDisplayData } = useData();
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

  const data = currentDisplayData?.shippingInsurance || [];
  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => String(o['订单状态'] || '').trim() !== '已取消');
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange), [orders, allDates, timeRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange) : [], [orders, allDates, timeRange, compareEnabled]);

  const filteredData = useMemo(() => {
    if (!filteredOrders.length || !data.length) return data;
    const orderIds = new Set(filteredOrders.map((o: any) => String(o['订单号'] || '').trim()));
    return data.filter((o: any) => orderIds.has(String(o['订单号'] || '').trim()));
  }, [filteredOrders, data]);

  const compareData = useMemo(() => {
    if (!compareOrders.length || !data.length) return [];
    const orderIds = new Set(compareOrders.map((o: any) => String(o['订单号'] || '').trim()));
    return data.filter((o: any) => orderIds.has(String(o['订单号'] || '').trim()));
  }, [compareOrders, data]);

  const totalCost = useMemo(() => filteredData.reduce((s: number, o: any) => s + safeFloat(o['服务费用（元）']), 0), [filteredData]);
  const compareCost = useMemo(() => compareData.reduce((s: number, o: any) => s + safeFloat(o['服务费用（元）']), 0), [compareData]);
  const gmv = useMemo(() => filteredOrders.reduce((s: number, o: any) => s + safeFloat(o['商品总价(元)']), 0), [filteredOrders]);
  const costRatio = gmv > 0 ? (totalCost / gmv) * 100 : 0;
  const compensated = filteredData.filter((o: any) => o['运费补偿状态'] && o['运费补偿状态'] !== '无').length;
  const compRate = filteredData.length > 0 ? (compensated / filteredData.length) * 100 : 0;

  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';
  const granLabel = granularity === 'day' ? '按日' : granularity === 'week' ? '按周' : '按月';

  const trend = useMemo(() => {
    const byDate: Record<string, number> = {};
    filteredData.forEach((o: any) => {
      const d = (o['订单发货时间'] || '').split(' ')[0] || (o['运费补偿生效时间'] || '').split(' ')[0];
      if (d) byDate[d] = (byDate[d] || 0) + (parseFloat(o['服务费用（元）']) || 0);
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, v]) => ({ date: d.slice(5), value: Math.round(v * 100) / 100 }));
  }, [filteredData]);

  const compareTrend = useMemo(() => {
    if (!compareEnabled || !compareData.length) return [];
    const byDate: Record<string, number> = {};
    compareData.forEach((o: any) => {
      const d = (o['订单发货时间'] || '').split(' ')[0] || (o['运费补偿生效时间'] || '').split(' ')[0];
      if (d) byDate[d] = (byDate[d] || 0) + (parseFloat(o['服务费用（元）']) || 0);
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, v]) => ({ date: d.slice(5), prevValue: Math.round(v * 100) / 100 }));
  }, [compareData, compareEnabled]);

  const mergedTrend = useMemo(() => {
    if (!compareEnabled) return trend;
    const maxLen = Math.max(trend.length, compareTrend.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({ date: (trend[i] || compareTrend[i] || {}).date || '', value: (trend[i] || {}).value || 0, prevValue: (compareTrend[i] || {}).prevValue || 0 });
    }
    return result;
  }, [trend, compareTrend, compareEnabled]);

  const statusDist = useMemo(() => {
    const charge: Record<string, number> = {};
    const comp: Record<string, number> = {};
    filteredData.forEach((o: any) => {
      const cs = o['收费状态'] || '未知';
      charge[cs] = (charge[cs] || 0) + 1;
      const cc = o['运费补偿状态'] || '未知';
      comp[cc] = (comp[cc] || 0) + 1;
    });
    return { charge, comp };
  }, [filteredData]);

  const noData = filteredData.length === 0;

  const kpiCards = [
    { label: '运费险总费用', value: `¥${totalCost.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-danger)', change: compareEnabled ? changePct(totalCost, compareCost) : null },
    { label: '费用占比', value: `${costRatio.toFixed(2)}%`, icon: Percent, color: 'var(--pdd-warning)', change: null },
    { label: '运费补偿率', value: `${compRate.toFixed(1)}%`, icon: ShieldCheck, color: 'var(--pdd-success)', change: null },
  ];

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tfState} />
      <div className="grid grid-cols-3 gap-3">
        {kpiCards.map((c, i) => (
          <motion.div key={c.label} custom={i} variants={cardV} initial="hidden" animate="visible"
            className="pdd-card flex flex-col items-center py-4">
            <div className="flex items-center gap-2 mb-1"><c.icon size={16} color={c.color} /><span className="text-xs text-[var(--pdd-text-secondary)]">{c.label}</span></div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold" style={{ color: c.color }}>{noData ? '--' : c.value}</span>
              {c.change != null && Math.abs(c.change) > 0.01 && (
                <span className={`text-xs font-medium ${c.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                  {c.change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(c.change).toFixed(1)}%
                </span>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="pdd-card">
        <h3 className="text-sm font-semibold mb-2">运费险费用趋势({rangeLabel} · {granLabel}){compareEnabled && <span className="text-xs text-[#722ed1] ml-1">+环比</span>}</h3>
        {noData ? <div className="h-48 flex items-center justify-center text-xs text-[var(--pdd-text-secondary)]">请先上传运费险数据</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mergedTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number, name: string) => [`¥${v}`, name]} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="value" stroke="var(--pdd-primary-light)" strokeWidth={2} dot={{ fill: 'var(--pdd-primary-light)', r: 3 }} name="保费费用" />
              {compareEnabled && <Line type="monotone" dataKey="prevValue" stroke="var(--pdd-primary-light)" strokeWidth={1.5} strokeDasharray="4 2" dot={{ r: 2 }} name="对比费用" />}
            </LineChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="pdd-card">
        <h3 className="text-sm font-semibold mb-2">状态分布({rangeLabel})</h3>
        {noData ? <p className="text-xs text-[var(--pdd-text-secondary)] text-center py-4">暂无数据</p> : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium mb-1.5">收费状态</p>
              {Object.entries(statusDist.charge).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 text-xs"><span>{k}</span><span className="text-[var(--pdd-text-secondary)]">{v}条</span></div>
              ))}
            </div>
            <div>
              <p className="text-xs font-medium mb-1.5">运费补偿状态</p>
              {Object.entries(statusDist.comp).map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 text-xs"><span>{k}</span><span className="text-[var(--pdd-text-secondary)]">{v}条</span></div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
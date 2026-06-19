import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ShieldCheck, Percent, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { useData } from '../App';
import { findField } from '../utils';
import TimeFilter, { TimeRange, TimeGranularity, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, aggregateByGranularity, changePct, formatLabel, useTimeFilter } from '../components/TimeFilter';
import FilterToolbar from '../components/FilterToolbar';

const cardV = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1 } }) };

export default function InsurancePage() {
  const { currentDisplayData } = useData();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, useNaturalDate, setUseNaturalDate, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;
  const [insPage, setInsPage] = useState(1);
  const [insDetail, setInsDetail] = useState<any>(null);
  const insPageSize = 12;

  const data = currentDisplayData?.shippingInsurance || [];
  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => { const st = String(findField(o, '订单状态', '状态') || '').trim(); return !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st); });
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange, useNaturalDate), [orders, allDates, timeRange, customStart, customEnd, quickRange]);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [orders, allDates, timeRange, compareEnabled, compareStart, compareEnd, customStart, customEnd, quickRange]);

  const filteredData = useMemo(() => {
    if (!data.length) return [];
    if (!filteredOrders.length) return data;
    const orderIds = new Set(filteredOrders.map((o: any) => String(findField(o, '订单号') || '').trim()));
    return data.filter((o: any) => {
      const insOrderNo = String(findField(o, '订单编号', '订单号') || '').trim();
      return insOrderNo && orderIds.has(insOrderNo);
    });
  }, [filteredOrders, data]);

  const compareData = useMemo(() => {
    if (!compareOrders.length || !data.length) return [];
    const orderIds = new Set(compareOrders.map((o: any) => String(findField(o, '订单号') || '').trim()));
    return data.filter((o: any) => {
      const insOrderNo = String(findField(o, '订单编号', '订单号') || '').trim();
      return insOrderNo && orderIds.has(insOrderNo);
    });
  }, [compareOrders, data]);

  const totalCost = useMemo(() => filteredData.reduce((s: number, o: any) => s + safeFloat(findField(o, '服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)')), 0), [filteredData]);
  const compareCost = useMemo(() => compareData.reduce((s: number, o: any) => s + safeFloat(findField(o, '服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)')), 0), [compareData]);
  const gmv = useMemo(() => filteredOrders.reduce((s: number, o: any) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0), [filteredOrders]);
  const costRatio = gmv > 0 ? (totalCost / gmv) * 100 : 0;
  const compensated = filteredData.filter((o: any) => {
    const s = String(findField(o, '运费补偿状态', '补偿状态', '理赔状态') || '');
    return s && s !== '无';
  }).length;
  const compRate = filteredData.length > 0 ? (compensated / filteredData.length) * 100 : 0;

  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';
  const granLabel = granularity === 'day' ? '按日' : granularity === 'week' ? '按周' : '按月';

  const trend = useMemo(() => {
    const byDate: Record<string, number> = {};
    filteredData.forEach((o: any) => {
      const d = (String(findField(o, '订单发货时间') || '')).split(' ')[0] || (String(findField(o, '运费补偿生效时间', '补偿生效时间') || '')).split(' ')[0];
      if (d) byDate[d] = (byDate[d] || 0) + safeFloat(findField(o, '服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)'));
    });
    return Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0])).slice(-14).map(([d, v]) => ({ date: d.slice(5), value: Math.round(v * 100) / 100 }));
  }, [filteredData]);

  const compareTrend = useMemo(() => {
    if (!compareEnabled || !compareData.length) return [];
    const byDate: Record<string, number> = {};
    compareData.forEach((o: any) => {
      const d = (String(findField(o, '订单发货时间') || '')).split(' ')[0] || (String(findField(o, '运费补偿生效时间', '补偿生效时间') || '')).split(' ')[0];
      if (d) byDate[d] = (byDate[d] || 0) + safeFloat(findField(o, '服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)'));
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
      const cs = String(findField(o, '收费状态') || '未知');
      charge[cs] = (charge[cs] || 0) + 1;
      const cc = String(findField(o, '运费补偿状态', '补偿状态', '理赔状态') || '未知');
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
      <FilterToolbar tf={tf} />
        {timeRange !== 'all' && timeRange !== 'custom' && (
          <div className="flex items-center rounded border border-pdd-border overflow-hidden text-[11px]">
            <button onClick={() => setUseNaturalDate(false)}
              className={`px-2 py-1 transition-colors ${!useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>按订单时间</button>
            <button onClick={() => setUseNaturalDate(true)}
              className={`px-2 py-1 transition-colors ${useNaturalDate ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>按当前时间</button>
          </div>
        )}
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
        <h3 className="text-sm font-semibold mb-2">运费险费用趋势({rangeLabel} · {granLabel}){compareEnabled && <span className="text-xs text-purple-600 ml-1">+环比</span>}</h3>
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

      {/* 运费险明细表格 */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="pdd-card p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">运费险明细 ({filteredData.length}条)</h3>
          <div className="flex items-center gap-2 text-xs text-pdd-text-secondary">
            <button onClick={() => setInsPage(Math.max(1, insPage - 1))} disabled={insPage === 1} className="px-1.5 py-0.5 rounded hover:bg-[var(--pdd-gray-200)] disabled:opacity-30">←</button>
            <span>{insPage}/{Math.max(1, Math.ceil(filteredData.length / insPageSize))}</span>
            <button onClick={() => setInsPage(Math.min(Math.ceil(filteredData.length / insPageSize), insPage + 1))} disabled={insPage >= Math.ceil(filteredData.length / insPageSize)} className="px-1.5 py-0.5 rounded hover:bg-[var(--pdd-gray-200)] disabled:opacity-30">→</button>
          </div>
        </div>
        {noData ? <p className="text-xs text-pdd-text-secondary text-center py-4">暂无数据</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
                <th className="py-1.5 text-left">订单编号</th>
                <th className="py-1.5 text-right">服务费用</th>
                <th className="py-1.5 text-left">收费状态</th>
                <th className="py-1.5 text-left">补偿状态</th>
                <th className="py-1.5 text-left">发货时间</th>
              </tr></thead>
              <tbody>
                {filteredData.slice((insPage - 1) * insPageSize, insPage * insPageSize).map((r: any, i: number) => (
                  <tr key={i} onClick={() => setInsDetail(r)} className="border-b border-pdd-border hover:bg-[var(--pdd-gray-200)]/50 cursor-pointer transition-colors">
                    <td className="py-1.5 font-mono text-[10px] text-pdd-text truncate max-w-[180px]" title={String(findField(r, '订单编号', '订单号') || '')}>
                      {String(findField(r, '订单编号', '订单号') || '-')}
                    </td>
                    <td className="py-1.5 text-right text-pdd-danger tabular-nums">¥{safeFloat(findField(r, '服务费用（元）', '服务费用(元)', '服务费用', '保费（元）', '保费(元)', '保费')).toFixed(2)}</td>
                    <td className="py-1.5">{String(findField(r, '收费状态') || '-')}</td>
                    <td className="py-1.5">{String(findField(r, '运费补偿状态', '补偿状态', '理赔状态') || '-')}</td>
                    <td className="py-1.5 text-pdd-text-secondary">{String(findField(r, '订单发货时间') || '-').split(' ')[0]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* 运费险详情弹窗 */}
      {insDetail && (() => {
        const o = insDetail;
        const fv = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return String(v).trim(); } return '-'; };
        const fn = (labels: string[]) => { for (const l of labels) { const v = findField(o, l); if (v != null && String(v).trim() !== '') return safeFloat(v); } return 0; };
        const fee = fn(['服务费用（元）', '服务费用(元)', '服务费用', '保费（元）', '保费(元)', '保费']);

        const sections = [
          { title: '基本信息', rows: [
            ['订单编号', fv(['订单编号', '订单号'])],
            ['收费编号', fv(['收费编号'])],
            ['服务费用', `¥${fee.toFixed(2)}`],
            ['收费状态', fv(['收费状态'])],
          ]},
          { title: '理赔/补偿', rows: [
            ['运费补偿状态', fv(['运费补偿状态', '补偿状态'])],
            ['理赔状态', fv(['理赔状态'])],
            ['运费补偿生效时间', fv(['运费补偿生效时间', '补偿生效时间'])],
          ]},
          { title: '时间信息', rows: [
            ['订单发货时间', fv(['订单发货时间'])],
            ['订单创建时间', fv(['订单创建时间', '创建时间'])],
          ]},
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-start justify-center pt-8 pb-8" onClick={() => setInsDetail(null)}>
            <div className="absolute inset-0 bg-black/50" />
            <div className="relative bg-pdd-card rounded-xl border border-pdd-border shadow-2xl w-full max-w-xl max-h-full overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-5 py-3 border-b border-pdd-border flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-pdd-text">运费险详情</h2>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">{fv(['订单编号', '订单号'])}</p>
                </div>
                <button onClick={() => setInsDetail(null)} className="p-1.5 rounded-lg hover:bg-[var(--pdd-gray-200)] text-pdd-text-secondary hover:text-pdd-text transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
              <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
                {sections.map((sec, si) => (
                  <div key={si}>
                    <h3 className="text-xs font-semibold text-pdd-primary-light mb-2 border-b border-pdd-border pb-1">{sec.title}</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      {sec.rows.map(([label, value], ri) => (
                        <div key={ri} className="flex justify-between text-xs py-1 border-b border-[var(--pdd-gray-100)]">
                          <span className="text-pdd-text-secondary flex-shrink-0">{label}</span>
                          <span className="text-pdd-text text-right ml-3 truncate max-w-[220px]">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {/* 显示所有其他字段 */}
                {(() => {
                  const shownKeys = new Set(['订单编号', '订单号', '收费编号', '服务费用（元）', '服务费用(元)', '服务费用', '保费（元）', '保费(元)', '保费', '收费状态', '运费补偿状态', '补偿状态', '理赔状态', '运费补偿生效时间', '补偿生效时间', '订单发货时间', '订单创建时间', '创建时间']);
                  const otherKeys = Object.keys(o).filter(k => !shownKeys.has(k) && typeof o[k] !== 'object' && String(o[k] || '').trim() !== '');
                  if (!otherKeys.length) return null;
                  return (
                    <div>
                      <h3 className="text-xs font-semibold text-pdd-primary-light mb-2 border-b border-pdd-border pb-1">其他字段</h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                        {otherKeys.map(k => (
                          <div key={k} className="flex justify-between text-xs py-1 border-b border-[var(--pdd-gray-100)]">
                            <span className="text-pdd-text-secondary flex-shrink-0">{k}</span>
                            <span className="text-pdd-text text-right ml-3 truncate max-w-[220px]">{String(o[k] || '-')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, Download, ArrowUp, ArrowDown, Table, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';
import { useData } from '../App';
import { findField } from '../utils';
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, getCompareOrders, getAllDateGroups, filterPromoByTimeRange, changePct } from '../components/TimeFilter';
import { KPI_LINES, ChartTooltip, buildTrendData, buildCompareTrendData } from '../utils/trendData';
import TrendDataTable from '../components/TrendDataTable';
import EventAnalysisPanel from '../components/EventAnalysisPanel';

const cv = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.04 } }) };

export default function TrendPage() {
  const { currentDisplayData } = useData();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;

  const orders = currentDisplayData?.orders || [];
  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const filteredOrders = useMemo(() => filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange), [orders, allDates, timeRange, customStart, customEnd, quickRange]);
  const compareOrders = useMemo(() => getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange), [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange]);

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

  const noData = !filteredOrders.length;

  const trendData = useMemo(() => buildTrendData(filteredOrders, filteredPromoSummary, granularity, filteredStarSummary, filteredLiveSummary), [filteredOrders, filteredPromoSummary, filteredStarSummary, filteredLiveSummary, granularity]);
  const compareTrendData = useMemo(() => {
    if (!compareEnabled || !compareOrders.length) return [];
    return buildCompareTrendData(compareOrders, granularity);
  }, [compareOrders, compareEnabled, granularity]);

  // 选中折线的 KPI keys
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set(['gmv', 'orderCount', 'avgPrice']));
  const [kpiExpanded, setKpiExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  const toggleKpi = (key: string) => {
    const next = new Set(selectedKpis);
    if (next.has(key)) next.delete(key); else next.add(key);
    setSelectedKpis(next);
  };

  // 合并环比数据
  const chartData = useMemo(() => {
    if (!compareEnabled || !compareTrendData.length) return trendData;
    const cmpMap: Record<string, any> = {};
    compareTrendData.forEach((d: any) => { cmpMap[d._fullDate || d.date] = d; });
    return trendData.map((d: any) => {
      const cmp = cmpMap[d._fullDate || d.date];
      if (!cmp) return d;
      const merged = { ...d };
      Object.keys(cmp).forEach(k => {
        if (k !== 'date' && k !== '_fullDate') merged[k + '_prev'] = cmp[k];
      });
      return merged;
    });
  }, [trendData, compareTrendData, compareEnabled]);

  const hasPercentKpi = [...selectedKpis].some(k => KPI_LINES.find(l => l.key === k)?.type === 'percent');
  const selectedLines = KPI_LINES.filter(l => selectedKpis.has(l.key));

  // 完整 KPI 计算
  const fullKpi = useMemo(() => {
    if (!trendData.length) return null;
    const sum = trendData.reduce((acc, d) => ({
      gmv: acc.gmv + (d.gmv || 0),
      orderCount: acc.orderCount + (d.orderCount || 0),
      paid: acc.paid + (d.paid || 0),
      postage: acc.postage + (d.postage || 0),
      refundAmount: acc.refundAmount + (d.refundAmount || 0),
      discount: acc.discount + (d.discount || 0),
      promoCost: acc.promoCost + (d.promoCost || 0),
      promoGmv: acc.promoGmv + (d.promoGmv || 0),
    }), { gmv: 0, orderCount: 0, paid: 0, postage: 0, refundAmount: 0, discount: 0, promoCost: 0, promoGmv: 0 });

    const avgPrice = sum.orderCount > 0 ? sum.paid / sum.orderCount : 0;
    const promoRoi = sum.promoCost > 0 ? sum.promoGmv / sum.promoCost : 0;
    const promoRatio = sum.gmv > 0 ? (sum.promoCost / sum.gmv) * 100 : 0;
    const shopRoi = sum.promoCost > 0 ? sum.gmv / sum.promoCost : 0;
    let rfCount = 0, asCount = 0;
    filteredOrders.forEach(o => {
      const st = String(findField(o, '售后状态') || '').trim();
      if (st && st !== '无售后或售后取消' && st !== '无') asCount += 1;
      if (st.includes('退款')) rfCount += 1;
    });

    return {
      gmv: sum.gmv, orderCount: sum.orderCount, avgPrice,
      paid: sum.paid, postage: sum.postage,
      refundAmount: sum.refundAmount, discount: sum.discount,
      promoCost: sum.promoCost, promoGmv: sum.promoGmv,
      promoRoi, promoRatio, shopRoi,
      asRate: sum.orderCount > 0 ? (asCount / sum.orderCount) * 100 : 0,
      rfRate: sum.orderCount > 0 ? (rfCount / sum.orderCount) * 100 : 0,
    };
  }, [trendData, filteredOrders]);

  const compareFullKpi = useMemo(() => {
    if (!compareEnabled || !compareTrendData.length) return null;
    const sum = compareTrendData.reduce((acc, d) => ({
      gmv: acc.gmv + (d.gmv || 0),
      orderCount: acc.orderCount + (d.orderCount || 0),
      paid: acc.paid + (d.paid || 0),
    }), { gmv: 0, orderCount: 0, paid: 0 });
    return { gmv: sum.gmv, orderCount: sum.orderCount, avgPrice: sum.orderCount > 0 ? sum.paid / sum.orderCount : 0 };
  }, [compareTrendData, compareEnabled]);

  const allKpiCards = useMemo(() => {
    if (!fullKpi) return [];
    return [
      { key: 'gmv', label: 'GMV总额', value: fullKpi.gmv, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#1677FF', change: compareFullKpi ? changePct(fullKpi.gmv, compareFullKpi.gmv || 0) : null },
      { key: 'orderCount', label: '订单量', value: fullKpi.orderCount, fmt: (v: number) => v.toFixed(0), color: '#722ED1', change: compareFullKpi ? changePct(fullKpi.orderCount, compareFullKpi.orderCount || 0) : null },
      { key: 'avgPrice', label: '客单价', value: fullKpi.avgPrice, fmt: (v: number) => `¥${v.toFixed(2)}`, color: '#52C41A', change: compareFullKpi ? changePct(fullKpi.avgPrice, compareFullKpi.avgPrice || 0) : null },
      { key: 'paid', label: '用户实付', value: fullKpi.paid, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#73D13D', change: null },
      { key: 'promoCost', label: '推广花费', value: fullKpi.promoCost, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#F759AB', change: null },
      { key: 'promoRoi', label: '推广ROI', value: fullKpi.promoRoi, fmt: (v: number) => v.toFixed(2), color: '#2F54EB', change: null },
      { key: 'rfRate', label: '退款率', value: fullKpi.rfRate, fmt: (v: number) => `${v.toFixed(1)}%`, color: '#FF4D4F', change: null },
      { key: 'asRate', label: '售后率', value: fullKpi.asRate, fmt: (v: number) => `${v.toFixed(1)}%`, color: '#FAAD14', change: null },
      { key: 'postage', label: '邮费总额', value: fullKpi.postage, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#13C2C2', change: null },
      { key: 'refundAmount', label: '退款金额', value: fullKpi.refundAmount, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#FF7875', change: null },
      { key: 'discount', label: '优惠总额', value: fullKpi.discount, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#FFC53D', change: null },
      { key: 'promoGmv', label: '推广GMV', value: fullKpi.promoGmv, fmt: (v: number) => `¥${v.toFixed(0)}`, color: '#EB2F96', change: null },
      { key: 'promoRatio', label: '推广占比', value: fullKpi.promoRatio, fmt: (v: number) => `${v.toFixed(1)}%`, color: '#FA541C', change: null },
      { key: 'shopRoi', label: '全店投产', value: fullKpi.shopRoi, fmt: (v: number) => v.toFixed(2), color: '#52C41A', change: null },
    ];
  }, [fullKpi, compareFullKpi]);

  const displayCards = kpiExpanded ? allKpiCards : allKpiCards.slice(0, 8);

  const exportCSV = () => {
    if (!trendData.length) return;
    const headers = ['日期', ...selectedLines.map(l => l.label)];
    const rows = trendData.map((d: any) => [d.date, ...selectedLines.map(l => {
      const v = d[l.key];
      if (v == null) return '';
      if (KPI_LINES.find(x => x.key === l.key)?.type === 'percent') return v.toFixed(2) + '%';
      return typeof v === 'number' ? v.toFixed(2) : String(v);
    })]);
    const csv = '﻿' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `趋势数据_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 space-y-3">
      <TimeFilter state={tf} />

      {/* KPI 汇总卡片 */}
      {fullKpi && (
        <div>
          <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
            {displayCards.map((c, i) => {
              const changeVal: number | null = c.change;
              return (
                <motion.div key={c.key} custom={i} variants={cv} initial="hidden" animate="visible"
                  className="pdd-card px-3 py-2 flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full shrink-0" style={{ background: c.color }} />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[var(--pdd-text-secondary)]">{c.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-[var(--pdd-text)]">{noData ? '--' : c.fmt(c.value)}</span>
                      {changeVal != null && Math.abs(changeVal) > 0.01 && (
                        <span className={`text-xs ${changeVal > 0 ? 'text-[var(--pdd-success)]' : 'text-[var(--pdd-danger)]'}`}>
                          {changeVal > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(changeVal).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
          {allKpiCards.length > 8 && (
            <button onClick={() => setKpiExpanded(!kpiExpanded)}
              className="flex items-center gap-1 mx-auto mt-2 text-xs text-[var(--pdd-text-muted)] hover:text-[var(--pdd-primary)] transition-colors">
              {kpiExpanded ? <><ChevronUp size={12} />收起指标</> : <><ChevronDown size={12} />展开全部14项指标</>}
            </button>
          )}
        </div>
      )}

      {/* 折线指标选择器 — 常驻的彩色小方块 */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border px-3 py-2.5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-[var(--pdd-text-secondary)]">
            折线指标 <span className="text-[var(--pdd-text-muted)]">（点击小方块切换）</span>
          </span>
          <span className="text-xs text-[var(--pdd-text-muted)]">{selectedKpis.size}/23</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {KPI_LINES.map(k => {
            const active = selectedKpis.has(k.key);
            return (
              <button
                key={k.key}
                onClick={() => toggleKpi(k.key)}
                title={`${k.label} — ${active ? '已选中' : '未选中'}`}
                className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all ${
                  active ? 'bg-[var(--pdd-primary)]/10 border border-[var(--pdd-primary)]/30 shadow-sm' : 'bg-[var(--pdd-gray-100)] border border-transparent opacity-50 hover:opacity-80'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: active ? k.color : '#ccc' }} />
                <span style={{ color: active ? k.color : 'var(--pdd-text-muted)' }}>{k.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 工具栏：视图切换 + 导出 */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center bg-pdd-card border border-pdd-border rounded-lg p-0.5">
          <button onClick={() => setViewMode('chart')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors ${viewMode === 'chart' ? 'bg-[var(--pdd-primary)] text-white' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
            <BarChart3 size={13} />图表</button>
          <button onClick={() => setViewMode('table')}
            className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs transition-colors ${viewMode === 'table' ? 'bg-[var(--pdd-primary)] text-white' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
            <Table size={13} />表格</button>
        </div>
        <button onClick={exportCSV} disabled={!trendData.length}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-pdd-card border border-pdd-border text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-primary)] transition-colors disabled:opacity-40">
          <Download size={13} />导出CSV</button>
      </div>

      {/* 图表 / 表格 */}
      {noData ? (
        <div className="pdd-card text-center py-16 text-[var(--pdd-text-secondary)]">
          <TrendingUp size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">暂无趋势数据，请导入订单数据后查看</p>
        </div>
      ) : viewMode === 'chart' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-[var(--pdd-text)] flex items-center gap-1.5 mb-3">
            <TrendingUp size={14} color="var(--pdd-primary)" />指标趋势
            {(() => {
              const labels: Record<string, string> = { day: '按日', week: '按周', month: '按月' };
              return <span className="text-xs font-normal text-[var(--pdd-text-secondary)]">({labels[granularity] || '按日'})</span>;
            })()}
          </h3>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
              <YAxis yAxisId="value" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
              {hasPercentKpi && <YAxis yAxisId="percent" orientation="right" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} unit="%" />}
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
              {selectedLines.map(l => (
                <Line key={l.key} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={{ r: 2, fill: l.color }} activeDot={{ r: 4 }} />
              ))}
              {compareEnabled && selectedLines.map(l => (
                <Line key={l.key + '_prev'} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key + '_prev'} name={l.label + '(上期)'} stroke={l.color} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      ) : (
        <TrendDataTable
          trendData={trendData}
          compareData={compareTrendData}
          selectedKpis={selectedKpis}
          compareEnabled={compareEnabled}
        />
      )}

      {/* 活动分析面板 */}
      <EventAnalysisPanel orders={filteredOrders} trendData={trendData} compareEnabled={compareEnabled} />
    </div>
  );
}

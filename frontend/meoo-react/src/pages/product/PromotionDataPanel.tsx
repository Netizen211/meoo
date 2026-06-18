import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Megaphone, TrendingUp,
  Target, BarChart3, Activity, ChevronDown,
  ShoppingCart, Users, PieChart, Clock
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { ProductStat } from '../../components/ProductLinkStats';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: ProductStat | null;
  timeRange?: string;
}

const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

const fmtNum = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0);

function Section({ title, defaultOpen = true, children, badge, icon }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 text-sm font-bold text-gray-700">
        <div className="flex items-center gap-1.5">
          {icon}
          <span>{title}</span>
          {badge && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{badge}</span>}
        </div>
        <ChevronDown size={12} className={'text-gray-300 transition-transform ' + (open ? '' : '-rotate-90')} />
      </button>
      {open && <div className="p-3 sm:p-4">{children}</div>}
    </div>
  );
}

function KpiCard({ label, value, color = 'text-gray-800', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg min-w-0">
      <div className="px-3 py-2.5">
        <div className="text-[10px] text-gray-400 truncate">{label}</div>
        <div className={'text-sm sm:text-base font-bold ' + color + ' tabular-nums truncate mt-0.5'}>{value}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-100">
            {headers.map((h, i) => (
              <th key={i} className="text-left py-2 px-2 text-gray-400 font-semibold first:pl-0 last:pr-0 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
              {row.map((cell, ci) => (
                <td key={ci} className="py-2 px-2 text-gray-700 first:pl-0 last:pr-0 tabular-nums whitespace-nowrap">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PromotionDataPanel({ isOpen, onClose, product, timeRange }: Props) {
  const [trendMetric, setTrendMetric] = useState('cost');

  const metrics = useMemo(() => {
    if (!product) return null;
    const pc = product.promoCost || 0;
    const pt = product.promoTransaction || 0;
    const po = product.promoOrders || 0;
    const clicks = product.promoClicks || 0;
    const imps = product.promoImpressions || 0;
    const totalOrd = product.orders || 0;
    const totalGmv = product.gmv || 0;
    const roi = pc > 0 ? pt / pc : 0;
    const ctr = imps > 0 ? (clicks / imps) * 100 : 0;
    const cvr = clicks > 0 ? (po / clicks) * 100 : 0;
    const cpc = clicks > 0 ? pc / clicks : 0;
    const costRatio = product.promoCostRatio || 0;
    const organicOrd = Math.max(0, totalOrd - po);
    const organicGmv = Math.max(0, totalGmv - pt);
    const promoOrdRatio = totalOrd > 0 ? (po / totalOrd) * 100 : 0;
    const organicOrdRatio = totalOrd > 0 ? (organicOrd / totalOrd) * 100 : 0;
    const promoGmvRatio = totalGmv > 0 ? (pt / totalGmv) * 100 : 0;
    const organicGmvRatio = totalGmv > 0 ? (organicGmv / totalGmv) * 100 : 0;
    const costPerOrder = po > 0 ? pc / po : 0;
    return {
      cost: pc, transaction: pt, promoOrders: po,
      clicks, impressions: imps,
      roi, ctr, cvr, cpc, costRatio,
      totalOrd, totalGmv,
      organicOrd, organicGmv,
      promoOrdRatio, organicOrdRatio,
      promoGmvRatio, organicGmvRatio,
      costPerOrder,
    };
  }, [product]);

  const trendData = useMemo(() => {
    if (!product?.promoSourceDetails?.length) return [];
    const dayMap: Record<string, any> = {};
    product.promoSourceDetails.forEach((s: any) => {
      const date = (s.date || '').split(' ')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!dayMap[date]) dayMap[date] = { date, cost: 0, transaction: 0, clicks: 0, impressions: 0, orders: 0 };
      dayMap[date].cost += s.cost || 0;
      dayMap[date].transaction += s.transaction || 0;
      dayMap[date].clicks += s.clicks || 0;
      dayMap[date].impressions += s.impressions || 0;
      dayMap[date].orders += s.orders || 0;
    });
    const sorted = Object.values(dayMap).sort((a: any, b: any) => a.date.localeCompare(b.date)) as any[];
    sorted.forEach((d: any) => {
      d.roi = d.cost > 0 ? d.transaction / d.cost : 0;
      d.ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
    });
    return sorted;
  }, [product?.promoSourceDetails]);

  const sourceBreakdown = useMemo(() => {
    if (!product?.promoSourceDetails?.length) return [];
    const agg: Record<string, { cost: number; transaction: number; orders: number; clicks: number; impressions: number }> = {};
    product.promoSourceDetails.forEach((s: any) => {
      const src = s.source || '其他';
      if (!agg[src]) agg[src] = { cost: 0, transaction: 0, orders: 0, clicks: 0, impressions: 0 };
      agg[src].cost += s.cost || 0;
      agg[src].transaction += s.transaction || 0;
      agg[src].orders += s.orders || 0;
      agg[src].clicks += s.clicks || 0;
      agg[src].impressions += s.impressions || 0;
    });
    const totalCost = Object.values(agg).reduce((s, v) => s + v.cost, 0);
    return Object.entries(agg)
      .map(([src, v]) => ({
        source: src, cost: v.cost, transaction: v.transaction,
        orders: v.orders, clicks: v.clicks, impressions: v.impressions,
        roi: v.cost > 0 ? v.transaction / v.cost : 0,
        ctr: v.impressions > 0 ? (v.clicks / v.impressions) * 100 : 0,
        cvr: v.clicks > 0 ? (v.orders / v.clicks) * 100 : 0,
        cpc: v.clicks > 0 ? v.cost / v.clicks : 0,
        ratio: totalCost > 0 ? (v.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [product?.promoSourceDetails]);

  const TrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dayData = trendData.find((d: any) => d.date === label);
    if (!dayData) return null;
    const items = [
      { key: 'cost', label: '推广花费', color: 'text-rose-600', fmt: (v: number) => fmtMoney(v) },
      { key: 'transaction', label: '推广成交', color: 'text-emerald-600', fmt: (v: number) => fmtMoney(v) },
      { key: 'roi', label: 'ROI', color: dayData.roi >= 1 ? 'text-blue-600' : 'text-rose-600', fmt: (v: number) => v.toFixed(2) },
      { key: 'clicks', label: '点击量', color: 'text-amber-600', fmt: (v: number) => fmtNum(v) },
      { key: 'impressions', label: '展现量', color: 'text-cyan-600', fmt: (v: number) => fmtNum(v) },
      { key: 'orders', label: '成交订单', color: 'text-indigo-600', fmt: (v: number) => fmtNum(v) },
    ];
    return (
      <div className="bg-white border border-gray-200 px-3 py-2 text-xs shadow-sm rounded-lg" style={{ maxWidth: '200px' }}>
        <div className="font-bold text-gray-700 mb-1.5">{label}</div>
        <div className="space-y-1">
          {items.map(item => (
            <div key={item.key} className="flex items-center justify-between gap-3">
              <span className="text-gray-500">{item.label}</span>
              <span className={'font-bold tabular-nums ' + item.color}>{item.fmt(dayData[item.key] || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!product) return null;
  const m = metrics;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[600px] max-w-full bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
          >
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-4 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-base sm:text-[15px] font-bold text-gray-800 truncate flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Megaphone size={14} className="text-blue-600" />
                  </div>
                  <span className="truncate">商品推广分析</span>
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-gray-400 pl-[36px]">
                  <span className="font-mono text-gray-500">{product.productId}</span>
                  <span className="text-gray-300">·</span>
                  <span className="truncate max-w-[200px]">{product.productName}</span>
                  {timeRange && timeRange !== 'all' && (
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">{timeRange}天</span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">

              {(!m || m.cost <= 0) ? (
                <div className="flex flex-col items-center justify-center py-24 text-gray-400">
                  <Megaphone size={32} className="mb-3 text-gray-200" />
                  <p className="text-sm">该商品暂无推广数据</p>
                  <p className="text-[11px] mt-1 text-gray-300">上传商品推广报表后可查看推广分析</p>
                </div>
              ) : (
                <>
                  {/* Section 1: 推广概览 */}
                  <Section title="推广概览" icon={<BarChart3 size={13} className="text-blue-500" />}>
                    <div className="grid grid-cols-4 gap-2">
                      <KpiCard label="推广花费" value={fmtMoney(m.cost)} color="text-rose-600" />
                      <KpiCard label="推广成交" value={fmtMoney(m.transaction)} color="text-emerald-600" />
                      <KpiCard label="推广订单" value={fmtNum(m.promoOrders)} color="text-blue-600" />
                      <KpiCard label="推广ROI" value={m.roi.toFixed(2)} color={m.roi >= 1 ? 'text-emerald-600' : 'text-rose-600'} />
                      <KpiCard label="点击量" value={fmtNum(m.clicks)} />
                      <KpiCard label="展现量" value={fmtNum(m.impressions)} />
                      <KpiCard label="点击率CTR" value={m.ctr.toFixed(2) + '%'} />
                      <KpiCard label="平均点击单价" value={m.cpc > 0 ? fmtMoney(m.cpc) : '-'} />
                    </div>
                  </Section>

                  {/* Section 2: 推广 vs 自然 */}
                  <Section title="推广 vs 自然流量" icon={<Users size={13} className="text-blue-500" />}>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="border border-blue-100 bg-blue-50/30 rounded-lg p-3.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <Megaphone size={12} className="text-blue-500" />
                          <span className="text-[11px] font-bold text-blue-700">推广流量</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">成交额</span>
                            <span className="font-bold text-gray-800">{fmtMoney(m.transaction)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">订单数</span>
                            <span className="font-bold text-gray-800">{fmtNum(m.promoOrders)}单</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">占总成交</span>
                            <span className="font-bold text-blue-600">{m.promoGmvRatio.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">占总订单</span>
                            <span className="font-bold text-blue-600">{m.promoOrdRatio.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                      <div className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-3.5">
                        <div className="flex items-center gap-1.5 mb-2">
                          <ShoppingCart size={12} className="text-emerald-500" />
                          <span className="text-[11px] font-bold text-emerald-700">自然流量</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">成交额</span>
                            <span className="font-bold text-gray-800">{fmtMoney(m.organicGmv)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">订单数</span>
                            <span className="font-bold text-gray-800">{fmtNum(m.organicOrd)}单</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">占总成交</span>
                            <span className="font-bold text-emerald-600">{m.organicGmvRatio.toFixed(1)}%</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400">占总订单</span>
                            <span className="font-bold text-emerald-600">{m.organicOrdRatio.toFixed(1)}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
                        <span>成交额构成</span>
                        <span>推广 {m.promoGmvRatio.toFixed(1)}% · 自然 {m.organicGmvRatio.toFixed(1)}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                        <div className="h-full bg-blue-400 rounded-l-full transition-all" style={{ width: m.promoGmvRatio + '%' }} />
                        <div className="h-full bg-emerald-400 rounded-r-full transition-all" style={{ width: m.organicGmvRatio + '%' }} />
                      </div>
                    </div>
                  </Section>

                  {/* Section 3: 推广趋势 */}
                  {trendData.length > 1 && (
                    <Section title="推广趋势" badge={trendData.length + '天'} icon={<Activity size={13} className="text-blue-500" />}>
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {['cost', 'transaction', 'roi', 'clicks', 'impressions'].map(k => (
                          <button key={k} onClick={() => setTrendMetric(k)}
                            className={'px-2 py-1 text-[10px] font-medium rounded ' + (trendMetric === k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200')}>
                            {{ cost: '花费', transaction: '成交', roi: 'ROI', clicks: '点击', impressions: '展现' }[k]}
                          </button>
                        ))}
                      </div>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                            <defs>
                              <linearGradient id="promoGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip content={<TrendTooltip />} />
                            <Area type="monotone" dataKey={trendMetric}
                              stroke="#3b82f6"
                              strokeWidth={2}
                              fill="url(#promoGrad)"
                              dot={false}
                              activeDot={{ r: 4 }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Section>
                  )}

                  {/* Section 4: 推广漏斗 */}
                  {m.impressions > 0 && (
                    <Section title="推广漏斗" icon={<Target size={13} className="text-blue-500" />}>
                      <div className="space-y-3">
                        {[
                          { name: '展现', value: m.impressions, unit: '次', bar: 'bg-cyan-400', dot: 'bg-cyan-500' },
                          { name: '点击', value: m.clicks, unit: '次', rate: m.ctr, rateLabel: '点击率', bar: 'bg-amber-400', dot: 'bg-amber-500' },
                          { name: '成交', value: m.promoOrders, unit: '单', rate: m.cvr, rateLabel: '转化率', bar: 'bg-emerald-400', dot: 'bg-emerald-500' },
                        ].map((step, i) => (
                          <div key={step.name}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <div className="flex items-center gap-2">
                                <span className={'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white ' + step.dot}>{i + 1}</span>
                                <span className="font-medium text-gray-700">{step.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-gray-800 tabular-nums">{fmtNum(step.value)}{step.unit}</span>
                                {step.rate !== undefined && (
                                  <span className="text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    {step.rateLabel} {step.rate.toFixed(2)}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                              <div className={'h-full rounded-full transition-all duration-500 ' + step.bar}
                                style={{ width: (step.value / Math.max(m.impressions, 1)) * 100 + '%' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* Section 5: 来源分析 */}
                  {sourceBreakdown.length > 0 && (
                    <Section title="来源分析" badge={sourceBreakdown.length + '个来源'} icon={<PieChart size={13} className="text-blue-500" />}>
                      <SimpleTable
                        headers={['推广来源', '花费', '成交额', '订单', 'ROI', '点击', '展现', 'CTR', 'CVR', 'CPC', '占比']}
                        rows={sourceBreakdown.map(s => [
                          <span className="font-medium text-gray-700">{s.source}</span>,
                          <span className="font-mono text-rose-600">{fmtMoney(s.cost)}</span>,
                          <span className="font-mono text-emerald-600">{fmtMoney(s.transaction)}</span>,
                          <span className="font-mono">{fmtNum(s.orders)}</span>,
                          <span className={'font-semibold font-mono ' + (s.roi >= 1 ? 'text-emerald-600' : 'text-rose-600')}>{s.roi.toFixed(2)}</span>,
                          <span className="font-mono">{fmtNum(s.clicks)}</span>,
                          <span className="font-mono">{fmtNum(s.impressions)}</span>,
                          <span className="font-mono text-gray-500">{s.ctr.toFixed(1)}%</span>,
                          <span className="font-mono text-gray-500">{s.cvr.toFixed(1)}%</span>,
                          <span className="font-mono text-amber-600">{s.cpc > 0 ? fmtMoney(s.cpc) : '-'}</span>,
                          <span className="font-mono text-gray-500">{s.ratio.toFixed(1)}%</span>,
                        ])}
                      />
                    </Section>
                  )}

                  {/* Section 6: 推广效率 */}
                  <Section title="推广效率" icon={<TrendingUp size={13} className="text-blue-500" />}>
                    <div className="grid grid-cols-4 gap-2">
                      <KpiCard label="推广费占比" value={m.costRatio.toFixed(1) + '%'} sub={'GMV ' + fmtMoney(m.totalGmv)} />
                      <KpiCard label="每单推广费" value={fmtMoney(m.costPerOrder)} sub={'推广单 ' + fmtNum(m.promoOrders)} />
                      <KpiCard label="推广成交占比" value={m.promoGmvRatio.toFixed(1) + '%'} color="text-blue-600" sub={'全店 ' + fmtMoney(m.totalGmv)} />
                      <KpiCard label="推广订单占比" value={m.promoOrdRatio.toFixed(1) + '%'} color="text-indigo-600" sub={'全店 ' + fmtNum(m.totalOrd) + '单'} />
                    </div>
                    {m.promoOrders > 0 && (
                      <div className="mt-3 text-[11px] text-gray-600 leading-relaxed space-y-1 bg-gray-50/70 rounded-lg p-3">
                        <p>
                          该商品累计推广花费 <strong className="text-rose-600">{fmtMoney(m.cost)}</strong>，
                          带来推广成交 <strong className="text-emerald-600">{fmtMoney(m.transaction)}</strong>，
                          投产比 <strong className="text-blue-600">{m.roi.toFixed(2)}</strong>。
                        </p>
                        <p>
                          每获得一次点击平均花费 <strong className="text-amber-600">{m.cpc > 0 ? fmtMoney(m.cpc) : '-'}</strong>，
                          点击率 <strong className="text-blue-600">{m.ctr.toFixed(2)}%</strong>，
                          转化率 <strong className="text-emerald-600">{m.cvr.toFixed(2)}%</strong>。
                        </p>
                        <p>
                          推广成交占全店 <strong className="text-blue-600">{m.promoGmvRatio.toFixed(1)}%</strong>，
                          自然成交占全店 <strong className="text-emerald-600">{m.organicGmvRatio.toFixed(1)}%</strong>。
                        </p>
                      </div>
                    )}
                  </Section>

                  {/* Section 7: 分小时推广确认 */}
                  {(product as any).hourlyPromotedOrders > 0 && (
                    <Section title="分小时推广确认" icon={<Clock size={13} className="text-blue-500" />}>
                      <div className="bg-blue-50/50 rounded-lg p-3.5 border border-blue-100">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[11px] text-gray-500">推广时段内确认订单</p>
                            <p className="text-xl font-bold text-blue-600 tabular-nums">{(product as any).hourlyPromotedOrders} 单</p>
                          </div>
                          <div className="bg-blue-100 rounded-full p-2">
                            <Clock size={20} className="text-blue-500" />
                          </div>
                        </div>
                        <p className="text-[10px] text-gray-400 mt-2">
                          该商品在分小时推广的时段内有 {(product as any).hourlyPromotedOrders} 笔订单被确认推广，
                          说明在这些时段投放的推广带来了实际成交。
                        </p>
                      </div>
                    </Section>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

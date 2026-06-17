
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X, TrendingUp, RotateCcw,
  Activity, Calendar, ChevronDown,
  AlertCircle, Truck, Users, Package, RefreshCw,
  Zap, Layers, ArrowUp, ArrowDown, BarChart3,
  TrendingDown
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import { analyticsApi } from '../../../api/analyticsApi';

/* ── 格式化工具 ── */
const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

const fmtNum = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0);

const fmtChg = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(1) + '%';

const TABS = [
  { key: 'overview', label: '概览', icon: BarChart3 },
  { key: 'price', label: '价格利润', icon: TrendingUp },
  { key: 'marketing', label: '营销售后', icon: Zap },
  { key: 'details', label: '明细分析', icon: Layers },
] as const;
type TabKey = (typeof TABS)[number]['key'];

/* ── 折叠区 ── */
function CollapsibleSection({ title, defaultOpen = true, children, badge }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white border border-gray-200">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 text-sm font-bold text-gray-700">
        <div className="flex items-center gap-1.5">
          <span>{title}</span>
          {badge && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600">{badge}</span>}
        </div>
        <ChevronDown size={12} className={'text-gray-300 transition-transform ' + (open ? '' : '-rotate-90')} />
      </button>
      {open && <div className="px-3 pb-3 pt-0.5">{children}</div>}
    </div>
  );
}

function KpiCard({ label, value, color = 'text-gray-800', change, sub }: {
  label: string; value: string; color?: string; change?: { val: number; label?: string } | null; sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 min-w-0">
      <div className="px-2.5 py-2">
        <div className="text-[10px] text-gray-400 truncate">{label}</div>
        <div className={'text-base font-bold ' + color + ' tabular-nums truncate mt-0.5'}>{value}</div>
        {change && (
          <div className={'flex items-center gap-0.5 mt-1 text-[10px] font-medium ' + (change.val >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
            {change.val >= 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}
            <span>{Math.abs(change.val).toFixed(1)}%</span>
            {change.label && <span className="text-gray-400 ml-0.5">{change.label}</span>}
          </div>
        )}
        {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

function ChangeTag({ val, inverse = false }: { val: number; inverse?: boolean }) {
  const bad = inverse ? val < 0 : val > 0;
  const good = inverse ? val > 0 : val < 0;
  const isUp = val > 0;
  const isDown = val < 0;
  let cls = 'text-gray-500';
  let bg = 'bg-gray-100';
  if (isUp) { cls = bad ? 'text-rose-600' : 'text-emerald-600'; bg = bad ? 'bg-rose-50' : 'bg-emerald-50'; }
  if (isDown) { cls = good ? 'text-emerald-600' : 'text-rose-600'; bg = good ? 'bg-emerald-50' : 'bg-rose-50'; }
  return (
    <span className={'inline-flex items-center gap-0.5 px-1 py-0.5 text-[10px] font-semibold ' + bg + ' ' + cls}>
      {isUp && <ArrowUp size={8} />}{isDown && <ArrowDown size={8} />}{fmtChg(val)}
    </span>
  );
}

function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          {headers.map((h, i) => <th key={i} className="text-left py-1.5 px-1.5 text-gray-400 font-semibold first:pl-0 last:pr-0 whitespace-nowrap">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-b border-gray-50">
            {row.map((cell, ci) => <td key={ci} className="py-1.5 px-1.5 text-gray-700 first:pl-0 last:pr-0 tabular-nums whitespace-nowrap">{cell}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* ── 空状态 ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">{text}</div>
  );
}

/* ── 折线图 Tooltip（含改价信息，支持分类合并展示） ── */
function TrendTooltip({ active, payload, label, priceChangeMap }: any) {
  if (!active || !payload?.length) return null;
  const changes = label ? priceChangeMap[label] : undefined;
  return (
    <div className="bg-white border border-gray-200 px-3 py-2 text-xs shadow-sm" style={{ maxWidth: '220px' }}>
      <div className="font-bold text-gray-700 mb-1">{label}</div>
      <div className="flex items-center gap-3">
        <span className="text-gray-500">{payload[0]?.name}</span>
        <span className="font-bold text-gray-800 tabular-nums">{fmtMoney(payload[0]?.value || 0)}</span>
      </div>
      {changes && changes.length > 0 && (
        <div className="border-t border-amber-200 mt-1.5 pt-1.5 space-y-1.5">
          {changes.map((c: any, i: number) => (
            <div key={i} className="text-[10px] leading-tight">
              {/* 批量改价标记 */}
              {c.batchType === '批量' && (
                <div className="text-amber-600 font-bold mb-0.5">📦 批量改价</div>
              )}
              {/* 推定改价标记 */}
              {c.inferred && (
                <div className="text-gray-400 italic mb-0.5">推定改价 ({c.inferredRange})</div>
              )}
              {/* 合并条目：显示分类名 + 数量 */}
              {c.merged && c.details ? (
                <>
                  <div className="text-gray-600 font-bold mb-0.5">
                    {c.skuName} · 统一{c.type}
                  </div>
                  <div className="text-gray-400 mb-0.5">
                    {fmtMoney(c.oldPrice)} → {fmtMoney(c.newPrice)} ({c.changePct > 0 ? '+' : ''}{c.changePct.toFixed(1)}%)
                  </div>
                  {/* 展开明细 */}
                  <div className="space-y-0.5 bg-amber-50/50 rounded px-1 py-0.5">
                    {c.details.map((d: any, di: number) => (
                      <div key={di} className="flex items-center justify-between gap-1">
                        <span className="text-gray-500 truncate max-w-[100px]">{d.skuName}</span>
                        <span className={c.type === '涨价' ? 'text-rose-400' : 'text-emerald-400'}>
                          {fmtMoney(d.oldPrice)}→{fmtMoney(d.newPrice)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                /* 普通单条改价 */
                <>
                  <div className="text-gray-500 font-medium truncate max-w-[180px]">{c.skuName}</div>
                  <div className="flex items-center gap-1">
                    <span className={c.type === '涨价' ? 'text-rose-500' : 'text-emerald-500'}>
                      {fmtMoney(c.oldPrice)}→{fmtMoney(c.newPrice)}
                    </span>
                    <span className="text-gray-400">
                      ({c.type === '涨价' ? '▲' : '▼'}{c.changePct > 0 ? '+' : ''}{c.changePct.toFixed(1)}%)
                    </span>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface Props {
  productId: string | null;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  timeRange: string;
  customStart?: string;
  customEnd?: string;
}

export default function ProductRetrospective({ productId, storeId, isOpen, onClose, timeRange, customStart, customEnd }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [compareWindow, setCompareWindow] = useState(7);
  const [trendMetric, setTrendMetric] = useState('gmv');
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const fetchData = useCallback(async () => {
    if (!productId || !storeId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await analyticsApi.getRetrospective(storeId, productId, timeRange, customStart || undefined, customEnd || undefined, compareWindow);
      if (result) setData(result);
      else setError('获取数据失败');
    } catch (e: any) {
      setError(e.message || '请求失败');
    } finally {
      setLoading(false);
    }
  }, [productId, storeId, timeRange, customStart, customEnd, compareWindow]);

  useEffect(() => {
    if (isOpen && productId) fetchData();
  }, [isOpen, productId, timeRange, customStart, customEnd, fetchData]);

  // 改价日期→详情映射（必须在条件返回之前，hooks 数量不能变）
  const pc = data?.priceChanges || [];
  const priceChangeMap = useMemo(() => {
    const map: Record<string, any[]> = {};
    (pc as any[]).forEach((item: any) => {
      const d = item.change?.date;
      if (!d) return;
      if (!map[d]) map[d] = [];
      map[d].push({
        skuName: item.change.skuName,
        oldPrice: item.change.oldPrice,
        newPrice: item.change.newPrice,
        changePct: item.change.changePct,
        type: item.change.type,
        merged: item.change.merged,
        mergeCount: item.change.mergeCount,
        details: item.change.details,
        batchType: item.change.batchType,
        inferred: item.change.inferred,
        inferredRange: item.change.inferredRange,
      });
    });
    return map;
  }, [pc]);

  if (!productId) return null;

  const s = data?.snapshot;
  const pw = data?.profitWaterfall || [];
  const pe = data?.promoEfficiency;
  const ra = data?.refundAnalysis;
  const sm = data?.skuMatrix || [];
  const dt = data?.dailyTrend || [];
  const lb = data?.liveBreakdown;
  const lg = data?.logistics;
  const bm = data?.buyerMetrics;

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/10 z-50" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-[780px] max-w-[95vw] bg-white border-l border-gray-200 z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800">商品复盘</h2>
            <p className="text-[10px] text-gray-400 mt-0.5">{s?.productName || productId}</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500"><X size={15} /></button>
        </div>

        {/* Time Controls */}
        <div className="px-4 py-2 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1.5 text-[11px] font-semibold bg-gray-900 text-white">
            {timeRange === 'all' ? '全部' : timeRange === 'custom' ? (customStart ? customStart.slice(5) : '') + '~' + (customEnd ? customEnd.slice(5) : '') : timeRange + '天'}
          </span>
          <span className="text-[10px] text-gray-400 ml-1">对比</span>
          {[7, 14, 30].map(w => (
            <button key={w} onClick={() => setCompareWindow(w)}
              className={'px-2 py-1 text-[10px] font-semibold ' + (compareWindow === w ? 'bg-sky-100 text-sky-600' : 'text-gray-400')}>{w}天</button>
          ))}
          <button onClick={fetchData} className="ml-auto p-1 text-gray-300 hover:text-gray-500">
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-4 pt-3 pb-1 flex items-center gap-1 border-b border-gray-100">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={'px-3 py-1.5 text-xs font-bold ' + (activeTab === tab.key ? 'bg-gray-900 text-white' : 'text-gray-400 hover:text-gray-600')}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
              <RefreshCw size={14} className="mr-2 animate-spin" />
              加载复盘数据...
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 text-sm">
              <AlertCircle size={16} className="mb-2" />
              <p>{error}</p>
              <button onClick={fetchData} className="mt-3 px-3 py-1.5 text-xs bg-gray-800 text-white">重新加载</button>
            </div>
          )}

              {/* === Tab: 概览 === */}
              {!loading && !error && data && activeTab === 'overview' && (
                <div className="space-y-4">
                  {s && (
                    <CollapsibleSection title="商品快照" defaultOpen={true}>
                      <div className="grid grid-cols-4 gap-2.5">
                        <KpiCard label="首次出单" value={s.firstOrderDate || '-'} />
                        <KpiCard label="最近出单" value={s.lastOrderDate || '-'} />
                        <KpiCard label="活跃天数" value={s.activeDays + '天'} />
                        <KpiCard label="总订单" value={fmtNum(s.totalOrders)} />
                        <KpiCard label="总销量" value={fmtNum(s.totalSales)} />
                        <KpiCard label="总GMV" value={fmtMoney(s.totalGmv)} />
                        <KpiCard label="客单价" value={fmtMoney(s.avgOrderValue)} />
                        <KpiCard label="日均销量" value={s.avgDailySales.toFixed(1)} />
                      </div>
                    </CollapsibleSection>
                  )}
                  {dt.length > 1 && (
                    <CollapsibleSection title="每日趋势" defaultOpen={true}>
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {[
                          { key: 'gmv', label: 'GMV' },
                          { key: 'sales', label: '销量' },
                          { key: 'orders', label: '订单' },
                          { key: 'revenue', label: '实收' },
                          { key: 'refund', label: '退款' },
                        ].map(m => (
                          <button key={m.key} onClick={() => setTrendMetric(m.key)}
                            className={'px-2 py-1 text-[10px] font-bold ' + (trendMetric === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500')}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dt} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                            <defs>
                              <linearGradient id="overviewGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip content={<TrendTooltip priceChangeMap={priceChangeMap} />} />
                            <Area type="monotone" dataKey={trendMetric} stroke="#3b82f6" strokeWidth={2} fill="url(#overviewGrad)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload?.date) return null;
                                const changes = priceChangeMap[payload.date];
                                if (!changes) return null;
                                return <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />;
                              }}
                              activeDot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload?.date) return null;
                                const changes = priceChangeMap[payload.date];
                                if (changes) {
                                  return (
                                    <g>
                                      <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />
                                      <circle cx={cx} cy={cy} r={3} fill="#fff" />
                                    </g>
                                  );
                                }
                                return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" strokeWidth={0} />;
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CollapsibleSection>
                  )}
                  {dt.length === 0 && !s && <EmptyState text="暂无足够的商品数据进行分析" />}
                </div>
              )}

              {/* === Tab: 价格利润（大整改） === */}
              {!loading && !error && data && activeTab === 'price' && (
                <div className="space-y-4">
                  {/* 趋势图 + 改价标记 — 视觉强化 */}
                  {dt.length > 1 && (
                    <CollapsibleSection title="数据趋势" defaultOpen={true}>
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {[
                          { key: 'gmv', label: 'GMV' },
                          { key: 'sales', label: '销量' },
                          { key: 'orders', label: '订单' },
                          { key: 'revenue', label: '实收' },
                        ].map(m => (
                          <button key={m.key} onClick={() => setTrendMetric(m.key)}
                            className={'px-2 py-1 text-[10px] font-bold ' + (trendMetric === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500')}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={dt} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                            <defs>
                              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip content={<TrendTooltip priceChangeMap={priceChangeMap} />} />
                            <Area type="monotone" dataKey={trendMetric} stroke="#3b82f6" strokeWidth={2} fill="url(#priceGrad)"
                              dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload?.date) return null;
                                const changes = priceChangeMap[payload.date];
                                if (!changes) return null;
                                return <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />;
                              }}
                              activeDot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (!payload?.date) return null;
                                const changes = priceChangeMap[payload.date];
                                if (changes) {
                                  return (
                                    <g>
                                      <circle cx={cx} cy={cy} r={7} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />
                                      <circle cx={cx} cy={cy} r={3} fill="#fff" />
                                    </g>
                                  );
                                }
                                return <circle cx={cx} cy={cy} r={4} fill="#3b82f6" strokeWidth={0} />;
                              }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 改价日期列表 — 支持合并展示 */}
                      {Object.keys(priceChangeMap).length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {Object.entries(priceChangeMap).map(([date, changes]) => (
                            <div key={date} className="flex items-center gap-1 px-2 py-1 bg-amber-50 border border-amber-200 text-[10px]">
                              <Calendar size={10} className="text-amber-500" />
                              <span className="font-bold text-amber-800">{date}</span>
                              <span className="text-amber-300">|</span>
                              {changes.map((c, i) => (
                                <span key={i} className={'inline-flex items-center gap-1 px-1 py-0.5 ' + (c.merged ? 'bg-amber-100/50' : 'bg-white')}
                                  title={c.details ? c.details.map((d: any) => d.skuName + ' ' + fmtMoney(d.oldPrice) + '→' + fmtMoney(d.newPrice)).join('\n') : ''}>
                                  {c.batchType === '批量' && <span className="text-amber-600 font-bold mr-0.5">📦</span>}
                                  {c.merged ? (
                                    <>
                                      <span className="text-gray-600 font-medium max-w-[60px] truncate">{c.skuName}</span>
                                      <span className="text-gray-400">·</span>
                                      <span className={c.type === '涨价' ? 'text-rose-500' : 'text-emerald-500'}>
                                        {fmtMoney(c.newPrice)}
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="text-gray-400 line-through">{fmtMoney(c.oldPrice)}</span>
                                      <span className={c.type === '涨价' ? 'text-rose-500' : 'text-emerald-500'}>→</span>
                                      <span className={c.type === '涨价' ? 'text-rose-600' : 'text-emerald-600'}>{fmtMoney(c.newPrice)}</span>
                                    </>
                                  )}
                                  {c.inferred && <span className="text-gray-300 ml-0.5">推定</span>}
                                </span>
                              ))}
                            </div>
                          ))}
                        </div>
                      )}
                    </CollapsibleSection>
                  )}

                  {/* 改价前后对比明细 */}
                  {pc.length > 0 && (
                    <CollapsibleSection title="改价前后对比" defaultOpen={false} badge={pc.length + '次'}>
                      {pc.map((item: any, idx: number) => (
                        <div key={idx} className="border border-gray-200 mb-2">
                          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <div className="flex items-center gap-2 text-xs">
                              {item.change.batchType === '批量' && <span className="text-amber-600 font-bold">📦</span>}
                              <span className="font-bold text-gray-700">{item.change.date}</span>
                              <span className="text-gray-400 bg-white px-1.5 py-0.5 text-[10px]">{item.change.skuName}</span>
                              {!item.change.merged && (
                                <span className="text-gray-400 font-mono">
                                  <span className="line-through text-gray-300">{fmtMoney(item.change.oldPrice)}</span>
                                  <span className="mx-1">→</span>
                                  <span className={item.change.type === '涨价' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{fmtMoney(item.change.newPrice)}</span>
                                </span>
                              )}
                            </div>
                            {!item.change.merged && (
                              <div className={'text-[10px] font-bold px-2 py-0.5 ' + (item.change.type === '涨价' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600')}>
                                {item.change.type === '涨价' ? '↑' : '↓'} {item.change.changePct > 0 ? '+' : ''}{item.change.changePct}%
                              </div>
                            )}
                          </div>
                          {/* 合并改价的详情列表 */}
                          {item.change.merged && item.change.details && (
                            <div className="px-3 py-2 bg-amber-50/30 border-b border-gray-100">
                              <div className="text-[10px] text-gray-500 font-medium mb-1">涉及 {item.change.mergeCount} 个规格，统一{item.change.type}：</div>
                              <div className="space-y-0.5">
                                {item.change.details.map((d: any, di: number) => (
                                  <div key={di} className="flex items-center gap-2 text-[10px]">
                                    <span className="text-gray-600 w-20 truncate">{d.skuName}</span>
                                    <span className="text-gray-400 line-through">{fmtMoney(d.oldPrice)}</span>
                                    <span className={item.change.type === '涨价' ? 'text-rose-400' : 'text-emerald-400'}>→</span>
                                    <span className={item.change.type === '涨价' ? 'text-rose-600 font-bold' : 'text-emerald-600 font-bold'}>{fmtMoney(d.newPrice)}</span>
                                    <span className="text-gray-400">({d.changePct > 0 ? '+' : ''}{d.changePct.toFixed(1)}%)</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          <SimpleTable
                            headers={['指标', '改价前', '改价后', '变化']}
                            rows={item.metrics.map((m: any) => [
                              m.label,
                              ['refundRate', 'profitRate', 'promoCostRatio'].includes(m.key) ? m.before.toFixed(1) + '%' :
                              ['gmv', 'revenue', 'refund', 'promoCost', 'profit'].includes(m.key) ? fmtMoney(m.before) :
                              m.key === 'promoROI' ? m.before.toFixed(2) : fmtNum(m.before),
                              ['refundRate', 'profitRate', 'promoCostRatio'].includes(m.key) ? m.after.toFixed(1) + '%' :
                              ['gmv', 'revenue', 'refund', 'promoCost', 'profit'].includes(m.key) ? fmtMoney(m.after) :
                              m.key === 'promoROI' ? m.after.toFixed(2) : fmtNum(m.after),
                              <ChangeTag key="c" val={m.change.pct} inverse={['refund', 'refundRate'].includes(m.key)} />
                            ])}
                          />
                        </div>
                      ))}
                    </CollapsibleSection>
                  )}

                  {/* 利润拆解 */}
                  {pw.length > 0 && (
                    <CollapsibleSection title="利润拆解" defaultOpen={true}>
                      <div className="space-y-1">
                        {pw.map((item: any, idx: number) => {
                          const isIncome = item.type === 'income';
                          const isProfit = item.type === 'profit';
                          const barWidth = Math.min(100, Math.max(2, Math.abs(item.pct)));
                          let barColor = 'bg-gray-200';
                          if (isProfit) barColor = 'bg-blue-500';
                          else if (isIncome) barColor = 'bg-emerald-400';
                          else barColor = 'bg-rose-300';
                          return (
                            <div key={item.step}
                              className={'flex items-center gap-2 text-xs ' + (isProfit ? 'font-bold border-t border-gray-100 pt-2 mt-2' : '')}>
                              <div className="w-16 text-right text-gray-400 shrink-0">{item.label}</div>
                              <div className="flex-1 h-4 bg-gray-100">
                                <div className={'h-full ' + barColor} style={{ width: barWidth + '%' }} />
                              </div>
                              <div className="w-20 text-right font-mono shrink-0 text-gray-700">{fmtMoney(item.amount)}</div>
                              <div className={'w-12 text-right shrink-0 font-bold ' + (isProfit ? 'text-blue-600' : isIncome ? 'text-emerald-600' : 'text-rose-400')}>
                                {item.pct.toFixed(1)}%
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleSection>
                  )}
                </div>
              )}

              {/* === Tab: 营销售后 === */}
              {!loading && !error && data && activeTab === 'marketing' && (
                <div className="space-y-4">
                  {pe && pe.summary && pe.summary.cost > 0 && (
                    <CollapsibleSection title="推广效率" defaultOpen={true}>
                      <div className="grid grid-cols-4 gap-2.5 mb-4">
                        <KpiCard label="推广花费" value={fmtMoney(pe.summary.cost)} />
                        <KpiCard label="推广成交" value={fmtMoney(pe.summary.transaction)} />
                        <KpiCard label="推广ROI" value={pe.summary.roi.toFixed(2)} />
                        <KpiCard label="点击率CTR" value={pe.summary.ctr.toFixed(1) + '%'} />
                      </div>
                      {pe.byScene && pe.byScene.length > 0 && (
                        <div className="mb-4">
                          <div className="text-[11px] font-bold text-gray-400 mb-2.5 px-0.5">推广场景</div>
                          <SimpleTable headers={['场景', '花费', '成交', '订单', 'ROI', '占比']}
                            rows={pe.byScene.map((s: any) => [s.scene, fmtMoney(s.cost), fmtMoney(s.transaction), fmtNum(s.orders), s.roi.toFixed(2), s.ratio.toFixed(1) + '%'])} />
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2.5 mb-4">
                        <KpiCard label="直接交易" value={fmtMoney(pe.directIndirect.directTrans)} sub={'占比 ' + pe.directIndirect.directRatio.toFixed(1) + '%'} />
                        <KpiCard label="净ROI" value={pe.netMetrics.netRoi.toFixed(2)} />
                        <KpiCard label="净交易额" value={fmtMoney(pe.netMetrics.netTrans)} />
                      </div>
                      {pe.interaction && pe.interaction.inquiries > 0 && (
                        <div className="grid grid-cols-3 gap-2.5">
                          <KpiCard label="询单量" value={fmtNum(pe.interaction.inquiries)} sub={'¥' + pe.interaction.avgInquiryCost.toFixed(0) + '/次'} />
                          <KpiCard label="收藏量" value={fmtNum(pe.interaction.favorites)} sub={'¥' + pe.interaction.avgFavoriteCost.toFixed(0) + '/次'} />
                          <KpiCard label="关注量" value={fmtNum(pe.interaction.follows)} sub={'¥' + pe.interaction.avgFollowCost.toFixed(0) + '/次'} />
                        </div>
                      )}
                    </CollapsibleSection>
                  )}
                  {lb && lb.liveOrders > 0 && (
                    <CollapsibleSection title="直播成交" defaultOpen={false}>
                      <div className="grid grid-cols-3 gap-2.5">
                        <KpiCard label="直播GMV" value={fmtMoney(lb.liveGmv)} sub={'占比 ' + lb.liveRatio.toFixed(1) + '%'} />
                        <KpiCard label="直播订单" value={fmtNum(lb.liveOrders)} />
                        <KpiCard label="非直播GMV" value={fmtMoney(lb.nonLiveGmv)} />
                      </div>
                    </CollapsibleSection>
                  )}
                  {ra && ra.summary.totalCount > 0 && (
                    <CollapsibleSection title="售后分析" defaultOpen={false} badge={ra.summary.totalCount + '笔'}>
                      <div className="grid grid-cols-4 gap-2.5 mb-3">
                        <KpiCard label="退款笔数" value={fmtNum(ra.summary.totalCount)} />
                        <KpiCard label="退款金额" value={fmtMoney(ra.summary.totalAmount)} />
                      </div>
                      {ra.byReason && ra.byReason.length > 0 && (
                        <div className="mb-3">
                          <div className="text-[11px] font-bold text-gray-400 mb-2.5 px-0.5">退款原因</div>
                          <SimpleTable headers={['原因', '笔数', '占比', '金额']}
                            rows={ra.byReason.map((r: any) => [r.reason, fmtNum(r.count), r.ratio.toFixed(1) + '%', fmtMoney(r.amount)])} />
                        </div>
                      )}
                      {ra.byType && ra.byType.length > 0 && (
                        <div className="mb-3">
                          <div className="text-[11px] font-bold text-gray-400 mb-2.5 px-0.5">退款类型</div>
                          <SimpleTable headers={['类型', '笔数', '占比', '金额']}
                            rows={ra.byType.map((t: any) => [t.type, fmtNum(t.count), t.ratio.toFixed(1) + '%', fmtMoney(t.amount)])} />
                          {ra.receivedRefund && ra.receivedRefund.count > 0 && (
                            <div className="mt-2 text-[11px] text-rose-500 font-medium">
                              已收货退款 {fmtNum(ra.receivedRefund.count)}笔, {fmtMoney(ra.receivedRefund.amount)}
                            </div>
                          )}
                        </div>
                      )}
                      {ra.byTimeWindow && ra.byTimeWindow.some((w: any) => w.count > 0) && (
                        <div>
                          <div className="text-[11px] font-bold text-gray-400 mb-2.5 px-0.5">退款时间窗口</div>
                          <SimpleTable headers={['窗口', '笔数', '占比', '金额']}
                            rows={ra.byTimeWindow.filter((w: any) => w.count > 0).map((w: any) => [w.window, fmtNum(w.count), w.ratio.toFixed(1) + '%', fmtMoney(w.amount)])} />
                        </div>
                      )}
                    </CollapsibleSection>
                  )}
                  {!pe && !ra && <EmptyState text="暂无营销售后数据" />}
                </div>
              )}

              {/* === Tab: 明细分析 === */}
              {!loading && !error && data && activeTab === 'details' && (
                <div className="space-y-4">
                  {sm.length > 0 && (
                    <CollapsibleSection title="SKU明细" defaultOpen={true} badge={sm.length + '个SKU'}>
                      <SimpleTable headers={['SKU名称', '销量', '占比', 'GMV', '均价', '订单', '主力']}
                        rows={sm.map((x: any, idx: number) => [x.skuName, fmtNum(x.sales), x.salesRatio.toFixed(1) + '%', fmtMoney(x.gmv), fmtMoney(x.avgPrice), fmtNum(x.orders),
                          x.isMainSku ? (
                            <span key="m" className="inline-flex items-center gap-1 text-blue-600 font-bold bg-blue-50 px-2 py-0.5 text-[10px]">
                              主力
                            </span>
                          ) : <span key="m" className="text-gray-300 text-[10px]">-</span>
                        ])} />
                    </CollapsibleSection>
                  )}
                  {lg && lg.shippedOrders > 0 && (
                    <CollapsibleSection title="发货物流" defaultOpen={false}>
                      <div className="grid grid-cols-3 gap-2.5 mb-3">
                        <KpiCard label="平均发货" value={lg.avgShipHours.toFixed(1) + 'h'} />
                        <KpiCard label="已发货" value={fmtNum(lg.shippedOrders)} />
                        <KpiCard label="超时" value={fmtNum(lg.lateCount)} color={lg.lateCount > 0 ? 'text-rose-500' : 'text-gray-700'} />
                      </div>
                      {lg.courierDistribution && lg.courierDistribution.length > 0 && (
                        <SimpleTable headers={['快递公司', '订单', '占比']}
                          rows={lg.courierDistribution.map((c: any) => [c.name, fmtNum(c.count), c.ratio.toFixed(1) + '%'])} />
                      )}
                    </CollapsibleSection>
                  )}
                  {bm && bm.uniqueBuyers > 0 && (
                    <CollapsibleSection title="买家分析" defaultOpen={false}>
                      <div className="grid grid-cols-4 gap-2.5">
                        <KpiCard label="唯一买家" value={fmtNum(bm.uniqueBuyers)} />
                        <KpiCard label="复购买家" value={fmtNum(bm.repeatBuyers)} />
                        <KpiCard label="复购率" value={bm.repeatRate.toFixed(1) + '%'} />
                        <KpiCard label="人均GMV" value={fmtMoney(bm.avgPerBuyer)} />
                      </div>
                    </CollapsibleSection>
                  )}
                  {sm.length === 0 && !lg && !bm && <EmptyState text="暂无明细数据" />}
                </div>
              )}
            </div>
          </div>
        </>
      );
    }

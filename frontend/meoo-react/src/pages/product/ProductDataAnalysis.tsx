import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Activity, RefreshCw, AlertCircle, Layers, Zap, ChevronDown, Calendar } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from 'recharts';
import { analyticsApi } from '../../../api/analyticsApi';

const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

const fmtNum = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0);

/* ── 极简 KPI 卡片 ── */
function KpiCard({ label, value, color = 'text-gray-800' }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 min-w-0">
      <div className="px-2.5 py-2">
        <div className="text-[10px] text-gray-400 truncate">{label}</div>
        <div className={'text-base font-bold ' + color + ' tabular-nums truncate mt-0.5'}>{value}</div>
      </div>
    </div>
  );
}

/* ── 折叠区 ── */
function Section({ title, defaultOpen = true, children, badge }: {
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

/* ── 简约表格 ── */
function SimpleTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  if (!rows.length) return null;
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-gray-100">
          {headers.map((h, i) => (
            <th key={i} className="text-left py-1.5 px-1.5 text-gray-400 font-semibold first:pl-0 last:pr-0 whitespace-nowrap">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ri) => (
          <tr key={ri} className="border-b border-gray-50">
            {row.map((cell, ci) => (
              <td key={ci} className="py-1.5 px-1.5 text-gray-700 first:pl-0 last:pr-0 tabular-nums whitespace-nowrap">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface SkuItem {
  skuName: string; sales: number; revenue: number; price: number; profit: number; orders: number;
  prices?: number[];
}

interface Props {
  productId: string;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  skuList?: SkuItem[];
  timeRange: string;
  customStart?: string;
  customEnd?: string;
}

export default function ProductDataAnalysis({ productId, storeId, isOpen, onClose, skuList: propSkuList, timeRange, customStart, customEnd }: Props) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [trendMetric, setTrendMetric] = useState('gmv');
  const [showSkuAll, setShowSkuAll] = useState(false);

  const fetchData = useCallback(async (showLoader = true) => {
    if (!productId || !storeId) {
      setFetchError('店铺ID不可用，请刷新页面后重试');
      setLoading(false);
      return;
    }
    if (showLoader) setLoading(true);
    setFetchError(null);
    try {
      const result = await analyticsApi.getRetrospective(storeId, productId, timeRange, customStart, customEnd, 7);
      if (result) setData(result);
      else setFetchError('服务端未返回数据');
    } catch (e: any) {
      setFetchError(e?.message || '请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  }, [productId, storeId, timeRange, customStart, customEnd]);

  useEffect(() => {
    if (isOpen && productId) {
      setData(null);
      setFetchError(null);
      setLoading(true);
      fetchData(false);
    }
  }, [isOpen, productId, timeRange, customStart, customEnd]); // eslint-disable-line react-hooks/exhaustive-deps

  const dt = data?.dailyTrend || [];
  const pc = data?.priceChanges || [];
  const skuMatrix = data?.skuMatrix || [];
  const snapshot = data?.snapshot;
  const pw = data?.profitWaterfall || [];
  const pe = data?.promoEfficiency;
  const ra = data?.refundAnalysis;

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

  const displaySkuList = useMemo(() => {
    if (skuMatrix.length > 0) return skuMatrix;
    if (propSkuList && propSkuList.length > 0) return propSkuList;
    return [];
  }, [skuMatrix, propSkuList]);

  const visibleSkuList = useMemo(
    () => showSkuAll ? displaySkuList : displaySkuList.slice(0, 10),
    [displaySkuList, showSkuAll]
  );

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/10 z-50" onClick={onClose} />

      <div className="fixed right-0 top-0 bottom-0 w-[780px] max-w-[95vw] bg-white border-l border-gray-200 z-50 overflow-y-auto">
        {/* ── 顶栏 ── */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
              商品数据分析
              <span className="text-[10px] font-normal px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                {timeRange === 'all' ? '全部' : timeRange === 'custom' ? (customStart || '') + '~' + (customEnd || '') : timeRange + '天'}
              </span>
            </h2>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {productId ? '#' + productId.slice(-8) : ''}
              {snapshot?.productName ? ' · ' + snapshot.productName.slice(0, 30) : ''}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500">
            <X size={15} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          {/* ── 加载态 ── */}
          {!data && !fetchError && (
            <div className="flex items-center justify-center py-24 text-gray-400 text-sm">
              <RefreshCw size={14} className="mr-2 animate-spin" />
              {loading ? '加载分析数据...' : '正在连接...'}
            </div>
          )}

          {/* ── 错误态 ── */}
          {fetchError && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 text-sm">
              <AlertCircle size={16} className="mb-2" />
              <p>{fetchError}</p>
              <button onClick={() => fetchData()} className="mt-3 px-3 py-1.5 text-xs bg-gray-800 text-white">重新加载</button>
            </div>
          )}

          {/* ── 数据内容 ── */}
          {data && (
            <>
              {/* ── KPI 概览 ── */}
              {snapshot && (
                <div className="grid grid-cols-4 gap-1.5">
                  <KpiCard label="总GMV" value={fmtMoney(snapshot.totalGmv)} />
                  <KpiCard label="总销量" value={fmtNum(snapshot.totalSales)} />
                  <KpiCard label="总订单" value={fmtNum(snapshot.totalOrders)} />
                  <KpiCard label="客单价" value={fmtMoney(snapshot.avgOrderValue)} />
                  <KpiCard label="活跃天数" value={snapshot.activeDays + '天'} />
                  <KpiCard label="日均销量" value={snapshot.avgDailySales.toFixed(1)} />
                  <KpiCard label="首次出单" value={snapshot.firstOrderDate || '-'} />
                  <KpiCard label="最近出单" value={snapshot.lastOrderDate || '-'} />
                </div>
              )}

              {/* ── 趋势图 ── */}
              {dt.length > 1 && (
                <Section title="数据趋势" badge={dt.length + '天'}>
                  <div className="flex items-center gap-1 mb-2 flex-wrap">
                    {[
                      { key: 'gmv', label: 'GMV' }, { key: 'sales', label: '销量' },
                      { key: 'orders', label: '订单' }, { key: 'revenue', label: '实收' },
                      { key: 'refund', label: '退款' }, { key: 'profit', label: '利润' },
                    ].map(m => (
                      <button key={m.key} onClick={() => setTrendMetric(m.key)}
                        className={'px-2 py-1 text-[10px] font-bold ' + (trendMetric === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500')}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                  <div className="h-[240px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dt} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                        <defs>
                          <linearGradient id="analysisGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.1} />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} width={40} />
                        <Tooltip content={<TrendTooltip priceChangeMap={priceChangeMap} />} />
                        <Area type="monotone" dataKey={trendMetric} stroke="#3b82f6" strokeWidth={2} fill="url(#analysisGrad)"
                          dot={(props: any) => {
                            const { cx, cy, payload } = props;
                            if (!payload?.date) return null;
                            const changes = priceChangeMap[payload.date];
                            if (!changes) return null;
                            return (
                              <circle cx={cx} cy={cy} r={5} fill="#f59e0b" stroke="#fff" strokeWidth={2.5} />
                            );
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
                </Section>
              )}

              {/* ── SKU改价趋势 ── */}
              {propSkuList && propSkuList.filter(s => (s.prices?.length || 0) >= 2).length > 0 && (() => {
                const topSku = [...propSkuList].filter(s => (s.prices?.length || 0) >= 2).sort((a, b) => b.sales - a.sales).slice(0, 5);
                const maxLen = Math.max(...topSku.map(s => s.prices?.length || 0));
                if (maxLen < 2) return null;
                const chartData = Array.from({ length: maxLen }, (_, i) => {
                  const point: Record<string, any> = { index: `#${i + 1}` };
                  topSku.forEach(s => {
                    if (s.prices && i < s.prices.length) point[s.skuName] = s.prices[i];
                  });
                  return point;
                });
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <Section title="SKU改价趋势" badge={topSku.length + '个SKU'}>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="index" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `¥${v.toFixed(0)}`} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '11px' }}
                            formatter={(v: number, name: string) => [`¥${v.toFixed(2)}`, name]} />
                          {topSku.map((s, i) => (
                            <Line key={s.skuName + i} type="monotone" dataKey={s.skuName} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 justify-center">
                      {topSku.map((s, i) => (
                        <div key={s.skuName + i} className="flex items-center gap-1 text-[10px] text-gray-500">
                          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i % colors.length] }} />
                          <span className="max-w-[80px] truncate">{s.skuName}</span>
                        </div>
                      ))}
                    </div>
                  </Section>
                );
              })()}

              {/* ── SKU 明细 ── */}
              {displaySkuList.length > 0 && (
                <Section title="SKU 明细" badge={displaySkuList.length + '个SKU'}>
                  <SimpleTable
                    headers={['SKU', '单价', '销量', '收入', '利润', '订单']}
                    rows={visibleSkuList.map((s: any) => [
                      s.skuName || '-',
                      <span className="font-mono">¥{(s.price || s.avgPrice || 0).toFixed(2)}</span>,
                      <span className="font-semibold">{fmtNum(s.sales || 0)}</span>,
                      fmtMoney(s.revenue || s.gmv || 0),
                      <span className={'font-mono font-semibold ' + ((s.profit || s.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-500')}>
                        {fmtMoney(s.profit || s.netProfit || 0)}
                      </span>,
                      fmtNum(s.orders || 0),
                    ])}
                  />
                  {displaySkuList.length > 10 && !showSkuAll && (
                    <button onClick={() => setShowSkuAll(true)}
                      className="w-full text-center py-1.5 text-[11px] text-blue-500 bg-gray-50">
                      查看全部 {displaySkuList.length} 个SKU
                    </button>
                  )}
                </Section>
              )}

              {/* ── 利润拆解 ── */}
              {pw.length > 0 && (
                <Section title="利润拆解">
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
                </Section>
              )}

              {/* ── 推广效率 ── */}
              {pe && pe.summary && pe.summary.cost > 0 && (
                <Section title="推广效率">
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    <KpiCard label="推广花费" value={fmtMoney(pe.summary.cost)} />
                    <KpiCard label="推广成交" value={fmtMoney(pe.summary.transaction)} />
                    <KpiCard label="ROI" value={pe.summary.roi.toFixed(2)} />
                    <KpiCard label="CTR" value={pe.summary.ctr.toFixed(1) + '%'} />
                  </div>
                  {pe.byScene && pe.byScene.length > 0 && (
                    <SimpleTable headers={['场景', '花费', '成交', '订单', 'ROI', '占比']}
                      rows={pe.byScene.map((s: any) => [s.scene, fmtMoney(s.cost), fmtMoney(s.transaction), fmtNum(s.orders), s.roi.toFixed(2), s.ratio.toFixed(1) + '%'])} />
                  )}
                </Section>
              )}

              {/* ── 售后分析 ── */}
              {ra && ra.summary && ra.summary.totalCount > 0 && (
                <Section title="售后分析" badge={ra.summary.totalCount + '笔'}>
                  <div className="grid grid-cols-3 gap-1.5 mb-2">
                    <KpiCard label="退款笔数" value={fmtNum(ra.summary.totalCount)} />
                    <KpiCard label="退款金额" value={fmtMoney(ra.summary.totalAmount)} />
                    <KpiCard label="退款率" value={(ra.summary.totalCount / (snapshot?.totalOrders || 1) * 100).toFixed(1) + '%'} />
                  </div>
                  {ra.byReason && ra.byReason.length > 0 && (
                    <>
                      <div className="text-[10px] font-bold text-gray-400 mb-1">退款原因</div>
                      <SimpleTable headers={['原因', '笔数', '占比', '金额']}
                        rows={ra.byReason.map((r: any) => [r.reason, fmtNum(r.count), r.ratio.toFixed(1) + '%', fmtMoney(r.amount)])} />
                    </>
                  )}
                </Section>
              )}

              {dt.length === 0 && displaySkuList.length === 0 && (
                <div className="flex items-center justify-center py-16 text-gray-400 text-sm">暂无足够的分析数据</div>
              )}
            </>
          )}
        </div>
      </div>
    </>
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

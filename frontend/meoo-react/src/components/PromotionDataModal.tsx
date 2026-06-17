// ── 推广分析面板（右侧滑出，匹配商品复盘风格）──
import React, { useState, useMemo } from 'react';
import {
  X, Megaphone, TrendingUp, DollarSign, MousePointerClick,
  Eye, Target, BarChart3, Activity, TrendingDown,
  ChevronDown, ArrowUp, ArrowDown, ShoppingCart, RefreshCw
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  timeRange?: string;
}

/* ── 工具函数 ── */
const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

const fmtNum = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0);

/* ── 折叠区 ── */
function CollapsibleSection({ title, defaultOpen = true, children, badge }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode; badge?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
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

/* ── KPI 卡片 ── */
function KpiCard({ label, value, color = 'text-gray-800', sub }: {
  label: string; value: string; color?: string; sub?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 min-w-0">
      <div className="px-2.5 py-2">
        <div className="text-[10px] text-gray-400 truncate">{label}</div>
        <div className={'text-base font-bold ' + color + ' tabular-nums truncate mt-0.5'}>{value}</div>
        {sub && <div className="text-[10px] text-gray-400 mt-0.5 truncate">{sub}</div>}
      </div>
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

/* ── 空状态 ── */
function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-16 text-gray-400 text-sm">{text}</div>
  );
}

export default function PromotionDataModal({ isOpen, onClose, product }: Props) {
  const [promoTrendMetric, setPromoTrendMetric] = useState('cost');

  // ── 核心指标计算 ──
  const metrics = useMemo(() => {
    if (!product) return null;
    const pc = product.promoCost || 0;
    const pt = product.promoTransaction || 0;
    const clicks = product.promoClicks || 0;
    const imps = product.promoImpressions || 0;
    const orders = product.orders || 0;
    const gmv = product.gmv || 0;
    const costRatio = product.promoCostRatio || 0;
    const roi = pc > 0 ? pt / pc : 0;
    const ctr = imps > 0 ? (clicks / imps) * 100 : 0;
    const cpc = clicks > 0 ? pc / clicks : 0;
    const avgOrderValue = product.avgOrderValue || 0;
    const transactionRatio = gmv > 0 ? (pt / gmv) * 100 : 0;
    const promoOrderRatio = orders > 0 ? ((product.promoOrders || 0) / orders) * 100 : 0;
    const costPerOrder = orders > 0 ? pc / orders : 0;
    const discountRatio = product.discountRatio || 0;
    return {
      cost: pc, transaction: pt, roi, costRatio, clicks, impressions: imps,
      ctr, cpc, avgOrderValue, transactionRatio, promoOrderRatio,
      costPerOrder, discountRatio, orders, gmv, promoOrders: product.promoOrders || 0,
    };
  }, [product]);

  // ── 按来源聚合 ──
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
        source: src,
        cost: v.cost,
        transaction: v.transaction,
        orders: v.orders,
        clicks: v.clicks,
        impressions: v.impressions,
        roi: v.cost > 0 ? v.transaction / v.cost : 0,
        ratio: totalCost > 0 ? (v.cost / totalCost) * 100 : 0,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [product?.promoSourceDetails]);

  // ── 推广日趋势数据（从 promoSourceDetails 按日期聚合）──
  const promoTrendData = useMemo(() => {
    if (!product?.promoSourceDetails?.length) return [];
    const dayMap: Record<string, any> = {};
    (product.promoSourceDetails as any[]).forEach((s: any) => {
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
    // 补充 roi 字段
    sorted.forEach((d: any) => {
      d.roi = d.cost > 0 ? d.transaction / d.cost : 0;
      d.ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
    });
    return sorted;
  }, [product?.promoSourceDetails]);

  // ── 趋势图 tooltip（显示当天所有指标）──
  const PromoTrendTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const dayData = promoTrendData.find((d: any) => d.date === label);
    if (!dayData) return null;
    const LABEL_MAP: Record<string, string> = {
      cost: '推广花费', transaction: '推广成交', roi: 'ROI',
      clicks: '点击量', impressions: '展现量', orders: '成交订单', ctr: '点击率'
    };
    const fmtVal = (key: string, val: number) => {
      if (['roi', 'ctr'].includes(key)) return Number(val).toFixed(2) + (key === 'ctr' ? '%' : '');
      if (['cost', 'transaction'].includes(key)) return fmtMoney(val);
      return fmtNum(val);
    };
    return (
      <div className="bg-white border border-gray-200 px-3 py-2 text-xs shadow-sm" style={{ maxWidth: '220px' }}>
        <div className="font-bold text-gray-700 mb-1.5">{label}</div>
        <div className="space-y-1">
          {['cost', 'transaction', 'roi', 'clicks', 'impressions', 'orders'].map(key => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-gray-500">{LABEL_MAP[key]}</span>
              <span className={'font-bold tabular-nums ' + (
                key === 'roi' ? (dayData[key] >= 1 ? 'text-green-600' : 'text-red-500') :
                key === 'cost' ? 'text-red-500' :
                key === 'transaction' ? 'text-green-600' : 'text-gray-800'
              )}>
                {fmtVal(key, dayData[key] || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!product) return null;

  const m = metrics;
  const hasPromoData = m && m.cost > 0;

  return (
    <>
      {isOpen && (
        <>
          {/* 遮罩 */}
          <div className="fixed inset-0 bg-black/10 z-50" onClick={onClose} />

          {/* 侧边面板 */}
          <div className="fixed right-0 top-0 bottom-0 w-[780px] max-w-[95vw] bg-white border-l border-gray-200 z-50 overflow-y-auto">

            {/* ── 顶栏 ── */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                  商品推广分析
                  {timeRange && (
                    <span className="text-[10px] font-normal px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      {timeRange === 'all' ? '全部' : timeRange + '天'}
                    </span>
                  )}
                </h2>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {product.productId ? '#' + product.productId.slice(-8) : ''}
                  {product.productName && !product.name && ' · ' + String(product.productName).slice(0, 30)}
                  {product.name && ' · ' + String(product.name).slice(0, 30)}
                </p>
              </div>
              <button onClick={onClose} className="p-1 text-gray-300 hover:text-gray-500">
                <X size={15} />
              </button>
            </div>

            <div className="p-4 space-y-3">

              {!hasPromoData && (
                <EmptyState text="该商品暂无推广数据" />
              )}

              {hasPromoData && m && (
                <>
                  {/* ── 推广概览 — 8个KPI卡片 ── */}
                  <CollapsibleSection title="推广概览" defaultOpen={true}>
                    <div className="grid grid-cols-4 gap-2.5">
                      <KpiCard label="推广花费" value={fmtMoney(m.cost)} color="text-red-500" />
                      <KpiCard label="推广成交" value={fmtMoney(m.transaction)} color="text-green-600" />
                      <KpiCard label="推广ROI" value={m.roi.toFixed(2)} color={m.roi >= 1 ? 'text-green-600' : 'text-red-500'} />
                      <KpiCard label="推广费占比" value={m.costRatio.toFixed(1) + '%'} color="text-purple-600" />
                      <KpiCard label="点击量" value={fmtNum(m.clicks)} color="text-amber-600" />
                      <KpiCard label="展现量" value={fmtNum(m.impressions)} color="text-cyan-600" />
                      <KpiCard label="点击率CTR" value={m.ctr.toFixed(2) + '%'} color="text-indigo-600" />
                      <KpiCard label="平均点击单价" value={m.cpc > 0 ? fmtMoney(m.cpc) : '-'} color="text-pink-600" />
                    </div>
                  </CollapsibleSection>

                  {/* ── 推广趋势图 ── */}
                  {promoTrendData.length > 1 && (
                    <CollapsibleSection title="推广趋势" defaultOpen={true} badge={promoTrendData.length + '天'}>
                      <div className="flex items-center gap-1 mb-3 flex-wrap">
                        {[
                          { key: 'cost', label: '花费', color: '#ef4444' },
                          { key: 'transaction', label: '成交', color: '#22c55e' },
                          { key: 'roi', label: 'ROI', color: '#3b82f6' },
                          { key: 'clicks', label: '点击', color: '#f59e0b' },
                          { key: 'impressions', label: '展现', color: '#06b6d4' },
                        ].map(m => (
                          <button key={m.key} onClick={() => setPromoTrendMetric(m.key)}
                            className={'px-2 py-1 text-[10px] font-bold ' + (promoTrendMetric === m.key ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500')}>
                            {m.label}
                          </button>
                        ))}
                      </div>
                      <div className="h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={promoTrendData} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                            <defs>
                              {(['cost', 'transaction', 'roi', 'clicks', 'impressions']).map(k => {
                                const colors: Record<string, string> = {
                                  cost: '#ef4444', transaction: '#22c55e', roi: '#3b82f6',
                                  clicks: '#f59e0b', impressions: '#06b6d4'
                                };
                                const c = colors[k] || '#f59e0b';
                                return (
                                  <linearGradient key={k} id={'promoGrad_' + k} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={c} stopOpacity={0.12} />
                                    <stop offset="100%" stopColor={c} stopOpacity={0} />
                                  </linearGradient>
                                );
                              })}
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: '#bbb' }} axisLine={false} tickLine={false} width={40} />
                            <Tooltip content={<PromoTrendTooltip />} />
                            <Area type="monotone" dataKey={promoTrendMetric}
                              stroke={({ cost: '#ef4444', transaction: '#22c55e', roi: '#3b82f6', clicks: '#f59e0b', impressions: '#06b6d4' } as any)[promoTrendMetric] || '#f59e0b'}
                              strokeWidth={2}
                              fill={'url(#promoGrad_' + promoTrendMetric + ')'}
                              dot={false}
                              activeDot={{ r: 4, fill: ({ cost: '#ef4444', transaction: '#22c55e', roi: '#3b82f6', clicks: '#f59e0b', impressions: '#06b6d4' } as any)[promoTrendMetric] || '#f59e0b' }}
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                      {/* 图例说明 */}
                      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400 flex-wrap">
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-red-500" /> 花费
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500" /> 成交
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500" /> ROI
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-amber-500" /> 点击
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-cyan-500" /> 展现
                        </span>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* ── 推广来源 ── */}
                  {sourceBreakdown.length > 0 && (
                    <CollapsibleSection title="推广来源" defaultOpen={true} badge={sourceBreakdown.length + '个来源'}>
                      <SimpleTable
                        headers={['来源', '花费', '成交', '订单', 'ROI', '花费占比']}
                        rows={sourceBreakdown.map(s => [
                          <span className="font-medium text-gray-700">{s.source}</span>,
                          fmtMoney(s.cost),
                          fmtMoney(s.transaction),
                          fmtNum(s.orders),
                          <span className={'font-semibold ' + (s.roi >= 1 ? 'text-green-600' : 'text-red-500')}>{s.roi.toFixed(2)}</span>,
                          s.ratio.toFixed(1) + '%',
                        ])}
                      />
                    </CollapsibleSection>
                  )}

                  {/* ── 推广效率 ── */}
                  <CollapsibleSection title="推广效率" defaultOpen={true}>
                    <div className="grid grid-cols-4 gap-2.5 mb-3">
                      <KpiCard label="推广成交占比" value={m.transactionRatio.toFixed(1) + '%'} sub={'GMV ' + fmtMoney(m.gmv)} />
                      <KpiCard label="每单推广费" value={fmtMoney(m.costPerOrder)} sub={'订单 ' + fmtNum(m.orders)} />
                      <KpiCard label="推广订单占比" value={m.promoOrderRatio.toFixed(1) + '%'} sub={'推广单 ' + fmtNum(m.promoOrders)} />
                      <KpiCard label="折扣率" value={m.discountRatio.toFixed(1) + '%'} color={m.discountRatio > 10 ? 'text-amber-600' : 'text-gray-700'} />
                    </div>
                    {m.promoOrders > 0 && m.transaction > 0 && (
                      <div className="text-[11px] text-gray-600 leading-relaxed space-y-1 bg-gray-50/70 rounded-lg p-3">
                        <p>
                          该商品累计推广花费 <strong className="text-red-500">{fmtMoney(m.cost)}</strong>，
                          带来推广成交 <strong className="text-green-600">{fmtMoney(m.transaction)}</strong>，
                          投产比 <strong className="text-blue-600">{m.roi.toFixed(2)}</strong>。
                        </p>
                        <p>
                          每获得一次点击平均花费 <strong className="text-pink-600">{m.cpc > 0 ? fmtMoney(m.cpc) : '-'}</strong>，
                          点击率 <strong className="text-indigo-600">{m.ctr.toFixed(2)}%</strong>。
                        </p>
                        <p>
                          推广成交占全店 <strong className="text-gray-700">{m.transactionRatio.toFixed(1)}%</strong>，
                          每单推广成本 <strong className="text-gray-700">{fmtMoney(m.costPerOrder)}</strong>。
                        </p>
                      </div>
                    )}
                  </CollapsibleSection>

                </>
              )}

              {/* 没有推广数据但有商品信息时显示简要商品信息 */}
              {!hasPromoData && product && (
                <div className="bg-gray-50/50 rounded-lg border border-gray-100 p-4 text-[11px] text-gray-500">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between">
                      <span>商品售价</span>
                      <span className="font-semibold text-gray-700">{m?.avgOrderValue ? fmtMoney(m.avgOrderValue) : '--'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>总销量</span>
                      <span className="font-semibold text-gray-700">{fmtNum(product.sales || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>总GMV</span>
                      <span className="font-semibold text-gray-700">{fmtMoney(product.gmv || 0)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>总订单</span>
                      <span className="font-semibold text-gray-700">{fmtNum(product.orders || 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

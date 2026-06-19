import React, { useState } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, X, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { KPI_LINES, ChartTooltip } from '../../utils/trendData';

// ─── 指标分组定义 ────────────────────────────────────
const KPI_GROUPS: { name: string; labels: string[] }[] = [
  {
    name: '收入',
    labels: ['GMV（商品总价）', '商家实收', '用户实付', '自然销售额', '优惠总额'],
  },
  {
    name: '订单',
    labels: ['有效订单量', '客单价', '买家数', '商品数', '自然单', '平均发货时长', '发货率', 'SKU数量'],
  },
  {
    name: '退款/售后',
    labels: ['退款金额', '退款单数', '退款率', '售后率', '退款金额(按同意退款时间)', '退款单数(按同意退款时间)'],
  },
  {
    name: '利润',
    labels: ['利润金额', '罚款金额', '罚款次数'],
  },
  {
    name: '推广',
    labels: ['推广花费', '推广GMV', '推广ROI', '推广订单量', '推广占比', '全店投产'],
  },
  {
    name: '广告效果',
    labels: ['点击率', '转化率', '平均点击成本', '平均获客成本', '曝光量', '点击量', '询单成本', '收藏成本', '关注成本'],
  },
  {
    name: '费用',
    labels: ['平台服务费', '快递成本', '运费险', '退款成功快递发货成本', '退货退回成本'],
  },
];

interface KpiCardItem {
  label: string;
  value: number | undefined;
  fmt: (v: number) => string;
  icon: any;
  change: number | null;
  source?: string;
}

interface Props {
  kpiCards: KpiCardItem[];
  allKpiCards: KpiCardItem[];
  visibleKpis: Set<string>;
  setVisibleKpis: (s: Set<string>) => void;
  showKpiSelector: boolean;
  setShowKpiSelector: (v: boolean) => void;
  filteredOrders: any[];
  noData: boolean;
  onCardClick: (label: string) => void;
  onDetailClick?: (label: string) => void;
  onCardReorder?: (newOrder: KpiCardItem[]) => void;
  /** 指标选择面板中勾选时触发，用于将选中指标置顶 */
  onKpiSelect?: (label: string) => void;
  dailyKpiData: Record<string, any>[];
  compareData: Record<string, any>[];
  selectedTrendKpis: Set<string>;
  rangeLabel: string;
  compareEnabled: boolean;
  onClearLines?: () => void;
}

export default function DashboardKpiPanel({
  kpiCards, allKpiCards, visibleKpis, setVisibleKpis, showKpiSelector, setShowKpiSelector,
  filteredOrders, noData,
  onCardClick, onDetailClick, onCardReorder, onKpiSelect,
  dailyKpiData, compareData, selectedTrendKpis, rangeLabel, compareEnabled,
  onClearLines
}: Props) {
  // 获取已选中的 KPI 线信息
  const selectedLines = KPI_LINES.filter(l => selectedTrendKpis.has(l.key));
  // 指标选择面板搜索
  const [kpiSearch, setKpiSearch] = useState('');

  // 根据 KPI_LINES key 找到对应的卡片 label（42个全映射）
  const getCardLabelForKey = (key: string): string | undefined => {
    const map: Record<string, string> = {
      'gmv': 'GMV（商品总价）', 'merchantReceived': '商家实收', 'paid': '用户实付',
      'organicGmv': '自然销售额', 'discount': '优惠总额',
      'orderCount': '有效订单量', 'avgPrice': '客单价',
      'buyerCount': '买家数', 'productCount': '商品数',
      'organicOrders': '自然单', 'avgShipHours': '平均发货时长', 'shipRate': '发货率',
      'skuQty': 'SKU数量',
      'refundAmount': '退款金额', 'rfCount': '退款单数',
      'rfRate': '退款率', 'asRate': '售后率',
      'refundApprovalAmount': '退款金额(按同意退款时间)',
      'refundApprovalOrders': '退款单数(按同意退款时间)',
      'profit': '利润金额', 'penaltyAmount': '罚款金额', 'penaltyCount': '罚款次数',
      'promoCost': '推广花费', 'promoGmv': '推广GMV', 'promoRoi': '推广ROI',
      'promoOrders': '推广订单量', 'promoRatio': '推广占比', 'shopRoi': '全店投产',
      'totalImpressions': '曝光量', 'totalClicks': '点击量',
      'ctr': '点击率', 'cvr': '转化率', 'cpc': '平均点击成本', 'cpa': '平均获客成本',
      'avgInquiryCost': '询单成本', 'avgFavoriteCost': '收藏成本', 'avgFollowCost': '关注成本',
      'refundedShippingCost': '退款成功快递发货成本', 'returnShippingCost': '退货退回成本',
      'platformFee': '平台服务费', 'postage': '快递成本', 'insurance': '运费险',
    };
    return map[key];
  };

  /** 勾选/取消指标 */
  const toggleKpi = (label: string) => {
    const wasChecked = visibleKpis.has(label);
    const newSet = new Set(visibleKpis);
    if (wasChecked) newSet.delete(label); else newSet.add(label);
    setVisibleKpis(newSet);
    // 选中时置顶（调用的父级 setKpiCardOrder 将其移到第1位）
    if (!wasChecked && onKpiSelect) onKpiSelect(label);
  };

  // 已选指标数量
  const checkedCount = visibleKpis.size;

  return (
    <div>
      {/* 指标选择面板 — 分组式 */}
      {showKpiSelector && (
        <div className="bg-pdd-card rounded-lg border border-pdd-border mb-3 overflow-hidden shadow-lg">
          {/* 搜索栏 */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-pdd-border/50">
            <Search size={13} className="text-pdd-text-secondary/50 shrink-0" />
            <input
              type="text"
              value={kpiSearch}
              onChange={e => setKpiSearch(e.target.value)}
              placeholder="搜索指标…"
              className="flex-1 bg-transparent text-xs text-pdd-text outline-none placeholder:text-pdd-text-secondary/30"
            />
            {/* 全选 / 清空 */}
            {!kpiSearch.trim() && (
              <div className="flex items-center gap-2 text-[10px]">
                {checkedCount === allKpiCards.length ? (
                  <button onClick={() => { setVisibleKpis(new Set()); }} className="text-pdd-text-secondary/40 hover:text-pdd-danger transition-colors">清空</button>
                ) : (
                  <button onClick={() => { setVisibleKpis(new Set(allKpiCards.map(k => k.label))); }} className="text-pdd-text-secondary/40 hover:text-pdd-primary transition-colors">全选</button>
                )}
              </div>
            )}
            <span className="text-[10px] text-pdd-text-secondary/40 tabular-nums">{checkedCount}/{allKpiCards.length}</span>
          </div>
          {/* 指标列表：有搜索 → 平铺；无搜索 → 分组 */}
          <div className="max-h-64 overflow-y-auto p-2">
            {kpiSearch.trim() ? (
              /* ── 搜索模式：平铺所有匹配项 ── */
              (() => {
                const q = kpiSearch.trim().toLowerCase();
                const matched = allKpiCards.filter(k => k.label.toLowerCase().includes(q));
                if (matched.length === 0) return <div className="text-xs text-pdd-text-secondary/40 text-center py-4">无匹配指标</div>;
                return (
                  <div className="flex flex-wrap gap-1">
                    {matched.map(k => {
                      const isChecked = visibleKpis.has(k.label);
                      return (
                        <button key={k.label} onClick={() => toggleKpi(k.label)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                            isChecked
                              ? 'bg-pdd-primary/10 text-pdd-primary border border-pdd-primary/25'
                              : 'text-pdd-text-secondary/70 border border-transparent hover:bg-pdd-gray-100/50'
                          }`}
                        >
                          {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                          <span>{k.label}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              /* ── 分组模式 ── */
              <div className="space-y-2">
                {KPI_GROUPS.map(group => {
                  const groupCards = allKpiCards.filter(k => group.labels.includes(k.label));
                  if (groupCards.length === 0) return null;
                  const checkedInGroup = groupCards.filter(k => visibleKpis.has(k.label)).length;
                  const allChecked = checkedInGroup === groupCards.length;
                  const noneChecked = checkedInGroup === 0;
                  return (
                    <div key={group.name}>
                      {/* 分组头 */}
                      <div className="flex items-center justify-between px-1 py-1">
                        <span className="text-[10px] font-medium text-pdd-text-secondary/60 uppercase tracking-wider">{group.name}</span>
                        <button
                          onClick={() => {
                            const newSet = new Set(visibleKpis);
                            if (allChecked) {
                              groupCards.forEach(k => newSet.delete(k.label));
                            } else {
                              groupCards.forEach(k => newSet.add(k.label));
                            }
                            setVisibleKpis(newSet);
                            // 选中时逐个通知父级排序
                            if (!allChecked && onKpiSelect) {
                              groupCards.forEach(k => { if (!visibleKpis.has(k.label)) onKpiSelect(k.label); });
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                            allChecked
                              ? 'text-pdd-primary/60 hover:text-pdd-primary bg-pdd-primary/5'
                              : noneChecked
                                ? 'text-pdd-text-secondary/30 hover:text-pdd-text-secondary/60'
                                : 'text-pdd-warning/60 hover:text-pdd-warning'
                          }`}
                        >
                          {allChecked ? '取消全选' : noneChecked ? '全选' : `已选${checkedInGroup}/${groupCards.length}`}
                        </button>
                      </div>
                      {/* 分组内指标按钮 */}
                      <div className="flex flex-wrap gap-1 px-1 pb-2">
                        {groupCards.map(k => {
                          const isChecked = visibleKpis.has(k.label);
                          return (
                            <button key={k.label} onClick={() => toggleKpi(k.label)}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all ${
                                isChecked
                                  ? 'bg-pdd-primary/10 text-pdd-primary border border-pdd-primary/25'
                                  : 'text-pdd-text-secondary/70 border border-transparent hover:bg-pdd-gray-100/50'
                              }`}
                            >
                              {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                              <span>{k.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* KPI 卡片网格 */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpiCards.map((c) => (
            <div
              key={c.label}
              onClick={() => onCardClick(c.label)}
              className="bg-pdd-card rounded-lg border border-pdd-border px-4 py-3 cursor-pointer hover:border-pdd-primary/30 transition-colors">
              <div className="flex items-center gap-1.5 mb-0.5">
                <c.icon size={13} className="text-pdd-text-secondary" />
                <span className="text-[11px] font-medium text-pdd-text-secondary/80">{c.label}</span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-semibold text-pdd-text tracking-tight">{noData ? '--' : c.value != null ? c.fmt(c.value) : '--'}</span>
                {c.change != null && Math.abs(c.change) > 0.01 && (
                  <span className={`text-[11px] ${c.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                    {c.change > 0 ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />}
                    {Math.abs(c.change).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* 趋势图 */}
      {dailyKpiData.length > 0 && (
        <div className="mt-4 bg-pdd-card rounded-lg border border-pdd-border overflow-hidden">
          {/* 图标题栏 */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
              <TrendingUp size={13} className="text-pdd-primary" />指标趋势
            </h3>
            {selectedLines.length > 0 && (
              <button
                onClick={() => onClearLines?.()}
                className="text-[10px] px-2 py-0.5 rounded border border-pdd-border text-pdd-text-secondary hover:text-pdd-danger hover:border-pdd-danger/30 transition-colors"
              >清屏</button>
            )}
          </div>

          {/* 已选指标标签行 */}
          {selectedLines.length > 0 && (
            <div className="flex items-center flex-wrap gap-1 px-4 py-1">
              {selectedLines.map(l => (
                <span
                  key={l.key}
                  onClick={() => {
                    const cardLabel = getCardLabelForKey(l.key);
                    if (cardLabel) onCardClick(cardLabel);
                  }}
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] cursor-pointer transition-colors hover:opacity-80"
                  style={{ backgroundColor: l.color + '15', color: l.color, border: '1px solid ' + l.color + '30' }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: l.color, display: 'inline-block' }} />
                  {l.label}
                  <X size={9} className="opacity-60 hover:opacity-100" />
                </span>
              ))}
            </div>
          )}

          {/* 图表 */}
          <div className="px-3 pb-3">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={(() => {
                if (!compareEnabled || !compareData.length) return dailyKpiData;
                const cmpMap: Record<string, any> = {};
                compareData.forEach((d: any) => { cmpMap[d._fullDate || d.date] = d; });
                return dailyKpiData.map((d: any) => {
                  const cmp = cmpMap[d._fullDate || d.date];
                  if (!cmp) return d;
                  const merged = { ...d };
                  Object.keys(cmp).forEach(k => {
                    if (k !== 'date' && k !== '_fullDate') merged[k + '_prev'] = cmp[k];
                  });
                  return merged;
                });
              })()} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" strokeOpacity={0.4} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)', strokeOpacity: 0.5 }} tickLine={false} />
                <YAxis yAxisId="value" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} width={45} />
                {[...selectedTrendKpis].some(k => KPI_LINES.find(l => l.key === k)?.type === 'percent') && (
                  <YAxis yAxisId="percent" orientation="right" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} unit="%" width={35} />
                )}
                <Tooltip content={<ChartTooltip />} />
                {selectedLines.map(l => (
                  <Line key={l.key} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={false} activeDot={{ r: 3, strokeWidth: 0 }} />
                ))}
                {compareEnabled && selectedLines.map(l => (
                  <Line key={l.key + '_prev'} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key + '_prev'} name={l.label + '(上期)'} stroke={l.color} strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ArrowUp, ArrowDown, TrendingUp, X, Search } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { KPI_LINES, ChartTooltip } from '../../utils/trendData';
import { DndContext, DragEndEvent, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ════════════════════════════════════════════════════════════════════════
//  ★★★  新增KPI完整指南  ★★★
//
//  【历史教训】之前 自然单/自然销售额/快递成本/平均询单成本/平均收藏成本/
//  平均关注成本/总询单成本/总收藏成本/总关注成本 这 9 个KPI无法被选择器控制，
//  就是因为没有完成以下所有步骤，导致"显示了但勾不掉"的bug。
//
//  【新增一个KPI必须修改以下 4 处（缺一不可）】
//
//  ① 本文件 KPI_GROUPS  ↓↓↓  把 label 加到对应分组
//     例: labels: ['新指标名', ...]
//
//  ② 本文件 getCardLabelForKey  ↓↓↓  加上 key → label 映射
//     例: 'newKpiKey': '新指标名',
//
//  ③ trendData.tsx 的 KPI_LINES  ↓↓↓  加上趋势线定义（color, type）
//     例: { key: 'newKpiKey', label: '新指标名', type: 'value', color: '#xxxxxx' },
//
//  ④ DashboardPage.tsx 的 allKpiCards 计算区  ↓↓↓  算出 value/change/fmt
//     例: { label: '新指标名', value: ..., change: ..., fmt: ..., icon: ... },
//
//  如果涉及后端新字段，还需要加：
//  ⑤ backend/src/shared-types.ts → 类型定义
//  ⑥ backend/src/services/dataService.ts → 聚合逻辑
//
//  【常见错误自查】
//  ☐ 选择器面板里找不到这个指标？ → 漏了 ①
//  ☐ 勾了不显示卡片？            → 漏了 ④
//  ☐ 趋势图选不到这个指标？      → 漏了 ③
//  ☐ 勾掉又自动出现？            → 漏了 ② 或者 MUST_SHOW 没删干净
// ════════════════════════════════════════════════════════════════════════
const KPI_GROUPS: { name: string; labels: string[] }[] = [
  {
    name: '收入',
    labels: [
      'GMV（商品总价）', '商家实收', '用户实付', '自然销售额', '优惠总额',
      '净GMV(GMV-退款)', '净实收(实收-退款)', '单均GMV', '单均实收',
      '实收/GMV比', '实付/GMV比', '自然占比', '折扣率', '单均优惠',
    ],
  },
  {
    name: '订单',
    labels: [
      '有效订单量', '客单价', '买家数', '商品数',
      '自然单', '平均发货时长', '发货率', 'SKU数量',
      '人均订单数', '每单件数',
    ],
  },
  {
    name: '退款/售后',
    labels: [
      '退款金额', '退款单数', '退款率', '售后率',
      '退款金额(按同意退款时间)', '退款单数(按同意退款时间)',
      '平均退款额', '退款侵蚀率', '同意退款率',
      '退款后实收', '退款成本合计',
    ],
  },
  {
    name: '利润',
    labels: [
      '利润金额', '净利润率', '毛利润', '毛利率',
      '单均利润', '单均实收', '人均利润', '单商品利润', '单SKU利润',
      '罚款金额', '罚款次数', '调整后利润(去罚款)',
    ],
  },
  {
    name: '成本与费用',
    labels: [
      '平台服务费', '快递成本', '运费险',
      '平台费率', '快递费率', '运费险率',
      '总成本率', '总运营成本', '单均运营成本',
      '退款成功快递发货成本', '退货退回成本',
      '退款单均成本',
    ],
  },
  {
    name: '推广',
    labels: [
      '推广花费', '推广GMV', '推广ROI', '推广订单量', '推广占比', '全店投产',
      '曝光量', '点击量',
      '推广订单占比', '推广GMV占比', '单均推广费', '单品均推广费',
      '自然单占比', '推广费用率', '推广收入比',
    ],
  },
  {
    name: '广告效果',
    labels: [
      '点击率', '转化率', '点击转化率',
      '平均点击成本', '平均订单花费', '千次曝光成本',
      '每点击GMV', '每点击收入',
    ],
  },
  {
    name: '推广互动成本',
    labels: [
      '总询单成本', '总收藏成本', '总关注成本',
      '平均询单成本', '平均收藏成本', '平均关注成本',
      '总互动成本', '互动成本率', '单次互动成本',
    ],
  },
  {
    name: '商品结构',
    labels: [
      '商品数', 'SKU数量',
      '单商品收入', '单商品利润', '单商品订单',
    ],
  },
  {
    name: '客户价值',
    labels: [
      '买家数', '人均订单数', '人均消费', '人均利润',
      '人均SKU数',
    ],
  },
  {
    name: '物流履约',
    labels: [
      '平均发货时长', '发货率', '快递成本', '快递费率',
    ],
  },
  {
    name: '财务',
    labels: [
      '罚款金额', '罚款次数', '百亿补贴', '平台服务费',
      '罚款占利润比',
    ],
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

// ─── 可拖拽 KPI 卡片（与原始卡片样式完全一致，无任何额外装饰） ───
function SortableKpiCard({ card, noData, onCardClick }: { card: KpiCardItem; noData: boolean; onCardClick: (label: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: card.label });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    position: 'relative',
    zIndex: isDragging ? 50 : 'auto',
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onCardClick(card.label)}
      className="bg-pdd-card rounded-lg border border-pdd-border px-4 py-3 cursor-grab active:cursor-grabbing hover:border-pdd-primary/30 transition-colors"
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        <card.icon size={13} className="text-pdd-text-secondary" />
        <span className="text-[11px] font-medium text-pdd-text-secondary/80">{card.label}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-xl font-semibold text-pdd-text tracking-tight">{noData ? '--' : card.value != null ? card.fmt(card.value) : '--'}</span>
        {card.change != null && Math.abs(card.change) > 0.01 && (
          <span className={`text-[11px] ${card.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>
            {card.change > 0 ? <ArrowUp size={10} className="inline" /> : <ArrowDown size={10} className="inline" />}
            {Math.abs(card.change).toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
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

  // ★ 构建 label → { value, fmt } 映射，用于选择器显示数值
  const kpiValueMap = useMemo(() => {
    const map = new Map<string, { value: number | undefined; fmt: (v: number) => string }>();
    allKpiCards.forEach(k => map.set(k.label, { value: k.value, fmt: k.fmt }));
    return map;
  }, [allKpiCards]);

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
      'ctr': '点击率', 'cvr': '转化率', 'cpc': '平均点击成本', 'cpa': '平均订单花费',
      'avgInquiryCost': '平均询单成本', 'avgFavoriteCost': '平均收藏成本', 'avgFollowCost': '平均关注成本',
      'inquiryCost': '总询单成本', 'favoriteCost': '总收藏成本', 'followCost': '总关注成本',
      'refundedShippingCost': '退款成功快递发货成本', 'returnShippingCost': '退货退回成本',
      'platformFee': '平台服务费', 'postage': '快递成本', 'insurance': '运费险',
      'grossProfitRate': '毛利率', 'netProfitRate': '净利润率',
      'profitPerOrder': '单均利润', 'avgRefundAmount': '平均退款额',
      'promoCostRate': '推广费用率',
      // ── 扩展映射（与KPI_LINES一一对应） ──
      'netGmv': '净GMV(GMV-退款)', 'netRevenue': '净实收(实收-退款)',
      'gmvPerOrder': '单均GMV', 'mrPerOrder': '单均实收',
      'ordersPerBuyer': '人均订单数', 'itemsPerOrder': '每单件数',
      'refundErosionRate': '退款侵蚀率', 'refundApprovalRate': '同意退款率',
      'mrAfterRefund': '退款后实收',
      // 'profitRate': '利润率', -- removed (duplicate of netProfitRate)
      'grossProfit': '毛利润',
      'promoOrderRatio': '推广订单占比', 'promoGmvRatio': '推广GMV占比',
      'promoCostPerOrder': '单均推广费', 'cpm': '千次曝光成本',
      'promoCvr': '点击转化率',
      'totalInteractionCost': '总互动成本', 'interactionCostRate': '互动成本率',
      'avgInteractionCost': '单次互动成本',
      'platformFeeRate': '平台费率', 'postageRate': '快递费率',
      'totalCostRate': '总成本率',
      'discRate': '折扣率', 'organicRatio': '自然占比',
      'merchantTakeRate': '实收/GMV比', 'discPerOrder': '单均优惠',
      'paidTakeRate': '实付/GMV比', 'insuranceRate': '运费险率',
      'subsidyFee': '百亿补贴',
      // -- 补齐缺失的 18 个 KPI_LINES 映射 --
      'adjustedProfit': '调整后利润(去罚款)',
      'gmvPerClick': '每点击GMV',
      'opCostPerOrder': '单均运营成本',
      'ordersPerProduct': '单商品订单',
      'organicOrderRatio': '自然单占比',
      'penaltyProfitRatio': '罚款占利润比',
      'profitPerBuyer': '人均利润',
      'profitPerProduct': '单商品利润',
      'profitPerSku': '单SKU利润',
      'promoCostPerProduct': '单品均推广费',
      'promoToRevenue': '推广收入比',
      'refundCostPerOrder': '退款单均成本',
      'revenuePerClick': '每点击收入',
      'revenuePerProduct': '单商品收入',
      'skuPerBuyer': '人均SKU数',
      'spendingPerBuyer': '人均消费',
      'totalOpCost': '总运营成本',
      'totalRefundCost': '退款成本合计',
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

  // ── 点击外部关闭选择面板 ──
  const selectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showKpiSelector) return;
    let handler: ((e: MouseEvent) => void) | null = null;
    const id = setTimeout(() => {
      handler = (e: MouseEvent) => {
        if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
          setShowKpiSelector(false);
        }
      };
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => { clearTimeout(id); if (handler) document.removeEventListener('mousedown', handler); };
  }, [showKpiSelector, setShowKpiSelector]);

  // ── 传感器（只响应鼠标拖拽，点击不移） ──
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  /** 拖拽结束：更新排序 */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = kpiCards.findIndex(c => c.label === active.id);
    const newIndex = kpiCards.findIndex(c => c.label === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const newCards = arrayMove(kpiCards, oldIndex, newIndex);
    onCardReorder?.(newCards);
  };

  // 已选指标数量
  const checkedCount = visibleKpis.size;

  return (
    <div>
      {/* 指标选择面板 — 分组式 */}
      <div ref={selectorRef}>
      {showKpiSelector && (
        <div className="bg-pdd-card rounded-lg border border-pdd-border mb-3 overflow-hidden shadow-lg">
          {/* 搜索栏 */}
          <div className="flex items-center gap-2 px-2 py-1.5 border-b border-pdd-border/50">
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
          <div className="max-h-96 overflow-y-auto p-2">
            {kpiSearch.trim() ? (
              /* ── 搜索模式：平铺所有匹配项 ── */
              (() => {
                const q = kpiSearch.trim().toLowerCase();
                const matched = allKpiCards.filter(k => k.label.toLowerCase().includes(q));
                if (matched.length === 0) return <div className="text-xs text-pdd-text-secondary/40 text-center py-4">无匹配指标</div>;
                return (
                  <div className="grid grid-cols-2">
                    {matched.map(k => {
                      const isChecked = visibleKpis.has(k.label);
                      return (
                        <div key={k.label} className="border border-dashed border-pdd-border/25 -mr-px -mb-px">
                          <button onClick={() => toggleKpi(k.label)}
                            className={`w-full inline-flex items-center gap-1 px-1.5 py-1 text-[11px] leading-tight transition-all ${
                              isChecked
                                ? 'bg-pdd-primary/10 text-pdd-primary'
                                : 'text-pdd-text-secondary/70 hover:bg-pdd-gray-100/50'
                            }`}
                          >
                            {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                            <span className="truncate">{k.label}</span>
                            {(() => {
                              const vm = kpiValueMap.get(k.label);
                              if (!vm || vm.value === undefined) return null;
                              return <span className="ml-auto text-[10px] tabular-nums text-pdd-text-secondary/50 font-medium">{vm.fmt(vm.value)}</span>;
                            })()}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            ) : (
              /* ── 分组模式 — 3列实线边框 + 内部虚线分割 ── */
              <div className="grid grid-cols-4 gap-1.5">
                {KPI_GROUPS.map(group => {
                  const groupCards = allKpiCards.filter(k => group.labels.includes(k.label));
                  if (groupCards.length === 0) return null;
                  const checkedInGroup = groupCards.filter(k => visibleKpis.has(k.label)).length;
                  const allChecked = checkedInGroup === groupCards.length;
                  const noneChecked = checkedInGroup === 0;
                  return (
                    <div key={group.name} className="border border-solid border-pdd-border/40 rounded-md px-2 pt-1.5 pb-1">
                      {/* 分组头 */}
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-dashed border-pdd-border/30">
                        <span className="text-[11px] font-semibold text-pdd-text-secondary/70">{group.name}</span>
                        <button
                          onClick={() => {
                            const newSet = new Set(visibleKpis);
                            if (allChecked) {
                              groupCards.forEach(k => newSet.delete(k.label));
                            } else {
                              groupCards.forEach(k => newSet.add(k.label));
                            }
                            setVisibleKpis(newSet);
                            if (!allChecked && onKpiSelect) {
                              groupCards.forEach(k => { if (!visibleKpis.has(k.label)) onKpiSelect(k.label); });
                            }
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
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
                      {/* 分组内指标 — 虚线网格分割 */}
                      <div className="grid grid-cols-2">
                        {groupCards.map((k, ki) => {
                          const isChecked = visibleKpis.has(k.label);
                          const colSpan = groupCards.length === 3 && ki === 2 ? 'col-span-2' : '';
                          return (
                            <div key={k.label} className={`border border-dashed border-pdd-border/25 -mr-px -mb-px ${colSpan}`}>
                              <button onClick={() => toggleKpi(k.label)}
                                className={`w-full inline-flex items-center gap-1 px-1.5 py-1 text-[11px] leading-tight transition-all ${
                                  isChecked
                                    ? 'bg-pdd-primary/10 text-pdd-primary'
                                    : 'text-pdd-text-secondary/70 hover:bg-pdd-gray-100/50'
                                }`}
                              >
                                {isChecked && <span className="w-1.5 h-1.5 rounded-full bg-pdd-primary shrink-0" />}
                                <span className="truncate">{k.label}</span>
                                {(() => {
                                  const vm = kpiValueMap.get(k.label);
                                  if (!vm || vm.value === undefined) return null;
                                  return <span className="ml-auto text-[10px] tabular-nums text-pdd-text-secondary/50 font-medium">{vm.fmt(vm.value)}</span>;
                                })()}
                              </button>
                            </div>
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
      </div>

      {/* KPI 卡片网格 — 鼠标拖拽调整顺序 */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={kpiCards.map(c => c.label)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
            {kpiCards.map((c) => (
              <SortableKpiCard key={c.label} card={c} noData={noData} onCardClick={onCardClick} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

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

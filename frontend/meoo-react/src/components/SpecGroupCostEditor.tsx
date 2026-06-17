import React, { useState, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronDown, ChevronUp, Edit3, Trash2, Check, AlertCircle, Eye, EyeOff,
  Move, Plus, X, GripVertical, Info,
} from 'lucide-react';
import {
  groupSkuItems, applySpecOverrides, loadSpecOverrides, saveSpecOverrides,
  type SpecGroupItem, type SpecOverrides,
} from '../utils/specGrouping';
import SpecPreviewCard from './SpecPreviewCard';

interface Props {
  productId: string;
  productName: string;
  skus: SpecGroupItem[];
  /** 当前成本字典 (skuKey -> cost) */
  productCosts: Record<string, number>;
  /** 设置成本回调 */
  setProductCost: (skuKey: string, cost: number) => void;
  /** 是否缺编码 */
  isMissingCode?: boolean;
  allSkusHaveCost?: boolean;
}

/**
 * 规格压缩版商品成本编辑器 — 完整版
 *
 * 功能：
 * - 智能规格压缩（5层策略）
 * - 双击重命名分组
 * - 悬浮预览所有 SKU 明细
 * - 移动 SKU 到其他分组（修正识别错误）
 * - 新建自定义规格分组
 * - 删除分组
 * - 组成本一键设置
 * - 所有修改持久化到 localStorage
 */
export default function SpecGroupCostEditor({
  productId, productName, skus, productCosts, setProductCost, isMissingCode, allSkusHaveCost,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [expandedSkuPrices, setExpandedSkuPrices] = useState<Set<string>>(new Set());
  // 编辑组名状态：editingGroupLabel 跟踪哪个组在编辑，editInputValue 是输入框值（分离两者避免输入后条件失效）
  const [editingGroupLabel, setEditingGroupLabel] = useState<string | null>(null);
  const [editInputValue, setEditInputValue] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);

  // 悬浮预览
  const [hoverInfo, setHoverInfo] = useState<{ label: string; items: SpecGroupItem[]; x: number; y: number } | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout>>();

  // 移动 SKU 状态
  const [movingSku, setMovingSku] = useState<string | null>(null);

  // ─── 覆盖系统 ───
  const [overrides, setOverrides] = useState<SpecOverrides>(() => loadSpecOverrides(productId));

  const saveAndRefresh = useCallback((updated: SpecOverrides) => {
    setOverrides(updated);
    saveSpecOverrides(productId, updated);
  }, [productId]);

  // ─── 计算分组（自动 + 用户覆盖） ───
  const specGroups = useMemo(() => {
    const auto = groupSkuItems(skus);
    return applySpecOverrides(auto, skus, overrides);
  }, [skus, overrides]);

  const hasMultipleSku = skus.length > 1;

  // ─── 获取最终组标签 ───
  const getLabel = (label: string): string => overrides.labels[label] || label;

  // ─── 编辑组名 ───
  const handleRename = (oldLabel: string, newLabel: string) => {
    if (!newLabel.trim() || newLabel === oldLabel) { setEditingGroupLabel(null); return; }
    const updated = { ...overrides, labels: { ...overrides.labels, [oldLabel]: newLabel.trim() } };
    // 移动相关：如果 moves 中有指向旧标签的，也一并更新
    const updatedMoves = { ...updated.moves };
    for (const [skuKey, target] of Object.entries(updatedMoves)) {
      if (target === oldLabel) updatedMoves[skuKey] = newLabel.trim();
    }
    updated.moves = updatedMoves;
    // 自定义组标签更新
    const updatedCustom = (updated.customGroups || []).map(cg =>
      cg.label === oldLabel ? { ...cg, label: newLabel.trim() } : cg
    );
    updated.customGroups = updatedCustom;
    saveAndRefresh(updated);
    setEditingGroupLabel(null);
  };

  // ─── 移动 SKU ───
  const moveSkuToGroup = (skuKey: string, targetLabel: string) => {
    const updated = {
      ...overrides,
      moves: { ...overrides.moves, [skuKey]: targetLabel },
    };
    saveAndRefresh(updated);
    setMovingSku(null);
  };

  // ─── 新建自定义组 ───
  const createCustomGroup = (label: string) => {
    if (!label.trim()) return;
    // 检查是否已有同名组
    const exists = specGroups.some(g => g.label === label.trim()) ||
      (overrides.customGroups || []).some(cg => cg.label === label.trim());
    if (exists) { setShowNewGroupInput(false); setNewGroupName(''); return; }
    const updated = {
      ...overrides,
      customGroups: [...(overrides.customGroups || []), { label: label.trim(), skuKeys: [] }],
    };
    saveAndRefresh(updated);
    setShowNewGroupInput(false);
    setNewGroupName('');
  };

  // ─── 删除组（清空其 SKU 的移动记录，移除自定义组定义） ───
  const removeGroup = (label: string) => {
    // 找到该组
    const group = specGroups.find(g => g.label === label);
    if (!group) return;

    // 清除该组内所有 SKU 的成本和移动记录
    const updatedMoves = { ...overrides.moves };
    group.items.forEach(item => {
      if (productCosts[item.skuKey]) setProductCost(item.skuKey, 0);
      delete updatedMoves[item.skuKey];
    });
    // 如果 SKU 被移动到本组，也要清除
    for (const [skuKey, target] of Object.entries(updatedMoves)) {
      if (target === label) delete updatedMoves[skuKey];
    }
    // 移除自定义组定义
    const updatedCustom = (overrides.customGroups || []).filter(cg => cg.label !== label);

    // 清理重命名记录
    const updatedLabels = { ...overrides.labels };
    delete updatedLabels[label];

    saveAndRefresh({ labels: updatedLabels, moves: updatedMoves, customGroups: updatedCustom });
  };

  // ─── 悬浮预览 handlers ───
  const handleMouseEnter = useCallback((label: string, items: SpecGroupItem[], e: React.MouseEvent) => {
    clearTimeout(previewTimer.current);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    previewTimer.current = setTimeout(() => {
      setHoverInfo({ label, items, x: rect.right + 8, y: rect.top - 10 });
    }, 150);
  }, []);
  const handleMouseLeave = useCallback(() => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(() => setHoverInfo(null), 200);
  }, []);

  // ─── 用于移动的组列表 ───
  const groupLabels = specGroups.map(g => g.label);

  const allGroupLabels = useMemo(() => {
    const labels = [...specGroups.map(g => g.label)];
    // 加上自定义组定义中还没有被 auto 创建的
    for (const cg of overrides.customGroups || []) {
      if (!labels.includes(cg.label)) labels.push(cg.label);
    }
    return [...new Set(labels)];
  }, [specGroups, overrides.customGroups]);

  // ─── 统计数据 ───
  const totalOrders = skus.reduce((s, sku) => s + sku.orderCount, 0);
  const totalItems = skus.reduce((s, sku) => s + sku.itemCount, 0);

  // ──────────────── 单 SKU 模式 ────────────────
  if (!hasMultipleSku) {
    const sku = skus[0];
    const skuKey = sku.skuKey;
    return (
      <div className="flex items-center gap-3 px-4 py-2.5">
        <div className="flex-1" />
        <input type="number" placeholder="裸货成本"
          className="w-28 px-2 py-1.5 border border-pdd-border rounded-lg text-sm shrink-0 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
          value={productCosts[skuKey] != null ? productCosts[skuKey] : ''}
          onClick={e => e.stopPropagation()}
          onChange={e => {
            const v = parseFloat(e.target.value);
            setProductCost(skuKey, isNaN(v) ? 0 : v);
          }} />
        {productCosts[skuKey] ? <Check size={14} className="text-pdd-success shrink-0" /> : null}
      </div>
    );
  }

  // ──────────────── 多 SKU 模式 ────────────────
  return (
    <div>
      {/* 顶部压缩行 */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 cursor-pointer hover:bg-pdd-bg/60 transition-colors select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          {specGroups.map((group, gi) => {
            const hasCost = group.items.some(i => productCosts[i.skuKey]);
            const groupCostVal = (() => {
              for (const item of group.items) {
                if (productCosts[item.skuKey]) return productCosts[item.skuKey];
              }
              return 0;
            })();
            const isCustom = overrides.customGroups?.some(cg => cg.label === group.label);
            return (
              <div
                key={group.label}
                className="group relative flex items-center gap-1 bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-xs hover:border-blue-300 hover:shadow-sm transition-all"
                onClick={e => e.stopPropagation()}
                onMouseEnter={(e) => handleMouseEnter(group.label, group.items, e)}
                onMouseLeave={handleMouseLeave}
              >
                {/* 编辑组名 */}
                {editingGroupLabel === group.label ? (
                  <input
                    className="w-16 px-1 py-0.5 border border-pdd-primary rounded text-xs outline-none"
                    value={editInputValue}
                    autoFocus
                    onChange={e => setEditInputValue(e.target.value)}
                    onBlur={() => {
                      handleRename(group.label, editInputValue);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleRename(group.label, editInputValue);
                      if (e.key === 'Escape') setEditingGroupLabel(null);
                    }}
                  />
                ) : (
                  <span
                    className="font-medium text-pdd-text cursor-pointer hover:text-pdd-primary max-w-[60px] truncate"
                    onDoubleClick={() => { setEditingGroupLabel(group.label); setEditInputValue(getLabel(group.label)); }}
                    title="双击重命名"
                  >
                    {getLabel(group.label)}
                  </span>
                )}
                {isCustom && <span className="text-[8px] text-orange-400 bg-orange-50 px-1 rounded">自定义</span>}
                <span className="text-pdd-text-secondary">¥{group.price.toFixed(1)}</span>
                <span className="text-pdd-text-secondary/30">|</span>
                <input type="number"
                  className="w-14 px-1 py-0.5 border border-pdd-border rounded text-xs text-center outline-none focus:border-red-400 [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  placeholder="成本"
                  value={hasCost ? groupCostVal : ''}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const v = parseFloat(e.target.value);
                    const cost = isNaN(v) ? 0 : v;
                    group.items.forEach(item => setProductCost(item.skuKey, cost));
                  }}
                />
                <span className="text-pdd-text-secondary/30 text-[10px]">元</span>
                {hasCost && <Check size={12} className="text-pdd-success shrink-0" />}
                {group.count > 1 && (
                  <span className="text-[10px] text-pdd-primary bg-pdd-primary/5 rounded px-1">{group.count}个</span>
                )}

                {/* 操作按钮组（hover 显示） */}
                <div className="hidden group-hover:flex items-center gap-0.5 ml-0.5">
                  {/* 重命名快捷按钮 */}
                  <button
                    onClick={e => { e.stopPropagation(); setEditingGroupLabel(group.label); setEditInputValue(getLabel(group.label)); }}
                    className="p-0.5 hover:bg-blue-50 rounded text-gray-300 hover:text-blue-500 transition-colors"
                    title="重命名"
                  >
                    <Edit3 size={10} />
                  </button>
                  {/* 删除组 */}
                  {specGroups.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); removeGroup(group.label); }}
                      className="p-0.5 hover:bg-red-50 rounded text-gray-300 hover:text-red-500 transition-colors"
                      title="删除分组（将组内SKU释放到其他组）"
                    >
                      <Trash2 size={10} />
                    </button>
                  )}
                  {/* 预览按钮 */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      setHoverInfo(prev =>
                        prev?.label === group.label ? null : { label: getLabel(group.label), items: group.items, x: (e.currentTarget as HTMLElement).getBoundingClientRect().right + 8, y: (e.currentTarget as HTMLElement).getBoundingClientRect().top - 10 }
                      );
                    }}
                    className="p-0.5 hover:bg-gray-50 rounded text-gray-300 hover:text-gray-600 transition-colors"
                    title="预览SKU"
                  >
                    <Info size={10} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* 新建规格按钮 */}
          {showNewGroupInput ? (
            <div className="flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5 text-xs"
              onClick={e => e.stopPropagation()}>
              <input
                className="w-16 px-1 py-0.5 border border-blue-300 rounded text-xs outline-none bg-white"
                value={newGroupName}
                autoFocus
                placeholder="组名"
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createCustomGroup(newGroupName);
                  if (e.key === 'Escape') { setShowNewGroupInput(false); setNewGroupName(''); }
                }}
                onBlur={() => { if (newGroupName.trim()) createCustomGroup(newGroupName); else { setShowNewGroupInput(false); setNewGroupName(''); } }}
              />
              <button onClick={() => { createCustomGroup(newGroupName); }}
                className="p-0.5 text-blue-500 hover:text-blue-700"><Check size={12} /></button>
              <button onClick={() => { setShowNewGroupInput(false); setNewGroupName(''); }}
                className="p-0.5 text-gray-400 hover:text-gray-600"><X size={12} /></button>
            </div>
          ) : (
            <button
              onClick={e => { e.stopPropagation(); setShowNewGroupInput(true); }}
              className="flex items-center gap-0.5 px-2 py-1.5 border border-dashed border-gray-300 rounded-lg text-xs text-gray-400 hover:text-blue-500 hover:border-blue-300 hover:bg-blue-50/30 transition-all"
              title="新建自定义规格分组"
            >
              <Plus size={12} /> 新建
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0 text-xs text-pdd-text-secondary">
          <span>{totalOrders}单/{totalItems}件</span>
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* 展开的详细 SKU 列表（带移动功能） */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-pdd-border bg-pdd-card/50"
          >
            {specGroups.map((group, gi) => (
              <div key={group.label} className="border-b border-pdd-border/50 last:border-0">
                {/* 组头 */}
                <div className="px-4 py-2 text-xs font-semibold text-pdd-text-secondary flex items-center gap-2 bg-pdd-bg/30">
                  <span className="text-pdd-text font-medium">{getLabel(group.label)}</span>
                  <span className="text-pdd-text-secondary/40">·</span>
                  <span>均价 ¥{group.price.toFixed(1)}</span>
                  <span className="text-pdd-text-secondary/40">·</span>
                  <span>{group.orders}单/{group.itemsCount}件</span>
                  <span className="text-pdd-text-secondary/40">·</span>
                  <span>{group.count}个SKU</span>
                </div>

                {/* SKU 明细行（含移动操作） */}
                {group.items.map((item, si) => {
                  const skuKey = item.skuKey;
                  const hasMultiplePrices = item.prices.length > 1 && new Set(item.prices.map(p => Math.round(p * 100) / 100)).size > 1;
                  const isPriceExpanded = expandedSkuPrices.has(skuKey);
                  const itemMinPrice = item.prices.length ? Math.min(...item.prices) : 0;
                  const itemMaxPrice = item.prices.length ? Math.max(...item.prices) : 0;
                  const isMissingSkuCode = !item.skuCode;
                  const isMovingThis = movingSku === skuKey;
                  return (
                    <div key={skuKey} className="px-4 py-2 ml-4 border-t border-pdd-border/30 flex items-center gap-2 hover:bg-pdd-bg/40 group/sku">
                      <span className="text-xs text-pdd-text-secondary/50 font-mono w-4 shrink-0">{si + 1}.</span>
                      <GripVertical size={10} className="text-gray-200 group-hover/sku:text-gray-300 shrink-0" />
                      {/* SKU 信息 */}
                      <div className="flex-1 min-w-0 flex items-center gap-1.5">
                        <span className="text-xs text-pdd-text truncate max-w-[100px]" title={item.skuName}>{item.skuName || '-'}</span>
                        {item.skuCode && <span className="text-[9px] text-green-600 bg-green-50 px-1 rounded font-mono shrink-0">{item.skuCode}</span>}
                        {isMissingSkuCode && <span className="text-[9px] text-pdd-danger bg-pdd-danger/10 px-1 rounded flex items-center gap-0.5 shrink-0"><AlertCircle size={8} />缺编码</span>}
                        <span className="text-[10px] text-pdd-text-secondary shrink-0">
                          ¥{formatPriceRange(itemMinPrice, itemMaxPrice)}
                        </span>
                        {hasMultiplePrices && (
                          <PriceEyeButton skuKey={skuKey} expandedSet={expandedSkuPrices} setExpanded={setExpandedSkuPrices} />
                        )}
                      </div>
                      {/* 订单数 */}
                      <span className="text-xs text-pdd-text-secondary shrink-0 w-16 text-right">{item.orderCount}单/{item.itemCount}件</span>
                      {/* 成本输入 */}
                      <input type="number" placeholder="成本"
                        className="w-16 px-1.5 py-1 border border-pdd-border rounded text-xs text-center outline-none focus:border-red-400 shrink-0"
                        value={productCosts[skuKey] != null ? productCosts[skuKey] : ''}
                        onClick={e => e.stopPropagation()}
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setProductCost(skuKey, isNaN(v) ? 0 : v);
                        }} />
                      {productCosts[skuKey] && <Check size={12} className="text-pdd-success shrink-0" />}
                      {/* 移动按钮 */}
                      <div className="relative shrink-0">
                        <button
                          onClick={e => { e.stopPropagation(); setMovingSku(isMovingThis ? null : skuKey); }}
                          className={`p-1 rounded transition-colors ${isMovingThis ? 'bg-blue-100 text-blue-600' : 'opacity-0 group-hover/sku:opacity-100 text-gray-300 hover:text-blue-500 hover:bg-blue-50'}`}
                          title="移动到其他分组"
                        >
                          <Move size={12} />
                        </button>
                        {isMovingThis && (
                          <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[120px]"
                            onClick={e => e.stopPropagation()}>
                            <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100">移动到</div>
                            {allGroupLabels.filter(l => l !== group.label).map(label => (
                              <button
                                key={label}
                                onClick={() => moveSkuToGroup(skuKey, label)}
                                className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                              >
                                {getLabel(label)}
                              </button>
                            ))}
                            {allGroupLabels.length <= 1 && (
                              <div className="px-3 py-2 text-[10px] text-gray-300 text-center">无其他分组</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 全局悬浮预览卡片 */}
      <SpecPreviewCard
        label={hoverInfo?.label || ''}
        items={hoverInfo?.items || []}
        visible={!!hoverInfo}
        x={hoverInfo?.x || 0}
        y={hoverInfo?.y || 0}
      />
    </div>
  );
}

function formatPriceRange(min: number, max: number) {
  if (!min && !max) return '';
  if (min === max) return `¥${min.toFixed(1)}`;
  return `¥${min.toFixed(1)}~¥${max.toFixed(1)}`;
}

function PriceEyeButton({ skuKey, expandedSet, setExpanded }: {
  skuKey: string;
  expandedSet: Set<string>;
  setExpanded: React.Dispatch<React.SetStateAction<Set<string>>>;
}) {
  const isExpanded = expandedSet.has(skuKey);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        setExpanded(prev => {
          const next = new Set(prev);
          if (next.has(skuKey)) next.delete(skuKey);
          else next.add(skuKey);
          return next;
        });
      }}
      className="p-0.5 hover:bg-pdd-bg rounded shrink-0"
    >
      {isExpanded ? <EyeOff size={12} className="text-pdd-text-secondary" /> : <Eye size={12} className="text-pdd-danger" />}
    </button>
  );
}


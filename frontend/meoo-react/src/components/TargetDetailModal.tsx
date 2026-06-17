// ── 目标配置弹窗：每单赚X元 + 全维度调整方案 ──
import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Target, TrendingUp, TrendingDown, Check, Save, DollarSign } from 'lucide-react';
import type { TargetEngineResult, TargetColumnResult, ManualTargetOverrides, ProductTargetConfig } from '../types/productTarget';
import { computeTargetsByProfit } from '../utils/targetEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: any;
  engineResult: TargetEngineResult;
  rowMode: '单品' | '总额';
  profitPerOrder: number;
  onSaveTarget: (productId: string, config: ProductTargetConfig) => void;
}

const PRESETS = [1, 2, 3, 5, 10];

function fmtMoney(v: number): string {
  if (v >= 10000) return '¥' + (v / 10000).toFixed(1) + '万';
  if (v >= 100) return '¥' + v.toFixed(0);
  return '¥' + v.toFixed(v < 10 ? 2 : 1);
}
function fmtPct(v: number): string { return v.toFixed(1) + '%'; }

function riskColor(level: string): string {
  switch (level) {
    case 'low': return 'text-green-600 bg-green-50 border-green-200';
    case 'medium': return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'high': return 'text-red-600 bg-red-50 border-red-200';
    default: return 'text-gray-400 bg-gray-50 border-gray-200';
  }
}

const COL_LABELS: Record<string, string> = {
  revenue: '商家实收', orders: '订单量', totalCost: '总成本', promo: '推广费',
  roi: '投产比', refundRate: '退款率', otherCost: '其他成本', profit: '利润',
  skuPrice: '单品价格', skuCount: 'SKU数量', skuCost: '单品成本', promoAvg: '推广费(均)',
  profitRate: '利润率', skuProfit: '单品利润',
};

const COL_KEYS_TOTAL = ['revenue', 'orders', 'totalCost', 'promo', 'roi', 'refundRate', 'otherCost', 'profit'];
const COL_KEYS_SINGLE = ['skuPrice', 'skuCount', 'skuCost', 'promoAvg', 'roi', 'refundRate', 'profitRate', 'skuProfit'];

export default function TargetDetailModal({ isOpen, onClose, product, engineResult: initialResult, rowMode, profitPerOrder: initialProfit, onSaveTarget }: Props) {
  const [profitPerOrder, setProfitPerOrder] = useState(initialProfit);
  const [editingColumn, setEditingColumn] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [manualOverrides, setManualOverrides] = useState<Partial<ManualTargetOverrides>>({});

  const currentResult = useMemo(() => {
    return computeTargetsByProfit(product, profitPerOrder, undefined,
      Object.keys(manualOverrides).length > 0 ? manualOverrides : undefined);
  }, [product, profitPerOrder, manualOverrides]);

  const { targetSet, adjustments, riskRating, isAchievable, maxAchievableProfit, perOrderMetrics, gap } = currentResult;

  const colKeys = rowMode === '单品' ? COL_KEYS_SINGLE : COL_KEYS_TOTAL;

  const handlePreset = useCallback((val: number) => {
    setProfitPerOrder(val);
    setManualOverrides({});
  }, []);

  const handleCustomChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    if (!isNaN(v) && v > 0 && v < 1000) setProfitPerOrder(v);
  }, []);

  const handleColumnEditStart = useCallback((key: string, currentValue: number) => {
    setEditingColumn(key);
    setEditValue(currentValue > 0 ? currentValue.toFixed(2) : '');
  }, []);

  const handleColumnEditSave = useCallback(() => {
    if (!editingColumn) return;
    const v = parseFloat(editValue);
    if (!isNaN(v) && v > 0) {
      setManualOverrides(prev => ({ ...prev, [editingColumn]: v }));
    }
    setEditingColumn(null);
    setEditValue('');
  }, [editingColumn, editValue]);

  const handleResetOverrides = useCallback(() => {
    setManualOverrides({});
    setEditingColumn(null);
  }, []);

  const handleSave = useCallback(() => {
    if (!product) return;
    const pid = product.id || product.productId;
    onSaveTarget(pid, {
      profitPerOrder,
      presetKey: PRESETS.includes(profitPerOrder) ? String(profitPerOrder) as any : 'custom',
      manualOverrides: Object.keys(manualOverrides).length > 0 ? manualOverrides : undefined,
    });
    onClose();
  }, [product, profitPerOrder, manualOverrides, onSaveTarget, onClose]);

  const waterfallItems = adjustments.filter(a => a.adjustedAmount > 0.01);

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-[680px] max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>

              {/* ── Header ── */}
              <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100 px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                    <Target size={16} className="text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-gray-800">目标配置</h2>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                      {product.name || product.productName || (product.id ? product.id.slice(-8) : '')}
                    </p>
                  </div>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-5">

                {/* ── 每单利润输入 ── */}
                <div>
                  <label className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2.5">
                    <DollarSign size={13} /> 每单目标利润
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 max-w-[160px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium">¥</span>
                      <input type="number" value={profitPerOrder}
                        onChange={handleCustomChange}
                        className="w-full pl-7 pr-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 bg-gray-50/50 text-gray-800"
                        step="0.5" min="0.5" max="100" />
                    </div>
                    <div className="flex gap-1.5">
                      {PRESETS.map(v => (
                        <button key={v} onClick={() => handlePreset(v)}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                            profitPerOrder === v && Object.keys(manualOverrides).length === 0
                              ? 'bg-blue-500 text-white border-blue-500 shadow-sm'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                          }`}>
                          {v}元
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="mt-1.5 text-[11px] text-gray-400">
                    当前每单利润：
                    <span className={`font-semibold ${perOrderMetrics.profitPerOrder >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {fmtMoney(perOrderMetrics.profitPerOrder)}
                    </span>
                    {gap > 0.01 && (
                      <span className="ml-2">需提升：<span className="font-semibold text-amber-600">{fmtMoney(gap)}</span>/单</span>
                    )}
                    {gap < -0.01 && (
                      <span className="ml-2 text-green-600">✓ 已超出目标 {fmtMoney(Math.abs(gap))}/单</span>
                    )}
                  </div>
                </div>

                {/* ── 风险评级 ── */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${riskColor(riskRating.level)}`}>
                  <span>{riskRating.level === 'low' ? '🟢' : riskRating.level === 'medium' ? '🟡' : '🔴'}</span>
                  <span>{riskRating.label}</span>
                  <span className="text-[11px] opacity-70 ml-1">{riskRating.description}</span>
                  {!isAchievable && (
                    <span className="ml-2 text-red-500 font-semibold">目标过高（最大{fmtMoney(maxAchievableProfit)}/单）</span>
                  )}
                  {isAchievable && (
                    <span className="ml-2 text-green-600 font-semibold">✓ 可达</span>
                  )}
                </div>

                {/* ── 瀑布图 ── */}
                {waterfallItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-2">调整路径</h3>
                    <div className="bg-gray-50/70 rounded-lg border border-gray-100 p-3 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">当前利润</span>
                        <span className={`font-semibold ${perOrderMetrics.profitPerOrder >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {fmtMoney(perOrderMetrics.profitPerOrder)}/单
                        </span>
                      </div>
                      {waterfallItems.map((adj, i) => (
                        <div key={i} className="flex items-center justify-between text-xs pl-4 border-l-2 border-blue-200 ml-1">
                          <span className="text-gray-500">{adj.name}</span>
                          <span className="text-green-600 font-semibold">+{fmtMoney(adj.adjustedAmount)}</span>
                        </div>
                      ))}
                      <div className="border-t border-gray-200 pt-1.5 flex items-center justify-between text-xs font-semibold">
                        <span className="text-gray-700">目标利润</span>
                        <span className="text-blue-600">{fmtMoney(profitPerOrder)}/单 {isAchievable ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── 全维度表 ── */}
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <h3 className="text-xs font-semibold text-gray-500">调整方案</h3>
                    {Object.keys(manualOverrides).length > 0 && (
                      <button onClick={handleResetOverrides}
                        className="text-[11px] text-blue-500 hover:text-blue-700 font-medium">重置</button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 px-2 font-medium text-gray-400">指标</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-400">当前</th>
                          <th className="text-right py-2 px-2 font-medium text-gray-400">目标</th>
                          <th className="text-center py-2 px-2 font-medium text-gray-400">调整</th>
                          <th className="text-center py-2 px-2 font-medium text-gray-400">风险</th>
                          <th className="text-center py-2 px-2 font-medium text-gray-400">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {colKeys.map(key => {
                          const col = (targetSet as any)[key] as TargetColumnResult;
                          if (!col || !col.editable) return null;
                          const isEditing = editingColumn === key;
                          const isManual = col.source === 'manual';
                          return (
                            <tr key={key} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                              <td className="py-2 px-2 font-medium text-gray-700">{COL_LABELS[key] || key}</td>
                              <td className="py-2 px-2 text-right text-gray-500 tabular-nums">{col.fmt}</td>
                              <td className="py-2 px-2 text-right tabular-nums">
                                {isEditing ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <input type="number" value={editValue}
                                      onChange={e => setEditValue(e.target.value)}
                                      className="w-20 px-2 py-1 text-xs border border-blue-300 rounded text-right focus:outline-none focus:border-blue-500"
                                      step="0.01" autoFocus
                                      onKeyDown={e => { if (e.key === 'Enter') handleColumnEditSave(); if (e.key === 'Escape') setEditingColumn(null); }} />
                                    <button onClick={handleColumnEditSave}
                                      className="p-1 rounded text-blue-500 hover:bg-blue-50"><Check size={12} /></button>
                                  </div>
                                ) : (
                                  <span className={`font-semibold ${isManual ? 'text-blue-600' : 'text-gray-800'}`}>
                                    {col.value > 0 ? col.fmt : '--'}
                                    {isManual && <span className="ml-1 text-[9px] text-blue-400">手动</span>}
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                {col.direction === 'up' ? (
                                  <span className="inline-flex items-center gap-0.5 text-red-500">
                                    <TrendingUp size={12} />+{col.changePct.toFixed(1)}%
                                  </span>
                                ) : col.direction === 'down' ? (
                                  <span className="inline-flex items-center gap-0.5 text-green-600">
                                    <TrendingDown size={12} />{col.changePct.toFixed(1)}%
                                  </span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  col.urgency === 'high' ? 'bg-red-50 text-red-500' :
                                  col.urgency === 'medium' ? 'bg-amber-50 text-amber-500' :
                                  'bg-green-50 text-green-600'
                                }`}>
                                  {col.urgency === 'high' ? '高' : col.urgency === 'medium' ? '中' : '低'}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-center">
                                {!isEditing && (
                                  <button onClick={() => handleColumnEditStart(key, col.value)}
                                    className="text-[10px] text-blue-400 hover:text-blue-600 font-medium">
                                    修改
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── 措施明细 ── */}
                {waterfallItems.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 mb-2">具体措施</h3>
                    <div className="space-y-2">
                      {waterfallItems.map((adj, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-50/70 rounded-lg p-3 border border-gray-100">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                            adj.risk.level === 'high' ? 'bg-red-100 text-red-600' :
                            adj.risk.level === 'medium' ? 'bg-amber-100 text-amber-600' :
                            'bg-green-100 text-green-600'
                          }`}>
                            {adj.level}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-gray-700">{adj.name}</span>
                              <span className="text-xs font-semibold text-green-600">+{fmtMoney(adj.adjustedAmount)}</span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">{adj.description}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                              <span>当前: {adj.key === 'refundRate' ? fmtPct(adj.currentValue) : fmtMoney(adj.currentValue)}</span>
                              <span>→</span>
                              <span>目标: {adj.key === 'refundRate' ? fmtPct(adj.targetValue) : fmtMoney(adj.targetValue)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>

              {/* ── Footer ── */}
              <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 px-5 py-3 flex items-center justify-between">
                <div className="text-[11px] text-gray-400">
                  {Object.keys(manualOverrides).length > 0
                    ? `${Object.keys(manualOverrides).length} 个手动设置`
                    : '引擎自动计算'}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={onClose}
                    className="px-4 py-2 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    取消
                  </button>
                  <button onClick={handleSave}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-500 rounded-lg hover:bg-blue-600 transition-colors shadow-sm">
                    <Save size={13} /> 保存目标
                  </button>
                </div>
              </div>

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

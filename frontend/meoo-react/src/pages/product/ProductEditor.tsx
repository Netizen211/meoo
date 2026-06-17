import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Image as ImageIcon, Target, Lightbulb, DollarSign,
  Activity, Upload, Check, RefreshCw, Percent,
  Save, FileImage, Edit3, BarChart3, Copy, Tag, PenLine, Hash
} from 'lucide-react';
import { ProductStat } from '../../components/ProductLinkStats';
import type { ProductTargetConfig, TargetEngineResult } from '../../types/productTarget';
import { computeTargetsByProfit, flattenTargetSet, extractPerOrderMetrics } from '../../utils/targetEngine';
import TargetDetailModal from '../../components/TargetDetailModal';

interface Props {
  product: ProductStat | null;
  isOpen: boolean;
  onClose: () => void;
  currentImage?: string;
  onImageUpload?: (productId: string, file: File) => void;
  currentTargets?: Record<string, ProductTargetConfig>;
  onSaveTargets?: (productId: string, config: ProductTargetConfig) => void;
  productCosts?: Record<string, number>;
}

const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

/* ── localStorage 读写辅助 ── */
function loadJSON<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function saveJSON(key: string, val: any) {
  localStorage.setItem(key, JSON.stringify(val));
}

const PRESET_TAGS = ['爆品', '利润款', '引流款', '潜力款', '滞销款', '常规款', '清仓', '新品', '高退款', '高ROI'];

export default function ProductEditor({ product, isOpen, onClose, currentImage, onImageUpload, currentTargets, onSaveTargets, productCosts }: Props) {
  const existingConfig = currentTargets?.[product?.productId || ''] || { profitPerOrder: 10 };
  const [profitPerOrder, setProfitPerOrder] = useState((existingConfig as any).profitPerOrder || 10);
  const [saved, setSaved] = useState(false);
  const [showTargetModal, setShowTargetModal] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── 商品备注 ──
  const [notes, setNotes] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);
  useEffect(() => {
    if (!product) return;
    const allNotes = loadJSON<Record<string, string>>('dianfx_product_notes', {});
    setNotes(allNotes[product.productId] || '');
    setNotesDirty(false);
  }, [product?.productId]);
  useEffect(() => {
    if (!product || !notesDirty) return;
    const timer = setTimeout(() => {
      const allNotes = loadJSON<Record<string, string>>('dianfx_product_notes', {});
      allNotes[product.productId] = notes;
      saveJSON('dianfx_product_notes', allNotes);
      setNotesDirty(false);
    }, 500);
    return () => clearTimeout(timer);
  }, [notes, notesDirty, product?.productId]);

  // ── 商品标签 ──
  const [localTags, setLocalTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  useEffect(() => {
    if (!product) return;
    const allTags = loadJSON<Record<string, string[]>>('dianfx_product_tags', {});
    setLocalTags(allTags[product.productId] || []);
  }, [product?.productId]);
  const syncTags = useCallback((tags: string[]) => {
    const allTags = loadJSON<Record<string, string[]>>('dianfx_product_tags', {});
    allTags[product!.productId] = tags;
    saveJSON('dianfx_product_tags', allTags);
    setLocalTags(tags);
  }, [product]);
  const addTag = useCallback((t: string) => {
    if (!localTags.includes(t)) syncTags([...localTags, t]);
  }, [localTags, syncTags]);
  const removeTag = useCallback((t: string) => {
    syncTags(localTags.filter(x => x !== t));
  }, [localTags, syncTags]);

  // ── 复制ID ──
  const copyId = useCallback(() => {
    if (!product) return;
    navigator.clipboard.writeText(product.productId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [product]);

  // 当前引擎结果
  const engineResult = useMemo<TargetEngineResult | null>(() => {
    if (!product) return null;
    try {
      return computeTargetsByProfit(product, profitPerOrder);
    } catch { return null; }
  }, [product, profitPerOrder]);

  // 智能推荐
  const recommendation = useMemo(() => {
    if (!product) return null;
    const uc = productCosts?.[product.productId] || product.costBreakdown?.productCost || 0;
    const pkgFee = 3, shipFee = 5, insFee = 2;
    const platformRate = 0.006;
    const fixedCost = uc + pkgFee + shipFee + insFee;
    const recPrice = fixedCost > 0 ? Math.ceil(fixedCost / (1 - 0.3 - platformRate)) : 0;
    const bePrice = fixedCost > 0 ? Math.ceil(fixedCost / (1 - platformRate)) : 0;
    const currentPrice = product.avgOrderValue || 0;
    const currentProfitRate = product.profitRate || 0;
    const targetProfitRate = Math.max(15, Math.round(currentProfitRate * 1.2));
    return {
      recPrice, bePrice, currentPrice, targetProfitRate,
      suggestion: `建议售价 ≥ ¥${recPrice || '--'}（盈亏平衡 ¥${bePrice || '--'}），目标ROI≥3，目标利润率≥${targetProfitRate}%`,
    };
  }, [product, productCosts]);

  const handleImageSelect = useCallback(() => {
    if (!product || !onImageUpload) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (ev: any) => {
      const f = ev.target?.files?.[0];
      if (f) onImageUpload(product.productId, f);
    };
    input.click();
  }, [product, onImageUpload]);

  const handleSave = useCallback(() => {
    if (!product || !onSaveTargets) return;
    onSaveTargets(product.productId, {
      profitPerOrder,
      presetKey: [1,2,3,5,10].includes(profitPerOrder) ? String(profitPerOrder) as any : 'custom',
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [product, profitPerOrder, onSaveTargets]);

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
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[520px] max-w-[90vw] bg-pdd-card shadow-xl border-l border-pdd-border z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-pdd-card/90 backdrop-blur-sm border-b border-pdd-border/50 px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
                  <Edit3 size={16} className="text-violet-500" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-pdd-text">商品编辑</h2>
                  <p className="text-[11px] text-pdd-text-secondary/60 font-mono mt-0.5">
                    {product.productName?.slice(0, 30)}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-6">
              {/* ── 商品图片 + 商品信息 ── */}
              <div>
                <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                  <FileImage size={13} /> 商品信息
                </h3>
                <div className="flex items-start gap-4">
                  <div className="relative w-[120px] h-[120px] shrink-0 rounded-lg bg-gray-50 border border-gray-200 overflow-hidden flex items-center justify-center cursor-pointer hover:border-blue-300 transition-colors group"
                    onClick={handleImageSelect}>
                    {currentImage ? (
                      <img src={currentImage} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-pdd-text-secondary/40">
                        <ImageIcon size={28} />
                        <span className="text-[11px]">点击上传</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                      <Upload size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-[11px] text-pdd-text-secondary/70 leading-relaxed space-y-2">
                    <div className="flex items-center gap-1.5">
                      <Hash size={11} className="text-gray-400 shrink-0" />
                      <span className="text-pdd-text-secondary/50 shrink-0">商品ID</span>
                      <span className="font-mono text-gray-500 text-[10px] break-all" title={product.productId}>
                        {product.productId}
                      </span>
                      <button onClick={copyId} className="shrink-0 p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors" title="复制商品ID">
                        {copied ? <Check size={10} className="text-green-500" /> : <Copy size={10} />}
                      </button>
                    </div>
                    {product.productCode && (
                      <div className="flex items-center gap-1.5">
                        <Tag size={11} className="text-gray-400 shrink-0" />
                        <span>编码：<span className="font-mono text-gray-500">{product.productCode}</span></span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5">
                      <FileImage size={11} className="text-gray-400 shrink-0" />
                      <span>点击图片更新主图（JPG/PNG, 800×800+）</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── 商品备注 ── */}
              <div>
                <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                  <PenLine size={13} /> 商品备注
                </h3>
                <textarea value={notes} onChange={e => { setNotes(e.target.value); setNotesDirty(true); }}
                  placeholder="记录该商品的备注信息，如货源、供应商、注意事项等…"
                  className="w-full h-20 px-3 py-2 text-xs border border-pdd-border rounded-lg focus:outline-none focus:border-pdd-primary bg-pdd-card text-pdd-text resize-none placeholder:text-gray-300" />
                <div className="flex justify-end mt-1">
                  {notesDirty ? (
                    <span className="text-[10px] text-amber-500">未保存…</span>
                  ) : notes ? (
                    <span className="text-[10px] text-green-500">✓ 已保存</span>
                  ) : null}
                </div>
              </div>

              {/* ── 商品标签 ── */}
              <div>
                <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                  <Tag size={13} /> 商品标签
                </h3>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {localTags.map(t => (
                    <span key={t} className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-violet-50 text-violet-600 border border-violet-200">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-red-500 transition-colors"><X size={10} /></button>
                    </span>
                  ))}
                  {localTags.length === 0 && <span className="text-[10px] text-gray-400">暂无标签，从下方选择或输入</span>}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {PRESET_TAGS.filter(t => !localTags.includes(t)).map(t => (
                    <button key={t} onClick={() => addTag(t)}
                      className="px-2 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200 hover:bg-violet-50 hover:text-violet-600 hover:border-violet-200 transition-colors">
                      + {t}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input value={tagInput} onChange={e => setTagInput(e.target.value)}
                    placeholder="自定义标签"
                    className="flex-1 px-2 py-1 text-[11px] border border-pdd-border rounded focus:outline-none focus:border-pdd-primary bg-pdd-card text-pdd-text"
                    onKeyDown={e => { if (e.key === 'Enter' && tagInput.trim()) { addTag(tagInput.trim()); setTagInput(''); } }} />
                  <button onClick={() => { if (tagInput.trim()) { addTag(tagInput.trim()); setTagInput(''); } }}
                    className="px-2.5 py-1 text-[10px] font-medium text-white bg-pdd-primary rounded hover:bg-pdd-primary-dark transition-colors">
                    添加
                  </button>
                </div>
              </div>

              {/* ── 成本设置 ── */}
              {onSaveTargets && (
                <div>
                  <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                    <DollarSign size={13} /> 成本设置
                  </h3>
                  <div className="bg-pdd-bg/60 rounded-lg border border-pdd-border/40 p-3.5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 max-w-[140px]">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">¥</span>
                        <input type="number" defaultValue={productCosts?.[product.productId] || 0}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            if (!isNaN(v) && v >= 0) {
                              const all = loadJSON<Record<string, number>>('dianfx_product_costs', {});
                              all[product.productId] = v;
                              saveJSON('dianfx_product_costs', all);
                            }
                          }}
                          className="w-full pl-6 pr-2 py-1.5 text-sm font-semibold border border-pdd-border rounded-lg focus:outline-none focus:border-pdd-primary bg-pdd-card text-pdd-text" />
                      </div>
                      <span className="text-xs text-pdd-text-secondary">元/单位成本</span>
                    </div>
                    <p className="text-[10px] text-pdd-text-secondary/60">
                      设置商品单位成本，用于利润计算。留空则使用系统估算值。
                    </p>
                  </div>
                </div>
              )}

              {/* ── 智能推荐 ── */}
              {recommendation && (
                <div>
                  <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                    <Lightbulb size={13} className="text-amber-500" /> 智能推荐
                  </h3>
                  <div className="bg-amber-50/70 border border-amber-200/60 rounded-lg p-3.5 space-y-2">
                    <div className="text-[11px] text-amber-800 leading-relaxed">
                      {recommendation.suggestion}
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-amber-700">
                      <span>当前售价：<strong>{fmtMoney(recommendation.currentPrice)}</strong></span>
                      <span>推荐售价：<strong className="text-emerald-600">{fmtMoney(recommendation.recPrice)}</strong></span>
                    </div>
                    <button onClick={() => setProfitPerOrder(10)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium bg-amber-100 text-amber-700 rounded-md hover:bg-amber-200 transition-colors">
                      <RefreshCw size={12} /> 默认10元/单
                    </button>
                  </div>
                </div>
              )}

              {/* ── 目标设定（每单赚X元） ── */}
              <div>
                <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3 flex items-center gap-1.5">
                  <Target size={13} /> 目标设定
                </h3>
                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1 max-w-[140px]">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400">¥</span>
                    <input type="number" value={profitPerOrder}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v > 0 && v < 1000) setProfitPerOrder(v);
                      }}
                      className="w-full pl-6 pr-2 py-1.5 text-sm font-semibold border border-pdd-border rounded-lg focus:outline-none focus:border-pdd-primary bg-pdd-card text-pdd-text" />
                  </div>
                  <span className="text-xs text-pdd-text-secondary">元/单</span>
                  <div className="flex gap-1">
                    {[1,2,3,5,10].map(v => (
                      <button key={v} onClick={() => setProfitPerOrder(v)}
                        className={`px-2 py-1 text-[10px] font-semibold rounded border transition-all ${
                          profitPerOrder === v
                            ? 'bg-pdd-primary text-white border-pdd-primary'
                            : 'text-pdd-text-secondary border-pdd-border hover:border-pdd-primary/40'
                        }`}>
                        {v}元
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setShowTargetModal(true)}
                    className="px-2.5 py-1.5 text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1">
                    <BarChart3 size={12} /> 详情
                  </button>
                </div>
                {engineResult && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-3 text-[11px] text-pdd-text-secondary">
                      <span>当前每单利润：
                        <strong className={engineResult.perOrderMetrics.profitPerOrder >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {fmtMoney(engineResult.perOrderMetrics.profitPerOrder)}
                        </strong>
                      </span>
                      <span>目标每单利润：
                        <strong className="text-blue-600">{fmtMoney(profitPerOrder)}</strong>
                      </span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${
                        engineResult.isAchievable
                          ? 'text-green-600 bg-green-50 border-green-200'
                          : 'text-red-500 bg-red-50 border-red-200'
                      }`}>
                        {engineResult.isAchievable ? '✓ 可达' : '✗ 不可达'}
                      </span>
                    </div>
                    {engineResult.adjustments.filter(a => a.adjustedAmount > 0.01).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {engineResult.adjustments.filter(a => a.adjustedAmount > 0.01).map((adj, i) => (
                          <span key={i}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border ${
                              adj.risk.level === 'high' ? 'text-red-500 bg-red-50 border-red-200' :
                              adj.risk.level === 'medium' ? 'text-amber-500 bg-amber-50 border-amber-200' :
                              'text-green-600 bg-green-50 border-green-200'
                            }`}>
                            {adj.name} +{fmtMoney(adj.adjustedAmount)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <button onClick={handleSave}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-pdd-primary rounded-lg hover:bg-pdd-primary-dark transition-colors">
                    {saved ? <><Check size={13} /> 已保存</> : <><Save size={13} /> 保存目标</>}
                  </button>
                </div>
              </div>

              {/* Target Detail Modal */}
              {showTargetModal && engineResult && product && (
                <TargetDetailModal
                  isOpen={showTargetModal}
                  onClose={() => setShowTargetModal(false)}
                  product={product}
                  engineResult={engineResult}
                  rowMode="总额"
                  profitPerOrder={profitPerOrder}
                  onSaveTarget={(pid, cfg) => {
                    if (onSaveTargets) onSaveTargets(pid, cfg);
                    setShowTargetModal(false);
                  }}
                />
              )}

              {/* ── 商品信息摘要 ── */}
              <div>
                <h3 className="text-xs font-semibold text-pdd-text-secondary mb-3">当前数据</h3>
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-pdd-bg/60 rounded-lg border border-pdd-border/40 px-3 py-2">
                    <div className="text-[10px] text-pdd-text-secondary/70">售价</div>
                    <div className="text-sm font-semibold text-pdd-text">{fmtMoney(product.avgOrderValue)}</div>
                  </div>
                  <div className="bg-pdd-bg/60 rounded-lg border border-pdd-border/40 px-3 py-2">
                    <div className="text-[10px] text-pdd-text-secondary/70">利润率</div>
                    <div className="text-sm font-semibold text-pdd-text">{product.profitRate.toFixed(1)}%</div>
                  </div>
                  <div className="bg-pdd-bg/60 rounded-lg border border-pdd-border/40 px-3 py-2">
                    <div className="text-[10px] text-pdd-text-secondary/70">ROI</div>
                    <div className="text-sm font-semibold text-pdd-text">{product.roi > 0 ? product.roi.toFixed(2) : '-'}</div>
                  </div>
                  <div className="bg-pdd-bg/60 rounded-lg border border-pdd-border/40 px-3 py-2">
                    <div className="text-[10px] text-pdd-text-secondary/70">GMV</div>
                    <div className="text-sm font-semibold text-pdd-text">{fmtMoney(product.gmv)}</div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

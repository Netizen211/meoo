import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Package, TrendingUp, TrendingDown, DollarSign, AlertTriangle, RotateCcw, Target, BarChart3, Link2, Layers, Zap, ArrowRight } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { ProductStat } from '../../components/ProductLinkStats';

interface Props {
  product: ProductStat | null;
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = ['var(--pdd-danger)', 'var(--pdd-primary)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-purple)', '#13c2c2', '#eb2f96', '#fa541c'];

function fmt(n: number) { return n.toFixed(2); }
function fmtInt(n: number) { return n.toFixed(0); }

export default function ProductDetailDrawer({ product, isOpen, onClose }: Props) {
  const waterfallData = useMemo(() => {
    if (!product) return [];
    const cb = product.costBreakdown || {};
    const items: { name: string; value: number; fill: string }[] = [
      { name: 'GMV', value: product.gmv, fill: 'var(--pdd-primary)' },
      { name: '折扣', value: -product.discount, fill: 'var(--pdd-warning)' },
      { name: '推广费', value: -product.promoCost, fill: 'var(--pdd-purple)' },
    ];
    if ((cb.platformFee || 0) > 0) items.push({ name: '平台扣点', value: -(cb.platformFee || 0), fill: '#ff7a45' });
    if ((cb.insuranceFee || 0) > 0) items.push({ name: '运费险', value: -(cb.insuranceFee || 0), fill: '#ffc53d' });
    if ((cb.penaltyFee || 0) > 0) items.push({ name: '罚款/扣款', value: -(cb.penaltyFee || 0), fill: '#f5222d' });
    if ((cb.marketingFee || 0) > 0) items.push({ name: '营销费用', value: -(cb.marketingFee || 0), fill: '#eb2f96' });
    items.push({ name: '成本', value: -(cb.productCost || product.totalCost || 0), fill: 'var(--pdd-danger)' });
    items.push({ name: '净利润', value: product.netProfit, fill: product.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' });
    return items;
  }, [product]);

  const afterSalePieData = useMemo(() => {
    if (!product) return [];
    return Object.entries(product.afterSaleBreakdown).map(([name, value]) => ({ name, value }));
  }, [product]);

  if (!product) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] max-w-full bg-pdd-card shadow-2xl z-50 flex flex-col border-l border-pdd-border"
          >
            {/* Header */}
            <div className="shrink-0 bg-pdd-card border-b border-pdd-border px-4 sm:px-6 py-4 sm:py-5 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2 sm:pr-4">
                <h2 className="text-base sm:text-lg font-bold text-pdd-text truncate flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-pdd-danger/10 flex items-center justify-center shrink-0">
                    <Package size={14} color="var(--pdd-danger)" />
                  </div>
                  <span className="truncate">{product.productName}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2 text-xs text-pdd-text-secondary pl-[36px] sm:pl-[42px]">
                  {product.productCode && <span className="font-mono bg-pdd-bg px-1.5 py-0.5 rounded text-pdd-text">{product.productCode}</span>}
                  {product.firstOrderDate && <span>上架: {product.firstOrderDate}</span>}
                  <span>活跃 {product.activeDays} 天</span>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-pdd-bg transition-colors group">
                <X size={18} className="text-pdd-text-secondary group-hover:text-pdd-text" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6">
              {/* Core KPI Cards - 2行3列 */}
              <section>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'GMV', value: `¥${fmtInt(product.gmv)}`, color: 'var(--pdd-primary)', icon: DollarSign },
                    { label: '实收金额', value: `¥${fmtInt(product.revenue)}`, color: 'var(--pdd-success)', icon: TrendingUp },
                    { label: '净利润', value: `¥${fmtInt(product.netProfit)}`, color: product.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)', icon: product.netProfit >= 0 ? TrendingUp : TrendingDown },
                    { label: '利润率', value: `${fmt(product.profitRate)}%`, color: product.profitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)', icon: Target },
                    { label: 'ROI', value: `${product.roi.toFixed(2)}x`, color: product.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)', icon: BarChart3 },
                    { label: '退款率', value: `${fmt(product.refundRate)}%`, color: product.refundRate > 10 ? 'var(--pdd-danger)' : 'var(--pdd-success)', icon: RotateCcw },
                  ].map((kpi) => (
                    <div key={kpi.label} className="bg-pdd-bg rounded-xl p-3 hover:bg-pdd-bg transition-colors">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <kpi.icon size={12} color={kpi.color} />
                        <span className="text-[11px] text-pdd-text-secondary font-medium">{kpi.label}</span>
                      </div>
                      <div className="text-base font-bold tracking-tight" style={{ color: kpi.color }}>{kpi.value}</div>
                    </div>
                  ))}
                </div>
              </section>

              {/* Sales Trend Chart */}
              {product.dailySales.length > 1 && (
                <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                    <TrendingUp size={15} color="var(--pdd-danger)" />销售趋势
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={product.dailySales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} tickFormatter={(v) => v.slice(5)} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="left" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
                      <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '11px' }} formatter={(v: number, name: string) => [name === 'gmv' ? `¥${fmt(v)}` : fmtInt(v), name === 'gmv' ? 'GMV' : '销量']} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                      <Line yAxisId="left" type="monotone" dataKey="sales" name="销量" stroke="var(--pdd-primary)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                      <Line yAxisId="right" type="monotone" dataKey="gmv" name="GMV" stroke="var(--pdd-success)" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </section>
              )}

              {/* Price Distribution */}
              {product.priceDistribution.length > 0 && (
                <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                    <BarChart3 size={15} color="var(--pdd-danger)" />价格带分布
                  </h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={product.priceDistribution}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" vertical={false} />
                      <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--pdd-text-secondary)' }} angle={-20} textAnchor="end" height={40} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '11px' }} formatter={(v: number) => [`${v}单`, '订单数']} cursor={{ fill: 'var(--pdd-bg)' }} />
                      <Bar dataKey="count" fill="var(--pdd-primary)" radius={[6, 6, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </section>
              )}

              {/* After Sale Breakdown */}
              {afterSalePieData.length > 0 && (
                <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                    <AlertTriangle size={15} color="var(--pdd-danger)" />售后原因拆解
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={afterSalePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" strokeWidth={0}>
                        {afterSalePieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', fontSize: '11px' }} formatter={(v: number) => [`${v}单`, '数量']} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </section>
              )}

              {/* Related Products */}
              {product.relatedProducts.length > 0 && (
                <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                    <Link2 size={15} color="var(--pdd-danger)" />关联购买 TOP5
                  </h3>
                  <div className="space-y-2">
                    {product.relatedProducts.map((rp, i) => (
                      <div key={rp.productId} className="flex items-center justify-between p-3 rounded-xl bg-pdd-bg hover:bg-pdd-bg transition-colors group">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${i === 0 ? 'bg-pdd-danger/100 text-white' : i === 1 ? 'bg-orange-400 text-white' : i === 2 ? 'bg-yellow-400 text-white' : 'bg-pdd-bg text-pdd-text'}`}>{i + 1}</span>
                          <span className="truncate text-xs font-medium text-pdd-text group-hover:text-pdd-danger transition-colors">{rp.productName}</span>
                        </div>
                        <span className="text-[11px] text-pdd-text-secondary font-mono shrink-0 ml-3">{rp.coOccurrenceCount}次同购</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Promo Funnel */}
              {product.hasPromoData && (
                <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                  <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                    <Zap size={15} color="var(--pdd-danger)" />推广效果汇总
                  </h3>
                  <div className="space-y-3">
                    {[
                      { label: '曝光', value: product.promoImpressions, color: 'var(--pdd-primary)' },
                      { label: '点击', value: product.promoClicks, rate: product.ctr, color: 'var(--pdd-warning)' },
                      { label: '成交', value: product.promoOrders, rate: product.cvr, color: 'var(--pdd-success)' },
                    ].map((step, i) => (
                      <div key={step.label} className="relative">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-pdd-text">{step.label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-pdd-text">{step.value.toLocaleString()}</span>
                            {step.rate !== undefined && <span className="text-[11px] text-pdd-text-secondary font-mono">({fmt(step.rate)}%)</span>}
                          </div>
                        </div>
                        <div className="h-2.5 bg-pdd-bg rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700 ease-out"
                            style={{
                              width: `${Math.min(100, (step.value / Math.max(product.promoImpressions, 1)) * 100)}%`,
                              backgroundColor: step.color
                            }}
                          />
                        </div>
                        {i < 2 && <ArrowRight size={12} className="absolute left-1/2 -translate-x-1/2 -bottom-3.5 text-pdd-border rotate-90" />}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t border-pdd-border grid grid-cols-2 gap-3">
                    <div className="bg-pdd-primary/10/50 rounded-xl p-3">
                      <span className="text-[11px] text-pdd-text-secondary block mb-1">推广花费</span>
                      <span className="font-mono font-bold text-sm text-purple-700">¥{fmt(product.promoCost)}</span>
                    </div>
                    <div className="bg-pdd-bg rounded-xl p-3">
                      <span className="text-[11px] text-pdd-text-secondary block mb-1">推广ROI</span>
                      <span className="font-mono font-bold text-sm" style={{ color: product.roi >= 0 ? 'var(--pdd-success)' : 'var(--pdd-primary-light)' }}>{product.roi.toFixed(2)}x</span>
                    </div>
                  </div>

                  {/* 推广来源明细 */}
                  {product.promoSourceDetails && product.promoSourceDetails.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-pdd-border">
                      <h4 className="text-xs font-bold text-pdd-text mb-3 flex items-center gap-1.5">
                        <Layers size={13} color="var(--pdd-purple)" />推广数据来源明细
                        <span className="text-pdd-text-secondary font-normal">({product.promoSourceDetails.length}条)</span>
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-pdd-text-secondary border-b border-pdd-border">
                              <th className="py-2 text-left font-medium">来源</th>
                              <th className="py-2 text-left font-medium">日期</th>
                              <th className="py-2 text-right font-medium">花费</th>
                              <th className="py-2 text-right font-medium">点击</th>
                              <th className="py-2 text-right font-medium">曝光</th>
                              <th className="py-2 text-right font-medium">成交</th>
                              <th className="py-2 text-right font-medium">交易额</th>
                              <th className="py-2 text-right font-medium">CTR</th>
                              <th className="py-2 text-right font-medium">CVR</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.promoSourceDetails.map((d, i) => (
                              <tr key={i} className="border-b border-pdd-gray-50 hover:bg-pdd-bg transition-colors">
                                <td className="py-2">
                                  <span className={`px-1.5 py-0.5 rounded font-medium ${
                                    d.source === '商品推广' ? 'bg-pdd-danger/10 text-pdd-danger' :
                                    d.source === '商品推广汇总' ? 'bg-pink-50 text-pink-600' :
                                    d.source === '明星店铺' ? 'bg-pdd-warning/10 text-orange-600' :
                                    d.source === '直播推广' ? 'bg-pdd-primary/10 text-pdd-primary-dark' :
                                    'bg-pdd-bg text-pdd-text'
                                  }`}>{d.source}</span>
                                </td>
                                <td className="py-2 text-pdd-text font-mono">{d.date || '--'}</td>
                                <td className="py-2 text-right font-mono text-purple-700">¥{d.cost.toFixed(2)}</td>
                                <td className="py-2 text-right font-mono">{d.clicks.toLocaleString()}</td>
                                <td className="py-2 text-right font-mono">{d.impressions.toLocaleString()}</td>
                                <td className="py-2 text-right font-mono">{d.orders}</td>
                                <td className="py-2 text-right font-mono">¥{d.transaction.toFixed(2)}</td>
                                <td className="py-2 text-right font-mono text-pdd-text">{d.ctr.toFixed(2)}%</td>
                                <td className="py-2 text-right font-mono text-pdd-text">{d.cvr.toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-pdd-border font-bold text-pdd-text bg-pdd-bg/50">
                              <td className="py-2">合计</td>
                              <td className="py-2">--</td>
                              <td className="py-2 text-right font-mono text-purple-700">¥{product.promoSourceDetails.reduce((s, d) => s + d.cost, 0).toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">{product.promoSourceDetails.reduce((s, d) => s + d.clicks, 0).toLocaleString()}</td>
                              <td className="py-2 text-right font-mono">{product.promoSourceDetails.reduce((s, d) => s + d.impressions, 0).toLocaleString()}</td>
                              <td className="py-2 text-right font-mono">{product.promoSourceDetails.reduce((s, d) => s + d.orders, 0)}</td>
                              <td className="py-2 text-right font-mono">¥{product.promoSourceDetails.reduce((s, d) => s + d.transaction, 0).toFixed(2)}</td>
                              <td className="py-2 text-right font-mono">
                                {(() => { const imp = product.promoSourceDetails.reduce((s, d) => s + d.impressions, 0); const clk = product.promoSourceDetails.reduce((s, d) => s + d.clicks, 0); return imp > 0 ? ((clk / imp) * 100).toFixed(2) : '0.00'; })()}%
                              </td>
                              <td className="py-2 text-right font-mono">
                                {(() => { const clk = product.promoSourceDetails.reduce((s, d) => s + d.clicks, 0); const ord = product.promoSourceDetails.reduce((s, d) => s + d.orders, 0); return clk > 0 ? ((ord / clk) * 100).toFixed(2) : '0.00'; })()}%
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Profit Waterfall */}
              <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                  <DollarSign size={15} color="var(--pdd-danger)" />利润分解
                </h3>
                <div className="space-y-2">
                  {waterfallData.map((item) => (
                    <div key={item.name} className="flex items-center justify-between p-3 rounded-xl bg-pdd-bg hover:bg-pdd-bg transition-colors">
                      <span className="text-xs font-semibold text-pdd-text">{item.name}</span>
                      <span className="font-mono font-bold text-sm" style={{ color: item.fill }}>
                        {item.value >= 0 ? '+' : '-'}¥{fmt(Math.abs(item.value))}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Inventory & Turnover */}
              <section className="bg-pdd-card border border-pdd-border rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm">
                <h3 className="text-sm font-bold text-pdd-text mb-4 flex items-center gap-2">
                  <Layers size={15} color="var(--pdd-danger)" />库存与周转
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-pdd-bg rounded-xl p-3.5">
                    <span className="text-[11px] text-pdd-text-secondary block mb-1.5">预估库存</span>
                    <span className="font-mono font-bold text-lg text-pdd-text">{product.inventoryEstimate}</span>
                  </div>
                  <div className="bg-pdd-bg rounded-xl p-3.5">
                    <span className="text-[11px] text-pdd-text-secondary block mb-1.5">周转天数</span>
                    <span className="font-mono font-bold text-lg" style={{ color: product.turnoverDays > 30 ? 'var(--pdd-primary-light)' : product.turnoverDays > 14 ? 'var(--pdd-warning)' : 'var(--pdd-success)' }}>
                      {product.turnoverDays}天
                    </span>
                  </div>
                  <div className="bg-pdd-bg rounded-xl p-3.5">
                    <span className="text-[11px] text-pdd-text-secondary block mb-1.5">日均销量</span>
                    <span className="font-mono font-bold text-lg text-pdd-text">{fmt(product.avgDailySales)}</span>
                  </div>
                  <div className="bg-pdd-bg rounded-xl p-3.5">
                    <span className="text-[11px] text-pdd-text-secondary block mb-1.5">售罄率</span>
                    <span className="font-mono font-bold text-lg text-pdd-text">{fmt(product.sellThroughRate)}%</span>
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

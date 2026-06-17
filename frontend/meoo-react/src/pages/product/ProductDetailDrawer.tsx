import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { X, Package, Copy, Check, Tag, ChevronDown, DollarSign, Activity, TrendingUp } from 'lucide-react';
import { ProductStat } from '../../components/ProductLinkStats';

interface SkuItem {
  productId: string; productName: string; skuId: string; skuName: string;
  sales: number; revenue: number; gmv: number; orders: number; refund: number;
  prices: number[];
}

interface Props {
  product: ProductStat | null;
  skuList: SkuItem[];
  isOpen: boolean;
  onClose: () => void;
}

const fmtMoney = (v: number) =>
  v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' :
  v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1);

const fmtNum = (v: number) =>
  v >= 10000 ? (v / 10000).toFixed(1) + '万' : v.toFixed(0);

export default function ProductDetailDrawer({ product, skuList, isOpen, onClose }: Props) {
  const [copiedId, setCopiedId] = useState(false);
  const [skuOpen, setSkuOpen] = useState(true);

  const skuStats = useMemo(() => {
    if (!skuList.length) return null;
    const allPrices = skuList.flatMap(s => s.prices);
    const avg = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 0;
    const min = allPrices.length > 0 ? Math.min(...allPrices) : 0;
    const max = allPrices.length > 0 ? Math.max(...allPrices) : 0;
    const totalSales = skuList.reduce((s, i) => s + i.sales, 0);
    const totalRevenue = skuList.reduce((s, i) => s + i.revenue, 0);
    const totalOrders = skuList.reduce((s, i) => s + i.orders, 0);
    return { avgPrice: avg, minPrice: min, maxPrice: max, totalSales, totalRevenue, totalOrders };
  }, [skuList]);

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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] max-w-full bg-white shadow-2xl z-50 flex flex-col border-l border-gray-200"
          >
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-4 sm:px-5 py-4 flex items-start justify-between">
              <div className="flex-1 min-w-0 pr-2">
                <h2 className="text-base sm:text-[15px] font-bold text-gray-800 truncate flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-blue-600" />
                  </div>
                  <span className="truncate">{product.productName}</span>
                </h2>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-gray-400 pl-[36px]">
                  <span className="font-mono text-gray-500">{product.productId}</span>
                  <span className="ml-1 inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                    onClick={() => { navigator.clipboard.writeText(product.productId).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }); }}>
                    {copiedId ? <Check size={9} className="text-green-500" /> : <Copy size={9} />}
                    {copiedId ? '已复制' : '复制ID'}
                  </span>
                  {product.productCode && (
                    <span className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-500">编码: {product.productCode}</span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">

              {/* 基本信息 */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                  <Package size={13} className="text-blue-500" />
                  <span className="text-[12px] font-bold text-gray-700">基本信息</span>
                </div>
                <div className="grid grid-cols-2 gap-y-3 gap-x-6 p-4 text-xs">
                  <InfoRow label="商品ID" value={
                    <span className="flex items-center gap-1">
                      <span className="font-mono text-gray-800">{product.productId}</span>
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors cursor-pointer"
                        onClick={() => { navigator.clipboard.writeText(product.productId).then(() => { setCopiedId(true); setTimeout(() => setCopiedId(false), 1500); }); }}>
                        {copiedId ? <Check size={9} className="text-green-500" /> : <Copy size={9} />}
                      </span>
                    </span>
                  } />
                  <InfoRow label="商品编码" value={product.productCode || '-'} />
                  <InfoRow label="首单日期" value={product.firstOrderDate || '-'} />
                  <InfoRow label="最近出单" value={product.lastOrderDate || '-'} />
                  <InfoRow label="活跃天数" value={product.activeDays !== undefined ? `${product.activeDays}天` : '-'} />
                  <InfoRow label="总销量" value={<span className="font-semibold text-gray-800">{fmtNum(product.sales)}件</span>} />
                  <InfoRow label="总收入" value={<span className="font-semibold text-gray-800">{fmtMoney(product.revenue)}</span>} />
                  <InfoRow label="总订单" value={<span className="font-semibold text-gray-800">{fmtNum(product.orders)}单</span>} />
                  <InfoRow label="退款率" value={
                    <span className={`font-semibold ${product.refundRate > 10 ? 'text-red-500' : 'text-green-600'}`}>
                      {product.refundRate.toFixed(1)}%
                    </span>
                  } />
                  <InfoRow label="售后单" value={`${fmtNum(product.afterSaleCount)}单`} />
                </div>
              </div>

              {/* SKU规格与价格 */}
              {skuList.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/50 cursor-pointer select-none"
                    onClick={() => setSkuOpen(o => !o)}>
                    <div className="flex items-center gap-1.5">
                      <Tag size={13} className="text-blue-500" />
                      <span className="text-[12px] font-bold text-gray-700">SKU规格与价格</span>
                      <span className="text-[10px] text-gray-400 ml-1">({skuList.length})</span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-400 transition-transform duration-200 ${skuOpen ? 'rotate-180' : ''}`} />
                  </div>
                  {skuOpen && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-gray-500 border-b border-gray-100">
                            <th className="py-2.5 px-3 text-left font-medium w-1/2">规格名称</th>
                            <th className="py-2.5 px-3 text-right font-medium">售价</th>
                            <th className="py-2.5 px-3 text-right font-medium">价格变动</th>
                            <th className="py-2.5 px-3 text-right font-medium">销量</th>
                            <th className="py-2.5 px-3 text-right font-medium">收入</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {skuList.map((sku) => {
                            const priceRange = sku.prices.length > 0
                              ? { min: Math.min(...sku.prices), max: Math.max(...sku.prices) }
                              : null;
                            const hasVariation = priceRange && priceRange.max - priceRange.min > 0.01;
                            const avgPrice = sku.prices.length > 0
                              ? sku.prices.reduce((a, b) => a + b, 0) / sku.prices.length
                              : 0;
                            return (
                              <tr key={sku.skuId} className="hover:bg-gray-50/50 transition-colors">
                                <td className="py-2.5 px-3 text-gray-700 max-w-[200px]">
                                  <div className="truncate font-medium">{sku.skuName}</div>
                                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">{sku.skuId}</div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-gray-800">
                                  ¥{avgPrice.toFixed(2)}
                                </td>
                                <td className="py-2.5 px-3 text-right">
                                  {hasVariation ? (
                                    <span className="text-[11px] font-mono text-amber-600">
                                      ¥{priceRange!.min.toFixed(2)} ~ ¥{priceRange!.max.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300">-</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                                  {fmtNum(sku.sales)}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                                  {fmtMoney(sku.revenue)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* 改价趋势折线图 */}
              {skuList.filter(s => s.prices.length >= 2).length > 0 && (() => {
                // 取价格记录最多的前5个SKU
                const topSku = [...skuList].filter(s => s.prices.length >= 2).sort((a, b) => b.sales - a.sales).slice(0, 5);
                const maxLen = Math.max(...topSku.map(s => s.prices.length));
                const chartData = Array.from({ length: maxLen }, (_, i) => {
                  const point: Record<string, any> = { index: `#${i + 1}` };
                  topSku.forEach(s => {
                    if (i < s.prices.length) point[s.skuName] = s.prices[i];
                  });
                  return point;
                });
                const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
                return (
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                      <TrendingUp size={13} className="text-blue-500" />
                      <span className="text-[12px] font-bold text-gray-700">SKU改价趋势</span>
                    </div>
                    <div className="p-3">
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={chartData} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                          <XAxis dataKey="index" tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10, fill: '#999' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `¥${v.toFixed(0)}`} />
                          <Tooltip
                            contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgba(0,0,0,0.06)', fontSize: '11px' }}
                            formatter={(v: number, name: string) => [`¥${v.toFixed(2)}`, name]}
                          />
                          {topSku.map((s, i) => (
                            <Line key={s.skuId} type="monotone" dataKey={s.skuName} stroke={colors[i % colors.length]} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                      <div className="flex flex-wrap gap-3 mt-1 justify-center">
                        {topSku.map((s, i) => (
                          <div key={s.skuId} className="flex items-center gap-1 text-[10px] text-gray-500">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="max-w-[80px] truncate">{s.skuName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 价格统计分析 */}
              {skuStats && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                    <DollarSign size={13} className="text-blue-500" />
                    <span className="text-[12px] font-bold text-gray-700">价格统计分析</span>
                  </div>
                  <div className="grid grid-cols-3 gap-0">
                    <StatTile label="平均售价" value={`¥${skuStats.avgPrice.toFixed(2)}`} sub={skuList.flatMap(s => s.prices).length > 0 ? `${skuList.flatMap(s => s.prices).length}个价格样本` : undefined} />
                    <StatTile label="最低售价" value={`¥${skuStats.minPrice.toFixed(2)}`} borderLeft />
                    <StatTile label="最高售价" value={`¥${skuStats.maxPrice.toFixed(2)}`} borderLeft />
                  </div>
                </div>
              )}

              {/* 销售汇总 */}
              {skuStats && (
                <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-100 bg-gray-50/50">
                    <Activity size={13} className="text-blue-500" />
                    <span className="text-[12px] font-bold text-gray-700">销售汇总</span>
                  </div>
                  <div className="grid grid-cols-3 gap-0">
                    <StatTile label="总销量" value={`${fmtNum(skuStats.totalSales)}`} sub="件" />
                    <StatTile label="总订单" value={`${fmtNum(skuStats.totalOrders)}`} sub="单" borderLeft />
                    <StatTile label="总收入" value={fmtMoney(skuStats.totalRevenue)} borderLeft />
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between min-w-0">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-700 text-right ml-2">{value}</span>
    </div>
  );
}

function StatTile({ label, value, sub, borderLeft }: { label: string; value: string; sub?: string; borderLeft?: boolean }) {
  return (
    <div className={`py-4 px-4 text-center ${borderLeft ? 'border-l border-gray-100' : ''}`}>
      <div className="text-[11px] text-gray-400 mb-1">{label}</div>
      <div className="text-base font-bold text-gray-800">{value}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

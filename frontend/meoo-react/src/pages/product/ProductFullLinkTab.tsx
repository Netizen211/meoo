import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpDown, Download, Filter, LayoutGrid, Table, Eye, Percent, Target, RotateCcw, Package, Search, CheckCircle, XCircle, Activity, Shield } from 'lucide-react';
import { ProductStat } from '../../components/ProductLinkStats';
import ProductLinkChart from '../../components/ProductLinkChart';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { SEMANTIC, CHART } from '../../ui/tokens/colors';

function fmt(n: number) { return (n || 0).toFixed(2); }
function fmtInt(n: number) { return (n || 0).toFixed(0); }

type ViewMode = 'card' | 'table' | 'chart';
type RoiFilter = 'all' | 'profit' | 'loss' | 'flat';

interface Props {
  productStats?: Record<string, ProductStat>;
}

export default function ProductFullLinkTab({ productStats }: Props) {
  // 服务端已计算好统计，这里仅做简单汇总展示
  const totalStats = useMemo(() => {
    const all = Object.values(productStats || {});
    return {
      totalGmv: all.reduce((s, p) => s + p.gmv, 0),
      totalOrders: all.reduce((s, p) => s + p.orders, 0),
      totalRevenue: all.reduce((s, p) => s + p.revenue, 0),
      totalProfit: all.reduce((s, p) => s + p.netProfit, 0),
      avgRoi: all.length > 0 ? all.reduce((s, p) => s + p.roi, 0) / all.length : 0,
      avgProfitRate: all.length > 0 ? all.reduce((s, p) => s + p.profitRate, 0) / all.length : 0,
      // Extended fields used by KPI cards
      gmv: all.reduce((s, p) => s + p.gmv, 0),
      revenue: all.reduce((s, p) => s + p.revenue, 0),
      promoCost: all.reduce((s, p) => s + p.promoCost, 0),
      discount: all.reduce((s, p) => s + p.discount, 0),
      totalGrossProfit: all.reduce((s, p) => s + (p.grossProfit ?? 0), 0),
      totalPreTaxProfit: all.reduce((s, p) => s + (p.preTaxProfit ?? 0), 0),
      totalTaxes: all.reduce((s, p) => s + (p.costBreakdown?.taxes ?? 0), 0),
      totalCustomDed: all.reduce((s, p) => s + (p.costBreakdown?.customDeductions ?? 0), 0),
      netProfit: all.reduce((s, p) => s + p.netProfit, 0),
      totalCost: all.reduce((s, p) => s + p.totalCost, 0),
      refundRate: all.length > 0 ? all.reduce((s, p) => s + p.refundRate, 0) / all.length : 0,
    };
  }, [productStats]);

  const [sortKey, setSortKey] = useState<string>('roi');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [roiFilter, setRoiFilter] = useState<RoiFilter>('all');
  const [minOrders, setMinOrders] = useState(0);
  const [minGmv, setMinGmv] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);

  const productList = useMemo(() => {
    if (!productStats) return [];
    return Object.entries(productStats).map(([pid, s]) => ({ id: pid, ...s }));
  }, [productStats]);

  const filteredProducts = useMemo(() => {
    let result = [...productList];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(p => p.productName.toLowerCase().includes(q) || p.productId.toLowerCase().includes(q));
    }
    result = result.filter(p => {
      if (roiFilter === 'profit' && p.roi < 1) return false;
      if (roiFilter === 'loss' && p.roi >= 1) return false;
      if (roiFilter === 'flat' && Math.abs(p.roi - 1) > 0.05) return false;
      if (p.orders < minOrders) return false;
      if (p.gmv < minGmv) return false;
      return true;
    });
    result.sort((a, b) => {
      const getVal = (s: ProductStat, key: string): number => {
        const map: Record<string, number> = {
          roi: s.roi, gmv: s.gmv, orders: s.orders, revenue: s.revenue,
          netProfit: s.netProfit, profitRate: s.profitRate, refundRate: s.refundRate,
          avgOrderValue: s.avgOrderValue, promoCost: s.promoCost, discount: s.discount,
          totalCost: s.totalCost, ctr: s.ctr, cvr: s.cvr, sales: s.sales
        };
        return map[key] || 0;
      };
      const diff = getVal(a, sortKey) - getVal(b, sortKey);
      return sortDir === 'desc' ? -diff : diff;
    });
    return result;
  }, [productList, searchQuery, roiFilter, minOrders, minGmv, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const exportCSV = () => {
    const headers = ['商品名称', '商品ID', 'GMV', '订单数', '销量', '客单价', '商家实收', '推广成本', '折扣成本', '总成本', '退款金额', '退款率', '售后率', '净利润', '利润率', 'ROI', 'CTR', 'CVR', '数据来源'];
    const rows = filteredProducts.map(p => {
      const source = p.hasOrderData && p.hasPromoData ? '订单+推广' : p.hasOrderData ? '订单' : p.hasPromoData ? '推广' : '无';
      return [p.productName, p.productId, p.gmv, p.orders, p.sales, p.avgOrderValue, p.revenue, p.promoCost, p.discount, p.totalCost, p.refund, p.refundRate, p.afterSaleRate, p.netProfit, p.profitRate, p.roi, p.ctr, p.cvr, source];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product_fulllink_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: '总GMV', value: `¥${fmtInt(totalStats.gmv)}`, icon: DollarSign, color: CHART.all[0], bar: `linear-gradient(90deg, ${CHART.all[0]}, ${CHART.all[1]})` },
    { label: '总实收', value: `¥${fmtInt(totalStats.revenue)}`, icon: TrendingUp, color: SEMANTIC.profit, bar: `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` },
    { label: '推广花费', value: `¥${fmtInt(totalStats.promoCost)}`, icon: Target, color: '#7C3AED', bar: 'linear-gradient(90deg, #7C3AED, #A78BFA)' },
    { label: '总折扣', value: `¥${fmtInt(totalStats.discount)}`, icon: Percent, color: SEMANTIC.warning, bar: `linear-gradient(90deg, ${SEMANTIC.warning}, #FBBF24)` },
    { label: '毛利润', value: `¥${fmtInt(totalStats.totalGrossProfit)}`, icon: TrendingUp, color: totalStats.totalGrossProfit >= 0 ? CHART.all[0] : SEMANTIC.loss, bar: totalStats.totalGrossProfit >= 0 ? `linear-gradient(90deg, ${CHART.all[0]}, ${CHART.all[2]})` : `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
    { label: '税前利润', value: `¥${fmtInt(totalStats.totalPreTaxProfit)}`, icon: Activity, color: totalStats.totalPreTaxProfit >= 0 ? SEMANTIC.profit : SEMANTIC.loss, bar: totalStats.totalPreTaxProfit >= 0 ? `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` : `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
    { label: '税费+扣费', value: `¥${fmtInt(totalStats.totalTaxes + totalStats.totalCustomDed)}`, icon: Shield, color: SEMANTIC.warning, bar: `linear-gradient(90deg, ${SEMANTIC.warning}, #FBBF24)` },
    { label: '净利润', value: `¥${fmtInt(totalStats.netProfit)}`, icon: DollarSign, color: totalStats.netProfit >= 0 ? SEMANTIC.profit : SEMANTIC.loss, bar: totalStats.netProfit >= 0 ? `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` : `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
    { label: '平均ROI', value: `${(totalStats.avgRoi || 0).toFixed(2)}x`, icon: BarChart3, color: (totalStats.avgRoi || 0) >= 1 ? SEMANTIC.profit : SEMANTIC.loss, bar: (totalStats.avgRoi || 0) >= 1 ? `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` : `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
    { label: '平均利润率', value: `${(totalStats.avgProfitRate || 0).toFixed(1)}%`, icon: RotateCcw, color: '#ff7875', bar: 'linear-gradient(90deg, #ff7875, #FFA07A)' },
  ];

  const tableColumns = [
    { key: 'name', label: '商品', sortable: false },
    { key: 'source', label: '来源', sortable: false },
    { key: 'roi', label: 'ROI', sortable: true },
    { key: 'gmv', label: 'GMV', sortable: true },
    { key: 'orders', label: '订单', sortable: true },
    { key: 'revenue', label: '实收', sortable: true },
    { key: 'promoCost', label: '推广', sortable: true },
    { key: 'totalCost', label: '总成本', sortable: true },
    { key: 'netProfit', label: '净利润', sortable: true },
    { key: 'profitRate', label: '利润率', sortable: true },
    { key: 'refundRate', label: '退款率', sortable: true },
    { key: 'ctr', label: 'CTR', sortable: true },
    { key: 'cvr', label: 'CVR', sortable: true },
  ];

  const renderStatValue = (s: ProductStat, key: string) => {
    const isRate = ['refundRate', 'afterSaleRate', 'profitRate', 'ctr', 'cvr'].includes(key);
    const isMoney = ['gmv', 'revenue', 'promoCost', 'discount', 'totalCost', 'refund', 'netProfit', 'avgOrderValue'].includes(key);
    const val = s[key as keyof ProductStat] as number;
    const safeVal = val || 0;
    if (key === 'roi') {
      return <span style={{ color: safeVal >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>{safeVal.toFixed(2)}x</span>;
    }
    if (isRate) {
      const color = key === 'profitRate' ? (safeVal >= 0 ? SEMANTIC.profit : SEMANTIC.loss) : undefined;
      return <span style={{ color }}>{safeVal.toFixed(1)}%</span>;
    }
    if (isMoney) {
      const color = key === 'netProfit' ? (val >= 0 ? SEMANTIC.profit : SEMANTIC.loss) : key === 'revenue' ? SEMANTIC.profit : key === 'totalCost' || key === 'promoCost' ? SEMANTIC.loss : undefined;
      return <span style={{ color }}>¥{fmt(val)}</span>;
    }
    return <span>{val}</span>;
  };

  const selectedDetail = selectedProduct && productStats ? productStats[selectedProduct] : null;
  const noData = productList.length === 0;

  if (noData) {
    return (
      <Card className="p-8 text-center bg-gradient-to-br from-white/50 to-white/20 backdrop-blur-sm border-white/50">
        <Package size={48} className="mx-auto mb-3 text-pdd-text-secondary/30" />
        <p className="text-lg text-pdd-text-secondary mb-2">暂无商品数据</p>
        <p className="text-sm text-pdd-text-secondary/70">请先上传订单数据或推广数据，系统将自动按商品ID关联分析</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3 ml-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {kpiCards.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white/60 to-white/30">
              <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: k.bar }} />
              <CardContent className="p-3 relative z-10">
                <div className="flex items-center gap-2 mb-1"><k.icon size={14} style={{ color: k.color }} /><span className="text-xs text-pdd-text-secondary/70">{k.label}</span></div>
                <div className="text-lg font-bold" style={{ color: k.color }}>{k.value}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <Card className="p-3 bg-white/40 backdrop-blur-sm border-white/50">
        <CardContent className="p-0">
          <div className="flex items-center gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-1">
              <span className="text-pdd-text-secondary/60">ROI:</span>
              {(['all', 'profit', 'loss', 'flat'] as RoiFilter[]).map(f => (
                <button key={f} onClick={() => setRoiFilter(f)}
                  className={`px-2 py-1 rounded transition-all duration-200 ${roiFilter === f ? 'bg-red-600 text-white shadow-sm' : 'bg-white/60 text-pdd-text-secondary/70 hover:text-pdd-text hover:bg-white'}`}>
                  {f === 'all' ? '全部' : f === 'profit' ? '盈利' : f === 'loss' ? '亏损' : '持平'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <span className="text-pdd-text-secondary/60">最低订单:</span>
              <input type="number" value={minOrders} onChange={e => setMinOrders(parseInt(e.target.value) || 0)} className="w-14 px-2 py-1 rounded border border-pdd-border bg-white/60 text-pdd-text outline-none text-[10px]" />
            </div>
            <div className="flex items-center gap-1 relative">
              <Search size={12} className="text-pdd-text-secondary/40 absolute left-2" />
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索商品" className="w-32 pl-6 pr-2 py-1 rounded border border-pdd-border bg-white/60 text-pdd-text outline-none text-[10px] placeholder:text-pdd-text-secondary/30 focus:border-pdd-primary transition-colors" />
            </div>
            <div className="flex items-center gap-1 ml-auto">
              {(['table', 'card', 'chart'] as ViewMode[]).map(v => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`p-1.5 rounded transition-all duration-200 ${viewMode === v ? 'bg-red-600 text-white shadow-sm' : 'bg-white/60 text-pdd-text-secondary/70 hover:text-pdd-text hover:bg-white'}`}>
                  {v === 'table' ? <Table size={12} /> : v === 'card' ? <LayoutGrid size={12} /> : <BarChart3 size={12} />}
                </button>
              ))}
              <button onClick={exportCSV} className="p-1.5 rounded bg-white/60 text-pdd-text-secondary/70 hover:text-red-500 hover:bg-white transition-all duration-200"><Download size={12} /></button>
            </div>
          </div>
          <p className="text-[10px] text-pdd-text-secondary/50 mt-2">筛选后 {filteredProducts.length} / {productList.length} 个商品</p>
        </CardContent>
      </Card>

      {/* Chart View */}
      {viewMode === 'chart' && (
        <ProductLinkChart linkStats={filteredProducts.map(p => ({
          name: p.productName, gmv: p.gmv, cost: p.totalCost, revenue: p.revenue, roi: p.roi, netProfit: p.netProfit
        }))} />
      )}

      {/* Card View */}
      {viewMode === 'card' && (
        <div className="grid grid-cols-2 gap-3">
          {filteredProducts.slice(0, 20).map(p => (
            <motion.div key={p.productId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.01 }}>
              <Card className="cursor-pointer bg-gradient-to-br from-white/60 to-white/30 hover:shadow-lg transition-all duration-300" onClick={() => setSelectedProduct(p.productId)}>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1 min-w-0">
                      <Link size={12} style={{ color: '#7C3AED' }} className="flex-shrink-0" />
                      <span className="text-xs font-bold truncate text-pdd-text">{p.productName}</span>
                    </div>
                    <span className="text-xs font-bold" style={{ color: p.roi >= 1 ? SEMANTIC.profit : SEMANTIC.warning }}>ROI {p.roi.toFixed(2)}x</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-[10px]">
                    <div><span className="text-pdd-text-secondary/60">GMV</span><br /><span className="font-mono text-pdd-text tabular-nums">¥{fmt(p.gmv)}</span></div>
                    <div><span className="text-pdd-text-secondary/60">实收</span><br /><span className="font-mono tabular-nums" style={{ color: SEMANTIC.profit }}>¥{fmt(p.revenue)}</span></div>
                    <div><span className="text-pdd-text-secondary/60">净利</span><br /><span className="font-mono tabular-nums" style={{ color: p.netProfit >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>¥{fmt(p.netProfit)}</span></div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <Card className="overflow-hidden border-white/50 shadow-sm">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-gradient-to-r from-blue-50/40 via-transparent to-purple-50/40 sticky top-0 z-10">
                {tableColumns.map(h => (
                  <th key={h.key} className="px-2 py-2 text-left font-medium text-pdd-text-secondary whitespace-nowrap cursor-pointer hover:text-red-500 transition-colors" onClick={() => h.sortable && toggleSort(h.key)}>
                    {h.label}{h.sortable && <ArrowUpDown size={10} className="inline ml-1" />}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.productId} className="border-b border-pdd-border/40 hover:bg-gradient-to-r hover:from-orange-50/60 hover:to-amber-50/30 cursor-pointer transition-all duration-200" onClick={() => setSelectedProduct(p.productId)}>
                    <td className="px-2 py-2 font-medium truncate max-w-[120px]">
                      <div className="flex items-center gap-1">
                        <Link size={10} style={{ color: '#7C3AED' }} />
                        <span className="truncate">{p.productName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {p.hasOrderData && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ backgroundColor: SEMANTIC.profit }} title="订单" />}
                        {p.hasPromoData && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-600" title="推广" />}
                        <span className="text-[10px]">{p.hasOrderData && p.hasPromoData ? '全链路' : p.hasOrderData ? '订单' : '推广'}</span>
                      </div>
                    </td>
                    {tableColumns.filter(c => c.key !== 'name' && c.key !== 'source').map(c => (
                      <td key={c.key} className="px-2 py-2 whitespace-nowrap tabular-nums">{renderStatValue(p, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Selected Product Detail */}
      <AnimatePresence>
        {selectedDetail && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <Card className="p-4 bg-gradient-to-br from-white/60 to-white/20 backdrop-blur-sm border-white/50">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Eye size={14} style={{ color: '#7C3AED' }} />
                  {selectedDetail.productName}
                  <span className="text-[10px] text-pdd-text-secondary/50 font-mono">ID: {selectedProduct}</span>
                </h3>
                <button onClick={() => setSelectedProduct(null)} className="p-1 text-pdd-text-secondary/50 hover:text-red-500 transition-colors"><XCircle size={14} /></button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign size={12} style={{ color: SEMANTIC.profit }} /> 订单维度{!selectedDetail.hasOrderData && <span className="text-[10px] text-pdd-text-secondary/50">（无数据）</span>}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">GMV</span><p className="font-mono font-bold" style={{ color: CHART.all[0] }}>¥{fmt(selectedDetail.gmv)}</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">实收</span><p className="font-mono font-bold" style={{ color: SEMANTIC.profit }}>¥{fmt(selectedDetail.revenue)}</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">订单</span><p className="font-mono font-bold text-pdd-text">{selectedDetail.orders}</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">退款率</span><p className="font-mono font-bold">{(selectedDetail.refundRate||0).toFixed(1)}%</p></div>
                  </div>
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><Target size={12} style={{ color: '#7C3AED' }} /> 推广维度{!selectedDetail.hasPromoData && <span className="text-[10px] text-pdd-text-secondary/50">（无数据）</span>}</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">推广花费</span><p className="font-mono font-bold" style={{ color: '#7C3AED' }}>¥{fmt(selectedDetail.promoCost)}</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">CTR</span><p className="font-mono font-bold text-pdd-text">{(selectedDetail.ctr||0).toFixed(2)}%</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">CVR</span><p className="font-mono font-bold text-pdd-text">{(selectedDetail.cvr||0).toFixed(2)}%</p></div>
                    <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">推广占比</span><p className="font-mono font-bold text-pdd-text">{(selectedDetail.promoCostRatio||0).toFixed(1)}%</p></div>
                  </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-pdd-border/50">
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">总成本</span><p className="font-mono font-bold" style={{ color: SEMANTIC.loss }}>¥{fmt(selectedDetail.totalCost)}</p></div>
                <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">净利润</span><p className="font-mono font-bold" style={{ color: selectedDetail.netProfit >= 0 ? SEMANTIC.profit : SEMANTIC.warning }}>¥{fmt(selectedDetail.netProfit)}</p></div>
                <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">利润率</span><p className="font-mono font-bold text-pdd-text">{(selectedDetail.profitRate||0).toFixed(1)}%</p></div>
                <div className="bg-white/60 backdrop-blur-sm rounded p-2 border border-pdd-border/30"><span className="text-pdd-text-secondary/60">ROI</span><p className="font-mono font-bold" style={{ color: selectedDetail.roi >= 1 ? SEMANTIC.profit : SEMANTIC.warning }}>{(selectedDetail.roi||0).toFixed(2)}x</p></div>
              </div>
            </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

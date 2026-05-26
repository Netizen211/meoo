import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, TrendingUp, TrendingDown, DollarSign, BarChart3, ArrowUpDown, Download, Filter, LayoutGrid, Table, Eye, Percent, Target, RotateCcw, Package, Search, CheckCircle, XCircle, Activity, Shield } from 'lucide-react';
import { useTotalProductStats, ProductStat } from '../../components/ProductLinkStats';
import ProductLinkChart from '../../components/ProductLinkChart';

function fmt(n: number) { return n.toFixed(2); }
function fmtInt(n: number) { return n.toFixed(0); }

type ViewMode = 'card' | 'table' | 'chart';
type RoiFilter = 'all' | 'profit' | 'loss' | 'flat';

interface Props {
  productStats?: Record<string, ProductStat>;
}

export default function ProductFullLinkTab({ productStats }: Props) {
  // 完全依赖外部传入的已过滤数据
  const totalStats = useTotalProductStats(productStats || {});

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
    { label: '总GMV', value: `¥${fmtInt(totalStats.gmv)}`, icon: DollarSign, color: 'var(--pdd-primary)' },
    { label: '总实收', value: `¥${fmtInt(totalStats.revenue)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广花费', value: `¥${fmtInt(totalStats.promoCost)}`, icon: Target, color: 'var(--pdd-purple)' },
    { label: '总折扣', value: `¥${fmtInt(totalStats.discount)}`, icon: Percent, color: 'var(--pdd-warning)' },
    { label: '毛利润', value: `¥${fmtInt(totalStats.totalGrossProfit)}`, icon: TrendingUp, color: totalStats.totalGrossProfit >= 0 ? 'var(--pdd-info)' : 'var(--pdd-danger)' },
    { label: '税前利润', value: `¥${fmtInt(totalStats.totalPreTaxProfit)}`, icon: Activity, color: totalStats.totalPreTaxProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
    { label: '税费+扣费', value: `¥${fmtInt(totalStats.totalTaxes + totalStats.totalCustomDed)}`, icon: Shield, color: 'var(--pdd-warning)' },
    { label: '净利润', value: `¥${fmtInt(totalStats.netProfit)}`, icon: DollarSign, color: totalStats.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
    { label: '平均ROI', value: `${totalStats.roi.toFixed(2)}x`, icon: BarChart3, color: totalStats.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
    { label: '退款率', value: `${totalStats.refundRate.toFixed(1)}%`, icon: RotateCcw, color: '#ff7875' },
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
    if (key === 'roi') {
      return <span style={{ color: val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{val.toFixed(2)}x</span>;
    }
    if (isRate) {
      const color = key === 'profitRate' ? (val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)') : undefined;
      return <span style={{ color }}>{val.toFixed(1)}%</span>;
    }
    if (isMoney) {
      const color = key === 'netProfit' ? (val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)') : key === 'revenue' ? 'var(--pdd-success)' : key === 'totalCost' || key === 'promoCost' ? 'var(--pdd-danger)' : undefined;
      return <span style={{ color }}>¥{fmt(val)}</span>;
    }
    return <span>{val}</span>;
  };

  const selectedDetail = selectedProduct && productStats ? productStats[selectedProduct] : null;
  const noData = productList.length === 0;

  if (noData) {
    return (
      <div className="pdd-card p-8 text-center ml-5">
        <Package size={48} className="mx-auto mb-3 text-pdd-text-secondary" />
        <p className="text-lg text-pdd-text-secondary mb-2">暂无商品数据</p>
        <p className="text-sm text-pdd-text-secondary">请先上传订单数据或推广数据，系统将自动按商品ID关联分析</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 ml-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-3">
        {kpiCards.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="pdd-card p-3">
            <div className="flex items-center gap-2 mb-1"><k.icon size={14} color={k.color} /><span className="text-xs text-pdd-text-secondary">{k.label}</span></div>
            <div className="text-lg font-bold" style={{ color: k.color }}>{k.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="pdd-card p-3">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-1">
            <span className="text-pdd-text-secondary">ROI:</span>
            {(['all', 'profit', 'loss', 'flat'] as RoiFilter[]).map(f => (
              <button key={f} onClick={() => setRoiFilter(f)}
                className={`px-2 py-1 rounded ${roiFilter === f ? 'bg-red-600 text-white' : 'bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text'}`}>
                {f === 'all' ? '全部' : f === 'profit' ? '盈利' : f === 'loss' ? '亏损' : '持平'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-pdd-text-secondary">最低订单:</span>
            <input type="number" value={minOrders} onChange={e => setMinOrders(parseInt(e.target.value) || 0)} className="w-14 px-2 py-1 rounded border border-pdd-border bg-pdd-bg" />
          </div>
          <div className="flex items-center gap-1 relative">
            <Search size={12} className="text-pdd-text-secondary absolute left-2" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索商品" className="w-32 pl-6 pr-2 py-1 rounded border border-pdd-border bg-pdd-bg focus:border-red-600 focus:outline-none" />
          </div>
          <div className="flex items-center gap-1 ml-auto">
            {(['table', 'card', 'chart'] as ViewMode[]).map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`p-1.5 rounded ${viewMode === v ? 'bg-red-600 text-white' : 'bg-pdd-bg text-pdd-text-secondary'}`}>
                {v === 'table' ? <Table size={12} /> : v === 'card' ? <LayoutGrid size={12} /> : <BarChart3 size={12} />}
              </button>
            ))}
            <button onClick={exportCSV} className="p-1.5 rounded bg-pdd-bg text-pdd-text-secondary hover:text-pdd-danger"><Download size={12} /></button>
          </div>
        </div>
        <p className="text-[10px] text-pdd-text-secondary mt-2">筛选后 {filteredProducts.length} / {productList.length} 个商品</p>
      </div>

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
            <motion.div key={p.productId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.01 }}
              className="pdd-card p-3 cursor-pointer" onClick={() => setSelectedProduct(p.productId)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 min-w-0">
                  <Link size={12} className="text-pdd-purple flex-shrink-0" />
                  <span className="text-xs font-bold truncate">{p.productName}</span>
                </div>
                <span className="text-xs font-bold" style={{ color: p.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-primary-light)' }}>ROI {p.roi.toFixed(2)}x</span>
              </div>
              <div className="grid grid-cols-3 gap-1 text-[10px]">
                <div><span className="text-pdd-text-secondary">GMV</span><br /><span className="font-mono">¥{fmt(p.gmv)}</span></div>
                <div><span className="text-pdd-text-secondary">实收</span><br /><span className="font-mono text-pdd-success">¥{fmt(p.revenue)}</span></div>
                <div><span className="text-pdd-text-secondary">净利</span><br /><span className="font-mono" style={{ color: p.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-primary-light)' }}>¥{fmt(p.netProfit)}</span></div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table View */}
      {viewMode === 'table' && (
        <div className="pdd-card overflow-hidden">
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead><tr className="bg-pdd-bg sticky top-0 z-10">
                {tableColumns.map(h => (
                  <th key={h.key} className="px-2 py-2 text-left font-medium text-pdd-text-secondary whitespace-nowrap cursor-pointer hover:text-pdd-danger" onClick={() => h.sortable && toggleSort(h.key)}>
                    {h.label}{h.sortable && <ArrowUpDown size={10} className="inline ml-1" />}
                  </th>
                ))}
              </tr></thead>
              <tbody>
                {filteredProducts.map(p => (
                  <tr key={p.productId} className="border-b border-pdd-border hover:bg-pdd-bg cursor-pointer" onClick={() => setSelectedProduct(p.productId)}>
                    <td className="px-2 py-2 font-medium truncate max-w-[120px]">
                      <div className="flex items-center gap-1">
                        <Link size={10} className="text-pdd-purple" />
                        <span className="truncate">{p.productName}</span>
                      </div>
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        {p.hasOrderData && <span className="inline-block w-1.5 h-1.5 rounded-full bg-pdd-success/100" title="订单" />}
                        {p.hasPromoData && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-600" title="推广" />}
                        <span className="text-[10px]">{p.hasOrderData && p.hasPromoData ? '全链路' : p.hasOrderData ? '订单' : '推广'}</span>
                      </div>
                    </td>
                    {tableColumns.filter(c => c.key !== 'name' && c.key !== 'source').map(c => (
                      <td key={c.key} className="px-2 py-2 whitespace-nowrap">{renderStatValue(p, c.key)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected Product Detail */}
      <AnimatePresence>
        {selectedDetail && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="pdd-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Eye size={14} color="var(--pdd-purple)" />
                {selectedDetail.productName}
                <span className="text-[10px] text-pdd-text-secondary font-mono">ID: {selectedProduct}</span>
              </h3>
              <button onClick={() => setSelectedProduct(null)} className="p-1 text-pdd-text-secondary hover:text-pdd-danger"><XCircle size={14} /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign size={12} color="var(--pdd-success)" /> 订单维度{!selectedDetail.hasOrderData && <span className="text-[10px] text-pdd-text-secondary">（无数据）</span>}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">GMV</span><p className="font-mono font-bold text-pdd-info">¥{fmt(selectedDetail.gmv)}</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">实收</span><p className="font-mono font-bold text-pdd-success">¥{fmt(selectedDetail.revenue)}</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">订单</span><p className="font-mono font-bold">{selectedDetail.orders}</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">退款率</span><p className="font-mono font-bold">{selectedDetail.refundRate.toFixed(1)}%</p></div>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><Target size={12} color="var(--pdd-purple)" /> 推广维度{!selectedDetail.hasPromoData && <span className="text-[10px] text-pdd-text-secondary">（无数据）</span>}</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">推广花费</span><p className="font-mono font-bold text-pdd-purple">¥{fmt(selectedDetail.promoCost)}</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">CTR</span><p className="font-mono font-bold">{selectedDetail.ctr.toFixed(2)}%</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">CVR</span><p className="font-mono font-bold">{selectedDetail.cvr.toFixed(2)}%</p></div>
                  <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">推广占比</span><p className="font-mono font-bold">{selectedDetail.promoCostRatio.toFixed(1)}%</p></div>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-pdd-border">
              <div className="grid grid-cols-4 gap-2 text-xs">
                <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">总成本</span><p className="font-mono font-bold text-pdd-danger">¥{fmt(selectedDetail.totalCost)}</p></div>
                <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">净利润</span><p className="font-mono font-bold" style={{ color: selectedDetail.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-primary-light)' }}>¥{fmt(selectedDetail.netProfit)}</p></div>
                <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">利润率</span><p className="font-mono font-bold">{selectedDetail.profitRate.toFixed(1)}%</p></div>
                <div className="bg-pdd-bg rounded p-2"><span className="text-pdd-text-secondary">ROI</span><p className="font-mono font-bold" style={{ color: selectedDetail.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-primary-light)' }}>{selectedDetail.roi.toFixed(2)}x</p></div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, TrendingUp, TrendingDown, DollarSign, ShoppingCart, BarChart3, ArrowUpDown, Download, Filter, LayoutGrid, Table, Eye, RefreshCw, Percent, Target, RotateCcw, Package, Search, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useData, useStore } from '../App';
import { ProductStat } from '../components/ProductLinkStats';
import { apiClient } from '../../api/client';
import ProductLinkChart from '../components/ProductLinkChart';
import TimeFilter, { TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups, filterPromoByTimeRange, useTimeFilter } from '../components/TimeFilter';

function fmt(n: number) { return n.toFixed(2); }
function fmtInt(n: number) { return n.toFixed(0); }

type ViewMode = 'card' | 'table' | 'chart';
type RoiFilter = 'all' | 'profit' | 'loss' | 'flat';

export default function ProductLinksPage() {
  const { currentDisplayData } = useData();
  const tf = useTimeFilter('all', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;

  // 构建时间过滤后的 displayData
  const filteredDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    const orders = currentDisplayData.orders || [];
    const allDates = getAllDateGroups(orders);
    const filteredOrders = filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange);
    return {
      ...currentDisplayData,
      orders: filteredOrders,
      afterSaleRecords: filterPromoByTimeRange(currentDisplayData.afterSaleRecords || [], allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange),
      promotionProducts: filterPromoByTimeRange(currentDisplayData.promotionProducts || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      promotionSummary: filterPromoByTimeRange(currentDisplayData.promotionSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      shippingInsurance: filterPromoByTimeRange(currentDisplayData.shippingInsurance || [], allDates, timeRange, ['日期'], customStart, customEnd, quickRange),
    };
  }, [currentDisplayData, timeRange, customStart, customEnd, quickRange]);

  // ★ 服务端计算商品统计（替代浏览器端 useProductStats）
  const { currentStore } = useStore();
  const [productStats, setProductStats] = useState<Record<string, ProductStat>>({});
  useEffect(() => {
    const sid = currentStore?.id;
    if (!sid) return;
    apiClient.get(`/analytics/products/stats?storeId=${encodeURIComponent(sid)}`)
      .then(res => { if (res.success && res.data) setProductStats(res.data); })
      .catch(() => {});
  }, [currentStore?.id]);

  // 简单汇总
  const totalStats = useMemo(() => {
    const all = Object.values(productStats);
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
      totalCost: all.reduce((s, p) => s + p.totalCost, 0),
      netProfit: all.reduce((s, p) => s + p.netProfit, 0),
      roi: all.length > 0 ? all.reduce((s, p) => s + p.roi, 0) / all.length : 0,
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
    return Object.entries(productStats).map(([pid, s]) => ({
      id: pid,
      ...s
    }));
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
    const headers = ['商品名称', '商品ID', 'GMV', '订单数', '销量', '客单价', '商家实收', '推广花费', '推广成交', '曝光量', '点击量', 'CTR', 'CVR', '折扣成本', '总成本', '退款金额', '退款率', '售后率', '折扣占比', '推广占比', '净利润', '利润率', 'ROI', '数据来源'];
    const rows = filteredProducts.map(p => {
      const source = p.hasOrderData && p.hasPromoData ? '订单+推广' : p.hasOrderData ? '订单' : p.hasPromoData ? '推广' : '无';
      return [p.productName, p.productId, p.gmv, p.orders, p.sales, p.avgOrderValue, p.revenue, p.promoCost, p.promoTransaction, p.promoImpressions, p.promoClicks, p.ctr, p.cvr, p.discount, p.totalCost, p.refund, p.refundRate, p.afterSaleRate, p.discountRatio, p.promoCostRatio, p.netProfit, p.profitRate, p.roi, source];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `product_correlation_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const kpiCards = [
    { label: '总GMV', value: `¥${fmtInt(totalStats.gmv)}`, icon: DollarSign, color: 'var(--pdd-primary)' },
    { label: '总实收', value: `¥${fmtInt(totalStats.revenue)}`, icon: TrendingUp, color: 'var(--pdd-success)' },
    { label: '推广花费', value: `¥${fmtInt(totalStats.promoCost)}`, icon: Target, color: 'var(--pdd-purple)' },
    { label: '总折扣', value: `¥${fmtInt(totalStats.discount)}`, icon: Percent, color: 'var(--pdd-warning)' },
    { label: '总成本', value: `¥${fmtInt(totalStats.totalCost)}`, icon: TrendingDown, color: 'var(--pdd-danger)' },
    { label: '净利润', value: `¥${fmtInt(totalStats.netProfit)}`, icon: DollarSign, color: totalStats.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
    { label: '平均ROI', value: `${totalStats.roi.toFixed(2)}x`, icon: BarChart3, color: totalStats.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
    { label: '退款率', value: `${totalStats.refundRate.toFixed(1)}%`, icon: RotateCcw, color: '#ff7875' },
  ];

  const tableColumns = [
    { key: 'name', label: '商品', sortable: false },
    { key: 'source', label: '数据来源', sortable: false },
    { key: 'roi', label: 'ROI', sortable: true },
    { key: 'gmv', label: 'GMV', sortable: true },
    { key: 'orders', label: '订单数', sortable: true },
    { key: 'sales', label: '销量', sortable: true },
    { key: 'avgOrderValue', label: '客单价', sortable: true },
    { key: 'revenue', label: '商家实收', sortable: true },
    { key: 'promoCost', label: '推广花费', sortable: true },
    { key: 'promoTransaction', label: '推广成交', sortable: true },
    { key: 'promoImpressions', label: '曝光量', sortable: true },
    { key: 'promoClicks', label: '点击量', sortable: true },
    { key: 'ctr', label: 'CTR', sortable: true },
    { key: 'cvr', label: 'CVR', sortable: true },
    { key: 'discount', label: '折扣成本', sortable: true },
    { key: 'totalCost', label: '总成本', sortable: true },
    { key: 'refund', label: '退款金额', sortable: true },
    { key: 'refundRate', label: '退款率', sortable: true },
    { key: 'afterSaleRate', label: '售后率', sortable: true },
    { key: 'netProfit', label: '净利润', sortable: true },
    { key: 'profitRate', label: '利润率', sortable: true },
  ];

  const renderStatValue = (s: ProductStat, key: string) => {
    const isRate = ['refundRate', 'afterSaleRate', 'discountRatio', 'promoCostRatio', 'profitRate', 'ctr', 'cvr'].includes(key);
    const isMoney = ['gmv', 'revenue', 'promoCost', 'promoTransaction', 'discount', 'totalCost', 'refund', 'netProfit', 'avgOrderValue'].includes(key);
    const isCount = ['orders', 'sales', 'promoImpressions', 'promoClicks'].includes(key);
    const val = s[key as keyof ProductStat] as number;
    if (key === 'roi') {
      return <span style={{ color: val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{val.toFixed(2)}x</span>;
    }
    if (isRate) {
      const color = key === 'profitRate' ? (val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)') : undefined;
      return <span style={{ color }}>{val.toFixed(1)}%</span>;
    }
    if (isMoney) {
      const color = key === 'netProfit' ? (val >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)') : key === 'revenue' || key === 'promoTransaction' ? 'var(--pdd-success)' : key === 'totalCost' || key === 'promoCost' ? 'var(--pdd-danger)' : undefined;
      return <span style={{ color }}>¥{fmt(val)}</span>;
    }
    if (isCount) {
      return <span>{fmtInt(val)}</span>;
    }
    return <span>{val}</span>;
  };

  const selectedDetail = selectedProduct ? productStats[selectedProduct] : null;

  const noData = productList.length === 0;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <TimeFilter state={tf} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <motion.h1 initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="text-2xl font-bold mb-1">商品关联分析</motion.h1>
          <p className="text-[var(--pdd-text-secondary)] text-sm">基于商品ID自动关联订单与推广数据 · {productList.length}个商品 · {filteredDisplayData?.orders?.length || 0}条订单</p>
        </div>
        <div className="flex items-center gap-2">
          {filteredProducts.length > 0 && (
            <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={exportCSV}
              className="flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--pdd-border)] text-sm text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-danger)] hover:border-[pdd-danger] transition-colors">
              <Download size={14} /> 导出CSV
            </motion.button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {kpiCards.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="pdd-card p-3">
            <div className="flex items-center gap-2 mb-1"><k.icon size={14} color={k.color} /><span className="text-xs text-[var(--pdd-text-secondary)]">{k.label}</span></div>
            <div className="text-lg font-bold" style={{ color: k.color }}>{noData ? '--' : k.value}</div>
          </motion.div>
        ))}
      </div>

      {noData && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card p-8 text-center">
          <Package size={48} className="mx-auto mb-3 text-[var(--pdd-text-secondary)]" />
          <p className="text-lg text-[var(--pdd-text-secondary)] mb-2">暂无商品数据</p>
          <p className="text-sm text-[var(--pdd-text-secondary)]">请先上传订单数据或推广数据，系统将自动按商品ID提取并关联</p>
        </motion.div>
      )}

      {!noData && (
        <>
          <div className="pdd-card p-4 mb-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Filter size={16} color="var(--pdd-warning)" /> 筛选与视图</h3>
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--pdd-text-secondary)]">ROI筛选:</span>
                {(['all', 'profit', 'loss', 'flat'] as RoiFilter[]).map(f => (
                  <button key={f} onClick={() => setRoiFilter(f)}
                    className={`px-2 py-1 rounded text-xs ${roiFilter === f ? 'bg-[var(--pdd-danger)] text-white' : 'bg-[var(--pdd-bg)] text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
                    {f === 'all' ? '全部' : f === 'profit' ? '盈利' : f === 'loss' ? '亏损' : '持平'}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--pdd-text-secondary)]">最低订单:</span>
                <input type="number" value={minOrders} onChange={e => setMinOrders(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 text-xs rounded border border-[var(--pdd-border)] bg-[var(--pdd-bg)]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--pdd-text-secondary)]">最低GMV:</span>
                <input type="number" value={minGmv} onChange={e => setMinGmv(parseInt(e.target.value) || 0)} className="w-16 px-2 py-1 text-xs rounded border border-[var(--pdd-border)] bg-[var(--pdd-bg)]" />
              </div>
              <div className="flex items-center gap-2 relative">
                <Search size={14} className="text-[var(--pdd-text-secondary)]" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="搜索商品名称/ID" className="w-40 px-2 py-1 text-xs rounded border border-[var(--pdd-border)] bg-[var(--pdd-bg)] focus:border-[pdd-danger] focus:outline-none" />
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-[var(--pdd-text-secondary)]">视图:</span>
                {(['table', 'card', 'chart'] as ViewMode[]).map(v => (
                  <button key={v} onClick={() => setViewMode(v)}
                    className={`p-1.5 rounded ${viewMode === v ? 'bg-[var(--pdd-danger)] text-white' : 'bg-[var(--pdd-bg)] text-[var(--pdd-text-secondary)]'}`}>
                    {v === 'table' ? <Table size={14} /> : v === 'card' ? <LayoutGrid size={14} /> : <BarChart3 size={14} />}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-[var(--pdd-text-secondary)]">筛选后 {filteredProducts.length} / {productList.length} 个商品</p>
          </div>

          {viewMode === 'chart' && (
            <ProductLinkChart linkStats={filteredProducts.map(p => ({
              name: p.productName, gmv: p.gmv, cost: p.totalCost, revenue: p.revenue, roi: p.roi, netProfit: p.netProfit
            }))} />
          )}

          {viewMode === 'card' && (
            <div className="grid grid-cols-2 gap-3 mb-4">
              {filteredProducts.map(p => (
                <motion.div key={p.productId} initial={{ opacity: 0 }} animate={{ opacity: 1 }} whileHover={{ scale: 1.01 }}
                  className="pdd-card p-4 cursor-pointer" onClick={() => setSelectedProduct(p.productId)}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Link size={14} className="text-[var(--pdd-purple)]" />
                      <span className="text-sm font-bold truncate">{p.productName}</span>
                      <span className="text-xs text-[var(--pdd-text-secondary)] font-mono">ID:{p.productId}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      {p.hasOrderData && <CheckCircle size={12} color="var(--pdd-success)" />}
                      {p.hasPromoData && <Target size={12} color="var(--pdd-purple)" />}
                      <span className="text-sm font-bold" style={{ color: p.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>ROI {p.roi.toFixed(2)}x</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div><span className="text-[var(--pdd-text-secondary)]">GMV</span><br /><span className="font-mono font-bold">¥{fmt(p.gmv)}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">实收</span><br /><span className="font-mono font-bold text-[var(--pdd-success)]">¥{fmt(p.revenue)}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">成本</span><br /><span className="font-mono font-bold text-pdd-danger">¥{fmt(p.totalCost)}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">订单</span><br /><span className="font-mono">{p.orders}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">销量</span><br /><span className="font-mono">{p.sales}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">客单价</span><br /><span className="font-mono">¥{fmt(p.avgOrderValue)}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">退款率</span><br /><span className="font-mono">{p.refundRate.toFixed(1)}%</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">净利润</span><br /><span className="font-mono font-bold" style={{ color: p.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{fmt(p.netProfit)}</span></div>
                    <div><span className="text-[var(--pdd-text-secondary)]">利润率</span><br /><span className="font-mono">{p.profitRate.toFixed(1)}%</span></div>
                    {p.hasPromoData && (
                      <>
                        <div><span className="text-[var(--pdd-text-secondary)]">推广花费</span><br /><span className="font-mono text-[var(--pdd-purple)]">¥{fmt(p.promoCost)}</span></div>
                        <div><span className="text-[var(--pdd-text-secondary)]">推广成交</span><br /><span className="font-mono text-[var(--pdd-success)]">¥{fmt(p.promoTransaction)}</span></div>
                        <div><span className="text-[var(--pdd-text-secondary)]">曝光量</span><br /><span className="font-mono">{fmtInt(p.promoImpressions)}</span></div>
                        <div><span className="text-[var(--pdd-text-secondary)]">点击量</span><br /><span className="font-mono">{fmtInt(p.promoClicks)}</span></div>
                        <div><span className="text-[var(--pdd-text-secondary)]">CTR</span><br /><span className="font-mono">{p.ctr.toFixed(2)}%</span></div>
                        <div><span className="text-[var(--pdd-text-secondary)]">CVR</span><br /><span className="font-mono">{p.cvr.toFixed(2)}%</span></div>
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {viewMode === 'table' && (
            <div className="pdd-card overflow-hidden max-h-[480px]">
              <div className="overflow-x-auto overflow-y-auto max-h-[480px]">
                <table className="w-full text-xs">
                  <thead><tr className="bg-[var(--pdd-bg)]">
                    {tableColumns.map(h => (
                      <th key={h.key} className="px-2 py-2 text-left font-medium text-[var(--pdd-text-secondary)] whitespace-nowrap cursor-pointer hover:text-[var(--pdd-danger)]" onClick={() => h.sortable && toggleSort(h.key)}>
                        {h.label}{h.sortable && <ArrowUpDown size={10} className="inline ml-1" />}
                      </th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredProducts.map(p => (
                      <tr key={p.productId} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)] cursor-pointer" onClick={() => setSelectedProduct(p.productId)}>
                        <td className="px-2 py-2 font-medium truncate max-w-[120px]">
                          <div className="flex items-center gap-1">
                            <Link size={12} className="text-[var(--pdd-purple)]" />
                            <span className="truncate">{p.productName}</span>
                          </div>
                          <span className="text-[10px] text-[var(--pdd-text-secondary)] font-mono">{p.productId}</span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            {p.hasOrderData && <span className="inline-block w-2 h-2 rounded-full bg-[var(--pdd-success)]" title="有订单数据" />}
                            {p.hasPromoData && <span className="inline-block w-2 h-2 rounded-full bg-[var(--pdd-purple)]" title="有推广数据" />}
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

          <AnimatePresence>
            {selectedDetail && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="pdd-card p-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Eye size={16} color="var(--pdd-purple)" />
                    商品详情 · {selectedDetail.productName}
                    <span className="text-xs text-[var(--pdd-text-secondary)] font-mono">ID: {selectedProduct}</span>
                  </h3>
                  <button onClick={() => setSelectedProduct(null)} className="p-1 text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-danger)]"><XCircle size={16} /></button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <ShoppingCart size={12} color="var(--pdd-success)" /> 订单维度
                      {!selectedDetail.hasOrderData && <span className="text-[10px] text-[var(--pdd-text-secondary)]">（无数据）</span>}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">GMV</span><p className="font-mono font-bold text-[var(--pdd-primary)]">¥{fmt(selectedDetail.gmv)}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">实收</span><p className="font-mono font-bold text-[var(--pdd-success)]">¥{fmt(selectedDetail.revenue)}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">订单数</span><p className="font-mono font-bold">{selectedDetail.orders}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">销量</span><p className="font-mono font-bold">{selectedDetail.sales}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">客单价</span><p className="font-mono font-bold">¥{fmt(selectedDetail.avgOrderValue)}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">退款率</span><p className="font-mono font-bold">{selectedDetail.refundRate.toFixed(1)}%</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">售后率</span><p className="font-mono font-bold">{selectedDetail.afterSaleRate.toFixed(1)}%</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">折扣</span><p className="font-mono font-bold text-[var(--pdd-warning)]">¥{fmt(selectedDetail.discount)}</p></div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                      <Target size={12} color="var(--pdd-purple)" /> 推广维度
                      {!selectedDetail.hasPromoData && <span className="text-[10px] text-[var(--pdd-text-secondary)]">（无数据）</span>}
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">推广花费</span><p className="font-mono font-bold text-[var(--pdd-purple)]">¥{fmt(selectedDetail.promoCost)}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">成交笔数</span><p className="font-mono font-bold">{selectedDetail.promoOrders}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">点击量</span><p className="font-mono font-bold">{selectedDetail.promoClicks}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">曝光量</span><p className="font-mono font-bold">{selectedDetail.promoImpressions}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">CTR</span><p className="font-mono font-bold">{selectedDetail.ctr.toFixed(2)}%</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">CVR</span><p className="font-mono font-bold">{selectedDetail.cvr.toFixed(2)}%</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">推广交易额</span><p className="font-mono font-bold">¥{fmt(selectedDetail.promoTransaction)}</p></div>
                      <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">推广占比</span><p className="font-mono font-bold">{selectedDetail.promoCostRatio.toFixed(1)}%</p></div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[var(--pdd-border)]">
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1"><DollarSign size={12} color="var(--pdd-danger)" /> 综合盈利</h4>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">总成本</span><p className="font-mono font-bold text-pdd-danger">¥{fmt(selectedDetail.totalCost)}</p></div>
                    <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">净利润</span><p className="font-mono font-bold" style={{ color: selectedDetail.netProfit >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>¥{fmt(selectedDetail.netProfit)}</p></div>
                    <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">利润率</span><p className="font-mono font-bold">{selectedDetail.profitRate.toFixed(1)}%</p></div>
                    <div className="bg-[var(--pdd-bg)] rounded-lg p-2"><span className="text-[var(--pdd-text-secondary)]">ROI</span><p className="font-mono font-bold" style={{ color: selectedDetail.roi >= 1 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>{selectedDetail.roi.toFixed(2)}x</p></div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
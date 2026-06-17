import React, { useMemo, useState } from 'react';
import { Box, AlertTriangle, Target, ArrowUp, ArrowDown, Minus, Search, BarChart3 } from 'lucide-react';
import { ProductStat } from '../../components/ProductLinkStats';
import { Card, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { SEMANTIC, CHART } from '../../ui/tokens/colors';


// ===== Types =====
export interface SkuMatrixProps {
  productStats: Record<string, ProductStat>;
  filteredOrders: any[];
  orderFinancialActuals: Record<string, any>;
  afterSaleRecords: any[];
  promotionProducts: any[];
  prevProductStats: Record<string, ProductStat>;
  noData: boolean;
}

interface SkuInsight {
  skuKey: string;
  productId: string;
  productName: string;
  skuId: string;
  skuName: string;
  sales: number;
  gmv: number;
  revenue: number;
  orders: number;
  refundCount: number;
  refundAmount: number;
  refundRate: number;
  profit: number;
  profitRate: number;
  promoCost: number;
  promoRoi: number;
  salesShare: number;          // SKU占该商品的销量比例
  profitShare: number;         // SKU占该商品的利润比例
  avgPrice: number;
  trend: 'up' | 'down' | 'flat';    // 销量趋势
  prevSales: number;
  salesChange: number;         // 环比变化率
  quadrant: 'star' | 'cashcow' | 'question' | 'dog';  // 四象限分类
  riskLevel: 'low' | 'medium' | 'high';
  action: string;              // 建议操作
  ordersList: string[];        // 关联订单号
  dailySales: { date: string; sales: number }[];
}

interface ProductSkuGroup {
  productId: string;
  productName: string;
  totalSales: number;
  totalProfit: number;
  totalGmv: number;
  totalOrders: number;
  totalRefundRate: number;
  skuCount: number;
  activeSkuCount: number;
  skus: SkuInsight[];
}


// ===== Quadrant labels =====
const QUADRANT_META: Record<string, { label: string; emoji: string; color: string; bg: string; desc: string; action: string }> = {
  star: { label: '明星SKU', emoji: '⭐', color: '#17B26A', bg: '#F0FDF4', desc: '高销量 + 高利润', action: '加大推广，保持优势' },
  cashcow: { label: '现金牛SKU', emoji: '💰', color: '#1F6BFF', bg: '#EFF6FF', desc: '高销量 + 低利润', action: '优化成本，适当提价' },
  question: { label: '问题SKU', emoji: '❓', color: '#FF9F1A', bg: '#FFF7ED', desc: '低销量 + 高利润', action: '增加曝光，测试转化' },
  dog: { label: '瘦狗SKU', emoji: '⚠️', color: '#F04438', bg: '#FEF2F2', desc: '低销量 + 低利润', action: '考虑淘汰，清仓处理' },
};

// ===== Helper: field value from order =====
const fv = (o: any, fields: string[]): string => {
  const keys = Object.keys(o);
  for (const f of fields) {
    const fClean = f.toLowerCase().replace(/[\s\-_()（）\[\]【】]/g, '');
    for (const k of keys) {
      const kClean = k.replace(/[﻿ \t\r\n\s\-_()（）\[\]【】]/g, '').toLowerCase();
      if (kClean === fClean || kClean.includes(fClean)) { const v = o[k]; if (v != null && v !== '') return String(v).trim(); }
    }
  }
  return '';
};
const fn = (o: any, fields: string[]): number => {
  for (const f of fields) {
    const v = fv(o, [f]); if (v) { const n = parseFloat(v.replace(/[^\d.\-]/g, '')); if (!isNaN(n)) return n; }
  }
  return 0;
};

// ===== Main Component =====
export default function SkuProfitabilityMatrix({ productStats, filteredOrders, orderFinancialActuals, afterSaleRecords, promotionProducts, prevProductStats, noData }: SkuMatrixProps) {
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [expandedSku, setExpandedSku] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('sales');
  const [sortDesc, setSortDesc] = useState(true);
  const [quadrantFilter, setQuadrantFilter] = useState<string>('all');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // ===== Compute SKU-level insights =====
  const skuInsights = useMemo((): SkuInsight[] => {
    if (!filteredOrders.length) return [];
    const skuMap: Record<string, any> = {};
    const productTotalSales: Record<string, number> = {};

    filteredOrders.forEach((o: any) => {
      const pid = fv(o, ['商品id', '商品ID', 'productId']);
      if (!pid) return;
      const skuId = fv(o, ['规格id', '规格ID', 'sku_id', 'style_id', '商品规格ID', 'spec_id']) || pid;
      const skuName = fv(o, ['规格名称', '商品规格', '规格', 'sku_name', 'spec_name']) || '-';
      const key = pid + '_' + skuId;
      const orderNo = fv(o, ['订单号', '订单编号']);

      if (!skuMap[key]) {
        skuMap[key] = { productId: pid, productName: fv(o, ['商品名称', '商品']), skuId, skuName, sales: 0, gmv: 0, revenue: 0, orders: 0, orderNos: [], refundCount: 0, refundAmount: 0, promoCost: 0, dailySalesMap: {}, prices: [] };
      }
      const s = skuMap[key];
      const qty = fn(o, ['商品数量(件)', '商品数量', '数量']) || 1;
      s.sales += qty;
      s.gmv += fn(o, ['商品总价(元)', '商品总价']) || fn(o, ['用户实付金额(元)', '用户实付']);
      s.revenue += fn(o, ['商家实收金额(元)', '商家实收', '实收金额']);
      s.orders += 1;
      if (orderNo) s.orderNos.push(orderNo);
      const price = fn(o, ['用户实付金额(元)', '用户实付']);
      if (price > 0) s.prices.push(price);
      const date = fv(o, ['支付时间']).split(' ')[0];
      if (date) s.dailySalesMap[date] = (s.dailySalesMap[date] || 0) + qty;
      productTotalSales[pid] = (productTotalSales[pid] || 0) + qty;
    });

    // Match refunds by order number
    if (afterSaleRecords?.length) {
      afterSaleRecords.forEach((rec: any) => {
        const oid = fv(rec, ['订单编号', '订单号']);
        if (!oid) return;
        Object.values(skuMap).forEach((s: any) => {
          if (s.orderNos.includes(oid)) {
            s.refundCount += 1;
            s.refundAmount += fn(rec, ['退款金额(元)', '金额']);
          }
        });
      });
    }

    // Match promotion costs by productId
    if (promotionProducts?.length) {
      promotionProducts.forEach((p: any) => {
        const pid = fv(p, ['商品ID', '商品id', '商品编号']);
        const cost = fn(p, ['成交花费', '广告花费', '花费(元)']);
        if (!pid || !cost) return;
        Object.values(skuMap).forEach((s: any) => {
          if (s.productId === pid) s.promoCost += cost;
        });
      });
    }

    // Build per-SKU insights
    const allSales = Object.values(skuMap).map((s: any) => s.sales).sort((a, b) => a - b);
    const medSales = allSales[Math.floor(allSales.length / 2)] || 0;

    const result = Object.values(skuMap).map((s: any) => {
      const avgPrice = s.orders > 0 ? s.revenue / s.orders : 0;
      const salesShare = (productTotalSales[s.productId] || s.sales) > 0 ? (s.sales / (productTotalSales[s.productId] || s.sales)) * 100 : 100;

      // Traceable profit from orderFinancialActuals
      let totalProfit = 0;
      let profitOrders = 0;
      s.orderNos.forEach((oid: string) => {
        const fa = orderFinancialActuals?.[oid];
        if (fa) {
          totalProfit += (fa.netRevenue || 0) - (fa.refundAmount || 0) - (fa.baseTechFee || 0) - (fa.subTechFee || 0) - (fa.penalties || 0) - (fa.experiencePlan || 0) - (fa.marketingFees || 0) - (fa.adTransfer || 0);
          profitOrders++;
        }
      });
      if (profitOrders === 0) totalProfit = s.revenue - s.refundAmount - (s.promoCost || 0);

      const profitRate = s.revenue > 0 ? (totalProfit / s.revenue) * 100 : 0;
      const refundRate = s.orders > 0 ? (s.refundCount / s.orders) * 100 : 0;
      const promoRoi = s.promoCost > 0 ? (s.gmv / s.promoCost) : 0;

      // Trend from previous period
      const prevStat = prevProductStats?.[s.productId];
      const prevSales = prevStat ? (prevStat.sales * (salesShare / 100)) : 0;
      const salesChange = prevSales > 0 ? ((s.sales - prevSales) / prevSales) * 100 : 0;
      const trend: 'up' | 'down' | 'flat' = salesChange > 10 ? 'up' : salesChange < -10 ? 'down' : 'flat';

      // Median profit rate for quadrant
      const sampledRates = Object.values(skuMap).map((x: any) => x.revenue > 0 ? ((x.revenue - x.refundAmount) / x.revenue) * 100 : 0).sort((a, b) => a - b);
      const medRate = sampledRates[Math.floor(sampledRates.length / 2)] || 0;

      const isHighSales = s.sales >= medSales;
      const isHighProfit = profitRate >= medRate;
      const quadrant: 'star' | 'cashcow' | 'question' | 'dog' = isHighSales && isHighProfit ? 'star' : isHighSales && !isHighProfit ? 'cashcow' : !isHighSales && isHighProfit ? 'question' : 'dog';

      const riskLevel: 'low' | 'medium' | 'high' = refundRate > 20 || profitRate < -10 ? 'high' : refundRate > 10 || profitRate < 5 ? 'medium' : 'low';

      let action = '';
      if (quadrant === 'star') action = '加大推广投入，维持流量优势';
      else if (quadrant === 'cashcow' && profitRate < 3) action = '利润过低，建议提价或降低推广费';
      else if (quadrant === 'cashcow') action = '稳定产出，优化供应链成本';
      else if (quadrant === 'question' && trend === 'up') action = '销量上升中，适当增加曝光';
      else if (quadrant === 'question') action = '测试不同流量渠道，提高转化';
      else if (quadrant === 'dog' && refundRate > 20) action = '高退货率低利润，建议下架';
      else if (quadrant === 'dog') action = '低效SKU，考虑清仓或淘汰';
      if (refundRate > 30) action = '退款率过高，优先排查质量问题';
      if (trend === 'down' && quadrant !== 'dog') action += '（销量下滑中）';

      return {
        skuKey: s.productId + '_' + s.skuId,
        productId: s.productId, productName: s.productName,
        skuId: s.skuId, skuName: s.skuName,
        sales: s.sales, gmv: s.gmv, revenue: s.revenue,
        orders: s.orders, refundCount: s.refundCount, refundAmount: s.refundAmount,
        refundRate, profit: totalProfit, profitRate,
        promoCost: s.promoCost, promoRoi,
        salesShare, profitShare: 0,
        avgPrice, trend, prevSales, salesChange,
        quadrant, riskLevel, action,
        ordersList: s.orderNos,
        dailySales: Object.entries(s.dailySalesMap).sort(([a], [b]) => a.localeCompare(b)).map(([date, sales]) => ({ date, sales: sales as number })),
      } as SkuInsight;
    });

    // Compute profit share per product group
    result.forEach(s => {
      const groupTotal = result.filter(x => x.productId === s.productId).reduce((acc, x) => acc + x.profit, 0);
      s.profitShare = groupTotal > 0 ? (s.profit / groupTotal) * 100 : 0;
    });

    return result.sort((a, b) => b.sales - a.sales);
  }, [filteredOrders, orderFinancialActuals, afterSaleRecords, promotionProducts, prevProductStats]);

  // ===== Group by product =====
  const productGroups = useMemo((): ProductSkuGroup[] => {
    const map: Record<string, SkuInsight[]> = {};
    skuInsights.forEach(s => {
      const key = s.productId;
      if (!map[key]) map[key] = [];
      map[key].push(s);
    });
    return Object.entries(map).map(([productId, skus]) => ({
      productId, productName: skus[0].productName,
      totalSales: skus.reduce((s, x) => s + x.sales, 0),
      totalProfit: skus.reduce((s, x) => s + x.profit, 0),
      totalGmv: skus.reduce((s, x) => s + x.gmv, 0),
      totalOrders: skus.reduce((s, x) => s + x.orders, 0),
      totalRefundRate: skus.reduce((s, x) => s + x.orders, 0) > 0 ? (skus.reduce((s, x) => s + x.refundCount, 0) / skus.reduce((s, x) => s + x.orders, 0)) * 100 : 0,
      skuCount: skus.length,
      activeSkuCount: skus.filter(x => x.sales > 0).length,
      skus,
    })).sort((a, b) => b.totalSales - a.totalSales);
  }, [skuInsights]);

  // ===== Apply filters =====
  const filteredGroups = useMemo(() => {
    let groups = productGroups;
    if (quadrantFilter !== 'all') {
      groups = groups.map(g => ({ ...g, skus: g.skus.filter(s => s.quadrant === quadrantFilter) })).filter(g => g.skus.length > 0);
    }
    if (riskFilter !== 'all') {
      groups = groups.map(g => ({ ...g, skus: g.skus.filter(s => s.riskLevel === riskFilter) })).filter(g => g.skus.length > 0);
    }
    if (searchTerm.trim()) {
      const kw = searchTerm.trim().toLowerCase();
      groups = groups.map(g => ({ ...g, skus: g.skus.filter(s => s.productName.toLowerCase().includes(kw) || s.skuName.toLowerCase().includes(kw) || s.skuId.toLowerCase().includes(kw)) })).filter(g => g.skus.length > 0);
    }
    return groups;
  }, [productGroups, quadrantFilter, riskFilter, searchTerm]);

  // ===== Sorted groups =====
  const sortedGroups = useMemo(() => {
    return filteredGroups.map(g => ({
      ...g,
      skus: [...g.skus].sort((a, b) => {
        const av = (a as any)[sortField] ?? 0;
        const bv = (b as any)[sortField] ?? 0;
        return sortDesc ? bv - av : av - bv;
      }),
    }));
  }, [filteredGroups, sortField, sortDesc]);

  // ===== KPI =====
  const kpis = useMemo(() => {
    const total = skuInsights.length;
    const active = skuInsights.filter(s => s.sales > 0).length;
    const avgProfitRate = skuInsights.filter(s => s.revenue > 0).reduce((s, x) => s + x.profitRate, 0) / Math.max(skuInsights.filter(s => s.revenue > 0).length, 1);
    const avgRefundRate = skuInsights.reduce((s, x) => s + x.refundRate, 0) / Math.max(total, 1);
    const lossCount = skuInsights.filter(s => s.profit < 0).length;
    const highRefund = skuInsights.filter(s => s.refundRate > 15).length;
    const starCount = skuInsights.filter(s => s.quadrant === 'star').length;
    const dogCount = skuInsights.filter(s => s.quadrant === 'dog').length;
    const upCount = skuInsights.filter(s => s.trend === 'up').length;
    const downCount = skuInsights.filter(s => s.trend === 'down').length;
    return { total, active, avgProfitRate, avgRefundRate, lossCount, highRefund, starCount, dogCount, upCount, downCount };
  }, [skuInsights]);

  // ===== Pareto =====
  const paretoData = useMemo(() => {
    const sorted = [...skuInsights].sort((a, b) => b.sales - a.sales);
    const totalSales = sorted.reduce((s, x) => s + x.sales, 0);
    let cumulative = 0;
    return sorted.slice(0, 15).map(s => {
      cumulative += s.sales;
      return { name: (s.skuName || s.productName).length > 8 ? (s.skuName || s.productName).slice(0, 8) + '…' : (s.skuName || s.productName), sales: s.sales, cumPct: totalSales > 0 ? (cumulative / totalSales) * 100 : 0, profit: s.profit };
    });
  }, [skuInsights]);

  const pareto80Idx = paretoData.findIndex(d => d.cumPct >= 80);
  const pareto80Count = pareto80Idx >= 0 ? pareto80Idx + 1 : paretoData.length;

  // ===== Quadrant stats =====
  const quadrantStats = useMemo(() => {
    return Object.entries(QUADRANT_META).map(([key, meta]) => {
      const skus = skuInsights.filter(s => s.quadrant === key);
      return { key, ...meta, count: skus.length, sales: skus.reduce((s, x) => s + x.sales, 0), profit: skus.reduce((s, x) => s + x.profit, 0) };
    });
  }, [skuInsights]);

  // ===== Helpers =====
  const sortClick = (field: string) => {
    if (sortField === field) setSortDesc(!sortDesc);
    else { setSortField(field); setSortDesc(true); }
  };
  const sortIcon = (field: string) => {
    if (sortField !== field) return null;
    return sortDesc ? <ArrowDown size={10} className="inline ml-0.5" /> : <ArrowUp size={10} className="inline ml-0.5" />;
  };

  if (noData || !filteredOrders.length) {
    return <Card className="p-8 text-center text-xs text-pdd-text-secondary"><Box size={32} className="mx-auto mb-2 opacity-30" />暂无SKU数据，请上传包含规格信息的订单数据</Card>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {[
          { label: 'SKU总数', value: kpis.total, color: CHART.all[0], bar: `linear-gradient(90deg, ${CHART.all[0]}, ${CHART.all[1]})` },
          { label: '动销SKU', value: kpis.active + '/' + kpis.total, sub: kpis.total > 0 ? (kpis.active / kpis.total * 100).toFixed(0) + '%' : '0%', color: CHART.all[1], bar: `linear-gradient(90deg, ${CHART.all[1]}, ${CHART.all[2]})` },
          { label: '平均利润率', value: kpis.avgProfitRate.toFixed(1) + '%', color: kpis.avgProfitRate >= 0 ? SEMANTIC.profit : SEMANTIC.loss, bar: kpis.avgProfitRate >= 0 ? `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` : `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
          { label: '平均退款率', value: kpis.avgRefundRate.toFixed(1) + '%', color: kpis.avgRefundRate <= 10 ? SEMANTIC.profit : SEMANTIC.loss, bar: kpis.avgRefundRate <= 10 ? `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` : `linear-gradient(90deg, ${SEMANTIC.warning}, ${SEMANTIC.loss})` },
          { label: '明星', value: kpis.starCount, color: '#eab308', bar: 'linear-gradient(90deg, #eab308, #f59e0b)' },
          { label: '瘦狗', value: kpis.dogCount, color: SEMANTIC.loss, bar: `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` },
          { label: '亏损', value: kpis.lossCount, color: kpis.lossCount > 0 ? SEMANTIC.loss : SEMANTIC.profit, bar: kpis.lossCount > 0 ? `linear-gradient(90deg, ${SEMANTIC.loss}, #F87171)` : `linear-gradient(90deg, ${SEMANTIC.profit}, #34D399)` },
          { label: '高退货', value: kpis.highRefund, color: kpis.highRefund > 0 ? SEMANTIC.warning : SEMANTIC.neutral, bar: kpis.highRefund > 0 ? `linear-gradient(90deg, ${SEMANTIC.warning}, #FBBF24)` : `linear-gradient(90deg, ${SEMANTIC.neutral}, #9CA3AF)` },
        ].map((k, i) => (
          <Card key={i} className="relative overflow-hidden group hover:shadow-lg transition-all duration-300 hover:-translate-y-0.5 bg-gradient-to-br from-white/60 to-white/30">
            <div className="absolute top-0 left-0 right-0 h-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" style={{ background: k.bar }} />
            <CardContent className="p-2.5 relative z-10">
              <p className="text-[9px] text-pdd-text-secondary/60">{k.label}</p>
              <p className="text-lg font-bold" style={{ color: k.color || SEMANTIC.neutral }}>{k.value}</p>
              {k.sub && <p className="text-[9px] text-pdd-text-secondary/60">{k.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quadrant Matrix */}
      <Card className="p-3 bg-gradient-to-br from-white/50 to-white/20 backdrop-blur-sm border-white/50">
        <CardContent className="p-0">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1"><Target size={13} style={{ color: CHART.all[0] }} />SKU四象限矩阵 <span className="text-[9px] font-normal text-pdd-text-secondary/50">按销量×利润率自动分类</span></h3>
          <div className="grid grid-cols-2 gap-2">
            {quadrantStats.map(q => (
              <div key={q.key} className="rounded-lg p-3 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5" style={{ backgroundColor: q.bg, border: '1px solid ' + q.color + '30' }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{ color: q.color }}>{q.emoji} {q.label}</span>
                  <span className="text-sm font-bold" style={{ color: q.color }}>{q.count}</span>
                </div>
                <p className="text-[9px] text-pdd-text-secondary/70 mb-1.5">{q.desc}</p>
                <div className="flex items-center gap-2 text-[9px] text-pdd-text-secondary/70">
                  <span>销量 {q.sales.toFixed(0)}</span>
                  <span>利润 {'¥' + q.profit.toFixed(0)}</span>
                </div>
                <p className="text-[9px] mt-1 italic" style={{ color: q.color }}>{q.action}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pareto */}
      {paretoData.length > 0 && (
        <Card className="p-3 bg-gradient-to-br from-white/50 to-white/20 backdrop-blur-sm border-white/50">
          <CardContent className="p-0">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1"><BarChart3 size={13} style={{ color: CHART.all[0] }} />帕累托贡献分析 <span className="text-[9px] font-normal text-pdd-text-secondary/50">TOP{pareto80Count}个SKU贡献80%销量</span></h3>
            <div className="space-y-1">
              {paretoData.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px] group hover:bg-white/30 rounded px-1 -mx-1 transition-colors">
                  <span className="w-20 truncate text-pdd-text-secondary/70 group-hover:text-pdd-text transition-colors">{d.name}</span>
                  <div className="flex-1 h-3 bg-white/50 rounded-full overflow-hidden shadow-inner">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: Math.min(d.cumPct, 100) + '%', background: i < pareto80Count ? `linear-gradient(90deg, ${CHART.all[0]}, ${CHART.all[1]})` : `linear-gradient(90deg, ${SEMANTIC.neutral}, #9CA3AF)` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-pdd-text tabular-nums">{d.cumPct.toFixed(0)}%</span>
                  <span className="w-12 text-right font-mono text-pdd-text-secondary/70 tabular-nums">{d.sales.toFixed(0)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-2.5 bg-white/40 backdrop-blur-sm border-white/50">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Search size={12} className="text-pdd-text-secondary/60" />
            <input type="text" placeholder="搜索SKU名称/ID…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="text-[10px] px-2 py-1 rounded border border-pdd-border bg-white/60 text-pdd-text outline-none w-36 placeholder:text-pdd-text-secondary/30" />
            <span className="text-[9px] text-pdd-text-secondary/40">|</span>
            <span className="text-[9px] text-pdd-text-secondary/70">象限</span>
            {[{key:'all',label:'全部'},{key:'star',label:'明星'},{key:'cashcow',label:'现金牛'},{key:'question',label:'问题'},{key:'dog',label:'瘦狗'}].map(q => (
              <button key={q.key} onClick={() => setQuadrantFilter(q.key)} className={"text-[10px] px-2 py-0.5 rounded transition-all duration-200 " + (quadrantFilter === q.key ? 'bg-pdd-primary text-white shadow-sm' : 'bg-white/60 text-pdd-text-secondary/70 hover:text-pdd-text hover:bg-white')}>{q.label}</button>
            ))}
            <span className="text-[9px] text-pdd-text-secondary/40">|</span>
            <span className="text-[9px] text-pdd-text-secondary/70">风险</span>
            {[{key:'all',label:'全部'},{key:'high',label:'高危'},{key:'medium',label:'关注'},{key:'low',label:'正常'}].map(r => (
              <button key={r.key} onClick={() => setRiskFilter(r.key)} className={"text-[10px] px-2 py-0.5 rounded transition-all duration-200 " + (riskFilter === r.key ? 'bg-pdd-primary text-white shadow-sm' : 'bg-white/60 text-pdd-text-secondary/70 hover:text-pdd-text hover:bg-white')}>{r.label}</button>
            ))}
            <span className="text-[9px] text-pdd-text-secondary/50 ml-auto">{skuInsights.length} SKU</span>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden border-white/50 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-pdd-text-secondary/70 border-b border-pdd-border bg-gradient-to-r from-blue-50/40 via-transparent to-purple-50/40">
                <th className="py-2 px-2 text-left w-5"></th>
                <th className="py-2 px-2 text-left">商品 / SKU</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('sales')}>销量{sortIcon('sales')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('gmv')}>GMV{sortIcon('gmv')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('profit')}>利润{sortIcon('profit')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('profitRate')}>利润率{sortIcon('profitRate')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('refundRate')}>退款率{sortIcon('refundRate')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('promoCost')}>推广费{sortIcon('promoCost')}</th>
                <th className="py-2 px-2 text-right cursor-pointer hover:text-pdd-text transition-colors" onClick={() => sortClick('promoRoi')}>ROI{sortIcon('promoRoi')}</th>
                <th className="py-2 px-2 text-center">趋势</th>
                <th className="py-2 px-2 text-left">分类</th>
                <th className="py-2 px-2 text-left">建议</th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map(group => (
                <React.Fragment key={group.productId}>
                  <tr onClick={() => setExpandedProduct(expandedProduct === group.productId ? null : group.productId)}
                    className="border-b border-pdd-border/50 hover:bg-pdd-bg cursor-pointer transition-colors bg-pdd-bg/30">
                    <td className="py-1.5 px-2 text-pdd-text-secondary">{expandedProduct === group.productId ? '▼' : '▶'}</td>
                    <td className="py-1.5 px-2 font-medium text-pdd-text text-[11px]" colSpan={2}>
                      {group.productName || group.productId}
                      <span className="text-[8px] text-pdd-text-secondary ml-1">({group.activeSkuCount}/{group.skuCount} SKU)</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{'¥' + group.totalGmv.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right font-mono" style={{ color: group.totalProfit >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>{'¥' + group.totalProfit.toFixed(0)}</td>
                    <td className="py-1.5 px-2 text-right font-mono text-pdd-text-secondary" colSpan={2}>{group.totalRefundRate.toFixed(1)}%</td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                    <td className="py-1.5 px-2"></td>
                  </tr>
                  {expandedProduct === group.productId && group.skus.map(sku => (
                    <React.Fragment key={sku.skuKey}>
                      <tr onClick={() => setExpandedSku(expandedSku === sku.skuKey ? null : sku.skuKey)}
                        className="border-b border-pdd-border/30 hover:bg-pdd-bg/50 cursor-pointer transition-colors">
                        <td className="py-1.5 px-2 text-pdd-text-secondary">{expandedSku === sku.skuKey ? '▼' : '▶'}</td>
                        <td className="py-1.5 px-2 text-pdd-text-secondary max-w-[120px] truncate">
                          {sku.skuName || sku.skuId}
                          <span className="text-[8px] text-pdd-text-secondary ml-1">({sku.salesShare.toFixed(0)}%)</span>
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{sku.sales.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{'¥' + sku.gmv.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: sku.profit >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>{'¥' + sku.profit.toFixed(0)}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: sku.profitRate >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>{sku.profitRate.toFixed(1)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: sku.refundRate <= 10 ? undefined : sku.refundRate <= 20 ? SEMANTIC.warning : SEMANTIC.loss }}>{sku.refundRate.toFixed(1)}%</td>
                        <td className="py-1.5 px-2 text-right font-mono text-pdd-text">{sku.promoCost > 0 ? '¥' + sku.promoCost.toFixed(0) : '-'}</td>
                        <td className="py-1.5 px-2 text-right font-mono" style={{ color: sku.promoRoi >= 2 ? SEMANTIC.profit : sku.promoRoi >= 1 ? SEMANTIC.warning : undefined }}>{sku.promoRoi > 0 ? sku.promoRoi.toFixed(1) : '-'}</td>
                        <td className="py-1.5 px-2 text-center">
                          {sku.trend === 'up' ? <ArrowUp size={11} className="inline" style={{ color: SEMANTIC.profit }} /> : sku.trend === 'down' ? <ArrowDown size={11} className="inline" style={{ color: SEMANTIC.loss }} /> : <Minus size={11} className="inline" style={{ color: SEMANTIC.neutral }} />}
                        </td>
                        <td className="py-1.5 px-2">
                          <span className="text-[9px]">{sku.quadrant === 'star' ? '⭐' : sku.quadrant === 'cashcow' ? '💰' : sku.quadrant === 'question' ? '❓' : '⚠️'}</span>
                          {sku.riskLevel === 'high' && <span className="text-[8px] ml-0.5" style={{ color: SEMANTIC.loss }}>高危</span>}
                        </td>
                        <td className="py-1.5 px-2 text-[8px] text-pdd-text-secondary max-w-[100px] truncate">{sku.action}</td>
                      </tr>
                      {expandedSku === sku.skuKey && (
                        <tr className="bg-pdd-bg/80">
                          <td colSpan={12} className="px-4 py-3">
                            <div className="grid grid-cols-4 gap-3">
                              <div className="relative overflow-hidden bg-gradient-to-br from-white/70 to-white/30 rounded p-2 border border-pdd-border/50 group hover:shadow-md transition-all duration-200">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-[8px] text-pdd-text-secondary">均价</p>
                                <p className="text-xs font-bold text-pdd-text">{'¥' + sku.avgPrice.toFixed(1)}</p>
                              </div>
                              <div className="relative overflow-hidden bg-gradient-to-br from-white/70 to-white/30 rounded p-2 border border-pdd-border/50 group hover:shadow-md transition-all duration-200">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-green-400 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-[8px] text-pdd-text-secondary">订单数</p>
                                <p className="text-xs font-bold text-pdd-text">{sku.orders}</p>
                              </div>
                              <div className="relative overflow-hidden bg-gradient-to-br from-white/70 to-white/30 rounded p-2 border border-pdd-border/50 group hover:shadow-md transition-all duration-200">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-400 to-red-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-[8px] text-pdd-text-secondary">退款金额</p>
                                <p className="text-xs font-bold" style={{ color: SEMANTIC.loss }}>{'¥' + sku.refundAmount.toFixed(0)}</p>
                              </div>
                              <div className="relative overflow-hidden bg-gradient-to-br from-white/70 to-white/30 rounded p-2 border border-pdd-border/50 group hover:shadow-md transition-all duration-200">
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                <p className="text-[8px] text-pdd-text-secondary">推广ROI</p>
                                <p className="text-xs font-bold" style={{ color: sku.promoRoi >= 2 ? SEMANTIC.profit : SEMANTIC.warning }}>{sku.promoRoi > 0 ? sku.promoRoi.toFixed(2) : '无推广'}</p>
                              </div>
                            </div>
                            {sku.ordersList.length > 0 && (
                              <details className="mt-2">
                                <summary className="text-[9px] text-pdd-text-secondary cursor-pointer hover:text-pdd-text">查看关联订单 ({sku.ordersList.length})</summary>
                                <div className="flex flex-wrap gap-1 mt-1 max-h-20 overflow-y-auto">
                                  {sku.ordersList.map((oid, oi) => (
                                    <span key={oi} className="text-[8px] px-1 py-0.5 rounded bg-pdd-card text-pdd-text-secondary border border-pdd-border/30">{oid}</span>
                                  ))}
                                </div>
                              </details>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </React.Fragment>
              ))}
              {sortedGroups.length === 0 && (
                <tr><td colSpan={12} className="py-6 text-center text-[10px] text-pdd-text-secondary">无匹配SKU，请调整筛选条件</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-3 py-2 border-t border-pdd-border/50 flex items-center justify-between text-[9px] text-pdd-text-secondary/60">
          <span>共 {skuInsights.length} SKU · {productGroups.length} 商品</span>
          <span>上升 {kpis.upCount} · 下降 {kpis.downCount}</span>
        </div>
      </Card>

      {/* Alerts */}
      {skuInsights.filter(s => s.riskLevel === 'high').length > 0 && (
        <Card className="p-3 overflow-hidden relative" style={{ borderColor: SEMANTIC.loss + '30', backgroundColor: 'rgba(239, 68, 68, 0.03)' }}>
          <div className="absolute top-0 left-0 w-1 h-full" style={{ background: `linear-gradient(180deg, ${SEMANTIC.loss}, #FCA5A5)` }} />
          <CardContent className="p-0 relative z-10">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1"><AlertTriangle size={13} style={{ color: SEMANTIC.loss }} />需要关注的SKU ({skuInsights.filter(s => s.riskLevel === 'high').length})</h3>
            <div className="space-y-1">
              {skuInsights.filter(s => s.riskLevel === 'high').slice(0, 10).map(s => (
                <div key={s.skuKey} className="flex items-center gap-2 text-[10px] bg-white/60 backdrop-blur-sm rounded px-2 py-1 hover:bg-white/80 transition-colors">
                  <span style={{ color: SEMANTIC.loss }}>⚠</span>
                  <span className="font-medium text-pdd-text max-w-[100px] truncate">{s.skuName || s.productName}</span>
                  <span className="text-pdd-text-secondary/70">{s.refundRate.toFixed(1)}%退款 · 利润率{s.profitRate.toFixed(1)}%</span>
                  <span className="ml-auto text-[9px]" style={{ color: SEMANTIC.loss }}>{s.action}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

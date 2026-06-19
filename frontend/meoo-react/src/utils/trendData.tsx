import { safeFloat, getWeekKey, getMonthKey, TimeGranularity } from '../components/TimeFilter';
import { findField } from './fieldAccess';

// KPI指标线定义 — 共享于 DashboardKpiPanel 和 TrendPage
// 全部42个指标，与 allKpiCards 一一对应
export const KPI_LINES = [
  // ── 收入（5） ──
  { key: 'gmv', label: 'GMV（商品总价）', type: 'value' as const, color: '#165DFF' },
  { key: 'merchantReceived', label: '商家实收', type: 'value' as const, color: '#00B42A' },
  { key: 'paid', label: '用户实付', type: 'value' as const, color: '#73D13D' },
  { key: 'organicGmv', label: '自然销售额', type: 'value' as const, color: '#00B42A' },
  { key: 'discount', label: '优惠总额', type: 'value' as const, color: '#FF7D00' },
  // ── 订单（8） ──
  { key: 'orderCount', label: '有效订单量', type: 'value' as const, color: '#722ED1' },
  { key: 'avgPrice', label: '客单价', type: 'value' as const, color: '#165DFF' },
  { key: 'buyerCount', label: '买家数', type: 'value' as const, color: '#722ED1' },
  { key: 'productCount', label: '商品数', type: 'value' as const, color: '#722ED1' },
  { key: 'organicOrders', label: '自然单', type: 'value' as const, color: '#00B42A' },
  { key: 'avgShipHours', label: '平均发货时长', type: 'value' as const, color: '#165DFF' },
  { key: 'shipRate', label: '发货率', type: 'percent' as const, color: '#36CFC9' },
  { key: 'skuQty', label: 'SKU数量', type: 'value' as const, color: '#FA8C16' },
  // ── 退款/售后（6） ──
  { key: 'refundAmount', label: '退款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'rfCount', label: '退款单数', type: 'value' as const, color: '#F53F3F' },
  { key: 'rfRate', label: '退款率', type: 'percent' as const, color: '#F53F3F' },
  { key: 'asRate', label: '售后率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'refundApprovalAmount', label: '退款金额(按同意退款时间)', type: 'value' as const, color: '#F53F3F' },
  { key: 'refundApprovalOrders', label: '退款单数(按同意退款时间)', type: 'value' as const, color: '#F53F3F' },
  // ── 利润（3） ──
  { key: 'profit', label: '利润金额', type: 'value' as const, color: '#00B42A' },
  { key: 'penaltyAmount', label: '罚款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'penaltyCount', label: '罚款次数', type: 'value' as const, color: '#F53F3F' },
  // ── 推广（8） ──
  { key: 'promoCost', label: '推广花费', type: 'value' as const, color: '#165DFF' },
  { key: 'promoGmv', label: '推广GMV', type: 'value' as const, color: '#722ED1' },
  { key: 'promoRoi', label: '推广ROI', type: 'value' as const, color: '#00B42A' },
  { key: 'promoOrders', label: '推广订单量', type: 'value' as const, color: '#165DFF' },
  { key: 'promoRatio', label: '推广占比', type: 'percent' as const, color: '#FA541C' },
  { key: 'shopRoi', label: '全店投产', type: 'value' as const, color: '#00B42A' },
  { key: 'totalImpressions', label: '曝光量', type: 'value' as const, color: '#722ED1' },
  { key: 'totalClicks', label: '点击量', type: 'value' as const, color: '#165DFF' },
  // ── 广告效果（8） ──
  { key: 'ctr', label: '点击率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'cvr', label: '转化率', type: 'percent' as const, color: '#00B42A' },
  { key: 'cpc', label: '平均点击成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'cpa', label: '平均获客成本', type: 'value' as const, color: '#722ED1' },
  { key: 'avgInquiryCost', label: '询单成本', type: 'value' as const, color: '#165DFF' },
  { key: 'avgFavoriteCost', label: '收藏成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'avgFollowCost', label: '关注成本', type: 'value' as const, color: '#722ED1' },
  // ── 费用（5） ──
  { key: 'refundedShippingCost', label: '退款成功快递发货成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'returnShippingCost', label: '退货退回成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'platformFee', label: '平台服务费', type: 'value' as const, color: '#F53F3F' },
  { key: 'postage', label: '快递成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'insurance', label: '运费险', type: 'value' as const, color: '#165DFF' },
];

// 共享的趋势图 Tooltip
export function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-pdd-card border border-pdd-border rounded-lg p-2.5 shadow-lg text-xs">
      <div className="font-medium text-pdd-text mb-1">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-pdd-text-secondary">
          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: entry.color }} />
          <span>{entry.name}:</span>
          <span className="font-medium text-pdd-text">
            {entry.value != null ? (typeof entry.value === 'number' ? (Number.isInteger(entry.value) ? entry.value.toLocaleString() : entry.value.toFixed(entry.name.includes('率') || entry.name.includes('ROI') ? 2 : 0)) : entry.value) : '--'}
          </span>
        </div>
      ))}
    </div>
  );
}

function getGranularityKey(dateStr: string, granularity: TimeGranularity): string {
  if (granularity === 'week') return getWeekKey(dateStr);
  if (granularity === 'month') return getMonthKey(dateStr);
  return dateStr;
}

export function formatGranularityLabel(key: string, granularity: TimeGranularity): string {
  if (granularity === 'month') return key;
  return key.slice(5); // day/week: "2026-05-25" → "05-25"; month: "2026-5月" → keep
}

/**
 * 按 granularity 聚合订单和推广数据为趋势图数据
 * 基于 DashboardPage 的 dailyKpiData 计算模式
 */
export function buildTrendData(
  orders: any[],
  promoSummary: any[],
  granularity: TimeGranularity,
  starStoreSummary?: any[],
  liveStreamSummary?: any[],
  /** 售后记录（用于按同意退款时间计算每日退款数据） */
  afterSaleRecords?: any[],
  /** 每日快递费配置 */
  shippingFeePerOrder?: number,
  /** 每日退货费配置 */
  returnShippingFeePerOrder?: number,
): Record<string, any>[] {
  if (!orders.length) return [];

  const byKey: Record<string, any> = {};

  orders.forEach(o => {
    const rawDate = String(findField(o, '支付时间') || '').split(' ')[0];
    if (!rawDate) return;
    const key = getGranularityKey(rawDate, granularity);
    if (!byKey[key]) {
      byKey[key] = {
        _key: key,
        _sortKey: rawDate,
        gmv: 0, orderCount: 0, paid: 0, postage: 0, refundAmount: 0, discount: 0,
        asCount: 0, rfCount: 0, shippedCount: 0,
        buyerSet: new Set<string>(), productSet: new Set<string>(),
        totalQty: 0, shipHourSum: 0,
        merchantReceived: 0, platformFee: 0, insuranceFromOrder: 0,
      };
    }
    const g = byKey[key];
    if (rawDate < g._sortKey) g._sortKey = rawDate;

    g.gmv += safeFloat(findField(o, '商品总价(元)', '商品总价'));
    g.orderCount += 1;
    g.paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
    g.postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费'));
    g.discount += safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'))
      + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))
      + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
    // ★ 订单表无"退款金额(元)"列，此处始终为0；refundAmount将在售后聚合后覆盖
    g.merchantReceived += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    g.platformFee += safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费'));
    g.insuranceFromOrder += safeFloat(findField(o, '运费险(元)', '运费险', '保险(元)', '保险'));
    const st = String(findField(o, '售后状态') || '').trim();
    if (st && st !== '无售后或售后取消' && st !== '无') g.asCount += 1;
    if (st.includes('退款')) g.rfCount += 1;
    const shipT = findField(o, '发货时间');
    if (shipT != null && String(shipT).trim() !== '') {
      g.shippedCount += 1;
      const payT = new Date(String(findField(o, '支付时间') || ''));
      const shipD = new Date(String(shipT));
      if (!isNaN(payT.getTime()) && !isNaN(shipD.getTime())) g.shipHourSum += (shipD.getTime() - payT.getTime()) / 3600000;
    }
    g.buyerSet.add(String(findField(o, '订单号') || '').trim());
    g.productSet.add(String(findField(o, '商品id', '商品ID') || '').trim());
    g.totalQty += safeFloat(findField(o, '商品数量(件)', '商品数量', '数量'));
  });

  // 合并推广数据（全部渠道）
  const promoByKey: Record<string, any> = {};
  function addPromo(records: any[], channel: 'product' | 'star' | 'live') {
    records.forEach(r => {
      const rawDate = String(findField(r, '日期', 'date') || '').trim().replace(/\//g, '-');
      if (!rawDate) return;
      const key = getGranularityKey(rawDate, granularity);
      if (!promoByKey[key]) promoByKey[key] = {
        promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0,
        inqCost: 0, inqCount: 0, favCost: 0, favCount: 0, folCost: 0, folCount: 0,
      };
      if (channel === 'product') {
        promoByKey[key].promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)', '成交花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数') || '0') || 0;
        promoByKey[key].inqCost += safeFloat(findField(r, '询单花费(元)'));
        promoByKey[key].inqCount += parseInt(findField(r, '询单量') || '0') || 0;
        promoByKey[key].favCost += safeFloat(findField(r, '收藏花费(元)'));
        promoByKey[key].favCount += parseInt(findField(r, '收藏量') || '0') || 0;
        promoByKey[key].folCost += safeFloat(findField(r, '关注花费(元)'));
        promoByKey[key].folCount += parseInt(findField(r, '关注量') || '0') || 0;
      } else if (channel === 'star') {
        promoByKey[key].promoCost += safeFloat(findField(r, '花费(元)', '总花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
        promoByKey[key].favCount += parseInt(findField(r, '收藏量') || '0') || 0;
        promoByKey[key].folCount += parseInt(findField(r, '店铺关注量', '关注量') || '0') || 0;
      } else {
        promoByKey[key].promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
        promoByKey[key].folCount += parseInt(findField(r, '关注量') || '0') || 0;
        promoByKey[key].favCount += parseInt(findField(r, '收藏量') || '0') || 0;
      }
    });
  }
  addPromo(promoSummary, 'product');
  if (starStoreSummary?.length) addPromo(starStoreSummary, 'star');
  if (liveStreamSummary?.length) addPromo(liveStreamSummary, 'live');

  // ── 按同意退款时间聚合售后数据 ──
  const asByKey: Record<string, any> = {};
  if (afterSaleRecords?.length) {
    afterSaleRecords.forEach(r => {
      const st = String(r['售后状态'] || '').trim();
      if (st !== '退款成功') return;
      const approvalDate = String(r['同意退款时间'] || r['退款成功时间'] || '').trim().split(' ')[0];
      if (!approvalDate) return;
      const key = getGranularityKey(approvalDate, granularity);
      if (!asByKey[key]) asByKey[key] = { refundApprovalAmount: 0, refundApprovalOrders: 0, refundedASCount: 0, physicalReturnCount: 0 };
      asByKey[key].refundApprovalAmount += safeFloat(findField(r, '退款金额(元)', '退款金额', '买家退款金额'));
      asByKey[key].refundApprovalOrders += 1;
      asByKey[key].refundedASCount += 1;
      const tracking = String(r['退货运单号'] || '').trim();
      if (tracking !== '') asByKey[key].physicalReturnCount += 1;
    });
  }

  return Object.values(byKey)
    .sort((a: any, b: any) => a._sortKey.localeCompare(b._sortKey))
    .map((d: any) => {
      const p = promoByKey[d._key] || { promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0, inqCost: 0, inqCount: 0, favCost: 0, favCount: 0, folCost: 0, folCount: 0 };
      const a = asByKey[d._key] || { refundApprovalAmount: 0, refundApprovalOrders: 0, refundedASCount: 0, physicalReturnCount: 0 };
      // ★ 修复BUG：趋势利润使用售后表退款金额（订单表无此列，始终为0）
      // 与后端口径一致：利润 = 商家实收 - 退款 - 推广费 - 邮费（不含百亿补贴，趋势无financial记录）
      const totalProfit = d.merchantReceived - a.refundApprovalAmount - p.promoCost - d.postage;
      return {
        date: formatGranularityLabel(d._key, granularity),
        _fullDate: d._sortKey,
        // ── 收入（5） ──
        gmv: d.gmv, merchantReceived: d.merchantReceived,
        paid: d.paid, organicGmv: Math.max(0, d.gmv - p.promoGmv),
        discount: d.discount,
        // ── 订单（8） ──
        orderCount: d.orderCount, avgPrice: d.orderCount > 0 ? d.paid / d.orderCount : 0,
        buyerCount: d.buyerSet.size, productCount: d.productSet.size,
        organicOrders: Math.max(0, d.orderCount - p.promoOrders),
        avgShipHours: d.shippedCount > 0 ? d.shipHourSum / d.shippedCount : 0,
        shipRate: d.orderCount > 0 ? (d.shippedCount / d.orderCount) * 100 : 0,
        skuQty: d.totalQty,
        // ── 退款/售后（6） ──
        // ★ 修复BUG：refundAmount使用售后表退款金额（订单表无此列）
        refundAmount: a.refundApprovalAmount, rfCount: d.rfCount,
        rfRate: d.orderCount > 0 ? (d.rfCount / d.orderCount) * 100 : 0,
        asRate: d.orderCount > 0 ? (d.asCount / d.orderCount) * 100 : 0,
        refundApprovalAmount: a.refundApprovalAmount,
        refundApprovalOrders: a.refundApprovalOrders,
        // ── 利润（3） ──
        profit: totalProfit,
        penaltyAmount: 0, penaltyCount: 0,
        // ── 推广（8） ──
        promoCost: p.promoCost, promoGmv: p.promoGmv,
        promoRoi: p.promoCost > 0 ? p.promoGmv / p.promoCost : 0,
        promoOrders: p.promoOrders,
        promoRatio: d.gmv > 0 ? (p.promoCost / d.gmv) * 100 : 0,
        shopRoi: p.promoCost > 0 ? d.gmv / p.promoCost : 0,
        totalImpressions: p.promoImpressions,
        totalClicks: p.promoClicks,
        // ── 广告效果（8） ──
        ctr: p.promoImpressions > 0 ? (p.promoClicks / p.promoImpressions) * 100 : 0,
        cvr: p.promoClicks > 0 ? (p.promoOrders / p.promoClicks) * 100 : 0,
        cpc: p.promoClicks > 0 ? p.promoCost / p.promoClicks : 0,
        cpa: p.promoOrders > 0 ? p.promoCost / p.promoOrders : 0,
        avgInquiryCost: p.inqCount > 0 ? p.inqCost / p.inqCount : 0,
        avgFavoriteCost: p.favCount > 0 ? p.favCost / p.favCount : 0,
        avgFollowCost: p.folCount > 0 ? p.folCost / p.folCount : 0,
        // ── 费用（5） ──
        refundedShippingCost: a.refundedASCount * (shippingFeePerOrder || 4),
        returnShippingCost: a.physicalReturnCount * (returnShippingFeePerOrder || 10),
        platformFee: d.platformFee,
        postage: d.postage,
        insurance: d.insuranceFromOrder || 0,
      };
    });
}

/**
 * 对比版趋势数据 — 不含推广数据（对比期推广数据通常不可用）
 */
export function buildCompareTrendData(
  orders: any[],
  granularity: TimeGranularity
): Record<string, any>[] {
  if (!orders.length) return [];

  const byKey: Record<string, any> = {};

  orders.forEach(o => {
    const rawDate = String(findField(o, '支付时间') || '').split(' ')[0];
    if (!rawDate) return;
    const key = getGranularityKey(rawDate, granularity);
    if (!byKey[key]) {
      byKey[key] = {
        _key: key,
        _sortKey: rawDate,
        gmv: 0, orderCount: 0, paid: 0, postage: 0, refundAmount: 0, discount: 0,
        asCount: 0, rfCount: 0, shippedCount: 0,
        buyerSet: new Set<string>(), productSet: new Set<string>(),
        totalQty: 0, shipHourSum: 0,
        merchantReceived: 0, platformFee: 0, insuranceFromOrder: 0,
      };
    }
    const g = byKey[key];
    if (rawDate < g._sortKey) g._sortKey = rawDate;
    g.gmv += safeFloat(findField(o, '商品总价(元)', '商品总价'));
    g.orderCount += 1;
    g.paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
    g.postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费'));
    g.discount += safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'))
      + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))
      + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
    g.refundAmount += safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)'));
    g.merchantReceived += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    g.platformFee += safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费'));
    g.insuranceFromOrder += safeFloat(findField(o, '运费险(元)', '运费险', '保险(元)', '保险'));
    const st = String(findField(o, '售后状态') || '').trim();
    if (st && st !== '无售后或售后取消' && st !== '无') g.asCount += 1;
    if (st.includes('退款')) g.rfCount += 1;
    const shipT = findField(o, '发货时间');
    if (shipT != null && String(shipT).trim() !== '') {
      g.shippedCount += 1;
      const payT = new Date(String(findField(o, '支付时间') || ''));
      const shipD = new Date(String(shipT));
      if (!isNaN(payT.getTime()) && !isNaN(shipD.getTime())) g.shipHourSum += (shipD.getTime() - payT.getTime()) / 3600000;
    }
    g.buyerSet.add(String(findField(o, '订单号') || '').trim()); // 完整订单号，不再slice(-4)
    g.productSet.add(String(findField(o, '商品id', '商品ID') || '').trim());
    g.totalQty += safeFloat(findField(o, '商品数量(件)', '商品数量', '数量'));
  });

  return Object.values(byKey)
    .sort((a: any, b: any) => a._sortKey.localeCompare(b._sortKey))
    .map((d: any) => {
      const totalProfit = d.merchantReceived - d.postage;
      return {
        date: formatGranularityLabel(d._key, granularity),
        _fullDate: d._sortKey,
        gmv: d.gmv, orderCount: d.orderCount,
        merchantReceived: d.merchantReceived,
        avgPrice: d.orderCount > 0 ? d.paid / d.orderCount : 0,
        paid: d.paid, postage: d.postage, refundAmount: d.refundAmount, discount: d.discount,
        asRate: d.orderCount > 0 ? (d.asCount / d.orderCount) * 100 : 0,
        rfRate: d.orderCount > 0 ? (d.rfCount / d.orderCount) * 100 : 0,
        shipRate: d.orderCount > 0 ? (d.shippedCount / d.orderCount) * 100 : 0,
        buyerCount: d.buyerSet.size, productCount: d.productSet.size,
        avgQty: d.orderCount > 0 ? d.totalQty / d.orderCount : 0,
        avgShipHours: d.shippedCount > 0 ? d.shipHourSum / d.shippedCount : 0,
        profit: totalProfit, profitRate: d.merchantReceived > 0 ? (totalProfit / d.merchantReceived) * 100 : 0,
        netProfitRate: d.merchantReceived > 0 ? (totalProfit / d.merchantReceived) * 100 : 0,
        platformFee: d.platformFee, insurance: d.insuranceFromOrder || 0,
        skuQty: d.totalQty, rfCount: d.rfCount,
        // 对比版无推广/售后审批/成本等数据
        organicGmv: 0, organicOrders: 0, promoRatio: 0, penaltyAmount: 0, penaltyCount: 0,
        refundApprovalAmount: 0, refundApprovalOrders: 0,
        refundedShippingCost: 0, returnShippingCost: 0,
        promoCost: 0, promoGmv: 0, promoRoi: 0, promoOrders: 0,
        ctr: 0, cvr: 0, cpc: 0, cpa: 0, shopRoi: 0,
        totalImpressions: 0, totalClicks: 0,
        avgInquiryCost: 0, avgFavoriteCost: 0, avgFollowCost: 0,
      };
    });
}

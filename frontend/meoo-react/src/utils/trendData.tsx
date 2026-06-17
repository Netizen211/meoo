import { safeFloat, getWeekKey, getMonthKey, TimeGranularity } from '../components/TimeFilter';
import { findField } from './fieldAccess';

// KPI指标线定义 — 共享于 DashboardKpiPanel 和 TrendPage
export const KPI_LINES = [
  // ── 收入 ──
  { key: 'gmv', label: '总GMV', type: 'value' as const, color: '#165DFF' },
  { key: 'merchantReceived', label: '总实收(商家实收)', type: 'value' as const, color: '#00B42A' },
  { key: 'paid', label: '用户实付', type: 'value' as const, color: '#73D13D' },
  { key: 'refundAmount', label: '退款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'discount', label: '优惠总额', type: 'value' as const, color: '#FF7D00' },
  { key: 'organicGmv', label: '自然销售额', type: 'value' as const, color: '#00B42A' },
  // ── 利润 ──
  { key: 'profit', label: '总利润', type: 'value' as const, color: '#00B42A' },
  { key: 'profitRate', label: '利润率', type: 'percent' as const, color: '#00B42A' },
  { key: 'netProfitRate', label: '净利润率', type: 'percent' as const, color: '#00B42A' },
  { key: 'promoRatio', label: '推广占比', type: 'percent' as const, color: '#FA541C' },
  { key: 'penaltyAmount', label: '罚款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'subsidyFee', label: '百亿补贴费', type: 'value' as const, color: '#FF7D00' },
  // ── 效率 ──
  { key: 'avgPrice', label: '客单价', type: 'value' as const, color: '#165DFF' },
  { key: 'orderCount', label: '有效订单量', type: 'value' as const, color: '#722ED1' },
  { key: 'productCount', label: '在售商品', type: 'value' as const, color: '#722ED1' },
  { key: 'sellThroughRate', label: '动销率', type: 'percent' as const, color: '#722ED1' },
  { key: 'asRate', label: '售后率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'rfRate', label: '退款率', type: 'percent' as const, color: '#F53F3F' },
  { key: 'buyerCount', label: '买家数', type: 'value' as const, color: '#722ED1' },
  { key: 'avgShipHours', label: '平均发货时长', type: 'value' as const, color: '#165DFF' },
  { key: 'organicOrders', label: '自然单', type: 'value' as const, color: '#00B42A' },
  { key: 'shipRate', label: '发货率', type: 'percent' as const, color: '#36CFC9' },
  { key: 'avgQty', label: '平均件数', type: 'value' as const, color: '#FA8C16' },
  // ── 推广 ──
  { key: 'promoCost', label: '推广花费', type: 'value' as const, color: '#165DFF' },
  { key: 'promoGmv', label: '推广GMV', type: 'value' as const, color: '#722ED1' },
  { key: 'promoRoi', label: '推广ROI', type: 'value' as const, color: '#00B42A' },
  { key: 'promoRefund', label: '推广退款', type: 'value' as const, color: '#F53F3F' },
  { key: 'realPromoOrders', label: '推广真实单量', type: 'value' as const, color: '#165DFF' },
  { key: 'promoRecharge', label: '推广充值', type: 'value' as const, color: '#FF7D00' },
  { key: 'ctr', label: '点击率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'cvr', label: '转化率', type: 'percent' as const, color: '#00B42A' },
  { key: 'cpc', label: '平均点击成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'cpa', label: '平均获客成本', type: 'value' as const, color: '#722ED1' },
  { key: 'shopRoi', label: '全店投产', type: 'value' as const, color: '#00B42A' },
  // ── 费用 ──
  { key: 'shippedCost', label: '发货商品成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'postage', label: '快递成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'insurance', label: '运费险', type: 'value' as const, color: '#165DFF' },
  { key: 'platformFee', label: '平台扣点', type: 'value' as const, color: '#F53F3F' },
  { key: 'vatEstimate', label: '增值税(估)', type: 'value' as const, color: '#722ED1' },
  { key: 'surchargeEstimate', label: '附加税(估)', type: 'value' as const, color: '#722ED1' },
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
  liveStreamSummary?: any[]
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
    // 用最早日期作为排序键（保持语义）
    if (rawDate < g._sortKey) g._sortKey = rawDate;

    g.gmv += safeFloat(findField(o, '商品总价(元)', '商品总价'));
    g.orderCount += 1;
    g.paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
    g.postage += safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费'));
    g.discount += safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'))
      + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))
      + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
    g.refundAmount += safeFloat(findField(o, '退款金额(元)', '退款金额', '退款(元)'));
    // ★ 新增：商家实收、平台扣点、运费险（从订单行提取）
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

  // 合并推广数据（全部渠道：商品推广 + 明星店铺 + 直播推广）
  const promoByKey: Record<string, any> = {};
  function addPromo(records: any[], channel: 'product' | 'star' | 'live') {
    records.forEach(r => {
      const rawDate = String(findField(r, '日期', 'date') || '').trim().replace(/\//g, '-');
      if (!rawDate) return;
      const key = getGranularityKey(rawDate, granularity);
      if (!promoByKey[key]) promoByKey[key] = { promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0 };
      if (channel === 'product') {
        promoByKey[key].promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)', '成交花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数') || '0') || 0;
      } else if (channel === 'star') {
        promoByKey[key].promoCost += safeFloat(findField(r, '花费(元)', '总花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
      } else {
        promoByKey[key].promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
        promoByKey[key].promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
        promoByKey[key].promoImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
        promoByKey[key].promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
        promoByKey[key].promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
      }
    });
  }
  addPromo(promoSummary, 'product');
  if (starStoreSummary?.length) addPromo(starStoreSummary, 'star');
  if (liveStreamSummary?.length) addPromo(liveStreamSummary, 'live');

  return Object.values(byKey)
    .sort((a: any, b: any) => a._sortKey.localeCompare(b._sortKey))
    .map((d: any) => {
      const promo = promoByKey[d._key] || { promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0 };
      const totalProfit = d.merchantReceived - d.refundAmount - d.platformFee;
      return {
        date: formatGranularityLabel(d._key, granularity),
        _fullDate: d._sortKey,
        // 收入
        gmv: d.gmv, merchantReceived: d.merchantReceived,
        paid: d.paid, refundAmount: d.refundAmount, discount: d.discount,
        organicGmv: Math.max(0, d.gmv - promo.promoGmv),
        // 利润
        profit: totalProfit,
        profitRate: d.merchantReceived > 0 ? (totalProfit / d.merchantReceived) * 100 : 0,
        netProfitRate: d.merchantReceived > 0 ? (totalProfit / d.merchantReceived) * 100 : 0,
        promoRatio: d.gmv > 0 ? (promo.promoCost / d.gmv) * 100 : 0,
        penaltyAmount: 0, subsidyFee: 0,
        // 效率
        avgPrice: d.orderCount > 0 ? d.paid / d.orderCount : 0,
        orderCount: d.orderCount, productCount: d.productSet.size,
        sellThroughRate: 0,
        asRate: d.orderCount > 0 ? (d.asCount / d.orderCount) * 100 : 0,
        rfRate: d.orderCount > 0 ? (d.rfCount / d.orderCount) * 100 : 0,
        buyerCount: d.buyerSet.size,
        avgShipHours: d.shippedCount > 0 ? d.shipHourSum / d.shippedCount : 0,
        organicOrders: Math.max(0, d.orderCount - promo.promoOrders),
        shipRate: d.orderCount > 0 ? (d.shippedCount / d.orderCount) * 100 : 0,
        avgQty: d.orderCount > 0 ? d.totalQty / d.orderCount : 0,
        // 推广
        promoCost: promo.promoCost, promoGmv: promo.promoGmv,
        promoRoi: promo.promoCost > 0 ? promo.promoGmv / promo.promoCost : 0,
        promoRefund: 0, realPromoOrders: 0, promoRecharge: 0,
        ctr: promo.promoImpressions > 0 ? (promo.promoClicks / promo.promoImpressions) * 100 : 0,
        cvr: promo.promoClicks > 0 ? (promo.promoOrders / promo.promoClicks) * 100 : 0,
        cpc: promo.promoClicks > 0 ? promo.promoCost / promo.promoClicks : 0,
        cpa: promo.promoOrders > 0 ? promo.promoCost / promo.promoOrders : 0,
        shopRoi: promo.promoCost > 0 ? d.gmv / promo.promoCost : 0,
        // 费用
        shippedCost: 0,
        postage: d.postage,
        insurance: d.insuranceFromOrder || 0,
        platformFee: d.platformFee,
        vatEstimate: d.merchantReceived > 0 ? d.merchantReceived / 1.01 * 0.01 : 0,
        surchargeEstimate: d.merchantReceived > 0 ? (d.merchantReceived / 1.01 * 0.01) * 0.12 : 0,
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
      const totalProfit = d.merchantReceived - d.refundAmount - d.platformFee;
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
        vatEstimate: d.merchantReceived > 0 ? d.merchantReceived / 1.01 * 0.01 : 0,
        surchargeEstimate: d.merchantReceived > 0 ? (d.merchantReceived / 1.01 * 0.01) * 0.12 : 0,
        // 对比版无推广数据
        organicGmv: 0, organicOrders: 0, promoRatio: 0, penaltyAmount: 0, subsidyFee: 0,
        sellThroughRate: 0, shippedCost: 0,
        promoCost: 0, promoGmv: 0, promoRoi: 0, promoRefund: 0, realPromoOrders: 0, promoRecharge: 0,
        ctr: 0, cvr: 0, cpc: 0, cpa: 0, shopRoi: 0,
      };
    });
}

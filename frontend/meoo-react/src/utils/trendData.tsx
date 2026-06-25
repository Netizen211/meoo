import { safeFloat, getWeekKey, getMonthKey, TimeGranularity } from '../components/TimeFilter';
import { findField } from './fieldAccess';

// ★★★ 完整KPI趋势线定义 ★★★
// 全部 ~80 条，与 trendData.tsx buildTrendData 输出字段一一对应
export const KPI_LINES = [
  // ── 收入（8） ──
  { key: 'gmv', label: 'GMV（商品总价）', type: 'value' as const, color: '#165DFF' },
  { key: 'merchantReceived', label: '商家实收', type: 'value' as const, color: '#00B42A' },
  { key: 'paid', label: '用户实付', type: 'value' as const, color: '#73D13D' },
  { key: 'organicGmv', label: '自然销售额', type: 'value' as const, color: '#00B42A' },
  { key: 'discount', label: '优惠总额', type: 'value' as const, color: '#FF7D00' },
  { key: 'netGmv', label: '净GMV(GMV-退款)', type: 'value' as const, color: '#165DFF' },
  { key: 'netRevenue', label: '净实收(实收-退款)', type: 'value' as const, color: '#00B42A' },
  { key: 'gmvPerOrder', label: '单均GMV', type: 'value' as const, color: '#722ED1' },
  // ── 订单（10） ──
  { key: 'orderCount', label: '有效订单量', type: 'value' as const, color: '#722ED1' },
  { key: 'avgPrice', label: '客单价', type: 'value' as const, color: '#165DFF' },
  { key: 'buyerCount', label: '买家数', type: 'value' as const, color: '#722ED1' },
  { key: 'productCount', label: '商品数', type: 'value' as const, color: '#722ED1' },
  { key: 'organicOrders', label: '自然单', type: 'value' as const, color: '#00B42A' },
  { key: 'avgShipHours', label: '平均发货时长', type: 'value' as const, color: '#165DFF' },
  { key: 'shipRate', label: '发货率', type: 'percent' as const, color: '#36CFC9' },
  { key: 'skuQty', label: 'SKU数量', type: 'value' as const, color: '#FA8C16' },
  { key: 'ordersPerBuyer', label: '人均订单数', type: 'value' as const, color: '#722ED1' },
  { key: 'itemsPerOrder', label: '每单件数', type: 'value' as const, color: '#FA8C16' },
  // ── 退款/售后（10） ──
  { key: 'refundAmount', label: '退款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'rfCount', label: '退款单数', type: 'value' as const, color: '#F53F3F' },
  { key: 'rfRate', label: '退款率', type: 'percent' as const, color: '#F53F3F' },
  { key: 'asRate', label: '售后率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'refundApprovalAmount', label: '退款金额(按同意退款时间)', type: 'value' as const, color: '#F53F3F' },
  { key: 'refundApprovalOrders', label: '退款单数(按同意退款时间)', type: 'value' as const, color: '#F53F3F' },
  { key: 'avgRefundAmount', label: '平均退款额', type: 'value' as const, color: '#F53F3F' },
  { key: 'refundErosionRate', label: '退款侵蚀率', type: 'percent' as const, color: '#F53F3F' },
  { key: 'refundApprovalRate', label: '同意退款率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'mrAfterRefund', label: '退款后实收', type: 'value' as const, color: '#00B42A' },
  // ── 利润（8） ──
  { key: 'profit', label: '利润金额', type: 'value' as const, color: '#00B42A' },
  { key: 'penaltyAmount', label: '罚款金额', type: 'value' as const, color: '#F53F3F' },
  { key: 'penaltyCount', label: '罚款次数', type: 'value' as const, color: '#F53F3F' },
  { key: 'netProfitRate', label: '净利润率', type: 'percent' as const, color: '#00B42A' },
  { key: 'profitPerOrder', label: '单均利润', type: 'value' as const, color: '#00B42A' },
  { key: 'grossProfit', label: '毛利润', type: 'value' as const, color: '#722ED1' },
  { key: 'grossProfitRate', label: '毛利率', type: 'percent' as const, color: '#722ED1' },
  { key: 'mrPerOrder', label: '单均实收', type: 'value' as const, color: '#00B42A' },
  // ── 推广（11） ──
  { key: 'promoCost', label: '推广花费', type: 'value' as const, color: '#165DFF' },
  { key: 'promoGmv', label: '推广GMV', type: 'value' as const, color: '#722ED1' },
  { key: 'promoRoi', label: '推广ROI', type: 'value' as const, color: '#00B42A' },
  { key: 'promoOrders', label: '推广订单量', type: 'value' as const, color: '#165DFF' },
  { key: 'promoRatio', label: '推广占比', type: 'percent' as const, color: '#FA541C' },
  { key: 'shopRoi', label: '全店投产', type: 'value' as const, color: '#00B42A' },
  { key: 'totalImpressions', label: '曝光量', type: 'value' as const, color: '#722ED1' },
  { key: 'totalClicks', label: '点击量', type: 'value' as const, color: '#165DFF' },
  { key: 'promoOrderRatio', label: '推广订单占比', type: 'percent' as const, color: '#722ED1' },
  { key: 'promoGmvRatio', label: '推广GMV占比', type: 'percent' as const, color: '#722ED1' },
  { key: 'promoCostPerOrder', label: '单均推广费', type: 'value' as const, color: '#F53F3F' },
  // ── 广告效果（10） ──
  { key: 'ctr', label: '点击率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'cvr', label: '转化率', type: 'percent' as const, color: '#00B42A' },
  { key: 'cpc', label: '平均点击成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'cpa', label: '平均订单花费', type: 'value' as const, color: '#722ED1' },
  { key: 'avgInquiryCost', label: '平均询单成本', type: 'value' as const, color: '#165DFF' },
  { key: 'avgFavoriteCost', label: '平均收藏成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'avgFollowCost', label: '平均关注成本', type: 'value' as const, color: '#722ED1' },
  { key: 'inquiryCost', label: '总询单成本', type: 'value' as const, color: '#165DFF' },
  { key: 'favoriteCost', label: '总收藏成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'followCost', label: '总关注成本', type: 'value' as const, color: '#722ED1' },
  { key: 'cpm', label: '千次曝光成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'promoCvr', label: '点击转化率', type: 'percent' as const, color: '#00B42A' },
  // ── 互动成本（4） ──
  { key: 'totalInteractionCost', label: '总互动成本', type: 'value' as const, color: '#EC4899' },
  { key: 'interactionCostRate', label: '互动成本率', type: 'percent' as const, color: '#EC4899' },
  { key: 'avgInteractionCost', label: '单次互动成本', type: 'value' as const, color: '#EC4899' },
  // ── 费用（8） ──
  { key: 'refundedShippingCost', label: '退款成功快递发货成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'returnShippingCost', label: '退货退回成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'platformFee', label: '平台服务费', type: 'value' as const, color: '#F53F3F' },
  { key: 'postage', label: '快递成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'insurance', label: '运费险', type: 'value' as const, color: '#165DFF' },
  { key: 'platformFeeRate', label: '平台费率', type: 'percent' as const, color: '#F53F3F' },
  { key: 'postageRate', label: '快递费率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'totalCostRate', label: '总成本率', type: 'percent' as const, color: '#F53F3F' },
  // ── 收入比率（5） ──
  { key: 'discRate', label: '折扣率', type: 'percent' as const, color: '#FF7D00' },
  { key: 'organicRatio', label: '自然占比', type: 'percent' as const, color: '#00B42A' },
  { key: 'merchantTakeRate', label: '实收/GMV比', type: 'percent' as const, color: '#722ED1' },
  { key: 'discPerOrder', label: '单均优惠', type: 'value' as const, color: '#FF7D00' },
  { key: 'promoCostRate', label: '推广费用率', type: 'percent' as const, color: '#165DFF' },
  { key: 'paidTakeRate', label: '实付/GMV比', type: 'percent' as const, color: '#73D13D' },
  { key: 'insuranceRate', label: '运费险率', type: 'percent' as const, color: '#165DFF' },
  { key: 'skuPerBuyer', label: '人均SKU数', type: 'value' as const, color: '#FA8C16' },
  { key: 'profitPerBuyer', label: '人均利润', type: 'value' as const, color: '#00B42A' },
  { key: 'spendingPerBuyer', label: '人均消费', type: 'value' as const, color: '#722ED1' },
  { key: 'profitPerSku', label: '单SKU利润', type: 'value' as const, color: '#FA8C16' },
  { key: 'promoCostPerProduct', label: '单品均推广费', type: 'value' as const, color: '#F53F3F' },
  { key: 'profitPerProduct', label: '单商品利润', type: 'value' as const, color: '#722ED1' },
  { key: 'revenuePerProduct', label: '单商品收入', type: 'value' as const, color: '#00B42A' },
  { key: 'ordersPerProduct', label: '单商品订单', type: 'value' as const, color: '#165DFF' },
  { key: 'opCostPerOrder', label: '单均运营成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'totalOpCost', label: '总运营成本', type: 'value' as const, color: '#F53F3F' },
  { key: 'promoToRevenue', label: '推广收入比', type: 'percent' as const, color: '#FA541C' },
  { key: 'gmvPerClick', label: '每点击GMV', type: 'value' as const, color: '#722ED1' },
  { key: 'revenuePerClick', label: '每点击收入', type: 'value' as const, color: '#00B42A' },
  { key: 'subsidyFee', label: '百亿补贴', type: 'value' as const, color: '#FF7D00' },
  { key: 'penaltyProfitRatio', label: '罚款占利润比', type: 'percent' as const, color: '#F53F3F' },
  { key: 'organicOrderRatio', label: '自然单占比', type: 'percent' as const, color: '#00B42A' },
  { key: 'adjustedProfit', label: '调整后利润(去罚款)', type: 'value' as const, color: '#722ED1' },
  { key: 'refundCostPerOrder', label: '退款单均成本', type: 'value' as const, color: '#FF7D00' },
  { key: 'totalRefundCost', label: '退款成本合计', type: 'value' as const, color: '#FF7D00' },
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
  /** 每日运费险配置 */
  insuranceFeePerOrder?: number,
  /** 财务记录（用于按日聚合罚款/百亿补贴） */
  financialRecords?: any[],
  /** 推广明细（商品x天，46列）— 含询单/收藏/关注等汇总表没有的字段 */
  promoDetailRecords?: any[],
): Record<string, any>[] {
  if (!orders.length) return [];

  // Build orderNo→refund info map from after-sale records
  // 只跟踪是否为退款订单 + 是否有退货运单（用于退款成本），金额用商家实收维度
  const refundMap = new Map();
  if (afterSaleRecords?.length) {
    afterSaleRecords.forEach(r => {
      const st = String(r['售后状态'] || '').trim();
      if (st !== '退款成功') return;
      const orderNo = String(r['订单编号'] || r['订单号'] || '').trim();
      if (!orderNo) return;
      const existing = refundMap.get(orderNo) || { isRefunded: false, hasPhysicalReturn: false };
      existing.isRefunded = true;
      const tracking = String(r['退货运单号'] || '').trim();
      if (tracking) existing.hasPhysicalReturn = true;
      refundMap.set(orderNo, existing);
    });
  }

    const byKey: Record<string, any> = {};

  orders.forEach(o => {
    const rawDate = String(findField(o, '支付时间') || '').split(' ')[0];
    if (!rawDate) return;
    // ★ 过滤测试/无效订单：商家实收金额必须 > 0（防止¥0.01测试数据污染指标）
    const mrCheck = safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    if (mrCheck <= 0) return;
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
        refundedASCount: 0, physicalReturnCount: 0,
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
    g.merchantReceived += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    g.platformFee += safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费'));
    g.insuranceFromOrder += safeFloat(findField(o, '运费险(元)', '运费险', '保险(元)', '保险'));
    // ★ 退款金额使用商家实收维度：找到退款订单号，取该订单的商家实收金额
    const orderNo = String(findField(o, '订单号') || '').trim();
    const refundInfo = refundMap.get(orderNo);
    if (refundInfo) {
      g.refundAmount += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
      g.rfCount += 1;
      g.refundedASCount += 1;
      if (refundInfo.hasPhysicalReturn) g.physicalReturnCount += 1;
    }
    const st = String(findField(o, '售后状态') || '').trim();
    if (st && st !== '无售后或售后取消' && st !== '无') g.asCount += 1;
    const shipT = findField(o, '发货时间');
    if (shipT != null && String(shipT).trim() !== '') {
      g.shippedCount += 1;
      const payT = new Date(String(findField(o, '支付时间') || ''));
      const shipD = new Date(String(shipT));
      if (!isNaN(payT.getTime()) && !isNaN(shipD.getTime())) g.shipHourSum += (shipD.getTime() - payT.getTime()) / 3600000;
    }
    g.buyerSet.add(String(findField(o, '订单号') || '').trim().slice(-4));
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
        // ★ 询单/收藏/关注从 promoDetailRecords 读取（46列明细表才有），不在这里读
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

  // ── 询单/收藏/关注从推广明细表读取（46列才有这些字段） ──
  // 优先使用 promoDetailRecords，fallback 到 promoSummary（兼容旧数据）
  const interactionSource = promoDetailRecords && promoDetailRecords.length > 0 ? promoDetailRecords : promoSummary;
  console.error('[Trend] interaction source:', interactionSource.length, 'records, isDetail:', (promoDetailRecords?.length || 0) > 0);
  if (interactionSource.length > 0) {
    interactionSource.forEach((r: any) => {
      const rawDate = String(findField(r, '日期', 'date') || '').trim().replace(/\//g, '-');
      if (!rawDate) return;
      const key = getGranularityKey(rawDate, granularity);
      if (!promoByKey[key]) promoByKey[key] = {
        promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0,
        inqCost: 0, inqCount: 0, favCost: 0, favCount: 0, folCost: 0, folCount: 0,
      };
      const inqField = findField(r, '询单花费(元)', '询单花费', '询单花费金额');
      const favField = findField(r, '收藏花费(元)', '收藏花费', '收藏花费金额');
      const folField = findField(r, '关注花费(元)', '关注花费', '关注花费金额');
      if (inqField || favField || folField) {
        console.error('[Trend] interaction data:', { key, inqField, favField, folField, rawDate });
      }
      promoByKey[key].inqCost += safeFloat(findField(r, '询单花费(元)', '询单花费', '询单花费金额'));
      promoByKey[key].inqCount += parseInt(findField(r, '询单量') || '0') || 0;
      promoByKey[key].favCost += safeFloat(findField(r, '收藏花费(元)', '收藏花费', '收藏花费金额'));
      promoByKey[key].favCount += parseInt(findField(r, '收藏量') || '0') || 0;
      promoByKey[key].folCost += safeFloat(findField(r, '关注花费(元)', '关注花费', '关注花费金额'));
      promoByKey[key].folCount += parseInt(findField(r, '关注量') || '0') || 0;
    });
  }

  // ── 按日聚合财务记录（罚款004 + 百亿补贴） ──
  const financialByKey: Record<string, { penaltyAmount: number; penaltyCount: number; subsidyFee: number }> = {};
  if (financialRecords?.length) {
    // ★ 从订单提取日期范围，过滤财务记录（防止日期外围数据污染）
    let finMinDate = '', finMaxDate = '';
    for (const o of orders) {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
      if (d && (!finMinDate || d < finMinDate)) finMinDate = d;
      if (d && (!finMaxDate || d > finMaxDate)) finMaxDate = d;
    }
    financialRecords.forEach((r: any) => {
      const rawDate = String(findField(r, '发生时间') || '').trim().split(' ')[0];
      if (!rawDate) return;
      if (finMinDate && rawDate < finMinDate) return;
      if (finMaxDate && rawDate > finMaxDate) return;
      const desc = String(findField(r, '业务描述', '描述') || '').trim();
      const remark = String(findField(r, '备注', '备注说明') || '').trim();
      const key = getGranularityKey(rawDate, granularity);
      if (!financialByKey[key]) financialByKey[key] = { penaltyAmount: 0, penaltyCount: 0, subsidyFee: 0 };
      const amount = Math.abs(safeFloat(findField(r, '支出金额（-元）', '支出金额(元)', '支出金额', '发生金额')));
      if (desc.startsWith('004')) {
        financialByKey[key].penaltyAmount += amount;
        financialByKey[key].penaltyCount += 1;
      }
      if (desc.includes('百亿补贴') || remark.includes('百亿补贴')) {
        financialByKey[key].subsidyFee += amount;
      }
    });
  }

  // ── 按同意退款时间聚合售后数据 ──
  const asByKey: Record<string, any> = {};
  if (afterSaleRecords?.length) {
    afterSaleRecords.forEach(r => {
      const st = String(r['售后状态'] || '').trim();
      if (st !== '退款成功') return;
      const approvalDate = String(r['同意退款时间'] || r['退款成功时间'] || '').trim().split(' ')[0];
      if (!approvalDate) return;
      const key = getGranularityKey(approvalDate, granularity);
      if (!asByKey[key]) asByKey[key] = { refundApprovalAmount: 0, refundApprovalOrders: 0 };
      asByKey[key].refundApprovalAmount += safeFloat(findField(r, '退款金额(元)', '退款金额', '买家退款金额'));
      asByKey[key].refundApprovalOrders += 1;
    });
  }

  return Object.values(byKey)
    .sort((a: any, b: any) => a._sortKey.localeCompare(b._sortKey))
    .map((d: any) => {
      const p = promoByKey[d._key] || { promoCost: 0, promoGmv: 0, promoImpressions: 0, promoClicks: 0, promoOrders: 0, inqCost: 0, inqCount: 0, favCost: 0, favCount: 0, folCost: 0, folCount: 0 };
      const a = asByKey[d._key] || { refundApprovalAmount: 0, refundApprovalOrders: 0 };
      const f = financialByKey[d._key] || { penaltyAmount: 0, penaltyCount: 0, subsidyFee: 0 };
      // ★ 趋势利润与 KPI 卡片利润口径完全一致
      // 利润 = 商家实收 - 退款(商家实收维度) - 推广费 - 运费险 - 罚款 - 邮费 - 百亿补贴
      const insuranceUsed = (insuranceFeePerOrder && insuranceFeePerOrder > 0) ? d.orderCount * insuranceFeePerOrder : (d.insuranceFromOrder || 0);
      const totalProfit = d.merchantReceived - d.refundAmount - p.promoCost - insuranceUsed - f.penaltyAmount - d.postage - f.subsidyFee;
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
        // ★ 商家实收维度退款金额
        refundAmount: d.refundAmount, rfCount: d.rfCount,
        rfRate: d.orderCount > 0 ? (d.rfCount / d.orderCount) * 100 : 0,
        asRate: d.orderCount > 0 ? (d.asCount / d.orderCount) * 100 : 0,
        refundApprovalAmount: a.refundApprovalAmount,
        refundApprovalOrders: a.refundApprovalOrders,
        // ── 利润（3） ──
        profit: totalProfit,
        penaltyAmount: f.penaltyAmount, penaltyCount: f.penaltyCount,
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
        inquiryCost: p.inqCost,
        favoriteCost: p.favCost,
        followCost: p.folCost,
        // ── 费用（5） ──
        refundedShippingCost: d.refundedASCount * (shippingFeePerOrder || 4),
        returnShippingCost: d.physicalReturnCount * (returnShippingFeePerOrder || 10),
        platformFee: d.platformFee,
        postage: (shippingFeePerOrder && shippingFeePerOrder > 0) ? d.orderCount * shippingFeePerOrder : d.postage,
        insurance: insuranceUsed,

        // ──★ 衍生指标 ─────────────────────────────────────
        gmvPerOrder: d.orderCount > 0 ? d.gmv / d.orderCount : 0,
        mrPerOrder: d.orderCount > 0 ? d.merchantReceived / d.orderCount : 0,
        discRate: d.gmv > 0 ? d.discount / d.gmv * 100 : 0,
        discPerOrder: d.orderCount > 0 ? d.discount / d.orderCount : 0,
        netGmv: Math.max(0, d.gmv - d.refundAmount),
        netRevenue: Math.max(0, d.merchantReceived - d.refundAmount),
        organicRatio: d.gmv > 0 ? Math.max(0, d.gmv - p.promoGmv) / d.gmv * 100 : 100,
        merchantTakeRate: d.gmv > 0 ? d.merchantReceived / d.gmv * 100 : 0,
        paidTakeRate: d.gmv > 0 ? d.paid / d.gmv * 100 : 0,
        ordersPerBuyer: d.buyerSet.size > 0 ? d.orderCount / d.buyerSet.size : 0,
        itemsPerOrder: d.orderCount > 0 ? d.totalQty / d.orderCount : 0,
        cpm: p.promoImpressions > 0 ? p.promoCost / p.promoImpressions * 1000 : 0,
        promoCostPerOrder: p.promoOrders > 0 ? p.promoCost / p.promoOrders : 0,
        promoCvr: p.promoClicks > 0 ? (p.promoOrders / p.promoClicks) * 100 : 0,
        promoOrderRatio: d.orderCount > 0 ? (p.promoOrders / d.orderCount) * 100 : 0,
        promoGmvRatio: d.gmv > 0 ? (p.promoGmv / d.gmv) * 100 : 0,
        profitRate: d.merchantReceived > 0 ? totalProfit / d.merchantReceived * 100 : 0,
        netProfitRate: d.merchantReceived > 0 ? totalProfit / d.merchantReceived * 100 : 0,
        profitPerOrder: d.orderCount > 0 ? totalProfit / d.orderCount : 0,
        grossProfit: d.merchantReceived - d.platformFee - d.postage - insuranceUsed,
        grossProfitRate: d.merchantReceived > 0 ? (d.merchantReceived - d.platformFee - d.postage - insuranceUsed) / d.merchantReceived * 100 : 0,
        mrAfterRefund: d.merchantReceived - d.refundAmount,
        refundErosionRate: d.merchantReceived > 0 ? d.refundAmount / d.merchantReceived * 100 : 0,
        avgRefundAmount: d.rfCount > 0 ? d.refundAmount / d.rfCount : 0,
        refundApprovalRate: d.orderCount > 0 ? a.refundApprovalOrders / d.orderCount * 100 : 0,
        postageRate: d.merchantReceived > 0 ? d.postage / d.merchantReceived * 100 : 0,
        platformFeeRate: d.merchantReceived > 0 ? d.platformFee / d.merchantReceived * 100 : 0,
        insuranceRate: d.merchantReceived > 0 ? insuranceUsed / d.merchantReceived * 100 : 0,
        promoCostRate: d.gmv > 0 ? p.promoCost / d.gmv * 100 : 0,
        totalCostRate: d.merchantReceived > 0 ? (d.platformFee + d.postage + insuranceUsed + p.promoCost) / d.merchantReceived * 100 : 0,
        totalInteractionCost: p.inqCost + p.favCost + p.folCost,
        interactionCostRate: p.promoCost > 0 ? (p.inqCost + p.favCost + p.folCost) / p.promoCost * 100 : 0,
        avgInteractionCost: (p.inqCount + p.favCount + p.folCount) > 0 ? (p.inqCost + p.favCost + p.folCost) / (p.inqCount + p.favCount + p.folCount) : 0,
        // ──★ 新增衍生指标 ──────────────────────────────────
        skuPerBuyer: d.buyerSet.size > 0 ? d.totalQty / d.buyerSet.size : 0,
        profitPerBuyer: d.buyerSet.size > 0 ? totalProfit / d.buyerSet.size : 0,
        spendingPerBuyer: d.buyerSet.size > 0 ? d.paid / d.buyerSet.size : 0,
        profitPerSku: d.totalQty > 0 ? totalProfit / d.totalQty : 0,
        promoCostPerProduct: d.productSet.size > 0 ? p.promoCost / d.productSet.size : 0,
        profitPerProduct: d.productSet.size > 0 ? totalProfit / d.productSet.size : 0,
        revenuePerProduct: d.productSet.size > 0 ? d.merchantReceived / d.productSet.size : 0,
        ordersPerProduct: d.productSet.size > 0 ? d.orderCount / d.productSet.size : 0,
        opCostPerOrder: d.orderCount > 0 ? (d.platformFee + d.postage + (insuranceFeePerOrder && insuranceFeePerOrder > 0 ? d.orderCount * insuranceFeePerOrder : d.insuranceFromOrder || 0) + p.promoCost) / d.orderCount : 0,
        totalOpCost: d.platformFee + d.postage + (insuranceFeePerOrder && insuranceFeePerOrder > 0 ? d.orderCount * insuranceFeePerOrder : d.insuranceFromOrder || 0) + p.promoCost,
        promoToRevenue: d.merchantReceived > 0 ? p.promoCost / d.merchantReceived * 100 : 0,
        gmvPerClick: p.promoClicks > 0 ? p.promoGmv / p.promoClicks : 0,
        revenuePerClick: p.promoClicks > 0 ? d.merchantReceived / p.promoClicks : 0,
        subsidyFee: f.subsidyFee,
        penaltyProfitRatio: totalProfit !== 0 ? f.penaltyAmount / Math.abs(totalProfit) * 100 : 0,
        organicOrderRatio: d.orderCount > 0 ? Math.max(0, d.orderCount - p.promoOrders) / d.orderCount * 100 : 0,
        adjustedProfit: totalProfit + f.penaltyAmount,
        refundCostPerOrder: d.rfCount > 0 ? (d.refundedASCount * (shippingFeePerOrder || 4) + d.physicalReturnCount * (returnShippingFeePerOrder || 10)) / d.rfCount : 0,
        totalRefundCost: d.refundedASCount * (shippingFeePerOrder || 4) + d.physicalReturnCount * (returnShippingFeePerOrder || 10),
      };
    });
}

/**
 * 对比版趋势数据 — 不含推广数据（对比期推广数据通常不可用）
 */
export function buildCompareTrendData(
  orders: any[],
  granularity: TimeGranularity,
  afterSaleRecords?: any[],
): Record<string, any>[] {
  if (!orders.length) return [];

  // ★ 构建退款订单号集合（金额使用商家实收维度）
  const refundedOrderNos = new Set<string>();
  if (afterSaleRecords?.length) {
    afterSaleRecords.forEach(r => {
      const st = String(r['售后状态'] || '').trim();
      if (st !== '退款成功') return;
      const orderNo = String(r['订单编号'] || r['订单号'] || '').trim();
      if (orderNo) refundedOrderNos.add(orderNo);
    });
  }

  const byKey: Record<string, any> = {};

  orders.forEach(o => {
    const rawDate = String(findField(o, '支付时间') || '').split(' ')[0];
    if (!rawDate) return;
    // ★ 过滤测试/无效订单：商家实收金额必须 > 0（防止¥0.01测试数据污染指标）
    const mrCheck = safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    if (mrCheck <= 0) return;
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
    // ★ 退款金额使用商家实收维度
    const orderNo = String(findField(o, '订单号') || '').trim();
    const isRefunded = refundedOrderNos.has(orderNo);
    if (isRefunded) {
      g.refundAmount += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
      g.rfCount += 1;
    }
    g.merchantReceived += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    g.platformFee += safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费'));
    g.insuranceFromOrder += safeFloat(findField(o, '运费险(元)', '运费险', '保险(元)', '保险'));
    const st = String(findField(o, '售后状态') || '').trim();
    if (st && st !== '无售后或售后取消' && st !== '无') g.asCount += 1;
    const shipT = findField(o, '发货时间');
    if (shipT != null && String(shipT).trim() !== '') {
      g.shippedCount += 1;
      const payT = new Date(String(findField(o, '支付时间') || ''));
      const shipD = new Date(String(shipT));
      if (!isNaN(payT.getTime()) && !isNaN(shipD.getTime())) g.shipHourSum += (shipD.getTime() - payT.getTime()) / 3600000;
    }
    g.buyerSet.add(String(findField(o, '订单号') || '').trim().slice(-4));
    g.productSet.add(String(findField(o, '商品id', '商品ID') || '').trim());
    g.totalQty += safeFloat(findField(o, '商品数量(件)', '商品数量', '数量'));
  });

  return Object.values(byKey)
    .sort((a: any, b: any) => a._sortKey.localeCompare(b._sortKey))
    .map((d: any) => {
      const totalProfit = d.merchantReceived - d.postage - (d.insuranceFromOrder || 0);
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
        platformFee: d.platformFee,
        // 对比版无配置信息，直接用原始数据
        insurance: d.insuranceFromOrder || 0,
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

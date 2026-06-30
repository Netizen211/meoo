// ─── 数据验证框架：每个指标独立计算，确保与原始数据一致 ───
// 使用方式：
//   1. 先过滤时间范围（filterByTimeRange）
//   2. 传入各模块计算
//   3. 每个模块可独立用 SQL 验证

export { computeOrderMetrics, type OrderMetrics } from './orderMetrics';
export { computeRefundMetrics, type RefundMetrics } from './refundMetrics';
export { computePromotionMetrics, type PromotionMetrics } from './promotionMetrics';
export { computeFinancialMetrics, type FinancialMetrics } from './financialMetrics';
export { computeInsuranceMetrics } from './insuranceMetrics';
export { computeProductCost } from './costMetrics';
export { computeProductProfit, computeAggregateProfit, type ProfitBreakdown } from './profitMetrics';

/**
 * 安全转数字：处理空值、逗号、字符串
 */
export function safeNum(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  if (typeof v === 'number') return isNaN(v) ? 0 : v;
  const s = String(v).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

/**
 * 安全转字符串
 */
export function safeStr(v: any): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/**
 * 统一输入接口（所有模块共用）
 */
export interface MetricsInput {
  orders: any[];
  afterSaleRecords: any[];
  promotionProducts: any[];
  promotionHourly?: any[];
  starStoreSummary?: any[];
  liveStreamSummary?: any[];
  shippingInsurance?: any[];
  financialRecords?: any[];
  productCosts?: Record<string, number>;
  configs?: Record<string, any>;
}

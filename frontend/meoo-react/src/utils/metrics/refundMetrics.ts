import { safeNum, safeStr } from "./index";

export interface RefundMetrics {
  refundCount: number;
  refundAmount: number;
  refundRate: number;
  afterSaleCount: number;
  afterSaleRate: number;
  refundApprovalAmount: number;
  refundApprovalOrders: number;
}

/**
 * 退款指标
 * ★ 数据来源：afterSaleRecords 表（订单表的退款金额字段始终为0）
 */
export function computeRefundMetrics(orders: any[], afterSaleRecords: any[]): RefundMetrics {
  var orderNoSet = new Set(orders.map(function(o){ return safeStr(o["订单号"]); }).filter(Boolean));
  var relevantAS = afterSaleRecords.filter(function(r){
    var on = safeStr(r["订单编号"] || r["订单号"]);
    return on && orderNoSet.has(on);
  });
  var refundSuccess = relevantAS.filter(function(r){ return safeStr(r["售后状态"]) === "退款成功"; });
  var refundOrderNos = new Set(refundSuccess.map(function(r){ return safeStr(r["订单编号"] || r["订单号"]); }).filter(Boolean));
  var refundAmount = 0;
  refundSuccess.forEach(function(r){ refundAmount += safeNum(r["退款金额(元)"] || r["买家退款金额"] || r["退款金额"]); });
  var afterSaleFiltered = relevantAS.filter(function(r){
    var st = safeStr(r["售后状态"]);
    return st === "退款成功" || st === "售后处理中" || st === "处理中";
  });
  var afterSaleOrderNos = new Set(afterSaleFiltered.map(function(r){ return safeStr(r["订单编号"] || r["订单号"]); }).filter(Boolean));
  var orderCount = orders.length;
  return {
    refundCount: refundOrderNos.size,
    refundAmount: refundAmount,
    refundRate: orderCount > 0 ? (refundOrderNos.size / orderCount) * 100 : 0,
    afterSaleCount: afterSaleOrderNos.size,
    afterSaleRate: orderCount > 0 ? (afterSaleOrderNos.size / orderCount) * 100 : 0,
    refundApprovalAmount: 0,
    refundApprovalOrders: 0,
  };
}

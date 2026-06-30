import { safeNum, safeStr } from "./index";

/**
 * 运费险费用
 * ★ 数据来源：shippingInsurance 表（每订单只取第一条记录防重复）
 */
export function computeInsuranceMetrics(insuranceRecords: any[], insuranceFeePerOrder?: number, orderCount?: number): number {
  if (insuranceFeePerOrder && insuranceFeePerOrder > 0 && orderCount) {
    return orderCount * insuranceFeePerOrder;
  }
  var seen = new Set<string>();
  var total = 0;
  insuranceRecords.forEach(function(r){
    var rNo = safeStr(r["订单编号"] || r["订单号"]);
    if (!rNo || seen.has(rNo)) return;
    seen.add(rNo);
    total += safeNum(r["服务费用（元）"] || r["服务费用(元)"] || r["保费"] || r["保费(元)"]);
  });
  return total;
}

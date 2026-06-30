import { safeNum, safeStr } from "./index";

export interface FinancialMetrics {
  platformFee: number;     // 平台技术服务费
  penaltyAmount: number;   // 罚款
  penaltyCount: number;    // 罚款笔数
  subsidyFee: number;      // 百亿补贴费用
}

/**
 * 财务相关指标
 * ★ 数据来源：financialRecords 表 + orders 表平台服务费字段
 */
export function computeFinancialMetrics(orders: any[], financialRecords: any[]): FinancialMetrics {
  // 平台服务费优先从订单表取
  var platformFee = orders.reduce(function(s,o){
    return s + (safeNum(o["平台技术服务费(元)"]) || safeNum(o["平台服务费(元)"]) || safeNum(o["技术服务费(元)"]) || 0);
  }, 0);
  // 如果订单表没有，从财务记录取003类
  if (platformFee === 0 && financialRecords.length > 0) {
    platformFee = financialRecords.reduce(function(s,r){
      var desc = safeStr(r["业务描述"]);
      if (desc.startsWith("003")) return s + Math.abs(safeNum(r["支出金额(-元)"] || r["支出金额(元)"] || r["发生金额"]));
      return s;
    }, 0);
  }
  // 兜底：商家实收 * 0.6%
  var totalRevenue = orders.reduce(function(s,o){ return s + safeNum(o["商家实收金额(元)"]); }, 0);
  if (platformFee === 0) platformFee = totalRevenue * 0.006;

  var penaltyAmount = 0, penaltyCount = 0, subsidyFee = 0;
  financialRecords.forEach(function(r){
    var desc = safeStr(r["业务描述"]);
    var remark = safeStr(r["备注"]);
    var expense = Math.abs(safeNum(r["支出金额(-元)"] || r["支出金额(元)"] || r["发生金额"]));
    if (desc.startsWith("004")) { penaltyAmount += expense; penaltyCount++; }
    if (desc.includes("百亿补贴") || remark.includes("百亿补贴")) subsidyFee += expense;
  });

  return { platformFee, penaltyAmount, penaltyCount, subsidyFee };
}

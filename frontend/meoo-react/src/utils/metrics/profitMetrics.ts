import { safeNum } from "./index";

export interface ProfitBreakdown {
  revenue: number;          // 商家实收
  refund: number;           // 退款金额
  productCost: number;      // 商品成本
  promoCost: number;        // 推广费
  packagingFee: number;     // 包装费
  shippingFee: number;      // 快递费
  insuranceFee: number;     // 运费险
  platformFee: number;      // 平台服务费
  netProfit: number;        // 净利润
  profitRate: number;       // 利润率
}

/**
 * 利润计算
 * ★ 公式：利润 = 收入 - 退款 - 产品成本 - 推广费 - 包装费 - 快递费 - 运费险 - 平台费
 * ★ 全链路验证通过后，后续可扩展：罚款、百亿补贴、税费等
 */
export function computeProductProfit(
  revenue: number,
  refund: number,
  productCost: number,
  promoCost: number,
  sales: number,
  configs?: Record<string, any>,
  platformFee?: number,
): ProfitBreakdown {
  var pfo = safeNum(configs?.["dianfx_packaging_fee"] || 3);
  var sfo = safeNum(configs?.["dianfx_shipping_fee"] || 5);
  var ifo = safeNum(configs?.["dianfx_insurance_fee"] || 2);
  var pf = pfo * sales;      // 包装费 = 每件包装费 * 销量
  var sf = sfo * sales;      // 快递费 = 每件快递费 * 销量
  var insf = ifo * sales;    // 运费险 = 每件运费险 * 销量
  var platFee = platformFee || 0;
  var netProfit = revenue - refund - productCost - promoCost - pf - sf - insf - platFee;
  var profitRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  return { revenue, refund, productCost, promoCost, packagingFee: pf, shippingFee: sf, insuranceFee: insf, platformFee: platFee, netProfit, profitRate };
}

/**
 * 总利润计算（含平台费分摊）
 */
export function computeAggregateProfit(
  orders: any[],
  refundAmount: number,
  totalPromoCost: number,
  productCostTotal: number,
  configs?: Record<string, any>,
  platformFee?: number,
): ProfitBreakdown {
  var revenue = orders.reduce(function(s,o){ return s + safeNum(o["商家实收金额(元)"]); }, 0);
  return computeProductProfit(revenue, refundAmount, productCostTotal, totalPromoCost, orders.length, configs, platformFee);
}

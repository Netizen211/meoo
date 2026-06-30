import { safeNum } from "./index";

/**
 * 商品成本（产品成本 + 包装 + 快递 + 运费险 + 平台费）
 * ★ 优先使用成本管理配置的实际成本，兜底用 GMV * 默认成本率
 */
export function computeProductCost(
  gmv: number,
  sales: number,
  productCosts: Record<string, number>,
  productId: string,
  skuSalesMap?: Record<string, number>,
  configs?: Record<string, any>,
): { productCost: number; source: string } {
  var pc = 0;
  var source = "missing";
  var dcr = safeNum(configs?.["dianfx_default_cost_ratio"] || 30);
  
  if (productCosts[productId] !== undefined && productCosts[productId] > 0) {
    pc = productCosts[productId] * sales;
    source = "real";
  } else {
    // SKU级成本
    var stc = 0, ms = 0;
    for (var k in productCosts) {
      if (k.startsWith(productId + "_") && productCosts[k] > 0) {
        var ss = (skuSalesMap || {})[k] || 0;
        stc += productCosts[k] * ss;
        ms += ss;
      }
    }
    if (stc > 0 && ms > 0) {
      if (ms < sales) stc += (stc / ms) * (sales - ms);
      pc = stc;
      source = "real";
    } else if (dcr > 0) {
      pc = gmv * (dcr / 100);
      source = "estimated";
    }
  }
  return { productCost: pc, source };
}

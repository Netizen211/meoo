// ── 核心算法引擎：「每单赚X元」逆向推算 ──
import type {
  PerOrderMetrics, ProductTargetSet, TargetColumnResult,
  LeverAdjustment, TargetEngineResult, ManualTargetOverrides,
} from '../types/productTarget';
import { DEFAULT_PDD_RULES, getRefundRateTarget, getColumnEditable } from './pddRules';
import type { PddRuleSet } from '../types/productTarget';

function fmtMoney(v: number): string {
  if (v >= 10000) return "¥" + (v / 10000).toFixed(1) + "万";
  if (v >= 100) return "¥" + v.toFixed(0);
  return "¥" + v.toFixed(v < 10 ? 2 : 1);
}
function fmtPct(v: number): string { return v.toFixed(1) + "%"; }
function fmtInt(v: number): string { return v.toFixed(0); }

function makeResult(value: number, current: number, direction: "up" | "down" | "none", editable: boolean, source: "auto" | "manual", fmtOverride?: string): TargetColumnResult {
  const change = value - current;
  const changePct = current > 0 ? (change / current) * 100 : 0;
  return {
    value,
    fmt: fmtOverride || (Math.abs(value) < 0.01 ? "--" : fmtMoney(value)),
    changeNeeded: change,
    changePct,
    direction,
    urgency: value > 0 ? "low" : "medium",
    source,
    editable,
  };
}

export function extractPerOrderMetrics(p: any): PerOrderMetrics {
  const orders = p.orders || 0;
  const sales = p.sales || 0;
  const revenue = p.revenue || 0;
  const costs = p.costs || 0;
  const promoCost = p.promoCost || 0;
  const cb = p.costBreakdown || {};
  const refundRate = p.refundRate || 0;
  const otherCostTotal =
    (cb.packagingFee || 0) + (cb.shippingFee || 0) + (cb.platformFee || 0) +
    (cb.taxes || 0) + (cb.customDeductions || 0);
  const effectiveOrders = Math.max(orders, 1);
  const effectiveSales = Math.max(sales, 1);
  return {
    revenuePerOrder: revenue / effectiveOrders,
    costPerOrder: costs / effectiveOrders,
    promoPerOrder: promoCost / effectiveOrders,
    otherCostPerOrder: otherCostTotal / effectiveOrders,
    refundRate,
    profitPerOrder: (revenue - costs - promoCost - otherCostTotal) / effectiveOrders,
    sellingPrice: p.avgPrice || revenue / effectiveSales,
    unitCost: costs / effectiveSales,
    orders, sales,
  };
}

function computeLeverAdjustments(metrics: PerOrderMetrics, rules: PddRuleSet): LeverAdjustment[] {
  const { promoPerOrder, refundRate, sellingPrice } = metrics;
  return [
    { level: 1, name: "包装费优化", key: "packagingFee", description: "更换包装材料，批量采购降低单件包装成本", maxAdjustPerOrder: 2, risk: { level: "low" as const, label: "零流量影响", description: "不影响转化" }, currentValue: 3, targetValue: 1, adjustedAmount: 0 },
    { level: 1, name: "运费优化", key: "shippingFee", description: "与快递公司议价，日均100单以上可谈到2~3元/单", maxAdjustPerOrder: 3, risk: { level: "low" as const, label: "零流量影响", description: "不影响转化" }, currentValue: 5, targetValue: 2, adjustedAmount: 0 },
    { level: 2, name: "退款率优化", key: "refundRate", description: "优化SKU描述+实拍图+尺寸表，降低退款率", maxAdjustPerOrder: 0, risk: { level: "low" as const, label: "低流量影响", description: "退款率降低有利于权重" }, currentValue: refundRate, targetValue: getRefundRateTarget(refundRate, rules), adjustedAmount: 0 },
    { level: 2, name: "售价微调", key: "priceTweak", description: "在PDD安全区内上调售价5%", maxAdjustPerOrder: sellingPrice * rules.price.safeUpLimit, risk: { level: "low" as const, label: "低风险", description: "上调≤5%安全区" }, currentValue: sellingPrice, targetValue: sellingPrice * (1 + rules.price.safeUpLimit), adjustedAmount: 0 },
    { level: 3, name: "推广费优化", key: "promo", description: "优化推广人群/时段/地域，减少浪费", maxAdjustPerOrder: promoPerOrder * 0.15, risk: { level: "medium" as const, label: "中等风险", description: "降低15%推广费可能减少曝光" }, currentValue: promoPerOrder, targetValue: promoPerOrder * 0.85, adjustedAmount: 0 },
    { level: 3, name: "售价中调", key: "priceMedium", description: "中等幅度上调", maxAdjustPerOrder: sellingPrice * (rules.price.mediumUpLimit - rules.price.safeUpLimit), risk: { level: "medium" as const, label: "中等风险", description: "上调5~10%需配合优惠券" }, currentValue: sellingPrice * (1 + rules.price.safeUpLimit), targetValue: sellingPrice * (1 + rules.price.mediumUpLimit), adjustedAmount: 0 },
    { level: 4, name: "推广费大幅优化", key: "promoHeavy", description: "大幅降低推广预算", maxAdjustPerOrder: promoPerOrder * 0.25, risk: { level: "high" as const, label: "高风险", description: "降低>20%推广费可能导致断流" }, currentValue: promoPerOrder * 0.85, targetValue: promoPerOrder * 0.75, adjustedAmount: 0 },
    { level: 4, name: "售价大幅上调", key: "priceHigh", description: "大幅上调售价", maxAdjustPerOrder: sellingPrice * (rules.price.highUpLimit - rules.price.mediumUpLimit), risk: { level: "high" as const, label: "极高风险", description: "上调>15%触发比价降权" }, currentValue: sellingPrice * (1 + rules.price.mediumUpLimit), targetValue: sellingPrice * (1 + rules.price.highUpLimit), adjustedAmount: 0 },
  ];
}

function calcRefundRateImpact(metrics: PerOrderMetrics, targetRefundRate: number): number {
  const cur = metrics.refundRate > 0 ? metrics.revenuePerOrder * (metrics.refundRate / 100) : 0;
  const tgt = metrics.revenuePerOrder * (targetRefundRate / 100);
  return cur - tgt;
}

function computeAdjustments(metrics: PerOrderMetrics, gap: number, rules: PddRuleSet):
  { adjustments: LeverAdjustment[]; totalAdjusted: number; riskRating: any; isAchievable: boolean; maxAchievableProfit: number } {
  const adjustments = computeLeverAdjustments(metrics, rules);
  let remaining = gap;
  let highestRisk = "low";
  for (const adj of adjustments) {
    if (remaining <= 0) { adj.adjustedAmount = 0; continue; }
    let amt = adj.key === "refundRate"
      ? Math.min(calcRefundRateImpact(metrics, adj.targetValue), remaining)
      : Math.min(adj.maxAdjustPerOrder, remaining);
    amt = Math.max(0, amt);
    adj.adjustedAmount = amt;
    remaining -= amt;
    if (adj.risk.level === "high") highestRisk = "high";
    else if (adj.risk.level === "medium" && highestRisk === "low") highestRisk = "medium";
  }
  const riskRating = highestRisk === "high"
    ? { level: "high" as const, label: "高风险", description: "需要大幅调整，可能显著影响流量" }
    : highestRisk === "medium"
    ? { level: "medium" as const, label: "中等风险", description: "部分调整可能影响流量，建议逐步执行" }
    : { level: "low" as const, label: "低风险", description: "通过低风险优化即可达成目标" };
  return { adjustments, totalAdjusted: gap - Math.max(0, remaining), riskRating, isAchievable: remaining <= 0.01, maxAchievableProfit: metrics.profitPerOrder + gap - Math.max(0, remaining) };
}

export function computeTargetsByProfit(
  p: any, profitPerOrder: number, rules: PddRuleSet = DEFAULT_PDD_RULES,
  manualOverrides?: Partial<ManualTargetOverrides>
): TargetEngineResult {
  const metrics = extractPerOrderMetrics(p);
  const gap = profitPerOrder - metrics.profitPerOrder;
  const { adjustments, riskRating, isAchievable, maxAchievableProfit } = computeAdjustments(metrics, gap, rules);

  let accPrice = 0, accPromo = 0, accCost = 0;
  for (const a of adjustments) {
    if (a.key.startsWith("price")) accPrice += a.adjustedAmount;
    else if (a.key.startsWith("promo")) accPromo += a.adjustedAmount;
    else if (a.key === "packagingFee" || a.key === "shippingFee") accCost += a.adjustedAmount;
  }
  function ov(key: string, auto: number): number {
    const mo = manualOverrides as any;
    return (mo && key in mo && mo[key] > 0) ? mo[key] : auto;
  }
  function isMan(key: string): "auto" | "manual" {
    const mo = manualOverrides as any;
    return (mo && key in mo && mo[key] > 0) ? "manual" : "auto";
  }

  const { sellingPrice: sp, unitCost: uc, orders: ord, revenuePerOrder: rpm, costPerOrder: cpm, promoPerOrder: ppm, otherCostPerOrder: opm, profitPerOrder: curProfit, refundRate: rr } = metrics;

  const skuPriceT = ov("skuPrice", sp > 0 ? Math.ceil((sp + accPrice) * 100) / 100 : 0);
  const skuCostT = ov("skuCost", uc);
  const revenueT = ov("revenue", Math.ceil((rpm + accPrice) * ord));
  const ordersT = ov("orders", ord);
  const totalCostT = ov("totalCost", cpm * ord);
  const promoPerOrderT = Math.max(0, ppm - accPromo);
  const promoT = ov("promo", promoPerOrderT * ord);
  const promoAvgT = ov("promoAvg", ord > 0 ? promoT / ord : 0);
  const roT = ov("roi", promoT > 0 ? revenueT / promoT : 0);
  const refundT = ov("refundRate", getRefundRateTarget(rr));
  const otherT = ov("otherCost", Math.max(0, opm * ord - accCost * ord));
  const skuProfitT = ov("skuProfit", skuPriceT - skuCostT);
  const profitRateT = ov("profitRate", skuPriceT > 0 ? ((skuPriceT - skuCostT) / skuPriceT) * 100 : 0);
  const profitT = ov("profit", ord > 0 ? profitPerOrder * ord : 0);
  const curMarginRate = sp > 0 ? ((sp - uc) / sp) * 100 : 0;

  const targetSet: ProductTargetSet = {
    revenue: makeResult(revenueT, rpm * ord, revenueT >= rpm * ord ? "up" : "down", getColumnEditable("revenue"), isMan("revenue"), revenueT >= 10000 ? "¥" + (revenueT / 10000).toFixed(1) + "万" : "¥" + revenueT.toFixed(0)),
    orders: makeResult(ordersT, ord, ordersT >= ord ? "up" : "down", getColumnEditable("orders"), isMan("orders"), fmtInt(ordersT)),
    totalCost: makeResult(totalCostT, cpm * ord, totalCostT <= cpm * ord ? "down" : "up", getColumnEditable("totalCost"), isMan("totalCost")),
    promo: makeResult(promoT, ppm * ord, promoT <= ppm * ord ? "down" : "up", getColumnEditable("promo"), isMan("promo")),
    roi: makeResult(roT, p.roi || 0, roT > (p.roi || 0) ? "up" : "down", getColumnEditable("roi"), isMan("roi"), roT > 0 ? roT.toFixed(1) : "--"),
    refundRate: makeResult(refundT, rr, refundT <= rr ? "down" : "up", getColumnEditable("refundRate"), isMan("refundRate"), fmtPct(refundT)),
    otherCost: makeResult(otherT, opm * ord, otherT <= opm * ord ? "down" : "up", getColumnEditable("otherCost"), isMan("otherCost"), otherT > 0 ? "¥" + otherT.toFixed(0) : "--"),
    profit: makeResult(profitT, curProfit * ord, profitT >= curProfit * ord ? "up" : "down", getColumnEditable("profit"), isMan("profit"), profitT >= 10000 ? "¥" + (profitT / 10000).toFixed(1) + "万" : "¥" + profitT.toFixed(0)),
    skuPrice: makeResult(skuPriceT, sp, skuPriceT > sp ? "up" : skuPriceT < sp ? "down" : "none", getColumnEditable("skuPrice"), isMan("skuPrice")),
    skuCount: { value: 0, fmt: "--", changeNeeded: 0, changePct: 0, direction: "none", urgency: "low", source: "auto", editable: false },
    skuCost: makeResult(skuCostT, uc, skuCostT < uc ? "down" : skuCostT > uc ? "up" : "none", getColumnEditable("skuCost"), isMan("skuCost")),
    promoAvg: makeResult(promoAvgT, ppm, promoAvgT <= ppm ? "down" : "up", getColumnEditable("promoAvg"), isMan("promoAvg")),
    profitRate: makeResult(profitRateT, curMarginRate, profitRateT >= curMarginRate ? "up" : "down", getColumnEditable("profitRate"), isMan("profitRate"), fmtPct(profitRateT)),
    skuProfit: makeResult(skuProfitT, sp - uc, skuProfitT >= (sp - uc) ? "up" : "down", getColumnEditable("skuProfit"), isMan("skuProfit")),
  };

  return { perOrderMetrics: metrics, gap, adjustments: adjustments.filter(a => a.adjustedAmount > 0.01 || a.level <= 2), targetSet, riskRating, isAchievable, maxAchievableProfit };
}

export interface FlatTargetEntry { value: number; fmt: string; }

export function flattenTargetSet(result: TargetEngineResult, rowMode: "单品" | "总额"): Record<string, FlatTargetEntry> {
  const ts = result.targetSet;
  const keys = rowMode === "单品"
    ? ["skuPrice", "skuCount", "skuCost", "promoAvg", "roi", "refundRate", "profitRate", "skuProfit"]
    : ["revenue", "orders", "totalCost", "promo", "roi", "refundRate", "otherCost", "profit"];
  const out: Record<string, FlatTargetEntry> = {};
  for (const k of keys) {
    const col = (ts as any)[k] as TargetColumnResult;
    out[k] = { value: col.value, fmt: col.fmt };
  }
  return out;
}

export default computeTargetsByProfit;

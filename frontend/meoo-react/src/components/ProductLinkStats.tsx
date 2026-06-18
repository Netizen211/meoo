import { useMemo } from "react";

// ===== 类型定义 (前端+服务端共享) =====

interface DailySalesPoint { date: string; sales: number; gmv: number; orders: number; }
interface PriceBucket { range: string; min: number; max: number; count: number; }

export interface TaxConfig {
  id: string; name: string; taxType: "vat"|"income"|"surcharge"|"custom";
  rate: number; base: "revenue"|"profit"|"vat"|"gmv"|"orders";
  enabled: boolean; description?: string;
}

export interface CustomDeduction {
  id: string; name: string; formula: string;
  scope: "global"|"product"|"category"; scopeTarget?: string;
  effectiveFrom?: string; effectiveTo?: string; condition?: string;
  enabled: boolean; sortOrder: number;
}

export interface CostBreakdown {
  productCost: number; packagingFee: number; shippingFee: number;
  promoCost: number; discount: number; platformFee: number;
  insuranceFee?: number; penaltyFee?: number; marketingFee?: number;
  taxes: number; customDeductions: number;
}

export interface CostSource {
  productCost: "real"|"estimated"|"missing";
  taxes: "configured"|"default";
  customDeductions: "configured"|"none";
}

export interface TaxDetail { name: string; amount: number; rate: number; base: number; }
export interface DeductionDetail { name: string; amount: number; formula: string; }

export interface PromoSourceDetail {
  source: string; date: string; cost: number; clicks: number;
  impressions: number; orders: number; transaction: number;
  ctr: number; cvr: number; productName: string; rawRow?: any;
}

export interface ProductStat {
  productId: string; productName: string; productCode: string;
  gmv: number; orders: number; sales: number; revenue: number;
  refund: number; refundCount: number; discount: number;
  afterSaleCount: number; afterSaleRate: number; avgOrderValue: number;
  promoCost: number; promoClicks: number; promoImpressions: number;
  promoOrders: number; promoTransaction: number;
  ctr: number; cvr: number; totalCost: number; netProfit: number;
  profitRate: number; roi: number; refundRate: number;
  discountRatio: number; promoCostRatio: number;
  hasOrderData: boolean; hasPromoData: boolean;
  promoSourceDetails: PromoSourceDetail[];
  dailySales: DailySalesPoint[];
  priceDistribution: PriceBucket[];
  afterSaleBreakdown: Record<string, number>;
  relatedProducts: { productId: string; productName: string; coOccurrenceCount: number }[];
  firstOrderDate: string; lastOrderDate: string;
  activeDays: number; avgDailySales: number;
  inventoryEstimate: number; turnoverDays: number; sellThroughRate: number;
  costBreakdown: CostBreakdown; costSource: CostSource;
  taxDetails: TaxDetail[]; deductionDetails: DeductionDetail[];
  profitConfidence: "high"|"medium"|"low";
  grossProfit: number; preTaxProfit: number; netProfitAfterTax: number;
  hourlyPromotedOrders?: number; hourlyConfirmed?: boolean;
}

// ===== useProductDetail (简单查找，无计算) =====

export function useProductDetail(productStats: Record<string, ProductStat>, productId: string | null) {
  return useMemo(() => {
    if (!productId || !productStats[productId]) return null;
    return productStats[productId];
  }, [productStats, productId]);
}

// ★ 注意: useProductStats 和 useTotalProductStats 已删除
// ★ 所有商品统计计算已迁移至 server/src/services/analyticsService.ts
// ★ 前端 ProductPage 通过 GET /api/analytics/products/stats 获取服务端计算结果
// ★ ProductStat 类型定义与服务端 analyticsService.ts 的返回结构保持一致
/**
 * 服务端分析API — 所有KPI由服务端预计算（MySQL直接聚合，不依赖浏览器）
 *
 * ★ v2: 新增批量端点，单次请求获取全部数据，消除 N+1 请求瀑布
 */
import { apiClient } from './client';

export interface DashboardKpi {
  gmv: number; revenue: number; paid: number; refund: number;
  orders: number; refundOrders: number; refundRate: number; afterSaleRate: number;
  avgOrder: number; discount: number; platformFee: number;
  profit: number; profitRate: number;
  postage: number; conversionRate: number; avgShipHours: number;
  organicOrders: number; organicGmv: number;
  products: number; buyers: number; productCount: number;
  promoCost: number; promoGmv: number; promoROI: number; promoOrders: number; promoRatio: number;
  ctr: number; cvr: number; insuranceFee: number; penalties: number;
  skuQuantity?: number;           // ★ SKU数量（下单商品件数合计）
  refundApprovalAmount?: number;  // ★ 同意退款时间维度：退款金额
  refundApprovalOrders?: number;  // ★ 同意退款时间维度：退款订单数
  promoBreakdown?: {
    product: { cost: number; gmv: number; orders: number };
    star: { cost: number; gmv: number; orders: number };
    live: { cost: number; gmv: number; orders: number };
  };
}

export interface StatusItem { name: string; value: number; }
export interface ProvinceItem { name: string; value: number; }

/** 服务器 /api/analytics/dashboard 完整返回 */
export interface DashboardResponse {
  kpi: DashboardKpi;
  status: StatusItem[];
  provinces: ProvinceItem[];
}

export interface ProductKpi {
  id: string; name: string; orders: number; gmv: number; revenue: number;
  refund: number; refundRate: number; promoCost: number; promoGmv: number; roi: number;
}

export interface PromotionResponse {
  summary: { rows: number; cost: number; gmv: number; orders: number; impressions: number; clicks: number; roi: number; ctr: number; cvr: number; breakdown?: any };
  byProduct: any[];
}

export interface AfterSaleResponse {
  total: number; refundAmount: number; asRate: number;
  reasons: { name: string; count: number }[];
}

// ★ 新增类型定义
export interface DailyTrend { date: string; gmv: number; orders: number; revenue: number; refund: number; refundCount: number; }
export interface RegionItem { province: string; orders: number; gmv: number; buyers: number; }
export interface LogisticsSummary { distribution: { range: string; count: number }[]; shippedOrders: number; avgHours: number; totalOrders: number; }
export interface PromoByDateItem { date: string; cost: number; gmv: number; orders: number; impressions: number; clicks: number; }
export interface CostSummary { productCost: number; packagingFee: number; shippingFee: number; insuranceFee: number; laborFee: number; promotionFee: number; platformCommission: number; penalties: number; marketingFees: number; totalCost: number; totalRevenue: number; profit: number; profitMargin: number; netProfit: number; orderCount: number; totalQty: number; lossOrderCount: number; totalRefundAmount: number; duplicateFees: number; }
export interface PeriodCompare { current: { orders: number; gmv: number; revenue: number; cost: number; profit: number } | null; previous: { orders: number; gmv: number; revenue: number; cost: number; profit: number } | null; changes: { orders: number; gmv: number; revenue: number; cost: number; profit: number }; }
export interface CostTrendResponse { current: { revenue: number; cost: number; profit: number; penalties: number; marketingFees: number }; previous: { revenue: number; cost: number; profit: number }; changes: { revenue: number; cost: number; profit: number }; }
export interface FinancialSummary { totalIncome: number; totalExpense: number; incomeCount: number; expenseCount: number; totalRecords: number; orderRevenue: number; }

/** ★ 批量分析：单次请求获取全部数据 */
export interface BulkAnalytics {
  dashboard: DashboardResponse;
  products: ProductKpi[];
  promotion: PromotionResponse;
  afterSale: AfterSaleResponse;
  trends: DailyTrend[];
  regions: RegionItem[];
  logistics: LogisticsSummary;
  promoByDate: PromoByDateItem[];
  costs: CostSummary;
  compare: PeriodCompare;
  financial: FinancialSummary;
  meta: { storeId: string; computedInMs: number; dataRows: number };
}

export const analyticsApi = {
  /** ★ 批量获取全部分析数据（推荐使用，减少请求次数）
   *  使用带重试的可靠请求，应对瞬时网络波动 */
  async getBulk(storeId: string): Promise<BulkAnalytics | null> {
    const res = await apiClient.getReliable<BulkAnalytics>(`/analytics/bulk?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  /** 从服务器 MySQL 直接聚合计算所有 KPI */
  async getDashboard(storeId: string): Promise<DashboardResponse | null> {
    const res = await apiClient.get<DashboardResponse>(`/analytics/dashboard?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getProducts(storeId: string): Promise<ProductKpi[] | null> {
    const res = await apiClient.get<ProductKpi[]>(`/analytics/products?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getPromotion(storeId: string): Promise<PromotionResponse | null> {
    const res = await apiClient.get<PromotionResponse>(`/analytics/promotion?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getAfterSale(storeId: string): Promise<AfterSaleResponse | null> {
    const res = await apiClient.get<AfterSaleResponse>(`/analytics/aftersale?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  // ★ 新增：专项分析端点
  async getTrends(storeId: string): Promise<DailyTrend[] | null> {
    const res = await apiClient.get<DailyTrend[]>(`/analytics/trends?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getRegions(storeId: string): Promise<RegionItem[] | null> {
    const res = await apiClient.get<RegionItem[]>(`/analytics/regions?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getLogistics(storeId: string): Promise<LogisticsSummary | null> {
    const res = await apiClient.get<LogisticsSummary>(`/analytics/logistics?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getCosts(storeId: string, startDate?: string, endDate?: string): Promise<CostSummary | null> {
    const params = new URLSearchParams({ storeId });
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    const res = await apiClient.get<CostSummary>(`/analytics/costs?${params.toString()}`);
    return res.success ? res.data! : null;
  },

  async getCompare(storeId: string, days?: number): Promise<PeriodCompare | null> {
    const daysParam = days ? `&days=${days}` : '';
    const res = await apiClient.get<PeriodCompare>(`/analytics/compare?storeId=${encodeURIComponent(storeId)}${daysParam}`);
    return res.success ? res.data! : null;
  },

  async getPromoTrends(storeId: string): Promise<PromoByDateItem[] | null> {
    const res = await apiClient.get<PromoByDateItem[]>(`/analytics/promo-trends?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getFinancial(storeId: string): Promise<FinancialSummary | null> {
    const res = await apiClient.get<FinancialSummary>(`/analytics/financial?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  async getDashboardFull(storeId: string): Promise<any> {
    const res = await apiClient.get<any>(`/analytics/dashboard-full?storeId=${encodeURIComponent(storeId)}`);
    return res.success ? res.data! : null;
  },

  /** ★ 成本环比趋势（带时间范围过滤） */
  async getCostTrend(storeId: string, startDate: string, endDate: string, compareDays?: number): Promise<CostTrendResponse | null> {
    const params = new URLSearchParams({ storeId, startDate, endDate });
    if (compareDays) params.set('compareDays', String(compareDays));
    const res = await apiClient.get<CostTrendResponse>(`/analytics/cost-trend?${params.toString()}`);
    return res.success ? res.data! : null;
  },

  /** ★ 商品复盘数据 */
  async getRetrospective(
    storeId: string, productId: string,
    timeRange: string = '30', customStart?: string, customEnd?: string,
    compareWindow: number = 7
  ): Promise<any> {
    const params = new URLSearchParams({ storeId, productId, timeRange, compareWindow: String(compareWindow) });
    if (customStart) params.set('customStart', customStart);
    if (customEnd) params.set('customEnd', customEnd);
    const res = await apiClient.get<any>(`/analytics/products/retrospective?${params.toString()}`);
    return res.success ? res.data! : null;
  },
};

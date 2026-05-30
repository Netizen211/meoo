/**
 * 服务端分析API — 所有KPI由服务端预计算（MySQL直接聚合，不依赖浏览器）
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
  summary: { rows: number; cost: number; gmv: number; orders: number; impressions: number; clicks: number; roi: number; ctr: number; cvr: number };
  byProduct: any[];
}

export interface AfterSaleResponse {
  total: number; refundAmount: number; asRate: number;
  reasons: { name: string; count: number }[];
}

export const analyticsApi = {
  /** 从服务器 MySQL 直接聚合计算所有 KPI */
  async getDashboard(storeId: string): Promise<DashboardResponse | null> {
    const res = await apiClient.get<DashboardResponse>(`/analytics/dashboard?storeId=${storeId}`);
    return res.success ? res.data! : null;
  },

  async getProducts(storeId: string): Promise<ProductKpi[] | null> {
    const res = await apiClient.get<ProductKpi[]>(`/analytics/products?storeId=${storeId}`);
    return res.success ? res.data! : null;
  },

  async getPromotion(storeId: string): Promise<PromotionResponse | null> {
    const res = await apiClient.get<PromotionResponse>(`/analytics/promotion?storeId=${storeId}`);
    return res.success ? res.data! : null;
  },

  async getAfterSale(storeId: string): Promise<AfterSaleResponse | null> {
    const res = await apiClient.get<AfterSaleResponse>(`/analytics/aftersale?storeId=${storeId}`);
    return res.success ? res.data! : null;
  },
};

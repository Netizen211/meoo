/**
 * 前后端共享类型定义 — 单一来源 (Single Source of Truth)
 *
 * 前端: tsconfig paths → "@shared/*" → ./shared/*
 * 后端: tsconfig paths → "@shared/*" → ../shared/*
 */
// ===== API 通用 =====
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

// ===== 用户 =====
export interface User {
  id: string;
  username: string;
  role: 'normal' | 'test' | 'admin';
  membershipLevel: 'free' | 'pro' | 'enterprise';
  membershipExpiresAt?: string | null;
  isBanned?: boolean;
  phone?: string;
}

// ===== 店铺 =====
export interface Store {
  id: string;
  name: string;
  userId?: string;
  createdAt?: string;
}

// ===== 数据分类 =====
export type DataCategory =
  | 'orders' | 'promotionSummary' | 'promotionProducts'
  | 'starStoreSummary' | 'liveStreamSummary'
  | 'shippingInsurance' | 'afterSaleRecords' | 'financialRecords';

export const DATA_CATEGORIES: DataCategory[] = [
  'orders', 'promotionSummary', 'promotionProducts',
  'starStoreSummary', 'liveStreamSummary', 'shippingInsurance',
  'afterSaleRecords', 'financialRecords',
];

export interface StoreAvailableFields {
  csv: string[];
  promotion: string[];
  insurance: string[];
  afterSale: string[];
}

export interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];
  financialRecords: any[];
  availableFields?: StoreAvailableFields;
}

export interface UploadRecord {
  id: string; fileName: string; fileType: string;
  storeId: string; storeName: string; uploadedAt: string;
  rowCount: number; fieldCount: number;
}

// ===== 认证 =====
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface LoginRequest { username: string; password: string; }
export interface RegisterRequest {
  username: string; password: string; phone?: string; inviteCode: string;
}

// ===== 产品统计 =====
export interface ProductStats {
  productId: string; productName: string; productCode: string;
  gmv: number; orders: number; sales: number; revenue: number;
  refund: number; refundCount: number; discount: number;
  afterSaleCount: number; afterSaleRate: number; avgOrderValue: number;
  promoCost: number; promoClicks: number; promoImpressions: number;
  promoOrders: number; promoTransaction: number;
  ctr: number; cvr: number; totalCost: number; netProfit: number;
  profitRate: number; roi: number;
  refundRate: number; discountRatio: number; promoCostRatio: number;
  hasOrderData: boolean; hasPromoData: boolean;
}

// ===== Dashboard KPI =====
export interface DashboardKPI {
  kpi: {
    gmv: number; revenue: number; orders: number;
    refund: number; refundRate: number; profit: number; profitRate: number;
    avgOrder: number; promoCost: number; promoGmv: number; promoROI: number;
    products: number; buyers: number; conversionRate: number;
    afterSaleRate: number; insuranceFee: number; penalties: number;
  };
  status: Array<{ name: string; value: number }>;
  provinces: Array<{ name: string; value: number }>;
}

// ===== Bulk Analytics (v2 — single request, all data) =====
export interface BulkAnalytics {
  dashboard: DashboardKPI;
  products: ProductStats[];
  promotion: {
    summary: { rows: number; cost: number; gmv: number; orders: number; impressions: number; clicks: number; roi: number; ctr: number; cvr: number; breakdown?: any };
    byProduct: any[];
  };
  afterSale: { total: number; refundAmount: number; asRate: number; reasons: Array<{ name: string; count: number }> };
  trends: Array<{ date: string; gmv: number; orders: number; revenue: number; refund: number; refundCount: number }>;
  regions: Array<{ province: string; orders: number; gmv: number; buyers: number }>;
  logistics: { distribution: Array<{ range: string; count: number }>; shippedOrders: number; avgHours: number; totalOrders: number };
  promoByDate: Array<{ date: string; cost: number; gmv: number; orders: number; impressions: number; clicks: number }>;
  costs: { productCost: number; packagingFee: number; shippingFee: number; insuranceFee: number; totalCost: number; orderCount: number };
  compare: { current: any; previous: any; changes: Record<string, number> } | null;
  financial: { totalIncome: number; totalExpense: number; incomeCount: number; expenseCount: number; totalRecords: number; orderRevenue: number };
  meta: { storeId: string; computedInMs: number; dataRows: number };
}

// 前后端共享类型定义

// ===== 用户与认证 =====

export interface User {
  id: string;
  username: string;
  role: 'normal' | 'test' | 'admin';
  membershipLevel: 'free' | 'pro' | 'enterprise';
  membershipExpiresAt?: string | null;
  isBanned?: boolean;
  bannedReason?: string;
  phone?: string;
  inviteCode?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  phone?: string;
  inviteCode: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ===== 店铺 =====

export interface Store {
  id: string;
  name: string;
  createdAt: string;
}

// ===== 店铺数据 =====

export interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  promotionHourly: any[];       // 商品推广_分小时 — 每行=某商品×某小时，日期来自Row1[0]
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];
  financialRecords: any[];
  availableFields: StoreAvailableFields;
}

export interface StoreAvailableFields {
  csv: string[];
  promotion: string[];
  insurance: string[];
  afterSale: string[];
  financial: string[];
}

export type DataCategory =
  | 'orders'
  | 'promotionSummary'
  | 'promotionProducts'
  | 'promotionHourly'    // 商品推广_分小时
  | 'starStoreSummary'
  | 'liveStreamSummary'
  | 'shippingInsurance'
  | 'afterSaleRecords'
  | 'financialRecords';

export const DATA_CATEGORIES: DataCategory[] = [
  'orders',
  'promotionSummary',
  'promotionProducts',
  'promotionHourly',     // 商品推广_分小时
  'starStoreSummary',
  'liveStreamSummary',
  'shippingInsurance',
  'afterSaleRecords',
  'financialRecords',
];

export interface SyncRequest {
  storeId: string;
  storeName: string;
  clientUpdatedAt: string;
  data: {
    orders: any[];
    promotionSummary: any[];
    promotionProducts: any[];
    promotionHourly: any[];
    starStoreSummary: any[];
    liveStreamSummary: any[];
    shippingInsurance: any[];
    afterSaleRecords: any[];
    financialRecords: any[];
    availableFields: StoreAvailableFields;
  };
  configs: Record<string, any>;
  uploadRecords: UploadRecord[];
}

export interface PullResponse {
  storeName: string;
  data: StoreDataItem;
  configs: Record<string, any>;
  uploadRecords: UploadRecord[];
  lastSyncedAt: string;
}

// ===== 上传记录 =====

export interface UploadRecord {
  id: string;
  fileName: string;
  fileType: string;
  storeId: string;
  storeName: string;
  uploadedAt: string;
  rowCount: number;
  fieldCount: number;
}

// ===== 邀请码 =====

export interface InviteCode {
  id?: number;
  code: string;
  batchId?: string;
  createdBy: string;
  usedBy?: string;
  usedAt?: string;
  isUsed: boolean;
  createdAt?: string;
}

// ===== 管理员日志 =====

export interface AdminLog {
  id?: number;
  adminId: string;
  action: string;
  targetType: 'user' | 'invite_code' | 'system';
  targetId?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
}

// ===== 充值申请 =====

export interface RechargeOrder {
  id?: number;
  userId: string;
  username: string;
  plan: 'pro' | 'enterprise';
  duration: 'monthly' | 'yearly';
  amount: number;
  wechatNickname?: string;
  remark?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  reviewedAt?: string;
  createdAt?: string;
}

// ===== API 通用响应 =====

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
}

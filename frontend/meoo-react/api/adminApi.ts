import { apiClient } from './client';

export interface AdminStats {
  totalUsers: number;
  totalStores: number;
  totalRecords: number;
  storageBytes: number;
  freeUsers: number;
  proUsers: number;
  enterpriseUsers: number;
  todayUploads: number;
  todayActiveUsers: number;
  bannedUsers: number;
}

export interface AdminUser {
  id: string;
  username: string;
  role: string;
  membershipLevel: string;
  membershipExpiresAt: string | null;
  isBanned: boolean;
  bannedReason: string | null;
  phone: string;
  createdAt: string;
}

export interface AdminLog {
  id: number;
  adminId: string;
  action: string;
  targetType: string;
  targetId: string;
  details: string;
  ipAddress: string;
  createdAt: string;
}

// 全局配置中的费用项目
export interface FeeConfig {
  packagingFee: number;
  expressFee: number;
  platformCommissionRate: number;
  shippingInsurance: number;
  laborFee: number;
  promotionFee: number;
}

// 快递公司费率
export interface ExpressRateItem {
  company: string;
  firstWeight: number;
  firstPrice: number;
  continuedWeight: number;
  continuedPrice: number;
}

// 扣费公式
export interface DeductionFormula {
  id: string;
  name: string;
  formula: string;
  enabled: boolean;
  createdBy?: string;
  createdAt?: string;
}

// 税率配置
export interface TaxRateConfig {
  vatRate: number;
  incomeTaxRate: number;
  surtaxRate: number;
}

// 完整的全局业务配置
export interface GlobalConfig {
  fees: FeeConfig;
  expressRates: ExpressRateItem[];
  deductionFormulas: DeductionFormula[];
  taxRates: TaxRateConfig;
}

// 系统设置
export interface SystemSettings {
  registrationOpen: boolean;
  inviteCodeRequired: boolean;
  proGraceDays: number;
  membershipReminderDays: number;
  freeDataRetentionDays: number;
  cleanupCron: string;
  dataRetentionDays: number;
  maxLoginAttempts: number;
  tokenExpiresMinutes: number;
  wecomWebhook: string;
  dingtalkWebhook: string;
  aiEnabled: boolean;
  aiApiKey: string;
  aiDailyLimit: number;
  aiModel: string;
}

// 配置变更历史项
export interface ConfigHistoryItem {
  id: number;
  configKey: string;
  oldValue: string | null;
  newValue: string | null;
  changedBy: string;
  changedAt: string;
  ipAddress: string | null;
}

export interface GetUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: string;
  membershipLevel?: string;
}

export interface UserStore {
  storeId: string;
  storeName: string;
  totalRows: number;
}

export interface UserRechargeRecord {
  id: number;
  plan: string;
  duration: string;
  amount: number;
  status: string;
}

export interface MembershipHistory {
  id: number;
  userId: string;
  fromLevel: string;
  toLevel: string;
  fromExpiresAt: string;
  toExpiresAt: string;
  note: string;
  operatedBy: string;
  createdAt: string;
}

export interface UserFullDetail {
  profile: {
    id: string;
    username: string;
    role: string;
    membershipLevel: string;
    membershipExpiresAt: string | null;
    isBanned: boolean;
    bannedReason: string | null;
    phone: string;
    isSubAccount: boolean;
    parentUserId: string | null;
    createdAt: string;
  };
  stores: Array<{ id: string; name: string; created_at: string; totalRows: number; lastUpload: string | null }>;
  rechargeRecords: Array<{ id: number; plan: string; duration: string; amount: number; status: string; created_at: string; reviewed_at: string | null; review_note: string | null }>;
  membershipHistory: Array<{ id: number; fromLevel: string; toLevel: string; fromExpiresAt: string | null; toExpiresAt: string | null; note: string; operatedBy: string; createdAt: string }>;
  sessions: Array<{ id: number; sessionId: string; ipAddress: string; userAgent: string; deviceInfo: string; lastActivityAt: string; createdAt: string; expiresAt: string }>;
  operationLogs: Array<any>;
  uploadRecords: Array<{ id: number; storeId: string; storeName: string; fileName: string; fileSize: number; category: string; rowCount: number; uploadedAt: string }>;
}

export interface RevenueSummary {
  totalRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  pendingAmount: number;
  conversionRate: number;
  payingUsers: number;
  totalUsers: number;
  monthlyTrend: Array<{ month: string; amount: number; count: number }>;
  byPlan: Array<{ plan: string; count: number; total: number }>;
  byDuration: Array<{ duration: string; count: number; total: number }>;
}

export interface Transaction {
  id: number;
  userId: string;
  username: string;
  plan: string;
  duration: string;
  amount: number;
  status: string;
  wechatNickname: string;
  remark: string;
  reviewedBy: string;
  reviewNote: string;
  reviewedAt: string;
  createdAt: string;
}

export interface SystemInfo {
  uptime: number;
  nodeVersion: string;
  memoryUsage: NodeJS.MemoryUsage;
  platform: string;
  arch: string;
  tables: Array<{ table_name: string; size_mb: number; row_count: number }>;
  counts: {
    users: number;
    stores: number;
    records: number;
    logs: number;
    activeSessions: number;
  };
}

export interface StoreDataInfo {
  store: { id: string; name: string; userId: string; createdAt: string };
  categoryStats: Array<{ category: string; totalRows: number; lastUpload: string }>;
  availableFields: Array<{ category: string; field_name: string; field_label: string }>;
  records: Array<{ id: number; category: string; rowCount: number; uploadedAt: string }>;
}

export interface MaintenanceStatus {
  enabled: boolean;
  message: string;
  allowedIps: string[];
}

export const adminApi = {
  // ========== 系统概览 ==========
  async getStats(): Promise<AdminStats | null> {
    const res = await apiClient.get<AdminStats>('/admin/stats');
    return res.success ? res.data! : null;
  },

  async getHealth() {
    const res = await apiClient.get('/admin/health');
    return res;
  },

  async getGrowthTrend() {
    const res = await apiClient.get('/admin/growth-trend');
    return res;
  },

  async getRecentActivity() {
    const res = await apiClient.get('/admin/recent-activity');
    return res;
  },

  // ========== 用户管理 ==========
  async getUsers(params: GetUsersParams = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    if (params.search) qs.set('search', params.search);
    if (params.role) qs.set('role', params.role);
    if (params.membershipLevel) qs.set('membershipLevel', params.membershipLevel);
    const res = await apiClient.get('/admin/users?' + qs.toString());
    return res;
  },

  async getUserDetail(userId: string) {
    const res = await apiClient.get('/admin/users/' + userId + '/detail');
    if (res.success && res.data) {
      return res.data as { stores: UserStore[]; rechargeRecords: UserRechargeRecord[] };
    }
    return null;
  },

  async toggleBan(userId: string, isBanned: boolean, reason?: string): Promise<boolean> {
    const res = await apiClient.put('/admin/users/' + userId, { isBanned, bannedReason: reason });
    return res.success;
  },

  async batchToggleBan(userIds: string[], isBanned: boolean, reason?: string): Promise<boolean> {
    const res = await apiClient.put('/admin/users/batch/ban', { userIds, isBanned, bannedReason: reason });
    return res.success;
  },

  async batchNotify(userIds: string[], message: string): Promise<boolean> {
    const res = await apiClient.post('/admin/users/batch/notify', { userIds, message });
    return res.success;
  },

  async adjustMembership(userId: string, membershipLevel: string, membershipExpiresAt?: string, note?: string): Promise<boolean> {
    const res = await apiClient.put('/admin/users/' + userId + '/membership', { membershipLevel, membershipExpiresAt, note });
    return res.success;
  },

  async createUser(data: { username: string; password: string; email?: string; role?: string; membershipLevel?: string }) {
    const res = await apiClient.post('/admin/users', data);
    return res;
  },

  async impersonateUser(userId: string) {
    const res = await apiClient.post('/admin/impersonate/' + userId);
    return res;
  },

  async getMembershipHistory(page = 1, pageSize = 100, userId?: string) {
    const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (userId) qs.set('userId', userId);
    const res = await apiClient.get('/admin/membership/history?' + qs.toString());
    return res;
  },

  // ========== 操作日志 (增强) ==========
  async getLogs(options: {
    page?: number; pageSize?: number;
    action?: string; admin?: string;
    startDate?: string; endDate?: string;
  } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(options.page ?? 1));
    params.set('pageSize', String(options.pageSize ?? 50));
    if (options.action) params.set('action', options.action);
    if (options.admin) params.set('admin', options.admin);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    const res = await apiClient.get('/admin/logs?' + params.toString());
    return res;
  },

  async getLogActions(): Promise<string[]> {
    const res = await apiClient.get<string[]>('/admin/logs/actions');
    return res.success ? (res.data ?? []) : [];
  },

  async exportLogsCSV(options: { startDate?: string; endDate?: string; action?: string } = {}): Promise<boolean> {
    const params = new URLSearchParams();
    if (options.action) params.set('action', options.action);
    if (options.startDate) params.set('startDate', options.startDate);
    if (options.endDate) params.set('endDate', options.endDate);
    // 下载文件：使用 fetch 直接请求
    try {
      const baseUrl = apiClient.getBaseUrl();
      const url = baseUrl + '/admin/logs/export?' + params.toString();
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'admin_logs_' + Date.now() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      return true;
    } catch {
      return false;
    }
  },

  async cleanLogs(beforeDays: number): Promise<{ success: boolean; message?: string; deleted?: number }> {
    const res = await apiClient.delete<{ deleted: number }>('/admin/logs');
    return res;
  },

  // ========== 数据监控 ==========
  async getDataStats() {
    const res = await apiClient.get('/admin/data-stats');
    return res;
  },

  // ========== 系统设置 ==========
  async getSettings(): Promise<SystemSettings | null> {
    const res = await apiClient.get<SystemSettings>('/admin/settings');
    if (res.success && res.data) return res.data;
    return null;
  },

  async updateSettings(settings: Partial<SystemSettings>) {
    const res = await apiClient.put('/admin/settings', settings);
    return res;
  },

  // ========== 全局业务配置 ==========
  async getConfig(): Promise<GlobalConfig | null> {
    const res = await apiClient.get<GlobalConfig>('/admin/config');
    return res.success ? (res.data ?? null) : null;
  },

  async updateConfig(config: Partial<GlobalConfig>) {
    const res = await apiClient.put('/admin/config', config);
    return res;
  },

  async getConfigHistory(options: { page?: number; pageSize?: number; configKey?: string } = {}) {
    const params = new URLSearchParams();
    params.set('page', String(options.page ?? 1));
    params.set('pageSize', String(options.pageSize ?? 50));
    if (options.configKey) params.set('configKey', options.configKey);
    const res = await apiClient.get('/admin/config/history?' + params.toString());
    return res;
  },

  async exportConfigJSON(): Promise<boolean> {
    try {
      const baseUrl = apiClient.getBaseUrl();
      const url = baseUrl + '/admin/config/export';
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'system_config_' + Date.now() + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      return true;
    } catch {
      return false;
    }
  },

  async importConfigJSON(configs: Record<string, any>) {
    const res = await apiClient.post('/admin/config/import', { configs });
    return res;
  },

  // ========== 邀请码 ==========
  async generateInviteCodes(count = 5) {
    const res = await apiClient.post<{ batchId: string; codes: string[] }>('/stores/invite/generate', { count });
    return res;
  },

  async getInviteCodes() {
    const res = await apiClient.get('/stores/invite/list');
    return res;
  },

  async deleteInviteCode(code: string) {
    const res = await apiClient.delete('/stores/invite/' + code);
    return res.success;
  },

  // ========== 子账号管理（管理员） ==========
  async getSubAccounts(params: {
    page?: number; pageSize?: number;
    search?: string; parentId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 50));
    if (params.search) qs.set('search', params.search);
    if (params.parentId) qs.set('parentId', params.parentId);
    const res = await apiClient.get('/admin/sub-accounts?' + qs.toString());
    return res;
  },

  async createSubAccount(data: {
    username: string; password: string;
    parentUserId: string; roleName?: string; phone?: string;
  }) {
    const res = await apiClient.post('/admin/sub-accounts', data);
    return res;
  },

  async deleteSubAccount(subId: string) {
    const res = await apiClient.delete('/admin/sub-accounts/' + subId);
    return res;
  },

  async toggleSubAccountBan(subId: string, isBanned: boolean, reason?: string) {
    const res = await apiClient.put('/admin/sub-accounts/' + subId + '/banned', { isBanned, reason });
    return res;
  },

  async getSubAccountLogs(params: {
    page?: number; pageSize?: number; subUserId?: string;
  } = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 50));
    if (params.subUserId) qs.set('subUserId', params.subUserId);
    const res = await apiClient.get('/admin/sub-accounts/logs?' + qs.toString());
    return res;
  },

  async getParentUsers() {
    const res = await apiClient.get<Array<{ id: string; username: string; phone: string; membership_level: string }>>('/admin/parent-users');
    return res;
  },

  async getRoles() {
    const res = await apiClient.get<Array<{ name: string; pages: string[]; funcs: string[]; scope: string }>>('/admin/roles');
    return res;
  },

  // ========== 充值审核 ==========
  async getRechargeList(status?: string, page = 1, pageSize = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    if (search) params.set('search', search);
    const res = await apiClient.get('/recharge/list?' + params.toString());
    return res;
  },

  async reviewRecharge(orderId: number, action: 'approve' | 'reject', note?: string) {
    const res = await apiClient.put('/recharge/review/' + orderId, { action, note });
    return res;
  },

  async batchReviewRecharge(ids: number[], action: 'approve' | 'reject', note?: string) {
    const res = await apiClient.put('/recharge/review/batch', { ids, action, note });
    return res;
  },

  async exportRechargeRecords(status: string, format: 'csv' | 'json') {
    const res = await apiClient.get('/recharge/list?status=' + status + '&pageSize=10000');
    return res;
  },

  // ========== 用户完整详情 ==========
  async getUserFullDetail(userId: string): Promise<UserFullDetail | null> {
    const res = await apiClient.get<UserFullDetail>('/admin/users/' + userId + '/full-detail');
    return res.success ? (res.data ?? null) : null;
  },

  // ========== 会话管理 ==========
  async getUserSessions(userId: string) {
    const res = await apiClient.get('/admin/users/' + userId + '/sessions');
    return res;
  },

  async revokeSession(userId: string, sessionId: string) {
    const res = await apiClient.delete('/admin/users/' + userId + '/sessions/' + sessionId);
    return res;
  },

  async revokeAllSessions(userId: string) {
    const res = await apiClient.delete('/admin/users/' + userId + '/sessions');
    return res;
  },

  // ========== 密码重置 ==========
  async resetUserPassword(userId: string, newPassword: string) {
    const res = await apiClient.post('/admin/users/' + userId + '/reset-password', { newPassword });
    return res;
  },

  // ========== 删除账号 ==========
  async deleteUserAccount(userId: string) {
    const res = await apiClient.delete('/admin/users/' + userId + '/account');
    return res;
  },

  // ========== 用户备注 ==========
  async getUserNote(userId: string): Promise<string> {
    const res = await apiClient.get<{ note: string }>('/admin/users/' + userId + '/notes');
    return res.success ? (res.data?.note ?? '') : '';
  },

  async updateUserNote(userId: string, note: string) {
    const res = await apiClient.put('/admin/users/' + userId + '/notes', { note });
    return res;
  },

  // ========== 营收仪表盘 ==========
  async getRevenueSummary(): Promise<RevenueSummary | null> {
    const res = await apiClient.get<RevenueSummary>('/admin/revenue/summary');
    return res.success ? (res.data ?? null) : null;
  },

  async getRevenueTransactions(params: {
    page?: number; pageSize?: number; status?: string; plan?: string;
    startDate?: string; endDate?: string;
  } = {}) {
    const qs = new URLSearchParams();
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 30));
    if (params.status) qs.set('status', params.status);
    if (params.plan) qs.set('plan', params.plan);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get('/admin/revenue/transactions?' + qs.toString());
    return res;
  },

  async exportRevenueCSV(startDate?: string, endDate?: string): Promise<boolean> {
    try {
      const baseUrl = apiClient.getBaseUrl();
      const params = new URLSearchParams();
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const url = baseUrl + '/admin/revenue/export?' + params.toString();
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'revenue_' + Date.now() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      return true;
    } catch { return false; }
  },

  // ========== 店铺数据浏览 ==========
  async getStoreData(storeId: string, params: { category?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.category) qs.set('category', params.category);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await apiClient.get<StoreDataInfo>('/admin/stores/' + storeId + '/data?' + qs.toString());
    return res;
  },

  async deleteStore(storeId: string) {
    const res = await apiClient.delete('/admin/stores/' + storeId);
    return res;
  },

  // ========== 系统信息 ==========
  async getSystemInfo(): Promise<SystemInfo | null> {
    const res = await apiClient.get<SystemInfo>('/admin/system-info');
    return res.success ? (res.data ?? null) : null;
  },

  // ========== 用户导出 ==========
  async exportUsersCSV(params: { role?: string; membershipLevel?: string } = {}): Promise<boolean> {
    try {
      const baseUrl = apiClient.getBaseUrl();
      const qs = new URLSearchParams();
      if (params.role) qs.set('role', params.role);
      if (params.membershipLevel) qs.set('membershipLevel', params.membershipLevel);
      const url = baseUrl + '/admin/user-export?' + qs.toString();
      const token = localStorage.getItem('accessToken') || '';
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) return false;
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'users_export_' + Date.now() + '.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      return true;
    } catch { return false; }
  },

  // ========== 数据趋势 ==========
  async getTrends(days = 30) {
    const res = await apiClient.get('/admin/trends?days=' + days);
    return res;
  },

  // ========== 登录历史 ==========
  async getLoginHistory(page = 1, pageSize = 50) {
    const res = await apiClient.get('/admin/login-history?page=' + page + '&pageSize=' + pageSize);
    return res;
  },

  // ========== 维护模式 ==========
  async getMaintenanceStatus(): Promise<MaintenanceStatus | null> {
    const res = await apiClient.get<MaintenanceStatus>('/admin/maintenance');
    return res.success ? (res.data ?? null) : null;
  },

  async updateMaintenance(data: { enabled?: boolean; message?: string; allowedIps?: string[] }) {
    const res = await apiClient.put('/admin/maintenance', data);
    return res;
  },
};

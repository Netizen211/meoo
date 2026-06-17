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
  lastLoginAt?: string | null;
  storeCount?: number;
  dataVolume?: number;
  totalRecharge?: number;
  activeDays?: number;
  activityLevel?: 'high' | 'medium' | 'low' | 'silent';
  riskEventCount?: number;
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
  copyEnabled: boolean;
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
  activityLevel?: string;
  hasRisk?: string;
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
    if (params.activityLevel) qs.set('activityLevel', params.activityLevel);
    if (params.hasRisk) qs.set('hasRisk', params.hasRisk);
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

  async getInviteStats(timeRange = '30d') {
    const res = await apiClient.get('/admin/invite-codes/stats?timeRange=' + timeRange);
    return res.success ? (res.data ?? {}) : {};
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
    const res = await apiClient.get('/admin/recharges?status=' + (status || 'all'));
    return res;
  },

  async reviewRecharge(orderId: number, action: 'approve' | 'reject', note?: string) {
    const res = await apiClient.post('/admin/recharges/' + orderId + '/review', { status: action, note });
    return res;
  },

  async batchReviewRecharge(ids: number[], action: 'approve' | 'reject', note?: string) {
    const results = [];
    for (const id of ids) {
      const res = await apiClient.post('/admin/recharges/' + id + '/review', { status: action, note });
      results.push(res);
    }
    return { success: true, data: results };
  },

  async exportRechargeRecords(status: string, format: 'csv' | 'json') {
    const res = await apiClient.get('/admin/recharges?status=' + (status || 'all'));
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

  // ========== ========== 分析模块 (Phase 2.2+) ========== ==========
  async getEventStats(params: { startDate?: string; endDate?: string } = {}): Promise<EventStat[]> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<EventStat[]>('/admin/analytics/event-stats?' + qs.toString());
    return res.success ? (res.data ?? []) : [];
  },

  async getDailyActivity(params: { startDate?: string; endDate?: string } = {}): Promise<DailyActivity[]> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<DailyActivity[]>('/admin/analytics/daily-activity?' + qs.toString());
    return res.success ? (res.data ?? []) : [];
  },

  async getEvents(params: {
    event_type?: string; user_id?: string;
    page?: number; pageSize?: number;
    startDate?: string; endDate?: string;
  } = {}): Promise<{ success: boolean; data: EventRecord[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    if (params.event_type) qs.set('event_type', params.event_type);
    if (params.user_id) qs.set('user_id', params.user_id);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<any>('/admin/analytics/events?' + qs.toString());
    if (res.success) {
      return { success: true, data: res.data ?? [], total: res.total ?? 0, page: res.page ?? 1, pageSize: res.pageSize ?? 20 };
    }
    return { success: false, data: [], total: 0, page: 1, pageSize: 20 };
  },

  async getFunnelData(params: { funnel_name?: string; startDate?: string; endDate?: string } = {}): Promise<FunnelStep[]> {
    const qs = new URLSearchParams();
    if (params.funnel_name) qs.set('funnel_name', params.funnel_name);
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<FunnelStep[]>('/admin/analytics/funnel?' + qs.toString());
    return res.success ? (res.data ?? []) : [];
  },

  async getModuleRank(params: { startDate?: string; endDate?: string } = {}): Promise<ModuleRankItem[]> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<ModuleRankItem[]>('/admin/analytics/module-rank?' + qs.toString());
    return res.success ? (res.data ?? []) : [];
  },

  async getPayConversion(params: { startDate?: string; endDate?: string } = {}): Promise<{ trend: PayConversionTrend[] }> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<{ trend: PayConversionTrend[] }>('/admin/analytics/pay-conversion?' + qs.toString());
    return res.success ? (res.data ?? { trend: [] }) : { trend: [] };
  },

  async getDataQuality(params: { store_id?: string; check_type?: string; page?: number; pageSize?: number } = {}): Promise<{
    success: boolean; data: { summary: any[]; checks: any[]; total: number; page: number; pageSize: number }
  }> {
    const qs = new URLSearchParams();
    if (params.store_id) qs.set('store_id', params.store_id);
    if (params.check_type) qs.set('check_type', params.check_type);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await apiClient.get('/admin/data-quality?' + qs.toString());
    return res.success ? { success: true, data: res.data ?? { summary: [], checks: [], total: 0, page: 1, pageSize: 20 } }
      : { success: false, data: { summary: [], checks: [], total: 0, page: 1, pageSize: 20 } };
  },

  async getAIMonitoring(params: { startDate?: string; endDate?: string; page?: number; pageSize?: number } = {}): Promise<{
    success: boolean; data: { summary: any; recent: any[]; total: number; page: number; pageSize: number }
  }> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await apiClient.get('/admin/monitoring/ai?' + qs.toString());
    return res.success ? { success: true, data: res.data ?? { summary: {}, recent: [], total: 0, page: 1, pageSize: 20 } }
      : { success: false, data: { summary: {}, recent: [], total: 0, page: 1, pageSize: 20 } };
  },

  async getRiskEvents(params: { risk_type?: string; risk_level?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<{
    success: boolean; data: { summary: any; events: any[]; total: number; page: number; pageSize: number }
  }> {
    const qs = new URLSearchParams();
    if (params.risk_type) qs.set('risk_type', params.risk_type);
    if (params.risk_level) qs.set('risk_level', params.risk_level);
    if (params.status) qs.set('status', params.status);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await apiClient.get('/admin/risk-events?' + qs.toString());
    return res.success ? { success: true, data: res.data ?? { summary: {}, events: [], total: 0, page: 1, pageSize: 20 } }
      : { success: false, data: { summary: {}, events: [], total: 0, page: 1, pageSize: 20 } };
  },

  // ========== 运营总览 (Phase 2.1) ==========
  async getOperationsOverview(timeRange = '7d'): Promise<OperationsOverview | null> {
    const res = await apiClient.get<OperationsOverview>('/admin/operations/overview?timeRange=' + timeRange);
    return res.success ? (res.data ?? null) : null;
  },

  // ========== 用户分群 (Phase 2.4) ==========
  async getUserSegments(): Promise<any[]> {
    const res = await apiClient.get<any[]>('/admin/users/segments');
    return res.success ? (res.data ?? []) : [];
  },

  async createUserSegment(data: { segment_name: string; segment_rules?: any; is_active?: number }): Promise<boolean> {
    const res = await apiClient.post('/admin/users/segments', data);
    return res.success;
  },

  // ========== 用户行为时间线 (Phase 2.4) ==========
  async getUserTimeline(userId: string, days = 30): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/admin/users/${userId}/timeline?days=${days}`);
    return res.success ? (res.data ?? []) : [];
  },

  async getUserModuleClicks(userId: string): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/admin/users/${userId}/module-clicks`);
    return res.success ? (res.data ?? []) : [];
  },

  async getUserRiskEvents(userId: string): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/admin/users/${userId}/risk-events`);
    return res.success ? (res.data ?? []) : [];
  },

  // ========== 营收升级 (Phase 2.5) ==========
  async getMrrTrend(months = 12): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/admin/revenue/mrr-trend?months=${months}`);
    return res.success ? (res.data ?? []) : [];
  },

  async getChurnRate(period = 'monthly'): Promise<any[]> {
    const res = await apiClient.get<any[]>(`/admin/revenue/churn-rate?period=${period}`);
    return res.success ? (res.data ?? []) : [];
  },

  // ========== 上传监控 (Phase 3.1) ==========
  async getUploadStats(params: { startDate?: string; endDate?: string } = {}): Promise<any> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    const res = await apiClient.get<any>('/admin/monitoring/upload-stats?' + qs.toString());
    return res.success ? (res.data ?? {}) : {};
  },

  async getUploadFailures(params: { page?: number; pageSize?: number; startDate?: string; endDate?: string } = {}): Promise<{ success: boolean; data: { uploads: any[]; total: number; page: number; pageSize: number } }> {
    const qs = new URLSearchParams();
    if (params.startDate) qs.set('startDate', params.startDate);
    if (params.endDate) qs.set('endDate', params.endDate);
    qs.set('page', String(params.page ?? 1));
    qs.set('pageSize', String(params.pageSize ?? 20));
    const res = await apiClient.get('/admin/monitoring/upload-failures?' + qs.toString());
    return res.success ? { success: true, data: res.data ?? { uploads: [], total: 0, page: 1, pageSize: 20 } }
      : { success: false, data: { uploads: [], total: 0, page: 1, pageSize: 20 } };
  },

  // ========== 风控中心 (Phase 3.5) ==========
  async getRiskOverview(): Promise<any> {
    const res = await apiClient.get<any>('/admin/risk/overview');
    return res.success ? (res.data ?? {}) : {};
  },

  async resolveRiskEvent(id: number, resolution_note = ''): Promise<boolean> {
    const res = await apiClient.put(`/admin/risk/events/${id}/resolve`, { resolution_note });
    return res.success;
  },

  async muteRiskEvent(id: number): Promise<boolean> {
    const res = await apiClient.put(`/admin/risk/events/${id}/mute`);
    return res.success;
  },

  // ========== 系统健康 (Phase 3.6) ==========
  async getApiHealthStats(timeRange = '24h'): Promise<any> {
    const res = await apiClient.get<any>('/admin/health/api-stats?timeRange=' + timeRange);
    return res.success ? (res.data ?? {}) : {};
  },

  async getDatabaseStats(): Promise<any> {
    const res = await apiClient.get<any>('/admin/health/database-stats');
    return res.success ? (res.data ?? {}) : {};
  },

  async getStorageStats(): Promise<any> {
    const res = await apiClient.get<any>('/admin/health/storage-stats');
    return res.success ? (res.data ?? {}) : {};
  },
};

export interface OperationsOverview {
  dau: number;
  wau: number;
  mau: number;
  totalUsers: number;
  newUsers: number;
  totalStores: number;
  newStores: number;
  uploads: number;
  storageBytes: number;
  revenue: number;
  payingUsers: number;
  pendingRecharge: number;
  pendingRechargeAmount: number;
  systemAnomalies: number;
  trendData: Array<{
    date: string;
    newUsers: number;
    newStores: number;
    uploads: number;
    revenue: number;
  }>;
}

// ========== 分析模块类型定义 ==========

export interface EventStat {
  event_type: string;
  count: number;
  unique_users: number;
}

export interface DailyActivity {
  stat_date: string;
  active_users: number;
  total_users: number;
  total_page_views: number;
  total_module_clicks: number;
  total_duration: number;
}

export interface EventRecord {
  id: number;
  user_id: string;
  session_id: string;
  event_type: string;
  event_category: string;
  event_label: string;
  event_value: string;
  page_url: string;
  store_id: string;
  device_info: string;
  ip_address: string;
  duration_ms: number;
  metadata: any;
  created_at: string;
}

export interface FunnelStep {
  id: number;
  funnel_name: string;
  step_name: string;
  step_order: number;
  user_count: number;
  conversion_rate: number;
  stat_date: string;
}

export interface ModuleRankItem {
  module_name: string;
  click_count: number;
  unique_users: number;
  click_ratio: number;
  avg_duration_sec: number;
  bounce_rate: number;
  pay_conversion_contribution: number;
  stat_date: string;
}

export interface PayConversionTrend {
  stat_date: string;
  dau: number;
  paywall_views: number;
  module_clicks: number;
}

// ========== 用户分群 & 时间线 (Phase 2.4) ==========
export interface UserSegment {
  id: number;
  segment_name: string;
  segment_rules: any;
  user_count: number;
  is_active: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TimelineEvent {
  event_type: string;
  event_label: string;
  page_url: string;
  duration_ms: number;
  created_at: string;
}

export interface UserModuleClick {
  module_name: string;
  click_count: number;
  active_days: number;
  total_duration: number;
}

// ========== 营收升级 (Phase 2.5) ==========
export interface MrrTrendItem {
  month: string;
  revenue: number;
  paying_users: number;
}

export interface ChurnRateItem {
  month: string;
  active_users: number;
  retained_users: number;
  churn_rate: number;
}

// ========== 上传监控 (Phase 3.1) ==========
export interface UploadStatsData {
  stats: {
    total_uploads: number;
    active_stores: number;
    success_count: number;
    fail_count: number;
    avg_parse_ms: number;
  };
  trend: Array<{
    date: string;
    total: number;
    success: number;
    fail: number;
  }>;
  typeDist: Array<{ file_type: string; count: number }>;
  failReasons: Array<{ error_message: string; count: number }>;
}

// ========== 风控中心 (Phase 3.5) ==========
export interface RiskOverview {
  summary: {
    total_events: number;
    critical_count: number;
    high_count: number;
    medium_count: number;
    open_count: number;
    resolved_count: number;
  };
  typeDist: Array<{
    risk_type: string;
    count: number;
    open_count: number;
  }>;
}

// ========== 系统健康 (Phase 3.6) ==========
export interface ApiHealthData {
  summary: {
    avg_latency: number;
    total_errors: number;
    total_calls: number;
    error_rate: number;
  };
  endpoints: Array<{
    endpoint: string;
    method: string;
    avg_response_ms: number;
    p95_response_ms: number;
    p99_response_ms: number;
    error_count: number;
    total_calls: number;
    error_rate: number;
    stat_date: string;
  }>;
}

export interface DatabaseStats {
  size_mb: number;
  table_count: number;
  active_connections: number;
  status: string;
}

export interface StorageStats {
  total_bytes: number;
  top_users: Array<{
    user_id: string;
    username: string;
    storage_bytes: number;
  }>;
  avg_bytes: number;
  total_users_with_data: number;
}

export interface InviteStats {
  totalCodes: number;
  usedCodes: number;
  availableCodes: number;
  totalUsers: number;
  payingUsers: number;
  totalRevenue: number;
  registrationRate: number;
  paymentRate: number;
  batchDetails: Array<{
    channel: string;
    invite_count: number;
    used_count: number;
    registered_users: number;
    paying_users: number;
    revenue: number;
  }>;
  codeDetails: Array<{
    code: string;
    batch_id: string;
    used_by: string;
    used_at: string;
    registered_at: string;
    paid_amount: number;
  }>;
}
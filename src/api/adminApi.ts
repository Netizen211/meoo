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

  // ========== 用户管理 ==========
  async getUsers(page = 1, pageSize = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    const res = await apiClient.get('/admin/users?' + params.toString());
    return res;
  },

  async toggleBan(userId: string, isBanned: boolean, reason?: string): Promise<boolean> {
    const res = await apiClient.put('/admin/users/' + userId, { isBanned, bannedReason: reason });
    return res.success;
  },

  async adjustMembership(userId: string, membershipLevel: string, membershipExpiresAt?: string): Promise<boolean> {
    const res = await apiClient.put('/admin/users/' + userId + '/membership', { membershipLevel, membershipExpiresAt });
    return res.success;
  },

  async createUser(data: { username: string; password: string; email?: string; role?: string; membershipLevel?: string }) {
    const res = await apiClient.post('/admin/users', data);
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

  // ========== 最近动态 ==========
  async getRecentActivity() {
    const res = await apiClient.get('/admin/recent-activity');
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

  // ========== 充值审核 ==========
  async getRechargeList(status?: string, page = 1, pageSize = 20) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    const res = await apiClient.get('/recharge/list?' + params.toString());
    return res;
  },

  async reviewRecharge(orderId: number, action: 'approve' | 'reject', note?: string) {
    const res = await apiClient.put('/recharge/review/' + orderId, { action, note });
    return res;
  },
};

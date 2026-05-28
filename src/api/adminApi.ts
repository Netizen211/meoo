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

export const adminApi = {
  // 系统概览统计
  async getStats(): Promise<AdminStats | null> {
    const res = await apiClient.get<AdminStats>('/admin/stats');
    return res.success ? res.data! : null;
  },

  // 用户列表
  async getUsers(page = 1, pageSize = 20, search?: string) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    const res = await apiClient.get(`/admin/users?${params.toString()}`);
    return res;
  },

  // 封禁/解封用户
  async toggleBan(userId: string, isBanned: boolean, reason?: string): Promise<boolean> {
    const res = await apiClient.put(`/admin/users/${userId}`, { isBanned, bannedReason: reason });
    return res.success;
  },

  // 调整会员
  async adjustMembership(userId: string, membershipLevel: string, membershipExpiresAt?: string): Promise<boolean> {
    const res = await apiClient.put(`/admin/users/${userId}/membership`, { membershipLevel, membershipExpiresAt });
    return res.success;
  },

  // 获取操作日志
  async getLogs(page = 1, pageSize = 50) {
    const res = await apiClient.get(`/admin/logs?page=${page}&pageSize=${pageSize}`);
    return res;
  },

  // 获取数据统计
  async getDataStats() {
    const res = await apiClient.get('/admin/data-stats');
    return res;
  },

  // 获取系统设置
  async getSettings() {
    const res = await apiClient.get('/admin/settings');
    return res;
  },

  // 更新系统设置
  async updateSettings(settings: Record<string, any>) {
    const res = await apiClient.put('/admin/settings', settings);
    return res;
  },

  // 生成邀请码
  async generateInviteCodes(count = 5) {
    const res = await apiClient.post<{ batchId: string; codes: string[] }>('/stores/invite/generate', { count });
    return res;
  },

  // 获取邀请码列表
  async getInviteCodes() {
    const res = await apiClient.get('/stores/invite/list');
    return res;
  },

  // 销毁邀请码
  async deleteInviteCode(code: string) {
    const res = await apiClient.delete(`/stores/invite/${code}`);
    return res.success;
  },

  // 充值审核列表
  async getRechargeList(status?: string, page = 1, pageSize = 20) {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    const res = await apiClient.get(`/recharge/list?${params.toString()}`);
    return res;
  },

  // 审核充值申请
  async reviewRecharge(orderId: number, action: 'approve' | 'reject', note?: string) {
    const res = await apiClient.put(`/recharge/review/${orderId}`, { action, note });
    return res;
  },
};

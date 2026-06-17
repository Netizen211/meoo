/**
 * useAdminData — @tanstack/react-query hooks for admin API
 *
 * 统一的数据请求层，替代手写 useEffect + useState + useCallback 模式。
 *
 * 使用示例:
 *   // 查询
 *   const { data, isLoading, error } = useAdminUsers({ page: 1, pageSize: 20 });
 *
 *   // 变更（自动刷新列表）
 *   const banMutation = useBanUser();
 *   banMutation.mutate({ userId: 'xxx', isBanned: true, reason: '违规' });
 *
 * 迁移步骤:
 *   1. import { useAdminUsers } from '../hooks/useAdminData';
 *   2. 替换 const [users] + useEffect + loadUsers()
 *   3. 替换 fetch + setUsers → useMutation
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type GetUsersParams, type AdminUser, type ConfigHistoryItem, type MembershipHistory } from '../../api/adminApi';
import { apiClient } from '../../api/client';

// ---- Query keys (用于缓存管理) ----
export const adminKeys = {
  all: ['admin'] as const,
  users: (params: GetUsersParams) => ['admin', 'users', params] as const,
  userDetail: (userId: string) => ['admin', 'user', userId] as const,
  // Analytics
  eventStats: (params: object) => ['admin', 'analytics', 'event-stats', params] as const,
  dailyActivity: (params: object) => ['admin', 'analytics', 'daily-activity', params] as const,
  events: (params: object) => ['admin', 'analytics', 'events', params] as const,
  funnelData: (params: object) => ['admin', 'analytics', 'funnel', params] as const,
  moduleRank: (params: object) => ['admin', 'analytics', 'module-rank', params] as const,
  payConversion: (params: object) => ['admin', 'analytics', 'pay-conversion', params] as const,
  // Monitoring
  aiMonitoring: (params: object) => ['admin', 'monitoring', 'ai', params] as const,
  uploadStats: (params: object) => ['admin', 'monitoring', 'upload-stats', params] as const,
  uploadFailures: (params: object) => ['admin', 'monitoring', 'upload-failures', params] as const,
  // Quality
  dataQuality: (params: object) => ['admin', 'data-quality', params] as const,
  // Risk
  riskEvents: (params: object) => ['admin', 'risk-events', params] as const,
  // Operations
  operationsOverview: (timeRange: string) => ['admin', 'operations', 'overview', timeRange] as const,
  dataStats: (params: object) => ['admin', 'data-stats', params] as const,
};

// ========== 通用工具 ==========

/** 标准分页响应类型约束 */
interface PaginatedData<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 从 standard { success, data, total, page, pageSize } 响应中提取 */
function extractPaginated<T>(res: any, fallback: T[] = []): PaginatedData<T> {
  return {
    data: (res.data ?? fallback) as T[],
    total: res.total ?? 0,
    page: res.page ?? 1,
    pageSize: res.pageSize ?? 20,
  };
}

// ========== 查询 Hooks ==========

// ---- 用户列表 (带自动缓存，翻页保留旧数据) ----
export function useAdminUsers(params: GetUsersParams = {}) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: async () => {
      const res = await adminApi.getUsers(params);
      return {
        users: (res.data || []) as AdminUser[],
        total: (res as any).total ?? 0,
        page: (res as any).page ?? 1,
        pageSize: (res as any).pageSize ?? 20,
      };
    },
    placeholderData: (prev) => prev,
  });
}

// ---- 用户详情 ----
export function useAdminUserDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', userId],
    queryFn: () => adminApi.getUserDetail(userId!),
    enabled: !!userId,
  });
}

// ========== Analytics Hooks ==========

/** 事件统计 */
export function useEventStats(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.eventStats(params),
    queryFn: () => adminApi.getEventStats(params),
    placeholderData: (prev) => prev,
  });
}

/** 每日活跃度 */
export function useDailyActivity(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.dailyActivity(params),
    queryFn: () => adminApi.getDailyActivity(params),
    placeholderData: (prev) => prev,
  });
}

/** 事件明细列表（分页） */
export function useEvents(params: {
  event_type?: string; user_id?: string;
  page?: number; pageSize?: number;
  startDate?: string; endDate?: string;
} = {}) {
  return useQuery({
    queryKey: adminKeys.events(params),
    queryFn: async () => {
      const res = await adminApi.getEvents(params);
      return extractPaginated<import('../../api/adminApi').EventRecord>(res);
    },
    placeholderData: (prev) => prev,
  });
}

/** 漏斗数据 */
export function useFunnelData(params: { funnel_name?: string; startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.funnelData(params),
    queryFn: () => adminApi.getFunnelData(params),
    placeholderData: (prev) => prev,
  });
}

/** 模块点击排行 */
export function useModuleRank(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.moduleRank(params),
    queryFn: () => adminApi.getModuleRank(params),
    placeholderData: (prev) => prev,
  });
}

/** 付费转化 */
export function usePayConversion(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.payConversion(params),
    queryFn: () => adminApi.getPayConversion(params),
    placeholderData: (prev) => prev,
  });
}

// ========== Monitoring Hooks ==========

/** AI调用监控 */
export function useAiMonitoring(params: {
  startDate?: string; endDate?: string; page?: number; pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: adminKeys.aiMonitoring(params),
    queryFn: async () => {
      const res = await adminApi.getAIMonitoring(params);
      return res.success ? res.data : { summary: {}, recent: [], total: 0, page: 1, pageSize: 20 };
    },
    placeholderData: (prev) => prev,
  });
}

/** 上传统计 */
export function useUploadStats(params: { startDate?: string; endDate?: string } = {}) {
  return useQuery({
    queryKey: adminKeys.uploadStats(params),
    queryFn: () => adminApi.getUploadStats(params),
    placeholderData: (prev) => prev,
  });
}

/** 上传失败记录（分页） */
export function useUploadFailures(params: {
  page?: number; pageSize?: number; startDate?: string; endDate?: string;
} = {}) {
  return useQuery({
    queryKey: adminKeys.uploadFailures(params),
    queryFn: async () => {
      const res = await adminApi.getUploadFailures(params);
      return res.success ? res.data : { uploads: [], total: 0, page: 1, pageSize: 20 };
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Data Quality Hooks ==========

/** 数据质量检查 */
export function useDataQuality(params: {
  store_id?: string; check_type?: string; page?: number; pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: adminKeys.dataQuality(params),
    queryFn: async () => {
      const res = await adminApi.getDataQuality(params);
      return res.success ? res.data : { summary: [], checks: [], total: 0, page: 1, pageSize: 20 };
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Risk Hooks ==========

/** 风险事件 */
export function useRiskEvents(params: {
  risk_type?: string; risk_level?: string; status?: string;
  page?: number; pageSize?: number;
} = {}) {
  return useQuery({
    queryKey: adminKeys.riskEvents(params),
    queryFn: async () => {
      const res = await adminApi.getRiskEvents(params);
      return res.success ? res.data : { summary: {}, events: [], total: 0, page: 1, pageSize: 20 };
    },
    placeholderData: (prev) => prev,
  });
}

/** 最近操作记录（管理端首页用） */
export function useRecentActivity() {
  return useQuery({
    queryKey: ['admin', 'recent-activity'],
    queryFn: async () => {
      const res = await adminApi.getRecentActivity();
      return (res?.data ?? []) as Array<{
        id: number; username: string; action: string;
        details: string; targetType: string; createdAt: string;
      }>;
    },
    refetchInterval: 60_000,  // 每分钟自动刷新
    placeholderData: (prev) => prev,
  });
}

// ========== Operations Hooks ==========

/** 运营总览（支持 refetchInterval 等选项） */
export function useOperationsOverview(timeRange = '7d', options?: { refetchInterval?: number; placeholderData?: (prev: any) => any }) {
  return useQuery({
    queryKey: adminKeys.operationsOverview(timeRange),
    queryFn: () => adminApi.getOperationsOverview(timeRange),
    placeholderData: (prev) => prev,
    ...options,
  });
}

/** 数据中心统计（返回店铺数据数组） */
export function useDataStats() {
  return useQuery({
    queryKey: ['admin', 'data-stats'],
    queryFn: async () => {
      const res = await adminApi.getDataStats();
      return res.success ? (res.data ?? []) : [];
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Invite Code Hooks ==========

/** 邀请码列表 */
export function useInviteCodes() {
  return useQuery({
    queryKey: ['admin', 'invite', 'codes'],
    queryFn: async () => {
      const res = await adminApi.getInviteCodes();
      return (res.data ?? []) as Array<{
        id: number; code: string; batchId: string;
        createdBy: string; usedBy: string; usedAt: string;
        isUsed: boolean; createdAt: string;
      }>;
    },
    placeholderData: (prev) => prev,
  });
}

/** 邀请码统计 */
export function useInviteStats(period = '30d') {
  return useQuery({
    queryKey: ['admin', 'invite', 'stats', period],
    queryFn: () => adminApi.getInviteStats(period),
    placeholderData: (prev) => prev,
  });
}

/** 生成邀请码 */
export function useGenerateInviteCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (count: number) => adminApi.generateInviteCodes(count),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'invite'] });
    },
  });
}

/** 删除邀请码 */
export function useDeleteInviteCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => adminApi.deleteInviteCode(code),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'invite', 'codes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'invite', 'stats'] });
    },
  });
}

// ========== Announcement Hooks ==========

export interface Announcement {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetRoles: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** 公告列表 */
export function useAnnouncements() {
  return useQuery({
    queryKey: ['admin', 'announcements'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/announcements');
      return (res.data ?? []) as Announcement[];
    },
    placeholderData: (prev) => prev,
  });
}

/** 创建/更新公告（有 id 为更新） */
export function useSaveAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      id?: number; title: string; content: string;
      priority: string; targetRoles?: string | null; isActive: boolean;
    }) => {
      const body = {
        title: data.title, content: data.content,
        priority: data.priority, targetRoles: data.targetRoles || null,
        isActive: data.isActive,
      };
      if (data.id) {
        return apiClient.put('/admin/announcements/' + data.id, body);
      }
      return apiClient.post('/admin/announcements', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

/** 删除公告 */
export function useDeleteAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiClient.delete('/admin/announcements/' + id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

/** 切换公告上线/下线 */
export function useToggleAnnouncement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiClient.put('/admin/announcements/' + id, { isActive }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'announcements'] });
    },
  });
}

// ========== System Settings Hooks ==========

/** 系统设置 */
export function useSystemSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => adminApi.getSettings(),
    placeholderData: (prev) => prev,
  });
}

/** 更新系统设置 */
export function useUpdateSystemSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: any) => adminApi.updateSettings(settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    },
  });
}

// ========== Config Hooks ==========

/** 全局配置 */
export function useConfig() {
  return useQuery({
    queryKey: ['admin', 'config'],
    queryFn: () => adminApi.getConfig(),
    placeholderData: (prev) => prev,
  });
}

/** 更新配置 */
export function useUpdateConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => adminApi.updateConfig(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });
}

/** 导入配置 */
export function useImportConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (configs: Record<string, any>) => adminApi.importConfigJSON(configs),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'config'] });
    },
  });
}

/** 配置变更历史 */
export function useConfigHistory(page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['admin', 'config', 'history', page, pageSize],
    queryFn: async () => {
      const res = await adminApi.getConfigHistory({ page, pageSize });
      return {
        items: (res.data ?? []) as ConfigHistoryItem[],
        total: (res as any).total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Revenue Hooks ==========

// ========== Membership Hooks ==========

/** 会员变更历史 */
export function useMembershipHistory(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'membership-history', userId],
    queryFn: async () => {
      const res = await adminApi.getMembershipHistory(1, 100, userId!);
      return (res.data ?? []) as MembershipHistory[];
    },
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 子账号列表 */
export function useSubAccounts(params: {
  page?: number; pageSize?: number;
  search?: string; parentId?: string;
} = {}) {
  return useQuery({
    queryKey: ['admin', 'sub-accounts', params],
    queryFn: async () => {
      const res = await adminApi.getSubAccounts(params);
      return {
        items: (res.data ?? []) as any[],
        total: (res as any).total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

/** 子账号日志 */
export function useSubAccountLogs(page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['admin', 'sub-account-logs', page, pageSize],
    queryFn: async () => {
      const res = await adminApi.getSubAccountLogs({ page, pageSize });
      return {
        items: (res.data ?? []) as any[],
        total: (res as any).total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

/** 父级用户列表（用于创建子账号） */
export function useParentUsers() {
  return useQuery({
    queryKey: ['admin', 'parent-users'],
    queryFn: () => adminApi.getParentUsers(),
    placeholderData: (prev) => prev,
  });
}

/** 创建子账号 */
export function useCreateSubAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; parentUserId: string; roleName?: string; phone?: string }) =>
      adminApi.createSubAccount(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-accounts'] });
    },
  });
}

/** 删除子账号 */
export function useDeleteSubAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subId: string) => adminApi.deleteSubAccount(subId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-accounts'] });
    },
  });
}

/** 启用/禁用子账号 */
export function useToggleSubAccountBan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subId, isBanned, reason }: { subId: string; isBanned: boolean; reason?: string }) =>
      adminApi.toggleSubAccountBan(subId, isBanned, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'sub-accounts'] });
    },
  });
}

// ========== System Info Hooks ==========

/** 系统信息 */
export function useSystemInfo() {
  return useQuery({
    queryKey: ['admin', 'system-info'],
    queryFn: () => adminApi.getSystemInfo(),
    placeholderData: (prev) => prev,
  });
}

/** 维护模式状态 */
export function useMaintenanceStatus() {
  return useQuery({
    queryKey: ['admin', 'maintenance'],
    queryFn: () => adminApi.getMaintenanceStatus(),
    placeholderData: (prev) => prev,
  });
}

/** 更新维护模式 */
export function useUpdateMaintenance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { enabled?: boolean; message?: string; allowedIps?: string[] }) =>
      adminApi.updateMaintenance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'maintenance'] });
    },
  });
}

/** 登录历史（分页） */
export function useLoginHistory(page: number, pageSize = 20) {
  return useQuery({
    queryKey: ['admin', 'login-history', page, pageSize],
    queryFn: async () => {
      const res = await adminApi.getLoginHistory(page, pageSize);
      return {
        items: (res.data ?? []) as any[],
        total: res.total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Revenue Hooks ==========

/** 营收概览数据 */
export function useRevenueSummary() {
  return useQuery({
    queryKey: ['admin', 'revenue', 'summary'],
    queryFn: () => adminApi.getRevenueSummary(),
    placeholderData: (prev) => prev,
  });
}

/** MRR 趋势 */
export function useMrrTrend(months = 12) {
  return useQuery({
    queryKey: ['admin', 'revenue', 'mrr-trend', months],
    queryFn: () => adminApi.getMrrTrend(months),
    placeholderData: (prev) => prev,
  });
}

/** 流失率 */
export function useChurnRate(period = 'monthly') {
  return useQuery({
    queryKey: ['admin', 'revenue', 'churn-rate', period],
    queryFn: () => adminApi.getChurnRate(period),
    placeholderData: (prev) => prev,
  });
}

/** 交易明细（分页 + 筛选） */
export function useRevenueTransactions(params: {
  page?: number; pageSize?: number; status?: string; plan?: string;
  startDate?: string; endDate?: string;
} = {}) {
  return useQuery({
    queryKey: ['admin', 'revenue', 'transactions', params],
    queryFn: async () => {
      const res = await adminApi.getRevenueTransactions(params);
      return { transactions: res.data ?? [], total: res.total ?? 0, page: res.page ?? 1 };
    },
    placeholderData: (prev) => prev,
  });
}

// ========== Recharge Hooks ==========

/** 充值列表查询（带自动分页+搜索） */
export function useRechargeList(status: string, page: number, pageSize = 20, search?: string) {
  return useQuery({
    queryKey: ['admin', 'recharge', status, page, pageSize, search],
    queryFn: async () => {
      const res = await adminApi.getRechargeList(status, page, pageSize, search);
      return {
        items: res.data ?? [],
        total: (res as any).total ?? 0,
      };
    },
    placeholderData: (prev) => prev,
  });
}

/** 单个审核操作 */
export function useReviewRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, action, note }: { orderId: number; action: 'approve' | 'reject'; note?: string }) =>
      adminApi.reviewRecharge(orderId, action, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recharge'] });
    },
  });
}

/** 批量审核操作 */
export function useBatchReviewRecharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ ids, action, note }: { ids: number[]; action: 'approve' | 'reject'; note?: string }) =>
      adminApi.batchReviewRecharge(ids, action, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'recharge'] });
    },
  });
}

// ---- 封禁/解封单个用户 ----
export function useBanUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isBanned, reason }: { userId: string; isBanned: boolean; reason?: string }) =>
      adminApi.toggleBan(userId, isBanned, reason),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'full-detail', variables.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

// ---- 批量封禁/解封 ----
export function useBatchBanUsers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, isBanned, reason }: { userIds: string[]; isBanned: boolean; reason?: string }) =>
      adminApi.batchToggleBan(userIds, isBanned, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
  });
}

// ---- 批量通知 ----
export function useBatchNotify() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userIds, message }: { userIds: string[]; message: string }) =>
      adminApi.batchNotify(userIds, message),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
  });
}

// ---- 创建用户 ----
export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { username: string; password: string; email?: string; role?: string; membershipLevel?: string }) =>
      adminApi.createUser(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
  });
}

// ---- 调整会员等级 ----
export function useAdjustMembership() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, membershipLevel, expiresAt, note }: {
      userId: string; membershipLevel: string; expiresAt?: string; note?: string;
    }) => adminApi.adjustMembership(userId, membershipLevel, expiresAt, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.users({}) });
    },
  });
}

// ========== User Detail Hooks ==========

/** 用户完整档案（含profile/stores/recharge/sessions等所有Tab数据） */
export function useUserFullDetail(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', 'full-detail', userId],
    queryFn: () => adminApi.getUserFullDetail(userId!),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 用户备注（单独查询，用于编辑表单同步） */
export function useUserNote(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', 'note', userId],
    queryFn: () => adminApi.getUserNote(userId!),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 更新用户备注 */
export function useUpdateUserNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, note }: { userId: string; note: string }) =>
      adminApi.updateUserNote(userId, note),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'note', variables.userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'full-detail', variables.userId] });
    },
  });
}

/** 重置用户密码 */
export function useResetUserPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, newPassword }: { userId: string; newPassword: string }) =>
      adminApi.resetUserPassword(userId, newPassword),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'full-detail', variables.userId] });
    },
  });
}

/** 强制下线所有会话 */
export function useRevokeAllSessions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.revokeAllSessions(userId),
    onSuccess: (_data, userId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'full-detail', userId] });
    },
  });
}

/** 撤销单个会话 */
export function useRevokeSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, sessionId }: { userId: string; sessionId: string }) =>
      adminApi.revokeSession(userId, sessionId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['admin', 'user', 'full-detail', variables.userId] });
    },
  });
}

/** 删除用户账号 */
export function useDeleteUserAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => adminApi.deleteUserAccount(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
    },
  });
}

/** 用户行为时间线 */
export function useUserTimeline(userId: string | undefined, days = 30) {
  return useQuery({
    queryKey: ['admin', 'user', 'timeline', userId, days],
    queryFn: () => adminApi.getUserTimeline(userId!, days),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 用户模块点击统计 */
export function useUserModuleClicks(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', 'module-clicks', userId],
    queryFn: () => adminApi.getUserModuleClicks(userId!),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 用户风险事件 */
export function useUserRiskEvents(userId: string | undefined) {
  return useQuery({
    queryKey: ['admin', 'user', 'risk-events', userId],
    queryFn: () => adminApi.getUserRiskEvents(userId!),
    enabled: !!userId,
    placeholderData: (prev) => prev,
  });
}

/** 管理员Badge计数（侧边栏用，自动60s刷新） */
export function useAdminBadges() {
  return useQuery({
    queryKey: ['admin', 'badges'],
    queryFn: async () => {
      const [statsRes, rechargeRes] = await Promise.all([
        adminApi.getStats(),
        adminApi.getRechargeList('pending', 1, 1),
      ]);
      return {
        pendingRecharge: (rechargeRes as any)?.total ?? 0,
        totalUsers: statsRes?.totalUsers ?? 0,
      };
    },
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  });
}

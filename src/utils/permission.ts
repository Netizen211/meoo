// 统一权限判断模块
// 所有页面和组件都用这里的方法判断权限，不要各自判断

export interface PermissionUser {
  id?: string;
  username?: string;
  role?: 'normal' | 'test' | 'admin' | string;
  membershipLevel?: 'free' | 'pro' | 'enterprise' | string;
  membershipExpiresAt?: string | null;
}

/**
 * 是否为完整功能会员
 * test / admin / pro / enterprise 都可以使用全部功能
 */
export function isFullMember(user: PermissionUser | null | undefined): boolean {
  if (!user) return false;
  return (
    user.role === 'test' ||
    user.role === 'admin' ||
    user.membershipLevel === 'pro' ||
    user.membershipLevel === 'enterprise'
  );
}

/**
 * 是否为管理员（可访问后台管理）
 */
export function isAdmin(user: PermissionUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === 'admin' || user.role === 'test';
}

/**
 * 是否为免费用户
 */
export function isFreeUser(user: PermissionUser | null | undefined): boolean {
  if (!user) return true;
  return (
    user.role !== 'test' &&
    user.role !== 'admin' &&
    (user.membershipLevel === 'free' || !user.membershipLevel)
  );
}

/**
 * 免费用户可访问的页面列表
 */
const FREE_ALLOWED_PAGES = new Set([
  '/dashboard',
  '/upload',
  '/stores',
  '/membership',
  '/settings',
  '/product',
  '/user',
  '/trend',
  '/region',
  '/cost-management',
]);

/**
 * 判断免费用户是否可以访问某个页面路由
 * 免费用户可以进页面看到基础数据，但高级指标和操作被锁定
 */
export function canAccessPage(
  user: PermissionUser | null | undefined,
  path: string
): boolean {
  if (isFullMember(user)) return true;
  // 免费用户可以访问所有页面，但看到的内容被锁定
  return true;
}

/**
 * 功能级别权限：判断是否可以查看高级指标
 */
export function canViewAdvancedMetrics(user: PermissionUser | null | undefined): boolean {
  return isFullMember(user);
}

/**
 * 功能级别权限：判断是否可以导出数据
 */
export function canExport(user: PermissionUser | null | undefined): boolean {
  return isFullMember(user);
}

/**
 * 功能级别权限：判断是否可以使用 AI 分析
 * 还需要后台 AI 开关已启用
 */
export function canUseAI(
  user: PermissionUser | null | undefined,
  aiEnabled?: boolean,
  dailyLimit?: number,
  dailyUsed?: number
): { allowed: boolean; reason: string } {
  if (!isFullMember(user)) {
    return { allowed: false, reason: 'AI 分析为会员专属功能，请先升级' };
  }
  if (aiEnabled === false) {
    return { allowed: false, reason: 'AI 分析暂未开启' };
  }
  if (dailyLimit != null && dailyUsed != null && dailyUsed >= dailyLimit) {
    return { allowed: false, reason: `今日 AI 调用次数已达上限（${dailyLimit}次）` };
  }
  return { allowed: true, reason: '' };
}

/**
 * 获取会员等级中文名
 */
export function getMembershipLabel(level: string): string {
  switch (level) {
    case 'enterprise': return '企业版';
    case 'pro': return '全功能会员';
    case 'free':
    default: return '免费版';
  }
}

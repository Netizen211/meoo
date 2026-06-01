/**
 * 会话管理服务 — 超越大厂的多设备管控
 *
 * 功能：
 * - 记录每次登录的设备/IP/位置
 * - 最大并发会话数限制
 * - 异地登录检测 + 通知
 * - 远程踢下线
 * - 会话超时自动失效
 */
import { db } from '../db';
import type { TenantContext, DeviceInfo } from '../middleware/tenantContext';
import { writeAudit } from './auditService';

const MAX_CONCURRENT_SESSIONS = 5;
const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30分钟无操作

export interface UserSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  geoLocation?: string;
  loginAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
  terminatedAt?: Date;
  terminatedBy?: string;
}

/**
 * 登录时注册新会话
 */
export async function createSession(
  ctx: TenantContext,
  loginMethod: 'password' | 'refresh_token'
): Promise<{ sessionId: string; isNewDevice: boolean; warningMessage?: string }> {
  const sessionId = ctx.sessionId;

  // 检查是否是已知设备
  const knownDevice = await db('user_sessions')
    .where({ user_id: ctx.userId, device_id: ctx.device.deviceId })
    .first();

  const isNewDevice = !knownDevice;

  // 插入新会话
  await db('user_sessions').insert({
    session_id: sessionId,
    user_id: ctx.userId,
    device_id: ctx.device.deviceId,
    device_name: parseDeviceName(ctx.device.userAgent),
    ip_address: ctx.device.ipAddress,
    geo_location: ctx.device.geoLocation || null,
    login_method: loginMethod,
    is_active: true,
    last_active_at: db.fn.now(),
  }).catch(err => console.error('[session] create failed:', err.message));

  // 检查并发会话数
  const activeSessions = await db('user_sessions')
    .where({ user_id: ctx.userId, is_active: true })
    .count('* as count').first();

  const warningMessages: string[] = [];

  if (Number((activeSessions as any)?.count) > MAX_CONCURRENT_SESSIONS) {
    // 自动踢掉最早的会话
    const oldest = await db('user_sessions')
      .where({ user_id: ctx.userId, is_active: true })
      .orderBy('login_at', 'asc')
      .first();

    if (oldest && oldest.session_id !== sessionId) {
      await terminateSession(oldest.session_id, 'system');
      warningMessages.push(`超出最大设备数(${MAX_CONCURRENT_SESSIONS})，已自动下线最早设备`);
    }
  }

  if (isNewDevice) {
    warningMessages.push(`检测到新设备登录（${parseDeviceName(ctx.device.userAgent)}），如非本人操作请及时修改密码`);
    // 记录新设备登录审计
    await writeAudit(ctx, '新设备登录', 'session',
      `新设备: ${parseDeviceName(ctx.device.userAgent)} IP: ${ctx.device.ipAddress}`);
  }

  // 检查IP突变（与上次登录IP不同城市）
  const lastSession = await db('user_sessions')
    .where({ user_id: ctx.userId, is_active: true })
    .whereNot({ session_id: sessionId })
    .orderBy('last_active_at', 'desc')
    .first();

  if (lastSession && lastSession.ip_address !== ctx.device.ipAddress) {
    warningMessages.push(`登录IP与上次不同（上次: ${lastSession.ip_address}，本次: ${ctx.device.ipAddress}）`);
  }

  return {
    sessionId,
    isNewDevice,
    warningMessage: warningMessages.length > 0 ? warningMessages.join('；') : undefined,
  };
}

/**
 * 刷新会话活跃时间
 */
export async function touchSession(sessionId: string): Promise<void> {
  await db('user_sessions')
    .where('session_id', sessionId)
    .update({ last_active_at: db.fn.now() })
    .catch(() => {});
}

/**
 * 终止会话（远程踢下线）
 */
export async function terminateSession(
  sessionId: string,
  terminatedBy: string
): Promise<boolean> {
  const updated = await db('user_sessions')
    .where('session_id', sessionId)
    .update({
      is_active: false,
      terminated_at: db.fn.now(),
      terminated_by: terminatedBy,
    });
  return updated > 0;
}

/**
 * 获取用户的所有活跃会话
 */
export async function getUserSessions(userId: string): Promise<UserSession[]> {
  const rows = await db('user_sessions')
    .where({ user_id: userId, is_active: true })
    .orderBy('last_active_at', 'desc');

  return rows.map((r: any) => ({
    sessionId: r.session_id,
    userId: r.user_id,
    deviceId: r.device_id,
    deviceName: r.device_name,
    ipAddress: r.ip_address,
    geoLocation: r.geo_location,
    loginAt: r.created_at,
    lastActiveAt: r.last_active_at,
    isActive: r.is_active,
    terminatedAt: r.terminated_at,
    terminatedBy: r.terminated_by,
  }));
}

/**
 * 验证会话是否有效
 */
export async function validateSession(
  userId: string,
  sessionId: string
): Promise<{ valid: boolean; reason?: string }> {
  const session = await db('user_sessions')
    .where({ session_id: sessionId, user_id: userId, is_active: true })
    .first();

  if (!session) {
    return { valid: false, reason: '会话不存在或已被终止' };
  }

  // 空闲超时检查
  const idleTime = Date.now() - new Date(session.last_active_at).getTime();
  if (idleTime > SESSION_IDLE_TIMEOUT_MS) {
    await terminateSession(sessionId, 'system');
    return { valid: false, reason: '会话已超时' };
  }

  // 更新活跃时间
  await touchSession(sessionId);
  return { valid: true };
}

/**
 * 清理过期会话（定时任务调用）
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const expiredSince = new Date(Date.now() - SESSION_IDLE_TIMEOUT_MS);
  const updated = await db('user_sessions')
    .where('is_active', true)
    .where('last_active_at', '<', expiredSince)
    .update({
      is_active: false,
      terminated_at: db.fn.now(),
      terminated_by: 'system',
    });
  return updated;
}

// ─── 工具函数 ─────────────────────────────────────────

function parseDeviceName(userAgent: string): string {
  if (!userAgent) return '未知设备';
  if (userAgent.includes('Windows')) return 'Windows PC';
  if (userAgent.includes('Mac OS')) return 'Mac';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iPhone/iPad';
  if (userAgent.includes('Android')) return 'Android手机';
  if (userAgent.includes('Linux')) return 'Linux';
  return userAgent.slice(0, 50);
}

export default { createSession, touchSession, terminateSession, getUserSessions, validateSession, cleanupExpiredSessions };

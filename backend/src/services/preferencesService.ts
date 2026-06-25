/**
 * 用户偏好服务 (User Preferences Service)
 *
 * 企业级用户偏好管理系统，替代前端 localStorage 直读方案。
 * 提供全局统一的偏好存取，支持：
 * - 跨设备/跨浏览器偏好同步
 * - 乐观锁版本控制（冲突检测）
 * - 批量读写（减少 API 调用）
 * - SSE 实时推送（多端即时同步）
 *
 * 设计原则：
 * - 所有偏好值存为 JSON，支持任意结构（数组、对象、标量）
 * - 每个用户每个 key 唯一，upsert 语义
 * - 版本号递增，客户端携带 version 做冲突检测
 */
import { db } from '../db';
import { sse } from './sseService';
import logger from './loggerService';

const TABLE = 'user_preferences';

export interface PreferenceRecord {
  id?: number;
  userId: string;
  prefKey: string;
  prefValue: any;
  version: number;
  updatedAt: Date;
}

// ===== 常量定义：所有支持的偏好 key =====
// 集中注册，防止拼写错误，便于审计
export const PREFERENCE_KEYS = {
  // 产品页
  PRODUCT_VISIBLE_KPIS: 'product_visible_kpis',
  PRODUCT_KPI_ORDER: 'product_kpi_order',

  // 仪表盘
  DASHBOARD_VISIBLE_KPIS: 'dashboard_visible_kpis',
  DASHBOARD_KPI_ORDER: 'dashboard_kpi_order',
  DASHBOARD_TREND_KPIS: 'dashboard_trend_kpis',
  DASHBOARD_HIDDEN_COLS: 'dashboard_hidden_cols',
  DASHBOARD_PINNED_COLS: 'dashboard_pinned_cols',
  DASHBOARD_CUSTOM_COSTS: 'dashboard_custom_costs',

  // 筛选器
  SAVED_FILTERS: 'saved_filters',
  FILTER_HISTORY: 'filter_history',
  SAVED_RANGES: 'saved_ranges',

  // 搜索
  SEARCH_HISTORY: 'search_history',

  // 主题
  DARK_MODE: 'dark_mode',

  // 成本页
  COST_ACTIVE_TAB: 'cost_active_tab',
  COURIER_RATES: 'courier_rates',

  // 上次店铺
  LAST_STORE: 'last_store',
} as const;

export type PreferenceKey = (typeof PREFERENCE_KEYS)[keyof typeof PREFERENCE_KEYS];

// ===== CRUD 操作 =====

/**
 * 获取用户所有偏好（全量加载，仅在登录/页面初始化时调用）
 */
export async function getAllPreferences(userId: string): Promise<Record<string, { value: any; version: number }>> {
  try {
    const rows = await db(TABLE)
      .where('user_id', userId)
      .select('pref_key', 'pref_value', 'version');

    const result: Record<string, { value: any; version: number }> = {};
    for (const row of rows) {
      try {
        result[row.pref_key] = {
          value: typeof row.pref_value === 'string' ? JSON.parse(row.pref_value) : row.pref_value,
          version: row.version,
        };
      } catch {
        result[row.pref_key] = { value: row.pref_value, version: row.version };
      }
    }
    return result;
  } catch (error: any) {
    logger.error('Failed to fetch all preferences', { extra: { userId, error: error.message } });
    return {};
  }
}

/**
 * 获取单个偏好值
 */
export async function getPreference(userId: string, key: string): Promise<{ value: any; version: number } | null> {
  try {
    const row = await db(TABLE)
      .where('user_id', userId)
      .andWhere('pref_key', key)
      .first();

    if (!row) return null;

    let value = row.pref_value;
    if (typeof value === 'string') {
      try { value = JSON.parse(value); } catch { /* leave as string */ }
    }
    return { value, version: row.version };
  } catch (error: any) {
    logger.error('Failed to fetch preference', { extra: { userId, key, error: error.message } });
    return null;
  }
}

/**
 * 设置偏好值（upsert 语义）
 *
 * @param userId 用户ID
 * @param key 偏好key
 * @param value 偏好值（任意可JSON序列化的值）
 * @param expectedVersion 可选，乐观锁：提供后做版本比对，版本不匹配则拒绝写入
 * @returns { success: boolean, version: number, conflict: boolean }
 */
export async function setPreference(
  userId: string,
  key: string,
  value: any,
  expectedVersion?: number,
): Promise<{ success: boolean; version: number; conflict: boolean }> {
  try {
    // 先检查是否已存在
    const existing = await db(TABLE)
      .where('user_id', userId)
      .andWhere('pref_key', key)
      .first();

    if (existing) {
      // 版本冲突检测
      if (expectedVersion !== undefined && existing.version !== expectedVersion) {
        return {
          success: false,
          version: existing.version,
          conflict: true,
        };
      }

      await db(TABLE)
        .where('user_id', userId)
        .andWhere('pref_key', key)
        .update({
          pref_value: JSON.stringify(value),
          version: existing.version + 1,
          updated_at: db.fn.now(),
        });

      // ★ SSE 广播到该用户的其他设备
      sse.sendToUser(userId, 'preference:updated', {
        key,
        value,
        version: existing.version + 1,
      });

      return { success: true, version: existing.version + 1, conflict: false };
    } else {
      // 首次创建
      await db(TABLE).insert({
        user_id: userId,
        pref_key: key,
        pref_value: JSON.stringify(value),
        version: 1,
        updated_at: db.fn.now(),
      });

      return { success: true, version: 1, conflict: false };
    }
  } catch (error: any) {
    logger.error('Failed to set preference', { extra: { userId, key, error: error.message } });
    return { success: false, version: 0, conflict: false };
  }
}

/**
 * 批量设置偏好（原子操作，用于页面卸载时一次性保存）
 */
export async function setPreferencesBatch(
  userId: string,
  prefs: Array<{ key: string; value: any; version?: number }>,
): Promise<{ success: boolean; results: Array<{ key: string; version: number; conflict: boolean }> }> {
  const results: Array<{ key: string; version: number; conflict: boolean }> = [];

  // 使用事务保证原子性
  const trx = await db.transaction();

  try {
    for (const pref of prefs) {
      const existing = await trx(TABLE)
        .where('user_id', userId)
        .andWhere('pref_key', pref.key)
        .first();

      if (existing) {
        if (pref.version !== undefined && existing.version !== pref.version) {
          results.push({ key: pref.key, version: existing.version, conflict: true });
          continue;
        }
        await trx(TABLE)
          .where('user_id', userId)
          .andWhere('pref_key', pref.key)
          .update({
            pref_value: JSON.stringify(pref.value),
            version: existing.version + 1,
            updated_at: db.fn.now(),
          });
        results.push({ key: pref.key, version: existing.version + 1, conflict: false });

        // 发送 SSE
        sse.sendToUser(userId, 'preference:updated', {
          key: pref.key,
          value: pref.value,
          version: existing.version + 1,
        });
      } else {
        await trx(TABLE).insert({
          user_id: userId,
          pref_key: pref.key,
          pref_value: JSON.stringify(pref.value),
          version: 1,
          updated_at: db.fn.now(),
        });
        results.push({ key: pref.key, version: 1, conflict: false });
      }
    }

    await trx.commit();
    return { success: true, results };
  } catch (error: any) {
    await trx.rollback();
    logger.error('Failed to batch set preferences', { extra: { userId, error: error.message } });
    return { success: false, results };
  }
}

/**
 * 删除偏好
 */
export async function deletePreference(userId: string, key: string): Promise<boolean> {
  try {
    await db(TABLE)
      .where('user_id', userId)
      .andWhere('pref_key', key)
      .delete();

    sse.sendToUser(userId, 'preference:deleted', { key });
    return true;
  } catch (error: any) {
    logger.error('Failed to delete preference', { extra: { userId, key, error: error.message } });
    return false;
  }
}

/**
 * 将旧 localStorage 中的偏好迁移到服务端
 * 用于已有用户在迁移后首次访问时，自动同步其旧的本地设置
 */
export async function migrateFromLocalStorage(
  userId: string,
  oldPrefs: Record<string, any>,
): Promise<number> {
  let migrated = 0;
  const validKeys = new Set(Object.values(PREFERENCE_KEYS));

  for (const [key, value] of Object.entries(oldPrefs)) {
    // 只迁移已知的偏好 key
    const normalizedKey = key.replace(/^dianfx_/, '');
    if (validKeys.has(normalizedKey as PreferenceKey)) {
      const result = await setPreference(userId, normalizedKey, value);
      if (result.success) migrated++;
    }
  }
  return migrated;
}

export default {
  getAllPreferences,
  getPreference,
  setPreference,
  setPreferencesBatch,
  deletePreference,
  migrateFromLocalStorage,
  PREFERENCE_KEYS,
};

import { db } from '../../db';
import { config } from '../../config';

/**
 * 获取系统配置值
 */
export async function getConfigValue(key: string): Promise<string | null> {
  const row = await db('system_configs').where('config_key', key).first();
  return row ? row.config_value : null;
}

/**
 * 设置系统配置值
 */
export async function setConfigValue(key: string, value: string): Promise<void> {
  const existing = await db('system_configs').where('config_key', key).first();
  if (existing) {
    await db('system_configs').where('config_key', key).update({
      config_value: value, updated_at: db.fn.now(),
    });
  } else {
    await db('system_configs').insert({
      config_key: key, config_value: value, updated_at: db.fn.now(),
    });
  }
}

/**
 * 记录配置变更历史 + 审计日志
 */
export async function recordConfigHistory(
  configKey: string, oldValue: string | null, newValue: string,
  userId: string, ip: string,
): Promise<void> {
  await db('config_history').insert({
    config_key: configKey, old_value: oldValue, new_value: newValue,
    changed_by: userId, changed_at: db.fn.now(), ip_address: ip,
  });
  await db('admin_logs').insert({
    admin_id: userId, action: 'system_config',
    target_type: 'system', target_id: configKey,
    details: '更新配置: ' + configKey, ip_address: ip,
  });
}

/**
 * 检查新分析表是否已创建（用于优雅降级）
 */
export async function checkTableExists(tableName: string): Promise<boolean> {
  try {
    const result = await db.raw(
      "SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = ? AND table_name = ?",
      [(config as any).db.database, tableName]
    );
    return (result as any)[0]?.[0]?.cnt > 0;
  } catch { return false; }
}

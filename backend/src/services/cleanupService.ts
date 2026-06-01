import { db } from '../db';
import { config } from '../config';

// 每天凌晨 3 点执行（UTC+8）
export function startCleanupCron(): void {
  // 动态导入 node-cron 避免阻塞启动
  const cron = require('node-cron');

  cron.schedule('0 3 * * *', async () => {
    console.log('[cleanup] Starting daily cleanup...');
    try {
      await cleanupExpiredProUsers();
      console.log('[cleanup] Daily cleanup completed');
    } catch (err) {
      console.error('[cleanup] Error during cleanup:', err);
    }
  });

  console.log('[cleanup] Cron job scheduled (daily at 3:00 AM)');
}

async function cleanupExpiredProUsers(): Promise<void> {
  const graceMs = config.membership.proGraceDays * 24 * 60 * 60 * 1000;
  const cutoffDate = new Date(Date.now() - graceMs);

  // 查找 Pro 会员已过期超过宽限期的用户
  const expiredUsers = await db('users')
    .where('membership_level', 'pro')
    .where('membership_expires_at', '<', cutoffDate)
    .where('membership_expires_at', '>', '2020-01-01'); // 排除空值

  if (expiredUsers.length === 0) {
    console.log('[cleanup] No expired Pro users to clean up');
    return;
  }

  console.log(`[cleanup] Found ${expiredUsers.length} expired Pro users`);

  for (const user of expiredUsers) {
    console.log(`[cleanup] Cleaning up user: ${user.username} (${user.id})`);

    // 获取用户的所有店铺
    const stores = await db('stores').where('user_id', user.id);

    for (const store of stores) {
      // 删除店铺数据
      await db('store_data').where('store_id', store.id).del();
      await db('store_configs').where('store_id', store.id).del();
      await db('store_available_fields').where('store_id', store.id).del();
      await db('upload_records').where('store_id', store.id).del();
    }

    // 删除店铺
    await db('stores').where('user_id', user.id).del();

    // 撤销 refresh tokens
    await db('refresh_tokens').where('user_id', user.id).update({ revoked_at: new Date() });

    // 降级为免费用户
    await db('users').where('id', user.id).update({
      membership_level: 'free',
      membership_expires_at: null,
    });

    // 记录操作日志
    await db('admin_logs').insert({
      admin_id: 'system',
      action: 'auto_cleanup_expired',
      target_type: 'user',
      target_id: user.id,
      details: `Pro 会员过期超过${config.membership.proGraceDays}天，自动清除数据并降级为免费用户`,
    });
  }

  console.log(`[cleanup] Cleaned up ${expiredUsers.length} expired users`);
}

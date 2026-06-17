import { db } from '../db';

// 默认阈值（当 system_configs 中未配置时使用）
const DEFAULTS = {
  ABNORMAL_LOGIN_IPS: 5,       // 1小时内不同IP数
  MASS_EXPORT_COUNT: 10,       // 1小时内导出次数
  AI_MISUSE_COUNT: 50,         // 1小时内AI调用次数
  ADMIN_BATCH_BAN_COUNT: 3,    // 1小时内批量封禁次数
};

// 从 system_configs 读取阈值配置（带缓存，每次检测周期重新读取）
async function getThreshold(key: string, defaultValue: number): Promise<number> {
  try {
    const row = await db('system_configs').where('config_key', key).first();
    if (row) {
      const val = parseInt((row as any).config_value, 10);
      if (!isNaN(val) && val > 0) return val;
    }
  } catch {
    // 表不存在或读取失败时使用默认值
  }
  return defaultValue;
}

// 每 5 分钟检测异常行为并写入 risk_events 表
export function startRiskDetection(): void {
  const cron = require('node-cron');

  cron.schedule('*/5 * * * *', async () => {
    try {
      // 每次周期重新读取阈值，支持热更新
      const thresholds = {
        abnormalLoginIps: await getThreshold('risk_abnormal_login_ips', DEFAULTS.ABNORMAL_LOGIN_IPS),
        massExportCount: await getThreshold('risk_mass_export_count', DEFAULTS.MASS_EXPORT_COUNT),
        aiMisuseCount: await getThreshold('risk_ai_misuse_count', DEFAULTS.AI_MISUSE_COUNT),
        adminBatchBanCount: await getThreshold('risk_admin_batch_ban_count', DEFAULTS.ADMIN_BATCH_BAN_COUNT),
      };

      console.log(`[risk] Starting detection (thresholds: ${JSON.stringify(thresholds)})...`);
      await detectAbnormalLogin(thresholds.abnormalLoginIps);
      await detectMassExport(thresholds.massExportCount);
      await detectAIMisuse(thresholds.aiMisuseCount);
      await detectAdminHighRisk(thresholds.adminBatchBanCount);
      console.log('[risk] Detection cycle completed');
    } catch (err) {
      console.error('[risk] Detection error:', err);
    }
  });

  console.log('[risk] Risk detection cron scheduled (every 5 minutes)');
}

// ===== 检测规则 1: 异常登录 =====
async function detectAbnormalLogin(thresholdIps: number): Promise<void> {
  try {
    const hasSessions = await db.schema.hasTable('user_sessions');
    if (!hasSessions) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const suspicious = await db('user_sessions')
      .select('user_id')
      .where('created_at', '>=', oneHourAgo)
      .groupBy('user_id')
      .havingRaw('COUNT(DISTINCT ip_address) >= ?', [thresholdIps]);

    for (const row of suspicious) {
      const userId = (row as any).user_id;
      if (!userId) continue;

      const existing = await db('risk_events')
        .where('user_id', userId)
        .where('risk_type', 'abnormal_login')
        .where('status', 'open')
        .where('created_at', '>=', oneHourAgo)
        .first();

      if (!existing) {
        await db('risk_events').insert({
          risk_type: 'abnormal_login',
          risk_level: 'high',
          user_id: userId,
          description: `1小时内从${thresholdIps}个以上不同IP登录`,
          event_data: JSON.stringify({ detected_at: new Date().toISOString(), threshold: thresholdIps }),
          status: 'open',
          created_at: new Date(),
        });
        console.log(`[risk] Abnormal login detected: user ${userId}`);
      }
    }
  } catch (err) {
    console.error('[risk] detectAbnormalLogin error:', err);
  }
}

// ===== 检测规则 2: 大量导出 =====
async function detectMassExport(thresholdExports: number): Promise<void> {
  try {
    const hasEvents = await db.schema.hasTable('user_events');
    if (!hasEvents) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const suspicious = await db('user_events')
      .select('user_id')
      .where('event_type', 'export_click')
      .where('created_at', '>=', oneHourAgo)
      .groupBy('user_id')
      .havingRaw('COUNT(*) > ?', [thresholdExports]);

    for (const row of suspicious) {
      const userId = (row as any).user_id;
      if (!userId) continue;

      const existing = await db('risk_events')
        .where('user_id', userId)
        .where('risk_type', 'mass_export')
        .where('status', 'open')
        .where('created_at', '>=', oneHourAgo)
        .first();

      if (!existing) {
        await db('risk_events').insert({
          risk_type: 'mass_export',
          risk_level: 'high',
          user_id: userId,
          description: `1小时内导出数据超过${thresholdExports}次`,
          event_data: JSON.stringify({ detected_at: new Date().toISOString(), threshold: thresholdExports }),
          status: 'open',
          created_at: new Date(),
        });
        console.log(`[risk] Mass export detected: user ${userId}`);
      }
    }
  } catch (err) {
    console.error('[risk] detectMassExport error:', err);
  }
}

// ===== 检测规则 3: AI 滥用 =====
async function detectAIMisuse(thresholdCalls: number): Promise<void> {
  try {
    const hasAiLogs = await db.schema.hasTable('ai_call_logs');
    if (!hasAiLogs) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const suspicious = await db('ai_call_logs')
      .select('user_id')
      .where('created_at', '>=', oneHourAgo)
      .groupBy('user_id')
      .havingRaw('COUNT(*) > ?', [thresholdCalls]);

    for (const row of suspicious) {
      const userId = (row as any).user_id;
      if (!userId) continue;

      const existing = await db('risk_events')
        .where('user_id', userId)
        .where('risk_type', 'ai_misuse')
        .where('status', 'open')
        .where('created_at', '>=', oneHourAgo)
        .first();

      if (!existing) {
        await db('risk_events').insert({
          risk_type: 'ai_misuse',
          risk_level: 'medium',
          user_id: userId,
          description: `1小时内AI调用超过${thresholdCalls}次`,
          event_data: JSON.stringify({ detected_at: new Date().toISOString(), threshold: thresholdCalls }),
          status: 'open',
          created_at: new Date(),
        });
        console.log(`[risk] AI misuse detected: user ${userId}`);
      }
    }
  } catch (err) {
    console.error('[risk] detectAIMisuse error:', err);
  }
}

// ===== 检测规则 4: 管理员高危操作 =====
async function detectAdminHighRisk(thresholdBans: number): Promise<void> {
  try {
    const hasLogs = await db.schema.hasTable('admin_logs');
    if (!hasLogs) return;

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const batchBans = await db('admin_logs')
      .select('admin_id')
      .where('action', 'batch_ban')
      .where('created_at', '>=', oneHourAgo)
      .groupBy('admin_id')
      .havingRaw('COUNT(*) >= ?', [thresholdBans]);

    for (const row of batchBans) {
      const adminId = (row as any).admin_id;
      if (!adminId) continue;

      const existing = await db('risk_events')
        .where('user_id', adminId)
        .where('risk_type', 'admin_high_risk')
        .where('status', 'open')
        .where('created_at', '>=', oneHourAgo)
        .first();

      if (!existing) {
        await db('risk_events').insert({
          risk_type: 'admin_high_risk',
          risk_level: 'high',
          user_id: adminId,
          description: `管理员一小时内执行了${thresholdBans}次以上批量封禁操作`,
          event_data: JSON.stringify({ detected_at: new Date().toISOString(), threshold: thresholdBans }),
          status: 'open',
          created_at: new Date(),
        });
        console.log(`[risk] Admin high-risk detected: admin ${adminId}`);
      }
    }
  } catch (err) {
    console.error('[risk] detectAdminHighRisk error:', err);
  }
}


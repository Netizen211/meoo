/**
 * 配置路由 — 系统设置、业务配置、配置历史
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import { getConfigValue, setConfigValue, recordConfigHistory } from './helpers';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

// ==================== 系统设置 ====================

// GET /api/admin/settings
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const aiRows = await db('ai_config').select('config_key', 'config_value');
    const aiConfig: Record<string, string> = {};
    for (const row of aiRows as any[]) aiConfig[row.config_key] = row.config_value;

    const sysRows = await db('system_configs').select('config_key', 'config_value');
    const sysConfig: Record<string, string> = {};
    for (const row of sysRows as any[]) sysConfig[row.config_key] = row.config_value;

    res.json({
      success: true,
      data: {
        registrationOpen: sysConfig.registration_open !== 'false',
        inviteCodeRequired: sysConfig.invite_code_required !== 'false',
        proGraceDays: parseInt(sysConfig.pro_grace_days ?? '30', 10),
        membershipReminderDays: parseInt(sysConfig.membership_reminder_days ?? '7', 10),
        freeDataRetentionDays: parseInt(sysConfig.free_data_retention_days ?? '3', 10),
        cleanupCron: sysConfig.cleanup_cron || '0 3 * * *',
        dataRetentionDays: parseInt(sysConfig.data_retention_days ?? '365', 10),
        maxLoginAttempts: parseInt(sysConfig.max_login_attempts ?? '5', 10),
        tokenExpiresMinutes: parseInt(sysConfig.token_expires_minutes ?? '15', 10),
        wecomWebhook: sysConfig.wecom_webhook || '',
        dingtalkWebhook: sysConfig.dingtalk_webhook || '',
        copyEnabled: sysConfig.copy_enabled !== 'false',
        aiEnabled: aiConfig.ai_enabled === 'true',
        aiApiKey: aiConfig.ai_api_key || '',
        aiDailyLimit: parseInt(aiConfig.ai_daily_limit ?? '10', 10),
        aiModel: aiConfig.ai_model || 'claude-sonnet-4-6',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取设置失败' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    const userId = req.user!.userId;
    const ip = req.ip || '';

    if (settings.aiEnabled !== undefined) {
      await db('ai_config').where('config_key', 'ai_enabled').update({
        config_value: settings.aiEnabled ? 'true' : 'false', updated_at: db.fn.now(),
      });
      await recordConfigHistory('ai_enabled', null, String(settings.aiEnabled), userId, ip);
    }
    if (settings.aiApiKey !== undefined) {
      await db('ai_config').where('config_key', 'ai_api_key').update({
        config_value: settings.aiApiKey, updated_at: db.fn.now(),
      });
      await recordConfigHistory('ai_api_key', null, '***', userId, ip);
    }
    if (settings.aiDailyLimit !== undefined) {
      await db('ai_config').where('config_key', 'ai_daily_limit').update({
        config_value: String(settings.aiDailyLimit), updated_at: db.fn.now(),
      });
      await recordConfigHistory('ai_daily_limit', null, String(settings.aiDailyLimit), userId, ip);
    }
    if (settings.aiModel !== undefined) {
      await db('ai_config').where('config_key', 'ai_model').update({
        config_value: settings.aiModel, updated_at: db.fn.now(),
      });
      await recordConfigHistory('ai_model', null, settings.aiModel, userId, ip);
    }

    const configMap: Record<string, string> = {
      registrationOpen: 'registration_open',
      inviteCodeRequired: 'invite_code_required',
      proGraceDays: 'pro_grace_days',
      membershipReminderDays: 'membership_reminder_days',
      freeDataRetentionDays: 'free_data_retention_days',
      cleanupCron: 'cleanup_cron',
      dataRetentionDays: 'data_retention_days',
      maxLoginAttempts: 'max_login_attempts',
      tokenExpiresMinutes: 'token_expires_minutes',
      wecomWebhook: 'wecom_webhook',
      dingtalkWebhook: 'dingtalk_webhook',
      copyEnabled: 'copy_enabled',
    };

    for (const [field, dbKey] of Object.entries(configMap)) {
      if (settings[field] !== undefined) {
        const oldRow = await db('system_configs').where('config_key', dbKey).first();
        const oldVal = oldRow ? oldRow.config_value : null;
        const newVal = typeof settings[field] === 'boolean' ? String(settings[field]) : String(settings[field]);
        await setConfigValue(dbKey, newVal);
        if (oldVal !== newVal) {
          await recordConfigHistory(dbKey, oldVal, newVal, userId, ip);
        }
      }
    }

    res.json({ success: true, message: '设置已更新' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '保存设置失败' });
  }
});

// ==================== 全局业务配置 (AdminConfig) ====================

// GET /api/admin/config
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const rows = await db('system_configs').select('config_key', 'config_value');
    const configs: Record<string, any> = {};
    for (const row of rows as any[]) {
      try { configs[row.config_key] = JSON.parse(row.config_value); }
      catch { configs[row.config_key] = row.config_value; }
    }

    res.json({
      success: true,
      data: {
        fees: configs.fees || {
          packagingFee: 0, expressFee: 0, platformCommissionRate: 0,
          shippingInsurance: 0, laborFee: 0, promotionFee: 0,
        },
        expressRates: configs.express_rates || [],
        deductionFormulas: configs.deduction_formulas || [],
        taxRates: configs.tax_rates || { vatRate: 13, incomeTaxRate: 25, surtaxRate: 6 },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取配置失败' });
  }
});

// PUT /api/admin/config
router.put('/config', async (req: Request, res: Response) => {
  try {
    const config = req.body;
    const userId = req.user!.userId;
    const ip = req.ip || '';

    const keyMap: Record<string, string> = {
      fees: 'fees', expressRates: 'express_rates',
      deductionFormulas: 'deduction_formulas', taxRates: 'tax_rates',
    };

    for (const [field, dbKey] of Object.entries(keyMap)) {
      if (config[field] !== undefined) {
        const oldRow = await db('system_configs').where('config_key', dbKey).first();
        const oldVal = oldRow ? oldRow.config_value : null;
        const newVal = JSON.stringify(config[field]);
        await setConfigValue(dbKey, newVal);
        if (oldVal !== newVal) {
          await recordConfigHistory(dbKey, oldVal, newVal, userId, ip);
        }
      }
    }

    res.json({ success: true, message: '配置已更新' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '保存配置失败' });
  }
});

// GET /api/admin/config/history
router.get('/config/history', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50, configKey } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('config_history').select('*');
    if (configKey && configKey !== 'all') {
      query = query.where('config_key', configKey as string);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.orderBy('changed_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, configKey: r.config_key,
        oldValue: r.old_value, newValue: r.new_value,
        changedBy: r.changed_by, changedAt: r.changed_at,
        ipAddress: r.ip_address,
      })),
      total: Number((total as any)?.count) || 0, page: Number(page), pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取配置历史失败' });
  }
});

// GET /api/admin/config/export
router.get('/config/export', async (_req: Request, res: Response) => {
  try {
    const rows = await db('system_configs').select('config_key', 'config_value', 'updated_at');
    const exportData: Record<string, any> = {
      exportedAt: new Date().toISOString(), version: '1.0', configs: {},
    };
    for (const row of rows as any[]) {
      try { exportData.configs[row.config_key] = JSON.parse(row.config_value); }
      catch { exportData.configs[row.config_key] = row.config_value; }
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="system_config_' + Date.now() + '.json"');
    res.json(exportData);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '导出配置失败' });
  }
});

// POST /api/admin/config/import
router.post('/config/import', async (req: Request, res: Response) => {
  try {
    const { configs } = req.body;
    if (!configs || typeof configs !== 'object') {
      res.status(400).json({ success: false, error: '无效的配置数据' });
      return;
    }
    const userId = req.user!.userId;
    const ip = req.ip || '';
    let importedCount = 0;

    for (const [key, value] of Object.entries(configs)) {
      const oldRow = await db('system_configs').where('config_key', key).first();
      const oldVal = oldRow ? oldRow.config_value : null;
      const newVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
      await setConfigValue(key, newVal);
      if (oldVal !== newVal) {
        await recordConfigHistory(key, oldVal, newVal, userId, ip);
        importedCount++;
      }
    }

    res.json({ success: true, message: '成功导入 ' + importedCount + ' 项配置', importedCount });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '导入配置失败' });
  }
});

export default router;
import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { db } from '../db';
import * as dataService from '../services/dataService';

const router = Router();

// 所有 admin 路由需要 admin 或 test 角色
router.use(requireAuth, requireRole('admin', 'test'));

// ==================== 辅助函数 ====================

async function getConfigValue(key: string): Promise<string | null> {
  const row = await db('system_configs').where('config_key', key).first();
  return row ? row.config_value : null;
}

async function setConfigValue(key: string, value: string): Promise<void> {
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

async function recordConfigHistory(
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

// ==================== 仪表盘 ====================

// GET /api/admin/stats — 系统概览
router.get('/stats', async (_req: Request, res: Response) => {
  try {
    const storageStats = await dataService.getStorageStats();
    const userCounts = await db('users')
      .select('membership_level')
      .count('* as count')
      .groupBy('membership_level');

    const levelCounts: Record<string, number> = { free: 0, pro: 0, enterprise: 0 };
    for (const row of userCounts as any[]) {
      levelCounts[row.membership_level] = row.count;
    }

    const todayUploads = await db('upload_records')
      .where('uploaded_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('* as count').first();

    const bannedUsers = await db('users').where('is_banned', true).count('* as count').first();

    const todayActiveUsers = await db('upload_records')
      .where('uploaded_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count(db.raw('DISTINCT user_id as count'))
      .first();

    res.json({
      success: true,
      data: {
        ...storageStats,
        freeUsers: levelCounts.free || 0,
        proUsers: levelCounts.pro || 0,
        enterpriseUsers: levelCounts.enterprise || 0,
        todayUploads: (todayUploads as any)?.count || 0,
        todayActiveUsers: (todayActiveUsers as any)?.count || 0,
        bannedUsers: (bannedUsers as any)?.count || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

// GET /api/admin/health — 系统健康检查
router.get('/health', async (_req: Request, res: Response) => {
  try {
    let dbConnected = false;
    try {
      await db.raw('SELECT 1');
      dbConnected = true;
    } catch {}

    const uptime = process.uptime();

    res.json({
      success: true,
      data: {
        dbConnected,
        uptime,
        status: dbConnected ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '健康检查失败' });
  }
});

// GET /api/admin/growth-trend — 近7天增长趋势
router.get('/growth-trend', async (_req: Request, res: Response) => {
  try {
    const days = 7;
    const data: Array<{ date: string; newUsers: number; newStores: number }> = [];

    for (let i = days - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const [userCount] = await db('users')
        .where('created_at', '>=', start)
        .where('created_at', '<', end)
        .count('* as count');

      const [storeCount] = await db('stores')
        .where('created_at', '>=', start)
        .where('created_at', '<', end)
        .count('* as count');

      const month = start.getMonth() + 1;
      const day = start.getDate();
      data.push({
        date: `${month}/${day}`,
        newUsers: Number((userCount as any)?.count ?? 0),
        newStores: Number((storeCount as any)?.count ?? 0),
      });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取增长趋势失败' });
  }
});

// POST /api/admin/impersonate/:userId — 管理员模拟登录
router.post('/impersonate/:userId', async (req: Request, res: Response) => {
  try {
    const targetUser = await db('users').where('id', req.params.userId).first();
    if (!targetUser) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const { signAccessToken } = require('../services/authService');
    const token = signAccessToken({
      userId: targetUser.id, username: targetUser.username,
      role: targetUser.role, membershipLevel: targetUser.membership_level,
    });

    await db('admin_logs').insert({
      admin_id: req.user!.userId, action: 'impersonate_user',
      target_type: 'user', target_id: targetUser.id,
      details: '管理员 ' + req.user!.username + ' 模拟登录为 ' + targetUser.username,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      data: {
        accessToken: token,
        user: { id: targetUser.id, username: targetUser.username, role: targetUser.role, membershipLevel: targetUser.membership_level },
        message: '正在以 ' + targetUser.username + ' 身份查看',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// ==================== 用户管理 ====================

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    let query = db('users').select('*');
    if (search) query = query.where('username', 'like', '%' + search + '%');
    const total = await query.clone().count('* as count').first();
    const rows = await query.orderBy('created_at', 'desc').offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, username: r.username, role: r.role,
        membershipLevel: r.membership_level, membershipExpiresAt: r.membership_expires_at,
        isBanned: r.is_banned, bannedReason: r.banned_reason,
        phone: r.phone, createdAt: r.created_at,
      })),
      total: (total as any)?.count || 0, page: Number(page), pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// POST /api/admin/users — 管理员创建账号
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { username, password, email, role, membershipLevel } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: '用户名和密码不能为空' });
      return;
    }
    if (username.length < 3) {
      res.status(400).json({ success: false, error: '用户名至少3个字符' });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ success: false, error: '密码至少6个字符' });
      return;
    }

    const existing = await db('users').where('username', username).first();
    if (existing) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }

    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const userId = `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const safeUsername = require('validator').escape(username);

    await db('users').insert({
      id: userId,
      username: safeUsername,
      password_hash: passwordHash,
      role: role || 'normal',
      membership_level: membershipLevel || 'free',
      phone: email || '',
      invite_code: 'ADMIN_CREATED',
    });

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'create_user',
      target_type: 'user', target_id: userId,
      details: `管理员创建账号: ${safeUsername}, 角色: ${role || 'normal'}, 会员: ${membershipLevel || 'free'}`,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      data: { id: userId, username: safeUsername, role: role || 'normal', membershipLevel: membershipLevel || 'free' },
      message: '账号创建成功',
    });
  } catch (err: any) {
    console.error('[admin] create user error:', err);
    res.status(500).json({ success: false, error: '创建失败' });
  }
});

// PUT /api/admin/users/:id
router.put('/users/:id', async (req: Request, res: Response) => {
  try {
    const { isBanned, bannedReason } = req.body;
    await db('users').where('id', req.params.id).update({
      is_banned: isBanned ? true : false,
      banned_reason: isBanned ? (bannedReason || '管理员操作') : null,
    });
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: isBanned ? 'ban_user' : 'unban_user',
      target_type: 'user', target_id: req.params.id,
      details: isBanned ? '封禁原因: ' + (bannedReason || '管理员操作') : '解封用户',
      ip_address: req.ip,
    });
    res.json({ success: true, message: isBanned ? '用户已封禁' : '用户已解封' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// PUT /api/admin/users/:id/membership
router.put('/users/:id/membership', async (req: Request, res: Response) => {
  try {
    const { membershipLevel, membershipExpiresAt } = req.body;
    const updateData: any = { membership_level: membershipLevel };
    if (membershipLevel === 'enterprise') {
      updateData.membership_expires_at = null;
    } else if (membershipExpiresAt) {
      updateData.membership_expires_at = membershipExpiresAt;
    }
    await db('users').where('id', req.params.id).update(updateData);
    await db('admin_logs').insert({
      admin_id: req.user!.userId, action: 'admin_adjust_membership',
      target_type: 'user', target_id: req.params.id,
      details: '调整为 ' + membershipLevel + ', 到期: ' + (membershipExpiresAt || '长期'),
      ip_address: req.ip,
    });
    res.json({ success: true, message: '会员调整成功' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// ==================== 数据监控 ====================

// GET /api/admin/data-stats
router.get('/data-stats', async (_req: Request, res: Response) => {
  try {
    const rawStats = await db('store_data')
      .select('store_id', 'category')
      .sum('row_count as total_rows')
      .groupBy('store_id', 'category');
    const stores = await db('stores')
      .select('stores.id', 'stores.name', 'users.username')
      .leftJoin('users', 'stores.user_id', 'users.id');

    const uploadInfo = await db('upload_records')
      .select('store_id', db.raw('MAX(uploaded_at) as last_upload_at'))
      .groupBy('store_id');
    const uploadMap: Record<string, string | null> = {};
    for (const r of uploadInfo as any[]) {
      uploadMap[r.store_id] = r.last_upload_at;
    }

    const storageInfo = await db('store_data')
      .select('store_id', db.raw('SUM(LENGTH(payload_json)) as storage_bytes'))
      .groupBy('store_id');
    const storageMap: Record<string, number> = {};
    for (const r of storageInfo as any[]) {
      storageMap[r.store_id] = Number(r.storage_bytes ?? 0);
    }

    const storeMap: Record<string, any> = {};
    for (const s of stores) {
      storeMap[s.id] = {
        storeId: s.id, storeName: s.name || '未命名', userName: s.username || '-',
        orders: 0, promotionSummary: 0, promotionProducts: 0,
        starStoreSummary: 0, liveStreamSummary: 0,
        shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0, totalRows: 0,
        lastUploadAt: null as string | null, storageBytes: 0,
      };
    }
    for (const row of rawStats as any[]) {
      if (!storeMap[row.store_id]) {
        storeMap[row.store_id] = {
          storeId: row.store_id, storeName: '未知店铺', userName: '-',
          orders: 0, promotionSummary: 0, promotionProducts: 0,
          starStoreSummary: 0, liveStreamSummary: 0,
          shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0, totalRows: 0,
          lastUploadAt: null as string | null, storageBytes: 0,
        };
      }
      const cat = row.category as string;
      if (storeMap[row.store_id][cat] !== undefined) {
        storeMap[row.store_id][cat] = row.total_rows || 0;
      }
      storeMap[row.store_id].totalRows += row.total_rows || 0;
    }

    for (const storeId of Object.keys(storeMap)) {
      storeMap[storeId].lastUploadAt = uploadMap[storeId] || null;
      storeMap[storeId].storageBytes = storageMap[storeId] || 0;
    }

    res.json({ success: true, data: Object.values(storeMap) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取数据统计失败' });
  }
});

// GET /api/admin/recent-activity
router.get('/recent-activity', async (_req: Request, res: Response) => {
  try {
    const rows = await db('admin_logs')
      .select('admin_logs.*', 'users.username')
      .leftJoin('users', 'admin_logs.admin_id', 'users.id')
      .orderBy('admin_logs.created_at', 'desc').limit(8);

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, username: r.username || r.admin_id, action: r.action,
        details: r.details, targetType: r.target_type, createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取动态失败' });
  }
});

// ==================== 操作日志 (增强) ====================

// GET /api/admin/logs — 操作日志（支持筛选）
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50, action, admin, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('admin_logs')
      .select('admin_logs.*', 'users.username')
      .leftJoin('users', 'admin_logs.admin_id', 'users.id');

    if (action && action !== 'all') {
      query = query.where('admin_logs.action', action as string);
    }
    if (admin) {
      query = query.where(function () {
        this.where('users.username', 'like', '%' + admin + '%')
          .orWhere('admin_logs.admin_id', 'like', '%' + admin + '%');
      });
    }
    if (startDate) query = query.where('admin_logs.created_at', '>=', startDate as string);
    if (endDate) query = query.where('admin_logs.created_at', '<=', endDate as string + ' 23:59:59');

    const total = await query.clone().count('* as count').first();
    const rows = await query.orderBy('admin_logs.created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, adminId: r.username || r.admin_id,
        action: r.action, targetType: r.target_type, targetId: r.target_id,
        details: r.details, ipAddress: r.ip_address, createdAt: r.created_at,
      })),
      total: (total as any)?.count || 0, page: Number(page), pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取日志失败' });
  }
});

// GET /api/admin/logs/actions — 操作类型列表
router.get('/logs/actions', async (_req: Request, res: Response) => {
  try {
    const rows = await db('admin_logs').distinct('action').select('action');
    res.json({ success: true, data: rows.map((r: any) => r.action) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取操作类型失败' });
  }
});

// GET /api/admin/logs/export — 导出日志 CSV
router.get('/logs/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, action } = req.query;
    let query = db('admin_logs')
      .select('admin_logs.*', 'users.username')
      .leftJoin('users', 'admin_logs.admin_id', 'users.id')
      .orderBy('admin_logs.created_at', 'desc').limit(10000);

    if (action && action !== 'all') query = query.where('admin_logs.action', action as string);
    if (startDate) query = query.where('admin_logs.created_at', '>=', startDate as string);
    if (endDate) query = query.where('admin_logs.created_at', '<=', endDate as string + ' 23:59:59');

    const rows = await query;
    const headers = ['时间', '操作者', '操作类型', '目标类型', '目标ID', '详情', 'IP地址'];
    const csvRows = [headers.join(',')];

    for (const r of rows as any[]) {
      csvRows.push([
        '"' + r.created_at + '"',
        '"' + (r.username || r.admin_id) + '"',
        '"' + r.action + '"',
        '"' + r.target_type + '"',
        '"' + (r.target_id || '') + '"',
        '"' + (r.details || '').replace(/"/g, '""') + '"',
        '"' + (r.ip_address || '') + '"',
      ].join(','));
    }

    const csvContent = '﻿' + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="admin_logs_' + Date.now() + '.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '导出日志失败' });
  }
});

// DELETE /api/admin/logs — 清理旧日志
router.delete('/logs', async (req: Request, res: Response) => {
  try {
    const { beforeDays = 365 } = req.body;
    const cutoff = new Date(Date.now() - Number(beforeDays) * 24 * 60 * 60 * 1000);
    const deleted = await db('admin_logs').where('created_at', '<', cutoff).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId, action: 'delete_data',
      target_type: 'system',
      details: '清理了 ' + deleted + ' 条 ' + beforeDays + ' 天前的旧日志',
      ip_address: req.ip,
    });
    res.json({ success: true, message: '已清理 ' + deleted + ' 条旧日志', deleted });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '清理日志失败' });
  }
});

// ==================== 系统设置 (增强) ====================

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

    // AI 配置
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

    // 系统设置
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

    const total = await query.clone().count('* as count').first();
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
      total: (total as any)?.count || 0, page: Number(page), pageSize: Number(pageSize),
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

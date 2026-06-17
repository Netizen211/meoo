/**
 * 系统路由 — 健康检查、系统信息、维护模式、用户导出
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import { getConfigValue, setConfigValue, recordConfigHistory } from './helpers';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

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

// GET /api/admin/system-info — 系统信息
router.get('/system-info', async (_req: Request, res: Response) => {
  try {
    const tables = await db.raw(`
      SELECT
        TABLE_NAME as table_name,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb,
        TABLE_ROWS as row_count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
    `);

    const userCount = await db('users').count('* as count').first();
    const storeCount = await db('stores').count('* as count').first();
    const recordCount = await db('store_data').sum('row_count as total').first();
    const logCount = await db('admin_logs').count('* as count').first();
    const sessionCount = await db('user_sessions').where({ is_active: 1 }).count('* as count').first();

    res.json({
      success: true,
      data: {
        uptime: process.uptime(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
        platform: process.platform,
        arch: process.arch,
        tables: tables[0] || [],
        counts: {
          users: Number((userCount as any)?.count ?? 0),
          stores: Number((storeCount as any)?.count ?? 0),
          records: Number((recordCount as any)?.total ?? 0),
          logs: Number((logCount as any)?.count ?? 0),
          activeSessions: Number((sessionCount as any)?.count ?? 0),
        },
      },
    });
  } catch (err: any) {
    console.error('[admin] system-info error:', err);
    res.status(500).json({ success: false, error: '获取系统信息失败' });
  }
});

// GET /api/admin/user-export — 导出用户CSV
router.get('/user-export', async (req: Request, res: Response) => {
  try {
    const { role, membershipLevel } = req.query;
    let query = db('users').select('*');
    if (role) query = query.where('role', role as string);
    if (membershipLevel) query = query.where('membership_level', membershipLevel as string);

    const rows = await query.orderBy('created_at', 'desc').limit(50000);
    const headers = ['用户ID', '用户名', '角色', '会员等级', '到期时间', '注册时间', '状态', '封禁原因'];
    const csvRows = [headers.join(',')];

    for (const r of rows as any[]) {
      csvRows.push([
        r.id,
        '"' + r.username + '"',
        r.role,
        r.membership_level,
        r.membership_expires_at || '',
        '"' + r.created_at + '"',
        r.is_banned ? '已封禁' : '正常',
        '"' + (r.banned_reason || '') + '"',
      ].join(','));
    }

    const csvContent = '﻿' + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="users_export_' + Date.now() + '.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

// GET /api/admin/maintenance — 获取维护模式状态
router.get('/maintenance', async (_req: Request, res: Response) => {
  try {
    const enabled = await getConfigValue('maintenance_mode');
    const message = await getConfigValue('maintenance_message');
    const allowedIps = await getConfigValue('maintenance_allowed_ips');
    res.json({
      success: true,
      data: {
        enabled: enabled === 'true',
        message: message || '系统维护中，请稍后再试...',
        allowedIps: allowedIps ? JSON.parse(allowedIps) : [],
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取维护状态失败' });
  }
});

// PUT /api/admin/maintenance — 设置维护模式
router.put('/maintenance', async (req: Request, res: Response) => {
  try {
    const { enabled, message, allowedIps } = req.body;
    const userId = req.user!.userId;
    const ip = req.ip || '';

    if (enabled !== undefined) {
      const oldRow = await db('system_configs').where('config_key', 'maintenance_mode').first();
      const oldVal = oldRow ? oldRow.config_value : 'false';
      await setConfigValue('maintenance_mode', String(enabled));
      await recordConfigHistory('maintenance_mode', oldVal, String(enabled), userId, ip);
    }
    if (message !== undefined) {
      await setConfigValue('maintenance_message', message);
      await recordConfigHistory('maintenance_message', null, message, userId, ip);
    }
    if (allowedIps !== undefined) {
      await setConfigValue('maintenance_allowed_ips', JSON.stringify(allowedIps));
      await recordConfigHistory('maintenance_allowed_ips', null, JSON.stringify(allowedIps), userId, ip);
    }

    await db('admin_logs').insert({
      admin_id: userId,
      action: enabled ? 'enable_maintenance' : 'disable_maintenance',
      target_type: 'system',
      details: enabled ? '启用维护模式' : '关闭维护模式',
      ip_address: ip,
    });

    res.json({ success: true, message: enabled ? '维护模式已启用' : '维护模式已关闭' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

export default router;
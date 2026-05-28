import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { db } from '../db';
import * as dataService from '../services/dataService';

const router = Router();

// 所有 admin 路由需要 admin 或 test 角色
router.use(requireAuth, requireRole('admin', 'test'));

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
      .count('* as count')
      .first();

    const bannedUsers = await db('users').where('is_banned', true).count('* as count').first();

    res.json({
      success: true,
      data: {
        ...storageStats,
        freeUsers: levelCounts.free || 0,
        proUsers: levelCounts.pro || 0,
        enterpriseUsers: levelCounts.enterprise || 0,
        todayUploads: (todayUploads as any)?.count || 0,
        bannedUsers: (bannedUsers as any)?.count || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取统计数据失败' });
  }
});

// GET /api/admin/users — 用户列表
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, search } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('users').select('*');
    if (search) {
      query = query.where('username', 'like', `%${search}%`);
    }

    const total = await query.clone().count('* as count').first();
    const rows = await query
      .orderBy('created_at', 'desc')
      .offset(offset)
      .limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        membershipLevel: r.membership_level,
        membershipExpiresAt: r.membership_expires_at,
        isBanned: r.is_banned,
        bannedReason: r.banned_reason,
        phone: r.phone,
        createdAt: r.created_at,
      })),
      total: (total as any)?.count || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取用户列表失败' });
  }
});

// PUT /api/admin/users/:id — 封禁/解封
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
      target_type: 'user',
      target_id: req.params.id,
      details: isBanned ? `封禁原因: ${bannedReason || '管理员操作'}` : '解封用户',
      ip_address: req.ip,
    });

    res.json({ success: true, message: isBanned ? '用户已封禁' : '用户已解封' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// PUT /api/admin/users/:id/membership — 调整会员
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
      admin_id: req.user!.userId,
      action: 'admin_adjust_membership',
      target_type: 'user',
      target_id: req.params.id,
      details: `调整为 ${membershipLevel}, 到期: ${membershipExpiresAt || '长期'}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: '会员调整成功' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// GET /api/admin/data-stats — 数据监控
router.get('/data-stats', async (_req: Request, res: Response) => {
  try {
    const rawStats = await db('store_data')
      .select('store_id', 'category')
      .sum('row_count as total_rows')
      .groupBy('store_id', 'category');

    const stores = await db('stores')
      .select('stores.id', 'stores.name', 'users.username')
      .leftJoin('users', 'stores.user_id', 'users.id');

    const storeMap: Record<string, any> = {};
    for (const s of stores) {
      storeMap[s.id] = {
        storeId: s.id,
        storeName: s.name || '未命名',
        userName: s.username || '-',
        orders: 0, promotionSummary: 0, promotionProducts: 0,
        starStoreSummary: 0, liveStreamSummary: 0,
        shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0,
        totalRows: 0,
      };
    }
    for (const row of rawStats as any[]) {
      if (!storeMap[row.store_id]) {
        storeMap[row.store_id] = {
          storeId: row.store_id, storeName: '未知店铺', userName: '-',
          orders: 0, promotionSummary: 0, promotionProducts: 0,
          starStoreSummary: 0, liveStreamSummary: 0,
          shippingInsurance: 0, afterSaleRecords: 0, financialRecords: 0,
          totalRows: 0,
        };
      }
      const cat = row.category as string;
      if (storeMap[row.store_id][cat] !== undefined) {
        storeMap[row.store_id][cat] = row.total_rows || 0;
      }
      storeMap[row.store_id].totalRows += row.total_rows || 0;
    }

    res.json({ success: true, data: Object.values(storeMap) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取数据统计失败' });
  }
});

// GET /api/admin/recent-activity — 最近操作动态
router.get('/recent-activity', async (_req: Request, res: Response) => {
  try {
    const rows = await db('admin_logs')
      .select('admin_logs.*', 'users.username')
      .leftJoin('users', 'admin_logs.admin_id', 'users.id')
      .orderBy('admin_logs.created_at', 'desc')
      .limit(8);

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        username: r.username || r.admin_id,
        action: r.action,
        details: r.details,
        targetType: r.target_type,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取动态失败' });
  }
});

// GET /api/admin/logs — 操作日志
router.get('/logs', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const total = await db('admin_logs').count('* as count').first();
    const rows = await db('admin_logs')
      .select('admin_logs.*', 'users.username')
      .leftJoin('users', 'admin_logs.admin_id', 'users.id')
      .orderBy('admin_logs.created_at', 'desc')
      .offset(offset)
      .limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        adminId: r.username || r.admin_id,
        action: r.action,
        targetType: r.target_type,
        targetId: r.target_id,
        details: r.details,
        ipAddress: r.ip_address,
        createdAt: r.created_at,
      })),
      total: (total as any)?.count || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取日志失败' });
  }
});

// GET /api/admin/settings — 获取系统设置
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const aiRows = await db('ai_config').select('config_key', 'config_value');
    const aiConfig: Record<string, string> = {};
    for (const row of aiRows as any[]) {
      aiConfig[row.config_key] = row.config_value;
    }

    res.json({
      success: true,
      data: {
        registrationOpen: true,
        inviteCodeRequired: true,
        membershipGraceDays: 30,
        membershipReminderDays: 7,
        aiEnabled: aiConfig.ai_enabled === 'true',
        aiApiKey: aiConfig.ai_api_key || '',
        aiDailyLimit: parseInt(aiConfig.ai_daily_limit || '10', 10),
        aiModel: aiConfig.ai_model || 'claude-sonnet-4-6',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取设置失败' });
  }
});

// PUT /api/admin/settings — 更新系统设置
router.put('/settings', async (req: Request, res: Response) => {
  try {
    const settings = req.body;
    if (settings.aiEnabled !== undefined) {
      await db('ai_config').where('config_key', 'ai_enabled').update({ config_value: settings.aiEnabled ? 'true' : 'false', updated_at: db.fn.now() });
    }
    if (settings.aiApiKey !== undefined) {
      await db('ai_config').where('config_key', 'ai_api_key').update({ config_value: settings.aiApiKey, updated_at: db.fn.now() });
    }
    if (settings.aiDailyLimit !== undefined) {
      await db('ai_config').where('config_key', 'ai_daily_limit').update({ config_value: String(settings.aiDailyLimit), updated_at: db.fn.now() });
    }
    if (settings.aiModel !== undefined) {
      await db('ai_config').where('config_key', 'ai_model').update({ config_value: settings.aiModel, updated_at: db.fn.now() });
    }

    res.json({ success: true, message: '设置已更新' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '保存设置失败' });
  }
});

export default router;

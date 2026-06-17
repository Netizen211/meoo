import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import * as dataService from '../../services/dataService';

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
      levelCounts[row.membership_level] = Number(row.count) || 0;
    }

    const todayUploads = await db('upload_records')
      .where('uploaded_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .count('* as count').first();

    const bannedUsers = await db('users').where('is_banned', true).count('* as count').first();

    const todayActiveUsers = await db('upload_records')
      .where('uploaded_at', '>=', new Date(Date.now() - 24 * 60 * 60 * 1000))
      .countDistinct({ count: 'user_id' })
      .first();

    res.json({
      success: true,
      data: {
        ...storageStats,
        freeUsers: Number(levelCounts.free) || 0,
        proUsers: Number(levelCounts.pro) || 0,
        enterpriseUsers: Number(levelCounts.enterprise) || 0,
        todayUploads: Number((todayUploads as any)?.count) || 0,
        todayActiveUsers: Number((todayActiveUsers as any)?.count) || 0,
        bannedUsers: Number((bannedUsers as any)?.count) || 0,
      },
    });
  } catch (err: any) {
    console.error('[admin] stats error:', err.message, err.stack?.substring(0, 200));
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
    const { page = 1, pageSize = 20, search, role, membershipLevel } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('users')
      .select(
        'users.*',
        db.raw('(SELECT COALESCE(SUM(amount), 0) FROM recharge_orders WHERE user_id = users.id AND status = \'approved\') as total_recharge'),
        db.raw('(SELECT COUNT(*) FROM stores WHERE user_id = users.id) as store_count'),
        db.raw('(SELECT MAX(created_at) FROM user_sessions WHERE user_id = users.id) as last_login_at'),
      );

    if (search) query = query.where('users.username', 'like', '%' + search + '%');
    if (role) query = query.where('users.role', role as string);
    if (membershipLevel) query = query.where('users.membership_level', membershipLevel as string);

    // 使用简化查询计数，避免 only_full_group_by 问题
    const countQuery = db('users');
    if (search) countQuery.where('users.username', 'like', '%' + search + '%');
    if (role) countQuery.where('users.role', role as string);
    if (membershipLevel) countQuery.where('users.membership_level', membershipLevel as string);
    const total = await countQuery.count('users.id as count').first();
    const rows = await query.orderBy('users.created_at', 'desc').offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, username: r.username, role: r.role,
        membershipLevel: r.membership_level, membershipExpiresAt: r.membership_expires_at,
        isBanned: r.is_banned, bannedReason: r.banned_reason,
        phone: r.phone, createdAt: r.created_at,
        totalRecharge: Number(r.total_recharge ?? 0),
        storeCount: Number(r.store_count ?? 0),
        lastLoginAt: r.last_login_at || null,
      })),
      total: Number((total as any)?.count) || 0, page: Number(page), pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] users list error:', err.message, err.stack?.substring(0, 200));
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

// 批量操作路由必须放在 /users/:id 之前，防止 "batch" 被当作 :id 匹配

// PUT /api/admin/users/batch/ban — 批量封禁/解封
router.put('/users/batch/ban', async (req: Request, res: Response) => {
  try {
    const { userIds, isBanned, bannedReason } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ success: false, error: '请选择用户' });
      return;
    }
    await db('users').whereIn('id', userIds).update({
      is_banned: isBanned ? true : false,
      banned_reason: isBanned ? (bannedReason || '管理员操作') : null,
    });
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: isBanned ? 'batch_ban_user' : 'batch_unban_user',
      target_type: 'users',
      target_id: userIds.join(','),
      details: `${isBanned ? '批量封禁' : '批量解封'} ${userIds.length} 个用户, 原因: ${bannedReason || '无'}`,
      ip_address: req.ip,
    });
    res.json({ success: true, message: `已处理 ${userIds.length} 个用户` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '批量操作失败' });
  }
});

// POST /api/admin/users/batch/notify — 批量发送通知
router.post('/users/batch/notify', async (req: Request, res: Response) => {
  try {
    const { userIds, message } = req.body;
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0 || !message) {
      res.status(400).json({ success: false, error: '参数不完整' });
      return;
    }
    // Store notifications (could send via email/WebSocket in production)
    for (const uid of userIds) {
      await db('admin_logs').insert({
        admin_id: req.user!.userId,
        action: 'send_notification',
        target_type: 'user',
        target_id: uid,
        details: message,
        ip_address: req.ip,
      });
    }
    res.json({ success: true, message: `已向 ${userIds.length} 个用户发送通知` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '发送通知失败' });
  }
});

// GET /api/admin/users/:id/detail — 用户详情（店铺、充值记录）
router.get('/users/:id/detail', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const stores = await db('stores')
      .where('user_id', userId)
      .select('id as storeId', 'name as storeName')
      .orderBy('created_at', 'desc')
      .limit(50);

    // Get row counts per store
    for (const s of stores as any[]) {
      const count = await db('store_data')
        .where('store_id', s.storeId)
        .sum('row_count as total')
        .first();
      s.totalRows = Number((count as any)?.total ?? 0);
    }

    const rechargeRecords = await db('recharge_orders')
      .where('user_id', userId)
      .select('id', 'plan', 'duration', 'amount', 'status')
      .orderBy('created_at', 'desc')
      .limit(20);

    res.json({
      success: true,
      data: { stores, rechargeRecords },
    });
  } catch (err: any) {
    console.error('[admin] user detail error:', err);
    res.status(500).json({ success: false, error: '获取用户详情失败' });
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
    const { membershipLevel, membershipExpiresAt, note } = req.body;
    const user = await db('users').where('id', req.params.id).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }
    const oldLevel = user.membership_level;

    const updateData: any = { membership_level: membershipLevel };
    if (membershipLevel === 'enterprise') {
      updateData.membership_expires_at = null;
    } else if (membershipExpiresAt) {
      updateData.membership_expires_at = membershipExpiresAt;
    }
    await db('users').where('id', req.params.id).update(updateData);

    // Record membership history
    await db('membership_history').insert({
      user_id: req.params.id,
      from_level: oldLevel,
      to_level: membershipLevel,
      from_expires_at: user.membership_expires_at,
      to_expires_at: membershipExpiresAt || null,
      note: note || '',
      operated_by: req.user!.userId,
    });

    await db('admin_logs').insert({
      admin_id: req.user!.userId, action: 'admin_adjust_membership',
      target_type: 'user', target_id: req.params.id,
      details: `会员调整: ${oldLevel} -> ${membershipLevel}, 到期: ${membershipExpiresAt || '长期'}, 备注: ${note || ''}`,
      ip_address: req.ip,
    });
    res.json({ success: true, message: '会员调整成功' });
  } catch (err: any) {
    console.error('[admin] membership adjust error:', err);
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// GET /api/admin/membership/history — 会员变更历史
router.get('/membership/history', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 100, userId } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);
    let query = db('membership_history')
      .select(
        'membership_history.*',
        'operators.username as operator_name',
        'target.username as target_name',
      )
      .leftJoin('users as operators', 'membership_history.operated_by', 'operators.id')
      .leftJoin('users as target', 'membership_history.user_id', 'target.id');

    if (userId) query = query.where('membership_history.user_id', userId as string);

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.orderBy('membership_history.created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        fromLevel: r.from_level,
        toLevel: r.to_level,
        fromExpiresAt: r.from_expires_at,
        toExpiresAt: r.to_expires_at,
        note: r.note,
        operatedBy: r.operator_name || r.operated_by,
        username: r.target_name,
        createdAt: r.created_at,
      })),
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] membership history error:', err);
    res.status(500).json({ success: false, error: '获取会员历史失败' });
  }
});

// ==================== 数据监控 ====================

// GET /api/admin/data-stats
router.get('/data-stats', async (_req: Request, res: Response) => {
  try {
    const rawStats = await db('store_data')
      .select('store_id', 'category')
      .sum({ total_rows: 'row_count' })
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
        storeMap[row.store_id][cat] = Number(row.total_rows) || 0;
      }
      storeMap[row.store_id].totalRows += Number(row.total_rows) || 0;
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

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.orderBy('admin_logs.created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id, adminId: r.username || r.admin_id,
        action: r.action, targetType: r.target_type, targetId: r.target_id,
        details: r.details, ipAddress: r.ip_address, createdAt: r.created_at,
      })),
      total: Number((total as any)?.count) || 0, page: Number(page), pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] logs error:', err.message, err.stack?.substring(0, 200));
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

// ==================== 子账号管理（管理员视角） ====================

// GET /api/admin/sub-accounts — 查看所有子账号
router.get('/sub-accounts', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50, search, parentId } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('users as sub')
      .leftJoin('users as parent', 'sub.parent_user_id', 'parent.id')
      .where('sub.is_sub_account', 1)
      .select(
        'sub.id', 'sub.username', 'sub.phone', 'sub.is_banned', 'sub.created_at',
        'sub.parent_user_id', 'parent.username as parent_username',
      );

    if (search) {
      query = query.where(function () {
        this.where('sub.username', 'like', '%' + search + '%')
          .orWhere('parent.username', 'like', '%' + search + '%');
      });
    }
    if (parentId) {
      query = query.where('sub.parent_user_id', parentId as string);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.orderBy('sub.created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    // 获取每个子账号的角色
    const subRoleMap: Record<string, string> = {};
    const subIds = (rows as any[]).map(r => r.id);
    if (subIds.length > 0) {
      const roleRows = await db('sub_roles')
        .whereIn('parent_user_id', (rows as any[]).map(r => r.parent_user_id).filter(Boolean))
        .select('parent_user_id', 'name');
      // 简单的映射：取第一个角色（预设角色）
      for (const r of roleRows as any[]) {
        if (!subRoleMap[r.parent_user_id]) {
          subRoleMap[r.parent_user_id] = r.name;
        }
      }
    }

    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        id: r.id,
        username: r.username,
        phone: r.phone,
        isBanned: r.is_banned,
        createdAt: r.created_at,
        parentUserId: r.parent_user_id,
        parentUsername: r.parent_username || '未知',
        role: subRoleMap[r.parent_user_id] || '只读观察',
      })),
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] sub-accounts error:', err);
    res.status(500).json({ success: false, error: '获取子账号列表失败' });
  }
});

// POST /api/admin/sub-accounts — 管理员创建子账号
router.post('/sub-accounts', async (req: Request, res: Response) => {
  try {
    const { username, password, parentUserId, roleName, phone } = req.body;
    if (!username || !password || !parentUserId) {
      res.status(400).json({ success: false, error: '缺少参数：username, password, parentUserId' });
      return;
    }

    // 检查父用户是否存在且是主账号
    const parent = await db('users').where('id', parentUserId).first();
    if (!parent) {
      res.status(404).json({ success: false, error: '父用户不存在' });
      return;
    }
    if (parent.is_sub_account) {
      res.status(400).json({ success: false, error: '父用户不能是子账号' });
      return;
    }

    // 检查用户名是否已存在
    const existing = await db('users').where('username', username).first();
    if (existing) {
      res.status(400).json({ success: false, error: '用户名已存在' });
      return;
    }

    const bcrypt = require('bcrypt');
    const crypto = require('crypto');
    const subId = `sub-${parentUserId}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const passwordHash = await bcrypt.hash(password, 12);
    const safeUsername = require('validator').escape(username);
    const role = roleName || '只读观察';
    const perms = (PRESET_ROLES as any)[role] || PRESET_ROLES['只读观察'];

    await db('users').insert({
      id: subId,
      username: safeUsername,
      password_hash: passwordHash,
      phone: phone || '',
      role: 'sub_account',
      membership_level: 'enterprise',
      parent_user_id: parentUserId,
      is_sub_account: 1,
      sub_role_id: null,
    });

    // 存储角色（为父用户创建预设角色）
    const existingRole = await db('sub_roles')
      .where({ parent_user_id: parentUserId, name: role })
      .first();
    if (!existingRole) {
      await db('sub_roles').insert({
        parent_user_id: parentUserId,
        name: role,
        permissions: JSON.stringify(perms),
        is_preset: 1,
      });
    }

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'create_sub_account',
      target_type: 'sub_account',
      target_id: subId,
      details: `管理员为 ${parent.username}(${parentUserId}) 创建子账号: ${safeUsername}, 角色: ${role}`,
      ip_address: req.ip,
    });

    res.json({
      success: true,
      data: {
        id: subId,
        username: safeUsername,
        parentUserId,
        parentUsername: parent.username,
        role,
        createdAt: new Date().toISOString(),
      },
      message: '子账号创建成功',
    });
  } catch (err: any) {
    console.error('[admin] create sub-account error:', err);
    res.status(500).json({ success: false, error: '创建子账号失败' });
  }
});

// DELETE /api/admin/sub-accounts/:id — 管理员删除子账号
router.delete('/sub-accounts/:id', async (req: Request, res: Response) => {
  try {
    const subId = req.params.id;
    const sub = await db('users').where({ id: subId, is_sub_account: 1 }).first();
    if (!sub) {
      res.status(404).json({ success: false, error: '子账号不存在' });
      return;
    }

    await db('users').where('id', subId).del();
    await db('user_sessions').where('user_id', subId).del();
    await db('user_operation_logs').where('user_id', subId).del();
    await db('sub_account_stores').where('user_id', subId).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_sub_account',
      target_type: 'sub_account',
      target_id: subId,
      details: `管理员删除子账号: ${sub.username}(父用户: ${sub.parent_user_id})`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: '子账号已删除' });
  } catch (err: any) {
    console.error('[admin] delete sub-account error:', err);
    res.status(500).json({ success: false, error: '删除失败' });
  }
});

// GET /api/admin/sub-accounts/logs — 子账号操作日志（全量）
router.get('/sub-accounts/logs', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50, subUserId } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('user_operation_logs')
      .select('*');

    if (subUserId) {
      query = query.where('user_id', subUserId as string);
    }

    const total = await query.clone().clearSelect().count('* as cnt').first();
    const rows = await query.orderBy('created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows,
      total: Number((total as any)?.cnt) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] sub-account logs error:', err);
    res.status(500).json({ success: false, error: '获取操作日志失败' });
  }
});

// GET /api/admin/parent-users — 获取可创建子账号的主账号列表
router.get('/parent-users', async (_req: Request, res: Response) => {
  try {
    const rows = await db('users')
      .where('is_sub_account', 0)
      .where(function () {
        this.where('parent_user_id', null).orWhere('parent_user_id', '');
      })
      .select('id', 'username', 'phone', 'membership_level')
      .orderBy('created_at', 'desc');

    res.json({ success: true, data: rows });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取主账号列表失败' });
  }
});

// ==================== 角色权限管理 ====================

const PRESET_ROLES: Record<string, any> = {
  '管理员': { pages: { dashboard: 1, product: 1, promotion: 1, finance: 1, afterSale: 1, insurance: 1, region: 1, trend: 1, user: 1, risk: 1, cost: 1, stores: 1, upload: 1, membership: 1, settings: 1 }, funcs: { export: 1, delete: 1, editCost: 1, manageStores: 1, uploadData: 1, viewAmount: 1 }, scope: 'all' },
  '运营专员': { pages: { dashboard: 1, product: 1, promotion: 1, afterSale: 1, region: 1, trend: 1, user: 1, cost: 1, upload: 1 }, funcs: { export: 1, editCost: 1, uploadData: 1, viewAmount: 1 }, scope: 'all' },
  '客服专员': { pages: { dashboard: 1, afterSale: 1 }, funcs: { export: 1 }, scope: 'all' },
  '财务专员': { pages: { dashboard: 1, finance: 1, cost: 1 }, funcs: { export: 1, viewAmount: 1 }, scope: 'all' },
  '只读观察': { pages: { dashboard: 1, product: 1, promotion: 1, afterSale: 1, region: 1, trend: 1 }, funcs: { viewAmount: 1 }, scope: 'all' },
};

// GET /api/admin/roles — 获取预设角色列表
router.get('/roles', async (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: Object.entries(PRESET_ROLES).map(([name, perms]) => ({
        name,
        pages: Object.keys(perms.pages),
        funcs: Object.keys(perms.funcs),
        scope: perms.scope,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取角色列表失败' });
  }
});

// PUT /api/admin/sub-accounts/:id/banned — 封禁/解封子账号
router.put('/sub-accounts/:id/banned', async (req: Request, res: Response) => {
  try {
    const { isBanned, reason } = req.body;
    const subId = req.params.id;
    const sub = await db('users').where({ id: subId, is_sub_account: 1 }).first();
    if (!sub) {
      res.status(404).json({ success: false, error: '子账号不存在' });
      return;
    }

    await db('users').where('id', subId).update({
      is_banned: isBanned ? true : false,
      banned_reason: isBanned ? (reason || '管理员操作') : null,
    });

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: isBanned ? 'ban_sub_account' : 'unban_sub_account',
      target_type: 'sub_account',
      target_id: subId,
      details: `${isBanned ? '封禁' : '解封'}子账号: ${sub.username}, 原因: ${reason || '无'}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: isBanned ? '已封禁' : '已解封' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// ==================== 系统公告 ====================

// GET /api/admin/announcements
router.get('/announcements', async (_req: Request, res: Response) => {
  try {
    const rows = await db('system_announcements')
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(50);
    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        id: r.id,
        title: r.title,
        content: r.content,
        isActive: r.is_active,
        priority: r.priority,
        targetRoles: r.target_roles,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch (err: any) {
    console.error('[admin] announcements error:', err);
    res.status(500).json({ success: false, error: '获取公告失败' });
  }
});

// POST /api/admin/announcements
router.post('/announcements', async (req: Request, res: Response) => {
  try {
    const { title, content, priority, targetRoles, isActive } = req.body;
    if (!title || !content) {
      res.status(400).json({ success: false, error: '标题和内容不能为空' });
      return;
    }
    const [id] = await db('system_announcements').insert({
      title: require('validator').escape(title),
      content,
      priority: priority || 'normal',
      target_roles: targetRoles || null,
      is_active: isActive !== false ? 1 : 0,
      created_by: req.user!.userId,
    });
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'create_announcement',
      target_type: 'announcement',
      target_id: String(id),
      details: `发布公告: ${title}`,
      ip_address: req.ip,
    });
    res.json({ success: true, data: { id }, message: '公告已发布' });
  } catch (err: any) {
    console.error('[admin] create announcement error:', err);
    res.status(500).json({ success: false, error: '发布公告失败' });
  }
});

// PUT /api/admin/announcements/:id
router.put('/announcements/:id', async (req: Request, res: Response) => {
  try {
    const updateData: any = {};
    if (req.body.title !== undefined) updateData.title = require('validator').escape(req.body.title);
    if (req.body.content !== undefined) updateData.content = req.body.content;
    if (req.body.priority !== undefined) updateData.priority = req.body.priority;
    if (req.body.targetRoles !== undefined) updateData.target_roles = req.body.targetRoles;
    if (req.body.isActive !== undefined) updateData.is_active = req.body.isActive ? 1 : 0;

    if (Object.keys(updateData).length === 0) {
      res.status(400).json({ success: false, error: '无更新内容' });
      return;
    }

    await db('system_announcements').where('id', req.params.id).update(updateData);
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'update_announcement',
      target_type: 'announcement',
      target_id: req.params.id,
      details: '更新公告',
      ip_address: req.ip,
    });
    res.json({ success: true, message: '公告已更新' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '更新公告失败' });
  }
});

// DELETE /api/admin/announcements/:id
router.delete('/announcements/:id', async (req: Request, res: Response) => {
  try {
    await db('system_announcements').where('id', req.params.id).del();
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_announcement',
      target_type: 'announcement',
      target_id: req.params.id,
      details: '删除公告',
      ip_address: req.ip,
    });
    res.json({ success: true, message: '公告已删除' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '删除公告失败' });
  }
});

// ==================== 用户完整详情（多 Tab 数据） ====================

// GET /api/admin/users/:id/full-detail — 用户完整档案
router.get('/users/:id/full-detail', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await db('users').where('id', userId).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

    // 店铺列表
    const stores = await db('stores')
      .where('user_id', userId)
      .select('id', 'name', 'created_at')
      .orderBy('created_at', 'desc');
    for (const s of stores as any[]) {
      const count = await db('store_data').where('store_id', s.id).sum('row_count as total').first();
      s.totalRows = Number((count as any)?.total ?? 0);
      const lastUpload = await db('upload_records').where('store_id', s.id).max('uploaded_at as last_at').first();
      s.lastUpload = (lastUpload as any)?.last_at || null;
    }

    // 充值记录
    const rechargeRecords = await db('recharge_orders')
      .where('user_id', userId)
      .select('id', 'plan', 'duration', 'amount', 'status', 'created_at', 'reviewed_at', 'review_note')
      .orderBy('created_at', 'desc')
      .limit(50);

    // 会员变更历史
    const membershipHistory = await db('membership_history')
      .where('user_id', userId)
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(30);

    // 活跃会话
    const sessions = await db('user_sessions')
      .where({ user_id: userId, is_active: 1 })
      .where('expires_at', '>', db.fn.now())
      .select('id', 'session_id', 'ip_address', 'user_agent', 'device_info', 'last_activity_at', 'created_at', 'expires_at')
      .orderBy('last_activity_at', 'desc');

    // 操作日志
    const operationLogs = await db('user_operation_logs')
      .where('user_id', userId)
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(50);

    // 上传记录
    const uploadRecords = await db('upload_records')
      .leftJoin('stores', 'upload_records.store_id', 'stores.id')
      .where('upload_records.user_id', userId)
      .select('upload_records.*', 'stores.name as store_name')
      .orderBy('upload_records.uploaded_at', 'desc')
      .limit(30);

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          username: user.username,
          role: user.role,
          membershipLevel: user.membership_level,
          membershipExpiresAt: user.membership_expires_at,
          isBanned: user.is_banned,
          bannedReason: user.banned_reason,
          phone: user.phone,
          isSubAccount: user.is_sub_account,
          parentUserId: user.parent_user_id,
          createdAt: user.created_at,
        },
        stores,
        rechargeRecords,
        membershipHistory: (membershipHistory as any[]).map(r => ({
          id: r.id,
          fromLevel: r.from_level,
          toLevel: r.to_level,
          fromExpiresAt: r.from_expires_at,
          toExpiresAt: r.to_expires_at,
          note: r.note,
          operatedBy: r.operated_by,
          createdAt: r.created_at,
        })),
        sessions: (sessions as any[]).map(s => ({
          id: s.id,
          sessionId: s.session_id,
          ipAddress: s.ip_address,
          userAgent: s.user_agent,
          deviceInfo: s.device_info,
          lastActivityAt: s.last_activity_at,
          createdAt: s.created_at,
          expiresAt: s.expires_at,
        })),
        operationLogs,
        uploadRecords: (uploadRecords as any[]).map(r => ({
          id: r.id,
          storeId: r.store_id,
          storeName: r.store_name,
          fileName: r.file_name,
          fileSize: r.file_size,
          category: r.category,
          rowCount: r.row_count,
          uploadedAt: r.uploaded_at,
        })),
      },
    });
  } catch (err: any) {
    console.error('[admin] full-detail error:', err);
    res.status(500).json({ success: false, error: '获取用户详情失败' });
  }
});

// ==================== 会话管理 ====================

// GET /api/admin/users/:id/sessions — 获取用户活跃会话
router.get('/users/:id/sessions', async (req: Request, res: Response) => {
  try {
    const sessions = await db('user_sessions')
      .where({ user_id: req.params.id, is_active: 1 })
      .where('expires_at', '>', db.fn.now())
      .select('id', 'session_id', 'ip_address', 'user_agent', 'device_info', 'last_activity_at', 'created_at', 'expires_at')
      .orderBy('last_activity_at', 'desc');
    res.json({
      success: true,
      data: (sessions as any[]).map(s => ({
        id: s.id,
        sessionId: s.session_id,
        ipAddress: s.ip_address,
        userAgent: s.user_agent,
        deviceInfo: s.device_info,
        lastActivityAt: s.last_activity_at,
        createdAt: s.created_at,
        expiresAt: s.expires_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取会话失败' });
  }
});

// DELETE /api/admin/users/:id/sessions/:sessionId — 撤销指定会话
router.delete('/users/:id/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const { id, sessionId } = req.params;
    await db('user_sessions').where({ user_id: id, session_id: sessionId }).update({ is_active: 0 });
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'revoke_session',
      target_type: 'session',
      target_id: sessionId,
      details: `撤销用户 ${id} 的会话`,
      ip_address: req.ip,
    });
    res.json({ success: true, message: '会话已强制下线' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// DELETE /api/admin/users/:id/sessions — 撤销所有会话（强制下线）
router.delete('/users/:id/sessions', async (req: Request, res: Response) => {
  try {
    const count = await db('user_sessions')
      .where({ user_id: req.params.id, is_active: 1 })
      .update({ is_active: 0 });
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'force_logout',
      target_type: 'user',
      target_id: req.params.id,
      details: `强制下线用户所有会话 (${count} 个)`,
      ip_address: req.ip,
    });
    res.json({ success: true, message: `已强制下线 ${count} 个会话`, revoked: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// ==================== 密码重置 ====================

// POST /api/admin/users/:id/reset-password — 管理员重置用户密码
router.post('/users/:id/reset-password', async (req: Request, res: Response) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: '新密码至少6个字符' });
      return;
    }

    const user = await db('users').where('id', req.params.id).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash(newPassword, 12);
    await db('users').where('id', req.params.id).update({ password_hash: passwordHash });

    // 强制下线所有会话
    await db('user_sessions').where({ user_id: req.params.id, is_active: 1 }).update({ is_active: 0 });

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'reset_password',
      target_type: 'user',
      target_id: req.params.id,
      details: `管理员重置用户 ${user.username} 的密码`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: `已重置用户 ${user.username} 的密码，所有会话已强制下线` });
  } catch (err: any) {
    console.error('[admin] reset-password error:', err);
    res.status(500).json({ success: false, error: '密码重置失败' });
  }
});

// ==================== 用户备注 ====================

// PUT /api/admin/users/:id/notes — 管理备注
router.put('/users/:id/notes', async (req: Request, res: Response) => {
  try {
    const { note } = req.body;
    const user = await db('users').where('id', req.params.id).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

    // Store note in system_configs
    const key = `user_note_${req.params.id}`;
    await setConfigValue(key, note || '');

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'update_user_note',
      target_type: 'user',
      target_id: req.params.id,
      details: `更新用户备注: ${note ? note.substring(0, 100) : '(已清除)'}`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: '备注已更新' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '更新备注失败' });
  }
});

// GET /api/admin/users/:id/notes
router.get('/users/:id/notes', async (req: Request, res: Response) => {
  try {
    const note = await getConfigValue(`user_note_${req.params.id}`);
    res.json({ success: true, data: { note: note || '' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取备注失败' });
  }
});

// ==================== 营收/财务仪表盘 ====================

// GET /api/admin/revenue/summary — 营收概览
router.get('/revenue/summary', async (_req: Request, res: Response) => {
  try {
    // 总营收
    const totalRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .sum('amount as total')
      .first();

    // 本月营收
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .where('created_at', '>=', monthStart)
      .sum('amount as total')
      .first();

    // 今日营收
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .where('created_at', '>=', todayStart)
      .sum('amount as total')
      .first();

    // 待审核金额
    const pendingAmount = await db('recharge_orders')
      .where('status', 'pending')
      .sum('amount as total')
      .first();

    // 近12个月营收趋势
    const monthlyTrend: Array<{ month: string; amount: number; count: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const start = new Date();
      start.setMonth(start.getMonth() - i);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);

      const row = await db('recharge_orders')
        .where('status', 'approved')
        .where('created_at', '>=', start)
        .where('created_at', '<', end)
        .select(db.raw('COALESCE(SUM(amount), 0) as amount'), db.raw('COUNT(*) as count'))
        .first();

      monthlyTrend.push({
        month: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`,
        amount: Number((row as any)?.amount ?? 0),
        count: Number((row as any)?.count ?? 0),
      });
    }

    // 按套餐统计
    const byPlan = await db('recharge_orders')
      .where('status', 'approved')
      .select('plan', db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as total'))
      .groupBy('plan');

    // 按时长统计
    const byDuration = await db('recharge_orders')
      .where('status', 'approved')
      .select('duration', db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as total'))
      .groupBy('duration');

    // 转化率（注册到付费）
    const totalUsers = await db('users').count('* as count').first();
    const payingUsers = await db('recharge_orders')
      .where('status', 'approved')
      .countDistinct('user_id as count')
      .first();

    res.json({
      success: true,
      data: {
        totalRevenue: Number((totalRevenue as any)?.total ?? 0),
        monthlyRevenue: Number((monthlyRevenue as any)?.total ?? 0),
        todayRevenue: Number((todayRevenue as any)?.total ?? 0),
        pendingAmount: Number((pendingAmount as any)?.total ?? 0),
        conversionRate: (totalUsers as any)?.count > 0
          ? Math.round((Number((payingUsers as any)?.count) / Number((totalUsers as any)?.count)) * 10000) / 100
          : 0,
        payingUsers: Number((payingUsers as any)?.count ?? 0),
        totalUsers: Number((totalUsers as any)?.count ?? 0),
        monthlyTrend,
        byPlan: (byPlan as any[]).map(r => ({ plan: r.plan, count: r.count, total: Number(r.total) })),
        byDuration: (byDuration as any[]).map(r => ({ duration: r.duration, count: r.count, total: Number(r.total) })),
      },
    });
  } catch (err: any) {
    console.error('[admin] revenue summary error:', err);
    res.status(500).json({ success: false, error: '获取营收数据失败' });
  }
});

// GET /api/admin/revenue/transactions — 交易明细
router.get('/revenue/transactions', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 30, status, plan, startDate, endDate } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('recharge_orders')
      .select('recharge_orders.*', 'users.username')
      .leftJoin('users', 'recharge_orders.user_id', 'users.id');

    if (status && status !== 'all') query = query.where('recharge_orders.status', status as string);
    if (plan && plan !== 'all') query = query.where('recharge_orders.plan', plan as string);
    if (startDate) query = query.where('recharge_orders.created_at', '>=', startDate as string);
    if (endDate) query = query.where('recharge_orders.created_at', '<=', endDate as string + ' 23:59:59');

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.orderBy('recharge_orders.created_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username || '未知',
        plan: r.plan,
        duration: r.duration,
        amount: Number(r.amount),
        status: r.status,
        wechatNickname: r.wechat_nickname,
        remark: r.remark,
        reviewedBy: r.reviewed_by,
        reviewNote: r.review_note,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取交易明细失败' });
  }
});

// GET /api/admin/revenue/export — 导出营收CSV
router.get('/revenue/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;
    let query = db('recharge_orders')
      .select('recharge_orders.*', 'users.username')
      .leftJoin('users', 'recharge_orders.user_id', 'users.id')
      .where('status', 'approved');

    if (startDate) query = query.where('recharge_orders.created_at', '>=', startDate as string);
    if (endDate) query = query.where('recharge_orders.created_at', '<=', endDate as string + ' 23:59:59');

    const rows = await query.orderBy('recharge_orders.created_at', 'desc').limit(50000);
    const headers = ['交易ID', '用户', '套餐', '时长', '金额', '状态', '创建时间', '审核时间'];
    const csvRows = [headers.join(',')];

    for (const r of rows as any[]) {
      csvRows.push([
        r.id,
        '"' + (r.username || '') + '"',
        r.plan,
        r.duration,
        r.amount,
        r.status,
        '"' + r.created_at + '"',
        '"' + (r.reviewed_at || '') + '"',
      ].join(','));
    }

    const csvContent = '﻿' + csvRows.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="revenue_' + Date.now() + '.csv"');
    res.send(csvContent);
  } catch (err: any) {
    res.status(500).json({ success: false, error: '导出失败' });
  }
});

// ==================== 店铺数据浏览器 ====================

// GET /api/admin/stores/:id/data — 浏览店铺上传数据
router.get('/stores/:id/data', async (req: Request, res: Response) => {
  try {
    const { category, page = 1, pageSize = 20 } = req.query;
    const storeId = req.params.id;
    const offset = (Number(page) - 1) * Number(pageSize);

    // 验证店铺存在
    const store = await db('stores').where('id', storeId).first();
    if (!store) { res.status(404).json({ success: false, error: '店铺不存在' }); return; }

    let query = db('store_data').where('store_id', storeId);
    if (category && category !== 'all') {
      query = query.where('category', category as string);
    }

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query
      .select('id', 'category', 'row_count', 'uploaded_at')
      .orderBy('uploaded_at', 'desc')
      .offset(offset).limit(Number(pageSize));

    // 获取各分类数据量
    const categoryStats = await db('store_data')
      .where('store_id', storeId)
      .select('category', db.raw('SUM(row_count) as total_rows'), db.raw('MAX(uploaded_at) as last_upload'))
      .groupBy('category');

    // 获取店铺可用字段
    const availableFields = await db('store_available_fields')
      .where('store_id', storeId)
      .select('category', 'field_name', 'field_label');

    res.json({
      success: true,
      data: {
        store: { id: store.id, name: store.name, userId: store.user_id, createdAt: store.created_at },
        categoryStats: (categoryStats as any[]).map(c => ({
          category: c.category,
          totalRows: Number(c.total_rows),
          lastUpload: c.last_upload,
        })),
        availableFields,
        records: (rows as any[]).map(r => ({
          id: r.id,
          category: r.category,
          rowCount: r.row_count,
          uploadedAt: r.uploaded_at,
        })),
      },
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    console.error('[admin] store data error:', err);
    res.status(500).json({ success: false, error: '获取店铺数据失败' });
  }
});

// DELETE /api/admin/stores/:storeId — 管理员删除店铺及数据
router.delete('/stores/:storeId', async (req: Request, res: Response) => {
  try {
    const storeId = req.params.storeId;
    const store = await db('stores').where('id', storeId).first();
    if (!store) { res.status(404).json({ success: false, error: '店铺不存在' }); return; }

    await db('store_data').where('store_id', storeId).del();
    await db('store_configs').where('store_id', storeId).del();
    await db('store_available_fields').where('store_id', storeId).del();
    await db('upload_records').where('store_id', storeId).del();
    await db('sub_account_stores').where('store_id', storeId).del();
    await db('stores').where('id', storeId).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_store',
      target_type: 'store',
      target_id: storeId,
      details: `管理员删除店铺: ${store.name} (用户: ${store.user_id})`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: '店铺及所有数据已删除' });
  } catch (err: any) {
    console.error('[admin] delete store error:', err);
    res.status(500).json({ success: false, error: '删除店铺失败' });
  }
});

// ==================== 系统信息 & 维护 ====================

// GET /api/admin/system-info — 系统信息
router.get('/system-info', async (_req: Request, res: Response) => {
  try {
    // 数据库表大小
    const tables = await db.raw(`
      SELECT
        TABLE_NAME as table_name,
        ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb,
        TABLE_ROWS as row_count
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC
    `);

    // 各表行数
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

// ==================== 增量统计（会话数、注册趋势等） ====================

// GET /api/admin/trends — 数据趋势（注册、登录、上传综合）
router.get('/trends', async (req: Request, res: Response) => {
  try {
    const { days = 30 } = req.query;
    const numDays = Math.min(Number(days), 365);
    const data: Array<{
      date: string;
      registrations: number;
      logins: number;
      uploads: number;
      rechargeCount: number;
      rechargeAmount: number;
    }> = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const start = new Date();
      start.setDate(start.getDate() - i);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);

      const regCount = await db('users')
        .where('created_at', '>=', start).where('created_at', '<', end)
        .count('* as count').first();

      const loginCount = await db('user_sessions')
        .where('created_at', '>=', start).where('created_at', '<', end)
        .count('* as count').first();

      const uploadCount = await db('upload_records')
        .where('uploaded_at', '>=', start).where('uploaded_at', '<', end)
        .count('* as count').first();

      const rechargeRow = await db('recharge_orders')
        .where('status', 'approved')
        .where('created_at', '>=', start).where('created_at', '<', end)
        .select(db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as amount'))
        .first();

      data.push({
        date: `${start.getMonth() + 1}/${start.getDate()}`,
        registrations: Number((regCount as any)?.count ?? 0),
        logins: Number((loginCount as any)?.count ?? 0),
        uploads: Number((uploadCount as any)?.count ?? 0),
        rechargeCount: Number((rechargeRow as any)?.count ?? 0),
        rechargeAmount: Number((rechargeRow as any)?.amount ?? 0),
      });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取趋势数据失败' });
  }
});

// GET /api/admin/login-history — 最近登录记录
router.get('/login-history', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const query = db('user_sessions')
      .leftJoin('users', 'user_sessions.user_id', 'users.id')
      .select(
        'user_sessions.id', 'user_sessions.user_id', 'users.username',
        'user_sessions.ip_address', 'user_sessions.user_agent',
        'user_sessions.device_info', 'user_sessions.is_active',
        'user_sessions.created_at', 'user_sessions.last_activity_at', 'user_sessions.expires_at',
      )
      .orderBy('user_sessions.created_at', 'desc');

    const total = await query.clone().clearSelect().count('* as count').first();
    const rows = await query.offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: (rows as any[]).map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username || '未知',
        ipAddress: r.ip_address,
        userAgent: r.user_agent,
        deviceInfo: r.device_info,
        isActive: r.is_active,
        createdAt: r.created_at,
        lastActivityAt: r.last_activity_at,
        expiresAt: r.expires_at,
      })),
      total: Number((total as any)?.count) || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取登录历史失败' });
  }
});

// ==================== 维护模式 ====================

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

// ==================== 删除用户账号（完整清理） ====================

// DELETE /api/admin/users/:id/account — 完全删除用户及所有关联数据
router.delete('/users/:id/account', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await db('users').where('id', userId).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

    // 获取用户的所有店铺
    const stores = await db('stores').where('user_id', userId).select('id');
    const storeIds = stores.map((s: any) => s.id);

    // 删除所有关联数据
    for (const sid of storeIds) {
      await db('store_data').where('store_id', sid).del();
      await db('store_configs').where('store_id', sid).del();
      await db('store_available_fields').where('store_id', sid).del();
      await db('upload_records').where('store_id', sid).del();
      await db('sub_account_stores').where('store_id', sid).del();
    }
    await db('stores').where('user_id', userId).del();
    await db('recharge_orders').where('user_id', userId).del();
    await db('membership_history').where('user_id', userId).del();
    await db('user_sessions').where('user_id', userId).del();
    await db('user_operation_logs').where('user_id', userId).del();
    await db('refresh_tokens').where('user_id', userId).del();
    await db('admin_logs').where('admin_id', userId).del();
    await db('invite_codes').where('used_by', user.username).update({ is_used: false, used_by: null, used_at: null });
    await db('sub_roles').where('parent_user_id', userId).del();
    // 删除该用户创建的子账号
    await db('users').where('parent_user_id', userId).del();
    await db('users').where('id', userId).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_account',
      target_type: 'user',
      target_id: userId,
      details: `完全删除用户账号: ${user.username}, 含 ${storeIds.length} 个店铺`,
      ip_address: req.ip,
    });

    res.json({ success: true, message: `用户 ${user.username} 已完全删除，清理了 ${storeIds.length} 个店铺` });
  } catch (err: any) {
    console.error('[admin] delete account error:', err);
    res.status(500).json({ success: false, error: '删除账号失败' });
  }
});

export default router;

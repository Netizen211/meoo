/**
 * 仪表盘路由 — 系统概览、增长趋势、近期活动
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import * as dataService from '../../services/dataService';

const router = Router();

// 所有 admin 路由需要 admin 或 test 角色
router.use(requireAuth, requireRole('admin', 'test'));

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

// GET /api/admin/recent-activity — 最近操作日志
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

export default router;
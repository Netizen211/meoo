/**
 * 营收路由 — 营收概览、交易明细、会员历史
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

// ==================== 营收/财务仪表盘 ====================

// GET /api/admin/revenue/summary — 营收概览
router.get('/revenue/summary', async (_req: Request, res: Response) => {
  try {
    const totalRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .sum('amount as total')
      .first();

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .where('created_at', '>=', monthStart)
      .sum('amount as total')
      .first();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayRevenue = await db('recharge_orders')
      .where('status', 'approved')
      .where('created_at', '>=', todayStart)
      .sum('amount as total')
      .first();

    const pendingAmount = await db('recharge_orders')
      .where('status', 'pending')
      .sum('amount as total')
      .first();

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

    const byPlan = await db('recharge_orders')
      .where('status', 'approved')
      .select('plan', db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as total'))
      .groupBy('plan');

    const byDuration = await db('recharge_orders')
      .where('status', 'approved')
      .select('duration', db.raw('COUNT(*) as count'), db.raw('COALESCE(SUM(amount), 0) as total'))
      .groupBy('duration');

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

export default router;
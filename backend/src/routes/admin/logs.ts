/**
 * 操作日志路由 — 日志查询、导出、清理
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

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

export default router;
/**
 * 公告路由 — 系统公告 CRUD
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

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

export default router;
/**
 * 子账号路由 — 子账号管理、角色权限
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

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

    const subRoleMap: Record<string, string> = {};
    const subIds = (rows as any[]).map(r => r.id);
    if (subIds.length > 0) {
      const roleRows = await db('sub_roles')
        .whereIn('parent_user_id', (rows as any[]).map(r => r.parent_user_id).filter(Boolean))
        .select('parent_user_id', 'name');
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

    const parent = await db('users').where('id', parentUserId).first();
    if (!parent) {
      res.status(404).json({ success: false, error: '父用户不存在' });
      return;
    }
    if (parent.is_sub_account) {
      res.status(400).json({ success: false, error: '父用户不能是子账号' });
      return;
    }

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

export default router;
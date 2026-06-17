/**
 * 用户管理路由 — 用户 CRUD、详情、会话、备注、密码重置、封禁、删除
 */
import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { db } from '../../db';
import { getConfigValue, setConfigValue } from './helpers';

const router = Router();

router.use(requireAuth, requireRole('admin', 'test'));

// ==================== 管理员模拟登录 ====================

// POST /api/admin/impersonate/:userId
router.post('/impersonate/:userId', async (req: Request, res: Response) => {
  try {
    const targetUser = await db('users').where('id', req.params.userId).first();
    if (!targetUser) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const { signAccessToken } = require('../../services/authService');
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

// ==================== 用户列表与创建 ====================

// GET /api/admin/users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { page = 1, pageSize = 20, search, role, membershipLevel, activityLevel, hasRisk } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    const activeDaysSubquery = '(SELECT COUNT(DISTINCT stat_date) FROM user_daily_activity WHERE user_id = users.id AND is_active = 1 AND stat_date >= DATE_SUB(CURDATE(), INTERVAL 30 DAY))';
    const riskSubquery = "(SELECT COUNT(*) FROM risk_events WHERE user_id = users.id AND status = 'open')";

    let query = db('users')
      .select(
        'users.*',
        db.raw('(SELECT COALESCE(SUM(amount), 0) FROM recharge_orders WHERE user_id = users.id AND status = \'approved\') as total_recharge'),
        db.raw('(SELECT COUNT(*) FROM stores WHERE user_id = users.id) as store_count'),
        db.raw('(SELECT MAX(created_at) FROM user_sessions WHERE user_id = users.id) as last_login_at'),
        db.raw('(SELECT COALESCE(SUM(sd.row_count), 0) FROM store_data sd JOIN stores s ON s.id = sd.store_id WHERE s.user_id = users.id) as data_volume'),
        db.raw(activeDaysSubquery + ' as active_days'),
        db.raw(riskSubquery + ' as risk_event_count'),
      );

    if (search) query = query.where('users.username', 'like', '%' + search + '%');
    if (role) query = query.where('users.role', role as string);
    if (membershipLevel) query = query.where('users.membership_level', membershipLevel as string);

    if (activityLevel) {
      switch (activityLevel) {
        case 'high':   query = query.whereRaw(activeDaysSubquery + ' > 20'); break;
        case 'medium': query = query.whereRaw(activeDaysSubquery + ' BETWEEN 10 AND 20'); break;
        case 'low':    query = query.whereRaw(activeDaysSubquery + ' BETWEEN 1 AND 9'); break;
        case 'silent': query = query.whereRaw(activeDaysSubquery + ' = 0'); break;
      }
    }

    if (hasRisk === 'true') {
      query = query.whereRaw(riskSubquery + ' > 0');
    } else if (hasRisk === 'false') {
      query = query.whereRaw(riskSubquery + ' = 0');
    }

    const countQuery = db('users');
    if (search) countQuery.where('users.username', 'like', '%' + search + '%');
    if (role) countQuery.where('users.role', role as string);
    if (membershipLevel) countQuery.where('users.membership_level', membershipLevel as string);
    if (activityLevel) {
      switch (activityLevel) {
        case 'high':   countQuery.whereRaw(activeDaysSubquery + ' > 20'); break;
        case 'medium': countQuery.whereRaw(activeDaysSubquery + ' BETWEEN 10 AND 20'); break;
        case 'low':    countQuery.whereRaw(activeDaysSubquery + ' BETWEEN 1 AND 9'); break;
        case 'silent': countQuery.whereRaw(activeDaysSubquery + ' = 0'); break;
      }
    }
    if (hasRisk === 'true') {
      countQuery.whereRaw(riskSubquery + ' > 0');
    } else if (hasRisk === 'false') {
      countQuery.whereRaw(riskSubquery + ' = 0');
    }

    const total = await countQuery.count('users.id as count').first();
    const rows = await query.orderBy('users.created_at', 'desc').offset(offset).limit(Number(pageSize));

    res.json({
      success: true,
      data: rows.map((r: any) => {
        const ad = r.active_days != null ? Number(r.active_days) : undefined;
        return {
          id: r.id, username: r.username, role: r.role,
          membershipLevel: r.membership_level, membershipExpiresAt: r.membership_expires_at,
          isBanned: r.is_banned, bannedReason: r.banned_reason,
          phone: r.phone, createdAt: r.created_at,
          totalRecharge: Number(r.total_recharge ?? 0),
          storeCount: Number(r.store_count ?? 0),
          dataVolume: r.data_volume != null ? Number(r.data_volume) : undefined,
          lastLoginAt: r.last_login_at || null,
          activeDays: ad,
          activityLevel: ad != null
            ? (ad > 20 ? 'high' : ad >= 10 ? 'medium' : ad >= 1 ? 'low' : 'silent')
            : undefined,
          riskEventCount: r.risk_event_count != null ? Number(r.risk_event_count) : undefined,
        };
      }),
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

// ==================== 批量操作 (必须在 /users/:id 之前) ====================

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

// ==================== 单用户操作 (含 :id 参数) ====================

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
      target_type: 'user', target_id: req.params.id,
      details: isBanned ? '封禁原因: ' + (bannedReason || '管理员操作') : '解封用户',
      ip_address: req.ip,
    });
    res.json({ success: true, message: isBanned ? '用户已封禁' : '用户已解封' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
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

// PUT /api/admin/users/:id/membership — 调整会员等级
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

// ==================== 用户完整详情（多 Tab 数据） ====================

// GET /api/admin/users/:id/full-detail — 用户完整档案
router.get('/users/:id/full-detail', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await db('users').where('id', userId).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

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

    const rechargeRecords = await db('recharge_orders')
      .where('user_id', userId)
      .select('id', 'plan', 'duration', 'amount', 'status', 'created_at', 'reviewed_at', 'review_note')
      .orderBy('created_at', 'desc')
      .limit(50);

    const membershipHistory = await db('membership_history')
      .where('user_id', userId)
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(30);

    const sessions = await db('user_sessions')
      .where({ user_id: userId, is_active: 1 })
      .where('expires_at', '>', db.fn.now())
      .select('id', 'session_id', 'ip_address', 'user_agent', 'device_info', 'last_activity_at', 'created_at', 'expires_at')
      .orderBy('last_activity_at', 'desc');

    const operationLogs = await db('user_operation_logs')
      .where('user_id', userId)
      .select('*')
      .orderBy('created_at', 'desc')
      .limit(50);

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
      details: '撤销用户 ' + id + ' 的会话',
      ip_address: req.ip,
    });
    res.json({ success: true, message: '会话已强制下线' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// DELETE /api/admin/users/:id/sessions — 撤销所有会话
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
      details: '强制下线用户所有会话 (' + count + ' 个)',
      ip_address: req.ip,
    });
    res.json({ success: true, message: '已强制下线 ' + count + ' 个会话', revoked: count });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

// ==================== 密码重置 ====================

// POST /api/admin/users/:id/reset-password
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

    await db('user_sessions').where({ user_id: req.params.id, is_active: 1 }).update({ is_active: 0 });

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'reset_password',
      target_type: 'user',
      target_id: req.params.id,
      details: '管理员重置用户 ' + user.username + ' 的密码',
      ip_address: req.ip,
    });

    res.json({ success: true, message: '已重置用户 ' + user.username + ' 的密码，所有会话已强制下线' });
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

    const key = 'user_note_' + req.params.id;
    await setConfigValue(key, note || '');

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'update_user_note',
      target_type: 'user',
      target_id: req.params.id,
      details: '更新用户备注: ' + (note ? note.substring(0, 100) : '(已清除)'),
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
    const note = await getConfigValue('user_note_' + req.params.id);
    res.json({ success: true, data: { note: note || '' } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取备注失败' });
  }
});

// ==================== 删除用户账号（完整清理） ====================

// DELETE /api/admin/users/:id/account — 完全删除用户及所有关联数据
router.delete('/users/:id/account', async (req: Request, res: Response) => {
  try {
    const userId = req.params.id;
    const user = await db('users').where('id', userId).first();
    if (!user) { res.status(404).json({ success: false, error: '用户不存在' }); return; }

    const stores = await db('stores').where('user_id', userId).select('id');
    const storeIds = stores.map((s: any) => s.id);

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
    await db('users').where('parent_user_id', userId).del();
    await db('users').where('id', userId).del();

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'delete_account',
      target_type: 'user',
      target_id: userId,
      details: '完全删除用户账号: ' + user.username + ', 含 ' + storeIds.length + ' 个店铺',
      ip_address: req.ip,
    });

    res.json({ success: true, message: '用户 ' + user.username + ' 已完全删除，清理了 ' + storeIds.length + ' 个店铺' });
  } catch (err: any) {
    console.error('[admin] delete account error:', err);
    res.status(500).json({ success: false, error: '删除账号失败' });
  }
});

export default router;
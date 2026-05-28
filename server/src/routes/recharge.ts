import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { db } from '../db';

const router = Router();

// POST /api/recharge/apply — 用户提交充值申请
router.post('/apply', requireAuth, async (req: Request, res: Response) => {
  try {
    const { plan, duration, amount, wechatNickname, remark } = req.body;
    const userId = req.user!.userId;

    if (!plan || !['pro', 'enterprise'].includes(plan)) {
      res.status(400).json({ success: false, error: '无效的套餐类型' });
      return;
    }
    if (!duration || !['monthly', 'yearly'].includes(duration)) {
      res.status(400).json({ success: false, error: '无效的时长类型' });
      return;
    }
    if (!amount || amount <= 0) {
      res.status(400).json({ success: false, error: '无效的金额' });
      return;
    }

    // 检查是否已有待审核的申请
    const existing = await db('recharge_orders')
      .where({ user_id: userId, status: 'pending' })
      .first();

    if (existing) {
      res.status(400).json({
        success: false,
        error: '您已有一笔待审核的充值申请，请等待管理员处理',
      });
      return;
    }

    // 获取用户名
    const user = await db('users').where('id', userId).first();

    const [id] = await db('recharge_orders').insert({
      user_id: userId,
      username: user?.username || userId,
      plan,
      duration,
      amount,
      wechat_nickname: wechatNickname || '',
      remark: remark || '',
      status: 'pending',
    });

    await db('admin_logs').insert({
      admin_id: userId,
      action: 'recharge_apply',
      target_type: 'user',
      target_id: userId,
      details: `提交充值申请: ${plan}/${duration}, ¥${amount}`,
    });

    res.json({
      success: true,
      data: { id, status: 'pending' },
      message: '充值申请已提交，请完成转账后等待管理员确认',
    });
  } catch (err: any) {
    console.error('[recharge] apply error:', err);
    res.status(500).json({ success: false, error: '提交申请失败' });
  }
});

// GET /api/recharge/my — 用户查看自己的充值记录
router.get('/my', requireAuth, async (req: Request, res: Response) => {
  try {
    const rows = await db('recharge_orders')
      .where('user_id', req.user!.userId)
      .orderBy('created_at', 'desc');

    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        plan: r.plan,
        duration: r.duration,
        amount: r.amount,
        wechatNickname: r.wechat_nickname,
        remark: r.remark,
        status: r.status,
        reviewNote: r.review_note,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取充值记录失败' });
  }
});

// ===== 管理员接口 =====

// GET /api/recharge/list — 管理员查看充值申请列表
router.get('/list', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const { status, page = 1, pageSize = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(pageSize);

    let query = db('recharge_orders');
    if (status && status !== 'all') {
      query = query.where('status', status);
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
        userId: r.user_id,
        username: r.username,
        plan: r.plan,
        duration: r.duration,
        amount: r.amount,
        wechatNickname: r.wechat_nickname,
        remark: r.remark,
        status: r.status,
        reviewedBy: r.reviewed_by,
        reviewNote: r.review_note,
        reviewedAt: r.reviewed_at,
        createdAt: r.created_at,
      })),
      total: (total as any)?.count || 0,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '获取充值列表失败' });
  }
});

// PUT /api/recharge/review/:id — 管理员审核充值申请
router.put('/review/:id', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const { action, note } = req.body; // action: 'approve' | 'reject'
    const orderId = Number(req.params.id);

    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, error: '无效的操作' });
      return;
    }

    const order = await db('recharge_orders').where('id', orderId).first();
    if (!order) {
      res.status(404).json({ success: false, error: '充值申请不存在' });
      return;
    }
    if (order.status !== 'pending') {
      res.status(400).json({ success: false, error: '该申请已处理' });
      return;
    }

    const now = new Date();

    if (action === 'approve') {
      // 计算会员到期时间
      const months = order.duration === 'yearly' ? 12 : 1;
      const expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);

      // 如果用户当前是 pro 且未过期，叠加时间
      const user = await db('users').where('id', order.user_id).first();
      if (user && user.membership_level === 'pro' && user.membership_expires_at) {
        const currentExpiry = new Date(user.membership_expires_at);
        if (currentExpiry > now) {
          // 在现有到期时间基础上叠加
          expiresAt.setTime(currentExpiry.getTime() + months * 30 * 24 * 60 * 60 * 1000);
        }
      }

      await db('users').where('id', order.user_id).update({
        membership_level: order.plan,
        membership_expires_at: order.plan === 'enterprise' ? null : expiresAt,
      });

      await db('recharge_orders').where('id', orderId).update({
        status: 'approved',
        reviewed_by: req.user!.userId,
        review_note: note || '',
        reviewed_at: now,
        updated_at: now,
      });

      await db('admin_logs').insert({
        admin_id: req.user!.userId,
        action: 'recharge_approve',
        target_type: 'user',
        target_id: order.user_id,
        details: `通过充值申请 #${orderId}: ${order.username} ${order.plan}/${order.duration} ¥${order.amount}`,
        ip_address: req.ip,
      });
    } else {
      await db('recharge_orders').where('id', orderId).update({
        status: 'rejected',
        reviewed_by: req.user!.userId,
        review_note: note || '',
        reviewed_at: now,
        updated_at: now,
      });

      await db('admin_logs').insert({
        admin_id: req.user!.userId,
        action: 'recharge_reject',
        target_type: 'user',
        target_id: order.user_id,
        details: `拒绝充值申请 #${orderId}: ${order.username}, 原因: ${note || '无'}`,
        ip_address: req.ip,
      });
    }

    res.json({ success: true, message: action === 'approve' ? '已通过充值申请' : '已拒绝充值申请' });
  } catch (err: any) {
    console.error('[recharge] review error:', err);
    res.status(500).json({ success: false, error: '审核操作失败' });
  }
});

export default router;

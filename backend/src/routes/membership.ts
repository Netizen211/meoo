import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireRole, requirePaid } from '../middleware/requireRole';
import { db } from '../db';
import { config } from '../config';

const router = Router();

// GET /api/membership/status
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await db('users').where('id', req.user!.userId).first();

    // 测试账号
    if (req.user!.userId === 'test-001') {
      res.json({
        success: true,
        data: {
          level: 'enterprise',
          expiresAt: null,
          reminderDays: 0,
          notifications: [] as string[],
        },
      });
      return;
    }

    if (!row) {
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    const notifications: string[] = [];
    let reminderDays = 0;

    if (row.membership_level === 'pro' && row.membership_expires_at) {
      const expiresAt = new Date(row.membership_expires_at);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilExpiry <= 0) {
        const graceDaysLeft = config.membership.proGraceDays + daysUntilExpiry;
        if (graceDaysLeft > 0) {
          reminderDays = graceDaysLeft;
          notifications.push(`您的专业版会员已过期，云端数据将在 ${graceDaysLeft} 天后清除，请及时续费`);
        }
      } else if (daysUntilExpiry <= config.membership.reminderDays) {
        reminderDays = daysUntilExpiry;
        notifications.push(`您的专业版会员将在 ${daysUntilExpiry} 天后到期，请及时续费以保留云端数据`);
      }
    }

    res.json({
      success: true,
      data: {
        level: row.membership_level,
        expiresAt: row.membership_expires_at,
        reminderDays,
        notifications,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '服务器错误' });
  }
});

// POST /api/membership/upgrade
router.post('/upgrade', requireAuth, async (req: Request, res: Response) => {
  try {
    const { level, duration } = req.body; // duration: 'monthly' | 'yearly'

    if (!['pro', 'enterprise'].includes(level)) {
      res.status(400).json({ success: false, error: '无效的会员等级' });
      return;
    }

    if (req.user!.userId === 'test-001') {
      res.json({ success: true, message: '测试账号无需升级' });
      return;
    }

    // 计算到期时间
    const now = new Date();
    let expiresAt: Date | null = null;
    if (level === 'pro') {
      const months = duration === 'yearly' ? 12 : 1;
      expiresAt = new Date(now.getTime() + months * 30 * 24 * 60 * 60 * 1000);
    }
    // enterprise 不设置到期时间

    await db('users').where('id', req.user!.userId).update({
      membership_level: level,
      membership_expires_at: expiresAt,
    });

    // 记录操作日志
    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'upgrade_membership',
      target_type: 'user',
      target_id: req.user!.userId,
      details: `升级会员: ${level}${expiresAt ? ', 到期时间: ' + expiresAt.toISOString() : ', 长期'}`,
    });

    res.json({
      success: true,
      data: {
        level,
        expiresAt: expiresAt?.toISOString() || null,
      },
      message: '会员升级成功',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '升级失败' });
  }
});

// POST /api/membership/prolong (管理员专用：手动延长或修改会员)
router.post('/prolong', requireAuth, requireRole('admin', 'test'), async (req: Request, res: Response) => {
  try {
    const { targetUserId, level, expiresAt } = req.body;

    const updateData: any = {};
    if (level) updateData.membership_level = level;
    if (expiresAt !== undefined) updateData.membership_expires_at = expiresAt || null;
    if (level === 'enterprise') updateData.membership_expires_at = null;

    await db('users').where('id', targetUserId).update(updateData);

    await db('admin_logs').insert({
      admin_id: req.user!.userId,
      action: 'admin_prolong_membership',
      target_type: 'user',
      target_id: targetUserId,
      details: `管理员调整会员: ${JSON.stringify(updateData)}`,
    });

    res.json({ success: true, message: '会员调整成功' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: '操作失败' });
  }
});

export default router;

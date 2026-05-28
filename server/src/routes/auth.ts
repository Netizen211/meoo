import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { registerUser, loginUser, refreshAccessToken, revokeRefreshToken } from '../services/authService';
import { createDemoDataForUser } from '../services/demoDataService';
import { db } from '../db';
import validator from 'validator';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, phone, inviteCode } = req.body;
    const result = await registerUser(username, password, inviteCode, phone);
    if (result.success) {
      // 新注册用户自动创建演示数据
      if (result.user) {
        createDemoDataForUser(result.user.id).catch(err =>
          console.error('[auth] demo creation failed:', err));
      }
      res.json({ success: true, data: result.tokens, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    console.error('[auth] register error:', err);
    res.status(500).json({ success: false, error: '注册失败，请稍后再试' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await loginUser(username, password);
    if (result.success) {
      // 登录时若用户无店铺，自动创建演示数据
      if (result.user) {
        const storeCount = await db('stores').where('user_id', result.user.id).count('* as cnt').first();
        if (!(storeCount as any)?.cnt) {
          createDemoDataForUser(result.user.id).catch(err =>
            console.error('[auth] demo creation on login failed:', err));
        }
      }
      res.json({ success: true, data: result.tokens, message: result.message });
    } else {
      res.status(401).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    console.error('[auth] login error:', err);
    res.status(500).json({ success: false, error: '登录失败，请稍后再试' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ success: false, error: '缺少刷新令牌' });
      return;
    }
    const result = await refreshAccessToken(refreshToken);
    if (result.success) {
      res.json({ success: true, data: result.tokens });
    } else {
      res.status(401).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    console.error('[auth] refresh error:', err);
    res.status(500).json({ success: false, error: '刷新失败' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
    }
    res.json({ success: true, message: '已退出登录' });
  } catch (err: any) {
    res.json({ success: true, message: '已退出登录' }); // 即使撤销失败也不阻止退出
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const row = await db('users').where('id', req.user!.userId).first();
    if (!row) {
      // 测试账号
      if (req.user!.userId === 'test-001') {
        res.json({
          success: true,
          data: {
            user: {
              id: 'test-001',
              username: '123456',
              role: 'test',
              membershipLevel: 'enterprise',
            },
            notifications: [],
          },
        });
        return;
      }
      res.status(404).json({ success: false, error: '用户不存在' });
      return;
    }

    if (row.is_banned) {
      res.status(403).json({ success: false, error: '账号已被封禁' });
      return;
    }

    // 构建提醒通知
    const notifications: string[] = [];
    if (row.membership_level === 'pro' && row.membership_expires_at) {
      const expiresAt = new Date(row.membership_expires_at);
      const now = new Date();
      const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));

      if (daysUntilExpiry <= 0) {
        const graceDaysLeft = 30 + daysUntilExpiry; // daysUntilExpiry is negative
        if (graceDaysLeft > 0) {
          notifications.push(`您的专业版会员已过期，云端数据将在 ${graceDaysLeft} 天后清除，请及时续费`);
        } else {
          notifications.push('您的专业版会员已过期超过30天，云端数据已被清除');
        }
      } else if (daysUntilExpiry <= 7) {
        notifications.push(`您的专业版会员将在 ${daysUntilExpiry} 天后到期，请及时续费以保留云端数据`);
      }
    }

    res.json({
      success: true,
      data: {
        user: {
          id: row.id,
          username: row.username,
          role: row.role,
          membershipLevel: row.membership_level,
          membershipExpiresAt: row.membership_expires_at,
          phone: row.phone,
          isBanned: row.is_banned,
        },
        notifications,
      },
    });
  } catch (err: any) {
    console.error('[auth] me error:', err);
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

export default router;

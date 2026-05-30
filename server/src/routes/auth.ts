import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { registerUser, loginUser, refreshAccessToken, revokeRefreshToken } from '../services/authService';
import { createDemoDataForUser } from '../services/demoDataService';
import { db } from '../db';
import validator from 'validator';
import crypto from 'crypto';
import { Resend } from 'resend';

const router = Router();

// Resend 邮件客户端
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// ===== 邮箱验证码 =====
// 存储验证码（生产环境应使用 Redis）
const emailCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// POST /api/auth/send-code — 发送邮箱验证码
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !validator.isEmail(email)) {
      res.status(400).json({ success: false, error: '请输入有效的邮箱地址' });
      return;
    }

    // 检查频率限制（同一邮箱60秒内只能发一次）
    const existing = emailCodes.get(email);
    if (existing && Date.now() - existing.expiresAt + 5 * 60 * 1000 < 60 * 1000) {
      res.status(429).json({ success: false, error: '发送过于频繁，请60秒后再试' });
      return;
    }

    // 生成6位验证码
    const code = String(Math.floor(100000 + Math.random() * 900000));
    emailCodes.set(email, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5分钟有效
      attempts: 0,
    });

    // 通过 Resend 发送验证码邮件
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder') {
      try {
        await resend.emails.send({
          from: '店分析 <noreply@melody.wang>',
          to: email,
          subject: '验证码 - 店分析',
          html: `
            <div style="max-width:480px;margin:0 auto;font-family:Arial,sans-serif;color:#e0e0e0;background:#1a1d2e;padding:40px 30px;border-radius:12px;">
              <h2 style="color:#6366f1;margin:0 0 8px 0;">店分析</h2>
              <p style="font-size:14px;color:#a0a0b0;margin:0 0 24px 0;">您的注册验证码</p>
              <div style="background:#0f1119;border:1px solid #2a2d3e;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px 0;">
                <span style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#ffffff;">${code}</span>
              </div>
              <p style="font-size:12px;color:#606080;margin:0;">验证码 5 分钟内有效，请勿转发给他人。</p>
            </div>
          `,
        });
      } catch (sendErr) {
        console.error('[email] Resend send error:', sendErr);
        // 发送失败时清除验证码，让用户重试
        emailCodes.delete(email);
        res.status(500).json({ success: false, error: '邮件发送失败，请稍后再试' });
        return;
      }
    } else {
      // 开发环境：打印到控制台
      console.log(`[EMAIL] 验证码已发送到 ${email}: ${code}`);
    }

    res.json({ success: true, message: '验证码已发送' });
  } catch (err: any) {
    console.error('[auth] send-code error:', err);
    res.status(500).json({ success: false, error: '发送失败' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, email, inviteCode, smsCode } = req.body;

    // 邮箱验证码校验
    if (email) {
      const stored = emailCodes.get(email);
      if (!stored) {
        res.status(400).json({ success: false, error: '请先获取邮箱验证码' });
        return;
      }
      if (Date.now() > stored.expiresAt) {
        emailCodes.delete(email);
        res.status(400).json({ success: false, error: '验证码已过期，请重新获取' });
        return;
      }
      if (stored.attempts >= 5) {
        emailCodes.delete(email);
        res.status(400).json({ success: false, error: '验证码尝试次数过多，请重新获取' });
        return;
      }
      stored.attempts++;
      if (stored.code !== String(smsCode).trim()) {
        res.status(400).json({ success: false, error: '验证码错误' });
        return;
      }
      // 验证成功，删除验证码
      emailCodes.delete(email);
    }

    const result = await registerUser(username, password, inviteCode, email);
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

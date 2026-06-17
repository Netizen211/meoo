import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth';
import { registerUser, loginUser, refreshAccessToken, revokeRefreshToken } from '../services/authService';
import { createDemoDataForUser } from '../services/demoDataService';
import { db } from '../db';
import validator from 'validator';
import crypto from 'crypto';
import { Resend } from 'resend';
import { validate, loginSchema, registerSchema, sendCodeSchema, refreshSchema } from '../middleware/validate';
import logger from '../services/loggerService';

const router = Router();

// Resend 邮件客户端
const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

// ===== 邮箱验证码 =====
// 存储验证码（生产环境应使用 Redis）
const emailCodes = new Map<string, { code: string; expiresAt: number; attempts: number }>();

// ★ 注册限流：同一IP每分钟最多3次
const registerLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '注册请求过于频繁，请1分钟后再试' },
});

// ★ 验证码限流：同一IP每分钟最多2次
const sendCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 2,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '验证码发送过于频繁，请1分钟后再试' },
});

// POST /api/v1/auth/send-code — 发送邮箱验证码
router.post('/send-code', sendCodeLimiter, validate(sendCodeSchema), async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

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
        logger.error('Resend send error', { error: String(sendErr) });
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
    logger.error('send-code error', { error: err.message });
    res.status(500).json({ success: false, error: '发送失败' });
  }
});

// POST /api/v1/auth/register
router.post('/register', registerLimiter, validate(registerSchema), async (req: Request, res: Response) => {
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
      // ★ 已禁用自动演示数据创建
      // if (result.user) {
      //   createDemoDataForUser(result.user.id).catch(err =>
      //     console.error('[auth] demo creation failed:', err));
      // }
      res.json({ success: true, data: result.tokens, message: result.message });
    } else {
      res.status(400).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    logger.error('register error', { error: err.message });
    res.status(500).json({ success: false, error: '注册失败，请稍后再试' });
  }
});

// POST /api/v1/auth/login
router.post('/login', validate(loginSchema), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    const result = await loginUser(username, password);
    if (result.success) {
      // 管理员登录审计
      if (result.user && (result.user.role === 'admin' || result.user.role === 'test')) {
        await db('admin_logs').insert({
          admin_id: result.user.id,
          action: 'admin_login',
          target_type: 'system',
          target_id: '',
          details: `管理员 ${result.user.username} 登录后台管理`,
          ip_address: req.ip,
        });
      }

      // ★ 已禁用：不再自动创建演示数据，保持账号干净
      // 如需恢复演示数据，取消下面注释
      // if (result.user) {
      //   const storeCount = await db('stores').where('user_id', result.user.id).count('* as cnt').first();
      //   if (!(storeCount as any)?.cnt) {
      //     createDemoDataForUser(result.user.id).catch(err =>
      //       console.error('[auth] demo creation on login failed:', err));
      //   }
      // }
      res.json({ success: true, data: result.tokens, message: result.message });
    } else {
      // 记录失败的登录尝试
      if (username === 'admin' || username === '123456') {
        logger.warn('Failed admin login attempt', { extra: { username, ip: req.ip } as any });
      }
      res.status(401).json({ success: false, error: result.message });
    }
  } catch (err: any) {
    logger.error('login error', { error: err.message });
    res.status(500).json({ success: false, error: '登录失败，请稍后再试' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response) => {
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
    logger.error('refresh error', { error: err.message });
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

    // ★ 子账号：加载角色权限
    let permissions: any = null;
    if (row.role === 'sub_account' && row.sub_role_id) {
      const roleRow = await db('sub_roles').where('id', row.sub_role_id).first();
      if (roleRow) {
        permissions = {
          features: roleRow.feature_permissions ? (typeof roleRow.feature_permissions === 'string' ? JSON.parse(roleRow.feature_permissions) : roleRow.feature_permissions) : {},
          data: roleRow.data_permissions ? (typeof roleRow.data_permissions === 'string' ? JSON.parse(roleRow.data_permissions) : roleRow.data_permissions) : {},
        };
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
          permissions,
        },
        notifications,
      },
    });
  } catch (err: any) {
    logger.error('me error', { error: err.message });
    res.status(500).json({ success: false, error: '获取用户信息失败' });
  }
});

export default router;

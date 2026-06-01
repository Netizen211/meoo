import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { db } from '../db';
import { config } from '../config';
import type { JwtPayload } from '../middleware/auth';
import type { User, AuthResponse } from '../shared-types';
import validator from 'validator';

const SALT_ROUNDS = 12;

// ===== 密码处理 =====

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ===== JWT 处理 =====

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.accessExpires as any });
}

export function signRefreshToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.jwt.refreshSecret, { expiresIn: config.jwt.refreshExpires as any });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.secret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as JwtPayload;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateUserId(): string {
  return `user-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

// ===== 认证业务逻辑 =====

export async function registerUser(
  username: string,
  password: string,
  inviteCode: string,
  email?: string
): Promise<{ success: boolean; message: string; user?: User; tokens?: AuthResponse }> {
  // 输入验证
  if (!username || !password || !inviteCode) {
    return { success: false, message: '请填写所有必填项' };
  }
  if (!validator.isLength(username, { min: 3, max: 64 })) {
    return { success: false, message: '用户名长度需要 3-64 个字符' };
  }
  if (!validator.isLength(password, { min: 8, max: 128 })) {
    return { success: false, message: '密码长度需要 8-128 个字符' };
  }
  // ★ 密码复杂度：必须包含至少两种字符类型（字母 + 数字/符号）
  if (!validator.isStrongPassword(password, {
    minLength: 8, minLowercase: 0, minUppercase: 0,
    minNumbers: 0, minSymbols: 0,
  })) {
    // isStrongPassword 默认要求大小写+数字+符号，太严格。改用自定义检查
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^a-zA-Z0-9]/.test(password);
  if (!hasLetter || (!hasNumber && !hasSymbol)) {
    return { success: false, message: '密码必须包含字母，以及数字或符号中的至少一种' };
  }
  // ★ 禁止常见弱密码
  const weakPasswords = ['12345678', 'password', '123456789', 'qwerty123', 'admin123', '11111111', '00000000'];
  if (weakPasswords.includes(password.toLowerCase())) {
    return { success: false, message: '密码过于常见，请使用更复杂的密码' };
  }
  const safeUsername = validator.escape(username);

  // 检查用户名是否已存在
  const existing = await db('users').where('username', safeUsername).first();
  if (existing) {
    return { success: false, message: '用户名已存在' };
  }

  // 验证邀请码
  const code = await db('invite_codes').where({ code: inviteCode, is_used: false }).first();
  if (!code) {
    return { success: false, message: '邀请码无效或已被使用' };
  }

  // 创建用户
  const userId = generateUserId();
  const passwordHash = await hashPassword(password);

  await db('users').insert({
    id: userId,
    username: safeUsername,
    password_hash: passwordHash,
    role: 'normal',
    membership_level: 'free',
    phone: email ? validator.escape(email) : '',
    invite_code: inviteCode,
  });

  // 标记邀请码已使用
  await db('invite_codes').where('code', inviteCode).update({
    is_used: true,
    used_by: safeUsername,
    used_at: new Date(),
  });

  const user: User = {
    id: userId,
    username: safeUsername,
    role: 'normal',
    membershipLevel: 'free',
    phone: email || '',
    inviteCode,
  };

  const tokens = generateTokens(user);

  return { success: true, message: '注册成功', user, tokens };
}

export async function loginUser(
  username: string,
  password: string
): Promise<{ success: boolean; message: string; user?: User; tokens?: AuthResponse }> {
  if (!username || !password) {
    return { success: false, message: '请输入用户名和密码' };
  }

  // 测试账号硬编码
  if (username === config.testAccount.username && password === config.testAccount.password) {
    const user: User = {
      id: 'test-001',
      username: config.testAccount.username,
      role: 'test',
      membershipLevel: 'enterprise',
    };
    const tokens = generateTokens(user);
    return { success: true, message: '登录成功', user, tokens };
  }

  // 查找用户
  const row = await db('users').where('username', username).first();
  if (!row) {
    return { success: false, message: '用户名或密码错误' };
  }

  // 检查是否被封禁
  if (row.is_banned) {
    return { success: false, message: `账号已被封禁${row.banned_reason ? '：' + row.banned_reason : ''}` };
  }

  // 验证密码
  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    return { success: false, message: '用户名或密码错误' };
  }

  // 检查 Pro 会员是否过期
  let membershipLevel = row.membership_level;
  if (membershipLevel === 'pro' && row.membership_expires_at) {
    const expiresAt = new Date(row.membership_expires_at);
    const graceEnd = new Date(expiresAt.getTime() + config.membership.proGraceDays * 24 * 60 * 60 * 1000);
    if (new Date() > graceEnd) {
      // 超过宽限期，降级为 free
      membershipLevel = 'free';
      await db('users').where('id', row.id).update({
        membership_level: 'free',
        membership_expires_at: null,
      });
    }
  }

  // 子账号处理
  let subPermissions = null;
  let parentUserId = null;
  if (row.is_sub_account && row.parent_user_id) {
    parentUserId = row.parent_user_id;
    const subRole = await db('sub_roles').where({ parent_user_id: row.parent_user_id, name: '管理员' }).first();
    if (subRole) {
      try { subPermissions = typeof subRole.permissions === 'string' ? JSON.parse(subRole.permissions) : subRole.permissions; } catch {}
    }
  }

  const user: User = {
    id: row.id,
    username: row.username,
    role: row.role,
    membershipLevel,
    membershipExpiresAt: row.membership_expires_at,
    phone: row.phone || '',
  };

  const tokens = generateTokens(user);

  return { success: true, message: '登录成功', user, tokens };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ success: boolean; message: string; tokens?: AuthResponse }> {
  try {
    const payload = verifyRefreshToken(refreshToken);
    const tokenHash = hashToken(refreshToken);

    // 检查 refresh token 是否在数据库中且未被撤销
    const stored = await db('refresh_tokens')
      .where({ token_hash: tokenHash, revoked_at: null })
      .where('expires_at', '>', new Date())
      .first();

    if (!stored) {
      return { success: false, message: '刷新令牌无效或已过期' };
    }

    // 撤销旧 token
    await db('refresh_tokens').where('id', stored.id).update({ revoked_at: new Date() });

    const user: User = {
      id: payload.userId,
      username: payload.username,
      role: payload.role as User['role'],
      membershipLevel: payload.membershipLevel as User['membershipLevel'],
    };

    const tokens = generateTokens(user);
    return { success: true, message: '令牌刷新成功', tokens };
  } catch {
    return { success: false, message: '刷新令牌无效或已过期' };
  }
}

export async function revokeRefreshToken(refreshToken: string): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await db('refresh_tokens').where({ token_hash: tokenHash }).update({ revoked_at: new Date() });
}

// ===== 内部工具函数 =====

function generateTokens(user: User): AuthResponse {
  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    userId: user.id,
    username: user.username,
    role: user.role,
    membershipLevel: user.membershipLevel,
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 存储 refresh token 哈希
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天
  db('refresh_tokens').insert({
    user_id: user.id,
    token_hash: hashToken(refreshToken),
    expires_at: expiresAt,
  }).catch(err => console.error('[authService] Failed to store refresh token:', err));

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      membershipLevel: user.membershipLevel,
    },
  };
}

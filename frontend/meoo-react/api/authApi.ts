import { apiClient, setTokens, clearTokens } from './client';
import type { User, AuthResponse } from '../../shared/types';

export interface LoginResult {
  success: boolean;
  message: string;
  user?: User;
}

export interface RegisterResult {
  success: boolean;
  message: string;
  user?: User;
}

// 发送邮箱验证码
export async function sendEmailCode(email: string): Promise<{ success: boolean; message: string }> {
  const res = await apiClient.post('/auth/send-code', { email });
  return { success: res.success, message: res.success ? (res.data as any)?.message || '验证码已发送' : res.error || '发送失败' };
}

// 服务端登录
export async function serverLogin(username: string, password: string): Promise<LoginResult> {
  const res = await apiClient.post<AuthResponse>('/auth/login', { username, password });
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return { success: true, message: '登录成功', user: res.data.user };
  }
  return { success: false, message: res.error || '登录失败' };
}

// 服务端注册
export async function serverRegister(
  username: string,
  password: string,
  inviteCode: string,
  email?: string,
  smsCode?: string
): Promise<RegisterResult> {
  const res = await apiClient.post<AuthResponse>('/auth/register', {
    username,
    password,
    inviteCode,
    email,
    smsCode,
  });
  if (res.success && res.data) {
    setTokens(res.data.accessToken, res.data.refreshToken);
    return { success: true, message: (res.data as any).message || '注册成功', user: res.data.user };
  }
  return { success: false, message: res.error || '注册失败' };
}

// 服务端登出
export async function serverLogout(): Promise<void> {
  await apiClient.post('/auth/logout');
  clearTokens();
}

// 刷新令牌
export async function refreshToken(): Promise<boolean> {
  const res = await apiClient.post<AuthResponse>('/auth/refresh');
  return res.success;
}

// 获取当前用户信息
export async function getMe(): Promise<{ user?: User; notifications?: string[] }> {
  const res = await apiClient.get<{ user: User; notifications: string[] }>('/auth/me');
  if (res.success && res.data) {
    return res.data;
  }
  return {};
}

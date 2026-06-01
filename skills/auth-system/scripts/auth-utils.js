/**
 * 认证工具函数
 * 提供注册、登录、登出、获取用户信息等核心认证功能
 * 使用虚拟邮箱方案实现用户名认证
 */

import { supabase } from '../../../src/supabase/client';

/**
 * 生成虚拟邮箱（用于用户名注册）
 * @param {string} username - 用户名
 * @returns {string} 虚拟邮箱地址
 */
function generateVirtualEmail(username) {
  return `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@auth.local`;
}

/**
 * 用户注册
 * @param {string} username - 用户名
 * @param {string} password - 用户密码
 * @param {Object} metadata - 用户元数据（可选）
 * @returns {Promise<{user: Object|null, error: Object|null}>}
 */
export async function registerUser(username, password, metadata = {}) {
  const email = generateVirtualEmail(username);

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        username,
        ...metadata,
      },
    },
  });

  return { user: data?.user, error };
}

/**
 * 用户登录
 * @param {string} username - 用户名
 * @param {string} password - 用户密码
 * @returns {Promise<{session: Object|null, error: Object|null}>}
 */
export async function loginUser(username, password) {
  const email = generateVirtualEmail(username);

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  return { session: data?.session, error };
}

/**
 * 用户登出
 * @returns {Promise<{error: Object|null}>}
 */
export async function logoutUser() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * 获取当前用户信息
 * @returns {Promise<{user: Object|null, profile: Object|null, error: Object|null}>}
 */
export async function getCurrentUser() {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { user: null, profile: null, error: authError };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  return { user, profile, error: profileError };
}

/**
 * 更新用户资料
 * @param {string} userId - 用户 ID
 * @param {Object} updates - 更新字段
 * @returns {Promise<{profile: Object|null, error: Object|null}>}
 */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .maybeSingle();

  return { profile: data, error };
}

/**
 * 更新密码
 * @param {string} newPassword - 新密码
 * @returns {Promise<{error: Object|null}>}
 */
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  return { error };
}

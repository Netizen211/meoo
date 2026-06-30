/**
 * 企业级用户偏好状态管理 (PreferenceStore)
 *
 * 三层架构：
 *   Server (MySQL)  ←→  Zustand Store (内存)  ←→  localStorage (缓存)
 *
 * 核心能力：
 * - 账号隔离：所有 key 在服务端按 userId 分区
 * - 跨设备同步：SSE 实时推送偏好变更到所有已登录设备
 * - 乐观更新：本地立即生效，异步推送到服务端
 * - 冲突检测：版本号机制，冲突时回滚并重新加载
 * - 离线降级：服务端不可用时自动降级到 localStorage
 *
 * 使用方式：
 *   const { get, set } = usePreferenceStore();
 *   const visibleKpis = get('product_visible_kpis', ['商品数']);
 *   set('product_visible_kpis', newSet);
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ===== API 模块 =====
// 导入 JWT 令牌，确保 API 请求通过后端认证
import { getAccessToken, refreshAccessToken } from '../../api/client';

const API_BASE = '/api/v1/preferences';

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getAccessToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ★ 带 401 自动刷新的 fetch 封装
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  let res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options.headers as Record<string,string> } });
  // 401 时尝试刷新 token 后重试一次
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(url, { ...options, headers: { ...authHeaders(), ...options.headers as Record<string,string> } });
    }
  }
  return res;
}

// ★ 修复：请求去重缓存 — 同一时刻多次调用只发一次请求
let fetchAllPromise: Promise<Record<string, { value: any; version: number }>> | null = null;
// ★ 修复：写入防抖 — 同一 key 500ms 内多次 set 只发一次
const debounceTimers: Record<string, ReturnType<typeof setTimeout> | null> = {};

async function fetchAllFromServer(): Promise<Record<string, { value: any; version: number }>> {
  // 如果已有请求在飞行，复用该 Promise
  if (fetchAllPromise) return fetchAllPromise;

  fetchAllPromise = (async () => {
    try {
      const res = await authFetch(API_BASE);
      if (!res.ok) return {};
      const json = await res.json();
      return json.data || {};
    } catch {
      return {};
    } finally {
      fetchAllPromise = null;
    }
  })();

  return fetchAllPromise;
}

async function sendToServer(key: string, value: any, version?: number): Promise<{ success: boolean; version: number; conflict: boolean }> {
  try {
    const res = await authFetch(`${API_BASE}/${key}`, {
      method: 'PUT',
      body: JSON.stringify({ value, version }),
    });
    const json = await res.json();
    if (res.status === 409) {
      return { success: false, version: json.currentVersion || 0, conflict: true };
    }
    return { success: json.success, version: json.data?.version || 0, conflict: false };
  } catch {
    return { success: false, version: 0, conflict: false };
  }
}

async function batchSendToServer(prefs: Array<{ key: string; value: any; version?: number }>): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/batch`, {
      method: 'POST',
      body: JSON.stringify({ prefs }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function migrateToServer(prefs: Record<string, any>): Promise<boolean> {
  try {
    const res = await authFetch(`${API_BASE}/migrate`, {
      method: 'POST',
      body: JSON.stringify({ prefs }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ===== 安全 localStorage 包装 =====
const safeStorage = {
  getItem: (name: string): string | null => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string): void => {
    try { localStorage.setItem(name, value); } catch {
      console.warn(`[PreferenceStore] localStorage 写入失败: ${name}`);
    }
  },
  removeItem: (name: string): void => {
    try { localStorage.removeItem(name); } catch {}
  },
};

// ===== 全局缓存 key（不含 userId = 只存浏览器自身缓存的通用数据） =====
// 注意：这个 store 本身 persist 不隔离用户，只做"未登录时的兜底缓存"
// 真正的用户隔离靠服务端的 userId prefix
const STORAGE_KEY = 'dianfx_preference_cache_v2';

// ===== Store 类型定义 =====

interface PreferenceState {
  // 数据
  preferences: Record<string, { value: any; version: number }>;
  loaded: boolean;
  initialized: boolean;
  pendingSync: Set<string>; // 待同步的 key

  // 初始化
  initialize: (userId: string) => Promise<void>;

  // 读取
  get: <T = any>(key: string, defaultValue: T) => T;
  getVersion: (key: string) => number;

  // 写入（乐观更新 + 异步同步）
  set: (key: string, value: any) => void;

  // 批量写入
  setBatch: (entries: Array<{ key: string; value: any }>) => void;

  // 从服务端重新加载
  reload: () => Promise<void>;

  // 应用来自 SSE 的远程更新
  applyRemoteUpdate: (key: string, value: any, version: number) => void;

  // 迁移旧数据
  migrateLegacyData: (userId: string) => Promise<number>;

  // 销毁（退出登录时）
  destroy: () => void;
}

export const usePreferenceStore = create<PreferenceState>()(
  persist(
    (set, get) => ({
      preferences: {},
      loaded: false,
      initialized: false,
      pendingSync: new Set(),

      // ─── 初始化 ────────────────────────────────────
      initialize: async (userId: string) => {
        if (get().initialized) return;

        try {
          // 1. 先加载缓存（立即可用）
          // 2. 再从服务端拉取最新数据
          const serverPrefs = await fetchAllFromServer();

          set((state) => {
            // 合并：服务端数据优先于本地缓存
            const merged = { ...state.preferences };
            for (const [key, pref] of Object.entries(serverPrefs)) {
              merged[key] = pref;
            }
            return {
              preferences: merged,
              loaded: true,
              initialized: true,
            };
          });

          // ★ 修复：初始化完成后推送队列中的待同步项（带正确的 version）
          const pendingAfterInit = get().pendingSync;
          if (pendingAfterInit.size > 0) {
            const prefs = get().preferences;
            const batchData = Array.from(pendingAfterInit).map(key => ({
              key,
              value: prefs[key]?.value,
              version: prefs[key]?.version || 0,
            }));
            batchSendToServer(batchData).then((success) => {
              if (success) {
                set((s) => ({ pendingSync: new Set() }));
              }
            });
          }
        } catch (error) {
          console.warn('[PreferenceStore] 服务端加载失败，使用缓存数据:', error);
          set({ loaded: true, initialized: true });
        }
      },

      // ─── 读取 ────────────────────────────────────
      get: <T = any>(key: string, defaultValue: T): T => {
        const pref = get().preferences[key];
        if (pref === undefined || pref === null) return defaultValue;
        return pref.value !== undefined ? pref.value as T : defaultValue;
      },

      getVersion: (key: string): number => {
        const pref = get().preferences[key];
        return pref?.version || 0;
      },

      // ─── 写入（乐观更新 + 500ms防抖） ─────────────────
      set: (key: string, value: any) => {
        const state = get();
        const currentVersion = state.preferences[key]?.version || 0;

        // 乐观更新：立即更新本地状态
        set((s) => ({
          preferences: {
            ...s.preferences,
            [key]: { value, version: currentVersion },
          },
          pendingSync: new Set(s.pendingSync).add(key),
        }));

        // ★ 修复：初始化未完成时不同步到服务端（避免 version=0 导致 409）
        if (!state.initialized) {
          return; // 等 initialize 完成后统一推送
        }

        // ★ 修复：防抖 — 同一 key 在 500ms 内多次 set 只发最后一次
        if (debounceTimers[key]) clearTimeout(debounceTimers[key]);
        debounceTimers[key] = setTimeout(() => {
          debounceTimers[key] = null;
          const latest = get().preferences[key];
          if (!latest) return;
          sendToServer(key, latest.value, currentVersion).then((result) => {
            if (result.conflict) {
              console.warn(`[PreferenceStore] 版本冲突 (${key})，重新加载`);
              get().reload();
            } else if (result.success) {
              set((s) => {
                const newPrefs = { ...s.preferences };
                if (newPrefs[key]) {
                  newPrefs[key] = { value: latest.value, version: result.version };
                }
                const newPending = new Set(s.pendingSync);
                newPending.delete(key);
                return { preferences: newPrefs, pendingSync: newPending };
              });
            }
          });
        }, 500);
      },

      // ─── 批量写入 ────────────────────────────────
      setBatch: (entries: Array<{ key: string; value: any }>) => {
        const state = get();
        const newPrefs = { ...state.preferences };
        const newPending = new Set(state.pendingSync);

        for (const { key, value } of entries) {
          const currentVersion = state.preferences[key]?.version || 0;
          newPrefs[key] = { value, version: currentVersion };
          newPending.add(key);
        }

        set({ preferences: newPrefs, pendingSync: newPending });

        // 异步批量同步
        const batchData = entries.map(({ key }) => ({
          key,
          value: newPrefs[key].value,
          version: state.preferences[key]?.version,
        }));

        batchSendToServer(batchData).then((success) => {
          if (success) {
            set((s) => {
              const cleared = new Set(s.pendingSync);
              for (const { key } of entries) cleared.delete(key);
              return { pendingSync: cleared };
            });
          }
        });
      },

      // ─── 重新加载 ────────────────────────────────
      reload: async () => {
        const serverPrefs = await fetchAllFromServer();
        if (Object.keys(serverPrefs).length > 0) {
          set({ preferences: serverPrefs as any });
        }
      },

      // ─── SSE 远程更新 ────────────────────────────
      applyRemoteUpdate: (key: string, value: any, version: number) => {
        set((state) => {
          const current = state.preferences[key];
          // 只有当版本号更高时才接受远程更新
          if (current && current.version >= version) {
            return state; // 忽略旧版本更新
          }
          return {
            preferences: {
              ...state.preferences,
              [key]: { value, version },
            },
          };
        });
      },

      // ─── 迁移旧数据 ──────────────────────────────
      migrateLegacyData: async (userId: string): Promise<number> => {
        const legacyKeys: Record<string, string> = {
          'dianfx_product_visible_kpis': 'product_visible_kpis',
          'dianfx_product_kpi_order': 'product_kpi_order',
          'dianfx_visible_kpis': 'dashboard_visible_kpis',
          'dianfx_kpi_card_order': 'dashboard_kpi_order',
          'dianfx_selected_trend_kpis': 'dashboard_trend_kpis',
          'dianfx_hidden_cols': 'dashboard_hidden_cols',
          'dianfx_pinned_cols': 'dashboard_pinned_cols',
          'dianfx_order_custom_costs': 'dashboard_custom_costs',
          'dianfx_saved_filters': 'saved_filters',
          'dianfx_filter_history': 'filter_history',
          'dianfx_saved_ranges': 'saved_ranges',
          'dianfx_search_history': 'search_history',
          'dianfx_dark_mode': 'dark_mode',
          'dianfx_cost_active_tab': 'cost_active_tab',
          'dianfx_courier_rates': 'courier_rates',
          'dianfx_last_store': 'last_store',
        };

        const legacyData: Record<string, any> = {};
        let count = 0;

        for (const [legacyKey, newKey] of Object.entries(legacyKeys)) {
          try {
            const raw = localStorage.getItem(legacyKey);
            if (raw !== null) {
              try {
                legacyData[newKey] = JSON.parse(raw);
              } catch {
                legacyData[newKey] = raw;
              }
              count++;
            }
          } catch { /* ignore */ }
        }

        if (count > 0) {
          // 发送到服务端
          await migrateToServer(legacyData);
          // 更新本地 store
          set((state) => {
            const newPrefs = { ...state.preferences };
            for (const [newKey, value] of Object.entries(legacyData)) {
              newPrefs[newKey] = { value, version: 1 };
            }
            return { preferences: newPrefs };
          });
        }

        return count;
      },

      // ─── 销毁 ────────────────────────────────────
      destroy: () => {
        set({
          preferences: {},
          loaded: false,
          initialized: false,
          pendingSync: new Set(),
        });
      },
    }),
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => safeStorage),
      // 只持久化 preferences（不持久化运行时状态）
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    },
  ),
);

export default usePreferenceStore;

// ★ 暴露 preferenceStore 到 window，供反馈中心捕获偏好设置
if (typeof window !== 'undefined') {
  try {
    if (!(window as any).__ZUSTAND_STORES__) (window as any).__ZUSTAND_STORES__ = {};
    (window as any).__ZUSTAND_STORES__.preferenceStore = usePreferenceStore;
  } catch {}
}

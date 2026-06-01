// API 客户端：fetch 封装 + JWT 管理 + 自动刷新 + API 版本控制

const API_VERSION = 'v1';
const API_BASE = process.env.NODE_ENV === 'production'
  ? `/api/${API_VERSION}`
  : `http://localhost:3007/api/${API_VERSION}`;

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

const TOKEN_STORAGE_KEY = 'dianfx_jwt_tokens';

// 持久化 token 存储：内存 + localStorage 双写，页面刷新不丢失
function loadTokens(): TokenStore {
  try {
    const saved = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { accessToken: null, refreshToken: null };
}

function saveTokensToStorage(t: TokenStore): void {
  try {
    if (t.accessToken) {
      localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(t));
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  } catch {}
}

let tokens: TokenStore = loadTokens();

let refreshPromise: Promise<boolean> | null = null;

export function setTokens(accessToken: string, refreshToken: string): void {
  tokens.accessToken = accessToken;
  tokens.refreshToken = refreshToken;
  saveTokensToStorage(tokens);
}

export function clearTokens(): void {
  const hadTokens = !!(tokens.accessToken || tokens.refreshToken);
  tokens.accessToken = null;
  tokens.refreshToken = null;
  refreshPromise = null;
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
  // 只在确实有过token（服务端登录）时才触发全局登出
  if (hadTokens) {
    try { window.dispatchEvent(new CustomEvent('dianfx:auth-expired')); } catch {}
  }
}

export function hasTokens(): boolean {
  return !!tokens.accessToken;
}

export function getAccessToken(): string | null {
  return tokens.accessToken;
}

async function refreshAccessToken(): Promise<boolean> {
  if (!tokens.refreshToken) return false;

  // 避免并发刷新
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });

      if (!res.ok) {
        clearTokens();
        return false;
      }

      const json = await res.json();
      if (json.success && json.data) {
        setTokens(json.data.accessToken, json.data.refreshToken);
        return true;
      }

      clearTokens();
      return false;
    } catch {
      clearTokens();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
  const url = `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`;
  }

  let res = await fetch(url, { ...options, headers });

  // 401 时尝试刷新 token 并重试一次
  if (res.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      res = await fetch(url, { ...options, headers });
    }
  }

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = { success: !res.ok, error: res.statusText };
  }

  return {
    success: body.success !== false,
    data: body.data,
    error: body.error,
    status: res.status,
  };
}

/**
 * ★ 带重试的请求（指数退避）
 * 适用于关键 API 调用（登录、数据同步等）
 * 5xx 错误或网络错误自动重试，4xx 不重试
 */
async function requestWithRetry<T = any>(
  path: string,
  options: RequestInit = {},
  maxRetries: number = 3,
): Promise<{ success: boolean; data?: T; error?: string; status: number }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await request<T>(path, options);

    // 4xx 错误不重试（客户端错误）
    if (result.status >= 400 && result.status < 500) return result;
    // 成功不重试
    if (result.success) return result;

    // 最后一次尝试，直接返回
    if (attempt === maxRetries) return result;

    // 指数退避：100ms, 200ms, 400ms
    const delay = 100 * Math.pow(2, attempt);
    await new Promise(r => setTimeout(r, delay));
  }
  // unreachable
  return { success: false, error: '请求失败', status: 0 };
}

// 便利方法
export const apiClient = {
  get<T = any>(path: string) {
    return request<T>(path);
  },

  /** GET 带重试（关键数据拉取） */
  getReliable<T = any>(path: string) {
    return requestWithRetry<T>(path);
  },

  post<T = any>(path: string, body?: any) {
    return request<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  /** POST 带重试（数据同步等关键操作） */
  postReliable<T = any>(path: string, body?: any) {
    return requestWithRetry<T>(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  put<T = any>(path: string, body?: any) {
    return request<T>(path, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  delete<T = any>(path: string) {
    return request<T>(path, { method: 'DELETE' });
  },

  async isServerAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  },

  getBaseUrl(): string {
    return API_BASE;
  },
};

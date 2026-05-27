// API 客户端：fetch 封装 + JWT 管理 + 自动刷新

const API_BASE = process.env.NODE_ENV === 'production' ? '/api' : 'http://localhost:3015/api';

interface TokenStore {
  accessToken: string | null;
  refreshToken: string | null;
}

let tokens: TokenStore = {
  accessToken: null,
  refreshToken: null,
};

let refreshPromise: Promise<boolean> | null = null;

export function setTokens(accessToken: string, refreshToken: string): void {
  tokens.accessToken = accessToken;
  tokens.refreshToken = refreshToken;
}

export function clearTokens(): void {
  tokens.accessToken = null;
  tokens.refreshToken = null;
  refreshPromise = null;
}

export function hasTokens(): boolean {
  return !!tokens.accessToken;
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

// 便利方法
export const apiClient = {
  get<T = any>(path: string) {
    return request<T>(path);
  },

  post<T = any>(path: string, body?: any) {
    return request<T>(path, {
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

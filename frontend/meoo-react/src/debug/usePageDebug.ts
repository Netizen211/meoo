/**
 * usePageDebug — 统一页面调试上下文 hook
 *
 * 每个页面只需调用一次，自动采集：
 *   1. 页面名称（手动传入）
 *   2. 当前路由 + hash
 *   3. 用户身份（从 localStorage JWT 解码）
 *   4. 当前店铺 ID
 *   5. 数据概览（从 useDataStore 自动读取）
 *   6. 页面自定义 KPI（手动传入）
 *
 * 用法：
 *   usePageDebug('after-sale', { orderCount, refundRate });
 *
 * 不再需要手动 import { setDebugContext } + useEffect
 */
import { useEffect, useRef } from 'react';
import { setDebugContext, getDebugContext } from './DebugOverlay';

// 全局 debug context 注册表（自动收集所有页面的状态）
let globalContext: Record<string, any> = {};

export function usePageDebug(
  pageName: string,
  pageKpis?: Record<string, any>
) {
  const prevPageRef = useRef<string>('');

  // 记录此 hook 实例设置过的 key，用于清理
  const keysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const now = pageName;

    // ★ 清理上一个页面留下的 KPI（只清除动态 key，保留 user/stores 等全局信息）
    // 使用 'page_' 前缀和自定义 KPI key 作为清理标记
    const autoKeys = new Set([
      'page', 'route', 'timestamp', 'userId', 'username', 'role',
      'storeCount', 'storeIds', 'uploadCount', 'syncStatus', 'storageMode',
    ]);
    // 清除旧页面的自定义 KPI（不在 autoKeys 中的 key）
    for (const k of keysRef.current) {
      if (!autoKeys.has(k)) {
        setDebugContext(k, undefined);
      }
    }
    keysRef.current.clear();

    // 基础上下文（自动采集）
    const baseCtx: Record<string, any> = {
      page: now,
      route: location.hash || location.pathname,
      timestamp: new Date().toISOString(),
    };

    // 用户身份
    try {
      const raw = localStorage.getItem('dianfx_jwt_tokens');
      if (raw) {
        const tokens = JSON.parse(raw);
        if (tokens.accessToken) {
          const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
          baseCtx.userId = payload.userId || '';
          baseCtx.username = payload.username || '';
          baseCtx.role = payload.role || '';
        }
      }
    } catch {}

    // 自动读取 useDataStore 的数据概况（不传全量数据）
    try {
      const zStores = (window as any).__ZUSTAND_STORES__;
      if (zStores?.dataStore) {
        const ds = zStores.dataStore.getState();
        if (ds) {
          const storeIds = Object.keys(ds.storeDataMap || {});
          baseCtx.storeCount = storeIds.length;
          baseCtx.storeIds = storeIds;
          baseCtx.uploadCount = (ds.uploadRecords || []).length;
          baseCtx.syncStatus = ds.syncStatus;
          baseCtx.storageMode = ds.storageMode;
        }
      }
    } catch {}

    // 页面自定义 KPI
    if (pageKpis && typeof pageKpis === 'object') {
      for (const [key, val] of Object.entries(pageKpis)) {
        baseCtx[key] = val;
        if (!autoKeys.has(key)) keysRef.current.add(key);
      }
    }

    // 注册到全局
    for (const [k, v] of Object.entries(baseCtx)) {
      setDebugContext(k, v);
    }

    // 也记录到全局注册表
    globalContext[now] = { ...baseCtx, _capturedAt: Date.now() };

    return () => {
      setDebugContext('page_left_at', new Date().toISOString());
      // 页面卸载时也清理自定义 KPI
      for (const k of keysRef.current) {
        setDebugContext(k, undefined);
      }
    };
  }, [pageName, pageKpis]);
}

/**
 * 获取 debug 上下文的全局注册表（所有页面的历史快照）
 */
export function getPageDebugHistory(): Record<string, any> {
  return { ...globalContext };
}

/**
 * 获取当前完整的 debug 上下文
 */
export function getCurrentDebugContext(): Record<string, any> {
  return getDebugContext();
}

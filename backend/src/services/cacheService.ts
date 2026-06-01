/**
 * 内存缓存服务 — 分析结果缓存，TTL 自动过期
 *
 * PM2 集群模式下的缓存一致性策略：
 * - 每个进程独立维护内存缓存（最快读取速度）
 * - 缓存失效通过 PM2 IPC 消息广播到所有进程
 * - 无 PM2 时（单进程模式）直接本地失效
 *
 * 策略：
 * - 原始数据缓存 30s（频繁请求复用）
 * - 计算结果缓存 60s（计算成本高）
 * - 数据同步时主动失效
 */

import logger from './loggerService';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<any>>();

// 最大缓存条目数（防止内存泄漏）
const MAX_ENTRIES = 10000;

// 定时清理过期条目（每5分钟）
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt < now) {
      store.delete(key);
      cleaned++;
    }
  }
  if (cleaned > 0) {
    logger.debug(`Cache cleanup: removed ${cleaned} expired entries, ${store.size} remaining`);
  }
}, 300000);
// unref 防止阻止进程退出
if (typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * ★ PM2 集群跨进程缓存失效
 * 利用 PM2 的进程间消息 (process.send) 广播缓存失效指令
 */
export function startClusterCacheInvalidation(): void {
  // 检查是否在 PM2 集群模式下运行
  const isPM2 = typeof process.send === 'function' && process.env.NODE_APP_INSTANCE !== undefined;

  if (!isPM2) {
    logger.debug('Cache: single-process mode (no PM2 cluster detected)');
    return;
  }

  logger.info('Cache: PM2 cluster mode — IPC invalidation enabled');

  // 监听来自其他进程的缓存失效消息
  process.on('message', (msg: any) => {
    if (msg && msg.type === 'cache:invalidate') {
      if (msg.pattern === '*') {
        store.clear();
        logger.debug('Cache: cleared all (IPC broadcast)');
      } else if (msg.storeId) {
        internalInvalidateStore(msg.storeId);
        logger.debug(`Cache: invalidated store ${msg.storeId} (IPC broadcast)`);
      }
    }
  });
}

/** 广播缓存失效到所有 PM2 进程 */
function broadcastInvalidation(storeId?: string): boolean {
  if (typeof process.send === 'function') {
    try {
      process.send({
        type: 'cache:invalidate',
        pattern: storeId ? undefined : '*',
        storeId,
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function internalInvalidateStore(storeId: string): void {
  const suffix = `:${storeId}`;
  for (const key of store.keys()) {
    if (key.endsWith(suffix)) store.delete(key);
  }
}

export const cache = {
  /** 读取缓存，过期返回 null */
  get<T>(key: string): T | null {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.data as T;
  },

  /** 写入缓存，TTL 秒后过期 */
  set<T>(key: string, data: T, ttlSeconds: number = 30): void {
    // LRU 简单实现：超过最大条目数时删除最老的 20%
    if (store.size >= MAX_ENTRIES) {
      const entries = Array.from(store.entries());
      entries.sort((a, b) => a[1].expiresAt - b[1].expiresAt);
      const toDelete = Math.ceil(MAX_ENTRIES * 0.2);
      for (let i = 0; i < toDelete && i < entries.length; i++) {
        store.delete(entries[i][0]);
      }
      logger.warn(`Cache: evicted ${toDelete} oldest entries (limit ${MAX_ENTRIES})`);
    }

    store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  },

  /** 主动失效指定前缀的所有缓存 */
  invalidate(prefix: string): void {
    for (const key of store.keys()) {
      if (key.startsWith(prefix)) store.delete(key);
    }
    broadcastInvalidation();
  },

  /** ★ 主动失效指定 storeId 的所有缓存（集群安全） */
  invalidateStore(storeId: string): void {
    internalInvalidateStore(storeId);
    broadcastInvalidation(storeId);
  },

  /** 获取缓存统计 */
  stats(): { size: number; maxSize: number; keys: string[] } {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.expiresAt < now) store.delete(key);
    }
    return {
      size: store.size,
      maxSize: MAX_ENTRIES,
      keys: Array.from(store.keys()).slice(0, 50), // 最多返回 50 个 key
    };
  },

  /** 清空全部缓存 */
  clear(): void {
    store.clear();
    broadcastInvalidation();
  },
};

export default cache;

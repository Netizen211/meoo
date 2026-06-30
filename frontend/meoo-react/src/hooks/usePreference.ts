/**
 * usePreference Hook
 *
 * 替代直接使用 localStorage 的 useState 模式。
 * 提供与 useState 一致的 API，但数据存储在 PreferenceStore 中，
 * 自动同步到服务端，支持跨设备/跨浏览器保持一致。
 *
 * 用法：
 *   // 替代: const [visible, setVisible] = useState(() => localStorage.getItem(...))
 *   const [visibleKpis, setVisibleKpis] = usePreference<Set<string>>(
 *     'product_visible_kpis',
 *     new Set(['商品数']),
 *     { serialize: (v) => [...v], deserialize: (v) => new Set(v) }
 *   );
 *
 * 或者简单值：
 *   const [darkMode, setDarkMode] = usePreference<boolean>('dark_mode', false);
 */
import { useCallback, useMemo } from 'react';
import { usePreferenceStore } from '../store/preferenceStore';

export interface UsePreferenceOptions<T> {
  /** 序列化：存储到服务端前的转换（如 Set -> Array） */
  serialize?: (value: T) => any;
  /** 反序列化：从服务端读取后的转换（如 Array -> Set） */
  deserialize?: (stored: any) => T;
}

/**
 * 通用偏好 hook，返回 [value, setValue] 与 React.useState 签名一致
 */
export function usePreference<T = any>(
  key: string,
  defaultValue: T,
  options?: UsePreferenceOptions<T>,
): [T, (value: T | ((prev: T) => T)) => void] {
  const store = usePreferenceStore();

  const value = useMemo(() => {
    const raw = store.get(key, defaultValue);
    if (options?.deserialize) {
      return options.deserialize(raw);
    }
    return raw as T;
  }, [store.preferences[key], key]); // eslint-disable-line react-hooks/exhaustive-deps

  const setValue = useCallback((newValue: T | ((prev: T) => T)) => {
    // 支持函数更新器（兼容 useState 模式）
    const resolved = typeof newValue === 'function'
      ? (newValue as (prev: T) => T)(store.get(key, defaultValue) as T)
      : newValue;
    const toStore = options?.serialize ? options.serialize(resolved) : resolved;
    store.set(key, toStore);
  }, [key, defaultValue, store]);

  return [value, setValue];
}

/**
 * 批量管理多个偏好（用于页面卸载时一次性保存）
 */
export function usePreferenceBatch(): {
  get: <T>(key: string, defaultValue: T) => T;
  set: (key: string, value: any) => void;
  setBatch: (entries: Array<{ key: string; value: any }>) => void;
  save: () => void;
} {
  const store = usePreferenceStore();

  return useMemo(() => ({
    get: <T>(key: string, defaultValue: T): T => store.get(key, defaultValue),
    set: (key: string, value: any) => store.set(key, value),
    setBatch: (entries: Array<{ key: string; value: any }>) => store.setBatch(entries),
    save: () => {
      // 批量同步由 store 内部自动处理
    },
  }), [store]);
}

/**
 * 偏好初始化 hook：在 App 初始化时调用
 */
export function usePreferenceInit(userId: string | null): { ready: boolean; migrated: number } {
  const store = usePreferenceStore();

  // 当 userId 变化时初始化
  useMemo(() => {
    if (userId) {
      store.initialize(userId).then(() => {
        // 异步迁移旧数据（只执行一次）
        store.migrateLegacyData(userId).then((count) => {
          if (count > 0) {
            console.log(`[PreferenceStore] 已迁移 ${count} 项旧数据到服务端`);
          }
        });
      });
    } else {
      store.destroy();
    }
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    ready: store.initialized,
    migrated: 0,
  };
}

export default usePreference;

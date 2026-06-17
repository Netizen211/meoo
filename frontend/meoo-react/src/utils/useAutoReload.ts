/**
 * useAutoReload — 部署版本自检 Hook
 *
 * 运行时轮询 build-meta.json，发现 buildId 变更时自动刷新页面。
 * 彻底解决「部署新版本后用户浏览器因缓存看不到新内容」的问题。
 *
 * 原理：每个生产构建会生成 build-meta.json（含唯一 buildId），
 *       此 Hook 在页面可见时定期对比本地缓存的 buildId 与服务器最新版本，
 *       若不一致则自动刷新。
 *
 * 使用方式：在根组件中调用 useAutoReload() 即可。
 */
import { useEffect, useRef } from 'react';

const CHECK_INTERVAL = 30_000; // 30秒检查一次
const VERSION_CACHE_KEY = 'meoo_build_id';

export function useAutoReload(metaPath = '/build-meta.json') {
  const checkedRef = useRef(false);

  useEffect(() => {
    // ★ 只在生产环境生效
    if (process.env.NODE_ENV !== 'production') return;

    let timer: ReturnType<typeof setInterval>;
    let aborted = false;

    const checkVersion = async () => {
      try {
        const res = await fetch(metaPath + '?t=' + Date.now(), {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const meta = await res.json();
        if (!meta.buildId) return;

        const prev = sessionStorage.getItem(VERSION_CACHE_KEY);

        if (!prev) {
          // 首次加载：记录当前版本
          sessionStorage.setItem(VERSION_CACHE_KEY, meta.buildId);
          checkedRef.current = true;
          return;
        }

        if (prev !== meta.buildId) {
          // ★ 版本不一致 → 有新部署 → 自动刷新
          sessionStorage.setItem(VERSION_CACHE_KEY, meta.buildId);
          // 短暂延迟让 toast 展示
          window.location.reload();
        }
      } catch {
        // 静默失败（可能是 offline，不影响用户）
      }
    };

    // 初次检查（延迟一下等页面渲染完毕）
    const initial = setTimeout(checkVersion, 2000);

    // 定时轮询 + 页面可见性变化时检查
    timer = setInterval(checkVersion, CHECK_INTERVAL);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      aborted = true;
      clearTimeout(initial);
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

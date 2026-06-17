import { useState, useEffect, useCallback } from 'react';

type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'dianfx_dark_mode';

function migrateAdminTheme(): void {
  // ★ 向后兼容：将旧的 admin_theme 迁移到 dianfx_dark_mode
  try {
    const adminTheme = localStorage.getItem('admin_theme');
    if (adminTheme !== null && localStorage.getItem(STORAGE_KEY) === null) {
      localStorage.setItem(STORAGE_KEY, adminTheme === 'dark' ? 'true' : 'false');
      localStorage.removeItem('admin_theme');
    }
  } catch {}
}

function getInitialMode(): ThemeMode {
  if (typeof document === 'undefined') return 'light';
  migrateAdminTheme();
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'true') return 'dark';
  if (saved === 'false') return 'light';
  if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) return 'dark';
  const htmlTheme = document.documentElement.getAttribute('data-theme');
  if (htmlTheme === 'dark' || htmlTheme === 'light') return htmlTheme;
  return 'light';
}

function applyThemeMode(mode: ThemeMode) {
  const html = document.documentElement;
  if (mode === 'dark') {
    html.classList.add('dark');
    html.setAttribute('data-theme', 'dark');
  } else {
    html.classList.remove('dark');
    html.setAttribute('data-theme', 'light');
  }
  localStorage.setItem(STORAGE_KEY, mode === 'dark' ? 'true' : 'false');
}

export function useDarkMode() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    applyThemeMode(mode);
    if (!ready) {
      requestAnimationFrame(() => {
        document.documentElement.classList.add('theme-ready');
        setReady(true);
      });
    }
  }, [mode, ready]);

  const toggle = useCallback(() => {
    setMode(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setDark = useCallback(() => setMode('dark'), []);
  const setLight = useCallback(() => setMode('light'), []);

  return { isDark: mode === 'dark', isLight: mode === 'light', mode, toggle, setDark, setLight, ready };
}

export type { ThemeMode };

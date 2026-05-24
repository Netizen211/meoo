import { useEffect, useState, useCallback } from 'react';
import { ThemeMode } from '../themes/types';
import { applyTheme, getInitialTheme, getThemeByMode, saveThemePreference } from '../themes/theme-config';

/**
 * 主题管理 Hook
 * 支持 Light/Dark 模式切换
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemeMode>(getInitialTheme);
  const [isReady, setIsReady] = useState(false);

  // 应用主题
  const applyThemeToDOM = useCallback((mode: ThemeMode) => {
    const themeConfig = getThemeByMode(mode);
    applyTheme(themeConfig);
  }, []);

  // 设置主题
  const setTheme = useCallback((mode: ThemeMode) => {
    setThemeState(mode);
    saveThemePreference(mode);
    applyThemeToDOM(mode);
  }, [applyThemeToDOM]);

  // 切换主题
  const toggleTheme = useCallback(() => {
    const newMode = theme === 'dark' ? 'light' : 'dark';
    setTheme(newMode);
  }, [theme, setTheme]);

  // 初始化
  useEffect(() => {
    applyThemeToDOM(theme);
    setIsReady(true);
  }, [theme, applyThemeToDOM]);

  // 监听系统主题变化
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      // 只有在用户没有手动设置过主题时才自动切换
      const saved = localStorage.getItem('dianfx_dark_mode');
      if (saved === null) {
        const newMode = e.matches ? 'dark' : 'light';
        setThemeState(newMode);
        applyThemeToDOM(newMode);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyThemeToDOM]);

  // 监听来自父窗口的主题切换消息（iframe 场景）
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data && typeof event.data.theme === 'string') {
        const newTheme = event.data.theme as ThemeMode;
        if (newTheme === 'light' || newTheme === 'dark') {
          setTheme(newTheme);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [setTheme]);

  return {
    theme,
    isDark: theme === 'dark',
    isReady,
    setTheme,
    toggleTheme,
  };
}

export type { ThemeMode };

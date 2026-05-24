import { ThemeConfig, ThemeMode } from './types';

/**
 * 拼多多风格主题配置
 * 主色调：拼多多红 #e02e24
 */

export const lightTheme: ThemeConfig = {
  name: 'pdd-light',
  mode: 'light',
  colors: {
    // 主色调 - 拼多多红
    primary: '#e02e24',
    primaryLight: '#ef4444',
    primaryDark: '#c41e14',
    // 背景色
    background: '#f5f5f5',
    card: '#ffffff',
    sidebar: '#ffffff',
    // 文字色
    text: '#1f2937',
    textSecondary: '#6b7280',
    // 边框色
    border: '#e5e5e5',
    // 功能色
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
};

export const darkTheme: ThemeConfig = {
  name: 'pdd-dark',
  mode: 'dark',
  colors: {
    // 主色调 - 红色系
    primary: '#ef4444',
    primaryLight: '#f87171',
    primaryDark: '#dc2626',
    // 背景色
    background: '#0a0a0a',
    card: '#171717',
    sidebar: '#0a0a0a',
    // 文字色
    text: '#f5f5f5',
    textSecondary: '#a3a3a3',
    // 边框色
    border: '#262626',
    // 功能色
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
};

/**
 * 应用主题到 DOM
 */
export function applyTheme(theme: ThemeConfig): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;

  // 设置主题模式类
  root.classList.remove('light', 'dark');
  root.classList.add(theme.mode);
  root.setAttribute('data-theme', theme.mode);

  // 设置 CSS 变量
  root.style.setProperty('--pdd-primary', theme.colors.primary);
  root.style.setProperty('--pdd-primary-light', theme.colors.primaryLight);
  root.style.setProperty('--pdd-primary-dark', theme.colors.primaryDark);
  root.style.setProperty('--pdd-bg', theme.colors.background);
  root.style.setProperty('--pdd-card', theme.colors.card);
  root.style.setProperty('--pdd-sidebar', theme.colors.sidebar);
  root.style.setProperty('--pdd-text', theme.colors.text);
  root.style.setProperty('--pdd-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--pdd-border', theme.colors.border);
  root.style.setProperty('--pdd-success', theme.colors.success);
  root.style.setProperty('--pdd-warning', theme.colors.warning);
  root.style.setProperty('--pdd-danger', theme.colors.danger);
  root.style.setProperty('--pdd-info', theme.colors.info);
}

/**
 * 获取初始主题
 */
export function getInitialTheme(): ThemeMode {
  if (typeof document === 'undefined') return 'light';

  // 检查 localStorage
  const saved = localStorage.getItem('dianfx_dark_mode');
  if (saved !== null) {
    return saved === 'true' ? 'dark' : 'light';
  }

  // 检查系统偏好
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  // 检查 DOM 属性
  const dataTheme = document.documentElement.getAttribute('data-theme');
  if (dataTheme === 'dark' || dataTheme === 'light') {
    return dataTheme as ThemeMode;
  }

  return 'light';
}

/**
 * 保存主题偏好
 */
export function saveThemePreference(mode: ThemeMode): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem('dianfx_dark_mode', mode === 'dark' ? 'true' : 'false');
}

/**
 * 根据模式获取主题配置
 */
export function getThemeByMode(mode: ThemeMode): ThemeConfig {
  return mode === 'dark' ? darkTheme : lightTheme;
}

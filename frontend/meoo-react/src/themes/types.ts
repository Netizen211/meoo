/**
 * 主题系统类型定义
 * 支持多主题扩展
 */

export type ThemeMode = 'light' | 'dark';

export interface ThemeColors {
  // 主色调
  primary: string;
  primaryLight: string;
  primaryDark: string;
  // 背景色
  background: string;
  card: string;
  sidebar: string;
  // 文字色
  text: string;
  textSecondary: string;
  // 边框色
  border: string;
  // 功能色
  success: string;
  warning: string;
  danger: string;
  info: string;
}

export interface ThemeConfig {
  name: string;
  mode: ThemeMode;
  colors: ThemeColors;
}

// CSS 变量名映射
export const CSS_VAR_MAP = {
  primary: '--pdd-primary',
  primaryLight: '--pdd-primary-light',
  primaryDark: '--pdd-primary-dark',
  background: '--pdd-bg',
  card: '--pdd-card',
  sidebar: '--pdd-sidebar',
  text: '--pdd-text',
  textSecondary: '--pdd-text-secondary',
  border: '--pdd-border',
  success: '--pdd-success',
  warning: '--pdd-warning',
  danger: '--pdd-danger',
  info: '--pdd-info',
} as const;

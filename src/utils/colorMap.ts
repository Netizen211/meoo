/**
 * 颜色映射工具 - 将 pdd-* 主题颜色转换为十六进制值
 * 用于内联样式和图表库（recharts）等不支持 Tailwind 类名的场景
 * 注：保留 hex 值以支持十六进制 alpha 通道拼接（如 `${color}15`）
 */

export const colorMap: Record<string, string> = {
  // 主色调
  'var(--pdd-primary)': '#e02e24',
  'var(--pdd-primary-light)': '#ef4444',
  'var(--pdd-primary-dark)': '#c41e14',

  // 功能色
  'var(--pdd-success)': '#22c55e',
  'var(--pdd-warning)': '#f59e0b',
  'var(--pdd-danger)': '#ef4444',
  'var(--pdd-info)': '#3b82f6',

  // 扩展色
  'var(--pdd-purple)': '#8b5cf6',
  'var(--pdd-cyan)': '#06b6d4',
  'var(--pdd-pink)': '#ec4899',
  'var(--pdd-orange)': '#f97316',

  // 中性色
  'pdd-text': '#1f2937',
  'pdd-text-secondary': '#6b7280',
  'pdd-bg': '#f5f5f5',
  'pdd-card': '#ffffff',
  'pdd-border': '#e5e5e5',
};

/**
 * 获取颜色的十六进制值
 * @param colorKey - pdd-* 颜色键名或十六进制值
 * @returns 十六进制颜色值
 */
export function getColor(colorKey: string): string {
  return colorMap[colorKey] || colorKey;
}

/**
 * 获取 CSS 变量颜色值（用于支持主题切换的内联样式）
 * @param colorKey - pdd-* 颜色键名
 * @returns CSS var() 引用
 */
export function getColorVar(colorKey: string): string {
  if (colorMap[colorKey]) {
    const varName = colorKey.replace('pdd-', '--pdd-');
    return `var(${varName})`;
  }
  return colorKey;
}

/**
 * 获取带透明度的颜色值
 * @param colorKey - pdd-* 颜色键名或十六进制值
 * @param opacity - 透明度 (0-1)
 * @returns rgba 颜色值
 */
export function getColorWithOpacity(colorKey: string, opacity: number): string {
  const hex = getColor(colorKey);
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

/**
 * 图表颜色配置 - 用于 recharts
 */
export const chartColors = {
  primary: '#e02e24',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  pink: '#ec4899',
  orange: '#f97316',
};

/**
 * 图表颜色数组 - 用于循环使用
 */
export const chartColorArray = [
  '#e02e24', // primary
  '#22c55e', // success
  '#f59e0b', // warning
  '#ef4444', // danger
  '#3b82f6', // info
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#f97316', // orange
];

/**
 * ============================================================
 *  🎯 UI 系统统一导出入口（Layer 2 — JS 层）
 *  ============================================================
 *
 *  这个文件把 ui/ 下的所有令牌、工具函数、组件集中导出。
 *  页面只需 import { COLORS, CHART, getMetricColor } from '../../ui';
 *
 *  Layer 1（CSS 变量）定义在 tailwind.config.js + globals.css
 *  Layer 2（JS 令牌）定义在 ui/tokens/colors.ts，由此文件导出
 *
 *  分层目的：
 *    CSS 变量 → 控制结构样式（卡片背景、边框、间距）
 *    JS 令牌  → 控制数据颜色（图表色、盈亏色、语义色）
 *    二者互不干扰，改数据颜色不影响结构样式
 * ============================================================
 */

// 颜色令牌系统
export {
  CHART,
  CHART_COLORS,
  SEMANTIC,
  COLORS,
  getMetricColor,
  TRUST_COLORS,
  RISK_COLORS,
  BADGE_METRIC_VARIANT,
} from './tokens/colors';

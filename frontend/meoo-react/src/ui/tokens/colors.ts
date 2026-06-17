/**
 * ============================================================
 *  🎨 数据颜色令牌系统（Layer 2 — JS 颜色令牌）
 *  ============================================================
 *
 *  架构说明（两层）：
 *    Layer 1 — CSS 变量（src/styles/globals.css）
 *      → 控制结构样式：卡片背景、边框、页面背景、文字颜色
 *      → 通过 Tailwind 的 theme.extend.colors 映射 var(--pdd-*)
 *      → 改一个变量 = 全站结构色统一变化
 *
 *    Layer 2 — JS 颜色令牌（本文件）
 *      → 控制数据驱动颜色：图表系列色、盈亏语义色、状态指示色
 *      → 不同的图表可以用不同的配色方案
 *      → 本文件导出常量 + 工具函数
 *
 *  使用原则：
 *    ✅ 页面/组件内部用 COLORS.chart[0..n] 给图表系列上色
 *    ✅ 利润用 COLORS.profit，亏损用 COLORS.loss
 *    ✅ 需要按指标区分颜色时调用 getMetricColor(metric)
 *    ✅ 每个组件仍可传 className 覆盖 Tailwind 样式
 *    ❌ 不直接在组件里写硬编码色值 (#xxxxxx)
 *    ❌ 不用 CSS 变量控制数据颜色（那是 Layer 1 的事）
 *
 *  @example
 *    import { COLORS, getMetricColor } from '../../ui/tokens/colors';
 *
 *    // 图表系列色
 *    <PieChart>
 *      {data.map((entry, i) => (
 *        <Cell key={i} fill={COLORS.chart[i % COLORS.chart.length]} />
 *      ))}
 *    </PieChart>
 *
 *    // 利润/亏损
 *    <span style={{ color: value >= 0 ? COLORS.profit : COLORS.loss }}>
 *      {formatMoney(value)}
 *    </span>
 *
 *    // 按指标区分
 *    <span style={{ color: getMetricColor('gmv') }}>GMV</span>
 * ============================================================
 */

// -------- 图表系列色 --------
// 用于 Recharts/PieChart/LineChart 等图表的数据系列
// 按优先级排列：前 5 个最常用，后面的用于更多数据项
export const CHART = {
  /** 主色系列（最常用，用于 90% 的场景） */
  primary: [
    '#2563EB', // 蓝 600 — GMV、营收
    '#10B981', // 绿 500 — 利润、增长
    '#F59E0B', // 琥珀 500 — 推广费、成本
    '#EF4444', // 红 500 — 退款、亏损
    '#8B5CF6', // 紫 500 — 访客、流量
  ] as const,

  /** 扩展色系列（用于商品排行、多维度对比） */
  extended: [
    '#06B6D4', // 青 500
    '#F97316', // 橙 500
    '#EC4899', // 粉 500
    '#14B8A6', // 翠绿 500
    '#6366F1', // 靛蓝 500
    '#EAB308', // 黄 500
    '#84CC16', // 酸橙 500
    '#A855F7', // 紫罗兰 500
  ] as const,

  /** 全部色（primary + extended 拼接） */
  all: [] as readonly string[],
};

// 拼接 all 数组
CHART.all = [...CHART.primary, ...CHART.extended];

/** 兼容旧代码的别名 */
export const CHART_COLORS = CHART.all;

// -------- 语义色 --------
export const SEMANTIC = {
  /** 盈利 / 正向指标色 */
  profit: '#10B981',
  /** 亏损 / 负向指标色 */
  loss: '#EF4444',
  /** 中性 / 零色 */
  neutral: '#6B7280',
  /** 警告色 */
  warning: '#F59E0B',
  /** 信息色 */
  info: '#3B82F6',
  /** 成功色 */
  success: '#10B981',
  /** 错误色 */
  error: '#EF4444',
} as const;

/** 兼容旧代码的别名 */
export const COLORS = {
  chart: CHART.all,
  profit: SEMANTIC.profit,
  loss: SEMANTIC.loss,
  warning: SEMANTIC.warning,
  info: SEMANTIC.info,
  success: SEMANTIC.success,
  error: SEMANTIC.error,
  neutral: SEMANTIC.neutral,
} as const;

// -------- 指标 → 颜色映射 --------
// 用于 getMetricColor() 函数
const METRIC_COLOR_MAP: Record<string, string> = {
  // 收入类 → 蓝色系
  gmv: '#2563EB',
  revenue: '#2563EB',
  '商家实收': '#2563EB',
  '商品总价': '#2563EB',

  // 利润类 → 绿色系
  profit: '#10B981',
  margin: '#10B981',
  '毛利率': '#10B981',
  '净利': '#10B981',

  // 成本类 → 琥珀色系
  cost: '#F59E0B',
  '推广费': '#F59E0B',
  '快递费': '#D97706',
  '包装费': '#B45309',
  '技术服务费': '#F59E0B',
  '运费险': '#D97706',

  // 退款类 → 红色系
  refund: '#EF4444',
  '退款金额': '#EF4444',
  '扣款': '#DC2626',
  '罚款': '#B91C1C',

  // 流量类 → 紫色系
  visitor: '#8B5CF6',
  uv: '#8B5CF6',
  pv: '#A78BFA',
  click: '#8B5CF6',

  // 推广指标 → 青色系
  roi: '#06B6D4',
  '点击率': '#06B6D4',
  '转化率': '#0D9488',
  '花费': '#F59E0B',

  // 售后指标 → 粉色系
  '售后率': '#EC4899',
  '品质退货率': '#DB2777',
};

/**
 * 获取指定指标对应的颜色
 *
 * @param metric 指标名称（中文/英文均可）
 * @param fallback 未找到时的备用色（默认灰色）
 * @returns 颜色十六进制值
 *
 * @example
 *   getMetricColor('gmv')        // '#2563EB'
 *   getMetricColor('退款金额')   // '#EF4444'
 *   getMetricColor('未知指标')   // '#6B7280'
 */
export function getMetricColor(metric: string, fallback: string = SEMANTIC.neutral): string {
  return METRIC_COLOR_MAP[metric.toLowerCase()] ?? fallback;
}

// -------- 可信度标记色 --------
// 用于数据来源标记（Badge/标签）
export const TRUST_COLORS = {
  /** ✅ 已对账 — 财务表有实际金额 */
  reconciled: { bg: '#D1FAE5', text: '#065F46', label: '已对账' },
  /** 🟡 公式估算 — 财务表未同步，公式推算 */
  estimated: { bg: '#FEF3C7', text: '#92400E', label: '公式估算' },
  /** 🔵 用户配置 — 用户手动填写的参数 */
  configured: { bg: '#DBEAFE', text: '#1E40AF', label: '用户配置' },
  /** 🟠 待同步 — 数据未上传 */
  pending: { bg: '#FFEDD5', text: '#9A3412', label: '待同步' },
} as const;

// -------- 风险等级色 --------
export const RISK_COLORS = {
  high: { bg: '#FEE2E2', text: '#991B1B', icon: '#EF4444', label: '高风险' },
  medium: { bg: '#FEF3C7', text: '#92400E', icon: '#F59E0B', label: '中风险' },
  low: { bg: '#DBEAFE', text: '#1E40AF', icon: '#3B82F6', label: '低风险' },
} as const;

// -------- Badge 变体映射 --------
// 用于 <Badge variant="xxx"> 的语义映射
export const BADGE_METRIC_VARIANT = {
  profit: 'success',
  loss: 'destructive',
  warning: 'warning',
  info: 'default',
} as const;

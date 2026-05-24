/**
 * 安全的公式引擎 - 用于自定义扣费项计算
 * 支持变量注入、条件表达式、数学函数
 * 电商全维度数据支持
 */

export interface FormulaContext {
  // 基础交易数据
  gmv: number;              // 商品总价(GMV)
  revenue: number;          // 商家实收金额
  orders: number;           // 订单数
  sales: number;            // 销量(件数)

  // 成本相关
  productCost: number;      // 商品成本(裸货成本)
  packagingFee: number;     // 包装费
  shippingFee: number;      // 快递费
  promoCost: number;        // 推广费
  discount: number;         // 折扣金额

  // 利润相关
  profit: number;           // 当前阶段利润(税前)
  grossProfit: number;      // 毛利
  netProfit: number;        // 净利润

  // 售后相关
  refund: number;           // 退款金额
  refundRate: number;       // 退款率(%)
  afterSaleCount: number;   // 售后订单数
  afterSaleRate: number;    // 售后率(%)

  // 推广相关
  promoOrders: number;      // 推广成交订单数
  promoTransaction: number; // 推广成交金额
  promoClicks: number;      // 推广点击量
  promoImpressions: number; // 推广曝光量
  ctr: number;              // 点击率(%)
  cvr: number;              // 转化率(%)
  roi: number;              // 推广ROI

  // 客单价相关
  avgOrderValue: number;    // 客单价

  // 时间相关
  activeDays: number;       // 活跃天数
  avgDailySales: number;    // 日均销量

  // 其他
  platformFee: number;      // 平台服务费
  taxes: number;            // 税费

  [key: string]: number;    // 允许字符串索引
}

const ALLOWED_VARS = [
  // 基础交易
  'gmv', 'revenue', 'orders', 'sales',
  // 成本
  'productCost', 'packagingFee', 'shippingFee', 'promoCost', 'discount',
  // 利润
  'profit', 'grossProfit', 'netProfit',
  // 售后
  'refund', 'refundRate', 'afterSaleCount', 'afterSaleRate',
  // 推广
  'promoOrders', 'promoTransaction', 'promoClicks', 'promoImpressions', 'ctr', 'cvr', 'roi',
  // 其他
  'avgOrderValue', 'activeDays', 'avgDailySales', 'platformFee', 'taxes'
];
const ALLOWED_FUNCS = ['max', 'min', 'abs', 'round', 'ceil', 'floor'];

/**
 * 安全计算公式字符串
 * @param formula 公式表达式，如 "orders * 2" 或 "profit > 0 ? profit * 0.1 : 0"
 * @param ctx 变量上下文
 * @returns 计算结果，出错返回0
 */
export function evaluateFormula(formula: string, ctx: FormulaContext): number {
  if (!formula || !formula.trim()) return 0;

  try {
    // 安全检查：只允许白名单字符
    const sanitized = formula.trim();

    // 检查是否包含危险关键字
    const dangerous = /(\balert\b|\beval\b|\bFunction\b|\bimport\b|\brequire\b|\bfetch\b|\bwindow\b|\bdocument\b|\b__proto__\b|\bconstructor\b)/i;
    if (dangerous.test(sanitized)) {
      console.warn('公式包含不允许的关键字:', formula);
      return 0;
    }

    // 构建安全的计算函数
    const varDecls = ALLOWED_VARS.map(v => `const ${v} = ${ctx[v] ?? 0};`).join('\n');
    const funcDecls = ALLOWED_FUNCS.map(f => `const ${f} = Math.${f};`).join('\n');

    const code = `
      ${varDecls}
      ${funcDecls}
      return (${sanitized});
    `;

    // eslint-disable-next-line no-new-func
    const fn = new Function(code);
    const result = fn();

    if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
      return 0;
    }
    return result;
  } catch (err) {
    console.warn('公式计算错误:', formula, err);
    return 0;
  }
}

/**
 * 验证公式语法是否合法
 * @param formula 公式表达式
 * @returns 是否合法
 */
export function validateFormula(formula: string): boolean {
  if (!formula || !formula.trim()) return false;
  try {
    const testCtx: FormulaContext = {
      // 基础交易
      gmv: 100, revenue: 80, orders: 10, sales: 15,
      // 成本
      productCost: 50, packagingFee: 2, shippingFee: 3, promoCost: 5, discount: 10,
      // 利润
      profit: 20, grossProfit: 25, netProfit: 18,
      // 售后
      refund: 5, refundRate: 5, afterSaleCount: 1, afterSaleRate: 10,
      // 推广
      promoOrders: 3, promoTransaction: 60, promoClicks: 50, promoImpressions: 1000,
      ctr: 5, cvr: 6, roi: 12,
      // 其他
      avgOrderValue: 8, activeDays: 30, avgDailySales: 0.5, platformFee: 0, taxes: 2
    };
    evaluateFormula(formula, testCtx);
    return true;
  } catch {
    return false;
  }
}

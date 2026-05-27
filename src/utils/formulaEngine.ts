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

// 中文变量名 → 英文变量名映射（按长度降序排列，优先匹配长词避免部分替换）
const CHINESE_VAR_MAP: [string, string][] = ([
  // 基础交易
  ['商品总价', 'gmv'],
  ['销售额', 'gmv'],
  ['商家实收', 'revenue'],
  ['实收金额', 'revenue'],
  ['订单数', 'orders'],
  ['订单量', 'orders'],
  ['销量', 'sales'],
  ['件数', 'sales'],
  // 成本
  ['裸货成本', 'productCost'],
  ['商品成本', 'productCost'],
  ['货品成本', 'productCost'],
  ['包装费', 'packagingFee'],
  ['快递费', 'shippingFee'],
  ['运费', 'shippingFee'],
  ['推广费', 'promoCost'],
  ['推广花费', 'promoCost'],
  ['推广成本', 'promoCost'],
  ['折扣', 'discount'],
  ['优惠金额', 'discount'],
  // 利润
  ['净利润', 'netProfit'],
  ['毛利润', 'grossProfit'],
  ['毛利', 'grossProfit'],
  ['利润', 'profit'],
  // 售后
  ['退款金额', 'refund'],
  ['退款率', 'refundRate'],
  ['售后订单数', 'afterSaleCount'],
  ['售后数', 'afterSaleCount'],
  ['售后率', 'afterSaleRate'],
  // 推广
  ['推广成交额', 'promoTransaction'],
  ['推广订单数', 'promoOrders'],
  ['推广订单', 'promoOrders'],
  ['点击量', 'promoClicks'],
  ['曝光量', 'promoImpressions'],
  ['点击率', 'ctr'],
  ['转化率', 'cvr'],
  ['投产比', 'roi'],
  // 其他
  ['客单价', 'avgOrderValue'],
  ['活跃天数', 'activeDays'],
  ['日均销量', 'avgDailySales'],
  ['平台服务费', 'platformFee'],
  ['平台费', 'platformFee'],
  ['税费', 'taxes'],
  // 同义英文大写
  ['GMV', 'gmv'],
  ['ROI', 'roi'],
] as [string, string][]).sort((a, b) => b[0].length - a[0].length); // 长→短

/** 获取可用于UI展示的变量列表（中文名 + 英文名） */
export interface VarOption {
  key: string;       // 英文变量名（写入公式的实际值）
  label: string;     // 中文显示名
  alias?: string;    // 中文别名（也可用于公式）
  category: string;  // 分类
}

export function getVarOptions(): VarOption[] {
  // 构建中文→英文查找Map
  const cnToEn: Record<string, string> = {};
  for (const [ch, en] of CHINESE_VAR_MAP) {
    if (!cnToEn[en]) cnToEn[en] = ch;
  }
  const categories: [string, string[]][] = [
    ['基础交易', ['gmv', 'revenue', 'orders', 'sales', 'avgOrderValue']],
    ['成本费用', ['productCost', 'packagingFee', 'shippingFee', 'promoCost', 'discount', 'platformFee', 'taxes']],
    ['利润指标', ['profit', 'grossProfit', 'netProfit']],
    ['售后数据', ['refund', 'refundRate', 'afterSaleCount', 'afterSaleRate']],
    ['推广数据', ['promoOrders', 'promoTransaction', 'promoClicks', 'promoImpressions', 'ctr', 'cvr', 'roi']],
    ['时间相关', ['activeDays', 'avgDailySales']],
  ];
  return categories.flatMap(([cat, vars]) =>
    vars.map(v => ({ key: v, label: cnToEn[v] || v, alias: cnToEn[v] || undefined, category: cat }))
  );
}

/** 将公式中的中文变量名替换为英文 */
function translateChineseVars(expression: string): string {
  let result = expression;
  for (const [ch, en] of CHINESE_VAR_MAP) {
    // 只替换完整词（前后不是字母/数字/中文）
    if (result.includes(ch)) {
      const escaped = ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escaped, 'g'), en);
    }
  }
  return result;
}

/**
 * 安全计算公式字符串
 * @param formula 公式表达式，如 "orders * 2" 或 "profit > 0 ? profit * 0.1 : 0"
 * @param ctx 变量上下文
 * @returns 计算结果，出错返回0
 */
export function evaluateFormula(formula: string, ctx: FormulaContext): number {
  if (!formula || !formula.trim()) return 0;

  try {
    // 将中文变量名翻译为英文
    const translated = translateChineseVars(formula.trim());

    // 检查是否包含危险关键字
    const dangerous = /(\balert\b|\beval\b|\bFunction\b|\bimport\b|\brequire\b|\bfetch\b|\bwindow\b|\bdocument\b|\b__proto__\b|\bconstructor\b)/i;
    if (dangerous.test(translated)) {
      console.warn('公式包含不允许的关键字:', formula);
      return 0;
    }

    // 构建安全的计算函数
    const varDecls = ALLOWED_VARS.map(v => `const ${v} = ${ctx[v] ?? 0};`).join('\n');
    const funcDecls = ALLOWED_FUNCS.map(f => `const ${f} = Math.${f};`).join('\n');

    const code = `
      ${varDecls}
      ${funcDecls}
      return (${translated});
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
    const translated = translateChineseVars(formula.trim());
    // 安全检查
    const dangerous = /(\balert\b|\beval\b|\bFunction\b|\bimport\b|\brequire\b|\bfetch\b|\bwindow\b|\bdocument\b|\b__proto__\b|\bconstructor\b)/i;
    if (dangerous.test(translated)) return false;
    // 直接用 new Function 检查语法，让语法错误抛出
    const varDecls = ALLOWED_VARS.map(v => `const ${v} = 1;`).join('\n');
    const funcDecls = ALLOWED_FUNCS.map(f => `const ${f} = Math.${f};`).join('\n');
    const code = `${varDecls}\n${funcDecls}\nreturn (${translated});`;
    new Function(code);
    return true;
  } catch {
    return false;
  }
}

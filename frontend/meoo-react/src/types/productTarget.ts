// ── 目标配置系统类型定义 ──

// 每单利润目标配置（按商品存储）
export interface ProductTargetConfig {
  profitPerOrder: number;       // 每单赚X元 (默认 10)
  presetKey?: '1' | '2' | '3' | '5' | '10' | 'custom';
  // 用户手动设置的独立列目标（可选，设置后引擎以此为准而非自动计算）
  manualOverrides?: Partial<ManualTargetOverrides>;
}

export interface ManualTargetOverrides {
  // 总额模式
  revenue: number;
  orders: number;
  totalCost: number;
  promo: number;
  roi: number;
  refundRate: number;
  otherCost: number;
  profit: number;
  // 单品模式
  skuPrice: number;
  skuCount: number;
  skuCost: number;
  promoAvg: number;
  profitRate: number;
  skuProfit: number;
}

// 目标计算结果（每列一行）
export interface TargetColumnResult {
  value: number;                // 目标数值
  fmt: string;                  // 格式化显示
  changeNeeded: number;         // 所需变化量（绝对值）
  changePct: number;            // 所需变化百分比
  direction: 'up' | 'down' | 'none';
  urgency: 'low' | 'medium' | 'high';
  source: 'auto' | 'manual';
  editable: boolean;
  breakdown?: {
    current: number;
    target: number;
    reason: string;
  };
}

// 单品的完整目标集（总额8列 + 单品8列）
export interface ProductTargetSet {
  // 总额模式
  revenue: TargetColumnResult;
  orders: TargetColumnResult;
  totalCost: TargetColumnResult;
  promo: TargetColumnResult;
  roi: TargetColumnResult;
  refundRate: TargetColumnResult;
  otherCost: TargetColumnResult;
  profit: TargetColumnResult;
  // 单品模式
  skuPrice: TargetColumnResult;
  skuCount: TargetColumnResult;
  skuCost: TargetColumnResult;
  promoAvg: TargetColumnResult;
  profitRate: TargetColumnResult;
  skuProfit: TargetColumnResult;
}

// 每单指标（中间计算结构）
export interface PerOrderMetrics {
  revenuePerOrder: number;
  costPerOrder: number;
  promoPerOrder: number;
  otherCostPerOrder: number;
  refundRate: number;
  profitPerOrder: number;
  sellingPrice: number;
  unitCost: number;
  orders: number;
  sales: number;
}

// PDD 运营规则配置
export interface PddRuleSet {
  price: {
    safeUpLimit: number;        // 安全上调上限（如 0.05 = 5%）
    mediumUpLimit: number;      // 中等风险上调上限
    highUpLimit: number;        // 高风险上调上限
    maxUpLimit: number;         // 绝对上限
    downLimit: number;          // 降价上限（负值）
  };
  promo: {
    safeReduceLimit: number;    // 安全降低上限
    mediumReduceLimit: number;
    highReduceLimit: number;
  };
  refundRate: {
    targetMax: number;          // 目标退款率上限
    perLevel: { rate: number; target: number }[];
  };
  otherCost: {
    minPackagingFee: number;
    minShippingFee: number;
    minInsuranceFee: number;
  };
}

// 风险评级输出
export interface RiskRating {
  level: 'low' | 'medium' | 'high';
  label: string;
  description: string;
}

// 杠杆调整项
export interface LeverAdjustment {
  level: 1 | 2 | 3 | 4;
  name: string;
  key: string;
  description: string;
  maxAdjustPerOrder: number;    // 每单最大可调整金额
  risk: RiskRating;
  currentValue: number;
  targetValue: number;
  adjustedAmount: number;
}

// 整体计算结果
export interface TargetEngineResult {
  perOrderMetrics: PerOrderMetrics;
  gap: number;                  // 利润缺口
  adjustments: LeverAdjustment[];
  targetSet: ProductTargetSet;
  riskRating: RiskRating;
  isAchievable: boolean;
  maxAchievableProfit: number;  // 最大可实现每单利润
}

// ── PDD 运营规则约束 ──
// 编码化拼多多运营规则，用于目标引擎判断调整方案的可行性和风险

import type { PddRuleSet, RiskRating } from '../types/productTarget';

// ===== 默认规则集 =====
export const DEFAULT_PDD_RULES: PddRuleSet = {
  // ── 价格调整约束 ──
  price: {
    safeUpLimit: 0.05,          // ≤5%: 几乎无流量影响
    mediumUpLimit: 0.10,        // 5~10%: 轻微流量下降(5~10%)
    highUpLimit: 0.15,          // 10~15%: 明显流量下降(10~20%)
    maxUpLimit: 0.20,           // 15~20%: 严重流量损失(20~40%)
    downLimit: -0.20,           // 降价最多20%
  },

  // ── 推广费调整约束 ──
  promo: {
    safeReduceLimit: 0.10,      // 降低≤10%: 几乎无影响
    mediumReduceLimit: 0.20,    // 降低10~20%: 轻微影响(5~15%)
    highReduceLimit: 0.30,      // 降低20~30%: 中等影响(15~30%)
  },

  // ── 退款率约束 ──
  refundRate: {
    targetMax: 10,               // 退款率目标最高容忍值(%)
    perLevel: [
      { rate: 20, target: 10 },  // 当前≥20% -> 目标降至10%
      { rate: 10, target: 6 },   // 当前10~20% -> 目标降至6%
      { rate: 5, target: 3.5 }, // 当前5~10% -> 目标降至3.5%
      { rate: 3, target: 2.5 }, // 当前3~5% -> 目标降至2.5%
      { rate: 0, target: 1.5 }, // 当前<3% -> 目标1.5%
    ],
  },

  // ── 其他成本约束（最低极限值） ──
  otherCost: {
    minPackagingFee: 1,         // 包装费最低 1元/件
    minShippingFee: 2,          // 运费最低 2元/单
    minInsuranceFee: 0.5,       // 运费险最低 0.5元/件
  },
};

// ===== 风险评级 =====
export function assessRisk(
  metric: 'price' | 'promo' | 'refundRate' | 'otherCost',
  changePct: number,           // 变化百分比（正值为上调/增加）
  rules: PddRuleSet = DEFAULT_PDD_RULES
): RiskRating {
  switch (metric) {
    case 'price': {
      if (changePct <= 0) return { level: 'low', label: '降价', description: '降价有利于转化，但注意历史最低价限制' };
      if (changePct <= rules.price.safeUpLimit * 100) return { level: 'low', label: '低风险', description: '上调≤5%，PDD安全调价区' };
      if (changePct <= rules.price.mediumUpLimit * 100) return { level: 'medium', label: '中等风险', description: '上调5~10%，建议配合优惠券缓冲' };
      if (changePct <= rules.price.highUpLimit * 100) return { level: 'high', label: '高风险', description: '上调10~15%，同款比价中可能失去优势' };
      return { level: 'high', label: '极高风险', description: '上调超过15%，可能触发比价系统降权' };
    }
    case 'promo': {
      if (changePct >= 0) return { level: 'low', label: '增加推广', description: '增加推广预算有助于提升单量' };
      const reducePct = Math.abs(changePct);
      if (reducePct <= rules.promo.safeReduceLimit * 100) return { level: 'low', label: '低风险', description: '降低≤10%，可通过优化人群/时段弥补' };
      if (reducePct <= rules.promo.mediumReduceLimit * 100) return { level: 'medium', label: '中等风险', description: '降低10~20%，建议逐步降低观察ROI' };
      return { level: 'high', label: '高风险', description: '降低20~30%，会明显减少曝光量' };
    }
    case 'refundRate': {
      if (changePct <= 0) return { level: 'low', label: '降低退款率', description: '退款率降低有利于权重提升' };
      return { level: 'medium', label: '中等风险', description: '退款率上升需关注产品质量' };
    }
    default:
      return { level: 'low', label: '低风险', description: '' };
  }
}

// ===== 获取退款率优化目标 =====
export function getRefundRateTarget(currentRefundRate: number, rules: PddRuleSet = DEFAULT_PDD_RULES): number {
  for (const level of rules.refundRate.perLevel) {
    if (currentRefundRate >= level.rate) return level.target;
  }
  return rules.refundRate.perLevel[rules.refundRate.perLevel.length - 1].target;
}

// ===== 价格调整安全边界 =====
export function getPriceTarget(currentPrice: number, neededPerOrder: number, rules: PddRuleSet = DEFAULT_PDD_RULES): {
  targetPrice: number;
  changePct: number;
  feasible: boolean;
  maxPossiblePrice: number;
} {
  const maxPrice = currentPrice * (1 + rules.price.maxUpLimit);
  const targetPrice = Math.ceil((currentPrice + neededPerOrder) * 100) / 100;
  const changePct = targetPrice > currentPrice ? (targetPrice - currentPrice) / currentPrice : 0;
  return {
    targetPrice: Math.min(targetPrice, maxPrice),
    changePct,
    feasible: targetPrice <= maxPrice,
    maxPossiblePrice: maxPrice,
  };
}

// ===== 获取所有列的可编辑状态 =====
export function getColumnEditable(key: string): boolean {
  if (key === 'skuCount') return false; // SKU数量不可直接设目标
  return true;
}

export default DEFAULT_PDD_RULES;

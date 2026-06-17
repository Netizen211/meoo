/**
 * 商品标签系统 — 自动判断每个商品的多维度标签
 *
 * 标签分类:
 *   营销类  — 百亿补贴、商品推广
 *   风险类  — 超时罚款、高退款率
 *   效率类  — 高/中/低/亏损投产、高/低转化率、高点击率
 *   价格类  — 超低价格
 *   盈利类  — 利润款、亏损款
 *   稳定类  — 不稳定款、长期稳定款
 *
 * 所有判断以商品维度进行，数据来源为 ProductStat + 前端映射的 product 对象。
 */

// ===================== 类型定义 =====================

export interface TagDef {
  key: string;
  label: string;
  color: string;
  bg: string;
  group: '营销' | '风险' | '效率' | '价格' | '盈利' | '稳定';
  description: string;
}

export interface TagSummary {
  /** 标签 key → 有此标签的商品个数 */
  counts: Record<string, number>;
  /** 标签 key → 标签定义 */
  defs: Record<string, TagDef>;
  /** 按分组排序的标签列表 */
  grouped: { group: string; tags: TagDef[] }[];
  /** 所有标签（按分组排序展平） */
  allTags: TagDef[];
}

export interface ProductWithTags {
  autoTags: string[];          // 自动判断的标签 key 列表
  autoTagLabels: string[];     // 自动判断的标签 label 列表（方便直接显示）
}

// ===================== 标签定义 =====================

export const TAG_DEFS: TagDef[] = [
  // ── 营销类 ──
  { key: 'subsidy',       label: '百亿补贴', color: '#b8860b', bg: '#faf6ee', group: '营销', description: '有百亿补贴服务费扣款' },
  { key: 'promoted',      label: '商品推广', color: '#4f6fa8', bg: '#f2f4f9', group: '营销', description: '有推广投放记录' },

  // ── 风险类 ──
  { key: 'penalty',       label: '超时罚款', color: '#b91c1c', bg: '#fef2f2', group: '风险', description: '有超时发货或罚款记录' },
  { key: 'highRefund',    label: '高退款率', color: '#b91c1c', bg: '#fef2f2', group: '风险', description: '退款率高于15%' },

  // ── 效率类 ──
  { key: 'highRoi',       label: '高投产',   color: '#1a7f4a', bg: '#f0f7f3', group: '效率', description: '投产比优秀（ROI≥8）' },
  { key: 'midRoi',        label: '中投产',   color: '#8f7a20', bg: '#f9f7ef', group: '效率', description: '投产比中等（ROI 3.5~8）' },
  { key: 'lowRoi',        label: '低投产',   color: '#b91c1c', bg: '#fef2f2', group: '效率', description: '投产比偏低（ROI<3.5）' },
  { key: 'lossPromo',     label: '亏损投产', color: '#7c4d8a', bg: '#f7f4f8', group: '效率', description: '推广ROI低于商品整体ROI，推广拉低利润' },
  { key: 'highCvr',       label: '高转化率', color: '#1a7f4a', bg: '#f0f7f3', group: '效率', description: '推广转化率高于8%' },
  { key: 'lowCvr',        label: '低转化率', color: '#8a8a8a', bg: '#f5f5f5', group: '效率', description: '推广转化率低于2%' },
  { key: 'highCtr',       label: '高点击率', color: '#4f6fa8', bg: '#f2f4f9', group: '效率', description: '推广点击率高于8%' },

  // ── 价格类 ──
  { key: 'ultraLowPrice', label: '超低价格', color: '#6d4d8a', bg: '#f5f2f8', group: '价格', description: '售价极低且利润微薄' },

  // ── 盈利类 ──
  { key: 'profitProduct', label: '利润款',   color: '#1a7f4a', bg: '#f0f7f3', group: '盈利', description: '商品净利润为正且利润率>10%' },
  { key: 'lossProduct',   label: '亏损款',   color: '#b91c1c', bg: '#fef2f2', group: '盈利', description: '商品净利润为负' },

  // ── 稳定类 ──
  { key: 'unstable',      label: '不稳定款', color: '#b8860b', bg: '#faf6ee', group: '稳定', description: '日销量波动大，表现不稳定' },
  { key: 'stable',        label: '长期稳定款', color: '#1a7f4a', bg: '#f0f7f3', group: '稳定', description: '长期在售且销售稳定、持续盈利' },
];

export const TAG_DEF_MAP: Record<string, TagDef> = {};
TAG_DEFS.forEach(t => { TAG_DEF_MAP[t.key] = t; });

export const TAG_GROUPS = (() => {
  const map: Record<string, TagDef[]> = {};
  TAG_DEFS.forEach(t => {
    if (!map[t.group]) map[t.group] = [];
    map[t.group].push(t);
  });
  return Object.entries(map).map(([group, tags]) => ({ group, tags }));
})();

// ===================== 判断函数 =====================

/**
 * 计算单个商品的自动标签
 * @param product  - 前端映射后的 product 对象（含 profit/roi/promoCost 等）
 * @param productStat - 原始 ProductStat（含 dailySales/ctr/cvr/deductionDetails 等）
 */
export function computeProductAutoTags(
  product: any,
  productStat?: any
): string[] {
  const tags: string[] = [];

  if (!product) return tags;

  // ── 辅助函数 ──
  const avgPrice = product.avgPrice || 0;
  const profit = product.profit || 0;
  const profitRate = product.profitRate || 0;
  const promoCost = product.promoCost || 0;
  const roi = product.roi || 0;
  const refundRate = product.refundRate || 0;
  const sales = product.sales || 0;
  const orders = product.orders || 0;
  const gmv = product.gmv || 0;
  const revenue = product.revenue || 0;
  const totalCost = product.costs || 0;
  const activeDays = product.activeDays || 0;

  // 从 ProductStat 中提取额外字段
  const dailySales = productStat?.dailySales || product.dailySales || [];
  const deductionDetails = productStat?.deductionDetails || product.deductionDetails || [];
  const costBreakdown = product.costBreakdown || productStat?.costBreakdown || {};
  const cvr = productStat?.cvr ?? product.cvr ?? -1;
  const ctr = productStat?.ctr ?? product.ctr ?? -1;
  const penaltyFee = costBreakdown.penaltyFee || 0;

  // ==========================================
  // 1. 百亿补贴 — deductionDetails 含 "百亿补贴"
  // ==========================================
  if (Array.isArray(deductionDetails) && deductionDetails.some((d: any) =>
    String(d.name || '').includes('百亿补贴')
  )) {
    tags.push('subsidy');
  }

  // ==========================================
  // 2. 商品推广 — 有推广花费
  // ==========================================
  if (promoCost > 0) {
    tags.push('promoted');
  }

  // ==========================================
  // 3. 超时罚款 — penaltyFee > 0 或 deductionDetails 含罚款/超时/赔付
  // ==========================================
  if (penaltyFee > 0) {
    tags.push('penalty');
  } else if (Array.isArray(deductionDetails) && deductionDetails.some((d: any) => {
    const name = String(d.name || '');
    return name.includes('罚款') || name.includes('超时') || name.includes('赔付') || name.includes('违约') || name.includes('处罚');
  })) {
    tags.push('penalty');
  }

  // ==========================================
  // 4. 高退款率 — refundRate > 15%
  // ==========================================
  if (refundRate > 15) {
    tags.push('highRefund');
  }

  // ==========================================
  // 5. 投产判断 — 综合 ROI + 推广效率
  //    整体 ROI = gmv / totalCost（总投入产出比）
  //    推广 ROI = roi（广告投产）
  //    - ROI < 3.5  → 低投产
  //    - ROI 3.5~8  → 中投产
  //    - ROI ≥ 8    → 高投产
  //    - 推广ROI < 整体ROI → 亏损投产（推广拉低效率）
  // ==========================================
  const overallRoi = totalCost > 0 ? gmv / totalCost : 0;
  if (overallRoi >= 8) {
    tags.push('highRoi');
  } else if (overallRoi >= 3.5) {
    tags.push('midRoi');
  } else if (overallRoi > 0 && overallRoi < 3.5) {
    tags.push('lowRoi');
  }

  // 亏损投产：有推广花费，且推广ROI < 整体ROI（推广亏钱）
  if (promoCost > 0 && roi > 0 && overallRoi > 0 && roi < overallRoi * 0.8) {
    tags.push('lossPromo');
  }

  // ==========================================
  // 6. 转化率 — 有推广数据才判断
  // ==========================================
  if (cvr >= 0) {
    if (cvr > 8) {
      tags.push('highCvr');
    } else if (cvr < 2 && cvr > 0) {
      tags.push('lowCvr');
    }
  }

  // ==========================================
  // 7. 点击率 — 有推广数据才判断
  // ==========================================
  if (ctr > 8) {
    tags.push('highCtr');
  }

  // ==========================================
  // 8. 超低价格 — 售价低且利润薄
  //    条件：售价 < 20 且 单品利润 < 5
  //    或：售价 < 10（绝对低价）
  // ==========================================
  if (avgPrice > 0 && avgPrice < 20) {
    const unitProfit = sales > 0 ? profit / sales : profitRate / 100 * avgPrice;
    if (avgPrice < 10 || (avgPrice < 20 && unitProfit < 5)) {
      tags.push('ultraLowPrice');
    }
  }

  // ==========================================
  // 9. 利润款 / 亏损款
  // ==========================================
  if (profit > 0 && profitRate > 10) {
    tags.push('profitProduct');
  }
  if (profit <= 0 && sales > 0) {
    tags.push('lossProduct');
  }

  // ==========================================
  // 10. 不稳定款 / 长期稳定款 — 基于 dailySales 波动
  // ==========================================
  if (Array.isArray(dailySales) && dailySales.length >= 3) {
    const salesValues = dailySales.map((d: any) => d.sales || 0);
    const mean = salesValues.reduce((s: number, v: number) => s + v, 0) / salesValues.length;
    if (mean > 0) {
      const variance = salesValues.reduce((s: number, v: number) => s + (v - mean) ** 2, 0) / salesValues.length;
      const cv = Math.sqrt(variance) / mean; // 变异系数

      if (cv > 1.5) {
        tags.push('unstable');
      } else if (cv < 0.6 && activeDays >= 30 && profit > 0) {
        tags.push('stable');
      }
    }
  } else if (activeDays >= 30 && profit > 0 && sales > 0) {
    // 没有 dailySales 数据，但有足够的活跃天数且盈利 → 长期稳定款
    tags.push('stable');
  }

  return tags;
}

// ===================== 全局统计 =====================

/**
 * 为所有商品计算标签，并返回聚合统计
 * @param products - 前端 product 数组
 * @param productStats - 原始 ProductStat Map（productId → ProductStat）
 */
export function computeAllTags(
  products: any[],
  productStats: Record<string, any>
): {
  /** productId → string[] 自动标签 key 列表 */
  autoTags: Record<string, string[]>;
  /** tag key → 有此标签的商品数 */
  tagCounts: Record<string, number>;
  /** tag key → 商品ID列表（用于筛选） */
  tagProductIds: Record<string, string[]>;
} {
  const autoTags: Record<string, string[]> = {};
  const tagCounts: Record<string, number> = {};
  const tagProductIds: Record<string, string[]> = {};

  // 初始化所有标签计数为 0
  TAG_DEFS.forEach(t => {
    tagCounts[t.key] = 0;
    tagProductIds[t.key] = [];
  });

  products.forEach(p => {
    const prodStat = productStats[p.id];
    const tags = computeProductAutoTags(p, prodStat);
    autoTags[p.id] = tags;
    tags.forEach(tk => {
      tagCounts[tk] = (tagCounts[tk] || 0) + 1;
      if (!tagProductIds[tk]) tagProductIds[tk] = [];
      tagProductIds[tk].push(p.id);
    });
  });

  return { autoTags, tagCounts, tagProductIds };
}

// ===================== 标签颜色工具 =====================

/** 获取标签的背景色和文字颜色 */
export function getTagStyle(key: string): { color: string; bg: string } {
  const def = TAG_DEF_MAP[key];
  if (def) return { color: def.color, bg: def.bg };
  return { color: '#6b7280', bg: '#f3f4f6' };
}

/** 获取标签显示文字 */
export function getTagLabel(key: string): string {
  const def = TAG_DEF_MAP[key];
  return def?.label || key;
}

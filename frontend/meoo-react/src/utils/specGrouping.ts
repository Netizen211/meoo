/**
 * SKU 规格名智能解析 & 规格压缩
 *
 * 从商品分析页 (ProductPage.tsx) 提取的通用逻辑，
 * 用于成本管理页等需要按规格语义分组的场景。
 *
 * 分组策略 (5层)：
 *   1. 数量型 — "1件装" vs "2件装"
 *   2. 价格关系型 — 历史订单价格比例恒定
 *   3. 属性型 — 颜色/尺寸/款式
 *   4. 纯数字型 — "1","2","3"
 *   5. 价格聚类 — 按价格比例聚类
 */

// ════════════════════════════════════════
// parseSpecName — 从 SKU 名称中提取数量/颜色/尺寸/款式
// ════════════════════════════════════════

export interface ParsedSpec {
  quantity: number | null;
  unit: string | null;
  color: string | null;
  size: string | null;
  style: string | null;
  base: string;
}

export function parseSpecName(name: string): ParsedSpec {
  if (!name || name === '-') return { quantity: null, unit: null, color: null, size: null, style: null, base: name || '' };

  const cnNumMap: Record<string, number> = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '单': 1, '双': 2, '对': 2, '半': 0.5 };
  const allUnits = ['件装','个装','双装','对装','包装','盒装','瓶装','罐装','袋装','支装','只装','片装','条装','套装','份装','板装','排装','听装','管装','粒装','枚装','卷装','桶装','箱装','打装',
                    '件','个','双','对','包','盒','瓶','罐','袋','套','组','支','只','条','片',
                    '斤','两','千克','克','公斤','颗','粒','枚','本','册','副','付','顶','根','块','把','串','打','桶','箱','卷',
                    '份','板','排','听','管','筒','扎','捆','贴','杯','碗','盘','碟','勺','ml','L','g','kg'];

  let rest = name.trim();
  let quantity: number | null = null;
  let unit: string | null = null;

  const sortedUnits = [...allUnits].sort((a, b) => b.length - a.length);
  for (const u of sortedUnits) {
    const escU = u.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
    const pat = new RegExp('^(\\d+)\\s*' + escU);
    const m = rest.match(pat);
    if (m) {
      quantity = parseInt(m[1]);
      unit = u;
      rest = rest.replace(m[0], '').trim();
      break;
    }
    const m2 = rest.match(new RegExp('(?:^|[\\s\\/\\-_·])(\\d+)\\s*' + escU + '(?:$|[\\s\\/\\-_·,，])'));
    if (m2) {
      quantity = parseInt(m2[1]);
      unit = u;
      rest = rest.replace(m2[0], '').trim();
      break;
    }
  }

  if (quantity === null) {
    for (const u of sortedUnits) {
      const escU = u.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
      const cnPat = new RegExp('^([一两二三四五六七八九十单双对半])\\s*' + escU);
      const m = rest.match(cnPat);
      if (m && cnNumMap[m[1]] !== undefined) {
        quantity = cnNumMap[m[1]];
        unit = u;
        rest = rest.replace(m[0], '').trim();
        break;
      }
    }
  }

  if (quantity === null) {
    const justNum = rest.match(/^(\d+)$/);
    if (justNum) {
      quantity = parseInt(justNum[1]);
      unit = '件';
      rest = '';
    }
  }

  // 提取颜色
  const colorPatterns = [
    '中国红','珊瑚红','番茄红','朱红','嫣红','玫红','酒红','枣红','砖红','铁锈红',
    '橘粉','肉粉','豆沙粉','樱花粉','少女粉','芭比粉','裸粉','桃粉','藕粉',
    '卡其','驼色','米色','米白','象牙白','奶白','杏色','裸色','肤色','奶茶色','燕麦色',
    '天蓝','藏青','宝蓝','湖蓝','靛蓝','藏蓝','海蓝','深蓝','浅蓝','婴儿蓝','雾霾蓝','牛仔蓝','天空蓝',
    '墨绿','草绿','军绿','荧光绿','翠绿','薄荷绿','橄榄绿','深绿','浅绿','抹茶绿','豆绿','苹果绿',
    '银灰','烟灰','炭灰','深灰','浅灰','高级灰','雾灰',
    '薰衣草','玫紫','浅紫','深紫','香芋紫','葡萄紫',
    '荧光','渐变','印花','条纹','格子','波点','纯色','花色','拼色','撞色',
    '巧克力','咖啡色','咖啡','燕麦','杏仁色','栗色','棕色',
    '红色','橙色','黄色','绿色','青色','蓝色','紫色','黑色','白色','灰色','棕色',
    '粉色','金色','银色','透明','牛仔',
    '透明','磨砂','哑光','亮光','珠光','闪粉',
    '黑白','蓝白','红白','黑红','蓝红',
  ];
  let color: string | null = null;
  for (const c of colorPatterns) {
    if (rest.includes(c)) {
      color = c;
      rest = rest.replace(c, '').trim();
      break;
    }
  }

  let size: string | null = null;
  const sizeMatch = rest.match(/^(S|M|L|XL|XXL|XXXL|均码|加大|加小|超大|超小|标准|迷你|F|均|free)$/i);
  if (sizeMatch) {
    size = sizeMatch[1].toUpperCase();
    rest = rest.replace(sizeMatch[0], '').trim();
  } else {
    const numSize = rest.match(/^(\d{3,4})$/);
    if (numSize && parseInt(numSize[1]) >= 100 && parseInt(numSize[1]) <= 220) {
      size = numSize[1];
      rest = rest.replace(numSize[0], '').trim();
    }
  }

  let style: string | null = null;
  const styleMatch = rest.match(/([A-Za-z]+款|套餐\d+|组合\d+|方案\d+|\d+号|款\d+|版\d+|[ABCDEFG]款|[甲乙丙丁]|标准款|豪华款|普通款|升级款|经典款|阶段[一二三四五六七八九十]?|[一二三四五六七八九十]+阶段|标准|舒适|加厚|薄款|升级版|基础版|简约版|精装版|豪华版)/);
  if (styleMatch) {
    style = styleMatch[1];
    rest = rest.replace(styleMatch[0], '').trim();
  }

  rest = rest.replace(/[\/\-_·\s()（）\[\]【】「」『』【】]+/g, '').trim();
  return { quantity, unit, color, size, style, base: rest || (quantity ? '__qty__' : name) };
}

// ════════════════════════════════════════
// 规格压缩 — 适配 CostManagementPage 的 SkuItem
// ════════════════════════════════════════

export interface SpecGroupItem {
  skuKey: string;           // productId_skuId 或 productId
  skuName: string;
  skuCode: string;
  prices: number[];
  orderCount: number;
  itemCount: number;
  /** 包含该规格内所有 SKU 的 uniqueOrderNos */
  uniqueOrderNos: Set<string>;
}

export interface SpecGroup {
  label: string;               // "规格一" / "规格二"
  items: SpecGroupItem[];
  price: number;               // 均价
  count: number;               // SKU 数
  orders: number;              // 总订单数
  itemsCount: number;          // 总件数
  /** 合并后的 uniqueOrderNos */
  uniqueOrderNos: Set<string>;
}

/**
 * 对单个商品的所有 SKU 执行规格压缩，返回按价格排序的分组
 * @param skus 同一商品下的所有 SKU（SkuItem 结构）
 */
export function groupSkuItems(skus: SpecGroupItem[]): SpecGroup[] {
  if (!skus.length) return [];

  const cnDigits = ['一','二','三','四','五','六','七','八','九','十'];

  function labelGroups(groups: SpecGroup[]): SpecGroup[] {
    const sorted = [...groups].sort((a, b) => a.price - b.price);
    return sorted.map((g, i) => ({
      ...g,
      label: cnDigits[i] ? `规格${cnDigits[i]}` : `规格${i + 1}`,
    }));
  }

  const parsed = skus.map(s => {
    const p = parseSpecName(s.skuName || '');
    return { ...s, parsed: p };
  });

  // 锚定价格（历史价格众数）
  function getAnchorPrice(s: typeof parsed[0]): number {
    if (s.prices && s.prices.length > 0) {
      const freq: Record<number, number> = {};
      let maxFreq = 0;
      let modePrice = s.prices[0];
      s.prices.forEach(p => {
        const k = Math.round(p * 10) / 10;
        freq[k] = (freq[k] || 0) + 1;
        if (freq[k] > maxFreq) { maxFreq = freq[k]; modePrice = k; }
      });
      return modePrice;
    }
    return 0;
  }

  function buildGroups(entries: { items: typeof parsed }[]): SpecGroup[] {
    return entries.map(({ items }) => ({
      label: '',
      price: items.reduce((s, i) => s + getAnchorPrice(i), 0) / items.length,
      count: items.length,
      orders: items.reduce((s, i) => s + (i.orderCount || 0), 0),
      itemsCount: items.reduce((s, i) => s + (i.itemCount || 0), 0),
      items: items.map(i => ({
        skuKey: i.skuKey,
        skuName: i.skuName,
        skuCode: i.skuCode,
        prices: i.prices,
        orderCount: i.orderCount,
        itemCount: i.itemCount,
        uniqueOrderNos: i.uniqueOrderNos,
      })),
      uniqueOrderNos: items.reduce((merged, i) => {
        i.uniqueOrderNos.forEach(no => merged.add(no));
        return merged;
      }, new Set<string>()),
    }));
  }

  // Strategy 1: 数量型
  const qtyCount = parsed.filter(s => s.parsed.quantity !== null).length;
  const majorityHasQty = qtyCount >= Math.ceil(parsed.length * 0.5);
  if (majorityHasQty && parsed.length > 1) {
    const qtyGroups = new Map<string, typeof parsed>();
    parsed.forEach(s => {
      if (s.parsed.quantity !== null) {
        const key = `${s.parsed.quantity}|${s.parsed.unit || '件'}`;
        if (!qtyGroups.has(key)) qtyGroups.set(key, []);
        qtyGroups.get(key)!.push(s);
      } else {
        if (!qtyGroups.has('other')) qtyGroups.set('other', []);
        qtyGroups.get('other')!.push(s);
      }
    });
    const entries = Array.from(qtyGroups.entries());
    if (entries.length > 1) {
      return labelGroups(buildGroups(entries.map(([, items]) => ({ items }))));
    }
  }

  // Strategy 2: 价格关系型
  if (parsed.length > 1) {
    const anchored = parsed.map(s => ({ ...s, anchorPrice: getAnchorPrice(s) }));
    anchored.sort((a, b) => a.anchorPrice - b.anchorPrice);
    const uniquePrices = [...new Set(anchored.map(a => a.anchorPrice))].filter(p => p > 0);
    if (uniquePrices.length > 1) {
      const basePrice = uniquePrices[0];
      const ratioGroups = new Map<string, typeof anchored>();
      anchored.forEach(s => {
        const ratio = s.anchorPrice > 0 ? s.anchorPrice / basePrice : 1;
        const roundedRatio = Math.round(ratio * 2) / 2;
        const key = roundedRatio >= 1 ? roundedRatio.toString() : 'other';
        if (!ratioGroups.has(key)) ratioGroups.set(key, []);
        ratioGroups.get(key)!.push(s);
      });
      const validGroups = Array.from(ratioGroups.entries()).filter(([, items]) => items.length > 0);
      if (validGroups.length > 1) {
        return labelGroups(buildGroups(validGroups.map(([, items]) => ({ items }))));
      }
    }
  }

  // Strategy 3: 属性型
  const attrKeyed = new Map<string, typeof parsed>();
  parsed.forEach(s => {
    const key = s.parsed.color || s.parsed.size || s.parsed.style || s.parsed.base || 'default';
    if (!attrKeyed.has(key)) attrKeyed.set(key, []);
    attrKeyed.get(key)!.push(s);
  });
  if (attrKeyed.size > 1 && attrKeyed.size < parsed.length * 0.9) {
    return labelGroups(buildGroups(Array.from(attrKeyed.entries()).map(([, items]) => ({ items }))));
  }

  // Strategy 4: 纯数字型
  const allNumeric = parsed.every(s => /^\d+$/.test(s.skuName.trim()));
  if (allNumeric && parsed.length > 1) {
    const numGroups = new Map<string, typeof parsed>();
    parsed.forEach(s => {
      const n = parseInt(s.skuName.trim());
      const key = isNaN(n) ? '0' : n.toString();
      if (!numGroups.has(key)) numGroups.set(key, []);
      numGroups.get(key)!.push(s);
    });
    if (numGroups.size > 1) {
      return labelGroups(buildGroups(Array.from(numGroups.entries()).map(([, items]) => ({ items }))));
    }
  }

  // Strategy 5 (Fallback): 价格聚类
  const fallbackAnchored = parsed.map(s => ({ ...s, anchorPrice: getAnchorPrice(s) }));
  fallbackAnchored.sort((a, b) => a.anchorPrice - b.anchorPrice);
  const priceRatioGroups = new Map<string, typeof parsed>();
  const basePrice = fallbackAnchored[0]?.anchorPrice || 1;
  fallbackAnchored.forEach(s => {
    const ratio = s.anchorPrice > 0 ? Math.round((s.anchorPrice / basePrice) * 2) / 2 : 1;
    const key = ratio > 0 ? ratio.toString(10) : '1';
    if (!priceRatioGroups.has(key)) priceRatioGroups.set(key, []);
    priceRatioGroups.get(key)!.push(s);
  });
  return labelGroups(buildGroups(Array.from(priceRatioGroups.entries()).map(([, items]) => ({ items }))));
}

// ════════════════════════════════════════
// 用户覆盖系统 — 允许手动修正自动分组的错误
// ════════════════════════════════════════

export interface SpecOverrides {
  /** 重命名的组标签: 原始标签 -> 自定义标签, e.g. "规格一" -> "小号" */
  labels: Record<string, string>;
  /** SKU 移动到目标组: skuKey -> 目标组标签 */
  moves: Record<string, string>;
  /** 用户自定义分组 */
  customGroups: Array<{ label: string; skuKeys: string[] }>;
}

const OVERRIDES_KEY_PREFIX = 'spec_overrides_';

export function loadSpecOverrides(productId: string): SpecOverrides {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY_PREFIX + productId);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { labels: {}, moves: {}, customGroups: [] };
}

export function saveSpecOverrides(productId: string, overrides: SpecOverrides): void {
  try {
    localStorage.setItem(OVERRIDES_KEY_PREFIX + productId, JSON.stringify(overrides));
  } catch {}
}

/** 将用户覆盖应用到自动分组结果上 */
export function applySpecOverrides(
  autoGroups: SpecGroup[],
  allSkus: SpecGroupItem[],
  overrides: SpecOverrides,
): SpecGroup[] {
  // 1. 重命名组标签
  const groups = autoGroups.map(g => ({
    ...g,
    label: overrides.labels[g.label] || g.label,
    items: g.items.map(i => ({ ...i, uniqueOrderNos: new Set(i.uniqueOrderNos) })),
    uniqueOrderNos: new Set(g.uniqueOrderNos),
  }));

  // 2. 添加自定义组
  for (const cg of overrides.customGroups || []) {
    const existing = groups.find(g => g.label === cg.label);
    if (existing) continue; // 跳过，移动到下面处理
    const customItems: SpecGroupItem[] = [];
    for (const skuKey of cg.skuKeys) {
      const src = allSkus.find(s => s.skuKey === skuKey);
      if (src) {
        customItems.push({ ...src, uniqueOrderNos: new Set(src.uniqueOrderNos) });
      }
    }
    if (customItems.length === 0) continue;
    const price = customItems.reduce((s, i) => s + (i.prices.length ? i.prices.reduce((a, b) => a + b, 0) / i.prices.length : 0), 0) / customItems.length;
    groups.push({
      label: cg.label,
      items: customItems,
      price,
      count: customItems.length,
      orders: customItems.reduce((s, i) => s + i.orderCount, 0),
      itemsCount: customItems.reduce((s, i) => s + i.itemCount, 0),
      uniqueOrderNos: customItems.reduce((merged, i) => {
        i.uniqueOrderNos.forEach(no => merged.add(no));
        return merged;
      }, new Set<string>()),
    });
  }

  // 3. 处理 SKU 移动 (从自动组移动到目标组)
  const moves = overrides.moves || {};
  const moveKeys = Object.keys(moves);
  if (moveKeys.length > 0) {
    for (const [skuKey, targetLabel] of Object.entries(moves)) {
      // 找到源组并移除
      let sourceIdx = -1;
      let itemIdx = -1;
      for (let gi = 0; gi < groups.length; gi++) {
        const idx = groups[gi].items.findIndex(i => i.skuKey === skuKey);
        if (idx >= 0) { sourceIdx = gi; itemIdx = idx; break; }
      }
      if (sourceIdx < 0 || itemIdx < 0) continue;

      const [movedItem] = groups[sourceIdx].items.splice(itemIdx, 1);
      if (!movedItem) continue;

      // 找目标组
      let targetIdx = groups.findIndex(g => g.label === targetLabel);
      if (targetIdx < 0) {
        // 目标组不存在 → 创建新组
        groups.push({
          label: targetLabel,
          items: [],
          price: 0, count: 0, orders: 0, itemsCount: 0,
          uniqueOrderNos: new Set(),
        });
        targetIdx = groups.length - 1;
      }
      groups[targetIdx].items.push(movedItem);
    }

    // 4. 重新计算每个组的统计数据
    for (const g of groups) {
      if (g.items.length === 0) continue;
      g.count = g.items.length;
      g.price = g.items.reduce((s, i) => s + (i.prices.length ? i.prices.reduce((a, b) => a + b, 0) / i.prices.length : 0), 0) / g.items.length;
      g.orders = g.items.reduce((s, i) => s + i.orderCount, 0);
      g.itemsCount = g.items.reduce((s, i) => s + i.itemCount, 0);
      g.uniqueOrderNos = g.items.reduce((merged, i) => {
        i.uniqueOrderNos.forEach(no => merged.add(no));
        return merged;
      }, new Set<string>());
    }
  }

  // 5. 移除空组（只在有别的组时）
  const nonEmpty = groups.filter(g => g.items.length > 0);
  return nonEmpty.length > 0 ? nonEmpty : groups;
}

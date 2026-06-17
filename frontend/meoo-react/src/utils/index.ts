export function findField(row: any, ...keywords: string[]): any {
  if (!row || typeof row !== 'object') return undefined;
  const keys = Object.keys(row);
  for (const kw of keywords) {
    const kwClean = kw.toLowerCase().replace(/[\s\-_\(\)（）\[\]【】]/g, '');
    for (const k of keys) {
      const kClean = k.replace(/[﻿ \t\r\n\s\-_\(\)（）\[\]【】]/g, '').toLowerCase();
      if (kClean === kwClean) return row[k];
    }
    for (const k of keys) {
      const kClean = k.replace(/[﻿ \t\r\n\s\-_\(\)（）\[\]【】]/g, '').toLowerCase();
      if (kClean.includes(kwClean)) return row[k];
    }
  }
  return undefined;
}

export function sf(v: any): number {
  if (v == null) return 0;
  const s = String(v).trim().replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

export const safeFloat = sf;

export function ss(v: any): string {
  return String(v || '').trim();
}

export function hoursDiff(a: string, b: string): number {
  const da = new Date(a), db = new Date(b);
  return (da.getTime() - db.getTime()) / 3600000;
}

export function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'h_' + Math.abs(hash).toString(36);
}

export function exportCSV(headers: string[], rows: any[][], filename: string) {
  const bom = '\uFEFF';
  const csv = bom + [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── SKU 分类系统 v3（简化版）────────────────────
// 设计原则：
//   同商品下按价格段分大类，同价格段内不同颜色/尺码合并。
//   记忆优先（用户手动调整过的不变），价格是唯一分类依据。
//
// 逻辑：
//   A — 记忆恢复：用户手动保存的分类映射直接还原
//   B — 价格聚类：同商品下，价格相近（≤15% 或 ≤¥5）的归一类，否则不同类

export interface SkuItem {
  skuId: string;
  skuName: string;
  skuCode: string;
  productCode: string;
  productId?: string;
  price: number;
}

export interface SkuClass {
  classId: string;
  displayName: string;
  displayPrice: number;
  skus: SkuItem[];
  strategy: string;
}

// ─── 主分类函数 ───────────────────────────────────

/**
 * 简化的 SKU 分类
 * 1. 记忆恢复（用户手动调整过的不动）
 * 2. 同商品下按价格聚类
 */
export function classifySkus(
  skus: SkuItem[],
  memory?: Record<string, string>,
  productId?: string,
): SkuClass[] {
  if (!skus.length) return [];

  const mem = memory || {};
  const groups: Map<string, SkuItem[]> = new Map();
  const classMeta: Map<string, { strategy: string; displayName: string }> = new Map();

  // ── 第 1 步：记忆恢复 ──────────────────────────
  // 用户手动分类过的 SKU 全部还原，不再参与后续分类
  const memRemaining: SkuItem[] = [];
  for (const sk of skus) {
    const pid = sk.productId || productId || '';
    const memKey = `${sk.skuId}|${pid}`;
    const cid = mem[memKey];
    if (cid) {
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)!.push(sk);
      if (!classMeta.has(cid)) classMeta.set(cid, { strategy: 'memory', displayName: sk.skuName });
    } else {
      memRemaining.push(sk);
    }
  }

  // ── 第 2 步：同商品下按价格聚类 ────────────────
  // 按 productId 分组
  const productSkus = new Map<string, SkuItem[]>();
  for (const sk of memRemaining) {
    const pid = sk.productId || productId || '__unknown';
    if (!productSkus.has(pid)) productSkus.set(pid, []);
    productSkus.get(pid)!.push(sk);
  }

  // 每个商品内部按价格聚类
  for (const [pid, items] of productSkus) {
    // 按价格排序
    const sorted = [...items].sort((a, b) => a.price - b.price);
    // 聚类：价差 > 15% 且 > ¥5 则分裂
    const clusters: SkuItem[][] = [];
    let curCluster: SkuItem[] = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
      const prevPrice = curCluster.reduce((s, x) => s + x.price, 0) / curCluster.length;
      const gap = Math.abs(sorted[i].price - prevPrice);
      const threshold = Math.max(prevPrice * 0.15, 5);
      if (gap > threshold) {
        clusters.push(curCluster);
        curCluster = [sorted[i]];
      } else {
        curCluster.push(sorted[i]);
      }
    }
    if (curCluster.length) clusters.push(curCluster);

    // 生成组
    clusters.forEach((cluster, idx) => {
      const avgPrice = cluster.reduce((s, x) => s + x.price, 0) / cluster.length;
      const cid = pid === '__unknown'
        ? `price_${avgPrice.toFixed(2)}_${idx}`
        : `p_${pid}_c${idx}`;
      groups.set(cid, cluster);
      // 显示名：取同一类中所有 SKU 名称的最长公共前缀
      const names = cluster.map(s => s.skuName).filter(Boolean);
      const common = findCommonPrefix(names);
      const displayName = common
        ? `${common}…（${cluster.length}个规格）`
        : names[0] || `¥${avgPrice.toFixed(2)}`;
      classMeta.set(cid, { strategy: 'price_cluster', displayName });
    });
  }

  // ── 构建输出 ───────────────────────────────────
  const result: SkuClass[] = [];
  for (const [cid, items] of groups) {
    // 稳定价格：众数优先 → 频次相同取最新 → 取较高价
    const priceFreq: Record<string, { price: number; count: number }> = {};
    items.forEach(sk => {
      const pk = sk.price.toFixed(2);
      if (!priceFreq[pk]) priceFreq[pk] = { price: sk.price, count: 0 };
      priceFreq[pk].count++;
    });
    const sortedPrices = Object.values(priceFreq).sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.price - a.price;
    });
    const displayPrice = sortedPrices[0]?.price || items[0]?.price || 0;
    const meta = classMeta.get(cid);
    const strategyLabel = meta?.strategy || 'unknown';
    result.push({
      classId: cid,
      displayName: meta?.displayName || items[0]?.skuName || '未命名',
      displayPrice,
      skus: items,
      strategy: strategyLabel,
    });
  }

  // 按价格排序
  result.sort((a, b) => {
    if (a.displayPrice === 0 && b.displayPrice === 0) return 0;
    if (a.displayPrice === 0) return 1;
    if (b.displayPrice === 0) return -1;
    return a.displayPrice - b.displayPrice;
  });

  return result;
}

/** 查找一组字符串的最长公共前缀 */
function findCommonPrefix(strings: string[]): string {
  if (!strings.length) return '';
  let prefix = strings[0];
  for (let i = 1; i < strings.length; i++) {
    while (strings[i].indexOf(prefix) !== 0) {
      prefix = prefix.slice(0, -1);
      if (!prefix) return '';
    }
  }
  return prefix;
}

/** 生成分类记忆映射（SKU → classId），存入 localStorage */
export function buildSkuClassMemory(classes: SkuClass[]): Record<string, string> {
  const mem: Record<string, string> = {};
  for (const cls of classes) {
    for (const sk of cls.skus) {
      const pid = sk.productId || '';
      // 用 skuId|productId 作 key（比 productCode 更稳定）
      const key = `${sk.skuId}|${pid}`;
      mem[key] = cls.classId;
    }
  }
  return mem;
}

// ─── 记忆版本管理 ─────────────────────────────────
const MEMORY_VERSION_KEY = 'dianfx_sku_classes_v3';

/** 读取记忆（带版本检测，旧版自动清除） */
export function loadSkuClassMemory(): Record<string, string> {
  try {
    const raw = localStorage.getItem(MEMORY_VERSION_KEY);
    if (!raw) {
      // 尝试读旧版 key（无版本号），读到说明有旧数据 → 直接丢掉
      const oldRaw = localStorage.getItem('dianfx_sku_classes');
      if (oldRaw) {
        localStorage.removeItem('dianfx_sku_classes');
        console.log('[SKU分类] 检测到旧版记忆，已清除');
      }
      return {};
    }
    const parsed = JSON.parse(raw);
    // 新版格式：{ version: 3, data: {...} }
    if (parsed && parsed.version === 3 && parsed.data) {
      return parsed.data;
    }
    // 版本不匹配 → 清除
    localStorage.removeItem(MEMORY_VERSION_KEY);
    return {};
  } catch {
    return {};
  }
}

/** 保存记忆（带版本号） */
export function saveSkuClassMemory(data: Record<string, string>): void {
  try {
    localStorage.setItem(MEMORY_VERSION_KEY, JSON.stringify({
      version: 3,
      data,
      savedAt: Date.now(),
    }));
  } catch { /* localStorage 满则静默失败 */ }
}

export function exportJSON(data: any, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}
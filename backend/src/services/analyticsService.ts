
import { db } from '../db';

function safeNum(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function safeStr(v: any): string {
  if (v == null) return '';
  return String(v).replace(/[﻿ \t\r\n\s]+/g, '').trim();
}

// ★ 字段名标准化 — 统一映射，与 dataService / routes/data 共用
import { normalizeFieldName, normalizeRecordKeys, normalizeRecordsArray } from './fieldNormalizer';

export async function loadStoreData(storeId: string): Promise<Record<string, any[]>> {
  const rows = await db('store_data').where('store_id', storeId);
  const data: Record<string, any[]> = {};
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.payload_json);
      data[row.category] = Array.isArray(parsed) ? normalizeRecordsArray(parsed) : [];
    } catch { data[row.category] = []; }
  }
  return data;
}

export async function loadStoreConfigs(storeId: string): Promise<Record<string, any>> {
  const rows = await db('store_configs').where('store_id', storeId);
  const configs: Record<string, any> = {};
  for (const row of rows) {
    try { configs[row.config_key] = JSON.parse(row.payload_json); }
    catch { configs[row.config_key] = row.payload_json; }
  }
  return configs;
}

// ★ 获取订单号（兼容归一化前后的字段名）
function getOrderNo(record: any): string {
  return safeStr(record['订单编号'] || record['订单号'] || '');
}
function getAfterSaleStatus(record: any): string {
  return String(record['售后状态'] || record['退款状态'] || '').trim();
}

// ★ 有效订单过滤：排除已取消/待付款/代付款等非真实订单
// ★ 同时排除测试/异常订单：商家实收金额 ≤ 0 或 用户实付金额 ≤ 0
function filterValidOrders(orders: any[]): any[] {
  return orders.filter(o => {
    const st = String(o['订单状态'] || '').trim();
    if (['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st)) return false;
    const pt = o['支付时间'] || o['下单时间'];
    if (pt == null || String(pt).trim() === '') return false;
    // ★ 过滤测试数据：商家实收金额必须 > 0，防止测试订单（金额≈0.01）污染指标
    const mr = safeNum(o['商家实收金额(元)'] || o['商家实收金额'] || o['实收金额'] || '');
    if (mr <= 0) return false;
    return true;
  });
}

// ★ 全店聚合：加载用户所有店铺数据并合并
export async function loadAllUserStoreData(userId: string): Promise<Record<string, any[]>> {
  const storeRows = await db('stores').where('user_id', userId).select('id');
  const storeIds = storeRows.map((s: any) => s.id);
  if (!storeIds.length) return { orders: [], promotionProducts: [], promotionHourly: [], starStoreSummary: [], liveStreamSummary: [], afterSaleRecords: [], shippingInsurance: [], financialRecords: [] };

  const allRows = await db('store_data').whereIn('store_id', storeIds);
  const merged: Record<string, any[]> = {};
  for (const row of allRows) {
    try {
      const parsed = JSON.parse(row.payload_json);
      if (Array.isArray(parsed)) {
        merged[row.category] = [...(merged[row.category] || []), ...normalizeRecordsArray(parsed)];
      }
    } catch { /* skip corrupted data */ }
  }
  return merged;
}

// ★ 全店聚合：加载用户所有店铺的成本配置（取第一个有效的）
export async function loadAllStoresConfigs(userId: string): Promise<Record<string, any>> {
  const storeRows = await db('stores').where('user_id', userId).select('id');
  const storeIds = storeRows.map((s: any) => s.id);
  if (!storeIds.length) return {};

  const configRows = await db('store_configs').whereIn('store_id', storeIds);
  const merged: Record<string, any> = {};
  for (const row of configRows) {
    if (merged[row.config_key] === undefined) {
      try { merged[row.config_key] = JSON.parse(row.payload_json); }
      catch { merged[row.config_key] = row.payload_json; }
    }
  }
  return merged;
}


function emptyStat(pid: string, name: string, code: string): any {
  return {
    productId: pid, productName: name || pid, productCode: code,
    gmv: 0, orders: 0, sales: 0, revenue: 0, refund: 0, refundCount: 0, discount: 0,
    afterSaleCount: 0, afterSaleRate: 0, avgOrderValue: 0,
    promoCost: 0, promoClicks: 0, promoImpressions: 0, promoOrders: 0, promoTransaction: 0,
    ctr: 0, cvr: 0, totalCost: 0, netProfit: 0, profitRate: 0, roi: 0,
    refundRate: 0, discountRatio: 0, promoCostRatio: 0,
    hasOrderData: false, hasPromoData: false, promoSourceDetails: [],
    dailySales: [], priceDistribution: [], afterSaleBreakdown: {}, relatedProducts: [],
    firstOrderDate: '', lastOrderDate: '', activeDays: 0, avgDailySales: 0,
    turnoverDays: 0, sellThroughRate: 0,
    costBreakdown: { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, insuranceFee: 0, penaltyFee: 0, marketingFee: 0, taxes: 0, customDeductions: 0 },
    costSource: { productCost: 'missing', taxes: 'default', customDeductions: 'none' },
    taxDetails: [], deductionDetails: [],
    profitConfidence: 'low', grossProfit: 0, preTaxProfit: 0, netProfitAfterTax: 0,
  };
}

function buildBuckets(prices: number[]): any[] {
  if (!prices.length) return [];
  const min = Math.min(...prices), max = Math.max(...prices);
  const n = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(prices.length))));
  const step = (max - min) / n || 1;
  const buckets: any[] = [];
  for (let i = 0; i < n; i++) {
    buckets.push({ range: '$' + (min + i * step).toFixed(0) + '-' + (min + (i + 1) * step).toFixed(0), min: min + i * step, max: min + (i + 1) * step, count: 0 });
  }
  prices.forEach(p => { for (const b of buckets) { if (p >= b.min && p < b.max) { b.count++; break; } } });
  return buckets.filter((b: any) => b.count > 0);
}


export function computeAllProductStats(
  rawOrders: any[], promoProducts: any[],
  promotionHourly: any[],
  starStoreSummary: any[], liveStreamSummary: any[],
  afterSaleRecords: any[],
  productCosts: Record<string, number>,
  costConfigs: Record<string, any>
): Record<string, any> {
  const orders = filterValidOrders(rawOrders);
  const stats: Record<string, any> = {};
  const productNames: Record<string, string> = {};
  const productCodes: Record<string, string> = {};
  const orderDetails: Record<string, any> = {};
  const dailySalesMap: Record<string, Record<string, any>> = {};
  const skuSalesMap: Record<string, Record<string, number>> = {};
  // ★ 退款金额 Map — 使用售后表的实际退款金额（而非订单的商家实收金额）
  const refundAmountMap = new Map<string, number>();
  afterSaleRecords.forEach((r: any) => {
    if (getAfterSaleStatus(r) !== '退款成功') return;
    const on = getOrderNo(r);
    if (!on) return;
    refundAmountMap.set(on, (refundAmountMap.get(on) || 0) + safeNum(r['退款金额(元)'] || r['买家退款金额'] || r['退款金额']));
  });
  // ★ 单次遍历同时构建 date-GMV 映射（原为独立遍历）
  const dgm: Record<string, { pid: string; gmv: number }[]> = {};
  // ★ 退款以售后表为准（表格口径）
  const refundOrderSet = new Set(afterSaleRecords.filter(r => getAfterSaleStatus(r) === '退款成功').map(r => getOrderNo(r)).filter(Boolean));

  // ★ 分小时推广索引: promotionHourly → Set<date_hour_pid> (用于逐单判定是否推广中)
  const promotedSlots = new Set<string>();
  promotionHourly.forEach((h: any) => {
    const pid = safeStr(h['商品ID'] || h['商品id'] || '');
    const d = safeStr(h['日期'] || h['date'] || '');
    const hr = safeStr(h['时段'] || h['小时'] || '');
    if (pid && d && hr) promotedSlots.add(`${d}_${hr}_${pid}`);
  });
  // ★ 每个商品的分小时推广确认订单数（仅统计推广时段内的订单）
  const hourlyPromotedOrders: Record<string, number> = {};

  // ★ 辅助: 从支付时间提取小时段 (e.g., '2026-06-17 10:30:18' → '10:00-11:00')
  function getHourSlot(payTime: string): string {
    const t = safeStr(payTime);
    if (!t || t.length < 13) return '';
    const hh = parseInt(t.slice(11, 13), 10);
    if (isNaN(hh)) return '';
    return `${String(hh).padStart(2, '0')}:00-${String(hh + 1).padStart(2, '0')}:00`;
  }

  // ★ Pass 1: 单次遍历订单 — 统计 + 日销售 + SKU + 详情 + date-GMV
  // ★ 按商品跟踪唯一订单号
  const pidOrderSets: Record<string, Set<string>> = {};
  orders.forEach((o: any) => {
    const pid = safeStr(o['商品ID'] || o['商品id'] || '');
    if (!pid || pid === '-') return;
    const name = safeStr(o['商品名称'] || o['商品'] || '');
    const code = safeStr(o['商家编码-商品维度'] || o['商家编码'] || '');
    if (name && !productNames[pid]) productNames[pid] = name;
    if (code && !productCodes[pid]) productCodes[pid] = code;
    if (!stats[pid]) stats[pid] = emptyStat(pid, name, code);
    stats[pid].hasOrderData = true;  // ★ 修复：标记该商品有订单数据
    if (!pidOrderSets[pid]) pidOrderSets[pid] = new Set();
    const orderNo = safeStr(o['订单号']);
    pidOrderSets[pid].add(orderNo);
    const s = stats[pid];
    const gmv = safeNum(o['商品总价(元)']);
    const revenue = safeNum(o['商家实收金额(元)']);
    const disc = safeNum(o['店铺优惠折扣(元)']) + safeNum(o['平台优惠折扣(元)']) + safeNum(o['多多支付立减金额(元)']) + safeNum(o['拼多多优惠券(元)']);
    const qty = safeNum(o['商品数量(件)']);
    s.gmv += gmv; s.sales += qty;
    s.revenue += revenue; s.discount += disc;
    // ★ 退款检测：使用售后表实际退款金额（修复BUG：之前误用订单商家实收金额）
    const on = safeStr(o['订单号']);
    if (refundOrderSet.has(on)) { s.refundCount += 1; s.refund += (refundAmountMap.get(on) || 0); }
    const dk = (o['支付时间'] || '').split(' ')[0];
    if (dk && /^\d{4}-\d{2}-\d{2}$/.test(dk)) {
      if (!dailySalesMap[pid]) dailySalesMap[pid] = {};
      if (!dailySalesMap[pid][dk]) dailySalesMap[pid][dk] = { date: dk, sales: 0, gmv: 0, orders: 0 };
      dailySalesMap[pid][dk].sales += qty;
      dailySalesMap[pid][dk].gmv += gmv;
      dailySalesMap[pid][dk].orders += 1;
      if (!dgm[dk]) dgm[dk] = [];
      dgm[dk].push({ pid, gmv });
      // ★ 分小时推广匹配：如果订单支付时间所在小时有推广投放，计入hourlyPromotedOrders
      const hourSlot = getHourSlot(o['支付时间'] || '');
      if (hourSlot && promotedSlots.has(`${dk}_${hourSlot}_${pid}`)) {
        hourlyPromotedOrders[pid] = (hourlyPromotedOrders[pid] || 0) + 1;
      }
    }
    const skuId = safeStr(o['商品规格ID'] || o['sku_id'] || o['SKU ID'] || '');
    if (skuId) { if (!skuSalesMap[pid]) skuSalesMap[pid] = {}; skuSalesMap[pid][skuId] = (skuSalesMap[pid][skuId] || 0) + qty; }
    if (!orderDetails[pid]) orderDetails[pid] = { dates: [], prices: [], orderNos: [] };
    orderDetails[pid].dates.push(String(o['支付时间'] || ''));
    orderDetails[pid].prices.push(gmv / Math.max(1, qty));
    orderDetails[pid].orderNos.push(safeStr(o['订单号']));
  });
  // ★ 补填唯一订单数 + 分小时推广确认订单数
  Object.keys(stats).forEach(pid => {
    stats[pid].orders = pidOrderSets[pid]?.size || 0;
    stats[pid].hourlyPromotedOrders = hourlyPromotedOrders[pid] || 0;
    stats[pid].hourlyConfirmed = (hourlyPromotedOrders[pid] || 0) > 0;
  });

  // Pass 2: 售后数据（按订单号排重 + 仅计数有效售后状态）
  const processedAS = new Set<string>(); // dedup key: pid::orderNo
  afterSaleRecords.forEach((r: any) => {
    const pid = safeStr(r['商品ID'] || r['商品id'] || '');
    if (!pid) return;
    const on = getOrderNo(r);
    const dedupKey = pid + '::' + on;
    if (processedAS.has(dedupKey)) return;
    processedAS.add(dedupKey);
    if (!stats[pid]) stats[pid] = emptyStat(pid, String(r['sku信息'] || '').split(',')[0] || pid, '');
    const s = stats[pid];
    // ★ 仅计数有效售后状态（与 Dashboard 口径一致：退款成功/售后处理中/处理中）
    const st = getAfterSaleStatus(r);
    if (st === '退款成功' || st === '售后处理中' || st === '处理中') {
      s.afterSaleCount += 1;
    }
    s.afterSaleBreakdown[st] = (s.afterSaleBreakdown[st] || 0) + 1;
  });

  // ★ 计算 date-GMV 比率（基于 Pass1 收集的 dgm，必须在 Pass3 之前）
  const dr: Record<string, { pid: string; ratio: number }[]> = {};
  Object.keys(dgm).forEach(dk => {
    const m: Record<string, number> = {};
    dgm[dk].forEach(i => { m[i.pid] = (m[i.pid] || 0) + i.gmv; });
    const t = Object.values(m).reduce((s, v) => s + v, 0);
    if (t > 0) dr[dk] = Object.entries(m).map(([pid, gmv]) => ({ pid, ratio: gmv / t }));
  });

  // Pass 3: 商品推广数据 — 有商品ID直接匹配，无商品ID按GMV比例分摊
  promoProducts.forEach((p: any) => {
    const pid = safeStr(p['商品ID'] || p['商品id'] || p['商品编号'] || '');
    const c = safeNum(p['成交花费(元)'] || p['总花费(元)'] || p['花费(元)']);
    const cl = safeNum(p['点击量']), im = safeNum(p['曝光量'] || p['展现量']);
    const ord = safeNum(p['成交笔数']), tr = safeNum(p['交易额(元)'] || p['成交金额(元)']);

    if (pid && stats[pid]) {
      // 有商品ID：直接匹配
      const s = stats[pid];
      s.hasPromoData = true;
      s.promoCost += c; s.promoClicks += cl; s.promoImpressions += im;
      s.promoOrders += ord; s.promoTransaction += tr;
      s.promoSourceDetails.push({
        source: '商品推广', date: safeStr(p['日期']),
        cost: c, clicks: cl, impressions: im, orders: ord, transaction: tr,
        ctr: im > 0 ? (cl / im) * 100 : 0, cvr: cl > 0 ? (ord / cl) * 100 : 0,
        productName: safeStr(p['商品名称'] || ''),
      });
    } else {
      // ★ 无商品ID（账号级推广）：按当日GMV比例分摊到各商品
      const dk = (p['日期'] || '').split(' ')[0];
      const ratios = dr[dk];
      if (!ratios) return;
      ratios.forEach(({ pid: rpid, ratio }) => {
        if (!stats[rpid]) return;
        const s = stats[rpid];
        s.hasPromoData = true;
        s.promoCost += c * ratio; s.promoTransaction += tr * ratio;
        s.promoOrders += Math.round(ord * ratio);
      });
    }
  });

  // ★ 合并明星店铺 + 直播推广分配为单次遍历
  const allocate = (rr: any[], cf: string, gf: string, of: string, src: string) => {
    rr.forEach((r: any) => {
      const dk = (r['日期'] || '').split(' ')[0];
      const ratios = dr[dk]; if (!ratios) return;
      const tc = safeNum(r[cf]), tg = safeNum(r[gf]), to = safeNum(r[of]);
      ratios.forEach(({ pid, ratio }) => {
        if (!stats[pid]) return;
        const s = stats[pid];
        s.promoCost += tc * ratio; s.promoTransaction += tg * ratio; s.promoOrders += Math.round(to * ratio);
        s.promoSourceDetails.push({ source: src, date: dk, cost: tc * ratio, clicks: 0, impressions: 0, orders: Math.round(to * ratio), transaction: tg * ratio, ctr: 0, cvr: 0, productName: '' });
      });
    });
  };
  allocate(starStoreSummary, '花费(元)', '交易额(元)', '成交笔数', '明星店铺');
  allocate(liveStreamSummary, '总花费(元)', '交易额(元)', '成交笔数', '直播推广');

  const pfo = safeNum(costConfigs['dianfx_packaging_fee'] || 3);
  const sfo = safeNum(costConfigs['dianfx_shipping_fee'] || 5);
  const ifo = safeNum(costConfigs['dianfx_insurance_fee'] || 2);
  const dcr = safeNum(costConfigs['dianfx_default_cost_ratio'] || 30);

  // ★ 平台技术服务费：按订单级字段分摊到各商品
  const totalPlatformFeeFromOrders = orders.reduce((s, o) => {
    return s + (safeNum(o['平台技术服务费(元)']) || safeNum(o['平台服务费(元)']) || safeNum(o['技术服务费(元)']) || 0);
  }, 0);
  // 按商品收入占比分摊平台费
  const totalRevenueAll = Object.values(stats).reduce((s: number, st: any) => s + st.revenue, 0);
  const platformFeeAlloc: Record<string, number> = {};
  if (totalPlatformFeeFromOrders > 0 && totalRevenueAll > 0) {
    Object.keys(stats).forEach(pid => {
      platformFeeAlloc[pid] = totalPlatformFeeFromOrders * (stats[pid].revenue / totalRevenueAll);
    });
  }

  // Pass 4: 最终计算
  Object.keys(stats).forEach(pid => {
    const s = stats[pid];
    let pc = 0; let cst: string = 'missing';
    if (productCosts[pid] !== undefined && productCosts[pid] > 0) { pc = productCosts[pid] * s.sales; cst = 'real'; }
    else {
      let stc = 0; let ms = 0;
      for (const [k, uc] of Object.entries(productCosts)) {
        if (k.startsWith(pid + '_') && uc > 0) { const ss = (skuSalesMap[pid] || {})[k] || 0; stc += uc * ss; ms += ss; }
      }
      if (stc > 0 && ms > 0) { if (ms < s.sales) stc += (stc / ms) * (s.sales - ms); pc = stc; cst = 'real'; }
      else if (dcr > 0) { pc = s.gmv * (dcr / 100); cst = 'estimated'; }
    }
    // ★ 包装/运费/险按件数乘（非订单数）
    const pf = pfo * s.sales, sf = sfo * s.sales, insf = ifo * s.sales;
    const gp = s.revenue - s.promoCost - pf - sf - insf;
    // ★ 修复：利润 = 收入 - 退款金额 - 产品成本 - 推广费 - 包装 - 快递 - 运费险 - 平台费
    const platAlloc = platformFeeAlloc[pid] || 0;
    const ptp = s.revenue - s.refund - pc - s.promoCost - pf - sf - insf - platAlloc;
    s.roi = s.promoCost > 0 ? s.promoTransaction / s.promoCost : 0;
    s.refundRate = s.orders > 0 ? (s.refundCount / s.orders) * 100 : 0;
    s.avgOrderValue = s.orders > 0 ? s.gmv / s.orders : 0;
    s.afterSaleRate = s.orders > 0 ? (s.afterSaleCount / s.orders) * 100 : 0;
    s.ctr = s.promoImpressions > 0 ? (s.promoClicks / s.promoImpressions) * 100 : 0;
    s.cvr = s.promoClicks > 0 ? (s.promoOrders / s.promoClicks) * 100 : 0;
    s.discountRatio = s.gmv > 0 ? (s.discount / s.gmv) * 100 : 0;
    s.promoCostRatio = s.gmv > 0 ? (s.promoCost / s.gmv) * 100 : 0;
    s.netProfit = ptp; s.grossProfit = gp; s.preTaxProfit = ptp; s.netProfitAfterTax = ptp;
    s.totalCost = pc + pf + sf + insf + s.promoCost + platAlloc;
    // ★ 修复：profitRate 必须在 netProfit 赋值之后计算（之前顺序错误导致永远为 0）
    s.profitRate = s.revenue > 0 ? (s.netProfit / s.revenue) * 100 : 0;
    s.costBreakdown = { productCost: pc, packagingFee: pf, shippingFee: sf, promoCost: s.promoCost, discount: s.discount, platformFee: platAlloc, insuranceFee: insf, penaltyFee: 0, marketingFee: 0, taxes: 0, customDeductions: 0 };
    s.costSource = { productCost: cst, taxes: 'default', customDeductions: 'none' };
    s.profitConfidence = cst === 'real' ? (s.hasPromoData ? 'high' : 'medium') : 'low';
    const dm = dailySalesMap[pid];
    if (dm) s.dailySales = Object.values(dm).sort((a: any, b: any) => a.date.localeCompare(b.date));
    const det = orderDetails[pid];
    if (det && det.dates.length > 0) {
      const sorted = det.dates.filter(Boolean).sort();
      s.firstOrderDate = sorted[0] || ''; s.lastOrderDate = sorted[sorted.length - 1] || '';
      const first = new Date(s.firstOrderDate), last = new Date(s.lastOrderDate);
      s.activeDays = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1);
      s.avgDailySales = s.activeDays > 0 ? s.sales / s.activeDays : 0;
      // ★ 修复：周转天数 = 30 / 日均销量（之前公式 sales/avgDailySales=activeDays, 恒等于活跃天数）
      s.turnoverDays = s.avgDailySales > 0 ? Math.round(30 / s.avgDailySales) : 999;
      s.sellThroughRate = s.activeDays > 0 ? (s.sales / s.activeDays) * 100 : 0;
    }
    if (det && det.prices.length > 0) s.priceDistribution = buildBuckets(det.prices);
  });
  return stats;
}


export function computeDashboardKPI(data: Record<string, any[]>, configs?: Record<string, any>): any {
  const rawOrders: any[] = data.orders || [];
  // ★ 有效订单口径：排除已取消/待付款/代付款等非真实订单
  const orders = filterValidOrders(rawOrders);
  const promo: any[] = data.promotionProducts || [];
  const starStore: any[] = data.starStoreSummary || [];
  const liveStream: any[] = data.liveStreamSummary || [];
  const afterSale: any[] = data.afterSaleRecords || [];
  const insurance: any[] = data.shippingInsurance || [];
  const financial: any[] = data.financialRecords || [];
  const safeCF = (cfg: any, key: string, defaultVal: number): number => {
    if (!cfg) return defaultVal;
    const v = cfg[key];
    if (v === undefined || v === null || v === '') return defaultVal;
    const n = parseFloat(String(v));
    return isNaN(n) ? defaultVal : n;
  };
  const insFeePerOrder = safeCF(configs, 'dianfx_insurance_fee', 0);
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + safeNum(x[key]), 0);
  const sm = (arr: any[], keys: string[]) => arr.reduce((s, x) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);
  const totalGmv = sum(orders, '商品总价(元)');
  const totalRevenue = sum(orders, '商家实收金额(元)');
  const totalPaid = sum(orders, '用户实付金额(元)');
  const totalRefund = sum(orders, '退款金额(元)');
  const totalPostage = sum(orders, '邮费(元)');
  // ★ 唯一订单号集合（修正：之前用行数）
  const uniqueOrderNos = new Set(orders.map(o => String(o['订单号'] || '').trim()).filter(Boolean));
  const orderCount = uniqueOrderNos.size || orders.length;
  // ★ 买家数：订单号后4位相同=同买家
  const buyerSet = new Set(orders.map(o => { const on = String(o['订单号'] || '').trim(); return on.slice(-4); }).filter(Boolean));
  // ★ 退款订单：售后表"退款成功"对应的订单（表格口径）
  const refundedOrderNos = new Set(afterSale.filter(r => getAfterSaleStatus(r) === '退款成功').map(r => getOrderNo(r)).filter(Boolean));
  // ★ 售后率订单：(退款成功 + 售后处理中)的订单（用户指定口径）
  const afterSaleFilteredSet = new Set(afterSale.filter(r => {
    const st = getAfterSaleStatus(r);
    return st === '退款成功' || st === '售后处理中' || st === '处理中';
  }).map(r => getOrderNo(r)).filter(Boolean));
  const refundOrders = orders.filter(o => refundedOrderNos.has(String(o['订单号'] || '').trim()));
  // ★ 修复BUG：退款金额使用售后表实际金额，而非订单商家实收金额
  const refundAmountMapLocal = new Map<string, number>();
  afterSale.filter(r => getAfterSaleStatus(r) === '退款成功').forEach((r: any) => {
    const on = getOrderNo(r);
    if (!on) return;
    refundAmountMapLocal.set(on, (refundAmountMapLocal.get(on) || 0) + safeNum(r['退款金额(元)'] || r['买家退款金额'] || r['退款金额']));
  });
  const totalRefundAmount = refundOrders.reduce((s, o) => s + (refundAmountMapLocal.get(String(o['订单号'] || '').trim()) || 0), 0);
  const totalDiscount = sum(orders, '店铺优惠折扣(元)') + sum(orders, '平台优惠折扣(元)') + sum(orders, '多多支付立减金额(元)') + sum(orders, '拼多多优惠券(元)');
  const platformFee = sum(orders, '平台技术服务费(元)') || sum(orders, '平台服务费(元)') || sum(orders, '技术服务费(元)');
  const promoCost = sm(promo, ['成交花费(元)', '总花费(元)', '花费(元)']);
  // ★ 推广 GMV 优先用净交易额，兜底用交易额
  const promoGmv = sm(promo, ['净交易额(元)', '交易额(元)', '成交金额(元)']);
  const promoOrders = Math.round(sum(promo, '成交笔数'));
  const starCost = sm(starStore, ['花费(元)', '总花费(元)']);
  const starGmv = sm(starStore, ['交易额(元)', '成交金额(元)']);
  const starOrders = Math.round(sm(starStore, ['成交笔数', '订单数']));
  const liveCost = sm(liveStream, ['总花费(元)', '花费(元)']);
  const liveGmv = sm(liveStream, ['交易额(元)', '成交金额(元)']);
  const liveOrders = Math.round(sm(liveStream, ['成交笔数', '订单数']));
  const totalPromoCost = promoCost + starCost + liveCost;
  const totalPromoGmv = promoGmv + starGmv + liveGmv;
  const totalPromoOrders = promoOrders + starOrders + liveOrders;
  // ★ 退款金额 = 退款成功订单的商家实收合计（表格口径）
  const asRefund = totalRefundAmount;
  const insFee = insFeePerOrder > 0
    ? orderCount * insFeePerOrder
    : (() => {
        const seen = new Set<string>();
        let total = 0;
        insurance.forEach(r => {
          const rNo = String(r['订单编号'] || r['订单号'] || '').trim();
          if (!rNo || seen.has(rNo)) return;
          seen.add(rNo);
          total += safeNum(r['服务费用（元）'] || r['服务费用(元)'] || r['保费（元）'] || r['保费(元)'] || 0);
        });
        return total;
      })();
  const finExpense = (f: any) => safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || f['支出金额(元)'] || '0');
  const penalties = financial.filter(f => String(f['业务描述'] || '').startsWith('004')).reduce((s, f) => s + Math.abs(finExpense(f)), 0);
  // ★ 百亿补贴费用：货款明细中 0030003 或包含"百亿补贴"的服务费
  const subsidyFee = financial.filter(f =>
    String(f['业务描述'] || '').includes('百亿补贴') || String(f['备注'] || '').includes('百亿补贴')
  ).reduce((s, f) => s + Math.abs(finExpense(f)), 0);
  // ★ SKU数量 = 所有商品数量(件)的合计
  const skuQuantity = orders.reduce((s, o) => s + safeNum(o['商品数量(件)']), 0);
  // ★ 同意退款时间维度退款 = 售后记录中退款成功的退款金额合计（按退款单本身金额）
  const refundApprovedRecords = afterSale.filter(r => getAfterSaleStatus(r) === '退款成功');
  const refundApprovalAmount = refundApprovedRecords.reduce((s, r) => s + safeNum(r['退款金额(元)'] || r['买家退款金额'] || r['退款金额']), 0);
  const refundApprovalOrders = new Set(refundApprovedRecords.map(r => getOrderNo(r)).filter(Boolean)).size;
  const rfp = asRefund > 0 ? asRefund : totalRefund;
  const profit = totalRevenue - rfp - totalPromoCost - insFee - penalties - totalPostage - subsidyFee;
  const profitRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const avgOrder = orderCount > 0 ? totalRevenue / orderCount : 0;
  // ★ 发货判定：有快递单号才算已发货
  const shipped = orders.filter(o => { const v = o['快递单号']; return v != null && String(v).trim() !== ''; });
  const avgShipH = shipped.length > 0 ? shipped.reduce((s, o) => { const pt = new Date(String(o['支付时间'] || '')); const st = new Date(String(o['发货时间'] || '')); return s + (isNaN(st.getTime()) || isNaN(pt.getTime()) ? 0 : (st.getTime() - pt.getTime()) / 3600000); }, 0) / shipped.length : 0;
  const conv = orderCount > 0 ? (shipped.length / orderCount) * 100 : 0;
  const orgOrd = Math.max(0, orderCount - totalPromoOrders);
  const orgGmv = Math.max(0, totalGmv - totalPromoGmv);
  const statusMap: Record<string, number> = {};
  orders.forEach(o => { const s = String(o['订单状态'] || ''); statusMap[s] = (statusMap[s] || 0) + 1; });
  const provMap: Record<string, number> = {};
  orders.forEach(o => { const p = String(o['省'] || '').trim(); if (p) provMap[p] = (provMap[p] || 0) + 1; });
  return {
    kpi: { gmv: totalGmv, revenue: totalRevenue, paid: totalPaid, refund: totalRefundAmount, orders: orderCount, refundOrders: refundOrders.length, refundRate: orderCount > 0 ? (refundOrders.length / orderCount) * 100 : 0, afterSaleRate: orderCount > 0 ? (afterSaleFilteredSet.size / orderCount) * 100 : 0, afterSaleRefundAmount: asRefund, avgOrder, discount: totalDiscount, platformFee: platformFee || (totalRevenue * 0.006), profit, profitRate, postage: totalPostage, conversionRate: conv, avgShipHours: avgShipH, organicOrders: orgOrd, organicGmv: orgGmv, products: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || '')).filter(Boolean)).size, promoCost: totalPromoCost, promoGmv: totalPromoGmv, promoROI: totalPromoCost > 0 ? totalPromoGmv / totalPromoCost : 0, promoOrders: totalPromoOrders, promoBreakdown: { product: { cost: promoCost, gmv: promoGmv, orders: promoOrders }, star: { cost: starCost, gmv: starGmv, orders: starOrders }, live: { cost: liveCost, gmv: liveGmv, orders: liveOrders } }, promoRatio: totalGmv > 0 ? (totalPromoCost / totalGmv) * 100 : 0, ctr: sum(promo, '点击量') / Math.max(1, sum(promo, '曝光量')) * 100, cvr: sum(promo, '成交笔数') / Math.max(1, sum(promo, '点击量')) * 100, insuranceFee: insFee, penalties, subsidyFee, buyers: buyerSet.size, productCount: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || '').trim()).filter(id => id && id !== '-')).size, skuQuantity, refundApprovalAmount, refundApprovalOrders },
    status: Object.entries(statusMap).map(([k, v]) => ({ name: k, value: v })),
    provinces: Object.entries(provMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => ({ name: k, value: v })),
  };
}


function computeSkuMatrix(stats: any, orders: any[], productId: string, productCosts: Record<string, number>): any[] {
  const sm: Record<string, any> = {};
  orders.filter(o => safeStr(o['商品ID'] || o['商品id']) === productId).forEach(o => {
    const skuId = safeStr(o['商品规格ID'] || o['sku_id'] || o['SKU ID'] || 'default');
    if (!sm[skuId]) sm[skuId] = { skuId, skuName: safeStr(o['商品规格'] || o['sku_name'] || skuId), sales: 0, gmv: 0, refundCount: 0, refundAmount: 0 };
    sm[skuId].sales += safeNum(o['商品数量(件)']);
    sm[skuId].gmv += safeNum(o['商品总价(元)']);
    if (safeNum(o['退款金额(元)']) > 0) { sm[skuId].refundCount += 1; sm[skuId].refundAmount += safeNum(o['退款金额(元)']); }
  });
  const ts = Object.values(sm).reduce((s: number, sk: any) => s + sk.sales, 0);
  return Object.values(sm).map(sk => {
    const rev = sk.gmv * (stats.revenue / Math.max(1, stats.gmv));
    const cost = productCosts[productId + '_' + sk.skuId] || productCosts[productId] || 0;
    const profit = rev - (cost * sk.sales) - (sk.gmv * (stats.promoCost / Math.max(1, stats.gmv)));
    return { skuId: sk.skuId, skuName: sk.skuName, sales: sk.sales, salesRatio: ts > 0 ? (sk.sales / ts) * 100 : 0, gmv: sk.gmv, refundRate: sk.sales > 0 ? (sk.refundCount / sk.sales) * 100 : 0, profitRate: rev > 0 ? (profit / rev) * 100 : 0, isMainSku: sk.sales / Math.max(1, ts) > 0.3, avgRefundDays: 0, refundAmount: sk.refundAmount, topRefundReason: '--' };
  }).sort((a, b) => b.sales - a.sales);
}

function computeRefundAnalysis(productId: string, orders: any[], afterSaleRecords: any[]): any {
  const reasons: Record<string, { count: number; amount: number }> = {};
  afterSaleRecords.filter(r => safeStr(r['商品ID'] || r['商品id']) === productId).forEach(r => {
    const reason = safeStr(r['退款原因'] || r['售后原因'] || '其他');
    if (!reasons[reason]) reasons[reason] = { count: 0, amount: 0 };
    reasons[reason].count += 1; reasons[reason].amount += safeNum(r['退款金额(元)'] || r['买家退款金额']);
  });
  const total = Object.values(reasons).reduce((s: number, r: any) => s + r.count, 0);
  const byReason = Object.entries(reasons).map(([r, d]) => ({ reason: r, count: d.count, ratio: total > 0 ? (d.count / total) * 100 : 0, amount: d.amount })).sort((a, b) => b.count - a.count);
  const wins: Record<string, any> = {};
  orders.filter(o => safeStr(o['商品ID'] || o['商品id']) === productId && safeNum(o['退款金额(元)']) > 0).forEach(o => {
    const days = Math.floor((Date.now() - new Date(o['支付时间'] || '').getTime()) / 86400000);
    let w = '30天以上'; if (days <= 7) w = '0-7天'; else if (days <= 14) w = '8-14天'; else if (days <= 30) w = '15-30天';
    if (!wins[w]) wins[w] = { count: 0, amount: 0 };
    wins[w].count += 1; wins[w].amount += safeNum(o['退款金额(元)']);
  });
  const tw = Object.values(wins).reduce((s: number, w: any) => s + w.count, 0);
  const om: Record<string, number> = { '0-7天': 1, '8-14天': 2, '15-30天': 3, '30天以上': 4 };
  const timeWindow = Object.entries(wins).map(([w, d]) => ({ window: w, count: d.count, ratio: tw > 0 ? (d.count / tw) * 100 : 0, amount: d.amount })).sort((a, b) => (om[a.window] || 99) - (om[b.window] || 99));
  return { byReason, timeWindow };
}

function classifyProduct(stats: any, allStats: Record<string, any>): any {
  const all = Object.values(allStats).filter(s => s.orders > 0);
  const avgPR = all.length > 0 ? all.reduce((s: number, x: any) => s + x.profitRate, 0) / all.length : 0;
  const avgRR = all.length > 0 ? all.reduce((s: number, x: any) => s + x.refundRate, 0) / all.length : 0;
  let type = '问题商品', tc = '#ef4444';
  if (stats.profitRate >= avgPR * 1.2) { type = '明星商品'; tc = '#22c55e'; }
  else if (stats.profitRate >= avgPR * 0.8) { type = '金牛商品'; tc = '#f59e0b'; }
  else if (stats.sales > 0) { type = '潜力商品'; tc = '#3b82f6'; }
  let stage = '成熟期';
  if (stats.activeDays < 30) stage = '引入期';
  else if (stats.activeDays < 90) stage = '成长期';
  else if (stats.refundRate > avgRR * 1.5) stage = '衰退期';
  const hp = Math.min(40, Math.max(0, (stats.profitRate / Math.max(1, avgPR)) * 40));
  const hr = Math.min(30, Math.max(0, (1 - stats.refundRate / Math.max(1, avgRR * 2)) * 30));
  const hr2 = Math.min(30, Math.max(0, (stats.roi / 3) * 30));
  const hs = Math.round(hp + hr + hr2);
  const cm3 = stats.profitRate * 0.4 + (1 - stats.refundRate / 100) * 30 + Math.min(stats.roi * 10, 30);
  let sug = '';
  if (stats.profitRate < 0) sug = '亏损状态，建议优化成本或提高售价';
  else if (stats.refundRate > avgRR * 1.5) sug = '退款率偏高，建议检查商品质量或详情页描述';
  else if (stats.roi < 1) sug = '推广ROI偏低，建议优化推广策略或暂停低效渠道';
  else sug = '商品表现良好，保持当前策略并关注竞品动态';
  return { type, typeColor: tc, stage, suggestion: sug, healthScore: hs, cm3 };
}

function rankingsOf(pid: string, all: any[], key: string): any {
  const sorted = [...all].sort((a, b) => (b[key] || 0) - (a[key] || 0));
  const idx = sorted.findIndex(s => s.productId === pid);
  return { rank: idx >= 0 ? idx + 1 : all.length, total: all.length };
}

function detectAnomalies(stats: any, prev: any): any[] {
  const a: any[] = [];
  if (prev && prev.gmv > 0) {
    const ch = ((stats.gmv - prev.gmv) / prev.gmv) * 100;
    if (ch < -20) a.push({ title: 'GMV显著下降', description: 'GMV环比下降' + Math.abs(ch).toFixed(1) + '%', severity: 'urgent', metric: 'GMV变化', value: ch });
    if (stats.refundRate > prev.refundRate * 1.3) a.push({ title: '退款率异常上升', description: '退款率从' + prev.refundRate.toFixed(1) + '%升至' + stats.refundRate.toFixed(1) + '%', severity: 'warning', metric: '退款率', value: stats.refundRate });
  }
  if (stats.roi > 0 && stats.roi < 1) a.push({ title: '推广ROI偏低', description: '推广ROI仅' + stats.roi.toFixed(2) + '，花费$' + stats.promoCost.toFixed(0), severity: 'urgent', metric: 'ROI', value: stats.roi });
  if (stats.profitRate < 0) a.push({ title: '商品亏损', description: '净利润率' + stats.profitRate.toFixed(1) + '%', severity: 'urgent', metric: '利润率', value: stats.profitRate });
  return a;
}

function storeBenchmark(allStats: Record<string, any>): any {
  const p = Object.values(allStats).filter(s => s.orders > 0);
  if (!p.length) return { roi: { avg: 0, median: 0 }, profitRate: { avg: 0, median: 0 }, refundRate: { avg: 0, median: 0 }, turnoverDays: { avg: 0, median: 0 }, dailySales: { avg: 0, median: 0 } };
  const med = (arr: number[]) => { const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  return {
    roi: { avg: avg(p.map(s => s.roi)), median: med(p.map(s => s.roi)) },
    profitRate: { avg: avg(p.map(s => s.profitRate)), median: med(p.map(s => s.profitRate)) },
    refundRate: { avg: avg(p.map(s => s.refundRate)), median: med(p.map(s => s.refundRate)) },
    turnoverDays: { avg: avg(p.map(s => s.turnoverDays)), median: med(p.map(s => s.turnoverDays)) },
    dailySales: { avg: avg(p.map(s => s.avgDailySales)), median: med(p.map(s => s.avgDailySales)) },
  };
}


export function computeDeepAnalysis(
  productId: string, allStats: Record<string, any>,
  rawOrders: any[], promoProducts: any[], afterSaleRecords: any[],
  productCosts: Record<string, number>,
  prevStats?: Record<string, any>
): any {
  const orders = filterValidOrders(rawOrders);
  const stats = allStats[productId];
  if (!stats) return null;
  const prev = prevStats?.[productId] || null;
  const r = stats.revenue / Math.max(1, stats.gmv);
  const pt = stats.netProfit / Math.max(1, stats.gmv);
  const trendData = (stats.dailySales || []).map((d: any) => ({
    date: d.date, gmv: d.gmv, revenue: d.gmv * r, profit: d.gmv * pt,
    sales: d.sales, orders: d.orders,
    refund: d.gmv * (stats.refund / Math.max(1, stats.gmv)),
    refundRate: stats.refundRate,
  }));
  const hm: Record<number, { orders: number; gmv: number }> = {};
  orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id']) === productId).forEach((o: any) => {
    const h = new Date(o['支付时间'] || '').getHours();
    if (isNaN(h)) return;
    if (!hm[h]) hm[h] = { orders: 0, gmv: 0 };
    hm[h].orders += 1; hm[h].gmv += safeNum(o['商品总价(元)']);
  });
  const hd = Array.from({ length: 24 }, (_, h) => ({ hour: h, orders: hm[h]?.orders || 0, gmv: hm[h]?.gmv || 0 }));
  const pps = promoProducts.filter((p: any) => safeStr(p['商品ID'] || p['商品id']) === productId);
  const ti = pps.reduce((s: number, p: any) => s + safeNum(p['曝光量'] || p['展现量']), 0);
  const tc = pps.reduce((s: number, p: any) => s + safeNum(p['点击量']), 0);
  const funnel = {
    impressions: ti, clicks: tc, addToCart: 0,
    orders: stats.orders, payments: stats.orders - stats.refundCount,
    impressionsToClicks: ti > 0 ? (tc / ti) * 100 : 0,
    clicksToOrders: tc > 0 ? (stats.orders / tc) * 100 : 0,
    ordersToPayments: stats.orders > 0 ? ((stats.orders - stats.refundCount) / stats.orders) * 100 : 0,
  };
  const gm = stats.gmv;
  const pct = (v: number) => gm > 0 ? (Math.abs(v) / gm * 100).toFixed(0) + '%' : '--';
  const pw = [
    { label: 'GMV', value: gm, color: '#22c55e', pct: '100%' },
    { label: '折扣优惠', value: -(stats.discount || 0), color: '#e02e24', pct: pct(stats.discount) },
    { label: '推广花费', value: -(stats.promoCost || 0), color: '#e02e24', pct: pct(stats.promoCost) },
    { label: '商品成本', value: -(stats.costBreakdown?.productCost || 0), color: '#e02e24', pct: pct(stats.costBreakdown?.productCost || 0) },
    { label: '运费险', value: -(stats.costBreakdown?.insuranceFee || 0), color: '#f97316', pct: pct(stats.costBreakdown?.insuranceFee || 0) },
    { label: '净利润', value: stats.netProfit || 0, color: (stats.netProfit || 0) >= 0 ? '#22c55e' : '#e02e24', pct: pct(stats.netProfit) },
  ];
  const all = Object.values(allStats).filter((s: any) => s.orders > 0);
  return {
    productId, productName: stats.productName, stats, prevStats: prev,
    trendData, hourlyData: hd, funnel, profitWaterfall: pw,
    skuMatrix: computeSkuMatrix(stats, orders, productId, productCosts),
    refundAnalysis: computeRefundAnalysis(productId, orders, afterSaleRecords),
    productClassification: classifyProduct(stats, allStats),
    rankings: {
      profitRank: rankingsOf(productId, all, 'netProfit'),
      roiRank: rankingsOf(productId, all, 'roi'),
      salesRank: rankingsOf(productId, all, 'sales'),
      gmvRank: rankingsOf(productId, all, 'gmv'),
    },
    anomalies: detectAnomalies(stats, prev),
    storeBenchmark: storeBenchmark(allStats),
  };
}

// ===== 商品列表（原 routes 内联计算） =====

export function computeProductsList(data: Record<string, any[]>, storeId: string): Promise<any[]> {
  return (async () => {
    const rawOrders: any[] = data.orders || [];
    // ★ 排除待付款等无效订单
    const orders = filterValidOrders(rawOrders);
    const promo: any[] = data.promotionProducts || [];
    const costs: Record<string, number> = await loadProductCosts(storeId);

    const byPid: Record<string, any> = {};
    const pidOrderSets: Record<string, Set<string>> = {};
    const hasProdRefundField = orders.some(o => o['退款金额(元)'] !== undefined);
    orders.forEach(o => {
      const pid = safeStr(o['商品ID'] || o['商品id'] || '');
      if (!byPid[pid]) { byPid[pid] = { gmv: 0, revenue: 0, refund: 0, refundCnt: 0, name: safeStr(o['商品名称'] || pid) }; pidOrderSets[pid] = new Set(); }
      const on = safeStr(o['订单号']);
      if (on) pidOrderSets[pid].add(on);
      byPid[pid].gmv += safeNum(o['商品总价(元)']);
      byPid[pid].revenue += safeNum(o['商家实收金额(元)']);
      if (hasProdRefundField) {
        byPid[pid].refund += safeNum(o['退款金额(元)']);
        if (safeNum(o['退款金额(元)']) > 0) byPid[pid].refundCnt++;
      } else {
        const st = String(o['售后状态'] || '').trim();
        if (st.includes('退款') && st !== '无售后或售后取消') byPid[pid].refundCnt++;
      }
    });

    const promoByPid: Record<string, any> = {};
    promo.forEach(p => {
      const pid = safeStr(p['商品ID'] || '');
      if (!promoByPid[pid]) promoByPid[pid] = { cost: 0, gmv: 0 };
      const costFields = ['成交花费(元)', '总花费(元)', '花费(元)'];
      for (const k of costFields) { const v = safeNum(p[k]); if (v !== 0 || p[k] !== undefined) { promoByPid[pid].cost += v; break; } }
      const gmvFields = ['交易额(元)', '成交金额(元)'];
      for (const k of gmvFields) { const v = safeNum(p[k]); if (v !== 0 || p[k] !== undefined) { promoByPid[pid].gmv += v; break; } }
    });

    return Object.entries(byPid).map(([pid, pr]) => {
      const promoData = promoByPid[pid] || { cost: 0, gmv: 0 };
      const orderCnt = pidOrderSets[pid]?.size || 0;
      return {
        id: pid, name: pr.name, orders: orderCnt, gmv: pr.gmv,
        revenue: pr.revenue, refund: pr.refund,
        refundRate: orderCnt > 0 ? (pr.refundCnt / orderCnt) * 100 : 0,
        promoCost: promoData.cost, promoGmv: promoData.gmv,
        roi: promoData.cost > 0 ? promoData.gmv / promoData.cost : 0,
      };
    });
  })();
}

// ===== 推广分析 =====

export function computePromotionStats(data: Record<string, any[]>): any {
  const promo: any[] = data.promotionProducts || [];
  const star: any[] = data.starStoreSummary || [];
  const live: any[] = data.liveStreamSummary || [];
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + safeNum(x[key]), 0);
  const sm = (arr: any[], keys: string[]) => arr.reduce((s, x) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);

  const pCost = sm(promo, ['成交花费(元)', '总花费(元)', '花费(元)']);
  const pGmv = sm(promo, ['交易额(元)', '成交金额(元)']);
  const pOrders = Math.round(sum(promo, '成交笔数'));
  const pImp = sum(promo, '曝光量');
  const pClick = sum(promo, '点击量');
  const sCost = sm(star, ['花费(元)', '总花费(元)']);
  const sGmv = sm(star, ['交易额(元)', '成交金额(元)']);
  const sOrders = Math.round(sm(star, ['成交笔数', '订单数']));
  const sImp = sm(star, ['曝光量', '展现量']);
  const sClick = sm(star, ['点击量']);
  const lCost = sm(live, ['总花费(元)', '花费(元)']);
  const lGmv = sm(live, ['交易额(元)', '成交金额(元)']);
  const lOrders = Math.round(sm(live, ['成交笔数', '订单数']));
  const lImp = sm(live, ['曝光量', '展现量']);
  const lClick = sm(live, ['点击量']);

  const totalCost = pCost + sCost + lCost;
  const totalGmv = pGmv + sGmv + lGmv;
  const totalOrders = pOrders + sOrders + lOrders;

  return {
    summary: {
      rows: promo.length + star.length + live.length,
      cost: totalCost, gmv: totalGmv, orders: totalOrders,
      impressions: pImp + sImp + lImp, clicks: pClick + sClick + lClick,
      roi: totalCost > 0 ? totalGmv / totalCost : 0,
      ctr: (pImp + sImp + lImp) > 0 ? ((pClick + sClick + lClick) / (pImp + sImp + lImp)) * 100 : 0,
      cvr: (pClick + sClick + lClick) > 0 ? (totalOrders / (pClick + sClick + lClick)) * 100 : 0,
      breakdown: {
        product: { cost: pCost, gmv: pGmv, orders: pOrders, impressions: pImp, clicks: pClick },
        star: { cost: sCost, gmv: sGmv, orders: sOrders, impressions: sImp, clicks: sClick },
        live: { cost: lCost, gmv: lGmv, orders: lOrders, impressions: lImp, clicks: lClick },
      },
    },
    byProduct: promo,
  };
}

// ===== 售后分析 =====

export function computeAfterSaleStats(data: Record<string, any[]>): any {
  const as: any[] = data.afterSaleRecords || [];
  const orders: any[] = filterValidOrders(data.orders || []);
  // ★ 仅计退款成功的售后
  const successAS = as.filter(r => String(r['售后状态'] || '').trim() === '退款成功');
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + safeNum(x[key]), 0);
  // ★ 有售后的唯一订单
  // ★ 售后率 = (售后处理中 + 退款成功) / 总订单（用户指定口径）
  const afterSaleOrders = as.filter(r => {
    const st = getAfterSaleStatus(r);
    return st === '退款成功' || st === '售后处理中' || st === '处理中';
  });
  const asOrderSet = new Set(afterSaleOrders.map(r => getOrderNo(r)).filter(Boolean));
  const totalOrders = new Set(orders.map(o => String(o['订单号'] || '').trim()).filter(Boolean)).size || orders.length;

  const reasons: Record<string, number> = {};
  successAS.forEach(r => {
    const reason = safeStr(r['退款原因'] || r['售后原因'] || '其他');
    reasons[reason] = (reasons[reason] || 0) + 1;
  });

  return {
    total: successAS.length,
    refundAmount: sum(successAS, '退款金额(元)'),
    asRate: totalOrders > 0 ? (asOrderSet.size / totalOrders) * 100 : 0,
    reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, count: v })),
  };
}

// ===== 物流汇总 =====

export function computeLogisticsSummary(rawOrders: any[]): any {
  const orders = filterValidOrders(rawOrders);
  const shipHours: number[] = [];
  // ★ 有快递单号才算已发货
  const shippedOrders = orders.filter(o => safeStr(o['快递单号'] || '').trim());
  shippedOrders.forEach(o => {
    const pt = new Date(o['支付时间'] || '');
    const st = new Date(o['发货时间'] || '');
    if (!isNaN(pt.getTime()) && !isNaN(st.getTime())) {
      shipHours.push((st.getTime() - pt.getTime()) / 3600000);
    }
  });
  const uniqueOrders = new Set(orders.map(o => String(o['订单号'] || '').trim()).filter(Boolean)).size || orders.length;
  return {
    totalOrders: uniqueOrders,
    shippedOrders: shippedOrders.length,
    avgShipHours: shipHours.length > 0 ? shipHours.reduce((a, b) => a + b, 0) / shipHours.length : 0,
  };
}

// ===== 路由辅助：缓存+加载+计算一体化（保持路由薄） =====
import cache from './cacheService';
import { dbCircuit } from './circuitBreakerService';

/** 加载店铺数据（带缓存 + 断路器） */
export async function cachedLoadStoreData(storeId: string): Promise<Record<string, any[]>> {
  const cacheKey = `raw:${storeId}`;
  const cached = cache.get<Record<string, any[]>>(cacheKey);
  if (cached) return cached;
  const data = await dbCircuit.execute(() => loadStoreData(storeId));
  cache.set(cacheKey, data, 30);
  return data;
}

/** 加载全店聚合数据（带缓存 + 断路器） */
export async function cachedLoadAllStoresData(userId: string): Promise<Record<string, any[]>> {
  const cacheKey = `raw:all:${userId}`;
  const cached = cache.get<Record<string, any[]>>(cacheKey);
  if (cached) return cached;
  const data = await dbCircuit.execute(() => loadAllUserStoreData(userId));
  cache.set(cacheKey, data, 30);
  return data;
}

/** 加载全店配置（带缓存） */
export async function cachedLoadAllStoresConfigs(userId: string): Promise<Record<string, any>> {
  const cacheKey = `config:all:${userId}`;
  const cached = cache.get<Record<string, any>>(cacheKey);
  if (cached) return cached;
  const configs = await dbCircuit.execute(() => loadAllStoresConfigs(userId));
  cache.set(cacheKey, configs, 30);
  return configs;
}

/** 加载商品成本 */
export async function loadProductCosts(storeId: string, userId?: string): Promise<Record<string, number>> {
  const productCosts: Record<string, number> = {};
  if (storeId === '__all__' && userId) {
    const storeRows = await db('stores').where('user_id', userId).select('id');
    for (const s of storeRows) {
      const row = await db('store_configs').where({ store_id: s.id, config_key: 'dianfx_product_costs_' + s.id }).first();
      if (row?.payload_json) { try { Object.assign(productCosts, JSON.parse(row.payload_json)); } catch {} }
    }
  } else {
    const row = await db('store_configs').where({ store_id: storeId, config_key: 'dianfx_product_costs_' + storeId }).first();
    if (row?.payload_json) { try { Object.assign(productCosts, JSON.parse(row.payload_json)); } catch {} }
  }
  return productCosts;
}

/** 一站式：获取数据 + 配置 + 成本，根据 storeId 自动判断全店/单店 */
export async function resolveStoreContext(storeId: string, userId: string): Promise<{
  data: Record<string, any[]>;
  configs: Record<string, any>;
  productCosts: Record<string, number>;
}> {
  const isAll = storeId === '__all__';
  const [data, configs, productCosts] = await Promise.all([
    isAll ? cachedLoadAllStoresData(userId) : cachedLoadStoreData(storeId),
    isAll ? cachedLoadAllStoresConfigs(userId) : loadStoreConfigs(storeId),
    loadProductCosts(storeId, isAll ? userId : undefined),
  ]);
  return { data, configs, productCosts };
}

// ===== 新增: 每日趋势 =====
export function computeDailyTrends(rawOrders: any[], afterSaleRecords: any[]): any {
  const orders = filterValidOrders(rawOrders);
  const dailyMap: Record<string, { gmv: number; orders: number; revenue: number; refund: number; refundCount: number; uniqueOrders: Set<string> }> = {};
  // ★ 退款以售后表为准（表格口径）
  const refundOrderSet = new Set((afterSaleRecords || []).filter(r => getAfterSaleStatus(r) === '退款成功').map(r => getOrderNo(r)).filter(Boolean));
  // ★ 退款金额 Map — 使用售后表的实际退款金额，而非订单的商家实收金额
  const refundAmountMap = new Map<string, number>();
  (afterSaleRecords || []).forEach((r: any) => {
    if (getAfterSaleStatus(r) !== '退款成功') return;
    const on = getOrderNo(r);
    if (!on) return;
    refundAmountMap.set(on, (refundAmountMap.get(on) || 0) + safeNum(r['退款金额(元)'] || r['买家退款金额'] || r['退款金额']));
  });
  orders.forEach((o: any) => {
    const d = (o['支付时间'] || '').split(' ')[0];
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!dailyMap[d]) dailyMap[d] = { gmv: 0, orders: 0, revenue: 0, refund: 0, refundCount: 0, uniqueOrders: new Set() };
    dailyMap[d].gmv += safeNum(o['商品总价(元)']);
    dailyMap[d].revenue += safeNum(o['商家实收金额(元)']);
    dailyMap[d].orders += 1;
    dailyMap[d].uniqueOrders.add(safeStr(o['订单号']));
    const on = String(o['订单号'] || '').trim();
    if (refundOrderSet.has(on)) {
      dailyMap[d].refundCount += 1;
      dailyMap[d].refund += (refundAmountMap.get(on) || 0);
    }
  });
  return Object.entries(dailyMap).map(([date, v]) => ({ date, ...v, orders: v.uniqueOrders.size })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

// ===== 新增: 地区分布 =====
export function computeRegionDistribution(rawOrders: any[]): any {
  const orders = filterValidOrders(rawOrders);
  const provMap: Record<string, { orders: number; gmv: number; buyers: number }> = {};
  const buyerSet = new Map<string, Set<string>>();
  orders.forEach((o: any) => {
    const prov = safeStr(o['省'] || '').trim();
    if (!prov) return;
    if (!provMap[prov]) provMap[prov] = { orders: 0, gmv: 0, buyers: 0 };
    provMap[prov].orders += 1;
    provMap[prov].gmv += safeNum(o['商品总价(元)']);
    const orderNo = safeStr(o['订单号'] || '');
    if (orderNo) {
      if (!buyerSet.has(prov)) buyerSet.set(prov, new Set());
      // ★ 买家=订单号后4位
      buyerSet.get(prov)!.add(orderNo.slice(-4));
    }
  });
  return Object.entries(provMap).map(([prov, v]) => ({
    province: prov, orders: v.orders, gmv: v.gmv,
    buyers: buyerSet.get(prov)?.size || 0,
  })).sort((a: any, b: any) => b.gmv - a.gmv);
}

// ===== 新增: 财务汇总 =====
export function computeFinancialSummary(financialRecords: any[], rawOrders: any[]): any {
  const orders = filterValidOrders(rawOrders);
  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const safeIncome = (f: any) => safeNum(f['收入金额（+元）'] || f['收入金额(+元)'] || '0');
  const safeExpense = (f: any) => safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || '0');
  const income = financialRecords.filter((f: any) => safeIncome(f) > 0);
  const expense = financialRecords.filter((f: any) => safeExpense(f) > 0);
  return {
    totalIncome: income.reduce((s, f) => s + safeIncome(f), 0),
    totalExpense: expense.reduce((s, f) => s + Math.abs(safeExpense(f)), 0),
    incomeCount: income.length,
    expenseCount: expense.length,
    totalRecords: financialRecords.length,
    orderRevenue: orders.reduce((s: number, o: any) => s + safeNum(o['商家实收金额(元)']), 0),
  };
}

// ===== 周期对比 (环比) — 增强版含成本/利润 =====
export function computePeriodCompare(
  rawOrders: any[],
  promoProducts: any[],
  afterSaleRecords: any[],
  compareDays: number = 7,
  productCosts?: Record<string, number>,
  configs?: Record<string, any>,
  storeId?: string
): any {
  const orders = filterValidOrders(rawOrders);
  if (!orders.length) return { current: null, previous: null, changes: {} };
  const now = new Date();
  const cutoff = new Date(now.getTime() - compareDays * 86400000);
  const prevCutoff = new Date(cutoff.getTime() - compareDays * 86400000);

  const currentOrders = orders.filter((o: any) => {
    const d = new Date((o['支付时间'] || '').split(' ')[0]);
    return d >= cutoff && !isNaN(d.getTime());
  });
  const prevOrders = orders.filter((o: any) => {
    const d = new Date((o['支付时间'] || '').split(' ')[0]);
    return d >= prevCutoff && d < cutoff && !isNaN(d.getTime());
  });

  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const curGmv = sum(currentOrders, '商品总价(元)');
  const curRev = sum(currentOrders, '商家实收金额(元)');
  const prevGmv = sum(prevOrders, '商品总价(元)');
  const prevRev = sum(prevOrders, '商家实收金额(元)');

  const chg = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

  // ★ 新增: 成本比较（需 productCosts + configs）
  let curCost = 0, prevCost = 0;
  if (productCosts && configs) {
    const curSummary = computeCostSummary(currentOrders, productCosts, configs, [], [], storeId);
    const prevSummary = computeCostSummary(prevOrders, productCosts, configs, [], [], storeId);
    curCost = curSummary.totalCost;
    prevCost = prevSummary.totalCost;
  }

  const curProfit = curRev - curCost;
  const prevProfit = prevRev - prevCost;

  return {
    current: {
      orders: currentOrders.length,
      gmv: curGmv,
      revenue: curRev,
      cost: curCost,
      profit: curProfit,
    },
    previous: {
      orders: prevOrders.length,
      gmv: prevGmv,
      revenue: prevRev,
      cost: prevCost,
      profit: prevProfit,
    },
    changes: {
      orders: chg(currentOrders.length, prevOrders.length),
      gmv: chg(curGmv, prevGmv),
      revenue: chg(curRev, prevRev),
      cost: prevCost > 0 ? chg(curCost, prevCost) : (curCost > 0 ? 100 : 0),
      profit: prevProfit !== 0 ? ((curProfit - prevProfit) / Math.abs(prevProfit)) * 100 : (curProfit > 0 ? 100 : -100),
    },
  };
}

// ===== 新增: 推广按日汇总 =====
export function computePromoByDate(promoProducts: any[], starStoreSummary: any[], liveStreamSummary: any[]): any {
  const dateMap: Record<string, { cost: number; gmv: number; orders: number; impressions: number; clicks: number }> = {};
  const sm = (arr: any[], cf: string, gf: string, of: string) => {
    arr.forEach((r: any) => {
      const d = (r['日期'] || '').split(' ')[0];
      if (!d) return;
      if (!dateMap[d]) dateMap[d] = { cost: 0, gmv: 0, orders: 0, impressions: 0, clicks: 0 };
      const costFields = [cf, '花费(元)', '总花费(元)'];
      for (const kf of costFields) { const v = safeNum(r[kf]); if (v !== 0 || r[kf] !== undefined) { dateMap[d].cost += v; break; } }
      const gmvFields = [gf, '交易额(元)', '成交金额(元)'];
      for (const kf of gmvFields) { const v = safeNum(r[kf]); if (v !== 0 || r[kf] !== undefined) { dateMap[d].gmv += v; break; } }
      dateMap[d].orders += Math.round(safeNum(r[of] || r['成交笔数'] || 0));
      dateMap[d].impressions += safeNum(r['曝光量'] || r['展现量'] || 0);
      dateMap[d].clicks += safeNum(r['点击量'] || 0);
    });
  };
  sm(promoProducts, '成交花费(元)', '交易额(元)', '成交笔数');
  sm(starStoreSummary, '花费(元)', '交易额(元)', '成交笔数');
  sm(liveStreamSummary, '总花费(元)', '交易额(元)', '成交笔数');
  return Object.entries(dateMap).map(([date, v]) => ({ date, ...v })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

// ===== 新增: 物流时效分布 =====
export function computeShipTimeDistribution(rawOrders: any[]): any {
  const orders = filterValidOrders(rawOrders);
  const buckets: Record<string, number> = { '<24h': 0, '24-48h': 0, '48-72h': 0, '>72h': 0, '未发货': 0 };
  let shipped = 0, totalHours = 0;
  orders.forEach((o: any) => {
    const pt = new Date(o['支付时间'] || '');
    const st = new Date(o['发货时间'] || '');
    if (isNaN(st.getTime()) || safeStr(o['发货时间'] || '').trim() === '') { buckets['未发货']++; return; }
    const h = (st.getTime() - pt.getTime()) / 3600000;
    if (h < 0) return;
    totalHours += h; shipped++;
    if (h < 24) buckets['<24h']++;
    else if (h < 48) buckets['24-48h']++;
    else if (h < 72) buckets['48-72h']++;
    else buckets['>72h']++;
  });
  return { distribution: Object.entries(buckets).map(([k, v]) => ({ range: k, count: v })), shippedOrders: shipped, avgHours: shipped > 0 ? totalHours / shipped : 0, totalOrders: orders.length };
}

// ===== 成本汇总（增强版） =====
// 支持带 storeId 后缀的配置键（如 dianfx_packaging_fee_store123），
// 也兼容不带后缀的旧键（dianfx_packaging_fee）
function safeCF(configs: Record<string, any>, key: string, storeId: string | undefined, def: number): number {
  if (storeId) {
    const v = configs[`${key}_${storeId}`];
    if (v !== undefined) return safeNum(v);
  }
  return safeNum(configs[key] ?? def);
}

export function computeCostSummary(
  rawOrders: any[],
  productCosts: Record<string, number>,
  configs: Record<string, any>,
  financialRecords: any[] = [],
  afterSaleRecords: any[] = [],
  storeId?: string
): any {
  // ★ 排除待付款等无效订单
  const orders = filterValidOrders(rawOrders);
  // 配置读取（优先 storeId 后缀键）
  const pfo = safeCF(configs, 'dianfx_packaging_fee', storeId, 3);
  const sfo = safeCF(configs, 'dianfx_shipping_fee', storeId, 5);
  const ifo = safeCF(configs, 'dianfx_insurance_fee', storeId, 2);
  const lfo = safeCF(configs, 'dianfx_labor_fee', storeId, 0);
  const promoFo = safeCF(configs, 'dianfx_promotion_fee', storeId, 0);
  const platComm = safeCF(configs, 'dianfx_platform_commission', storeId, 0);
  const defCostRatio = safeCF(configs, 'dianfx_default_cost_ratio', storeId, 0);

  let totalProductCost = 0, totalQty = 0, totalRevenue = 0;
  const orderMap = new Map<string, { merchant: number; qty: number; products: string[]; pidQty: Map<string, number> }>();

  orders.forEach((o: any) => {
    const pid = safeStr(o['商品ID'] || o['商品id'] || '');
    const qty = safeNum(o['商品数量(件)']);
    const merchant = safeNum(o['商家实收金额(元)']);
    const orderNo = String(o['订单号'] || '').trim();

    totalQty += qty;
    totalRevenue += merchant;
    if (pid && productCosts[pid]) totalProductCost += productCosts[pid] * qty;

    // 按订单聚合（用于多SKU检测和单订单成本计算）
    if (orderNo) {
      if (!orderMap.has(orderNo)) orderMap.set(orderNo, { merchant: 0, qty: 0, products: [], pidQty: new Map() });
      const entry = orderMap.get(orderNo)!;
      entry.merchant += merchant;
      entry.qty += qty;
      if (!entry.products.includes(pid)) entry.products.push(pid);
      entry.pidQty.set(pid, (entry.pidQty.get(pid) || 0) + qty);
    }
  });

  // 按件数乘，非订单数
  const totalPackaging = pfo * totalQty;
  const totalShipping = sfo * totalQty;
  const totalInsurance = ifo * totalQty;
  const totalLabor = lfo * orders.length;
  const totalPromotion = promoFo * orders.length;

  const uniqueOrders = orderMap.size || orders.length;

  // 计算平台佣金
  const totalPlatformCommission = platComm > 0 ? totalRevenue * (platComm / 100) : 0;

  // ★ 罚金 & 营销费（从财务记录提取）
  let penalties = 0, marketingFees = 0;
  const finOrderSet = new Set<string>();
  (financialRecords || []).forEach((f: any) => {
    const income = safeNum(f['收入金额（+元）'] || f['收入金额(+元)'] || '0');
    const expense = Math.abs(safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || '0'));
    const type = String(f['费用类型'] || f['类型'] || f['明细'] || '').trim();
    const orderNo = String(f['订单编号'] || f['订单号'] || '').trim();
    if (orderNo) finOrderSet.add(orderNo);

    // 罚款：费用类型包含"罚款"或"赔付"
    if (type.includes('罚款') || type.includes('赔付') || type.includes('违约金') || type.includes('延迟发货')) {
      penalties += expense;
    }
    // 营销费：费用类型包含"推广"或"营销"
    if (type.includes('推广') || type.includes('营销') || type.includes('广告')) {
      marketingFees += expense;
    }
    // 无类型时：按费用类型关键字兜底
    const desc = String(f['费用说明'] || f['备注'] || f['摘要'] || '').trim();
    if (!type) {
      if (desc.includes('罚款') || desc.includes('赔付')) penalties += expense;
      else if (desc.includes('推广') || desc.includes('营销')) marketingFees += expense;
    }
  });

  // ★ 售后退款总额
  let totalRefundAmount = 0;
  (afterSaleRecords || []).forEach((r: any) => {
    const status = String(r['售后状态'] || '').trim();
    const amount = safeNum(r['退款金额(元)'] || r['退款金额'] || r['售后金额'] || 0);
    if (status === '退款成功') totalRefundAmount += amount;
  });

  // ★ 多SKU重复扣费检测
  let duplicateFees = 0;
  orderMap.forEach((entry, orderNo) => {
    if (entry.products.length > 1) {
      // 多SKU订单：包装费、人工费、快递费被每个SKU各扣一次，多余次数×费率
      const skuCount = entry.products.length;
      const extraPackaging = pfo * (skuCount - 1) * entry.qty;
      const extraShipping = sfo * (skuCount - 1);
      const extraLabor = lfo * (skuCount - 1);
      duplicateFees += extraPackaging + extraShipping + extraLabor;
    }
  });

  // ★ 亏损订单数（订单级成本 > 收入）
  let lossOrderCount = 0;
  orderMap.forEach((entry, orderNo) => {
    // 按订单汇总成本（不含多SKU重复扣费）
    let orderTotalCost = 0;
    entry.pidQty.forEach((qty, pid) => {
      if (pid && productCosts[pid]) orderTotalCost += productCosts[pid] * qty;
    });
    // 加上配置费（均摊至订单）
    orderTotalCost += pfo * entry.qty + sfo + ifo + lfo + promoFo;
    // 加上平台佣金
    if (platComm > 0) orderTotalCost += entry.merchant * (platComm / 100);
    // 加上罚金（先检查该订单是否有罚款）
    let orderPenalty = 0;
    if (finOrderSet.has(orderNo)) {
      (financialRecords || []).forEach((f: any) => {
        const fn = String(f['订单编号'] || f['订单号'] || '').trim();
        if (fn === orderNo) {
          const expense = Math.abs(safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || '0'));
          const type = String(f['费用类型'] || '').trim();
          const desc = String(f['费用说明'] || '').trim();
          if (type.includes('罚款') || type.includes('赔付') || desc.includes('罚款')) orderPenalty += expense;
        }
      });
    }
    orderTotalCost += orderPenalty;

    const orderRevenue = entry.merchant;
    if (orderTotalCost > orderRevenue) lossOrderCount++;
  });

  const totalCost = totalProductCost + totalPackaging + totalShipping + totalInsurance + totalLabor + totalPromotion + totalPlatformCommission;
  const totalWithPenaltiesAndMarketing = totalCost + penalties + marketingFees;
  const profit = totalRevenue - totalWithPenaltiesAndMarketing;
  const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const netProfit = profit - totalRefundAmount;

  return {
    productCost: totalProductCost,
    packagingFee: totalPackaging,
    shippingFee: totalShipping,
    insuranceFee: totalInsurance,
    laborFee: totalLabor,
    promotionFee: totalPromotion,
    platformCommission: totalPlatformCommission,
    penalties,
    marketingFees,
    totalCost: totalWithPenaltiesAndMarketing,
    totalRevenue,
    profit,
    profitMargin,
    netProfit,
    orderCount: uniqueOrders,
    totalQty,
    lossOrderCount,
    totalRefundAmount,
    duplicateFees,
  };
}

// ===== 商品复盘：价格变更检测 =====
// ===== 改价检测（关键修复）=====
// 2026-06-15 重大修复：
//   问题：拼多多订单数据中「商品规格ID」字段普遍缺失，导致所有SKU归入default桶，
//        不同规格（颜色/尺寸/件数）的基准价格不同，被误检测为"价格变动"。
//   修复：使用「商品规格」名称作为SKU标识（当规格ID缺失时），同一规格名称的SKU
//        才能比较价格变化。
//   额外改进：
//   1. 沉默改价检测：订单间隔 > 3天且价格变化 → 标记 inferred
//   2. 同一天、同方向、同比例的多SKU改价 → 合并展示

function detectPriceChanges(orders: any[], productId: string): any[] {
  const productOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId)
    .filter((o: any) => safeNum(o['商品总价(元)']) > 0)
    .sort((a: any, b: any) => safeStr(a['支付时间'] || '').localeCompare(safeStr(b['支付时间'] || '')));
  if (productOrders.length < 3) return [];

  // ★ 修复：使用「商品规格」名称作为SKU标识（当规格ID缺失时）
  //   拼多多数据中 商品规格ID 经常缺失，但 商品规格 必有
  const skuGroups: Record<string, any[]> = {};
  productOrders.forEach((o: any) => {
    const specName = safeStr(o['商品规格'] || '');
    // 用 specName 作为 key，避免所有无ID的订单挤入 default
    const skuKey = specName || safeStr(o['商品规格ID'] || o['sku_id'] || o['SKU ID'] || '__unknown__');
    if (!skuGroups[skuKey]) skuGroups[skuKey] = [];
    skuGroups[skuKey].push(o);
  });

  const rawEvents: any[] = [];
  Object.entries(skuGroups).forEach(([skuKey, skuOrders]) => {
    if (skuOrders.length < 2) return; // 单次订单的SKU无法检测变化
    const skuName = safeStr(skuOrders[0]['商品规格'] || skuKey);

    const dayMap: Record<string, number[]> = {};
    skuOrders.forEach((o: any) => {
      const d = (o['支付时间'] || '').split(' ')[0];
      if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      const qty = Math.max(1, safeNum(o['商品数量(件)']) || 1);
      const unitPrice = safeNum(o['商品总价(元)']) / qty;
      if (!dayMap[d]) dayMap[d] = [];
      dayMap[d].push(unitPrice);
    });

    const dailyPrices: { date: string; price: number }[] = Object.entries(dayMap).map(([d, prices]) => {
      prices.sort((a, b) => a - b);
      const mid = Math.floor(prices.length / 2);
      const median = prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
      return { date: d, price: Math.round(median * 100) / 100 };
    }).sort((a, b) => a.date.localeCompare(b.date));

    let prevPrice = 0;
    let prevDate = '';
    dailyPrices.forEach((dp) => {
      if (prevPrice > 0 && Math.abs(dp.price - prevPrice) / prevPrice > 0.05) {
        const gapDays = prevDate ? Math.round((new Date(dp.date).getTime() - new Date(prevDate).getTime()) / 86400000) : 0;
        const inferred = gapDays > 3;
        rawEvents.push({
          date: dp.date, skuId: skuKey, skuName,
          oldPrice: prevPrice, newPrice: dp.price,
          change: Math.round((dp.price - prevPrice) * 100) / 100,
          changePct: Math.round(((dp.price - prevPrice) / prevPrice) * 1000) / 10,
          type: dp.price < 5 ? '异常价格' : dp.price > prevPrice ? '涨价' : '降价',
          inferred,
          inferredRange: inferred ? prevDate + '~' + dp.date : undefined,
        });
      }
      prevPrice = dp.price;
      prevDate = dp.date;
    });
  });

  if (rawEvents.length === 0) return [];

  // 同一天同向多SKU变动 → 合并展示
  rawEvents.sort((a: any, b: any) => a.date.localeCompare(b.date));
  const byDate: Record<string, any[]> = {};
  rawEvents.forEach((ev: any) => {
    if (!byDate[ev.date]) byDate[ev.date] = [];
    byDate[ev.date].push(ev);
  });

  const mergedEvents: any[] = [];
  Object.entries(byDate).forEach(([date, dateEvents]) => {
    if (dateEvents.length === 1) {
      mergedEvents.push(dateEvents[0]);
      return;
    }
    // 检查是否同向同幅
    const first = dateEvents[0];
    const allSameDirection = dateEvents.every((e: any) => (e.type === first.type));
    const allSamePct = dateEvents.every((e: any) => Math.abs(e.changePct - first.changePct) < 1.0);
    if (allSameDirection && allSamePct && dateEvents.length >= 2) {
      mergedEvents.push({
        ...first,
        skuName: '批量改价 (' + dateEvents.length + '个SKU)',
        merged: true,
        mergeCount: dateEvents.length,
        details: dateEvents.map((e: any) => ({ skuName: e.skuName, oldPrice: e.oldPrice, newPrice: e.newPrice, changePct: e.changePct })),
        batchType: '批量',
      });
    } else {
      dateEvents.forEach((ev: any) => mergedEvents.push(ev));
    }
  });

  return mergedEvents.sort((a: any, b: any) => b.date.localeCompare(a.date));
}

// ===== 价格变更前后对比 =====
function computeSinglePriceImpact(
  orders: any[], promoProducts: any[], afterSaleRecords: any[],
  financialRecords: any[], shippingInsurance: any[],
  productCosts: Record<string, number>, configs: Record<string, any>,
  productId: string, change: any, windowDays: number
): any {
  const fd = (d: Date) => d.toISOString().split('T')[0];
  const cd = new Date(change.date);
  // 防御：无效日期时返回空对比
  if (isNaN(cd.getTime())) {
    return { change, windowDays, before: null, after: null, metrics: [] };
  }
  const bs = fd(new Date(cd.getTime() - windowDays * 86400000));
  const be = fd(new Date(cd.getTime() - 86400000));
  const as = fd(cd);
  const ae = fd(new Date(cd.getTime() + (windowDays - 1) * 86400000));
  const filterByDate = (arr: any[], field: string, start: string, end: string) =>
    arr.filter((x: any) => { const d = (x[field] || '').split(' ')[0]; return d >= start && d <= end; });
  const filterPid = (arr: any[]) => arr.filter((x: any) => safeStr(x['商品ID'] || x['商品id'] || '') === productId);
  const bOrders = filterPid(filterByDate(orders, '支付时间', bs, be));
  const aOrders = filterPid(filterByDate(orders, '支付时间', as, ae));
  const bPromo = filterPid(filterByDate(promoProducts, '日期', bs, be));
  const aPromo = filterPid(filterByDate(promoProducts, '日期', as, ae));
  const bAS = filterPid(filterByDate(afterSaleRecords, '申请时间', bs, be));
  const aAS = filterPid(filterByDate(afterSaleRecords, '申请时间', as, ae));
  const bIns = filterByDate(shippingInsurance, '日期', bs, be);
  const aIns = filterByDate(shippingInsurance, '日期', as, ae);
  const bFin = filterByDate(financialRecords, '发生时间', bs, be);
  const aFin = filterByDate(financialRecords, '发生时间', as, ae);
  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const sumSM = (arr: any[], keys: string[]) => arr.reduce((s: number, x: any) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);

  const calc = (ord: any[], prom: any[], asr: any[], ins: any[], fin: any[]) => {
    const gmv = sum(ord, '商品总价(元)');
    const rev = sum(ord, '商家实收金额(元)');
    const sales = sum(ord, '商品数量(件)');
    const orderSet = new Set(ord.map((o: any) => safeStr(o['订单号'])).filter(Boolean));
    const orderCnt = orderSet.size;
    const refundAS = asr.filter((r: any) => safeStr(r['售后状态'] || '').trim() === '退款成功');
    const refundAmt = refundAS.reduce((s: number, r: any) => s + safeNum(r['退款金额(元)'] || r['买家退款金额']), 0);
    const refundCnt = new Set(refundAS.map((r: any) => getOrderNo(r)).filter(Boolean)).size;
    const promoCost = sumSM(prom, ['成交花费(元)', '总花费(元)', '花费(元)']);
    const promoTrans = sumSM(prom, ['交易额(元)', '成交金额(元)']);
    const promoClicks = sum(prom, '点击量');
    const promoImps = sum(prom, '曝光量');
    const promoOrd = Math.round(sum(prom, '成交笔数'));
    const insFee = sum(ins, '服务费用（元）') + sum(ins, '服务费用(元)') + sum(ins, '保费（元）') + sum(ins, '保费(元)');
    const ef = (f: any) => safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || f['支出金额(元)'] || '0');
    const techFee = fin.filter((f: any) => String(f['业务描述'] || '').startsWith('0030002')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
    const subFee = fin.filter((f: any) => String(f['业务描述'] || '').startsWith('0030003')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
    const pen = fin.filter((f: any) => String(f['业务描述'] || '').startsWith('004')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
    const totalQty = sales;
    const pc = productCosts[productId] || 0;
    const prodCost = pc * totalQty;
    const pfo = safeNum(configs['dianfx_packaging_fee'] || 3) * totalQty;
    const sfo = safeNum(configs['dianfx_shipping_fee'] || 5) * totalQty;
    const ic = safeNum(configs['dianfx_insurance_fee'] || 2) * totalQty;
    const profit = rev - refundAmt - promoCost - prodCost - pfo - sfo - ic - techFee - subFee - pen;
    return {
      sales, orders: orderCnt, gmv, revenue: rev,
      refund: refundAmt, refundRate: orderCnt > 0 ? (refundCnt / orderCnt) * 100 : 0, refundCount: refundCnt,
      promoCost, promoROI: promoCost > 0 ? promoTrans / promoCost : 0, promoCostRatio: gmv > 0 ? (promoCost / gmv) * 100 : 0,
      promoClicks, promoImpressions: promoImps, promoOrders: promoOrd,
      productCost: prodCost, packagingFee: pfo, shippingFee: sfo,
      insuranceFee: ic, techFee, subsidyFee: subFee, penalty: pen,
      profit, profitRate: rev > 0 ? (profit / rev) * 100 : 0,
    };
  };

  const before = calc(bOrders, bPromo, bAS, bIns, bFin);
  const after = calc(aOrders, aPromo, aAS, aIns, aFin);
  const chg = (b: number, a: number) => ({ value: a - b, pct: b !== 0 ? ((a - b) / Math.abs(b)) * 100 : (a !== 0 ? 100 : 0) });
  const metrics = [
    { key: 'sales', label: '销量', before: before.sales, after: after.sales, change: chg(before.sales, after.sales) },
    { key: 'orders', label: '订单数', before: before.orders, after: after.orders, change: chg(before.orders, after.orders) },
    { key: 'gmv', label: 'GMV', before: before.gmv, after: after.gmv, change: chg(before.gmv, after.gmv) },
    { key: 'revenue', label: '商家实收', before: before.revenue, after: after.revenue, change: chg(before.revenue, after.revenue) },
    { key: 'refund', label: '退款金额', before: before.refund, after: after.refund, change: chg(before.refund, after.refund) },
    { key: 'refundRate', label: '退款率', before: before.refundRate, after: after.refundRate, change: chg(before.refundRate, after.refundRate) },
    { key: 'promoCost', label: '推广花费', before: before.promoCost, after: after.promoCost, change: chg(before.promoCost, after.promoCost) },
    { key: 'promoROI', label: '推广ROI', before: before.promoROI, after: after.promoROI, change: chg(before.promoROI, after.promoROI) },
    { key: 'profit', label: '净利润', before: before.profit, after: after.profit, change: chg(before.profit, after.profit) },
    { key: 'profitRate', label: '利润率', before: before.profitRate, after: after.profitRate, change: chg(before.profitRate, after.profitRate) },
  ];
  return { change, windowDays, before, after, metrics };
}

// ===== 利润拆解瀑布 =====
function computeProfitWaterfall(
  orders: any[], promoProducts: any[], afterSaleRecords: any[],
  financialRecords: any[], shippingInsurance: any[],
  productCosts: Record<string, number>, configs: Record<string, any>,
  productId: string
): any[] {
  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const sumSM = (arr: any[], keys: string[]) => arr.reduce((s: number, x: any) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);
  const pidOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  const gmv = sum(pidOrders, '商品总价(元)');
  const rev = sum(pidOrders, '商家实收金额(元)');
  const sales = sum(pidOrders, '商品数量(件)');
  const discount = sum(pidOrders, '店铺优惠折扣(元)') + sum(pidOrders, '平台优惠折扣(元)') + sum(pidOrders, '多多支付立减金额(元)') + sum(pidOrders, '拼多多优惠券(元)');
  const promo = promoProducts.filter((p: any) => safeStr(p['商品ID'] || p['商品id'] || '') === productId);
  const promoCost = sumSM(promo, ['成交花费(元)', '总花费(元)', '花费(元)']);
  const prodCost = (productCosts[productId] || 0) * sales;
  const pfo = safeNum(configs['dianfx_packaging_fee'] || 3) * sales;
  const sfo = safeNum(configs['dianfx_shipping_fee'] || 5) * sales;
  const ic = safeNum(configs['dianfx_insurance_fee'] || 2) * sales;
  const ef = (f: any) => safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || f['支出金额(元)'] || '0');
  const techFee = financialRecords.filter((f: any) => String(f['业务描述'] || '').startsWith('0030002')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
  const subFee = financialRecords.filter((f: any) => String(f['业务描述'] || '').startsWith('0030003')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
  const penalty = financialRecords.filter((f: any) => String(f['业务描述'] || '').startsWith('004')).reduce((s: number, f: any) => s + Math.abs(ef(f)), 0);
  const refundAmt = afterSaleRecords.filter((r: any) => safeStr(r['商品ID'] || r['商品id'] || '') === productId && safeStr(r['售后状态'] || '').trim() === '退款成功')
    .reduce((s: number, r: any) => s + safeNum(r['退款金额(元)'] || r['买家退款金额']), 0);
  let curRev = rev;
  const items: any[] = [];
  items.push({ step: 1, label: '商家实收', amount: rev, runningTotal: rev, pct: rev > 0 ? 100 : 0, type: 'income' });
  if (discount > 0) { items.push({ step: 2, label: '折扣优惠', amount: -discount, runningTotal: curRev, pct: rev > 0 ? (discount / rev) * 100 : 0, type: 'deduction' }); }
  if (refundAmt > 0) { items.push({ step: 3, label: '退款金额', amount: -refundAmt, runningTotal: curRev, pct: rev > 0 ? (refundAmt / rev) * 100 : 0, type: 'deduction' }); }
  if (promoCost > 0) { items.push({ step: 4, label: '推广花费', amount: -promoCost, runningTotal: curRev, pct: rev > 0 ? (promoCost / rev) * 100 : 0, type: 'deduction' }); }
  if (prodCost > 0) { items.push({ step: 5, label: '商品成本', amount: -prodCost, runningTotal: curRev, pct: rev > 0 ? (prodCost / rev) * 100 : 0, type: 'deduction' }); }
  if (pfo > 0) { items.push({ step: 6, label: '包装费', amount: -pfo, runningTotal: curRev, pct: rev > 0 ? (pfo / rev) * 100 : 0, type: 'deduction' }); }
  if (sfo > 0) { items.push({ step: 7, label: '快递费', amount: -sfo, runningTotal: curRev, pct: rev > 0 ? (sfo / rev) * 100 : 0, type: 'deduction' }); }
  if (ic > 0) { items.push({ step: 8, label: '运费险', amount: -ic, runningTotal: curRev, pct: rev > 0 ? (ic / rev) * 100 : 0, type: 'deduction' }); }
  if (techFee > 0) { items.push({ step: 9, label: '技术服务费', amount: -techFee, runningTotal: curRev, pct: rev > 0 ? (techFee / rev) * 100 : 0, type: 'deduction' }); }
  if (subFee > 0) { items.push({ step: 10, label: '百亿补贴费', amount: -subFee, runningTotal: curRev, pct: rev > 0 ? (subFee / rev) * 100 : 0, type: 'deduction' }); }
  if (penalty > 0) { items.push({ step: 11, label: '罚款扣款', amount: -penalty, runningTotal: curRev, pct: rev > 0 ? (penalty / rev) * 100 : 0, type: 'deduction' }); }
  const totalDeductions = discount + refundAmt + promoCost + prodCost + pfo + sfo + ic + techFee + subFee + penalty;
  const netProfit = rev - totalDeductions;
  items.push({ step: 99, label: '净利润', amount: netProfit, runningTotal: netProfit, pct: rev > 0 ? (netProfit / rev) * 100 : 0, type: 'profit' });
  return items;
}

// ===== 推广效率（含渠道/场景/归因/净指标/互动） =====
function computePromoEfficiencyV2(promoProducts: any[], starStoreSummary: any[], liveStreamSummary: any[], productId: string): any {
  const pidPromo = promoProducts.filter((p: any) => safeStr(p['商品ID'] || p['商品id'] || '') === productId);
  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const sumSM = (arr: any[], keys: string[]) => arr.reduce((s: number, x: any) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);
  // 汇总
  const cost = sumSM(pidPromo, ['成交花费(元)', '总花费(元)', '花费(元)']);
  const trans = sumSM(pidPromo, ['交易额(元)', '成交金额(元)']);
  const orders = Math.round(sum(pidPromo, '成交笔数'));
  const clicks = sum(pidPromo, '点击量');
  const imps = sum(pidPromo, '曝光量');
  // 场景细分
  const scenes: Record<string, { cost: number; trans: number; orders: number; clicks: number; imps: number }> = {};
  pidPromo.forEach((p: any) => {
    const scene = safeStr(p['推广场景'] || '其他');
    if (!scenes[scene]) scenes[scene] = { cost: 0, trans: 0, orders: 0, clicks: 0, imps: 0 };
    scenes[scene].cost += safeNum(p['成交花费(元)'] || p['总花费(元)'] || p['花费(元)'] || 0);
    scenes[scene].trans += safeNum(p['交易额(元)'] || p['成交金额(元)'] || 0);
    scenes[scene].orders += safeNum(p['成交笔数'] || 0);
    scenes[scene].clicks += safeNum(p['点击量'] || 0);
    scenes[scene].imps += safeNum(p['曝光量'] || 0);
  });
  const byScene = Object.entries(scenes).map(([scene, d]) => ({
    scene, cost: d.cost, transaction: d.trans, orders: d.orders, clicks: d.clicks, impressions: d.imps,
    roi: d.cost > 0 ? d.trans / d.cost : 0,
    ratio: cost > 0 ? (d.cost / cost) * 100 : 0,
  })).sort((a, b) => b.cost - a.cost);
  // 直接/间接归因
  const directTrans = sum(pidPromo, '直接交易额(元)');
  const indirectTrans = sum(pidPromo, '间接交易额(元)');
  const directOrders = Math.round(sum(pidPromo, '直接成交笔数'));
  const indirectOrders = Math.round(sum(pidPromo, '间接成交笔数'));
  // 净指标
  const netTrans = sum(pidPromo, '净交易额(元)');
  const netOrders = Math.round(sum(pidPromo, '净成交笔数'));
  const netRoi = cost > 0 && netTrans > 0 ? netTrans / cost : 0;
  const refundExemptRate = pidPromo.reduce((s: number, p: any) => s + safeNum(p['退款豁免率'] || 0), 0) / Math.max(1, pidPromo.length);
  // 互动指标
  const inquiries = Math.round(sum(pidPromo, '询单量'));
  const favorites = Math.round(sum(pidPromo, '收藏量'));
  const follows = Math.round(sum(pidPromo, '关注量'));
  return {
    summary: { cost, transaction: trans, orders, roi: cost > 0 ? trans / cost : 0, clicks, impressions: imps, ctr: imps > 0 ? (clicks / imps) * 100 : 0, cvr: clicks > 0 ? (orders / clicks) * 100 : 0 },
    byScene,
    directIndirect: { directTrans, indirectTrans, directOrders, indirectOrders, directRatio: trans > 0 ? (directTrans / trans) * 100 : 0 },
    netMetrics: { netTrans, netOrders, netRoi, refundExemptRate },
    interaction: { inquiries, avgInquiryCost: inquiries > 0 ? cost / inquiries : 0, favorites, avgFavoriteCost: favorites > 0 ? cost / favorites : 0, follows, avgFollowCost: follows > 0 ? cost / follows : 0 },
  };
}

// ===== 售后分析V2（含原因/类型/时间窗口） =====
function computeRefundAnalysisV2(afterSaleRecords: any[], orders: any[], productId: string): any {
  const as = afterSaleRecords.filter((r: any) => safeStr(r['商品ID'] || r['商品id'] || '') === productId);
  const sumAmt = (arr: any[]) => arr.reduce((s: number, r: any) => s + safeNum(r['退款金额(元)'] || r['买家退款金额']), 0);
  const totalCount = as.length;
  const totalAmount = sumAmt(as);
  // 原因分布
  const reasons: Record<string, { count: number; amount: number }> = {};
  as.forEach((r: any) => {
    const reason = safeStr(r['退款原因'] || r['售后原因'] || '其他');
    if (!reasons[reason]) reasons[reason] = { count: 0, amount: 0 };
    reasons[reason].count += 1;
    reasons[reason].amount += safeNum(r['退款金额(元)'] || r['买家退款金额']);
  });
  const byReason = Object.entries(reasons).map(([reason, d]) => ({ reason, count: d.count, ratio: totalCount > 0 ? (d.count / totalCount) * 100 : 0, amount: d.amount })).sort((a, b) => b.count - a.count);
  // 类型分布
  const types: Record<string, { count: number; amount: number }> = {};
  as.forEach((r: any) => {
    const type = safeStr(r['退款类型'] || r['售后类型'] || '其他');
    if (!types[type]) types[type] = { count: 0, amount: 0 };
    types[type].count += 1;
    types[type].amount += safeNum(r['退款金额(元)'] || r['买家退款金额']);
  });
  const byType = Object.entries(types).map(([type, d]) => ({ type, count: d.count, ratio: totalCount > 0 ? (d.count / totalCount) * 100 : 0, amount: d.amount })).sort((a, b) => b.count - a.count);
  // 已收货退款（退货退款中已签收的）
  const receivedRefund = { count: byType.filter(t => t.type.includes('退货') || t.type.includes('已收货')).reduce((s, t) => s + t.count, 0), amount: byType.filter(t => t.type.includes('退货') || t.type.includes('已收货')).reduce((s, t) => s + t.amount, 0) };
  // 时间窗口分布
  const wins: Record<string, { count: number; amount: number }> = { '0-7天': { count: 0, amount: 0 }, '8-14天': { count: 0, amount: 0 }, '15-30天': { count: 0, amount: 0 }, '30天以上': { count: 0, amount: 0 } };
  as.forEach((r: any) => {
    const order = orders.find((o: any) => safeStr(o['订单号']) === getOrderNo(r));
    if (!order) return;
    const payDate = new Date((order['支付时间'] || '').split(' ')[0]);
    const applyDate = new Date((r['申请时间'] || '').split(' ')[0]);
    if (isNaN(payDate.getTime()) || isNaN(applyDate.getTime())) return;
    const days = Math.floor((applyDate.getTime() - payDate.getTime()) / 86400000);
    const amt = safeNum(r['退款金额(元)'] || r['买家退款金额']);
    if (days <= 7) { wins['0-7天'].count += 1; wins['0-7天'].amount += amt; }
    else if (days <= 14) { wins['8-14天'].count += 1; wins['8-14天'].amount += amt; }
    else if (days <= 30) { wins['15-30天'].count += 1; wins['15-30天'].amount += amt; }
    else { wins['30天以上'].count += 1; wins['30天以上'].amount += amt; }
  });
  const byTimeWindow = Object.entries(wins).map(([window, d]) => ({ window, count: d.count, ratio: totalCount > 0 ? (d.count / totalCount) * 100 : 0, amount: d.amount }));
  return { summary: { totalCount, totalAmount }, byReason, byType, receivedRefund, byTimeWindow };
}

// ===== SKU明细V2 =====
function computeSkuMatrixV2(orders: any[], productId: string): any[] {
  const sm: Record<string, any> = {};
  orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId).forEach((o: any) => {
    const skuId = safeStr(o['商品规格ID'] || o['sku_id'] || o['SKU ID'] || 'default');
    if (!sm[skuId]) sm[skuId] = { skuId, skuName: safeStr(o['商品规格'] || skuId), sales: 0, gmv: 0, orderNos: new Set<string>() };
    sm[skuId].sales += safeNum(o['商品数量(件)']);
    sm[skuId].gmv += safeNum(o['商品总价(元)']);
    sm[skuId].orderNos.add(safeStr(o['订单号']));
  });
  const ts = Object.values(sm).reduce((s: number, sk: any) => s + sk.sales, 0);
  return Object.values(sm).map((sk: any) => ({
    skuId: sk.skuId, skuName: sk.skuName,
    sales: sk.sales, salesRatio: ts > 0 ? (sk.sales / ts) * 100 : 0,
    gmv: sk.gmv, avgPrice: sk.sales > 0 ? sk.gmv / sk.sales : 0,
    orders: sk.orderNos.size,
    isMainSku: ts > 0 && sk.sales / ts > 0.3,
  })).sort((a: any, b: any) => b.sales - a.sales);
}

// ===== 每日趋势（按商品过滤） =====
function computeDailyTrendForProduct(orders: any[], afterSaleRecords: any[], productId: string): any[] {
  const dayMap: Record<string, { gmv: number; revenue: number; sales: number; orders: number; refund: number }> = {};
  const pidOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  const refundOrderNos = new Set(afterSaleRecords.filter((r: any) => getAfterSaleStatus(r) === '退款成功').map((r: any) => getOrderNo(r)));
  pidOrders.forEach((o: any) => {
    const d = (o['支付时间'] || '').split(' ')[0];
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!dayMap[d]) dayMap[d] = { gmv: 0, revenue: 0, sales: 0, orders: 0, refund: 0 };
    dayMap[d].gmv += safeNum(o['商品总价(元)']);
    dayMap[d].revenue += safeNum(o['商家实收金额(元)']);
    dayMap[d].sales += safeNum(o['商品数量(件)']);
    dayMap[d].orders += 1;
    if (refundOrderNos.has(safeStr(o['订单号']))) {
      dayMap[d].refund += safeNum(o['商家实收金额(元)']);
    }
  });
  return Object.entries(dayMap).map(([date, v]) => ({ date, ...v })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

// ===== 直播间vs非直播 =====
function computeLiveBreakdown(orders: any[], productId: string): any {
  const pidOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  let liveGmv = 0, liveOrders = 0, liveSales = 0;
  let nonLiveGmv = 0, nonLiveOrders = 0, nonLiveSales = 0;
  pidOrders.forEach((o: any) => {
    const isLive = String(o['是否直播间成交'] || '').trim() === '是';
    const gmv = safeNum(o['商品总价(元)']);
    const sales = safeNum(o['商品数量(件)']);
    if (isLive) { liveGmv += gmv; liveOrders += 1; liveSales += sales; }
    else { nonLiveGmv += gmv; nonLiveOrders += 1; nonLiveSales += sales; }
  });
  const total = liveGmv + nonLiveGmv;
  return { liveGmv, liveOrders, liveSales, nonLiveGmv, nonLiveOrders, nonLiveSales, liveRatio: total > 0 ? (liveGmv / total) * 100 : 0 };
}

// ===== 物流分析V2 =====
function computeLogisticsV2(orders: any[], productId: string): any {
  const pidOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  const couriers: Record<string, number> = {};
  let shipped = 0, totalHours = 0, lateCount = 0;
  pidOrders.forEach((o: any) => {
    const courier = safeStr(o['快递公司'] || '').trim();
    if (courier) couriers[courier] = (couriers[courier] || 0) + 1;
    const pt = new Date(o['支付时间'] || '');
    const st = new Date(o['发货时间'] || '');
    if (!isNaN(st.getTime()) && safeStr(o['发货时间'] || '').trim() !== '') {
      shipped++;
      const h = (st.getTime() - pt.getTime()) / 3600000;
      if (h >= 0) totalHours += h;
      if (h > 48) lateCount++;
    }
  });
  const courierDistribution = Object.entries(couriers).map(([name, count]) => ({ name, count, ratio: pidOrders.length > 0 ? (count / pidOrders.length) * 100 : 0 })).sort((a, b) => b.count - a.count);
  return { courierDistribution, shippedOrders: shipped, avgShipHours: shipped > 0 ? totalHours / shipped : 0, lateCount, totalOrders: pidOrders.length };
}

// ===== 买家指标 =====
function computeBuyerMetrics(orders: any[], productId: string): any {
  const pidOrders = orders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  const buyerMap: Record<string, { orders: number; gmv: number }> = {};
  pidOrders.forEach((o: any) => {
    const orderNo = safeStr(o['订单号'] || '');
    const buyerId = orderNo.slice(-4);
    if (!buyerMap[buyerId]) buyerMap[buyerId] = { orders: 0, gmv: 0 };
    buyerMap[buyerId].orders += 1;
    buyerMap[buyerId].gmv += safeNum(o['商品总价(元)']);
  });
  const buyers = Object.values(buyerMap);
  const uniqueBuyers = buyers.length;
  const repeatBuyers = buyers.filter((b: any) => b.orders >= 2).length;
  const totalGmv = buyers.reduce((s: number, b: any) => s + b.gmv, 0);
  return { uniqueBuyers, repeatBuyers, repeatRate: uniqueBuyers > 0 ? (repeatBuyers / uniqueBuyers) * 100 : 0, avgPerBuyer: uniqueBuyers > 0 ? totalGmv / uniqueBuyers : 0, avgOrdersPerBuyer: uniqueBuyers > 0 ? pidOrders.length / uniqueBuyers : 0 };
}

// ===== 时间过滤辅助函数 =====
function filterOrdersByTime(orders: any[], timeRange: string, customStart?: string, customEnd?: string): any[] {
  if (!orders.length || timeRange === 'all') return orders;
  const allDates = orders.map((o: any) => (o['支付时间'] || '').split(' ')[0]).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!allDates.length) return orders;
  const maxDate = allDates[allDates.length - 1];
  if (timeRange === 'custom' && customStart && customEnd) {
    return orders.filter((o: any) => { const d = (o['支付时间'] || '').split(' ')[0]; return d >= customStart && d <= customEnd; });
  }
  const days = parseInt(timeRange) || 30;
  const max = new Date(maxDate);
  const start = new Date(max);
  start.setDate(start.getDate() - days + 1);
  const startStr = start.toISOString().split('T')[0];
  return orders.filter((o: any) => { const d = (o['支付时间'] || '').split(' ')[0]; return d >= startStr && d <= maxDate; });
}

function filterRecordsByDate(records: any[], dateField: string, timeRange: string, customStart?: string, customEnd?: string): any[] {
  if (!records.length || timeRange === 'all') return records;
  const allDates = records.map((r: any) => (r[dateField] || '').split(' ')[0]).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  if (!allDates.length) return records;
  const maxDate = allDates[allDates.length - 1];
  if (timeRange === 'custom' && customStart && customEnd) {
    return records.filter((r: any) => { const d = (r[dateField] || '').split(' ')[0]; return d >= customStart && d <= customEnd; });
  }
  const days = parseInt(timeRange) || 30;
  const max = new Date(maxDate);
  const start = new Date(max);
  start.setDate(start.getDate() - days + 1);
  const startStr = start.toISOString().split('T')[0];
  return records.filter((r: any) => { const d = (r[dateField] || '').split(' ')[0]; return d >= startStr && d <= maxDate; });
}

// ===== 商品复盘主函数 =====
export async function computeProductRetrospective(
  data: Record<string, any[]>,
  productCosts: Record<string, number>,
  configs: Record<string, any>,
  productId: string,
  timeRange: string,
  customStart?: string,
  customEnd?: string,
  compareWindow?: number,
): Promise<any> {
  const wDays = compareWindow || 7;
  // 1. 时间过滤 + 状态过滤（排除待付款等无效订单）
  const orders = filterValidOrders(filterOrdersByTime(data.orders || [], timeRange, customStart, customEnd));
  const promoProducts = filterRecordsByDate(data.promotionProducts || [], '日期', timeRange, customStart, customEnd);
  const afterSaleRecords = filterRecordsByDate(data.afterSaleRecords || [], '申请时间', timeRange, customStart, customEnd);
  const shippingInsurance = filterRecordsByDate(data.shippingInsurance || [], '日期', timeRange, customStart, customEnd);
  const financialRecords = filterRecordsByDate(data.financialRecords || [], '发生时间', timeRange, customStart, customEnd);
  const starStore = filterRecordsByDate(data.starStoreSummary || [], '日期', timeRange, customStart, customEnd);
  const liveStream = filterRecordsByDate(data.liveStreamSummary || [], '日期', timeRange, customStart, customEnd);

  // 2. 商品快照（全量数据，不过滤）
  const allOrders = data.orders || [];
  const pidAllOrders = allOrders.filter((o: any) => safeStr(o['商品ID'] || o['商品id'] || '') === productId);
  const allDates = pidAllOrders.map((o: any) => (o['支付时间'] || '').split(' ')[0]).filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const totalSales = pidAllOrders.reduce((s: number, o: any) => s + safeNum(o['商品数量(件)']), 0);
  const totalGmv = pidAllOrders.reduce((s: number, o: any) => s + safeNum(o['商品总价(元)']), 0);
  const totalRevenue = pidAllOrders.reduce((s: number, o: any) => s + safeNum(o['商家实收金额(元)']), 0);
  const uniqueOrders = new Set(pidAllOrders.map((o: any) => safeStr(o['订单号'])).filter(Boolean));
  const firstOrderDate = allDates[0] || '';
  const lastOrderDate = allDates[allDates.length - 1] || '';
  const activeDays = allDates.length > 1 ? Math.ceil((new Date(lastOrderDate).getTime() - new Date(firstOrderDate).getTime()) / 86400000) + 1 : allDates.length;
  const snapshot = {
    productName: pidAllOrders[0] ? safeStr(pidAllOrders[0]['商品名称'] || pidAllOrders[0]['商品'] || productId) : productId,
    productId, firstOrderDate, lastOrderDate, activeDays,
    totalSales, totalOrders: uniqueOrders.size, totalGmv, totalRevenue,
    avgOrderValue: uniqueOrders.size > 0 ? totalGmv / uniqueOrders.size : 0,
    avgDailySales: activeDays > 0 ? totalSales / activeDays : 0,
  };

  // 安全执行辅助：单个模块失败不影响其他模块
  const safe = <T>(fn: () => T, fallback: T): T => { try { return fn(); } catch (e: any) { console.warn('[retrospective] sub-computation error:', e.message); return fallback; } };

  // 3. 价格变更检测 + 前后对比
  const priceImpacts = safe(() => {
    const priceChanges = detectPriceChanges(orders, productId);
    return priceChanges.map((change: any) =>
      computeSinglePriceImpact(
        orders, promoProducts, afterSaleRecords,
        financialRecords, shippingInsurance,
        productCosts, configs, productId, change, wDays
      )
    );
  }, []);

  // 4. 利润拆解（时间过滤后的数据）
  const profitWaterfall = safe(() => computeProfitWaterfall(
    orders, promoProducts, afterSaleRecords,
    financialRecords, shippingInsurance,
    productCosts, configs, productId
  ), []);

  // 5. 推广效率
  const promoEfficiency = safe(() => computePromoEfficiencyV2(promoProducts, starStore, liveStream, productId), { summary: { cost: 0, transaction: 0, orders: 0, roi: 0, clicks: 0, impressions: 0, ctr: 0, cvr: 0 }, byScene: [], directIndirect: { directTrans: 0, indirectTrans: 0, directOrders: 0, indirectOrders: 0, directRatio: 0 }, netMetrics: { netTrans: 0, netOrders: 0, netRoi: 0, refundExemptRate: 0 }, interaction: { inquiries: 0, avgInquiryCost: 0, favorites: 0, avgFavoriteCost: 0, follows: 0, avgFollowCost: 0 } });

  // 6. 售后分析
  const refundAnalysis = safe(() => computeRefundAnalysisV2(afterSaleRecords, orders, productId), { summary: { totalCount: 0, totalAmount: 0 }, byReason: [], byType: [], receivedRefund: { count: 0, amount: 0 }, byTimeWindow: [] });

  // 7. SKU明细
  const skuMatrix = safe(() => computeSkuMatrixV2(orders, productId), []);

  // 8. 每日趋势
  const dailyTrend = safe(() => computeDailyTrendForProduct(orders, afterSaleRecords, productId), []);

  // 9. 直播vs非直播
  const liveBreakdown = safe(() => computeLiveBreakdown(orders, productId), { liveGmv: 0, liveOrders: 0, liveSales: 0, nonLiveGmv: 0, nonLiveOrders: 0, nonLiveSales: 0, liveRatio: 0 });

  // 10. 物流
  const logistics = safe(() => computeLogisticsV2(orders, productId), { courierDistribution: [], shippedOrders: 0, avgShipHours: 0, lateCount: 0, totalOrders: 0 });

  // 11. 买家指标
  const buyerMetrics = safe(() => computeBuyerMetrics(orders, productId), { uniqueBuyers: 0, repeatBuyers: 0, repeatRate: 0, avgPerBuyer: 0, avgOrdersPerBuyer: 0 });

  return {
    snapshot,
    priceChanges: priceImpacts,
    profitWaterfall,
    promoEfficiency,
    refundAnalysis,
    skuMatrix,
    dailyTrend,
    liveBreakdown,
    logistics,
    buyerMetrics,
  };
}

export default { loadStoreData, loadStoreConfigs, computeAllProductStats, computeDeepAnalysis, computeDashboardKPI, computeProductsList, computePromotionStats, computeAfterSaleStats, computeLogisticsSummary, computeDailyTrends, computeRegionDistribution, computeFinancialSummary, computePeriodCompare, computePromoByDate, computeShipTimeDistribution, computeCostSummary, cachedLoadStoreData, cachedLoadAllStoresData, cachedLoadAllStoresConfigs, loadProductCosts, resolveStoreContext, detectPriceChanges, computeSinglePriceImpact, computeProfitWaterfall, computePromoEfficiencyV2, computeRefundAnalysisV2, computeSkuMatrixV2, computeDailyTrendForProduct, computeLiveBreakdown, computeLogisticsV2, computeBuyerMetrics, computeProductRetrospective };

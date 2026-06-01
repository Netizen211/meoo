
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
export async function loadStoreData(storeId: string): Promise<Record<string, any[]>> {
  const rows = await db('store_data').where('store_id', storeId);
  const data: Record<string, any[]> = {};
  for (const row of rows) {
    try { data[row.category] = JSON.parse(row.payload_json); }
    catch { data[row.category] = []; }
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

// ★ 全店聚合：加载用户所有店铺数据并合并
export async function loadAllUserStoreData(userId: string): Promise<Record<string, any[]>> {
  const storeRows = await db('stores').where('user_id', userId).select('id');
  const storeIds = storeRows.map((s: any) => s.id);
  if (!storeIds.length) return { orders: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], afterSaleRecords: [], shippingInsurance: [], financialRecords: [] };

  const allRows = await db('store_data').whereIn('store_id', storeIds);
  const merged: Record<string, any[]> = {};
  for (const row of allRows) {
    try {
      const parsed = JSON.parse(row.payload_json);
      if (Array.isArray(parsed)) {
        merged[row.category] = [...(merged[row.category] || []), ...parsed];
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
  orders: any[], promoProducts: any[],
  starStoreSummary: any[], liveStreamSummary: any[],
  afterSaleRecords: any[],
  productCosts: Record<string, number>,
  costConfigs: Record<string, any>
): Record<string, any> {
  const stats: Record<string, any> = {};
  const productNames: Record<string, string> = {};
  const productCodes: Record<string, string> = {};
  const orderDetails: Record<string, any> = {};
  const dailySalesMap: Record<string, Record<string, any>> = {};
  const skuSalesMap: Record<string, Record<string, number>> = {};
  const orderRefundMap = new Map<string, number>();
  // ★ 单次遍历同时构建 date-GMV 映射（原为独立遍历）
  const dgm: Record<string, { pid: string; gmv: number }[]> = {};

  // ★ Pass 1: 单次遍历订单 — 统计 + 日销售 + SKU + 详情 + date-GMV
  orders.forEach((o: any) => {
    const pid = safeStr(o['商品ID'] || o['商品id'] || '');
    if (!pid || pid === '-') return;
    const name = safeStr(o['商品名称'] || '');
    const code = safeStr(o['商家编码-商品维度'] || o['商家编码'] || '');
    if (name && !productNames[pid]) productNames[pid] = name;
    if (code && !productCodes[pid]) productCodes[pid] = code;
    if (!stats[pid]) stats[pid] = emptyStat(pid, name, code);
    const s = stats[pid];
    const gmv = safeNum(o['商品总价(元)']);
    const revenue = safeNum(o['商家实收金额(元)']);
    const refund = safeNum(o['退款金额(元)']);
    const disc = safeNum(o['店铺优惠折扣(元)']) + safeNum(o['平台优惠折扣(元)']) + safeNum(o['多多支付立减金额(元)']) + safeNum(o['拼多多优惠券(元)']);
    const qty = safeNum(o['商品数量(件)']);
    s.gmv += gmv; s.orders += 1; s.sales += qty;
    s.revenue += revenue; s.refund += refund; s.discount += disc;
    if (refund > 0) { s.refundCount += 1; const on = safeStr(o['订单号']); if (on) orderRefundMap.set(on + '_' + pid, refund); }
    s.hasOrderData = true;
    const dk = safeStr(o['支付时间'] || '').split(' ')[0];
    if (dk && /^\d{4}-\d{2}-\d{2}$/.test(dk)) {
      // 日销售
      if (!dailySalesMap[pid]) dailySalesMap[pid] = {};
      if (!dailySalesMap[pid][dk]) dailySalesMap[pid][dk] = { date: dk, sales: 0, gmv: 0, orders: 0 };
      dailySalesMap[pid][dk].sales += qty;
      dailySalesMap[pid][dk].gmv += gmv;
      dailySalesMap[pid][dk].orders += 1;
      // date-GMV 映射（原独立遍历）
      if (!dgm[dk]) dgm[dk] = [];
      dgm[dk].push({ pid, gmv });
    }
    const skuId = safeStr(o['商品规格ID'] || o['sku_id'] || o['SKU ID'] || '');
    if (skuId) { if (!skuSalesMap[pid]) skuSalesMap[pid] = {}; skuSalesMap[pid][skuId] = (skuSalesMap[pid][skuId] || 0) + qty; }
    if (!orderDetails[pid]) orderDetails[pid] = { dates: [], prices: [], orderNos: [] };
    orderDetails[pid].dates.push(safeStr(o['支付时间']));
    orderDetails[pid].prices.push(gmv / Math.max(1, qty));
    orderDetails[pid].orderNos.push(safeStr(o['订单号']));
  });

  // Pass 2: 售后数据
  afterSaleRecords.forEach((r: any) => {
    const pid = safeStr(r['商品ID'] || r['商品id'] || '');
    if (!pid) return;
    if (!stats[pid]) stats[pid] = emptyStat(pid, String(r['sku信息'] || '').split(',')[0] || pid, '');
    const s = stats[pid];
    s.afterSaleCount += 1;
    const ar = safeNum(r['退款金额(元)'] || r['买家退款金额'] || r['退款金额']);
    const on = safeStr(r['订单编号'] || '');
    if (on) { const ex = orderRefundMap.get(on + '_' + pid) || 0; s.refund += Math.max(0, ar - ex); }
    else { s.refund += ar; }
    const st = safeStr(r['售后状态'] || '未知');
    s.afterSaleBreakdown[st] = (s.afterSaleBreakdown[st] || 0) + 1;
  });

  // Pass 3: 商品推广数据
  promoProducts.forEach((p: any) => {
    const pid = safeStr(p['商品ID'] || p['商品id'] || p['商品编号'] || '');
    if (!pid || !stats[pid]) return;
    const s = stats[pid];
    const c = safeNum(p['成交花费(元)'] || p['总花费(元)'] || p['花费(元)']);
    const cl = safeNum(p['点击量']), im = safeNum(p['曝光量'] || p['展现量']);
    const ord = safeNum(p['成交笔数']), tr = safeNum(p['交易额(元)'] || p['成交金额(元)']);
    s.hasPromoData = true;
    s.promoCost += c; s.promoClicks += cl; s.promoImpressions += im;
    s.promoOrders += ord; s.promoTransaction += tr;
    s.promoSourceDetails.push({
      source: '商品推广', date: safeStr(p['日期']),
      cost: c, clicks: cl, impressions: im, orders: ord, transaction: tr,
      ctr: im > 0 ? (cl / im) * 100 : 0, cvr: cl > 0 ? (ord / cl) * 100 : 0,
      productName: safeStr(p['商品名称'] || ''),
    });
  });

  // ★ 计算 date-GMV 比率（原独立遍历，现用 Pass1 收集的 dgm）
  const dr: Record<string, { pid: string; ratio: number }[]> = {};
  Object.keys(dgm).forEach(dk => {
    const m: Record<string, number> = {};
    dgm[dk].forEach(i => { m[i.pid] = (m[i.pid] || 0) + i.gmv; });
    const t = Object.values(m).reduce((s, v) => s + v, 0);
    if (t > 0) dr[dk] = Object.entries(m).map(([pid, gmv]) => ({ pid, ratio: gmv / t }));
  });
  // ★ 合并明星店铺 + 直播推广分配为单次遍历
  const allocate = (rr: any[], cf: string, gf: string, of: string, src: string) => {
    rr.forEach((r: any) => {
      const dk = safeStr(r['日期'] || '').split(' ')[0];
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
    const pf = pfo * s.orders, sf = sfo * s.orders, insf = ifo * s.orders;
    const gp = s.revenue - s.promoCost - pf - sf - insf;
    const ptp = s.revenue - pc - s.promoCost - pf - sf - insf;
    s.roi = s.promoCost > 0 ? s.promoTransaction / s.promoCost : 0;
    s.refundRate = s.orders > 0 ? (s.refundCount / s.orders) * 100 : 0;
    s.avgOrderValue = s.orders > 0 ? s.gmv / s.orders : 0;
    s.afterSaleRate = s.orders > 0 ? (s.afterSaleCount / s.orders) * 100 : 0;
    s.ctr = s.promoImpressions > 0 ? (s.promoClicks / s.promoImpressions) * 100 : 0;
    s.cvr = s.promoClicks > 0 ? (s.promoOrders / s.promoClicks) * 100 : 0;
    s.discountRatio = s.gmv > 0 ? (s.discount / s.gmv) * 100 : 0;
    s.promoCostRatio = s.gmv > 0 ? (s.promoCost / s.gmv) * 100 : 0;
    s.profitRate = s.revenue > 0 ? (s.netProfit / s.revenue) * 100 : 0;
    s.totalCost = pc + pf + sf + insf + s.promoCost;
    s.netProfit = ptp; s.grossProfit = gp; s.preTaxProfit = ptp; s.netProfitAfterTax = ptp;
    s.costBreakdown = { productCost: pc, packagingFee: pf, shippingFee: sf, promoCost: s.promoCost, discount: s.discount, platformFee: 0, insuranceFee: insf, penaltyFee: 0, marketingFee: 0, taxes: 0, customDeductions: 0 };
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
      s.turnoverDays = s.avgDailySales > 0 ? s.sales / s.avgDailySales : 0;
      s.sellThroughRate = s.activeDays > 0 ? (s.sales / s.activeDays) * 100 : 0;
    }
    if (det && det.prices.length > 0) s.priceDistribution = buildBuckets(det.prices);
  });
  return stats;
}


export function computeDashboardKPI(data: Record<string, any[]>): any {
  const orders: any[] = data.orders || [];
  const promo: any[] = data.promotionProducts || [];
  const starStore: any[] = data.starStoreSummary || [];
  const liveStream: any[] = data.liveStreamSummary || [];
  const afterSale: any[] = data.afterSaleRecords || [];
  const insurance: any[] = data.shippingInsurance || [];
  const financial: any[] = data.financialRecords || [];
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + safeNum(x[key]), 0);
  const sm = (arr: any[], keys: string[]) => arr.reduce((s, x) => { for (const k of keys) { const v = safeNum(x[k]); if (v !== 0 || x[k] !== undefined) return s + v; } return s; }, 0);
  const totalGmv = sum(orders, '商品总价(元)');
  const totalRevenue = sum(orders, '商家实收金额(元)');
  const totalPaid = sum(orders, '用户实付金额(元)');
  const totalRefund = sum(orders, '退款金额(元)');
  const refundOrders = orders.filter(o => safeNum(o['退款金额(元)']) > 0);
  const totalDiscount = sum(orders, '店铺优惠折扣(元)') + sum(orders, '平台优惠折扣(元)') + sum(orders, '多多支付立减金额(元)') + sum(orders, '拼多多优惠券(元)');
  const platformFee = sum(orders, '平台技术服务费(元)');
  const promoCost = sm(promo, ['成交花费(元)', '总花费(元)', '花费(元)']);
  const promoGmv = sm(promo, ['交易额(元)', '成交金额(元)']);
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
  const asRefund = sm(afterSale, ['退款金额(元)', '买家退款金额', '退款金额']);
  const insFee = sm(insurance, ['服务费用（元）', '服务费用(元)', '保费（元）', '保费(元)']);
  const penalties = financial.filter(f => String(f['业务描述'] || '').startsWith('004')).reduce((s, f) => s + Math.abs(safeNum(f['支出金额（-元）'] || f['支出金额(元)'] || '0')), 0);
  const rfp = asRefund > 0 ? asRefund : totalRefund;
  const profit = totalRevenue - rfp - totalPromoCost - insFee - penalties;
  const profitRate = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
  const avgOrder = orders.length > 0 ? totalRevenue / orders.length : 0;
  const shipped = orders.filter(o => { const v = o['发货时间']; return v != null && String(v).trim() !== ''; });
  const avgShipH = shipped.length > 0 ? shipped.reduce((s, o) => { const pt = new Date(String(o['支付时间'] || '')); const st = new Date(String(o['发货时间'] || '')); return s + (isNaN(st.getTime()) || isNaN(pt.getTime()) ? 0 : (st.getTime() - pt.getTime()) / 3600000); }, 0) / shipped.length : 0;
  const conv = orders.length > 0 ? (shipped.length / orders.length) * 100 : 0;
  const orgOrd = Math.max(0, orders.length - totalPromoOrders);
  const orgGmv = Math.max(0, totalGmv - totalPromoGmv);
  const statusMap: Record<string, number> = {};
  orders.forEach(o => { const s = String(o['订单状态'] || ''); statusMap[s] = (statusMap[s] || 0) + 1; });
  const provMap: Record<string, number> = {};
  orders.forEach(o => { const p = String(o['省'] || '').trim(); if (p) provMap[p] = (provMap[p] || 0) + 1; });
  return {
    kpi: { gmv: totalGmv, revenue: totalRevenue, paid: totalPaid, refund: totalRefund, orders: orders.length, refundOrders: refundOrders.length, refundRate: orders.length > 0 ? (refundOrders.length / orders.length) * 100 : 0, afterSaleRate: orders.length > 0 ? (afterSale.length / orders.length) * 100 : 0, afterSaleRefundAmount: asRefund, avgOrder, discount: totalDiscount, platformFee, profit, profitRate, postage: 0, conversionRate: conv, avgShipHours: avgShipH, organicOrders: orgOrd, organicGmv: orgGmv, products: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || '')).filter(Boolean)).size, promoCost: totalPromoCost, promoGmv: totalPromoGmv, promoROI: totalPromoCost > 0 ? totalPromoGmv / totalPromoCost : 0, promoOrders: totalPromoOrders, promoBreakdown: { product: { cost: promoCost, gmv: promoGmv, orders: promoOrders }, star: { cost: starCost, gmv: starGmv, orders: starOrders }, live: { cost: liveCost, gmv: liveGmv, orders: liveOrders } }, promoRatio: totalGmv > 0 ? (totalPromoCost / totalGmv) * 100 : 0, ctr: sum(promo, '点击量') / Math.max(1, sum(promo, '曝光量')) * 100, cvr: sum(promo, '成交笔数') / Math.max(1, sum(promo, '点击量')) * 100, insuranceFee: insFee, penalties, buyers: new Set(orders.map(o => String(o['订单号'] || '').trim()).filter(Boolean)).size, productCount: new Set(orders.map(o => String(o['商品ID'] || o['商品id'] || '').trim()).filter(id => id && id !== '-')).size },
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
    const days = Math.floor((Date.now() - new Date(safeStr(o['支付时间'] || '')).getTime()) / 86400000);
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
  orders: any[], promoProducts: any[], afterSaleRecords: any[],
  productCosts: Record<string, number>,
  prevStats?: Record<string, any>
): any {
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
    const h = new Date(safeStr(o['支付时间'] || '')).getHours();
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
    const orders: any[] = data.orders || [];
    const promo: any[] = data.promotionProducts || [];
    const costsStr = (await db('store_configs').where({ store_id: storeId, config_key: 'dianfx_product_costs_' + storeId }).first())?.payload_json;
    const costs: Record<string, number> = costsStr ? JSON.parse(costsStr) : {};

    const byPid: Record<string, any> = {};
    orders.forEach(o => {
      const pid = safeStr(o['商品ID'] || o['商品id'] || '');
      if (!byPid[pid]) byPid[pid] = { orders: [], gmv: 0, revenue: 0, refund: 0, refundCnt: 0, name: safeStr(o['商品名称'] || pid) };
      byPid[pid].orders.push(o);
      byPid[pid].gmv += safeNum(o['商品总价(元)']);
      byPid[pid].revenue += safeNum(o['商家实收金额(元)']);
      byPid[pid].refund += safeNum(o['退款金额(元)']);
      if (safeNum(o['退款金额(元)']) > 0) byPid[pid].refundCnt++;
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
      return {
        id: pid, name: pr.name, orders: pr.orders.length, gmv: pr.gmv,
        revenue: pr.revenue, refund: pr.refund,
        refundRate: pr.orders.length > 0 ? (pr.refundCnt / pr.orders.length) * 100 : 0,
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
  const orders: any[] = data.orders || [];
  const sum = (arr: any[], key: string) => arr.reduce((s, x) => s + safeNum(x[key]), 0);

  const reasons: Record<string, number> = {};
  as.forEach(r => {
    const reason = safeStr(r['退款原因'] || r['售后原因'] || '其他');
    reasons[reason] = (reasons[reason] || 0) + 1;
  });

  return {
    total: as.length,
    refundAmount: sum(as, '退款金额(元)'),
    asRate: orders.length > 0 ? (as.length / orders.length) * 100 : 0,
    reasons: Object.entries(reasons).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ name: k, count: v })),
  };
}

// ===== 物流汇总 =====

export function computeLogisticsSummary(orders: any[]): any {
  const shipHours: number[] = [];
  orders.forEach(o => {
    const pt = new Date(safeStr(o['支付时间'] || ''));
    const st = new Date(safeStr(o['发货时间'] || ''));
    if (!isNaN(pt.getTime()) && !isNaN(st.getTime())) {
      shipHours.push((st.getTime() - pt.getTime()) / 3600000);
    }
  });
  return {
    totalOrders: orders.length,
    shippedOrders: orders.filter(o => safeStr(o['发货时间'] || '')).length,
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
export function computeDailyTrends(orders: any[], afterSaleRecords: any[]): any {
  const dailyMap: Record<string, { gmv: number; orders: number; revenue: number; refund: number; refundCount: number }> = {};
  orders.forEach((o: any) => {
    const d = safeStr(o['支付时间'] || '').split(' ')[0];
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
    if (!dailyMap[d]) dailyMap[d] = { gmv: 0, orders: 0, revenue: 0, refund: 0, refundCount: 0 };
    dailyMap[d].gmv += safeNum(o['商品总价(元)']);
    dailyMap[d].revenue += safeNum(o['商家实收金额(元)']);
    dailyMap[d].orders += 1;
    if (safeNum(o['退款金额(元)']) > 0) { dailyMap[d].refund += safeNum(o['退款金额(元)']); dailyMap[d].refundCount += 1; }
  });
  return Object.entries(dailyMap).map(([date, v]) => ({ date, ...v })).sort((a: any, b: any) => a.date.localeCompare(b.date));
}

// ===== 新增: 地区分布 =====
export function computeRegionDistribution(orders: any[]): any {
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
      buyerSet.get(prov)!.add(orderNo);
    }
  });
  return Object.entries(provMap).map(([prov, v]) => ({
    province: prov, orders: v.orders, gmv: v.gmv,
    buyers: buyerSet.get(prov)?.size || 0,
  })).sort((a: any, b: any) => b.gmv - a.gmv);
}

// ===== 新增: 财务汇总 =====
export function computeFinancialSummary(financialRecords: any[], orders: any[]): any {
  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const income = financialRecords.filter((f: any) => safeNum(f['收入金额（+元）'] || f['收入金额(+元)'] || '0') > 0);
  const expense = financialRecords.filter((f: any) => safeNum(f['支出金额（-元）'] || f['支出金额(-元)'] || '0') > 0);
  return {
    totalIncome: sum(income, '收入金额（+元）') || sum(income, '收入金额(+元)'),
    totalExpense: sum(expense, '支出金额（-元）') || sum(expense, '支出金额(-元)'),
    incomeCount: income.length,
    expenseCount: expense.length,
    totalRecords: financialRecords.length,
    orderRevenue: orders.reduce((s: number, o: any) => s + safeNum(o['商家实收金额(元)']), 0),
  };
}

// ===== 新增: 周期对比 (环比) =====
export function computePeriodCompare(orders: any[], promoProducts: any[], afterSaleRecords: any[], compareDays: number = 7): any {
  if (!orders.length) return { current: null, previous: null, changes: {} };
  const now = new Date();
  const cutoff = new Date(now.getTime() - compareDays * 86400000);
  const prevCutoff = new Date(cutoff.getTime() - compareDays * 86400000);

  const currentOrders = orders.filter((o: any) => {
    const d = new Date(safeStr(o['支付时间'] || '').split(' ')[0]);
    return d >= cutoff && !isNaN(d.getTime());
  });
  const prevOrders = orders.filter((o: any) => {
    const d = new Date(safeStr(o['支付时间'] || '').split(' ')[0]);
    return d >= prevCutoff && d < cutoff && !isNaN(d.getTime());
  });

  const sum = (arr: any[], key: string) => arr.reduce((s: number, x: any) => s + safeNum(x[key]), 0);
  const curGmv = sum(currentOrders, '商品总价(元)');
  const curRev = sum(currentOrders, '商家实收金额(元)');
  const prevGmv = sum(prevOrders, '商品总价(元)');
  const prevRev = sum(prevOrders, '商家实收金额(元)');

  const chg = (cur: number, prev: number) => prev > 0 ? ((cur - prev) / prev * 100) : (cur > 0 ? 100 : 0);

  return {
    current: { orders: currentOrders.length, gmv: curGmv, revenue: curRev },
    previous: { orders: prevOrders.length, gmv: prevGmv, revenue: prevRev },
    changes: {
      orders: chg(currentOrders.length, prevOrders.length),
      gmv: chg(curGmv, prevGmv),
      revenue: chg(curRev, prevRev),
    },
  };
}

// ===== 新增: 推广按日汇总 =====
export function computePromoByDate(promoProducts: any[], starStoreSummary: any[], liveStreamSummary: any[]): any {
  const dateMap: Record<string, { cost: number; gmv: number; orders: number; impressions: number; clicks: number }> = {};
  const sm = (arr: any[], cf: string, gf: string, of: string) => {
    arr.forEach((r: any) => {
      const d = safeStr(r['日期'] || '').split(' ')[0];
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
export function computeShipTimeDistribution(orders: any[]): any {
  const buckets: Record<string, number> = { '<24h': 0, '24-48h': 0, '48-72h': 0, '>72h': 0, '未发货': 0 };
  let shipped = 0, totalHours = 0;
  orders.forEach((o: any) => {
    const pt = new Date(safeStr(o['支付时间'] || ''));
    const st = new Date(safeStr(o['发货时间'] || ''));
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

// ===== 新增: 成本汇总 =====
export function computeCostSummary(orders: any[], productCosts: Record<string, number>, configs: Record<string, any>): any {
  const pfo = safeNum(configs['dianfx_packaging_fee'] || 3);
  const sfo = safeNum(configs['dianfx_shipping_fee'] || 5);
  const ifo = safeNum(configs['dianfx_insurance_fee'] || 2);
  let totalProductCost = 0;
  orders.forEach((o: any) => {
    const pid = safeStr(o['商品ID'] || o['商品id'] || '');
    const qty = safeNum(o['商品数量(件)']);
    if (pid && productCosts[pid]) totalProductCost += productCosts[pid] * qty;
  });
  const totalPackaging = pfo * orders.length;
  const totalShipping = sfo * orders.length;
  const totalInsurance = ifo * orders.length;
  return {
    productCost: totalProductCost,
    packagingFee: totalPackaging,
    shippingFee: totalShipping,
    insuranceFee: totalInsurance,
    totalCost: totalProductCost + totalPackaging + totalShipping + totalInsurance,
    orderCount: orders.length,
  };
}

export default { loadStoreData, loadStoreConfigs, computeAllProductStats, computeDeepAnalysis, computeDashboardKPI, computeProductsList, computePromotionStats, computeAfterSaleStats, computeLogisticsSummary, computeDailyTrends, computeRegionDistribution, computeFinancialSummary, computePeriodCompare, computePromoByDate, computeShipTimeDistribution, computeCostSummary, cachedLoadStoreData, cachedLoadAllStoresData, cachedLoadAllStoresConfigs, loadProductCosts, resolveStoreContext };

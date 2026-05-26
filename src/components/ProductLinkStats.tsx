import { useMemo } from 'react';
import { evaluateFormula, FormulaContext } from '../utils/formulaEngine';
import { findField } from '../utils';

interface DailySalesPoint {
  date: string;
  sales: number;
  gmv: number;
  orders: number;
}

interface PriceBucket {
  range: string;
  min: number;
  max: number;
  count: number;
}

interface AfterSaleBreakdown {
  [status: string]: number;
}

interface RelatedProduct {
  productId: string;
  productName: string;
  coOccurrenceCount: number;
}

// 税务配置
export interface TaxConfig {
  id: string;
  name: string;
  taxType: 'vat' | 'income' | 'surcharge' | 'custom';
  rate: number;
  base: 'revenue' | 'profit' | 'vat' | 'gmv' | 'orders';
  enabled: boolean;
  description?: string;
}

// 自定义扣费项
export interface CustomDeduction {
  id: string;
  name: string;
  formula: string;
  scope: 'global' | 'product' | 'category';
  scopeTarget?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  condition?: string;
  enabled: boolean;
  sortOrder: number;
}

// 成本明细
export interface CostBreakdown {
  productCost: number;
  packagingFee: number;
  shippingFee: number;
  promoCost: number;
  discount: number;
  platformFee: number;
  taxes: number;
  customDeductions: number;
}

// 成本来源标识
export interface CostSource {
  productCost: 'real' | 'estimated' | 'missing';
  taxes: 'configured' | 'default';
  customDeductions: 'configured' | 'none';
}

// 税费明细项
export interface TaxDetail {
  name: string;
  amount: number;
  rate: number;
  base: number;
}

// 自定义扣费明细项
export interface DeductionDetail {
  name: string;
  amount: number;
  formula: string;
}

// 推广来源明细记录
export interface PromoSourceDetail {
  source: string;           // 来源类型: '商品推广' | '明星店铺' | '直播推广'
  date: string;             // 日期
  cost: number;             // 花费
  clicks: number;           // 点击量
  impressions: number;      // 曝光/展现量
  orders: number;           // 成交笔数
  transaction: number;      // 交易额
  ctr: number;              // 点击率
  cvr: number;              // 转化率
  productName: string;      // 商品名称（来自推广数据）
  rawRow: any;              // 原始数据行（用于展示更多字段）
}

interface ProductStat {
  productId: string;
  productName: string;
  productCode: string;
  gmv: number;
  orders: number;
  sales: number;
  revenue: number;
  refund: number;
  refundCount: number;
  discount: number;
  afterSaleCount: number;
  afterSaleRate: number;
  avgOrderValue: number;
  promoCost: number;
  promoClicks: number;
  promoImpressions: number;
  promoOrders: number;
  promoTransaction: number;
  ctr: number;
  cvr: number;
  totalCost: number;
  netProfit: number;
  profitRate: number;
  roi: number;
  refundRate: number;
  discountRatio: number;
  promoCostRatio: number;
  hasOrderData: boolean;
  hasPromoData: boolean;
  // 推广来源明细
  promoSourceDetails: PromoSourceDetail[];
  // Detail analysis fields
  dailySales: DailySalesPoint[];
  priceDistribution: PriceBucket[];
  afterSaleBreakdown: AfterSaleBreakdown;
  relatedProducts: RelatedProduct[];
  firstOrderDate: string;
  lastOrderDate: string;
  activeDays: number;
  avgDailySales: number;
  inventoryEstimate: number;
  turnoverDays: number;
  sellThroughRate: number;
  // Profit trust fields
  costBreakdown: CostBreakdown;
  costSource: CostSource;
  taxDetails: TaxDetail[];
  deductionDetails: DeductionDetail[];
  profitConfidence: 'high' | 'medium' | 'low';
  grossProfit: number;
  preTaxProfit: number;
  netProfitAfterTax: number;
}

function sf(v: any): number {
  if (v === undefined || v === null || v === '') return 0;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function getPromoCost(r: any): number {
  return sf(r['总花费(元)'] || r['花费(元)'] || r['推广花费'] || r['成交花费(元)'] || r['消耗'] || 0);
}

function buildPriceBuckets(prices: number[]): PriceBucket[] {
  if (!prices.length) return [];
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min;
  const bucketCount = Math.min(10, Math.max(3, Math.ceil(Math.sqrt(prices.length))));
  const step = range / bucketCount || 1;
  
  const buckets: PriceBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bMin = min + i * step;
    const bMax = i === bucketCount - 1 ? max + 0.01 : min + (i + 1) * step;
    buckets.push({
      range: `¥${bMin.toFixed(0)}-${bMax.toFixed(0)}`,
      min: bMin,
      max: bMax,
      count: 0
    });
  }
  
  prices.forEach(p => {
    const idx = Math.min(Math.floor((p - min) / step), bucketCount - 1);
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++;
  });
  
  return buckets.filter(b => b.count > 0);
}

// 清理字符串值（去除所有不可见字符：BOM、制表符、空格等）
function cleanStr(v: any): string {
  if (v == null) return '';
  return String(v).replace(/[\uFEFF\u00A0\t\r\n\s]+/g, '').trim();
}

// 安全解析浮点数
function safeNum(v: any): number {
  if (v == null) return 0;
  const s = String(v).replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

// 获取商品ID（统一处理各种字段名变体）
function getProductId(row: any): string {
  const v = findField(row, '商品id', '商品ID', 'productId', 'product_id', '商品编号');
  return cleanStr(v);
}

// 获取商品名称
function getProductName(row: any): string {
  const v = findField(row, '商品名称', '商品', 'productName', 'product_name', '宝贝标题');
  return cleanStr(v);
}

// 获取商家编码
function getProductCode(row: any): string {
  const v = findField(row, '商家编码-商品维度', '商家编码', 'skuCode', 'sku_code', '编码');
  return cleanStr(v);
}

export function useProductStats(
  currentDisplayData: any,
  productCosts?: Record<string, number>,
  taxConfigs?: TaxConfig[],
  customDeductions?: CustomDeduction[],
  defaultCostRatio?: number,
  packagingFeePerOrder?: number,
  shippingFeePerOrder?: number
): Record<string, ProductStat> {
  return useMemo(() => {
    // 数据已在UploadPage源头清洗，此处直接使用
    const orders = currentDisplayData?.orders || [];
    const promoProducts = currentDisplayData?.promotionProducts || [];
    const promoSummary = currentDisplayData?.promotionSummary || [];
    const stats: Record<string, ProductStat> = {};

    let maxOrderDate = '';
    const productNames: Record<string, string> = {};
    const productCodes: Record<string, string> = {};
    // Temporary storage for raw data needed for derived metrics
    const orderDetails: Record<string, { dates: string[]; prices: number[]; afterSaleStatuses: string[]; orderNos: string[] }> = {};
    // Map buyer (orderNo last 4) -> set of productIds
    const buyerProducts: Record<string, Set<string>> = {};
    // Daily sales built during initial pass to avoid O(N*M) re-iteration
    const dailySalesMap: Record<string, Record<string, DailySalesPoint>> = {};
    // Per-SKU sales tracking for accurate cost calculation
    const skuSalesMap: Record<string, Record<string, number>> = {};

    orders.forEach((o: any) => {
      // 使用智能字段匹配获取商品ID
      const pid = getProductId(o);
      if (!pid) return;
      const name = getProductName(o);
      const code = getProductCode(o);
      if (name && !productNames[pid]) productNames[pid] = name;
      if (code && !productCodes[pid]) productCodes[pid] = code;

      if (!stats[pid]) {
        stats[pid] = {
          productId: pid, productName: name || pid, productCode: code || '',
          gmv: 0, orders: 0, sales: 0, revenue: 0, refund: 0, discount: 0,
          afterSaleCount: 0, afterSaleRate: 0, avgOrderValue: 0,
          promoCost: 0, promoClicks: 0, promoImpressions: 0, promoOrders: 0, promoTransaction: 0,
          ctr: 0, cvr: 0, totalCost: 0, netProfit: 0, profitRate: 0, roi: 0,
          refundRate: 0, refundCount: 0, discountRatio: 0, promoCostRatio: 0,
          hasOrderData: true, hasPromoData: false,
          promoSourceDetails: [],
          dailySales: [], priceDistribution: [], afterSaleBreakdown: {}, relatedProducts: [],
          firstOrderDate: '', lastOrderDate: '', activeDays: 0, avgDailySales: 0,
          inventoryEstimate: 0, turnoverDays: 0, sellThroughRate: 0,
          costBreakdown: { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, taxes: 0, customDeductions: 0 },
          costSource: { productCost: 'missing', taxes: 'default', customDeductions: 'none' },
          taxDetails: [],
          deductionDetails: [],
          profitConfidence: 'low',
          grossProfit: 0,
          preTaxProfit: 0,
          netProfitAfterTax: 0
        };
        orderDetails[pid] = { dates: [], prices: [], afterSaleStatuses: [], orderNos: [] };
      }
      const s = stats[pid];
      s.hasOrderData = true;
      // GMV = 商品总价（优先），用户实付（备用）
      const actualPay = safeNum(findField(o, '用户实付金额(元)', '用户实付', '实付金额'));
      const productTotal = safeNum(findField(o, '商品总价(元)', '商品总价'));
      s.gmv += productTotal || actualPay;
      s.orders += 1;
      const qty = safeNum(findField(o, '商品数量(件)', '商品数量', '数量')) || 1;
      s.sales += qty;
      // Track per-SKU sales
      const skuId = cleanStr(findField(o, '规格id', '规格ID', 'sku_id', 'skuId'));
      const skuKey = skuId ? `${pid}_${skuId}` : pid;
      if (!skuSalesMap[pid]) skuSalesMap[pid] = {};
      skuSalesMap[pid][skuKey] = (skuSalesMap[pid][skuKey] || 0) + qty;
      s.revenue += safeNum(findField(o, '商家实收金额(元)', '商家实收', '实收金额'));
      const shopDiscount = safeNum(findField(o, '店铺优惠折扣(元)', '店铺优惠'));
      const platDiscount = safeNum(findField(o, '平台优惠折扣(元)', '平台优惠'));
      const payDiscount = safeNum(findField(o, '多多支付立减金额(元)', '支付立减'));
      s.discount += shopDiscount + platDiscount + payDiscount;
      s.refund += safeNum(findField(o, '退款金额(元)', '退款金额', '退款(元)'));

      const st = cleanStr(findField(o, '售后状态'));
      if (st && st !== '无售后或售后取消' && st !== '无') s.afterSaleCount += 1;
      if (st && st.includes('退款')) s.refundCount += 1;

      // Collect raw data for derived metrics
      const payTimeRaw = cleanStr(findField(o, '支付时间'));
      const payTime = payTimeRaw ? payTimeRaw.split(' ')[0] : '';
      if (payTime && payTime > maxOrderDate) maxOrderDate = payTime;
      const price = actualPay;
      const orderNo = cleanStr(findField(o, '订单号'));
      const buyerKey = orderNo.length >= 4 ? orderNo.slice(-4) : orderNo;

      if (payTime) orderDetails[pid].dates.push(payTime);
      if (price > 0) orderDetails[pid].prices.push(price);
      if (st) orderDetails[pid].afterSaleStatuses.push(st);
      if (buyerKey) {
        orderDetails[pid].orderNos.push(buyerKey);
        if (!buyerProducts[buyerKey]) buyerProducts[buyerKey] = new Set();
        buyerProducts[buyerKey].add(pid);
      }
      // Accumulate daily sales during initial pass
      if (payTime) {
        if (!dailySalesMap[pid]) dailySalesMap[pid] = {};
        if (!dailySalesMap[pid][payTime]) dailySalesMap[pid][payTime] = { date: payTime, sales: 0, gmv: 0, orders: 0 };
        dailySalesMap[pid][payTime].orders += 1;
        dailySalesMap[pid][payTime].sales += safeNum(findField(o, '商品数量(件)', '商品数量', '数量')) || 1;
        dailySalesMap[pid][payTime].gmv += productTotal || actualPay;
      }
    });

    // 关联独立售后数据（通过商品ID匹配）
    const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
    if (afterSaleRecords.length > 0) {
      afterSaleRecords.forEach((r: any) => {
        const pid = String(r['商品ID'] || r['商品id'] || '').trim();
        if (!pid) return;
        // 如果该商品在stats中不存在，创建条目
        if (!stats[pid]) {
          stats[pid] = {
            productId: pid, productName: String(r['sku信息'] || '').split(',')[0] || pid, productCode: '',
            gmv: 0, orders: 0, sales: 0, revenue: 0, refund: 0, discount: 0,
            afterSaleCount: 0, afterSaleRate: 0, avgOrderValue: 0,
            promoCost: 0, promoClicks: 0, promoImpressions: 0, promoOrders: 0, promoTransaction: 0,
            ctr: 0, cvr: 0, totalCost: 0, netProfit: 0, profitRate: 0, roi: 0,
            refundRate: 0, refundCount: 0, discountRatio: 0, promoCostRatio: 0,
            hasOrderData: false, hasPromoData: false,
            promoSourceDetails: [],
            dailySales: [], priceDistribution: [], afterSaleBreakdown: {}, relatedProducts: [],
            firstOrderDate: '', lastOrderDate: '', activeDays: 0, avgDailySales: 0,
            inventoryEstimate: 0, turnoverDays: 0, sellThroughRate: 0,
            costBreakdown: { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, taxes: 0, customDeductions: 0 },
            costSource: { productCost: 'missing', taxes: 'default', customDeductions: 'none' },
            taxDetails: [], deductionDetails: [],
            profitConfidence: 'low', grossProfit: 0, preTaxProfit: 0, netProfitAfterTax: 0
          };
        }
        const s = stats[pid];
        s.afterSaleCount += 1;
        s.refund += sf(r['退款金额']);
        const status = String(r['售后状态'] || '未知');
        s.afterSaleBreakdown[status] = (s.afterSaleBreakdown[status] || 0) + 1;
      });
    }

    // ========== 推广数据关联 ==========
    // 商品推广明细（promotionProducts）有商品ID，直接按商品ID匹配
    promoProducts.forEach((p: any) => {
      const pid = cleanStr(p['商品ID'] || p['商品id'] || p['商品编号'] || '');
      if (!pid) return; // 无商品ID跳过
      if (!stats[pid]) return; // 商品不在订单数据中跳过

      const s = stats[pid];
      const pCost = safeNum(p['成交花费(元)'] ?? p['总花费(元)'] ?? p['花费(元)'] ?? p['推广花费'] ?? 0);
      const pClicks = safeNum(p['点击量'] ?? p['点击'] ?? 0);
      const pImpressions = safeNum(p['曝光量'] ?? p['展现量'] ?? p['展示'] ?? 0);
      const pOrders = safeNum(p['成交笔数'] ?? p['成交订单数'] ?? p['订单数'] ?? 0);
      const pTransaction = safeNum(p['交易额(元)'] ?? p['成交金额(元)'] ?? p['净交易额(元)'] ?? 0);
      const dateStr = cleanStr(p['日期'] || p['统计日期'] || '');
      const name = cleanStr(p['商品名称'] || p['商品'] || '');

      s.hasPromoData = true;
      s.promoCost += pCost;
      s.promoClicks += pClicks;
      s.promoImpressions += pImpressions;
      s.promoOrders += pOrders;
      s.promoTransaction += pTransaction;
      s.promoSourceDetails.push({
        source: '商品推广',
        date: dateStr,
        cost: pCost,
        clicks: pClicks,
        impressions: pImpressions,
        orders: pOrders,
        transaction: pTransaction,
        ctr: pImpressions > 0 ? (pClicks / pImpressions) * 100 : 0,
        cvr: pClicks > 0 ? (pOrders / pClicks) * 100 : 0,
        productName: name,
        rawRow: p,
      });
    });

    // 明星店铺和直播推广数据（按天汇总，无商品ID）- 按日期+GMV占比分配
    // Step 1: 构建每日商品GMV占比表
    const dailyGmvMap: Record<string, { pid: string; gmv: number }[]> = {};
    orders.forEach((o: any) => {
      const pid = getProductId(o);
      if (!pid) return;
      const payTimeRaw = cleanStr(findField(o, '支付时间'));
      const dateKey = payTimeRaw ? payTimeRaw.split(' ')[0] : '';
      if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
      const actualPay = safeNum(findField(o, '用户实付金额(元)', '用户实付', '实付金额'));
      const productTotal = safeNum(findField(o, '商品总价(元)', '商品总价'));
      const gmv = productTotal || actualPay;
      if (!dailyGmvMap[dateKey]) dailyGmvMap[dateKey] = [];
      dailyGmvMap[dateKey].push({ pid, gmv });
    });

    // 预计算每日总GMV和每商品占比
    const dailyRatios: Record<string, { pid: string; ratio: number }[]> = {};
    Object.keys(dailyGmvMap).forEach(dateKey => {
      const items = dailyGmvMap[dateKey];
      const merged: Record<string, number> = {};
      items.forEach(item => { merged[item.pid] = (merged[item.pid] || 0) + item.gmv; });
      const totalGmv = Object.values(merged).reduce((s, v) => s + v, 0);
      if (totalGmv > 0) {
        dailyRatios[dateKey] = Object.entries(merged).map(([pid, gmv]) => ({
          pid,
          ratio: gmv / totalGmv,
        }));
      }
    });

    // Step 2: 收集明星店铺和直播推广数据
    interface PromoDayRow {
      source: string;
      date: string;
      cost: number;
      clicks: number;
      impressions: number;
      orders: number;
      transaction: number;
      rawRow: any;
    }

    const promoDayRows: PromoDayRow[] = [];

    // 明星店铺数据
    const starStoreSummary = currentDisplayData?.starStoreSummary || [];
    starStoreSummary.forEach((r: any) => {
      const dateStr = cleanStr(r['日期'] || r['统计日期'] || '');
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      promoDayRows.push({
        source: '明星店铺', date: dateStr,
        cost: safeNum(r['花费(元)'] ?? r['总花费(元)'] ?? 0),
        clicks: safeNum(r['点击量'] ?? r['点击'] ?? 0),
        impressions: safeNum(r['曝光量'] ?? r['展现量'] ?? 0),
        orders: safeNum(r['成交笔数'] ?? r['成交订单数'] ?? r['订单数'] ?? 0),
        transaction: safeNum(r['交易额(元)'] ?? r['成交金额(元)'] ?? 0),
        rawRow: r,
      });
    });

    // 直播推广数据
    const liveStreamSummary = currentDisplayData?.liveStreamSummary || [];
    liveStreamSummary.forEach((r: any) => {
      const dateStr = cleanStr(r['日期'] || r['统计日期'] || '');
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
      promoDayRows.push({
        source: '直播推广', date: dateStr,
        cost: safeNum(r['总花费(元)'] ?? r['花费(元)'] ?? 0),
        clicks: safeNum(r['点击量'] ?? r['点击'] ?? 0),
        impressions: safeNum(r['曝光量'] ?? r['展现量'] ?? 0),
        orders: safeNum(r['成交笔数'] ?? r['成交订单数'] ?? r['订单数'] ?? 0),
        transaction: safeNum(r['交易额(元)'] ?? r['成交金额(元)'] ?? 0),
        rawRow: r,
      });
    });

    // Step 3: 按日期+GMV占比分配明星店铺和直播推广数据
    promoDayRows.forEach(row => {
      const ratios = dailyRatios[row.date];
      if (!ratios || ratios.length === 0) return;

      ratios.forEach(({ pid, ratio }) => {
        if (!stats[pid]) return;
        const s = stats[pid];
        const allocCost = row.cost * ratio;
        const allocClicks = Math.round(row.clicks * ratio);
        const allocImpressions = Math.round(row.impressions * ratio);
        const allocOrders = Math.round(row.orders * ratio);
        const allocTransaction = row.transaction * ratio;

        s.hasPromoData = true;
        s.promoCost += allocCost;
        s.promoClicks += allocClicks;
        s.promoImpressions += allocImpressions;
        s.promoOrders += allocOrders;
        s.promoTransaction += allocTransaction;
        s.promoSourceDetails.push({
          source: row.source,
          date: row.date,
          cost: allocCost,
          clicks: allocClicks,
          impressions: allocImpressions,
          orders: allocOrders,
          transaction: allocTransaction,
          ctr: allocImpressions > 0 ? (allocClicks / allocImpressions) * 100 : 0,
          cvr: allocClicks > 0 ? (allocOrders / allocClicks) * 100 : 0,
          productName: '',
          rawRow: row.rawRow,
        });
      });
    });

    // Compute derived metrics with profit trust
    Object.keys(stats).forEach(pid => {
      const s = stats[pid];
      if (productNames[pid] && productNames[pid] !== pid) s.productName = productNames[pid];
      if (productCodes[pid]) s.productCode = productCodes[pid];

      // Cost matching: SKU > productId > productCode > default ratio
      let productCost = 0;
      let costSourceType: 'real' | 'estimated' | 'missing' = 'missing';

      if (productCosts) {
        // 成本匹配优先级：直接productId > SKU格式(${pid}_*)汇总 > productCode > defaultRatio
        if (productCosts[pid] !== undefined && productCosts[pid] > 0) {
          // 直接匹配到商品ID
          productCost = productCosts[pid] * s.sales;
          costSourceType = 'real';
        } else {
          // 尝试匹配SKU格式 (${pid}_${skuId})，按各SKU实际销量×单价汇总
          let skuTotalCost = 0;
          let matchedSales = 0;
          const pidSkuSales = skuSalesMap[pid] || {};
          for (const [key, unitCost] of Object.entries(productCosts)) {
            if (key.startsWith(`${pid}_`) && unitCost > 0) {
              const skuSales = pidSkuSales[key] || 0;
              skuTotalCost += unitCost * skuSales;
              matchedSales += skuSales;
            }
          }
          if (skuTotalCost > 0) {
            // 有SKU成本匹配：未匹配到的销量按已匹配SKU的平均成本估算
            if (matchedSales < s.sales) {
              const unmatchedSales = s.sales - matchedSales;
              const avgCost = skuTotalCost / matchedSales;
              skuTotalCost += avgCost * unmatchedSales;
            }
            productCost = skuTotalCost;
            costSourceType = 'real';
          } else if (s.productCode && productCosts[s.productCode] !== undefined && productCosts[s.productCode] > 0) {
            productCost = productCosts[s.productCode] * s.sales;
            costSourceType = 'real';
          } else if (defaultCostRatio && defaultCostRatio > 0) {
            productCost = s.gmv * (defaultCostRatio / 100);
            costSourceType = 'estimated';
          }
        }
      } else if (defaultCostRatio && defaultCostRatio > 0) {
        productCost = s.gmv * (defaultCostRatio / 100);
        costSourceType = 'estimated';
      }

      const packagingFee = (packagingFeePerOrder || 0) * s.orders;
      const shippingFee = (shippingFeePerOrder || 0) * s.orders;

      // Gross profit = 实收 - 推广费 - 包装费 - 快递费（discount已体现在revenue中，不重复扣）
      const grossProfit = s.revenue - s.promoCost - packagingFee - shippingFee;

      // Pre-tax profit = 实收 - 商品成本 - 推广费 - 包装费 - 快递费
      const preTaxProfit = s.revenue - productCost - s.promoCost - packagingFee - shippingFee;

      // Tax calculation
      const taxDetails: TaxDetail[] = [];
      let totalTax = 0;
      let vatAmount = 0;

      if (taxConfigs && taxConfigs.length > 0) {
        const enabledTaxes = taxConfigs.filter(t => t.enabled);
        // First pass: calculate non-surcharge taxes
        enabledTaxes.filter(t => t.taxType !== 'surcharge').forEach(tax => {
          let base = 0;
          switch (tax.base) {
            case 'revenue': base = s.revenue; break;
            case 'profit': base = preTaxProfit; break;
            case 'gmv': base = s.gmv; break;
            case 'orders': base = s.orders; break;
            default: base = s.revenue;
          }
          const amount = Math.max(0, base * (tax.rate / 100));
          if (tax.taxType === 'vat') vatAmount = amount;
          taxDetails.push({ name: tax.name, amount, rate: tax.rate, base });
          totalTax += amount;
        });
        // Second pass: surcharge based on VAT
        enabledTaxes.filter(t => t.taxType === 'surcharge').forEach(tax => {
          const base = vatAmount;
          const amount = Math.max(0, base * (tax.rate / 100));
          taxDetails.push({ name: tax.name, amount, rate: tax.rate, base });
          totalTax += amount;
        });
      }

      // Custom deductions - 先计算自定义扣费，再计算最终净利润
      let deductionDetails: DeductionDetail[] = [];
      let totalCustomDeductions = 0;

      if (customDeductions && customDeductions.length > 0) {
        // 构建公式上下文（此时netProfit还未计算，用preTaxProfit - totalTax代替）
        const formulaCtx: FormulaContext = {
          // 基础交易
          gmv: s.gmv,
          revenue: s.revenue,
          orders: s.orders,
          sales: s.sales,
          // 成本
          productCost,
          packagingFee,
          shippingFee,
          promoCost: s.promoCost,
          discount: s.discount,
          // 利润（扣费前的利润）
          profit: preTaxProfit - totalTax,
          grossProfit,
          netProfit: preTaxProfit - totalTax, // 扣费前，用于条件判断
          // 售后
          refund: s.refund,
          refundCount: s.refundCount,
          refundRate: s.refundRate,
          afterSaleCount: s.afterSaleCount,
          afterSaleRate: s.afterSaleRate,
          // 推广
          promoOrders: s.promoOrders,
          promoTransaction: s.promoTransaction,
          promoClicks: s.promoClicks,
          promoImpressions: s.promoImpressions,
          ctr: s.ctr,
          cvr: s.cvr,
          roi: s.roi,
          // 其他
          avgOrderValue: s.avgOrderValue,
          activeDays: s.activeDays,
          avgDailySales: s.avgDailySales,
          platformFee: 0,
          taxes: totalTax
        };

        const sorted = [...customDeductions].filter(d => d.enabled).sort((a, b) => a.sortOrder - b.sortOrder);
        sorted.forEach(ded => {
          // Check scope
          if (ded.scope === 'product' && ded.scopeTarget && ded.scopeTarget !== pid) {
            console.log(`[扣费跳过] ${ded.name}: 商品范围不匹配`);
            return;
          }
          // Check time range against max order date (not today)
          const analysisDate = maxOrderDate || new Date().toISOString().slice(0, 10);
          if (ded.effectiveFrom && analysisDate < ded.effectiveFrom) {
            console.log(`[扣费跳过] ${ded.name}: 未到达生效日期 (分析日期=${analysisDate})`);
            return;
          }
          if (ded.effectiveTo && analysisDate > ded.effectiveTo) {
            console.log(`[扣费跳过] ${ded.name}: 已过期 (分析日期=${analysisDate})`);
            return;
          }
          // Check condition
          if (ded.condition) {
            const condResult = evaluateFormula(ded.condition, formulaCtx);
            if (!condResult) {
              console.log(`[扣费跳过] ${ded.name}: 条件不满足 (${ded.condition})`);
              return;
            }
          }
          const amount = evaluateFormula(ded.formula, formulaCtx);
          console.log(`[扣费计算] ${ded.name}: 公式=${ded.formula}, 结果=¥${amount.toFixed(2)}`);
          // 即使金额为0也记录，方便用户排查问题
          deductionDetails.push({ name: ded.name, amount, formula: ded.formula });
          totalCustomDeductions += amount;
        });
      }

      // Final net profit after tax
      const netProfitAfterTax = preTaxProfit - totalTax - totalCustomDeductions;

      // Confidence rating
      let profitConfidence: 'high' | 'medium' | 'low' = 'low';
      if (costSourceType === 'real' && s.hasOrderData) {
        profitConfidence = s.hasPromoData ? 'high' : 'medium';
      } else if (costSourceType === 'estimated') {
        profitConfidence = 'medium';
      }

      // Assign all values
      s.costBreakdown = {
        productCost, packagingFee, shippingFee,
        promoCost: s.promoCost, discount: s.discount,
        platformFee: 0, taxes: totalTax, customDeductions: totalCustomDeductions
      };
      s.costSource = {
        productCost: costSourceType,
        taxes: taxConfigs && taxConfigs.some(t => t.enabled) ? 'configured' : 'default',
        customDeductions: customDeductions && customDeductions.some(d => d.enabled) ? 'configured' : 'none'
      };
      s.taxDetails = taxDetails;
      s.deductionDetails = deductionDetails;
      s.profitConfidence = profitConfidence;
      s.grossProfit = grossProfit;
      s.preTaxProfit = preTaxProfit;
      s.netProfitAfterTax = netProfitAfterTax;

      // Legacy fields for backward compatibility
      s.totalCost = productCost + packagingFee + shippingFee + s.promoCost + totalTax + totalCustomDeductions;
      s.netProfit = netProfitAfterTax;

      // ROI = 总推广成交金额 / 总推广花费（综合多个推广计划的准确ROI）
      if (s.promoCost > 0) {
        s.roi = s.promoTransaction / s.promoCost;
      } else {
        s.roi = 0; // 无推广数据，不计算ROI
      }

      // 退款率 = 退款订单数 / 总订单数（比率不会超过100%）
      s.refundRate = s.orders > 0 ? (s.refundCount / s.orders) * 100 : 0;
      s.avgOrderValue = s.orders > 0 ? s.gmv / s.orders : 0;
      s.afterSaleRate = s.orders > 0 ? (s.afterSaleCount / s.orders) * 100 : 0;
      s.ctr = s.promoImpressions > 0 ? (s.promoClicks / s.promoImpressions) * 100 : 0;
      s.cvr = s.promoClicks > 0 ? (s.promoOrders / s.promoClicks) * 100 : 0;
      s.discountRatio = s.gmv > 0 ? (s.discount / s.gmv) * 100 : 0;
      s.promoCostRatio = s.gmv > 0 ? (s.promoCost / s.gmv) * 100 : 0;
      s.profitRate = s.revenue > 0 ? (s.netProfit / s.revenue) * 100 : 0;

      // Build daily sales from pre-computed map
      const dailyMap = dailySalesMap[pid];
      if (dailyMap) {
        s.dailySales = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      }
      const details = orderDetails[pid];
      if (details && details.dates.length > 0) {
        const sortedDates = details.dates.sort();
        s.firstOrderDate = sortedDates[0] || '';
        s.lastOrderDate = sortedDates[sortedDates.length - 1] || '';
        const first = new Date(s.firstOrderDate);
        const last = new Date(s.lastOrderDate);
        s.activeDays = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1);
        s.avgDailySales = s.activeDays > 0 ? s.sales / s.activeDays : 0;
      }

      // Build price distribution
      if (details && details.prices.length > 0) {
        s.priceDistribution = buildPriceBuckets(details.prices);
      }

      // Build after sale breakdown
      if (details && details.afterSaleStatuses.length > 0) {
        const breakdown: AfterSaleBreakdown = {};
        details.afterSaleStatuses.forEach(st => {
          const key = st || '未知';
          breakdown[key] = (breakdown[key] || 0) + 1;
        });
        s.afterSaleBreakdown = breakdown;
      }

      // Inventory & turnover estimates
      s.inventoryEstimate = Math.max(0, Math.round(s.sales * 1.5));
      s.turnoverDays = s.avgDailySales > 0 ? Math.round(s.inventoryEstimate / s.avgDailySales) : 999;
      s.sellThroughRate = s.inventoryEstimate > 0 ? (s.sales / (s.sales + s.inventoryEstimate)) * 100 : 0;
    });

    // Build related products (co-purchase analysis)
    Object.keys(stats).forEach(pid => {
      const details = orderDetails[pid];
      if (!details || details.orderNos.length === 0) return;
      const stat = stats[pid];
      if (!stat) return;

      const coOccurrence: Record<string, number> = {};
      details.orderNos.forEach(buyerKey => {
        const otherPids = buyerProducts[buyerKey];
        if (!otherPids) return;
        otherPids.forEach(otherPid => {
          if (otherPid === pid) return;
          coOccurrence[otherPid] = (coOccurrence[otherPid] || 0) + 1;
        });
      });

      stat.relatedProducts = Object.entries(coOccurrence)
        .map(([otherPid, count]) => ({
          productId: otherPid,
          productName: stats[otherPid]?.productName || otherPid,
          coOccurrenceCount: count
        }))
        .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
        .slice(0, 5);
    });

    return stats;
  }, [currentDisplayData]);
}

export function useTotalProductStats(productStats: Record<string, ProductStat>) {
  return useMemo(() => {
    let gmv = 0, orders = 0, sales = 0, revenue = 0, refund = 0, refundCount = 0, discount = 0;
    let promoCost = 0, promoClicks = 0, promoImpressions = 0, promoOrders = 0, promoTransaction = 0;
    let afterSaleCount = 0;
    let totalTaxes = 0, totalCustomDed = 0, totalGrossProfit = 0, totalPreTaxProfit = 0, totalNetProfitAfterTax = 0;
    let totalCostAcc = 0;
    Object.values(productStats).forEach(s => {
      gmv += s.gmv; orders += s.orders; sales += s.sales;
      revenue += s.revenue; refund += s.refund; refundCount += s.refundCount || 0; discount += s.discount;
      promoCost += s.promoCost; promoClicks += s.promoClicks;
      promoImpressions += s.promoImpressions; promoOrders += s.promoOrders;
      promoTransaction += s.promoTransaction; afterSaleCount += s.afterSaleCount;
      totalTaxes += s.costBreakdown?.taxes || 0;
      totalCustomDed += s.costBreakdown?.customDeductions || 0;
      totalGrossProfit += s.grossProfit || 0;
      totalPreTaxProfit += s.preTaxProfit || 0;
      totalNetProfitAfterTax += s.netProfitAfterTax || 0;
      totalCostAcc += s.totalCost || 0;
    });
    const netProfit = totalNetProfitAfterTax;
    // 汇总ROI = 总推广成交金额 / 总推广花费（标准电商ROI）
    const roi = promoCost > 0 ? promoTransaction / promoCost : 0;
    // 退款率 = 退款订单数 / 总订单数
    const refundRate = orders > 0 ? (refundCount / orders) * 100 : 0;
    const avgOrderValue = orders > 0 ? gmv / orders : 0;
    const afterSaleRate = orders > 0 ? (afterSaleCount / orders) * 100 : 0;
    const ctr = promoImpressions > 0 ? (promoClicks / promoImpressions) * 100 : 0;
    const cvr = promoClicks > 0 ? (promoOrders / promoClicks) * 100 : 0;
    const profitRate = revenue > 0 ? (netProfit / revenue) * 100 : 0;
    const productCount = Object.keys(productStats).length;
    const totalCostVal = totalCostAcc;
    return {
      productCount, gmv, orders, sales, revenue, refund, discount,
      promoCost, promoClicks, promoImpressions, promoOrders, promoTransaction,
      totalCost: totalCostVal, netProfit, roi, refundRate, avgOrderValue,
      afterSaleRate, ctr, cvr, profitRate,
      totalTaxes, totalCustomDed, totalGrossProfit, totalPreTaxProfit, totalNetProfitAfterTax
    };
  }, [productStats]);
}

export function useProductDetail(productStats: Record<string, ProductStat>, productId: string | null) {
  return useMemo(() => {
    if (!productId || !productStats[productId]) return null;
    return productStats[productId];
  }, [productStats, productId]);
}

// ProductStat 等类型已在上方 interface/type 声明时 export，此处仅补充未导出的类型
export type { ProductStat, DailySalesPoint, PriceBucket, AfterSaleBreakdown, RelatedProduct };

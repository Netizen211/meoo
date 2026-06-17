/**
 * ★ 日聚合数据引擎
 *
 * 核心思想：表格上传后自动按日期拆分所有数据源 → 预计算每个日期的聚合数据
 * 然后按需累计：
 *   "近7天" = sum(昨天, 前天, ..., 7天前)
 *   "近30天" = sum(近30个日桶)
 *   自定义 = sum(选中日期范围的日桶)
 */

import { safeFloat } from '../components/TimeFilter';
import { findField } from './fieldAccess';

export interface DailyBucket {
  date: string;
  gmv: number;
  orderCount: number;
  paid: number;
  merchantReceived: number;
  discount: number;
  productIdSet: Set<string>;
  buyerOrderTailSet: Set<string>;
  shippedCount: number;
  shipHourSum: number;
  totalQty: number;
  orders: any[];
  promoOrderNos: Set<string>;
  promoRefundAmount: number;
  promoRefundedOrderNos: Set<string>;
  asCount: number;
  rfCount: number;
  refundAmount: number;
  baseTechFee: number;
  subTechFee: number;
  experiencePlan: number;
  penalties: number;
  promoCost: number;
  promoGmv: number;
  promoOrders: number;
  promoImpressions: number;
  promoClicks: number;
  insuranceRaw: number;
}

function emptyBucket(date: string): DailyBucket {
  return {
    date,
    gmv: 0, orderCount: 0, paid: 0, merchantReceived: 0, discount: 0,
    productIdSet: new Set(), buyerOrderTailSet: new Set(),
    shippedCount: 0, shipHourSum: 0, totalQty: 0,
    orders: [],
    promoOrderNos: new Set(), promoRefundAmount: 0, promoRefundedOrderNos: new Set(),
    asCount: 0, rfCount: 0, refundAmount: 0,
    baseTechFee: 0, subTechFee: 0, experiencePlan: 0, penalties: 0,
    promoCost: 0, promoGmv: 0, promoOrders: 0, promoImpressions: 0, promoClicks: 0,
    insuranceRaw: 0,
  };
}

export interface DailyRangeResult {
  gmv: number; orderCount: number; paid: number;
  merchantReceived: number; refundAmount: number; discount: number;
  organicGmv: number;
  profit: number; profitRate: number; netProfitRate: number;
  promoRatio: number; penaltyAmount: number; subsidyFee: number;
  avgPrice: number; productCount: number; sellThroughRate: number;
  asRate: number; rfRate: number; buyerCount: number;
  avgShipHours: number; organicOrders: number;
  promoCost: number; promoGmv: number; promoRoi: number;
  promoRefund: number; realPromoOrders: number;
  ctr: number; cvr: number; cpc: number; cpa: number; shopRoi: number;
  shippedCost: number; postage: number; insurance: number; platformFee: number;
  vatEstimate: number; surchargeEstimate: number;
  orders: any[];
}

export function buildDailyDataStore(
  allOrders: any[],
  promoSummary: any[],
  promoProducts: any[],
  starStoreSummary: any[],
  liveStreamSummary: any[],
  afterSaleRecords: any[],
  shippingInsurance: any[],
  financialActuals: Record<string, any>,
  productCosts: Record<string, number>,
  defaultCostRatio: number,
  shippingFeePerOrder: number,
  subsidyActivePids?: Set<string>,  // ★ 百亿补贴活跃商品ID集合（含1天延迟判定）
) {
  const promoPidSet = new Set<string>();
  const allPromoProducts = promoProducts || [];
  (allPromoProducts).forEach((r: any) => {
    const pid = String(findField(r, '商品ID', '商品id') || '').trim();
    if (pid && pid !== '-') promoPidSet.add(pid);
  });
  const totalProductCount = promoPidSet.size || 1;

  const byDate: Record<string, DailyBucket> = {};
  function getOrCreate(date: string): DailyBucket {
    if (!byDate[date]) byDate[date] = emptyBucket(date);
    return byDate[date];
  }

  const refundByOrder = new Map<string, { asCount: number; rfCount: number; refundAmount: number }>();
  (afterSaleRecords || []).forEach((ar: any) => {
    const orderNo = String(findField(ar, '订单编号', '订单号') || '').trim();
    if (!orderNo) return;
    const status = String(findField(ar, '售后状态') || '').trim();
    const amount = safeFloat(findField(ar, '退款金额(元)', '买家退款金额', '退款金额', '退款(元)'));
    const ex = refundByOrder.get(orderNo) || { asCount: 0, rfCount: 0, refundAmount: 0 };
    if (status && status !== '无售后或售后取消' && status !== '无') ex.asCount++;
    if (status.includes('退款')) ex.rfCount++;
    if (amount > 0) ex.refundAmount += amount;
    refundByOrder.set(orderNo, ex);
  });

  (allOrders || []).forEach((o: any) => {
    const d = String(findField(o, '支付时间') || '').split(' ')[0];
    if (!d) return;
    const b = getOrCreate(d);
    b.gmv += safeFloat(findField(o, '商品总价(元)', '商品总价'));
    b.orderCount += 1;
    b.paid += safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额'));
    b.merchantReceived += safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
    b.discount += safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'))
      + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))
      + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'));
    b.totalQty += safeFloat(findField(o, '商品数量(件)', '商品数量', '数量'));
    const pid = String(findField(o, '商品id', '商品ID') || '').trim();
    if (pid && pid !== '-') b.productIdSet.add(pid);
    const orderNo = String(findField(o, '订单号') || '').trim();
    if (orderNo) b.buyerOrderTailSet.add(orderNo.slice(-4));
    const shipT = findField(o, '发货时间');
    if (shipT != null && String(shipT).trim() !== '') {
      b.shippedCount++;
      const payT = new Date(String(findField(o, '支付时间') || ''));
      const shipD = new Date(String(shipT));
      if (!isNaN(payT.getTime()) && !isNaN(shipD.getTime())) {
        b.shipHourSum += (shipD.getTime() - payT.getTime()) / 3600000;
      }
    }
    b.orders.push(o);
    const refund = refundByOrder.get(orderNo);
    if (refund) {
      b.asCount += refund.asCount;
      b.rfCount += refund.rfCount;
      b.refundAmount += refund.refundAmount;
    }
    const actual = financialActuals?.[orderNo];
    if (actual?.hasData) {
      b.baseTechFee += actual.baseTechFee || 0;
      b.subTechFee += actual.subTechFee || 0;
      b.experiencePlan += actual.experiencePlan || 0;
      b.penalties += actual.penalties || 0;
    }
    if (pid && promoPidSet.has(pid)) {
      b.promoOrderNos.add(orderNo);
      if (refund?.refundAmount) {
        b.promoRefundAmount += refund.refundAmount;
        if (refund.rfCount > 0) b.promoRefundedOrderNos.add(orderNo);
      }
    }
  });

  function addPromo(records: any[]) {
    (records || []).forEach((r: any) => {
      const d = String(findField(r, '日期', 'date') || '').trim().replace(/\//g, '-').split(' ')[0];
      if (!d) return;
      const b = getOrCreate(d);
      b.promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)', '成交花费(元)'));
      b.promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
      b.promoImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
      b.promoClicks += parseInt(findField(r, '点击量') || '0') || 0;
      b.promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
    });
  }
  if (promoSummary.length > 0) addPromo(promoSummary);
  else addPromo(promoProducts);
  addPromo(starStoreSummary);
  addPromo(liveStreamSummary);

  (shippingInsurance || []).forEach((r: any) => {
    const d = String(findField(r, '日期', '发生时间') || '').trim().replace(/\//g, '-').split(' ')[0];
    if (!d) return;
    const b = getOrCreate(d);
    b.insuranceRaw += safeFloat(findField(r, '服务费用(元)', '服务费用(元)', '保费', '保费(元)', 'insuaceFee'));
  });

  const sortedDates = Object.keys(byDate).sort();

  return {
    byDate, sortedDates,
    getRange(startDate: string, endDate: string): DailyRangeResult {
      const buckets: DailyBucket[] = [];
      for (const d of sortedDates) {
        if (d >= startDate && d <= endDate) buckets.push(byDate[d]);
      }
      const sumArr = buckets.reduce((acc: Record<string, number>, b: DailyBucket) => {
        (['gmv','orderCount','paid','merchantReceived','refundAmount','discount',
          'promoCost','promoGmv','promoOrders','promoImpressions','promoClicks',
          'penalties','asCount','rfCount'] as (keyof DailyBucket)[]).forEach(k => {
          acc[k] = (acc[k] || 0) + (typeof b[k] === 'number' ? (b[k] as number) : 0);
        });
        return acc;
      }, {} as Record<string, number>);

      const allPid = new Set<string>(), allBT = new Set<string>();
      let shippedCount = 0, shipHourSum = 0;
      const allPON = new Set<string>(), allPRON = new Set<string>();
      let promoRAmt = 0;
      const allOrd: any[] = [];
      buckets.forEach(b => {
        b.productIdSet.forEach(id => allPid.add(id));
        b.buyerOrderTailSet.forEach(t => allBT.add(t));
        shippedCount += b.shippedCount;
        shipHourSum += b.shipHourSum;
        b.promoOrderNos.forEach(no => allPON.add(no));
        b.promoRefundedOrderNos.forEach(no => allPRON.add(no));
        promoRAmt += b.promoRefundAmount;
        allOrd.push(...b.orders);
      });

      const organicGmv = Math.max(0, sumArr.gmv - sumArr.promoGmv);
      const organicOrders = Math.max(0, sumArr.orderCount - sumArr.promoOrders);
      const avgPrice = sumArr.orderCount > 0 ? sumArr.paid / sumArr.orderCount : 0;
      const avgSH = shippedCount > 0 ? shipHourSum / shippedCount : 0;
      const asRate = sumArr.orderCount > 0 ? (sumArr.rfCount / sumArr.orderCount) * 100 : 0;
      const rfRate = sumArr.orderCount > 0 ? (sumArr.rfCount / sumArr.orderCount) * 100 : 0;

      let platformFee = 0, shippedCost = 0, postage = 0, insuranceTotal = 0;
      try {
        const cr: Record<string, number> = JSON.parse(localStorage.getItem('dianfx_courier_rates') || '{}');
        allOrd.forEach((o: any) => {
          const on = String(findField(o, '订单号', '订单编号') || '').trim();
          const mr = safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额'));
          if (on) {
            const a = financialActuals?.[on];
            if (a?.hasData && (a.baseTechFee > 0 || a.subTechFee > 0)) {
              platformFee += a.baseTechFee + a.subTechFee;
            } else if (mr > 0) {
              platformFee += mr * 0.006;
              const pid = String(findField(o, '商品id', '商品ID') || '').trim();
              // ★ 用 subsidyActivePids（含1天延迟判定）替代 promoPidSet
              if (pid && subsidyActivePids?.has(pid)) platformFee += mr * 0.044;
            }
          }
          const tn = String(findField(o, '快递单号') || '').trim();
          if (tn) {
            const pid = String(findField(o, '商品id', '商品ID') || '').trim();
            if (pid && pid !== '-') {
              const qty = safeFloat(findField(o, '商品数量(件)', '商品数量', '数量'));
              if (qty) {
                const si = String(findField(o, '样式ID') || '').trim();
                const sk = si !== '-' ? pid + '_' + si : pid;
                const pc = String(findField(o, '商家编码-商品维度') || '').trim();
                let uc = 0;
                if (productCosts && sk && productCosts[sk] > 0) uc = productCosts[sk];
                else if (productCosts && pid && productCosts[pid] > 0) uc = productCosts[pid];
                else if (productCosts && pc && pc !== '-' && productCosts[pc] > 0) uc = productCosts[pc];
                else if (defaultCostRatio) uc = safeFloat(findField(o, '商品总价(元)', '商品总价')) * (defaultCostRatio / 100);
                shippedCost += uc * qty;
              }
            }
            const courier = String(findField(o, '快递公司') || '').trim();
            postage += cr[courier] ?? shippingFeePerOrder ?? 0;
          }
        });
      } catch {}
      buckets.forEach(b => { insuranceTotal += (b.experiencePlan || b.insuranceRaw || 0); });

      const profit = sumArr.merchantReceived - sumArr.refundAmount - sumArr.promoCost - sumArr.penalties - insuranceTotal - platformFee;
      return {
        gmv: sumArr.gmv, orderCount: sumArr.orderCount, paid: sumArr.paid,
        merchantReceived: sumArr.merchantReceived, refundAmount: sumArr.refundAmount, discount: sumArr.discount, organicGmv,
        profit,
        profitRate: sumArr.merchantReceived > 0 ? (profit / sumArr.merchantReceived) * 100 : 0,
        netProfitRate: sumArr.merchantReceived > 0 ? Math.max(0, (profit - sumArr.penalties - insuranceTotal) / sumArr.merchantReceived * 100) : 0,
        promoRatio: sumArr.gmv > 0 ? (sumArr.promoCost / sumArr.gmv) * 100 : 0,
        penaltyAmount: sumArr.penalties,
        subsidyFee: buckets.reduce((a, b) => a + b.subTechFee, 0),
        avgPrice, productCount: allPid.size, sellThroughRate: allPid.size > 0 ? (allPid.size / Math.max(totalProductCount, allPid.size)) * 100 : 0,
        asRate, rfRate, buyerCount: allBT.size || 1, avgShipHours: avgSH, organicOrders,
        promoCost: sumArr.promoCost, promoGmv: sumArr.promoGmv,
        promoRoi: sumArr.promoCost > 0 ? sumArr.promoGmv / sumArr.promoCost : 0,
        promoRefund: promoRAmt, realPromoOrders: allPON.size - allPRON.size,
        ctr: sumArr.promoImpressions > 0 ? (sumArr.promoClicks / sumArr.promoImpressions) * 100 : 0,
        cvr: sumArr.promoClicks > 0 ? (sumArr.promoOrders / sumArr.promoClicks) * 100 : 0,
        cpc: sumArr.promoClicks > 0 ? sumArr.promoCost / sumArr.promoClicks : 0,
        cpa: sumArr.promoOrders > 0 ? sumArr.promoCost / sumArr.promoOrders : 0,
        shopRoi: sumArr.promoCost > 0 ? sumArr.gmv / sumArr.promoCost : 0,
        shippedCost, postage, insurance: insuranceTotal, platformFee,
        vatEstimate: sumArr.merchantReceived > 0 ? sumArr.merchantReceived / 1.01 * 0.01 : 0,
        surchargeEstimate: sumArr.merchantReceived > 0 ? (sumArr.merchantReceived / 1.01 * 0.01) * 0.12 : 0,
        orders: allOrd,
      };
    },
  };
}


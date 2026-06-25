// ─── 统一 KPI 计算容器 ──────────────────────────────────
// 所有指标使用同一套流程、同一份原始数据计算
// 加新指标只需在这里加一个字段，前端展示层自动获取

import { findField } from './fieldAccess';
import { safeFloat } from '../components/TimeFilter';

// 统一输入
export interface ComputeKpisInput {
  orders: any[];
  afterSales: any[];
  promoRecords: any[];
  /** 推广明细（商品x天数据），用于读取询单/收藏/关注等汇总表没有的字段 */
  promoDetailRecords?: any[];
  starRecords: any[];
  liveRecords: any[];
  financialRecords: any[];
  insuranceRecords: any[];
  config: {
    shippingFeePerOrder: number;
    returnShippingFeePerOrder: number;
    insuranceFeePerOrder?: number;
  };
  approvalDateStart?: string;
  approvalDateEnd?: string;
  /** 原始售后记录（未经订单支付时间过滤），用于"按同意退款时间"维度的计算 */
  allAfterSaleRecords?: any[];
}

// 统一输出 —— 所有 KPI 都在这里
export interface UnifiedKpis {
  gmv: number;
  merchantReceived: number;
  paid: number;
  organicGmv: number;
  discount: number;
  cnt: number;
  avg: number;
  buyers: number;
  productCount: number;
  organicOrders: number;
  avgShipHours: number;
  conversionRate: number;
  skuQty: number;
  rfAmount: number;
  rfCnt: number;
  rfRate: number;
  asRate: number;
  refundApprovalAmount: number;
  refundApprovalOrders: number;
  profit: number;
  penalties: number;
  penaltyCount: number;
  promoCost: number;
  promoGmv: number;
  promoRoi: number;
  promoOrders: number;
  promoRatio: number;
  shopRoi: number;
  ctr: number;
  cvr: number;
  cpc: number;
  cpa: number;
  totalImpressions: number;
  totalClicks: number;
  inquiryCost: number;
  inquiryCount: number;
  favoriteCost: number;
  favoriteCount: number;
  followCost: number;
  followCount: number;
  avgInquiryCost: number;
  avgFavoriteCost: number;
  avgFollowCost: number;
  platformFee: number;
  postage: number;
  insuranceFee: number;
  subsidyFee: number;
  refundedShippingCost: number;
  returnShippingCost: number;
}


// ─── 统一计算入口 ──────────────────────────────────────
export function computeAllKpis(input: ComputeKpisInput): UnifiedKpis {
  const { orders, afterSales, promoRecords, starRecords, liveRecords,
          financialRecords, insuranceRecords, config } = input;
  const { shippingFeePerOrder, returnShippingFeePerOrder, insuranceFeePerOrder } = config;

  const cnt = orders.length;
  const gmv = orders.reduce((s, o) => s + safeFloat(findField(o, '商品总价(元)', '商品总价')), 0);
  const paid = orders.reduce((s, o) => s + safeFloat(findField(o, '用户实付金额(元)', '用户实付金额', '用户实付', '实付金额')), 0);
  const merchantReceived = orders.reduce((s, o) =>
    s + safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), 0);
  // 平台服务费：优先订单表，若无则从财务记录003类取，再无则兜底 = totalRevenue * 0.006
  let platformFee = orders.reduce((s, o) =>
    s + safeFloat(findField(o, '平台技术服务费(元)', '技术服务费(元)', '平台技术服务费', '技术服务费')), 0);
  if (platformFee === 0 && financialRecords.length > 0) {
    platformFee = financialRecords.reduce((s, r: any) => {
      const desc = String(findField(r, '业务描述', '描述') || '').trim();
      if (desc.startsWith('003')) {
        return s + Math.abs(safeFloat(findField(r, '支出金额（-元）', '支出金额(元)', '支出金额', '发生金额')));
      }
      return s;
    }, 0);
  }
  if (platformFee === 0) {
    platformFee = merchantReceived * 0.006; // 拼多多标准费率0.6%
  }
  const avg = cnt > 0 ? paid / cnt : 0;
  const skuQty = orders.reduce((s, o) => s + safeFloat(findField(o, '商品数量(件)', '商品数量', '数量', '购买数量')), 0);
  // 快递成本：优先使用用户配置的每单快递费（成本管理），没有则从订单字段取
  const postage = shippingFeePerOrder > 0
    ? cnt * shippingFeePerOrder
    : orders.reduce((s, o) => s + safeFloat(findField(o, '邮费(元)', '邮费', '快递费(元)', '快递费')), 0);
  const discount = orders.reduce((s, o) =>
    s + safeFloat(findField(o, '店铺优惠折扣(元)', '店铺优惠折扣', '店铺优惠'))
    + safeFloat(findField(o, '平台优惠折扣(元)', '平台优惠折扣', '平台优惠'))
    + safeFloat(findField(o, '多多支付立减金额(元)', '多多支付立减金额', '支付立减'))
    + safeFloat(findField(o, '拼多多优惠券(元)', '拼多多优惠券', '优惠券')), 0);

  // ── 买家数/商品数 ──
  const buyers = new Set(orders.map(o => {
    const no = String(findField(o, '订单号') || '').trim();
    return no.slice(-4);
  }).filter(Boolean)).size || (cnt > 0 ? 1 : 0);

  const productCount = new Set(orders.map(o =>
    String(findField(o, '商品id', '商品ID') || '').trim()
  ).filter(id => id && id !== '-' && id !== '')).size;

  // ── 发货相关 ──
  const shipped = orders.filter(o => {
    const v = findField(o, '发货时间');
    return v != null && String(v).trim() !== '';
  });
  const conversionRate = cnt > 0 ? (shipped.length / cnt) * 100 : 0;
  const avgShipHours = shipped.length > 0
    ? shipped.reduce((s, o) => {
        const payT = new Date(String(findField(o, '支付时间') || ''));
        const shipT = new Date(String(findField(o, '发货时间') || ''));
        return s + (shipT.getTime() - payT.getTime()) / 3600000;
      }, 0) / shipped.length
    : 0;

  // ── 退款/售后 ──
  const refundStatus = (st: string) => st === '退款成功';
  const asStatusForRate = (st: string) => ['退款成功', '售后处理中', '处理中'].includes(st);

  const refundedAS = afterSales.filter(r => refundStatus(String(r['售后状态'] || '').trim()));

  // ★ 退款金额按照商家实收维度计算
  // 即：找到所有退款成功的订单号 → 汇总这些订单的 商家实收金额(元)
  const refundedOrderNos = new Set(refundedAS.map(r =>
    String(r['订单编号'] || r['订单号'] || '').trim()).filter(Boolean));
  const refundedOrdersForAmount = orders.filter(o =>
    refundedOrderNos.has(String(findField(o, '订单号') || '').trim()));
  const rfAmount = refundedOrdersForAmount.reduce((s, o) =>
    s + safeFloat(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额')), 0);
  const rfCnt = refundedOrderNos.size;
  const rfRate = cnt > 0 ? (rfCnt / cnt) * 100 : 0;

  const asOrdersForRate = new Set(afterSales.filter(r =>
    asStatusForRate(String(r['售后状态'] || r['退款状态'] || '').trim())
  ).map(r => String(r['订单编号'] || r['订单号'] || '').trim()).filter(Boolean));
  const asRate = cnt > 0 ? (asOrdersForRate.size / cnt) * 100 : 0;

  // ── 同意退款时间维度 ──
  // ★ 使用 allAfterSaleRecords（原始售后数据，未经订单支付时间过滤）
  //    确保「按同意退款时间」维度不受订单支付时间筛选影响
  //    例如：订单支付在筛选范围外，但退款在筛选时间内同意，应计入
  const { approvalDateStart, approvalDateEnd, allAfterSaleRecords } = input;
  const sourceForApproval = allAfterSaleRecords || afterSales;
  const refundedForApproval = sourceForApproval.filter(r => refundStatus(String(r['售后状态'] || '').trim()));
  const approvalFilteredAS = refundedForApproval.filter(r => {
    const t = String(r['同意退款时间'] || r['退款成功时间'] || '').trim().split(' ')[0];
    if (!t) return false;
    if (approvalDateStart && t < approvalDateStart) return false;
    if (approvalDateEnd && t > approvalDateEnd) return false;
    return true;
  });
  const refundApprovalAmount = approvalFilteredAS.reduce((s, r) =>
    s + safeFloat(findField(r, '退款金额(元)', '退款金额', '买家退款金额')), 0);
  const refundApprovalOrders = new Set(approvalFilteredAS.map(r =>
    String(r['订单编号'] || r['订单号'] || '').trim()
  ).filter(Boolean)).size;

  // ── 退款成本 ──
  const refundedShippingCost = refundedAS.length * (shippingFeePerOrder || 4);
  const physicalReturns = afterSales.filter(r => {
    const st = String(r['售后状态'] || '').trim();
    if (st !== '退款成功') return false;
    const tracking = String(r['退货运单号'] || '').trim();
    return tracking !== '';
  });
  const returnShippingCost = physicalReturns.length * (returnShippingFeePerOrder || 10);

  // ── 罚款 ──
  let penaltyAmount = 0, penaltyCount = 0;
  let subsidyFee = 0;
  financialRecords.forEach((r: any) => {
    const desc = String(findField(r, '业务描述', '描述') || '').trim();
    const remark = String(findField(r, '备注', '备注说明') || '').trim();
    if (desc.startsWith('004')) {
      penaltyAmount += Math.abs(safeFloat(findField(r, '支出金额（-元）', '支出金额(元)', '支出金额', '发生金额')));
      penaltyCount++;
    }
    // ★ 百亿补贴费用（与后端口径一致）
    if (desc.includes('百亿补贴') || remark.includes('百亿补贴')) {
      subsidyFee += Math.abs(safeFloat(findField(r, '支出金额（-元）', '支出金额(元)', '支出金额', '发生金额')));
    }
  });

  // ── 运费险 ──
  // ★ 优先用配置的每单运费险费（成本管理），没有则从保险记录汇总（每订单只取第一条记录防重复）
  const insuranceFee = (insuranceFeePerOrder && insuranceFeePerOrder > 0)
    ? cnt * insuranceFeePerOrder
    : (() => {
        const seen = new Set<string>();
        let total = 0;
        insuranceRecords.forEach(r => {
          const rNo = String(r['订单编号'] || r['订单号'] || '').trim();
          if (!rNo || seen.has(rNo)) return;
          seen.add(rNo);
          total += safeFloat(findField(r, '服务费用（元）', '服务费用(元)', '保费', '保费(元)'));
        });
        return total;
      })();

  // ── 推广 ──
  let promoCost = 0, promoGmv = 0, promoOrders = 0;
  let totalImpressions = 0, totalClicks = 0;
  let inquiryCost = 0, inquiryCount = 0;
  let favoriteCost = 0, favoriteCount = 0;
  let followCost = 0, followCount = 0;

  promoRecords.forEach((r: any) => {
    promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)', '成交花费(元)'));
    promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
    promoOrders += parseInt(findField(r, '成交笔数') || '0') || 0;
    totalImpressions += parseInt(findField(r, '曝光量') || '0') || 0;
    totalClicks += parseInt(findField(r, '点击量') || '0') || 0;
  });

  // ★ 询单/收藏/关注字段仅存在于推广明细表（商品x天，46列），汇总表（26列）无此字段
  // 优先从 promoDetailRecords 读取，fallback到 promoRecords
  const inquirySource = input.promoDetailRecords && input.promoDetailRecords.length > 0
    ? input.promoDetailRecords : promoRecords;
  console.error('[KPI] interaction source:', inquirySource.length, 'records, isDetail:', (input.promoDetailRecords?.length || 0) > 0);
  inquirySource.forEach((r: any) => {
    const inqField = findField(r, '询单花费(元)', '询单花费', '询单花费金额');
    const favField = findField(r, '收藏花费(元)', '收藏花费', '收藏花费金额');
    const folField = findField(r, '关注花费(元)', '关注花费', '关注花费金额');
    if (inqField || favField || folField) {
      console.error('[KPI] interaction data found:', { inqField, favField, folField, keys: Object.keys(r).slice(0,10) });
    }
    inquiryCost += safeFloat(findField(r, '询单花费(元)', '询单花费', '询单花费金额'));
    inquiryCount += parseInt(findField(r, '询单量') || '0') || 0;
    favoriteCost += safeFloat(findField(r, '收藏花费(元)', '收藏花费', '收藏花费金额'));
    favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
    followCost += safeFloat(findField(r, '关注花费(元)', '关注花费', '关注花费金额'));
    followCount += parseInt(findField(r, '关注量') || '0') || 0;
  });

  starRecords.forEach((r: any) => {
    promoCost += safeFloat(findField(r, '花费(元)', '总花费(元)'));
    promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
    promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
    totalImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
    totalClicks += parseInt(findField(r, '点击量') || '0') || 0;
    favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
    followCount += parseInt(findField(r, '店铺关注量', '关注量') || '0') || 0;
  });

  liveRecords.forEach((r: any) => {
    promoCost += safeFloat(findField(r, '总花费(元)', '花费(元)'));
    promoGmv += safeFloat(findField(r, '交易额(元)', '成交金额(元)'));
    promoOrders += parseInt(findField(r, '成交笔数', '订单数') || '0') || 0;
    totalImpressions += parseInt(findField(r, '曝光量', '展现量') || '0') || 0;
    followCount += parseInt(findField(r, '关注量') || '0') || 0;
    favoriteCount += parseInt(findField(r, '收藏量') || '0') || 0;
  });

  const promoRoi = promoCost > 0 ? promoGmv / promoCost : 0;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const cvr = totalClicks > 0 ? (promoOrders / totalClicks) * 100 : 0;
  const cpc = totalClicks > 0 ? promoCost / totalClicks : 0;
  const cpa = promoOrders > 0 ? promoCost / promoOrders : 0;
  const avgInquiryCost = inquiryCount > 0 ? inquiryCost / inquiryCount : 0;
  const avgFavoriteCost = favoriteCount > 0 ? favoriteCost / favoriteCount : 0;
  const avgFollowCost = followCount > 0 ? followCost / followCount : 0;

  // ── 自然单/利润 ──
  const organicOrders = Math.max(0, cnt - promoOrders);
  const organicGmv = Math.max(0, gmv - promoGmv);
  const promoRatio = gmv > 0 ? (promoCost / gmv) * 100 : 0;
  const shopRoi = promoCost > 0 ? gmv / promoCost : 0;

  // 利润 = 商家实收 - 退款(商家实收维度) - 推广费 - 运费险 - 罚款 - 邮费 - 百亿补贴
  // ★ rfAmount 已经是商家实收维度，直接使用
  const profit = merchantReceived - rfAmount - promoCost - insuranceFee - penaltyAmount - postage - subsidyFee;

  return {
    gmv, merchantReceived, paid, organicGmv, discount,
    cnt, avg, buyers, productCount, organicOrders,
    avgShipHours, conversionRate, skuQty,
    rfAmount, rfCnt, rfRate, asRate,
    refundApprovalAmount, refundApprovalOrders,
    profit, penalties: penaltyAmount, penaltyCount, subsidyFee,
    promoCost, promoGmv, promoRoi, promoOrders,
    promoRatio, shopRoi,
    ctr, cvr, cpc, cpa, totalImpressions, totalClicks,
    inquiryCost, inquiryCount, favoriteCost, favoriteCount, followCost, followCount,
    avgInquiryCost, avgFavoriteCost, avgFollowCost,
    platformFee, postage, insuranceFee,
    refundedShippingCost, returnShippingCost,
  };
}

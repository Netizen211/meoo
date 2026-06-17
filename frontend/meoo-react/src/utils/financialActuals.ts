import { sf } from './index';

/**
 * 每笔订单的实际财务数据（来自货款明细CSV）
 *
 * 货款明细包含以下业务编码：
 *   0010002  交易收入-订单收入          → netRevenue
 *   0010005  交易收入-优惠券结算        → couponIncome
 *   0020002  交易退款-订单退款          → refundAmount（退款正数）
 *   0020005  交易退款-优惠券结算        → refundCoupon（退款正数）
 *   0030002  技术服务费-基础技术服务费   → baseTechFee（扣费正数）
 *   0030003  技术服务费-百亿补贴技服费   → subTechFee（扣费正数）
 *   0040002  售后费用-售后补偿消费者     → penalties（扣费正数）
 *   0040004  售后费用-延迟发货           → penalties
 *   0040005  售后费用-虚假发货           → penalties
 *   0050002  服务支出-消费者体验提升计划  → experiencePlan（扣费正数）
 *   0060002  营销费用-跨店满返           → marketingFees（扣费正数）
 *   0070004  转账-广告账户              → 无订单号时归入 unlinked.adTransfer
 */
export interface OrderFinancialActual {
  orderNo: string;
  baseTechFee: number;         // 0030002 基础技术服务费
  subTechFee: number;          // 0030003 百亿补贴技术服务费
  experiencePlan: number;      // 0050002 消费者体验提升计划（原错标为 shippingInsurance）
  shippingInsurance: number;   // 保留字段，货款明细中恒为0（运费险来自独立文件）
  adTransfer: number;          // 0070004 转账到推广账户
  penalties: number;           // 004xxxx 售后罚款总额（含理赔）
  insuranceClaims: number;     // 0040002 售后补偿消费者（运费险理赔，罚款中的理赔部分）
  penaltyRecords: { time: string; amount: number; type: string; desc: string }[];  // 罚款明细
  marketingFees: number;       // 006xxxx 营销费用
  netRevenue: number;          // 0010002 订单收入（正）
  couponIncome: number;        // 0010005 优惠券结算（正）
  refundAmount: number;        // 0020002 退款金额（正）
  refundCoupon: number;        // 0020005 退款优惠券（正）
  hasData: boolean;
}

/** 无法关联到订单号的费用汇总 */
export interface UnlinkedFinancials {
  penalties: number;           // 004xxxx 无订单号
  marketingFees: number;       // 006xxxx 无订单号
  experiencePlan: number;      // 0050002 无订单号
  adTransfer: number;          // 0070004 转账到广告
  lateShipment: number;        // 延迟发货扣款总额
  records: { time: string; desc: string; amount: number; type: string }[];
}

const EMPTY_ACTUAL: OrderFinancialActual = {
  orderNo: '',
  baseTechFee: 0, subTechFee: 0, experiencePlan: 0,
  shippingInsurance: 0, adTransfer: 0, penalties: 0, insuranceClaims: 0,
  penaltyRecords: [],
  marketingFees: 0, netRevenue: 0, couponIncome: 0,
  refundAmount: 0, refundCoupon: 0, hasData: false,
};

const EMPTY_UNLINKED: UnlinkedFinancials = {
  penalties: 0, marketingFees: 0, experiencePlan: 0,
  adTransfer: 0, lateShipment: 0, records: [],
};

/** 从货款明细构建按订单号索引的实际财务数据，同时收集无订单号的未关联费用 */
export function buildFinancialIndex(records: any[]): {
  index: Record<string, OrderFinancialActual>;
  unlinked: UnlinkedFinancials;
} {
  const map: Record<string, OrderFinancialActual> = {};
  const unlinked: UnlinkedFinancials = { ...EMPTY_UNLINKED, records: [] };
  if (!records || !records.length) return { index: map, unlinked };

  records.forEach((r: any) => {
    const desc = String(r['业务描述'] || r['账务类型'] || '');
    const code = desc.split('|')[0] || '';
    const inc = sf(r['收入金额（+元）'] || r['收入金额(+元)'] || r['收入金额(元)'] || r['收入金额'] || r['收入（+元）'] || r['收入(+元)'] || 0);
    const exp = sf(r['支出金额（-元）'] || r['支出金额(-元)'] || r['支出金额(元)'] || r['支出金额'] || r['支出（-元）'] || r['支出(-元)'] || 0);
    const no = String(r['商户订单号'] || r['商家订单号'] || '').trim();
    const amount = Math.abs(inc + exp);
    const time = r['发生时间'] || '';

    // ---- 无订单号记录 ----
    if (!no) {
      if (code === '0040004') {
        // 延迟发货（此类记录无订单号）
        unlinked.lateShipment += amount;
        unlinked.penalties += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '延迟发货' });
      } else if (code === '0040005') {
        unlinked.penalties += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '虚假发货' });
      } else if (code.startsWith('004')) {
        unlinked.penalties += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '售后扣款' });
      } else if (code === '0050002') {
        unlinked.experiencePlan += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '体验提升计划' });
      } else if (code.startsWith('006')) {
        unlinked.marketingFees += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '营销费' });
      } else if (code === '0070004') {
        unlinked.adTransfer += amount;
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '转账广告' });
      } else {
        // 兜底：其他未识别类型
        unlinked.records.push({ time, desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '其他' });
      }
      return;
    }

    // ---- 有订单号记录 ----
    if (!map[no]) map[no] = { ...EMPTY_ACTUAL, orderNo: no, hasData: true };
    const entry = map[no];

    if (code === '0010002') {
      entry.netRevenue += inc;
    } else if (code === '0010005') {
      entry.couponIncome += inc;
    } else if (code === '0020002') {
      entry.refundAmount += Math.abs(exp);
    } else if (code === '0020005') {
      entry.refundCoupon += Math.abs(exp);
    } else if (code === '0030002') {
      entry.baseTechFee += inc + exp;    // 通常 exp<0（扣费），inc>0（返还）
    } else if (code === '0030003') {
      entry.subTechFee += inc + exp;
    } else if (code.startsWith('004')) {
      entry.penalties += inc + exp;
      if (code === '0040002') {
        // ★ 0040002 = 售后补偿消费者 = 运费险理赔（罚款中的理赔部分）
        entry.insuranceClaims += inc + exp;
      }
      // ★ 保留罚款明细：时间、金额、类型、描述
      entry.penaltyRecords.push({
        time,
        amount: Math.abs(inc + exp),
        type: code === '0040004' ? '延迟发货' : code === '0040005' ? '虚假发货' : '售后扣款',
        desc: desc.split('|').slice(1).join(' / ') || desc,
      });
    } else if (code === '0050002') {
      entry.experiencePlan += inc + exp;
    } else if (code.startsWith('006')) {
      entry.marketingFees += inc + exp;
    } else if (code === '0070004') {
      entry.adTransfer += inc + exp;
    }
  });

  // 将所有费用转为正数（支出）存储
  Object.values(map).forEach(v => {
    v.baseTechFee = Math.abs(v.baseTechFee);
    v.subTechFee = Math.abs(v.subTechFee);
    v.experiencePlan = Math.abs(v.experiencePlan);
    v.shippingInsurance = 0;     // 货款明细不含运费险
    v.adTransfer = Math.abs(v.adTransfer);
    v.penalties = Math.abs(v.penalties);
    v.insuranceClaims = Math.abs(v.insuranceClaims);
    v.marketingFees = Math.abs(v.marketingFees);
    v.refundAmount = Math.abs(v.refundAmount);
    v.refundCoupon = Math.abs(v.refundCoupon);
  });

  return { index: map, unlinked };
}

/** 取每单平台佣金最佳值：actual 技服费优先，否则公式估算（基于用户实付金额） */
export function getBestPlatformFee(
  orderNo: string,
  userPaidAmount: number,
  ratePercent: number,
  index: Record<string, OrderFinancialActual>
): number {
  const actual = index[orderNo];
  if (actual?.hasData && (actual.baseTechFee > 0 || actual.subTechFee > 0)) {
    return actual.baseTechFee + actual.subTechFee;
  }
  // 公式估算：平台服务费基于用户实付金额计算
  return userPaidAmount * (ratePercent / 100);
}

/** 取每单运费险最佳值：actual 保费优先，否则配置固定值 */
export function getBestInsuranceFee(
  orderNo: string,
  defaultFee: number,
  index: Record<string, OrderFinancialActual>
): number {
  const actual = index[orderNo];
  if (actual?.hasData && actual.shippingInsurance > 0) {
    return actual.shippingInsurance;
  }
  return defaultFee;
}

/** 取每单罚款（仅 actual 数据有） */
export function getPenaltyFees(
  orderNo: string,
  index: Record<string, OrderFinancialActual>
): number {
  return index[orderNo]?.penalties ?? 0;
}

/** 取每单营销费用（仅 actual 数据有） */
export function getMarketingFees(
  orderNo: string,
  index: Record<string, OrderFinancialActual>
): number {
  return index[orderNo]?.marketingFees ?? 0;
}

/** 判断订单是否为百亿补贴订单 */
export function isSubsidyOrder(
  orderNo: string,
  index: Record<string, OrderFinancialActual>
): boolean {
  return (index[orderNo]?.subTechFee ?? 0) > 0;
}

/** 获取费率校准建议 — 分母使用用户实付金额（平台费基于实付计算，而非商家实收） */
export function getSuggestedCommissionRate(
  index: Record<string, OrderFinancialActual>,
  orders: any[],
  getOrderNo: (o: any) => string,
  getUserPaid: (o: any) => number
): { normalRate: number; subsidyRate: number; overallRate: number; normalOrders: number; subsidyOrders: number } {
  let normalTechFee = 0, normalUserPaid = 0;
  let subsidyTechFee = 0, subsidyUserPaid = 0;
  let normalCount = 0, subsidyCount = 0;

  orders.forEach(o => {
    const no = getOrderNo(o);
    const up = getUserPaid(o);
    if (!no || up <= 0) return;
    const actual = index[no];
    if (!actual?.hasData) return;

    if (actual.subTechFee > 0) {
      subsidyTechFee += actual.baseTechFee + actual.subTechFee;
      subsidyUserPaid += up;
      subsidyCount++;
    } else if (actual.baseTechFee > 0) {
      normalTechFee += actual.baseTechFee;
      normalUserPaid += up;
      normalCount++;
    }
  });

  return {
    normalRate: normalUserPaid > 0 ? (normalTechFee / normalUserPaid) * 100 : 0,
    subsidyRate: subsidyUserPaid > 0 ? (subsidyTechFee / subsidyUserPaid) * 100 : 0,
    overallRate: (normalUserPaid + subsidyUserPaid) > 0
      ? ((normalTechFee + subsidyTechFee) / (normalUserPaid + subsidyUserPaid)) * 100
      : 0,
    normalOrders: normalCount,
    subsidyOrders: subsidyCount,
  };
}

// ======================== 延迟发货罚款匹配 ========================

export interface LateShipmentMatch {
  orderNo: string;
  expectedPenalty: number;
  actualPenalty: number;
  confirmed: boolean;
}

export interface LateShipmentMatchingResult {
  /** 匹配到财务扣款的超时订单（绿色） */
  confirmedOrders: LateShipmentMatch[];
  /** 无财务扣款对应的超时订单（黄色，估算） */
  estimatedOrders: LateShipmentMatch[];
  /** 仍未匹配的财务扣款条数 */
  remainingPenaltyCount: number;
  /** 仍未匹配的财务扣款金额 */
  remainingPenaltyAmount: number;
}

/** 计算超时发货预计罚款 */
export function calcLateShipmentPenalty(orderAmount: number): number {
  if (orderAmount < 300) return 3;
  return Math.min(orderAmount * 0.01, 30);
}

/** 判断订单是否超时发货（发货时间 > 承诺发货时间） */
export function isLateShipment(o: any, findFieldFn: (o: any, ...names: string[]) => string): boolean {
  const promiseTime = findFieldFn(o, '承诺发货时间') || '';
  const shipTime = findFieldFn(o, '发货时间') || '';
  if (!promiseTime || !shipTime) return false;
  return shipTime > promiseTime;
}

/**
 * 匹配延迟发货罚款：
 * 1. 从订单中识别超时发货的订单
 * 2. 已有订单号的财务扣款直接确认（绿色）
 * 3. 剩余超时订单从无订单号扣款池中匹配（按数量，绿色）
 * 4. 匹配完仍有超时订单 → 黄色（公式估算）
 */
export function matchLateShipmentPenalties(
  orders: any[],
  orderFinancialActuals: Record<string, OrderFinancialActual>,
  unlinkedFinancials: UnlinkedFinancials,
  findFieldFn: (o: any, ...names: string[]) => string
): LateShipmentMatchingResult {
  const confirmedOrders: LateShipmentMatch[] = [];
  const estimatedOrders: LateShipmentMatch[] = [];

  // 1. 识别所有超时发货订单
  const lateOrders: { orderNo: string; orderAmount: number }[] = [];
  const seen = new Set<string>();
  orders.forEach((o: any) => {
    const orderNo = String(findFieldFn(o, '订单号') || '').trim();
    if (!orderNo || seen.has(orderNo)) return;
    if (!isLateShipment(o, findFieldFn)) return;
    seen.add(orderNo);

    const merchantReceived = parseFloat(String(findFieldFn(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0;
    const productTotal = parseFloat(String(findFieldFn(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
    const orderAmount = merchantReceived > 0 ? merchantReceived : productTotal;
    lateOrders.push({ orderNo, orderAmount });
  });

  // 2. 建立无订单号扣款池（只取延迟发货/虚假发货）
  const unlinkedPool: number[] = [];
  unlinkedFinancials.records.forEach(r => {
    if (r.type === '延迟发货' || r.type === '虚假发货') {
      unlinkedPool.push(r.amount);
    }
  });
  // 按金额排序，方便匹配
  unlinkedPool.sort((a, b) => a - b);

  // 3. 对每个超时订单匹配
  const remainingPool = [...unlinkedPool];

  lateOrders.forEach(({ orderNo, orderAmount }) => {
    const expectedPenalty = calcLateShipmentPenalty(orderAmount);
    const actual = orderFinancialActuals[orderNo];

    // 优先：财务索引中已有该订单的罚款（004xxxx 有订单号的情况）
    if (actual?.hasData && actual.penalties > 0) {
      confirmedOrders.push({ orderNo, expectedPenalty, actualPenalty: actual.penalties, confirmed: true });
      return;
    }

    // 其次：从无订单号扣款池中匹配（按数量，找金额最接近的）
    const poolIdx = remainingPool.findIndex(a => Math.abs(a - expectedPenalty) <= 2);
    if (poolIdx >= 0) {
      const matchedAmount = remainingPool.splice(poolIdx, 1)[0];
      confirmedOrders.push({ orderNo, expectedPenalty, actualPenalty: matchedAmount, confirmed: true });
      return;
    }

    // 无匹配：公式估算（黄色）
    estimatedOrders.push({ orderNo, expectedPenalty, actualPenalty: expectedPenalty, confirmed: false });
  });

  return {
    confirmedOrders,
    estimatedOrders,
    remainingPenaltyCount: remainingPool.length,
    remainingPenaltyAmount: remainingPool.reduce((s, a) => s + a, 0),
  };
}

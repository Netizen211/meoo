import { sf } from './index';

export interface OrderFinancialActual {
  orderNo: string;
  baseTechFee: number;
  subTechFee: number;
  shippingInsurance: number;
  penalties: number;
  marketingFees: number;
  netRevenue: number;
  couponIncome: number;
  hasData: boolean;
}

/** 无法关联到订单号的费用汇总 */
export interface UnlinkedFinancials {
  penalties: number;
  marketingFees: number;
  shippingInsurance: number;
  records: { time: string; desc: string; amount: number; type: string }[];
}

const EMPTY_ACTUAL: OrderFinancialActual = {
  orderNo: '',
  baseTechFee: 0,
  subTechFee: 0,
  shippingInsurance: 0,
  penalties: 0,
  marketingFees: 0,
  netRevenue: 0,
  couponIncome: 0,
  hasData: false,
};

const EMPTY_UNLINKED: UnlinkedFinancials = {
  penalties: 0,
  marketingFees: 0,
  shippingInsurance: 0,
  records: [],
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
    const desc = String(r['业务描述'] || '');
    const inc = sf(r['收入金额（+元）'] || r['收入金额(元)'] || r['收入金额'] || 0);
    const exp = sf(r['支出金额（-元）'] || r['支出金额(元)'] || r['支出金额'] || 0);
    const no = String(r['商户订单号'] || '').trim();

    if (!no) {
      // 无订单号的费用归入未关联汇总
      const amount = Math.abs(inc + exp);
      if (desc.startsWith('004')) {
        unlinked.penalties += amount;
        unlinked.records.push({ time: r['发生时间'] || '', desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '罚款' });
      } else if (desc.startsWith('0050002')) {
        unlinked.shippingInsurance += amount;
        unlinked.records.push({ time: r['发生时间'] || '', desc, amount, type: '运费险' });
      } else if (desc.startsWith('006')) {
        unlinked.marketingFees += amount;
        unlinked.records.push({ time: r['发生时间'] || '', desc: desc.split('|').slice(1).join(' / ') || desc, amount, type: '营销费' });
      }
      return;
    }

    if (!map[no]) map[no] = { ...EMPTY_ACTUAL, orderNo: no, hasData: true };

    const entry = map[no];

    if (desc.startsWith('0010002')) {
      entry.netRevenue += inc;
    } else if (desc.startsWith('0010005')) {
      entry.couponIncome += inc;
    } else if (desc.startsWith('0030002')) {
      entry.baseTechFee += inc + exp; // 通常 exp 为负（扣费），inc 为正（返还）
    } else if (desc.startsWith('0030003')) {
      entry.subTechFee += inc + exp;
    } else if (desc.startsWith('004')) {
      entry.penalties += inc + exp;
    } else if (desc.startsWith('0050002')) {
      entry.shippingInsurance += inc + exp;
    } else if (desc.startsWith('006')) {
      entry.marketingFees += inc + exp;
    }
    // 002xxxx（退款相关）不计入，因为退款已经体现在 netRevenue 中
  });

  // 将所有费用转为正数（支出）存储
  Object.values(map).forEach(v => {
    v.baseTechFee = Math.abs(v.baseTechFee);
    v.subTechFee = Math.abs(v.subTechFee);
    v.shippingInsurance = Math.abs(v.shippingInsurance);
    v.penalties = Math.abs(v.penalties);
    v.marketingFees = Math.abs(v.marketingFees);
  });

  return { index: map, unlinked };
}

/** 取每单平台佣金最佳值：actual 技服费优先，否则公式估算 */
export function getBestPlatformFee(
  orderNo: string,
  revenue: number,
  ratePercent: number,
  index: Record<string, OrderFinancialActual>
): number {
  const actual = index[orderNo];
  if (actual?.hasData && (actual.baseTechFee > 0 || actual.subTechFee > 0)) {
    return actual.baseTechFee + actual.subTechFee;
  }
  return revenue * (ratePercent / 100);
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

/** 获取费率校准建议 */
export function getSuggestedCommissionRate(
  index: Record<string, OrderFinancialActual>,
  orders: any[],
  getOrderNo: (o: any) => string,
  getRevenue: (o: any) => number
): { normalRate: number; subsidyRate: number; overallRate: number; normalOrders: number; subsidyOrders: number } {
  let normalTechFee = 0, normalRevenue = 0;
  let subsidyTechFee = 0, subsidyRevenue = 0;
  let normalCount = 0, subsidyCount = 0;

  orders.forEach(o => {
    const no = getOrderNo(o);
    const rev = getRevenue(o);
    if (!no || rev <= 0) return;
    const actual = index[no];
    if (!actual?.hasData) return;

    if (actual.subTechFee > 0) {
      subsidyTechFee += actual.baseTechFee + actual.subTechFee;
      subsidyRevenue += rev;
      subsidyCount++;
    } else if (actual.baseTechFee > 0) {
      normalTechFee += actual.baseTechFee;
      normalRevenue += rev;
      normalCount++;
    }
  });

  return {
    normalRate: normalRevenue > 0 ? (normalTechFee / normalRevenue) * 100 : 0,
    subsidyRate: subsidyRevenue > 0 ? (subsidyTechFee / subsidyRevenue) * 100 : 0,
    overallRate: (normalRevenue + subsidyRevenue) > 0
      ? ((normalTechFee + subsidyTechFee) / (normalRevenue + subsidyRevenue)) * 100
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

  // 2. 建立无订单号扣款池（按金额分组）
  const unlinkedPool: number[] = [];
  unlinkedFinancials.records.forEach(r => {
    // 只取延迟发货/虚假发货的罚款记录
    if (r.type === '罚款') {
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

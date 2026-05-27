// 多店铺数据聚合工具

interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];
  financialRecords: any[];
  availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string>; afterSale: Set<string> };
}

const EMPTY_FIELDS = { csv: new Set<string>(), promotion: new Set<string>(), insurance: new Set<string>(), afterSale: new Set<string>() };

/** 合并所有店铺的业务数据（订单/推广/售后等） */
export function aggregateStoreData(storeDataMap: Record<string, StoreDataItem>): StoreDataItem {
  const storeIds = Object.keys(storeDataMap);
  if (storeIds.length === 0) {
    return { orders: [], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [], afterSaleRecords: [], financialRecords: [], availableFields: EMPTY_FIELDS };
  }
  if (storeIds.length === 1) return storeDataMap[storeIds[0]];

  const result: StoreDataItem = {
    orders: [],
    promotionSummary: [],
    promotionProducts: [],
    starStoreSummary: [],
    liveStreamSummary: [],
    shippingInsurance: [],
    afterSaleRecords: [],
    financialRecords: [],
    availableFields: {
      csv: new Set<string>(),
      promotion: new Set<string>(),
      insurance: new Set<string>(),
      afterSale: new Set<string>(),
    },
  };

  for (const storeId of storeIds) {
    const d = storeDataMap[storeId];
    if (!d) continue;
    result.orders.push(...d.orders);
    result.promotionSummary.push(...d.promotionSummary);
    result.promotionProducts.push(...d.promotionProducts);
    result.starStoreSummary.push(...d.starStoreSummary);
    result.liveStreamSummary.push(...d.liveStreamSummary);
    result.shippingInsurance.push(...d.shippingInsurance);
    result.afterSaleRecords.push(...d.afterSaleRecords);
    result.financialRecords.push(...(d.financialRecords || []));
    d.availableFields.csv.forEach(f => result.availableFields.csv.add(f));
    d.availableFields.promotion.forEach(f => result.availableFields.promotion.add(f));
    d.availableFields.insurance.forEach(f => result.availableFields.insurance.add(f));
    d.availableFields.afterSale.forEach(f => result.availableFields.afterSale.add(f));
  }

  return result;
}

/** 合并所有店铺的简单配置（Record 类型），后续店铺覆盖前面的同名键 */
export function mergeRecordConfigs<T>(configsByStore: Record<string, Record<string, T>>): Record<string, T> {
  const result: Record<string, T> = {};
  for (const storeId of Object.keys(configsByStore)) {
    const config = configsByStore[storeId];
    if (!config) continue;
    Object.assign(result, config);
  }
  return result;
}

/** 合并所有店铺的数组配置（去重），基于 id 字段去重 */
export function mergeArrayConfigs<T extends { id: string }>(configsByStore: Record<string, T[]>): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const storeId of Object.keys(configsByStore)) {
    const items = configsByStore[storeId];
    if (!items) continue;
    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id);
        result.push(item);
      }
    }
  }
  return result;
}

/** 获取所有店铺订单总数（用于加权计算） */
export function getStoreOrderCounts(storeDataMap: Record<string, StoreDataItem>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [storeId, data] of Object.entries(storeDataMap)) {
    counts[storeId] = data?.orders?.length ?? 0;
  }
  return counts;
}

/** 按订单量加权平均费用 */
export function weightedAverageFee(
  feesByStore: Record<string, number>,
  storeDataMap: Record<string, StoreDataItem>
): number {
  let totalWeight = 0;
  let weightedSum = 0;
  for (const [storeId, fee] of Object.entries(feesByStore)) {
    const weight = storeDataMap[storeId]?.orders?.length ?? 0;
    weightedSum += fee * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/** 合并所有店铺的异常订单记录 */
export function mergeAbnormalOrders(
  ordersByStore: Record<string, Record<string, any>>
): Record<string, any> {
  const result: Record<string, any> = {};
  for (const storeId of Object.keys(ordersByStore)) {
    Object.assign(result, ordersByStore[storeId]);
  }
  return result;
}

/** 判断是否为"全部店铺"模式 */
export const ALL_STORES_ID = '__all__';
export function isAllStores(filter: string): boolean {
  return filter === ALL_STORES_ID;
}

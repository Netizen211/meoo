/**
 * 强制数据同步恢复 — 从服务器拉取全量数据并写入本地
 * ★ 修复：之前只检查订单数，现在真正拉取原始数据
 */
import { apiClient } from '../../api/client';
import { pullStoreData } from '../../api/dataApi';

export interface SyncResult {
  success: boolean;
  storesFound: number;
  storesRecovered: number;
  details: { storeId: string; storeName: string; orders: number; recordsLoaded: number }[];
  data?: Record<string, any>;  // ★ 返回拉取的原始数据供调用方写入 store
  error?: string;
}

export async function forceSyncFromServer(): Promise<SyncResult> {
  const result: SyncResult = { success: false, storesFound: 0, storesRecovered: 0, details: [], data: {} };
  try {
    const storesRes = await apiClient.get<{ id: string; name: string }[]>('/stores');
    if (!storesRes.success || !storesRes.data?.length) {
      result.error = '没有找到店铺数据';
      return result;
    }
    result.storesFound = storesRes.data.length;

    // ★ 逐个拉取店铺全量数据（原始订单 + 推广 + 售后 + 财务）
    for (const store of storesRes.data) {
      try {
        const pullRes = await pullStoreData(store.id);
        let totalRecords = 0;
        if (pullRes?.data) {
          const d = pullRes.data;
          totalRecords = (d.orders?.length || 0) + (d.promotionSummary?.length || 0) +
            (d.afterSaleRecords?.length || 0) + (d.financialRecords?.length || 0);
          result.data![store.id] = d;
        }
        const orders = pullRes?.data?.orders?.length || 0;
        result.details.push({ storeId: store.id, storeName: store.name, orders, recordsLoaded: totalRecords });
        if (orders > 0) result.storesRecovered++;
      } catch {
        result.details.push({ storeId: store.id, storeName: store.name, orders: 0, recordsLoaded: 0 });
      }
    }
    result.success = true;
    return result;
  } catch (e: any) {
    result.error = e?.message || '同步失败';
    return result;
  }
}

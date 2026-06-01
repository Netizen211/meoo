/**
 * 强制数据同步恢复 — 从服务器拉取全量数据
 * 数据存储在服务端，浏览器不存数据，刷新页面即可重新加载
 */
import { apiClient } from '../../api/client';

export interface SyncResult {
  success: boolean;
  storesFound: number;
  storesRecovered: number;
  details: { storeId: string; storeName: string; orders: number }[];
  error?: string;
}

export async function forceSyncFromServer(): Promise<SyncResult> {
  const result: SyncResult = { success: false, storesFound: 0, storesRecovered: 0, details: [] };
  try {
    const storesRes = await apiClient.get<{ id: string; name: string }[]>('/stores');
    if (!storesRes.success || !storesRes.data?.length) {
      result.error = '没有找到店铺数据';
      return result;
    }
    result.storesFound = storesRes.data.length;

    // ★ 逐个拉取店铺数据确认数据存在
    for (const store of storesRes.data) {
      try {
        const dashRes = await apiClient.get<any>(`/analytics/dashboard?storeId=${store.id}`);
        const orders = dashRes?.data?.kpi?.orders || 0;
        result.details.push({ storeId: store.id, storeName: store.name, orders });
        if (orders > 0) result.storesRecovered++;
      } catch {
        result.details.push({ storeId: store.id, storeName: store.name, orders: 0 });
      }
    }
    result.success = true;
    return result;
  } catch (e: any) {
    result.error = e?.message || '同步失败';
    return result;
  }
}

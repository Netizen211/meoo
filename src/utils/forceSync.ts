/**
 * 强制数据同步恢复 — 从服务器拉取全量数据覆盖本地
 * 用于修复数据不一致、数据丢失、导入成功但无显示等问题
 */
import { apiClient } from '../api/client';
import { pullStoreData } from '../api/dataApi';

export interface SyncResult {
  success: boolean;
  storesFound: number;
  storesRecovered: number;
  details: { storeId: string; storeName: string; orders: number; promo: number; afterSale: number; insurance: number; financial: number }[];
  error?: string;
}

export async function forceSyncFromServer(): Promise<SyncResult> {
  const result: SyncResult = { success: false, storesFound: 0, storesRecovered: 0, details: [] };

  try {
    // 1. 拉取店铺列表
    const storesRes = await apiClient.get<{ id: string; name: string; createdAt: string }[]>('/stores');
    if (!storesRes.success || !storesRes.data?.length) {
      result.error = '服务器上没有找到店铺数据';
      return result;
    }

    result.storesFound = storesRes.data.length;

    // 2. 逐个店铺拉取全量数据
    for (const store of storesRes.data) {
      const serverData = await pullStoreData(store.id);
      const detail = { storeId: store.id, storeName: store.name, orders: 0, promo: 0, afterSale: 0, insurance: 0, financial: 0 };

      if (serverData?.data) {
        const sd = serverData.data;

        // 保存到 localStorage（与 App.tsx initStore 格式完全一致）
        const storeDataForSave = {
          orders: sd.orders || [],
          promotionSummary: sd.promotionSummary || [],
          promotionProducts: sd.promotionProducts || [],
          starStoreSummary: sd.starStoreSummary || [],
          liveStreamSummary: sd.liveStreamSummary || [],
          shippingInsurance: sd.shippingInsurance || [],
          afterSaleRecords: sd.afterSaleRecords || [],
          financialRecords: sd.financialRecords || [],
          availableFields: {
            csv: Array.isArray(sd.availableFields?.csv) ? sd.availableFields.csv : [],
            promotion: Array.isArray(sd.availableFields?.promotion) ? sd.availableFields.promotion : [],
            insurance: Array.isArray(sd.availableFields?.insurance) ? sd.availableFields.insurance : [],
            afterSale: Array.isArray(sd.availableFields?.afterSale) ? sd.availableFields.afterSale : [],
          }
        };

        // 写入 store_data_map（与数据导入格式一致）
        const existingMap = JSON.parse(localStorage.getItem('dianfx_store_data_map') || '{}');
        existingMap[store.id] = storeDataForSave;
        localStorage.setItem('dianfx_store_data_map', JSON.stringify(existingMap));

        // 恢复配置（成本、费用等）
        if (serverData.configs) {
          for (const [key, value] of Object.entries(serverData.configs)) {
            localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
          }
        }

        detail.orders = sd.orders?.length || 0;
        detail.promo = (sd.promotionSummary?.length || 0) + (sd.promotionProducts?.length || 0);
        detail.afterSale = sd.afterSaleRecords?.length || 0;
        detail.insurance = sd.shippingInsurance?.length || 0;
        detail.financial = sd.financialRecords?.length || 0;

        result.storesRecovered++;
      }

      result.details.push(detail);
    }

    // 3. 确保店铺列表同步到 localStorage
    const storeList = storesRes.data.map(s => ({ id: s.id, name: s.name, createdAt: s.createdAt }));
    localStorage.setItem('dianfx_stores', JSON.stringify(storeList));

    // 4. 设置当前店铺（如果没有）
    if (storesRes.data[0] && !localStorage.getItem('dianfx_data_filter')) {
      localStorage.setItem('dianfx_data_filter', storesRes.data[0].id);
      localStorage.setItem('dianfx_current_store', JSON.stringify(storesRes.data[0]));
    }

    result.success = true;
    return result;
  } catch (e: any) {
    result.error = e.message || '网络连接失败，无法访问服务器';
    return result;
  }
}

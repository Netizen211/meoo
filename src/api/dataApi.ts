import { apiClient } from './client';

// 同步店铺数据到服务器
export async function syncStoreData(storeId: string, storeName: string, data: any, configs: Record<string, any>, uploadRecords: any[]): Promise<boolean> {
  const res = await apiClient.post('/data/sync', {
    storeId,
    storeName,
    clientUpdatedAt: new Date().toISOString(),
    data,
    configs,
    uploadRecords,
  });
  return res.success;
}

// 从服务器拉取店铺数据
export async function pullStoreData(storeId: string): Promise<{
  data: any;
  configs: Record<string, any>;
  uploadRecords: any[];
  lastSyncedAt: string;
} | null> {
  const res = await apiClient.post('/data/pull', { storeId });
  if (res.success && res.data) {
    return res.data;
  }
  return null;
}

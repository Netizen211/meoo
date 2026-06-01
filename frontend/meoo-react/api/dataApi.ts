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

// ★ 清除指定店铺的指定分类数据
export async function clearStoreDataCategory(storeId: string, category: string): Promise<boolean> {
  const res = await apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/category/${encodeURIComponent(category)}`);
  return res.success;
}

// ★ 清除指定店铺的配置
export async function clearStoreConfigs(storeId: string): Promise<boolean> {
  const res = await apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/configs`);
  return res.success;
}

// ★ 清除指定店铺的上传记录
export async function clearStoreUploads(storeId: string): Promise<boolean> {
  const res = await apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/uploads`);
  return res.success;
}

// ★ 清除当前用户所有数据
export async function clearAllUserData(): Promise<boolean> {
  const res = await apiClient.post('/data/clear-all');
  return res.success;
}

// ★ 单条配置即时同步（毫秒级，fire-and-forget）
// 用户操作后立即调用，UI 不等待响应
export function syncStoreConfig(storeId: string, configKey: string, value: any): void {
  const payloadJson = typeof value === 'string' ? value : JSON.stringify(value);
  apiClient.post('/data/config', { storeId, configKey, payloadJson }).catch(() => {});
}

// ★ 增量同步：只发送非空分类的数据（大幅减少上传体积）
// UploadPage 上传新文件时调用此函数，不发送已有数据
export async function syncStoreDelta(
  storeId: string,
  storeName: string,
  deltaCategories: Record<string, any[]>,
  configs?: Record<string, any>,
  uploadRecords?: any[]
): Promise<{ success: boolean; mergeStats?: Record<string, { added: number; skipped: number; total: number }> }> {
  // 构造最小 payload：只包含有数据的分类
  const data: Record<string, any[]> = {};
  for (const [key, value] of Object.entries(deltaCategories)) {
    if (Array.isArray(value) && value.length > 0) {
      data[key] = value;
    }
  }

  const res = await apiClient.post<{
    syncedAt: string;
    mergeStats: Record<string, { added: number; skipped: number; total: number }>;
  }>('/data/sync', {
    storeId,
    storeName,
    clientUpdatedAt: new Date().toISOString(),
    data,
    configs: configs || {},
    uploadRecords: uploadRecords || [],
  });

  return {
    success: res.success,
    mergeStats: res.data?.mergeStats,
  };
}

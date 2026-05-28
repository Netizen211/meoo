// IndexedDB 本地存储服务
// 所有商家数据（订单/推广/售后/运费险/财务等）存在浏览器 IndexedDB
// 替代之前大量使用 localStorage 的方式，解决 5-10MB 限制

const DB_NAME = 'dianfx_data';
const DB_VERSION = 1;

interface StoreSchema {
  storeData: { key: string; value: any };           // key = storeId, value = StoreDataItem
  productCosts: { key: string; value: Record<string, number> }; // key = storeId
  costConfigs: { key: string; value: Record<string, any> };
  packagingFee: { key: string; value: number };
  pricingPresets: { key: string; value: any[] };
  taxConfigs: { key: string; value: any[] };
  customDeductions: { key: string; value: any[] };
  defaultCostRatio: { key: string; value: number };
  shippingFee: { key: string; value: number };
  platformCommission: { key: string; value: number };
  laborFee: { key: string; value: number };
  insuranceFee: { key: string; value: number };
  abnormalOrders: { key: string; value: Record<string, any> };
  costHistory: { key: string; value: any[] };
  uploadRecords: { key: string; value: any[] };
}

type StoreName = keyof StoreSchema;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      const storeNames: StoreName[] = [
        'storeData', 'productCosts', 'costConfigs', 'packagingFee',
        'pricingPresets', 'taxConfigs', 'customDeductions',
        'defaultCostRatio', 'shippingFee', 'platformCommission',
        'laborFee', 'insuranceFee', 'abnormalOrders', 'costHistory',
        'uploadRecords',
      ];
      for (const name of storeNames) {
        if (!db.objectStoreNames.contains(name)) {
          db.createObjectStore(name);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

async function getStore(storeName: StoreName, mode: IDBTransactionMode = 'readonly') {
  const db = await openDB();
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

// ===== 通用 CRUD =====

export async function getItem<T = any>(storeName: StoreName, key: string): Promise<T | null> {
  try {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] getItem error (${storeName}/${key}):`, err);
    return null;
  }
}

export async function setItem<T = any>(storeName: StoreName, key: string, value: T): Promise<void> {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] setItem error (${storeName}/${key}):`, err);
  }
}

export async function removeItem(storeName: StoreName, key: string): Promise<void> {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] removeItem error (${storeName}/${key}):`, err);
  }
}

export async function getAllKeys(storeName: StoreName): Promise<string[]> {
  try {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve(req.result as string[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] getAllKeys error (${storeName}):`, err);
    return [];
  }
}

export async function getAllValues<T = any>(storeName: StoreName): Promise<T[]> {
  try {
    const store = await getStore(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] getAllValues error (${storeName}):`, err);
    return [];
  }
}

export async function clearStore(storeName: StoreName): Promise<void> {
  try {
    const store = await getStore(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error(`[IDB] clearStore error (${storeName}):`, err);
  }
}

// ===== 迁移旧的 localStorage 数据到 IndexedDB =====

export async function migrateFromLocalStorage(): Promise<{
  migrated: boolean;
  storeCount: number;
}> {
  try {
    // 检查是否已经迁移过
    const migrated = localStorage.getItem('dianfx_idb_migrated');
    if (migrated === 'v1') return { migrated: false, storeCount: 0 };

    let storeCount = 0;

    // 迁移 storeData
    const storeDataMap = localStorage.getItem('dianfx_store_data_map');
    if (storeDataMap) {
      try {
        const data = JSON.parse(storeDataMap);
        const storeIds = Object.keys(data);
        for (const storeId of storeIds) {
          const storeData = data[storeId];
          // 将 Set 转回数组存储
          if (storeData.availableFields) {
            const af = storeData.availableFields;
            storeData.availableFields = {
              csv: Array.isArray(af.csv) ? af.csv : [],
              promotion: Array.isArray(af.promotion) ? af.promotion : [],
              insurance: Array.isArray(af.insurance) ? af.insurance : [],
              afterSale: Array.isArray(af.afterSale) ? af.afterSale : [],
            };
          }
          await setItem('storeData', storeId, storeData);
          storeCount++;
        }
      } catch (e) {
        console.warn('[IDB] migrate storeData failed:', e);
      }
    }

    // 迁移分片存储的数据
    const perStoreKeys = [
      'dianfx_store_',
    ];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      for (const prefix of perStoreKeys) {
        if (key.startsWith(prefix)) {
          const storeId = key.slice(prefix.length);
          try {
            const val = JSON.parse(localStorage.getItem(key)!);
            await setItem('storeData', storeId, val);
            storeCount++;
          } catch {}
        }
      }
    }

    // 迁移各类配置（key = storeId, value = 配置数据）
    const configMigrations: { lsPrefix: string; storeName: StoreName; parseJson: boolean }[] = [
      { lsPrefix: 'dianfx_product_costs_', storeName: 'productCosts', parseJson: true },
      { lsPrefix: 'dianfx_cost_configs_', storeName: 'costConfigs', parseJson: true },
      { lsPrefix: 'dianfx_packaging_fee_', storeName: 'packagingFee', parseJson: false },
      { lsPrefix: 'dianfx_pricing_presets_', storeName: 'pricingPresets', parseJson: true },
      { lsPrefix: 'dianfx_tax_configs_', storeName: 'taxConfigs', parseJson: true },
      { lsPrefix: 'dianfx_custom_deductions_', storeName: 'customDeductions', parseJson: true },
      { lsPrefix: 'dianfx_default_cost_ratio_', storeName: 'defaultCostRatio', parseJson: false },
      { lsPrefix: 'dianfx_shipping_fee_', storeName: 'shippingFee', parseJson: false },
      { lsPrefix: 'dianfx_platform_commission_', storeName: 'platformCommission', parseJson: false },
      { lsPrefix: 'dianfx_labor_fee_', storeName: 'laborFee', parseJson: false },
      { lsPrefix: 'dianfx_insurance_fee_', storeName: 'insuranceFee', parseJson: false },
      { lsPrefix: 'dianfx_abnormal_orders_', storeName: 'abnormalOrders', parseJson: true },
      { lsPrefix: 'dianfx_cost_history_', storeName: 'costHistory', parseJson: true },
    ];

    for (const { lsPrefix, storeName, parseJson } of configMigrations) {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(lsPrefix)) {
          const storeId = key.slice(lsPrefix.length);
          try {
            const raw = localStorage.getItem(key)!;
            const val = parseJson ? JSON.parse(raw) : parseFloat(raw);
            if (parseJson || !isNaN(val)) {
              await setItem(storeName, storeId, val);
            }
          } catch {}
        }
      }
    }

    // 迁移 uploadRecords
    const uploadRecordsRaw = localStorage.getItem('dianfx_upload_records');
    if (uploadRecordsRaw) {
      try {
        await setItem('uploadRecords', '__all__', JSON.parse(uploadRecordsRaw));
      } catch {}
    }

    // 标记迁移完成
    localStorage.setItem('dianfx_idb_migrated', 'v1');
    console.log(`[IDB] Migration complete: ${storeCount} stores migrated`);
    return { migrated: true, storeCount };
  } catch (err) {
    console.error('[IDB] Migration error:', err);
    return { migrated: false, storeCount: 0 };
  }
}

// ===== 清除所有 IndexedDB 数据 =====
export async function clearAllData(): Promise<void> {
  const storeNames: StoreName[] = [
    'storeData', 'productCosts', 'costConfigs', 'packagingFee',
    'pricingPresets', 'taxConfigs', 'customDeductions',
    'defaultCostRatio', 'shippingFee', 'platformCommission',
    'laborFee', 'insuranceFee', 'abnormalOrders', 'costHistory',
    'uploadRecords',
  ];
  for (const name of storeNames) {
    await clearStore(name);
  }
  localStorage.removeItem('dianfx_idb_migrated');
}

// ===== 检查 IndexedDB 是否可用 =====
export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined';
  } catch {
    return false;
  }
}

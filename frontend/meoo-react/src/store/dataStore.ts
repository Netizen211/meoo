/**
 * DataStore - Zustand + persist
 * localStorage 自动持久化, 刷新零时差恢复
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { pullStoreData, syncStoreData } from '../../api/dataApi';

// ★ 安全 localStorage 包装：写入失败（如超配额）不崩溃页面
const safeStorage = {
  getItem: (name: string): string | null => {
    try { return localStorage.getItem(name); } catch { return null; }
  },
  setItem: (name: string, value: string): void => {
    try { localStorage.setItem(name, value); } catch (e) {
      // 静默失败，不崩溃页面
      console.warn(`[DataStore] localStorage 写入失败: ${name}`);
    }
  },
  removeItem: (name: string): void => {
    try { localStorage.removeItem(name); } catch {}
  },
};

export interface StoreDataItem {
  orders: any[]; promotionSummary: any[]; promotionProducts: any[];
  starStoreSummary: any[]; liveStreamSummary: any[]; shippingInsurance: any[];
  afterSaleRecords: any[]; financialRecords: any[];
  availableFields: { csv: string[]; promotion: string[]; insurance: string[]; afterSale: string[]; financial: string[] };
}


// ─── 店铺配置类型（持久化到 localStorage） ──────────────
export interface ConfigStoreData {
  productCostsByStore: Record<string, Record<string, number>>;
  costConfigsByStore: Record<string, Record<string, any>>;
  packagingFeeByStore: Record<string, number>;
  pricingPresetsByStore: Record<string, any[]>;
  taxConfigsByStore: Record<string, any[]>;
  customDeductionsByStore: Record<string, any[]>;
  defaultCostRatioByStore: Record<string, number>;
  shippingFeeByStore: Record<string, number>;
  platformCommissionByStore: Record<string, number>;
  laborFeeByStore: Record<string, number>;
  insuranceFeeByStore: Record<string, number>;
  promotionFeeByStore: Record<string, number>;
  subsidyCommissionByStore: Record<string, number>;
  abnormalOrdersByStore: Record<string, Record<string, any>>;
  costHistoryByStore: Record<string, any[]>;
}

export interface UploadRecord {
  id: string; storeId: string; storeName: string;
  fileName: string; fileType: string; rowCount: number;
  uploadedAt: string; fieldCount?: number; categories?: string[];
}

interface DataState extends ConfigStoreData {
  storeDataMap: Record<string, StoreDataItem>;
  uploadRecords: UploadRecord[];
  dataLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'done' | 'error';
  /** 存储模式：cloud=同步服务器，local=仅本地 */
  storageMode: Record<string, 'cloud' | 'local'>;
  setStorageMode: (storeId: string, mode: 'cloud' | 'local') => void;
  setLocalData: (storeId: string, dataOrUpdater: StoreDataItem | ((prev: StoreDataItem | null) => StoreDataItem)) => void;
  /** ★ 批量写入（刷新恢复 / 服务器数据合并） */
  bulkSetStoreData: (dataMap: Record<string, StoreDataItem>) => void;
  /** ★ 替换单个店铺全部数据（服务器确认覆盖） */
  replaceStoreForId: (storeId: string, data: StoreDataItem) => void;
  syncToServer: (storeId: string, storeName: string, uploadRecords?: UploadRecord[], categories?: string[]) => Promise<boolean>;
  loadAllFromServer: (storeIds: string[]) => Promise<void>;
  clearStore: (storeId: string) => void;
  /** ★ 替换全部上传记录 */
  setUploadRecords: (records: UploadRecord[]) => void;
  /** ★ 增量添加/更新上传记录 */
  addUploadRecord: (record: UploadRecord) => void;
  /** ★ 删除单条上传记录 */
  removeUploadRecord: (recordId: string) => void;
  /** ★ 按 storeId 清除上传记录 */
  clearStoreUploads: (storeId: string) => void;
  /** ★ 清空所有上传记录 */
  clearAllUploads: () => void;
  /** ★ 设置加载状态 */
  setDataLoadingState: (loading: boolean) => void;
  /** ★ 重置全部数据 */
  resetAll: () => void;
  /** ★ 最近一次同步的失败原因（上传页提示用） */
  lastSyncError: string | null;
  lastPrivacyNotice: string | null;
  clearSyncError: () => void;
  // ─── 配置持久化 Actions ──────────────────────────
  setProductCosts: (storeId: string, data: Record<string, number>) => void;
  setCostConfigs: (storeId: string, data: Record<string, any>) => void;
  setPackagingFee: (storeId: string, val: number) => void;
  setPricingPresets: (storeId: string, data: any[]) => void;
  setTaxConfigs: (storeId: string, data: any[]) => void;
  setCustomDeductions: (storeId: string, data: any[]) => void;
  setDefaultCostRatio: (storeId: string, val: number) => void;
  setShippingFee: (storeId: string, val: number) => void;
  setPlatformCommission: (storeId: string, val: number) => void;
  setLaborFee: (storeId: string, val: number) => void;
  setInsuranceFee: (storeId: string, val: number) => void;
  setPromotionFee: (storeId: string, val: number) => void;
  setSubsidyCommission: (storeId: string, val: number) => void;
  setAbnormalOrders: (storeId: string, data: Record<string, any>) => void;
  setCostHistory: (storeId: string, data: any[]) => void;
  removeStoreConfigs: (storeId: string) => void;
  resetAllConfigs: () => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      storeDataMap: {},
      uploadRecords: [],
      dataLoading: false,
      syncStatus: 'idle',
      storageMode: {},
      lastSyncError: null,
      lastPrivacyNotice: null,
      // ─── 配置持久化初始值 ──────
      productCostsByStore: {},
      costConfigsByStore: {},
      packagingFeeByStore: {},
      pricingPresetsByStore: {},
      taxConfigsByStore: {},
      customDeductionsByStore: {},
      defaultCostRatioByStore: {},
      shippingFeeByStore: {},
      platformCommissionByStore: {},
      laborFeeByStore: {},
      insuranceFeeByStore: {},
      promotionFeeByStore: {},
      subsidyCommissionByStore: {},
      abnormalOrdersByStore: {},
      costHistoryByStore: {},

      setLocalData: (storeId, dataOrUpdater) => {
        set(state => {
          const prev = state.storeDataMap[storeId] || null;
          const newData = typeof dataOrUpdater === 'function' ? dataOrUpdater(prev) : dataOrUpdater;
          return { storeDataMap: { ...state.storeDataMap, [storeId]: newData } };
        });
      },

      bulkSetStoreData: (dataMap) => set(state => ({
        storeDataMap: { ...dataMap, ...state.storeDataMap } // existing state wins over local restore
      })),

      replaceStoreForId: (storeId, data) => set(state => ({
        storeDataMap: { ...state.storeDataMap, [storeId]: data }
      })),

      syncToServer: async (storeId, storeName, uploads, categories) => {
        // ★ 本地模式：不同步到服务器
        if (get().storageMode[storeId] === 'local') { set({ syncStatus: 'done' }); return true; }
        const data = get().storeDataMap[storeId];
        if (!data) return false;
        set({ syncStatus: 'syncing' });
        // ★ 隐私字段自动剥离
        const PRIVACY = ['收货人','收货人姓名','收件人','收货人手机','收货人电话','手机号','买家手机','收货地址','详细地址','街道/镇','街道','镇','区','买家留言','商家备注'];
        const strippedFields: string[] = [];
        const strip = (rows: any[]) => rows.map(row => {
          const clean: any = {};
          Object.keys(row).forEach(k => {
            if (PRIVACY.includes(k)) {
              if (!strippedFields.includes(k)) strippedFields.push(k);
            } else clean[k] = row[k];
          });
          return clean;
        });
        // ★ 增量同步：只发送指定 categories（或全部）
        const ALL_CATS = ['orders','promotionSummary','promotionProducts','starStoreSummary','liveStreamSummary','shippingInsurance','afterSaleRecords','financialRecords'];
        const catsToSync = categories && categories.length > 0 ? categories : ALL_CATS;
        const slim: Record<string, any[]> = {};
        catsToSync.forEach(cat => {
          if (ALL_CATS.includes(cat) && Array.isArray((data as any)[cat]) && (data as any)[cat].length > 0) {
            slim[cat] = (cat === 'orders' || cat === 'afterSaleRecords')
              ? strip((data as any)[cat])
              : (data as any)[cat];
          }
        });
        if (strippedFields.length > 0) {
          set({ lastSyncError: null, lastPrivacyNotice: `已自动去除 ${strippedFields.length} 个隐私字段：${strippedFields.join('、')}` });
        }
        // ★ 同步 availableFields，刷新后字段列表不丢失
        if (data.availableFields) {
          (slim as any).availableFields = data.availableFields;
        }
        const currentUploads = uploads || get().uploadRecords;
        try {
          const res = await syncStoreData(storeId, storeName, slim as any, {}, currentUploads);
          if (res.success) {
            set({ syncStatus: 'done', lastSyncError: null });
            return true;
          } else {
            set({ syncStatus: 'error', lastSyncError: res.error || '同步失败' });
            return false;
          }
        } catch(e: any) {
          set({ syncStatus: 'error', lastSyncError: e?.message || '网络请求失败' });
          return false;
        }
      },

      loadAllFromServer: async (storeIds) => {
        set({ dataLoading: true });
        const results = await Promise.all(storeIds.map(async id => {
          try {
            const sd = await pullStoreData(id);
            return sd?.data ? { id, data: sd.data } : null;
          } catch { return null; }
        }));
        set(state => {
          const next = { ...state.storeDataMap };
          results.forEach(r => {
            if (!r) return;
            const d = r.data;
            next[r.id] = {
              orders: d.orders || [], promotionSummary: d.promotionSummary || [],
              promotionProducts: d.promotionProducts || [], starStoreSummary: d.starStoreSummary || [],
              liveStreamSummary: d.liveStreamSummary || [], shippingInsurance: d.shippingInsurance || [],
              afterSaleRecords: d.afterSaleRecords || [], financialRecords: d.financialRecords || [],
              availableFields: { csv: Array.isArray(d.availableFields?.csv)?d.availableFields.csv:[], promotion: Array.isArray(d.availableFields?.promotion)?d.availableFields.promotion:[], insurance: Array.isArray(d.availableFields?.insurance)?d.availableFields.insurance:[], afterSale: Array.isArray(d.availableFields?.afterSale)?d.availableFields.afterSale:[], financial: Array.isArray(d.availableFields?.financial)?d.availableFields.financial:[] },
            };
          });
          return { storeDataMap: next, dataLoading: false };
        });
      },

      clearStore: (storeId) => set(state => {
        const next = { ...state.storeDataMap };
        delete next[storeId];
        return { storeDataMap: next };
      }),
      /** ★ 重置全部数据（清空所有店铺 + 上传记录） */
      resetAll: () => set({ storeDataMap: {}, uploadRecords: [], syncStatus: 'idle' }),

      setUploadRecords: (records) => set({ uploadRecords: records }),
      addUploadRecord: (record) => set(state => ({
        uploadRecords: [...state.uploadRecords.filter(r => r.id !== record.id), record]
      })),
      removeUploadRecord: (recordId) => set(state => ({
        uploadRecords: state.uploadRecords.filter(r => r.id !== recordId)
      })),
      clearStoreUploads: (storeId) => set(state => ({
        uploadRecords: state.uploadRecords.filter(r => r.storeId !== storeId)
      })),
      clearAllUploads: () => set({ uploadRecords: [] }),
      setDataLoadingState: (loading) => set({ dataLoading: loading }),
      clearSyncError: () => set({ lastSyncError: null }),
      setStorageMode: (storeId, mode) => set(state => ({ storageMode: { ...state.storageMode, [storeId]: mode } })),
      setProductCosts: (storeId, data) => set(state => ({ productCostsByStore: { ...state.productCostsByStore, [storeId]: data } })),
      setCostConfigs: (storeId, data) => set(state => ({ costConfigsByStore: { ...state.costConfigsByStore, [storeId]: data } })),
      setPackagingFee: (storeId, val) => set(state => ({ packagingFeeByStore: { ...state.packagingFeeByStore, [storeId]: val } })),
      setPricingPresets: (storeId, data) => set(state => ({ pricingPresetsByStore: { ...state.pricingPresetsByStore, [storeId]: data } })),
      setTaxConfigs: (storeId, data) => set(state => ({ taxConfigsByStore: { ...state.taxConfigsByStore, [storeId]: data } })),
      setCustomDeductions: (storeId, data) => set(state => ({ customDeductionsByStore: { ...state.customDeductionsByStore, [storeId]: data } })),
      setDefaultCostRatio: (storeId, val) => set(state => ({ defaultCostRatioByStore: { ...state.defaultCostRatioByStore, [storeId]: val } })),
      setShippingFee: (storeId, val) => set(state => ({ shippingFeeByStore: { ...state.shippingFeeByStore, [storeId]: val } })),
      setPlatformCommission: (storeId, val) => set(state => ({ platformCommissionByStore: { ...state.platformCommissionByStore, [storeId]: val } })),
      setLaborFee: (storeId, val) => set(state => ({ laborFeeByStore: { ...state.laborFeeByStore, [storeId]: val } })),
      setInsuranceFee: (storeId, val) => set(state => ({ insuranceFeeByStore: { ...state.insuranceFeeByStore, [storeId]: val } })),
      setPromotionFee: (storeId, val) => set(state => ({ promotionFeeByStore: { ...state.promotionFeeByStore, [storeId]: val } })),
      setSubsidyCommission: (storeId, val) => set(state => ({ subsidyCommissionByStore: { ...state.subsidyCommissionByStore, [storeId]: val } })),
      setAbnormalOrders: (storeId, data) => set(state => ({ abnormalOrdersByStore: { ...state.abnormalOrdersByStore, [storeId]: data } })),
      setCostHistory: (storeId, data) => set(state => ({ costHistoryByStore: { ...state.costHistoryByStore, [storeId]: data } })),
      removeStoreConfigs: (storeId) => set(state => {
        const ns = {
          productCostsByStore: { ...state.productCostsByStore },
          costConfigsByStore: { ...state.costConfigsByStore },
          packagingFeeByStore: { ...state.packagingFeeByStore },
          pricingPresetsByStore: { ...state.pricingPresetsByStore },
          taxConfigsByStore: { ...state.taxConfigsByStore },
          customDeductionsByStore: { ...state.customDeductionsByStore },
          defaultCostRatioByStore: { ...state.defaultCostRatioByStore },
          shippingFeeByStore: { ...state.shippingFeeByStore },
          platformCommissionByStore: { ...state.platformCommissionByStore },
          laborFeeByStore: { ...state.laborFeeByStore },
          insuranceFeeByStore: { ...state.insuranceFeeByStore },
          promotionFeeByStore: { ...state.promotionFeeByStore },
          subsidyCommissionByStore: { ...state.subsidyCommissionByStore },
          abnormalOrdersByStore: { ...state.abnormalOrdersByStore },
          costHistoryByStore: { ...state.costHistoryByStore },
        };
        (Object.keys(ns) as (keyof typeof ns)[]).forEach(k => { delete ns[k][storeId]; });
        return ns;
      }),
      resetAllConfigs: () => set({
        productCostsByStore: {}, costConfigsByStore: {}, packagingFeeByStore: {}, pricingPresetsByStore: {},
        taxConfigsByStore: {}, customDeductionsByStore: {}, defaultCostRatioByStore: {}, shippingFeeByStore: {},
        platformCommissionByStore: {}, laborFeeByStore: {}, insuranceFeeByStore: {}, promotionFeeByStore: {},
        subsidyCommissionByStore: {},
        abnormalOrdersByStore: {}, costHistoryByStore: {},
      }),
    }),
    {
      name: 'meoo-data-store',
      version: 4,  // ★ v4: 清除旧的大数据缓存，防止 QuotaExceededError。只持久化配置项，订单数据从服务器加载
      storage: createJSONStorage(() => safeStorage),
      // ★ 不持久化订单数据（占用太大，超 5MB localStorage 上限会崩溃）
      //   只持久化配置项，订单数据从服务器加载或内存中保留
      partialize: (state) => ({
        uploadRecords: state.uploadRecords,
        storageMode: state.storageMode,
        lastSyncError: state.lastSyncError,
        lastPrivacyNotice: state.lastPrivacyNotice,
        productCostsByStore: state.productCostsByStore,
        costConfigsByStore: state.costConfigsByStore,
        packagingFeeByStore: state.packagingFeeByStore,
        pricingPresetsByStore: state.pricingPresetsByStore,
        taxConfigsByStore: state.taxConfigsByStore,
        customDeductionsByStore: state.customDeductionsByStore,
        defaultCostRatioByStore: state.defaultCostRatioByStore,
        shippingFeeByStore: state.shippingFeeByStore,
        platformCommissionByStore: state.platformCommissionByStore,
        laborFeeByStore: state.laborFeeByStore,
        insuranceFeeByStore: state.insuranceFeeByStore,
        promotionFeeByStore: state.promotionFeeByStore,
        subsidyCommissionByStore: state.subsidyCommissionByStore,
        abnormalOrdersByStore: state.abnormalOrdersByStore,
        costHistoryByStore: state.costHistoryByStore,
      }),
    }
  )
);

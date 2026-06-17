import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import MainLayout from './components/MainLayout';
import { PermissionProvider } from './context/PermissionContext';
import { LayoutProvider } from './context/LayoutContext';
import { Database, BarChart3, Loader2 } from 'lucide-react';
import { Toaster } from './components/ui/toast';
import ProtectionProvider from './protection/ProtectionProvider';
import { initTracker, trackPageView } from './services/tracker';
import { useDarkMode } from './hooks/useDarkMode';
import { useAutoReload } from './utils/useAutoReload';

// ★ 代码分割：按路由懒加载（首屏只加载当前页面代码，其余按需加载）
const AuthPage = lazy(() => import(/* webpackChunkName: "AuthPage" */ './pages/AuthPage'));
const StoresPage = lazy(() => import(/* webpackChunkName: "StoresPage" */ './pages/StoresPage'));
const UploadPage = lazy(() => import(/* webpackChunkName: "UploadPage" */ './pages/UploadPage'));
const DashboardPage = lazy(() => import(/* webpackChunkName: "DashboardPage" */ './pages/DashboardPage'));
const CostManagementPage = lazy(() => import(/* webpackChunkName: "CostManagementPage" */ './pages/CostManagementPage'));
const ProductPage = lazy(() => import(/* webpackChunkName: "ProductPage" */ './pages/ProductPage'));
const UserPage = lazy(() => import(/* webpackChunkName: "UserPage" */ './pages/UserPage'));
const TrendPage = lazy(() => import(/* webpackChunkName: "TrendPage" */ './pages/TrendPage'));
const RegionPage = lazy(() => import(/* webpackChunkName: "RegionPage" */ './pages/RegionPage'));
const LogisticsPage = lazy(() => import(/* webpackChunkName: "LogisticsPage" */ './pages/LogisticsPage'));
const CostPage = lazy(() => import(/* webpackChunkName: "CostPage" */ './pages/CostPage'));
const AfterSalePage = lazy(() => import(/* webpackChunkName: "AfterSalePage" */ './pages/AfterSalePage'));
const InsurancePage = lazy(() => import(/* webpackChunkName: "InsurancePage" */ './pages/InsurancePage'));
const PromotionPage = lazy(() => import(/* webpackChunkName: "PromotionPage" */ './pages/PromotionPage'));
const RiskPage = lazy(() => import(/* webpackChunkName: "RiskPage" */ './pages/RiskPage'));
const TimeWindowPage = lazy(() => import(/* webpackChunkName: "TimeWindowPage" */ './pages/TimeWindowPage'));
const MembershipPage = lazy(() => import(/* webpackChunkName: "MembershipPage" */ './pages/MembershipPage'));
const SettingsPage = lazy(() => import(/* webpackChunkName: "SettingsPage" */ './pages/SettingsPage'));
const SubAccountsPage = lazy(() => import(/* webpackChunkName: "SubAccountsPage" */ './pages/SubAccountsPage'));
const ProductLinksPage = lazy(() => import(/* webpackChunkName: "ProductLinksPage" */ './pages/ProductLinksPage'));
const ReconciliationPage = lazy(() => import(/* webpackChunkName: "ReconciliationPage" */ './pages/ReconciliationPage'));

// Legal 页面仍直接导入（体积小，且 Terms/Privacy 需快速渲染）
import { TermsPage, PrivacyPage } from './pages/LegalPage';

// ★ 优雅加载占位：告知用户服务器正在计算
const PageLoader: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-24 min-h-[40vh]">
    <div className="relative mb-6">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 animate-pulse">
        <BarChart3 size={28} className="text-white" />
      </div>
      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
        <Loader2 size={14} className="text-white animate-spin" />
      </div>
    </div>
    <p className="text-base font-medium text-white mb-1">正在加载数据</p>
    <p className="text-sm text-pdd-text-secondary">数据统计中，请稍候...</p>
    <div className="mt-6 flex gap-1.5">
      {[0, 1, 2].map(i => (
        <div key={i} className="w-2 h-2 rounded-full bg-indigo-500/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  </div>
);

/** 包装路由组件：ErrorBoundary + Suspense */
function RouteWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}

import { isFullMember } from './utils/permission';
import type { TaxConfig, CustomDeduction } from './components/ProductLinkStats';
const ALL_STORES_ID = '__all__';
const isAllStores = (s: string) => s === ALL_STORES_ID;
import { addLog } from './utils/operationLog';
import { OrderFinancialActual, UnlinkedFinancials, buildFinancialIndex } from './utils/financialActuals';
import { pullStoreData, syncStoreData, syncStoreConfig } from '../api/dataApi';
import { useDataStore } from './store/dataStore';
import { analyticsApi, type BulkAnalytics, type DashboardResponse, type ProductKpi, type PromotionResponse, type AfterSaleResponse,
  type DailyTrend, type RegionItem, type LogisticsSummary, type PromoByDateItem, type CostSummary, type PeriodCompare, type FinancialSummary } from '../api/analyticsApi';
import { apiClient, hasTokens, clearTokens, getAccessToken, refreshAccessToken } from '../api/client';

interface User {
  id: string;
  username: string;
  role: 'normal' | 'test' | 'admin';
  membershipLevel: 'free' | 'pro' | 'enterprise';
  membershipExpiresAt?: string | null;
}

interface AuthContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  logout: () => void;
  permissions: any;
  isPaid: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // ★ 从 JWT 同步恢复用户（毫秒级，不阻塞渲染）
  const [user, setUser] = useState<User | null>(() => {
    try {
      const raw = localStorage.getItem('dianfx_jwt_tokens');
      if (!raw) return null;
      const tokens = JSON.parse(raw);
      if (!tokens.accessToken) return null;
      const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
      if (!payload.userId) return null;
      return {
        id: payload.userId,
        username: payload.username || '',
        role: payload.role || 'normal',
        membershipLevel: payload.membershipLevel || 'free',
      };
    } catch { return null; }
  });

  // 后台异步获取完整用户信息（不阻塞渲染）
  useEffect(() => {
    if (!user) return;
    import('../api/authApi').then(({ getMe }) => {
      getMe().then(result => {
        if (result.user) setUser(result.user as User);
      }).catch(() => {});
    });
  }, []); // eslint-disable-line

  // 监听全局 auth-expired 事件
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('dianfx:auth-expired', handler);
    return () => window.removeEventListener('dianfx:auth-expired', handler);
  }, []);

  const [permissions, setPermissions] = useState<any>(null);

  const logout = useCallback(() => { setUser(null); setPermissions(null); clearTokens(); }, []);

  // ★ 登录时注入权限
  const setUserWithPerms = useCallback((u: User | null) => {
    setUser(u);
    if (u && (u as any).permissions) setPermissions((u as any).permissions);
    else setPermissions(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser: setUserWithPerms, logout,
      isPaid: isFullMember(user),
      permissions,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

interface Store {
  id: string;
  name: string;
  createdAt: string;
}

interface StoreContextType {
  stores: Store[];
  currentStore: Store | null;
  addStore: (name: string) => Promise<Store>;
  renameStore: (id: string, newName: string) => void;
  switchStore: (id: string) => void;
  deleteStore: (id: string) => void;
  clearCurrentStore: () => void;
}

const StoreContext = createContext<StoreContextType>(null!);
export const useStore = () => useContext(StoreContext);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); // ★ 用于检测登录状态变化
  const [stores, setStores] = useState<Store[]>([]);
  const [currentStore, setCurrentStore] = useState<Store | null>(null);
  const [storesLoaded, setStoresLoaded] = useState(false);
  const storesRef = useRef<Store[]>([]); // ★ 防竞态：ref 保存最新店铺列表

  // ★ 封装：从服务器加载店铺列表（可复用）
  const fetchStores = useCallback(async () => {
    if (!hasTokens()) return;
    const res = await apiClient.get<{ id: string; name: string; createdAt: string }[]>('/stores');
    if (res.success && res.data?.length) {
      const mapped: Store[] = res.data.map(s => ({ id: s.id, name: s.name, createdAt: s.createdAt }));
      if (mapped.length > 1) {
        mapped.unshift({ id: ALL_STORES_ID, name: '全部店铺', createdAt: '' });
      }
      const wasEmpty = storesRef.current.length === 0;
      storesRef.current = mapped;
      setStores(mapped);
      setStoresLoaded(true);
      // ★ 自动选中店铺（双层策略）
      // 策略1：从 localStorage 恢复上次选中的店铺（刷新不丢）
      const lastStoreId = (() => { try { return localStorage.getItem('dianfx_last_store'); } catch { return null; } })();
      const lastStore = lastStoreId ? mapped.find(s => s.id === lastStoreId) : null;
      // 策略2：选第一个非演示店铺
      const realStores = mapped.filter(s => s.id !== ALL_STORES_ID && !s.name.includes('演示'));
      const nonDemoStore = realStores.length > 0 ? realStores[0] : mapped.find(s => s.id !== ALL_STORES_ID);
      const autoStore = lastStore || nonDemoStore;
      if (autoStore && (wasEmpty || !storesRef.current.some(s => s.id === currentStore?.id))) {
        setCurrentStore(autoStore);
        try { localStorage.setItem('dianfx_last_store', autoStore.id); } catch {}
      }
      return mapped;
    } else if (res.success) {
      storesRef.current = [];
      setStores([]);
      setStoresLoaded(true);
    }
    return null;
  }, []);

  // ★ 修复：登录后自动拉取店铺列表（原仅 mount 时触发，登录后不会重试）
  useEffect(() => { fetchStores(); }, [fetchStores, user]);

  const addStore = useCallback(async (name: string): Promise<Store> => {
    // ★ 先调服务器创建，确认成功再更新本地
    const res = await apiClient.post<{ id: string; name: string; createdAt: string }>('/stores', { name });
    if (!res.success) throw new Error('创建店铺失败');
    const s: Store = { id: res.data!.id, name: res.data!.name, createdAt: res.data!.createdAt };
    setStores(prev => [...prev, s]);
    setCurrentStore(s);
    addLog({ action: '添加店铺', storeId: s.id, storeName: name, details: `添加店铺: ${name}`, result: 'success' });
    return s;
  }, []);

  const switchStore = useCallback((id: string) => {
    // 使用 ref 避免闭包过期问题
    const found = storesRef.current.find(s => s.id === id);
    if (found) {
      setCurrentStore(found);
      try { localStorage.setItem('dianfx_last_store', id); } catch {}
    }
  }, []);

  const deleteStore = useCallback(async (id: string) => {
    if (id === ALL_STORES_ID) return;
    const storeName = storesRef.current.find(s => s.id === id)?.name ?? id;
    // ★ 先调服务器删除，确认成功再更新本地状态
    try {
      await apiClient.delete(`/stores/${encodeURIComponent(id)}`);
      await apiClient.delete(`/data/store/${encodeURIComponent(id)}`).catch(() => {});
    } catch (e) {
      console.error('[StoreProvider] delete failed:', e);
      return; // 删除失败，不更新本地状态
    }
    addLog({ action: '删除店铺', storeId: id, storeName, details: `删除店铺: ${storeName}（含云端数据）`, result: 'success' });
    setStores(prev => {
      const remaining = prev.filter(s => s.id !== id);
      storesRef.current = remaining;
      return remaining;
    });
    // 切换到剩余第一个店铺
    const remaining = storesRef.current.filter(s => s.id !== id);
    setCurrentStore(remaining[0] || null);
  }, []);

  const renameStore = useCallback((id: string, newName: string) => {
    if (id === ALL_STORES_ID) return; // ★ 虚拟店铺不可改名
    const oldName = stores.find(s => s.id === id)?.name ?? id;
    setStores(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    if (currentStore?.id === id) {
      setCurrentStore(prev => prev ? { ...prev, name: newName } : null);
    }
    addLog({ action: '重命名店铺', storeId: id, storeName: newName, details: `店铺改名: "${oldName}" → "${newName}"`, result: 'success' });
  }, [currentStore, stores]);

  const clearCurrentStore = useCallback(() => {
    setCurrentStore(null);
  }, []);

  return (
    <StoreContext.Provider value={{ stores, currentStore, addStore, renameStore, switchStore, deleteStore, clearCurrentStore }}>
      {children}
    </StoreContext.Provider>
  );
}


interface StoreDataItem {
  orders: any[];
  promotionSummary: any[];
  promotionProducts: any[];
  starStoreSummary: any[];
  liveStreamSummary: any[];
  shippingInsurance: any[];
  afterSaleRecords: any[];
  financialRecords: any[];
  // ★ 统一为 string[]：Set 无法 JSON 序列化，localStorage/服务器恢复后会变成空对象
  availableFields: { csv: string[]; promotion: string[]; insurance: string[]; afterSale: string[]; financial: string[] };
}

// ★ 与 Zustand store 的 UploadRecord 保持一致
interface UploadRecord {
  id: string;
  fileName: string;
  fileType: string;
  storeId: string;
  storeName: string;
  uploadedAt: string;
  rowCount: number;
  fieldCount?: number;
  categories?: string[];
}

interface CostConfig {
  rawCost: number;
  packagingFee: number;
  updatedAt: string;
}

// 异常订单处理记录
export interface AbnormalOrderRecord {
  orderNo: string;
  status: 'excluded' | 'adjusted';
  note: string;
  adjustedFields: { itemCount?: number; merchantAmount?: number; rawCost?: number };
  alertTypes: string[];
  processedAt: string;
}

// 成本历史记录
export interface CostHistoryEntry {
  id: string;
  productId: string;
  productName: string;
  field: string;
  oldValue: number;
  newValue: number;
  reason: string;
  updatedAt: string;
}

interface DataContextType {
  dataFilter: string;
  setDataFilter: (filter: string) => void;
  getStoreData: (storeId: string) => StoreDataItem | null;
  setStoreData: (storeId: string, dataOrUpdater: any, categories?: string[]) => void;
  /** ★ 仅更新本地状态，不同步服务端（UploadPage 用此做本地合并，再调 syncStoreDelta） */
  setStoreDataLocal: (storeId: string, dataOrUpdater: any) => void;
  currentDisplayData: StoreDataItem;
  // 以下接口保持不变，内部按 dataFilter 自动选择当前店铺数据
  productCosts: Record<string, number>;
  setProductCost: (code: string, cost: number) => void;
  costConfigs: Record<string, CostConfig>;
  setCostConfig: (code: string, config: CostConfig) => void;
  packagingFeePerOrder: number;
  setPackagingFeePerOrder: (fee: number) => void;
  pricingPresets: any[];
  addPricingPreset: (preset: any) => void;
  updatePricingPreset: (presetId: string, updated: any) => void;
  removePricingPreset: (presetId: string) => void;
  uploadRecords: UploadRecord[];
  allUploadRecords: UploadRecord[];
  addUploadRecord: (record: Omit<UploadRecord, 'id' | 'uploadedAt'>) => void;
  deleteUploadRecord: (id: string) => void;
  clearStoreUploads: (storeId: string) => void;
  clearStoreData: (storeId: string) => void;
  taxConfigs: TaxConfig[];
  setTaxConfigs: (configs: TaxConfig[]) => void;
  addTaxConfig: (config: TaxConfig) => void;
  removeTaxConfig: (id: string) => void;
  updateTaxConfig: (id: string, config: Partial<TaxConfig>) => void;
  customDeductions: CustomDeduction[];
  setCustomDeductions: (deductions: CustomDeduction[]) => void;
  addCustomDeduction: (deduction: CustomDeduction) => void;
  removeCustomDeduction: (id: string) => void;
  updateCustomDeduction: (id: string, deduction: Partial<CustomDeduction>) => void;
  defaultCostRatio: number;
  setDefaultCostRatio: (ratio: number) => void;
  shippingFeePerOrder: number;
  setShippingFeePerOrder: (fee: number) => void;
  platformCommissionRate: number;
  setPlatformCommissionRate: (rate: number) => void;
  laborFeePerOrder: number;
  setLaborFeePerOrder: (fee: number) => void;
  insuranceFeePerOrder: number;
  setInsuranceFeePerOrder: (fee: number) => void;
  promotionFeePerOrder: number;
  setPromotionFeePerOrder: (fee: number) => void;
  subsidyCommissionRate: number;
  setSubsidyCommissionRate: (rate: number) => void;
  orderFinancialActuals: Record<string, OrderFinancialActual>;
  unlinkedFinancials: UnlinkedFinancials;
  abnormalOrders: Record<string, AbnormalOrderRecord>;
  setAbnormalOrder: (orderNo: string, record: AbnormalOrderRecord) => void;
  removeAbnormalOrder: (orderNo: string) => void;
  costHistory: CostHistoryEntry[];
  addCostHistory: (entry: Omit<CostHistoryEntry, 'id' | 'updatedAt'>) => void;
  clearAllData: () => void;
  clearOrderData: (storeId?: string) => void;
  clearPromotionData: (storeId?: string) => void;
  clearFinancialData: (storeId?: string) => void;
  clearCostData: (storeId?: string) => void;
  clearUploadRecords: (storeId?: string) => void;
  clearStoreList: () => void;
  syncStatus: 'idle' | 'syncing' | 'done' | 'error';
  dataLoading: boolean;
  refreshStoreData: (storeId: string, force?: boolean) => Promise<void>; // force=true 跳过空覆盖保护
  /** 服务端MySQL直接聚合的KPI — Dashboard使用 */
  serverDashboard: DashboardResponse | null;
  serverProducts: ProductKpi[] | null;
  serverPromotion: PromotionResponse | null;
  serverAfterSale: AfterSaleResponse | null;
  serverTrends: DailyTrend[] | null;
  serverRegions: RegionItem[] | null;
  serverLogistics: LogisticsSummary | null;
  serverPromoTrends: PromoByDateItem[] | null;
  serverCosts: CostSummary | null;
  serverCompare: PeriodCompare | null;
  serverFinancial: FinancialSummary | null;
  /** 数据加载状态 */
  analyticsLoading: boolean;
  /** ★ 手动刷新分析数据（5层保险第1层：同步后立即调用） */
  refreshAnalytics: (storeId?: string) => Promise<void>;
}

const DataContext = createContext<DataContextType>(null!);
export const useData = () => useContext(DataContext);

const EMPTY_STORE_DATA: StoreDataItem = {
  orders: [],
  promotionSummary: [],
  promotionProducts: [],
  starStoreSummary: [],
  liveStreamSummary: [],
  shippingInsurance: [],
  afterSaleRecords: [],
  financialRecords: [],
  availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] }
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { stores, currentStore, switchStore } = useStore();
  const dataFilter = currentStore?.id || '';
  const setDataFilter = useCallback((f: string) => {
    if (f) switchStore(f);
  }, [switchStore]);
  // ★ Zustand: 自动 localStorage 持久化，刷新不丢
  const storeDataMap = useDataStore(s => s.storeDataMap);
  const dataLoading = useDataStore(s => s.dataLoading);
  const syncStatus = useDataStore(s => s.syncStatus);
  const zSetLocal = useDataStore(s => s.setLocalData);
  const zSyncServer = useDataStore(s => s.syncToServer);
  const zBulkSet = useDataStore(s => s.bulkSetStoreData);
  const zReplaceStore = useDataStore(s => s.replaceStoreForId);
  const zSetDataLoading = useDataStore(s => s.setDataLoadingState);
  // ★ uploadRecords 改为 Zustand 管理
  const uploadRecords = useDataStore(s => s.uploadRecords);
  const zSetUploadRecords = useDataStore(s => s.setUploadRecords);
  const zAddUploadRecord = useDataStore(s => s.addUploadRecord);
  const zRemoveUploadRecord = useDataStore(s => s.removeUploadRecord);
  const zClearStoreUploads = useDataStore(s => s.clearStoreUploads);
  const zClearAllUploads = useDataStore(s => s.clearAllUploads);
  const zResetAll = useDataStore(s => s.resetAll);

  // ★ 登录/刷新后恢复数据：localStorage秒开 → 服务器确认
  useEffect(() => {
    if (!user || !hasTokens()) return;
    const realStores = stores.filter(s => s.id !== ALL_STORES_ID);
    if (!realStores.length) return;

    // Step 1: localStorage 立即恢复 (毫秒级, 刷新不丢)
    // Zustand persist 中间件已自动从 localStorage 恢复 storeDataMap + uploadRecords
    // 此处补充从旧格式 'meoo_ds_' 恢复（向后兼容）
    const fromLocal: Record<string, StoreDataItem> = {};
    for (const store of realStores) {
      try {
        const raw = localStorage.getItem('meoo_ds_' + store.id);
        if (raw) {
          const d = JSON.parse(raw);
          fromLocal[store.id] = {
            orders: d.o || [], promotionSummary: d.ps || [], promotionProducts: d.pp || [],
            starStoreSummary: d.ss || [], liveStreamSummary: d.ls || [],
            shippingInsurance: d.si || [], afterSaleRecords: d.as || [], financialRecords: d.fr || [],
            availableFields: { csv: Array.isArray(d.af?.csv) ? d.af.csv : [], promotion: Array.isArray(d.af?.promotion) ? d.af.promotion : [], insurance: Array.isArray(d.af?.insurance) ? d.af.insurance : [], afterSale: Array.isArray(d.af?.afterSale) ? d.af.afterSale : [], financial: Array.isArray(d.af?.financial) ? d.af.financial : [] },
          };
        }
      } catch {}
    }
    if (Object.keys(fromLocal).length > 0) {
      zBulkSet(fromLocal); // ★ Zustand: existing state wins over local restore
    }

    // Step 2: 服务器确认 (后台, 版本比对后覆盖)
    zSetDataLoading(true);
    Promise.all(realStores.map(store =>
      pullStoreData(store.id).then(serverData => ({ storeId: store.id, serverData }))
    )).then(results => {
      for (const { storeId, serverData } of results) {
        if (!serverData) continue;

        // 恢复原始数据到 storeDataMap
        if (serverData.data) {
          const sd = serverData.data;
          const storeData: StoreDataItem = {
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
              afterSale: Array.isArray(sd.availableFields?.afterSale) ? sd.availableFields.afterSale : [], financial: Array.isArray(sd.availableFields?.financial) ? sd.availableFields.financial : [],
            }
          };
          // ★ 防止空/旧服务端数据覆盖本地（同步失败时服务端为空，保留本地）
          // 检查全部数据分类，不只是 orders
          const localSnap = useDataStore.getState().storeDataMap[storeId];
          const localTotal = localSnap
            ? (localSnap.orders?.length||0) + (localSnap.promotionSummary?.length||0) + (localSnap.promotionProducts?.length||0)
              + (localSnap.starStoreSummary?.length||0) + (localSnap.liveStreamSummary?.length||0)
              + (localSnap.shippingInsurance?.length||0) + (localSnap.afterSaleRecords?.length||0) + (localSnap.financialRecords?.length||0)
            : 0;
          const serverTotal = (storeData.orders?.length||0) + (storeData.promotionSummary?.length||0) + (storeData.promotionProducts?.length||0)
            + (storeData.starStoreSummary?.length||0) + (storeData.liveStreamSummary?.length||0)
            + (storeData.shippingInsurance?.length||0) + (storeData.afterSaleRecords?.length||0) + (storeData.financialRecords?.length||0);
          if (serverTotal > 0 || localTotal === 0) {
            zReplaceStore(storeId, storeData);
          }
        }

        // ★ 恢复上传记录：合并多店铺，避免后一个覆盖前一个
        if (serverData.uploadRecords?.length) {
          const existing = useDataStore.getState().uploadRecords;
          const existingIds = new Set(existing.map(r => r.id));
          const newOnes = serverData.uploadRecords.filter((r: any) => !existingIds.has(r.id));
          if (newOnes.length > 0) {
            zSetUploadRecords([...existing, ...newOnes]);
          }
        }

        // 恢复配置（持久化到 Zustand）
        if (serverData.configs) {
          const z = useDataStore.getState();
          for (const [key, value] of Object.entries(serverData.configs)) {
            const val = typeof value === 'string' ? value : JSON.stringify(value);
            if (key.startsWith('dianfx_product_costs_')) z.setProductCosts(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_cost_configs_')) z.setCostConfigs(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_packaging_fee_')) z.setPackagingFee(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_shipping_fee_')) z.setShippingFee(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_platform_commission_')) z.setPlatformCommission(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_insurance_fee_')) z.setInsuranceFee(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_default_cost_ratio_')) z.setDefaultCostRatio(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_tax_configs_')) z.setTaxConfigs(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_custom_deductions_')) z.setCustomDeductions(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_abnormal_orders_')) z.setAbnormalOrders(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_cost_history_')) z.setCostHistory(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_pricing_presets_')) z.setPricingPresets(storeId, typeof value === 'string' ? JSON.parse(value) : value);
            else if (key.startsWith('dianfx_labor_fee_')) z.setLaborFee(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_promotion_fee_')) z.setPromotionFee(storeId, parseFloat(val) || 0);
            else if (key.startsWith('dianfx_subsidy_commission_')) z.setSubsidyCommission(storeId, parseFloat(val) || 0);
          }
        }
      }
    }).catch((e: any) => {
      console.error('[data] Load failed:', e?.message || e);
      let retries = 0;
      const retryLoad = () => {
        if (retries >= 3) return;
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries - 1), 8000);
        setTimeout(() => {
          const rs = stores.filter(s => s.id !== ALL_STORES_ID);
          if (rs.length) {
            Promise.all(rs.map(s => pullStoreData(s.id))).then(results => {
              results.forEach((sd, i) => {
                if (!sd?.data) return;
                const sid = rs[i].id;
                const newData = { ...sd.data, availableFields: {
                  csv: Array.isArray(sd.data.availableFields?.csv) ? sd.data.availableFields.csv : [],
                  promotion: Array.isArray(sd.data.availableFields?.promotion) ? sd.data.availableFields.promotion : [],
                  insurance: Array.isArray(sd.data.availableFields?.insurance) ? sd.data.availableFields.insurance : [],
                  afterSale: Array.isArray(sd.data.availableFields?.afterSale) ? sd.data.availableFields.afterSale : [], financial: Array.isArray(sd.data.availableFields?.financial) ? sd.data.availableFields.financial : [],
                }};
                // ★ retry 分支也用同样的非空保护
                const localSnap = useDataStore.getState().storeDataMap[sid];
                const localTotal = localSnap
                  ? (localSnap.orders?.length||0)+(localSnap.promotionSummary?.length||0)+(localSnap.promotionProducts?.length||0)
                    +(localSnap.starStoreSummary?.length||0)+(localSnap.liveStreamSummary?.length||0)
                    +(localSnap.shippingInsurance?.length||0)+(localSnap.afterSaleRecords?.length||0)+(localSnap.financialRecords?.length||0)
                  : 0;
                const serverTotal = (newData.orders?.length||0)+(newData.promotionSummary?.length||0)+(newData.promotionProducts?.length||0)
                  +(newData.starStoreSummary?.length||0)+(newData.liveStreamSummary?.length||0)
                  +(newData.shippingInsurance?.length||0)+(newData.afterSaleRecords?.length||0)+(newData.financialRecords?.length||0);
                if (serverTotal > 0 || localTotal === 0) {
                  zReplaceStore(sid, newData);
                }
              });
            }).catch(() => retryLoad());
          }
        }, delay);
      };
      retryLoad();
    }).finally(() => zSetDataLoading(false));
  }, [user, stores]);

  // ★ 按需加载原始数据（页面需要时调用）
  const refreshStoreData = useCallback(async (storeId: string, force?: boolean) => {
    if (!storeId || isAllStores(storeId)) return;
    const serverData = await pullStoreData(storeId);
    // ★ force=true（data:deleted）：服务端已删空，清空本地
    if (!serverData?.data) {
      if (force) {
        zReplaceStore(storeId, { ...EMPTY_STORE_DATA });
      }
      return;
    }
    const sd = serverData.data;
    const newData: StoreDataItem = {
      orders: sd.orders || [], promotionSummary: sd.promotionSummary || [],
      promotionProducts: sd.promotionProducts || [], starStoreSummary: sd.starStoreSummary || [],
      liveStreamSummary: sd.liveStreamSummary || [], shippingInsurance: sd.shippingInsurance || [],
      afterSaleRecords: sd.afterSaleRecords || [], financialRecords: sd.financialRecords || [],
      availableFields: {
        csv: Array.isArray(sd.availableFields?.csv) ? sd.availableFields.csv : [],
        promotion: Array.isArray(sd.availableFields?.promotion) ? sd.availableFields.promotion : [],
        insurance: Array.isArray(sd.availableFields?.insurance) ? sd.availableFields.insurance : [],
        afterSale: Array.isArray(sd.availableFields?.afterSale) ? sd.availableFields.afterSale : [], financial: Array.isArray(sd.availableFields?.financial) ? sd.availableFields.financial : [],
      }
    };
    // ★ force=true（SSE data:deleted 等远端真实删除）时跳过保护，允许覆盖
    if (force) {
      zReplaceStore(storeId, newData);
      return;
    }
    // ★ 非空保护：服务端为空时不覆盖本地
    const localSnap = useDataStore.getState().storeDataMap[storeId];
    const localTotal = localSnap
      ? (localSnap.orders?.length||0)+(localSnap.promotionSummary?.length||0)+(localSnap.promotionProducts?.length||0)
        +(localSnap.starStoreSummary?.length||0)+(localSnap.liveStreamSummary?.length||0)
        +(localSnap.shippingInsurance?.length||0)+(localSnap.afterSaleRecords?.length||0)+(localSnap.financialRecords?.length||0)
      : 0;
    const serverTotal = (newData.orders?.length||0)+(newData.promotionSummary?.length||0)+(newData.promotionProducts?.length||0)
      +(newData.starStoreSummary?.length||0)+(newData.liveStreamSummary?.length||0)
      +(newData.shippingInsurance?.length||0)+(newData.afterSaleRecords?.length||0)+(newData.financialRecords?.length||0);
    if (serverTotal > 0 || localTotal === 0) {
      zReplaceStore(storeId, newData);
    }
  }, []);

  // ★ 配置状态已全部迁移到 useDataStore（Zustand persist 自动 localStorage 持久化）

  // ---- 计算当前店铺的值（根据 dataFilter 自动选择） ----

  // 当前店铺 ID（__all__ 模式返回空字符串）
  const currentStoreId = useMemo(() => isAllStores(dataFilter) ? '' : dataFilter, [dataFilter]);

  const productCosts: Record<string, number> = useDataStore(s => s.productCostsByStore[dataFilter]) || {};
  const costConfigs: Record<string, CostConfig> = useDataStore(s => s.costConfigsByStore[dataFilter]) || {};
  const packagingFeePerOrder: number = useDataStore(s => s.packagingFeeByStore[dataFilter]) ?? 0;
  const pricingPresets: any[] = useDataStore(s => s.pricingPresetsByStore[dataFilter]) || [];
  const taxConfigs: TaxConfig[] = useDataStore(s => s.taxConfigsByStore[dataFilter]) || [];
  const customDeductions: CustomDeduction[] = useDataStore(s => s.customDeductionsByStore[dataFilter]) || [];
  const defaultCostRatio: number = useDataStore(s => s.defaultCostRatioByStore[dataFilter]) ?? 0;
  const shippingFeePerOrder: number = useDataStore(s => s.shippingFeeByStore[dataFilter]) ?? 0;
  const platformCommissionRate: number = useDataStore(s => s.platformCommissionByStore[dataFilter]) ?? 0;
  const laborFeePerOrder: number = useDataStore(s => s.laborFeeByStore[dataFilter]) ?? 0;
  const insuranceFeePerOrder: number = useDataStore(s => s.insuranceFeeByStore[dataFilter]) ?? 0;
  const promotionFeePerOrder: number = useDataStore(s => s.promotionFeeByStore[dataFilter]) ?? 0;
  const subsidyCommissionRate: number = useDataStore(s => s.subsidyCommissionByStore[dataFilter]) ?? 1.5;
  const abnormalOrders: Record<string, AbnormalOrderRecord> = useDataStore(s => s.abnormalOrdersByStore[dataFilter]) || {};
  const costHistory: CostHistoryEntry[] = useDataStore(s => s.costHistoryByStore[dataFilter]) || [];

  const filteredUploadRecords = useMemo((): UploadRecord[] => {
    return uploadRecords.filter(r => r.storeId === dataFilter);
  }, [dataFilter, uploadRecords]);

  // 注意：移除了自动清理无效店铺的 useEffect，因为它使用空依赖会捕获旧的闭包值，
  // dataFilter 由 currentStore 派生，无需持久化

  // ★ 服务端KPI（fetch on store change — 使用批量端点，单次请求获取全部数据）
  const [serverDashboard, setServerDashboard] = useState<DashboardResponse | null>(null);
  const [serverProducts, setServerProducts] = useState<ProductKpi[] | null>(null);
  const [serverPromotion, setServerPromotion] = useState<PromotionResponse | null>(null);
  const [serverAfterSale, setServerAfterSale] = useState<AfterSaleResponse | null>(null);
  const [serverTrends, setServerTrends] = useState<DailyTrend[] | null>(null);
  const [serverRegions, setServerRegions] = useState<RegionItem[] | null>(null);
  const [serverLogistics, setServerLogistics] = useState<LogisticsSummary | null>(null);
  const [serverPromoTrends, setServerPromoTrends] = useState<PromoByDateItem[] | null>(null);
  const [serverCosts, setServerCosts] = useState<CostSummary | null>(null);
  const [serverCompare, setServerCompare] = useState<PeriodCompare | null>(null);
  const [serverFinancial, setServerFinancial] = useState<FinancialSummary | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const analyticsFetchIdRef = useRef(0);
  const lastRefreshTimeRef = useRef<number>(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sseConnectedRef = useRef(false);
  const consecutiveFailuresRef = useRef(0); // ★ 连续失败计数（仅内部使用，不暴露给UI）

  // ★ 核心刷新函数：统一的数据加载入口（5层保险的第1层）
  const applyBulkData = useCallback((bulk: BulkAnalytics) => {
    setServerDashboard(bulk.dashboard);
    setServerProducts(bulk.products);
    setServerPromotion(bulk.promotion);
    setServerAfterSale(bulk.afterSale);
    setServerTrends(bulk.trends);
    setServerRegions(bulk.regions);
    setServerLogistics(bulk.logistics);
    setServerPromoTrends(bulk.promoByDate);
    setServerCosts(bulk.costs);
    setServerCompare(bulk.compare);
    setServerFinancial(bulk.financial);
    lastRefreshTimeRef.current = Date.now();
  }, []);

  // ★ 公开的刷新函数（UploadPage 等可在同步后直接调用）
  // ★ 公开的刷新函数 — 大厂设计：失败完全静默，不暴露任何状态给UI
  //   成功就更新数据，失败就保持旧数据，用户无感知
  const refreshAnalytics = useCallback(async (storeId?: string) => {
    const sid = storeId || dataFilter;
    if (!sid || !hasTokens()) {
      return;
    }

    const fetchId = ++analyticsFetchIdRef.current;
    setAnalyticsLoading(true);

    try {
      const bulk = await analyticsApi.getBulk(sid);
      if (fetchId !== analyticsFetchIdRef.current) return;
      if (bulk) {
        consecutiveFailuresRef.current = 0;
        applyBulkData(bulk);
      } else {
        consecutiveFailuresRef.current++;
      }
      setAnalyticsLoading(false);
    } catch {
      if (fetchId !== analyticsFetchIdRef.current) return;
      consecutiveFailuresRef.current++;
      setAnalyticsLoading(false);
    }
  }, [dataFilter, applyBulkData]);

  // ★ Layer 1+5: store切换时自动刷新 + 失败重试
  useEffect(() => {
    const storeId = dataFilter;
    if (!storeId || !hasTokens()) return;
    refreshAnalytics(storeId);
  }, [dataFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  // ★ Layer 2: SSE 实时连接（双认证 + 自动重连）
  useEffect(() => {
    if (!user || !hasTokens()) return;

    let aborted = false;
    let reconnectTimer: NodeJS.Timeout | null = null;
    const abortController = new AbortController();

    function getFreshToken(): string {
      try {
        const tokensStr = localStorage.getItem('dianfx_jwt_tokens');
        if (!tokensStr) return '';
        return JSON.parse(tokensStr).accessToken || '';
      } catch { return ''; }
    }

    function connectSSE() {
      if (aborted) return;
      // ★ 每次连接/重连重新读取 token（防止 15 分钟过期）
      const freshToken = getAccessToken() || getFreshToken();
      if (!freshToken) { scheduleReconnect(); return; }
      const url = `${apiClient.getBaseUrl()}/sse?token=${encodeURIComponent(freshToken)}`;

      (async () => {
        try {
          const res = await fetch(url, {
            headers: { 'Authorization': `Bearer ${freshToken}` },
            signal: abortController.signal,
          });
          // ★ 修复：401 时 token 可能过期，主动刷新后再重连
          if (res.status === 401) {
            sseConnectedRef.current = false;
            const refreshed = await refreshAccessToken();
            if (refreshed) {
              scheduleReconnect(); // 会用 getAccessToken() 拿到新 token 重连
            }
            return;
          }
          if (!res.ok || !res.body) {
            sseConnectedRef.current = false;
            scheduleReconnect();
            return;
          }
          sseConnectedRef.current = true;
          reconnectAttempts = 0; // ★ 连接成功后重置重试计数

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!aborted) {
            const { done, value } = await reader.read();
            if (done) {
              sseConnectedRef.current = false;
              scheduleReconnect(); // ★ 修复：流正常结束后也重连
              return;
            }
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (line.startsWith('event: ')) {
                const eventType = line.slice(7).trim();
                const dataLine = lines[i + 1];
                if (dataLine && dataLine.startsWith('data: ')) {
                  try {
                    const payload = JSON.parse(dataLine.slice(6));
                    if (eventType === 'sync:completed' && payload.storeId) {
                      lastRefreshTimeRef.current = Date.now();
                      refreshStoreData(payload.storeId);
                      refreshAnalytics(payload.storeId);
                    } else if (eventType === 'config:updated' && payload.storeId) {
                      lastRefreshTimeRef.current = Date.now();
                      refreshStoreData(payload.storeId);
                      refreshAnalytics(payload.storeId);
                    } else if (eventType === 'data:deleted' && payload.storeId) {
                      lastRefreshTimeRef.current = Date.now();
                      refreshStoreData(payload.storeId, true);
                      refreshAnalytics(payload.storeId);
                    }
                  } catch {}
                }
              }
            }
          }
        } catch {
          sseConnectedRef.current = false;
          scheduleReconnect(); // ★ 修复：网络异常也要重连
        }
      })();
    }

    let reconnectAttempts = 0;
    function scheduleReconnect() {
      if (aborted) return;
      reconnectAttempts++;
      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
      reconnectTimer = setTimeout(() => {
        connectSSE();
      }, delay);
    }

    connectSSE();

    return () => {
      aborted = true;
      abortController.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ★ Layer 3: 快速轮询兜底（SSE断开时每5秒兜底，SSE连接时不轮询）
  useEffect(() => {
    if (!user || !dataFilter) return;
    const pollTimer = setInterval(() => {
      if (!sseConnectedRef.current && Date.now() - lastRefreshTimeRef.current > 1000) {
        lastRefreshTimeRef.current = Date.now();
        refreshAnalytics(dataFilter);
      }
    }, 5000); // 5秒兜底，SSE连接时不触发
    return () => clearInterval(pollTimer);
  }, [user, dataFilter, refreshAnalytics]);

  // ★ Layer 4: 页面可见性刷新（切回标签页时立即刷新，3秒防抖）
  useEffect(() => {
    if (!user) return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && dataFilter) {
        if (Date.now() - lastRefreshTimeRef.current > 3000) {
          refreshAnalytics(dataFilter);
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [user, dataFilter, refreshAnalytics]);

  // ★ syncStatus 已在上方声明为 state，此处删除重复定义

  const getStoreData = useCallback((storeId: string): StoreDataItem | null => {
    return storeDataMap[storeId] || null;
  }, [storeDataMap]);

  /** ★ 仅更新本地状态，不同步到服务端 */
  const setStoreDataLocal = useCallback((storeId: string, dataOrUpdater: any) => {
    zSetLocal(storeId, dataOrUpdater);
  }, [zSetLocal]);

  const setStoreData = useCallback((storeId: string, dataOrUpdater: any, categories?: string[]) => {
    // 本地立即更新 (Zustand 自动持久化到 localStorage)
    zSetLocal(storeId, dataOrUpdater);
    // 后台同步服务器
    const storeName = stores.find(s => s.id === storeId)?.name || '';
    // ★ 直接从 Zustand 读最新 uploadRecords，避免 React 闭包旧值
    const latestUploads = useDataStore.getState().uploadRecords.filter(r => r.storeId === storeId);
    // ★ 增量同步：只发送变更的 categories
    zSyncServer(storeId, storeName, latestUploads, categories).then((ok) => {
      // ★ 同步成功才刷新分析，失败时 syncStatus 已设为 'error'
      if (ok) {
        refreshAnalytics(storeId);
      }
    });
  }, [stores, refreshAnalytics, zSetLocal, zSyncServer]);

  const currentDisplayData = useMemo((): StoreDataItem => {
    if (!dataFilter) return EMPTY_STORE_DATA;
    // ★ 全部店铺模式：合并所有真实店铺数据
    if (isAllStores(dataFilter)) {
      const realStores = stores.filter(s => s.id !== ALL_STORES_ID);
      if (!realStores.length) return EMPTY_STORE_DATA;
      const merged: StoreDataItem = {
        orders: [], promotionSummary: [], promotionProducts: [],
        starStoreSummary: [], liveStreamSummary: [], shippingInsurance: [],
        afterSaleRecords: [], financialRecords: [],
        availableFields: { csv: [], promotion: [], insurance: [], afterSale: [], financial: [] },
      };
      const csvSet = new Set<string>(); const promSet = new Set<string>();
      const insSet = new Set<string>(); const asSet = new Set<string>(); const finSet = new Set<string>();
      for (const store of realStores) {
        const sd = storeDataMap[store.id];
        if (!sd) continue;
        merged.orders.push(...sd.orders);
        merged.promotionSummary.push(...sd.promotionSummary);
        merged.promotionProducts.push(...sd.promotionProducts);
        merged.starStoreSummary.push(...sd.starStoreSummary);
        merged.liveStreamSummary.push(...sd.liveStreamSummary);
        merged.shippingInsurance.push(...sd.shippingInsurance);
        merged.afterSaleRecords.push(...sd.afterSaleRecords);
        merged.financialRecords.push(...sd.financialRecords);
        (Array.isArray(sd.availableFields.csv) ? sd.availableFields.csv : []).forEach(f => csvSet.add(f));
        (Array.isArray(sd.availableFields.promotion) ? sd.availableFields.promotion : []).forEach(f => promSet.add(f));
        (Array.isArray(sd.availableFields.insurance) ? sd.availableFields.insurance : []).forEach(f => insSet.add(f));
        (Array.isArray(sd.availableFields.afterSale) ? sd.availableFields.afterSale : []).forEach(f => asSet.add(f));
      }
      realStores.forEach(store => {
        const sd = storeDataMap[store.id];
        if (!sd) return;
        (Array.isArray(sd.availableFields.financial) ? sd.availableFields.financial : []).forEach(f => finSet.add(f));
      });
      merged.availableFields = { csv: [...csvSet], promotion: [...promSet], insurance: [...insSet], afterSale: [...asSet], financial: [...finSet] };
      return merged;
    }
    return storeDataMap[dataFilter] || EMPTY_STORE_DATA;
  }, [dataFilter, storeDataMap, stores]);

  const { index: orderFinancialActuals, unlinked: unlinkedFinancials } = useMemo(() => {
    return buildFinancialIndex(currentDisplayData.financialRecords || []);
  }, [currentDisplayData.financialRecords]);

  // 当 dataFilter 指向不存在的店铺时才自动切换
  useEffect(() => {
    if (!dataFilter || isAllStores(dataFilter)) return;
    const storeData = storeDataMap[dataFilter];
    if (storeData) return;

    // 检查是否是合法店铺（存在于 stores 列表中）
    if (stores.some(s => s.id === dataFilter)) return;

    // 切换到第一个有效店铺
    const validIds = Object.keys(storeDataMap).filter(id => {
      const d = storeDataMap[id];
      return (d.orders?.length > 0) || (d.promotionSummary?.length > 0);
    });
    if (validIds.length > 0) setDataFilter(validIds[0]);
    else if (Object.keys(storeDataMap).length === 0) setDataFilter('');
  }, [dataFilter, storeDataMap, setDataFilter, stores]);

  // 获取店铺名称
  const getStoreName = useCallback((storeId: string): string => {
    return stores.find(s => s.id === storeId)?.name || '';
  }, [stores]);

  // ---- Setter 函数（写入当前店铺的数据切片，__all__ 模式下无效） ----

  const setProductCost = useCallback((code: string, cost: number) => {
    if (isAllStores(dataFilter)) return;
    const curPC = useDataStore.getState().productCostsByStore[dataFilter] || {};
      const nextPC = { ...curPC, [code]: cost };
      useDataStore.getState().setProductCosts(dataFilter, nextPC);
      // ★ 即时同步到服务器
      syncStoreConfig(dataFilter, `dianfx_product_costs_${dataFilter}`, nextPC);
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改商品成本: ${code} → ¥${cost}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setCostConfig = useCallback((code: string, config: CostConfig) => {
    if (isAllStores(dataFilter)) return;
    const curCC = useDataStore.getState().costConfigsByStore[dataFilter] || {};
      const nextCC = { ...curCC, [code]: config };
      useDataStore.getState().setCostConfigs(dataFilter, nextCC);
      syncStoreConfig(dataFilter, `dianfx_cost_configs_${dataFilter}`, nextCC);
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改成本配置: ${code}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const addPricingPreset = useCallback((preset: any) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setPricingPresets(dataFilter, [...(useDataStore.getState().pricingPresetsByStore[dataFilter] || []), preset]);
      syncStoreConfig(dataFilter, `dianfx_pricing_presets_${dataFilter}`, useDataStore.getState().pricingPresetsByStore[dataFilter] || []);
  }, [dataFilter]);
  const updatePricingPreset = useCallback((presetId: string, updated: any) => {
    if (isAllStores(dataFilter)) return;
    const curPP = useDataStore.getState().pricingPresetsByStore[dataFilter] || [];
      const nextPP = curPP.map((p: any) =>
        (p.id === presetId || p.code === presetId || p.createdAt === presetId) ? { ...p, ...updated } : p
      );
      useDataStore.getState().setPricingPresets(dataFilter, nextPP);
      syncStoreConfig(dataFilter, `dianfx_pricing_presets_${dataFilter}`, nextPP);
  }, [dataFilter]);
  const removePricingPreset = useCallback((presetId: string) => {
    if (isAllStores(dataFilter)) return;
    const curPP2 = useDataStore.getState().pricingPresetsByStore[dataFilter] || [];
      const nextPP2 = curPP2.filter((p: any) =>
        p.id !== presetId && p.code !== presetId && p.createdAt !== presetId
      );
      useDataStore.getState().setPricingPresets(dataFilter, nextPP2);
      syncStoreConfig(dataFilter, `dianfx_pricing_presets_${dataFilter}`, nextPP2);
  }, [dataFilter]);
  const addUploadRecord = useCallback((record: Omit<UploadRecord, 'id' | 'uploadedAt'>) => {
    const storeId = record.storeId || dataFilter;
    if (!storeId || isAllStores(storeId)) return;
    const newRecord: UploadRecord = {
      ...record,
      storeId,
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };
    zAddUploadRecord(newRecord);
    addLog({ action: '上传数据', storeId, storeName: record.storeName, details: `上传文件: ${record.fileName} (${record.fileType}, ${record.rowCount}行)`, result: 'success' });
  }, [dataFilter, zAddUploadRecord]);
  const deleteUploadRecord = useCallback((id: string) => {
    const record = uploadRecords.find(r => r.id === id);
    if (!record) return;
    addLog({ action: '删除上传记录', storeId: record.storeId, storeName: record.storeName, details: `删除上传记录: ${record.fileName}`, result: 'success' });
    const catMap: Record<string, string> = {
      '订单数据': 'orders', '商品推广数据': 'promotionProducts', '明星店铺数据': 'starStoreSummary',
      '直播推广数据': 'liveStreamSummary', '运费险数据': 'shippingInsurance', '售后数据': 'afterSaleRecords',
      '货款明细': 'financialRecords',
    };
    const cat = catMap[record.fileType];
    if (cat) {
      apiClient.delete(`/data/store/${encodeURIComponent(record.storeId)}/category/${cat}`).catch(() => {});
    }
    // ★ 清除 Zustand 中对应数据
    zSetLocal(record.storeId, (prev: StoreDataItem | null) => {
      if (!prev) return EMPTY_STORE_DATA;
      const nd = { ...prev, availableFields: { ...prev.availableFields } };
      if (record.fileType === '订单数据') { nd.orders = []; nd.availableFields.csv = []; }
      else if (record.fileType === '商品推广数据') { nd.promotionSummary = []; nd.promotionProducts = []; nd.availableFields.promotion = []; }
      else if (record.fileType === '明星店铺数据') { nd.starStoreSummary = []; }
      else if (record.fileType === '直播推广数据') { nd.liveStreamSummary = []; }
      else if (record.fileType === '运费险数据') { nd.shippingInsurance = []; nd.availableFields.insurance = []; }
      else if (record.fileType === '售后数据') { nd.afterSaleRecords = []; nd.availableFields.afterSale = []; }
      else if (record.fileType === '货款明细') { nd.financialRecords = []; nd.availableFields.financial = []; }
      return nd;
    });
    zRemoveUploadRecord(id);
  }, [uploadRecords, zSetLocal, zRemoveUploadRecord]);
  const clearStoreUploads = useCallback((storeId: string) => {
    zClearStoreUploads(storeId);
  }, [zClearStoreUploads]);
  const clearStoreData = useCallback((storeId: string) => {
    apiClient.delete(`/data/store/${encodeURIComponent(storeId)}`).catch(() => {});
    zSetLocal(storeId, EMPTY_STORE_DATA);
  }, [zSetLocal]);

  // Tax config callbacks
  const addTaxConfig = useCallback((config: TaxConfig) => {
    if (isAllStores(dataFilter)) return;
    const curTC = useDataStore.getState().taxConfigsByStore[dataFilter] || [];
      const nextTC = [...curTC, config];
      useDataStore.getState().setTaxConfigs(dataFilter, nextTC);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, nextTC);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加税费: ${config.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeTaxConfig = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    const curTC2 = useDataStore.getState().taxConfigsByStore[dataFilter] || [];
      const nextTC2 = curTC2.filter((t: TaxConfig) => t.id !== id);
      useDataStore.getState().setTaxConfigs(dataFilter, nextTC2);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, nextTC2);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateTaxConfig = useCallback((id: string, updates: Partial<TaxConfig>) => {
    if (isAllStores(dataFilter)) return;
    const curTC3 = useDataStore.getState().taxConfigsByStore[dataFilter] || [];
      const nextTC3 = curTC3.map((t: TaxConfig) => t.id === id ? { ...t, ...updates } : t);
      useDataStore.getState().setTaxConfigs(dataFilter, nextTC3);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, nextTC3);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `更新税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // Custom deduction callbacks
  const addCustomDeduction = useCallback((deduction: CustomDeduction) => {
    if (isAllStores(dataFilter)) return;
    const curCD = useDataStore.getState().customDeductionsByStore[dataFilter] || [];
      const nextCD = [...curCD, deduction];
      useDataStore.getState().setCustomDeductions(dataFilter, nextCD);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, nextCD);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加自定义扣费: ${deduction.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeCustomDeduction = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    const curCD2 = useDataStore.getState().customDeductionsByStore[dataFilter] || [];
      const nextCD2 = curCD2.filter((d: CustomDeduction) => d.id !== id);
      useDataStore.getState().setCustomDeductions(dataFilter, nextCD2);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, nextCD2);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除自定义扣费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateCustomDeduction = useCallback((id: string, updates: Partial<CustomDeduction>) => {
    if (isAllStores(dataFilter)) return;
    const curCD3 = useDataStore.getState().customDeductionsByStore[dataFilter] || [];
      const nextCD3 = curCD3.map((d: CustomDeduction) => d.id === id ? { ...d, ...updates } : d);
      useDataStore.getState().setCustomDeductions(dataFilter, nextCD3);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, nextCD3);
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `更新自定义扣费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // Cost history callback
  const addCostHistory = useCallback((entry: Omit<CostHistoryEntry, 'id' | 'updatedAt'>) => {
    const newEntry: CostHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      updatedAt: new Date().toISOString(),
    };
    if (isAllStores(dataFilter)) return;
    const curCH = useDataStore.getState().costHistoryByStore[dataFilter] || [];
      const nextCH = [newEntry, ...curCH].slice(0, 500);
      useDataStore.getState().setCostHistory(dataFilter, nextCH);
      syncStoreConfig(dataFilter, `dianfx_cost_history_${dataFilter}`, nextCH);
  }, [dataFilter]);

  const setAbnormalOrder = useCallback((orderNo: string, record: AbnormalOrderRecord) => {
    if (isAllStores(dataFilter)) return;
    const curAO = useDataStore.getState().abnormalOrdersByStore[dataFilter] || {};
      const nextAO = { ...curAO, [orderNo]: record };
      useDataStore.getState().setAbnormalOrders(dataFilter, nextAO);
      syncStoreConfig(dataFilter, `dianfx_abnormal_orders_${dataFilter}`, nextAO);
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeAbnormalOrder = useCallback((orderNo: string) => {
    if (isAllStores(dataFilter)) return;
    const curAO2 = { ...(useDataStore.getState().abnormalOrdersByStore[dataFilter] || {}) };
      delete curAO2[orderNo];
      useDataStore.getState().setAbnormalOrders(dataFilter, curAO2);
      syncStoreConfig(dataFilter, `dianfx_abnormal_orders_${dataFilter}`, curAO2);
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `移除异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // ---- 数值型配置的 Setter ----

  const setPackagingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setPackagingFee(dataFilter, fee);
      syncStoreConfig(dataFilter, `dianfx_packaging_fee_${dataFilter}`, fee);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置包装费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setDefaultCostRatio = useCallback((ratio: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setDefaultCostRatio(dataFilter, ratio);
      syncStoreConfig(dataFilter, `dianfx_default_cost_ratio_${dataFilter}`, ratio);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置默认成本比例: ${ratio}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setShippingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setShippingFee(dataFilter, fee);
      syncStoreConfig(dataFilter, `dianfx_shipping_fee_${dataFilter}`, fee);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setPlatformCommissionRate = useCallback((rate: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setPlatformCommission(dataFilter, rate);
      syncStoreConfig(dataFilter, `dianfx_platform_commission_${dataFilter}`, rate);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置平台佣金率: ${rate}%`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setLaborFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setLaborFee(dataFilter, fee);
      syncStoreConfig(dataFilter, `dianfx_labor_fee_${dataFilter}`, fee);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置人工费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setInsuranceFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setInsuranceFee(dataFilter, fee);
      syncStoreConfig(dataFilter, `dianfx_insurance_fee_${dataFilter}`, fee);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费险: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setPromotionFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setPromotionFee(dataFilter, fee);
      syncStoreConfig(dataFilter, `dianfx_promotion_fee_${dataFilter}`, fee);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置推广费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setSubsidyCommissionRate = useCallback((rate: number) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setSubsidyCommission(dataFilter, rate);
    syncStoreConfig(dataFilter, `dianfx_subsidy_commission_${dataFilter}`, rate);
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置百亿补贴佣金率: ${rate}%`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // 清空所有数据（同步清除服务端 + React state）
  const clearAllData = useCallback(async () => {
    console.log('[CLEAR] Clearing all data (server + local)');
    addLog({ action: '清空全部数据', storeId: '全部', storeName: '全部店铺', details: '清空所有数据（含云端）', result: 'success' });
    // ★ 调用服务端清除所有数据
    try { await apiClient.post('/data/clear-all'); } catch (e) { console.error('[clearAllData] server error:', e); }
    zResetAll();
    setDataFilter('');
    useDataStore.getState().resetAllConfigs();
  }, []);

  const clearOrderData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing order data', storeId ?? 'ALL');
    if (storeId) {
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/category/orders`).catch(() => {});
      zSetLocal(storeId, (prev: StoreDataItem | null) => {
        if (!prev) return EMPTY_STORE_DATA;
        return { ...prev, orders: [], availableFields: { ...prev.availableFields, csv: [] } };
      });
      addLog({ action: '清除订单数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的订单数据（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/orders`).catch(() => {});
        zSetLocal(sid, (prev: StoreDataItem | null) => {
          if (!prev) return EMPTY_STORE_DATA;
          return { ...prev, orders: [], availableFields: { ...prev.availableFields, csv: [] } };
        });
      });
      addLog({ action: '清除订单数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的订单数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap, zSetLocal]);

  const clearPromotionData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing promotion data', storeId ?? 'ALL');
    const promoCats = ['promotionSummary', 'promotionProducts', 'starStoreSummary', 'liveStreamSummary'];
    const clearPromoForStore = (sid: string) => {
      promoCats.forEach(cat => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/${cat}`).catch(() => {});
      });
      zSetLocal(sid, (prev: StoreDataItem | null) => {
        if (!prev) return EMPTY_STORE_DATA;
        return { ...prev, promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], availableFields: { ...prev.availableFields, promotion: [] } };
      });
    };
    if (storeId) {
      clearPromoForStore(storeId);
      addLog({ action: '清除推广数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的推广数据（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(clearPromoForStore);
      addLog({ action: '清除推广数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的推广数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap, zSetLocal]);

  const clearFinancialData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing financial data', storeId ?? 'ALL');
    const clearFinForStore = (sid: string) => {
      apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/financialRecords`).catch(() => {});
      zSetLocal(sid, (prev: StoreDataItem | null) => {
        if (!prev) return EMPTY_STORE_DATA;
        return { ...prev, financialRecords: [], availableFields: { ...prev.availableFields, financial: [] } };
      });
    };
    if (storeId) {
      clearFinForStore(storeId);
      addLog({ action: '清除财务报表', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的财务报表数据（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(clearFinForStore);
      addLog({ action: '清除财务报表', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的财务报表数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap, zSetLocal]);

  const clearCostData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing cost data', storeId ?? 'ALL');
    if (storeId) {
      // ★ 同步清除服务端配置
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/configs`).catch(() => {});
      useDataStore.getState().removeStoreConfigs(storeId);
      addLog({ action: '清除成本配置', storeId, storeName: getStoreName(storeId), details: `清除成本配置（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/configs`).catch(() => {});
      });
      useDataStore.getState().resetAllConfigs();
      addLog({ action: '清除成本配置', storeId: '全部', storeName: '全部店铺', details: '清除所有成本配置（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearUploadRecordsFn = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing upload records', storeId ?? 'ALL');
    if (storeId) {
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/uploads`).catch(() => {});
      zClearStoreUploads(storeId);
      addLog({ action: '清除上传记录', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的上传记录（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/uploads`).catch(() => {});
      });
      zClearAllUploads();
      addLog({ action: '清除上传记录', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的上传记录（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap, zClearStoreUploads, zClearAllUploads]);

  const clearStoreList = useCallback(() => {
    console.log('[CLEAR] Clearing store list');
    addLog({ action: '清除店铺列表', storeId: '全部', storeName: '全部店铺', details: '清除店铺列表', result: 'success' });
    setDataFilter('');
  }, []);

  // taxConfigs 和 customDeductions 的 setter 包装（直接替换整个数组）
  const setTaxConfigs = useCallback((configs: TaxConfig[]) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setTaxConfigs(dataFilter, configs);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, configs);
  }, [dataFilter]);
  const setCustomDeductions = useCallback((deductions: CustomDeduction[]) => {
    if (isAllStores(dataFilter)) return;
    useDataStore.getState().setCustomDeductions(dataFilter, deductions);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, deductions);
  }, [dataFilter]);

  return (
    <DataContext.Provider value={{
      dataFilter, setDataFilter,
      getStoreData, setStoreData, setStoreDataLocal, currentDisplayData,
      productCosts, setProductCost,
      costConfigs, setCostConfig,
      packagingFeePerOrder, setPackagingFeePerOrder,
      pricingPresets, addPricingPreset, updatePricingPreset, removePricingPreset,
      uploadRecords: filteredUploadRecords, allUploadRecords: uploadRecords, addUploadRecord, deleteUploadRecord, clearStoreUploads, clearStoreData,
      taxConfigs, setTaxConfigs, addTaxConfig, removeTaxConfig, updateTaxConfig,
      customDeductions, setCustomDeductions, addCustomDeduction, removeCustomDeduction, updateCustomDeduction,
      defaultCostRatio, setDefaultCostRatio,
      shippingFeePerOrder, setShippingFeePerOrder,
      platformCommissionRate, setPlatformCommissionRate,
      laborFeePerOrder, setLaborFeePerOrder,
      insuranceFeePerOrder, setInsuranceFeePerOrder,
      promotionFeePerOrder, setPromotionFeePerOrder,
      subsidyCommissionRate, setSubsidyCommissionRate,
      orderFinancialActuals, unlinkedFinancials,
      abnormalOrders, setAbnormalOrder, removeAbnormalOrder,
      costHistory, addCostHistory,
      clearAllData,
      clearOrderData, clearPromotionData, clearFinancialData, clearCostData,
      clearUploadRecords: clearUploadRecordsFn, clearStoreList,
      syncStatus, dataLoading, refreshStoreData,
      serverDashboard, serverProducts, serverPromotion, serverAfterSale,
      serverTrends, serverRegions, serverLogistics, serverPromoTrends,
      serverCosts, serverCompare, serverFinancial,
      analyticsLoading, refreshAnalytics,
    }}>
      {children}
    </DataContext.Provider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // ★ 管理员账号走管理后台，不进入前端主站
  if (user.role === 'admin') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ★ ErrorBoundary 已迁移至 src/components/ErrorBoundary.tsx（更完善的重试+错误详情）

// ★ 路由追踪：页面切换自动记录 page_view 事件
function RouteTracker() {
  const location = useLocation();
  useEffect(() => {
    initTracker();
    trackPageView(location.pathname);
  }, [location.pathname]);
  return null;
}

// ★ 根级主题初始化：确保暗色模式在任何页面渲染前就已生效
function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { ready } = useDarkMode();
  if (!ready) return null; // 等待主题就绪再渲染子组件（防闪烁）
  return <>{children}</>;
}

function App() {
  useAutoReload('/build-meta.json');

  // ── 读取公开设置（复制权限等） ──
  useEffect(() => {
    fetch('/api/v1/settings/public')
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          const copyEnabled = res.data.copyEnabled !== false;
          document.body.style.userSelect = copyEnabled ? '' : 'none';
          document.body.style.webkitUserSelect = copyEnabled ? '' : 'none';
        }
      })
      .catch(() => {});
  }, []);

  return (
    <ErrorBoundary>
    <Toaster position="top-right" richColors closeButton />
    <ProtectionProvider>
    <ThemeProvider>
    <AuthProvider>
      <PermissionProvider>
      <LayoutProvider>
      <StoreProvider>
        <DataProvider>
          <HashRouter>
            <RouteTracker />
            <Routes>
              {/* ★ 所有页面包裹 ErrorBoundary + Suspense */}
              <Route path="/login" element={<RouteWrapper><AuthPage /></RouteWrapper>} />
              <Route path="/register" element={<RouteWrapper><AuthPage /></RouteWrapper>} />
              <Route path="/stores" element={<RouteWrapper><RequireAuth><StoresPage /></RequireAuth></RouteWrapper>} />
              <Route path="/upload" element={<RouteWrapper><RequireAuth><MainLayout><UploadPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/dashboard" element={<RouteWrapper><RequireAuth><MainLayout><DashboardPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/product" element={<RouteWrapper><RequireAuth><MainLayout><ProductPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/user" element={<RouteWrapper><RequireAuth><MainLayout><UserPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/trend" element={<RouteWrapper><RequireAuth><MainLayout><TrendPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/region" element={<RouteWrapper><RequireAuth><MainLayout><RegionPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/logistics" element={<RouteWrapper><RequireAuth><MainLayout><LogisticsPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/cost" element={<RouteWrapper><RequireAuth><MainLayout><CostPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/after-sale" element={<RouteWrapper><RequireAuth><MainLayout><AfterSalePage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/shipping-insurance" element={<RouteWrapper><RequireAuth><MainLayout><InsurancePage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/promotion" element={<RouteWrapper><RequireAuth><MainLayout><PromotionPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/risk" element={<RouteWrapper><RequireAuth><MainLayout><RiskPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/time-window" element={<RouteWrapper><RequireAuth><MainLayout><TimeWindowPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/membership" element={<RouteWrapper><RequireAuth><MainLayout><MembershipPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/settings" element={<RouteWrapper><RequireAuth><SettingsPage /></RequireAuth></RouteWrapper>} />
              <Route path="/cost-management" element={<RouteWrapper><RequireAuth><MainLayout><CostManagementPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/reconciliation" element={<RouteWrapper><RequireAuth><MainLayout><ReconciliationPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/product-links" element={<RouteWrapper><RequireAuth><MainLayout><ProductLinksPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/sub-accounts" element={<RouteWrapper><RequireAuth><MainLayout><SubAccountsPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
        </DataProvider>
      </StoreProvider>
      </LayoutProvider>
      </PermissionProvider>
    </AuthProvider>
    </ThemeProvider>
    </ProtectionProvider>
    </ErrorBoundary>
  );
}

export default App;
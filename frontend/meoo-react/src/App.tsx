import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary';
import MainLayout from './components/MainLayout';
import { Database, BarChart3, Loader2 } from 'lucide-react';

// ★ 代码分割：按路由懒加载（首屏只加载当前页面代码，其余按需加载）
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const StoresPage = lazy(() => import('./pages/StoresPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const CostManagementPage = lazy(() => import('./pages/CostManagementPage'));
const ProductPage = lazy(() => import('./pages/ProductPage'));
const UserPage = lazy(() => import('./pages/UserPage'));
const TrendPage = lazy(() => import('./pages/TrendPage'));
const RegionPage = lazy(() => import('./pages/RegionPage'));
const LogisticsPage = lazy(() => import('./pages/LogisticsPage'));
const CostPage = lazy(() => import('./pages/CostPage'));
const AfterSalePage = lazy(() => import('./pages/AfterSalePage'));
const InsurancePage = lazy(() => import('./pages/InsurancePage'));
const PromotionPage = lazy(() => import('./pages/PromotionPage'));
const RiskPage = lazy(() => import('./pages/RiskPage'));
const MembershipPage = lazy(() => import('./pages/MembershipPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SubAccountsPage = lazy(() => import('./pages/SubAccountsPage'));
const ProductLinksPage = lazy(() => import('./pages/ProductLinksPage'));
const FinancePage = lazy(() => import('./pages/FinancePage'));

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
    <p className="text-sm text-pdd-text-secondary">服务器计算中，请稍候...</p>
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
import { analyticsApi, type BulkAnalytics, type DashboardResponse, type ProductKpi, type PromotionResponse, type AfterSaleResponse,
  type DailyTrend, type RegionItem, type LogisticsSummary, type PromoByDateItem, type CostSummary, type PeriodCompare, type FinancialSummary } from '../api/analyticsApi';
import { apiClient, hasTokens, clearTokens, getAccessToken } from '../api/client';

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

  const logout = useCallback(() => { setUser(null); clearTokens(); }, []);

  return (
    <AuthContext.Provider value={{
      user, setUser, logout,
      isPaid: isFullMember(user),
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
  addStore: (name: string) => Store;
  renameStore: (id: string, newName: string) => void;
  switchStore: (id: string) => void;
  deleteStore: (id: string) => void;
  clearCurrentStore: () => void;
}

const StoreContext = createContext<StoreContextType>(null!);
export const useStore = () => useContext(StoreContext);

export function StoreProvider({ children }: { children: React.ReactNode }) {
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
      // ★ 自动选中第一个真实店铺（解决刷新后无选中店铺导致数据空白）
      const realStore = mapped.find(s => s.id !== ALL_STORES_ID);
      if (realStore && wasEmpty) {
        setCurrentStore(realStore);
      }
      return mapped;
    } else if (res.success) {
      storesRef.current = [];
      setStores([]);
      setStoresLoaded(true);
    }
    return null;
  }, []);

  // 登录后首次拉取店铺列表
  useEffect(() => { fetchStores(); }, [fetchStores]);

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
    if (found) setCurrentStore(found);
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
  availableFields: { csv: Set<string>; promotion: Set<string>; insurance: Set<string>; afterSale: Set<string> };
}

interface UploadRecord {
  id: string;
  fileName: string;
  fileType: string;
  storeId: string;
  storeName: string;
  uploadedAt: string;
  rowCount: number;
  fieldCount: number;
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
  setStoreData: (storeId: string, dataOrUpdater: any) => void;
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
  refreshStoreData: (storeId: string) => Promise<void>; // ★ 按需加载原始数据
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
  analyticsError: string | null;
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
  availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() }
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { stores, currentStore, switchStore } = useStore();
  const dataFilter = currentStore?.id || '';
  const setDataFilter = useCallback((f: string) => {
    if (f) switchStore(f);
  }, [switchStore]);
  const [storeDataMap, setStoreDataMap] = useState<Record<string, StoreDataItem>>({});
  const [dataLoading, setDataLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');

  // ★ 登录/刷新后从服务器恢复全部数据（配置+原始数据+上传记录）
  useEffect(() => {
    if (!user || !hasTokens()) return;
    const realStores = stores.filter(s => s.id !== ALL_STORES_ID);
    if (!realStores.length) return;

    setDataLoading(true);
    Promise.all(realStores.map(store =>
      pullStoreData(store.id).then(serverData => ({ storeId: store.id, serverData }))
    )).then(results => {
      for (const { storeId, serverData } of results) {
        if (!serverData) continue;

        // 恢复原始数据到 storeDataMap
        if (serverData.data) {
          const sd = serverData.data;
          setStoreDataMap(prev => ({
            ...prev,
            [storeId]: {
              orders: sd.orders || [],
              promotionSummary: sd.promotionSummary || [],
              promotionProducts: sd.promotionProducts || [],
              starStoreSummary: sd.starStoreSummary || [],
              liveStreamSummary: sd.liveStreamSummary || [],
              shippingInsurance: sd.shippingInsurance || [],
              afterSaleRecords: sd.afterSaleRecords || [],
              financialRecords: sd.financialRecords || [],
              availableFields: {
                csv: new Set(Array.isArray(sd.availableFields?.csv) ? sd.availableFields.csv : []),
                promotion: new Set(Array.isArray(sd.availableFields?.promotion) ? sd.availableFields.promotion : []),
                insurance: new Set(Array.isArray(sd.availableFields?.insurance) ? sd.availableFields.insurance : []),
                afterSale: new Set(Array.isArray(sd.availableFields?.afterSale) ? sd.availableFields.afterSale : []),
              }
            }
          }));
        }

        // 恢复上传记录
        if (serverData.uploadRecords?.length) {
          setUploadRecords(prev => {
            const existing = new Set(prev.map(r => r.id));
            const newRecords = serverData.uploadRecords.filter((r: any) => !existing.has(r.id));
            return [...prev, ...newRecords];
          });
        }

        // 恢复配置
        if (serverData.configs) {
          for (const [key, value] of Object.entries(serverData.configs)) {
            const val = typeof value === 'string' ? value : JSON.stringify(value);
            if (key.startsWith('dianfx_product_costs_')) setProductCostsByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_cost_configs_')) setCostConfigsByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_packaging_fee_')) setPackagingFeeByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_shipping_fee_')) setShippingFeeByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_platform_commission_')) setPlatformCommissionByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_insurance_fee_')) setInsuranceFeeByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_default_cost_ratio_')) setDefaultCostRatioByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_tax_configs_')) setTaxConfigsByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_custom_deductions_')) setCustomDeductionsByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_abnormal_orders_')) setAbnormalOrdersByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_cost_history_')) setCostHistoryByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_pricing_presets_')) setPricingPresetsByStore(prev => ({ ...prev, [storeId]: typeof value === 'string' ? JSON.parse(value) : value }));
            else if (key.startsWith('dianfx_labor_fee_')) setLaborFeeByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
            else if (key.startsWith('dianfx_promotion_fee_')) setPromotionFeeByStore(prev => ({ ...prev, [storeId]: parseFloat(val) || 0 }));
          }
        }
      }
    }).catch((e: any) => {
      console.error('[data] Load failed:', e?.message || e);
    }).finally(() => setDataLoading(false));
  }, [user, stores]);

  // ★ 按需加载原始数据（页面需要时调用）
  const refreshStoreData = useCallback(async (storeId: string) => {
    if (!storeId || isAllStores(storeId)) return;
    const serverData = await pullStoreData(storeId);
    if (!serverData?.data) return;
    const sd = serverData.data;
    setStoreDataMap(prev => ({
      ...prev,
      [storeId]: {
        orders: sd.orders || [], promotionSummary: sd.promotionSummary || [],
        promotionProducts: sd.promotionProducts || [], starStoreSummary: sd.starStoreSummary || [],
        liveStreamSummary: sd.liveStreamSummary || [], shippingInsurance: sd.shippingInsurance || [],
        afterSaleRecords: sd.afterSaleRecords || [], financialRecords: sd.financialRecords || [],
        availableFields: {
          csv: new Set(Array.isArray(sd.availableFields?.csv) ? sd.availableFields.csv : []),
          promotion: new Set(Array.isArray(sd.availableFields?.promotion) ? sd.availableFields.promotion : []),
          insurance: new Set(Array.isArray(sd.availableFields?.insurance) ? sd.availableFields.insurance : []),
          afterSale: new Set(Array.isArray(sd.availableFields?.afterSale) ? sd.availableFields.afterSale : []),
        }
      }
    }));
  }, []);

  // ★ 配置状态（全部从服务器加载，不存浏览器）
  const [productCostsByStore, setProductCostsByStore] = useState<Record<string, Record<string, number>>>({});
  const [costConfigsByStore, setCostConfigsByStore] = useState<Record<string, Record<string, CostConfig>>>({});
  const [packagingFeeByStore, setPackagingFeeByStore] = useState<Record<string, number>>({});
  const [pricingPresetsByStore, setPricingPresetsByStore] = useState<Record<string, any[]>>({});
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>([]);
  const [taxConfigsByStore, setTaxConfigsByStore] = useState<Record<string, TaxConfig[]>>({});
  const [customDeductionsByStore, setCustomDeductionsByStore] = useState<Record<string, CustomDeduction[]>>({});
  const [defaultCostRatioByStore, setDefaultCostRatioByStore] = useState<Record<string, number>>({});
  const [shippingFeeByStore, setShippingFeeByStore] = useState<Record<string, number>>({});
  const [platformCommissionByStore, setPlatformCommissionByStore] = useState<Record<string, number>>({});
  const [laborFeeByStore, setLaborFeeByStore] = useState<Record<string, number>>({});
  const [insuranceFeeByStore, setInsuranceFeeByStore] = useState<Record<string, number>>({});
  const [promotionFeeByStore, setPromotionFeeByStore] = useState<Record<string, number>>({});
  const [abnormalOrdersByStore, setAbnormalOrdersByStore] = useState<Record<string, Record<string, AbnormalOrderRecord>>>({});
  const [costHistoryByStore, setCostHistoryByStore] = useState<Record<string, CostHistoryEntry[]>>({});

  // ---- 计算当前店铺的值（根据 dataFilter 自动选择） ----

  // 当前店铺 ID（__all__ 模式返回空字符串）
  const currentStoreId = useMemo(() => isAllStores(dataFilter) ? '' : dataFilter, [dataFilter]);

  const productCosts = useMemo((): Record<string, number> => {
    return productCostsByStore[dataFilter] || {};
  }, [dataFilter, productCostsByStore]);

  const costConfigs = useMemo((): Record<string, CostConfig> => {
    return costConfigsByStore[dataFilter] || {};
  }, [dataFilter, costConfigsByStore]);

  const packagingFeePerOrder = useMemo((): number => {
    return packagingFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, packagingFeeByStore]);

  const pricingPresets = useMemo((): any[] => {
    return pricingPresetsByStore[dataFilter] || [];
  }, [dataFilter, pricingPresetsByStore]);

  const taxConfigs = useMemo((): TaxConfig[] => {
    return taxConfigsByStore[dataFilter] || [];
  }, [dataFilter, taxConfigsByStore]);

  const customDeductions = useMemo((): CustomDeduction[] => {
    return customDeductionsByStore[dataFilter] || [];
  }, [dataFilter, customDeductionsByStore]);

  const defaultCostRatio = useMemo((): number => {
    return defaultCostRatioByStore[dataFilter] ?? 0;
  }, [dataFilter, defaultCostRatioByStore]);

  const shippingFeePerOrder = useMemo((): number => {
    return shippingFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, shippingFeeByStore]);

  const platformCommissionRate = useMemo((): number => {
    return platformCommissionByStore[dataFilter] ?? 0;
  }, [dataFilter, platformCommissionByStore]);

  const laborFeePerOrder = useMemo((): number => {
    return laborFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, laborFeeByStore]);

  const insuranceFeePerOrder = useMemo((): number => {
    return insuranceFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, insuranceFeeByStore]);

  const promotionFeePerOrder = useMemo((): number => {
    return promotionFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, promotionFeeByStore]);

  const abnormalOrders = useMemo((): Record<string, AbnormalOrderRecord> => {
    return abnormalOrdersByStore[dataFilter] || {};
  }, [dataFilter, abnormalOrdersByStore]);

  const costHistory = useMemo((): CostHistoryEntry[] => {
    return costHistoryByStore[dataFilter] || [];
  }, [dataFilter, costHistoryByStore]);

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
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const analyticsFetchIdRef = useRef(0);
  const lastRefreshTimeRef = useRef<number>(0);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sseConnectedRef = useRef(false);

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
  const refreshAnalytics = useCallback(async (storeId?: string) => {
    const sid = storeId || dataFilter;
    if (!sid || !hasTokens()) return;

    const fetchId = ++analyticsFetchIdRef.current;
    setAnalyticsLoading(true);
    setAnalyticsError(null);

    try {
      const bulk = await analyticsApi.getBulk(sid);
      if (fetchId !== analyticsFetchIdRef.current) return; // 防竞态
      if (bulk) {
        applyBulkData(bulk);
        setAnalyticsLoading(false);
      } else {
        setAnalyticsError('数据加载失败，请检查网络后重试');
        setAnalyticsLoading(false);
      }
    } catch {
      if (fetchId !== analyticsFetchIdRef.current) return;
      setAnalyticsError('数据加载失败，请检查网络后重试');
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

    const tokensStr = localStorage.getItem('dianfx_jwt_tokens');
    if (!tokensStr) return;
    let token = '';
    try { token = JSON.parse(tokensStr).accessToken || ''; } catch { return; }
    if (!token) return;

    const sseUrl = `${apiClient.getBaseUrl()}/sse?token=${encodeURIComponent(token)}`;
    let aborted = false;
    let reconnectTimer: NodeJS.Timeout | null = null;
    const abortController = new AbortController();

    function connectSSE() {
      if (aborted) return;
      (async () => {
        try {
          const res = await fetch(sseUrl, {
            headers: { 'Authorization': `Bearer ${token}` },
            signal: abortController.signal,
          });
          if (!res.ok || !res.body) {
            sseConnectedRef.current = false;
            scheduleReconnect();
            return;
          }
          sseConnectedRef.current = true;

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (!aborted) {
            const { done, value } = await reader.read();
            if (done) { sseConnectedRef.current = false; break; }
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
                      // SSE推送到达 → 立即刷新
                      refreshAnalytics(payload.storeId);
                    } else if (eventType === 'config:updated' && payload.storeId) {
                      refreshAnalytics(payload.storeId);
                    } else if (eventType === 'data:deleted' && payload.storeId) {
                      refreshAnalytics(payload.storeId);
                    }
                  } catch {}
                }
              }
            }
          }
        } catch {
          sseConnectedRef.current = false;
        }
      })();
    }

    function scheduleReconnect() {
      if (aborted) return;
      reconnectTimer = setTimeout(() => {
        connectSSE();
      }, 10000); // 10秒后重连
    }

    connectSSE();

    return () => {
      aborted = true;
      abortController.abort();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ★ Layer 3: 轮询兜底（SSE断开时每30秒自动刷新）
  useEffect(() => {
    if (!user || !dataFilter) return;

    const POLL_INTERVAL = 30000;
    const pollTimer = setInterval(() => {
      // 只在SSE断开且距上次刷新超过25秒时才轮询
      if (!sseConnectedRef.current && Date.now() - lastRefreshTimeRef.current > 25000) {
        refreshAnalytics(dataFilter);
      }
    }, POLL_INTERVAL);

    return () => clearInterval(pollTimer);
  }, [user, dataFilter, refreshAnalytics]);

  // ★ Layer 4: 页面可见性刷新（切回标签页时自动刷新）
  useEffect(() => {
    if (!user) return;

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && dataFilter) {
        // 距上次刷新超过15秒才刷新
        if (Date.now() - lastRefreshTimeRef.current > 15000) {
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
    setStoreDataMap(prev => {
      const prevStoreData = prev[storeId] || null;
      const newData = typeof dataOrUpdater === 'function'
        ? (dataOrUpdater as (prev: StoreDataItem | null) => StoreDataItem)(prevStoreData)
        : dataOrUpdater;
      return { ...prev, [storeId]: newData };
    });
  }, []);

  const setStoreData = useCallback((storeId: string, dataOrUpdater: any) => {
    setStoreDataMap(prev => {
      const prevStoreData = prev[storeId] || null;
      const newData = typeof dataOrUpdater === 'function'
        ? (dataOrUpdater as (prev: StoreDataItem | null) => StoreDataItem)(prevStoreData)
        : dataOrUpdater;
      setSyncStatus('syncing');
      const storeName = stores.find(s => s.id === storeId)?.name || '';
      const slimData: Record<string, any[]> = {};
      const categories = ['orders', 'promotionSummary', 'promotionProducts', 'starStoreSummary', 'liveStreamSummary', 'shippingInsurance', 'afterSaleRecords', 'financialRecords'];
      for (const cat of categories) {
        if (Array.isArray((newData as any)[cat]) && (newData as any)[cat].length > 0) {
          slimData[cat] = (newData as any)[cat];
        }
      }
      slimData.availableFields = {
        csv: Array.from(newData.availableFields?.csv || []),
        promotion: Array.from(newData.availableFields?.promotion || []),
        insurance: Array.from(newData.availableFields?.insurance || []),
        afterSale: Array.from(newData.availableFields?.afterSale || []),
      };
      const sid = storeId;
      syncStoreData(sid, storeName, slimData as any, {}, [])
        .then(() => {
          setSyncStatus('done');
          // ★ Layer 1: 同步后直接调 refreshAnalytics 刷新（不走 getBulk 避免 URL 编码问题）
          refreshAnalytics(sid);
        })
        .catch(e => { console.error('[data] sync error:', e); setSyncStatus('error'); });
      setTimeout(() => { setSyncStatus(prev => prev === 'done' || prev === 'error' ? 'idle' : prev); }, 3000);
      return { ...prev, [storeId]: newData };
    });
  }, [stores, refreshAnalytics]);

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
        availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() },
      };
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
        sd.availableFields.csv.forEach(f => merged.availableFields.csv.add(f));
        sd.availableFields.promotion.forEach(f => merged.availableFields.promotion.add(f));
        sd.availableFields.insurance.forEach(f => merged.availableFields.insurance.add(f));
        sd.availableFields.afterSale.forEach(f => merged.availableFields.afterSale.add(f));
      }
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
    setProductCostsByStore(prev => {
      const current = prev[dataFilter] || {};
      const next = { ...prev, [dataFilter]: { ...current, [code]: cost } };
      // ★ 即时同步到服务器
      syncStoreConfig(dataFilter, `dianfx_product_costs_${dataFilter}`, next[dataFilter]);
      return next;
    });
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改商品成本: ${code} → ¥${cost}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setCostConfig = useCallback((code: string, config: CostConfig) => {
    if (isAllStores(dataFilter)) return;
    setCostConfigsByStore(prev => {
      const current = prev[dataFilter] || {};
      const next = { ...prev, [dataFilter]: { ...current, [code]: config } };
      syncStoreConfig(dataFilter, `dianfx_cost_configs_${dataFilter}`, next[dataFilter]);
      return next;
    });
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改成本配置: ${code}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const addPricingPreset = useCallback((preset: any) => {
    if (isAllStores(dataFilter)) return;
    setPricingPresetsByStore(prev => {
      const next = [...(prev[dataFilter] || []), preset];
      syncStoreConfig(dataFilter, `dianfx_pricing_presets_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
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
    setUploadRecords(prev => [...prev, newRecord]);
    addLog({ action: '上传数据', storeId, storeName: record.storeName, details: `上传文件: ${record.fileName} (${record.fileType}, ${record.rowCount}行)`, result: 'success' });
  }, [dataFilter]);
  const deleteUploadRecord = useCallback((id: string) => {
    setUploadRecords(prev => {
      const record = prev.find(r => r.id === id);
      if (!record) return prev;
      addLog({ action: '删除上传记录', storeId: record.storeId, storeName: record.storeName, details: `删除上传记录: ${record.fileName}`, result: 'success' });
      // ★ 同步删除服务端对应分类数据
      const catMap: Record<string, string> = {
        '订单数据': 'orders', '商品推广数据': 'promotionProducts', '明星店铺数据': 'starStoreSummary',
        '直播推广数据': 'liveStreamSummary', '运费险数据': 'shippingInsurance', '售后数据': 'afterSaleRecords',
      };
      const cat = catMap[record.fileType];
      if (cat) {
        apiClient.delete(`/data/store/${encodeURIComponent(record.storeId)}/category/${cat}`).catch(() => {});
      }
      setStoreDataMap(prevMap => {
        const storeData = prevMap[record.storeId];
        if (!storeData) return prevMap;
        const newData = { ...storeData };
        if (record.fileType === '订单数据') {
          newData.orders = [];
          newData.availableFields = { ...newData.availableFields, csv: new Set() };
        } else if (record.fileType === '商品推广数据') {
          newData.promotionSummary = [];
          newData.promotionProducts = [];
          newData.availableFields = { ...newData.availableFields, promotion: new Set() };
        } else if (record.fileType === '明星店铺数据') {
          newData.starStoreSummary = [];
        } else if (record.fileType === '直播推广数据') {
          newData.liveStreamSummary = [];
        } else if (record.fileType === '运费险数据') {
          newData.shippingInsurance = [];
          newData.availableFields = { ...newData.availableFields, insurance: new Set() };
        } else if (record.fileType === '售后数据') {
          newData.afterSaleRecords = [];
          newData.availableFields = { ...newData.availableFields, afterSale: new Set() };
        }
        return { ...prevMap, [record.storeId]: newData };
      });
      return prev.filter(r => r.id !== id);
    });
  }, [setDataFilter]);
  const clearStoreUploads = useCallback((storeId: string) => {
    setUploadRecords(prev => prev.filter(r => r.storeId !== storeId));
  }, []);
  const clearStoreData = useCallback((storeId: string) => {
    // ★ 同步删除服务端数据
    apiClient.delete(`/data/store/${encodeURIComponent(storeId)}`).catch(() => {});
    setStoreDataMap(prev => {
      const newData = { ...prev };
      delete newData[storeId];
      return newData;
    });
  }, []);

  // Tax config callbacks
  const addTaxConfig = useCallback((config: TaxConfig) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => {
      const next = [...(prev[dataFilter] || []), config];
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加税费: ${config.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeTaxConfig = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => {
      const next = (prev[dataFilter] || []).filter((t: TaxConfig) => t.id !== id);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateTaxConfig = useCallback((id: string, updates: Partial<TaxConfig>) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => {
      const next = (prev[dataFilter] || []).map((t: TaxConfig) => t.id === id ? { ...t, ...updates } : t);
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `更新税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // Custom deduction callbacks
  const addCustomDeduction = useCallback((deduction: CustomDeduction) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => {
      const next = [...(prev[dataFilter] || []), deduction];
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加自定义扣费: ${deduction.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeCustomDeduction = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => {
      const next = (prev[dataFilter] || []).filter((d: CustomDeduction) => d.id !== id);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除自定义扣费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateCustomDeduction = useCallback((id: string, updates: Partial<CustomDeduction>) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => {
      const next = (prev[dataFilter] || []).map((d: CustomDeduction) => d.id === id ? { ...d, ...updates } : d);
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
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
    setCostHistoryByStore(prev => {
      const next = [newEntry, ...(prev[dataFilter] || [])].slice(0, 500);
      syncStoreConfig(dataFilter, `dianfx_cost_history_${dataFilter}`, next);
      return { ...prev, [dataFilter]: next };
    });
  }, [dataFilter]);

  const setAbnormalOrder = useCallback((orderNo: string, record: AbnormalOrderRecord) => {
    if (isAllStores(dataFilter)) return;
    setAbnormalOrdersByStore(prev => {
      const current = prev[dataFilter] || {};
      const next = { ...prev, [dataFilter]: { ...current, [orderNo]: record } };
      syncStoreConfig(dataFilter, `dianfx_abnormal_orders_${dataFilter}`, next[dataFilter]);
      return next;
    });
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeAbnormalOrder = useCallback((orderNo: string) => {
    if (isAllStores(dataFilter)) return;
    setAbnormalOrdersByStore(prev => {
      const current = { ...(prev[dataFilter] || {}) };
      delete current[orderNo];
      syncStoreConfig(dataFilter, `dianfx_abnormal_orders_${dataFilter}`, current);
      return { ...prev, [dataFilter]: current };
    });
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `移除异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // ---- 数值型配置的 Setter ----

  const setPackagingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setPackagingFeeByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_packaging_fee_${dataFilter}`, fee);
      return { ...prev, [dataFilter]: fee };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置包装费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setDefaultCostRatio = useCallback((ratio: number) => {
    if (isAllStores(dataFilter)) return;
    setDefaultCostRatioByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_default_cost_ratio_${dataFilter}`, ratio);
      return { ...prev, [dataFilter]: ratio };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置默认成本比例: ${ratio}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setShippingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setShippingFeeByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_shipping_fee_${dataFilter}`, fee);
      return { ...prev, [dataFilter]: fee };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setPlatformCommissionRate = useCallback((rate: number) => {
    if (isAllStores(dataFilter)) return;
    setPlatformCommissionByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_platform_commission_${dataFilter}`, rate);
      return { ...prev, [dataFilter]: rate };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置平台佣金率: ${rate}%`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setLaborFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setLaborFeeByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_labor_fee_${dataFilter}`, fee);
      return { ...prev, [dataFilter]: fee };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置人工费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setInsuranceFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setInsuranceFeeByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_insurance_fee_${dataFilter}`, fee);
      return { ...prev, [dataFilter]: fee };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费险: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setPromotionFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setPromotionFeeByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_promotion_fee_${dataFilter}`, fee);
      return { ...prev, [dataFilter]: fee };
    });
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置推广费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // 清空所有数据（同步清除服务端 + React state）
  const clearAllData = useCallback(async () => {
    console.log('[CLEAR] Clearing all data (server + local)');
    addLog({ action: '清空全部数据', storeId: '全部', storeName: '全部店铺', details: '清空所有数据（含云端）', result: 'success' });
    // ★ 调用服务端清除所有数据
    try { await apiClient.post('/data/clear-all'); } catch (e) { console.error('[clearAllData] server error:', e); }
    setStoreDataMap({});
    setDataFilter('');
    setUploadRecords([]);
    setProductCostsByStore({});
    setCostConfigsByStore({});
    setPackagingFeeByStore({});
    setPricingPresetsByStore({});
    setTaxConfigsByStore({});
    setCustomDeductionsByStore({});
    setDefaultCostRatioByStore({});
    setShippingFeeByStore({});
    setPlatformCommissionByStore({});
    setLaborFeeByStore({});
    setInsuranceFeeByStore({});
    setPromotionFeeByStore({});
    setAbnormalOrdersByStore({});
    setCostHistoryByStore({});
  }, []);

  const clearOrderData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing order data', storeId ?? 'ALL');
    if (storeId) {
      // ★ 同步清除服务端订单数据
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/category/orders`).catch(() => {});
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], orders: [], availableFields: { ...prev[storeId].availableFields, csv: new Set() } } };
      });
      addLog({ action: '清除订单数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的订单数据（含云端）`, result: 'success' });
    } else {
      // 全部店铺：逐个调用服务端
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/orders`).catch(() => {});
      });
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, orders: [], availableFields: { ...d.availableFields, csv: new Set() } };
        }
        return next;
      });
      addLog({ action: '清除订单数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的订单数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearPromotionData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing promotion data', storeId ?? 'ALL');
    const promoCats = ['promotionSummary', 'promotionProducts', 'starStoreSummary', 'liveStreamSummary'];
    if (storeId) {
      // ★ 同步清除服务端推广数据（4个分类）
      promoCats.forEach(cat => {
        apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/category/${cat}`).catch(() => {});
      });
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], availableFields: { ...prev[storeId].availableFields, promotion: new Set() } } };
      });
      addLog({ action: '清除推广数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的推广数据（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        promoCats.forEach(cat => {
          apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/${cat}`).catch(() => {});
        });
      });
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], availableFields: { ...d.availableFields, promotion: new Set() } };
        }
        return next;
      });
      addLog({ action: '清除推广数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的推广数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearFinancialData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing financial data', storeId ?? 'ALL');
    if (storeId) {
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/category/financialRecords`).catch(() => {});
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], financialRecords: [] } };
      });
      addLog({ action: '清除财务报表', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的财务报表数据（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/category/financialRecords`).catch(() => {});
      });
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, financialRecords: [] };
        }
        return next;
      });
      addLog({ action: '清除财务报表', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的财务报表数据（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearCostData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing cost data', storeId ?? 'ALL');
    if (storeId) {
      // ★ 同步清除服务端配置
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/configs`).catch(() => {});
      setProductCostsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCostConfigsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setPackagingFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setDefaultCostRatioByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setShippingFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setPlatformCommissionByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setLaborFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setInsuranceFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setPromotionFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setAbnormalOrdersByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCustomDeductionsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCostHistoryByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      addLog({ action: '清除成本配置', storeId, storeName: getStoreName(storeId), details: `清除成本配置（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/configs`).catch(() => {});
      });
      setProductCostsByStore({}); setCostConfigsByStore({}); setPackagingFeeByStore({});
      setDefaultCostRatioByStore({}); setShippingFeeByStore({}); setPlatformCommissionByStore({});
      setLaborFeeByStore({}); setInsuranceFeeByStore({}); setPromotionFeeByStore({});
      setAbnormalOrdersByStore({}); setCustomDeductionsByStore({}); setCostHistoryByStore({});
      addLog({ action: '清除成本配置', storeId: '全部', storeName: '全部店铺', details: '清除所有成本配置（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearUploadRecordsFn = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing upload records', storeId ?? 'ALL');
    if (storeId) {
      // ★ 同步清除服务端上传记录
      apiClient.delete(`/data/store/${encodeURIComponent(storeId)}/uploads`).catch(() => {});
      setUploadRecords(prev => prev.filter(r => r.storeId !== storeId));
      addLog({ action: '清除上传记录', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的上传记录（含云端）`, result: 'success' });
    } else {
      Object.keys(storeDataMap).forEach(sid => {
        apiClient.delete(`/data/store/${encodeURIComponent(sid)}/uploads`).catch(() => {});
      });
      setUploadRecords([]);
      addLog({ action: '清除上传记录', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的上传记录（含云端）', result: 'success' });
    }
  }, [getStoreName, storeDataMap]);

  const clearStoreList = useCallback(() => {
    console.log('[CLEAR] Clearing store list');
    addLog({ action: '清除店铺列表', storeId: '全部', storeName: '全部店铺', details: '清除店铺列表', result: 'success' });
    setDataFilter('');
  }, []);

  // taxConfigs 和 customDeductions 的 setter 包装（直接替换整个数组）
  const setTaxConfigs = useCallback((configs: TaxConfig[]) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_tax_configs_${dataFilter}`, configs);
      return { ...prev, [dataFilter]: configs };
    });
  }, [dataFilter]);
  const setCustomDeductions = useCallback((deductions: CustomDeduction[]) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => {
      syncStoreConfig(dataFilter, `dianfx_custom_deductions_${dataFilter}`, deductions);
      return { ...prev, [dataFilter]: deductions };
    });
  }, [dataFilter]);

  return (
    <DataContext.Provider value={{
      dataFilter, setDataFilter,
      getStoreData, setStoreData, setStoreDataLocal, currentDisplayData,
      productCosts, setProductCost,
      costConfigs, setCostConfig,
      packagingFeePerOrder, setPackagingFeePerOrder,
      pricingPresets, addPricingPreset,
      uploadRecords: filteredUploadRecords, allUploadRecords: uploadRecords, addUploadRecord, deleteUploadRecord, clearStoreUploads, clearStoreData,
      taxConfigs, setTaxConfigs, addTaxConfig, removeTaxConfig, updateTaxConfig,
      customDeductions, setCustomDeductions, addCustomDeduction, removeCustomDeduction, updateCustomDeduction,
      defaultCostRatio, setDefaultCostRatio,
      shippingFeePerOrder, setShippingFeePerOrder,
      platformCommissionRate, setPlatformCommissionRate,
      laborFeePerOrder, setLaborFeePerOrder,
      insuranceFeePerOrder, setInsuranceFeePerOrder,
      promotionFeePerOrder, setPromotionFeePerOrder,
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
      analyticsLoading, analyticsError, refreshAnalytics,
    }}>
      {children}
    </DataContext.Provider>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// ★ ErrorBoundary 已迁移至 src/components/ErrorBoundary.tsx（更完善的重试+错误详情）

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <StoreProvider>
        <DataProvider>
          <HashRouter>
            <Routes>
              {/* ★ 所有页面包裹 ErrorBoundary + Suspense */}
              <Route path="/login" element={<RouteWrapper><LoginPage /></RouteWrapper>} />
              <Route path="/register" element={<RouteWrapper><RegisterPage /></RouteWrapper>} />
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
              <Route path="/membership" element={<RouteWrapper><RequireAuth><MainLayout><MembershipPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/settings" element={<RouteWrapper><RequireAuth><SettingsPage /></RequireAuth></RouteWrapper>} />
              <Route path="/cost-management" element={<RouteWrapper><RequireAuth><MainLayout><CostManagementPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/finance" element={<RouteWrapper><RequireAuth><MainLayout><FinancePage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/product-links" element={<RouteWrapper><RequireAuth><MainLayout><ProductLinksPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/sub-accounts" element={<RouteWrapper><RequireAuth><MainLayout><SubAccountsPage /></MainLayout></RequireAuth></RouteWrapper>} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
        </DataProvider>
      </StoreProvider>
    </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import StoresPage from './pages/StoresPage';
import MainLayout from './components/MainLayout';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import CostManagementPage from './pages/CostManagementPage';
import ProductPage from './pages/ProductPage';
import UserPage from './pages/UserPage';
import TrendPage from './pages/TrendPage';
import RegionPage from './pages/RegionPage';
import LogisticsPage from './pages/LogisticsPage';
import CostPage from './pages/CostPage';
import AfterSalePage from './pages/AfterSalePage';
import InsurancePage from './pages/InsurancePage';
import PromotionPage from './pages/PromotionPage';
import RiskPage from './pages/RiskPage';
import MembershipPage from './pages/MembershipPage';
import SettingsPage from './pages/SettingsPage';
import ProductLinksPage from './pages/ProductLinksPage';
import FinancePage from './pages/FinancePage';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminMembers from './pages/admin/AdminMembers';
import AdminInvite from './pages/admin/AdminInvite';
import AdminData from './pages/admin/AdminData';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import { simpleHash } from './utils';
import type { TaxConfig, CustomDeduction } from './components/ProductLinkStats';
import { importSampleData, hasSampleData } from './utils/dataImporter';
import { aggregateStoreData, mergeRecordConfigs, mergeArrayConfigs, mergeAbnormalOrders, weightedAverageFee, ALL_STORES_ID, isAllStores } from './utils/storeAggregator';
import { addLog } from './utils/operationLog';
import { OrderFinancialActual, UnlinkedFinancials, buildFinancialIndex } from './utils/financialActuals';

interface User {
  id: string;
  username: string;
  role: 'normal' | 'test' | 'admin';
  membershipLevel: 'free' | 'pro' | 'enterprise';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
  setUser: (user: User) => void;
  signup: (username: string, password: string, phone?: string, inviteCode?: string) => { success: boolean; message: string };
  logout: () => void;
  upgradeMembership: (level: 'pro' | 'enterprise') => void;
  isPaid: boolean;
}

const AuthContext = createContext<AuthContextType>(null!);
export const useAuth = () => useContext(AuthContext);

const TEST_ACCOUNT = { username: '123456', password: '123456' };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('dianfx_user');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    if (user) localStorage.setItem('dianfx_user', JSON.stringify(user));
    else localStorage.removeItem('dianfx_user');
  }, [user]);

  const login = useCallback((username: string, password: string): boolean => {
    if (username === TEST_ACCOUNT.username && password === TEST_ACCOUNT.password) {
      setUser({ id: 'test-001', username: '123456', role: 'test', membershipLevel: 'enterprise' });
      return true;
    }
    const hashedPwd = simpleHash(password);
    const existingUsers = JSON.parse(localStorage.getItem('dianfx_users') || '[]');
    const found = existingUsers.find((u: any) => u.username === username && u.password === hashedPwd);
    if (found) {
      setUser({ id: found.id, username: found.username, role: 'normal', membershipLevel: found.membershipLevel || 'free' });
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => setUser(null), []);

  const upgradeMembership = useCallback((level: 'pro' | 'enterprise') => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, membershipLevel: level };
      const users = JSON.parse(localStorage.getItem('dianfx_users') || '[]');
      const idx = users.findIndex((u: any) => u.id === prev.id);
      if (idx !== -1) {
        users[idx].membershipLevel = level;
        localStorage.setItem('dianfx_users', JSON.stringify(users));
      }
      return updated;
    });
  }, []);

  const signup = useCallback((username: string, password: string, phone?: string, inviteCode?: string): { success: boolean; message: string } => {
    if (!inviteCode || !inviteCode.trim()) {
      return { success: false, message: '邀请码不能为空' };
    }
    const validCodes = JSON.parse(localStorage.getItem('dianfx_invite_codes') || '[]');
    const codeIndex = validCodes.findIndex((c: any) => c.code === inviteCode && !c.used);
    if (codeIndex === -1) {
      return { success: false, message: '邀请码无效或已被使用' };
    }
    validCodes[codeIndex].used = true;
    validCodes[codeIndex].usedBy = username;
    validCodes[codeIndex].usedAt = new Date().toISOString();
    localStorage.setItem('dianfx_invite_codes', JSON.stringify(validCodes));
    const existingUsers = JSON.parse(localStorage.getItem('dianfx_users') || '[]');
    if (existingUsers.find((u: any) => u.username === username)) {
      return { success: false, message: '该用户名已被注册' };
    }
    const userId = `user-${Date.now()}`;
    const hashedPwd = simpleHash(password);
    const newUser = { id: userId, username, password: hashedPwd, phone: phone || '', createdAt: new Date().toISOString() };
    existingUsers.push(newUser);
    localStorage.setItem('dianfx_users', JSON.stringify(existingUsers));
    setUser({ id: userId, username, role: 'normal', membershipLevel: 'free' });
    return { success: true, message: '注册成功' };
  }, []);

  return (
    <AuthContext.Provider value={{
      user, login, setUser, signup, logout, upgradeMembership,
      isPaid: user?.membershipLevel !== 'free',
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
  const [stores, setStores] = useState<Store[]>(() => {
    const saved = localStorage.getItem('dianfx_stores');
    return saved ? JSON.parse(saved) : [];
  });
  const [currentStore, setCurrentStore] = useState<Store | null>(() => {
    const saved = localStorage.getItem('dianfx_current_store');
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => { localStorage.setItem('dianfx_stores', JSON.stringify(stores)); }, [stores]);
  useEffect(() => {
    if (currentStore) localStorage.setItem('dianfx_current_store', JSON.stringify(currentStore));
    else localStorage.removeItem('dianfx_current_store');
  }, [currentStore]);

  const addStore = useCallback((name: string): Store => {
    const s: Store = { id: `store-${Date.now()}`, name, createdAt: new Date().toISOString() };
    setStores(prev => [...prev, s]);
    setCurrentStore(s);
    addLog({ action: '添加店铺', storeId: s.id, storeName: name, details: `添加店铺: ${name}`, result: 'success' });
    return s;
  }, []);

  const switchStore = useCallback((id: string) => {
    // 优先从 React state 查找（与 UI 渲染保持一致），localStorage 作为 fallback
    const foundInState = stores.find(s => s.id === id);
    if (foundInState) {
      setCurrentStore(foundInState);
      return;
    }
    const saved = localStorage.getItem('dianfx_stores');
    if (!saved) return;
    try {
      const allStores: Store[] = JSON.parse(saved);
      const found = allStores.find(s => s.id === id);
      if (found) setCurrentStore(found);
    } catch {}
  }, [stores]);

  const deleteStore = useCallback((id: string) => {
    const storeName = stores.find(s => s.id === id)?.name ?? id;
    addLog({ action: '删除店铺', storeId: id, storeName, details: `删除店铺: ${storeName}`, result: 'success' });
    setStores(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (currentStore?.id === id) {
        setCurrentStore(remaining[0] || null);
      }
      return remaining;
    });
    // 清理该店铺的所有 localStorage 键值
    const keysToRemove = [
      'dianfx_store_data_',
      'dianfx_product_costs_',
      'dianfx_cost_configs_',
      'dianfx_packaging_fee_',
      'dianfx_shipping_fee_',
      'dianfx_platform_commission_',
      'dianfx_labor_fee_',
      'dianfx_insurance_fee_',
      'dianfx_default_cost_ratio_',
      'dianfx_tax_configs_',
      'dianfx_custom_deductions_',
      'dianfx_abnormal_orders_',
      'dianfx_cost_history_',
      'dianfx_pricing_presets_',
    ];
    keysToRemove.forEach(prefix => {
      localStorage.removeItem(`${prefix}${id}`);
    });
    // 同时清理分片存储的 keys 索引
    const keysJson = localStorage.getItem('dianfx_store_data_map_keys');
    if (keysJson) {
      try {
        const keys: string[] = JSON.parse(keysJson);
        const updated = keys.filter(k => k !== id);
        if (updated.length > 0) {
          localStorage.setItem('dianfx_store_data_map_keys', JSON.stringify(updated));
        } else {
          localStorage.removeItem('dianfx_store_data_map_keys');
        }
      } catch {}
    }
    localStorage.removeItem(`dianfx_store_${id}`);
  }, [currentStore, stores]);

  const renameStore = useCallback((id: string, newName: string) => {
    const oldName = stores.find(s => s.id === id)?.name ?? id;
    setStores(prev => prev.map(s => s.id === id ? { ...s, name: newName } : s));
    if (currentStore?.id === id) {
      const updated = { ...currentStore, name: newName };
      setCurrentStore(updated);
      localStorage.setItem('dianfx_current_store', JSON.stringify(updated));
    }
    addLog({ action: '重命名店铺', storeId: id, storeName: newName, details: `店铺改名: "${oldName}" → "${newName}"`, result: 'success' });
  }, [currentStore, stores]);

  const clearCurrentStore = useCallback(() => {
    setCurrentStore(null);
    localStorage.removeItem('dianfx_current_store');
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
  setStoreData: (storeId: string, data: StoreDataItem) => void;
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
  const [dataFilter, setDataFilter] = useState<string>(() => {
    const saved = localStorage.getItem('dianfx_data_filter');
    if (saved === '__all__') {
      const currentStore = localStorage.getItem('dianfx_current_store');
      if (currentStore) {
        try { return JSON.parse(currentStore).id; } catch {}
      }
      return '';
    }
    return saved || '';
  });
  const [storeDataMap, setStoreDataMap] = useState<Record<string, StoreDataItem>>(() => {
    const parseStoreData = (sd: any): StoreDataItem => ({
      ...sd,
      afterSaleRecords: sd.afterSaleRecords || [],
      availableFields: {
        csv: new Set(sd.availableFields?.csv || []),
        promotion: new Set(sd.availableFields?.promotion || []),
        insurance: new Set(sd.availableFields?.insurance || []),
        afterSale: new Set(sd.availableFields?.afterSale || [])
      }
    });

    // 优先尝试整体存储
    const saved = localStorage.getItem('dianfx_store_data_map');
    console.log('[LOAD] dianfx_store_data_map exists:', !!saved, 'size:', saved?.length || 0);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        console.log('[LOAD] Parsed stores:', Object.keys(data));
        const result: Record<string, StoreDataItem> = {};
        for (const [storeId, storeData] of Object.entries(data)) {
          result[storeId] = parseStoreData(storeData);
          console.log('[LOAD] Store', storeId, '- orders:', (storeData as any).orders?.length || 0);
        }
        console.log('[LOAD] Final loaded stores:', Object.keys(result));
        return result;
      } catch (e) {
        console.error('[LOAD] Parse failed:', e);
      }
    }

    // 降级：尝试分片存储格式
    const keysJson = localStorage.getItem('dianfx_store_data_map_keys');
    if (keysJson) {
      try {
        const keys: string[] = JSON.parse(keysJson);
        const result: Record<string, StoreDataItem> = {};
        for (const storeId of keys) {
          const chunk = localStorage.getItem(`dianfx_store_${storeId}`);
          if (chunk) {
            result[storeId] = parseStoreData(JSON.parse(chunk));
          }
        }
        if (Object.keys(result).length > 0) return result;
      } catch {}
    }
    const legacyData = localStorage.getItem('dianfx_parsed_data');
    if (legacyData) {
      try {
        const data = JSON.parse(legacyData);
        const legacyStoreId = localStorage.getItem('dianfx_current_store');
        if (legacyStoreId) {
          const parsed = JSON.parse(legacyStoreId);
          if (parsed?.id) {
            const result: Record<string, StoreDataItem> = {};
            result[parsed.id] = {
              orders: data.orders || [],
              promotionSummary: data.promotionSummary || [],
              promotionProducts: data.promotionProducts || [],
              starStoreSummary: data.starStoreSummary || [],
              liveStreamSummary: data.liveStreamSummary || [],
              shippingInsurance: data.shippingInsurance || [],
              afterSaleRecords: data.afterSaleRecords || [],
              availableFields: {
                csv: new Set(data.availableFields?.csv || []),
                promotion: new Set(data.availableFields?.promotion || []),
                insurance: new Set(data.availableFields?.insurance || []),
                afterSale: new Set(data.availableFields?.afterSale || [])
              }
            };
            return result;
          }
        }
      } catch {}
    }
    return {};
  });
  // 辅助：读取当前店铺的配置（兼容旧格式无 storeId 后缀的键值）
  const getStoreScopedKey = (baseKey: string, storeId: string): string => `${baseKey}_${storeId}`;

  const loadPerStoreRecord = <T extends Record<string, any>>(baseKey: string, initialStoreId: string): Record<string, T> => {
    const result: Record<string, T> = {};
    // 遍历所有 localStorage 键值，找出匹配的
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${baseKey}_`)) {
        const storeId = key.slice(baseKey.length + 1);
        try {
          result[storeId] = JSON.parse(localStorage.getItem(key)!);
        } catch {}
      }
    }
    // 兼容旧格式（无 storeId 后缀）→ 迁移到当前店铺
    if (Object.keys(result).length === 0) {
      const legacy = localStorage.getItem(baseKey);
      if (legacy) {
        try {
          result[initialStoreId] = JSON.parse(legacy);
        } catch {}
      }
    }
    return result;
  };

  const loadPerStoreNumber = (baseKey: string, initialStoreId: string): Record<string, number> => {
    const result: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${baseKey}_`)) {
        const storeId = key.slice(baseKey.length + 1);
        const val = parseFloat(localStorage.getItem(key)!);
        if (!isNaN(val)) result[storeId] = val;
      }
    }
    if (Object.keys(result).length === 0) {
      const legacy = localStorage.getItem(baseKey);
      if (legacy !== null) {
        const val = parseFloat(legacy);
        if (!isNaN(val)) result[initialStoreId] = val;
      }
    }
    return result;
  };

  const loadPerStoreArray = <T extends any>(baseKey: string, initialStoreId: string, defaultVal?: T[]): Record<string, T[]> => {
    const result = loadPerStoreRecord<T[]>(baseKey, initialStoreId);
    // 如果当前店铺没有数据且提供了默认值，使用默认值
    if (defaultVal && !result[initialStoreId]) {
      result[initialStoreId] = defaultVal;
    }
    return result;
  };

  const getInitialStoreId = (): string => {
    const saved = localStorage.getItem('dianfx_current_store');
    if (saved) {
      try { return JSON.parse(saved).id || ''; } catch { return ''; }
    }
    return '';
  };

  const initialStoreId = getInitialStoreId();

  const [productCostsByStore, setProductCostsByStore] = useState<Record<string, Record<string, number>>>(() =>
    loadPerStoreRecord('dianfx_product_costs', initialStoreId)
  );
  const [costConfigsByStore, setCostConfigsByStore] = useState<Record<string, Record<string, CostConfig>>>(() =>
    loadPerStoreRecord('dianfx_cost_configs', initialStoreId)
  );
  const [packagingFeeByStore, setPackagingFeeByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_packaging_fee', initialStoreId)
  );
  const [pricingPresetsByStore, setPricingPresetsByStore] = useState<Record<string, any[]>>(() =>
    loadPerStoreArray('dianfx_pricing_presets', initialStoreId)
  );
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>(() => {
    const saved = localStorage.getItem('dianfx_upload_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [taxConfigsByStore, setTaxConfigsByStore] = useState<Record<string, TaxConfig[]>>(() =>
    loadPerStoreArray('dianfx_tax_configs', initialStoreId, [
      { id: 'vat-default', name: '增值税', taxType: 'vat', rate: 1, base: 'revenue', enabled: true, description: '小规模纳税人1%' },
      { id: 'surcharge-default', name: '附加税', taxType: 'surcharge', rate: 6, base: 'vat', enabled: true, description: '城建税+教育费附加' },
    ])
  );
  const [customDeductionsByStore, setCustomDeductionsByStore] = useState<Record<string, CustomDeduction[]>>(() =>
    loadPerStoreArray('dianfx_custom_deductions', initialStoreId)
  );
  const [defaultCostRatioByStore, setDefaultCostRatioByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_default_cost_ratio', initialStoreId)
  );
  const [shippingFeeByStore, setShippingFeeByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_shipping_fee', initialStoreId)
  );
  const [platformCommissionByStore, setPlatformCommissionByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_platform_commission', initialStoreId)
  );
  const [laborFeeByStore, setLaborFeeByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_labor_fee', initialStoreId)
  );
  const [insuranceFeeByStore, setInsuranceFeeByStore] = useState<Record<string, number>>(() =>
    loadPerStoreNumber('dianfx_insurance_fee', initialStoreId)
  );
  const [abnormalOrdersByStore, setAbnormalOrdersByStore] = useState<Record<string, Record<string, AbnormalOrderRecord>>>(() => {
    const result = loadPerStoreRecord<Record<string, any>>('dianfx_abnormal_orders', initialStoreId);
    // 迁移旧格式: alertType → alertTypes
    for (const storeId of Object.keys(result)) {
      for (const key of Object.keys(result[storeId] || {})) {
        const entry = result[storeId][key];
        if (entry && typeof entry.alertType === 'string') {
          entry.alertTypes = [entry.alertType];
          delete entry.alertType;
        }
        if (entry && !entry.alertTypes) {
          entry.alertTypes = [];
        }
      }
    }
    return result;
  });
  const [costHistoryByStore, setCostHistoryByStore] = useState<Record<string, CostHistoryEntry[]>>(() =>
    loadPerStoreArray('dianfx_cost_history', initialStoreId)
  );

  // ---- 计算当前店铺的值（根据 dataFilter 自动选择） ----

  // 当前店铺 ID（__all__ 模式返回空字符串）
  const currentStoreId = useMemo(() => isAllStores(dataFilter) ? '' : dataFilter, [dataFilter]);

  const productCosts = useMemo((): Record<string, number> => {
    if (isAllStores(dataFilter)) return mergeRecordConfigs(productCostsByStore);
    return productCostsByStore[dataFilter] || {};
  }, [dataFilter, productCostsByStore]);

  const costConfigs = useMemo((): Record<string, CostConfig> => {
    if (isAllStores(dataFilter)) return mergeRecordConfigs(costConfigsByStore);
    return costConfigsByStore[dataFilter] || {};
  }, [dataFilter, costConfigsByStore]);

  const packagingFeePerOrder = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(packagingFeeByStore, storeDataMap);
    return packagingFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, packagingFeeByStore, storeDataMap]);

  const pricingPresets = useMemo((): any[] => {
    if (isAllStores(dataFilter)) {
      const all: any[] = [];
      for (const storeId of Object.keys(pricingPresetsByStore)) {
        all.push(...(pricingPresetsByStore[storeId] || []));
      }
      return all;
    }
    return pricingPresetsByStore[dataFilter] || [];
  }, [dataFilter, pricingPresetsByStore]);

  const taxConfigs = useMemo((): TaxConfig[] => {
    if (isAllStores(dataFilter)) return mergeArrayConfigs(taxConfigsByStore);
    return taxConfigsByStore[dataFilter] || [];
  }, [dataFilter, taxConfigsByStore]);

  const customDeductions = useMemo((): CustomDeduction[] => {
    if (isAllStores(dataFilter)) return mergeArrayConfigs(customDeductionsByStore);
    return customDeductionsByStore[dataFilter] || [];
  }, [dataFilter, customDeductionsByStore]);

  const defaultCostRatio = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(defaultCostRatioByStore, storeDataMap);
    return defaultCostRatioByStore[dataFilter] ?? 0;
  }, [dataFilter, defaultCostRatioByStore, storeDataMap]);

  const shippingFeePerOrder = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(shippingFeeByStore, storeDataMap);
    return shippingFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, shippingFeeByStore, storeDataMap]);

  const platformCommissionRate = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(platformCommissionByStore, storeDataMap);
    return platformCommissionByStore[dataFilter] ?? 0;
  }, [dataFilter, platformCommissionByStore, storeDataMap]);

  const laborFeePerOrder = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(laborFeeByStore, storeDataMap);
    return laborFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, laborFeeByStore, storeDataMap]);

  const insuranceFeePerOrder = useMemo((): number => {
    if (isAllStores(dataFilter)) return weightedAverageFee(insuranceFeeByStore, storeDataMap);
    return insuranceFeeByStore[dataFilter] ?? 0;
  }, [dataFilter, insuranceFeeByStore, storeDataMap]);

  const abnormalOrders = useMemo((): Record<string, AbnormalOrderRecord> => {
    if (isAllStores(dataFilter)) return mergeAbnormalOrders(abnormalOrdersByStore) as Record<string, AbnormalOrderRecord>;
    return abnormalOrdersByStore[dataFilter] || {};
  }, [dataFilter, abnormalOrdersByStore]);

  const costHistory = useMemo((): CostHistoryEntry[] => {
    if (isAllStores(dataFilter)) {
      const all: CostHistoryEntry[] = [];
      for (const storeId of Object.keys(costHistoryByStore)) {
        all.push(...(costHistoryByStore[storeId] || []));
      }
      return all.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    }
    return costHistoryByStore[dataFilter] || [];
  }, [dataFilter, costHistoryByStore]);

  // 上传记录按店铺过滤
  const filteredUploadRecords = useMemo((): UploadRecord[] => {
    if (isAllStores(dataFilter)) return uploadRecords;
    return uploadRecords.filter(r => r.storeId === dataFilter);
  }, [dataFilter, uploadRecords]);

  // 注意：移除了自动清理无效店铺的 useEffect，因为它使用空依赖会捕获旧的闭包值，
  // 导致错误地判断数据有效性并清空有效数据。数据一致性由 StoresPage 在 UI 层处理。

  useEffect(() => {
    localStorage.setItem('dianfx_data_filter', dataFilter);
  }, [dataFilter]);

  useEffect(() => {
    console.log('[SAVE] storeDataMap changed, keys:', Object.keys(storeDataMap));
    const dataToSave: Record<string, any> = {};
    for (const [storeId, storeData] of Object.entries(storeDataMap)) {
      dataToSave[storeId] = {
        orders: storeData.orders,
        promotionSummary: storeData.promotionSummary,
        promotionProducts: storeData.promotionProducts,
        starStoreSummary: storeData.starStoreSummary,
        liveStreamSummary: storeData.liveStreamSummary,
        shippingInsurance: storeData.shippingInsurance,
        afterSaleRecords: storeData.afterSaleRecords,
        financialRecords: storeData.financialRecords || [],
        availableFields: {
          csv: Array.from(storeData.availableFields.csv || []),
          promotion: Array.from(storeData.availableFields.promotion || []),
          insurance: Array.from(storeData.availableFields.insurance || []),
          afterSale: Array.from(storeData.availableFields.afterSale || [])
        }
      };
    }
    try {
      const jsonStr = JSON.stringify(dataToSave);
      console.log('[SAVE] Writing to localStorage, size:', jsonStr.length, 'stores:', Object.keys(dataToSave).length);
      localStorage.setItem('dianfx_store_data_map', jsonStr);
      // 整体存储成功，清理旧的分片存储残留
      localStorage.removeItem('dianfx_store_data_map_keys');
      console.log('[SAVE] Success');
    } catch (e) {
      console.warn('[SAVE] Overall save failed, trying chunked:', e);
      // 删除旧的整体存储，防止加载时优先命中旧数据而跳过分片
      localStorage.removeItem('dianfx_store_data_map');
      // localStorage 容量不足时，尝试逐店铺存储
      try {
        for (const [storeId, storeData] of Object.entries(dataToSave)) {
          localStorage.setItem(`dianfx_store_${storeId}`, JSON.stringify(storeData));
        }
        localStorage.setItem('dianfx_store_data_map_keys', JSON.stringify(Object.keys(dataToSave)));
        console.log('[SAVE] Chunked save success');
      } catch (e2) {
        console.error('[SAVE] Chunked save also failed:', e2);
      }
    }
  }, [storeDataMap]);

  // 清理已被删除的店铺的残留数据（deleteStore 只清 localStorage，这里同步清内存）
  useEffect(() => {
    const storesJson = localStorage.getItem('dianfx_stores');
    if (!storesJson) return;
    try {
      const storesList: { id: string }[] = JSON.parse(storesJson);
      const validIds = new Set(storesList.map(s => s.id));
      setStoreDataMap(prev => {
        const zombieIds = Object.keys(prev).filter(id => !validIds.has(id));
        if (zombieIds.length === 0) return prev;
        const next = { ...prev };
        zombieIds.forEach(id => delete next[id]);
        return next;
      });
    } catch {}
  }, []); // 仅在 mount 时执行一次

  // 持久化：按店铺分片存储
  useEffect(() => {
    for (const [storeId, data] of Object.entries(productCostsByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_product_costs', storeId), JSON.stringify(data));
    }
  }, [productCostsByStore]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(costConfigsByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_cost_configs', storeId), JSON.stringify(data));
    }
  }, [costConfigsByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(packagingFeeByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_packaging_fee', storeId), String(val));
    }
  }, [packagingFeeByStore]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(pricingPresetsByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_pricing_presets', storeId), JSON.stringify(data));
    }
  }, [pricingPresetsByStore]);
  useEffect(() => { localStorage.setItem('dianfx_upload_records', JSON.stringify(uploadRecords)); }, [uploadRecords]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(taxConfigsByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_tax_configs', storeId), JSON.stringify(data));
    }
  }, [taxConfigsByStore]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(customDeductionsByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_custom_deductions', storeId), JSON.stringify(data));
    }
  }, [customDeductionsByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(defaultCostRatioByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_default_cost_ratio', storeId), String(val));
    }
  }, [defaultCostRatioByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(shippingFeeByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_shipping_fee', storeId), String(val));
    }
  }, [shippingFeeByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(platformCommissionByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_platform_commission', storeId), String(val));
    }
  }, [platformCommissionByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(laborFeeByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_labor_fee', storeId), String(val));
    }
  }, [laborFeeByStore]);
  useEffect(() => {
    for (const [storeId, val] of Object.entries(insuranceFeeByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_insurance_fee', storeId), String(val));
    }
  }, [insuranceFeeByStore]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(abnormalOrdersByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_abnormal_orders', storeId), JSON.stringify(data));
    }
  }, [abnormalOrdersByStore]);
  useEffect(() => {
    for (const [storeId, data] of Object.entries(costHistoryByStore)) {
      localStorage.setItem(getStoreScopedKey('dianfx_cost_history', storeId), JSON.stringify(data));
    }
  }, [costHistoryByStore]);

  const getStoreData = useCallback((storeId: string): StoreDataItem | null => {
    return storeDataMap[storeId] || null;
  }, [storeDataMap]);

  const setStoreData = useCallback((storeId: string, dataOrUpdater: StoreDataItem | ((prev: StoreDataItem | null) => StoreDataItem)) => {
    setStoreDataMap(prev => {
      const prevStoreData = prev[storeId] || null;
      const newData = typeof dataOrUpdater === 'function'
        ? (dataOrUpdater as (prev: StoreDataItem | null) => StoreDataItem)(prevStoreData)
        : dataOrUpdater;
      return { ...prev, [storeId]: newData };
    });
  }, []);

  const currentDisplayData = useMemo((): StoreDataItem => {
    if (!dataFilter) return EMPTY_STORE_DATA;
    // "全部店铺"模式：聚合所有店铺数据
    if (isAllStores(dataFilter)) {
      return aggregateStoreData(storeDataMap);
    }
    const storeData = storeDataMap[dataFilter];
    if (!storeData) {
      const validStoreIds = Object.keys(storeDataMap).filter(id => {
        const d = storeDataMap[id];
        return (d.orders?.length > 0) || (d.promotionSummary?.length > 0) ||
               (d.starStoreSummary?.length > 0) || (d.liveStreamSummary?.length > 0) ||
               (d.shippingInsurance?.length > 0) || (d.afterSaleRecords?.length > 0) ||
               (d.financialRecords?.length > 0);
      });
      return EMPTY_STORE_DATA;
    }
    return storeData;
  }, [dataFilter, storeDataMap]);

  const { index: orderFinancialActuals, unlinked: unlinkedFinancials } = useMemo(() => {
    return buildFinancialIndex(currentDisplayData.financialRecords || []);
  }, [currentDisplayData.financialRecords]);

  // 当 dataFilter 指向不存在的店铺时才自动切换（空店铺不跳转）
  useEffect(() => {
    if (!dataFilter || isAllStores(dataFilter)) return;
    const storeData = storeDataMap[dataFilter];
    if (storeData) return;

    // 检查是否是合法的店铺（存在于店铺列表中但还没有数据）
    const storesJson = localStorage.getItem('dianfx_stores');
    if (storesJson) {
      try {
        const storesList: { id: string }[] = JSON.parse(storesJson);
        if (storesList.some(s => s.id === dataFilter)) return; // 合法店铺，不跳转
      } catch {}
    }

    // dataFilter 指向的店铺不存在，切换到第一个有效店铺
    const validStoreIds = Object.keys(storeDataMap).filter(id => {
      const d = storeDataMap[id];
      return (d.orders?.length > 0) || (d.promotionSummary?.length > 0) ||
             (d.starStoreSummary?.length > 0) || (d.liveStreamSummary?.length > 0) ||
             (d.shippingInsurance?.length > 0) || (d.afterSaleRecords?.length > 0) ||
             (d.financialRecords?.length > 0);
    });

    if (validStoreIds.length > 0) {
      setDataFilter(validStoreIds[0]);
    } else if (Object.keys(storeDataMap).length === 0) {
      setDataFilter('');
    }
  }, [dataFilter, storeDataMap, setDataFilter]);

  // 辅助：从 localStorage 获取店铺名称
  const getStoreName = useCallback((storeId: string): string => {
    const saved = localStorage.getItem('dianfx_stores');
    if (!saved) return '';
    try {
      const storesList: { id: string; name: string }[] = JSON.parse(saved);
      return storesList.find(s => s.id === storeId)?.name ?? '';
    } catch { return ''; }
  }, []);

  // ---- Setter 函数（写入当前店铺的数据切片，__all__ 模式下无效） ----

  const setProductCost = useCallback((code: string, cost: number) => {
    if (isAllStores(dataFilter)) return;
    setProductCostsByStore(prev => {
      const current = prev[dataFilter] || {};
      return { ...prev, [dataFilter]: { ...current, [code]: cost } };
    });
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改商品成本: ${code} → ¥${cost}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setCostConfig = useCallback((code: string, config: CostConfig) => {
    if (isAllStores(dataFilter)) return;
    setCostConfigsByStore(prev => {
      const current = prev[dataFilter] || {};
      return { ...prev, [dataFilter]: { ...current, [code]: config } };
    });
    addLog({ action: '修改成本配置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `修改成本配置: ${code}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const addPricingPreset = useCallback((preset: any) => {
    if (isAllStores(dataFilter)) return;
    setPricingPresetsByStore(prev => ({
      ...prev,
      [dataFilter]: [...(prev[dataFilter] || []), preset]
    }));
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
    setStoreDataMap(prev => {
      const newData = { ...prev };
      delete newData[storeId];
      return newData;
    });
  }, []);

  // Tax config callbacks
  const addTaxConfig = useCallback((config: TaxConfig) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => ({
      ...prev,
      [dataFilter]: [...(prev[dataFilter] || []), config]
    }));
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加税费: ${config.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeTaxConfig = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => ({
      ...prev,
      [dataFilter]: (prev[dataFilter] || []).filter((t: TaxConfig) => t.id !== id)
    }));
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateTaxConfig = useCallback((id: string, updates: Partial<TaxConfig>) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => ({
      ...prev,
      [dataFilter]: (prev[dataFilter] || []).map((t: TaxConfig) => t.id === id ? { ...t, ...updates } : t)
    }));
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `更新税费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // Custom deduction callbacks
  const addCustomDeduction = useCallback((deduction: CustomDeduction) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => ({
      ...prev,
      [dataFilter]: [...(prev[dataFilter] || []), deduction]
    }));
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `添加自定义扣费: ${deduction.name}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeCustomDeduction = useCallback((id: string) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => ({
      ...prev,
      [dataFilter]: (prev[dataFilter] || []).filter((d: CustomDeduction) => d.id !== id)
    }));
    addLog({ action: '修改税费/扣费', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `删除自定义扣费: ${id}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const updateCustomDeduction = useCallback((id: string, updates: Partial<CustomDeduction>) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => ({
      ...prev,
      [dataFilter]: (prev[dataFilter] || []).map((d: CustomDeduction) => d.id === id ? { ...d, ...updates } : d)
    }));
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
    setCostHistoryByStore(prev => ({
      ...prev,
      [dataFilter]: [newEntry, ...(prev[dataFilter] || [])].slice(0, 500)
    }));
  }, [dataFilter]);

  const setAbnormalOrder = useCallback((orderNo: string, record: AbnormalOrderRecord) => {
    if (isAllStores(dataFilter)) return;
    setAbnormalOrdersByStore(prev => {
      const current = prev[dataFilter] || {};
      return { ...prev, [dataFilter]: { ...current, [orderNo]: record } };
    });
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);
  const removeAbnormalOrder = useCallback((orderNo: string) => {
    if (isAllStores(dataFilter)) return;
    setAbnormalOrdersByStore(prev => {
      const current = { ...(prev[dataFilter] || {}) };
      delete current[orderNo];
      return { ...prev, [dataFilter]: current };
    });
    addLog({ action: '修改异常订单', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `移除异常订单: ${orderNo}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // ---- 数值型配置的 Setter ----

  const setPackagingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setPackagingFeeByStore(prev => ({ ...prev, [dataFilter]: fee }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置包装费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setDefaultCostRatio = useCallback((ratio: number) => {
    if (isAllStores(dataFilter)) return;
    setDefaultCostRatioByStore(prev => ({ ...prev, [dataFilter]: ratio }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置默认成本比例: ${ratio}`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setShippingFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setShippingFeeByStore(prev => ({ ...prev, [dataFilter]: fee }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setPlatformCommissionRate = useCallback((rate: number) => {
    if (isAllStores(dataFilter)) return;
    setPlatformCommissionByStore(prev => ({ ...prev, [dataFilter]: rate }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置平台佣金率: ${rate}%`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setLaborFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setLaborFeeByStore(prev => ({ ...prev, [dataFilter]: fee }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置人工费: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  const setInsuranceFeePerOrder = useCallback((fee: number) => {
    if (isAllStores(dataFilter)) return;
    setInsuranceFeeByStore(prev => ({ ...prev, [dataFilter]: fee }));
    addLog({ action: '修改费用设置', storeId: dataFilter, storeName: getStoreName(dataFilter), details: `设置运费险: ¥${fee}/单`, result: 'success' });
  }, [dataFilter, getStoreName]);

  // 辅助：清除所有店铺的某类 localStorage 键值
  const clearPerStoreKeys = (baseKey: string) => {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${baseKey}_`)) keysToRemove.push(key);
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    // 同时清除旧格式
    localStorage.removeItem(baseKey);
  };

  // 清空所有数据（localStorage + 内存 state）
  const clearAllData = useCallback(() => {
    console.log('[CLEAR] Clearing all data');
    addLog({ action: '清空全部数据', storeId: '全部', storeName: '全部店铺', details: '清空所有本地数据和缓存', result: 'success' });
    const dianfxKeys = Object.keys(localStorage).filter(k => k.startsWith('dianfx_'));
    dianfxKeys.forEach(k => localStorage.removeItem(k));
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
    setAbnormalOrdersByStore({});
    setCostHistoryByStore({});
  }, []);

  const clearOrderData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing order data', storeId ?? 'ALL');
    if (storeId) {
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], orders: [], availableFields: { ...prev[storeId].availableFields, csv: new Set() } } };
      });
      addLog({ action: '清除订单数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的订单数据`, result: 'success' });
    } else {
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, orders: [], availableFields: { ...d.availableFields, csv: new Set() } };
        }
        return next;
      });
      addLog({ action: '清除订单数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的订单数据', result: 'success' });
    }
  }, [getStoreName]);

  const clearPromotionData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing promotion data', storeId ?? 'ALL');
    if (storeId) {
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], availableFields: { ...prev[storeId].availableFields, promotion: new Set() } } };
      });
      addLog({ action: '清除推广数据', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的推广数据`, result: 'success' });
    } else {
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, promotionSummary: [], promotionProducts: [], starStoreSummary: [], liveStreamSummary: [], availableFields: { ...d.availableFields, promotion: new Set() } };
        }
        return next;
      });
      addLog({ action: '清除推广数据', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的推广数据', result: 'success' });
    }
  }, [getStoreName]);

  const clearFinancialData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing financial data', storeId ?? 'ALL');
    if (storeId) {
      setStoreDataMap(prev => {
        if (!prev[storeId]) return prev;
        return { ...prev, [storeId]: { ...prev[storeId], financialRecords: [] } };
      });
      addLog({ action: '清除财务报表', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的财务报表数据`, result: 'success' });
    } else {
      setStoreDataMap(prev => {
        const next: Record<string, StoreDataItem> = {};
        for (const [id, d] of Object.entries(prev)) {
          next[id] = { ...d, financialRecords: [] };
        }
        return next;
      });
      addLog({ action: '清除财务报表', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的财务报表数据', result: 'success' });
    }
  }, [getStoreName]);

  const clearCostData = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing cost data', storeId ?? 'ALL');
    const baseKeys = ['dianfx_product_costs', 'dianfx_cost_configs', 'dianfx_packaging_fee', 'dianfx_shipping_fee', 'dianfx_platform_commission', 'dianfx_labor_fee', 'dianfx_insurance_fee', 'dianfx_abnormal_orders', 'dianfx_default_cost_ratio', 'dianfx_cost_history', 'dianfx_custom_deductions'];
    if (storeId) {
      baseKeys.forEach(baseKey => localStorage.removeItem(`${baseKey}_${storeId}`));
      setProductCostsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCostConfigsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setPackagingFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setDefaultCostRatioByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setShippingFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setPlatformCommissionByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setLaborFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setInsuranceFeeByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setAbnormalOrdersByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCustomDeductionsByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      setCostHistoryByStore(prev => { const next = { ...prev }; delete next[storeId]; return next; });
      addLog({ action: '清除成本配置', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的成本配置`, result: 'success' });
    } else {
      setProductCostsByStore({});
      setCostConfigsByStore({});
      setPackagingFeeByStore({});
      setDefaultCostRatioByStore({});
      setShippingFeeByStore({});
      setPlatformCommissionByStore({});
      setLaborFeeByStore({});
      setInsuranceFeeByStore({});
      setAbnormalOrdersByStore({});
      setCustomDeductionsByStore({});
      setCostHistoryByStore({});
      baseKeys.forEach(baseKey => {
        clearPerStoreKeys(baseKey);
      });
      addLog({ action: '清除成本配置', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的成本配置', result: 'success' });
    }
  }, [getStoreName]);

  const clearUploadRecordsFn = useCallback((storeId?: string) => {
    console.log('[CLEAR] Clearing upload records', storeId ?? 'ALL');
    if (storeId) {
      setUploadRecords(prev => prev.filter(r => r.storeId !== storeId));
      addLog({ action: '清除上传记录', storeId, storeName: getStoreName(storeId), details: `清除店铺"${getStoreName(storeId)}"的上传记录`, result: 'success' });
    } else {
      setUploadRecords([]);
      localStorage.removeItem('dianfx_upload_records');
      addLog({ action: '清除上传记录', storeId: '全部', storeName: '全部店铺', details: '清除所有店铺的上传记录', result: 'success' });
    }
  }, [getStoreName]);

  const clearStoreList = useCallback(() => {
    console.log('[CLEAR] Clearing store list');
    addLog({ action: '清除店铺列表', storeId: '全部', storeName: '全部店铺', details: '清除店铺列表', result: 'success' });
    localStorage.removeItem('dianfx_stores');
    localStorage.removeItem('dianfx_current_store');
    setDataFilter('');
  }, []);

  // taxConfigs 和 customDeductions 的 setter 包装（直接替换整个数组）
  const setTaxConfigs = useCallback((configs: TaxConfig[]) => {
    if (isAllStores(dataFilter)) return;
    setTaxConfigsByStore(prev => ({ ...prev, [dataFilter]: configs }));
  }, [dataFilter]);
  const setCustomDeductions = useCallback((deductions: CustomDeduction[]) => {
    if (isAllStores(dataFilter)) return;
    setCustomDeductionsByStore(prev => ({ ...prev, [dataFilter]: deductions }));
  }, [dataFilter]);

  return (
    <DataContext.Provider value={{
      dataFilter, setDataFilter,
      getStoreData, setStoreData, currentDisplayData,
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
      orderFinancialActuals, unlinkedFinancials,
      abnormalOrders, setAbnormalOrder, removeAbnormalOrder,
      costHistory, addCostHistory,
      clearAllData,
      clearOrderData, clearPromotionData, clearFinancialData, clearCostData,
      clearUploadRecords: clearUploadRecordsFn, clearStoreList
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

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin' && user.role !== 'test') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <StoreProvider>
        <DataProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/stores" element={<RequireAuth><StoresPage /></RequireAuth>} />
              <Route path="/upload" element={<RequireAuth><MainLayout><UploadPage /></MainLayout></RequireAuth>} />
              <Route path="/dashboard" element={<RequireAuth><MainLayout><DashboardPage /></MainLayout></RequireAuth>} />
              <Route path="/product" element={<RequireAuth><MainLayout><ProductPage /></MainLayout></RequireAuth>} />
              <Route path="/user" element={<RequireAuth><MainLayout><UserPage /></MainLayout></RequireAuth>} />
              <Route path="/trend" element={<RequireAuth><MainLayout><TrendPage /></MainLayout></RequireAuth>} />
              <Route path="/region" element={<RequireAuth><MainLayout><RegionPage /></MainLayout></RequireAuth>} />
              <Route path="/logistics" element={<RequireAuth><MainLayout><LogisticsPage /></MainLayout></RequireAuth>} />
              <Route path="/cost" element={<RequireAuth><MainLayout><CostPage /></MainLayout></RequireAuth>} />
              <Route path="/after-sale" element={<RequireAuth><MainLayout><AfterSalePage /></MainLayout></RequireAuth>} />
              <Route path="/shipping-insurance" element={<RequireAuth><MainLayout><InsurancePage /></MainLayout></RequireAuth>} />
              <Route path="/promotion" element={<RequireAuth><MainLayout><PromotionPage /></MainLayout></RequireAuth>} />
              <Route path="/risk" element={<RequireAuth><MainLayout><RiskPage /></MainLayout></RequireAuth>} />
              <Route path="/membership" element={<RequireAuth><MainLayout><MembershipPage /></MainLayout></RequireAuth>} />
              <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
              <Route path="/cost-management" element={<RequireAuth><MainLayout><CostManagementPage /></MainLayout></RequireAuth>} />
              <Route path="/finance" element={<RequireAuth><MainLayout><FinancePage /></MainLayout></RequireAuth>} />
              <Route path="/product-links" element={<RequireAuth><MainLayout><ProductLinksPage /></MainLayout></RequireAuth>} />
              <Route path="/admin" element={<RequireAdmin><MainLayout><AdminDashboard /></MainLayout></RequireAdmin>} />
              <Route path="/admin/users" element={<RequireAdmin><MainLayout><AdminUsers /></MainLayout></RequireAdmin>} />
              <Route path="/admin/members" element={<RequireAdmin><MainLayout><AdminMembers /></MainLayout></RequireAdmin>} />
              <Route path="/admin/invite" element={<RequireAdmin><MainLayout><AdminInvite /></MainLayout></RequireAdmin>} />
              <Route path="/admin/data" element={<RequireAdmin><MainLayout><AdminData /></MainLayout></RequireAdmin>} />
              <Route path="/admin/logs" element={<RequireAdmin><MainLayout><AdminLogs /></MainLayout></RequireAdmin>} />
              <Route path="/admin/settings" element={<RequireAdmin><MainLayout><AdminSettings /></MainLayout></RequireAdmin>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
        </DataProvider>
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;
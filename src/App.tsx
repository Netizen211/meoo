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
import { simpleHash } from './utils';
import type { TaxConfig, CustomDeduction } from './components/ProductLinkStats';
import { importSampleData, hasSampleData } from './utils/dataImporter';

interface User {
  id: string;
  username: string;
  role: 'normal' | 'test';
  membershipLevel: 'free' | 'pro' | 'enterprise';
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => boolean;
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
      user, login, signup, logout, upgradeMembership,
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
  addStore: (name: string) => void;
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

  const addStore = useCallback((name: string) => {
    const s: Store = { id: `store-${Date.now()}`, name, createdAt: new Date().toISOString() };
    setStores(prev => [...prev, s]);
    setCurrentStore(s);
  }, []);

  const switchStore = useCallback((id: string) => {
    setStores(currentStores => {
      const found = currentStores.find(s => s.id === id);
      if (found) setCurrentStore(found);
      return currentStores;
    });
  }, []);

  const deleteStore = useCallback((id: string) => {
    setStores(prev => {
      const remaining = prev.filter(s => s.id !== id);
      if (currentStore?.id === id) {
        setCurrentStore(remaining[0] || null);
      }
      return remaining;
    });
    localStorage.removeItem(`dianfx_store_data_${id}`);
    localStorage.removeItem(`dianfx_product_costs_${id}`);
    localStorage.removeItem(`dianfx_cost_configs_${id}`);
  }, [currentStore]);

  const clearCurrentStore = useCallback(() => {
    setCurrentStore(null);
    localStorage.removeItem('dianfx_current_store');
  }, []);

  return (
    <StoreContext.Provider value={{ stores, currentStore, addStore, switchStore, deleteStore, clearCurrentStore }}>
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
  productCosts: Record<string, number>;
  setProductCost: (code: string, cost: number) => void;
  costConfigs: Record<string, CostConfig>;
  setCostConfig: (code: string, config: CostConfig) => void;
  packagingFeePerOrder: number;
  setPackagingFeePerOrder: (fee: number) => void;
  pricingPresets: any[];
  addPricingPreset: (preset: any) => void;
  uploadRecords: UploadRecord[];
  addUploadRecord: (record: Omit<UploadRecord, 'id' | 'uploadedAt'>) => void;
  deleteUploadRecord: (id: string) => void;
  clearStoreUploads: (storeId: string) => void;
  clearStoreData: (storeId: string) => void;
  // Tax & custom deductions
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
  abnormalOrders: Record<string, AbnormalOrderRecord>;
  setAbnormalOrder: (orderNo: string, record: AbnormalOrderRecord) => void;
  removeAbnormalOrder: (orderNo: string) => void;
  costHistory: CostHistoryEntry[];
  addCostHistory: (entry: Omit<CostHistoryEntry, 'id' | 'updatedAt'>) => void;
  clearAllData: () => void;
  // 分类清除方法
  clearOrderData: () => void;
  clearPromotionData: () => void;
  clearCostData: () => void;
  clearUploadRecords: () => void;
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
  availableFields: { csv: new Set(), promotion: new Set(), insurance: new Set(), afterSale: new Set() }
};

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [dataFilter, setDataFilter] = useState<string>(() => {
    const saved = localStorage.getItem('dianfx_data_filter');
    if (saved === 'all') {
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
  const [productCosts, setProductCosts] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('dianfx_product_costs');
    return saved ? JSON.parse(saved) : {};
  });
  const [costConfigs, setCostConfigs] = useState<Record<string, CostConfig>>(() => {
    const saved = localStorage.getItem('dianfx_cost_configs');
    return saved ? JSON.parse(saved) : {};
  });
  const [packagingFeePerOrder, setPackagingFeePerOrder] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_packaging_fee');
    return saved ? parseFloat(saved) : 0;
  });
  const [pricingPresets, setPricingPresets] = useState<any[]>(() => {
    const saved = localStorage.getItem('dianfx_pricing_presets');
    return saved ? JSON.parse(saved) : [];
  });
  const [uploadRecords, setUploadRecords] = useState<UploadRecord[]>(() => {
    const saved = localStorage.getItem('dianfx_upload_records');
    return saved ? JSON.parse(saved) : [];
  });
  // Tax configs
  const [taxConfigs, setTaxConfigs] = useState<TaxConfig[]>(() => {
    const saved = localStorage.getItem('dianfx_tax_configs');
    return saved ? JSON.parse(saved) : [
      { id: 'vat-default', name: '增值税', taxType: 'vat', rate: 1, base: 'revenue', enabled: true, description: '小规模纳税人1%' },
      { id: 'surcharge-default', name: '附加税', taxType: 'surcharge', rate: 6, base: 'vat', enabled: true, description: '城建税+教育费附加' },
    ];
  });
  // Custom deductions
  const [customDeductions, setCustomDeductions] = useState<CustomDeduction[]>(() => {
    const saved = localStorage.getItem('dianfx_custom_deductions');
    return saved ? JSON.parse(saved) : [];
  });
  // Default cost ratio (fallback when no real cost)
  const [defaultCostRatio, setDefaultCostRatio] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_default_cost_ratio');
    return saved ? parseFloat(saved) : 0;
  });
  // Shipping fee per order
  const [shippingFeePerOrder, setShippingFeePerOrder] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_shipping_fee');
    return saved ? parseFloat(saved) : 0;
  });
  const [platformCommissionRate, setPlatformCommissionRate] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_platform_commission');
    return saved ? parseFloat(saved) : 0;
  });
  const [laborFeePerOrder, setLaborFeePerOrder] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_labor_fee');
    return saved ? parseFloat(saved) : 0;
  });
  const [insuranceFeePerOrder, setInsuranceFeePerOrder] = useState<number>(() => {
    const saved = localStorage.getItem('dianfx_insurance_fee');
    return saved ? parseFloat(saved) : 0;
  });
  const [abnormalOrders, setAbnormalOrders] = useState<Record<string, AbnormalOrderRecord>>(() => {
    const saved = localStorage.getItem('dianfx_abnormal_orders');
    if (!saved) return {};
    const parsed = JSON.parse(saved);
    // 迁移旧格式: alertType:string → alertTypes:string[]
    for (const key of Object.keys(parsed)) {
      if (parsed[key] && typeof parsed[key].alertType === 'string') {
        parsed[key].alertTypes = [parsed[key].alertType];
        delete parsed[key].alertType;
      }
      if (parsed[key] && !parsed[key].alertTypes) {
        parsed[key].alertTypes = [];
      }
    }
    return parsed;
  });
  // Cost history
  const [costHistory, setCostHistory] = useState<CostHistoryEntry[]>(() => {
    const saved = localStorage.getItem('dianfx_cost_history');
    return saved ? JSON.parse(saved) : [];
  });

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
      console.log('[SAVE] Success');
    } catch (e) {
      console.warn('[SAVE] Overall save failed, trying chunked:', e);
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

  useEffect(() => { localStorage.setItem('dianfx_product_costs', JSON.stringify(productCosts)); }, [productCosts]);
  useEffect(() => { localStorage.setItem('dianfx_cost_configs', JSON.stringify(costConfigs)); }, [costConfigs]);
  useEffect(() => { localStorage.setItem('dianfx_packaging_fee', String(packagingFeePerOrder)); }, [packagingFeePerOrder]);
  useEffect(() => { localStorage.setItem('dianfx_pricing_presets', JSON.stringify(pricingPresets)); }, [pricingPresets]);
  useEffect(() => { localStorage.setItem('dianfx_upload_records', JSON.stringify(uploadRecords)); }, [uploadRecords]);
  useEffect(() => { localStorage.setItem('dianfx_tax_configs', JSON.stringify(taxConfigs)); }, [taxConfigs]);
  useEffect(() => { localStorage.setItem('dianfx_custom_deductions', JSON.stringify(customDeductions)); }, [customDeductions]);
  useEffect(() => { localStorage.setItem('dianfx_default_cost_ratio', String(defaultCostRatio)); }, [defaultCostRatio]);
  useEffect(() => { localStorage.setItem('dianfx_shipping_fee', String(shippingFeePerOrder)); }, [shippingFeePerOrder]);
  useEffect(() => { localStorage.setItem('dianfx_platform_commission', String(platformCommissionRate)); }, [platformCommissionRate]);
  useEffect(() => { localStorage.setItem('dianfx_labor_fee', String(laborFeePerOrder)); }, [laborFeePerOrder]);
  useEffect(() => { localStorage.setItem('dianfx_insurance_fee', String(insuranceFeePerOrder)); }, [insuranceFeePerOrder]);
  useEffect(() => { localStorage.setItem('dianfx_abnormal_orders', JSON.stringify(abnormalOrders)); }, [abnormalOrders]);
  useEffect(() => { localStorage.setItem('dianfx_cost_history', JSON.stringify(costHistory)); }, [costHistory]);

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
    const storeData = storeDataMap[dataFilter];
    if (!storeData) {
      // dataFilter 指向的店铺不存在，尝试自动切换到第一个有效店铺
      const validStoreIds = Object.keys(storeDataMap).filter(id => {
        const d = storeDataMap[id];
        return (d.orders?.length > 0) || (d.promotionSummary?.length > 0) ||
               (d.starStoreSummary?.length > 0) || (d.liveStreamSummary?.length > 0) ||
               (d.shippingInsurance?.length > 0) || (d.afterSaleRecords?.length > 0);
      });
      if (validStoreIds.length > 0) {
        console.log('[DATA] dataFilter invalid, auto-switching to:', validStoreIds[0]);
        // 注意：不能在 useMemo 中直接调用 setDataFilter，这里仅返回空数据
        // 实际的切换由下面的 useEffect 处理
      }
      return EMPTY_STORE_DATA;
    }
    return storeData;
  }, [dataFilter, storeDataMap]);

  // 当 dataFilter 指向无效店铺时，自动切换到第一个有效店铺
  useEffect(() => {
    if (!dataFilter) return;
    const storeData = storeDataMap[dataFilter];
    if (storeData) return; // 有效，无需切换

    const validStoreIds = Object.keys(storeDataMap).filter(id => {
      const d = storeDataMap[id];
      return (d.orders?.length > 0) || (d.promotionSummary?.length > 0) ||
             (d.starStoreSummary?.length > 0) || (d.liveStreamSummary?.length > 0) ||
             (d.shippingInsurance?.length > 0) || (d.afterSaleRecords?.length > 0);
    });

    if (validStoreIds.length > 0) {
      console.log('[DATA] Auto-switching dataFilter from', dataFilter, 'to', validStoreIds[0]);
      setDataFilter(validStoreIds[0]);
    } else if (Object.keys(storeDataMap).length === 0) {
      // storeDataMap 完全为空，清空 dataFilter
      console.log('[DATA] storeDataMap is empty, clearing dataFilter');
      setDataFilter('');
    }
  }, [dataFilter, storeDataMap, setDataFilter]);

  const setProductCost = useCallback((code: string, cost: number) => {
    setProductCosts(prev => ({ ...prev, [code]: cost }));
  }, []);
  const setCostConfig = useCallback((code: string, config: CostConfig) => {
    setCostConfigs(prev => ({ ...prev, [code]: config }));
  }, []);
  const addPricingPreset = useCallback((preset: any) => {
    setPricingPresets(prev => [...prev, preset]);
  }, []);
  const addUploadRecord = useCallback((record: Omit<UploadRecord, 'id' | 'uploadedAt'>) => {
    const newRecord: UploadRecord = {
      ...record,
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      uploadedAt: new Date().toISOString(),
    };
    setUploadRecords(prev => [...prev, newRecord]);
  }, []);
  const deleteUploadRecord = useCallback((id: string) => {
    setUploadRecords(prev => {
      const record = prev.find(r => r.id === id);
      if (!record) return prev;
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
    setTaxConfigs(prev => [...prev, config]);
  }, []);
  const removeTaxConfig = useCallback((id: string) => {
    setTaxConfigs(prev => prev.filter(t => t.id !== id));
  }, []);
  const updateTaxConfig = useCallback((id: string, updates: Partial<TaxConfig>) => {
    setTaxConfigs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  // Custom deduction callbacks
  const addCustomDeduction = useCallback((deduction: CustomDeduction) => {
    setCustomDeductions(prev => [...prev, deduction]);
  }, []);
  const removeCustomDeduction = useCallback((id: string) => {
    setCustomDeductions(prev => prev.filter(d => d.id !== id));
  }, []);
  const updateCustomDeduction = useCallback((id: string, updates: Partial<CustomDeduction>) => {
    setCustomDeductions(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
  }, []);

  // Cost history callback
  const addCostHistory = useCallback((entry: Omit<CostHistoryEntry, 'id' | 'updatedAt'>) => {
    const newEntry: CostHistoryEntry = {
      ...entry,
      id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      updatedAt: new Date().toISOString(),
    };
    setCostHistory(prev => [newEntry, ...prev].slice(0, 500)); // Keep last 500 entries
  }, []);

  const setAbnormalOrder = useCallback((orderNo: string, record: AbnormalOrderRecord) => {
    setAbnormalOrders(prev => ({ ...prev, [orderNo]: record }));
  }, []);
  const removeAbnormalOrder = useCallback((orderNo: string) => {
    setAbnormalOrders(prev => {
      const next = { ...prev };
      delete next[orderNo];
      return next;
    });
  }, []);

  // 清空所有数据（localStorage + 内存 state）
  const clearAllData = useCallback(() => {
    console.log('[CLEAR] Clearing all data');
    const dianfxKeys = Object.keys(localStorage).filter(k => k.startsWith('dianfx_'));
    dianfxKeys.forEach(k => localStorage.removeItem(k));
    setStoreDataMap({});
    setDataFilter('');
    setUploadRecords([]);
    setProductCosts({});
    setCostConfigs({});
    setPackagingFeePerOrder(0);
    setPricingPresets([]);
    setTaxConfigs([
      { id: 'vat-default', name: '增值税', taxType: 'vat', rate: 1, base: 'revenue', enabled: true, description: '小规模纳税人1%' },
      { id: 'surcharge-default', name: '附加税', taxType: 'surcharge', rate: 6, base: 'vat', enabled: true, description: '城建税+教育费附加' },
    ]);
    setCustomDeductions([]);
    setDefaultCostRatio(0);
    setShippingFeePerOrder(0);
    setPlatformCommissionRate(0);
    setLaborFeePerOrder(0);
    setInsuranceFeePerOrder(0);
    setAbnormalOrders({});
    setCostHistory([]);
  }, []);

  // 分类清除：仅清除订单数据
  const clearOrderData = useCallback(() => {
    console.log('[CLEAR] Clearing order data');
    setStoreDataMap(prev => {
      const next: Record<string, StoreDataItem> = {};
      for (const [id, d] of Object.entries(prev)) {
        next[id] = { ...d, orders: [], availableFields: { ...d.availableFields, csv: new Set() } };
      }
      return next;
    });
  }, []);

  // 分类清除：仅清除推广数据
  const clearPromotionData = useCallback(() => {
    console.log('[CLEAR] Clearing promotion data');
    setStoreDataMap(prev => {
      const next: Record<string, StoreDataItem> = {};
      for (const [id, d] of Object.entries(prev)) {
        next[id] = {
          ...d,
          promotionSummary: [],
          promotionProducts: [],
          starStoreSummary: [],
          liveStreamSummary: [],
          availableFields: { ...d.availableFields, promotion: new Set() }
        };
      }
      return next;
    });
  }, []);

  // 分类清除：仅清除成本相关数据
  const clearCostData = useCallback(() => {
    console.log('[CLEAR] Clearing cost data');
    setProductCosts({});
    setCostConfigs({});
    setPackagingFeePerOrder(0);
    setShippingFeePerOrder(0);
    setPlatformCommissionRate(0);
    setLaborFeePerOrder(0);
    setInsuranceFeePerOrder(0);
    setDefaultCostRatio(0);
    setCostHistory([]);
    setCustomDeductions([]);
    setAbnormalOrders({});
    localStorage.removeItem('dianfx_product_costs');
    localStorage.removeItem('dianfx_cost_configs');
    localStorage.removeItem('dianfx_packaging_fee');
    localStorage.removeItem('dianfx_shipping_fee');
    localStorage.removeItem('dianfx_platform_commission');
    localStorage.removeItem('dianfx_labor_fee');
    localStorage.removeItem('dianfx_insurance_fee');
    localStorage.removeItem('dianfx_abnormal_orders');
    localStorage.removeItem('dianfx_default_cost_ratio');
    localStorage.removeItem('dianfx_cost_history');
    localStorage.removeItem('dianfx_custom_deductions');
  }, []);

  // 分类清除：仅清除上传记录
  const clearUploadRecordsFn = useCallback(() => {
    console.log('[CLEAR] Clearing upload records');
    setUploadRecords([]);
    localStorage.removeItem('dianfx_upload_records');
  }, []);

  // 分类清除：仅清除店铺列表（保留数据）
  const clearStoreList = useCallback(() => {
    console.log('[CLEAR] Clearing store list');
    localStorage.removeItem('dianfx_stores');
    localStorage.removeItem('dianfx_current_store');
    setDataFilter('');
  }, []);

  return (
    <DataContext.Provider value={{
      dataFilter, setDataFilter,
      getStoreData, setStoreData, currentDisplayData,
      productCosts, setProductCost,
      costConfigs, setCostConfig,
      packagingFeePerOrder, setPackagingFeePerOrder,
      pricingPresets, addPricingPreset,
      uploadRecords, addUploadRecord, deleteUploadRecord, clearStoreUploads, clearStoreData,
      taxConfigs, setTaxConfigs, addTaxConfig, removeTaxConfig, updateTaxConfig,
      customDeductions, setCustomDeductions, addCustomDeduction, removeCustomDeduction, updateCustomDeduction,
      defaultCostRatio, setDefaultCostRatio,
      shippingFeePerOrder, setShippingFeePerOrder,
      platformCommissionRate, setPlatformCommissionRate,
      laborFeePerOrder, setLaborFeePerOrder,
      insuranceFeePerOrder, setInsuranceFeePerOrder,
      abnormalOrders, setAbnormalOrder, removeAbnormalOrder,
      costHistory, addCostHistory,
      clearAllData,
      clearOrderData, clearPromotionData, clearCostData,
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
              <Route path="/product-links" element={<RequireAuth><MainLayout><ProductLinksPage /></MainLayout></RequireAuth>} />
              <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
          </HashRouter>
        </DataProvider>
      </StoreProvider>
    </AuthProvider>
  );
}

export default App;
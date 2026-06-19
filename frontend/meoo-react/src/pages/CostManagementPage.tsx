import React, { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Edit3, Save, AlertCircle, AlertTriangle, Check, ChevronDown, ChevronUp,
  Eye, EyeOff, X, Settings, DollarSign, Plus, Trash2, Shield, Calculator as CalcIcon,
  Upload, History, ArrowUp, ArrowDown, Download, Search, LayoutDashboard,
  TrendingUp, Percent, BarChart3, Zap, Truck, Wrench, MessageSquare, RotateCcw, Filter,
  Clock, Target
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import * as XLSX from 'xlsx';
import { useData, useStore } from '../App';
import type { CustomDeduction } from '../components/ProductLinkStats';
import { findField } from '../utils';
import { getBestPlatformFee, getBestInsuranceFee, getPenaltyFees, matchLateShipmentPenalties, calcLateShipmentPenalty, isLateShipment } from '../utils/financialActuals';
import { evaluateFormula, validateFormula, getVarOptions, FormulaContext } from '../utils/formulaEngine';
import { TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups, useTimeFilter } from '../components/TimeFilter';
import { UnifiedFilterBar } from '../components/FilterToolbar';
import { analyticsApi } from '../../api/analyticsApi';
import type { CostTrendResponse, CostSummary as ApiCostSummary } from '../../api/analyticsApi';
import SpecGroupCostEditor from '../components/SpecGroupCostEditor';

const TABS = [
  { key: 'overview', label: '成本总览', Icon: LayoutDashboard },
  { key: 'costs', label: '商品成本', Icon: Package },
  { key: 'shipping', label: '快递配置', Icon: Truck },
  { key: 'deductions', label: '自定义扣费', Icon: CalcIcon },
  { key: 'alerts', label: '成本预警', Icon: AlertTriangle },
];

interface SkuItem {
  productId: string;
  productName: string;
  skuId: string;
  skuName: string;
  productCode: string;
  skuCode: string;
  hasProductCode: boolean;
  hasSkuCode: boolean;
  prices: number[];
  orderCount: number;
  itemCount: number;
  shippingOrderCount: number;
  actualShippingCost: number;
  insuredOrderCount: number;
  uniqueOrderNos: Set<string>;
}

interface ProductGroup {
  productId: string;
  productName: string;
  skus: SkuItem[];
  minPrice: number;
  maxPrice: number;
  totalOrders: number;
  totalItems: number;
}

// 处理面板组件：每个预警订单独立管理处理表单状态
function ProcessPanel({ alertData, alertType, onProcess, onCancel, existingData }: {
  alertData: any;
  alertType: string;
  onProcess: (status: 'excluded' | 'adjusted', note: string, adjFields: any) => void;
  onCancel: () => void;
  existingData?: { status: string; note: string; adjustedFields: any } | null;
}) {
  const [procNote, setProcNote] = React.useState(existingData?.note || '');
  const [procStatus, setProcStatus] = React.useState<'excluded' | 'adjusted'>(existingData?.status === 'adjusted' ? 'adjusted' : existingData?.status === 'excluded' ? 'excluded' : 'excluded');
  const [procAdjQty, setProcAdjQty] = React.useState(String(
    existingData?.adjustedFields?.itemCount != null ? existingData.adjustedFields.itemCount :
    alertType === 'multiItem' ? (alertData.qty || 1) : 1
  ));
  const [procAdjMerchant, setProcAdjMerchant] = React.useState(String(
    existingData?.adjustedFields?.merchantAmount != null ? existingData.adjustedFields.merchantAmount :
    alertData.merchant || 0
  ));
  const [procAdjCost, setProcAdjCost] = React.useState(String(
    existingData?.adjustedFields?.rawCost != null ? existingData.adjustedFields.rawCost :
    alertData.cost || 0
  ));

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
      <div className="mt-3 pt-3 border-t border-pdd-border">
        <p className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2"><Edit3 size={12} />处理异常订单</p>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <label className="text-xs text-pdd-text-secondary">处理方式:</label>
            <div className="flex items-center gap-1 bg-pdd-bg rounded-lg p-0.5">
              <button onClick={() => setProcStatus('excluded')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${procStatus === 'excluded' ? 'bg-pdd-danger text-white shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
                排除计算
              </button>
              <button onClick={() => setProcStatus('adjusted')}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${procStatus === 'adjusted' ? 'bg-pdd-primary text-white shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
                调整数值
              </button>
            </div>
          </div>
          {procStatus === 'adjusted' && (
            <div className="bg-pdd-bg rounded-lg p-3 space-y-2">
              <p className="text-[10px] text-pdd-text-secondary">以下字段将替换订单原始数据进行成本核算:</p>
              <div className="grid grid-cols-2 gap-2">
                {(alertType === 'multiItem' || alertType === 'loss') && (
                  <div>
                    <label className="text-[10px] text-pdd-text-secondary">数量(件)</label>
                    <input type="number" className="w-full px-2 py-1 border border-pdd-border rounded text-xs mt-0.5"
                      value={procAdjQty} onChange={e => setProcAdjQty(e.target.value)} />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-pdd-text-secondary">实收金额(元)</label>
                  <input type="number" className="w-full px-2 py-1 border border-pdd-border rounded text-xs mt-0.5" step="0.01"
                    value={procAdjMerchant} onChange={e => setProcAdjMerchant(e.target.value)} />
                </div>
                {(alertType === 'loss' || alertType === 'multiItem') && (
                  <div>
                    <label className="text-[10px] text-pdd-text-secondary">裸货成本(元/件)</label>
                    <input type="number" className="w-full px-2 py-1 border border-pdd-border rounded text-xs mt-0.5" step="0.01"
                      value={procAdjCost} onChange={e => setProcAdjCost(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            <label className="text-xs text-pdd-text-secondary flex items-center gap-1"><MessageSquare size={10} />备注说明</label>
            <textarea className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-xs mt-1 resize-none" rows={2}
              value={procNote} onChange={e => setProcNote(e.target.value)}
              placeholder="记录该订单异常的原因..." />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const adjFields: any = {};
              if (procStatus === 'adjusted') {
                if (alertType === 'multiItem' || alertType === 'loss') adjFields.itemCount = parseInt(procAdjQty) || 1;
                adjFields.merchantAmount = parseFloat(procAdjMerchant) || 0;
                if (alertType === 'loss' || alertType === 'multiItem') adjFields.rawCost = parseFloat(procAdjCost) || 0;
              }
              onProcess(procStatus, procNote, adjFields);
            }}
              className="px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-xs hover:opacity-90 transition-opacity flex items-center gap-1">
              <Save size={12} /> 确认处理
            </button>
            <button onClick={onCancel}
              className="px-3 py-1.5 border border-pdd-border rounded-lg text-xs hover:bg-pdd-bg transition-colors">
              取消
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export default function CostManagementPage() {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const saved = localStorage.getItem('dianfx_cost_active_tab');
      if (saved) return saved;
    } catch {}
    return 'overview';
  });
  useEffect(() => {
    localStorage.setItem('dianfx_cost_active_tab', activeTab);
  }, [activeTab]);
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, useNaturalDate, setUseNaturalDate, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;

  const {
    currentDisplayData,
    productCosts,
    setProductCost,
    costConfigs,
    setCostConfig,
    packagingFeePerOrder,
    setPackagingFeePerOrder,
    customDeductions,
    addCustomDeduction,
    removeCustomDeduction,
    updateCustomDeduction,
    defaultCostRatio,
    setDefaultCostRatio,
    shippingFeePerOrder,
    setShippingFeePerOrder,
    platformCommissionRate,
    setPlatformCommissionRate,
    laborFeePerOrder,
    setLaborFeePerOrder,
    insuranceFeePerOrder,
    setInsuranceFeePerOrder,
    promotionFeePerOrder,
    setPromotionFeePerOrder,
    abnormalOrders,
    setAbnormalOrder,
    removeAbnormalOrder,
    costHistory,
    addCostHistory,
    orderFinancialActuals,
    unlinkedFinancials
  } = useData();

  const allOrders = currentDisplayData?.orders || [];
  const afterSaleRecords = currentDisplayData?.afterSaleRecords || [];
  const promotionProducts = currentDisplayData?.promotionProducts || [];
  const financialRecords = currentDisplayData?.financialRecords || [];
  const allDates = useMemo(() => getAllDateGroups(allOrders), [allOrders]);
  const filteredOrders = useMemo(() => {
    const timeFiltered = filterByTimeRange(allOrders, allDates, timeRange, customStart, customEnd, quickRange, useNaturalDate);
    return timeFiltered.filter((o: any) => {
      // 排除已取消/待付款等无效订单
      const orderStatus = String(findField(o, '订单状态') || '').trim();
      if (['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(orderStatus)) return false;
      // 排除退款订单
      const afterSaleStatus = String(findField(o, '售后状态') || '').trim();
      if (afterSaleStatus.includes('退款')) return false;
      // 排除用户标记为排除计算的异常订单
      const orderNo = String(findField(o, '订单号') || '').trim();
      const ab = orderNo ? abnormalOrders[orderNo] : null;
      if (ab && ab.status === 'excluded') return false;
      return true;
    });
  }, [allOrders, allDates, timeRange, abnormalOrders, customStart, customEnd, quickRange]);
  const orders = filteredOrders;

  // ─── 服务端成本概览 & 环比趋势 ────────────
  // 设计原则：服务器计算，前端仅展示（原始设计要求）
  // 时间范围参数由前端提供（纯日期，不涉及计算逻辑）
  const { currentStore } = useStore();
  const storeId = currentStore?.id || '';
  const [serverCostSummary, setServerCostSummary] = useState<ApiCostSummary | null>(null);
  const [serverTrendData, setServerTrendData] = useState<CostTrendResponse | null>(null);
  const [costsServerLoading, setCostsServerLoading] = useState(false);

  useEffect(() => {
    if (!storeId || storeId === '__all__') return;

    // 从 allOrders + 时间范围参数推算日期范围
    // getAllDateGroups 返回 [dateString, orders[]][]
    const dateGroups = getAllDateGroups(allOrders);
    if (!dateGroups.length) return;

    const sorted = dateGroups.map(([d]) => d).filter(Boolean).sort();
    const dataEnd = sorted[sorted.length - 1] || '';
    const dataStart = sorted[0] || '';
    if (!dataStart || !dataEnd) return;

    let minDate = dataStart, maxDate = dataEnd;

    if (timeRange === 'custom' && customStart && customEnd) {
      minDate = customStart;
      maxDate = customEnd;
    } else if (quickRange) {
      // 从结束日期往前推
      const match = quickRange.match(/^(\d+)([dDwWmMyY])$/);
      if (match) {
        const num = parseInt(match[1]);
        const unit = match[2].toLowerCase();
        const d = new Date(dataEnd);
        if (unit === 'd') d.setDate(d.getDate() - num);
        else if (unit === 'w') d.setDate(d.getDate() - num * 7);
        else if (unit === 'm') d.setMonth(d.getMonth() - num);
        else if (unit === 'y') d.setFullYear(d.getFullYear() - num);
        const calcStart = d.toISOString().slice(0, 10);
        if (calcStart > minDate) minDate = calcStart;
      }
    } else if (timeRange && !isNaN(Number(timeRange))) {
      const days = Number(timeRange);
      const d = new Date(dataEnd);
      d.setDate(d.getDate() - days);
      const calcStart = d.toISOString().slice(0, 10);
      if (calcStart > minDate) minDate = calcStart;
    }

    setCostsServerLoading(true);
    Promise.all([
      analyticsApi.getCosts(storeId, minDate, maxDate),
      analyticsApi.getCostTrend(storeId, minDate, maxDate),
    ]).then(([costs, trend]) => {
      if (costs) setServerCostSummary(costs);
      if (trend) setServerTrendData(trend);
    }).catch(() => {
      // 静默失败，本地计算 fallback
    }).finally(() => setCostsServerLoading(false));
  }, [storeId, timeRange, customStart, customEnd, quickRange, allOrders]); // 时间范围或数据变化时重新获取

  const maxAnalysisDate = useMemo(() => {
    let maxDate = '';
    filteredOrders.forEach((o: any) => {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
      if (d && d > maxDate) maxDate = d;
    });
    return maxDate || new Date().toISOString().slice(0, 10);
  }, [filteredOrders]);

  // ========== 延迟发货罚款匹配 ==========

  const lateShipmentMatch = useMemo(() => {
    return matchLateShipmentPenalties(
      filteredOrders,
      orderFinancialActuals,
      unlinkedFinancials || { penalties: 0, marketingFees: 0, experiencePlan: 0, adTransfer: 0, lateShipment: 0, records: [] },
      findField
    );
  }, [filteredOrders, orderFinancialActuals, unlinkedFinancials]);

  const latePenaltyMap = useMemo(() => {
    const map: Record<string, { amount: number; confirmed: boolean }> = {};
    lateShipmentMatch.confirmedOrders.forEach(m => {
      map[m.orderNo] = { amount: m.actualPenalty, confirmed: true };
    });
    lateShipmentMatch.estimatedOrders.forEach(m => {
      map[m.orderNo] = { amount: m.expectedPenalty, confirmed: false };
    });
    return map;
  }, [lateShipmentMatch]);

  const productGroups = useMemo(() => {
    const groups = new Map<string, ProductGroup>();
    const skuMap = new Map<string, SkuItem>();
    const insurance = currentDisplayData?.shippingInsurance || [];

    orders.forEach(o => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      const ab = orderNo ? abnormalOrders[orderNo] : null;

      // 排除计算：跳过已标记为 excluded 的订单
      if (ab && ab.status === 'excluded') return;

      const productId = String(findField(o, '商品id', '商品ID') || '').trim();
      const productName = String(findField(o, '商品', '商品名称') || '').trim();
      const skuId = String(findField(o, '样式ID') || '').trim();
      const skuName = String(findField(o, '商品规格') || '').trim();
      const productCode = String(findField(o, '商家编码-商品维度') || '').trim();
      const skuCode = String(findField(o, '商家编码-规格维度') || '').trim();
      let price = parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0;

      // 调整值：使用用户修改后的数据
      if (ab && ab.status === 'adjusted') {
        if (ab.adjustedFields.merchantAmount != null) price = ab.adjustedFields.merchantAmount;
      }

      if (!productId) return;

      const skuKey = skuId ? `${productId}_${skuId}` : productId;

      if (!groups.has(productId)) {
        groups.set(productId, {
          productId,
          productName,
          skus: [],
          minPrice: Infinity,
          maxPrice: -Infinity,
          totalOrders: 0,
          totalItems: 0
        });
      }
      const group = groups.get(productId)!;
      group.totalOrders++;
      if (price > 0) {
        group.minPrice = Math.min(group.minPrice, price);
        group.maxPrice = Math.max(group.maxPrice, price);
      }

      if (!skuMap.has(skuKey)) {
        const skuItem: SkuItem = {
          productId, productName, skuId, skuName,
          productCode, skuCode,
          hasProductCode: !!productCode,
          hasSkuCode: !!skuCode,
          prices: [], orderCount: 0, itemCount: 0,
          shippingOrderCount: 0, actualShippingCost: 0, insuredOrderCount: 0,
          uniqueOrderNos: new Set<string>()
        };
        skuMap.set(skuKey, skuItem);
        group.skus.push(skuItem);
      }

      const sku = skuMap.get(skuKey)!;
      sku.orderCount++;
      sku.uniqueOrderNos.add(orderNo);
      // 后续订单出现编码时更新标记（首次设置可能在编码为空的订单上）
      if (!sku.hasProductCode && productCode) sku.hasProductCode = true;
      if (!sku.hasSkuCode && skuCode) sku.hasSkuCode = true;
      let itemQty = parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1').replace(/[^\d]/g, '')) || 1;
      // 调整数量
      if (ab && ab.status === 'adjusted' && ab.adjustedFields.itemCount != null) itemQty = ab.adjustedFields.itemCount;
      sku.itemCount += itemQty;
      group.totalItems += itemQty;
      if (price > 0) sku.prices.push(price);

      // 快递费统计：仅有快递单号的订单才计入（未发货不产生快递费）
      const trackingNo = String(findField(o, '快递单号') || '').trim();
      const actualPostage = parseFloat(String(findField(o, '邮费(元)', '邮费', '快递费', '运费') || '0')) || 0;
      if (trackingNo) {
        sku.shippingOrderCount++;
        sku.actualShippingCost = (sku.actualShippingCost || 0) + actualPostage;
      }

      // 运费险统计：匹配运费险数据
      const hasInsurance = insurance.some((r: any) => {
        const rno = String(findField(r, '订单编号', '订单号') || '').trim();
        return rno && rno === orderNo;
      });
      if (hasInsurance) sku.insuredOrderCount++;
    });

    groups.forEach(g => { g.skus.sort((a, b) => a.skuName.localeCompare(b.skuName)); });
    return Array.from(groups.values());
  }, [orders, currentDisplayData?.shippingInsurance, abnormalOrders]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchCost, setBatchCost] = useState('');
  const [costRatio, setCostRatio] = useState('40');
  // ★ F6: 批量操作确认状态
  const [batchConfirm, setBatchConfirm] = useState<{ cost: number; count: number } | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPrices, setExpandedPrices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [quickSettingsTab, setQuickSettingsTab] = useState<'fees' | 'couriers'>('fees');
  const [tempPackagingFee, setTempPackagingFee] = useState(String(packagingFeePerOrder));
  const [tempDefaultCostRatio, setTempDefaultCostRatio] = useState(String(defaultCostRatio ?? 30));
  const [tempShippingFee, setTempShippingFee] = useState(String(shippingFeePerOrder || 0));
  const [tempPlatformCommissionRate, setTempPlatformCommissionRate] = useState(String(platformCommissionRate || 0));
  const [tempLaborFee, setTempLaborFee] = useState(String(laborFeePerOrder || 0));
  const [tempInsuranceFee, setTempInsuranceFee] = useState(String(insuranceFeePerOrder || 0));
  const [tempPromotionFee, setTempPromotionFee] = useState(String(promotionFeePerOrder || 0));
  const [showCostHistory, setShowCostHistory] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified cost tab filter: all / missing / filled / unfilled
  const [costFilter, setCostFilter] = useState<'all' | 'missing' | 'filled' | 'unfilled'>('all');

  // Missing/filter states for cost tab
  const [missingSearchQuery, setMissingSearchQuery] = useState('');
  const [missingPriceMin, setMissingPriceMin] = useState('');
  const [missingPriceMax, setMissingPriceMax] = useState('');
  const [missingOrderMin, setMissingOrderMin] = useState('');
  const [missingOrderMax, setMissingOrderMax] = useState('');
  const [missingSortBy, setMissingSortBy] = useState<'orders' | 'items' | 'price'>('orders');
  const [missingSortOrder, setMissingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showMissingFilters, setShowMissingFilters] = useState(false);

  // Deduction filters
  const [deductionSearchQuery, setDeductionSearchQuery] = useState('');
  const [deductionAmountMin, setDeductionAmountMin] = useState('');
  const [deductionAmountMax, setDeductionAmountMax] = useState('');
  const [deductionSortBy, setDeductionSortBy] = useState<'name' | 'scope' | 'order'>('order');
  const [deductionSortOrder, setDeductionSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeductionFilters, setShowDeductionFilters] = useState(false);

  // Deduction form
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState<Partial<CustomDeduction>>({
    name: '', formula: '', scope: 'global', scopeTarget: '', enabled: true, condition: '', effectiveFrom: '', effectiveTo: ''
  });
  const [formulaValidation, setFormulaValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  // Derived data
  const missingCodeProducts = useMemo(() =>
    productGroups.filter(g => g.skus.some(s => !s.hasProductCode && !s.hasSkuCode)),
    [productGroups]
  );

  const getAllSkuKeys = (groups: ProductGroup[]): string[] => {
    const keys: string[] = [];
    groups.forEach(g => g.skus.forEach(s => {
      keys.push(s.skuId ? `${s.productId}_${s.skuId}` : s.productId);
    }));
    return keys;
  };

  const filteredMissingProducts = useMemo(() => {
    let result = missingCodeProducts;
    if (missingSearchQuery) {
      const query = missingSearchQuery.toLowerCase();
      result = result.filter(g =>
        g.productName.toLowerCase().includes(query) ||
        g.productId.toLowerCase().includes(query) ||
        g.skus.some(s => s.skuName.toLowerCase().includes(query))
      );
    }
    const minPrice = parseFloat(missingPriceMin) || 0;
    const maxPrice = parseFloat(missingPriceMax) || Infinity;
    if (minPrice > 0 || maxPrice < Infinity) {
      result = result.filter(g => {
        const avgPrice = (g.minPrice + g.maxPrice) / 2;
        return avgPrice >= minPrice && avgPrice <= maxPrice;
      });
    }
    const minOrders = parseInt(missingOrderMin) || 0;
    const maxOrders = parseInt(missingOrderMax) || Infinity;
    if (minOrders > 0 || maxOrders < Infinity) {
      result = result.filter(g => g.totalOrders >= minOrders && g.totalOrders <= maxOrders);
    }
    result = [...result].sort((a, b) => {
      let comparison = 0;
      switch (missingSortBy) {
        case 'orders': comparison = a.totalOrders - b.totalOrders; break;
        case 'items': comparison = a.totalItems - b.totalItems; break;
        case 'price': comparison = ((a.minPrice + a.maxPrice) / 2) - ((b.minPrice + b.maxPrice) / 2); break;
      }
      return missingSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [missingCodeProducts, missingSearchQuery, missingPriceMin, missingPriceMax, missingOrderMin, missingOrderMax, missingSortBy, missingSortOrder]);

  const filteredDeductions = useMemo(() => {
    let result = [...(customDeductions || [])];
    if (deductionSearchQuery) {
      const query = deductionSearchQuery.toLowerCase();
      result = result.filter(d => d.name.toLowerCase().includes(query));
    }
    result.sort((a, b) => {
      let comparison = 0;
      switch (deductionSortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'scope': comparison = a.scope.localeCompare(b.scope); break;
        case 'order': comparison = a.sortOrder - b.sortOrder; break;
      }
      return deductionSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [customDeductions, deductionSearchQuery, deductionSortBy, deductionSortOrder]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return productGroups;
    return productGroups.filter(g =>
      g.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.productId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.skus.some(s =>
        s.skuName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.skuCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.productCode.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [productGroups, searchQuery]);

  // Apply costFilter to product list
  const displayGroups = useMemo(() => {
    switch (costFilter) {
      case 'missing':
        return filteredMissingProducts.length ? filteredMissingProducts : (searchQuery ? filteredGroups.filter(g => missingCodeProducts.includes(g)) : missingCodeProducts);
      case 'filled':
        return filteredGroups.filter(g => g.skus.some(s => {
          const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
          return (productCosts[k] || 0) > 0;
        }));
      case 'unfilled':
        return filteredGroups.filter(g => g.skus.some(s => {
          const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
          return !(productCosts[k] || 0);
        }));
      default:
        return filteredGroups;
    }
  }, [filteredGroups, filteredMissingProducts, missingCodeProducts, costFilter, searchQuery, productCosts]);

  const toggleSelect = (key: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    const allKeys: string[] = [];
    displayGroups.forEach(g => {
      g.skus.forEach(s => {
        allKeys.push(s.skuId ? `${s.productId}_${s.skuId}` : s.productId);
      });
    });
    if (selectedItems.size === allKeys.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(allKeys));
    }
  };

  const applyBatchCost = () => {
    const cost = parseFloat(batchCost);
    if (isNaN(cost) || selectedItems.size === 0) return;
    // ★ F6: 先确认再执行
    setBatchConfirm({ cost, count: selectedItems.size });
  };

  const executeBatchCost = () => {
    if (!batchConfirm) return;
    const { cost } = batchConfirm;
    selectedItems.forEach(key => {
      const oldCost = productCosts[key] || 0;
      setProductCost(key, cost);
      const existingCfg = costConfigs[key];
      setCostConfig(key, { rawCost: cost, packagingFee: existingCfg?.packagingFee ?? packagingFeePerOrder, updatedAt: new Date().toISOString() });
      const product = productGroups.find(g => g.productId === key || g.skus.some(s => `${s.productId}_${s.skuId}` === key));
      if (product) {
        addCostHistory({
          productId: key, productName: product.productName,
          field: 'rawCost', oldValue: oldCost, newValue: cost, reason: '批量设置成本'
        });
      }
    });
    setSelectedItems(new Set());
    setBatchCost('');
    setBatchConfirm(null);
  };

  const clearSelection = () => { setSelectedItems(new Set()); setBatchCost(''); };

  const toggleProductExpand = (productId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(productId)) newSet.delete(productId); else newSet.add(productId);
    setExpandedProducts(newSet);
  };

  const togglePriceExpand = (skuKey: string) => {
    const newSet = new Set(expandedPrices);
    if (newSet.has(skuKey)) newSet.delete(skuKey); else newSet.add(skuKey);
    setExpandedPrices(newSet);
  };

  const saveQuickSettings = () => {
    setPackagingFeePerOrder(parseFloat(tempPackagingFee) || 0);
    setDefaultCostRatio(parseFloat(tempDefaultCostRatio) ?? 0);
    setShippingFeePerOrder(parseFloat(tempShippingFee) || 0);
    setPlatformCommissionRate(parseFloat(tempPlatformCommissionRate) || 0);
    setLaborFeePerOrder(parseFloat(tempLaborFee) || 0);
    setInsuranceFeePerOrder(parseFloat(tempInsuranceFee) || 0);
    setPromotionFeePerOrder(parseFloat(tempPromotionFee) || 0);
    setShowQuickSettings(false);
    // ★ 清除服务端缓存，下次 useEffect 重新获取时使用新配置
    setServerCostSummary(null);
    setServerTrendData(null);
  };

  const formatPriceRange = (min: number, max: number) => {
    if (min === Infinity || max === -Infinity) return '--';
    if (min === max) return `¥${min.toFixed(2)}`;
    return `¥${min.toFixed(2)} ~ ¥${max.toFixed(2)}`;
  };

  const getPriceDistribution = (prices: number[]) => {
    const dist = new Map<number, number>();
    prices.forEach(p => {
      const rounded = Math.round(p * 100) / 100;
      dist.set(rounded, (dist.get(rounded) || 0) + 1);
    });
    return Array.from(dist.entries()).sort((a, b) => b[1] - a[1]);
  };

  const calculateTotalCost = (sku: SkuItem) => {
    const skuKey = sku.skuId ? `${sku.productId}_${sku.skuId}` : sku.productId;
    const rawCost = productCosts[skuKey] || 0;
    // 未填裸货成本时，使用默认比例估算
    const effectiveRawCost = rawCost > 0 ? rawCost
      : (defaultCostRatio > 0 ? (defaultCostRatio / 100) * (sku.prices.filter(p => p > 0).reduce((a, b) => a + b, 0) / (sku.prices.length || 1)) : 0);

    const uniqueOrderCnt = sku.uniqueOrderNos?.size || sku.orderCount;
    const totalRawCost = rawCost > 0 ? rawCost * sku.itemCount : effectiveRawCost * sku.itemCount;
    const totalPackaging = packagingFeePerOrder * uniqueOrderCnt;
    const totalLabor = laborFeePerOrder * uniqueOrderCnt;
    // ★ F3: 快递费逐单计算 — 有实际邮费的取邮费，没有的按快递公司费率或默认费率
    let totalShipping = 0;
    const courierRates = JSON.parse(localStorage.getItem('dianfx_courier_rates') || '{}');
    const skuOrders = orders.filter(o => {
      const oId = String(findField(o, '商品id', '商品ID', 'productId') || '');
      const sId = String(findField(o, '商家编码-SKU维度', '规格编码', 'SKU编码') || '');
      const key = sId ? `${oId}_${sId}` : oId;
      return key === skuKey;
    });
    // 按SKU遍历每一个订单，逐单计算快递费
    skuOrders.forEach(o => {
      const trackingNo = String(findField(o, '快递单号') || '').trim();
      if (!trackingNo) return; // 无快递单号不计
      const actualPostage = parseFloat(String(findField(o, '邮费(元)', '邮费', '快递费', '运费') || '0')) || 0;
      if (actualPostage > 0) {
        totalShipping += actualPostage; // 有实际邮费的用实际值
      } else {
        const courier = String(findField(o, '快递公司') || '').trim();
        const rate = courierRates[courier] || shippingFeePerOrder || 0;
        totalShipping += rate; // 无实际邮费的按费率算
      }
    });
    // ★ F2: 推广费 — 有实际财务营销数据的用实际值，没有的才全局均摊
    let totalPromotionFee = 0;
    let useGlobalPromotionFee = true;

    // 实际财务数据覆盖：以公式为基准，有货款明细的订单用实际值替换
    const positivePrices = sku.prices.filter(p => p > 0);
    const totalRevenue = positivePrices.reduce((a, b) => a + b, 0);
    const avgRevenue = uniqueOrderCnt > 0 ? totalRevenue / uniqueOrderCnt : 0;

    let totalPlatformCommission = totalRevenue * (platformCommissionRate / 100);
    let totalSubTechFee = 0; // 百亿补贴扣点（单独展示）
    let totalInsurance = (insuranceFeePerOrder || 0) * sku.insuredOrderCount;
    let totalPenalties = 0;
    let totalMarketingFees = 0;
    let actualOrderCount = 0;
    let confirmedPenaltyCount = 0;
    let estimatedPenaltyCount = 0;

    sku.uniqueOrderNos.forEach(orderNo => {
      const actual = orderFinancialActuals[orderNo];
      const lateMatch = latePenaltyMap[orderNo];

      // 实际财务数据覆盖（平台佣金、运费险等）
      if (actual?.hasData) {
        actualOrderCount++;
        if (actual.baseTechFee > 0 || actual.subTechFee > 0) {
          totalPlatformCommission += actual.baseTechFee - avgRevenue * (platformCommissionRate / 100);
          totalSubTechFee += actual.subTechFee;
        }
        if (actual.shippingInsurance > 0) {
          totalInsurance += actual.shippingInsurance - (insuranceFeePerOrder || 0);
        }
        totalPenalties += actual.penalties;
        if (actual.marketingFees > 0) {
          totalMarketingFees += actual.marketingFees;
          useGlobalPromotionFee = false; // ★ F2: 有实际营销费数据的订单，跳过全局推广费均摊
        }
      }

      // 延迟发货罚款匹配（独立于 financialActuals 索引）
      if (lateMatch) {
        totalPenalties += lateMatch.amount;
        if (lateMatch.confirmed) confirmedPenaltyCount++;
        else estimatedPenaltyCount++;
      }
    });

    // 在循环后得到 totalPromotionFee（仅当无实际营销费时才使用全局均摊）
    if (useGlobalPromotionFee) {
      totalPromotionFee = (promotionFeePerOrder || 0) * uniqueOrderCnt;
    } else {
      totalPromotionFee = 0; // ★ F2: 有实际财务营销数据，跳过全局均摊避免双重计算
    }

    // 注意：商家实收已扣平台费，成本汇总不含 platformFee（totalPlatformCommission 仅供展示）
    const subtotal = totalRawCost + totalPackaging + totalLabor + totalShipping + totalInsurance + totalPenalties + totalMarketingFees + totalPromotionFee;

    // 自定义扣费：使用统一的安全公式引擎，含范围/条件/有效期检查
    const deductionDetails = (customDeductions || []).filter(d => d.enabled).sort((a, b) => a.sortOrder - b.sortOrder).map(d => {
      // 范围检查
      if (d.scope === 'product' && d.scopeTarget && d.scopeTarget !== sku.productId && d.scopeTarget !== skuKey) {
        return { name: d.name, formula: d.formula, amount: 0 };
      }
      // 有效期检查（基于订单最大日期）
      if (d.effectiveFrom && maxAnalysisDate < d.effectiveFrom) return { name: d.name, formula: d.formula, amount: 0 };
      if (d.effectiveTo && maxAnalysisDate > d.effectiveTo) return { name: d.name, formula: d.formula, amount: 0 };
      // 构建完整上下文
      const ctx: FormulaContext = {
        gmv: sku.prices.reduce((a, b) => a + b, 0),
        revenue: sku.prices.reduce((a, b) => a + b, 0),
        orders: sku.orderCount,
        sales: sku.itemCount,
        productCost: totalRawCost,
        packagingFee: totalPackaging,
        shippingFee: totalShipping,
        promoCost: 0,
        discount: 0,
        profit: sku.prices.reduce((a, b) => a + b, 0) - subtotal,
        grossProfit: 0,
        netProfit: 0,
        refund: 0,
        refundRate: 0,
        afterSaleCount: 0,
        afterSaleRate: 0,
        promoOrders: 0,
        promoTransaction: 0,
        promoClicks: 0,
        promoImpressions: 0,
        ctr: 0,
        cvr: 0,
        roi: 0,
        avgOrderValue: sku.orderCount > 0 ? sku.prices.reduce((a, b) => a + b, 0) / sku.orderCount : 0,
        activeDays: 0,
        avgDailySales: 0,
        platformFee: 0,
        taxes: 0,
      };
      // 条件检查
      if (d.condition) {
        const condResult = evaluateFormula(d.condition, ctx);
        if (!condResult) return { name: d.name, formula: d.formula, amount: 0 };
      }
      const amount = evaluateFormula(d.formula, ctx);
      return { name: d.name, formula: d.formula, amount };
    });

    const deductionTotal = deductionDetails.reduce((s, d) => s + d.amount, 0);
    const total = subtotal + deductionTotal;

    return {
      rawCost: rawCost > 0 ? rawCost : effectiveRawCost,
      totalRawCost, totalPackaging, totalLabor,
      totalShipping, shippingOrderCount: sku.shippingOrderCount,
      totalInsurance, insuredOrderCount: sku.insuredOrderCount,
      totalPlatformCommission,
      totalSubTechFee,
      totalPenalties,
      totalMarketingFees,
      totalPromotionFee,
      actualOrderCount,
      confirmedPenaltyCount,
      estimatedPenaltyCount,
      subtotal,
      deductionDetails,
      total,
      isEstimated: rawCost <= 0 && defaultCostRatio > 0,
    };
  };

  // Alert states
  const [alertFilter, setAlertFilter] = useState<'all' | 'multiSku' | 'multiItem' | 'loss' | 'lowPay' | 'highQty' | 'flashRefund'>('all');
  const [alertProcessedFilter, setAlertProcessedFilter] = useState<'all' | 'unprocessed' | 'processed'>('all');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [alertActionOpen, setAlertActionOpen] = useState<Set<string>>(new Set());
  // ★ 批量操作
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());
  const [showBatchAdjust, setShowBatchAdjust] = useState(false);
  const [batchAdjAmount, setBatchAdjAmount] = useState('');

  const batchProcess = (status: 'excluded' | 'adjusted') => {
    batchSelected.forEach(orderNo => {
      const adjFields: any = { itemCount: 1, merchantAmount: parseFloat(batchAdjAmount) || 0, rawCost: 0 };
      setAbnormalOrder(orderNo, { orderNo, status, note: '', adjustedFields: adjFields, alertTypes: ['batch'], processedAt: new Date().toISOString() });
    });
    setBatchSelected(new Set());
    setShowBatchAdjust(false);
    setBatchAdjAmount('');
  };

  // ========== 成本预警计算 ==========

  // 1. 一单多SKU：同订单号下多于1行SKU记录
  const multiSkuAlerts = useMemo(() => {
    const orderMap = new Map<string, { rows: any[]; lines: number }>();
    filteredOrders.forEach((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      if (!orderNo) return;
      if (!orderMap.has(orderNo)) orderMap.set(orderNo, { rows: [], lines: 0 });
      const entry = orderMap.get(orderNo)!;
      entry.rows.push(o);
      entry.lines++;
    });
    return Array.from(orderMap.entries())
      .filter(([_, v]) => v.lines >= 2)
      .map(([orderNo, v]) => {
        const lines = v.rows;
        const products = [...new Set(lines.map((r: any) => String(findField(r, '商品', '商品名称') || '').slice(0, 20)))];
        const totalItems = lines.reduce((s: number, r: any) => s + (parseInt(String(findField(r, '商品数量(件)', '商品数量', '数量') || '1')) || 1), 0);
        const totalPerOrderFees = packagingFeePerOrder + (laborFeePerOrder || 0) + (shippingFeePerOrder || 0) + (insuranceFeePerOrder || 0) + (promotionFeePerOrder || 0);
        const duplicateFee = totalPerOrderFees * (lines.length - 1);
        return { orderNo, lines: lines.length, products, totalItems, duplicateFee, totalPerOrderFees, _rows: lines };
      })
      .sort((a, b) => b.lines - a.lines);
  }, [filteredOrders, packagingFeePerOrder, laborFeePerOrder, shippingFeePerOrder, insuranceFeePerOrder, promotionFeePerOrder]);

  // 2. 一单多件：单行商品数量 > 1
  const multiItemAlerts = useMemo(() => {
    return filteredOrders
      .filter((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        return qty > 1;
      })
      .map((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const product = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        const unitPrice = qty > 0 ? merchant / qty : 0;
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const cost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        return { orderNo, product, qty, merchant, productTotal, unitPrice, cost, skuKey, _raw: o };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredOrders, productCosts, abnormalOrders]);

  // 3. 实收低于成本（亏损订单）—— 含人工费、运费险、平台扣点，未知成本用默认比例估算
  const lossAlerts = useMemo(() => {
    const insurance = currentDisplayData?.shippingInsurance || [];
    return filteredOrders
      .filter((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const knownCost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        const hasInsurance = insurance.some((r: any) => {
          const rno = String(findField(r, '订单编号', '订单号') || '').trim();
          return rno && rno === orderNo;
        });
        // ★ F4: 用 merchant（实收）替代 productTotal（原价），优惠券/满减使原价失真
        const estimatedRawCost = knownCost > 0
          ? knownCost * qty
          : (merchant * (defaultCostRatio / 100));
        if (estimatedRawCost <= 0 && knownCost <= 0 && defaultCostRatio <= 0) return false;
        const orderActual = orderFinancialActuals[orderNo];
        const platformCost = (orderActual?.hasData && (orderActual.baseTechFee > 0 || orderActual.subTechFee > 0))
          ? orderActual.baseTechFee + orderActual.subTechFee
          : merchant * (platformCommissionRate / 100);
        let insuranceCost = 0;
        if (orderActual?.hasData && orderActual.shippingInsurance > 0) {
          insuranceCost = orderActual.shippingInsurance;
        } else if (hasInsurance) {
          insuranceCost = insuranceFeePerOrder || 0;
        }
        const latePenalty = latePenaltyMap[orderNo];
        const penaltyFees = (orderActual?.penalties ?? 0) + (latePenalty?.amount ?? 0);
        // 注意：商家实收已扣平台费，estimatedCost 不含 platformCost
        const estimatedCost = estimatedRawCost
          + packagingFeePerOrder
          + (laborFeePerOrder || 0)
          + (shippingFeePerOrder || 0)
          + insuranceCost
          + (promotionFeePerOrder || 0)
          + penaltyFees
          + (orderActual?.marketingFees ?? 0);
        return merchant < estimatedCost;
      })
      .map((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const product = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const knownCost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        const hasInsurance = insurance.some((r: any) => {
          const rno = String(findField(r, '订单编号', '订单号') || '').trim();
          return rno && rno === orderNo;
        });
        // ★ F4: 同filter逻辑一致，用merchant替代productTotal
        const estimatedRawCost = knownCost > 0
          ? knownCost * qty
          : (merchant * (defaultCostRatio / 100));
        const orderActual2 = orderFinancialActuals[orderNo];
        const platformCost2 = (orderActual2?.hasData && (orderActual2.baseTechFee > 0 || orderActual2.subTechFee > 0))
          ? orderActual2.baseTechFee + orderActual2.subTechFee
          : merchant * (platformCommissionRate / 100);
        let insuranceCost2 = 0;
        if (orderActual2?.hasData && orderActual2.shippingInsurance > 0) {
          insuranceCost2 = orderActual2.shippingInsurance;
        } else if (hasInsurance) {
          insuranceCost2 = insuranceFeePerOrder || 0;
        }
        const latePenalty2 = latePenaltyMap[orderNo];
        const penaltyFees2 = (orderActual2?.penalties ?? 0) + (latePenalty2?.amount ?? 0);
        // 注意：商家实收已扣平台费，estimatedCost 不含 platformCost
        const estimatedCost = estimatedRawCost
          + packagingFeePerOrder
          + (laborFeePerOrder || 0)
          + (shippingFeePerOrder || 0)
          + insuranceCost2
          + (promotionFeePerOrder || 0)
          + penaltyFees2
          + (orderActual2?.marketingFees ?? 0);
        const loss = merchant - estimatedCost;
        return { orderNo, product, merchant, qty, cost: knownCost > 0 ? knownCost : 0, estimatedCost, loss, skuKey, costEstimated: knownCost <= 0, _raw: o };
      })
      .sort((a, b) => a.loss - b.loss);
  }, [filteredOrders, productCosts, packagingFeePerOrder, shippingFeePerOrder, laborFeePerOrder, insuranceFeePerOrder, promotionFeePerOrder, platformCommissionRate, defaultCostRatio, currentDisplayData, abnormalOrders, orderFinancialActuals, latePenaltyMap]);

  // 统计因无成本数据被跳过的订单数（defaultCostRatio=0 且 knownCost=0 时）
  const skippedNoCostCount = useMemo(() => {
    if (defaultCostRatio > 0) return 0;
    const insurance = currentDisplayData?.shippingInsurance || [];
    return filteredOrders.filter((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      const ab = orderNo ? abnormalOrders[orderNo] : null;
      const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
      const adjustedRawCost = ab?.adjustedFields?.rawCost;
      const knownCost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
      return knownCost <= 0;
    }).length;
  }, [filteredOrders, productCosts, defaultCostRatio, abnormalOrders, currentDisplayData]);

  // 4. 支付金额异常低
  const lowPayAlerts = useMemo(() => {
    return filteredOrders
      .filter((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        return merchant < 5 || (productTotal > 0 && merchant / productTotal < 0.1 && merchant < 20);
      })
      .map((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const product = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const cost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        return { orderNo, product, merchant, productTotal, cost, skuKey, _raw: o };
      })
      .sort((a, b) => a.merchant - b.merchant);
  }, [filteredOrders, productCosts, abnormalOrders]);

  // 5. 单行数量异常高（≥50件）
  const highQtyAlerts = useMemo(() => {
    return filteredOrders
      .filter((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        return qty >= 50;
      })
      .map((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        const product = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
        const qty = ab?.adjustedFields?.itemCount != null ? ab.adjustedFields.itemCount : (parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1);
        const merchant = ab?.adjustedFields?.merchantAmount != null ? ab.adjustedFields.merchantAmount : (parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0);
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const cost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        const unitPrice = qty > 0 ? merchant / qty : 0;
        return { orderNo, product, qty, merchant, productTotal, cost, unitPrice, skuKey, _raw: o };
      })
      .sort((a, b) => b.qty - a.qty);
  }, [filteredOrders, productCosts, abnormalOrders]);

  // Apply dismissed filter
  const activeMultiSkuAlerts = useMemo(() => multiSkuAlerts.filter(a => !dismissedAlerts.has(`multiSku_${a.orderNo}`)), [multiSkuAlerts, dismissedAlerts]);
  const activeMultiItemAlerts = useMemo(() => multiItemAlerts.filter(a => !dismissedAlerts.has(`multiItem_${a.orderNo}_${a.product}`)), [multiItemAlerts, dismissedAlerts]);

  // ★ F7: 多SKU订单号集合，用于在成本拆解中标注重复计费
  const multiSkuOrderNos = useMemo(() => {
    const nos = new Set<string>();
    multiSkuAlerts.forEach(a => nos.add(a.orderNo));
    return nos;
  }, [multiSkuAlerts]);
  const activeLossAlerts = useMemo(() => lossAlerts.filter(a => !dismissedAlerts.has(`loss_${a.orderNo}`)), [lossAlerts, dismissedAlerts]);
  const activeLowPayAlerts = useMemo(() => lowPayAlerts.filter(a => !dismissedAlerts.has(`lowPay_${a.orderNo}`)), [lowPayAlerts, dismissedAlerts]);
  const activeHighQtyAlerts = useMemo(() => highQtyAlerts.filter(a => !dismissedAlerts.has(`highQty_${a.orderNo}`)), [highQtyAlerts, dismissedAlerts]);

  // ★ F10: 比较期数据（环比趋势）
  const comparisonOrders = useMemo(() => {
    if (!tf.compareEnabled || !tf.compareStart || !tf.compareEnd) return [];
    const timeFiltered = filterByTimeRange(allOrders, allDates, tf.timeRange, tf.compareStart, tf.compareEnd, tf.quickRange, tf.useNaturalDate);
    return timeFiltered.filter((o: any) => {
      const orderStatus = String(findField(o, '订单状态') || '').trim();
      if (['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(orderStatus)) return false;
      const afterSaleStatus = String(findField(o, '售后状态') || '').trim();
      if (afterSaleStatus.includes('退款')) return false;
      return true;
    });
  }, [allOrders, allDates, tf.timeRange, tf.compareStart, tf.compareEnd, tf.quickRange, tf.useNaturalDate, tf.compareEnabled]);

  // ★ F10: 成本趋势（环比）
  const costTrend = useMemo(() => {
    if (comparisonOrders.length === 0) return null;
    const calcSummary = (ords: any[]) => {
      let revenue = 0, cost = 0;
      ords.forEach((o: any) => {
        const merchant = parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0;
        revenue += merchant;
        const skuId = String(findField(o, '样式ID') || '').trim();
        const pId = String(findField(o, '商品id', '商品ID') || '').trim();
        const skuKey = skuId ? `${pId}_${skuId}` : pId;
        const rawCost = productCosts[skuKey] || 0;
        const qty = parseInt(String(findField(o, '商品数量(件)', '商品数量', '数量') || '1')) || 1;
        const estRaw = rawCost > 0 ? rawCost * qty : merchant * (defaultCostRatio / 100);
        cost += estRaw + packagingFeePerOrder + (laborFeePerOrder || 0) + (shippingFeePerOrder || 0) + (insuranceFeePerOrder || 0) + (promotionFeePerOrder || 0);
      });
      return { revenue, cost, profit: revenue - cost };
    };
    const current = calcSummary(filteredOrders);
    const prev = calcSummary(comparisonOrders);
    return {
      costChange: prev.cost > 0 ? ((current.cost - prev.cost) / prev.cost) * 100 : 0,
      profitChange: prev.profit !== 0 ? ((current.profit - prev.profit) / Math.abs(prev.profit)) * 100 : 0,
      revenueChange: prev.revenue > 0 ? ((current.revenue - prev.revenue) / prev.revenue) * 100 : 0,
      currentCost: current.cost, prevCost: prev.cost,
      currentProfit: current.profit, prevProfit: prev.profit,
      currentRevenue: current.revenue, prevRevenue: prev.revenue,
    };
  }, [comparisonOrders, filteredOrders, productCosts, defaultCostRatio, packagingFeePerOrder, laborFeePerOrder, shippingFeePerOrder, insuranceFeePerOrder, promotionFeePerOrder]);

  // ★ F9: 独立计算罚款和营销费（per-order数据，不能在SKU循环中计算）
  const totalPenaltiesAndMarketing = useMemo(() => {
    let penalties = 0, marketing = 0;
    filteredOrders.forEach((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      if (!orderNo) return;
      const actual = orderFinancialActuals[orderNo];
      const lateMatch = latePenaltyMap[orderNo];
      if (actual?.penalties) penalties += actual.penalties;
      if (lateMatch?.amount) penalties += lateMatch.amount;
      if (actual?.marketingFees) marketing += actual.marketingFees;
    });
    return { penalties, marketing };
  }, [filteredOrders, orderFinancialActuals, latePenaltyMap]);

  // ★ F11: 多SKU重复扣费汇总
  const totalDuplicateFees = useMemo(() => {
    return multiSkuAlerts.reduce((sum, a) => sum + a.duplicateFee, 0);
  }, [multiSkuAlerts]);

  // ★ F12: 退款总额（用于净利润计算）
  const totalRefundAmount = useMemo(() => {
    return afterSaleRecords.reduce((sum: number, r: any) => {
      return sum + (Number(findField(r, '退款金额(元)', '退款金额', '售后金额') || 0) || 0);
    }, 0);
  }, [afterSaleRecords]);

  // ★ overviewStats — 放在所有依赖之后
  const overviewStats = useMemo(() => {
    const allSkus = getAllSkuKeys(productGroups);
    const skusWithCost = allSkus.filter(k => (productCosts[k] || 0) > 0);
    const productsWithCode = productGroups.filter(g =>
      g.skus.some(s => s.hasProductCode || s.hasSkuCode)
    ).length;
    const productsWithoutCode = productGroups.filter(g =>
      !g.skus.some(s => s.hasProductCode || s.hasSkuCode)
    ).length;
    const skusWithoutCost = allSkus.filter(k => !(productCosts[k] || 0));

    let totalCost = 0;
    let totalRevenue = 0;

    productGroups.forEach(g => {
      g.skus.forEach(sku => {
        const skuKey = sku.skuId ? `${sku.productId}_${sku.skuId}` : sku.productId;
        const rawCost = productCosts[skuKey] || 0;
        const uniqueCnt = sku.uniqueOrderNos?.size || sku.orderCount;
        const totalRaw = rawCost > 0
          ? rawCost * sku.itemCount
          : (defaultCostRatio > 0
            ? (defaultCostRatio / 100) * (sku.prices.filter(p => p > 0).reduce((a, b) => a + b, 0) / (sku.prices.length || 1)) * sku.itemCount
            : 0);

        totalCost += totalRaw
          + packagingFeePerOrder * uniqueCnt
          + (laborFeePerOrder || 0) * uniqueCnt
          + (shippingFeePerOrder || 0) * sku.shippingOrderCount
          + (insuranceFeePerOrder || 0) * sku.insuredOrderCount
          + (promotionFeePerOrder || 0) * uniqueCnt;

        totalRevenue += sku.prices.filter(p => p > 0).reduce((a, b) => a + b, 0);
      });
    });

    // ★ F9: 加入罚款和营销费
    const totalWithPenalties = totalCost + totalPenaltiesAndMarketing.penalties + totalPenaltiesAndMarketing.marketing;
    const profit = totalRevenue - totalWithPenalties;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    const avgUnitCost = skusWithCost.length > 0
      ? skusWithCost.reduce((sum, k) => sum + (productCosts[k] || 0), 0) / skusWithCost.length
      : 0;

    return {
      totalProducts: productGroups.length,
      productsWithCode,
      productsWithoutCode,
      totalSkus: allSkus.length,
      skusWithCost: skusWithCost.length,
      skusWithoutCost: skusWithoutCost.length,
      costCoverage: allSkus.length > 0 ? (skusWithCost.length / allSkus.length) * 100 : 0,
      totalEstimatedCost: totalWithPenalties,
      avgUnitCost,
      totalRevenue,
      profit,
      profitMargin,
      lossOrderCount: activeLossAlerts.length,
      penalties: totalPenaltiesAndMarketing.penalties,
      marketingFees: totalPenaltiesAndMarketing.marketing,
    };
  }, [productGroups, productCosts, packagingFeePerOrder, shippingFeePerOrder,
      laborFeePerOrder, insuranceFeePerOrder, promotionFeePerOrder,
      defaultCostRatio, activeLossAlerts, totalPenaltiesAndMarketing]);

  // ★ 合并服务端数据（优先，符合"服务器计算"设计原则）
  // 当服务端数据可用时，用服务端值覆盖本地计算的概览数值
  const displayOverview = useMemo(() => {
    if (!serverCostSummary) return overviewStats;
    return {
      ...overviewStats,
      totalRevenue: serverCostSummary.totalRevenue,
      totalEstimatedCost: serverCostSummary.totalCost,
      profit: serverCostSummary.profit,
      profitMargin: serverCostSummary.profitMargin,
      lossOrderCount: serverCostSummary.lossOrderCount,
      penalties: serverCostSummary.penalties,
      marketingFees: serverCostSummary.marketingFees,
      totalRefundAmount: serverCostSummary.totalRefundAmount,
      duplicateFees: serverCostSummary.duplicateFees,
    };
  }, [overviewStats, serverCostSummary]);

  // ★ 服务端环比趋势（优先），fallback 到前端计算
  const displayTrend = serverTrendData ? {
    costChange: serverTrendData.changes.cost,
    profitChange: serverTrendData.changes.profit,
    revenueChange: serverTrendData.changes.revenue,
    currentCost: serverTrendData.current.cost,
    prevCost: serverTrendData.previous.cost,
    currentProfit: serverTrendData.current.profit,
    prevProfit: serverTrendData.previous.profit,
    currentRevenue: serverTrendData.current.revenue,
    prevRevenue: serverTrendData.previous.revenue,
  } : costTrend;

  const exportSkuTemplate = () => {
    const headers = ['商品ID', 'SKU_ID', '商品名称', '规格', '商家编码', '当前成本(元/件)', '订单数', '件数'];
    const rows = productGroups.flatMap(g =>
      g.skus.map(s => {
        const skuKey = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
        return [
          s.productId, s.skuId || '',
          `"${(s.productName || '').replace(/"/g, '""')}"`,
          `"${(s.skuName || '').replace(/"/g, '""')}"`,
          s.skuCode || s.productCode || '',
          productCosts[skuKey] || '', s.orderCount, s.itemCount
        ].join(',');
      })
    );
    const csv = '﻿' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SKU成本模板_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 安全解析 CSV 行（处理引号内逗号）
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          result.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    result.push(current.trim());
    return result;
  };

  // 通用处理：从表头和数据行导入成本
  const processImportRows = (headers: string[], rows: any[][]) => {
    // 清洗表头：去除BOM和不可见字符
    const cleanHeaders = headers.map(h => String(h || '').replace(/[﻿ \t\r\n]+/g, '').trim());
    const costIdx = cleanHeaders.findIndex(h => h.includes('成本') || h.toLowerCase().includes('cost'));
    const idIdx = cleanHeaders.findIndex(h => h.includes('商品ID') || h.toLowerCase().includes('productid') || h.toLowerCase().includes('product'));
    const skuIdx = cleanHeaders.findIndex(h => h.includes('SKU') || h.toLowerCase().includes('sku'));

    if (costIdx < 0) { setImportStatus({ type: 'error', msg: '未找到成本列，请确保表头包含"成本"关键字' }); return; }
    if (idIdx < 0) { setImportStatus({ type: 'error', msg: '未找到商品ID列，请确保表头包含"商品ID"关键字' }); return; }

    let successCount = 0, skipCount = 0;
    for (const row of rows) {
      const cols = row.map(c => String(c ?? '').trim());
      const productId = cols[idIdx];
      const skuId = skuIdx >= 0 ? cols[skuIdx] : '';
      const costVal = parseFloat(cols[costIdx]);
      if (!productId || isNaN(costVal) || costVal <= 0) { skipCount++; continue; }
      const skuKey = skuId ? `${productId}_${skuId}` : productId;
      const oldCost = productCosts[skuKey] || 0;
      setProductCost(skuKey, costVal);
      const existingCfg = costConfigs[skuKey];
      setCostConfig(skuKey, { rawCost: costVal, packagingFee: existingCfg?.packagingFee ?? packagingFeePerOrder, updatedAt: new Date().toISOString() });
      const product = productGroups.find(g => g.productId === productId || g.skus.some(s => `${s.productId}_${s.skuId}` === skuKey));
      if (product) {
        addCostHistory({ productId: skuKey, productName: product.productName, field: 'rawCost', oldValue: oldCost, newValue: costVal, reason: '导入成本数据' });
      }
      successCount++;
    }
    setImportStatus({ type: 'success', msg: `成功导入 ${successCount} 条成本数据${skipCount > 0 ? `，跳过 ${skipCount} 条无效数据` : ''}` });
  };

  const handleImportCosts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);

    const ext = file.name.toLowerCase().split('.').pop();

    if (ext === 'xlsx' || ext === 'xls') {
      // Excel 文件解析
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const wb = XLSX.read(evt.target?.result, { type: 'array' });
          const sheetName = wb.SheetNames[0];
          if (!sheetName) { setImportStatus({ type: 'error', msg: '文件中没有工作表' }); return; }
          const sheet = wb.Sheets[sheetName];
          const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          // 跳过空行，找到有效数据
          const validRows = rawRows.filter(r => r && r.length > 0 && r.some((c: any) => String(c || '').trim()));
          if (validRows.length < 2) { setImportStatus({ type: 'error', msg: '文件为空或格式不正确' }); return; }
          const headers = validRows[0].map((c: any) => String(c ?? ''));
          const dataRows = validRows.slice(1);
          processImportRows(headers, dataRows);
        } catch (err) {
          setImportStatus({ type: 'error', msg: '解析Excel文件失败，请检查格式' });
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // CSV 文件解析
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const text = evt.target?.result as string;
          // 去除 UTF-8 BOM
          const cleanText = text.replace(/^﻿/, '');
          const lines = cleanText.split(/\r?\n/).filter(l => l.trim());
          if (lines.length < 2) { setImportStatus({ type: 'error', msg: '文件为空或格式不正确' }); return; }

          const headers = parseCsvLine(lines[0]);
          const dataRows = lines.slice(1).map(l => parseCsvLine(l));
          processImportRows(headers, dataRows);
        } catch (err) {
          setImportStatus({ type: 'error', msg: '解析CSV文件失败，请检查格式' });
        }
      };
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCostChange = (skuKey: string, cost: number) => {
    const oldCost = productCosts[skuKey] || 0;
    setProductCost(skuKey, cost);
    const existingConfig = costConfigs[skuKey];
    setCostConfig(skuKey, { rawCost: cost, packagingFee: existingConfig?.packagingFee ?? packagingFeePerOrder, updatedAt: new Date().toISOString() });
    const product = productGroups.find(g => g.skus.some(s => `${s.productId}_${s.skuId}` === skuKey || s.productId === skuKey));
    if (product) {
      addCostHistory({ productId: skuKey, productName: product.productName, field: 'rawCost', oldValue: oldCost, newValue: cost, reason: '手动修改成本' });
    }
  };

  // Deduction handlers
  const handleValidateFormula = () => {
    if (!deductionForm.formula) return;
    const isValid = validateFormula(deductionForm.formula);
    setFormulaValidation(isValid ? { valid: true } : { valid: false, error: '公式验证失败' });
  };

  const handleAddDeduction = () => {
    if (!deductionForm.name || !deductionForm.formula) return;
    const isValid = validateFormula(deductionForm.formula);
    if (!isValid) { setFormulaValidation({ valid: false, error: '公式验证失败' }); return; }
    addCustomDeduction({
      id: Date.now().toString(), name: deductionForm.name, formula: deductionForm.formula,
      scope: deductionForm.scope || 'global', scopeTarget: deductionForm.scopeTarget,
      effectiveFrom: deductionForm.effectiveFrom, effectiveTo: deductionForm.effectiveTo,
      condition: deductionForm.condition, enabled: deductionForm.enabled ?? true,
      sortOrder: (customDeductions || []).length
    });
    setDeductionForm({ name: '', formula: '', scope: 'global', scopeTarget: '', enabled: true, condition: '', effectiveFrom: '', effectiveTo: '' });
    setFormulaValidation(null);
    setShowDeductionForm(false);
  };

  const moveDeduction = (id: string, direction: 'up' | 'down') => {
    const idx = (customDeductions || []).findIndex(d => d.id === id);
    if (idx < 0) return;
    const newDeductions = [...(customDeductions || [])];
    if (direction === 'up' && idx > 0) {
      [newDeductions[idx], newDeductions[idx - 1]] = [newDeductions[idx - 1], newDeductions[idx]];
    } else if (direction === 'down' && idx < newDeductions.length - 1) {
      [newDeductions[idx], newDeductions[idx + 1]] = [newDeductions[idx + 1], newDeductions[idx]];
    }
    newDeductions.forEach((d, i) => updateCustomDeduction(d.id, { sortOrder: i }));
  };

  const renderSkuRow = (sku: SkuItem, showProduct = true) => {
    const skuKey = sku.skuId ? `${sku.productId}_${sku.skuId}` : sku.productId;
    const isSelected = selectedItems.has(skuKey);
    const isPriceExpanded = expandedPrices.has(skuKey);
    const priceDist = getPriceDistribution(sku.prices);
    const hasMultiplePrices = sku.prices.length > 1 && new Set(sku.prices.map(p => Math.round(p * 100) / 100)).size > 1;
    const costInfo = calculateTotalCost(sku);
    const isMissingCode = !sku.hasProductCode && !sku.hasSkuCode;
    // ★ F7: 计算该SKU的订单与多SKU订单的重叠数
    const multiSkuOverlap = [...(sku.uniqueOrderNos || [])].filter(no => multiSkuOrderNos.has(no)).length;

    return (
      <div key={skuKey} className={`p-4 border-b border-pdd-border last:border-0 transition-colors ${isSelected ? 'bg-pdd-danger/10' : 'hover:bg-pdd-bg/80'}`}>
        <div className="flex items-start gap-3">
          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(skuKey)}
            className="w-4 h-4 mt-1 rounded border-pdd-border text-pdd-danger focus:ring-red-500 cursor-pointer" />
          <div className="flex-1 min-w-0">
            {showProduct && <p className="text-sm font-semibold text-pdd-text truncate mb-0.5">{sku.productName || sku.productId}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {sku.skuName && <span className="text-xs text-pdd-text-secondary">规格: {sku.skuName}</span>}
              {sku.skuId && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-1.5 py-0.5 rounded font-mono">ID: {sku.skuId}</span>}
              {isMissingCode && <span className="text-[10px] text-pdd-danger bg-pdd-danger/10 px-1.5 py-0.5 rounded font-mono flex items-center gap-1"><AlertCircle size={10} />缺编码</span>}
              {sku.skuCode && <span className="text-[10px] text-pdd-success bg-pdd-success/10 px-1.5 py-0.5 rounded font-mono">规格码: {sku.skuCode}</span>}
              {sku.productCode && !sku.skuCode && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-1.5 py-0.5 rounded font-mono">商品码: {sku.productCode}</span>}
            </div>
          </div>
        </div>

        <div className="mt-3 ml-7 grid grid-cols-12 gap-3 items-center">
          <div className="col-span-3 flex items-center gap-1.5">
            <span className="text-[10px] text-pdd-text-secondary uppercase tracking-wide">实收价</span>
            <span className="text-sm font-mono font-medium text-pdd-text">
              {formatPriceRange(Math.min(...sku.prices.filter(p => p > 0)), Math.max(...sku.prices))}
            </span>
            {hasMultiplePrices && (
              <button onClick={() => togglePriceExpand(skuKey)} className="p-0.5 hover:bg-pdd-bg rounded transition-colors">
                {isPriceExpanded ? <EyeOff size={12} className="text-pdd-text-secondary" /> : <Eye size={12} className="text-pdd-danger" />}
              </button>
            )}
          </div>
          <div className="col-span-3 flex items-center gap-1.5">
            <span className="text-[10px] text-pdd-text-secondary uppercase tracking-wide">销量</span>
            <span className="text-sm font-mono text-pdd-text">{sku.orderCount}单 / {sku.itemCount}件</span>
          </div>
          <div className="col-span-6 flex items-center gap-2 justify-end">
            <div className="relative">
              <input type="number" placeholder="输入裸货成本"
                className="w-32 pl-2 pr-6 py-1.5 border border-pdd-border rounded-lg text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none transition-all bg-pdd-card"
                value={productCosts[skuKey] != null ? productCosts[skuKey] : ''}
                onChange={e => { const v = parseFloat(e.target.value); handleCostChange(skuKey, isNaN(v) ? 0 : v); }} />
              {productCosts[skuKey] && <div className="absolute right-2 top-1/2 -translate-y-1/2"><Check size={14} className="text-pdd-success" /></div>}
            </div>
            <span className="text-[10px] text-pdd-text-secondary">元/件</span>
          </div>
        </div>

        {costInfo && (
          <div className="mt-3 ml-7 p-3 bg-pdd-card rounded-lg border border-pdd-border">
            <p className="text-xs font-semibold text-pdd-text mb-2">成本拆解</p>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between py-0.5">
                <span className="text-pdd-text-secondary">裸货成本{costInfo.isEstimated ? '(估)' : ''}</span>
                <span className="font-mono text-pdd-text">
                  ¥{costInfo.rawCost.toFixed(2)} × {sku.itemCount}件 = <b>¥{costInfo.totalRawCost.toFixed(2)}</b>
                </span>
              </div>
              {packagingFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">包装费{multiSkuOverlap > 0 ? <span className="text-[10px] text-pdd-warning ml-1">⚠{multiSkuOverlap}单多SKU可能重复</span> : ''}</span>
                  <span className="font-mono text-pdd-text">
                    ¥{packagingFeePerOrder.toFixed(2)} × {sku.orderCount}单 = <b>¥{costInfo.totalPackaging.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {laborFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">人工费{multiSkuOverlap > 0 ? <span className="text-[10px] text-pdd-warning ml-1">⚠{multiSkuOverlap}单多SKU可能重复</span> : ''}</span>
                  <span className="font-mono text-pdd-text">
                    ¥{laborFeePerOrder.toFixed(2)} × {sku.orderCount}单 = <b>¥{costInfo.totalLabor.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {shippingFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">快递费{multiSkuOverlap > 0 ? <span className="text-[10px] text-pdd-warning ml-1">⚠{multiSkuOverlap}单多SKU可能重复</span> : ''}</span>
                  <span className="font-mono text-pdd-text">
                    {sku.actualShippingCost > 0 ? (
                      <span>实际邮费 <b>¥{costInfo.totalShipping.toFixed(2)}</b> ({costInfo.shippingOrderCount}单有快递)</span>
                    ) : (
                      <span>¥{shippingFeePerOrder.toFixed(2)} × {costInfo.shippingOrderCount}单 = <b>¥{costInfo.totalShipping.toFixed(2)}</b></span>
                    )}
                  </span>
                </div>
              )}
              {costInfo.shippingOrderCount < sku.orderCount && (
                <div className="text-[10px] text-pdd-text-secondary ml-2">&middot; {sku.orderCount}单中{costInfo.shippingOrderCount}单产生快递费（有快递单号），{sku.orderCount - costInfo.shippingOrderCount}单未发货不计</div>
              )}
              {insuranceFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">运费险{costInfo.actualOrderCount > 0 ? ' (含实际)' : ''}</span>
                  <span className="font-mono text-pdd-text">
                    ¥{insuranceFeePerOrder.toFixed(2)} × {costInfo.insuredOrderCount}单 = <b>¥{costInfo.totalInsurance.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {insuranceFeePerOrder > 0 && costInfo.insuredOrderCount < sku.orderCount && (
                <div className="text-[10px] text-pdd-text-secondary ml-2">&middot; {sku.orderCount}单中{costInfo.insuredOrderCount}单购买了运费险</div>
              )}
              {promotionFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">推广费</span>
                  <span className="font-mono text-pdd-text">
                    ¥{promotionFeePerOrder.toFixed(2)} × {sku.orderCount}单 = <b>¥{costInfo.totalPromotionFee.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {platformCommissionRate > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">平台扣点{costInfo.actualOrderCount > 0 ? ' (含实际)' : ''}</span>
                  <span className="font-mono text-pdd-text">
                    实收×{platformCommissionRate}% = <b>¥{costInfo.totalPlatformCommission.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {costInfo.totalSubTechFee > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">百亿补贴扣点 (实际)</span>
                  <span className="font-mono text-pdd-danger font-medium">¥{costInfo.totalSubTechFee.toFixed(2)}</span>
                </div>
              )}
              {costInfo.totalPenalties > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">
                    罚款/扣款
                    {costInfo.confirmedPenaltyCount > 0 && costInfo.estimatedPenaltyCount > 0
                      ? ` (${costInfo.confirmedPenaltyCount}确认 + ${costInfo.estimatedPenaltyCount}预估)`
                      : costInfo.confirmedPenaltyCount > 0 ? ' (已确认)' : ' (预估)'}
                  </span>
                  <span className="font-mono font-medium" style={{
                    color: costInfo.estimatedPenaltyCount > 0 && costInfo.confirmedPenaltyCount === 0
                      ? 'var(--pdd-warning)' : 'var(--pdd-danger)'
                  }}>¥{costInfo.totalPenalties.toFixed(2)}</span>
                </div>
              )}
              {costInfo.estimatedPenaltyCount > 0 && (
                <div className="text-[10px] text-pdd-warning ml-2">&middot; {costInfo.estimatedPenaltyCount} 单超时发货扣款为公式估算（未匹配到财务扣款记录）</div>
              )}
              {costInfo.totalMarketingFees > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">营销费用 (实际)</span>
                  <span className="font-mono text-pdd-danger font-medium">¥{costInfo.totalMarketingFees.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-pdd-border my-1.5" />
              <div className="flex items-center justify-between py-0.5">
                <span className="text-xs font-medium text-pdd-text-secondary">基础成本合计</span>
                <span className="font-bold text-pdd-text">¥{costInfo.subtotal.toFixed(2)}</span>
              </div>
              {costInfo.deductionDetails.length > 0 && (
                <>
                  <p className="text-[11px] text-pdd-text-secondary mt-1 mb-0.5">自定义扣费:</p>
                  {costInfo.deductionDetails.map((ded, di) => (
                    <div key={di} className="flex items-center justify-between py-0.5 ml-2">
                      <span className="text-pdd-text-secondary">&middot; {ded.name}</span>
                      <span className="font-mono text-pdd-text">{ded.formula} = <b>¥{ded.amount.toFixed(2)}</b></span>
                    </div>
                  ))}
                  <div className="border-t border-pdd-border my-1.5" />
                </>
              )}
              <div className="flex items-center justify-between py-0.5">
                <span className="text-xs font-semibold text-pdd-danger">总成本</span>
                <span className="font-bold text-pdd-danger">¥{costInfo.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {isPriceExpanded && hasMultiplePrices && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 ml-7 p-3 bg-pdd-bg rounded-lg border border-pdd-border">
            <p className="text-xs font-semibold text-pdd-text mb-2">价格分布 (共{sku.prices.length}单)</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {priceDist.map(([price, count]) => (
                <div key={price} className="flex items-center justify-between bg-pdd-card px-2.5 py-1.5 rounded-lg border border-pdd-border text-xs">
                  <span className="font-mono font-medium text-pdd-text">¥{price.toFixed(2)}</span>
                  <span className="text-pdd-text-secondary">{count}单 ({((count / sku.prices.length) * 100).toFixed(0)}%)</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    );
  };

  const fmt = (v: number) => v >= 10000 ? `¥${(v / 10000).toFixed(1)}万` : `¥${v.toFixed(0)}`;

  // ========== Tab: 成本概览 ==========
  const renderOverview = () => {
    // F8: 待办清单 — 计算有多少待处理事项
    const todoItems: { label: string; severity: 'danger' | 'warning' | 'info'; action: () => void }[] = [];
    if (overviewStats.skusWithoutCost > 0) {
      todoItems.push({
        label: `${overviewStats.skusWithoutCost} 个 SKU 未填写裸货成本，影响成本核算精度`,
        severity: 'danger',
        action: () => setActiveTab('costs'),
      });
    }
    if (overviewStats.productsWithoutCode > 0) {
      todoItems.push({
        label: `${overviewStats.productsWithoutCode} 个商品缺商家编码，无法与财务记录精确匹配`,
        severity: 'warning',
        action: () => setActiveTab('costs'),
      });
    }
    if (displayOverview.lossOrderCount > 0) {
      todoItems.push({
        label: `${displayOverview.lossOrderCount} 笔订单亏损（实收 < 成本），建议核查`,
        severity: 'danger',
        action: () => setActiveTab('alerts'),
      });
    }
    const hasNoFeeSettings = !packagingFeePerOrder && !(shippingFeePerOrder || 0) && !(laborFeePerOrder || 0) && !(insuranceFeePerOrder || 0) && !(promotionFeePerOrder || 0) && !platformCommissionRate;
    if (hasNoFeeSettings && orders.length > 0) {
      todoItems.push({
        label: '未设置任何费用参数（包装/快递/人工等），成本计算结果不完整',
        severity: 'warning',
        action: () => setShowQuickSettings(true),
      });
    }

    return (
    <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* F8: 待办清单 */}
      {todoItems.length > 0 && (
        <div className="space-y-1.5">
          {todoItems.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                item.severity === 'danger' ? 'bg-red-50 border-red-200' :
                item.severity === 'warning' ? 'bg-amber-50 border-amber-200' :
                'bg-blue-50 border-blue-200'
              }`}
              onClick={item.action}>
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                item.severity === 'danger' ? 'bg-red-500' :
                item.severity === 'warning' ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              <span className={`text-xs ${
                item.severity === 'danger' ? 'text-red-700' :
                item.severity === 'warning' ? 'text-amber-700' : 'text-blue-700'
              }`}>{item.label}</span>
              <span className="text-xs ml-auto opacity-60 hover:opacity-100">→</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ★ F13: 配置状态条（当前费用一目了然） */}
      <div className="flex items-center gap-2 px-3.5 py-2 bg-pdd-card border border-pdd-border rounded-lg text-[11px] text-pdd-text-secondary flex-wrap">
        <span className="font-medium text-pdd-text">当前配置：</span>
        {packagingFeePerOrder > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">包装¥{packagingFeePerOrder.toFixed(1)}</span>}
        {(laborFeePerOrder || 0) > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">人工¥{(laborFeePerOrder || 0).toFixed(1)}</span>}
        {(shippingFeePerOrder || 0) > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">快递¥{(shippingFeePerOrder || 0).toFixed(1)}</span>}
        {(insuranceFeePerOrder || 0) > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">运费险¥{(insuranceFeePerOrder || 0).toFixed(1)}</span>}
        {(promotionFeePerOrder || 0) > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">推广¥{(promotionFeePerOrder || 0).toFixed(1)}</span>}
        {defaultCostRatio > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">成本比{defaultCostRatio}%</span>}
        {platformCommissionRate > 0 && <span className="bg-pdd-bg px-2 py-0.5 rounded">扣点{platformCommissionRate}%</span>}
        <button onClick={() => setShowQuickSettings(true)} className="ml-auto text-pdd-primary-light hover:underline flex items-center gap-0.5">
          <Settings size={12} />修改
        </button>
      </div>

      {/* ★ F5: 收入/利润/成本仪表盘 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '总收入', value: fmt(displayOverview.totalRevenue), sub: `${displayOverview.totalSkus} SKU`, icon: TrendingUp, color: 'text-green-600'
          },
          { label: '总成本（实际）', value: fmt(displayOverview.totalEstimatedCost), sub: `含罚款¥${(displayOverview.penalties || 0).toFixed(0)}·营销¥${(displayOverview.marketingFees || 0).toFixed(0)}`, icon: DollarSign, color: 'text-red-500'
          },
          { label: '估算利润', value: fmt(displayOverview.profit), sub: `${displayOverview.profitMargin >= 0 ? '+' : ''}${displayOverview.profitMargin.toFixed(1)}% 利润率`, icon: TrendingUp,
            color: displayOverview.profit >= 0 ? 'text-green-600' : 'text-red-600'
          },
          { label: '亏损订单', value: displayOverview.lossOrderCount, sub: displayOverview.lossOrderCount > 0 ? '建议查看' : '无', icon: AlertTriangle,
            color: displayOverview.lossOrderCount > 0 ? 'text-red-500' : 'text-gray-400'
          },
        ].map((item, i) => {
          // ★ F10: 趋势箭头
          let trendEl: React.ReactNode = null;
          if (displayTrend && (item.label === '总收入' || item.label === '总成本（实际）' || item.label === '估算利润')) {
            const pct = item.label === '总收入' ? displayTrend.revenueChange
              : item.label === '总成本（实际）' ? displayTrend.costChange
              : displayTrend.profitChange;
            const isUp = pct > 0;
            const isBad = item.label === '总成本（实际）' ? isUp : !isUp;
            trendEl = (
              <span className={`inline-flex items-center gap-0.5 text-[10px] ml-1 ${isUp ? 'text-red-500' : 'text-green-500'}`}>
                {isUp ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                {Math.abs(pct).toFixed(1)}%
              </span>
            );
          }
          return (
            <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="pdd-card px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-pdd-gray-100">
                <item.icon size={18} className={item.color} />
              </div>
              <div>
                <div className="text-[11px] font-medium text-pdd-text-secondary/80">{item.label}{trendEl}</div>
                <div className={`text-xl font-semibold tracking-tight ${item.color}`}>{item.value}</div>
                <div className="text-[10px] text-pdd-text-secondary">{item.sub}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ★ F12: 净利润（扣除退款损失）— 优先服务端数据 */}
      {(serverCostSummary?.totalRefundAmount ?? totalRefundAmount) > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="pdd-card px-4 py-3 flex items-center gap-3 border-2 border-green-100">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-green-50">
              <TrendingUp size={18} className="text-green-600" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-pdd-text-secondary/80">净利润（扣除退款）</div>
              <div className={`text-xl font-semibold tracking-tight ${(displayOverview.profit - (serverCostSummary?.totalRefundAmount ?? totalRefundAmount)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {fmt(displayOverview.profit - (serverCostSummary?.totalRefundAmount ?? totalRefundAmount))}
              </div>
              <div className="text-[10px] text-pdd-text-secondary">
                利润¥{displayOverview.profit.toFixed(0)} - 退款¥{(serverCostSummary?.totalRefundAmount ?? totalRefundAmount).toFixed(0)}
                {displayOverview.profit > 0 && (serverCostSummary?.totalRefundAmount ?? totalRefundAmount) / displayOverview.profit > 0.1 && (
                  <span className="text-red-500 ml-1">⚠退款侵蚀{((serverCostSummary?.totalRefundAmount ?? totalRefundAmount) / displayOverview.profit * 100).toFixed(0)}%利润</span>
                )}
              </div>
            </div>
          </div>
          {/* ★ F11: 多SKU重复扣费预警 — 优先服务端数据 */}
          {(serverCostSummary?.duplicateFees ?? totalDuplicateFees) > 0 && (
            <div className="pdd-card px-4 py-3 flex items-center gap-3 border-2 border-amber-100">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-amber-50">
                <AlertTriangle size={18} className="text-amber-600" />
              </div>
              <div>
                <div className="text-[11px] font-medium text-pdd-text-secondary/80">多SKU订单重复扣费</div>
                <div className="text-xl font-semibold tracking-tight text-amber-600">¥{(serverCostSummary?.duplicateFees ?? totalDuplicateFees).toFixed(0)}</div>
                <div className="text-[10px] text-pdd-text-secondary">
                  因多SKU合并按单计费可能多扣
                  <button onClick={() => setActiveTab('alerts')} className="text-pdd-primary-light hover:underline ml-1">查看详情→</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 成本构成占比（简版饼图） */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '商品总数', value: overviewStats.totalProducts, sub: `${overviewStats.productsWithCode} 个有编码`, icon: Package },
          { label: '成本覆盖率', value: `${overviewStats.costCoverage.toFixed(0)}%`, sub: `${overviewStats.skusWithCost}/${overviewStats.totalSkus} SKU`, icon: Percent },
          { label: '平均单品成本', value: overviewStats.avgUnitCost > 0 ? `¥${overviewStats.avgUnitCost.toFixed(2)}` : '--', sub: '已填成本SKU均值', icon: TrendingUp },
          { label: '成本占收入比', value: displayOverview.totalRevenue > 0 ? `${(displayOverview.totalEstimatedCost / displayOverview.totalRevenue * 100).toFixed(0)}%` : '--', sub: `收入 ¥${displayOverview.totalRevenue.toFixed(0)}`, icon: Percent },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
            className="pdd-card px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-pdd-gray-100">
              <item.icon size={18} className="text-pdd-text-secondary" />
            </div>
            <div>
              <div className="text-[11px] font-medium text-pdd-text-secondary/80">{item.label}</div>
              <div className="text-xl font-semibold text-pdd-text tracking-tight">{item.value}</div>
              <div className="text-[10px] text-pdd-text-secondary">{item.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '管理商品成本', desc: '查看/编辑SKU裸货成本，批量导入', icon: Package, tab: 'costs' },
          { label: '快递配置', desc: '设置快递公司单价，分析运费效益', icon: Truck, tab: 'shipping' },
          { label: '自定义扣费', desc: '公式引擎，灵活定义扣费规则', icon: CalcIcon, tab: 'deductions' },
          { label: '成本预警', desc: '异常订单检测与处理', icon: AlertTriangle, tab: 'alerts' },
        ].map((card, i) => (
          <motion.div key={card.tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            onClick={() => setActiveTab(card.tab)}
            className="pdd-card p-4 cursor-pointer hover:border-pdd-primary-light transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={16} className="text-pdd-text-secondary" />
              <span className="text-sm font-semibold text-pdd-text">{card.label}</span>
            </div>
            <p className="text-xs text-pdd-text-secondary">{card.desc}</p>
            <div className="mt-2 text-xs text-pdd-primary-light group-hover:underline">进入 →</div>
          </motion.div>
        ))}
      </div>

      {(costHistory || []).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pdd-card p-3">
          <h4 className="text-xs font-bold text-gray-700 flex items-center gap-1.5 mb-2"><History size={14} className="text-pdd-text-secondary" />最近修改</h4>
          <div className="space-y-1">
            {(costHistory || []).slice(0, 5).map((record, idx) => (
              <div key={idx} className="flex items-center gap-3 py-1.5 border-b border-pdd-border last:border-0 text-xs">
                <span className="text-pdd-text-secondary w-32 shrink-0">{new Date(record.updatedAt).toLocaleString().slice(0, -3)}</span>
                <span className="flex-1 truncate">{record.productName}</span>
                <span className="text-pdd-text-secondary">¥{record.oldValue.toFixed(2)} →</span>
                <span className="text-pdd-danger font-medium">¥{record.newValue.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

// ========== Tab: 商品成本（合并 missing + costs）==========
  const renderCosts = () => (
    <motion.div key="costs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {productGroups.length === 0 ? (
        <div className="text-pdd-text-secondary text-center py-12">暂无商品数据，请先导入订单</div>
      ) : (
        <>
          <div className="pdd-card">
            {/* Toolbar: filter + search + actions */}
            <div className="flex items-center justify-between mb-3 pb-3 border-b border-pdd-border flex-wrap gap-2">
              <div className="flex items-center gap-1 bg-pdd-bg rounded-lg p-0.5">
                {[
                  { key: 'all', label: '全部' },
                  { key: 'missing', label: '缺编码' },
                  { key: 'filled', label: '已填成本' },
                  { key: 'unfilled', label: '未填成本' },
                ].map(f => (
                  <button key={f.key} onClick={() => { setCostFilter(f.key as any); setSelectedItems(new Set()); }}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                      costFilter === f.key ? 'bg-pdd-card text-pdd-primary shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'
                    }`}>
                    {f.label}
                    {f.key === 'missing' && missingCodeProducts.length > 0 && (
                      <span className="ml-1 px-1 py-0.5 rounded bg-pdd-danger/10 text-pdd-danger text-[10px]">{missingCodeProducts.length}</span>
                    )}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-1 mx-3">
                <Search size={14} className="text-pdd-text-secondary shrink-0" />
                <input type="text" placeholder="搜索商品/SKU/编码..." className="flex-1 text-sm outline-none bg-transparent min-w-[120px]"
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger shrink-0">清除</button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={exportSkuTemplate}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-pdd-border rounded-lg text-xs hover:bg-pdd-bg transition-colors">
                  <Download size={13} /> 模板
                </button>
                <label className="flex items-center gap-1 px-2.5 py-1.5 border border-red-200 bg-pdd-danger/10 rounded-lg text-xs text-pdd-danger hover:bg-pdd-danger/20 cursor-pointer transition-colors">
                  <Upload size={13} /> 导入
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImportCosts} />
                </label>
                <button onClick={() => setShowMissingFilters(!showMissingFilters)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 border rounded-lg text-xs transition-all ${showMissingFilters ? 'bg-pdd-danger/10 border-red-200 text-pdd-danger' : 'border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg'}`}>
                  <Settings size={13} /> 筛选
                </button>
                <button onClick={toggleSelectAll} className="text-xs text-pdd-danger hover:underline font-medium">
                  {selectedItems.size > 0 ? '取消全选' : '全选'}
                </button>
                {selectedItems.size > 0 && (
                  <button onClick={clearSelection} className="text-xs text-pdd-text-secondary hover:underline">清除</button>
                )}
              </div>
            </div>

            {importStatus && (
              <div className={`mb-3 text-xs font-medium px-3 py-2 rounded-lg ${importStatus.type === 'success' ? 'bg-pdd-success/10 text-pdd-success' : 'bg-pdd-danger/10 text-pdd-danger'}`}>
                {importStatus.msg}
              </div>
            )}

            {/* Filter panel */}
            <AnimatePresence>
              {showMissingFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 p-4 bg-pdd-bg rounded-lg border border-pdd-border">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="text-xs text-pdd-text-secondary mb-1 block">搜索商品</label>
                      <input type="text" placeholder="名称/ID/规格..." className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                        value={missingSearchQuery} onChange={e => setMissingSearchQuery(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary mb-1 block">价格区间</label>
                      <div className="flex items-center gap-1">
                        <input type="number" placeholder="最小" className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm outline-none"
                          value={missingPriceMin} onChange={e => setMissingPriceMin(e.target.value)} />
                        <span className="text-pdd-text-secondary">-</span>
                        <input type="number" placeholder="最大" className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm outline-none"
                          value={missingPriceMax} onChange={e => setMissingPriceMax(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary mb-1 block">订单数量</label>
                      <div className="flex items-center gap-1">
                        <input type="number" placeholder="最小" className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm outline-none"
                          value={missingOrderMin} onChange={e => setMissingOrderMin(e.target.value)} />
                        <span className="text-pdd-text-secondary">-</span>
                        <input type="number" placeholder="最大" className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm outline-none"
                          value={missingOrderMax} onChange={e => setMissingOrderMax(e.target.value)} />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary mb-1 block">排序</label>
                      <div className="flex items-center gap-1">
                        <select className="px-2 py-1.5 border border-pdd-border rounded text-sm outline-none"
                          value={missingSortBy} onChange={e => setMissingSortBy(e.target.value as any)}>
                          <option value="orders">订单数</option>
                          <option value="items">件数</option>
                          <option value="price">价格</option>
                        </select>
                        <button onClick={() => setMissingSortOrder(missingSortOrder === 'asc' ? 'desc' : 'asc')}
                          className="p-1.5 border border-pdd-border rounded hover:bg-pdd-bg">
                          {missingSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button onClick={() => {
                      setMissingSearchQuery(''); setMissingPriceMin(''); setMissingPriceMax('');
                      setMissingOrderMin(''); setMissingOrderMax('');
                      setMissingSortBy('orders'); setMissingSortOrder('desc');
                    }} className="text-xs text-pdd-text-secondary hover:text-pdd-danger flex items-center gap-1">
                      <X size={12} /> 清除筛选
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Batch cost bar — 增强版 */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-pdd-bg rounded-lg flex-wrap">
                <span className="text-sm font-bold text-pdd-text">已选 {selectedItems.size} 项</span>
                <input type="number" placeholder="统一成本(元/件)" className="w-36 px-2 py-1.5 border border-pdd-border rounded-lg text-sm"
                  value={batchCost} onChange={e => setBatchCost(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') applyBatchCost(); }} />
                <button onClick={applyBatchCost} className="px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-sm font-medium hover:opacity-90">
                  统一设置
                </button>
                <span className="text-pdd-text-secondary text-xs">或</span>
                <span className="text-xs text-pdd-text-secondary">按售价</span>
                <input type="number" value={costRatio} onChange={e => setCostRatio(e.target.value)}
                  className="w-14 px-1.5 py-1 border border-pdd-border rounded text-xs text-center" min="1" max="99" />%
                <button onClick={() => {
                  const ratio = parseFloat(costRatio) / 100;
                  let total = 0; let cnt = 0;
                  productGroups.forEach(g => g.skus.forEach(s => {
                    const key = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                    if (selectedItems.has(key) && s.prices?.length) {
                      total += s.prices.reduce((a: number,b: number) => a+b, 0) / s.prices.length;
                      cnt++;
                    }
                  }));
                  if (cnt > 0) setBatchCost((total/cnt*ratio).toFixed(1));
                }} className="px-2 py-1 text-xs border border-pdd-border rounded text-pdd-text-secondary hover:text-pdd-primary">
                  估算成本
                </button>
              </div>
            )}
            {/* ★ F6: 批量操作确认弹窗 */}
            {batchConfirm && (
              <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-3">
                <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800">确认批量操作</p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    即将为 <b>{batchConfirm.count}</b> 个 SKU 设置成本为 <b>¥{batchConfirm.cost.toFixed(2)}</b>/件。
                    {batchConfirm.count > 0 && (
                      <span className="block mt-0.5">覆盖前旧值：共 {selectedItems.size} 项将被新值取代，此操作不可撤销。</span>
                    )}
                  </p>
                </div>
                <button onClick={executeBatchCost}
                  className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 transition-colors">
                  确认执行
                </button>
                <button onClick={() => setBatchConfirm(null)}
                  className="px-3 py-1.5 border border-amber-300 rounded-lg text-xs text-amber-700 hover:bg-amber-100 transition-colors">
                  取消
                </button>
              </div>
            )}
            {/* 全选快捷操作（始终显示） */}
            <div className="flex items-center gap-2 mb-3 text-xs text-pdd-text-secondary">
              <button onClick={() => {
                const allKeys = displayGroups.flatMap(g => g.skus.map(s => s.skuId ? `${s.productId}_${s.skuId}` : s.productId));
                if (selectedItems.size === allKeys.length) setSelectedItems(new Set());
                else setSelectedItems(new Set(allKeys));
              }} className="hover:text-pdd-primary transition-colors">
                {selectedItems.size > 0 ? '取消全选' : '全选所有SKU'}
              </button>
              <span>|</span>
              <button onClick={() => {
                // 只选没有填成本的SKU
                const missing = displayGroups.flatMap(g => g.skus.filter(s => {
                  const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                  return !productCosts[k];
                }).map(s => s.skuId ? `${s.productId}_${s.skuId}` : s.productId));
                setSelectedItems(new Set(missing));
              }} className="hover:text-pdd-primary transition-colors">
                仅选未填成本 ({displayGroups.flatMap(g => g.skus.filter(s => {
                  const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                  return !productCosts[k];
                })).length}个)
              </button>
              <span>|</span>
              <button onClick={() => {
                const csv = '﻿商品ID,SKU_ID,商品名称,规格,当前成本(元/件)\n' + displayGroups.flatMap(g => g.skus.map(s => {
                  const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                  return [s.productId, s.skuId||'', `"${(s.productName||'').replace(/"/g,'""')}"`, `"${(s.skuName||'').replace(/"/g,'""')}"`, productCosts[k]||''].join(',');
                })).join('\n');
                const blob = new Blob([csv], {type:'text/csv;charset=utf-8;'});
                const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
                a.download = `SKU成本_${new Date().toISOString().slice(0,10)}.csv`; a.click();
              }} className="hover:text-pdd-primary transition-colors">
                导出CSV
              </button>
            </div>

            {/* 异常订单剔除提醒 */}
            {(excludedOrderCount > 0 || adjustedOrderCount > 0) && (
              <div className="mb-3 p-2.5 bg-pdd-warning/5 border border-pdd-warning/20 rounded-lg text-xs flex items-center gap-2">
                <AlertTriangle size={14} className="text-pdd-warning shrink-0" />
                <span className="text-pdd-text-secondary">
                  成本核算已剔除 <b className="text-pdd-danger">{excludedOrderCount}</b> 条异常订单
                  {adjustedOrderCount > 0 && <span>，<b className="text-pdd-primary">{adjustedOrderCount}</b> 条按调整值计算</span>}
                  。<button onClick={() => { setActiveTab('alerts'); setAlertProcessedFilter('processed'); }} className="text-pdd-primary-light hover:underline ml-1">查看详情 →</button>
                </span>
              </div>
            )}

            {/* Product list */}
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {displayGroups.map(group => {
                const isExpanded = expandedProducts.has(group.productId);
                const hasMultipleSku = group.skus.length > 1 || (group.skus.length === 1 && group.skus[0].skuId);
                const firstSku = group.skus[0];
                const skuKey = firstSku.skuId ? `${firstSku.productId}_${firstSku.skuId}` : firstSku.productId;
                const hasMultiplePrices = firstSku.prices.length > 1 && new Set(firstSku.prices.map(p => Math.round(p * 100) / 100)).size > 1;
                const isMissingCode = group.skus.some(s => !s.hasProductCode && !s.hasSkuCode);
                const allSkusHaveCost = group.skus.every(s => {
                  const k = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                  return (productCosts[k] || 0) > 0;
                });

                return (
                  <div key={group.productId} className="border border-pdd-border rounded-lg overflow-hidden">
                    <div className={`flex items-center gap-3 px-3 py-2.5 ${!hasMultipleSku ? '' : ''}`}>
                      <input type="checkbox"
                        checked={hasMultipleSku
                          ? group.skus.every(s => selectedItems.has(s.skuId ? `${s.productId}_${s.skuId}` : s.productId))
                          : selectedItems.has(skuKey)
                        }
                        onChange={(e) => {
                          e.stopPropagation();
                          const newSet = new Set(selectedItems);
                          if (hasMultipleSku) {
                            group.skus.forEach(s => {
                              const key = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                              if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                            });
                          } else {
                            if (newSet.has(skuKey)) newSet.delete(skuKey); else newSet.add(skuKey);
                          }
                          setSelectedItems(newSet);
                        }}
                        className="w-4 h-4 rounded border-pdd-border cursor-pointer" />
                      <Package size={16} className={isMissingCode ? 'text-pdd-danger shrink-0' : 'text-pdd-text-secondary shrink-0'} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate text-pdd-text">{group.productName}</p>
                          {isMissingCode && <span className="text-[10px] text-pdd-danger bg-pdd-danger/10 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5"><AlertCircle size={10} />缺编码</span>}
                          {allSkusHaveCost && group.skus.length > 1 && <span className="text-[10px] text-pdd-success bg-pdd-success/10 px-1.5 py-0.5 rounded shrink-0"><Check size={10} />已填</span>}
                        </div>
                        <p className="text-xs text-pdd-text-secondary">
                          商品ID: {group.productId}{hasMultipleSku ? ` · ${group.skus.length}个SKU` : ''} · {group.totalOrders}单/{group.totalItems}件
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {firstSku.skuCode && <span className="text-[10px] text-pdd-success bg-pdd-success/10 px-2 py-0.5 rounded font-mono">{firstSku.skuCode}</span>}
                        {firstSku.productCode && !firstSku.skuCode && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-2 py-0.5 rounded font-mono">{firstSku.productCode}</span>}
                        <span className="text-sm text-pdd-text shrink-0">{formatPriceRange(group.minPrice, group.maxPrice)}</span>
                        {!hasMultipleSku && hasMultiplePrices && (
                          <button onClick={(e) => { e.stopPropagation(); togglePriceExpand(skuKey); }} className="p-0.5 hover:bg-pdd-bg rounded">
                            {expandedPrices.has(skuKey) ? <EyeOff size={14} className="text-pdd-text-secondary" /> : <Eye size={14} className="text-pdd-danger" />}
                          </button>
                        )}
                      </div>
                      {!hasMultipleSku && (
                        <>
                          <input type="number" placeholder="裸货成本" className="w-28 px-2 py-1.5 border border-pdd-border rounded-lg text-sm shrink-0"
                            value={productCosts[skuKey] != null ? productCosts[skuKey] : ''}
                            onChange={e => { const v = parseFloat(e.target.value); handleCostChange(skuKey, isNaN(v) ? 0 : v); }}
                            onClick={e => e.stopPropagation()} />
                          {productCosts[skuKey] && <Check size={14} className="text-pdd-success shrink-0" />}
                        </>
                      )}
                    </div>
                    {/* 多SKU → 规格压缩编辑器 */}
                    {hasMultipleSku && (
                      <div className="border-t border-pdd-border">
                        <SpecGroupCostEditor
                          productId={group.productId}
                          productName={group.productName}
                          skus={group.skus.map(s => ({
                            skuKey: s.skuId ? `${s.productId}_${s.skuId}` : s.productId,
                            skuName: s.skuName,
                            skuCode: s.skuCode || s.productCode || '',
                            prices: s.prices,
                            orderCount: s.orderCount,
                            itemCount: s.itemCount,
                            uniqueOrderNos: s.uniqueOrderNos,
                          }))}
                          productCosts={productCosts}
                          setProductCost={handleCostChange}
                          isMissingCode={isMissingCode}
                          allSkusHaveCost={allSkusHaveCost}
                        />
                      </div>
                    )}
                    {/* 单SKU价格分布 */}
                    {!hasMultipleSku && expandedPrices.has(skuKey) && hasMultiplePrices && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="border-t border-pdd-border p-3 bg-pdd-bg">
                        <p className="text-xs font-medium mb-2">价格分布 (共{firstSku.prices.length}单):</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {getPriceDistribution(firstSku.prices).map(([price, count]) => (
                            <div key={price} className="flex items-center justify-between bg-pdd-card p-1.5 rounded">
                              <span className="font-medium">¥{price.toFixed(2)}</span>
                              <span className="text-pdd-text-secondary">{count}单</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
              {displayGroups.length === 0 && (
                <div className="text-center py-8 text-pdd-text-secondary text-sm">
                  {costFilter === 'missing' ? '没有缺编码的商品' : costFilter === 'filled' ? '没有已填成本的商品' : costFilter === 'unfilled' ? '所有商品都已填写成本' : '没有匹配的商品'}
                </div>
              )}
            </div>
          </div>

          {/* Cost history */}
          {(costHistory || []).length > 0 && (
            <div className="pdd-card">
              <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setShowCostHistory(!showCostHistory)}>
                <History size={16} className="text-pdd-text-secondary" />
                <h3 className="font-medium text-sm">最近修改记录</h3>
                {showCostHistory ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                <span className="text-xs text-pdd-text-secondary">({(costHistory || []).length}条)</span>
              </div>
              {showCostHistory && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-2 max-h-64 overflow-y-auto">
                  {(costHistory || []).slice(0, 20).map((record, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-pdd-border last:border-0 text-sm">
                      <span className="text-xs text-pdd-text-secondary w-32">{new Date(record.updatedAt).toLocaleString()}</span>
                      <span className="flex-1 truncate">{record.productName}</span>
                      <span className="text-xs text-pdd-text-secondary w-16">{record.field}</span>
                      <span className="text-pdd-text-secondary">¥{record.oldValue.toFixed(2)}</span>
                      <span className="text-pdd-text-secondary">→</span>
                      <span className="text-pdd-danger font-medium">¥{record.newValue.toFixed(2)}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </>
      )}
    </motion.div>
  );

  // ========== Tab: 快递配置（新增）==========
  const [newCourierName, setNewCourierName] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [shippingSearch, setShippingSearch] = useState('');

  const [courierRates, setCourierRates] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('dianfx_courier_rates') || '{}'); }
    catch { return {}; }
  });
  const [newCourierRate, setNewCourierRate] = useState('5');

  const saveCourierRate = (name: string, rate: number) => {
    const updated = { ...courierRates, [name]: rate };
    setCourierRates(updated);
    localStorage.setItem('dianfx_courier_rates', JSON.stringify(updated));
  };

  const getRate = (name: string) => courierRates[name] || shippingFeePerOrder || 0;

  const courierData = useMemo(() => {
    const map = new Map<string, { count: number; totalCost: number; orders: any[] }>();
    orders.forEach((o: any) => {
      const trackingNo = String(findField(o, '快递单号') || '').trim();
      if (!trackingNo) return;
      const courier = String(findField(o, '快递公司') || '').trim() || '其他';
      const postage = parseFloat(String(findField(o, '邮费(元)', '邮费', '快递费', '运费') || '0')) || 0;
      if (!map.has(courier)) map.set(courier, { count: 0, totalCost: 0, orders: [] });
      const entry = map.get(courier)!;
      entry.count++;
      entry.totalCost += postage;
      entry.orders.push(o);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
    const totalShipped = sorted.reduce((s, [_, v]) => s + v.count, 0);
    const totalShippingCost = sorted.reduce((s, [_, v]) => s + v.totalCost, 0);
    return { couriers: sorted, totalShipped, totalShippingCost, avgCost: totalShipped > 0 ? totalShippingCost / totalShipped : 0 };
  }, [orders]);

  const shippingDetails = useMemo(() => {
    const details: { orderNo: string; courier: string; trackingNo: string; rate: number; cost: number }[] = [];
    courierData.couriers.forEach(([name, data]) => {
      data.orders.forEach((o: any) => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const trackingNo = String(findField(o, '快递单号') || '').trim();
        const postage = parseFloat(String(findField(o, '邮费(元)', '邮费', '快递费', '运费') || '0')) || 0;
        details.push({
          orderNo, courier: name, trackingNo,
          rate: getRate(name),
          cost: postage || getRate(name),
        });
      });
    });
    if (shippingSearch) {
      const q = shippingSearch.toLowerCase();
      return details.filter(d => d.orderNo.toLowerCase().includes(q) || d.trackingNo.toLowerCase().includes(q));
    }
    return details;
  }, [courierData, courierRates, shippingFeePerOrder, shippingSearch]);

  const benefitAnalysis = useMemo(() => {
    if (courierData.couriers.length === 0) return null;
    const rates = Object.values(courierRates).filter(r => r > 0);
    const minRate = rates.length > 0 ? Math.min(...rates) : 0;
    const currentTotal = courierData.totalShippingCost;
    let ifUseCheapest = 0;
    courierData.couriers.forEach(([name, data]) => {
      ifUseCheapest += data.count * (minRate || shippingFeePerOrder || 5);
    });
    const savings = currentTotal - ifUseCheapest;
    const refundedShippedOrders = orders.filter((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      const hasTracking = String(findField(o, '快递单号') || '').trim();
      const afterSaleStatus = String(findField(o, '售后状态') || '').trim();
      return hasTracking && afterSaleStatus.includes('退款');
    });
    const returnShippingCost = refundedShippedOrders.reduce((s: number, o: any) => {
      return s + (parseFloat(String(findField(o, '邮费(元)', '邮费', '快递费', '运费') || '0')) || 0);
    }, 0);
    return { currentTotal, minRate, ifUseCheapest, savings, returnShippingCost, returnCount: refundedShippedOrders.length };
  }, [courierData, courierRates, shippingFeePerOrder, orders]);

  const renderShipping = () => {
    const addCourier = () => {
      if (!newCourierName.trim()) return;
      saveCourierRate(newCourierName.trim(), parseFloat(newCourierRate) || 5);
      setNewCourierName('');
      setNewCourierRate('5');
      setShowAddForm(false);
    };

    // 获取未匹配的快递公司（在订单中存在但未配置）
    const unmatchedCouriers = courierData.couriers.filter(([name]) => !courierRates[name] && name !== '其他');

    return (
      <motion.div key="shipping" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        {/* 快递公司单价配置 */}
        <div className="pdd-card p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Truck size={16} className="text-pdd-primary" />快递公司单价配置</h3>
            <button onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-xs hover:opacity-90 transition-opacity">
              <Plus size={14} /> 新增快递公司
            </button>
          </div>
          <p className="text-xs text-pdd-text-secondary mb-4">
            设置在各个快递公司的发货单价，系统自动按订单匹配计算快递费。<br />
            有快递单号 → 按快递公司匹配单价 → 计算快递费；无快递单号 → 未发货，不计快递费。
          </p>

          {/* 新增快递公司表单 */}
          <AnimatePresence>
            {showAddForm && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                className="mb-4 p-3 bg-pdd-bg rounded-lg border border-pdd-border">
                <div className="flex items-center gap-3">
                  <input type="text" placeholder="快递公司名称" className="flex-1 px-3 py-1.5 border border-pdd-border rounded-lg text-sm"
                    value={newCourierName} onChange={e => setNewCourierName(e.target.value)} />
                  <input type="number" step="0.1" placeholder="单价(元)" className="w-24 px-3 py-1.5 border border-pdd-border rounded-lg text-sm"
                    value={newCourierRate} onChange={e => setNewCourierRate(e.target.value)} />
                  <button onClick={addCourier} className="px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-sm">添加</button>
                  <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 border border-pdd-border rounded-lg text-sm">取消</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border text-xs text-pdd-text-secondary">
                  <th className="py-2 text-left font-medium w-8">#</th>
                  <th className="py-2 text-left font-medium">快递公司</th>
                  <th className="py-2 text-right font-medium">发货单数</th>
                  <th className="py-2 text-right font-medium">当前单价(元)</th>
                  <th className="py-2 text-right font-medium">总费用(元)</th>
                  <th className="py-2 text-right font-medium">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pdd-border">
                {courierData.couriers.map(([name, data], idx) => {
                  const rate = getRate(name);
                  const totalByRate = data.count * rate;
                  return (
                    <tr key={name} className="hover:bg-pdd-bg/50 transition-colors">
                      <td className="py-2.5 text-pdd-text-secondary">{idx + 1}</td>
                      <td className="py-2.5 font-medium text-pdd-text">
                        <span className="flex items-center gap-1.5">
                          <Truck size={14} className="text-pdd-text-secondary" />
                          {name}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-mono text-pdd-text">{data.count}单</td>
                      <td className="py-2.5 text-right">
                        <input type="number" step="0.1" className="w-20 px-2 py-1 border border-pdd-border rounded-lg text-sm text-right font-mono"
                          value={rate}
                          onChange={e => saveCourierRate(name, parseFloat(e.target.value) || 0)}
                          onFocus={e => e.target.select()} />
                      </td>
                      <td className="py-2.5 text-right font-mono text-pdd-text">¥{totalByRate.toFixed(2)}</td>
                      <td className="py-2.5 text-right">
                        {courierRates[name] ? (
                          <span className="text-[11px] text-pdd-success bg-pdd-success/10 px-2 py-0.5 rounded-full">✅已配置</span>
                        ) : (
                          <span className="text-[11px] text-pdd-primary bg-pdd-primary/10 px-2 py-0.5 rounded-full">🔵默认</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-pdd-border font-semibold">
                  <td colSpan={2} className="py-2.5 text-pdd-text">合计</td>
                  <td className="py-2.5 text-right font-mono text-pdd-text">{courierData.totalShipped}单</td>
                  <td className="py-2.5 text-right font-mono text-pdd-text">¥{courierData.avgCost.toFixed(2)}/单</td>
                  <td className="py-2.5 text-right font-mono text-pdd-primary">¥{courierData.totalShippingCost.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* 未匹配的快递公司 */}
          {unmatchedCouriers.length > 0 && (
            <div className="mt-3 p-3 bg-pdd-warning/10 border border-pdd-warning/20 rounded-lg">
              <p className="text-xs font-medium text-pdd-warning mb-1">⚠️ 以下快递公司未找到匹配，使用了默认价 ¥{(shippingFeePerOrder || 5).toFixed(2)}/单</p>
              <div className="space-y-0.5">
                {unmatchedCouriers.map(([name, data]) => (
                  <div key={name} className="flex items-center gap-2 text-xs text-pdd-text-secondary">
                    <span>× {name} {data.count}单</span>
                    <button onClick={() => { saveCourierRate(name, parseFloat(newCourierRate) || 5); }}
                      className="text-pdd-primary-light hover:underline">立即配置</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 快递费明细 */}
        <div className="pdd-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Search size={14} className="text-pdd-text-secondary" />快递费明细</h3>
            <div className="flex items-center gap-2">
              <Search size={14} className="text-pdd-text-secondary" />
              <input type="text" placeholder="搜索单号..." className="w-48 px-2 py-1.5 border border-pdd-border rounded-lg text-sm"
                value={shippingSearch} onChange={e => setShippingSearch(e.target.value)} />
              {shippingSearch && (
                <button onClick={() => setShippingSearch('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">清除</button>
              )}
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-pdd-card">
                <tr className="border-b border-pdd-border text-xs text-pdd-text-secondary">
                  <th className="py-2 text-left font-medium">订单号</th>
                  <th className="py-2 text-left font-medium">快递公司</th>
                  <th className="py-2 text-left font-medium">快递单号</th>
                  <th className="py-2 text-right font-medium">单价(元)</th>
                  <th className="py-2 text-right font-medium">费用(元)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pdd-border">
                {shippingDetails.slice(0, 200).map((d, i) => (
                  <tr key={i} className="hover:bg-pdd-bg/50 transition-colors text-xs">
                    <td className="py-1.5 font-mono text-pdd-text">#{d.orderNo.slice(-8)}</td>
                    <td className="py-1.5 text-pdd-text">{d.courier}</td>
                    <td className="py-1.5 font-mono text-pdd-text-secondary">{d.trackingNo.slice(-8)}</td>
                    <td className="py-1.5 text-right font-mono text-pdd-text">¥{d.rate.toFixed(2)}</td>
                    <td className="py-1.5 text-right font-mono text-pdd-text">¥{d.cost.toFixed(2)}</td>
                  </tr>
                ))}
                {shippingDetails.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-pdd-text-secondary text-xs">暂无数据</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-pdd-text-secondary mt-2">
            共 {shippingDetails.length} 条记录{courierData.totalShipped > 0 && ` · 已发货 ${courierData.totalShipped} 单 · 均单运费 ¥${courierData.avgCost.toFixed(2)}`}
          </p>
        </div>

        {/* 快递成本效益分析 */}
        {benefitAnalysis && (
          <div className="pdd-card p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><BarChart3 size={16} className="text-pdd-success" />快递成本效益分析</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
              <div className="bg-pdd-bg rounded-lg p-3">
                <p className="text-xs text-pdd-text-secondary">当前快递总成本</p>
                <p className="text-lg font-bold text-pdd-text">¥{benefitAnalysis.currentTotal.toFixed(2)}</p>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <p className="text-xs text-pdd-text-secondary">均单运费</p>
                <p className="text-lg font-bold text-pdd-text">¥{courierData.avgCost.toFixed(2)}</p>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <p className="text-xs text-pdd-text-secondary">退货额外运费</p>
                <p className="text-lg font-bold text-pdd-danger">¥{benefitAnalysis.returnShippingCost.toFixed(2)}</p>
                <p className="text-[10px] text-pdd-text-secondary">{benefitAnalysis.returnCount}单已发货退款</p>
              </div>
              <div className="bg-pdd-bg rounded-lg p-3">
                <p className="text-xs text-pdd-text-secondary">如果用最低价</p>
                <p className="text-lg font-bold" style={{ color: benefitAnalysis.savings > 0 ? 'var(--pdd-success)' : 'var(--pdd-text)' }}>
                  可省 ¥{benefitAnalysis.savings.toFixed(2)}
                </p>
              </div>
            </div>
            {/* 省钱建议 */}
            {benefitAnalysis.savings > 5 && (
              <div className="bg-pdd-success/10 border border-pdd-success/20 rounded-lg p-3">
                <p className="text-xs font-medium text-pdd-success mb-1">💡 省钱建议</p>
                <div className="space-y-1 text-xs text-pdd-text-secondary">
                  {courierData.couriers
                    .filter(([name, data]) => {
                      const rate = getRate(name);
                      const minR = benefitAnalysis.minRate || shippingFeePerOrder || 5;
                      return rate > minR && data.count >= 5;
                    })
                    .map(([name, data]) => {
                      const rate = getRate(name);
                      const minR = benefitAnalysis.minRate || shippingFeePerOrder || 5;
                      const potential = data.count * (rate - minR);
                      return (
                        <div key={name} className="flex items-center gap-2">
                          <span>★ 把 {name}(¥{rate.toFixed(1)}) 的 {data.count} 单改为最低价(¥{minR.toFixed(1)}) → 省 ¥{potential.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  <div className="border-t border-pdd-border pt-1 mt-1 font-medium text-pdd-text">
                    如果全部改用最低价快递，可节省 ¥{benefitAnalysis.savings.toFixed(2)}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  // ========== Tab: 自定义扣费 ==========
  const renderDeductions = () => (
    <motion.div key="deductions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="pdd-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">自定义扣费项</h3>
          <button onClick={() => setShowDeductionForm(!showDeductionForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-xs hover:opacity-90 transition-opacity">
            <Plus size={14} /> 添加扣费项
          </button>
        </div>

        {showDeductionForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-bg rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-pdd-text-secondary">名称</label>
                <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={deductionForm.name || ''}
                  onChange={e => setDeductionForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 平台服务费" />
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">作用范围</label>
                <select className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                  value={deductionForm.scope} onChange={e => setDeductionForm(f => ({ ...f, scope: e.target.value as CustomDeduction['scope'] }))}>
                  <option value="global">全局</option>
                  <option value="product">指定商品</option>
                </select>
              </div>
              {deductionForm.scope === 'product' && (
                <div>
                  <label className="text-xs text-pdd-text-secondary">目标商品ID <span className="text-pdd-danger">*</span></label>
                  <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1 font-mono" value={deductionForm.scopeTarget || ''}
                    onChange={e => setDeductionForm(f => ({ ...f, scopeTarget: e.target.value }))} placeholder="输入商品ID" />
                </div>
              )}
              <div className="col-span-2">
                <label className="text-xs text-pdd-text-secondary">计算公式</label>
                <div className="flex items-center gap-2 mt-1">
                  <input className="flex-1 px-2 py-1.5 border border-pdd-border rounded-lg text-sm font-mono" value={deductionForm.formula || ''}
                    onChange={e => { setDeductionForm(f => ({ ...f, formula: e.target.value })); setFormulaValidation(null); }}
                    placeholder="如: 销售额*0.05 或 订单数*2 或 revenue*0.05" />
                  <button onClick={handleValidateFormula} className="px-3 py-1.5 border border-pdd-border rounded-lg text-xs hover:bg-pdd-bg">
                    验证
                  </button>
                </div>
                {formulaValidation && (
                  <div className={`mt-1 text-xs flex items-center gap-1 ${formulaValidation.valid ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                    {formulaValidation.valid ? <Check size={12} /> : <X size={12} />}
                    {formulaValidation.valid ? '公式有效' : formulaValidation.error}
                  </div>
                )}
                <details className="mt-2">
                  <summary className="text-xs text-pdd-primary-light cursor-pointer hover:underline">可用变量（点击展开，支持中文名）</summary>
                  <div className="mt-2 space-y-2 text-[10px]">
                    {(() => {
                      const varOpts = getVarOptions();
                      const categories = [...new Set(varOpts.map(v => v.category))];
                      return categories.map(cat => (
                        <div key={cat} className="space-y-0.5">
                          <p className="text-pdd-text-secondary font-medium">{cat}:</p>
                          {varOpts.filter(v => v.category === cat).map(v => (
                            <span key={v.key} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-primary/10 mr-1 mb-1"
                              onClick={() => { setDeductionForm(f => ({ ...f, formula: (f.formula || '') + v.label })); }}
                              title={`${v.label} → ${v.key}（两种写法等价）`}>{v.label}</span>
                          ))}
                        </div>
                      ));
                    })()}
                  </div>
                  <p className="text-[10px] text-pdd-text-secondary mt-1">支持中文变量名（如"销售额*0.05"），也可用英文（如"revenue*0.05"）</p>
                  <p className="text-[10px] text-pdd-text-secondary mt-0.5">函数: max, min, abs, round, ceil, floor</p>
                </details>
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">条件表达式(可选)</label>
                <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={deductionForm.condition || ''}
                  onChange={e => setDeductionForm(f => ({ ...f, condition: e.target.value }))} placeholder="如: 利润>0 或 revenue>100" />
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">有效期起(可选)</label>
                <input type="date" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                  value={deductionForm.effectiveFrom || ''} onChange={e => setDeductionForm(f => ({ ...f, effectiveFrom: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">有效期止(可选)</label>
                <input type="date" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                  value={deductionForm.effectiveTo || ''} onChange={e => setDeductionForm(f => ({ ...f, effectiveTo: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleAddDeduction} className="px-4 py-1.5 bg-pdd-primary text-white rounded-lg text-sm hover:opacity-90">保存</button>
              <button onClick={() => { setShowDeductionForm(false); setFormulaValidation(null); }}
                className="px-4 py-1.5 border border-pdd-border rounded-lg text-sm hover:bg-pdd-bg">取消</button>
            </div>
          </motion.div>
        )}

        {(customDeductions || []).length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-bg rounded-lg border border-pdd-border">
            <Search size={16} className="text-pdd-text-secondary" />
            <input type="text" placeholder="搜索扣费项..." className="flex-1 text-sm outline-none bg-transparent"
              value={deductionSearchQuery} onChange={e => setDeductionSearchQuery(e.target.value)} />
            {deductionSearchQuery && <button onClick={() => setDeductionSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">重置</button>}
          </div>
        )}

        {(customDeductions || []).length === 0 ? (
          <div className="text-center py-8 text-pdd-text-secondary text-sm">暂无自定义扣费项，点击上方按钮添加</div>
        ) : (
          <div className="grid gap-2">
            {(customDeductions || []).sort((a, b) => a.sortOrder - b.sortOrder).map((ded, idx) => (
              <div key={ded.id} className="flex items-center gap-3 p-3 border border-pdd-border rounded-lg hover:bg-pdd-bg transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: ded.scope === 'global' ? 'var(--pdd-gray-100)' : 'var(--pdd-primary)' }}>
                  <CalcIcon size={16} style={{ color: ded.scope === 'global' ? 'var(--pdd-primary)' : 'var(--pdd-primary)' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-pdd-text">{ded.name}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ded.scope === 'global' ? 'bg-pdd-primary/10 text-pdd-primary' : 'bg-purple-100 text-purple-700'}`}>
                      {ded.scope === 'global' ? '全局' : '指定商品'}
                    </span>
                    {ded.effectiveFrom && (
                      <span className="text-[10px] text-pdd-text-secondary">{ded.effectiveFrom}~{ded.effectiveTo || '永久'}</span>
                    )}
                  </div>
                  <p className="text-xs font-mono text-pdd-text-secondary mt-0.5">{ded.formula}</p>
                </div>
                <input type="checkbox" checked={ded.enabled} onChange={() => updateCustomDeduction(ded.id, { enabled: !ded.enabled })}
                  className="w-4 h-4 rounded shrink-0 cursor-pointer" />
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={() => moveDeduction(ded.id, 'up')} disabled={idx === 0}
                    className="p-1 hover:bg-pdd-bg rounded disabled:opacity-30"><ArrowUp size={14} /></button>
                  <button onClick={() => moveDeduction(ded.id, 'down')} disabled={idx === (customDeductions || []).length - 1}
                    className="p-1 hover:bg-pdd-bg rounded disabled:opacity-30"><ArrowDown size={14} /></button>
                </div>
                <button onClick={() => removeCustomDeduction(ded.id)} className="p-1.5 hover:bg-pdd-danger/10 rounded-lg text-pdd-danger shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );

  // ========== Tab: 成本预警 ==========
  const dismissAlert = (key: string) => {
    const newSet = new Set(dismissedAlerts);
    newSet.add(key);
    setDismissedAlerts(newSet);
  };

  // ═══════════════════════════════════════════════════════════
  // 推广秒退验证 — 跨源数据比对
  // ═══════════════════════════════════════════════════════════

  // 构建 orderNo → 支付时间 Map
  const orderPayTimeMap = useMemo(() => {
    const map: Record<string, string> = {};
    allOrders.forEach(o => {
      const orderNo = String(findField(o, '订单号', '订单编号') || '').trim();
      const payTime = String(findField(o, '支付时间', '订单支付时间', '付款时间') || '').trim();
      if (orderNo && payTime) map[orderNo] = payTime;
    });
    return map;
  }, [allOrders]);

  // ① 秒拍秒退识别 + 分桶
  const flashRefundBuckets = useMemo(() => {
    const buckets = [
      { label: '<1小时', maxHours: 1, count: 0, amount: 0 },
      { label: '1-24小时', maxHours: 24, count: 0, amount: 0 },
      { label: '1-7天', maxHours: 168, count: 0, amount: 0 },
      { label: '7-30天', maxHours: 720, count: 0, amount: 0 },
      { label: '>30天', maxHours: Infinity, count: 0, amount: 0 },
    ];
    let skippedNoApplyTime = 0;
    let skippedNoPayTime = 0;
    let skippedNoOrderNo = 0;

    afterSaleRecords.forEach(r => {
      const orderNo = String(findField(r, '订单编号', '订单号') || '').trim();
      if (!orderNo) { skippedNoOrderNo++; return; }
      const applyTime = String(findField(r, '申请时间', '售后创建时间', '退款申请时间') || '').trim();
      if (!applyTime) { skippedNoApplyTime++; return; }
      const payTime = orderPayTimeMap[orderNo];
      if (!payTime) { skippedNoPayTime++; return; }

      const applyDate = new Date(applyTime);
      const payDate = new Date(payTime);
      if (isNaN(applyDate.getTime()) || isNaN(payDate.getTime())) { skippedNoApplyTime++; return; }

      const diffHours = (applyDate.getTime() - payDate.getTime()) / 3600000;
      const refundAmount = Number(findField(r, '退款金额(元)', '退款金额', '售后金额') || 0) || 0;

      for (const b of buckets) {
        if (diffHours <= b.maxHours) { b.count++; b.amount += refundAmount; break; }
      }
    });

    const totalCount = buckets.reduce((s, b) => s + b.count, 0);
    const totalAmount = buckets.reduce((s, b) => s + b.amount, 0);
    buckets.forEach(b => { (b as any).ratio = totalCount > 0 ? (b.count / totalCount) * 100 : 0; });

    return { buckets, totalCount, totalAmount, skippedNoApplyTime, skippedNoPayTime, skippedNoOrderNo };
  }, [afterSaleRecords, orderPayTimeMap]);

  // ② 推广订单 vs 有效订单对比
  const promoOrderGap = useMemo(() => {
    if (!promotionProducts.length) return { hasData: false, totalOrders: 0, flashRefundOrders: 0, effectiveOrders: 0, promoClaimedOrders: 0, promoCost: 0, avgCpc: 0, anomalies: [] as string[] };

    // 全店总订单（排除已取消/待付款等无效订单）
    const totalOrders = allOrders.filter(o => {
      const status = String(findField(o, '订单状态', '订单交易状态') || '');
      return !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(status) && !status.includes('取消');
    }).length;

    // 推广声称成交笔数 + 总花费
    let promoClaimedOrders = 0;
    let promoCost = 0;
    promotionProducts.forEach((p: any) => {
      promoClaimedOrders += Number(findField(p, '成交笔数', '推广订单数', '订单数') || 0) || 0;
      promoCost += Number(findField(p, '总花费(元)', '花费(元)', '成交花费(元)', '推广花费') || 0) || 0;
    });

    // 秒拍秒退（<1小时）
    const flashRefundOrders = flashRefundBuckets.buckets[0]?.count || 0;
    const effectiveOrders = totalOrders - flashRefundOrders;
    const avgCpc = promoClaimedOrders > 0 ? promoCost / promoClaimedOrders : 0;

    const anomalies: string[] = [];
    if (promoClaimedOrders > effectiveOrders) {
      anomalies.push(`推广声称成交${promoClaimedOrders}笔 > 有效订单${effectiveOrders}笔，数据异常`);
    }
    if (promoCost > 0 && flashRefundOrders > 0 && flashRefundBuckets.totalCount > 0) {
      const estimatedWasted = avgCpc * flashRefundOrders;
      const wastedPct = promoCost > 0 ? (estimatedWasted / promoCost) * 100 : 0;
      if (wastedPct > 5) {
        anomalies.push(`估算秒退可能浪费推广费约 ¥${estimatedWasted.toFixed(0)}（占总推广费 ${wastedPct.toFixed(1)}%）`);
      }
    }

    return { hasData: true, totalOrders, flashRefundOrders, effectiveOrders, promoClaimedOrders, promoCost, avgCpc, anomalies };
  }, [allOrders, promotionProducts, flashRefundBuckets]);

  // ③ 财务 002 流水独立解析（不修改 buildFinancialIndex）
  const financial002Analysis = useMemo(() => {
    if (!financialRecords.length) return { hasData: false, categories: [], totalCount: 0, totalAmount: 0 };

    const catMap: Record<string, { count: number; amount: number }> = {};
    let totalCount = 0;
    let totalAmount = 0;

    financialRecords.forEach((r: any) => {
      const desc = String(r['业务描述'] || '');
      if (!desc.startsWith('002')) return;
      const inc = Number(r['收入金额（+元）'] || r['收入金额(元)'] || r['收入金额'] || 0) || 0;
      const exp = Number(r['支出金额（-元）'] || r['支出金额(元)'] || r['支出金额'] || 0) || 0;
      const amount = Math.abs(inc + exp);
      // 提取描述文字（去掉编码前缀）
      const parts = desc.split('|');
      const label = parts.length > 1 ? parts.slice(1).join(' / ') : desc;
      if (!catMap[label]) catMap[label] = { count: 0, amount: 0 };
      catMap[label].count++;
      catMap[label].amount += amount;
      totalCount++;
      totalAmount += amount;
    });

    const categories = Object.entries(catMap)
      .map(([label, d]) => ({ label, count: d.count, amount: d.amount }))
      .sort((a, b) => b.amount - a.amount);

    return { hasData: true, categories, totalCount, totalAmount };
  }, [financialRecords]);

  // 推广秒退验证结论
  const flashRefundVerdict = useMemo(() => {
    const flashCount = flashRefundBuckets.buckets[0]?.count || 0;
    const hasPromo = promoOrderGap.hasData;
    const hasFinancial = financial002Analysis.hasData;

    if (!hasPromo && flashRefundBuckets.totalCount === 0) {
      return { level: 'info' as const, text: '暂无售后或推广数据，无法完成验证。请上传售后数据和推广数据。' };
    }
    if (!hasPromo && flashRefundBuckets.totalCount > 0) {
      return { level: 'info' as const, text: `检测到 ${flashRefundBuckets.totalCount} 笔退款订单（其中<1小时秒退 ${flashCount} 笔），但缺少推广数据，无法验证推广费。` };
    }

    // 检查 002 流水中是否有疑似推广费退还
    const promoRefundKeywords = ['推广', '营销', '广告', '返还', '退还'];
    const promoRefundCats = financial002Analysis.categories.filter(c =>
      promoRefundKeywords.some(kw => c.label.includes(kw))
    );
    const promoRefundTotal = promoRefundCats.reduce((s, c) => s + c.amount, 0);

    if (promoRefundTotal > 0) {
      const estimatedWasted = promoOrderGap.avgCpc * flashCount;
      const match = Math.abs(promoRefundTotal - estimatedWasted) / Math.max(estimatedWasted, 1) < 0.5;
      return {
        level: match ? 'safe' as const : 'warn' as const,
        text: match
          ? `✓ 002流水检测到推广相关退还 ¥${promoRefundTotal.toFixed(0)}，与秒退估算 ¥${estimatedWasted.toFixed(0)} 基本匹配，推广费退还正常。`
          : `⚠️ 002流水检测到推广相关退还 ¥${promoRefundTotal.toFixed(0)}，但秒退估算 ¥${estimatedWasted.toFixed(0)}，金额不匹配，建议核查。`,
      };
    }

    if (flashCount > 0 && promoOrderGap.anomalies.length > 0) {
      return {
        level: 'warn' as const,
        text: `⚠️ 财务002流水中未检测到推广费退还记录，但存在 ${flashCount} 笔秒退订单。${promoOrderGap.anomalies.join(' ')}。建议核对货款明细中002开头的流水，确认推广费是否被多扣。`,
      };
    }

    if (flashCount > 0) {
      return {
        level: 'info' as const,
        text: `检测到 ${flashCount} 笔秒退订单（<1小时），但推广数据未显示明显异常。若平台确实退还秒退推广费，当前系统暂未在002流水中检测到。`,
      };
    }

    return { level: 'safe' as const, text: '✓ 未检测到秒拍秒退异常，推广数据与订单数据基本一致。' };
  }, [flashRefundBuckets, promoOrderGap, financial002Analysis]);

  const allAlerts = useMemo(() => {
    const merged: { type: string; severity: number; data: any }[] = [];
    activeMultiSkuAlerts.forEach(a => merged.push({ type: 'multiSku', severity: 2, data: a }));
    activeMultiItemAlerts.forEach(a => merged.push({ type: 'multiItem', severity: 1, data: a }));
    activeLossAlerts.forEach(a => merged.push({ type: 'loss', severity: 3, data: a }));
    activeLowPayAlerts.forEach(a => merged.push({ type: 'lowPay', severity: 2, data: a }));
    activeHighQtyAlerts.forEach(a => merged.push({ type: 'highQty', severity: 3, data: a }));
    merged.sort((a, b) => b.severity - a.severity);
    return merged;
  }, [activeMultiSkuAlerts, activeMultiItemAlerts, activeLossAlerts, activeLowPayAlerts, activeHighQtyAlerts]);

  const filteredAlerts = useMemo(() => {
    let result = allAlerts;
    // 类型筛选
    if (alertFilter !== 'all') {
      const typeMap: Record<string, string> = { multiSku: 'multiSku', multiItem: 'multiItem', loss: 'loss', lowPay: 'lowPay', highQty: 'highQty' };
      result = result.filter(a => a.type === typeMap[alertFilter]);
    }
    // 处理状态筛选（按 alertType 精确匹配）
    if (alertProcessedFilter !== 'all') {
      result = result.filter(a => {
        const record = abnormalOrders[a.data.orderNo];
        const isProcessed = record ? (record.alertTypes || []).includes(a.type) : false;
        return alertProcessedFilter === 'processed' ? isProcessed : !isProcessed;
      });
    }
    return result;
  }, [allAlerts, alertFilter, alertProcessedFilter, abnormalOrders]);

  const handleProcessAlert = (orderNo: string, alertType: string, status: 'excluded' | 'adjusted', note: string, adjustedFields: any = {}) => {
    const existing = abnormalOrders[orderNo];
    const existingTypes = existing?.alertTypes || [];
    setAbnormalOrder(orderNo, {
      orderNo,
      status,
      note,
      adjustedFields,
      alertTypes: [...new Set([...existingTypes, alertType])],
      processedAt: new Date().toISOString(),
    });
    // 自动关闭 action panel（复合键）
    const newSet = new Set(alertActionOpen);
    newSet.delete(`${orderNo}_${alertType}`);
    setAlertActionOpen(newSet);
  };

  const handleUndoProcess = (orderNo: string, alertType?: string) => {
    const existing = abnormalOrders[orderNo];
    if (!existing || !alertType) {
      removeAbnormalOrder(orderNo);
      return;
    }
    const remaining = existing.alertTypes.filter(t => t !== alertType);
    if (remaining.length === 0) {
      removeAbnormalOrder(orderNo);
    } else {
      setAbnormalOrder(orderNo, { ...existing, alertTypes: remaining });
    }
  };

  const excludedOrderCount = useMemo(() => {
    return Object.values(abnormalOrders).filter(a => a.status === 'excluded').length;
  }, [abnormalOrders]);

  const adjustedOrderCount = useMemo(() => {
    return Object.values(abnormalOrders).filter(a => a.status === 'adjusted').length;
  }, [abnormalOrders]);

  const renderAlerts = () => (
    <motion.div key="alerts" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* 汇总统计 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {[
          { label: '一单多SKU', count: activeMultiSkuAlerts.length, color: 'var(--pdd-warning)', bg: '#FFFAEB', desc: '包装/快递费重复计算', type: 'multiSku' as const },
          { label: '一单多件', count: activeMultiItemAlerts.length, color: 'var(--pdd-primary)', bg: 'var(--pdd-gray-100)', desc: '数量>1单品成本', type: 'multiItem' as const },
          { label: '亏损订单', count: activeLossAlerts.length, color: 'var(--pdd-danger)', bg: '#FFF1F2', desc: '实收 < 预估成本', type: 'loss' as const },
          { label: '低支付金额', count: activeLowPayAlerts.length, color: 'var(--pdd-primary)', bg: 'var(--pdd-primary)', desc: '实收<¥5或比<10%', type: 'lowPay' as const },
          { label: '高数量异常', count: activeHighQtyAlerts.length, color: 'var(--pdd-warning)', bg: 'rgba(250,84,28,0.1)', desc: '件数≥50异常数据', type: 'highQty' as const },
          { label: '推广秒退', count: flashRefundBuckets.totalCount > 0 ? flashRefundBuckets.buckets[0]?.count || 0 : 0, color: '#0891b2', bg: 'rgba(8,145,178,0.1)', desc: flashRefundVerdict.level === 'warn' ? '⚠ 需关注' : flashRefundVerdict.level === 'safe' ? '✓ 正常' : '推广费秒退验证', type: 'flashRefund' as const },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            onClick={() => setAlertFilter(item.type)}
            className={`pdd-card px-3 py-2.5 cursor-pointer transition-all ${alertFilter === item.type ? 'ring-2' : 'hover:shadow-md'}`}
            style={{ borderColor: alertFilter === item.type ? item.color : undefined }}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-pdd-text-secondary">{item.label}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
            </div>
            <div className="text-xl font-bold" style={{ color: item.count > 0 ? item.color : 'var(--pdd-text-secondary)' }}>{item.count}</div>
            <span className="text-[10px] text-pdd-text-secondary">{item.desc}</span>
          </motion.div>
        ))}
      </div>

      {/* 无成本数据跳过预警提示 */}
      {skippedNoCostCount > 0 && defaultCostRatio <= 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-pdd-warning/10 border border-pdd-warning/30 rounded-lg text-xs text-pdd-text-secondary">
          <AlertTriangle size={14} className="text-pdd-warning shrink-0" />
          <span>默认成本比例为 0，<b className="text-pdd-text">{skippedNoCostCount} 条订单</b>因无成本数据无法参与亏损检测。请填写商品成本或设置默认成本比例。</span>
        </div>
      )}

      {/* 类型筛选 + 处理状态筛选 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-pdd-card rounded-lg p-0.5 border border-pdd-border">
          {[
            { key: 'all', label: '全部', count: allAlerts.length },
            { key: 'multiSku', label: '一单多SKU', count: activeMultiSkuAlerts.length },
            { key: 'multiItem', label: '一单多件', count: activeMultiItemAlerts.length },
            { key: 'loss', label: '亏损订单', count: activeLossAlerts.length },
            { key: 'lowPay', label: '低支付金额', count: activeLowPayAlerts.length },
            { key: 'highQty', label: '高数量异常', count: activeHighQtyAlerts.length },
            { key: 'flashRefund', label: '推广秒退', count: flashRefundBuckets.buckets[0]?.count || 0 },
          ].map(f => (
            <button key={f.key} onClick={() => setAlertFilter(f.key as any)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                alertFilter === f.key ? 'bg-pdd-card text-pdd-danger shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'
              }`}>
              {f.label} <span className="ml-1 opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-pdd-card rounded-lg p-0.5 border border-pdd-border">
          {[
            { key: 'unprocessed', label: '未处理' },
            { key: 'processed', label: '已处理' },
            { key: 'all', label: '全部状态' },
          ].map(f => (
            <button key={f.key} onClick={() => setAlertProcessedFilter(f.key as any)}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap flex items-center gap-1 ${
                alertProcessedFilter === f.key ? 'bg-pdd-card text-pdd-primary shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'
              }`}>
              <Filter size={11} />{f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 已处理统计条 */}
      {(excludedOrderCount > 0 || adjustedOrderCount > 0) && (
        <div className="flex items-center gap-3 p-2.5 bg-pdd-warning/5 border border-pdd-warning/20 rounded-lg text-xs">
          <AlertTriangle size={14} className="text-pdd-warning shrink-0" />
          <span className="text-pdd-text-secondary">
            已处理 <b className="text-pdd-text">{excludedOrderCount + adjustedOrderCount}</b> 条异常订单
            {excludedOrderCount > 0 && <span className="text-pdd-danger">（{excludedOrderCount} 条已排除计算）</span>}
            {adjustedOrderCount > 0 && <span className="text-pdd-primary">（{adjustedOrderCount} 条已调整）</span>}
          </span>
        </div>
      )}

      {/* 推广秒退详情面板 */}
      {alertFilter === 'flashRefund' && (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="pdd-card rounded-xl border p-4 space-y-4" style={{ borderColor: 'rgba(8,145,178,0.3)', backgroundColor: 'rgba(8,145,178,0.02)' }}>
          <div className="flex items-center gap-2">
            <Zap size={16} color="#0891b2" />
            <h3 className="text-sm font-bold text-pdd-text">推广秒退验证</h3>
            <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-medium ${
              flashRefundVerdict.level === 'safe' ? 'bg-green-100 text-green-700' :
              flashRefundVerdict.level === 'warn' ? 'bg-red-100 text-red-600' :
              'bg-blue-100 text-blue-600'
            }`}>
              {flashRefundVerdict.level === 'safe' ? '✓ 正常' : flashRefundVerdict.level === 'warn' ? '⚠ 需关注' : 'ℹ 信息'}
            </span>
          </div>

          <p className="text-xs text-pdd-gray-600 leading-relaxed">{flashRefundVerdict.text}</p>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* 左：秒退时间分布 */}
            <div>
              <h4 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1"><Clock size={12} color="#0891b2" />退款时间分布（支付→申请）</h4>
              {flashRefundBuckets.totalCount > 0 ? (
                <>
                  <table className="w-full" style={{ fontSize: '10px' }}>
                    <thead>
                      <tr className="text-pdd-gray-400 border-b border-pdd-gray-100">
                        <th className="py-1.5 text-left font-medium">时间窗口</th>
                        <th className="py-1.5 text-right font-medium">订单数</th>
                        <th className="py-1.5 text-right font-medium">占比</th>
                        <th className="py-1.5 text-right font-medium">退款金额</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-pdd-gray-50">
                      {flashRefundBuckets.buckets.map(b => (
                        <tr key={b.label} className={`hover:bg-pdd-gray-50 ${b.label === '<1小时' ? 'bg-red-50/30 font-semibold' : ''}`}>
                          <td className="py-1.5 text-pdd-gray-700">{b.label}</td>
                          <td className="py-1.5 text-right font-mono text-pdd-gray-700">{b.count}</td>
                          <td className="py-1.5 text-right font-mono text-pdd-gray-600">{(b as any).ratio.toFixed(1)}%</td>
                          <td className="py-1.5 text-right font-mono text-pdd-gray-600">¥{b.amount.toFixed(0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-1 text-pdd-gray-400" style={{ fontSize: '9px' }}>
                    共 {flashRefundBuckets.totalCount} 笔退款，总金额 ¥{flashRefundBuckets.totalAmount.toFixed(0)}
                    {flashRefundBuckets.skippedNoPayTime > 0 && <span className="ml-2 text-pdd-primary">跳过 {flashRefundBuckets.skippedNoPayTime} 条无支付时间</span>}
                    {flashRefundBuckets.skippedNoApplyTime > 0 && <span className="ml-2 text-pdd-primary">跳过 {flashRefundBuckets.skippedNoApplyTime} 条无申请时间</span>}
                  </div>
                </>
              ) : (
                <div className="text-xs text-pdd-gray-400 py-4 text-center">暂无售后数据，请上传售后明细</div>
              )}
            </div>

            {/* 右：推广验证 + 002 分析 */}
            <div className="space-y-4">
              {/* 推广订单验证 */}
              <div>
                <h4 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1"><Target size={12} color="#7c3aed" />推广订单验证</h4>
                {promoOrderGap.hasData ? (
                  <div className="space-y-1.5">
                    {[
                      { label: '全店总订单', value: promoOrderGap.totalOrders.toLocaleString() },
                      { label: '秒拍秒退 (<1h)', value: promoOrderGap.flashRefundOrders.toLocaleString(), warn: true },
                      { label: '有效订单 (总-秒退)', value: promoOrderGap.effectiveOrders.toLocaleString() },
                      { label: '推广声称成交笔数', value: promoOrderGap.promoClaimedOrders.toLocaleString() },
                      { label: '推广总花费', value: '¥' + promoOrderGap.promoCost.toFixed(0) },
                      { label: '单均推广成本 (CPO)', value: '¥' + promoOrderGap.avgCpc.toFixed(2) },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between text-xs">
                        <span className="text-pdd-gray-500">{row.label}</span>
                        <span className={`font-mono ${row.warn ? 'text-red-500 font-semibold' : 'text-pdd-gray-700'}`}>{row.value}</span>
                      </div>
                    ))}
                    {promoOrderGap.anomalies.map((a, i) => (
                      <div key={i} className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded mt-1">{a}</div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-pdd-gray-400 py-2">暂无推广数据</div>
                )}
              </div>

              {/* 002 财务流水分析 */}
              <div>
                <h4 className="text-xs font-semibold text-pdd-gray-600 mb-2 flex items-center gap-1"><DollarSign size={12} color="#f97316" />002类财务流水（退款相关）</h4>
                {financial002Analysis.hasData && financial002Analysis.totalCount > 0 ? (
                  <>
                    <div className="text-xs text-pdd-gray-500 mb-1">
                      共 {financial002Analysis.totalCount} 条记录，总金额 ¥{financial002Analysis.totalAmount.toFixed(0)}
                    </div>
                    <div className="max-h-[180px] overflow-y-auto space-y-1">
                      {financial002Analysis.categories.slice(0, 8).map(c => (
                        <div key={c.label} className="flex items-center justify-between text-xs py-0.5 border-b border-pdd-gray-50 last:border-0">
                          <span className="text-pdd-gray-600 truncate max-w-[200px]" title={c.label}>{c.label}</span>
                          <span className="text-pdd-gray-400 font-mono shrink-0">{c.count}笔 / ¥{c.amount.toFixed(0)}</span>
                        </div>
                      ))}
                      {financial002Analysis.categories.length > 8 && (
                        <div className="text-xs text-pdd-gray-400">...还有 {financial002Analysis.categories.length - 8} 个分类</div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-xs text-pdd-gray-400 py-2">
                    {financial002Analysis.hasData ? '002类流水为空（可能无退款相关财务记录）' : '暂无货款明细数据'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 说明 */}
          <div className="text-pdd-gray-400" style={{ fontSize: '9px' }}>
            <p>说明：秒拍秒退指用户点击广告后极短时间内下单并退款的订单。拼多多声称此类订单不扣推广费。
            本模块通过订单×售后时间差识别秒退，并对比推广数据声称的成交笔数，同时解析财务002类流水查找推广费退还记录。
            推广数据中的"成交笔数"已由平台剔除秒拍秒退，此处为跨源验证该声称是否合理。</p>
          </div>
        </motion.div>
      )}

      {/* ★ 批量操作栏 */}
      {filteredAlerts.length > 0 && alertFilter !== 'flashRefund' && (
        <div className="flex items-center gap-3 mb-2">
          <label className="flex items-center gap-1 text-xs cursor-pointer">
            <input type="checkbox" checked={batchSelected.size === filteredAlerts.filter(a => a.data?.orderNo).length && filteredAlerts.length > 0}
              onChange={e => {
                if (e.target.checked) setBatchSelected(new Set(filteredAlerts.map(a => a.data?.orderNo).filter(Boolean)));
                else setBatchSelected(new Set());
              }} className="w-3 h-3" /> 全选
          </label>
          {batchSelected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-pdd-text-secondary">已选 {batchSelected.size} 单</span>
              <button onClick={() => batchProcess('excluded')} className="px-2.5 py-1 rounded text-xs bg-pdd-danger text-white hover:opacity-90">批量排除</button>
              <button onClick={() => setShowBatchAdjust(true)} className="px-2.5 py-1 rounded text-xs bg-pdd-primary text-white hover:opacity-90">批量调整</button>
            </div>
          )}
          {showBatchAdjust && (
            <div className="flex items-center gap-2">
              <input type="number" placeholder="实收金额" className="w-20 px-2 py-0.5 border rounded text-xs" value={batchAdjAmount} onChange={e => setBatchAdjAmount(e.target.value)} />
              <button onClick={() => batchProcess('adjusted')} className="px-2.5 py-1 rounded text-xs bg-pdd-primary text-white">确认</button>
              <button onClick={() => { setShowBatchAdjust(false); setBatchAdjAmount(''); }} className="text-xs text-pdd-text-secondary">取消</button>
            </div>
          )}
        </div>
      )}
      {/* 异常列表 */}
      {alertFilter === 'flashRefund' ? (
        <div className="text-center py-6 text-pdd-text-secondary">
          <Zap size={32} className="mx-auto mb-2 opacity-20" />
          <p className="text-xs">推广秒退为汇总分析，无逐单列表。上方面板显示跨源验证详情。</p>
        </div>
      ) : filteredAlerts.length === 0 ? (
        <div className="text-center py-12 text-pdd-text-secondary">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{alertFilter === 'all' ? '未检测到成本异常，一切正常' : '该类型无异常订单'}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {filteredAlerts.map((alert, idx) => {
            const a = alert.data;
            const typeConfig = {
              multiSku: { label: '一单多SKU', color: 'var(--pdd-warning)', bg: '#FFFAEB', borderColor: '#FFEBA6', icon: Package },
              multiItem: { label: '一单多件', color: 'var(--pdd-primary)', bg: 'var(--pdd-gray-100)', borderColor: '#B2D0FF', icon: Package },
              loss: { label: '亏损订单', color: 'var(--pdd-danger)', bg: '#FFF1F2', borderColor: '#FFC2C2', icon: TrendingUp },
              lowPay: { label: '低支付金额', color: 'var(--pdd-primary)', bg: 'rgba(114,46,209,0.06)', borderColor: 'rgba(114,46,209,0.25)', icon: DollarSign },
              highQty: { label: '高数量异常', color: 'var(--pdd-warning)', bg: 'rgba(250,84,28,0.06)', borderColor: 'rgba(250,84,28,0.25)', icon: AlertTriangle },
            }[alert.type]!;

            const record = abnormalOrders[a.orderNo];
            const isProcessed = record ? (record.alertTypes || []).includes(alert.type) : false;
            const actionOpen = alertActionOpen.has(`${a.orderNo}_${alert.type}`);

            return (
              <div key={`${alert.type}_${a.orderNo}`} className={`pdd-card p-3 border rounded-xl transition-all ${isProcessed ? 'opacity-75' : ''}`} style={{ borderColor: isProcessed ? '#ABEFC6' : typeConfig.borderColor, backgroundColor: isProcessed ? 'var(--pdd-success)' : typeConfig.bg }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 shrink-0">
                    <input type="checkbox" checked={batchSelected.has(a.orderNo)} onChange={e => {
                      const next = new Set(batchSelected);
                      e.target.checked ? next.add(a.orderNo) : next.delete(a.orderNo);
                      setBatchSelected(next);
                    }} className="w-3 h-3" />
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ color: typeConfig.color, backgroundColor: typeConfig.bg }}>
                      {typeConfig.label}
                    </span>
                    <span className="text-xs font-mono text-pdd-text-secondary">#{a.orderNo.slice(-8)}</span>
                    {isProcessed && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${record.status === 'excluded' ? 'bg-pdd-danger/10 text-pdd-danger' : 'bg-pdd-primary/10 text-pdd-primary'}`}>
                        <Check size={10} />{record.status === 'excluded' ? '已排除' : '已调整'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {alert.type === 'loss' && (
                      <button onClick={() => { setActiveTab('costs'); }}
                        className="text-[11px] px-2 py-1 bg-pdd-danger/10 text-pdd-danger rounded-lg hover:bg-pdd-danger/20 transition-colors">
                        调整定价
                      </button>
                    )}
                    {isProcessed ? (
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => {
                          const key = `${a.orderNo}_${alert.type}`;
                          const newSet = new Set(alertActionOpen);
                          if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                          setAlertActionOpen(newSet);
                        }}
                          className={`text-[11px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                            actionOpen ? 'bg-pdd-primary/10 text-pdd-primary' : 'border border-pdd-border text-pdd-text-secondary hover:text-pdd-primary hover:bg-pdd-primary/5'
                          }`}>
                          <Edit3 size={10} />重新修改
                        </button>
                        <button onClick={() => handleUndoProcess(a.orderNo, alert.type)}
                          className="text-[11px] px-2 py-1 border border-pdd-border rounded-lg text-pdd-text-secondary hover:text-pdd-warning hover:bg-pdd-warning/5 transition-colors flex items-center gap-1">
                          <RotateCcw size={10} />撤销
                        </button>
                      </div>
                    ) : (
                      <>
                        <button onClick={() => {
                          const key = `${a.orderNo}_${alert.type}`;
                          const newSet = new Set(alertActionOpen);
                          if (newSet.has(key)) newSet.delete(key); else newSet.add(key);
                          setAlertActionOpen(newSet);
                        }}
                          className={`text-[11px] px-2 py-1 rounded-lg transition-colors flex items-center gap-1 ${
                            actionOpen ? 'bg-pdd-primary/10 text-pdd-primary' : 'border border-pdd-border text-pdd-text-secondary hover:text-pdd-primary hover:bg-pdd-primary/5'
                          }`}>
                          <Edit3 size={10} />处理
                        </button>
                        <button onClick={() => dismissAlert(`${alert.type}_${a.orderNo}${alert.type === 'multiItem' ? '_' + a.product : ''}`)}
                          className="text-[11px] px-2 py-1 border border-pdd-border rounded-lg text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg transition-colors">
                          忽略
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  <p className="text-sm text-pdd-text truncate">{a.product}</p>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-xs">
                    {alert.type === 'multiSku' && (
                      <>
                        <div><span className="text-pdd-text-secondary">行数: </span><span className="font-semibold text-pdd-text">{a.lines}行</span></div>
                        <div><span className="text-pdd-text-secondary">商品数: </span><span className="font-semibold text-pdd-text">{a.products.length}个</span></div>
                        <div>
                          <span className="text-pdd-text-secondary">费用重复: </span>
                          <span className="font-semibold text-pdd-warning">+¥{a.duplicateFee.toFixed(2)}</span>
                        </div>
                        <div className="col-span-3 mt-1">
                          <span className="text-[10px] text-pdd-text-secondary">包含: {a.products.join(' / ')}</span>
                        </div>
                        <div className="col-span-3 mt-1 p-2 bg-pdd-warning/10 rounded-lg">
                          <span className="text-[11px] text-pdd-warning font-medium">建议: 合并计算按单费用（包装/人工/快递/运费险）</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">（{a.lines}行共享1单，当前按单费用×{a.lines}次 = ¥{(a.totalPerOrderFees * a.lines).toFixed(2)}，应为¥{a.totalPerOrderFees.toFixed(2)}）</span>
                        </div>
                      </>
                    )}
                    {alert.type === 'multiItem' && (
                      <>
                        <div><span className="text-pdd-text-secondary">数量: </span><span className="font-semibold text-pdd-text">{a.qty}件</span></div>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold text-pdd-text">¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">单价: </span><span className="font-semibold text-pdd-text">¥{a.unitPrice.toFixed(2)}/件</span></div>
                        <div className="col-span-3 mt-1 p-2 bg-pdd-primary/10 rounded-lg">
                          <span className="text-[11px] text-pdd-primary font-medium">建议: 确认单品裸货成本是否准确</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">（当前成本: {a.cost > 0 ? `¥${a.cost}/件` : '未填写'}，预估总成本: {a.cost > 0 ? `¥${(a.cost * a.qty + packagingFeePerOrder + (shippingFeePerOrder || 0)).toFixed(2)}` : '--'}）</span>
                        </div>
                      </>
                    )}
                    {alert.type === 'loss' && (
                      <>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold text-pdd-danger">¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">预估成本: </span><span className="font-semibold text-pdd-text">¥{a.estimatedCost.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">亏损: </span><span className="font-semibold text-pdd-danger">-¥{Math.abs(a.loss).toFixed(2)}</span></div>
                        <div className="col-span-3 mt-1 p-2 bg-pdd-danger/10 rounded-lg">
                          <span className="text-[11px] text-pdd-danger font-medium">建议: 调整定价策略或检查成本</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">
                            （{a.costEstimated ? `按商品总价×${defaultCostRatio}%估算成本` : `裸货成本 ¥${a.cost.toFixed(2)}/件×${a.qty}件`} + 包装¥{packagingFeePerOrder.toFixed(2)} + 人工¥{(laborFeePerOrder || 0).toFixed(2)} + 快递¥{(shippingFeePerOrder || 0).toFixed(2)} = ¥{a.estimatedCost.toFixed(2)} &gt; 实收 ¥{a.merchant.toFixed(2)}，平台扣点已含在实收中）
                          </span>
                        </div>
                      </>
                    )}
                    {alert.type === 'lowPay' && (
                      <>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold" style={{ color: 'var(--pdd-primary)' }}>¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">商品总价: </span><span className="font-semibold text-pdd-text">¥{a.productTotal.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">实收比: </span>
                          <span className="font-semibold" style={{ color: a.productTotal > 0 && a.merchant / a.productTotal < 0.1 ? 'var(--pdd-danger)' : 'var(--pdd-primary)' }}>
                            {a.productTotal > 0 ? (a.merchant / a.productTotal * 100).toFixed(1) : '--'}%
                          </span>
                        </div>
                        <div className="col-span-3 mt-1 p-2 bg-purple-500/10 rounded-lg">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--pdd-primary)' }}>建议: 确认订单性质</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">（实收 ¥{a.merchant.toFixed(2)}{a.merchant < 5 ? ' < ¥5' : '，比率偏低'}，可能为促销/刷单/异常数据，确认后可标记忽略）</span>
                        </div>
                      </>
                    )}
                    {alert.type === 'highQty' && (
                      <>
                        <div><span className="text-pdd-text-secondary">数量: </span><span className="font-semibold" style={{ color: 'var(--pdd-warning)' }}>{a.qty}件</span></div>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold text-pdd-text">¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">单价: </span>
                          <span className="font-semibold" style={{ color: a.unitPrice < 1 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>
                            ¥{a.unitPrice.toFixed(2)}/件
                          </span>
                        </div>
                        <div className="col-span-3 mt-1 p-2 bg-orange-500/10 rounded-lg">
                          <span className="text-[11px] font-medium" style={{ color: 'var(--pdd-warning)' }}>建议: 核实是否异常数据</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">（单行{a.qty}件，裸货成本 {a.cost > 0 ? `¥${a.cost}/件` : '未填写'}，均价¥{a.unitPrice.toFixed(2)}，可能为批发/异常单）</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* 已处理备注 */}
                {isProcessed && record.note && (
                  <div className="mt-2 flex items-start gap-1.5 text-xs bg-pdd-bg rounded-lg p-2">
                    <MessageSquare size={12} className="text-pdd-text-secondary shrink-0 mt-0.5" />
                    <span className="text-pdd-text-secondary">{record.note}</span>
                  </div>
                )}

                {/* 处理面板 */}
                <AnimatePresence>
                  {actionOpen && (
                    <ProcessPanel
                      alertData={a}
                      alertType={alert.type}
                      existingData={isProcessed ? record : null}
                      onProcess={(status, note, adjFields) => handleProcessAlert(a.orderNo, alert.type, status, note, adjFields)}
                      onCancel={() => {
                        const key = `${a.orderNo}_${alert.type}`;
                        const newSet = new Set(alertActionOpen);
                        newSet.delete(key);
                        setAlertActionOpen(newSet);
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );

  return (
    <div className="p-4 lg:p-6 space-y-4">

      {/* ★ F8: 统一设置弹窗 — 合并原快速设置+全局设置 */}
      <AnimatePresence>
        {showQuickSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQuickSettings(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-pdd-card border border-pdd-border rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-pdd-text flex items-center gap-2"><Settings size={18} className="text-pdd-primary" />成本计算设置</h3>
                <button onClick={() => setShowQuickSettings(false)} className="p-1 hover:bg-pdd-bg rounded-lg text-pdd-text-secondary hover:text-pdd-text transition-colors"><X size={18} /></button>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 mb-4 bg-pdd-bg rounded-lg p-0.5">
                <button onClick={() => setQuickSettingsTab('fees')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${quickSettingsTab === 'fees' ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
                  <DollarSign size={12} className="inline mr-1" />通用费用
                </button>
                <button onClick={() => setQuickSettingsTab('couriers')}
                  className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${quickSettingsTab === 'couriers' ? 'bg-pdd-card text-pdd-text shadow-sm' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
                  <Truck size={12} className="inline mr-1" />快递费率
                </button>
              </div>

              {quickSettingsTab === 'fees' && (
                <div className="space-y-4">
                  <p className="text-xs text-pdd-text-secondary">通用费用将应用于所有商品成本计算，均为选填。</p>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">快递费/单 (元)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempShippingFee}
                      onChange={e => setTempShippingFee(e.target.value)} placeholder="选填" step="0.01" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Truck size={10} />每个订单固定快递成本</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">平台扣点 (%)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempPlatformCommissionRate}
                      onChange={e => setTempPlatformCommissionRate(e.target.value)} placeholder="选填" step="0.1" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Percent size={10} />按商家实收金额 × 比例计算</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">包装费/单 (元)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempPackagingFee}
                      onChange={e => setTempPackagingFee(e.target.value)} placeholder="选填" step="0.01" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Package size={10} />每个订单固定包装成本</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">人工费/单 (元)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempLaborFee}
                      onChange={e => setTempLaborFee(e.target.value)} placeholder="选填" step="0.01" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Wrench size={10} />拣货/打包/发货人工成本</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">默认成本比例 (%)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempDefaultCostRatio}
                      onChange={e => setTempDefaultCostRatio(e.target.value)} placeholder="选填" step="0.1" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Percent size={10} />无裸货成本时，按实收金额 × 此比例估算</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">运费险/单 (元)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempInsuranceFee}
                      onChange={e => setTempInsuranceFee(e.target.value)} placeholder="选填" step="0.01" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><Shield size={10} />仅当订单有运费险记录时计入</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-pdd-text">推广费/单 (元)</label>
                    <input type="number" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm mt-1" value={tempPromotionFee}
                      onChange={e => setTempPromotionFee(e.target.value)} placeholder="选填" step="0.01" />
                    <p className="text-[10px] text-pdd-text-secondary mt-1 flex items-center gap-1"><DollarSign size={10} />推广花费平均到每单的成本</p>
                  </div>
                  <button onClick={saveQuickSettings}
                    className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pdd-primary to-indigo-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                    <Save size={15} /> 保存设置
                  </button>
                </div>
              )}

              {quickSettingsTab === 'couriers' && (
                <div>
                  <p className="text-xs text-pdd-text-secondary mb-3">按快递公司单独设置费率（元/单），留空则使用上方默认快递费。</p>
                  {(() => {
                    const couriers = [...new Set(orders.map((o: any) => String(findField(o, '快递公司') || '').trim()).filter(Boolean))].sort();
                    if (!couriers.length) return <p className="text-xs text-pdd-text-secondary">暂无快递公司数据，请先上传包含「快递公司」列的订单数据。</p>;
                    return (
                      <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                        {couriers.map((c: string) => {
                          const val = courierRates[c] || '';
                          return (
                            <div key={c} className="flex items-center gap-2">
                              <span className="text-xs text-pdd-text w-24 truncate" title={c}>{c}</span>
                              <input type="number" step="0.1" className="flex-1 px-2 py-1.5 border border-pdd-border rounded text-xs"
                                defaultValue={val || ''}
                                placeholder="默认"
                                onBlur={e => {
                                  const v = parseFloat(e.target.value);
                                  if (isNaN(v) || v <= 0) {
                                    saveCourierRate(c, 0);
                                  } else {
                                    saveCourierRate(c, v);
                                  }
                                }} />
                              <span className="text-[10px] text-pdd-text-secondary w-10">元/单</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-pdd-text-secondary mt-3">{'快递费优先级：实际邮费 > 快递公司费率 > 默认快递费'}</p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <UnifiedFilterBar
        timeFilter={tf}
        actions={[
          { label: '成本设置', icon: <Settings size={13} />, onClick: () => setShowQuickSettings(true) },
        ]}
      />

      {/* Tab navigation */}
      <div className="flex gap-1 bg-pdd-card rounded-lg px-1.5 py-1 border border-pdd-border overflow-x-auto">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              activeTab === tab.key ? 'text-white shadow-md' : 'text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-bg'
            }`}
            style={activeTab === tab.key ? { background: 'linear-gradient(to right, var(--pdd-primary), #6366f1)' } : {}}>
            <tab.Icon size={13} />{tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'costs' && renderCosts()}
      {activeTab === 'shipping' && renderShipping()}
      {activeTab === 'deductions' && renderDeductions()}
      {activeTab === 'alerts' && renderAlerts()}
    </div>
  );
}

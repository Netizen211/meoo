import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, Edit3, Calculator, Save, AlertCircle, AlertTriangle, Check, ChevronDown, ChevronUp,
  Eye, EyeOff, X, Settings, DollarSign, Plus, Trash2, Shield, Calculator as CalcIcon,
  Upload, History, ArrowUp, ArrowDown, Download, Search, LayoutDashboard,
  TrendingUp, Percent, BarChart3, Zap, Truck, Wrench, MessageSquare, RotateCcw, Filter
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { useData } from '../App';
import type { TaxConfig, CustomDeduction } from '../components/ProductLinkStats';
import { findField } from '../utils';
import { getBestPlatformFee, getBestInsuranceFee, getPenaltyFees, matchLateShipmentPenalties, calcLateShipmentPenalty, isLateShipment } from '../utils/financialActuals';
import { evaluateFormula, validateFormula, getVarOptions, FormulaContext } from '../utils/formulaEngine';
import TimeFilter, { TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups, useTimeFilter } from '../components/TimeFilter';

const TABS = [
  { key: 'overview', label: '成本概览', Icon: LayoutDashboard },
  { key: 'costs', label: '商品成本', Icon: Package },
  { key: 'pricing', label: '定价计算器', Icon: Calculator },
  { key: 'tax', label: '税务配置', Icon: Shield },
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
        <p className="text-xs font-semibold text-pdd-text mb-2 flex items-center gap-1.5"><Edit3 size={12} />处理异常订单</p>
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
  const [activeTab, setActiveTab] = useState('overview');
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange } = tf;

  const {
    currentDisplayData,
    productCosts,
    setProductCost,
    costConfigs,
    setCostConfig,
    packagingFeePerOrder,
    setPackagingFeePerOrder,
    pricingPresets,
    addPricingPreset,
    taxConfigs,
    addTaxConfig,
    removeTaxConfig,
    updateTaxConfig,
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
  const allDates = useMemo(() => getAllDateGroups(allOrders), [allOrders]);
  const filteredOrders = useMemo(() => {
    const timeFiltered = filterByTimeRange(allOrders, allDates, timeRange, customStart, customEnd, quickRange);
    return timeFiltered.filter((o: any) => {
      // 排除已取消订单
      const orderStatus = String(findField(o, '订单状态') || '').trim();
      if (orderStatus === '已取消') return false;
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
      unlinkedFinancials || { penalties: 0, marketingFees: 0, shippingInsurance: 0, records: [] },
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
          shippingOrderCount: 0, insuredOrderCount: 0,
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

      // 快递费统计：所有订单都计入（商家实际承担快递成本，不论是否包邮）
      sku.shippingOrderCount++;

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
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPrices, setExpandedPrices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);
  const [tempPackagingFee, setTempPackagingFee] = useState(String(packagingFeePerOrder));
  const [tempDefaultCostRatio, setTempDefaultCostRatio] = useState(String(defaultCostRatio ?? 30));
  const [tempShippingFee, setTempShippingFee] = useState(String(shippingFeePerOrder || 0));
  const [tempPlatformCommissionRate, setTempPlatformCommissionRate] = useState(String(platformCommissionRate || 0));
  const [tempLaborFee, setTempLaborFee] = useState(String(laborFeePerOrder || 0));
  const [tempInsuranceFee, setTempInsuranceFee] = useState(String(insuranceFeePerOrder || 0));
  const [tempPromotionFee, setTempPromotionFee] = useState(String(promotionFeePerOrder || 0));
  const [showImportHelp, setShowImportHelp] = useState(false);
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

  // Pricing preset filters
  const [pricingSearchQuery, setPricingSearchQuery] = useState('');
  const [pricingCostMin, setPricingCostMin] = useState('');
  const [pricingCostMax, setPricingCostMax] = useState('');
  const [pricingSortBy, setPricingSortBy] = useState<'name' | 'cost' | 'suggestedPrice'>('name');
  const [pricingSortOrder, setPricingSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPricingFilters, setShowPricingFilters] = useState(false);

  // Tax filters
  const [taxSearchQuery, setTaxSearchQuery] = useState('');
  const [taxRateMin, setTaxRateMin] = useState('');
  const [taxRateMax, setTaxRateMax] = useState('');
  const [taxSortBy, setTaxSortBy] = useState<'name' | 'rate' | 'type'>('name');
  const [taxSortOrder, setTaxSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTaxFilters, setShowTaxFilters] = useState(false);

  // Deduction filters
  const [deductionSearchQuery, setDeductionSearchQuery] = useState('');
  const [deductionAmountMin, setDeductionAmountMin] = useState('');
  const [deductionAmountMax, setDeductionAmountMax] = useState('');
  const [deductionSortBy, setDeductionSortBy] = useState<'name' | 'scope' | 'order'>('order');
  const [deductionSortOrder, setDeductionSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeductionFilters, setShowDeductionFilters] = useState(false);

  // Tax form
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxForm, setTaxForm] = useState<Partial<TaxConfig>>({
    name: '', taxType: 'vat', rate: 0, base: 'revenue', enabled: true, description: ''
  });

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

  // Overview KPI calculations
  const overviewStats = useMemo(() => {
    const allSkus = getAllSkuKeys(productGroups);
    const skusWithCost = allSkus.filter(k => (productCosts[k] || 0) > 0);
    const productsWithCode = productGroups.filter(g =>
      g.skus.some(s => s.hasProductCode || s.hasSkuCode)
    ).length;
    const totalEstimatedCost = skusWithCost.reduce((sum, k) => {
      const sku = productGroups.flatMap(g => g.skus).find(s =>
        (s.skuId ? `${s.productId}_${s.skuId}` : s.productId) === k
      );
      if (!sku) return sum;
      const rawCost = productCosts[k] || 0;
      const uniqueCnt = sku.uniqueOrderNos?.size || sku.orderCount;
      return sum + rawCost * sku.itemCount + packagingFeePerOrder * uniqueCnt + (shippingFeePerOrder || 0) * uniqueCnt;
    }, 0);
    const avgUnitCost = skusWithCost.length > 0
      ? skusWithCost.reduce((sum, k) => sum + (productCosts[k] || 0), 0) / skusWithCost.length
      : 0;

    return {
      totalProducts: productGroups.length,
      productsWithCode,
      totalSkus: allSkus.length,
      skusWithCost: skusWithCost.length,
      costCoverage: allSkus.length > 0 ? (skusWithCost.length / allSkus.length) * 100 : 0,
      totalEstimatedCost,
      avgUnitCost,
    };
  }, [productGroups, productCosts, packagingFeePerOrder, shippingFeePerOrder]);

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

  const filteredPricingPresets = useMemo(() => {
    let result = [...pricingPresets];
    if (pricingSearchQuery) {
      const query = pricingSearchQuery.toLowerCase();
      result = result.filter(p =>
        (p.name && p.name.toLowerCase().includes(query)) ||
        (p.code && p.code.toLowerCase().includes(query))
      );
    }
    const minCost = parseFloat(pricingCostMin) || 0;
    const maxCost = parseFloat(pricingCostMax) || Infinity;
    if (minCost > 0 || maxCost < Infinity) {
      result = result.filter(p => p.rawCost >= minCost && p.rawCost <= maxCost);
    }
    result.sort((a, b) => {
      let comparison = 0;
      switch (pricingSortBy) {
        case 'name': comparison = (a.name || a.code || '').localeCompare(b.name || b.code || ''); break;
        case 'cost': comparison = a.rawCost - b.rawCost; break;
        case 'suggestedPrice': comparison = (a.suggestedPrice || 0) - (b.suggestedPrice || 0); break;
      }
      return pricingSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [pricingPresets, pricingSearchQuery, pricingCostMin, pricingCostMax, pricingSortBy, pricingSortOrder]);

  const filteredTaxConfigs = useMemo(() => {
    let result = [...(taxConfigs || [])];
    if (taxSearchQuery) {
      const query = taxSearchQuery.toLowerCase();
      result = result.filter(t => t.name.toLowerCase().includes(query));
    }
    const minRate = parseFloat(taxRateMin) || 0;
    const maxRate = parseFloat(taxRateMax) || Infinity;
    if (minRate > 0 || maxRate < Infinity) {
      result = result.filter(t => t.rate >= minRate && t.rate <= maxRate);
    }
    result.sort((a, b) => {
      let comparison = 0;
      switch (taxSortBy) {
        case 'name': comparison = a.name.localeCompare(b.name); break;
        case 'rate': comparison = a.rate - b.rate; break;
        case 'type': comparison = a.taxType.localeCompare(b.taxType); break;
      }
      return taxSortOrder === 'asc' ? comparison : -comparison;
    });
    return result;
  }, [taxConfigs, taxSearchQuery, taxRateMin, taxRateMax, taxSortBy, taxSortOrder]);

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
    if (isNaN(cost)) return;
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

  const savePackagingFee = () => {
    setPackagingFeePerOrder(parseFloat(tempPackagingFee) || 0);
    setDefaultCostRatio(parseFloat(tempDefaultCostRatio) ?? 30);
    setShippingFeePerOrder(parseFloat(tempShippingFee) || 0);
    setShowSettings(false);
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
    const totalShipping = (shippingFeePerOrder || 0) * uniqueOrderCnt;
    const totalPromotionFee = (promotionFeePerOrder || 0) * uniqueOrderCnt;

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
        totalMarketingFees += actual.marketingFees;
      }

      // 延迟发货罚款匹配（独立于 financialActuals 索引）
      if (lateMatch) {
        totalPenalties += lateMatch.amount;
        if (lateMatch.confirmed) confirmedPenaltyCount++;
        else estimatedPenaltyCount++;
      }
    });

    const subtotal = totalRawCost + totalPackaging + totalLabor + totalShipping + totalInsurance + totalPlatformCommission + totalSubTechFee + totalPenalties + totalMarketingFees + totalPromotionFee;

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
  const [alertFilter, setAlertFilter] = useState<'all' | 'multiSku' | 'multiItem' | 'loss' | 'lowPay' | 'highQty'>('all');
  const [alertProcessedFilter, setAlertProcessedFilter] = useState<'all' | 'unprocessed' | 'processed'>('all');
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [alertActionOpen, setAlertActionOpen] = useState<Set<string>>(new Set());

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
        // knownCost 是单件成本，defaultCostRatio 估算的是行总成本
        const estimatedRawCost = knownCost > 0
          ? knownCost * qty
          : (productTotal * (defaultCostRatio / 100));
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
        const estimatedCost = estimatedRawCost
          + packagingFeePerOrder
          + (laborFeePerOrder || 0)
          + (shippingFeePerOrder || 0)
          + insuranceCost
          + (promotionFeePerOrder || 0)
          + platformCost
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
        const productTotal = parseFloat(String(findField(o, '商品总价(元)', '商品总价') || '0').replace(/[^\d.\-]/g, '')) || 0;
        const skuKey = (String(findField(o, '样式ID') || '').trim()) ? `${String(findField(o, '商品id', '商品ID') || '').trim()}_${String(findField(o, '样式ID') || '').trim()}` : String(findField(o, '商品id', '商品ID') || '').trim();
        const adjustedRawCost = ab?.adjustedFields?.rawCost;
        const knownCost = adjustedRawCost != null ? adjustedRawCost : (productCosts[skuKey] || 0);
        const hasInsurance = insurance.some((r: any) => {
          const rno = String(findField(r, '订单编号', '订单号') || '').trim();
          return rno && rno === orderNo;
        });
        const estimatedRawCost = knownCost > 0
          ? knownCost * qty
          : (productTotal * (defaultCostRatio / 100));
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
        const estimatedCost = estimatedRawCost
          + packagingFeePerOrder
          + (laborFeePerOrder || 0)
          + (shippingFeePerOrder || 0)
          + insuranceCost2
          + (promotionFeePerOrder || 0)
          + platformCost2
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
  const activeLossAlerts = useMemo(() => lossAlerts.filter(a => !dismissedAlerts.has(`loss_${a.orderNo}`)), [lossAlerts, dismissedAlerts]);
  const activeLowPayAlerts = useMemo(() => lowPayAlerts.filter(a => !dismissedAlerts.has(`lowPay_${a.orderNo}`)), [lowPayAlerts, dismissedAlerts]);
  const activeHighQtyAlerts = useMemo(() => highQtyAlerts.filter(a => !dismissedAlerts.has(`highQty_${a.orderNo}`)), [highQtyAlerts, dismissedAlerts]);

  // Enhanced pricing form
  const [pricingForm, setPricingForm] = useState({
    name: '', code: '', rawCost: 0, shipping: 0, promotion: 0,
    packagingFee: 0, platformCommissionRate: 0, miscFees: 0, profitRate: 30,
  });
  const [savedMsg, setSavedMsg] = useState('');

  const totalPricingCosts = pricingForm.rawCost + pricingForm.shipping + pricingForm.promotion + pricingForm.packagingFee + pricingForm.miscFees + (laborFeePerOrder || 0) + (insuranceFeePerOrder || 0);
  const commissionRate = pricingForm.platformCommissionRate / 100;
  const targetProfitRate = pricingForm.profitRate / 100;
  const totalDeductRate = commissionRate + targetProfitRate;
  const pricingError = totalDeductRate >= 1 ? '佣金率+目标利润率不能超过100%' : '';
  const denominator = 1 - totalDeductRate;
  const suggestedPrice = pricingForm.rawCost > 0 && denominator > 0
    ? totalPricingCosts / denominator
    : 0;
  const estimatedProfit = suggestedPrice > 0
    ? suggestedPrice - totalPricingCosts - (suggestedPrice * commissionRate)
    : 0;

  const handleSavePricing = () => {
    if (!pricingForm.code.trim()) return;
    addPricingPreset({
      ...pricingForm, suggestedPrice, createdAt: new Date().toISOString()
    });
    if (pricingForm.rawCost > 0) setProductCost(pricingForm.code, pricingForm.rawCost);
    setSavedMsg('保存成功');
    setTimeout(() => setSavedMsg(''), 2000);
    setPricingForm({ name: '', code: '', rawCost: 0, shipping: 0, promotion: 0, packagingFee: 0, platformCommissionRate: 0, miscFees: 0, profitRate: 30 });
  };

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

  const handleImportCosts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) { setImportStatus({ type: 'error', msg: '文件为空或格式不正确' }); return; }

        const headers = parseCsvLine(lines[0]);
        const costIdx = headers.findIndex(h => h.includes('成本') || h.toLowerCase().includes('cost'));
        const idIdx = headers.findIndex(h => h.includes('商品ID') || h.toLowerCase().includes('product'));
        const skuIdx = headers.findIndex(h => h.includes('SKU') || h.toLowerCase().includes('sku'));

        if (costIdx < 0) { setImportStatus({ type: 'error', msg: '未找到成本列，请确保表头包含"成本"关键字' }); return; }

        let successCount = 0, skipCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCsvLine(lines[i]);
          const productId = cols[idIdx >= 0 ? idIdx : 0];
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
      } catch (err) {
        setImportStatus({ type: 'error', msg: '解析文件失败，请检查CSV格式' });
      }
    };
    reader.readAsText(file);
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

  // Tax handlers
  const handleAddTax = () => {
    if (!taxForm.name || !taxForm.rate) return;
    addTaxConfig({
      id: Date.now().toString(), name: taxForm.name, taxType: taxForm.taxType || 'vat',
      rate: taxForm.rate || 0, base: taxForm.base || 'revenue', enabled: taxForm.enabled ?? true,
      description: taxForm.description
    });
    setTaxForm({ name: '', taxType: 'vat', rate: 0, base: 'revenue', enabled: true, description: '' });
    setShowTaxForm(false);
  };

  const applyTaxTemplate = (type: 'small' | 'general') => {
    const existingNames = new Set((taxConfigs || []).map(t => t.name));
    if (type === 'small') {
      if (!existingNames.has('增值税(小规模)')) addTaxConfig({ id: Date.now().toString() + '1', name: '增值税(小规模)', taxType: 'vat', rate: 1, base: 'revenue', enabled: true });
      if (!existingNames.has('附加税')) addTaxConfig({ id: Date.now().toString() + '2', name: '附加税', taxType: 'surcharge', rate: 6, base: 'vat', enabled: true });
    } else {
      if (!existingNames.has('增值税(一般纳税人)')) addTaxConfig({ id: Date.now().toString() + '1', name: '增值税(一般纳税人)', taxType: 'vat', rate: 6, base: 'revenue', enabled: true });
      if (!existingNames.has('附加税')) addTaxConfig({ id: Date.now().toString() + '2', name: '附加税', taxType: 'surcharge', rate: 12, base: 'vat', enabled: true });
      if (!existingNames.has('企业所得税')) addTaxConfig({ id: Date.now().toString() + '3', name: '企业所得税', taxType: 'income', rate: 25, base: 'profit', enabled: true });
    }
  };

  const calculateTaxPreview = (revenue: number) => {
    let vatAmount = 0;
    // 估算利润：用配置的默认成本比例 + 履约费
    const estimatedCost = revenue * ((defaultCostRatio ?? 30) / 100) + (packagingFeePerOrder || 0) + (shippingFeePerOrder || 0);
    const estimatedProfit = Math.max(0, revenue - estimatedCost);
    const results: { name: string; amount: number; rate: number; base: number }[] = [];
    (taxConfigs || []).forEach(tax => {
      if (!tax.enabled) return;
      let base = revenue;
      if (tax.base === 'vat') base = vatAmount;
      if (tax.base === 'profit') base = estimatedProfit;
      const amount = base * (tax.rate / 100);
      if (tax.taxType === 'vat') vatAmount = amount;
      results.push({ name: tax.name, amount, rate: tax.rate, base });
    });
    return results;
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
          <div className="mt-3 ml-7 p-3 bg-pdd-card rounded-xl border border-pdd-border">
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
                  <span className="text-pdd-text-secondary">包装费</span>
                  <span className="font-mono text-pdd-text">
                    ¥{packagingFeePerOrder.toFixed(2)} × {sku.orderCount}单 = <b>¥{costInfo.totalPackaging.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {laborFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">人工费</span>
                  <span className="font-mono text-pdd-text">
                    ¥{laborFeePerOrder.toFixed(2)} × {sku.orderCount}单 = <b>¥{costInfo.totalLabor.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {shippingFeePerOrder > 0 && (
                <div className="flex items-center justify-between py-0.5">
                  <span className="text-pdd-text-secondary">快递费</span>
                  <span className="font-mono text-pdd-text">
                    ¥{shippingFeePerOrder.toFixed(2)} × {costInfo.shippingOrderCount}单 = <b>¥{costInfo.totalShipping.toFixed(2)}</b>
                  </span>
                </div>
              )}
              {shippingFeePerOrder > 0 && costInfo.shippingOrderCount < sku.orderCount && (
                <div className="text-[10px] text-pdd-text-secondary ml-2">&middot; {sku.orderCount}单中{costInfo.shippingOrderCount}单产生快递费，{sku.orderCount - costInfo.shippingOrderCount}单无快递</div>
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
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-3 ml-7 p-3 bg-pdd-bg rounded-xl border border-pdd-border">
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

  const taxPreview = calculateTaxPreview(1000);
  const fmt = (v: number) => v >= 10000 ? `¥${(v / 10000).toFixed(1)}万` : `¥${v.toFixed(0)}`;

  // ========== Tab: 成本概览 ==========
  const renderOverview = () => (
    <motion.div key="overview" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '商品总数', value: overviewStats.totalProducts, sub: `${overviewStats.productsWithCode} 个有编码`, icon: Package, color: 'var(--pdd-primary)', bg: 'rgba(59,130,246,0.1)' },
          { label: '成本覆盖率', value: `${overviewStats.costCoverage.toFixed(0)}%`, sub: `${overviewStats.skusWithCost}/${overviewStats.totalSkus} SKU`, icon: Percent, color: 'var(--pdd-success)', bg: 'rgba(34,197,94,0.1)' },
          { label: '总预估成本', value: fmt(overviewStats.totalEstimatedCost), sub: '基于已填成本计算', icon: DollarSign, color: 'var(--pdd-warning)', bg: 'rgba(245,158,11,0.1)' },
          { label: '平均单品成本', value: overviewStats.avgUnitCost > 0 ? `¥${overviewStats.avgUnitCost.toFixed(2)}` : '--', sub: '已填成本SKU均值', icon: TrendingUp, color: '#722ed1', bg: 'rgba(114,46,209,0.1)' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="pdd-card px-4 py-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: item.bg }}>
              <item.icon size={18} style={{ color: item.color }} />
            </div>
            <div>
              <div className="text-[11px] text-pdd-text-secondary">{item.label}</div>
              <div className="text-base font-bold text-pdd-text">{item.value}</div>
              <div className="text-[10px] text-pdd-text-secondary">{item.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: '管理商品成本', desc: '查看/编辑SKU裸货成本，批量导入', icon: Package, tab: 'costs', color: 'var(--pdd-primary)', bg: 'rgba(59,130,246,0.06)' },
          { label: '新品定价计算', desc: '输入成本因子，自动计算建议售价', icon: Calculator, tab: 'pricing', color: 'var(--pdd-success)', bg: 'rgba(34,197,94,0.06)' },
          { label: '税务配置', desc: '增值税/所得税/附加税设置', icon: Shield, tab: 'tax', color: 'var(--pdd-warning)', bg: 'rgba(245,158,11,0.06)' },
          { label: '自定义扣费', desc: '公式引擎，灵活定义扣费规则', icon: CalcIcon, tab: 'deductions', color: '#722ed1', bg: 'rgba(114,46,209,0.06)' },
        ].map((card, i) => (
          <motion.div key={card.tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            onClick={() => setActiveTab(card.tab)}
            className="pdd-card p-4 cursor-pointer hover:border-pdd-primary-light transition-all group">
            <div className="flex items-center gap-2 mb-2">
              <card.icon size={16} style={{ color: card.color }} />
              <span className="text-sm font-semibold text-pdd-text">{card.label}</span>
            </div>
            <p className="text-xs text-pdd-text-secondary">{card.desc}</p>
            <div className="mt-2 text-xs text-pdd-primary-light group-hover:underline">进入 →</div>
          </motion.div>
        ))}
      </div>

      {(costHistory || []).length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="pdd-card p-3">
          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><History size={14} className="text-pdd-text-secondary" />最近修改</h4>
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
                  <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleImportCosts} />
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

            {/* Batch cost bar */}
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2 mb-3 p-2 bg-pdd-bg rounded-lg">
                <span className="text-sm font-medium">已选 {selectedItems.size} 项</span>
                <input type="number" placeholder="批量设置裸货成本(元/件)" className="flex-1 px-2 py-1.5 border border-pdd-border rounded-lg text-sm"
                  value={batchCost} onChange={e => setBatchCost(e.target.value)} />
                <button onClick={applyBatchCost} className="px-3 py-1.5 bg-pdd-danger text-white rounded-lg text-sm hover:bg-pdd-darkRed transition-colors">
                  应用
                </button>
              </div>
            )}

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
                    <div className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-pdd-bg transition-colors ${isExpanded ? 'bg-pdd-bg' : ''}`}
                      onClick={() => hasMultipleSku && toggleProductExpand(group.productId)}>
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
                      <div className="flex items-center gap-3">
                        {firstSku.skuCode && <span className="text-[10px] text-pdd-success bg-pdd-success/10 px-2 py-0.5 rounded font-mono">{firstSku.skuCode}</span>}
                        {firstSku.productCode && !firstSku.skuCode && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-2 py-0.5 rounded font-mono">{firstSku.productCode}</span>}
                        <span className="text-sm text-pdd-text shrink-0">{formatPriceRange(group.minPrice, group.maxPrice)}</span>
                        {!hasMultipleSku && hasMultiplePrices && (
                          <button onClick={(e) => { e.stopPropagation(); togglePriceExpand(skuKey); }} className="p-0.5 hover:bg-pdd-bg rounded">
                            {expandedPrices.has(skuKey) ? <EyeOff size={14} className="text-pdd-text-secondary" /> : <Eye size={14} className="text-pdd-danger" />}
                          </button>
                        )}
                      </div>
                      {hasMultipleSku && (
                        isExpanded ? <ChevronUp size={16} className="text-pdd-text-secondary shrink-0" /> : <ChevronDown size={16} className="text-pdd-text-secondary shrink-0" />
                      )}
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
                    {hasMultipleSku && isExpanded && (
                      <div className="border-t border-pdd-border bg-pdd-card">
                        {group.skus.map(sku => renderSkuRow(sku, false))}
                      </div>
                    )}
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

  // ========== Tab: 定价计算器（增强版）==========
  const renderPricing = () => (
    <motion.div key="pricing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pdd-card p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Calculator size={16} className="text-pdd-primary" />成本因子</h3>
          <div className="bg-pdd-bg rounded-lg p-3 mb-4">
            <p className="text-xs text-pdd-text-secondary">公式: <span className="font-mono text-pdd-text">建议售价 = 总成本 / (1 - 佣金率 - 目标利润率)</span></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-pdd-text-secondary">商品名称</label>
              <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.name}
                onChange={e => setPricingForm(f => ({ ...f, name: e.target.value }))} placeholder="选填" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">商家编码 <span className="text-pdd-danger">*</span></label>
              <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.code}
                onChange={e => setPricingForm(f => ({ ...f, code: e.target.value }))} placeholder="必填" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">裸货成本(元)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.rawCost || ''}
                onChange={e => setPricingForm(f => ({ ...f, rawCost: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">运费(元)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.shipping || ''}
                onChange={e => setPricingForm(f => ({ ...f, shipping: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">推广费(元)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.promotion || ''}
                onChange={e => setPricingForm(f => ({ ...f, promotion: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">包装费(元)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.packagingFee || ''}
                onChange={e => setPricingForm(f => ({ ...f, packagingFee: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">平台佣金率(%)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.platformCommissionRate || ''}
                onChange={e => setPricingForm(f => ({ ...f, platformCommissionRate: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div>
              <label className="text-xs text-pdd-text-secondary">其他杂费(元)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.miscFees || ''}
                onChange={e => setPricingForm(f => ({ ...f, miscFees: parseFloat(e.target.value) || 0 }))} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="text-xs text-pdd-text-secondary">目标利润率(%)</label>
              <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={pricingForm.profitRate || ''}
                onChange={e => setPricingForm(f => ({ ...f, profitRate: parseFloat(e.target.value) || 0 }))} placeholder="30" />
            </div>
          </div>
          <button onClick={handleSavePricing}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 bg-pdd-primary text-white rounded-lg text-sm hover:opacity-90 transition-opacity font-medium">
            <Save size={14} />保存预设
          </button>
          {savedMsg && <p className="text-pdd-success text-sm mt-2 text-center">{savedMsg}</p>}
        </div>

        <div className="pdd-card p-4">
          <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp size={16} className="text-pdd-success" />计算结果</h3>
          {pricingError ? (
            <div className="h-64 flex items-center justify-center text-sm text-pdd-danger">
              {pricingError}
            </div>
          ) : suggestedPrice > 0 ? (
            <div className="space-y-4">
              <div className="bg-gradient-to-br from-pdd-primary/10 to-pdd-success/10 rounded-xl p-5 text-center">
                <p className="text-xs text-pdd-text-secondary mb-1">建议售价</p>
                <p className="text-3xl font-bold text-pdd-primary">¥{suggestedPrice.toFixed(2)}</p>
              </div>
              <div className="space-y-2">
                {[
                  { label: '成本合计', value: totalPricingCosts, color: 'var(--pdd-text)' },
                  { label: '平台佣金', value: suggestedPrice * commissionRate, color: 'var(--pdd-warning)' },
                  { label: '毛利润', value: estimatedProfit, color: estimatedProfit > 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-pdd-border last:border-0">
                    <span className="text-xs text-pdd-text-secondary">{row.label}</span>
                    <span className="text-sm font-semibold" style={{ color: row.color }}>¥{row.value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {/* Cost structure mini pie */}
              <div className="h-36">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={[
                      { name: '裸货成本', value: pricingForm.rawCost },
                      { name: '运费', value: pricingForm.shipping },
                      { name: '推广费', value: pricingForm.promotion },
                      { name: '包装费', value: pricingForm.packagingFee },
                      { name: '佣金', value: suggestedPrice * commissionRate },
                      { name: '其他', value: pricingForm.miscFees },
                    ].filter(d => d.value > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={55} innerRadius={35}>
                      <Cell fill="var(--pdd-danger)" />
                      <Cell fill="var(--pdd-primary)" />
                      <Cell fill="var(--pdd-warning)" />
                      <Cell fill="var(--pdd-success)" />
                      <Cell fill="#722ed1" />
                      <Cell fill="var(--pdd-text)" />
                    </Pie>
                    <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-64 flex items-center justify-center text-sm text-pdd-text-secondary">
              输入裸货成本后开始计算
            </div>
          )}
        </div>
      </div>

      {pricingPresets.length > 0 && (
        <div className="pdd-card p-4">
          <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-bg rounded-lg border border-pdd-border">
            <Search size={16} className="text-pdd-text-secondary" />
            <input type="text" placeholder="搜索名称/编码..." className="flex-1 text-sm outline-none bg-transparent"
              value={pricingSearchQuery} onChange={e => setPricingSearchQuery(e.target.value)} />
            {pricingSearchQuery && (
              <button onClick={() => setPricingSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">重置</button>
            )}
          </div>
          <h3 className="font-medium text-sm mb-3">已保存预设 ({filteredPricingPresets.length})</h3>
          <div className="space-y-1">
            {filteredPricingPresets.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2.5 px-3 border-b border-pdd-border last:border-0 text-sm hover:bg-pdd-bg rounded-lg transition-colors">
                <div>
                  <span className="font-medium text-pdd-text">{p.name || p.code}</span>
                  {p.name && <span className="text-xs text-pdd-text-secondary ml-2">{p.code}</span>}
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-pdd-text-secondary">成本 ¥{p.rawCost}</span>
                  <span className="text-pdd-text-secondary">→</span>
                  <span className="text-pdd-primary font-semibold">售价 ¥{p.suggestedPrice?.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );

  // ========== Tab: 税务配置 ==========
  const renderTax = () => (
    <motion.div key="tax" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="pdd-card p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">税务配置</h3>
          <div className="flex items-center gap-2">
            <button onClick={() => applyTaxTemplate('small')} className="px-3 py-1.5 border border-pdd-border rounded-lg text-xs hover:bg-pdd-bg transition-colors">
              小规模纳税人
            </button>
            <button onClick={() => applyTaxTemplate('general')} className="px-3 py-1.5 border border-pdd-border rounded-lg text-xs hover:bg-pdd-bg transition-colors">
              一般纳税人
            </button>
            <button onClick={() => setShowTaxForm(!showTaxForm)}
              className="flex items-center gap-1 px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-xs hover:opacity-90 transition-opacity">
              <Plus size={14} /> 添加税种
            </button>
          </div>
        </div>

        {showTaxForm && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-bg rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-pdd-text-secondary">税种名称</label>
                <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={taxForm.name}
                  onChange={e => setTaxForm(f => ({ ...f, name: e.target.value }))} placeholder="如: 增值税" />
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">税率(%)</label>
                <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={taxForm.rate || ''}
                  onChange={e => setTaxForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))} placeholder="如: 13" />
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">税种类型</label>
                <select className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                  value={taxForm.taxType} onChange={e => setTaxForm(f => ({ ...f, taxType: e.target.value as TaxConfig['taxType'] }))}>
                  <option value="vat">增值税</option>
                  <option value="income">所得税</option>
                  <option value="surcharge">附加税</option>
                  <option value="custom">自定义</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-pdd-text-secondary">计税基数</label>
                <select className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                  value={taxForm.base} onChange={e => setTaxForm(f => ({ ...f, base: e.target.value as TaxConfig['base'] }))}>
                  <option value="revenue">实收金额</option>
                  <option value="profit">利润</option>
                  <option value="vat">增值税额</option>
                  <option value="gmv">GMV</option>
                  <option value="orders">订单数</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-pdd-text-secondary">备注</label>
                <input className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1" value={taxForm.description || ''}
                  onChange={e => setTaxForm(f => ({ ...f, description: e.target.value }))} placeholder="可选" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3">
              <button onClick={handleAddTax} className="px-4 py-1.5 bg-pdd-primary text-white rounded-lg text-sm hover:opacity-90">保存</button>
              <button onClick={() => setShowTaxForm(false)} className="px-4 py-1.5 border border-pdd-border rounded-lg text-sm hover:bg-pdd-bg">取消</button>
            </div>
          </motion.div>
        )}

        {(taxConfigs || []).length > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-bg rounded-lg border border-pdd-border">
            <Search size={16} className="text-pdd-text-secondary" />
            <input type="text" placeholder="搜索税种名称..." className="flex-1 text-sm outline-none bg-transparent"
              value={taxSearchQuery} onChange={e => setTaxSearchQuery(e.target.value)} />
            {taxSearchQuery && <button onClick={() => setTaxSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">重置</button>}
          </div>
        )}

        {(taxConfigs || []).length === 0 ? (
          <div className="text-center py-8 text-pdd-text-secondary text-sm">暂无税务配置，使用模板快速开始或手动添加</div>
        ) : filteredTaxConfigs.length === 0 ? (
          <div className="text-center py-8 text-pdd-text-secondary text-sm">无匹配数据</div>
        ) : (
          <div className="grid gap-2">
            {filteredTaxConfigs.map(tax => (
              <div key={tax.id} className="flex items-center gap-3 p-3 border border-pdd-border rounded-lg hover:bg-pdd-bg transition-colors">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{
                  backgroundColor: tax.taxType === 'vat' ? 'rgba(59,130,246,0.1)' : tax.taxType === 'income' ? 'rgba(34,197,94,0.1)' : tax.taxType === 'surcharge' ? 'rgba(245,158,11,0.1)' : 'rgba(100,116,139,0.1)'
                }}>
                  <Shield size={16} style={{
                    color: tax.taxType === 'vat' ? 'var(--pdd-primary)' : tax.taxType === 'income' ? 'var(--pdd-success)' : tax.taxType === 'surcharge' ? 'var(--pdd-warning)' : 'var(--pdd-text)'
                  }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-pdd-text">{tax.name}</p>
                  <p className="text-xs text-pdd-text-secondary">
                    {tax.taxType === 'vat' ? '增值税' : tax.taxType === 'income' ? '所得税' : tax.taxType === 'surcharge' ? '附加税' : '自定义'}
                    {' · '}计税基数: {tax.base === 'revenue' ? '实收金额' : tax.base === 'profit' ? '利润' : tax.base === 'vat' ? '增值税额' : tax.base === 'gmv' ? 'GMV' : '订单数'}
                  </p>
                </div>
                <span className="text-lg font-bold text-pdd-primary shrink-0">{tax.rate}%</span>
                <input type="checkbox" checked={tax.enabled} onChange={() => updateTaxConfig(tax.id, { enabled: !tax.enabled })}
                  className="w-4 h-4 rounded shrink-0 cursor-pointer" />
                <button onClick={() => removeTaxConfig(tax.id)} className="p-1.5 hover:bg-pdd-danger/10 rounded-lg text-pdd-danger shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 bg-pdd-bg rounded-lg p-4">
          <h4 className="font-medium text-sm mb-2">实时预览 (假设实收 ¥1,000)</h4>
          {taxPreview.length === 0 ? (
            <p className="text-sm text-pdd-text-secondary">未配置启用的税费</p>
          ) : (
            <>
              <div className="space-y-1 text-sm">
                {taxPreview.map((t, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-pdd-text-secondary">{t.name} ({t.rate}% × ¥{t.base.toFixed(2)})</span>
                    <span className="font-medium text-pdd-text">¥{t.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-pdd-border pt-2 mt-2 flex items-center justify-between font-bold">
                <span>合计税费</span>
                <span className="text-pdd-danger">¥{taxPreview.reduce((s, t) => s + t.amount, 0).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );

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
                  style={{ backgroundColor: ded.scope === 'global' ? 'rgba(59,130,246,0.1)' : 'rgba(114,46,209,0.1)' }}>
                  <CalcIcon size={16} style={{ color: ded.scope === 'global' ? 'var(--pdd-primary)' : '#722ed1' }} />
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: '一单多SKU', count: activeMultiSkuAlerts.length, color: 'var(--pdd-warning)', bg: 'rgba(245,158,11,0.1)', desc: '包装/快递费重复计算', type: 'multiSku' as const },
          { label: '一单多件', count: activeMultiItemAlerts.length, color: 'var(--pdd-primary)', bg: 'rgba(59,130,246,0.1)', desc: '数量>1单品成本', type: 'multiItem' as const },
          { label: '亏损订单', count: activeLossAlerts.length, color: 'var(--pdd-danger)', bg: 'rgba(239,68,68,0.1)', desc: '实收 < 预估成本', type: 'loss' as const },
          { label: '低支付金额', count: activeLowPayAlerts.length, color: '#722ed1', bg: 'rgba(114,46,209,0.1)', desc: '实收<¥5或比<10%', type: 'lowPay' as const },
          { label: '高数量异常', count: activeHighQtyAlerts.length, color: '#fa541c', bg: 'rgba(250,84,28,0.1)', desc: '件数≥50异常数据', type: 'highQty' as const },
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

      {/* 异常列表 */}
      {filteredAlerts.length === 0 ? (
        <div className="text-center py-12 text-pdd-text-secondary">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{alertFilter === 'all' ? '未检测到成本异常，一切正常' : '该类型无异常订单'}</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[55vh] overflow-y-auto">
          {filteredAlerts.map((alert, idx) => {
            const a = alert.data;
            const typeConfig = {
              multiSku: { label: '一单多SKU', color: 'var(--pdd-warning)', bg: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.25)', icon: Package },
              multiItem: { label: '一单多件', color: 'var(--pdd-primary)', bg: 'rgba(59,130,246,0.06)', borderColor: 'rgba(59,130,246,0.25)', icon: Package },
              loss: { label: '亏损订单', color: 'var(--pdd-danger)', bg: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.25)', icon: TrendingUp },
              lowPay: { label: '低支付金额', color: '#722ed1', bg: 'rgba(114,46,209,0.06)', borderColor: 'rgba(114,46,209,0.25)', icon: DollarSign },
              highQty: { label: '高数量异常', color: '#fa541c', bg: 'rgba(250,84,28,0.06)', borderColor: 'rgba(250,84,28,0.25)', icon: AlertTriangle },
            }[alert.type]!;

            const record = abnormalOrders[a.orderNo];
            const isProcessed = record ? (record.alertTypes || []).includes(alert.type) : false;
            const actionOpen = alertActionOpen.has(`${a.orderNo}_${alert.type}`);

            return (
              <div key={`${alert.type}_${a.orderNo}`} className={`pdd-card p-3 border rounded-xl transition-all ${isProcessed ? 'opacity-75' : ''}`} style={{ borderColor: isProcessed ? 'rgba(34,197,94,0.3)' : typeConfig.borderColor, backgroundColor: isProcessed ? 'rgba(34,197,94,0.02)' : typeConfig.bg }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 shrink-0">
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
                            （{a.costEstimated ? `按商品总价×${defaultCostRatio}%估算成本` : `裸货成本 ¥${a.cost.toFixed(2)}/件×${a.qty}件`} + 包装¥{packagingFeePerOrder.toFixed(2)} + 人工¥{(laborFeePerOrder || 0).toFixed(2)} + 快递¥{(shippingFeePerOrder || 0).toFixed(2)} + 平台扣点¥{(a.merchant * platformCommissionRate / 100).toFixed(2)} = ¥{a.estimatedCost.toFixed(2)} &gt; 实收 ¥{a.merchant.toFixed(2)}）
                          </span>
                        </div>
                      </>
                    )}
                    {alert.type === 'lowPay' && (
                      <>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold" style={{ color: '#722ed1' }}>¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">商品总价: </span><span className="font-semibold text-pdd-text">¥{a.productTotal.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">实收比: </span>
                          <span className="font-semibold" style={{ color: a.productTotal > 0 && a.merchant / a.productTotal < 0.1 ? 'var(--pdd-danger)' : '#722ed1' }}>
                            {a.productTotal > 0 ? (a.merchant / a.productTotal * 100).toFixed(1) : '--'}%
                          </span>
                        </div>
                        <div className="col-span-3 mt-1 p-2 bg-purple-500/10 rounded-lg">
                          <span className="text-[11px] font-medium" style={{ color: '#722ed1' }}>建议: 确认订单性质</span>
                          <span className="text-[10px] text-pdd-text-secondary ml-2">（实收 ¥{a.merchant.toFixed(2)}{a.merchant < 5 ? ' < ¥5' : '，比率偏低'}，可能为促销/刷单/异常数据，确认后可标记忽略）</span>
                        </div>
                      </>
                    )}
                    {alert.type === 'highQty' && (
                      <>
                        <div><span className="text-pdd-text-secondary">数量: </span><span className="font-semibold" style={{ color: '#fa541c' }}>{a.qty}件</span></div>
                        <div><span className="text-pdd-text-secondary">实收: </span><span className="font-semibold text-pdd-text">¥{a.merchant.toFixed(2)}</span></div>
                        <div><span className="text-pdd-text-secondary">单价: </span>
                          <span className="font-semibold" style={{ color: a.unitPrice < 1 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>
                            ¥{a.unitPrice.toFixed(2)}/件
                          </span>
                        </div>
                        <div className="col-span-3 mt-1 p-2 bg-orange-500/10 rounded-lg">
                          <span className="text-[11px] font-medium" style={{ color: '#fa541c' }}>建议: 核实是否异常数据</span>
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
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-pdd-text">成本管理</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQuickSettings(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-sm hover:opacity-90 transition-opacity">
            <Zap size={14} /> 快速设置
          </button>
          <button onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-pdd-border rounded-lg text-sm hover:bg-pdd-bg transition-colors">
            <Settings size={14} /> 全局设置
          </button>
        </div>
      </div>

      {/* Global settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="pdd-card overflow-hidden">
            <div className="p-4">
              <h3 className="font-medium mb-3 flex items-center gap-2"><DollarSign size={16} />成本计算设置</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-pdd-text-secondary">每单包装/人工费(元)</label>
                    <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                      value={tempPackagingFee} onChange={e => setTempPackagingFee(e.target.value)} placeholder="0.00" />
                    <p className="text-xs text-pdd-text-secondary mt-1">每个订单只收一次包装费</p>
                  </div>
                  <div>
                    <label className="text-xs text-pdd-text-secondary">默认成本比例(%)</label>
                    <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                      value={tempDefaultCostRatio} onChange={e => setTempDefaultCostRatio(e.target.value)} placeholder="30" />
                    <p className="text-xs text-pdd-text-secondary mt-1">无成本数据时按实收金额的比例估算</p>
                  </div>
                  <div>
                    <label className="text-xs text-pdd-text-secondary">快递费/单(元)</label>
                    <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded-lg text-sm mt-1"
                      value={tempShippingFee} onChange={e => setTempShippingFee(e.target.value)} placeholder="0.00" />
                    <p className="text-xs text-pdd-text-secondary mt-1">每单固定快递费用</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button onClick={savePackagingFee} className="px-4 py-1.5 bg-pdd-primary text-white rounded-lg text-sm hover:opacity-90">
                      保存设置
                    </button>
                    <button onClick={() => setShowImportHelp(!showImportHelp)}
                      className="flex items-center gap-1 px-3 py-1.5 border border-pdd-border rounded-lg text-sm hover:bg-pdd-bg">
                      <Upload size={14} /> 批量导入成本
                    </button>
                  </div>
                  {showImportHelp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      className="bg-pdd-primary/10 rounded-lg p-3 text-xs">
                      <p className="font-medium mb-1">CSV格式说明:</p>
                      <p className="text-pdd-text-secondary mb-1">商品ID/SKU编码,成本单价</p>
                      <p className="text-pdd-text-secondary">示例: 12345,15.50 或 12345_SKU001,20.00</p>
                    </motion.div>
                  )}
                </div>
                <div className="bg-pdd-bg rounded-lg p-3">
                  <p className="text-xs text-pdd-text-secondary mb-2">成本计算公式:</p>
                  <p className="text-sm font-medium">总成本 = 裸货成本×件数 + (包装+人工+快递+运费险+推广费)×订单数 + 平台扣点 + 自定义扣费</p>
                  <p className="text-xs text-pdd-text-secondary mt-2">示例: 裸货成本10元/件，包装2元/单，快递3元/单，人工1元/单</p>
                  <p className="text-xs text-pdd-text-secondary">1单2件 = 10×2 + (2+1+3)×1 = 26元</p>
                  <p className="text-xs text-pdd-text-secondary mt-3">税费、平台扣点和自定义扣费将在利润计算中自动扣除</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick-settings modal */}
      <AnimatePresence>
        {showQuickSettings && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowQuickSettings(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="bg-pdd-card border border-pdd-border rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-pdd-text flex items-center gap-2"><Zap size={18} className="text-pdd-warning" />通用费用快速设置</h3>
                <button onClick={() => setShowQuickSettings(false)} className="p-1 hover:bg-pdd-bg rounded-lg text-pdd-text-secondary hover:text-pdd-text transition-colors"><X size={18} /></button>
              </div>
              <p className="text-xs text-pdd-text-secondary mb-4">这些费用将应用于所有商品成本计算，均为选填。</p>
              <div className="space-y-4">
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
              </div>
              <button onClick={saveQuickSettings}
                className="mt-5 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pdd-primary to-indigo-500 text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
                <Save size={15} /> 保存设置
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <TimeFilter state={tf} />

      {/* Tab navigation */}
      <div className="flex gap-1 bg-pdd-card rounded-xl px-1.5 py-1 border border-pdd-border shadow-sm overflow-x-auto">
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
      {activeTab === 'pricing' && renderPricing()}
      {activeTab === 'tax' && renderTax()}
      {activeTab === 'deductions' && renderDeductions()}
      {activeTab === 'alerts' && renderAlerts()}
    </div>
  );
}

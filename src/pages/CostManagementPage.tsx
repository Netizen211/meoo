import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Edit3, Calculator, Save, AlertCircle, Check, ChevronDown, ChevronUp, Eye, EyeOff, X, Settings, DollarSign, Plus, Trash2, Shield, Calculator as CalcIcon, Upload, History, ArrowUp, ArrowDown, Download, Search } from 'lucide-react';
import { useData } from '../App';
import type { TaxConfig, CustomDeduction } from '../components/ProductLinkStats';
import { validateFormula } from '../utils/formulaEngine';
import TimeFilter, { TimeRange, TimeGranularity, filterByTimeRange, getAllDateGroups } from '../components/TimeFilter';

const TABS = [
  { key: 'missing', label: '缺编码SKU', Icon: AlertCircle },
  { key: 'costs', label: '裸货成本填充', Icon: Edit3 },
  { key: 'pricing', label: '新品定价预设', Icon: Calculator },
  { key: 'tax', label: '税务配置', Icon: Shield },
  { key: 'deductions', label: '自定义扣费', Icon: CalcIcon },
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

export default function CostManagementPage() {
  const [activeTab, setActiveTab] = useState('missing');
  const [timeRange, setTimeRange] = useState<TimeRange>('7');
  const [granularity, setGranularity] = useState<TimeGranularity>('day');
  const [compareEnabled, setCompareEnabled] = useState(false);
  const tfState = { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled };

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
    costHistory,
    addCostHistory
  } = useData();

  const allOrders = currentDisplayData?.orders || [];
  const allDates = useMemo(() => getAllDateGroups(allOrders), [allOrders]);
  const filteredOrders = useMemo(() => filterByTimeRange(allOrders, allDates, timeRange), [allOrders, allDates, timeRange]);
  // 仅在缺编码SKU和裸货成本填充Tab使用时间过滤后的订单
  const orders = (activeTab === 'missing' || activeTab === 'costs') ? filteredOrders : allOrders;

  const productGroups = useMemo(() => {
    const groups = new Map<string, ProductGroup>();
    const skuMap = new Map<string, SkuItem>();

    orders.forEach(o => {
      const productId = String(o['商品id'] || '').trim();
      const productName = String(o['商品'] || '').trim();
      const skuId = String(o['样式ID'] || '').trim();
      const skuName = String(o['商品规格'] || '').trim();
      const productCode = String(o['商家编码-商品维度'] || '').trim();
      const skuCode = String(o['商家编码-规格维度'] || '').trim();
      const price = parseFloat(String(o['商家实收金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0;

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
          productId,
          productName,
          skuId,
          skuName,
          productCode,
          skuCode,
          hasProductCode: !!productCode,
          hasSkuCode: !!skuCode,
          prices: [],
          orderCount: 0,
          itemCount: 0
        };
        skuMap.set(skuKey, skuItem);
        group.skus.push(skuItem);
      }

      const sku = skuMap.get(skuKey)!;
      sku.orderCount++;
      const itemQty = parseInt(String(o['商品数量(件)'] || '1').replace(/[^\d]/g, '')) || 1;
      sku.itemCount += itemQty;
      group.totalItems += itemQty;
      if (price > 0) sku.prices.push(price);
    });

    groups.forEach(g => {
      g.skus.sort((a, b) => a.skuName.localeCompare(b.skuName));
    });

    return Array.from(groups.values());
  }, [orders]);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [batchCost, setBatchCost] = useState('');
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPrices, setExpandedPrices] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [tempPackagingFee, setTempPackagingFee] = useState(String(packagingFeePerOrder));
  const [tempDefaultCostRatio, setTempDefaultCostRatio] = useState(String(defaultCostRatio || 30));
  const [tempShippingFee, setTempShippingFee] = useState(String(shippingFeePerOrder || 0));
  const [showImportHelp, setShowImportHelp] = useState(false);
  const [showCostHistory, setShowCostHistory] = useState(false);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter states for each tab - MUST be declared before useMemo hooks that use them
  // Missing SKU tab filters
  const [missingSearchQuery, setMissingSearchQuery] = useState('');
  const [missingPriceMin, setMissingPriceMin] = useState('');
  const [missingPriceMax, setMissingPriceMax] = useState('');
  const [missingOrderMin, setMissingOrderMin] = useState('');
  const [missingOrderMax, setMissingOrderMax] = useState('');
  const [missingSortBy, setMissingSortBy] = useState<'orders' | 'items' | 'price'>('orders');
  const [missingSortOrder, setMissingSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showMissingFilters, setShowMissingFilters] = useState(false);

  // Pricing preset tab filters
  const [pricingSearchQuery, setPricingSearchQuery] = useState('');
  const [pricingCostMin, setPricingCostMin] = useState('');
  const [pricingCostMax, setPricingCostMax] = useState('');
  const [pricingSortBy, setPricingSortBy] = useState<'name' | 'cost' | 'suggestedPrice'>('name');
  const [pricingSortOrder, setPricingSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showPricingFilters, setShowPricingFilters] = useState(false);

  // Tax config tab filters
  const [taxSearchQuery, setTaxSearchQuery] = useState('');
  const [taxRateMin, setTaxRateMin] = useState('');
  const [taxRateMax, setTaxRateMax] = useState('');
  const [taxSortBy, setTaxSortBy] = useState<'name' | 'rate' | 'type'>('name');
  const [taxSortOrder, setTaxSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showTaxFilters, setShowTaxFilters] = useState(false);

  // Deductions tab filters
  const [deductionSearchQuery, setDeductionSearchQuery] = useState('');
  const [deductionAmountMin, setDeductionAmountMin] = useState('');
  const [deductionAmountMax, setDeductionAmountMax] = useState('');
  const [deductionSortBy, setDeductionSortBy] = useState<'name' | 'scope' | 'order'>('order');
  const [deductionSortOrder, setDeductionSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showDeductionFilters, setShowDeductionFilters] = useState(false);

  // Tax config states
  const [showTaxForm, setShowTaxForm] = useState(false);
  const [taxForm, setTaxForm] = useState<Partial<TaxConfig>>({
    name: '',
    taxType: 'vat',
    rate: 0,
    base: 'revenue',
    enabled: true,
    description: ''
  });

  // Custom deduction states
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState<Partial<CustomDeduction>>({
    name: '',
    formula: '',
    scope: 'global',
    enabled: true,
    condition: '',
    effectiveFrom: '',
    effectiveTo: ''
  });
  const [formulaValidation, setFormulaValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  // Derived data - useMemo hooks that depend on filter states (declared above)
  const missingCodeProducts = useMemo(() =>
    productGroups.filter(g => g.skus.some(s => !s.hasProductCode && !s.hasSkuCode)),
    [productGroups]
  );

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

  const toggleSelect = (key: string) => {
    const newSet = new Set(selectedItems);
    if (newSet.has(key)) newSet.delete(key);
    else newSet.add(key);
    setSelectedItems(newSet);
  };

  const toggleSelectAll = () => {
    const allKeys: string[] = [];
    productGroups.forEach(g => {
      if (g.skus.length === 1 && !g.skus[0].skuId) {
        allKeys.push(g.productId);
      } else {
        g.skus.forEach(s => {
          allKeys.push(s.skuId ? `${s.productId}_${s.skuId}` : s.productId);
        });
      }
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
      setCostConfig(key, { rawCost: cost, packagingFee: packagingFeePerOrder, updatedAt: new Date().toISOString() });
      // Add to history
      const product = productGroups.find(g => g.productId === key || g.skus.some(s => `${s.productId}_${s.skuId}` === key));
      if (product) {
        addCostHistory({
          productId: key,
          productName: product.productName,
          field: 'rawCost',
          oldValue: oldCost,
          newValue: cost,
          reason: '批量设置成本'
        });
      }
    });
    setSelectedItems(new Set());
    setBatchCost('');
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setBatchCost('');
  };

  const toggleProductExpand = (productId: string) => {
    const newSet = new Set(expandedProducts);
    if (newSet.has(productId)) newSet.delete(productId);
    else newSet.add(productId);
    setExpandedProducts(newSet);
  };

  const togglePriceExpand = (skuKey: string) => {
    const newSet = new Set(expandedPrices);
    if (newSet.has(skuKey)) newSet.delete(skuKey);
    else newSet.add(skuKey);
    setExpandedPrices(newSet);
  };

  const savePackagingFee = () => {
    setPackagingFeePerOrder(parseFloat(tempPackagingFee) || 0);
    setDefaultCostRatio(parseFloat(tempDefaultCostRatio) || 30);
    setShippingFeePerOrder(parseFloat(tempShippingFee) || 0);
    setShowSettings(false);
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
    if (rawCost <= 0) return null;
    const totalRawCost = rawCost * sku.itemCount;
    const totalPackaging = packagingFeePerOrder * sku.orderCount;
    const totalShipping = (shippingFeePerOrder || 0) * sku.orderCount;
    return { rawCost, totalRawCost, totalPackaging, totalShipping, total: totalRawCost + totalPackaging + totalShipping };
  };

  const [pricingForm, setPricingForm] = useState({
    name: '', code: '', rawCost: 0, shipping: 0, promotion: 0, profitRate: 30,
  });
  const [savedMsg, setSavedMsg] = useState('');

  const suggestedPrice = pricingForm.rawCost > 0
    ? pricingForm.rawCost + pricingForm.shipping + pricingForm.promotion + pricingForm.rawCost * pricingForm.profitRate / 100
    : 0;

  const handleSavePricing = () => {
    if (!pricingForm.code.trim()) return;
    addPricingPreset({ ...pricingForm, suggestedPrice, createdAt: new Date().toISOString() });
    if (pricingForm.rawCost > 0) setProductCost(pricingForm.code, pricingForm.rawCost);
    setSavedMsg('保存成功');
    setTimeout(() => setSavedMsg(''), 2000);
    setPricingForm({ name: '', code: '', rawCost: 0, shipping: 0, promotion: 0, profitRate: 30 });
  };

  // 导出SKU成本模板CSV
  const exportSkuTemplate = () => {
    const headers = ['商品ID', 'SKU_ID', '商品名称', '规格', '商家编码', '当前成本(元/件)', '订单数', '件数'];
    const rows = productGroups.flatMap(g =>
      g.skus.map(s => {
        const skuKey = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
        return [
          s.productId,
          s.skuId || '',
          `"${(s.productName || '').replace(/"/g, '""')}"`,
          `"${(s.skuName || '').replace(/"/g, '""')}"`,
          s.skuCode || s.productCode || '',
          productCosts[skuKey] || '',
          s.orderCount,
          s.itemCount
        ].join(',');
      })
    );
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SKU成本模板_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 批量导入成本CSV
  const handleImportCosts = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (lines.length < 2) {
          setImportStatus({ type: 'error', msg: '文件为空或格式不正确' });
          return;
        }

        // 解析表头，找到"当前成本"列索引
        const headerLine = lines[0];
        const headers = headerLine.split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const costIdx = headers.findIndex(h => h.includes('成本') || h.toLowerCase().includes('cost'));
        const idIdx = headers.findIndex(h => h.includes('商品ID') || h.toLowerCase().includes('product'));
        const skuIdx = headers.findIndex(h => h.includes('SKU') || h.toLowerCase().includes('sku'));

        if (costIdx < 0) {
          setImportStatus({ type: 'error', msg: '未找到成本列，请确保表头包含"成本"关键字' });
          return;
        }

        let successCount = 0;
        let skipCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          const productId = cols[idIdx >= 0 ? idIdx : 0];
          const skuId = skuIdx >= 0 ? cols[skuIdx] : '';
          const costVal = parseFloat(cols[costIdx]);

          if (!productId || isNaN(costVal) || costVal <= 0) {
            skipCount++;
            continue;
          }

          const skuKey = skuId ? `${productId}_${skuId}` : productId;
          const oldCost = productCosts[skuKey] || 0;
          setProductCost(skuKey, costVal);
          setCostConfig(skuKey, { rawCost: costVal, packagingFee: packagingFeePerOrder, updatedAt: new Date().toISOString() });

          const product = productGroups.find(g => g.productId === productId || g.skus.some(s => `${s.productId}_${s.skuId}` === skuKey));
          if (product) {
          addCostHistory({
            productId: skuKey,
            productName: product.productName,
            field: 'rawCost',
            oldValue: oldCost,
            newValue: costVal,
            reason: '导入成本数据'
          });
          }
          successCount++;
        }

        setImportStatus({
          type: 'success',
          msg: `成功导入 ${successCount} 条成本数据${skipCount > 0 ? `，跳过 ${skipCount} 条无效数据` : ''}`
        });
      } catch (err) {
        setImportStatus({ type: 'error', msg: '解析文件失败，请检查CSV格式' });
      }
    };
    reader.readAsText(file);
    // 重置input以允许重复选择同一文件
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCostChange = (skuKey: string, cost: number) => {
    const oldCost = productCosts[skuKey] || 0;
    setProductCost(skuKey, cost);
    setCostConfig(skuKey, { rawCost: cost, packagingFee: packagingFeePerOrder, updatedAt: new Date().toISOString() });
    // Add to history
    const product = productGroups.find(g => g.skus.some(s => `${s.productId}_${s.skuId}` === skuKey || s.productId === skuKey));
    if (product) {
      addCostHistory({
        productId: skuKey,
        productName: product.productName,
        field: 'rawCost',
        oldValue: oldCost,
        newValue: cost,
        reason: '手动修改成本'
      });
    }
  };

  // Tax config handlers
  const handleAddTax = () => {
    if (!taxForm.name || !taxForm.rate) return;
    addTaxConfig({
      id: Date.now().toString(),
      name: taxForm.name,
      taxType: taxForm.taxType || 'vat',
      rate: taxForm.rate || 0,
      base: taxForm.base || 'revenue',
      enabled: taxForm.enabled ?? true,
      description: taxForm.description
    });
    setTaxForm({ name: '', taxType: 'vat', rate: 0, base: 'revenue', enabled: true, description: '' });
    setShowTaxForm(false);
  };

  const applyTaxTemplate = (type: 'small' | 'general') => {
    if (type === 'small') {
      addTaxConfig({ id: Date.now().toString() + '1', name: '增值税(小规模)', taxType: 'vat', rate: 1, base: 'revenue', enabled: true });
      addTaxConfig({ id: Date.now().toString() + '2', name: '附加税', taxType: 'surcharge', rate: 6, base: 'vat', enabled: true });
    } else {
      addTaxConfig({ id: Date.now().toString() + '1', name: '增值税(一般纳税人)', taxType: 'vat', rate: 6, base: 'revenue', enabled: true });
      addTaxConfig({ id: Date.now().toString() + '2', name: '附加税', taxType: 'surcharge', rate: 12, base: 'vat', enabled: true });
      addTaxConfig({ id: Date.now().toString() + '3', name: '企业所得税', taxType: 'income', rate: 25, base: 'profit', enabled: true });
    }
  };

  const calculateTaxPreview = (revenue: number) => {
    let vatAmount = 0;
    const results: { name: string; amount: number; rate: number; base: number }[] = [];
    (taxConfigs || []).forEach(tax => {
      if (!tax.enabled) return;
      let base = revenue;
      if (tax.base === 'vat') base = vatAmount;
      if (tax.base === 'profit') base = revenue * 0.3;
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
    if (!isValid) {
      setFormulaValidation({ valid: false, error: '公式验证失败' });
      return;
    }
    addCustomDeduction({
      id: Date.now().toString(),
      name: deductionForm.name,
      formula: deductionForm.formula,
      scope: deductionForm.scope || 'global',
      scopeTarget: deductionForm.scopeTarget,
      effectiveFrom: deductionForm.effectiveFrom,
      effectiveTo: deductionForm.effectiveTo,
      condition: deductionForm.condition,
      enabled: deductionForm.enabled ?? true,
      sortOrder: (customDeductions || []).length
    });
    setDeductionForm({ name: '', formula: '', scope: 'global', enabled: true, condition: '', effectiveFrom: '', effectiveTo: '' });
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

    return (
      <div key={skuKey} className={`p-4 border-b border-pdd-border last:border-0 transition-colors ${isSelected ? 'bg-pdd-danger/10/60' : 'hover:bg-pdd-bg/80'}`}>
        {/* 第一行：选择 + 商品信息 */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => toggleSelect(skuKey)}
            className="w-4 h-4 mt-1 rounded border-pdd-border text-pdd-danger focus:ring-red-500 cursor-pointer"
          />
          <div className="flex-1 min-w-0">
            {showProduct && <p className="text-sm font-semibold text-pdd-text truncate mb-0.5">{sku.productName || sku.productId}</p>}
            <div className="flex items-center gap-2 flex-wrap">
              {sku.skuName && <span className="text-xs text-pdd-text-secondary">规格: {sku.skuName}</span>}
              {sku.skuId && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-1.5 py-0.5 rounded font-mono">ID: {sku.skuId}</span>}
              {sku.skuCode && <span className="text-[10px] text-pdd-danger bg-pdd-danger/10 px-1.5 py-0.5 rounded font-mono">规格码: {sku.skuCode}</span>}
              {sku.productCode && !sku.skuCode && <span className="text-[10px] text-pdd-text-secondary bg-pdd-bg px-1.5 py-0.5 rounded font-mono">商品码: {sku.productCode}</span>}
            </div>
          </div>
        </div>

        {/* 第二行：数据指标 + 成本输入（网格对齐） */}
        <div className="mt-3 ml-7 grid grid-cols-12 gap-3 items-center">
          {/* 价格区间 */}
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

          {/* 订单/件数 */}
          <div className="col-span-3 flex items-center gap-1.5">
            <span className="text-[10px] text-pdd-text-secondary uppercase tracking-wide">销量</span>
            <span className="text-sm font-mono text-pdd-text">{sku.orderCount}单 / {sku.itemCount}件</span>
          </div>

          {/* 成本输入 */}
          <div className="col-span-6 flex items-center gap-2 justify-end">
            <div className="relative">
              <input
                type="number"
                placeholder="输入裸货成本"
                className="w-32 pl-2 pr-6 py-1.5 border border-pdd-border rounded-lg text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none transition-all bg-pdd-card"
                value={productCosts[skuKey] || ''}
                onChange={e => handleCostChange(skuKey, parseFloat(e.target.value) || 0)}
              />
              {productCosts[skuKey] && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  <Check size={14} className="text-pdd-success" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-pdd-text-secondary">元/件</span>
          </div>
        </div>

        {/* 成本计算详情（仅当有成本时显示） */}
        {costInfo && (
          <div className="mt-3 ml-7 p-3 bg-pdd-success/10/80 rounded-xl border border-green-100">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-pdd-text">
              <span>裸货: <b className="text-pdd-text">¥{costInfo.rawCost.toFixed(2)}</b> × {sku.itemCount}件 = <b className="text-pdd-text">¥{costInfo.totalRawCost.toFixed(2)}</b></span>
              <span className="text-pdd-border">+</span>
              <span>包装: <b className="text-pdd-text">¥{packagingFeePerOrder.toFixed(2)}</b> × {sku.orderCount}单 = <b className="text-pdd-text">¥{costInfo.totalPackaging.toFixed(2)}</b></span>
              {shippingFeePerOrder > 0 && (
                <>
                  <span className="text-pdd-border">+</span>
                  <span>快递: <b className="text-pdd-text">¥{shippingFeePerOrder.toFixed(2)}</b> × {sku.orderCount}单 = <b className="text-pdd-text">¥{costInfo.totalShipping.toFixed(2)}</b></span>
                </>
              )}
              <span className="text-pdd-border">=</span>
              <span className="text-pdd-danger font-bold text-sm">总成本 ¥{costInfo.total.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* 价格分布展开 */}
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

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-pdd-text">成本管理</h1>
        <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-1.5 px-3 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg">
          <Settings size={14} /> 全局设置
        </button>
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="pdd-card">
            <h3 className="font-medium mb-3 flex items-center gap-2"><DollarSign size={16} />成本计算设置</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-pdd-text-secondary">每单包装/人工费(元)</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                    value={tempPackagingFee}
                    onChange={e => setTempPackagingFee(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-pdd-text-secondary mt-1">每个订单只收一次包装费</p>
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">默认成本比例(%)</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                    value={tempDefaultCostRatio}
                    onChange={e => setTempDefaultCostRatio(e.target.value)}
                    placeholder="30"
                  />
                  <p className="text-xs text-pdd-text-secondary mt-1">无成本数据时按实收金额的比例估算</p>
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">快递费/单(元)</label>
                  <input
                    type="number"
                    className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                    value={tempShippingFee}
                    onChange={e => setTempShippingFee(e.target.value)}
                    placeholder="0.00"
                  />
                  <p className="text-xs text-pdd-text-secondary mt-1">每单固定快递费用</p>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button onClick={savePackagingFee} className="px-4 py-1.5 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed">
                    保存设置
                  </button>
                  <button
                    onClick={() => setShowImportHelp(!showImportHelp)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                  >
                    <Upload size={14} /> 批量导入成本
                  </button>
                </div>
                {showImportHelp && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-info/10 rounded p-3 text-xs">
                    <p className="font-medium mb-1">CSV格式说明:</p>
                    <p className="text-pdd-text-secondary mb-1">商品ID/SKU编码,成本单价</p>
                    <p className="text-pdd-text-secondary">示例: 12345,15.50</p>
                    <p className="text-pdd-text-secondary">或: 12345_SKU001,20.00</p>
                  </motion.div>
                )}
              </div>
              <div className="bg-pdd-bg rounded p-3">
                <p className="text-xs text-pdd-text-secondary mb-2">成本计算公式:</p>
                <p className="text-sm font-medium">总成本 = 裸货成本 × 商品件数 + 包装费 × 订单数 + 快递费 × 订单数</p>
                <p className="text-xs text-pdd-text-secondary mt-2">示例: 裸货成本10元/件，包装费2元/单，快递费3元/单</p>
                <p className="text-xs text-pdd-text-secondary">1单2件 = 10×2 + 2×1 + 3×1 = 25元</p>
                <p className="text-xs text-pdd-text-secondary mt-3">税费和自定义扣费将在利润计算中自动扣除</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {(activeTab === 'missing' || activeTab === 'costs') && <TimeFilter state={tfState} />}

      <div className="flex gap-2 border-b border-pdd-border pb-2">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-pdd-red text-white' : 'text-pdd-text-secondary hover:bg-pdd-bg'
            }`}
          >
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'missing' && (
          <motion.div key="missing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {missingCodeProducts.length === 0 ? (
              <p className="text-pdd-text-secondary text-center py-8">暂无缺编码数据，请先上传订单</p>
            ) : (
              <div className="pdd-card">
                {/* Filter Toolbar */}
                <div className="flex items-center justify-between mb-3 pb-3 border-b border-pdd-border">
                  <p className="text-sm text-pdd-text-secondary">以下商品缺少商家编码，共 {filteredMissingProducts.length} / {missingCodeProducts.length} 个商品</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowMissingFilters(!showMissingFilters)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-xs font-medium transition-all ${showMissingFilters ? 'bg-pdd-danger/10 border-red-200 text-pdd-danger' : 'border-pdd-border text-pdd-text hover:bg-pdd-bg'}`}
                    >
                      <Settings size={14} /> 筛选
                    </button>
                    <button onClick={toggleSelectAll} className="text-xs text-pdd-danger hover:underline font-medium">
                      {selectedItems.size > 0 ? '取消全选' : '全选'}
                    </button>
                    {selectedItems.size > 0 && (
                      <button onClick={clearSelection} className="text-xs text-pdd-text-secondary hover:underline">
                        清除
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter Panel */}
                <AnimatePresence>
                  {showMissingFilters && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mb-4 p-4 bg-pdd-bg rounded-lg border border-pdd-border">
                      <div className="grid grid-cols-4 gap-3">
                        {/* Search */}
                        <div>
                          <label className="text-xs text-pdd-text-secondary mb-1 block">搜索商品</label>
                          <input
                            type="text"
                            placeholder="名称/ID/规格..."
                            className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
                            value={missingSearchQuery}
                            onChange={e => setMissingSearchQuery(e.target.value)}
                          />
                        </div>
                        {/* Price Range */}
                        <div>
                          <label className="text-xs text-pdd-text-secondary mb-1 block">价格区间</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="最小"
                              className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                              value={missingPriceMin}
                              onChange={e => setMissingPriceMin(e.target.value)}
                            />
                            <span className="text-pdd-text-secondary">-</span>
                            <input
                              type="number"
                              placeholder="最大"
                              className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                              value={missingPriceMax}
                              onChange={e => setMissingPriceMax(e.target.value)}
                            />
                          </div>
                        </div>
                        {/* Order Count Range */}
                        <div>
                          <label className="text-xs text-pdd-text-secondary mb-1 block">订单数量</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              placeholder="最小"
                              className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                              value={missingOrderMin}
                              onChange={e => setMissingOrderMin(e.target.value)}
                            />
                            <span className="text-pdd-text-secondary">-</span>
                            <input
                              type="number"
                              placeholder="最大"
                              className="w-20 px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                              value={missingOrderMax}
                              onChange={e => setMissingOrderMax(e.target.value)}
                            />
                          </div>
                        </div>
                        {/* Sort */}
                        <div>
                          <label className="text-xs text-pdd-text-secondary mb-1 block">排序</label>
                          <div className="flex items-center gap-1">
                            <select
                              className="px-2 py-1.5 border border-pdd-border rounded text-sm focus:border-red-400 outline-none"
                              value={missingSortBy}
                              onChange={e => setMissingSortBy(e.target.value as 'orders' | 'items' | 'price')}
                            >
                              <option value="orders">订单数</option>
                              <option value="items">件数</option>
                              <option value="price">价格</option>
                            </select>
                            <button
                              onClick={() => setMissingSortOrder(missingSortOrder === 'asc' ? 'desc' : 'asc')}
                              className="p-1.5 border border-pdd-border rounded hover:bg-pdd-bg"
                            >
                              {missingSortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                      {/* Clear Filters */}
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => {
                            setMissingSearchQuery('');
                            setMissingPriceMin('');
                            setMissingPriceMax('');
                            setMissingOrderMin('');
                            setMissingOrderMax('');
                            setMissingSortBy('orders');
                            setMissingSortOrder('desc');
                          }}
                          className="text-xs text-pdd-text-secondary hover:text-pdd-danger flex items-center gap-1"
                        >
                          <X size={12} /> 清除筛选
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {selectedItems.size > 0 && (
                  <div className="flex items-center gap-2 mb-3 p-2 bg-pdd-bg rounded">
                    <span className="text-sm">已选 {selectedItems.size} 项</span>
                    <input
                      type="number"
                      placeholder="批量设置裸货成本(元/件)"
                      className="flex-1 px-2 py-1 border border-pdd-border rounded text-sm"
                      value={batchCost}
                      onChange={e => setBatchCost(e.target.value)}
                    />
                    <button onClick={applyBatchCost} className="px-3 py-1 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed">
                      应用
                    </button>
                  </div>
                )}
                <div className="space-y-1 max-h-96 overflow-y-auto">
                  {filteredMissingProducts.map(group => (
                    <div key={group.productId}>
                      {group.skus.length === 1 && !group.skus[0].skuId ? renderSkuRow(group.skus[0]) : (
                        <div className="border border-pdd-border rounded mb-2">
                          <div className="flex items-center gap-3 p-3 bg-pdd-bg cursor-pointer" onClick={() => toggleProductExpand(group.productId)}>
                            <input
                              type="checkbox"
                              checked={group.skus.every(s => selectedItems.has(s.skuId ? `${s.productId}_${s.skuId}` : s.productId))}
                              onChange={(e) => {
                                e.stopPropagation();
                                const newSet = new Set(selectedItems);
                                group.skus.forEach(s => {
                                  const key = s.skuId ? `${s.productId}_${s.skuId}` : s.productId;
                                  if (newSet.has(key)) newSet.delete(key);
                                  else newSet.add(key);
                                });
                                setSelectedItems(newSet);
                              }}
                              className="w-4 h-4 rounded border-pdd-border"
                            />
                            <Package size={16} className="text-pdd-red shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{group.productName}</p>
                              <p className="text-xs text-pdd-text-secondary">商品ID: {group.productId} · {group.skus.length}个SKU · {group.totalOrders}单/{group.totalItems}件</p>
                            </div>
                            <span className="text-sm text-pdd-text">{formatPriceRange(group.minPrice, group.maxPrice)}</span>
                            {expandedProducts.has(group.productId) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                          {expandedProducts.has(group.productId) && (
                            <div className="border-t border-pdd-border">
                              {group.skus.map(sku => renderSkuRow(sku, false))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'costs' && (
          <motion.div key="costs" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-3">
            {productGroups.length === 0 ? (
              <p className="text-pdd-text-secondary text-center py-8">暂无商品数据</p>
            ) : (
              <>
                <div className="pdd-card">
                  {/* 导入/导出工具栏 */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-pdd-border">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={exportSkuTemplate}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-pdd-border rounded-lg text-xs font-medium text-pdd-text hover:bg-pdd-bg hover:border-pdd-border transition-all"
                      >
                        <Download size={14} /> 下载SKU模板
                      </button>
                      <label className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-pdd-danger/10 rounded-lg text-xs font-medium text-pdd-danger hover:bg-pdd-danger/10 cursor-pointer transition-all">
                        <Upload size={14} /> 批量导入成本
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv"
                          className="hidden"
                          onChange={handleImportCosts}
                        />
                      </label>
                    </div>
                    {importStatus && (
                      <div className={`text-xs font-medium px-3 py-1.5 rounded-lg ${importStatus.type === 'success' ? 'bg-pdd-success/10 text-pdd-success' : 'bg-pdd-danger/10 text-pdd-danger'}`}>
                        {importStatus.msg}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm text-pdd-text-secondary">共 {filteredGroups.length} 个商品</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="搜索商品/SKU/编码..."
                        className="px-3 py-1.5 border border-pdd-border rounded-lg text-sm w-48 focus:border-red-400 focus:ring-1 focus:ring-red-400 outline-none"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                      />
                      <button onClick={toggleSelectAll} className="text-xs text-pdd-danger hover:underline font-medium">
                        {selectedItems.size > 0 ? '取消全选' : '全选'}
                      </button>
                      {selectedItems.size > 0 && (
                        <button onClick={clearSelection} className="text-xs text-pdd-text-secondary hover:underline">
                          清除
                        </button>
                      )}
                    </div>
                  </div>
                  {selectedItems.size > 0 && (
                    <div className="flex items-center gap-2 mb-3 p-2 bg-pdd-bg rounded">
                      <span className="text-sm">已选 {selectedItems.size} 项</span>
                      <input
                        type="number"
                        placeholder="批量设置裸货成本(元/件)"
                        className="flex-1 px-2 py-1 border border-pdd-border rounded text-sm"
                        value={batchCost}
                        onChange={e => setBatchCost(e.target.value)}
                      />
                      <button onClick={applyBatchCost} className="px-3 py-1 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed">
                        应用
                      </button>
                    </div>
                  )}
                  <div className="space-y-2 max-h-[500px] overflow-y-auto">
                    {filteredGroups.map(group => {
                      const isExpanded = expandedProducts.has(group.productId);
                      const hasMultipleSku = group.skus.length > 1 || (group.skus.length === 1 && group.skus[0].skuId);
                      const firstSku = group.skus[0];
                      const skuKey = firstSku.skuId ? `${firstSku.productId}_${firstSku.skuId}` : firstSku.productId;
                      const hasMultiplePrices = firstSku.prices.length > 1 && new Set(firstSku.prices.map(p => Math.round(p * 100) / 100)).size > 1;

                      return (
                        <div key={group.productId} className="border border-pdd-border rounded">
                          <div
                            className={`flex items-center gap-3 p-3 cursor-pointer hover:bg-pdd-bg ${isExpanded ? 'bg-pdd-bg' : ''}`}
                            onClick={() => hasMultipleSku && toggleProductExpand(group.productId)}
                          >
                            <input
                              type="checkbox"
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
                                    if (newSet.has(key)) newSet.delete(key);
                                    else newSet.add(key);
                                  });
                                } else {
                                  if (newSet.has(skuKey)) newSet.delete(skuKey);
                                  else newSet.add(skuKey);
                                }
                                setSelectedItems(newSet);
                              }}
                              className="w-4 h-4 rounded border-pdd-border"
                            />
                            <Edit3 size={16} className="text-pdd-text-secondary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{group.productName}</p>
                              <p className="text-xs text-pdd-text-secondary">
                                商品ID: {group.productId}
                                {hasMultipleSku ? ` · ${group.skus.length}个SKU` : ''}
                                {' · '}{group.totalOrders}单/{group.totalItems}件
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-0.5">
                              {firstSku.skuCode && <span className="text-xs text-pdd-red bg-pdd-danger/10 px-2 py-0.5 rounded">{firstSku.skuCode}</span>}
                              {firstSku.productCode && !firstSku.skuCode && <span className="text-xs text-pdd-text-secondary bg-pdd-bg px-2 py-0.5 rounded">{firstSku.productCode}</span>}
                            </div>
                            <div className="flex items-center gap-1 min-w-[100px] justify-end">
                              <span className="text-sm text-pdd-text">{formatPriceRange(group.minPrice, group.maxPrice)}</span>
                              {!hasMultipleSku && hasMultiplePrices && (
                                <button onClick={(e) => { e.stopPropagation(); togglePriceExpand(skuKey); }} className="p-0.5 hover:bg-pdd-bg rounded">
                                  {expandedPrices.has(skuKey) ? <EyeOff size={14} className="text-pdd-text-secondary" /> : <Eye size={14} className="text-pdd-red" />}
                                </button>
                              )}
                            </div>
                            {hasMultipleSku && (
                              isExpanded ? <ChevronUp size={16} className="text-pdd-text-secondary" /> : <ChevronDown size={16} className="text-pdd-text-secondary" />
                            )}
                            {!hasMultipleSku && (
                              <>
                                <input
                                  type="number"
                                  placeholder="裸货成本(元/件)"
                                  className="w-28 px-2 py-1 border border-pdd-border rounded text-sm"
                                  value={productCosts[skuKey] || ''}
                                  onChange={e => handleCostChange(skuKey, parseFloat(e.target.value) || 0)}
                                  onClick={e => e.stopPropagation()}
                                />
                                {productCosts[skuKey] && <Check size={14} className="text-pdd-success" />}
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
                  </div>
                </div>

                {/* Cost History */}
                {(costHistory || []).length > 0 && (
                  <div className="pdd-card">
                    <div className="flex items-center gap-2 mb-3 cursor-pointer" onClick={() => setShowCostHistory(!showCostHistory)}>
                      <History size={16} className="text-pdd-text-secondary" />
                      <h3 className="font-medium">最近修改记录</h3>
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
                            <span className="text-pdd-red font-medium">¥{record.newValue.toFixed(2)}</span>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'pricing' && (
          <motion.div key="pricing" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="pdd-card">
              <h3 className="font-medium mb-4">新品定价公式</h3>
              <div className="bg-pdd-bg rounded-lg p-4 mb-4 text-center">
                <p className="text-sm text-pdd-text-secondary mb-1">建议售价 = 裸货成本 + 运费 + 推广费 + 裸货成本 × 利润率</p>
                {suggestedPrice > 0 && (
                  <p className="text-2xl font-bold text-pdd-red mt-2">¥ {suggestedPrice.toFixed(2)}</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-pdd-text-secondary">商品名称</label>
                  <input className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.name}
                    onChange={e => setPricingForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">商家编码</label>
                  <input className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.code}
                    onChange={e => setPricingForm(f => ({ ...f, code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">裸货成本(元)</label>
                  <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.rawCost}
                    onChange={e => setPricingForm(f => ({ ...f, rawCost: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">运费(元)</label>
                  <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.shipping}
                    onChange={e => setPricingForm(f => ({ ...f, shipping: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">推广费(元)</label>
                  <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.promotion}
                    onChange={e => setPricingForm(f => ({ ...f, promotion: parseFloat(e.target.value) || 0 }))} />
                </div>
                <div>
                  <label className="text-xs text-pdd-text-secondary">利润率(%)</label>
                  <input type="number" className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1" value={pricingForm.profitRate}
                    onChange={e => setPricingForm(f => ({ ...f, profitRate: parseFloat(e.target.value) || 0 }))} />
                </div>
              </div>
              <button onClick={handleSavePricing}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed transition-colors">
                <Save size={14} />保存预设
              </button>
              {savedMsg && <p className="text-pdd-success text-sm mt-2">{savedMsg}</p>}
            </div>

            {pricingPresets.length > 0 && (
              <div className="pdd-card">
                {/* 筛选栏 */}
                <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-card rounded-lg border border-pdd-border">
                  <Search size={16} className="text-pdd-text-secondary" />
                  <input
                    type="text"
                    placeholder="搜索名称/编码..."
                    className="flex-1 text-sm outline-none"
                    value={pricingSearchQuery}
                    onChange={e => setPricingSearchQuery(e.target.value)}
                  />
                  {pricingSearchQuery && (
                    <button onClick={() => setPricingSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">
                      重置
                    </button>
                  )}
                </div>
                <h3 className="font-medium mb-3">已保存预设</h3>
                <div className="space-y-2">
                  {filteredPricingPresets.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-pdd-border last:border-0 text-sm">
                      <span>{p.name || p.code}</span>
                      <span className="text-pdd-text-secondary">成本¥{p.rawCost} → 售价¥{p.suggestedPrice?.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'tax' && (
          <motion.div key="tax" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="pdd-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">税务配置</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => applyTaxTemplate('small')}
                    className="px-3 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                  >
                    小规模纳税人模板
                  </button>
                  <button
                    onClick={() => applyTaxTemplate('general')}
                    className="px-3 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                  >
                    一般纳税人模板
                  </button>
                  <button
                    onClick={() => setShowTaxForm(!showTaxForm)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed"
                  >
                    <Plus size={14} /> 添加税种
                  </button>
                </div>
              </div>

              {showTaxForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-bg rounded p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-pdd-text-secondary">税种名称</label>
                      <input
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={taxForm.name}
                        onChange={e => setTaxForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="如: 增值税"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">税率(%)</label>
                      <input
                        type="number"
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={taxForm.rate}
                        onChange={e => setTaxForm(f => ({ ...f, rate: parseFloat(e.target.value) || 0 }))}
                        placeholder="如: 13"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">税种类型</label>
                      <select
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={taxForm.taxType}
                        onChange={e => setTaxForm(f => ({ ...f, taxType: e.target.value as TaxConfig['taxType'] }))}
                      >
                        <option value="vat">增值税</option>
                        <option value="income">所得税</option>
                        <option value="surcharge">附加税</option>
                        <option value="custom">自定义</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">计税基数</label>
                      <select
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={taxForm.base}
                        onChange={e => setTaxForm(f => ({ ...f, base: e.target.value as TaxConfig['base'] }))}
                      >
                        <option value="revenue">实收金额</option>
                        <option value="profit">利润</option>
                        <option value="vat">增值税额</option>
                        <option value="gmv">GMV</option>
                        <option value="orders">订单数</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-pdd-text-secondary">备注</label>
                      <input
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={taxForm.description}
                        onChange={e => setTaxForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="可选"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleAddTax}
                      className="px-4 py-1.5 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setShowTaxForm(false)}
                      className="px-4 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                    >
                      取消
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 搜索筛选 */}
              {(taxConfigs || []).length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-card rounded-lg border border-pdd-border">
                  <Search size={16} className="text-pdd-text-secondary" />
                  <input
                    type="text"
                    placeholder="搜索税种名称..."
                    className="flex-1 text-sm outline-none"
                    value={taxSearchQuery}
                    onChange={e => setTaxSearchQuery(e.target.value)}
                  />
                  {taxSearchQuery && (
                    <button onClick={() => setTaxSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">
                      重置
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {(taxConfigs || []).length === 0 ? (
                  <p className="text-pdd-text-secondary text-center py-4">暂无税务配置</p>
                ) : filteredTaxConfigs.length === 0 ? (
                  <p className="text-pdd-text-secondary text-center py-4">无匹配数据</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-pdd-bg">
                      <tr>
                        <th className="px-3 py-2 text-left">名称</th>
                        <th className="px-3 py-2 text-left">类型</th>
                        <th className="px-3 py-2 text-right">税率</th>
                        <th className="px-3 py-2 text-left">计税基数</th>
                        <th className="px-3 py-2 text-center">启用</th>
                        <th className="px-3 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTaxConfigs.map(tax => (
                        <tr key={tax.id} className="border-b border-pdd-border last:border-0">
                          <td className="px-3 py-2">{tax.name}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              tax.taxType === 'vat' ? 'bg-pdd-info/10 text-blue-700' :
                              tax.taxType === 'income' ? 'bg-pdd-success/10 text-green-700' :
                              tax.taxType === 'surcharge' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-pdd-bg text-pdd-text'
                            }`}>
                              {tax.taxType === 'vat' ? '增值税' :
                               tax.taxType === 'income' ? '所得税' :
                               tax.taxType === 'surcharge' ? '附加税' : '自定义'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right">{tax.rate}%</td>
                          <td className="px-3 py-2">
                            {tax.base === 'revenue' ? '实收金额' :
                             tax.base === 'profit' ? '利润' :
                             tax.base === 'vat' ? '增值税额' :
                             tax.base === 'gmv' ? 'GMV' : '订单数'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={tax.enabled}
                              onChange={() => updateTaxConfig(tax.id, { enabled: !tax.enabled })}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeTaxConfig(tax.id)}
                              className="p-1 hover:bg-pdd-danger/10 rounded text-pdd-red"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Tax Preview */}
              <div className="mt-4 bg-pdd-bg rounded p-4">
                <h4 className="font-medium mb-2">实时预览 (假设实收 ¥1000)</h4>
                <div className="space-y-1 text-sm">
                  {taxPreview.length === 0 ? (
                    <p className="text-pdd-text-secondary">未配置税费</p>
                  ) : (
                    <>
                      {taxPreview.map((t, i) => (
                        <div key={i} className="flex items-center justify-between">
                          <span>{t.name} ({t.rate}% × ¥{t.base.toFixed(2)})</span>
                          <span className="font-medium">¥{t.amount.toFixed(2)}</span>
                        </div>
                      ))}
                      <div className="border-t border-pdd-border pt-1 mt-1 flex items-center justify-between font-bold">
                        <span>合计税费</span>
                        <span className="text-pdd-red">¥{taxPreview.reduce((s, t) => s + t.amount, 0).toFixed(2)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'deductions' && (
          <motion.div key="deductions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="pdd-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium">自定义扣费项</h3>
                <button
                  onClick={() => setShowDeductionForm(!showDeductionForm)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed"
                >
                  <Plus size={14} /> 添加扣费项
                </button>
              </div>

              {showDeductionForm && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="bg-pdd-bg rounded p-4 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-pdd-text-secondary">名称</label>
                      <input
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={deductionForm.name}
                        onChange={e => setDeductionForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="如: 平台服务费"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">作用范围</label>
                      <select
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={deductionForm.scope}
                        onChange={e => setDeductionForm(f => ({ ...f, scope: e.target.value as CustomDeduction['scope'] }))}
                      >
                        <option value="global">全局</option>
                        <option value="product">指定商品</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-pdd-text-secondary">计算公式</label>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          className="flex-1 px-2 py-1.5 border border-pdd-border rounded text-sm"
                          value={deductionForm.formula}
                          onChange={e => {
                            setDeductionForm(f => ({ ...f, formula: e.target.value }));
                            setFormulaValidation(null);
                          }}
                          placeholder="如: revenue * 0.05 或 orders * 2"
                        />
                        <button
                          onClick={handleValidateFormula}
                          className="px-3 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                        >
                          验证
                        </button>
                      </div>
                      {formulaValidation && (
                        <div className={`mt-1 text-xs flex items-center gap-1 ${formulaValidation.valid ? 'text-pdd-success' : 'text-pdd-danger'}`}>
                          {formulaValidation.valid ? <Check size={12} /> : <X size={12} />}
                          {formulaValidation.valid ? '公式有效' : formulaValidation.error}
                        </div>
                      )}
                      <div className="mt-2 space-y-1">
                        <p className="text-xs text-pdd-text-secondary font-medium">可用变量（点击复制）:</p>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">基础交易:</p>
                            {['gmv - 商品总价(GMV)', 'revenue - 商家实收', 'orders - 订单数', 'sales - 销量(件数)', 'avgOrderValue - 客单价'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">成本费用:</p>
                            {['productCost - 商品成本', 'packagingFee - 包装费', 'shippingFee - 快递费', 'promoCost - 推广费', 'discount - 折扣金额', 'taxes - 税费'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">利润指标:</p>
                            {['profit - 税前利润', 'grossProfit - 毛利', 'netProfit - 净利润'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">售后数据:</p>
                            {['refund - 退款金额', 'refundRate - 退款率(%)', 'afterSaleCount - 售后订单数', 'afterSaleRate - 售后率(%)'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">推广数据:</p>
                            {['promoOrders - 推广成交订单', 'promoTransaction - 推广成交金额', 'promoClicks - 点击量', 'promoImpressions - 曝光量', 'ctr - 点击率(%)', 'cvr - 转化率(%)', 'roi - 推广ROI'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                          <div className="space-y-0.5">
                            <p className="text-pdd-text-secondary font-medium">时间数据:</p>
                            {['activeDays - 活跃天数', 'avgDailySales - 日均销量'].map(v => (
                              <span key={v} className="inline-block px-1.5 py-0.5 bg-pdd-bg rounded cursor-pointer hover:bg-pdd-info/10" onClick={() => navigator.clipboard.writeText(v.split(' ')[0])}>{v}</span>
                            ))}
                          </div>
                        </div>
                        <p className="text-xs text-pdd-text-secondary mt-1">数学函数: max, min, abs, round, ceil, floor</p>
                        <p className="text-[10px] text-pdd-text-secondary">示例: orders &gt; 10 ? revenue * 0.05 : 0 （订单数大于10时收取5%服务费）</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">条件表达式(可选)</label>
                      <input
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={deductionForm.condition}
                        onChange={e => setDeductionForm(f => ({ ...f, condition: e.target.value }))}
                        placeholder="如: revenue > 100"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">有效期起(可选)</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={deductionForm.effectiveFrom}
                        onChange={e => setDeductionForm(f => ({ ...f, effectiveFrom: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-pdd-text-secondary">有效期止(可选)</label>
                      <input
                        type="date"
                        className="w-full px-2 py-1.5 border border-pdd-border rounded text-sm mt-1"
                        value={deductionForm.effectiveTo}
                        onChange={e => setDeductionForm(f => ({ ...f, effectiveTo: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={handleAddDeduction}
                      className="px-4 py-1.5 bg-pdd-red text-white rounded text-sm hover:bg-pdd-darkRed"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => { setShowDeductionForm(false); setFormulaValidation(null); }}
                      className="px-4 py-1.5 border border-pdd-border rounded text-sm hover:bg-pdd-bg"
                    >
                      取消
                    </button>
                  </div>
                </motion.div>
              )}

              {/* 搜索筛选 */}
              {(customDeductions || []).length > 0 && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-pdd-card rounded-lg border border-pdd-border">
                  <Search size={16} className="text-pdd-text-secondary" />
                  <input
                    type="text"
                    placeholder="搜索扣费项..."
                    className="flex-1 text-sm outline-none"
                    value={deductionSearchQuery}
                    onChange={e => setDeductionSearchQuery(e.target.value)}
                  />
                  {deductionSearchQuery && (
                    <button onClick={() => setDeductionSearchQuery('')} className="text-xs text-pdd-text-secondary hover:text-pdd-danger">
                      重置
                    </button>
                  )}
                </div>
              )}

              <div className="space-y-2">
                {(customDeductions || []).length === 0 ? (
                  <p className="text-pdd-text-secondary text-center py-4">暂无自定义扣费项</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead className="bg-pdd-bg">
                      <tr>
                        <th className="px-3 py-2 text-left">名称</th>
                        <th className="px-3 py-2 text-left">公式</th>
                        <th className="px-3 py-2 text-left">范围</th>
                        <th className="px-3 py-2 text-center">启用</th>
                        <th className="px-3 py-2 text-center">排序</th>
                        <th className="px-3 py-2 text-center">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(customDeductions || []).sort((a, b) => a.sortOrder - b.sortOrder).map((ded, idx) => (
                        <tr key={ded.id} className="border-b border-pdd-border last:border-0">
                          <td className="px-3 py-2">{ded.name}</td>
                          <td className="px-3 py-2 font-mono text-xs text-pdd-text-secondary">{ded.formula}</td>
                          <td className="px-3 py-2">
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              ded.scope === 'global' ? 'bg-pdd-info/10 text-blue-700' : 'bg-pdd-primary/10 text-purple-700'
                            }`}>
                              {ded.scope === 'global' ? '全局' : '指定商品'}
                            </span>
                            {ded.effectiveFrom && (
                              <span className="text-xs text-pdd-text-secondary ml-1">
                                {ded.effectiveFrom}~{ded.effectiveTo || '永久'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={ded.enabled}
                              onChange={() => updateCustomDeduction(ded.id, { enabled: !ded.enabled })}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => moveDeduction(ded.id, 'up')}
                                disabled={idx === 0}
                                className="p-1 hover:bg-pdd-bg rounded disabled:opacity-30"
                              >
                                <ArrowUp size={14} />
                              </button>
                              <button
                                onClick={() => moveDeduction(ded.id, 'down')}
                                disabled={idx === (customDeductions || []).length - 1}
                                className="p-1 hover:bg-pdd-bg rounded disabled:opacity-30"
                              >
                                <ArrowDown size={14} />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <button
                              onClick={() => removeCustomDeduction(ded.id)}
                              className="p-1 hover:bg-pdd-danger/10 rounded text-pdd-red"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

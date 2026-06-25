import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Tooltip, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Package, TrendingUp, DollarSign, AlertTriangle, Ban,
  ShoppingCart, ArrowUp, ArrowDown, Search, Download,
  ChevronLeft, ChevronRight, ChevronDown, X, Check,
  BarChart3, Eye, Hash, Zap, Box, Clock, Target, Activity,
  RefreshCw, Layers, Percent, RotateCcw, Filter, Upload,
  Image as ImageIcon, Settings, Edit3, FileImage, Lightbulb,
  TrendingDown, GripVertical, Plus, Minus, Megaphone, Move, Info, Tag
} from 'lucide-react';
import { useData, useAuth, useStore } from '../App';
import { findField } from '../utils';
import TimeFilter, { useTimeFilter, safeFloat, filterByTimeRange, filterPromoByTimeRange, getCompareOrders, getAllDateGroups, changePct, getQuickRangeDates } from '../components/TimeFilter';
import { UnifiedFilterBar } from '../components/FilterToolbar';
import ProductDetailDrawer from './product/ProductDetailDrawer';
import ProductDeepAnalysis from './product/ProductDeepAnalysis';
import Product360Analysis from '../components/product-analysis/Product360Analysis';
import { computeTargetsByProfit, flattenTargetSet, extractPerOrderMetrics } from '../utils/targetEngine';
import type { TargetEngineResult, ProductTargetConfig } from '../types/productTarget';
import TargetDetailModal from '../components/TargetDetailModal';
import { useProductDetail, ProductStat } from '../components/ProductLinkStats';
import { apiClient } from '../../api/client';
import { AnalysisProvider } from '../context/analysisContext';
import { ChartTooltip, formatGranularityLabel } from '../utils/trendData';
import { computeAllTags, TAG_GROUPS, TAG_DEF_MAP, getTagLabel } from '../utils/productTagSystem';
import ProductDataAnalysis from './product/ProductDataAnalysis';
import ProductRetrospective from './product/ProductRetrospective';
import ProductEditor from './product/ProductEditor';
import PromotionDataPanel from './product/PromotionDataPanel';
import { CHART_COLORS } from '../ui';
import {
  loadSpecOverrides, saveSpecOverrides, type SpecOverrides,
} from '../utils/specGrouping';
import SpecPreviewCard from '../components/SpecPreviewCard';


const COLORS = CHART_COLORS;

/**
 * 可编辑的规格分组标签
 * 双击重命名，使用与 SpecGroupCostEditor 相同的共享存储
 */
function EditableSpecLabel({ productId, defaultLabel, version, onRename }: {
  productId: string;
  defaultLabel: string;
  version: number;
  onRename?: (productId: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState('');

  const displayLabel = React.useMemo(() => {
    const overrides = loadSpecOverrides(productId);
    return overrides.labels[defaultLabel] || defaultLabel;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId, defaultLabel, version]);

  const handleSave = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== defaultLabel) {
      const overrides = loadSpecOverrides(productId);
      overrides.labels[defaultLabel] = trimmed;
      saveSpecOverrides(productId, overrides);
      onRename?.(productId);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        className="w-20 px-1 py-0.5 border border-blue-400 rounded text-xs font-medium text-pdd-text outline-none"
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
        onClick={e => e.stopPropagation()}
      />
    );
  }

  return (
    <span
      className="text-xs font-medium text-pdd-text cursor-pointer hover:text-pdd-primary hover:bg-blue-50 px-1 rounded transition-colors"
      onDoubleClick={(e) => {
        e.stopPropagation();
        setValue(displayLabel);
        setEditing(true);
      }}
      title="双击重命名规格分组"
    >
      {displayLabel}
    </span>
  );
}

// ── 模块级列配置常量（22列总额 / 15列单品） ──
const COLS_TOTAL_DEFS: { key: string; label: string; width: string; sortable: boolean }[] = [
  { key: 'revenue', label: '商家实收', width: '100px', sortable: true },
  { key: 'orders', label: '订单量', width: '72px', sortable: true },
  { key: 'sales', label: '销量', width: '72px', sortable: true },
  { key: 'totalCost', label: '总成本', width: '90px', sortable: true },
  { key: 'promo', label: '推广费', width: '90px', sortable: true },
  { key: 'roi', label: '投产比', width: '80px', sortable: true },
  { key: 'refundRate', label: '退款率', width: '80px', sortable: true },
  { key: 'otherCost', label: '其他成本', width: '90px', sortable: true },
  { key: 'profit', label: '利润', width: '100px', sortable: true },
  { key: 'promoCost', label: '广告支出', width: '90px', sortable: true },
  { key: 'logistics', label: '物流成本', width: '90px', sortable: true },
  { key: 'platformFee', label: '平台佣金', width: '90px', sortable: true },
  { key: 'profitRate', label: '毛利率', width: '80px', sortable: true },
  { key: 'avgPrice', label: '客单价', width: '90px', sortable: true },
  { key: 'stockDays', label: '库存周转', width: '80px', sortable: true },
  { key: 'gmv', label: '销售额', width: '90px', sortable: true },
  { key: 'promoTransaction', label: '推广成交', width: '90px', sortable: true },
  { key: 'promoClicks', label: '推广点击', width: '80px', sortable: true },
  { key: 'promoCostRatio', label: '费比', width: '72px', sortable: true },
  { key: 'afterSaleRate', label: '售后率', width: '72px', sortable: true },
  { key: 'unitProfit', label: '单品利润', width: '80px', sortable: true },
  { key: 'unitCost', label: '单品成本', width: '80px', sortable: true },
];
const COLS_SINGLE_DEFS: { key: string; label: string; width: string; sortable: boolean }[] = [
  { key: 'skuPrice', label: '单品价格', width: '90px', sortable: true },
  { key: 'skuCount', label: 'SKU数量', width: '72px', sortable: true },
  { key: 'skuCost', label: '单品成本', width: '90px', sortable: true },
  { key: 'skuProfit', label: '单品利润', width: '90px', sortable: true },
  { key: 'promoAvg', label: '单品推广费', width: '90px', sortable: true },
  { key: 'roi', label: '投产比', width: '80px', sortable: true },
  { key: 'refundRate', label: '退款率', width: '80px', sortable: true },
  { key: 'profitRate', label: '利润率', width: '80px', sortable: true },
  { key: 'grossMargin', label: '毛利率', width: '80px', sortable: true },
  { key: 'stockDays', label: '库存周转', width: '80px', sortable: true },
  { key: 'skuGmv', label: '单品销售额', width: '90px', sortable: true },
  { key: 'skuOrders', label: '单品订单量', width: '72px', sortable: true },
  { key: 'skuSales', label: '单品销量', width: '72px', sortable: true },
  { key: 'afterSaleRate', label: '售后率', width: '72px', sortable: true },
  { key: 'costRatio', label: '费比', width: '72px', sortable: true },
];
const COL_GROUPS: { label: string; keys: string[] }[] = [
  { label: '收入', keys: ['revenue', 'gmv', 'avgPrice', 'profit', 'profitRate'] },
  { label: '成本', keys: ['totalCost', 'promo', 'promoCost', 'logistics', 'platformFee', 'otherCost', 'unitCost'] },
  { label: '效率', keys: ['orders', 'sales', 'roi', 'refundRate', 'afterSaleRate', 'promoCostRatio', 'stockDays', 'unitProfit', 'promoTransaction', 'promoClicks'] },
];
const SINGLE_GROUPS: { label: string; keys: string[] }[] = [
  { label: '价格成本', keys: ['skuPrice', 'skuCost', 'skuProfit', 'promoAvg'] },
  { label: '效率', keys: ['roi', 'refundRate', 'profitRate', 'grossMargin', 'stockDays', 'afterSaleRate', 'costRatio'] },
  { label: '销售额', keys: ['skuGmv', 'skuOrders', 'skuSales'] },
  { label: '其他', keys: ['skuCount'] },
];

export default function ProductPage() {
  const { currentDisplayData, productCosts, customDeductions, taxConfigs, defaultCostRatio, packagingFeePerOrder, shippingFeePerOrder, platformCommissionRate, insuranceFeePerOrder, orderFinancialActuals, abnormalOrders, serverProducts, serverDashboard } = useData();
  const { isPaid } = useAuth();
  const tf = useTimeFilter('7', 'day');
  const { timeRange, granularity, compareEnabled, setTimeRange, setGranularity, setCompareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange, setCustomRange, setQuickRange, savedRanges, saveCurrentRange, deleteSavedRange, applySavedRange } = tf;
  const [priceFilter, setPriceFilter] = useState<string>('all');
  const [salesFilter, setSalesFilter] = useState<string>('all');
  const [afterSaleFilter, setAfterSaleFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [compareProducts, setCompareProducts] = useState<string[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [sortField, setSortField] = useState<string>('gmv');
  const [sortDesc, setSortDesc] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [productTags, setProductTags] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('dianfx_product_tags');
      if (saved) { const parsed = JSON.parse(saved); if (parsed && typeof parsed === 'object') return parsed; }
    } catch {}
    return {};
  });
  const [tagInput, setTagInput] = useState('');
  const [taggingProduct, setTaggingProduct] = useState<string | null>(null);
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [drawerProductId, setDrawerProductId] = useState<string | null>(null);
  useEffect(() => {
    localStorage.setItem('dianfx_product_tags', JSON.stringify(productTags));
  }, [productTags]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [deepAnalysisOpen, setDeepAnalysisOpen] = useState(false);
  const [deepAnalysisProductId, setDeepAnalysisProductId] = useState<string | undefined>(undefined);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [dataAnalysisProductId, setDataAnalysisProductId] = useState<string | null>(null);
  const [retrospectiveProductId, setRetrospectiveProductId] = useState<string | null>(null);
  const [editorProductId, setEditorProductId] = useState<string | null>(null);
  const [promoDataProductId, setPromoDataProductId] = useState<string | null>(null);
  // 规格编辑: 悬浮预览 + 移动SKU
  const [hoverInfo, setHoverInfo] = useState<{ label: string; items: { skuName: string; price: number; orders: number; sales: number }[]; x: number; y: number } | null>(null);
  const [movingSkuId, setMovingSkuId] = useState<string | null>(null);
  const [newSpecGroupName, setNewSpecGroupName] = useState('');
  const [showNewSpecGroupInput, setShowNewSpecGroupInput] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  // ── 规格覆盖系统刷新键（每次 saveSpecOverrides 后递增，触发 UI 重渲染） ──
  const [specVersion, setSpecVersion] = useState(0);
  const saveOverrides = useCallback((productId: string, overrides: SpecOverrides) => {
    saveSpecOverrides(productId, overrides);
    setSpecVersion(v => v + 1);
  }, []);
  // ── 趋势图 ──
  const [selectedTrendKpi, setSelectedTrendKpi] = useState<string | null>(null);

  const pageSize = 10;

  // ── 产品本地存储状态 ──
  const [productImages, setProductImages] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem('dianfx_product_images'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('dianfx_product_images', JSON.stringify(productImages)); }, [productImages]);

  const [productAliases, setProductAliases] = useState<Record<string, string>>(() => {
    try { const s = localStorage.getItem('dianfx_product_aliases'); return s ? JSON.parse(s) : {}; } catch { return {}; }
  });
  useEffect(() => { localStorage.setItem('dianfx_product_aliases', JSON.stringify(productAliases)); }, [productAliases]);

  const [productTargets, setProductTargets] = useState<Record<string, ProductTargetConfig>>(() => {
    try {
      const s = localStorage.getItem('dianfx_product_targets');
      if (s) {
        const parsed = JSON.parse(s);
        if (parsed && typeof parsed === 'object') {
          // 向后兼容：旧格式（targetProfit等）转为新格式（profitPerOrder）
          const migrated: Record<string, ProductTargetConfig> = {};
          for (const [pid, val] of Object.entries(parsed)) {
            const v = val as any;
            if (v && typeof v === 'object' && 'profitPerOrder' in v) {
              migrated[pid] = v;
            } else if (v && typeof v === 'object') {
              migrated[pid] = { profitPerOrder: v.targetProfit ? 10 : 10, presetKey: '10' };
            } else {
              migrated[pid] = { profitPerOrder: 10, presetKey: '10' };
            }
          }
          return migrated;
        }
      }
    } catch {}
    return {};
  });
  useEffect(() => { localStorage.setItem('dianfx_product_targets', JSON.stringify(productTargets)); }, [productTargets]);

  // ── 图片放大/预览 ──
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const [hoveredImage, setHoveredImage] = useState<{ id: string; src: string; x: number; y: number } | null>(null);

  // ── 标签显隐：每个标签可独立隐藏 ──
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(() => {
    try { const v = localStorage.getItem('dianfx_hidden_tags'); return v ? new Set(JSON.parse(v)) : new Set(); } catch { return new Set(); }
  });
  useEffect(() => { localStorage.setItem('dianfx_hidden_tags', JSON.stringify([...hiddenTags])); }, [hiddenTags]);
  const toggleTagVisibility = useCallback((tagKey: string) => {
    setHiddenTags(prev => {
      const next = new Set(prev);
      if (next.has(tagKey)) next.delete(tagKey); else next.add(tagKey);
      return next;
    });
  }, []);

  // ── 单品/总额模式：每个商品独立 ──
  const [productDimModes, setProductDimModes] = useState<Record<string, '单品' | '总额'>>({});
  const getRowDimMode = useCallback((productId: string): '单品' | '总额' => {
    return productDimModes[productId] || '总额';
  }, [productDimModes]);
  const [listFilter, setListFilter] = useState<'all' | 'active' | 'zero'>('all');
  // ── 列管理 ──
  const MAX_VISIBLE_COLS = 8;
  const [colSelectorOpen, setColSelectorOpen] = useState(false);
  const colSelectorRef = useRef<HTMLDivElement>(null);
  const DEFAULT_TOTAL_KEYS = new Set(COLS_TOTAL_DEFS.slice(0, MAX_VISIBLE_COLS).map(c => c.key));
  const DEFAULT_SINGLE_KEYS = new Set(COLS_SINGLE_DEFS.slice(0, MAX_VISIBLE_COLS).map(c => c.key));
  const [visibleTotalCols, setVisibleTotalCols] = useState<Set<string>>(() => new Set(DEFAULT_TOTAL_KEYS));
  const [visibleSingleCols, setVisibleSingleCols] = useState<Set<string>>(() => new Set(DEFAULT_SINGLE_KEYS));

  // ── 列选择器点击外部关闭（允许 gear icon 触发） ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (target.closest('[data-col-settings]')) return; // gear icon 触发放行
      if (colSelectorRef.current && !colSelectorRef.current.contains(target)) {
        setColSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  // ── 每行独立数据窗口滚轮捕获（平滑滚动） ──
  useEffect(() => {
    const containers = document.querySelectorAll<HTMLElement>('[data-row-scroll="true"]');
    const handlers: Array<[HTMLElement, (e: WheelEvent) => void]> = [];
    containers.forEach(el => {
      let scrollVelocity = 0;
      let scrollAnimationId: number | null = null;
      const SCROLL_DECEL = 0.85;
      const SCROLL_SENSITIVITY = 0.6;

      function animateScroll() {
        if (Math.abs(scrollVelocity) < 0.5) {
          scrollVelocity = 0;
          scrollAnimationId = null;
          return;
        }
        el.scrollLeft += scrollVelocity;
        scrollVelocity *= SCROLL_DECEL;
        scrollAnimationId = requestAnimationFrame(animateScroll);
      }

      const handler = (e: WheelEvent) => {
        const colCount = parseInt(el.dataset.colCount || '0');
        // 只有数据列超过9列且内容溢出时才捕获滚轮做横向平滑滚动
        if (colCount > 9 && el.scrollWidth > el.clientWidth) {
          e.preventDefault();
          e.stopPropagation();
          scrollVelocity += e.deltaY * SCROLL_SENSITIVITY;
          const MAX_SPEED = 40;
          if (scrollVelocity > MAX_SPEED) scrollVelocity = MAX_SPEED;
          if (scrollVelocity < -MAX_SPEED) scrollVelocity = -MAX_SPEED;
          if (!scrollAnimationId) {
            scrollAnimationId = requestAnimationFrame(animateScroll);
          }
        }
        // 否则不拦截，滚轮自然冒泡到页面，正常上下滚动
      };
      el.addEventListener('wheel', handler, { passive: false });
      handlers.push([el, handler]);
    });
    return () => {
      handlers.forEach(([el, handler]) => {
        el.removeEventListener('wheel', handler);
      });
    };
  }, [paginatedProducts, visibleTotalCols, visibleSingleCols]);

  // ── KPI 可见性 + 排序 ──
  const [visibleKpis, setVisibleKpis] = useState<Set<string>>(() => {
    try { const s = localStorage.getItem('dianfx_product_visible_kpis'); return s ? new Set(JSON.parse(s)) : new Set(['商品数', '动销率', '利润总额', '利润率', '高退款品']); } catch { return new Set(['商品数', '动销率', '利润总额', '利润率', '高退款品']); }
  });
  const [kpiCardOrder, setKpiCardOrder] = useState<string[]>(() => {
    try { const s = localStorage.getItem('dianfx_product_kpi_order'); return s ? JSON.parse(s) : ['商品数', '动销率', '利润总额', '利润率', '高退款品']; } catch { return ['商品数', '动销率', '利润总额', '利润率', '高退款品']; }
  });
  const [showKpiSelector, setShowKpiSelector] = useState(false);

  // ── SKU 展开 ──
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [expandedSkuSubGroups, setExpandedSkuSubGroups] = useState<Set<string>>(new Set()); // "productId::groupIdx"
  const [skuPanelSubExpand, setSkuPanelSubExpand] = useState<Set<string>>(new Set());

  // ── 目标设定 ──
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [targetDetailProduct, setTargetDetailProduct] = useState<{ product: any; engineResult: TargetEngineResult; rowMode: '单品' | '总额'; profitPerOrder: number } | null>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(null);

  // ── KPI 指标池 ──
  const ALL_PRODUCT_KPIS = useMemo(() => [
    // 商品
    { label: '商品数', key: 'productCount', group: '商品', iconName: 'Package', fmt: (v: number) => (v || 0).toFixed(0) },
    { label: '动销率', key: 'sellThroughRate', group: '商品', iconName: 'Activity', fmt: (v: number) => (v || 0).toFixed(1) + '%' },
    { label: '零销品', key: 'zeroSalesCount', group: '商品', iconName: 'AlertTriangle', fmt: (v: number) => (v || 0).toFixed(0) },
    { label: '低库存品', key: 'lowInventoryCount', group: '商品', iconName: 'AlertTriangle', fmt: (v: number) => (v || 0).toFixed(0) },
    { label: '平均周转', key: 'avgTurnover', group: '商品', iconName: 'Clock', fmt: (v: number) => (v || 0).toFixed(0) + '天' },
    // 收入
    { label: '总GMV', key: 'totalGmv', group: '收入', iconName: 'TrendingUp', fmt: (v: number) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
    { label: '总实收', key: 'totalRevenue', group: '收入', iconName: 'DollarSign', fmt: (v: number) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
    { label: '总销量', key: 'totalSales', group: '收入', iconName: 'ShoppingCart', fmt: (v: number) => (v || 0).toFixed(0) },
    { label: '客单价', key: 'avgPrice', group: '收入', iconName: 'Target', fmt: (v: number) => (v || 0) ? '¥' + (v || 0).toFixed(0) : '-' },
    // 利润
    { label: '利润总额', key: 'totalProfit', group: '利润', iconName: 'TrendingUp', fmt: (v: number) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
    { label: '利润率', key: 'profitRate', group: '利润', iconName: 'Percent', fmt: (v: number) => (v || 0).toFixed(1) + '%' },
    // 退款
    { label: '退款率', key: 'refundRate', group: '退款', iconName: 'RotateCcw', fmt: (v: number) => (v || 0).toFixed(1) + '%' },
    { label: '高退款品', key: 'highRefundCount', group: '退款', iconName: 'AlertTriangle', fmt: (v: number) => (v || 0).toFixed(0) },
    // 推广
    { label: '高推广品', key: 'highPromoCount', group: '推广', iconName: 'Zap', fmt: (v: number) => (v || 0).toFixed(0) },
    { label: '推广花费', key: 'totalPromoCost', group: '推广', iconName: 'BarChart3', fmt: (v: number) => (v || 0) >= 10000 ? '¥' + ((v || 0) / 10000).toFixed(1) + '万' : '¥' + (v || 0).toFixed(0) },
    { label: '推广ROI', key: 'avgRoi', group: '推广', iconName: 'Activity', fmt: (v: number) => (v || 0) > 0 ? (v || 0).toFixed(1) : '-' },
  ], []);

  const KPI_GROUPS = useMemo(() => {
    const groups: { name: string; items: typeof ALL_PRODUCT_KPIS }[] = [
      { name: '商品', items: [] },
      { name: '收入', items: [] },
      { name: '利润', items: [] },
      { name: '退款', items: [] },
      { name: '推广', items: [] },
    ];
    ALL_PRODUCT_KPIS.forEach(kpi => {
      const g = groups.find(g => g.name === kpi.group);
      if (g) g.items.push(kpi);
    });
    return groups;
  }, [ALL_PRODUCT_KPIS]);



  const orders = useMemo(() => {
    if (!currentDisplayData?.orders?.length) return [];
    return currentDisplayData.orders.filter((o: any) => { const st = String(o['订单状态'] || '').trim(); return !['已取消', '待付款', '代付款', '未付款', '已关闭'].includes(st); });
  }, [currentDisplayData]);

  const allDates = useMemo(() => getAllDateGroups(orders), [orders]);
  const prevOrders = useMemo(() => getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange), [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange]);
  const prevFilteredOrders = useMemo(() => {
    let result = prevOrders;
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    return result;
  }, [prevOrders, abnormalOrders]);
  const filteredOrders = useMemo(() => {
    let result = filterByTimeRange(orders, allDates, timeRange, customStart, customEnd, quickRange);
    // 剔除用户标记为排除的异常订单
    if (abnormalOrders && Object.keys(abnormalOrders).length > 0) {
      result = result.filter(o => {
        const orderNo = String(findField(o, '订单号') || '').trim();
        const ab = orderNo ? abnormalOrders[orderNo] : null;
        return !(ab && ab.status === 'excluded');
      });
    }
    return result;
  }, [orders, allDates, timeRange, customStart, customEnd, quickRange, abnormalOrders]);

  /** 按天聚合订单，构建每日KPI趋势数据（必须定义在 filteredOrders 之后） */
  const dailyTrendData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const dayMap: Record<string, any> = {};
    filteredOrders.forEach((o: any) => {
      const date = String(findField(o, '支付时间') || '').split(' ')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      if (!dayMap[date]) dayMap[date] = { date, gmv: 0, revenue: 0, sales: 0, profit: 0, orders: 0, refund: 0, promoCost: 0, productIds: new Set() };
      const d = dayMap[date];
      d.gmv += safeFloat(findField(o, '商品总价(元)', '商品总价'));
      d.revenue += safeFloat(findField(o, '商家实收金额(元)', '商家实收'));
      d.sales += safeFloat(findField(o, '商品数量(件)', '商品数量')) || 1;
      d.orders += 1;
      const pid = String(findField(o, '商品id', '商品ID') || '');
      if (pid) d.productIds.add(pid);
      const orderNo = String(findField(o, '订单号') || '');
      d.refund += safeFloat(findField(o, '退款金额(元)', '退款金额'));
    });
    // 补充推广花费（按日期匹配）
    (currentDisplayData?.promotionProducts || []).forEach((p: any) => {
      const date = String(findField(p, '日期') || '').split(' ')[0];
      if (dayMap[date]) {
        dayMap[date].promoCost += safeFloat(findField(p, '花费(元)', '总花费(元)', '成交花费(元)'));
      }
    });
    const sorted = Object.values(dayMap).sort((a: any, b: any) => a.date.localeCompare(b.date));
    return sorted.map((d: any) => ({
      date: d.date, gmv: d.gmv, revenue: d.revenue, sales: d.sales,
      profit: d.profit, orders: d.orders, refund: d.refund,
      promoCost: d.promoCost, productCount: d.productIds.size,
      avgPrice: d.orders > 0 ? d.revenue / d.orders : 0,
      refundRate: d.revenue > 0 ? (d.refund / d.revenue) * 100 : 0,
      profitRate: d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0,
    }));
  }, [filteredOrders, currentDisplayData]);

  // 构建时间过滤后的 displayData 供 useProductStats 使用
  const filteredDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    return {
      ...currentDisplayData,
      orders: filteredOrders,
      afterSaleRecords: filterPromoByTimeRange(currentDisplayData.afterSaleRecords || [], allDates, timeRange, ['申请时间'], customStart, customEnd, quickRange),
      promotionProducts: filterPromoByTimeRange(currentDisplayData.promotionProducts || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      promotionSummary: filterPromoByTimeRange(currentDisplayData.promotionSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      starStoreSummary: filterPromoByTimeRange(currentDisplayData.starStoreSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      liveStreamSummary: filterPromoByTimeRange(currentDisplayData.liveStreamSummary || [], allDates, timeRange, undefined, customStart, customEnd, quickRange),
      shippingInsurance: filterPromoByTimeRange(currentDisplayData.shippingInsurance || [], allDates, timeRange, ['日期'], customStart, customEnd, quickRange),
    };
  }, [currentDisplayData, filteredOrders, allDates, timeRange, customStart, customEnd, quickRange]);

  // 上一周期日期范围（用于过滤非订单数据）
  const prevPeriodDates = useMemo(() => {
    if (!allDates.length || timeRange === 'all') return null;

    let currentStart: Date;
    let currentEnd: Date;

    if (timeRange === 'custom' && quickRange) {
      const dates = getQuickRangeDates(quickRange);
      currentStart = new Date(dates.start);
      currentEnd = new Date(dates.end);
    } else if (timeRange === 'custom' && customStart && customEnd) {
      currentStart = new Date(customStart);
      currentEnd = new Date(customEnd);
    } else if (timeRange === 'custom' || isNaN(parseInt(timeRange))) {
      return null;
    } else {
      const lastDate = allDates[allDates.length - 1][0];
      const lastD = new Date(lastDate);
      const rangeDays = parseInt(timeRange) || 7;
      currentEnd = lastD;
      currentStart = new Date(lastD);
      currentStart.setDate(currentStart.getDate() - rangeDays + 1);
    }

    if (isNaN(currentStart.getTime()) || isNaN(currentEnd.getTime())) return null;

    const periodDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / 86400000) + 1;
    const prevEnd = new Date(currentStart);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - periodDays + 1);

    return {
      start: prevStart.toISOString().split('T')[0],
      end: prevEnd.toISOString().split('T')[0],
    };
  }, [allDates, timeRange, customStart, customEnd, quickRange]);

  // 按指定日期范围过滤非订单数据
  const filterByDateRange = (data: any[], dateField: string, startDate: string, endDate: string) => {
    if (!data || !data.length) return data || [];
    return data.filter(item => {
      const dateStr = dateField ? item[dateField] : (item['日期'] || item['申请时间'] || item['支付时间'] || '');
      if (!dateStr) return true;
      const d = String(dateStr).trim().split(' ')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true;
      return d >= startDate && d <= endDate;
    });
  };

  // 上一周期数据（用于同比/环比）
  const prevDisplayData = useMemo(() => {
    if (!currentDisplayData) return null;
    if (!prevPeriodDates) {
      return {
        ...currentDisplayData,
        orders: prevFilteredOrders,
      };
    }
    const { start, end } = prevPeriodDates;
    return {
      ...currentDisplayData,
      orders: prevFilteredOrders,
      afterSaleRecords: filterByDateRange(currentDisplayData.afterSaleRecords || [], '申请时间', start, end),
      promotionProducts: filterByDateRange(currentDisplayData.promotionProducts || [], '日期', start, end),
      promotionSummary: filterByDateRange(currentDisplayData.promotionSummary || [], '日期', start, end),
      starStoreSummary: filterByDateRange(currentDisplayData.starStoreSummary || [], '日期', start, end),
      liveStreamSummary: filterByDateRange(currentDisplayData.liveStreamSummary || [], '日期', start, end),
      shippingInsurance: filterByDateRange(currentDisplayData.shippingInsurance || [], '日期', start, end),
    };
  }, [currentDisplayData, prevFilteredOrders, prevPeriodDates]);

  // ★ 服务端计算商品统计（替代浏览器端 useProductStats 945行）
  const { currentStore } = useStore();
  const [productStats, setProductStats] = useState<Record<string, ProductStat>>({});
  const [prevProductStats, setPrevProductStats] = useState<Record<string, ProductStat>>({});
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    const sid = currentStore?.id;
    if (!sid) return;
    setStatsLoading(true);
    apiClient.get(`/analytics/products/stats?storeId=${encodeURIComponent(sid)}`)
      .then(res => { if (res.success && res.data) setProductStats(res.data); })
      .catch(() => {})
      .finally(() => setStatsLoading(false));
  }, [currentStore?.id]);
  const drawerProduct = useProductDetail(productStats, drawerProductId);
  const compareOrders = useMemo(() => compareEnabled ? getCompareOrders(orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange) : [], [orders, allDates, timeRange, compareStart, compareEnd, customStart, customEnd, quickRange, compareEnabled]);

  // Convert productStats to list format for table display
  const products = useMemo(() => {
    return Object.values(productStats).map(s => ({
      id: s.productId,
      name: s.productName,
      code: s.productCode,
      sales: s.sales,
      revenue: s.revenue,
      orders: s.orders,
      afterSale: s.afterSaleCount,
      refund: s.refund,
      refundCount: s.refundCount || 0,
      costs: s.totalCost,
      avgPrice: s.avgOrderValue,
      afterSaleRate: s.afterSaleRate,
      refundRate: s.refundRate,
      profit: s.netProfit,
      profitRate: s.profitRate,
      gmv: s.gmv,
      promoCost: s.promoCost,
      promoTransaction: s.promoTransaction,
      promoClicks: s.promoClicks,
      promoImpressions: s.promoImpressions,
      roi: s.roi,
      grossProfit: s.grossProfit || 0,
      preTaxProfit: s.preTaxProfit || 0,
      netProfitAfterTax: s.netProfitAfterTax || s.netProfit,
      costBreakdown: s.costBreakdown || { productCost: 0, packagingFee: 0, shippingFee: 0, promoCost: 0, discount: 0, platformFee: 0, taxes: 0, customDeductions: 0 },
      costSource: s.costSource || { productCost: 'missing', taxes: 'default', customDeductions: 'none' },
      taxDetails: s.taxDetails || [],
      deductionDetails: s.deductionDetails || [],
      profitConfidence: s.profitConfidence || 'low',
      discountRatio: s.discountRatio,
      promoCostRatio: s.promoCostRatio,
      firstDate: s.firstOrderDate,
      lastDate: s.lastOrderDate,
      tags: productTags[s.productId] || [],
      inventory: s.inventoryEstimate,
      inventoryStatus: (s.avgDailySales ?? 0) <= 0 ? 'out' : (s.avgDailySales ?? 0) < 2 ? 'low' : 'normal',
      activeDays: s.activeDays,
      avgDailySales: s.avgDailySales,
      turnoverDays: s.turnoverDays,
      sellThroughRate: s.sellThroughRate,
      hourlyPromotedOrders: s.hourlyPromotedOrders || 0,
      hourlyConfirmed: s.hourlyConfirmed || false,
    }));
  }, [productStats, productTags]);

  // 上一周期商品列表（用于环比计算）
  const prevProducts = useMemo(() => {
    return Object.values(prevProductStats).map(s => ({
      id: s.productId,
      name: s.productName,
      code: s.productCode,
      sales: s.sales,
      revenue: s.revenue,
      orders: s.orders,
      afterSale: s.afterSaleCount,
      refund: s.refund,
      refundCount: s.refundCount || 0,
      costs: s.totalCost,
      avgPrice: s.avgOrderValue,
      afterSaleRate: s.afterSaleRate,
      refundRate: s.refundRate,
      profit: s.netProfit,
      profitRate: s.profitRate,
      gmv: s.gmv,
      promoCost: s.promoCost,
      promoTransaction: s.promoTransaction,
      promoClicks: s.promoClicks,
      promoImpressions: s.promoImpressions,
      roi: s.roi,
      grossProfit: s.grossProfit || 0,
      preTaxProfit: s.preTaxProfit || 0,
      netProfitAfterTax: s.netProfitAfterTax || s.netProfit,
      discountRatio: s.discountRatio,
      promoCostRatio: s.promoCostRatio,
      firstDate: s.firstOrderDate,
      lastDate: s.lastOrderDate,
      inventory: s.inventoryEstimate,
      inventoryStatus: (s.avgDailySales ?? 0) <= 0 ? 'out' : (s.avgDailySales ?? 0) < 2 ? 'low' : 'normal',
      activeDays: s.activeDays,
      avgDailySales: s.avgDailySales,
      turnoverDays: s.turnoverDays,
      sellThroughRate: s.sellThroughRate,
      hourlyPromotedOrders: s.hourlyPromotedOrders || 0,
      hourlyConfirmed: s.hourlyConfirmed || false,
    }));
  }, [prevProductStats]);

  const prevProductMap = useMemo(() => {
    const map: Record<string, any> = {};
    prevProducts.forEach(p => { map[p.id] = p; });
    return map;
  }, [prevProducts]);

  const filteredProducts = useMemo(() => {
    let result = products;
    // 搜索过滤：支持商品ID、商品名称、商家编码
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      result = result.filter(p =>
        (p.id && p.id.toLowerCase().includes(kw)) ||
        (p.name && p.name.toLowerCase().includes(kw)) ||
        (p.code && p.code.toLowerCase().includes(kw))
      );
    }
    if (priceFilter !== 'all') {
      const [min, max] = priceFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.avgPrice >= min && p.avgPrice < (max || Infinity));
    }
    if (salesFilter !== 'all') {
      const [min, max] = salesFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.sales >= min && p.sales < (max || Infinity));
    }
    if (afterSaleFilter !== 'all') {
      const [min, max] = afterSaleFilter.split('-').map(v => v === 'max' ? Infinity : parseInt(v));
      result = result.filter(p => p.afterSaleRate >= min && p.afterSaleRate < (max || Infinity));
    }
    if (listFilter === 'active') result = result.filter(p => p.sales > 0);
    if (listFilter === 'zero') result = result.filter(p => p.sales <= 0);
    // 标签筛选
    if (activeTagFilter) {
      const filteredIds = tagFilterProductIds[activeTagFilter] || [];
      const idSet = new Set(filteredIds);
      result = result.filter(p => idSet.has(p.id));
    }
    return result;
  }, [products, priceFilter, salesFilter, afterSaleFilter, searchKeyword, listFilter, activeTagFilter, tagFilterProductIds]);

  // ── 自动标签系统（基于所有商品计算，不受筛选影响） ──
  const { autoTags, tagCounts, tagProductIds: tagFilterProductIds } = useMemo(() => {
    return computeAllTags(products, productStats);
  }, [products, productStats]);

  // 当前有标签筛选时，重置页码
  useEffect(() => {
    if (activeTagFilter) setCurrentPage(1);
  }, [activeTagFilter]);

  const sortedProducts = useMemo(() => {
    const sorted = [...filteredProducts].sort((a: any, b: any) => {
      const av = a[sortField], bv = b[sortField];
      if (typeof av === 'number' && typeof bv === 'number') return sortDesc ? bv - av : av - bv;
      return sortDesc ? String(bv).localeCompare(String(av)) : String(av).localeCompare(String(bv));
    });
    return sorted;
  }, [filteredProducts, sortField, sortDesc]);

  const paginatedProducts = useMemo(() => sortedProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize), [sortedProducts, currentPage]);
  const totalPages = Math.ceil(sortedProducts.length / pageSize);

  const kpiMetrics = useMemo(() => {
    if (!filteredProducts.length) return null;
    const productIds = new Set(filteredProducts.map(p => p.id));
    const totalSales = filteredProducts.reduce((s, p) => s + p.sales, 0);
    const totalRevenue = filteredProducts.reduce((s, p) => s + p.revenue, 0);
    const totalProfit = filteredProducts.reduce((s, p) => s + p.profit, 0);
    const totalGmv = filteredProducts.reduce((s, p) => s + p.gmv, 0);
    const avgPrice = filteredProducts.length > 0 ? totalRevenue / filteredProducts.reduce((s, p) => s + p.orders, 0) : 0;
    const afterSaleCount = filteredProducts.reduce((s, p) => s + p.afterSale, 0);
    const totalOrders = filteredProducts.reduce((s, p) => s + p.orders, 0);
    const afterSaleRate = totalOrders > 0 ? (afterSaleCount / totalOrders) * 100 : 0;
    const zeroSales = filteredProducts.filter(p => p.sales <= 0).length;
    const lowInventory = filteredProducts.filter(p => p.inventoryStatus === 'low').length;
    const activeProducts = filteredProducts.filter(p => p.sales > 0).length;
    const sellThroughRate = filteredProducts.length > 0 ? (activeProducts / filteredProducts.length) * 100 : 0;
    const avgTurnover = filteredProducts.reduce((s, p) => s + (p.turnoverDays < 999 ? p.turnoverDays : 0), 0) / (filteredProducts.filter(p => p.turnoverDays < 999).length || 1);
    const avgPromoRatio = filteredProducts.reduce((s, p) => s + p.promoCostRatio, 0) / (filteredProducts.length || 1);
    const totalRefundOrders = filteredProducts.reduce((s, p) => s + (p.refundCount || 0), 0);
    const refundRate = totalOrders > 0 ? (totalRefundOrders / totalOrders) * 100 : 0;

    // 计算环比变化
    const diffs: Record<string, number | null> = {};
    const prevMatched = prevProducts.filter(p => productIds.has(p.id));
    if (prevMatched.length > 0) {
      const prevSales = prevMatched.reduce((s, p) => s + p.sales, 0);
      const prevRevenue = prevMatched.reduce((s, p) => s + p.revenue, 0);
      const prevProfit = prevMatched.reduce((s, p) => s + p.profit, 0);
      const prevGmv = prevMatched.reduce((s, p) => s + p.gmv, 0);
      const prevOrders = prevMatched.reduce((s, p) => s + p.orders, 0);
      const prevActive = prevMatched.filter(p => p.sales > 0).length;
      const prevAvgPrice = prevOrders > 0 ? prevRevenue / prevOrders : 0;
      const prevSellThrough = prevMatched.length > 0 ? (prevActive / prevMatched.length) * 100 : 0;
      diffs.productCount = changePct(productIds.size, prevMatched.length);
      diffs.totalGmv = changePct(totalGmv, prevGmv);
      diffs.totalRevenue = changePct(totalRevenue, prevRevenue);
      diffs.totalProfit = changePct(totalProfit, prevProfit);
      diffs.avgPrice = changePct(avgPrice, prevAvgPrice);
      diffs.sellThroughRate = changePct(sellThroughRate, prevSellThrough);
    } else {
      diffs.productCount = null; diffs.totalGmv = null; diffs.totalRevenue = null;
      diffs.totalProfit = null; diffs.avgPrice = null; diffs.sellThroughRate = null;
    }
    return { productCount: productIds.size, totalSales, totalRevenue, totalProfit, totalGmv, avgPrice, afterSaleRate, zeroSales, lowInventory, sellThroughRate, avgTurnover, avgPromoRatio, refundRate, diffs };
  }, [filteredProducts, prevProducts]);

  // ── 全店汇总（用于计算商品占比） ──
  const storeTotals = useMemo(() => {
    const totalSales = filteredProducts.reduce((s, p) => s + (p.sales || 0), 0);
    const totalPromo = filteredProducts.reduce((s, p) => s + (p.promoCost || 0), 0);
    const totalOrders = filteredProducts.reduce((s, p) => s + (p.orders || 0), 0);
    return { totalSales, totalPromo, totalOrders };
  }, [filteredProducts]);

  const radarData = useMemo(() => {
    if (!selectedProduct) return [];
    const p = products.find(x => x.id === selectedProduct);
    if (!p) return [];
    return [
      { subject: '销量', A: Math.min(100, p.sales / 10), fullMark: 100 },
      { subject: '收入', A: Math.min(100, p.revenue / 100), fullMark: 100 },
      { subject: '利润', A: Math.min(100, p.profit / 50), fullMark: 100 },
      { subject: '售后率', A: 100 - p.afterSaleRate, fullMark: 100 },
      { subject: '动销', A: p.sales > 0 ? 100 : 0, fullMark: 100 },
    ];
  }, [selectedProduct, products]);

  // 选中商品的订单明细（融合订单级数据）
  const selectedProductOrders = useMemo(() => {
    if (!selectedProduct) return [];
    return filteredOrders.filter(o => {
      const pid = String(o['商品id'] || o['商品ID'] || '').trim();
      return pid === selectedProduct;
    });
  }, [selectedProduct, filteredOrders]);

  // SKU 辅助：从订单行查找字段值
  const fv = (o: any, fields: string[]): string => {
    const keys = Object.keys(o);
    for (const f of fields) {
      const fClean = f.toLowerCase().replace(/[\s\-_()（）\[\]【】]/g, '');
      for (const k of keys) {
        const kClean = k.replace(/[﻿ \t\r\n\s\-_()（）\[\]【】]/g, '').toLowerCase();
        if (kClean === fClean || kClean.includes(fClean)) { const v = o[k]; if (v != null && v !== '') return String(v).trim(); }
      }
    }
    return '';
  };
  const fn = (o: any, fields: string[]): number => {
    for (const f of fields) {
      const v = fv(o, [f]); if (v) { const n = parseFloat(v.replace(/[^\d.\-]/g, '')); if (!isNaN(n)) return n; }
    }
    return 0;
  };

  // 真正的 SKU 级别统计（按 productId + skuId 分组）
  const skuData = useMemo(() => {
    if (!filteredOrders.length) return [];
    const skuMap: Record<string, {
      productId: string; productName: string; skuId: string; skuName: string;
      sales: number; revenue: number; gmv: number; orders: number; refund: number;
      prices: number[];
    }> = {};
    const productSalesMap: Record<string, number> = {}; // 商品总销量，用于计算占比

    filteredOrders.forEach((o: any) => {
      const pid = fv(o, ['商品id', '商品ID', 'productId']);
      if (!pid) return;
      const skuId = fv(o, ['规格id', '规格ID', 'sku_id', 'style_id', '商品规格ID', 'spec_id']) || pid;
      const skuName = fv(o, ['规格名称', '商品规格', '规格', 'sku_name', 'spec_name']) || '-';
      const key = `${pid}_${skuId}`;

      if (!skuMap[key]) {
        skuMap[key] = { productId: pid, productName: fv(o, ['商品名称', '商品']), skuId, skuName, sales: 0, revenue: 0, gmv: 0, orders: 0, refund: 0, prices: [] };
      }
      const qty = fn(o, ['商品数量(件)', '商品数量', '数量']) || 1;
      skuMap[key].sales += qty;
      skuMap[key].revenue += fn(o, ['商家实收金额(元)', '商家实收', '实收金额']);
      skuMap[key].gmv += fn(o, ['商品总价(元)', '商品总价']) || fn(o, ['用户实付金额(元)', '用户实付']);
      skuMap[key].orders += 1;
      skuMap[key].refund += fn(o, ['退款金额(元)', '退款金额']);
      // 使用商品总价(元)作为价格信号 - 用户指定的"订单维度的出售价格"
      const price = fn(o, ['商品总价(元)', '商品总价']) || fn(o, ['用户实付金额(元)', '用户实付']);
      if (price > 0) skuMap[key].prices.push(price);

      productSalesMap[pid] = (productSalesMap[pid] || 0) + qty;
    });

    return Object.values(skuMap).map(s => {
      const avgPrice = s.orders > 0 ? s.revenue / s.orders : 0;
      const productTotalSales = productSalesMap[s.productId] || s.sales;
      const salesShare = productTotalSales > 0 ? (s.sales / productTotalSales) * 100 : 100;
      // SKU 成本：优先匹配精确 SKU key，其次商品ID，最后用默认成本比例
      const skuKey = `${s.productId}_${s.skuId}`;
      let skuUnitCost = 0;
      if (productCosts) {
        if (productCosts[skuKey] !== undefined && productCosts[skuKey] > 0) {
          skuUnitCost = productCosts[skuKey];
        } else if (productCosts[s.productId] !== undefined && productCosts[s.productId] > 0) {
          skuUnitCost = productCosts[s.productId];
        }
      }
      const productCostTotal = skuUnitCost > 0
        ? skuUnitCost * s.sales
        : (defaultCostRatio ?? 30) / 100 * s.gmv;
      const perOrderFees = ((packagingFeePerOrder || 0) + (shippingFeePerOrder || 0)) * s.orders;
      const totalCost = productCostTotal + perOrderFees;
      const netProfit = s.revenue - totalCost - s.refund;
      const profitRate = s.revenue > 0 ? (netProfit / s.revenue) * 100 : 0;
      return {
        ...s,
        avgPrice,
        salesShare,
        netProfit,
        profitRate,
        skuCode: s.skuId !== s.productId ? s.skuId : (s.productId.slice(-6)),
      };
    }).sort((a, b) => b.sales - a.sales);
  }, [filteredOrders, productCosts, defaultCostRatio, packagingFeePerOrder, shippingFeePerOrder]);

  // 历史最低价（按产品+SKU，从全部订单的"商品总价(元)"字段获取）
  const historicalMinPrices = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    orders.forEach((o: any) => {
      const pid = fv(o, ['商品id', '商品ID', 'productId']);
      if (!pid) return;
      const skuId = fv(o, ['规格id', '规格ID', 'sku_id', 'style_id', '商品规格ID', 'spec_id']) || pid;
      const price = fn(o, ['商品总价(元)', '商品总价']);
      if (price <= 0) return;
      if (!map[pid]) map[pid] = {};
      const cur = map[pid][skuId];
      if (cur === undefined || price < cur) map[pid][skuId] = price;
    });
    return map;
  }, [orders]);

  // SKU矩阵数据：按商品分组 + 智能压缩 (must be defined AFTER skuData)
  const productSkuMap = useMemo(() => {
    const map = new Map<string, any[]>();
    skuData.forEach(s => {
      if (!map.has(s.productId)) map.set(s.productId, []);
      map.get(s.productId)!.push(s);
    });
    return map;
  }, [skuData]);
  const productSkuEntries = useMemo(() => {
    const entries = Array.from(productSkuMap.entries());
    entries.sort((a, b) => {
      const salesA = a[1].reduce((s, sku) => s + (sku.sales || 0), 0);
      const salesB = b[1].reduce((s, sku) => s + (sku.sales || 0), 0);
      return salesB - salesA;
    });
    return entries.slice(0, 30);
  }, [productSkuMap]);

  const priceElasticity = useMemo(() => {
    if (!filteredProducts.length) return [];
    const data = filteredProducts.slice(0, 30).map(p => ({
      price: p.avgPrice, sales: p.sales, name: p.name.slice(0, 10), profit: p.profit, discountRatio: p.discountRatio, profitRate: p.profitRate
    }));
    // 价格带分层统计
    const bands: Record<string, { min: number; max: number; count: number; totalSales: number; totalProfit: number; avgProfitRate: number }> = {};
    data.forEach(p => {
      const bandKey = p.price < 20 ? '¥0-20' : p.price < 50 ? '¥20-50' : p.price < 100 ? '¥50-100' : p.price < 200 ? '¥100-200' : '¥200+';
      const band = bands[bandKey] || (bands[bandKey] = { min: 0, max: 0, count: 0, totalSales: 0, totalProfit: 0, avgProfitRate: 0 });
      band.count++;
      band.totalSales += p.sales;
      band.totalProfit += p.profit;
      const [lo, hi] = bandKey.replace('¥', '').replace('+', '-99999').split('-').map(Number);
      band.min = lo;
      band.max = hi === 99999 ? Infinity : hi;
    });
    Object.values(bands).forEach(b => { b.avgProfitRate = b.totalSales > 0 ? (b.totalProfit / b.totalSales) * 100 : 0; });
    return { scatter: data, bands: Object.entries(bands).map(([k, v]) => ({ label: k, ...v })).sort((a, b) => a.min - b.min) };
  }, [filteredProducts]);

  const compareData = useMemo(() => products.filter(p => compareProducts.includes(p.id)), [compareProducts, products]);

  const toggleCompare = (id: string) => {
    setCompareProducts(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 5 ? [...prev, id] : prev);
  };

  const addTag = (productId: string) => {
    if (!tagInput.trim()) return;
    setProductTags(prev => ({ ...prev, [productId]: [...(prev[productId] || []), tagInput.trim()] }));
    setTagInput('');
    setTaggingProduct(null);
  };

  const removeTag = (productId: string, tag: string) => {
    setProductTags(prev => ({ ...prev, [productId]: (prev[productId] || []).filter(t => t !== tag) }));
  };

  
  // ── 列配置 ──
  const PER_UNIT_COLS = [
    { key: 'cost', label: '成本', width: '60px' },
    { key: 'price', label: '售价', width: '58px' },
    { key: 'profit', label: '单品利润', width: '68px' },
    { key: 'marginRate', label: '毛利率', width: '56px' },
    { key: 'promoPerUnit', label: '单品推广', width: '68px' },
    { key: 'refundRate', label: '退款率', width: '56px' },
    { key: 'sales', label: '销量', width: '50px' },
    { key: 'orders', label: '订单', width: '50px' },
  ];
  const TOTAL_COLS = [
    { key: 'totalCost', label: '总成本', width: '62px' },
    { key: 'gmv', label: 'GMV', width: '62px' },
    { key: 'totalProfit', label: '总利润', width: '62px' },
    { key: 'profitRate', label: '利润率', width: '56px' },
    { key: 'roi', label: 'ROI', width: '48px' },
    { key: 'refundRate', label: '退款率', width: '56px' },
    { key: 'sales', label: '销量', width: '50px' },
    { key: 'orders', label: '订单', width: '50px' },
    { key: 'avgPrice', label: '客单价', width: '56px' },
  ];

  // ── 获取单元格数据 ──
  function getCellData(colKey: string, p: any): { val: number; tgtNum: number; refNum: number; fmt: string; clr?: string; refFmt: string } {
    const uc = p.unitCost || 0;
    const ap = p.avgPrice || 0;
    const sa = p.sales || 0;
    const pc = p.promoCost || 0;
    const pp = ap > 0 && uc > 0 ? ap - uc : 0;
    const mr = ap > 0 && uc > 0 ? (ap - uc) / ap * 100 : 0;
    const fmtMoney = (v: number) => v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' : (v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(v < 10 ? 2 : 1));
    const fmtPct = (v: number) => v.toFixed(1) + '%';
    const fmtInt = (v: number) => v.toFixed(0);
    switch (colKey) {
      case 'cost': return { val: uc, tgtNum: 0, refNum: uc, fmt: uc > 0 ? fmtMoney(uc) : '--', refFmt: uc > 0 ? fmtMoney(uc) : '--' };
      case 'price': return { val: ap, tgtNum: 0, refNum: ap, fmt: ap > 0 ? fmtMoney(ap) : '--', refFmt: ap > 0 ? fmtMoney(ap) : '--' };
      case 'profit': return { val: pp, tgtNum: 0, refNum: pp, fmt: pp !== 0 ? (pp > 0 ? '¥' : '-¥') + Math.abs(pp).toFixed(2) : '¥0.00', refFmt: pp !== 0 ? (pp > 0 ? '¥' : '-¥') + Math.abs(pp).toFixed(2) : '¥0.00', clr: 'var(--pdd-text)' };
      case 'marginRate': return { val: mr, tgtNum: 0, refNum: mr, fmt: mr > 0 ? fmtPct(mr) : '--', refFmt: mr > 0 ? fmtPct(mr) : '--' };
      case 'promoPerUnit': { const pu = sa > 0 ? pc / sa : 0; return { val: pu, tgtNum: 0, refNum: pu, fmt: pu > 0 ? fmtMoney(pu) : '--', refFmt: pu > 0 ? fmtMoney(pu) : '--' }; }
      case 'refundRate': return { val: p.refundRate || 0, tgtNum: 0, refNum: p.refundRate || 0, fmt: fmtPct(p.refundRate || 0), refFmt: fmtPct(p.refundRate || 0) };
      case 'sales': return { val: sa, tgtNum: 0, refNum: sa, fmt: fmtInt(sa), refFmt: fmtInt(sa) };
      case 'orders': return { val: p.orders || 0, tgtNum: 0, refNum: p.orders || 0, fmt: fmtInt(p.orders || 0), refFmt: fmtInt(p.orders || 0) };
      case 'totalCost': return { val: uc * sa, tgtNum: 0, refNum: uc * sa, fmt: uc > 0 ? fmtMoney(uc * sa) : '--', refFmt: uc > 0 ? fmtMoney(uc * sa) : '--' };
      case 'gmv': return { val: p.gmv || 0, tgtNum: 0, refNum: p.gmv || 0, fmt: (p.gmv || 0) >= 10000 ? '¥' + ((p.gmv || 0) / 10000).toFixed(1) + '万' : '¥' + (p.gmv || 0).toFixed(0), refFmt: (p.gmv || 0) >= 10000 ? '¥' + ((p.gmv || 0) / 10000).toFixed(1) + '万' : '¥' + (p.gmv || 0).toFixed(0) };
      case 'totalProfit': return { val: p.profit || 0, tgtNum: 0, refNum: p.profit || 0, fmt: (p.profit || 0) >= 0 ? '¥' + (p.profit || 0).toFixed(0) : '-¥' + Math.abs(p.profit || 0).toFixed(0), refFmt: (p.profit || 0) >= 0 ? '¥' + (p.profit || 0).toFixed(0) : '-¥' + Math.abs(p.profit || 0).toFixed(0), clr: 'var(--pdd-text)' };
      case 'profitRate': return { val: p.profitRate || 0, tgtNum: 0, refNum: p.profitRate || 0, fmt: fmtPct(p.profitRate || 0), refFmt: fmtPct(p.profitRate || 0) };
      case 'roi': return { val: p.roi || 0, tgtNum: 0, refNum: p.roi || 0, fmt: (p.roi || 0) > 0 ? (p.roi || 0).toFixed(1) : '-', refFmt: (p.roi || 0) > 0 ? (p.roi || 0).toFixed(1) : '-' };
      case 'avgPrice': return { val: ap, tgtNum: 0, refNum: ap, fmt: ap > 0 ? fmtMoney(ap) : '--', refFmt: ap > 0 ? fmtMoney(ap) : '--' };
      default: return { val: 0, tgtNum: 0, refNum: 0, fmt: '--', refFmt: '--' };
    }
  }

  // ── 通用规格名称解析 ──
  // 解析中文电商规格名，提取数量、颜色、尺寸、款式
  // 面对全品类商家：服装/食品/百货/数码
  // Pattern A: 数字+单位 (1件装, 2个)
  // Pattern B: 中文数字+单位 (一件, 两双, 单件)
  // Pattern C: 纯数字 (1, 2) — PDD常见
  // Pattern D: 中文数量词 (单/双/对装)
  function parseSpecName(name: string): { quantity: number | null; unit: string | null; color: string | null; size: string | null; style: string | null; base: string } {
    if (!name || name === '-') return { quantity: null, unit: null, color: null, size: null, style: null, base: name || '' };

    // 中文数字 ↔ 阿拉伯数字
    const cnNumMap: Record<string, number> = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10, '单': 1, '双': 2, '对': 2, '半': 0.5 };
    // 所有可能的数量单位（按长度降序优先匹配长词）
    const allUnits = ['件装','个装','双装','对装','包装','盒装','瓶装','罐装','袋装','支装','只装','片装','条装','套装','份装','板装','排装','听装','管装','粒装','枚装','卷装','桶装','箱装','打装',
                      '件','个','双','对','包','盒','瓶','罐','袋','套','组','支','只','条','片',
                      '斤','两','千克','克','公斤','颗','粒','枚','本','册','副','付','顶','根','块','把','串','打','桶','箱','卷',
                      '份','板','排','听','管','筒','扎','捆','贴','杯','碗','盘','碟','勺','ml','L','g','kg'];

    let rest = name.trim();
    let quantity: number | null = null;
    let unit: string | null = null;

    // Step 1: 提取数量 — 多策略串行
    // 1A: 阿拉伯数字 + 单位 (1件装, 2个, 3双, 5斤...)
    //     按单位长度降序匹配，避免"件"抢在"件装"前
    const sortedUnits = [...allUnits].sort((a, b) => b.length - a.length);
    for (const u of sortedUnits) {
      const escU = u.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
      const pat = new RegExp('^(\\d+)\\s*' + escU);
      const m = rest.match(pat);
      if (m) {
        quantity = parseInt(m[1]);
        unit = u;
        rest = rest.replace(m[0], '').trim();
        break;
      }
      // 也匹配非开头位置，但只在数量词后无杂乱文本时
      const m2 = rest.match(new RegExp('(?:^|[\\s\\/\\-_·])(\\d+)\\s*' + escU + '(?:$|[\\s\\/\\-_·,，])'));
      if (m2) {
        quantity = parseInt(m2[1]);
        unit = u;
        rest = rest.replace(m2[0], '').trim();
        break;
      }
    }

    // 1B: 中文数字 + 单位 (一件, 两双, 三包, 单件)
    if (quantity === null) {
      for (const u of sortedUnits) {
        const escU = u.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, '\\$1');
        const cnPat = new RegExp('^([一两二三四五六七八九十单双对半])\\s*' + escU);
        const m = rest.match(cnPat);
        if (m && cnNumMap[m[1]] !== undefined) {
          quantity = cnNumMap[m[1]];
          unit = u;
          rest = rest.replace(m[0], '').trim();
          break;
        }
      }
    }

    // 1C: 纯数字 — 整个规格名就是数字 (PDD最常见: "1", "2", "3")
    if (quantity === null) {
      const justNum = rest.match(/^(\d+)$/);
      if (justNum) {
        quantity = parseInt(justNum[1]);
        unit = '件';
        rest = '';
      }
    }

    // Step 2: 提取颜色 (PDD全品类色名)
    const colorPatterns = [
      // 常见色系
      '中国红','珊瑚红','番茄红','朱红','嫣红','玫红','酒红','枣红','砖红','铁锈红',
      '橘粉','肉粉','豆沙粉','樱花粉','少女粉','芭比粉','裸粉','桃粉','藕粉',
      '卡其','驼色','米色','米白','象牙白','奶白','杏色','裸色','肤色','奶茶色','燕麦色',
      '天蓝','藏青','宝蓝','湖蓝','靛蓝','藏蓝','海蓝','深蓝','浅蓝','婴儿蓝','雾霾蓝','牛仔蓝','天空蓝',
      '墨绿','草绿','军绿','荧光绿','翠绿','薄荷绿','橄榄绿','深绿','浅绿','抹茶绿','豆绿','苹果绿',
      '银灰','烟灰','炭灰','深灰','浅灰','高级灰','雾灰',
      '薰衣草','玫紫','浅紫','深紫','香芋紫','葡萄紫',
      '荧光','渐变','印花','条纹','格子','波点','纯色','花色','拼色','撞色',
      '巧克力','咖啡色','咖啡','燕麦','杏仁色','栗色','棕色',
      '红色','橙色','黄色','绿色','青色','蓝色','紫色','黑色','白色','灰色','棕色',
      '粉色','金色','银色','透明','牛仔',
      // 材质色
      '透明','磨砂','哑光','亮光','珠光','闪粉',
      '黑白','蓝白','红白','黑红','蓝红',
    ];
    let color: string | null = null;
    for (const c of colorPatterns) {
      if (rest.includes(c)) {
        color = c;
        rest = rest.replace(c, '').trim();
        break;
      }
    }

    // Step 3: 提取尺寸
    let size: string | null = null;
    const sizeMatch = rest.match(/^(S|M|L|XL|XXL|XXXL|均码|加大|加小|超大|超小|标准|迷你|F|均|free)$/i);
    if (sizeMatch) {
      size = sizeMatch[1].toUpperCase();
      rest = rest.replace(sizeMatch[0], '').trim();
    } else {
      const numSize = rest.match(/^(\d{3,4})$/);
      if (numSize && parseInt(numSize[1]) >= 100 && parseInt(numSize[1]) <= 220) {
        size = numSize[1];
        rest = rest.replace(numSize[0], '').trim();
      }
    }

    // Step 4: 提取款式/套餐/型号/阶段
    let style: string | null = null;
    const styleMatch = rest.match(/([A-Za-z]+款|套餐\d+|组合\d+|方案\d+|\d+号|款\d+|版\d+|[ABCDEFG]款|[甲乙丙丁]|标准款|豪华款|普通款|升级款|经典款|阶段[一二三四五六七八九十]?|[一二三四五六七八九十]+阶段|标准|舒适|加厚|薄款|升级版|基础版|简约版|精装版|豪华版)/);
    if (styleMatch) {
      style = styleMatch[1];
      rest = rest.replace(styleMatch[0], '').trim();
    }

    rest = rest.replace(/[\/\-_·\s()（）\[\]【】「」『』【】]+/g, '').trim();

    return { quantity, unit, color, size, style, base: rest || (quantity ? '__qty__' : name) };
  }

  // ── SKU 智能压缩 ──
  // 按规格名语义分组 + 价格关系分组。面对全品类：
  //   Strategy 1 (数量型): 1件装/2件装 → 按数量聚合（仅要求多数SKU有数量信息）
  //   Strategy 2 (价格关系型): 新！利用历史订单价格检测SKU间稳定比例关系
  //     PDD改价是按批改的：所有"1件"同时同幅变价，"2件"也是
  //     价格变了但比例不变(1:1.8) → 用比例而不是绝对价格分组
  //   Strategy 3 (属性型): 颜色/尺寸/款式/阶段 → 按属性聚合
  //   Strategy 4 (纯数字): "1","2" → 按数值聚合（PDD极常见）
  //   Strategy 5 (价格聚类): 最终保底——按价格比例聚类而非精确价格
  // 两层下钻: 聚合组 → 点击展开 → 显示组内详细SKU列表
  // 命名规则: 统一用"规格一""规格二""规格三"... 按价格排序，不从SKU名截取
  function groupSKUs(skuList: any[]): {
    groups: {
      label: string; price: number; count: number;
      sales: number; revenue: number; profit: number; orders: number;
      items: { skuKey: string; skuName: string; sales: number; price: number; revenue: number; profit: number }[];
    }[];
  } {
    if (!skuList.length) return { groups: [] };

    const cnDigits = ['一','二','三','四','五','六','七','八','九','十'];

    // 统一标签生成器：按价格排序后分配 "规格一" "规格二" ...
    function labelGroups(groups: { label: string; price: number; count: number; sales: number; revenue: number; profit: number; orders: number; items: { skuKey: string; skuName: string; sales: number; price: number; revenue: number; profit: number }[] }[]) {
      const sorted = [...groups].sort((a, b) => a.price - b.price);
      return sorted.map((g, i) => ({ ...g, label: cnDigits[i] ? `规格${cnDigits[i]}` : `规格${i+1}` }));
    }

    const parsed = skuList.map(s => {
      const p = parseSpecName(s.skuName || '');
      return { ...s, parsed: p };
    });

    // ── 计算每个SKU的"锚定价格"（从历史订单价格中取众数）──
    // PDD商家频繁改价但按批改，历史价格模式比当前价格更稳定
    function getAnchorPrice(s: any): number {
      if (s.prices && Array.isArray(s.prices) && s.prices.length > 0) {
        // 计算众数（最常出现的价格）
        const freq: Record<number, number> = {};
        let maxFreq = 0;
        let modePrice = s.prices[0];
        s.prices.forEach((p: number) => {
          // 四舍五入到角(¥0.1精度)以容忍微小浮动
          const k = Math.round(p * 10) / 10;
          freq[k] = (freq[k] || 0) + 1;
          if (freq[k] > maxFreq) { maxFreq = freq[k]; modePrice = k; }
        });
        return modePrice;
      }
      return s.avgPrice || 0;
    }

    /* ─── 工具: 从条目生成分组 ─── */
    function makeGroups(entries: { items: typeof parsed }[]) {
      return entries.map(({ items }) => ({
        label: '',
        price: items.reduce((s, i) => s + (i.avgPrice || 0), 0) / items.length,
        count: items.length,
        sales: items.reduce((s, i) => s + (i.sales || 0), 0),
        revenue: items.reduce((s, i) => s + (i.revenue || 0), 0),
        profit: items.reduce((s, i) => s + (i.netProfit || 0), 0),
        orders: items.reduce((s, i) => s + (i.orders || 0), 0),
        items: items.map(i => ({ skuKey: `${i.productId}_${i.skuId}`, skuName: i.skuName, sales: i.sales || 0, price: i.avgPrice || 0, revenue: i.revenue || 0, profit: i.netProfit || 0 })),
      }));
    }

    // ── Strategy 1: 数量型 — 多数SKU有数量信息即可 ──
    const qtyCount = parsed.filter(s => s.parsed.quantity !== null).length;
    const majorityHasQty = qtyCount >= Math.ceil(parsed.length * 0.5);
    if (majorityHasQty && parsed.length > 1) {
      const qtyGroups = new Map<string, typeof parsed>();
      parsed.forEach(s => {
        if (s.parsed.quantity !== null) {
          const key = `${s.parsed.quantity}|${s.parsed.unit || '件'}`;
          if (!qtyGroups.has(key)) qtyGroups.set(key, []);
          qtyGroups.get(key)!.push(s);
        } else {
          if (!qtyGroups.has('other')) qtyGroups.set('other', []);
          qtyGroups.get('other')!.push(s);
        }
      });
      const entries = Array.from(qtyGroups.entries());
      if (entries.length > 1) {
        return { groups: labelGroups(makeGroups(entries.map(([, items]) => ({ items })))) };
      }
    }

    // ── Strategy 2 (新): 价格关系型 — 利用历史订单价格检测SKU间稳定比例 ──
    // PDD特点: 改价是按批改的，1件/2件的价格比保持恒定
    // 方法: 对每个SKU取历史价格众数作为锚定价，按锚定价排序，检测比例阶梯
    if (parsed.length > 1) {
      const anchored = parsed.map(s => ({ ...s, anchorPrice: getAnchorPrice(s) }));
      anchored.sort((a, b) => a.anchorPrice - b.anchorPrice);

      const uniquePrices = [...new Set(anchored.map(a => a.anchorPrice))].filter(p => p > 0);
      if (uniquePrices.length > 1) {
        const basePrice = uniquePrices[0];
        const ratioGroups = new Map<string, typeof anchored>();
        anchored.forEach(s => {
          const ratio = s.anchorPrice > 0 ? s.anchorPrice / basePrice : 1;
          const roundedRatio = Math.round(ratio * 2) / 2;
          const key = roundedRatio >= 1 ? roundedRatio.toString() : 'other';
          if (!ratioGroups.has(key)) ratioGroups.set(key, []);
          ratioGroups.get(key)!.push(s);
        });

        const validGroups = Array.from(ratioGroups.entries())
          .filter(([, items]) => items.length > 0);
        if (validGroups.length > 1) {
          return { groups: labelGroups(makeGroups(validGroups.map(([, items]) => ({ items })))) };
        }
      }
    }

    // ── Strategy 3: 颜色/尺寸/款式/阶段型 ──
    const attrKeyed = new Map<string, typeof parsed>();
    parsed.forEach(s => {
      const key = s.parsed.color || s.parsed.size || s.parsed.style || s.parsed.base || 'default';
      if (!attrKeyed.has(key)) attrKeyed.set(key, []);
      attrKeyed.get(key)!.push(s);
    });
    if (attrKeyed.size > 1 && attrKeyed.size < parsed.length * 0.9) {
      return { groups: labelGroups(makeGroups(Array.from(attrKeyed.entries()).map(([, items]) => ({ items })))) };
    }

    // ── Strategy 4: 纯数字型 — 规格名全都是数字 (PDD最常见: "1","2","3") ──
    const allNumeric = parsed.every(s => /^\d+$/.test(s.skuName.trim()));
    if (allNumeric && parsed.length > 1) {
      const numGroups = new Map<string, typeof parsed>();
      parsed.forEach(s => {
        const n = parseInt(s.skuName.trim());
        const key = isNaN(n) ? '0' : n.toString();
        if (!numGroups.has(key)) numGroups.set(key, []);
        numGroups.get(key)!.push(s);
      });
      if (numGroups.size > 1) {
        return { groups: labelGroups(makeGroups(Array.from(numGroups.entries()).map(([, items]) => ({ items })))) };
      }
    }

    // ── Strategy 5 (Fallback): 价格聚类 ──
    const fallbackAnchored = parsed.map(s => ({ ...s, anchorPrice: getAnchorPrice(s) }));
    fallbackAnchored.sort((a, b) => a.anchorPrice - b.anchorPrice);
    const priceRatioGroups = new Map<string, typeof parsed>();
    const basePrice = fallbackAnchored[0]?.anchorPrice || 1;
    fallbackAnchored.forEach(s => {
      const ratio = s.anchorPrice > 0 ? Math.round((s.anchorPrice / basePrice) * 2) / 2 : 1;
      const key = ratio > 0 ? ratio.toString(10) : '1';
      if (!priceRatioGroups.has(key)) priceRatioGroups.set(key, []);
      priceRatioGroups.get(key)!.push(s);
    });
    return { groups: labelGroups(makeGroups(Array.from(priceRatioGroups.entries()).map(([, items]) => ({ items })))) };
  }

  /** 将用户覆盖（移动SKU、自定义分组）应用到 groupSKUs 的自动分组结果上 */
  function applyGroupOverrides(
    groups: ReturnType<typeof groupSKUs>['groups'],
    productId: string,
    allSkuItems: any[],
  ): ReturnType<typeof groupSKUs>['groups'] {
    const overrides = loadSpecOverrides(productId);
    if (!overrides || (!overrides.moves && !overrides.customGroups?.length)) return groups;

    let result = groups.map(g => ({ ...g, items: [...g.items] }));

    // 1. 处理 SKU 移动
    if (overrides.moves) {
      for (const [skuKey, targetLabel] of Object.entries(overrides.moves)) {
        // 找到 SKU 当前所在组
        let sourceIdx = -1, itemIdx = -1;
        for (let gi = 0; gi < result.length; gi++) {
          const idx = result[gi].items.findIndex(i => i.skuKey === skuKey);
          if (idx >= 0) { sourceIdx = gi; itemIdx = idx; break; }
        }
        if (sourceIdx < 0 || itemIdx < 0) continue;

        const [movedItem] = result[sourceIdx].items.splice(itemIdx, 1);

        // 找目标组（先匹配原始标签，再匹配被重命名后的标签）
        let targetIdx = result.findIndex(g => g.label === targetLabel);
        if (targetIdx < 0) {
          // 用户可能重命名了组，查找原始标签 -> 显示名称的映射
          const reverseMap: Record<string, string> = {};
          for (const [orig, display] of Object.entries(overrides.labels)) {
            reverseMap[display] = orig;
          }
          const origLabel = reverseMap[targetLabel];
          if (origLabel) targetIdx = result.findIndex(g => g.label === origLabel);
        }
        if (targetIdx < 0) {
          // 从 allSkuItems 获取该 SKU 的数据来初始化新组
          const skuData = allSkuItems.find(s => `${s.productId}_${s.skuId}` === skuKey);
          result.push({
            label: targetLabel,
            price: 0, count: 0, sales: 0, revenue: 0, profit: 0, orders: 0,
            items: [],
          });
          targetIdx = result.length - 1;
        }
        result[targetIdx].items.push(movedItem);
      }
    }

    // 2. 添加自定义分组（从 allSkuItems 找数据）
    if (overrides.customGroups) {
      for (const cg of overrides.customGroups) {
        if (result.some(g => g.label === cg.label)) continue;
        const items = cg.skuKeys
          .map(skuKey => {
            const src = allSkuItems.find(s => `${s.productId}_${s.skuId}` === skuKey);
            if (!src) return null;
            return {
              skuKey,
              skuName: src.skuName || '-',
              sales: src.sales || 0,
              price: src.avgPrice || 0,
              revenue: src.revenue || 0,
              profit: src.netProfit || 0,
            };
          })
          .filter(Boolean);
        if (items.length === 0) continue;
        result.push({
          label: cg.label,
          price: items.reduce((s, i) => s + i!.price, 0) / items.length,
          count: items.length,
          sales: items.reduce((s, i) => s + i!.sales, 0),
          revenue: items.reduce((s, i) => s + i!.revenue, 0),
          profit: items.reduce((s, i) => s + i!.profit, 0),
          orders: items.reduce((s, i) => s + (i as any).orders || 0, 0),
          items: items as any[],
        });
      }
    }

    // 3. 重新计算各组统计
    for (const g of result) {
      if (g.items.length === 0) continue;
      g.count = g.items.length;
      g.price = g.items.reduce((s, i) => s + i.price, 0) / g.items.length;
      g.sales = g.items.reduce((s, i) => s + i.sales, 0);
      g.revenue = g.items.reduce((s, i) => s + i.revenue, 0);
      g.profit = g.items.reduce((s, i) => s + i.profit, 0);
      g.orders = g.items.reduce((s, i) => s + (i as any).orders || 0, 0);
    }

    // 4. 移除空组
    const nonEmpty = result.filter(g => g.items.length > 0);
    return nonEmpty.length > 0 ? nonEmpty : result;
  }

  const getAlertTags = (p: any) => {
    const tags: { label: string; color: string; bg: string }[] = [];
    if (p.refundRate > 15) tags.push({ label: '高退款', color: 'var(--pdd-danger)', bg: 'var(--pdd-danger-bg)' });
    if (p.sales <= 0) tags.push({ label: '零动销', color: 'var(--pdd-text-secondary)', bg: 'var(--pdd-bg)' });
    if (p.inventoryStatus === 'low') tags.push({ label: '低库存', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning-bg)' });
    if (p.promoCostRatio > 30) tags.push({ label: '高推广依赖', color: 'var(--pdd-primary)', bg: 'var(--pdd-primary-bg)' });
    if (p.turnoverDays > 30) tags.push({ label: '周转慢', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning-bg)' });
    return tags;
  };

  // ── 智能目标算法：为所有列生成算法目标（基于「每单赚X元」引擎）──
  function computeSmartTargets(p: any, rowMode: '单品' | '总额'): Record<string, { value: number; fmt: string }> {
    const targetConfig = productTargets[p.id] || { profitPerOrder: 10 };
    const profitPerOrder = targetConfig.profitPerOrder || 10;
    const manualOverrides = targetConfig.manualOverrides;
    try {
      const engineResult = computeTargetsByProfit(p, profitPerOrder, undefined, manualOverrides);
      return flattenTargetSet(engineResult, rowMode);
    } catch {
      // 容错：引擎报错时返回空
      const keys = rowMode === '单品'
        ? ['skuPrice', 'skuCount', 'skuCost', 'promoAvg', 'roi', 'refundRate', 'profitRate', 'skuProfit']
        : ['revenue', 'orders', 'totalCost', 'promo', 'roi', 'refundRate', 'otherCost', 'profit'];
      const out: Record<string, { value: number; fmt: string }> = {};
      keys.forEach(k => { out[k] = { value: 0, fmt: '--' }; });
      return out;
    }
  }
  // ── 目标推荐算法 ──
  function calcRecommendation(p: any): { targetProfit: number; targetProfitRate: number; targetROI: number; targetGMV: number; suggestion: string } {
    const uc = productCosts?.[p.id] || 0;
    const pkgFee = 3, shipFee = 5, insFee = 2;
    const platformRate = 0.006;
    const fixedCost = uc + pkgFee + shipFee + insFee;
    const recPrice = fixedCost > 0 ? Math.ceil(fixedCost / (1 - 0.3 - platformRate)) : 0;
    const bePrice = fixedCost > 0 ? Math.ceil(fixedCost / (1 - platformRate)) : 0;
    const recProfit = Math.ceil((p.revenue || 0) * 0.15);
    const recGMV = Math.ceil((p.revenue || 0) * 1.2);
    const suggestion = '推荐: 建议售价≥¥' + (recPrice || '--') + '，盈亏平衡¥' + (bePrice || '--') + '，ROI≥3，净利率≥15%';
    return { targetProfit: recProfit, targetProfitRate: 15, targetROI: 3, targetGMV: recGMV, suggestion };
  }

  // ── 获取目标/推荐值 ──
  function getTargetOrRecommend(p: any, key: string): { value: number; fmt: string; source: 'user' | 'recommend' | 'none' } {
    const target = productTargets[p.id];
    const rec = calcRecommendation(p);
    // 映射 key 到目标字段
    const keyMap: Record<string, { userKey: string; recVal: number; money?: boolean; pct?: boolean; roi?: boolean; int?: boolean }> = {
      'profit': { userKey: 'targetProfit', recVal: rec.targetProfit, money: true },
      'totalProfit': { userKey: 'targetProfit', recVal: rec.targetProfit, money: true },
      'profitRate': { userKey: 'targetProfitRate', recVal: rec.targetProfitRate, pct: true },
      'marginRate': { userKey: 'targetProfitRate', recVal: rec.targetProfitRate, pct: true },
      'roi': { userKey: 'targetROI', recVal: rec.targetROI, roi: true },
      'gmv': { userKey: 'targetGMV', recVal: rec.targetGMV, money: true },
    };
    const km = keyMap[key];
    if (!km) return { value: 0, fmt: '', source: 'none' };
    // 用户有设定值吗？
    const userVal = (target as any)?.[km.userKey];
    if (userVal && userVal > 0) {
      const fmt = km.money ? ((userVal >= 10000 ? '¥' + (userVal / 10000).toFixed(1) + '万' : '¥' + userVal.toFixed(0))) : km.pct ? userVal.toFixed(1) + '%' : km.roi ? userVal.toFixed(1) : userVal.toFixed(0);
      return { value: userVal, fmt, source: 'user' };
    }
    // 用推荐值
    if (km.recVal > 0) {
      const fmt = km.money ? ((km.recVal >= 10000 ? '¥' + (km.recVal / 10000).toFixed(1) + '万' : '¥' + km.recVal.toFixed(0))) : km.pct ? km.recVal.toFixed(1) + '%' : km.roi ? km.recVal.toFixed(1) : km.recVal.toFixed(0);
      return { value: km.recVal, fmt, source: 'recommend' };
    }
    return { value: 0, fmt: '', source: 'none' };
  }

  // ── 图片上传 ──
  const handleImageUpload = useCallback((productId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl) setProductImages(prev => ({ ...prev, [productId]: dataUrl }));
    };
    reader.readAsDataURL(file);
  }, [setProductImages]);

const noData = !filteredOrders.length;
  const rangeLabel = timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : '近90天';

  // 导出 CSV
  const handleExportCSV = () => {
    const headers = ['商品名称', '商品ID', '商家编码', 'GMV', '实收', '利润', '利润率(%)', '推广花费', '推广成交', '推广ROI', '退款率(%)', '售后率(%)'];
    const rows = filteredProducts.map(p => [
      p.name, p.id, p.code,
      p.gmv.toFixed(0), p.revenue.toFixed(0), p.profit.toFixed(0), p.profitRate.toFixed(1),
      p.promoCost > 0 ? p.promoCost.toFixed(0) : '0',
      p.promoTransaction > 0 ? p.promoTransaction.toFixed(0) : '0',
      p.promoCost > 0 && p.promoTransaction > 0 ? (p.promoTransaction / p.promoCost).toFixed(2) : '-',
      p.refundRate > 0 ? p.refundRate.toFixed(1) : '0',
      p.afterSaleRate.toFixed(1),
    ]);
    const csv = '﻿' + headers.join(',') + '\n' + rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `商品分析_导出_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

        const renderKpiPanel = () => {
    const visibleList = kpiCardOrder.filter(k => visibleKpis.has(k));
    const displayed = visibleList.slice(0, 10);
    const allKpis = ALL_PRODUCT_KPIS;
    const kpiValues: Record<string, number> = {};
    allKpis.forEach(kpi => {
      kpiValues[kpi.label] = (kpiMetrics as any)?.[kpi.key] || 0;
    });
    const primaryCount = 5;
    const primaryKpis = displayed.slice(0, primaryCount);
    const extraCount = displayed.length - primaryCount;
    return (
      <>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {primaryKpis.map((label) => {
            const kpi = allKpis.find(k => k.label === label);
            if (!kpi) return null;
            const val = kpiValues[label];
            const isProfit = label.includes('利润') || label.includes('利润率');
            const valColor = 'text-pdd-text';
            const isSelected = selectedTrendKpi === label;
            return (
              <div key={label}
                className={`rounded-lg border px-4 py-3 cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-pdd-primary/[0.08] border-pdd-primary/30 shadow-sm'
                    : 'bg-pdd-card border-pdd-border/60 hover:border-pdd-primary/30 hover:shadow-sm'
                }`}
                onClick={() => setSelectedTrendKpi(isSelected ? null : label)}>
                <div className="text-[11px] font-medium text-pdd-text-secondary/70 leading-none mb-2">{label}</div>
                <div className={'text-xl font-bold tabular-nums leading-none tracking-tight ' + valColor}>
                  {kpi.fmt(val)}
                </div>
              </div>
            );
          })}
          {extraCount > 0 && (
            <div onClick={() => setShowKpiSelector(true)}
              className="bg-pdd-bg/50 rounded-lg border border-dashed border-pdd-border/40 flex items-center justify-center cursor-pointer hover:border-pdd-primary/30 hover:bg-pdd-bg transition-all group">
              <span className="text-xs text-pdd-text-secondary/50 group-hover:text-pdd-primary/70">+{extraCount}个指标</span>
            </div>
          )}
        </div>

        {/* KPI 趋势图 */}
        {selectedTrendKpi && dailyTrendData.length > 1 && (
          <div className="mt-4 bg-pdd-card rounded-lg border border-pdd-border/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-pdd-border/30">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-pdd-text">{selectedTrendKpi} 趋势</span>
                <span className="text-[10px] text-pdd-text-secondary/60">
                  {dailyTrendData[0]?.date} ~ {dailyTrendData[dailyTrendData.length-1]?.date}
                </span>
              </div>
              <button onClick={() => setSelectedTrendKpi(null)} className="text-pdd-text-secondary/40 hover:text-pdd-text/70 p-0.5">
                <X size={13} />
              </button>
            </div>
            <div className="px-2 pt-2 pb-1 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrendData} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    width={60}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Line
                    type="monotone"
                    dataKey={(() => {
                      const k = allKpis.find(k => k.label === selectedTrendKpi);
                      const map: Record<string, string> = {
                        '商品数': 'productCount', '总GMV': 'gmv', '总实收': 'revenue',
                        '总销量': 'sales', '客单价': 'avgPrice', '利润总额': 'profit',
                        '利润率': 'profitRate', '退款率': 'refundRate',
                        '推广花费': 'promoCost', '有效订单量': 'orders',
                      };
                      return map[selectedTrendKpi] || 'revenue';
                    })()}
                    stroke="var(--pdd-primary)"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: 'var(--pdd-primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* KPI 选择器弹窗 */}
        {showKpiSelector && (
          <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center p-4" onClick={() => setShowKpiSelector(false)}>
            <div className="bg-pdd-card rounded-lg border border-pdd-border shadow-lg max-w-lg w-full p-5" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-pdd-text">自定义KPI指标</h3>
                <button onClick={() => setShowKpiSelector(false)} className="text-pdd-text-secondary hover:text-pdd-text"><X size={16} /></button>
              </div>
              <div className="text-[11px] text-pdd-text-secondary mb-3">选择要显示的指标（最多10个，最少1个）</div>
              {KPI_GROUPS.map(group => (
                <div key={group.name} className="mb-3">
                  <div className="text-[11px] font-semibold text-pdd-text-secondary mb-1.5">{group.name}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.items.map(kpi => {
                      const active = visibleKpis.has(kpi.label);
                      const count = visibleKpis.size;
                      return (
                        <button key={kpi.label} onClick={() => {
                          if (active) { if (count <= 1) return; setVisibleKpis(prev => { const n = new Set(prev); n.delete(kpi.label); return n; });
                          } else { if (count >= 10) return; setVisibleKpis(prev => { const n = new Set(prev); n.add(kpi.label); return n; }); }
                        }}
                          className={'px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ' + (active ? 'bg-pdd-primary/10 text-pdd-primary border-pdd-primary/20' : 'bg-pdd-card text-pdd-text-secondary border-pdd-border hover:border-pdd-primary/30')}>
                          {kpi.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div className="text-[10px] text-pdd-text-secondary/70 mt-2">已选 {visibleKpis.size}/10 个指标</div>
            </div>
          </div>
        )}
      </>
    );
  };

  // ── 列配置 — getMergedCellData：行内按 rowMode 映射 ──

  function getMergedCellData(colKey: string, p: any, rowMode: '单品' | '总额') {
    const fmtMoney = (v: number) => v >= 10000 ? '¥' + (v / 10000).toFixed(1) + '万' : (v >= 100 ? '¥' + v.toFixed(0) : '¥' + v.toFixed(1));
    const fmtPct = (v: number) => (v || 0).toFixed(1) + '%';
    const fmtInt = (v: number) => (v || 0).toFixed(0);
    switch (colKey) {
      case 'revenue': {
        const r = p.revenue || 0;
        return { val: r, tgtNum: 0, refNum: r, fmt: fmtMoney(r), refFmt: fmtMoney(r) };
      }
      case 'orders': return getCellData('orders', p);
      case 'sales': return getCellData('sales', p);
      case 'totalCost': return getCellData('totalCost', p);
      case 'promo': {
        const pc = p.promoCost || 0;
        return { val: pc, tgtNum: 0, refNum: pc, fmt: fmtMoney(pc), refFmt: fmtMoney(pc) };
      }
      case 'roi': return getCellData('roi', p);
      case 'refundRate': return getCellData('refundRate', p);
      case 'otherCost': {
        const cb = p.costBreakdown || {};
        const oc = (cb.packagingFee || 0) + (cb.shippingFee || 0) + (cb.platformFee || 0) + (cb.taxes || 0) + (cb.customDeductions || 0);
        return { val: oc, tgtNum: 0, refNum: oc, fmt: oc > 0 ? fmtMoney(oc) : '--', refFmt: oc > 0 ? fmtMoney(oc) : '--' };
      }
      case 'profit': return getCellData('totalProfit', p);
      case 'promoCost': {
        const pc = p.promoCost || 0;
        return { val: pc, tgtNum: 0, refNum: pc, fmt: fmtMoney(pc), refFmt: fmtMoney(pc) };
      }
      case 'logistics': {
        const cb = p.costBreakdown || {};
        const lg = (cb.shippingFee || 0) + (cb.packagingFee || 0);
        return { val: lg, tgtNum: 0, refNum: lg, fmt: lg > 0 ? fmtMoney(lg) : '--', refFmt: lg > 0 ? fmtMoney(lg) : '--' };
      }
      case 'platformFee': {
        const cb = p.costBreakdown || {};
        const pf = cb.platformFee || 0;
        return { val: pf, tgtNum: 0, refNum: pf, fmt: pf > 0 ? fmtMoney(pf) : '--', refFmt: pf > 0 ? fmtMoney(pf) : '--' };
      }
      case 'profitRate': return getCellData('profitRate', p);
      case 'avgPrice': {
        const a = p.avgPrice || 0;
        return { val: a, tgtNum: 0, refNum: a, fmt: a > 0 ? '¥' + a.toFixed(0) : '--', refFmt: a > 0 ? '¥' + a.toFixed(0) : '--' };
      }
      case 'stockDays': {
        const d = p.activeDays || 0;
        return { val: d, tgtNum: 0, refNum: d, fmt: d > 0 ? d + '天' : '--', refFmt: d > 0 ? d + '天' : '--' };
      }
      case 'gmv': {
        const g = p.gmv || 0;
        return { val: g, tgtNum: 0, refNum: g, fmt: fmtMoney(g), refFmt: fmtMoney(g) };
      }
      case 'promoTransaction': {
        const pt = p.promoTransaction || 0;
        return { val: pt, tgtNum: 0, refNum: pt, fmt: pt > 0 ? fmtMoney(pt) : '--', refFmt: pt > 0 ? fmtMoney(pt) : '--' };
      }
      case 'promoClicks': {
        const pc = p.promoClicks || 0;
        return { val: pc, tgtNum: 0, refNum: pc, fmt: pc > 0 ? (pc >= 10000 ? (pc / 10000).toFixed(1) + '万' : pc.toFixed(0)) : '--', refFmt: pc > 0 ? (pc >= 10000 ? (pc / 10000).toFixed(1) + '万' : pc.toFixed(0)) : '--' };
      }
      case 'promoCostRatio': {
        const pcr = p.promoCostRatio || 0;
        return { val: pcr, tgtNum: 0, refNum: pcr, fmt: pcr > 0 ? fmtPct(pcr) : '--', refFmt: pcr > 0 ? fmtPct(pcr) : '--' };
      }
      case 'afterSaleRate': {
        const ar = p.afterSaleRate || 0;
        return { val: ar, tgtNum: 0, refNum: ar, fmt: ar > 0 ? fmtPct(ar) : '--', refFmt: ar > 0 ? fmtPct(ar) : '--' };
      }
      case 'unitProfit': {
        const up = p.sales > 0 ? (p.profit || 0) / p.sales : 0;
        return { val: up, tgtNum: 0, refNum: up, fmt: up > 0 ? '¥' + up.toFixed(2) : '--', refFmt: up > 0 ? '¥' + up.toFixed(2) : '--' };
      }
      case 'unitCost': {
        const uc = p.sales > 0 ? (p.costs || 0) / p.sales : 0;
        return { val: uc, tgtNum: 0, refNum: uc, fmt: uc > 0 ? '¥' + uc.toFixed(1) : '--', refFmt: uc > 0 ? '¥' + uc.toFixed(1) : '--' };
      }
      // ── 单品模式列 ──
      case 'skuPrice': return getCellData('price', p);
      case 'skuCount': return { val: 0, tgtNum: 0, refNum: 0, fmt: '--', refFmt: '--' };
      case 'skuCost': return getCellData('cost', p);
      case 'skuProfit': return getCellData('profit', p);
      case 'promoAvg': return getCellData('promoPerUnit', p);
      case 'grossMargin': {
        const ap = p.avgPrice || 0;
        const uc = p.sales > 0 ? (p.costs || 0) / p.sales : 0;
        const gm = ap > 0 && uc > 0 ? ((ap - uc) / ap) * 100 : 0;
        return { val: gm, tgtNum: 0, refNum: gm, fmt: gm > 0 ? fmtPct(gm) : '--', refFmt: gm > 0 ? fmtPct(gm) : '--' };
      }
      case 'skuGmv': {
        const g = p.gmv || 0;
        return { val: g, tgtNum: 0, refNum: g, fmt: fmtMoney(g), refFmt: fmtMoney(g) };
      }
      case 'skuOrders': {
        const o = p.orders || 0;
        return { val: o, tgtNum: 0, refNum: o, fmt: fmtInt(o), refFmt: fmtInt(o) };
      }
      case 'skuSales': {
        const s = p.sales || 0;
        return { val: s, tgtNum: 0, refNum: s, fmt: fmtInt(s), refFmt: fmtInt(s) };
      }
      case 'costRatio': {
        const cr = p.promoCostRatio || 0;
        return { val: cr, tgtNum: 0, refNum: cr, fmt: cr > 0 ? fmtPct(cr) : '--', refFmt: cr > 0 ? fmtPct(cr) : '--' };
      }
      default: return { val: 0, tgtNum: 0, refNum: 0, fmt: '--', refFmt: '--' };
    }
  }

  // ── 排序切换 ──
  const handleSort = (key: string) => {
    if (sortField === key) setSortDesc(prev => !prev);
    else { setSortField(key); setSortDesc(true); }
  };

  const SortIcon = ({ colKey }: { colKey: string }) => {
    if (sortField !== colKey) return <span className="inline-block ml-1 text-xs text-pdd-text-secondary/20">⇅</span>;
    return <span className="inline-block ml-1 text-xs text-pdd-primary">{sortDesc ? '↓' : '↑'}</span>;
  };


  const isColVisibleInSet = useCallback((colKey: string, set: 'total' | 'single') => {
    return set === 'total' ? visibleTotalCols.has(colKey) : visibleSingleCols.has(colKey);
  }, [visibleTotalCols, visibleSingleCols]);
  const toggleCol = useCallback((colKey: string, set: 'total' | 'single') => {
    const upd = (prev: Set<string>) => {
      const n = new Set(prev);
      if (n.has(colKey)) n.delete(colKey); else n.add(colKey);
      return n;
    };
    if (set === 'total') setVisibleTotalCols(upd);
    else setVisibleSingleCols(upd);
  }, []);
  const resetCols = useCallback(() => {
    setVisibleTotalCols(new Set(DEFAULT_TOTAL_KEYS));
    setVisibleSingleCols(new Set(DEFAULT_SINGLE_KEYS));
  }, []);
  const totalVisibleColCount = visibleTotalCols.size;
  const singleVisibleColCount = visibleSingleCols.size;

  const renderProductTable = () => {
    return (
    <>
      <div className="bg-pdd-card rounded-lg overflow-hidden border border-pdd-border/60">
      {noData ? (
          <div className="h-56 flex flex-col items-center justify-center text-sm text-pdd-text-secondary gap-2">
            <Package size={36} className="text-pdd-text-secondary/30" />
            <span>{'暂无数据，请先上传订单'}</span>
          </div>
        ) : (
          <>

          {/* 隐藏滚动条（Chrome/Safari/Edge）& 整行悬停效果 */}
          <style>{`
            [data-row-scroll="true"]::-webkit-scrollbar { display: none; }
            #product-table tbody tr:hover { filter: brightness(0.96); }
          `}</style>
          {/* ── 标签栏（含列管理） ── */}
          {products.length > 0 && (
            <div className="px-4 py-2.5 border-b border-pdd-border/20 bg-pdd-bg/10">
              <div className="flex items-start gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {activeTagFilter && (() => {
                    const activeDef = TAG_DEF_MAP[activeTagFilter];
                    const activeBg = activeDef?.bg || '#f3f4f6';
                    const activeColor = activeDef?.color || '#374151';
                    return (
                      <button onClick={() => setActiveTagFilter(null)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors hover:opacity-80"
                        style={{ backgroundColor: activeBg, color: activeColor, borderColor: activeColor + '30' }}>
                        <X size={12} />
                        {getTagLabel(activeTagFilter)}
                      </button>
                    );
                  })()}
                  {TAG_GROUPS.filter(g => g.group === '效率').flatMap(g => g.tags).map(t => {
                    const count = tagCounts[t.key] || 0;
                    if (count === 0) return null;
                    const isHidden = hiddenTags.has(t.key);
                    const def = TAG_DEF_MAP[t.key];
                    const bgColor = def?.bg || '#f5f5f5';
                    const textColor = def?.color || '#6b7280';
                    return (
                      <button key={t.key} onClick={() => toggleTagVisibility(t.key)}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border transition-all hover:shadow-sm`}
                        style={{
                          backgroundColor: isHidden ? '#f9fafb' : bgColor,
                          color: isHidden ? '#d1d5db' : textColor,
                          borderColor: isHidden ? '#f0f0f0' : textColor + '30',
                          textDecoration: isHidden ? 'line-through' : 'none',
                        }}
                        title={isHidden ? `点击显示「${t.label}」标签` : `点击隐藏「${t.label}」标签`}>
                        <span>{t.label}</span>
                        <span className="text-[10px]" style={{ opacity: 0.6 }}>({count})</span>
                      </button>
                    );
                  })}
                </div>
                {/* 列管理按钮（右对齐） */}
                <div className="relative flex-shrink-0" ref={colSelectorRef}>
                  <button onClick={() => setColSelectorOpen(prev => !prev)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-pdd-primary bg-blue-50 border border-blue-200 rounded-md px-2.5 py-1 hover:bg-blue-100 transition-colors">
                    <span>☰ 列管理</span>
                    <span className="text-[10px] text-pdd-text-secondary/60 ml-0.5">总额 {totalVisibleColCount} / 单品 {singleVisibleColCount}</span>
                  </button>
                  {colSelectorOpen && (
                    <div className="absolute top-full right-0 mt-1 bg-white border border-pdd-border rounded-lg shadow-lg z-50 min-w-[600px] max-h-[420px] overflow-y-auto p-2">
                      <div className="flex items-center justify-between mb-1.5 px-0.5">
                        <span className="text-[9px] text-pdd-text-secondary/50">勾选要查看的列（每个商品独立切换总额/单品模式）</span>
                      </div>
                      <div className="mb-2">
                        <div className="text-[10px] font-bold text-pdd-text-secondary/80 mb-1 px-0.5 pb-0.5 border-b border-pdd-border/20">总额模式</div>
                        <div className="flex flex-wrap gap-0">
                          {COL_GROUPS.map(group => (
                            <div key={group.label} className="inline-block align-top mr-2 mb-1 w-[130px]">
                              <div className="text-[9px] font-semibold text-pdd-text-secondary/60 mb-0.5 px-0.5">{group.label}</div>
                              {group.keys.map(key => {
                                const colDef = COLS_TOTAL_DEFS.find(c => c.key === key);
                                if (!colDef) return null;
                                const checked = isColVisibleInSet(key, 'total');
                                return (
                                  <label key={key}
                                    className={'block text-[9px] py-0.5 px-0.5 cursor-pointer text-pdd-text-secondary hover:text-pdd-primary'}>
                                    <input type="checkbox" checked={checked}
                                      onChange={() => toggleCol(key, 'total')}
                                      className="accent-pdd-primary mr-1 w-2.5 h-2.5 align-text-bottom" />
                                    {colDef.label}
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="pt-1.5 border-t border-pdd-border/20">
                        <div className="text-[10px] font-bold text-pdd-text-secondary/80 mb-1 px-0.5 pb-0.5 border-b border-pdd-border/20">单品模式</div>
                        <div className="flex flex-wrap gap-0">
                          {SINGLE_GROUPS.map(group => (
                            <div key={group.label} className="inline-block align-top mr-2 mb-1 w-[130px]">
                              <div className="text-[9px] font-semibold text-pdd-text-secondary/60 mb-0.5 px-0.5">{group.label}</div>
                              {group.keys.map(key => {
                                const colDef = COLS_SINGLE_DEFS.find(c => c.key === key);
                                if (!colDef) return null;
                                const checked = isColVisibleInSet(key, 'single');
                                return (
                                  <label key={key}
                                    className={'block text-[9px] py-0.5 px-0.5 cursor-pointer text-pdd-text-secondary hover:text-pdd-primary'}>
                                    <input type="checkbox" checked={checked}
                                      onChange={() => toggleCol(key, 'single')}
                                      className="accent-pdd-primary mr-1 w-2.5 h-2.5 align-text-bottom" />
                                    {colDef.label}
                                  </label>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-1.5 mt-1.5 pt-1.5 border-t border-pdd-border/30">
                        <button onClick={() => { setVisibleTotalCols(new Set()); setVisibleSingleCols(new Set()); }}
                          className="text-[10px] px-2 py-0.5 rounded bg-white text-pdd-text-secondary border border-pdd-border cursor-pointer hover:bg-pdd-bg">全不选</button>
                        <button onClick={resetCols} className="text-[10px] px-2 py-0.5 rounded bg-pdd-primary text-white border-0 cursor-pointer hover:bg-blue-700">重置（默认8列）</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {activeTagFilter && (
                <div className="mt-1.5 text-[11px] text-pdd-text-secondary/60">
                  已筛选：{getTagLabel(activeTagFilter)} — {tagCounts[activeTagFilter] || 0} 款商品
                  <button onClick={() => setActiveTagFilter(null)} className="ml-2 text-pdd-text-secondary hover:text-pdd-text underline">清除</button>
                </div>
              )}
            </div>
          )}

          <div id="product-table">
            <table style={{ borderCollapse: 'collapse', fontSize: '12px', width: '1394px', tableLayout: 'fixed' }}>
              {/* ── 每行独立数据窗口 ── */}
              <tbody>
                {paginatedProducts.flatMap((p, i) => {
                  const profit = p.profit || 0;
                  const isExpanded = expandedRows.has(p.id);
                  const rec = calcRecommendation(p);
                  const img = productImages[p.id];
                  const alias = productAliases[p.id];
                  const displayName = alias || p.name;
                  const productSkuData = skuData.filter(s => s.productId === p.id);
                  let skuGroups = groupSKUs(productSkuData);
                  // 应用用户覆盖（移动SKU、自定义分组）
                  skuGroups = {
                    groups: applyGroupOverrides(skuGroups.groups, p.id, productSkuData),
                  };
                  // 没有SKU数据的商品也要有默认分组，保证所有行文字区高度一致
                  if (skuGroups.groups.length === 0) {
                    skuGroups = {
                      groups: [{
                        label: '规格一', price: p.avgPrice || 0,
                        count: 1, sales: p.sales || 0, revenue: p.revenue || 0,
                        profit: p.profit || 0, orders: p.orders || 0,
                        items: [{ skuKey: '', skuName: '-', sales: p.sales || 0, price: p.avgPrice || 0, revenue: p.revenue || 0, profit: p.profit || 0 }],
                      }],
                    };
                  }
                  const rowMode = getRowDimMode(p.id);
                  const smartTargets = computeSmartTargets(p, rowMode);
                  const prevP = prevProductMap[p.id];
                  const rowVisibleCols = (rowMode === '总额' ? COLS_TOTAL_DEFS : COLS_SINGLE_DEFS).filter(
                    c => (rowMode === '总额' ? visibleTotalCols : visibleSingleCols).has(c.key)
                  );
                  function getCompare(colKey) {
                    if (!prevP) return { fmt: "", cls: "text-gray-300" };
                    let curVal = 0, prevVal = 0;
                    const getOC = (pp) => { const cb = pp.costBreakdown || {}; return (cb.packagingFee || 0) + (cb.shippingFee || 0) + (cb.platformFee || 0) + (cb.taxes || 0) + (cb.customDeductions || 0); };
                    switch (colKey) {
                      case "revenue": curVal = p.revenue || 0; prevVal = prevP.revenue || 0; break;
                      case "orders": curVal = p.orders || 0; prevVal = prevP.orders || 0; break;
                      case "sales": curVal = p.sales || 0; prevVal = prevP.sales || 0; break;
                      case "totalCost": curVal = p.costs || 0; prevVal = prevP.costs || 0; break;
                      case "promo": curVal = p.promoCost || 0; prevVal = prevP.promoCost || 0; break;
                      case "promoCost": curVal = p.promoCost || 0; prevVal = prevP.promoCost || 0; break;
                      case "roi": curVal = p.roi || 0; prevVal = prevP.roi || 0; break;
                      case "refundRate": curVal = p.refundRate || 0; prevVal = prevP.refundRate || 0; break;
                      case "otherCost": curVal = getOC(p); prevVal = getOC(prevP); break;
                      case "profit": curVal = p.profit || 0; prevVal = prevP.profit || 0; break;
                      case "logistics": { const cb1 = p.costBreakdown||{}, cb2 = prevP.costBreakdown||{}; curVal = (cb1.shippingFee||0)+(cb1.packagingFee||0); prevVal = (cb2.shippingFee||0)+(cb2.packagingFee||0); break; }
                      case "platformFee": { const cb1 = p.costBreakdown||{}, cb2 = prevP.costBreakdown||{}; curVal = cb1.platformFee||0; prevVal = cb2.platformFee||0; break; }
                      case "profitRate": curVal = p.profitRate || 0; prevVal = prevP.profitRate || 0; break;
                      case "avgPrice": curVal = p.avgPrice || 0; prevVal = prevP.avgPrice || 0; break;
                      case "stockDays": curVal = p.activeDays || 0; prevVal = prevP.activeDays || 0; break;
                      case "gmv": curVal = p.gmv || 0; prevVal = prevP.gmv || 0; break;
                      case "promoTransaction": curVal = p.promoTransaction || 0; prevVal = prevP.promoTransaction || 0; break;
                      case "promoClicks": curVal = p.promoClicks || 0; prevVal = prevP.promoClicks || 0; break;
                      case "promoCostRatio": curVal = p.promoCostRatio || 0; prevVal = prevP.promoCostRatio || 0; break;
                      case "afterSaleRate": curVal = p.afterSaleRate || 0; prevVal = prevP.afterSaleRate || 0; break;
                      case "unitProfit": { curVal = p.sales > 0 ? (p.profit||0)/p.sales : 0; prevVal = prevP.sales > 0 ? (prevP.profit||0)/prevP.sales : 0; break; }
                      case "unitCost": { curVal = p.sales > 0 ? (p.costs||0)/p.sales : 0; prevVal = prevP.sales > 0 ? (prevP.costs||0)/prevP.sales : 0; break; }
                      case "skuPrice": curVal = p.avgPrice || 0; prevVal = prevP.avgPrice || 0; break;
                      case "skuCount": return { fmt: "-", cls: "text-gray-300" };
                      case "skuCost": { curVal = p.sales > 0 ? (p.costs||0)/p.sales : 0; prevVal = prevP.sales > 0 ? (prevP.costs||0)/prevP.sales : 0; break; }
                      case "skuProfit": { curVal = p.profit > 0 && p.sales > 0 ? p.profit/p.sales : 0; prevVal = prevP.profit > 0 && prevP.sales > 0 ? prevP.profit/prevP.sales : 0; break; }
                      case "promoAvg": { curVal = p.promoCost > 0 && p.orders > 0 ? p.promoCost/p.orders : 0; prevVal = prevP.promoCost > 0 && prevP.orders > 0 ? prevP.promoCost/prevP.orders : 0; break; }
                      case "grossMargin": {
                        const ap1 = p.avgPrice||0, uc1 = p.sales>0?(p.costs||0)/p.sales:0;
                        const ap2 = prevP.avgPrice||0, uc2 = prevP.sales>0?(prevP.costs||0)/prevP.sales:0;
                        curVal = ap1>0&&uc1>0?((ap1-uc1)/ap1)*100:0; prevVal = ap2>0&&uc2>0?((ap2-uc2)/ap2)*100:0; break;
                      }
                      case "skuGmv": curVal = p.gmv || 0; prevVal = prevP.gmv || 0; break;
                      case "skuOrders": curVal = p.orders || 0; prevVal = prevP.orders || 0; break;
                      case "skuSales": curVal = p.sales || 0; prevVal = prevP.sales || 0; break;
                      case "costRatio": curVal = p.promoCostRatio || 0; prevVal = prevP.promoCostRatio || 0; break;
                      default: return { fmt: "-", cls: "text-gray-300" };
                    }
                    if (prevVal > 0 && curVal !== prevVal) {
                      const change = ((curVal - prevVal) / prevVal) * 100;
                      const fmt = (change > 0 ? "+" : "") + change.toFixed(1) + "%";
                      const goodKeys = new Set(["revenue","orders","sales","profit","profitRate","roi","gmv","avgPrice","promoTransaction","skuProfit","skuPrice","skuGmv","skuOrders","skuSales","unitProfit","grossMargin"]);
                      const badKeys = new Set(["refundRate","totalCost","promo","promoCost","otherCost","promoAvg","skuCost","logistics","platformFee","promoCostRatio","afterSaleRate","stockDays","unitCost","costRatio"]);
                      const isGood = goodKeys.has(colKey);
                      const isBad = badKeys.has(colKey);
                      const cls = (isGood && change > 0) || (isBad && change < 0) ? "text-green-600" : (isGood && change < 0) || (isBad && change > 0) ? "text-red-500" : "text-gray-400";
                      return { fmt, cls };
                    }
                    return { fmt: "-", cls: "text-gray-300" };
                  }

                  const row = (
                    <tr key={p.id}
                      className={`group ${isExpanded ? 'bg-blue-50/30' : ''} hover:bg-black/[0.02]`}
                      style={{ height: '100px', borderTop: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', transition: 'background-color 1s cubic-bezier(0.22, 1, 0.36, 1)' }}>
                      <td className="px-3 align-middle" style={{ minWidth: '430px', maxWidth: '430px', width: '430px', height: '100px', borderRight: '1px solid #e5e7eb' }}>
                        <div className="flex gap-2 items-center" style={{ height: '100%' }}>
                          {/* 商品图 — 88px正方形 */}
                          <div className="w-[88px] flex-shrink-0 flex flex-col justify-center">
                            <div className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 cursor-pointer group relative bg-gray-50"
                              onMouseEnter={(e) => {
                                if (img) {
                                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                  setHoveredImage({ id: p.id, src: img, x: rect.right + 8, y: rect.top });
                                }
                              }}
                              onMouseLeave={() => setHoveredImage(null)}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (img) { setEnlargedImage(img); return; }
                                const input = document.createElement('input');
                                input.type = 'file'; input.accept = 'image/*';
                                input.onchange = (ev: any) => { const f = ev.target?.files?.[0]; if (f) handleImageUpload(p.id, f); };
                                input.click();
                              }}>
                              {img ?
                                <div className="w-full h-full bg-cover bg-center transition-transform duration-200 group-hover:scale-110"
                                  style={{ backgroundImage: `url(${img})`, imageRendering: 'auto' }} />
                                : <div className="w-full h-full flex items-center justify-center"><Upload size={14} className="text-gray-300" /></div>
                              }
                            </div>
                          </div>
                          {/* 文字区 */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-[13px] font-medium text-blue-600 hover:text-blue-800 cursor-pointer truncate max-w-[160px] leading-snug"
                                title={displayName}
                                onClick={(e) => { e.stopPropagation(); setDrawerProductId(p.id); }}>
                                {displayName}
                              </span>
                              <button onClick={(e) => { e.stopPropagation(); setExpandedRows(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; }); }}
                                className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-gray-200 text-gray-400 hover:bg-gray-50">
                                {skuGroups.groups.length}个规格
                              </button>
                              <div className="inline-flex bg-gray-100 rounded text-[9px] leading-none p-[1px]">
                                <button onClick={(e) => { e.stopPropagation(); setProductDimModes(prev => ({...prev, [p.id]: '单品'})); }}
                                  className={'px-1.5 py-0.5 rounded ' + (rowMode === '单品' ? 'bg-white text-gray-700 shadow-sm font-medium' : 'text-gray-400')}>单品</button>
                                <button onClick={(e) => { e.stopPropagation(); setProductDimModes(prev => ({...prev, [p.id]: '总额'})); }}
                                  className={'px-1.5 py-0.5 rounded ' + (rowMode === '总额' ? 'bg-white text-gray-700 shadow-sm font-medium' : 'text-gray-400')}>总额</button>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-400 flex-wrap mt-0.5">
                              <span className="font-mono text-gray-500">{p.id || '--'}</span>
                              {p.code && <><span className="text-gray-300">|</span><span>编码 {p.code}</span></>}
                              <span className="text-gray-300">|</span>
                              <span>{p.firstDate || '--'}出单</span>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-wrap mt-0.5">
                              {(() => {
                                const uc = p.costs > 0 && p.sales > 0 ? p.costs / p.sales : 0;
                                const sp = p.avgPrice || 0;
                                const up = sp > 0 && uc > 0 ? sp - uc : 0;
                                return (<>
                                  <span>成本<span className="font-semibold text-gray-600 ml-0.5">{uc > 0 ? '¥' + uc.toFixed(1) : '--'}</span></span>
                                  <span className="text-gray-300">|</span>
                                  <span>售价<span className="font-semibold text-gray-600 ml-0.5">{sp > 0 ? '¥' + sp.toFixed(sp < 10 ? 2 : 1) : '--'}</span></span>
                                  {up !== 0 && <><span className="text-gray-300">|</span><span>利润<span className={'font-semibold ml-0.5 ' + (up > 0 ? 'text-green-600' : 'text-red-500')}>{up > 0 ? '¥' + up.toFixed(2) : '-¥' + Math.abs(up).toFixed(2)}</span></span></>}
                                </>);
                              })()}
                            </div>
                            {/* ── 推广数据行 ── */}
                            {p.promoCost > 0 && (
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap mt-0.5">
                                <span className="inline-flex items-center gap-1">
                                  推广费<span className="font-semibold text-orange-600 ml-0.5">{p.promoCost >= 10000 ? '¥' + (p.promoCost / 10000).toFixed(1) + '万' : '¥' + p.promoCost.toFixed(0)}</span>
                                </span>
                                <span className="text-gray-300">|</span>
                                <span>ROI<span className={'font-semibold ml-0.5 ' + ((p.roi || 0) >= 1 ? 'text-green-600' : 'text-red-500')}>{(p.roi || 0).toFixed(1)}</span></span>
                                <span className="text-gray-300">|</span>
                                <span>成交<span className="font-semibold text-blue-600 ml-0.5">{p.promoTransaction >= 10000 ? '¥' + (p.promoTransaction / 10000).toFixed(1) + '万' : '¥' + (p.promoTransaction || 0).toFixed(0)}</span></span>
                                <span className="text-gray-300">|</span>
                                <span>费比<span className="font-semibold text-purple-600 ml-0.5">{(p.promoCostRatio || 0).toFixed(1)}%</span></span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 flex-wrap mt-[2px]">
                              {(() => {
                                const alertTags = getAlertTags(p).map(t => ({ ...t, key: t.label }));
                                const sysTags = (autoTags[p.id] || []).map(tk => {
                                  const def = TAG_DEF_MAP[tk];
                                  return def ? { label: def.label, color: def.color, bg: def.bg, key: tk } : null;
                                }).filter(Boolean);
                                const allTags = [...alertTags, ...sysTags].slice(0, 6);
                                return allTags.map(t => (
                                  <span key={t.key}
                                    className="text-[9px] font-medium px-1.5 py-[1px] rounded-sm cursor-pointer border"
                                    style={{ backgroundColor: t.bg, color: t.color, borderColor: t.color + '30' }}
                                    onClick={(e) => { e.stopPropagation(); setActiveTagFilter(activeTagFilter === t.key ? null : t.key); }}>
                                    {t.label}
                                  </span>
                                ));
                              })()}
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* ── 占比列（固定60px，100px高度三等分） ── */}
                      <td className="p-0 align-middle" style={{ width: '60px', minWidth: '60px', maxWidth: '60px', height: '100px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                          <div style={{ height: '28px', background: '#f8f9fb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: '#9ca3af' }}>占比</div>
                          <div className="flex flex-col" style={{ flex: 1 }}>
                            <div className="border-b border-dashed border-gray-100 tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 3px', flex: 1, gap: '1px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 500, color: '#9ca3af' }}>销售</span>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>{((storeTotals.totalSales > 0 ? ((p.sales / storeTotals.totalSales) * 100) : 0)).toFixed(1).padStart(4, '0')}%</span>
                            </div>
                            <div className="border-b border-dashed border-gray-100 tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 3px', flex: 1, gap: '1px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 500, color: '#9ca3af' }}>推广</span>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>{((storeTotals.totalPromo > 0 ? (((p.promoCost || 0) / storeTotals.totalPromo) * 100) : 0)).toFixed(1).padStart(4, '0')}%</span>
                            </div>
                            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '0 3px', flex: 1, gap: '1px' }}>
                              <span style={{ fontSize: '8px', fontWeight: 500, color: '#9ca3af' }}>订单</span>
                              <span style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>{((storeTotals.totalOrders > 0 ? ((p.orders / storeTotals.totalOrders) * 100) : 0)).toFixed(1).padStart(4, '0')}%</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      {/* ── 数值列（固定36px，100px高度三等分） ── */}
                      <td className="p-0 align-middle" style={{ width: '36px', minWidth: '36px', maxWidth: '36px', height: '100px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #e5e7eb' }}>
                          <div style={{ height: '28px', background: '#f8f9fb', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 500, color: '#9ca3af' }}>数值</div>
                          <div className="flex flex-col" style={{ flex: 1 }}>
                            <div className="border-b border-dashed border-gray-100" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '10px', fontWeight: 500, color: '#9ca3af' }}>目标</div>
                            <div className="border-b border-dashed border-gray-100" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '10px', fontWeight: 500, color: '#9ca3af' }}>本期</div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, fontSize: '10px', fontWeight: 500, color: '#9ca3af' }}>同比</div>
                          </div>
                        </div>
                      </td>
                      {/* ── 滚动数据窗口（798px固定，100px填充） ── */}
                      <td key="data-cols" className="p-0 align-middle overflow-x-auto"
                        data-row-scroll="true"
                        data-col-count={rowVisibleCols.length}
                        style={{ width: '798px', minWidth: '798px', maxWidth: '798px', height: '100px', scrollbarWidth: 'none', scrollbarColor: 'transparent transparent', overflowY: 'clip', borderRight: '1px solid #e5e7eb' }}>
                          <table className="w-full text-xs" style={{ borderCollapse: 'collapse', tableLayout: 'fixed', height: '100%', minWidth: rowVisibleCols.reduce((s, c) => s + parseInt(c.width), 0) }}>
                            <thead style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)', height: '28px' }}>
                              <tr className="border-b border-gray-200" style={{ background: '#f8f9fb' }}>
                                {rowVisibleCols.map(col => (
                                  <th key={col.key}
                                    onClick={() => handleSort(col.key)}
                                    className="px-1.5 text-right text-[10px] font-medium text-gray-500 cursor-pointer hover:text-gray-700 whitespace-nowrap"
                                    style={{ width: col.width, minWidth: col.width }}>
                                    {col.label}{sortField === col.key ? (sortDesc ? ' ↓' : ' ↑') : ''}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody style={{ height: 'calc(100% - 28px)' }}>
                              {/* 目标行 */}
                              <tr className="border-b border-dashed border-gray-100" style={{ height: '33.33%' }}>
                                {rowVisibleCols.map(col => {
                                  const st = smartTargets[col.key];
                                  return (
                                    <td key={col.key} className="px-1.5 text-right text-[11px] font-semibold text-gray-400 tabular-nums cursor-pointer hover:text-blue-600"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const cfg = productTargets[p.id] || { profitPerOrder: 10 };
                                        const ppo = cfg.profitPerOrder || 10;
                                        const er = computeTargetsByProfit(p, ppo, undefined, cfg.manualOverrides);
                                        setTargetDetailProduct({ product: p, engineResult: er, rowMode, profitPerOrder: ppo });
                                      }}>
                                      {st?.value > 0 ? st.fmt : '--'}
                                    </td>
                                  );
                                })}
                              </tr>
                              {/* 本期行 */}
                              <tr className="border-b border-dashed border-gray-100" style={{ height: '33.33%' }}>
                                {rowVisibleCols.map(col => {
                                  let cd = getMergedCellData(col.key, p, rowMode);
                                  if (col.key === 'skuCount') {
                                    const count = skuGroups.groups.length;
                                    cd = { ...cd, val: count, fmt: String(count) };
                                  }
                                  return (
                                    <td key={col.key} className="px-1.5 text-right text-[13px] font-bold tabular-nums">{cd.fmt}</td>
                                  );
                                })}
                              </tr>
                              {/* 同比行 */}
                              <tr style={{ height: '33.33%' }}>
                                {rowVisibleCols.map(col => {
                                  const cmp = getCompare(col.key);
                                  return (
                                    <td key={col.key} className={'px-1.5 text-right text-[11px] font-semibold tabular-nums ' + cmp.cls}>
                                      {cmp.fmt || '--'}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                      </td>
                          {/* 操作 - 四个竖直排列按钮：商品分析/商品复盘/推广数据/商品编辑 */}
                          <td className="px-0.5 text-center align-middle whitespace-nowrap" style={{ borderLeft: '1px solid #e5e7eb', borderRight: '1px solid #e5e7eb', width: '70px', height: '100px' }}>
                            <div className="flex flex-col items-center justify-around" style={{ height: '100%' }}>
                              <button onClick={(e) => { e.stopPropagation(); setDataAnalysisProductId(p.id); }}
                                className="flex items-center justify-center gap-1 w-full px-1 rounded text-[9px] text-blue-600 hover:bg-blue-50 transition-colors font-medium"
                                title="商品分析">
                                <BarChart3 size={10} /><span>商品分析</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setRetrospectiveProductId(p.id); }}
                                className="flex items-center justify-center gap-1 w-full px-1 rounded text-[9px] text-amber-600 hover:bg-amber-50 transition-colors font-medium"
                                title="商品复盘">
                                <RotateCcw size={10} /><span>商品复盘</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setPromoDataProductId(p.id); }}
                                className="flex items-center justify-center gap-1 w-full px-1 rounded text-[9px] text-orange-600 hover:bg-orange-50 transition-colors font-medium"
                                title="推广数据">
                                <Megaphone size={10} /><span>推广数据</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); setEditorProductId(p.id); }}
                                className="flex items-center justify-center gap-1 w-full px-1 rounded text-[9px] text-violet-600 hover:bg-violet-50 transition-colors font-medium"
                                title="商品编辑">
                                <Edit3 size={10} /><span>商品编辑</span>
                              </button>
                            </div>
                          </td>
                    </tr>
                  );

                  const skuRow = isExpanded && skuGroups.groups.length > 0 ? (
                    <tr key={p.id + '_sku'} className="border-b border-gray-100">
                      <td colSpan={99} className="p-0">
                        <div className="border-t border-pdd-border bg-pdd-bg/40">
                          {/* Level 1: Compressed groups */}
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-pdd-border/40">
                                <th className="px-4 py-2 text-left text-xs font-semibold text-pdd-text-secondary w-36">规格 / SKU</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-pdd-text-secondary w-20">历史最低价</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-pdd-text-secondary w-16">销量</th>
                                <th className="px-3 py-2 text-right text-xs font-semibold text-pdd-text-secondary w-20">收入</th>
                                <th className="px-4 py-2 text-right text-xs font-semibold text-pdd-text-secondary w-20">利润</th>
                              </tr>
                            </thead>
                            <tbody>
                              {skuGroups.groups.map((g, gi) => {
                                const subKey = `${p.id}::${gi}`;
                                const isSubExpanded = expandedSkuSubGroups.has(subKey);
                                // 构建 skuName → skuEntry 映射 (用于移动操作)
                                const skuEntryMap = new Map<string, { skuId: string; skuKey: string }>();
                                productSkuData.forEach(se => {
                                  if (se.skuName) skuEntryMap.set(se.skuName, { skuId: se.skuId, skuKey: `${se.productId}_${se.skuId}` });
                                });
                                // 计算该规格组的历史最低价
                                const groupHistLow = (() => {
                                  const histForProduct = historicalMinPrices[p.id];
                                  if (!histForProduct) return null;
                                  let min = Infinity;
                                  g.items.forEach(item => {
                                    const entry = productSkuData.find(s => s.skuName === item.skuName);
                                    if (entry) {
                                      const price = histForProduct[entry.skuId];
                                      if (price !== undefined && price < min) min = price;
                                    }
                                  });
                                  return min === Infinity ? null : min;
                                })();
                                const displayPrice = groupHistLow !== null ? groupHistLow : g.price;
                                // 获取当前所有组标签（含覆盖）
                                const currentOverrides = loadSpecOverrides(p.id);
                                const allLabels = skuGroups.groups.map(gg => currentOverrides.labels[gg.label] || gg.label);
                                // 悬浮预览
                                const previewItems = g.items.map(item => ({
                                  skuName: item.skuName,
                                  price: item.price,
                                  orders: item.sales,
                                  sales: 0,
                                }));
                                return (
                                  <React.Fragment key={gi}>
                                    <tr className={`border-b border-pdd-border/30 transition-colors ${isSubExpanded ? 'bg-pdd-bg/50' : ''} ${g.count > 1 ? 'cursor-pointer hover:bg-pdd-bg/50' : ''}`}
                                      onClick={() => {
                                        if (g.count > 1) {
                                          setExpandedSkuSubGroups(prev => {
                                            const n = new Set(prev);
                                            if (n.has(subKey)) n.delete(subKey); else n.add(subKey);
                                            return n;
                                          });
                                        }
                                      }}>
                                      <td className="px-4 py-2">
                                        <div className="flex items-center gap-2">
                                          {g.count > 1 ? (
                                            <span className={`inline-block w-4 text-center text-xs font-mono transition-transform duration-100 ${isSubExpanded ? 'text-pdd-primary' : 'text-pdd-text-secondary/70'}`}>
                                              {isSubExpanded ? '▼' : '▶'}
                                            </span>
                                          ) : (
                                            <span className="inline-block w-4" />
                                          )}
                                          <span
                                            onMouseEnter={(e) => {
                                              clearTimeout(hoverTimer.current);
                                              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                              hoverTimer.current = setTimeout(() => {
                                                setHoverInfo({ label: currentOverrides.labels[g.label] || g.label, items: previewItems, x: rect.right + 8, y: rect.top - 10 });
                                              }, 200);
                                            }}
                                            onMouseLeave={() => {
                                              clearTimeout(hoverTimer.current);
                                              hoverTimer.current = setTimeout(() => setHoverInfo(null), 300);
                                            }}
                                          >
                                            <EditableSpecLabel productId={p.id} defaultLabel={g.label} version={specVersion} onRename={() => setSpecVersion(v => v + 1)} />
                                          </span>
                                          {g.count > 1 && (
                                            <span className="text-[11px] font-medium text-pdd-primary bg-pdd-primary/10 px-2 py-0.5 rounded"
                                              onMouseEnter={(e) => {
                                                clearTimeout(hoverTimer.current);
                                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                                hoverTimer.current = setTimeout(() => {
                                                  setHoverInfo({ label: currentOverrides.labels[g.label] || g.label, items: previewItems, x: rect.right + 8, y: rect.top - 10 });
                                                }, 200);
                                              }}
                                              onMouseLeave={() => {
                                                clearTimeout(hoverTimer.current);
                                                hoverTimer.current = setTimeout(() => setHoverInfo(null), 300);
                                              }}
                                            >
                                              {g.count}个规格
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-2 text-right align-middle">
                                        <div className="font-mono text-sm font-semibold text-pdd-text tabular-nums">¥{displayPrice.toFixed(2)}</div>
                                        {groupHistLow !== null && Math.abs(groupHistLow - g.price) > 0.01 && (
                                          <div className="text-[10px] text-pdd-text-secondary/40 line-through mt-0.5">¥{g.price.toFixed(2)}</div>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 text-right text-pdd-text-secondary tabular-nums font-semibold text-sm">{g.sales}</td>
                                      <td className="px-3 py-2 text-right text-pdd-text-secondary tabular-nums font-medium text-sm">{(g.revenue || 0) >= 10000 ? ((g.revenue || 0) / 10000).toFixed(1) + '万' : '¥' + (g.revenue || 0).toFixed(0)}</td>
                                      <td className="px-4 py-2 text-right tabular-nums font-mono text-sm font-semibold text-pdd-text">
                                        {g.profit >= 0 ? '+' : ''}¥{Math.abs(g.profit).toFixed(0)}
                                        {/* 信息按钮触发预览 */}
                                        <button
                                          className="ml-1.5 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 inline-flex align-middle"
                                          onClick={e => { e.stopPropagation(); }}
                                          onMouseEnter={(e) => {
                                            clearTimeout(hoverTimer.current);
                                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                            hoverTimer.current = setTimeout(() => {
                                              setHoverInfo({ label: currentOverrides.labels[g.label] || g.label, items: previewItems, x: rect.right + 8, y: rect.top - 10 });
                                            }, 100);
                                          }}
                                          onMouseLeave={() => {
                                            clearTimeout(hoverTimer.current);
                                            hoverTimer.current = setTimeout(() => setHoverInfo(null), 300);
                                          }}
                                          title="预览SKU"
                                        >
                                          <Info size={10} />
                                        </button>
                                      </td>
                                    </tr>
                                    {/* Level 2: Expanded sub-items */}
                                    {isSubExpanded && g.count > 1 && (
                                      <tr key={`${gi}_sub`}>
                                        <td colSpan={5} className="p-0">
                                          <table className="w-full text-xs bg-pdd-bg/50">
                                            <tbody>
                                              {g.items.map((item, ii) => {
                                                const histForProduct = historicalMinPrices[p.id];
                                                const skuEntry = productSkuData.find(s => s.skuName === item.skuName);
                                                const skuKey = skuEntry ? `${skuEntry.productId}_${skuEntry.skuId}` : `${p.id}_${item.skuName}`;
                                                const skuHistLow = skuEntry && histForProduct ? histForProduct[skuEntry.skuId] : null;
                                                const itemDisplayPrice = skuHistLow !== null ? skuHistLow : item.price;
                                                const isThisMoving = movingSkuId === skuKey;
                                                return (
                                                <tr key={ii} className={`border-b border-pdd-border/20 group/sku ${isThisMoving ? 'bg-blue-50' : ''}`}>
                                                  <td className="pl-10 pr-3 py-1.5 text-pdd-text-secondary text-xs w-[32%] flex items-center gap-1">
                                                    <span className="truncate">{item.skuName}</span>
                                                    {skuEntry?.skuId && <span className="text-[9px] text-gray-300 font-mono shrink-0">{skuEntry.skuId.slice(-4)}</span>}
                                                  </td>
                                                  <td className="px-3 py-1.5 text-right align-middle w-[17%]">
                                                    <div className="font-mono text-pdd-text-secondary tabular-nums text-xs">¥{itemDisplayPrice.toFixed(2)}</div>
                                                    {skuHistLow !== null && Math.abs(skuHistLow - item.price) > 0.01 && (
                                                      <div className="text-[9px] text-pdd-text-secondary/30 line-through">¥{item.price.toFixed(2)}</div>
                                                    )}
                                                  </td>
                                                  <td className="px-3 py-1.5 text-right text-pdd-text-secondary tabular-nums w-[13%]">{item.sales}</td>
                                                  <td className="px-3 py-1.5 text-right text-pdd-text-secondary tabular-nums w-[19%]">{(item.revenue || 0) >= 10000 ? ((item.revenue || 0) / 10000).toFixed(1) + '万' : '¥' + (item.revenue || 0).toFixed(0)}</td>
                                                  <td className="px-4 py-1.5 text-right tabular-nums font-mono w-[19%] text-pdd-text relative">
                                                    {item.profit >= 0 ? '+' : ''}¥{Math.abs(item.profit).toFixed(0)}
                                                    {/* 移动按钮 */}
                                                    <div className="relative inline-block ml-1">
                                                      <button
                                                        onClick={(e) => { e.stopPropagation(); setMovingSkuId(isThisMoving ? null : skuKey); }}
                                                        className={`p-0.5 rounded transition-colors align-middle ${
                                                          isThisMoving
                                                            ? 'bg-blue-100 text-blue-600'
                                                            : 'opacity-0 group-hover/sku:opacity-100 text-gray-300 hover:text-blue-500 hover:bg-blue-50'
                                                        }`}
                                                        title="移动到其他分组"
                                                      >
                                                        <Move size={10} />
                                                      </button>
                                                      {isThisMoving && (
                                                        <div className="absolute right-0 top-full mt-1 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-1 min-w-[120px]"
                                                          onClick={e => e.stopPropagation()}>
                                                          <div className="px-3 py-1.5 text-[10px] text-gray-400 font-medium border-b border-gray-100">移动到</div>
                                                          {allLabels.filter(l => l !== (currentOverrides.labels[g.label] || g.label)).map(label => (
                                                            <button
                                                              key={label}
                                                              onClick={() => {
                                                                const ov = loadSpecOverrides(p.id);
                                                                ov.moves[skuKey] = label;
                                                                saveOverrides(p.id, ov);
                                                                setMovingSkuId(null);
                                                              }}
                                                              className="block w-full text-left px-3 py-1.5 text-xs text-gray-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                                                            >
                                                              {label}
                                                            </button>
                                                          ))}
                                                          {allLabels.length <= 1 && (
                                                            <div className="px-3 py-2 text-[10px] text-gray-300 text-center">无其他分组</div>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </td>
                                                </tr>
                                                );
                                              })}
                                            </tbody>
                                          </table>
                                          {/* New group button at bottom */}
                                          <div className="px-4 py-2 bg-pdd-bg/30 border-t border-pdd-border/20">
                                            {showNewSpecGroupInput ? (
                                              <div className="flex items-center gap-1.5 text-xs">
                                                <input
                                                  className="w-24 px-2 py-1 border border-blue-300 rounded text-xs outline-none bg-white"
                                                  value={newSpecGroupName}
                                                  autoFocus
                                                  placeholder="新规格名称"
                                                  onChange={e => setNewSpecGroupName(e.target.value)}
                                                  onKeyDown={e => {
                                                    if (e.key === 'Enter' && newSpecGroupName.trim()) {
                                                      const ov = loadSpecOverrides(p.id);
                                                      ov.customGroups = [...(ov.customGroups || []), { label: newSpecGroupName.trim(), skuKeys: [] }];
                                                      saveOverrides(p.id, ov);
                                                      setShowNewSpecGroupInput(false);
                                                      setNewSpecGroupName('');
                                                    }
                                                    if (e.key === 'Escape') { setShowNewSpecGroupInput(false); setNewSpecGroupName(''); }
                                                  }}
                                                />
                                                <button onClick={() => {
                                                  if (newSpecGroupName.trim()) {
                                                    const ov = loadSpecOverrides(p.id);
                                                    ov.customGroups = [...(ov.customGroups || []), { label: newSpecGroupName.trim(), skuKeys: [] }];
                                                    saveOverrides(p.id, ov);
                                                  }
                                                  setShowNewSpecGroupInput(false);
                                                  setNewSpecGroupName('');
                                                }} className="p-1 text-blue-500 hover:text-blue-700"><Check size={12} /></button>
                                                <button onClick={() => { setShowNewSpecGroupInput(false); setNewSpecGroupName(''); }} className="p-1 text-gray-400 hover:text-gray-600"><X size={12} /></button>
                                              </div>
                                            ) : (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setShowNewSpecGroupInput(true); }}
                                                className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition-colors"
                                              >
                                                <Plus size={12} /> 新建规格分组
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    )}
                                  </React.Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : null;

                  return isExpanded && skuRow ? row : row;
                })}
              </tbody>
            </table>
          </div>
        </>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-pdd-border/30 bg-pdd-bg/20">
            <span className="text-sm text-pdd-text-secondary/70">
              {'共 '}{sortedProducts.length}{' 款商品'}
              {listFilter === 'active' && `（有销量 ${sortedProducts.filter(p => p.sales > 0).length} 款）`}
              {listFilter === 'zero' && `（零动销 ${sortedProducts.filter(p => p.sales <= 0).length} 款）`}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1}
                className="p-2 rounded-lg hover:bg-pdd-bg disabled:opacity-30 text-pdd-text-secondary transition-colors"><ChevronLeft size={15} /></button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const startP = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                const page = startP + i;
                if (page > totalPages) return null;
                return (
                  <button key={page} onClick={() => setCurrentPage(page)}
                    className={'w-8 h-8 text-xs font-semibold rounded-lg transition-all ' + (currentPage === page ? 'bg-pdd-primary text-white shadow-sm' : 'text-pdd-text-secondary/70 hover:bg-pdd-bg')}>
                    {page}
                  </button>
                );
              })}
              <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages}
                className="p-2 rounded-lg hover:bg-pdd-bg disabled:opacity-30 text-pdd-text-secondary transition-colors"><ChevronRight size={15} /></button>
            </div>
          </div>
        )}
        </div>

        {/* Target Dialog (old format compat) */}
        {editingTarget && (
          <TargetDialog
            product={products.find(p => p.id === editingTarget) || null}
            targets={productTargets[editingTarget]}
            recommendation={products.find(p => p.id === editingTarget) ? calcRecommendation(products.find(p => p.id === editingTarget)!) : null}
            onSave={(vals) => { setProductTargets(prev => ({ ...prev, [editingTarget]: vals })); setEditingTarget(null); }}
            onClose={() => setEditingTarget(null)}
          />
        )}

        {/* Target Detail Modal (new engine) */}
        {targetDetailProduct && (
          <TargetDetailModal
            isOpen={!!targetDetailProduct}
            onClose={() => setTargetDetailProduct(null)}
            product={targetDetailProduct.product}
            engineResult={targetDetailProduct.engineResult}
            rowMode={targetDetailProduct.rowMode}
            profitPerOrder={targetDetailProduct.profitPerOrder}
            onSaveTarget={(pid, cfg) => {
              setProductTargets(prev => ({ ...prev, [pid]: cfg }));
              setTargetDetailProduct(null);
            }}
          />
        )}

        {/* Product Detail */}
        {selectedProduct && productStats[selectedProduct] && (
          <div className="border border-pdd-border rounded bg-pdd-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-pdd-border/50">
              <div className="flex items-center gap-2 text-sm font-semibold text-pdd-text">
                {'商品详情'}
                <span className="text-[11px] font-mono text-pdd-text-secondary bg-pdd-gray-50 px-1.5 py-0.5 rounded">{selectedProduct.slice(-8)}</span>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-1 rounded text-pdd-text-secondary hover:text-pdd-text hover:bg-pdd-gray-100 transition-all"><X size={14} /></button>
            </div>
            <div className="p-0">
              <Product360Analysis
                product={productStats[selectedProduct] || null}
                compareProducts={compareProducts.map(id => productStats[id]).filter(Boolean)}
                onExport={() => {}}
                orders={selectedProductOrders}
                costConfig={{ productCosts, defaultCostRatio: defaultCostRatio ?? 30, packagingFeePerOrder, shippingFeePerOrder }}
                gmvTrend={prevProductStats[selectedProduct]?.gmv > 0 ? ((productStats[selectedProduct]?.gmv - prevProductStats[selectedProduct]?.gmv) / prevProductStats[selectedProduct]?.gmv) * 100 : undefined}
                refundRateTrend={prevProductStats[selectedProduct] ? (productStats[selectedProduct]?.refundRate || 0) - (prevProductStats[selectedProduct]?.refundRate || 0) : undefined}
              />
            </div>
          </div>
        )}
      </>
    );
  };
function TargetDialog({ product, targets, recommendation, onSave, onClose }: {
    product: any; targets: any; recommendation: { targetProfit: number; targetProfitRate: number; targetROI: number; targetGMV: number; suggestion: string } | null; onSave: (vals: any) => void; onClose: () => void;
  }) {
    const [profit, setProfit] = useState(targets?.targetProfit ?? recommendation?.targetProfit ?? 0);
    const [profitRate, setProfitRate] = useState(targets?.targetProfitRate ?? recommendation?.targetProfitRate ?? 0);
    const [roi, setRoi] = useState(targets?.targetROI ?? recommendation?.targetROI ?? 0);
    const [gmv, setGmv] = useState(targets?.targetGMV ?? recommendation?.targetGMV ?? 0);
    return (
      <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-pdd-card rounded border border-pdd-border shadow-lg max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-pdd-primary" />
              <span className="text-sm font-semibold text-pdd-text">设定目标</span>
            </div>
            <button onClick={onClose} className="text-pdd-text-secondary hover:text-pdd-text"><X size={15} /></button>
          </div>
          {product && (
            <div className="text-xs text-pdd-text-secondary mb-4">
              <span className="font-medium text-pdd-text">{product.name || product.id}</span>
            </div>
          )}
          {recommendation && (
            <div className="bg-pdd-primary/10 rounded p-3 mb-4 text-xs text-pdd-primary flex items-start gap-2">
              <Lightbulb size={13} className="shrink-0 mt-0.5" />
              <div>{recommendation.suggestion}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="text-[10px] font-medium text-pdd-text-secondary">目标利润</label>
              <input type="number" value={profit} onChange={e => setProfit(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2.5 py-1.5 text-xs border border-pdd-border rounded focus:outline-none focus:border-pdd-primary bg-pdd-card" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-pdd-text-secondary">目标利润率 (%)</label>
              <input type="number" value={profitRate} onChange={e => setProfitRate(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2.5 py-1.5 text-xs border border-pdd-border rounded focus:outline-none focus:border-pdd-primary bg-pdd-card" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-pdd-text-secondary">目标ROI</label>
              <input type="number" value={roi} onChange={e => setRoi(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2.5 py-1.5 text-xs border border-pdd-border rounded focus:outline-none focus:border-pdd-primary bg-pdd-card" />
            </div>
            <div>
              <label className="text-[10px] font-medium text-pdd-text-secondary">目标GMV</label>
              <input type="number" value={gmv} onChange={e => setGmv(parseFloat(e.target.value) || 0)}
                className="w-full mt-1 px-2.5 py-1.5 text-xs border border-pdd-border rounded focus:outline-none focus:border-pdd-primary bg-pdd-card" />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-pdd-text-secondary bg-pdd-card border border-pdd-border rounded hover:bg-pdd-gray-50 transition-colors">取消</button>
            <button onClick={() => onSave({ targetProfit: profit || 0, targetProfitRate: profitRate || 0, targetROI: roi || 0, targetGMV: gmv || 0 })}
              className="px-3 py-1.5 text-xs font-medium text-white bg-pdd-primary rounded hover:bg-pdd-primary-dark transition-colors">保存</button>
          </div>
        </div>
      </div>
    );
  }

  const renderContent = () => renderProductTable();

  return (
    <div className="min-h-screen bg-pdd-bg p-4 lg:p-6 space-y-4">
      {/* ── 统一筛选栏 ── */}
      <UnifiedFilterBar
        timeFilter={tf}
        search={{ value: searchKeyword, onChange: (v) => { setSearchKeyword(v); setCurrentPage(1); }, placeholder: '搜索商品ID/名称...' }}
        dropdowns={[
          { value: listFilter, onChange: (v) => { setListFilter(v as any); setCurrentPage(1); }, options: [{ value: 'all', label: '全部' }, { value: 'active', label: '有销量' }, { value: 'zero', label: '零动销' }], placeholder: '全部' },
        ]}
        showAdvanced={showFilterDropdown}
        onToggleAdvanced={() => setShowFilterDropdown(!showFilterDropdown)}
        advancedFilterPanel={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-pdd-text-secondary font-medium">价格</span>
              <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50">
                {['all','0-50','50-100','100-200','200-max'].map(k => (
                  <button key={k} onClick={() => { setPriceFilter(k); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                      priceFilter === k ? 'bg-pdd-card text-pdd-text shadow-sm font-medium' : 'text-pdd-text-secondary hover:text-pdd-text'
                    }`}>
                    {k === 'all' ? '不限' : k === '200-max' ? '¥200+' : '¥' + k.replace('-', '~').replace('max', '')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-pdd-text-secondary font-medium">销量</span>
              <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50">
                {['all','0-10','10-50','50-100','100-max'].map(k => (
                  <button key={k} onClick={() => { setSalesFilter(k); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                      salesFilter === k ? 'bg-pdd-card text-pdd-text shadow-sm font-medium' : 'text-pdd-text-secondary hover:text-pdd-text'
                    }`}>
                    {k === 'all' ? '不限' : k === '100-max' ? '100+' : k.replace('-', '~').replace('max', '')}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-pdd-text-secondary font-medium">售后率</span>
              <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50">
                {['all','0-5','5-10','10-20','20-max'].map(k => (
                  <button key={k} onClick={() => { setAfterSaleFilter(k); setCurrentPage(1); }}
                    className={`px-2.5 py-1 text-[11px] rounded-md transition-all ${
                      afterSaleFilter === k ? 'bg-pdd-card text-pdd-text shadow-sm font-medium' : 'text-pdd-text-secondary hover:text-pdd-text'
                    }`}>
                    {k === 'all' ? '不限' : k === '20-max' ? '20%+' : k.replace('-', '~').replace('max', '') + '%'}
                  </button>
                ))}
              </div>
            </div>
            {(priceFilter !== 'all' || salesFilter !== 'all' || afterSaleFilter !== 'all') && (
              <button onClick={() => { setPriceFilter('all'); setSalesFilter('all'); setAfterSaleFilter('all'); setShowFilterDropdown(false); }}
                className="text-[11px] text-pdd-danger/70 hover:text-pdd-danger font-medium">清除全部</button>
            )}
          </div>
        }
        activeFilterTags={[
          ...(priceFilter !== 'all' ? [{ key: 'price', label: `价格 ¥${priceFilter === '200-max' ? '200+' : priceFilter.replace('-', '~')}`, onRemove: () => setPriceFilter('all') }] : []),
          ...(salesFilter !== 'all' ? [{ key: 'sales', label: `销量 ${salesFilter === '100-max' ? '100+' : salesFilter.replace('-', '~')}`, onRemove: () => setSalesFilter('all') }] : []),
          ...(afterSaleFilter !== 'all' ? [{ key: 'afterSale', label: `售后率 ${afterSaleFilter === '20-max' ? '20%+' : afterSaleFilter.replace('-', '~') + '%'}`, onRemove: () => setAfterSaleFilter('all') }] : []),
        ]}
        onClearAllFilters={() => { setPriceFilter('all'); setSalesFilter('all'); setAfterSaleFilter('all'); setShowFilterDropdown(false); }}
        actions={[
          ...(compareProducts.length > 0 ? [{ label: `对比(${compareProducts.length})`, onClick: () => setShowCompare(!showCompare), active: showCompare }] : []),
          { label: '指标', onClick: () => setShowKpiSelector(true) },
          { label: 'CSV', onClick: handleExportCSV },
        ]}
      />

      {/* ── 主体内容 ── */}
      <div className="space-y-4">
        {/* KPI 卡片 */}
        {renderKpiPanel()}

        {/* 商品表格 */}
        {renderContent()}

        {/* ── 商品对比面板 ── */}
        {showCompare && compareData.length > 0 && (
          <div className="bg-pdd-card rounded-lg border border-pdd-border overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-pdd-border/50">
              <span className="text-xs font-semibold text-pdd-text-secondary">商品对比 ({compareData.length})</span>
              <button onClick={() => setShowCompare(false)} className="text-pdd-text-secondary/50 hover:text-pdd-text/70 p-1"><X size={13} /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-pdd-border/30 text-pdd-text-secondary">
                    <th className="py-2.5 px-4 text-left font-medium text-[11px]">商品</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">GMV</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">实收</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">利润</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">利润率</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">推广花费</th>
                    <th className="py-2.5 px-3 text-right font-medium text-[11px]">售后率</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pdd-border/20">
                  {compareData.map(p => (
                    <tr key={p.id} className="hover:bg-pdd-bg/30 transition-colors">
                      <td className="py-2.5 px-4 truncate max-w-[140px] text-pdd-text">{p.name}</td>
                      <td className="py-2.5 px-3 text-right text-pdd-text-secondary tabular-nums">{(p.gmv || 0) >= 10000 ? ((p.gmv || 0) / 10000).toFixed(1) + '万' : (p.gmv || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-right text-pdd-text-secondary tabular-nums">{(p.revenue || 0) >= 10000 ? ((p.revenue || 0) / 10000).toFixed(1) + '万' : (p.revenue || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-medium text-pdd-text">{(p.profit || 0) >= 10000 ? ((p.profit || 0) / 10000).toFixed(1) + '万' : (p.profit || 0).toFixed(0)}</td>
                      <td className="py-2.5 px-3 text-right text-pdd-text-secondary tabular-nums">{(p.profitRate || 0).toFixed(1)}%</td>
                      <td className="py-2.5 px-3 text-right text-pdd-text-secondary tabular-nums">{(p.promoCost || 0) > 0 ? ((p.promoCost || 0) >= 10000 ? ((p.promoCost || 0) / 10000).toFixed(1) + '万' : (p.promoCost || 0).toFixed(0)) : '-'}</td>
                      <td className="py-2.5 px-3 text-right text-pdd-text-secondary tabular-nums">{(p.afterSaleRate || 0).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── 商品详情 & 目标设定弹窗 — 由 renderProductTable 内部渲染 ── */}
        {/* 这两个组件在 renderProductTable() 中已经包含，不需要重复渲染 */}
      </div>

      {/* ── 商品详情抽屉 ── */}
      <ProductDetailDrawer
        product={drawerProduct}
        skuList={drawerProductId ? skuData.filter(s => s.productId === drawerProductId) : []}
        isOpen={!!drawerProductId}
        onClose={() => setDrawerProductId(null)}
      />

      {/* ── 单商品深度解析全屏模态框 ── */}
      <AnalysisProvider>
        <ProductDeepAnalysis
          isOpen={deepAnalysisOpen}
          onClose={() => setDeepAnalysisOpen(false)}
          initialProductId={deepAnalysisProductId}
          productStats={productStats}
          products={products}
          orders={filteredOrders}
          prevProductStats={prevProductStats}
        />
      </AnalysisProvider>

      {/* ── 商品数据分析 ── */}
      <ProductDataAnalysis
        productId={dataAnalysisProductId || ''}
        storeId={currentStore?.id || ''}
        isOpen={!!dataAnalysisProductId}
        onClose={() => setDataAnalysisProductId(null)}
        skuList={dataAnalysisProductId ? skuData.filter(s => s.productId === dataAnalysisProductId) : undefined}
        timeRange={timeRange}
        customStart={customStart}
        customEnd={customEnd}
      />

      {/* ── 商品复盘 ── */}
      <ProductRetrospective
        productId={retrospectiveProductId}
        storeId={currentStore?.id || ''}
        isOpen={!!retrospectiveProductId}
        onClose={() => setRetrospectiveProductId(null)}
        timeRange={timeRange}
        customStart={customStart}
        customEnd={customEnd}
      />

      {/* ── 商品编辑 ── */}
      <ProductEditor
        product={editorProductId ? productStats[editorProductId] || null : null}
        isOpen={!!editorProductId}
        onClose={() => setEditorProductId(null)}
        currentImage={editorProductId ? productImages[editorProductId] : undefined}
        onImageUpload={handleImageUpload}
        currentTargets={productTargets}
        onSaveTargets={(pid, targets) => { setProductTargets(prev => ({ ...prev, [pid]: targets })); }}
        productCosts={productCosts}
      />

      {/* ── 推广数据 ── */}
      <PromotionDataPanel
        isOpen={!!promoDataProductId}
        onClose={() => setPromoDataProductId(null)}
        product={promoDataProductId ? productStats[promoDataProductId] || null : null}
        timeRange={timeRange}
      />

      {/* ── 图片全屏放大 ── */}
      {enlargedImage && (
        <div className="fixed inset-0 z-[99999] bg-black/70 flex items-center justify-center cursor-pointer"
          onClick={() => setEnlargedImage(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={enlargedImage} alt="" className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl" />
            <button onClick={() => setEnlargedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      {/* 规格悬浮预览卡片 */}
      <SpecPreviewCard
        label={hoverInfo?.label || ''}
        items={hoverInfo?.items || []}
        visible={!!hoverInfo}
        x={hoverInfo?.x || 0}
        y={hoverInfo?.y || 0}
      />
    </div>
  );
}

/* ── 三点操作菜单 ── */
function ActionMenuButton({ productId, onDataAnalysis, onRetrospective, onEditor }: {
  productId: string;
  onDataAnalysis: () => void;
  onRetrospective: () => void;
  onEditor: () => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-all"
        title="操作"
      >
        <GripVertical size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-50" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[120px]"
            onClick={(e) => e.stopPropagation()}>
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onDataAnalysis(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-blue-50 hover:text-blue-600 transition-colors text-left">
              <BarChart3 size={13} /> 数据分析
            </button>
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onRetrospective(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-600 transition-colors text-left">
              <RotateCcw size={13} /> 商品复盘
            </button>
            <button onClick={(e) => { e.stopPropagation(); setOpen(false); onEditor(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-violet-50 hover:text-violet-600 transition-colors text-left">
              <Edit3 size={13} /> 商品编辑
            </button>
          </div>
        </>
      )}
    </div>
  );
}

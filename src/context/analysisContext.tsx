/**
 * 分析上下文 — 统一管理商品沉浸式分析的所有筛选状态
 * 核心理念：改一处全局变，点哪里哪里下钻
 */
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

// ─── 类型定义 ───

export interface TimeRange {
  start: string; // ISO date
  end: string;
}

export type TimeFilterMode = 'single' | 'compare';

export interface TimeFilter {
  mode: TimeFilterMode;
  rangeA: TimeRange;       // 主时段
  rangeB?: TimeRange;      // 对比时段
  preset?: '7d' | '30d' | '90d' | 'all' | 'custom' | 'thisWeek' | 'thisMonth' | 'lastMonth';
}

export interface FilterRule {
  id: string;
  field: 'price' | 'sales' | 'refundRate' | 'profitRate' | 'gmv' | 'roi';
  operator: 'gt' | 'lt' | 'between';
  value: number;
  value2?: number;
}

export interface DrillNode {
  type: 'all' | 'product' | 'sku';
  label: string;
  productId?: string;
  skuId?: string;
}

type ComparisonMode = 'storeAvg' | 'prevPeriod' | 'none';

interface AnalysisState {
  selectedProductId: string | null;
  drilldownPath: DrillNode[];
  timeFilter: TimeFilter;
  filterRules: FilterRule[];
  highlightMetric: string | null;
  comparisonMode: ComparisonMode;
}

interface AnalysisActions {
  selectProduct: (id: string | null) => void;
  drillToSku: (skuId: string, label: string) => void;
  drillUp: () => void;
  setTimeFilter: (f: TimeFilter) => void;
  addFilterRule: (r: FilterRule) => void;
  removeFilterRule: (id: string) => void;
  setHighlight: (metric: string | null) => void;
  setComparisonMode: (m: ComparisonMode) => void;
  resetAll: () => void;
}

type AnalysisContextType = AnalysisState & AnalysisActions & {
  breadcrumbs: DrillNode[];
  scopeLabel: string;
  timeLabel: string;
};

const ctx = createContext<AnalysisContextType>(null!);
export const useAnalysis = () => useContext(ctx);

function toLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function defaultTimeFilter(): TimeFilter {
  const end = new Date();
  const start = new Date(end.getTime() - 7 * 86400000);
  return {
    mode: 'single',
    rangeA: { start: toLocalDate(start), end: toLocalDate(end) },
    preset: '7d',
  };
}

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [drilldownPath, setDrilldownPath] = useState<DrillNode[]>([{ type: 'all', label: '全店' }]);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>(defaultTimeFilter);
  const [filterRules, setFilterRules] = useState<FilterRule[]>([]);
  const [highlightMetric, setHighlight] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('storeAvg');

  const selectProduct = useCallback((id: string | null, name?: string) => {
    setSelectedProductId(id);
    if (id) {
      setDrilldownPath([{ type: 'all', label: '全店' }, { type: 'product', label: name || id, productId: id }]);
    } else {
      setDrilldownPath([{ type: 'all', label: '全店' }]);
    }
    setHighlight(null);
  }, []);

  const drillToSku = useCallback((skuId: string, label: string) => {
    const current = drilldownPath[drilldownPath.length - 1];
    setDrilldownPath(prev => [...prev, { type: 'sku', label: label || skuId, productId: current.productId, skuId }]);
  }, [drilldownPath]);

  const drillUp = useCallback(() => {
    setDrilldownPath(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.slice(0, -1);
      const parent = next[next.length - 1];
      if (parent.type === 'all') setSelectedProductId(null);
      return next;
    });
  }, []);

  const addFilterRule = useCallback((r: FilterRule) => {
    setFilterRules(prev => [...prev, r]);
  }, []);

  const removeFilterRule = useCallback((id: string) => {
    setFilterRules(prev => prev.filter(r => r.id !== id));
  }, []);

  const resetAll = useCallback(() => {
    setSelectedProductId(null);
    setDrilldownPath([{ type: 'all', label: '全店' }]);
    setTimeFilter(defaultTimeFilter());
    setFilterRules([]);
    setHighlight(null);
    setComparisonMode('storeAvg');
  }, []);

  // 面包屑
  const breadcrumbs = drilldownPath;

  // 范围标签
  const scopeLabel = drilldownPath[drilldownPath.length - 1]?.label || '全店';

  // 时间标签
  const timeLabel = timeFilter.preset === 'custom'
    ? `${timeFilter.rangeA.start} ~ ${timeFilter.rangeA.end}`
    : timeFilter.preset === '7d' ? '最近7天'
    : timeFilter.preset === '30d' ? '最近30天'
    : timeFilter.preset === '90d' ? '最近90天'
    : '全部时间';

  const value = {
    selectedProductId, drilldownPath, timeFilter, filterRules, highlightMetric, comparisonMode,
    selectProduct, drillToSku, drillUp, setTimeFilter, addFilterRule, removeFilterRule, setHighlight, setComparisonMode, resetAll,
    breadcrumbs, scopeLabel, timeLabel,
  };

  return <ctx.Provider value={value}>{children}</ctx.Provider>;
}

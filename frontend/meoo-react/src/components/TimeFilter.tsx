/**
 * 时间筛选 — 全站一致性方案
 *
 * 核心原则（来自 23-产品愿景与质量底线.md）：
 *   "同一数据在不同页面必须口径一致，否则用户永远失去信任"
 *
 * ✅ 订单数据 (orders)：
 *    用 filterByTimeRange() 按订单的"支付时间"或"下单时间"筛选
 *    全站统一锚点: globalOrderMaxDate (以所有订单中的最大日期为锚点)
 *    所有页面使用相同的 timeFilter hook
 *
 * ✅ 非订单数据（推广/售后/财务/保险等）：
 *    用 filterPromoByTimeRange() 按记录自身的日期字段筛选
 *    锚点：自己的最大日期或订单最大日期（取较新者）
 *
 * ✅ 退款/罚款/保险等费用汇总：
 *    必须通过 orderFinancialActuals 按订单号关联到 filteredOrders
 *    不要直接对 afterSaleRecords/financialRecords 做时间筛选后汇总
 *    因为退款可能发生在订单日期之后很久（跨时间范围）
 *
 * ✅ 利润公式（全站统一口径）：
 *    profit = merchantReceived - refund - promoCost - penalty - insurance - platformFee
 *    (不含进价/包装费/快递费 — 这些在商品级利润计算中)
 *
 * 新增工具函数（2026-06-04）：
 *   computeDateRange()       — 提取日期范围计算逻辑（与 filterByTimeRange 同口径）
 *   computePromoDateRange()  — 非订单数据的日期锚点计算
 *   filterRecordsByDateRange() — 按日期范围过滤任意记录
 */
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Clock, Save, X } from 'lucide-react';
import { findField } from '../utils/fieldAccess';
import { usePreferenceStore } from '../store/preferenceStore';

export type TimeRange = '7' | '30' | '90' | 'all' | 'custom';
export type TimeGranularity = 'day' | 'week' | 'month';
export type QuickRange = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'lastQuarter' | 'thisYear' | 'lastYear';

export interface TimeFilterState {
  timeRange: TimeRange;
  granularity: TimeGranularity;
  compareEnabled: boolean;
  customStart?: string;
  customEnd?: string;
  compareStart?: string;
  compareEnd?: string;
  quickRange?: QuickRange;
}

export type TimeFilterStateWithSetters = TimeFilterState & {
  setTimeRange: (r: TimeRange) => void;
  setGranularity: (g: TimeGranularity) => void;
  setCompareEnabled: (v: boolean) => void;
};

export function useTimeFilter(defaultRange: TimeRange = '7', defaultGranularity: TimeGranularity = 'day'): TimeFilterState & {
  setTimeRange: (r: TimeRange) => void;
  setGranularity: (g: TimeGranularity) => void;
  setCompareEnabled: (v: boolean) => void;
  setCustomRange: (start: string, end: string) => void;
  setCompareRange: (start: string, end: string) => void;
  setQuickRange: (q: QuickRange) => void;
  savedRanges: SavedRange[];
  saveCurrentRange: (name: string) => void;
  deleteSavedRange: (id: string) => void;
  applySavedRange: (range: SavedRange) => void;
  useNaturalDate: boolean;
  setUseNaturalDate: (v: boolean) => void;
} {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultRange);
  const [granularity, setGranularity] = useState<TimeGranularity>(defaultGranularity);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [compareStart, setCompareStart] = useState<string>('');
  const [compareEnd, setCompareEnd] = useState<string>('');
  const [quickRange, setQuickRangeState] = useState<QuickRange | undefined>();
  const [useNaturalDate, setUseNaturalDate] = useState(false);
  // 使用 PreferenceStore 管理 savedRanges（跨设备同步）
  const prefStore = usePreferenceStore();
  const savedRanges = prefStore.get<SavedRange[]>('saved_ranges', []);
  const setSavedRanges = (newRanges: SavedRange[]) => prefStore.set('saved_ranges', newRanges);

  const setCustomRange = (start: string, end: string) => {
    setCustomStart(start);
    setCustomEnd(end);
    setTimeRange('custom');
    setQuickRangeState(undefined);
  };

  const setCompareRange = (start: string, end: string) => {
    setCompareStart(start);
    setCompareEnd(end);
  };

  const setQuickRange = (q: QuickRange) => {
    setQuickRangeState(q);
    setCustomStart('');
    setCustomEnd('');
    setTimeRange('custom');
  };

  // 包装 setTimeRange：切换到非自定义范围时自动清除自定义日期和快速范围
  const handleSetTimeRange = (r: TimeRange) => {
    setTimeRange(r);
    if (r !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
      setQuickRangeState(undefined);
    }
  };

  const saveCurrentRange = (name: string) => {
    const newRange: SavedRange = {
      id: Date.now().toString(),
      name,
      timeRange,
      granularity,
      customStart,
      customEnd,
      quickRange,
    };
    const updated = [...savedRanges, newRange];
    setSavedRanges(updated);
  };

  const deleteSavedRange = (id: string) => {
    const updated = savedRanges.filter(r => r.id !== id);
    setSavedRanges(updated);
  };

  const applySavedRange = (range: SavedRange) => {
    setTimeRange(range.timeRange);
    setGranularity(range.granularity);
    setCustomStart(range.customStart || '');
    setCustomEnd(range.customEnd || '');
    setQuickRangeState(range.quickRange);
  };

  return {
    timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange,
    setTimeRange: handleSetTimeRange, setGranularity, setCompareEnabled, setCustomRange, setCompareRange, setQuickRange,
    savedRanges, saveCurrentRange, deleteSavedRange, applySavedRange,
    useNaturalDate, setUseNaturalDate,
  };
}

interface SavedRange {
  id: string;
  name: string;
  timeRange: TimeRange;
  granularity: TimeGranularity;
  customStart?: string;
  customEnd?: string;
  quickRange?: QuickRange;
}

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr);
  const dayNum = d.getDay();
  const mondayOffset = dayNum === 0 ? -6 : 1 - dayNum;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  const m = monday.getMonth() + 1;
  const dd = monday.getDate();
  return `${monday.getFullYear()}-${m < 10 ? '0' + m : m}-${dd < 10 ? '0' + dd : dd}`;
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${d.getMonth() + 1}月`;
}

export function formatLabel(key: string, granularity: TimeGranularity): string {
  if (granularity === 'day') return key.slice(5);
  if (granularity === 'week') return key.slice(5);
  return key;
}

export function getQuickRangeDates(q: QuickRange): { start: string; end: string } {
  const today = new Date();
  const format = (d: Date) => d.toISOString().split('T')[0];
  
  switch (q) {
    case 'today':
      return { start: format(today), end: format(today) };
    case 'yesterday':
      const yest = new Date(today); yest.setDate(yest.getDate() - 1);
      return { start: format(yest), end: format(yest) };
    case 'thisWeek':
      const dayNum = today.getDay();
      const mondayOffset = dayNum === 0 ? -6 : 1 - dayNum;
      const monday = new Date(today); monday.setDate(today.getDate() + mondayOffset);
      return { start: format(monday), end: format(today) };
    case 'lastWeek':
      const lastWeekDayNum = today.getDay();
      const lastMondayOffset = lastWeekDayNum === 0 ? -13 : -6 - lastWeekDayNum;
      const lastMonday = new Date(today); lastMonday.setDate(today.getDate() + lastMondayOffset);
      const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);
      return { start: format(lastMonday), end: format(lastSunday) };
    case 'thisMonth':
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      return { start: format(firstDay), end: format(today) };
    case 'lastMonth':
      const lastMonthFirst = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastMonthLast = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: format(lastMonthFirst), end: format(lastMonthLast) };
    case 'thisQuarter':
      const quarter = Math.floor(today.getMonth() / 3);
      const quarterFirst = new Date(today.getFullYear(), quarter * 3, 1);
      return { start: format(quarterFirst), end: format(today) };
    case 'lastQuarter':
      const lastQ = Math.floor(today.getMonth() / 3) - 1;
      const lastQYear = lastQ < 0 ? today.getFullYear() - 1 : today.getFullYear();
      const lastQMonth = lastQ < 0 ? 9 : lastQ * 3;
      const lastQFirst = new Date(lastQYear, lastQMonth, 1);
      const lastQLast = new Date(lastQYear, lastQMonth + 3, 0);
      return { start: format(lastQFirst), end: format(lastQLast) };
    case 'thisYear':
      const yearFirst = new Date(today.getFullYear(), 0, 1);
      return { start: format(yearFirst), end: format(today) };
    case 'lastYear':
      const lastYearFirst = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearLast = new Date(today.getFullYear() - 1, 11, 31);
      return { start: format(lastYearFirst), end: format(lastYearLast) };
    default:
      return { start: format(today), end: format(today) };
  }
}

export function safeFloat(v: any): number { if (v == null) return 0; const s = String(v).trim().replace(/[^\d.\-]/g, ''); const n = parseFloat(s); return isNaN(n) ? 0 : n; }
/** 订单日期提取：支付时间 → 下单时间 降级 */
function getOrderDate(o: any): string { return String(findField(o, '支付时间') || findField(o, '下单时间') || '').split(' ')[0]; }

/**
 * 统一日期范围计算器
 * 返回与 filterByTimeRange 完全一致的 { startDate, endDate }，
 * 确保所有数据类型的日期范围口径统一。
 * timeRange === 'all' 或无数据时返回 null（表示不过滤）。
 */
export function computeDateRange(
  allDates: [string, any[]][],
  timeRange: TimeRange,
  customStart?: string,
  customEnd?: string,
  quickRange?: QuickRange,
  useNaturalDate?: boolean
): { startDate: string; endDate: string } | null {
  if (timeRange === 'all' || !allDates.length) return null;

  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    return { startDate: dates.start, endDate: dates.end };
  }
  if (timeRange === 'custom' && customStart) {
    return { startDate: customStart, endDate: customEnd || customStart };
  }
  if (timeRange === 'custom') return null;

  const anchorStr = useNaturalDate ? null : (globalOrderMaxDate || allDates[allDates.length - 1][0]);
  const anchorDate = anchorStr ? new Date(anchorStr) : new Date();
  const lastD = anchorDate;
  const rangeDays = parseInt(timeRange);
  const cutoff = new Date(lastD);
  cutoff.setDate(cutoff.getDate() - rangeDays + 1);
  return {
    startDate: cutoff.toISOString().split('T')[0],
    endDate: anchorDate.toISOString().split('T')[0],
  };
}

/**
 * 计算非订单数据的统一日期锚点（适用于推广/售后/财务等）
 * 与 filterPromoByTimeRange 口径一致。
 * timeRange === 'all' 或 records 为空时返回 null。
 */
export function computePromoDateRange(
  records: any[],
  allDates: [string, any[]][],
  timeRange: TimeRange,
  dateFields: string[] = ['日期', 'date'],
  customStart?: string,
  customEnd?: string,
  quickRange?: QuickRange,
  useNaturalDate?: boolean
): { startDate: string; endDate: string } | null {
  if (!records.length || timeRange === 'all') return null;

  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    return { startDate: dates.start, endDate: dates.end };
  }
  if (timeRange === 'custom' && customStart) {
    return { startDate: customStart, endDate: customEnd || customStart };
  }
  if (timeRange === 'custom' || isNaN(parseInt(timeRange))) return null;

  if (useNaturalDate) {
    const anchorDate = new Date();
    const rangeDays = parseInt(timeRange);
    const cutoff = new Date(anchorDate);
    cutoff.setDate(cutoff.getDate() - rangeDays + 1);
    return {
      startDate: cutoff.toISOString().split('T')[0],
      endDate: anchorDate.toISOString().split('T')[0],
    };
  }

  let maxDate = '';
  for (const r of records) {
    const d = String(findField(r, ...dateFields) || '').trim().replace(/\//g, '-').split(' ')[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > maxDate) maxDate = d;
  }
  if (!maxDate && allDates.length) maxDate = allDates[allDates.length - 1][0];
  if (!maxDate) return null;

  const lastD = new Date(maxDate);
  const rangeDays = parseInt(timeRange);
  const cutoff = new Date(lastD);
  cutoff.setDate(cutoff.getDate() - rangeDays + 1);
  return {
    startDate: cutoff.toISOString().split('T')[0],
    endDate: maxDate,
  };
}

/**
 * 按日期范围过滤任意记录数组。
 * records 中每条的日期通过 dateFields 提取，在 [startDate, endDate] 内则保留。
 */
export function filterRecordsByDateRange(
  records: any[],
  dateRange: { startDate: string; endDate: string } | null,
  dateFields: string[] = ['日期', 'date']
): any[] {
  if (!dateRange || !records.length) return records;
  const { startDate, endDate } = dateRange;
  return records.filter(r => {
    let d = String(findField(r, ...dateFields) || '').trim().split(' ')[0];
    d = d.replace(/\//g, '-');
    return d >= startDate && d <= endDate;
  });
}

// ★ 全局订单数据锚点：所有页面统一用订单最大日期做时间基准
let globalOrderMaxDate: string | null = null;
export function setGlobalOrderMaxDate(date: string | null) { globalOrderMaxDate = date; }
export function getGlobalOrderMaxDate(): string | null { return globalOrderMaxDate; }

export function filterByTimeRange(orders: any[], allDates: [string, any[]][], timeRange: TimeRange, customStart?: string, customEnd?: string, quickRange?: QuickRange, useNaturalDate?: boolean): any[] {
  // "全部" 或无日期数据时：返回全部
  if (timeRange === 'all' || !allDates.length) return orders;

  let startDate: string;
  let endDate: string;

  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    startDate = dates.start;
    endDate = dates.end;
  } else if (timeRange === 'custom' && customStart) {
    startDate = customStart;
    endDate = customEnd || customStart;
  } else {
    // ★ 锚点：按自然日期用今天，按数据日期用全局订单最大日期（fallback: 当前数据最大日期）
    const anchorStr = useNaturalDate ? null : (globalOrderMaxDate || allDates[allDates.length - 1][0]);
    const anchorDate = anchorStr ? new Date(anchorStr) : new Date();
    const lastD = anchorDate;
    const rangeDays = parseInt(timeRange);
    const cutoff = new Date(lastD);
    cutoff.setDate(cutoff.getDate() - rangeDays + 1);
    startDate = cutoff.toISOString().split('T')[0];
    endDate = anchorDate.toISOString().split('T')[0];
  }

  return orders.filter(o => {
    const d = getOrderDate(o);
    return d >= startDate && d <= endDate;
  });
}

// 按时间范围过滤推广/售后等带"日期"字段的数据
// 用记录自身的日期范围做时间锚点，而非订单日期（推广数据日期可能与订单不一致）
export function filterPromoByTimeRange(records: any[], allDates: [string, any[]][], timeRange: TimeRange, dateFields: string[] = ['日期', 'date'], customStart?: string, customEnd?: string, quickRange?: QuickRange, useNaturalDate?: boolean): any[] {
  if (!records.length) return records;
  if (timeRange === 'all') return records;

  let startDate: string;
  let endDate: string;

  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    startDate = dates.start;
    endDate = dates.end;
  } else if (timeRange === 'custom' && customStart) {
    startDate = customStart;
    endDate = customEnd || customStart;
  } else if (timeRange === 'custom' || isNaN(parseInt(timeRange))) {
    return records;
  } else {
    // ★ 锚点：useNaturalDate=true 用今天，否则用数据自身最大日期
    if (useNaturalDate) {
      const anchorDate = new Date();
      const rangeDays = parseInt(timeRange);
      const cutoff = new Date(anchorDate);
      cutoff.setDate(cutoff.getDate() - rangeDays + 1);
      startDate = cutoff.toISOString().split('T')[0];
      endDate = anchorDate.toISOString().split('T')[0];
    } else {
      let maxDate = '';
      for (const r of records) {
        const d = String(findField(r, ...dateFields) || '').trim().replace(/\//g, '-').split(' ')[0];
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && d > maxDate) maxDate = d;
      }
      if (!maxDate && allDates.length) maxDate = allDates[allDates.length - 1][0];
      if (!maxDate) return records;
      const lastD = new Date(maxDate);
      const rangeDays = parseInt(timeRange);
      const cutoff = new Date(lastD);
      cutoff.setDate(cutoff.getDate() - rangeDays + 1);
      startDate = cutoff.toISOString().split('T')[0];
      endDate = maxDate;
    }
  }

  return records.filter(r => {
    let d = String(findField(r, ...dateFields) || '').trim().split(' ')[0];
    d = d.replace(/\//g, '-');
    return d >= startDate && d <= endDate;
  });
}

export function getCompareOrders(orders: any[], allDates: [string, any[]][], timeRange: TimeRange, compareStart?: string, compareEnd?: string, customStart?: string, customEnd?: string, quickRange?: QuickRange): any[] {
  if (!allDates.length) return [];

  if (compareStart && compareEnd) {
    return orders.filter(o => {
      const d = getOrderDate(o);
      return d >= compareStart && d <= compareEnd;
    });
  }

  let startDate: string;
  let endDate: string;
  let isCurrentPeriod = false; // 标记是否为当前周期（需要再偏移到上一周期）

  // 自定义日期或快速范围：先获取当前周期日期
  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    startDate = dates.start;
    endDate = dates.end;
    isCurrentPeriod = true;
  } else if (timeRange === 'custom' && customStart) {
    startDate = customStart;
    endDate = customEnd || customStart; // 单天选择
    isCurrentPeriod = true;
  } else if (timeRange === 'custom') {
    return []; // 无日期无法计算
  } else if (timeRange === 'all' || isNaN(parseInt(timeRange))) {
    return [];
  } else {
    const lastDate = allDates[allDates.length - 1][0];
    const lastD = new Date(lastDate);
    if (isNaN(lastD.getTime())) return [];
    const rangeDays = parseInt(timeRange);
    const currentStart = new Date(lastD);
    currentStart.setDate(currentStart.getDate() - rangeDays + 1);
    const compareS = new Date(currentStart);
    compareS.setDate(compareS.getDate() - rangeDays);
    const compareE = new Date(currentStart);
    compareE.setDate(compareE.getDate() - 1);
    if (isNaN(compareS.getTime()) || isNaN(compareE.getTime())) return [];
    startDate = compareS.toISOString().split('T')[0];
    endDate = compareE.toISOString().split('T')[0];
  }

  // 自定义/快速范围需要从当前周期计算等长上一周期
  if (isCurrentPeriod) {
    const currentStartD = new Date(startDate);
    const currentEndD = new Date(endDate);
    const periodDays = Math.ceil((currentEndD.getTime() - currentStartD.getTime()) / 86400000) + 1;
    const prevEndD = new Date(currentStartD);
    prevEndD.setDate(prevEndD.getDate() - 1);
    const prevStartD = new Date(prevEndD);
    prevStartD.setDate(prevStartD.getDate() - periodDays + 1);
    startDate = prevStartD.toISOString().split('T')[0];
    endDate = prevEndD.toISOString().split('T')[0];
  }

  return orders.filter(o => {
    const d = getOrderDate(o);
    return d >= startDate && d <= endDate;
  });
}

export function getAllDateGroups(records: any[], dateFields?: string[]): [string, any[]][] {
  const m: Record<string, any[]> = {};
  records.forEach(o => {
    let d: string;
    if (dateFields && dateFields.length > 0) {
      d = dateFields.reduce((found, f) => found || String(o[f] || '').split(' ')[0] || '', '');
    } else {
      d = getOrderDate(o);
    }
    if (d) (m[d] = m[d] || []).push(o);
  });
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}

export function changePct(cur: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function aggregateByGranularity(ords: any[], gran: TimeGranularity, fields: { income?: string; postage?: string; discount?: string | string[]; paid?: string; qty?: string; asCheck?: (o: any) => boolean; rfCheck?: (o: any) => boolean }): Record<string, any> {
  const m: Record<string, any> = {};
  ords.forEach(o => {
    const d = getOrderDate(o);
    if (!d) return;
    let key: string;
    if (gran === 'day') key = d;
    else if (gran === 'week') key = getWeekKey(d);
    else key = getMonthKey(d);
    if (!m[key]) m[key] = { cnt: 0, income: 0, postage: 0, discount: 0, paid: 0, qty: 0, asCnt: 0, rfCnt: 0 };
    m[key].cnt++;
    if (fields.income) m[key].income += safeFloat(o[fields.income]);
    if (fields.postage) m[key].postage += safeFloat(o[fields.postage]);
    if (fields.discount) {
      const discFields = Array.isArray(fields.discount) ? fields.discount : [fields.discount];
      discFields.forEach(f => { m[key].discount += safeFloat(o[f]); });
    }
    if (fields.paid) m[key].paid += safeFloat(o[fields.paid]);
    if (fields.qty) m[key].qty += safeFloat(o[fields.qty]);
    if (fields.asCheck && fields.asCheck(o)) m[key].asCnt++;
    if (fields.rfCheck && fields.rfCheck(o)) m[key].rfCnt++;
  });
  return m;
}

export default function TimeFilter({ state, compact }: { state: TimeFilterState & {
  setTimeRange: (r: TimeRange) => void;
  setGranularity: (g: TimeGranularity) => void;
  setCompareEnabled: (v: boolean) => void;
  setCustomRange?: (start: string, end: string) => void;
  setCompareRange?: (start: string, end: string) => void;
  setQuickRange?: (q: QuickRange) => void;
  savedRanges?: SavedRange[];
  saveCurrentRange?: (name: string) => void;
  deleteSavedRange?: (id: string) => void;
  applySavedRange?: (range: SavedRange) => void;
}; compact?: boolean }) {
  const { timeRange, granularity, compareEnabled, customStart, customEnd, compareStart, compareEnd, quickRange, setTimeRange, setGranularity, setCompareEnabled, setCustomRange, setCompareRange, setQuickRange, savedRanges, saveCurrentRange, deleteSavedRange, applySavedRange } = state;
  const [showCustom, setShowCustom] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [tempStart, setTempStart] = useState(customStart || '');
  const [tempEnd, setTempEnd] = useState(customEnd || '');
  const [tempCompareStart, setTempCompareStart] = useState(compareStart || '');
  const [tempCompareEnd, setTempCompareEnd] = useState(compareEnd || '');
  const containerRef = useRef<HTMLDivElement>(null);
  const customRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭弹窗
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showCustom && customRef.current && !customRef.current.contains(e.target as Node)) setShowCustom(false);
      if (showCompare && compareRef.current && !compareRef.current.contains(e.target as Node)) setShowCompare(false);
      if (showSaved && savedRef.current && !savedRef.current.contains(e.target as Node)) setShowSaved(false);
    };
    if (showCustom || showCompare || showSaved) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showCustom, showCompare, showSaved]);

  const rangeLabel = useMemo(() => {
    if (timeRange === 'custom' && quickRange) {
      const labels: Record<QuickRange, string> = { today: '今日', yesterday: '昨日', thisWeek: '本周', lastWeek: '上周', thisMonth: '本月', lastMonth: '上月', thisQuarter: '本季度', lastQuarter: '上季度', thisYear: '本年', lastYear: '去年' };
      return labels[quickRange];
    }
    if (timeRange === 'custom' && customStart && customEnd) return customStart === customEnd ? customStart : `${customStart} 至 ${customEnd}`;
    return timeRange === '7' ? '近7天' : timeRange === '30' ? '近30天' : timeRange === '90' ? '近90天' : timeRange === 'all' ? '全部' : '自定义';
  }, [timeRange, quickRange, customStart, customEnd]);

  const applyCustomRange = () => {
    if (setCustomRange && tempStart) {
      const end = tempEnd || tempStart; // 未填结束日期则默认单天
      setCustomRange(tempStart, end);
      setShowCustom(false);
    }
  };

  const applyCompareRange = () => {
    if (setCompareRange && tempCompareStart) {
      const end = tempCompareEnd || tempCompareStart; // 未填结束日期则默认单天
      setCompareRange(tempCompareStart, end);
      setShowCompare(false);
    }
  };

  const handleSave = () => {
    if (saveCurrentRange && saveName.trim()) {
      saveCurrentRange(saveName.trim());
      setSaveName('');
    }
  };

  return (
    <div ref={containerRef} className="flex items-center gap-2 flex-wrap relative">
      {/* Quick ranges */}
      <div className="flex items-center gap-1 bg-pdd-card rounded-lg px-1 py-0.5 border border-pdd-border">
        {(['7', '30', '90', 'all'] as TimeRange[]).map(r => (
          <button key={r} onClick={() => setTimeRange(r)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${timeRange === r && !quickRange ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
            {r === 'all' ? '全部' : `近${r}天`}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'custom' ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
          <Calendar size={12} />自定义
        </button>
      </div>

      {/* Quick select dropdown */}
      {showCustom && (
        <div ref={customRef} className="absolute z-50 top-full left-0 mt-1 bg-pdd-card border border-pdd-border rounded-lg shadow-[0_4px_12px_rgba(16,24,40,0.08)] p-2 min-w-[320px]">
          <div className="grid grid-cols-2 gap-1 mb-2">
            {(['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear'] as QuickRange[]).map(q => {
              const labels: Record<QuickRange, string> = { today: '今日', yesterday: '昨日', thisWeek: '本周', lastWeek: '上周', thisMonth: '本月', lastMonth: '上月', thisQuarter: '本季度', lastQuarter: '上季度', thisYear: '本年', lastYear: '去年' };
              return (
                <button key={q} onClick={() => { setQuickRange && setQuickRange(q); setShowCustom(false); }}
                  className={`px-2 py-1 rounded text-xs text-left ${quickRange === q ? 'bg-pdd-primary text-white' : 'hover:bg-pdd-bg text-pdd-text-secondary'}`}>
                  {labels[q]}
                </button>
              );
            })}
          </div>
          <div className="border-t border-pdd-gray-100 pt-2">
            <p className="text-xs text-pdd-text-secondary mb-1">自定义日期（仅选开始日期为单天）</p>
            <div className="flex items-center gap-1">
              <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} className="px-2 py-1 rounded border border-pdd-border text-xs w-28 text-pdd-text" />
              <span className="text-xs text-pdd-gray-400">至</span>
              <input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} placeholder="可选" className="px-2 py-1 rounded border border-pdd-border text-xs w-28 text-pdd-text" />
              <button onClick={applyCustomRange} className="px-2 py-1 bg-pdd-primary text-white rounded text-xs">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* Granularity */}
      {!compact && (
        <div className="flex items-center gap-1 bg-pdd-card rounded-lg px-1 py-0.5 border border-pdd-border">
          {(['day', 'week', 'month'] as TimeGranularity[]).map(g => (
            <button key={g} onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${granularity === g ? 'bg-pdd-primary text-white' : 'text-pdd-text-secondary hover:text-pdd-text'}`}>
              {g === 'day' ? '按日' : g === 'week' ? '按周' : '按月'}
            </button>
          ))}
        </div>
      )}

      {/* ★ 对比开关 — 选择对比时段，图表以虚线展示同期数据 */}
      <div className="relative group">
        <button onClick={() => setCompareEnabled(!compareEnabled)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${compareEnabled ? 'bg-pdd-gray-100 text-pdd-primary border-pdd-primary/30' : 'border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/30'}`}>
          <Clock size={12} />{compareEnabled ? '对比中' : '对比'}
        </button>
        {!compareEnabled && (
          <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block">
            <div className="bg-pdd-card border border-pdd-border rounded-lg px-2 py-1 shadow-lg whitespace-nowrap">
              <p className="text-[10px] text-pdd-text-secondary">开启后选择对比时段，图表以虚线展示同期数据</p>
            </div>
          </div>
        )}
      </div>

      {/* Compare range selector */}
      {compareEnabled && (
        <div className="relative">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowCompare(!showCompare)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-pdd-border hover:bg-pdd-bg">
              <ChevronDown size={12} />{compareStart && compareEnd ? `${compareStart.slice(5)}~${compareEnd.slice(5)}` : '选对比时段'}
            </button>
            <span className="text-[10px] text-pdd-text-secondary/60">虚线=对比</span>
          </div>
          {showCompare && (
            <div ref={compareRef} className="absolute z-50 top-full left-0 mt-1 bg-pdd-card border border-pdd-border rounded-lg shadow-[0_4px_12px_rgba(16,24,40,0.08)] p-2">
              <p className="text-xs text-pdd-text-secondary mb-1">选择要对比的日期范围（与主时段天数相同）</p>
              <div className="flex items-center gap-1">
                <input type="date" value={tempCompareStart} onChange={e => setTempCompareStart(e.target.value)} className="px-2 py-1 rounded border border-pdd-border text-xs w-28 text-pdd-text" />
                <span className="text-xs text-pdd-gray-400">至</span>
                <input type="date" value={tempCompareEnd} onChange={e => setTempCompareEnd(e.target.value)} placeholder="可选" className="px-2 py-1 rounded border border-pdd-border text-xs w-28 text-pdd-text" />
                <button onClick={applyCompareRange} className="px-2 py-1 bg-pdd-primary text-white rounded text-xs">确定</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved ranges */}
      {savedRanges && savedRanges.length > 0 && (
        <button onClick={() => setShowSaved(!showSaved)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-pdd-border hover:border-pdd-success text-pdd-text-secondary">
          <Save size={12} />已保存
        </button>
      )}

      {showSaved && savedRanges && (
        <div ref={savedRef} className="absolute z-50 top-full left-0 mt-1 bg-pdd-card border border-pdd-border rounded-lg shadow-[0_4px_12px_rgba(16,24,40,0.08)] p-2 min-w-[200px]">
          {savedRanges.map(r => (
            <div key={r.id} className="flex items-center justify-between py-1 hover:bg-pdd-bg rounded px-2">
              <button onClick={() => { applySavedRange && applySavedRange(r); setShowSaved(false); }} className="text-xs text-left flex-1 text-pdd-text-secondary">{r.name}</button>
              <button onClick={() => deleteSavedRange && deleteSavedRange(r.id)} className="text-pdd-gray-400 hover:text-pdd-danger"><X size={12} /></button>
            </div>
          ))}
          <div className="border-t border-pdd-gray-100 pt-2 mt-1">
            <div className="flex items-center gap-1">
              <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="保存当前范围" className="px-2 py-1 rounded border border-pdd-border text-xs flex-1 text-pdd-text" />
              <button onClick={handleSave} className="px-2 py-1 bg-pdd-success text-white rounded text-xs"><Save size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Current range display */}
      {!compact && <span className="text-xs text-pdd-text-secondary">{rangeLabel}</span>}
      {!compact && compareEnabled && <span className="text-xs text-pdd-primary">vs 对比</span>}
    </div>
  );
}

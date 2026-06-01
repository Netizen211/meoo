import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Clock, Save, X } from 'lucide-react';
import { findField } from '../utils/fieldAccess';

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
} {
  const [timeRange, setTimeRange] = useState<TimeRange>(defaultRange);
  const [granularity, setGranularity] = useState<TimeGranularity>(defaultGranularity);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');
  const [compareStart, setCompareStart] = useState<string>('');
  const [compareEnd, setCompareEnd] = useState<string>('');
  const [quickRange, setQuickRangeState] = useState<QuickRange | undefined>();
  const [savedRanges, setSavedRanges] = useState<SavedRange[]>(() => {
    const saved = localStorage.getItem('dianfx_saved_ranges');
    return saved ? JSON.parse(saved) : [];
  });

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
    localStorage.setItem('dianfx_saved_ranges', JSON.stringify(updated));
  };

  const deleteSavedRange = (id: string) => {
    const updated = savedRanges.filter(r => r.id !== id);
    setSavedRanges(updated);
    localStorage.setItem('dianfx_saved_ranges', JSON.stringify(updated));
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

export function filterByTimeRange(orders: any[], allDates: [string, any[]][], timeRange: TimeRange, customStart?: string, customEnd?: string, quickRange?: QuickRange): any[] {
  if (!allDates.length) return [];
  // "全部"选项：不进行时间过滤，返回所有数据
  if (timeRange === 'all') return orders;

  let startDate: string;
  let endDate: string;

  if (timeRange === 'custom' && quickRange) {
    const dates = getQuickRangeDates(quickRange);
    startDate = dates.start;
    endDate = dates.end;
  } else if (timeRange === 'custom' && customStart) {
    startDate = customStart;
    endDate = customEnd || customStart; // 单天选择
  } else {
    const lastDate = allDates[allDates.length - 1][0];
    const lastD = new Date(lastDate);
    const rangeDays = parseInt(timeRange);
    const cutoff = new Date(lastD);
    cutoff.setDate(cutoff.getDate() - rangeDays + 1);
    startDate = cutoff.toISOString().split('T')[0];
    endDate = lastDate;
  }

  return orders.filter(o => {
    const d = String(findField(o, '支付时间') || '').split(' ')[0];
    return d >= startDate && d <= endDate;
  });
}

// 按时间范围过滤推广/售后等带"日期"字段的数据
// 用记录自身的日期范围做时间锚点，而非订单日期（推广数据日期可能与订单不一致）
export function filterPromoByTimeRange(records: any[], allDates: [string, any[]][], timeRange: TimeRange, dateFields: string[] = ['日期', 'date'], customStart?: string, customEnd?: string, quickRange?: QuickRange): any[] {
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
    endDate = customEnd || customStart; // 单天选择
  } else if (timeRange === 'custom' || isNaN(parseInt(timeRange))) {
    return records;
  } else {
    // 从记录自身找最大日期作为锚点，回退到订单日期
    let maxDate = '';
    for (const r of records) {
      const d = String(findField(r, ...dateFields) || '').trim().replace(/\//g, '-');
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

  return records.filter(r => {
    let d = String(findField(r, ...dateFields) || '').trim();
    d = d.replace(/\//g, '-');
    return d >= startDate && d <= endDate;
  });
}

export function getCompareOrders(orders: any[], allDates: [string, any[]][], timeRange: TimeRange, compareStart?: string, compareEnd?: string, customStart?: string, customEnd?: string, quickRange?: QuickRange): any[] {
  if (!allDates.length) return [];

  if (compareStart && compareEnd) {
    return orders.filter(o => {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
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
    const d = String(findField(o, '支付时间') || '').split(' ')[0];
    return d >= startDate && d <= endDate;
  });
}

export function getAllDateGroups(orders: any[]): [string, any[]][] {
  const m: Record<string, any[]> = {};
  orders.forEach(o => { const d = String(findField(o, '支付时间') || '').split(' ')[0]; if (d) (m[d] = m[d] || []).push(o); });
  return Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
}

export function changePct(cur: number, prev: number): number | null {
  if (!prev || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export function aggregateByGranularity(ords: any[], gran: TimeGranularity, fields: { income?: string; postage?: string; discount?: string | string[]; paid?: string; qty?: string; asCheck?: (o: any) => boolean; rfCheck?: (o: any) => boolean }): Record<string, any> {
  const m: Record<string, any> = {};
  ords.forEach(o => {
    const d = String(findField(o, '支付时间') || '').split(' ')[0];
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
      <div className="flex items-center gap-1 bg-[var(--pdd-card)] rounded-lg px-1 py-0.5 border border-[var(--pdd-border)]">
        {(['7', '30', '90', 'all'] as TimeRange[]).map(r => (
          <button key={r} onClick={() => setTimeRange(r)}
            className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${timeRange === r && !quickRange ? 'bg-pdd-primary text-white' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
            {r === 'all' ? '全部' : `近${r}天`}
          </button>
        ))}
        <button onClick={() => setShowCustom(!showCustom)}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${timeRange === 'custom' ? 'bg-pdd-primary text-white' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
          <Calendar size={12} />自定义
        </button>
      </div>

      {/* Quick select dropdown */}
      {showCustom && (
        <div ref={customRef} className="absolute z-50 top-full left-0 mt-1 bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-lg shadow-lg p-2 min-w-[320px]">
          <div className="grid grid-cols-2 gap-1 mb-2">
            {(['today', 'yesterday', 'thisWeek', 'lastWeek', 'thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'thisYear', 'lastYear'] as QuickRange[]).map(q => {
              const labels: Record<QuickRange, string> = { today: '今日', yesterday: '昨日', thisWeek: '本周', lastWeek: '上周', thisMonth: '本月', lastMonth: '上月', thisQuarter: '本季度', lastQuarter: '上季度', thisYear: '本年', lastYear: '去年' };
              return (
                <button key={q} onClick={() => { setQuickRange && setQuickRange(q); setShowCustom(false); }}
                  className={`px-2 py-1 rounded text-xs text-left ${quickRange === q ? 'bg-pdd-primary text-white' : 'hover:bg-[var(--pdd-bg)]'}`}>
                  {labels[q]}
                </button>
              );
            })}
          </div>
          <div className="border-t border-[var(--pdd-border)] pt-2">
            <p className="text-xs text-[var(--pdd-text-secondary)] mb-1">自定义日期（仅选开始日期为单天）</p>
            <div className="flex items-center gap-1">
              <input type="date" value={tempStart} onChange={e => setTempStart(e.target.value)} className="px-2 py-1 rounded border border-[var(--pdd-border)] text-xs w-28" />
              <span className="text-xs text-[var(--pdd-text-muted)]">至</span>
              <input type="date" value={tempEnd} onChange={e => setTempEnd(e.target.value)} placeholder="可选" className="px-2 py-1 rounded border border-[var(--pdd-border)] text-xs w-28" />
              <button onClick={applyCustomRange} className="px-2 py-1 bg-pdd-primary text-white rounded text-xs">确定</button>
            </div>
          </div>
        </div>
      )}

      {/* Granularity */}
      {!compact && (
        <div className="flex items-center gap-1 bg-[var(--pdd-card)] rounded-lg px-1 py-0.5 border border-[var(--pdd-border)]">
          {(['day', 'week', 'month'] as TimeGranularity[]).map(g => (
            <button key={g} onClick={() => setGranularity(g)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${granularity === g ? 'bg-pdd-info text-white' : 'text-[var(--pdd-text-secondary)] hover:text-[var(--pdd-text)]'}`}>
              {g === 'day' ? '按日' : g === 'week' ? '按周' : '按月'}
            </button>
          ))}
        </div>
      )}

      {/* Compare toggle */}
      <button onClick={() => setCompareEnabled(!compareEnabled)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${compareEnabled ? 'bg-pdd-primary-light/20 border-pdd-primary text-pdd-primary' : 'border-[var(--pdd-border)] text-[var(--pdd-text-secondary)] hover:border-pdd-primary-light'}`}>
        <Clock size={12} />环比对比
      </button>

      {/* Compare range selector */}
      {compareEnabled && (
        <div className="relative">
          <button onClick={() => setShowCompare(!showCompare)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--pdd-border)] hover:border-pdd-primary-light">
            <ChevronDown size={12} />对比时段
          </button>
          {showCompare && (
            <div ref={compareRef} className="absolute z-50 top-full left-0 mt-1 bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-lg shadow-lg p-2">
              <p className="text-xs text-[var(--pdd-text-secondary)] mb-1">对比时段（仅选开始日期为单天）</p>
              <div className="flex items-center gap-1">
                <input type="date" value={tempCompareStart} onChange={e => setTempCompareStart(e.target.value)} className="px-2 py-1 rounded border border-[var(--pdd-border)] text-xs w-28" />
                <span className="text-xs text-[var(--pdd-text-muted)]">至</span>
                <input type="date" value={tempCompareEnd} onChange={e => setTempCompareEnd(e.target.value)} placeholder="可选" className="px-2 py-1 rounded border border-[var(--pdd-border)] text-xs w-28" />
                <button onClick={applyCompareRange} className="px-2 py-1 bg-pdd-primary-dark text-white rounded text-xs">确定</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Saved ranges */}
      {savedRanges && savedRanges.length > 0 && (
        <button onClick={() => setShowSaved(!showSaved)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-[var(--pdd-border)] hover:border-pdd-success">
          <Save size={12} />已保存
        </button>
      )}

      {showSaved && savedRanges && (
        <div ref={savedRef} className="absolute z-50 top-full left-0 mt-1 bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-lg shadow-lg p-2 min-w-[200px]">
          {savedRanges.map(r => (
            <div key={r.id} className="flex items-center justify-between py-1 hover:bg-[var(--pdd-bg)] rounded px-2">
              <button onClick={() => { applySavedRange && applySavedRange(r); setShowSaved(false); }} className="text-xs text-left flex-1">{r.name}</button>
              <button onClick={() => deleteSavedRange && deleteSavedRange(r.id)} className="text-[var(--pdd-text-secondary)] hover:text-pdd-danger"><X size={12} /></button>
            </div>
          ))}
          <div className="border-t border-[var(--pdd-border)] pt-2 mt-1">
            <div className="flex items-center gap-1">
              <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="保存当前范围" className="px-2 py-1 rounded border border-[var(--pdd-border)] text-xs flex-1" />
              <button onClick={handleSave} className="px-2 py-1 bg-pdd-success text-white rounded text-xs"><Save size={12} /></button>
            </div>
          </div>
        </div>
      )}

      {/* Current range display */}
      {!compact && <span className="text-xs text-[var(--pdd-text-secondary)]">{rangeLabel}</span>}
      {!compact && compareEnabled && <span className="text-xs text-pdd-primary-dark">vs 对比</span>}
    </div>
  );
}

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, TrendingUp, ArrowUp, ArrowDown, BarChart3, Target, X } from 'lucide-react';
import { ShoppingEvent, getEventsInRange, getEventById, getTagStyle, computeEventKpi, filterDataByEvent } from '../utils/eventsData';
import { KPI_LINES } from '../utils/trendData';
import { calcChange } from '../utils/trendTable';
import { safeFloat, findField } from '../utils';

interface Props {
  orders: any[];
  trendData: Record<string, any>[];
  compareEnabled: boolean;
}

// 对比用的核心 KPI
const COMPARE_KPIS = ['gmv', 'orderCount', 'avgPrice', 'paid', 'refundAmount', 'discount', 'asRate', 'rfRate', 'buyerCount', 'productCount', 'avgQty'];

export default function EventAnalysisPanel({ orders, trendData, compareEnabled }: Props) {
  const [compareMode, setCompareMode] = useState<'events' | 'yoy'>('events');
  const [eventAId, setEventAId] = useState<string>('');
  const [eventBId, setEventBId] = useState<string>('');
  const [yoyEventId, setYoyEventId] = useState<string>('');
  const [yoyYearA, setYoyYearA] = useState<number>(2026);
  const [yoyYearB, setYoyYearB] = useState<number>(2025);
  const [showComparison, setShowComparison] = useState(false);

  // 从订单数据自动检测日期范围
  const dataRange = useMemo(() => {
    if (!orders.length) return null;
    let minDate = '', maxDate = '';
    orders.forEach(o => {
      const d = String(findField(o, '支付时间') || '').split(' ')[0];
      if (!d || d.length < 10) return;
      if (!minDate || d < minDate) minDate = d;
      if (!maxDate || d > maxDate) maxDate = d;
    });
    return minDate && maxDate ? { from: minDate, to: maxDate } : null;
  }, [orders]);

  // 自动检测覆盖的活动
  const detectedEvents = useMemo(() => {
    if (!dataRange) return [];
    return getEventsInRange(dataRange.from, dataRange.to);
  }, [dataRange]);

  // 可选活动列表（用于下拉选择）
  const availableEvents = useMemo(() => {
    if (!dataRange) return [];
    // 扩展检测范围：前后各加15天以包含更大范围的活动选择
    const fromD = new Date(dataRange.from);
    fromD.setDate(fromD.getDate() - 15);
    const toD = new Date(dataRange.to);
    toD.setDate(toD.getDate() + 15);
    return getEventsInRange(fromD.toISOString().slice(0, 10), toD.toISOString().slice(0, 10));
  }, [dataRange]);

  // 计算单个活动的KPI汇总
  const computeKpi = (eventId: string): Record<string, any> | null => {
    const event = getEventById(eventId);
    if (!event || !orders.length) return null;
    return computeEventKpi(orders, event);
  };

  // 对比结果
  const comparisonResult = useMemo(() => {
    if (!showComparison) return null;

    let kpiA: Record<string, any> | null = null;
    let kpiB: Record<string, any> | null = null;
    let labelA = '';
    let labelB = '';

    if (compareMode === 'events' && eventAId && eventBId) {
      kpiA = computeKpi(eventAId);
      kpiB = computeKpi(eventBId);
      labelA = getEventById(eventAId)?.name || eventAId;
      labelB = getEventById(eventBId)?.name || eventBId;
    } else if (compareMode === 'yoy' && yoyEventId && yoyYearA && yoyYearB) {
      // 同比：同活动不同年份
      const baseEvent = getEventById(yoyEventId);
      if (baseEvent) {
        const idA = baseEvent.id.replace(/\d{4}/, String(yoyYearA));
        const idB = baseEvent.id.replace(/\d{4}/, String(yoyYearB));
        kpiA = computeKpi(idA);
        kpiB = computeKpi(idB);
        labelA = `${baseEvent.name.replace(/\d{4}/, '')}${yoyYearA}`;
        labelB = `${baseEvent.name.replace(/\d{4}/, '')}${yoyYearB}`;
      }
    }

    if (!kpiA || !kpiB) return null;

    return { kpiA, kpiB, labelA, labelB };
  }, [showComparison, compareMode, eventAId, eventBId, yoyEventId, yoyYearA, yoyYearB, orders]);

  if (!dataRange || !detectedEvents.length) {
    return (
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
        <h3 className="text-sm font-semibold text-[var(--pdd-text)] flex items-center gap-1.5 mb-2">
          <Calendar size={14} color="var(--pdd-primary)" />活动分析
        </h3>
        <p className="text-xs text-[var(--pdd-text-secondary)]">当前数据未覆盖已知电商活动期，请上传包含活动期间的订单数据</p>
      </div>
    );
  }

  // 按年份分组活动
  const eventsByYear: Record<number, ShoppingEvent[]> = {};
  detectedEvents.forEach(e => {
    if (!eventsByYear[e.year]) eventsByYear[e.year] = [];
    eventsByYear[e.year].push(e);
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-pdd-card rounded-xl border border-pdd-border p-4 space-y-3">
      {/* 标题 + 数据范围 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--pdd-text)] flex items-center gap-1.5">
          <Calendar size={14} color="var(--pdd-primary)" />活动分析
        </h3>
        <span className="text-xs text-[var(--pdd-text-muted)]">
          数据: {dataRange.from} ~ {dataRange.to}
        </span>
      </div>

      {/* 检测到的活动 */}
      <div>
        <div className="text-xs font-medium text-[var(--pdd-text-secondary)] mb-1.5">覆盖活动 ({detectedEvents.length})</div>
        <div className="flex flex-wrap gap-1.5">
          {detectedEvents.map(e => (
            <span key={e.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs cursor-pointer hover:opacity-80 transition-opacity border"
              style={{ background: getTagStyle(e.tags[0]).bg, borderColor: getTagStyle(e.tags[0]).color + '40', color: getTagStyle(e.tags[0]).color }}
              title={e.description}
            >
              {e.name}
              <span className="opacity-50">({e.dateStart.slice(5)}~{e.dateEnd.slice(5)})</span>
            </span>
          ))}
        </div>
        {/* 标签图例 */}
        <div className="flex flex-wrap gap-1 mt-1.5">
          {(['旺季', '淡季', '大促', '平台S级', '传统节日', '换季清仓'] as const).map(t => {
            const s = getTagStyle(t);
            return (
              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: s.bg, color: s.color }}>
                {t}
              </span>
            );
          })}
        </div>
      </div>

      {/* 对比模式选择 */}
      <div className="border-t border-[var(--pdd-border)] pt-3">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={() => { setCompareMode('events'); setShowComparison(false); }}
            className={`px-3 py-1 rounded text-xs transition-colors ${compareMode === 'events' ? 'bg-[var(--pdd-primary)] text-white' : 'bg-[var(--pdd-border)] text-[var(--pdd-text-secondary)]'}`}
          >活动对比</button>
          <button
            onClick={() => { setCompareMode('yoy'); setShowComparison(false); }}
            className={`px-3 py-1 rounded text-xs transition-colors ${compareMode === 'yoy' ? 'bg-[var(--pdd-primary)] text-white' : 'bg-[var(--pdd-border)] text-[var(--pdd-text-secondary)]'}`}
          >同比对比</button>
        </div>

        {compareMode === 'events' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={eventAId} onChange={e => { setEventAId(e.target.value); setShowComparison(false); }}
              className="text-xs bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-[var(--pdd-text)] min-w-[140px]">
              <option value="">选择活动A...</option>
              {availableEvents.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dateStart.slice(0,7)})</option>)}
            </select>
            <span className="text-xs text-[var(--pdd-text-muted)]">vs</span>
            <select value={eventBId} onChange={e => { setEventBId(e.target.value); setShowComparison(false); }}
              className="text-xs bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-[var(--pdd-text)] min-w-[140px]">
              <option value="">选择活动B...</option>
              {availableEvents.map(e => <option key={e.id} value={e.id}>{e.name} ({e.dateStart.slice(0,7)})</option>)}
            </select>
            <button
              onClick={() => setShowComparison(true)}
              disabled={!eventAId || !eventBId}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--pdd-primary)] text-white transition-colors disabled:opacity-40"
            ><BarChart3 size={13} />对比分析</button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <select value={yoyEventId} onChange={e => { setYoyEventId(e.target.value); setShowComparison(false); }}
              className="text-xs bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-[var(--pdd-text)] min-w-[140px]">
              <option value="">选择活动...</option>
              {detectedEvents.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <span className="text-xs text-[var(--pdd-text-muted)]">同比</span>
            <select value={yoyYearA} onChange={e => { setYoyYearA(Number(e.target.value)); setShowComparison(false); }}
              className="text-xs bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-[var(--pdd-text)]">
              {[2026, 2027, 2028].map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <span className="text-xs text-[var(--pdd-text-muted)]">vs</span>
            <select value={yoyYearB} onChange={e => { setYoyYearB(Number(e.target.value)); setShowComparison(false); }}
              className="text-xs bg-pdd-card border border-pdd-border rounded-lg px-2 py-1.5 text-[var(--pdd-text)]">
              {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}年</option>)}
            </select>
            <button
              onClick={() => setShowComparison(true)}
              disabled={!yoyEventId || yoyYearA === yoyYearB}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-[var(--pdd-primary)] text-white transition-colors disabled:opacity-40"
            ><TrendingUp size={13} />同比增长分析</button>
          </div>
        )}
      </div>

      {/* 对比结果表格 */}
      <AnimatePresence>
        {showComparison && comparisonResult && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="border-t border-[var(--pdd-border)] pt-3 overflow-hidden">
            <div className="text-xs font-medium text-[var(--pdd-text-secondary)] mb-2">
              {comparisonResult.labelA} vs {comparisonResult.labelB}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-[var(--pdd-border)]">
                    <th className="text-left py-1.5 px-2 text-[var(--pdd-text-secondary)] font-medium">指标</th>
                    <th className="text-right py-1.5 px-2 font-medium" style={{ color: 'var(--pdd-primary)' }}>{comparisonResult.labelA}</th>
                    <th className="text-right py-1.5 px-2 font-medium" style={{ color: 'var(--pdd-warning)' }}>{comparisonResult.labelB}</th>
                    <th className="text-right py-1.5 px-2 text-[var(--pdd-text-secondary)] font-medium">变化</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_KPIS.map(key => {
                    const line = KPI_LINES.find(l => l.key === key);
                    if (!line) return null;
                    const valA = comparisonResult.kpiA?.[key];
                    const valB = comparisonResult.kpiB?.[key];
                    if (valA == null && valB == null) return null;
                    const change = calcChange(valA ?? 0, valB ?? 0);
                    const fmtVal = (v: number | null | undefined) => {
                      if (v == null) return '--';
                      if (line.type === 'percent') return v.toFixed(2) + '%';
                      if (key === 'gmv' || key === 'paid' || key === 'refundAmount' || key === 'discount') return '¥' + v.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
                      if (key === 'orderCount' || key === 'buyerCount' || key === 'productCount') return v.toLocaleString('zh-CN');
                      if (key === 'avgPrice') return '¥' + v.toFixed(2);
                      if (key === 'avgQty') return v.toFixed(1);
                      return v.toFixed(2);
                    };
                    return (
                      <tr key={key} className="border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg-hover)]">
                        <td className="py-1.5 px-2 text-[var(--pdd-text)]">
                          <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: line.color }} />
                          {line.label}
                        </td>
                        <td className="py-1.5 px-2 text-right font-medium text-[var(--pdd-text)]">{fmtVal(valA)}</td>
                        <td className="py-1.5 px-2 text-right font-medium text-[var(--pdd-text)]">{fmtVal(valB)}</td>
                        <td className="py-1.5 px-2 text-right">
                          <span className={`inline-flex items-center gap-0.5 ${change.dir === 'up' ? 'text-[var(--pdd-success)]' : change.dir === 'down' ? 'text-[var(--pdd-danger)]' : 'text-[var(--pdd-text-muted)]'}`}>
                            {change.dir === 'up' ? <ArrowUp size={10} /> : change.dir === 'down' ? <ArrowDown size={10} /> : null}
                            {change.dir === 'flat' ? '--' : change.pct.toFixed(1) + '%'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

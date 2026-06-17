/**
 * 分析控制栏 — 面包屑导航 + 时间筛选 + 对比模式
 */
import React, { useState } from 'react';
import { Clock, ChevronRight, Filter, RotateCcw, X, ArrowLeft } from 'lucide-react';
import { useAnalysis, type TimeFilter } from '../../context/analysisContext';

const TIME_PRESETS: { key: TimeFilter['preset']; label: string; days: number }[] = [
  { key: '7d', label: '7天', days: 7 },
  { key: '30d', label: '30天', days: 30 },
  { key: 'thisWeek', label: '本周', days: 0 },
  { key: 'thisMonth', label: '本月', days: 0 },
  { key: 'lastMonth', label: '上月', days: 0 },
  { key: 'all', label: '全部', days: 0 },
];

function toLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getNaturalRange(preset: string): { start: string; end: string } {
  const now = new Date();
  if (preset === 'thisWeek') {
    const day = now.getDay() || 7;
    const mon = new Date(now); mon.setDate(now.getDate() - day + 1);
    return { start: toLocal(mon), end: toLocal(now) };
  }
  if (preset === 'thisMonth') {
    return { start: toLocal(new Date(now.getFullYear(), now.getMonth(), 1)), end: toLocal(now) };
  }
  if (preset === 'lastMonth') {
    return { start: toLocal(new Date(now.getFullYear(), now.getMonth()-1, 1)), end: toLocal(new Date(now.getFullYear(), now.getMonth(), 0)) };
  }
  return { start: '', end: '' };
}

const COMPARE_OPTIONS: { key: 'storeAvg' | 'prevPeriod' | 'none'; label: string }[] = [
  { key: 'storeAvg', label: 'vs 店铺均值' },
  { key: 'prevPeriod', label: 'vs 上周期' },
  { key: 'none', label: '独立查看' },
];

export default function AnalysisControlBar() {
  const {
    breadcrumbs, scopeLabel, timeLabel, timeFilter,
    drillUp, selectProduct, setTimeFilter,
    comparisonMode, setComparisonMode, resetAll,
  } = useAnalysis();
  const [showCustom, setShowCustom] = useState(false);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handlePreset = (preset: TimeFilter['preset']) => {
    if (!preset || preset === 'custom') { setShowCustom(true); return; }
    let start: string, end: string;
    if (preset === 'thisWeek' || preset === 'thisMonth' || preset === 'lastMonth') {
      const r = getNaturalRange(preset); start = r.start; end = r.end;
    } else {
      const now = new Date();
      const days = TIME_PRESETS.find(p => p.key === preset)?.days || 30;
      end = toLocal(now);
      start = days > 0 ? toLocal(new Date(now.getTime() - days * 86400000)) : '2020-01-01';
    }
    setTimeFilter({ mode: 'single', rangeA: { start, end }, preset });
  };

  const handleCustom = () => {
    if (customStart && customEnd) {
      setTimeFilter({ mode: 'single', rangeA: { start: customStart, end: customEnd }, preset: 'custom' });
      setShowCustom(false);
    }
  };

  return (
    <div className="space-y-2 mb-4">
      {/* 面包屑 */}
      <div className="flex items-center gap-1 text-xs text-pdd-text-secondary flex-wrap">
        {breadcrumbs.map((crumb, i) => (
          <React.Fragment key={i}>
            {i > 0 && <ChevronRight size={12} className="text-pdd-text-secondary/50" />}
            {i < breadcrumbs.length - 1 ? (
              <button onClick={drillUp} className="hover:text-pdd-primary transition-colors flex items-center gap-1">
                <ArrowLeft size={10} />
                {crumb.label}
              </button>
            ) : (
              <span className="text-pdd-text font-medium">{crumb.label}</span>
            )}
          </React.Fragment>
        ))}
        <span className="ml-2 px-1.5 py-0.5 rounded bg-pdd-bg text-[10px]">{timeLabel}</span>
      </div>

      {/* 控制条 */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          {/* 时间预设 */}
          {TIME_PRESETS.map(p => (
            <button
              key={p.key}
              onClick={() => handlePreset(p.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                timeFilter.preset === p.key ? 'bg-pdd-primary text-white' : 'bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text'
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
              timeFilter.preset === 'custom' ? 'bg-pdd-primary text-white' : 'bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text'
            }`}
          >
            <Clock size={12} /> 自定义
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {/* 对比模式 */}
          {COMPARE_OPTIONS.map(o => (
            <button
              key={o.key}
              onClick={() => setComparisonMode(o.key)}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                comparisonMode === o.key ? 'bg-pdd-primary/10 text-pdd-primary border border-pdd-primary/20' : 'bg-pdd-bg text-pdd-text-secondary hover:text-pdd-text'
              }`}
            >
              {o.label}
            </button>
          ))}
          <button onClick={resetAll} className="p-1.5 text-pdd-text-secondary hover:text-pdd-text rounded" title="重置全部">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 自定义日期 */}
      {showCustom && (
        <div className="flex items-center gap-2 p-2 bg-pdd-bg rounded-lg">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="text-xs px-2 py-1 border border-pdd-border rounded bg-pdd-card text-pdd-text" />
          <span className="text-xs text-pdd-text-secondary">至</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="text-xs px-2 py-1 border border-pdd-border rounded bg-pdd-card text-pdd-text" />
          <button onClick={handleCustom} className="px-3 py-1 text-xs bg-pdd-primary text-white rounded">确定</button>
          <button onClick={() => setShowCustom(false)} className="p-1 text-pdd-text-secondary"><X size={14} /></button>
        </div>
      )}
    </div>
  );
}

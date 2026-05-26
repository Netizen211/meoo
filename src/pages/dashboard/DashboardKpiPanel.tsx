import React from 'react';
import { motion } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { ArrowUp, ArrowDown, TrendingUp } from 'lucide-react';
import { KPI_LINES, ChartTooltip } from '../../utils/trendData';

const cv = { hidden: { opacity: 0, y: 20 }, visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.06 } }) };

interface KpiCardItem {
  label: string;
  value: number | undefined;
  fmt: (v: number) => string;
  icon: any;
  color: string;
  change: number | null;
}

interface Props {
  kpiCards: KpiCardItem[];
  allKpiCards: KpiCardItem[];
  visibleKpis: Set<string>;
  setVisibleKpis: (s: Set<string>) => void;
  showKpiSelector: boolean;
  setShowKpiSelector: (v: boolean) => void;
  filteredOrders: any[];
  noData: boolean;
  draggedPanel: string | null;
  onDragStart: (p: string) => void;
  onDragOver: (e: React.DragEvent, p: string) => void;
  onDragEnd: () => void;
  onCardClick: (label: string) => void;
  onDetailClick?: (label: string) => void;
  onCardReorder?: (newOrder: KpiCardItem[]) => void;
  // 折线图相关
  dailyKpiData: Record<string, any>[];
  compareData: Record<string, any>[];
  selectedTrendKpis: Set<string>;
  rangeLabel: string;
  compareEnabled: boolean;
}

export default function DashboardKpiPanel({
  kpiCards, allKpiCards, visibleKpis, setVisibleKpis, showKpiSelector, setShowKpiSelector,
  filteredOrders, noData,
  draggedPanel, onDragStart, onDragOver, onDragEnd, onCardClick, onDetailClick, onCardReorder,
  dailyKpiData, compareData, selectedTrendKpis, rangeLabel, compareEnabled
}: Props) {
  const [draggedCard, setDraggedCard] = React.useState<string | null>(null);
  const [dragOrder, setDragOrder] = React.useState<KpiCardItem[] | null>(null);
  const displayCards = dragOrder || kpiCards;

  return (
    <motion.div key="kpi" layoutId="kpi" draggable onDragStart={() => onDragStart('kpi')} onDragOver={e => onDragOver(e, 'kpi')} onDragEnd={onDragEnd}
      className={`cursor-move transition-all ${draggedPanel === 'kpi' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2" />
      {showKpiSelector && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-pdd-card rounded-xl border border-pdd-border p-3 mb-2">
          <div>
            <div className="text-xs font-medium text-pdd-text-secondary mb-2">指标显示</div>
            <div className="grid grid-cols-4 gap-1">
              {allKpiCards.map(k => (
                <label key={k.label} className="flex items-center gap-1 text-xs cursor-pointer hover:bg-pdd-bg-hover px-2 py-1 rounded-lg">
                  <input type="checkbox" checked={visibleKpis.has(k.label)} onChange={() => {
                    const newSet = new Set(visibleKpis);
                    if (newSet.has(k.label)) newSet.delete(k.label); else newSet.add(k.label);
                    setVisibleKpis(newSet);
                  }} className="w-3 h-3" />
                  <span style={{ color: k.color }}>{k.label}</span>
                </label>
              ))}
            </div>
          </div>
        </motion.div>
      )}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {displayCards.map((c, i) => (
            <motion.div
              key={c.label}
              custom={i}
              variants={cv}
              initial="hidden"
              animate="visible"
              draggable
              onDragStart={() => { setDraggedCard(c.label); setDragOrder([...displayCards]); }}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedCard && draggedCard !== c.label) {
                  setDragOrder(prev => {
                    if (!prev) return null;
                    const fromIndex = prev.findIndex(card => card.label === draggedCard);
                    const toIndex = prev.findIndex(card => card.label === c.label);
                    if (fromIndex === -1 || toIndex === -1) return prev;
                    const newCards = [...prev];
                    const [movedCard] = newCards.splice(fromIndex, 1);
                    newCards.splice(toIndex, 0, movedCard);
                    return newCards;
                  });
                }
              }}
              onDragEnd={() => {
                if (dragOrder && onCardReorder) onCardReorder(dragOrder);
                setDraggedCard(null);
                setDragOrder(null);
              }}
              onClick={() => onCardClick(c.label)}
              className={`bg-pdd-card rounded-xl border border-pdd-border px-3 py-2 flex items-center gap-2 cursor-pointer hover:border-pdd-primary/30 transition-all relative ${draggedCard === c.label ? 'opacity-50 scale-95' : ''}`}>
              <c.icon size={14} color={c.color} />
              <div className="flex-1 min-w-0">
                <span className="text-xs text-pdd-text-secondary">{c.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-pdd-text">{noData ? '--' : c.value != null ? c.fmt(c.value) : '--'}</span>
                  {c.change != null && Math.abs(c.change) > 0.01 && (
                    <span className={`text-xs ${c.change > 0 ? 'text-pdd-success' : 'text-pdd-danger'}`}>{c.change > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(c.change).toFixed(1)}%</span>
                  )}
                </div>
              </div>
              {onDetailClick && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDetailClick(c.label); }}
                  className="absolute top-0.5 right-0.5 px-1 py-0.5 rounded text-[10px] text-pdd-text-secondary hover:text-pdd-primary hover:bg-pdd-primary/10 transition-colors"
                  title="查看详情"
                >详情</button>
              )}
            </motion.div>
          ))}
      </div>

      {/* KPI趋势图 */}
      {dailyKpiData.length > 0 && (() => {
        const hasPercentKpi = [...selectedTrendKpis].some(k => KPI_LINES.find(l => l.key === k)?.type === 'percent');
        const selectedLines = KPI_LINES.filter(l => selectedTrendKpis.has(l.key));
        const chartData = (() => {
          if (!compareEnabled || !compareData.length) return dailyKpiData;
          const cmpMap: Record<string, any> = {};
          compareData.forEach((d: any) => { cmpMap[d._fullDate || d.date] = d; });
          return dailyKpiData.map((d: any) => {
            const cmp = cmpMap[d._fullDate || d.date];
            if (!cmp) return d;
            const merged = { ...d };
            Object.keys(cmp).forEach(k => {
              if (k !== 'date' && k !== '_fullDate') merged[k + '_prev'] = cmp[k];
            });
            return merged;
          });
        })();
        return (
          <div className="mt-3 bg-pdd-card rounded-xl border border-pdd-border p-3">
            <h3 className="text-sm font-semibold text-pdd-text flex items-center gap-1.5 mb-2">
              <TrendingUp size={14} color="var(--pdd-primary)" />指标趋势({rangeLabel})
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
                <YAxis yAxisId="value" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
                {hasPercentKpi && <YAxis yAxisId="percent" orientation="right" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} unit="%" />}
                <Tooltip content={<ChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '6px' }} />
                {selectedLines.map(l => (
                  <Line key={l.key} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key} name={l.label} stroke={l.color} strokeWidth={2} dot={{ r: 2, fill: l.color }} activeDot={{ r: 4 }} />
                ))}
                {compareEnabled && selectedLines.map(l => (
                  <Line key={l.key + '_prev'} yAxisId={l.type === 'percent' ? 'percent' : 'value'} type="monotone" dataKey={l.key + '_prev'} name={l.label + '(上期)'} stroke={l.color} strokeWidth={1.5} strokeDasharray="5 3" dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}
    </motion.div>
  );
}

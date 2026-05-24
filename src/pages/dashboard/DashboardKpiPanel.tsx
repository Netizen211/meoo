import React from 'react';
import { motion } from 'framer-motion';
import { Settings, Move, ArrowUp, ArrowDown } from 'lucide-react';
import AmountFilterPanel, { DEFAULT_AMOUNT_FIELDS, FilterValues } from '../../components/AmountFilterPanel';
import { safeFloat } from '../../components/TimeFilter';

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
  amountFilters: FilterValues;
  setAmountFilters: (v: FilterValues) => void;
  filteredOrders: any[];
  noData: boolean;
  draggedPanel: string | null;
  onDragStart: (p: string) => void;
  onDragOver: (e: React.DragEvent, p: string) => void;
  onDragEnd: () => void;
  onCardClick: (label: string, data: any[], columns: { key: string; label: string }[]) => void;
  onCardReorder?: (newOrder: KpiCardItem[]) => void;
}

export default function DashboardKpiPanel({
  kpiCards, allKpiCards, visibleKpis, setVisibleKpis, showKpiSelector, setShowKpiSelector,
  amountFilters, setAmountFilters, filteredOrders, noData,
  draggedPanel, onDragStart, onDragOver, onDragEnd, onCardClick, onCardReorder
}: Props) {
  const [draggedCard, setDraggedCard] = React.useState<string | null>(null);
  const getFilteredData = (label: string) => {
    const baseColumns = [
      { key: '订单号', label: '订单号' },
      { key: '商品', label: '商品名称' },
      { key: '商家实收金额(元)', label: '商家实收' },
      { key: '支付时间', label: '支付时间' },
      { key: '订单状态', label: '订单状态' },
      { key: '省', label: '省份' },
    ];
    switch (label) {
      case '商家实收GMV':
        return { data: filteredOrders.filter(o => parseFloat(o['商家实收金额(元)'] || 0) > 0), columns: baseColumns };
      case '有效订单量':
        return { data: filteredOrders.filter(o => o['订单状态'] && !o['订单状态'].includes('取消') && !o['订单状态'].includes('关闭')), columns: baseColumns };
      case '客单价':
        return { data: filteredOrders.filter(o => parseFloat(o['商家实收金额(元)'] || 0) > 0), columns: baseColumns };
      case '售后率':
        return { data: filteredOrders.filter(o => o['订单状态'] && (o['订单状态'].includes('售后') || o['订单状态'].includes('退款'))), columns: baseColumns };
      case '退款率':
        return { data: filteredOrders.filter(o => o['订单状态'] && o['订单状态'].includes('退款')), columns: baseColumns };
      case '邮费总额':
        return { data: filteredOrders.filter(o => parseFloat(o['邮费(元)'] || 0) > 0), columns: [...baseColumns, { key: '邮费(元)', label: '邮费' }] };
      case '买家数':
        return { data: filteredOrders, columns: [...baseColumns, { key: '买家ID', label: '买家ID' }] };
      case '商品数':
        return { data: filteredOrders.filter(o => safeFloat(o['商品数量']) > 0), columns: [...baseColumns, { key: '商品数量', label: '数量' }] };
      case '退款金额':
        return { data: filteredOrders.filter(o => String(o['售后状态'] || '').includes('退款')), columns: baseColumns };
      case '优惠总额':
        return { data: filteredOrders.filter(o => safeFloat(o['店铺优惠折扣(元)']) + safeFloat(o['平台优惠折扣(元)']) > 0), columns: [...baseColumns, { key: '店铺优惠折扣(元)', label: '店铺优惠' }, { key: '平台优惠折扣(元)', label: '平台优惠' }] };
      case '发货率':
        return { data: filteredOrders.filter(o => String(o['发货时间'] || '').trim() !== ''), columns: [...baseColumns, { key: '发货时间', label: '发货时间' }] };
      case '平均发货时长':
        return { data: filteredOrders.filter(o => String(o['发货时间'] || '').trim() !== ''), columns: [...baseColumns, { key: '发货时间', label: '发货时间' }] };
      case '用户实付':
        return { data: filteredOrders.filter(o => parseFloat(o['用户实付金额(元)'] || 0) > 0), columns: [...baseColumns, { key: '用户实付金额(元)', label: '用户实付' }] };
      default:
        return { data: filteredOrders, columns: baseColumns };
    }
  };

  return (
    <motion.div key="kpi" layoutId="kpi" draggable onDragStart={() => onDragStart('kpi')} onDragOver={e => onDragOver(e, 'kpi')} onDragEnd={onDragEnd}
      className={`cursor-move transition-all ${draggedPanel === 'kpi' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pdd-text">核心指标</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowKpiSelector(!showKpiSelector)} className="text-xs text-pdd-primary-light hover:text-indigo-300 flex items-center gap-1">
            <Settings size={12} /> 选择指标
          </button>
          <Move size={14} className="text-pdd-text-secondary" />
        </div>
      </div>
      {showKpiSelector && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="bg-pdd-card rounded-xl border border-pdd-border p-3 mb-2">
          <div className="mb-3 pb-2 border-b border-pdd-border">
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
      <AmountFilterPanel fields={DEFAULT_AMOUNT_FIELDS} filters={amountFilters} onFiltersChange={setAmountFilters} />
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {kpiCards.map((c, i) => {
          const filtered = getFilteredData(c.label);
          return (
            <motion.div
              key={c.label}
              custom={i}
              variants={cv}
              initial="hidden"
              animate="visible"
              draggable
              onDragStart={() => setDraggedCard(c.label)}
              onDragOver={(e) => {
                e.preventDefault();
                if (draggedCard && draggedCard !== c.label && onCardReorder) {
                  const newCards = [...kpiCards];
                  const fromIndex = newCards.findIndex(card => card.label === draggedCard);
                  const toIndex = newCards.findIndex(card => card.label === c.label);
                  if (fromIndex !== -1 && toIndex !== -1) {
                    const [movedCard] = newCards.splice(fromIndex, 1);
                    newCards.splice(toIndex, 0, movedCard);
                    onCardReorder(newCards);
                  }
                }
              }}
              onDragEnd={() => setDraggedCard(null)}
              onClick={() => onCardClick(c.label, filtered.data, filtered.columns)}
              className={`bg-pdd-card rounded-xl border border-pdd-border px-3 py-2 flex items-center gap-2 cursor-move hover:border-pdd-border transition-all ${draggedCard === c.label ? 'opacity-50 scale-95' : ''}`}>
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
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

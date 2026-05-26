import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';

export interface FilterField {
  key: string;
  label: string;
  hint?: string;
  group: 'basic' | 'discount' | 'cost' | 'quantity';
  compute: (order: any) => number;
  filterLogic?: 'exclude_refund' | 'only_refund' | 'normal';
}

export interface FilterValues {
  [key: string]: { min: string; max: string };
}

const GROUP_LABELS: Record<string, string> = {
  basic: '基础金额',
  discount: '优惠相关',
  cost: '成本利润',
  quantity: '数量比率',
};

const GROUP_ORDER = ['basic', 'discount', 'cost', 'quantity'];

export const DEFAULT_AMOUNT_FIELDS: FilterField[] = [
  { key: 'actualPay', label: '买家实付金额', hint: '用户实付', group: 'basic', compute: (o) => parseFloat(String(o['用户实付金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'actualReceiveAll', label: '商家实收(含退款)', hint: '含退款订单', group: 'basic', compute: (o) => parseFloat(String(o['商家实收金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'actualReceive', label: '实收金额(剔除退款)', hint: '仅非退款', group: 'basic', compute: (o) => parseFloat(String(o['商家实收金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0, filterLogic: 'exclude_refund' },
  { key: 'refundAmount', label: '买家退款金额', hint: '仅退款单', group: 'basic', compute: (o) => parseFloat(String(o['用户实付金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0, filterLogic: 'only_refund' },
  { key: 'productTotal', label: '商品总价', hint: '含邮费', group: 'basic', compute: (o) => parseFloat(String(o['商品总价(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'postage', label: '邮费金额', group: 'basic', compute: (o) => parseFloat(String(o['邮费(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'discountTotal', label: '优惠总额', hint: '三项合计', group: 'discount', compute: (o) => (parseFloat(String(o['店铺优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) + (parseFloat(String(o['平台优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) + (parseFloat(String(o['多多支付立减金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) },
  { key: 'shopDiscount', label: '店铺优惠折扣', group: 'discount', compute: (o) => parseFloat(String(o['店铺优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'platDiscount', label: '平台优惠折扣', group: 'discount', compute: (o) => parseFloat(String(o['平台优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'duoduoDiscount', label: '多多支付立减', group: 'discount', compute: (o) => parseFloat(String(o['多多支付立减金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'discountRate', label: '优惠率', hint: '%', group: 'discount', compute: (o) => { const pt = parseFloat(String(o['商品总价(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0; if (!pt) return 0; const disc = (parseFloat(String(o['店铺优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) + (parseFloat(String(o['平台优惠折扣(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) + (parseFloat(String(o['多多支付立减金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0); return (disc / pt) * 100; } },
  { key: 'productCost', label: '商品成本', hint: '30%售价', group: 'cost', compute: (o) => (parseFloat(String(o['商品总价(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) * 0.3 },
  { key: 'profit', label: '利润金额', hint: '实收-成本-邮费', group: 'cost', compute: (o) => (parseFloat(String(o['商家实收金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) - (parseFloat(String(o['商品总价(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) * 0.3 - (parseFloat(String(o['邮费(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) },
  { key: 'recvRate', label: '实收率', hint: '%', group: 'cost', compute: (o) => { const pt = parseFloat(String(o['商品总价(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0; if (!pt) return 0; return ((parseFloat(String(o['商家实收金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) / pt) * 100; } },
  { key: 'productQty', label: '商品数量', hint: '件', group: 'quantity', compute: (o) => parseFloat(String(o['商品数量(件)'] || o['商品数量'] || '0').replace(/[^\d.\-]/g, '')) || 0 },
  { key: 'unitPrice', label: '客单价', hint: '实付/件数', group: 'quantity', compute: (o) => { const qty = parseFloat(String(o['商品数量(件)'] || o['商品数量'] || '0').replace(/[^\d.\-]/g, '')) || 0; if (!qty) return 0; return (parseFloat(String(o['用户实付金额(元)'] || '0').replace(/[^\d.\-]/g, '')) || 0) / qty; } },
];

export function createEmptyFilters(fields: FilterField[]): FilterValues {
  const f: FilterValues = {};
  fields.forEach(fd => { f[fd.key] = { min: '', max: '' }; });
  return f;
}

export function applyAmountFilters(orders: any[], fields: FilterField[], filters: FilterValues): any[] {
  let result = orders;
  fields.forEach(fd => {
    const fv = filters[fd.key];
    if (!fv || (!fv.min && !fv.max)) return;
    const minVal = fv.min ? parseFloat(fv.min) : null;
    const maxVal = fv.max ? parseFloat(fv.max) : null;
    if (minVal === null && maxVal === null) return;
    if (fd.filterLogic === 'exclude_refund') {
      result = result.filter(o => {
        const isRefund = String(o['售后状态'] || '').includes('退款');
        if (isRefund) return false;
        const val = fd.compute(o);
        if (minVal !== null && val < minVal) return false;
        if (maxVal !== null && val > maxVal) return false;
        return true;
      });
    } else if (fd.filterLogic === 'only_refund') {
      result = result.filter(o => {
        const isRefund = String(o['售后状态'] || '').includes('退款');
        if (!isRefund) return false;
        const val = fd.compute(o);
        if (minVal !== null && val < minVal) return false;
        if (maxVal !== null && val > maxVal) return false;
        return true;
      });
    } else {
      result = result.filter(o => {
        const val = fd.compute(o);
        if (minVal !== null && val < minVal) return false;
        if (maxVal !== null && val > maxVal) return false;
        return true;
      });
    }
  });
  return result;
}

export function getActiveFilterCount(filters: FilterValues): number {
  return Object.values(filters).filter(f => f.min || f.max).length;
}

export function getActiveFilterTags(fields: FilterField[], filters: FilterValues): { key: string; label: string; display: string }[] {
  const tags: { key: string; label: string; display: string }[] = [];
  fields.forEach(fd => {
    const fv = filters[fd.key];
    if (!fv || (!fv.min && !fv.max)) return;
    let display = '';
    if (fv.min && fv.max) display = `${fv.min}~${fv.max}`;
    else if (fv.min) display = `≥${fv.min}`;
    else display = `≤${fv.max}`;
    tags.push({ key: fd.key, label: fd.label, display });
  });
  return tags;
}

interface AmountFilterPanelProps {
  fields: FilterField[];
  filters: FilterValues;
  onFiltersChange: (filters: FilterValues) => void;
  compact?: boolean;
}

export default function AmountFilterPanel({ fields, filters, onFiltersChange, compact }: AmountFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeCount = getActiveFilterCount(filters);
  const activeTags = getActiveFilterTags(fields, filters);

  const updateFilter = (key: string, field: 'min' | 'max', value: string) => {
    const newFilters = { ...filters, [key]: { ...filters[key], [field]: value } };
    onFiltersChange(newFilters);
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters, [key]: { min: '', max: '' } };
    onFiltersChange(newFilters);
  };

  const clearAll = () => {
    const newFilters = createEmptyFilters(fields);
    onFiltersChange(newFilters);
  };

  const groupedFields: Record<string, FilterField[]> = {};
  fields.forEach(fd => {
    if (!groupedFields[fd.group]) groupedFields[fd.group] = [];
    groupedFields[fd.group].push(fd);
  });

  return (
    <div className="bg-[var(--pdd-card)] rounded-lg border border-[var(--pdd-border)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--pdd-border)]">
        <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-2 text-xs font-medium hover:text-pdd-primary transition-colors">
          <Filter size={14} />
          <span>金额筛选</span>
          {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 bg-pdd-primary text-white text-[10px] rounded-full leading-none">{activeCount}</span>
          )}
        </button>
        <div className="flex items-center gap-2">
          {activeCount > 0 && (
            <button onClick={clearAll} className="flex items-center gap-1 text-[10px] text-pdd-primary hover:underline">
              <RotateCcw size={10} />清除全部
            </button>
          )}
        </div>
      </div>

      {activeTags.length > 0 && (
        <div className="px-3 py-1.5 bg-[var(--pdd-bg)] flex items-center gap-1.5 flex-wrap">
          {activeTags.map(tag => (
            <span key={tag.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pdd-card border border-[var(--pdd-border)] rounded text-[10px]">
              <span className="text-pdd-primary font-medium">{tag.label}</span>
              <span className="text-[var(--pdd-text-secondary)]">{tag.display}</span>
              <button onClick={() => clearFilter(tag.key)} className="hover:text-pdd-primary"><X size={10} /></button>
            </span>
          ))}
        </div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 space-y-3">
              {GROUP_ORDER.filter(g => groupedFields[g]).map(group => (
                <div key={group}>
                  <div className="text-[10px] text-[var(--pdd-text-secondary)] font-medium uppercase tracking-wider mb-1.5">{GROUP_LABELS[group]}</div>
                  <div className={`grid ${compact ? 'grid-cols-3' : 'grid-cols-4'} gap-2`}>
                    {groupedFields[group].map(fd => (
                      <div key={fd.key} className="space-y-0.5">
                        <label className="text-[10px] text-[var(--pdd-text-secondary)] flex items-center gap-1">
                          {fd.label}
                          {fd.hint && <span className="text-[9px] text-pdd-text-secondary/70">({fd.hint})</span>}
                        </label>
                        <div className="flex gap-1">
                          <input
                            type="number"
                            placeholder="最小"
                            value={filters[fd.key]?.min || ''}
                            onChange={e => updateFilter(fd.key, 'min', e.target.value)}
                            className="w-1/2 px-1.5 py-1 text-[11px] border border-[var(--pdd-border)] rounded bg-pdd-card focus:border-pdd-primary focus:outline-none"
                          />
                          <input
                            type="number"
                            placeholder="最大"
                            value={filters[fd.key]?.max || ''}
                            onChange={e => updateFilter(fd.key, 'max', e.target.value)}
                            className="w-1/2 px-1.5 py-1 text-[11px] border border-[var(--pdd-border)] rounded bg-pdd-card focus:border-pdd-primary focus:outline-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

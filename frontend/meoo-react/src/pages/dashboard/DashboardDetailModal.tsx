import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpDown, TrendingUp } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  data: any[];
  columns?: { key: string; label: string }[];
  onClose: () => void;
}

/* ── helpers ── */
const isMoney = (k: string, label?: string) =>
  /^(金额|实付|实收|gmv|paid|merchant|利润|退款金额|商家实收|费用|成本|profit|cost|优惠|推广费|罚款)/i.test(label || k);
const isPercent = (k: string, label?: string) =>
  /^(退款率|售后率|利润率|占比|refundRate|rate|转化率|点击率)/i.test(label || k);
const isNumeric = (v: any) => typeof v === 'number' || (!isNaN(parseFloat(v)) && isFinite(v));

function fmtVal(key: string, label: string | undefined, v: any): string {
  const n = parseFloat(v);
  if (isNaN(n)) return String(v ?? '--');
  if (isMoney(key, label)) return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  if (isPercent(key, label)) return `${n.toFixed(1)}%`;
  return n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/* ── detect first numeric column ── */
function firstNumericKey(columns: { key: string; label: string }[], data: any[]): string | null {
  for (const c of columns) {
    const v = data[0]?.[c.key];
    if (isNumeric(v)) return c.key;
  }
  return null;
}

/* ── Mini horizontal bar ── */
const MiniBar = ({ value, max }: { value: number; max: number }) => (
  <div className="inline-flex items-center gap-1.5 w-full justify-end">
    <span className="tabular-nums">{value.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}</span>
    <div className="w-16 h-1.5 bg-pdd-border rounded-full overflow-hidden shrink-0">
      <div className="h-full bg-pdd-primary/50 rounded-full transition-all" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
    </div>
  </div>
);

/* ── Summary header ── */
const SummaryHeader = ({ data, columns, title }: { data: any[]; columns: { key: string; label: string }[]; title: string }) => {
  const numKey = firstNumericKey(columns, data);
  if (!numKey || data.length < 2) return null;
  const vals = data.map(d => parseFloat(d[numKey])).filter(v => !isNaN(v));
  if (!vals.length) return null;
  const total = vals.reduce((s, v) => s + v, 0);
  const avg = total / vals.length;
  const max = Math.max(...vals);
  return (
    <div className="flex items-center gap-4 px-3 py-2 bg-pdd-bg rounded-lg border border-pdd-border mb-3 text-xs">
      <div><span className="text-pdd-text-secondary">总数：</span><span className="font-semibold text-pdd-text">{data.length}</span></div>
      <div className="w-px h-4 bg-pdd-border" />
      <div><span className="text-pdd-text-secondary">合计：</span><span className="font-semibold text-pdd-primary">{fmtVal(numKey, '', total)}</span></div>
      <div className="w-px h-4 bg-pdd-border" />
      <div><span className="text-pdd-text-secondary">均值：</span><span className="text-pdd-text">{fmtVal(numKey, '', avg)}</span></div>
      <div className="w-px h-4 bg-pdd-border" />
      <div><span className="text-pdd-text-secondary">最高：</span><span className="text-pdd-success">{fmtVal(numKey, '', max)}</span></div>
    </div>
  );
};

/* ── DataTable with sorting ── */
const DataTable = ({ data, columns }: { data: any[]; columns: { key: string; label: string }[] }) => {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(false);

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = parseFloat(a[sortKey]), bv = parseFloat(b[sortKey]);
      if (!isNaN(av) && !isNaN(bv)) return sortAsc ? av - bv : bv - av;
      return sortAsc
        ? String(a[sortKey]).localeCompare(String(b[sortKey]))
        : String(b[sortKey]).localeCompare(String(a[sortKey]));
    });
  }, [data, sortKey, sortAsc]);

  const numKey = firstNumericKey(columns, data);
  const numVals = numKey ? sorted.map(d => parseFloat(d[numKey])).filter(v => !isNaN(v)) : [];
  const maxVal = numVals.length ? Math.max(...numVals) : 0;

  const handleSort = (key: string) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-pdd-card z-10">
        <tr className="border-b border-pdd-border">
          <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary w-8">#</th>
          {columns.map(col => {
            const isNum = isNumeric(sorted[0]?.[col.key]);
            return (
              <th key={col.key}
                onClick={() => handleSort(col.key)}
                className={`py-2 px-2 font-medium text-pdd-text-secondary cursor-pointer hover:text-pdd-primary transition-colors select-none ${isNum ? 'text-right' : 'text-left'}`}>
                <div className="flex items-center gap-1">
                  {col.label}
                  <ArrowUpDown size={10} className={`shrink-0 ${sortKey === col.key ? 'text-pdd-primary' : 'text-pdd-text-secondary/30'}`} />
                </div>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sorted.map((item: any, idx: number) => (
          <tr key={idx} className="border-b border-pdd-border hover:bg-pdd-bg transition-colors">
            <td className="py-2 px-2 text-pdd-text-secondary">{idx + 1}</td>
            {columns.map(col => {
              const raw = item[col.key];
              const val = raw ?? '--';
              const n = parseFloat(val);
              const isNum = !isNaN(n);
              const isMid = isMoney(col.key, col.label);
              return (
                <td key={col.key}
                  className={`py-2 px-2 truncate max-w-[160px] ${isNum ? 'text-right' : 'text-left'} ${col.key === '商品名称' || col.key === 'productName' ? 'font-medium' : ''} text-pdd-text`}
                  title={String(raw ?? '')}>
                  {isNum && numKey === col.key && maxVal > 0 && sorted.length > 5
                    ? <MiniBar value={n} max={maxVal} />
                    : isNum
                      ? <span className={`tabular-nums ${isMid && n < 0 ? 'text-pdd-danger' : isMid && n > 0 ? 'text-pdd-success' : ''}`}>{fmtVal(col.key, col.label, n)}</span>
                      : <>{String(val)}</>
                  }
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

/* ── AutoTable for name-value pairs ── */
const AutoTable = ({ data }: { data: any[] }) => {
  const first = data[0] || {};
  const keys = Object.keys(first);
  const hasNameValue = keys.length === 2 && 'name' in first && 'value' in first;
  const total = hasNameValue ? data.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) : 0;
  const maxVal = hasNameValue ? Math.max(...data.map(d => Number(d.value || 0))) : 0;

  if (!data.length) {
    return <div className="text-center py-8 text-pdd-text-secondary text-sm">暂无明细数据</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-pdd-card">
        <tr className="border-b border-pdd-border">
          <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary w-8">#</th>
          {keys.map(k => (
            <th key={k} className={`py-2 px-2 font-medium text-pdd-text-secondary ${k === 'value' ? 'text-right' : 'text-left'}`}>{k}</th>
          ))}
          {hasNameValue && <th className="text-right py-2 px-2 font-medium text-pdd-text-secondary">占比</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((item: any, idx: number) => (
          <tr key={idx} className="border-b border-pdd-border hover:bg-pdd-bg transition-colors">
            <td className="py-2 px-2 text-pdd-text-secondary">{idx + 1}</td>
            {keys.map(k => {
              const v = item[k];
              const n = parseFloat(v);
              if (k === 'value' || (!hasNameValue && !isNaN(n))) {
                return (
                  <td key={k} className="py-2 px-2 text-right text-pdd-text" title={String(v ?? '')}>
                    {hasNameValue && maxVal > 0
                      ? <MiniBar value={n} max={maxVal} />
                      : <span className="tabular-nums">{fmtVal(k, k, v)}</span>
                    }
                  </td>
                );
              }
              return <td key={k} className={`py-2 px-2 truncate max-w-[200px] ${k === 'name' ? 'font-medium' : ''} text-pdd-text`} title={String(v ?? '')}>{v ?? '--'}</td>;
            })}
            {hasNameValue && <td className="py-2 px-2 text-right text-pdd-text-secondary">{total > 0 ? ((Number(item.value) / total) * 100).toFixed(1) : '0'}%</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default function DashboardDetailModal({ open, title, data, columns, onClose }: Props) {
  const safeColumns: { key: string; label: string }[] = useMemo(() => {
    if (columns && columns.length > 0) return columns;
    if (!data.length) return [];
    return Object.keys(data[0]).map(k => ({ key: k, label: k }));
  }, [columns, data]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
            className="relative w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            {/* 渐变边框 */}
            <div className="absolute -inset-[0.5px] rounded-2xl bg-gradient-to-br from-pdd-primary/20 via-purple-500/10 to-pink-500/10 opacity-60 blur-[1px]" />
            <div className="relative bg-pdd-card border border-pdd-border/60 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-pdd-border/60 shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-pdd-text">{title}</h3>
                  <span className="text-pdd-text-secondary font-normal text-xs">({data.length}条)</span>
                </div>
                <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-pdd-bg text-pdd-text-secondary hover:text-pdd-primary transition-colors group">
                  <X size={16} className="group-hover:rotate-90 transition-transform duration-300" />
                </button>
              </div>
              {/* Summary */}
              {safeColumns.length > 0 && (
                <div className="px-5 pt-3 shrink-0">
                  <SummaryHeader data={data} columns={safeColumns} title={title} />
                </div>
              )}
              {/* Body */}
              <div className="overflow-auto px-5 py-3 flex-1 scrollbar-thin">
                {!data.length ? (
                  <div className="text-center py-12 text-pdd-text-secondary/60 text-sm">暂无明细数据</div>
                ) : columns && columns.length > 0 ? (
                  <DataTable data={data} columns={columns} />
                ) : (
                  <AutoTable data={data} />
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

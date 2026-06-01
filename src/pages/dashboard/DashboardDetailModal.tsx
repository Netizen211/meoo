import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface Props {
  open: boolean;
  title: string;
  data: any[];
  columns?: { key: string; label: string }[];
  onClose: () => void;
}

function inferColumns(data: any[]): { key: string; label: string; hasNameValue: boolean }[] {
  if (!data.length) return [];
  const first = data[0];
  if ('name' in first && 'value' in first) {
    return [{ key: 'name', label: '名称', hasNameValue: true }, { key: 'value', label: '数值', hasNameValue: true }];
  }
  return Object.keys(first).map(k => ({ key: k, label: k, hasNameValue: false }));
}

function AutoTable({ data }: { data: any[] }) {
  const cols = inferColumns(data);
  const hasNameValue = cols.length === 2 && cols[0].hasNameValue;
  const total = hasNameValue ? data.reduce((s: number, d: any) => s + (Number(d.value) || 0), 0) : 0;

  if (!data.length) {
    return <div className="text-center py-8 text-pdd-text-secondary text-sm">暂无明细数据</div>;
  }

  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-pdd-card">
        <tr className="border-b border-pdd-border">
          <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary">#</th>
          {cols.map(col => (
            <th key={col.key} className={`py-2 px-2 font-medium text-pdd-text-secondary ${col.key === 'value' || (!hasNameValue && !isNaN(Number(data[0][col.key]))) ? 'text-right' : 'text-left'}`}>{col.label}</th>
          ))}
          {hasNameValue && <th className="text-right py-2 px-2 font-medium text-pdd-text-secondary">占比</th>}
        </tr>
      </thead>
      <tbody>
        {data.map((item: any, idx: number) => (
          <tr key={idx} className="border-b border-pdd-border hover:bg-[var(--pdd-gray-200)] transition-colors">
            <td className="py-2 px-2 text-pdd-text-secondary">{idx + 1}</td>
            {cols.map(col => (
              <td key={col.key} className={`py-2 px-2 truncate max-w-[200px] ${col.key === 'value' || (!hasNameValue && !isNaN(Number(item[col.key]))) ? 'text-right' : 'text-left'} ${col.key === 'name' ? 'font-medium' : ''} text-pdd-text`} title={String(item[col.key] || '')}>{item[col.key] ?? '--'}</td>
            ))}
            {hasNameValue && <td className="py-2 px-2 text-right text-pdd-text-secondary">{total > 0 ? ((Number(item.value) / total) * 100).toFixed(1) : '0'}%</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function DashboardDetailModal({ open, title, data, columns, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div id="detail-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div id="detail-modal-content" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-pdd-card border border-pdd-border rounded-2xl p-4 max-w-4xl w-full max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-pdd-text">{title} - 明细数据 ({data.length}条)</h3>
              <button onClick={onClose} className="p-1 hover:bg-[var(--pdd-gray-200)] rounded-lg text-pdd-text-secondary hover:text-pdd-text transition-colors"><X size={16} /></button>
            </div>
            <div className="overflow-auto max-h-[60vh]">
              {columns && columns.length > 0 ? (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-pdd-card">
                    <tr className="border-b border-pdd-border">
                      <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary">#</th>
                      {columns.map(col => (
                        <th key={col.key} className="text-left py-2 px-2 font-medium text-pdd-text-secondary">{col.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item: any, idx: number) => (
                      <tr key={idx} className="border-b border-pdd-border hover:bg-[var(--pdd-gray-200)] transition-colors">
                        <td className="py-2 px-2 text-pdd-text-secondary">{idx + 1}</td>
                        {columns?.map(col => (
                          <td key={col.key} className="py-2 px-2 truncate max-w-[150px] text-pdd-text" title={item[col.key]}>{item[col.key] || '--'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <AutoTable data={data} />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

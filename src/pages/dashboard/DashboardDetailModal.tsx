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

export default function DashboardDetailModal({ open, title, data, columns, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div id="detail-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-pdd-text/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
          <motion.div id="detail-modal-content" initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }} className="bg-pdd-card border border-pdd-border rounded-2xl p-4 max-w-2xl w-full max-h-[80vh] overflow-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-pdd-text">{title} - 明细数据</h3>
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
                          <td key={col.key} className="py-2 px-2 truncate max-w-[150px] text-[#e2e8f0]" title={item[col.key]}>{item[col.key] || '--'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-pdd-card">
                    <tr className="border-b border-pdd-border">
                      <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary">#</th>
                      <th className="text-left py-2 px-2 font-medium text-pdd-text-secondary">名称</th>
                      <th className="text-right py-2 px-2 font-medium text-pdd-text-secondary">数值</th>
                      <th className="text-right py-2 px-2 font-medium text-pdd-text-secondary">占比</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((item: any, idx: number) => {
                      const total = data.reduce((sum: number, d: any) => sum + (d.value || 0), 0);
                      const percent = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0';
                      return (
                        <tr key={idx} className="border-b border-pdd-border hover:bg-[var(--pdd-gray-200)] transition-colors">
                          <td className="py-2 px-2 text-pdd-text-secondary">{idx + 1}</td>
                          <td className="py-2 px-2 font-medium truncate max-w-[200px] text-pdd-text" title={item.name}>{item.name}</td>
                          <td className="py-2 px-2 text-right text-pdd-primary-light font-medium">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</td>
                          <td className="py-2 px-2 text-right text-pdd-text-secondary">{percent}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

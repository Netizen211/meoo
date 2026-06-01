import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, FileSpreadsheet, FileText, Check, ChevronDown, Settings } from 'lucide-react';

interface ExportField {
  key: string;
  label: string;
  checked: boolean;
}

interface ExportButtonProps {
  data: any[];
  fields: ExportField[];
  filename?: string;
  onExport?: (format: 'csv' | 'excel', scope: 'current' | 'all', selectedFields: string[]) => void;
}

export default function ExportButton({ data, fields, filename = 'export', onExport }: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(fields);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const handleExport = async (format: 'csv' | 'excel', scope: 'current' | 'all') => {
    setExporting(true);
    setProgress(0);
    setIsOpen(false);

    const selectedKeys = selectedFields.filter(f => f.checked).map(f => f.key);
    if (selectedKeys.length === 0) {
      setExporting(false);
      return;
    }

    // Simulate progress
    for (let i = 0; i <= 100; i += 20) {
      await new Promise(r => setTimeout(r, 100));
      setProgress(i);
    }

    const exportData = scope === 'current' ? data : data;
    const headers = selectedFields.filter(f => f.checked).map(f => f.label);
    const rows = exportData.map(row => selectedKeys.map(k => row[k] ?? ''));

    if (format === 'csv') {
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.csv`;
      link.click();
    } else {
      // Excel export (simplified as CSV with xlsx extension for demo)
      const csv = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
      const blob = new Blob(['\ufeff' + csv], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${filename}.xls`;
      link.click();
    }

    onExport?.(format, scope, selectedKeys);
    setTimeout(() => {
      setExporting(false);
      setProgress(0);
    }, 500);
  };

  const toggleField = (key: string) => {
    setSelectedFields(prev => prev.map(f => f.key === key ? { ...f, checked: !f.checked } : f));
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-pdd-primary text-white rounded-lg text-sm hover:bg-pdd-primary-dark transition-colors"
      >
        <Download size={14} />
        <span>导出</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            className="absolute right-0 top-full mt-1 w-48 bg-pdd-card border border-pdd-border rounded-lg shadow-lg z-50 py-1"
          >
            <button
              onClick={() => handleExport('csv', 'current')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-pdd-bg text-left"
            >
              <FileText size={14} className="text-pdd-text-secondary" />
              <span>导出 CSV</span>
            </button>
            <button
              onClick={() => handleExport('excel', 'current')}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-pdd-bg text-left"
            >
              <FileSpreadsheet size={14} className="text-pdd-success" />
              <span>导出 Excel</span>
            </button>
            <div className="border-t border-pdd-border my-1" />
            <button
              onClick={() => setShowConfig(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-pdd-bg text-left text-pdd-text-secondary"
            >
              <Settings size={14} />
              <span>自定义字段</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Field Config Modal */}
      <AnimatePresence>
        {showConfig && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={() => setShowConfig(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-pdd-card rounded-lg p-4 w-80 max-h-[80vh] overflow-auto"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="font-semibold mb-3 text-pdd-text">选择导出字段</h3>
              <div className="space-y-2 mb-4">
                {selectedFields.map(f => (
                  <label key={f.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={f.checked}
                      onChange={() => toggleField(f.key)}
                      className="rounded border-pdd-border"
                    />
                    <span className="text-sm text-pdd-text">{f.label}</span>
                  </label>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedFields(fields)}
                  className="flex-1 px-3 py-1.5 text-sm border border-pdd-border rounded hover:bg-pdd-bg text-pdd-text"
                >
                  重置
                </button>
                <button
                  onClick={() => setShowConfig(false)}
                  className="flex-1 px-3 py-1.5 text-sm bg-pdd-primary text-white rounded hover:bg-pdd-primary-dark"
                >
                  确定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress Toast */}
      <AnimatePresence>
        {exporting && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-pdd-card border border-pdd-border rounded-lg shadow-lg p-3 z-50"
          >
            <div className="flex items-center gap-2 mb-2">
              {progress === 100 ? <Check size={16} className="text-pdd-success" /> : <Download size={16} className="text-pdd-primary" />}
              <span className="text-sm font-medium text-pdd-text">{progress === 100 ? '导出完成' : '正在导出...'}</span>
            </div>
            <div className="w-48 h-1.5 bg-pdd-bg rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-pdd-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

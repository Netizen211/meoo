import React from 'react';
import { Download } from 'lucide-react';

interface ExportColumn {
  key: string;
  title: string;
}

interface ExportButtonProps {
  /** 列定义 */
  columns: ExportColumn[];
  /** 数据源 */
  data: Record<string, any>[];
  /** 文件名（不含扩展名） */
  filename?: string;
  /** 按钮文本 */
  label?: string;
  /** 自定义数据提取函数，返回二维数组 */
  formatRow?: (row: Record<string, any>) => string[];
}

/** 将二维数组导出为 CSV 并下载 */
function exportCSV(rows: string[][], filename: string) {
  const BOM = '﻿';
  const csv = BOM + rows.map(row =>
    row.map(cell => {
      const str = String(cell ?? '');
      // 含逗号/引号/换行时包裹
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : filename + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 导出按钮组件 */
export default function ExportButton({ columns, data, filename = 'export', label = '导出', formatRow }: ExportButtonProps) {
  const handleExport = () => {
    const headers = columns.map(c => c.title);
    const rows = data.map(row => {
      if (formatRow) return formatRow(row);
      return columns.map(col => {
        const val = row[col.key];
        return val != null ? String(val) : '';
      });
    });
    exportCSV([headers, ...rows], filename);
  };

  return (
    <button onClick={handleExport}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
      style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
      <Download size={13} /> {label}
    </button>
  );
}

export { exportCSV };

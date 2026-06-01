import { KPI_LINES } from './trendData';

export interface TableColumn {
  key: string;
  label: string;
  type: 'value' | 'percent';
  color: string;
}

/** 根据选中的 KPI 生成表格列定义 */
export function getTableColumns(selectedKeys: Set<string>): TableColumn[] {
  return [
    { key: 'date', label: '日期', type: 'value', color: '#666' },
    ...KPI_LINES.filter(l => selectedKeys.has(l.key)).map(l => ({
      key: l.key,
      label: l.label,
      type: l.type,
      color: l.color,
    })),
  ];
}

/** 格式化单个数值 */
export function formatCellValue(value: any, col: TableColumn): string {
  if (value == null) return '--';
  if (col.key === 'date') return String(value);
  if (typeof value !== 'number') return String(value);
  if (col.type === 'percent') return value.toFixed(2) + '%';
  // 金额类用千分位
  if (col.label.includes('GMV') || col.label.includes('金额') || col.label.includes('花费') ||
      col.label.includes('费') || col.label.includes('客单价') || col.label.includes('实付') ||
      col.label.includes('成本') || col.label.includes('优惠')) {
    return value.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  if (col.label.includes('ROI') || col.label.includes('投产')) return value.toFixed(2);
  if (col.label.includes('率')) return value.toFixed(1) + '%';
  if (Number.isInteger(value)) return value.toLocaleString('zh-CN');
  return value.toFixed(2);
}

/** 对比两期数据计算变化 */
export function calcChange(current: number, previous: number): { pct: number; dir: 'up' | 'down' | 'flat' } {
  if (!previous || previous === 0) return { pct: 0, dir: 'flat' };
  const pct = ((current - previous) / previous) * 100;
  return {
    pct: Math.abs(pct),
    dir: pct > 0.1 ? 'up' : pct < -0.1 ? 'down' : 'flat',
  };
}

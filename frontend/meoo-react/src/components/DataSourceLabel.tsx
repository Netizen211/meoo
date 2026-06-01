import React from 'react';
import { Info } from 'lucide-react';

interface Props {
  source: string;
  className?: string;
}

/** 通用数据源标注组件 — 全局统一风格 */
export default function DataSourceLabel({ source, className = '' }: Props) {
  return (
    <span
      className={`text-[9px] text-gray-400/60 italic inline-flex items-center gap-0.5 ${className}`}
      title={`数据来源: ${source}`}
    >
      <Info size={8} className="opacity-40" />
      {source}
    </span>
  );
}

/** 带数据源的指标行 */
export function SourcedMetric({
  label, value, source, className = ''
}: { label: string; value: string; source: string; className?: string }) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-bold text-gray-800">{value}</span>
      <DataSourceLabel source={source} />
    </div>
  );
}

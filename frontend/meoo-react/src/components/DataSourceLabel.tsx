import React from 'react';
import { Info, CheckCircle, AlertTriangle, Settings, Clock } from 'lucide-react';

interface Props {
  source: string;
  className?: string;
}

/** 通用数据源标注组件 — 全局统一风格 */
export default function DataSourceLabel({ source, className = '' }: Props) {
  return (
    <span
      className={`text-[9px] italic inline-flex items-center gap-0.5 ${className}`}
      style={{ color: 'var(--pdd-gray-400)', opacity: 0.6 }}
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
      <span className="text-xs text-pdd-text-secondary">{label}</span>
      <span className="text-sm font-bold text-pdd-text">{value}</span>
      <DataSourceLabel source={source} />
    </div>
  );
}

// ──────────────────────────────────────────────────
// TrustBadge — 可信度标签（四档）
// 设计规范: 21-蓝白企业级UI设计系统.md §4.7
// ──────────────────────────────────────────────────

type TrustLevel = 'verified' | 'estimated' | 'configured' | 'pending';

const TRUST_META: Record<TrustLevel, {
  label: string; emoji: string; bg: string; text: string; border: string; icon: React.ElementType;
}> = {
  verified:   { label: '已对账', emoji: '✅', bg: '#ECFDF3', text: '#067647', border: '#ABF0D5', icon: CheckCircle },
  estimated:  { label: '公式估算', emoji: '🟡', bg: '#FFFAEB', text: '#B54708', border: '#FEDF89', icon: AlertTriangle },
  configured: { label: '用户配置', emoji: '🔵', bg: '#EEF5FF', text: '#175CD3', border: '#B2D0FF', icon: Settings },
  pending:    { label: '待同步', emoji: '🟠', bg: '#FFF1F2', text: '#B42318', border: '#FECACA', icon: Clock },
};

interface TrustBadgeProps {
  level: TrustLevel;
  className?: string;
}

/** 可信度标签 — 显示数据来源的可信程度 */
export function TrustBadge({ level, className = '' }: TrustBadgeProps) {
  const m = TRUST_META[level];
  const Icon = m.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap ${className}`}
      style={{ backgroundColor: m.bg, color: m.text, border: `1px solid ${m.border}` }}
      title={`数据可信度: ${m.label}`}
    >
      <Icon size={12} />
      {m.label}
    </span>
  );
}

/** 根据 costSource 返回对应的 TrustLevel */
export function trustLevelFromCostSource(costSource?: string): TrustLevel {
  if (costSource === 'real') return 'verified';
  if (costSource === 'estimated') return 'estimated';
  if (costSource === 'configured') return 'configured';
  return 'pending';
}

/** 根据是否有实际财务数据返回 TrustLevel */
export function trustLevelFromActual(hasActual: boolean): TrustLevel {
  return hasActual ? 'verified' : 'estimated';
}

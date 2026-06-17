import React, { useState } from 'react';
import { RefreshCw, FileSpreadsheet, Download, Settings, Search, X, Filter, ChevronDown } from 'lucide-react';
import TimeFilter from './TimeFilter';

/* ── 子组件：筛选胶囊组 ── */
interface FilterCapsuleGroup {
  items: { value: string; label: string; badge?: number }[];
  active: string;
  onChange: (v: string) => void;
}
export function FilterCapsules({ items, active, onChange }: FilterCapsuleGroup) {
  return (
    <div className="flex bg-pdd-bg rounded-lg p-0.5 border border-pdd-border/50">
      {items.map(v => (
        <button key={v.value} onClick={() => onChange(v.value)}
          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
            active === v.value
              ? 'bg-pdd-card text-pdd-text shadow-sm'
              : 'text-pdd-text-secondary hover:text-pdd-text'
          }`}>
          {v.label}
          {v.badge != null && v.badge > 0 && (
            <span className="ml-1 px-1 py-0.5 rounded bg-pdd-danger/10 text-pdd-danger text-[10px]">{v.badge}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── 子组件：筛选下拉框 ── */
interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
}
export function FilterSelect({ value, onChange, options, placeholder = '全部', className = '' }: FilterSelectProps) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      className={`px-2 py-1.5 text-xs border border-pdd-border rounded-lg bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary/40 transition-colors ${className}`}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/* ── 子组件：搜索框 ── */
interface FilterSearchProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}
export function FilterSearch({ value, onChange, placeholder = '搜索...', className = '' }: FilterSearchProps) {
  return (
    <div className={`relative flex-1 min-w-[120px] max-w-[200px] ${className}`}>
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-pdd-text-secondary/40" />
      <input type="text" value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-8 pr-7 py-1.5 text-xs bg-pdd-bg border border-pdd-border/50 rounded-lg outline-none text-pdd-text placeholder-pdd-text-secondary/50 transition-colors focus:border-pdd-primary/40" />
      {value && (
        <button onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-pdd-text-secondary/40 hover:text-pdd-text/70">
          <X size={12} />
        </button>
      )}
    </div>
  );
}

/* ── FilterToolbar 的旧兼容接口（保持 Backward Compatibility） ── */

interface LegacyProps {
  tf: any;
  onRefresh?: () => void;
  refreshing?: boolean;
  onExportCSV?: () => void;
  onExportJSON?: () => void;
  onToggleKpiFilter?: () => void;
  showKpiFilter?: boolean;
  searchSlot?: React.ReactNode;
  categorySlot?: React.ReactNode;
  lastRefresh?: Date;
  hideTimeToggle?: boolean;
  hideFilterButton?: boolean;
  hideRefreshTime?: boolean;
}

/* ── 新的统一筛选栏 ── */

export interface UnifiedFilterBarProps {
  /** TimeFilter state hook（必需） */
  timeFilter: any;

  /** 页面标题（显示在筛选栏左侧） */
  title?: string | { label: string; subtitle?: string };

  /** 标题右侧的自定义操作区（如快速设置按钮） */
  titleActions?: React.ReactNode;

  /** 搜索框配置 */
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };

  /** 胶囊组（可多个） */
  capsules?: FilterCapsuleGroup[];

  /** 下拉框筛选器 */
  dropdowns?: FilterSelectProps[];

  /** 高级筛选面板（展开时渲染） */
  advancedFilterPanel?: React.ReactNode;
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;

  /** 激活的筛选标签（显示为可清除的 chips） */
  activeFilterTags?: { key: string; label: string; onRemove: () => void }[];
  onClearAllFilters?: () => void;

  /** 操作按钮 */
  actions?: { icon?: React.ReactNode; label: string; onClick: () => void; active?: boolean; badge?: number; danger?: boolean }[];

  /** 快捷刷新/导出 */
  onRefresh?: () => void;
  refreshing?: boolean;
  onExportCSV?: () => void;
  lastRefresh?: Date;

  /** 层级（控制背景/阴影/sticky） */
  variant?: 'card' | 'sticky' | 'inline';
}

export function UnifiedFilterBar({
  timeFilter,
  title,
  titleActions,
  search,
  capsules = [],
  dropdowns = [],
  advancedFilterPanel,
  showAdvanced,
  onToggleAdvanced,
  activeFilterTags = [],
  onClearAllFilters,
  actions = [],
  onRefresh, refreshing, onExportCSV, lastRefresh,
  variant = 'card',
}: UnifiedFilterBarProps) {
  const hasAdvancedFilters = showAdvanced != null && onToggleAdvanced;

  const containerClass = variant === 'sticky'
    ? 'sticky top-0 z-10 bg-pdd-card/90 backdrop-blur-sm border-b border-pdd-border/50'
    : variant === 'inline'
      ? ''
      : 'bg-pdd-card rounded-lg border border-pdd-border';

  const innerClass = variant === 'sticky'
    ? 'px-4 lg:px-6 py-2.5 flex items-center gap-2 flex-wrap'
    : 'px-3 py-2 flex items-center gap-2 flex-wrap';

  const titleStr = typeof title === 'string' ? title : title?.label;
  const subtitleStr = typeof title === 'object' ? title?.subtitle : undefined;

  return (
    <div className={containerClass}>
      <div className={innerClass}>
        {/* Page title (on the left) */}
        {titleStr && (
          <div className="flex items-center gap-2 shrink-0">
            <div>
              <h2 className="text-sm font-bold text-pdd-text leading-tight">{titleStr}</h2>
              {subtitleStr && (
                <p className="text-[10px] text-pdd-text-secondary/70 leading-tight mt-0.5">{subtitleStr}</p>
              )}
            </div>
            {titleActions && (
              <div className="flex items-center gap-1.5 ml-1">
                {titleActions}
              </div>
            )}
            <span className="w-px h-5 bg-pdd-border/50 mx-1" />
          </div>
        )}

        {/* TimeFilter */}
        <TimeFilter state={timeFilter} compact />

        {/* Search */}
        {search && (
          <FilterSearch
            value={search.value}
            onChange={search.onChange}
            placeholder={search.placeholder}
          />
        )}

        {/* Capsule groups */}
        {capsules.map((g, i) => (
          <FilterCapsules key={i} items={g.items} active={g.active} onChange={g.onChange} />
        ))}

        {/* Dropdowns */}
        {dropdowns.map((d, i) => (
          <FilterSelect key={i} {...d} />
        ))}

        {/* Advanced filter toggle */}
        {hasAdvancedFilters && (
          <button onClick={onToggleAdvanced}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              showAdvanced
                ? 'bg-pdd-primary/10 text-pdd-primary border-pdd-primary/20'
                : 'border-pdd-border/60 text-pdd-text-secondary hover:border-pdd-primary/30'
            }`}>
            <Filter size={13} />
            筛选
            <ChevronDown size={10} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>
        )}

        {/* Actions */}
        {(actions.length > 0 || onExportCSV || onRefresh) && <span className="flex-1" />}
        {actions.map((a, i) => (
          <button key={i} onClick={a.onClick}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              a.danger
                ? 'border-pdd-danger/30 text-pdd-danger hover:bg-pdd-danger/10'
                : a.active
                  ? 'bg-pdd-primary/10 text-pdd-primary border-pdd-primary/20'
                  : 'border-pdd-border/60 text-pdd-text-secondary hover:border-pdd-primary/30 hover:text-pdd-primary'
            }`}>
            {a.icon}{a.label}
            {a.badge != null && <span className="w-4 h-4 rounded-full bg-pdd-primary text-[9px] text-white flex items-center justify-center font-medium">{a.badge}</span>}
          </button>
        ))}
        {onExportCSV && (
          <button onClick={onExportCSV}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-pdd-border/60 text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-primary transition-all">
            <FileSpreadsheet size={13} />CSV
          </button>
        )}
        {onRefresh && (
          <button onClick={onRefresh}
            className={`p-1.5 rounded-lg text-pdd-text-secondary hover:bg-pdd-gray-100 transition-colors ${refreshing ? 'animate-spin' : ''}`}>
            <RefreshCw size={13} />
          </button>
        )}
        {lastRefresh && (
          <span className="text-[11px] text-pdd-text-secondary/60 whitespace-nowrap">{lastRefresh.toLocaleTimeString()}</span>
        )}
      </div>

      {/* Active filter tags */}
      {(activeFilterTags.length > 0 || onClearAllFilters) && (
        <div className="flex items-center gap-1.5 px-3 pb-2 flex-wrap">
          {activeFilterTags.map(tag => (
            <span key={tag.key} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pdd-primary/5 border border-pdd-primary/15 rounded text-[10px] text-pdd-primary">
              {tag.label}
              <button onClick={tag.onRemove} className="hover:text-pdd-danger"><X size={10} /></button>
            </span>
          ))}
          {activeFilterTags.length > 0 && onClearAllFilters && (
            <button onClick={onClearAllFilters} className="text-[10px] text-pdd-text-secondary hover:text-pdd-danger ml-1">清除全部</button>
          )}
        </div>
      )}

      {/* Advanced filter panel */}
      {showAdvanced && advancedFilterPanel && (
        <div className="border-t border-pdd-border/50 px-4 py-3">
          {advancedFilterPanel}
        </div>
      )}
    </div>
  );
}

/* ── 向后兼容 FilterToolbar ── */
export default function FilterToolbar(props: LegacyProps) {
  const { tf, onRefresh, refreshing, onExportCSV, onExportJSON, onToggleKpiFilter, showKpiFilter, searchSlot, lastRefresh, hideTimeToggle, hideFilterButton, hideRefreshTime } = props;
  const { timeRange } = tf;

  return (
    <div className="flex items-center gap-2 flex-wrap bg-pdd-card rounded-lg border border-pdd-border px-3 py-2">
      {searchSlot}
      <TimeFilter state={tf} compact />
      <span className="flex-1" />
      {onRefresh && (
        <button onClick={onRefresh} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-primary transition-all ${refreshing ? 'animate-spin' : ''}`}>
          <RefreshCw size={13} />
        </button>
      )}
      {onExportCSV && (
        <button onClick={onExportCSV} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-pdd-border/60 text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-primary transition-all">
          <FileSpreadsheet size={13} />CSV
        </button>
      )}
      {onExportJSON && (
        <button onClick={onExportJSON} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-pdd-border/60 text-pdd-text-secondary hover:bg-pdd-bg hover:text-pdd-primary transition-all">
          <Download size={13} />JSON
        </button>
      )}
      {!hideFilterButton && onToggleKpiFilter && (
        <button onClick={onToggleKpiFilter} className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${showKpiFilter ? 'bg-pdd-gray-100 text-pdd-primary border-pdd-primary/20' : 'border-pdd-border/60 text-pdd-text-secondary hover:text-pdd-primary hover:bg-pdd-bg'}`}>
          <Settings size={13} />筛选
        </button>
      )}
      {!hideRefreshTime && lastRefresh && <span className="text-[11px] text-pdd-text-secondary/60 whitespace-nowrap">更新于 {lastRefresh.toLocaleTimeString()}</span>}
    </div>
  );
}

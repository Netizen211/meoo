import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, ChevronUp, Save, Trash2, Tag } from 'lucide-react';
import { usePreference } from '../hooks/usePreference';

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'multiselect';
  options?: { value: string; label: string }[];
}

interface FilterState {
  [key: string]: string | string[] | null;
}

interface SavedFilter {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: number;
}

const FILTER_CONFIGS: FilterConfig[] = [
  { key: 'dateRange', label: '日期范围', type: 'select', options: [
    { value: 'today', label: '今天' },
    { value: 'yesterday', label: '昨天' },
    { value: '7days', label: '近7天' },
    { value: '30days', label: '近30天' },
    { value: '90days', label: '近90天' },
    { value: 'custom', label: '自定义' },
  ]},
  { key: 'category', label: '商品类目', type: 'multiselect', options: [
    { value: 'clothing', label: '服装' },
    { value: 'shoes', label: '鞋靴' },
    { value: 'bags', label: '箱包' },
    { value: 'accessories', label: '配饰' },
    { value: 'home', label: '家居' },
  ]},
  { key: 'province', label: '省份', type: 'multiselect', options: [
    { value: 'guangdong', label: '广东' },
    { value: 'zhejiang', label: '浙江' },
    { value: 'jiangsu', label: '江苏' },
    { value: 'beijing', label: '北京' },
    { value: 'shanghai', label: '上海' },
  ]},
  { key: 'orderStatus', label: '订单状态', type: 'multiselect', options: [
    { value: 'pending', label: '待发货' },
    { value: 'shipped', label: '已发货' },
    { value: 'completed', label: '已完成' },
    { value: 'refunding', label: '退款中' },
  ]},
  { key: 'afterSale', label: '售后状态', type: 'select', options: [
    { value: 'all', label: '全部' },
    { value: 'none', label: '无售后' },
    { value: 'refund', label: '退款' },
    { value: 'return', label: '退货退款' },
  ]},
];

export default function FilterPanel({ onFilterChange }: { onFilterChange?: (filters: FilterState) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [savedFilters, setSavedFilters] = usePreference<SavedFilter[]>('saved_filters', []);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');

  const activeFilters = Object.entries(filters).filter(([_, v]) => v && (Array.isArray(v) ? v.length > 0 : v !== ''));

  const handleFilterChange = (key: string, value: string | string[]) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const clearAll = () => {
    setFilters({});
    onFilterChange?.({});
  };

  const saveFilter = () => {
    if (!saveName.trim()) return;
    const newSaved: SavedFilter = {
      id: Date.now().toString(),
      name: saveName,
      filters: { ...filters },
      createdAt: Date.now(),
    };
    const updated = [...savedFilters, newSaved];
    setSavedFilters(updated);
    setShowSaveDialog(false);
    setSaveName('');
  };

  const applySavedFilter = (saved: SavedFilter) => {
    setFilters(saved.filters);
    onFilterChange?.(saved.filters);
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter(s => s.id !== id);
    setSavedFilters(updated);
  };

  return (
    <div className="bg-[var(--pdd-card)] rounded-lg border border-[var(--pdd-border)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--pdd-border)]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium hover:text-pdd-primary transition-colors"
          >
            <Filter size={16} />
            <span>高级筛选</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {activeFilters.length > 0 && (
            <span className="px-2 py-0.5 bg-pdd-primary text-white text-xs rounded-full">
              {activeFilters.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {activeFilters.length > 0 && (
            <button onClick={clearAll} className="text-xs text-pdd-primary hover:underline">
              清除全部
            </button>
          )}
          <button
            onClick={() => setShowSaveDialog(true)}
            className="flex items-center gap-1 px-2 py-1 text-xs border border-[var(--pdd-border)] rounded hover:border-pdd-primary transition-colors"
          >
            <Save size={12} /> 保存
          </button>
        </div>
      </div>

      {/* Active filter tags */}
      {activeFilters.length > 0 && (
        <div className="px-4 py-2 bg-[var(--pdd-bg)] flex items-center gap-2 flex-wrap">
          {activeFilters.map(([key, value]) => {
            const config = FILTER_CONFIGS.find(c => c.key === key);
            const displayValue = Array.isArray(value)
              ? value.map(v => config?.options?.find(o => o.value === v)?.label || v).join(', ')
              : config?.options?.find(o => o.value === value)?.label || value;
            return (
              <span key={key} className="inline-flex items-center gap-1 px-2 py-1 bg-pdd-card border border-[var(--pdd-border)] rounded text-xs">
                <Tag size={10} className="text-pdd-primary" />
                {config?.label}: {displayValue}
                <button onClick={() => clearFilter(key)} className="hover:text-pdd-primary">
                  <X size={12} />
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Saved filters */}
      {savedFilters.length > 0 && (
        <div className="px-4 py-2 border-b border-[var(--pdd-border)] flex items-center gap-2 flex-wrap">
          <span className="text-xs text-[var(--pdd-text-secondary)]">已保存:</span>
          {savedFilters.map(saved => (
            <button
              key={saved.id}
              onClick={() => applySavedFilter(saved)}
              className="inline-flex items-center gap-1 px-2 py-1 bg-pdd-primary-light/10 text-pdd-primary text-xs rounded hover:bg-pdd-primary hover:text-white transition-colors"
            >
              {saved.name}
              <span onClick={(e) => { e.stopPropagation(); deleteSavedFilter(saved.id); }}>
                <Trash2 size={10} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filter form */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 grid grid-cols-3 gap-4">
              {FILTER_CONFIGS.map(config => (
                <div key={config.key} className="space-y-1">
                  <label className="text-xs text-[var(--pdd-text-secondary)]">{config.label}</label>
                  {config.type === 'select' ? (
                    <select
                      value={(filters[config.key] as string) || ''}
                      onChange={(e) => handleFilterChange(config.key, e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-[var(--pdd-border)] rounded-lg bg-pdd-card focus:border-pdd-primary focus:outline-none"
                    >
                      <option value="">全部</option>
                      {config.options?.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {config.options?.map(opt => {
                        const isSelected = (filters[config.key] as string[] || []).includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              const current = (filters[config.key] as string[]) || [];
                              const updated = isSelected
                                ? current.filter(v => v !== opt.value)
                                : [...current, opt.value];
                              handleFilterChange(config.key, updated);
                            }}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              isSelected
                                ? 'bg-pdd-primary text-white border-pdd-primary'
                                : 'bg-pdd-card border-[var(--pdd-border)] hover:border-pdd-primary'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Save dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-pdd-card rounded-lg p-4 w-80"
          >
            <h3 className="text-sm font-semibold mb-3 text-pdd-text">保存筛选条件</h3>
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="输入名称"
              className="w-full px-3 py-2 border border-[var(--pdd-border)] rounded-lg text-sm mb-3 bg-pdd-card text-pdd-text"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="px-3 py-1.5 text-sm border border-[var(--pdd-border)] rounded hover:bg-[var(--pdd-bg)] text-pdd-text"
              >
                取消
              </button>
              <button
                onClick={saveFilter}
                className="px-3 py-1.5 text-sm bg-pdd-primary text-white rounded hover:bg-pdd-primary-dark"
              >
                保存
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

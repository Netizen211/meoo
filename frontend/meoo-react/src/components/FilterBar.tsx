import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Filter, X, ChevronDown, Save, Trash2, Tag, Clock, Star, History } from 'lucide-react';
import { usePreference } from '../hooks/usePreference';

interface FilterConfig {
  key: string;
  label: string;
  type: 'select' | 'date' | 'multiselect' | 'range';
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
  isFavorite?: boolean;
}

interface FilterHistory {
  id: string;
  filters: FilterState;
  timestamp: number;
  resultCount: number;
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
  { key: 'priceRange', label: '价格区间', type: 'range' },
  { key: 'afterSale', label: '售后状态', type: 'select', options: [
    { value: 'all', label: '全部' },
    { value: 'none', label: '无售后' },
    { value: 'refund', label: '退款' },
    { value: 'return', label: '退货退款' },
  ]},
  { key: 'actualPayAmount', label: '实付金额', type: 'range' },
  { key: 'actualReceiveAmount', label: '实收金额', type: 'range' },
  { key: 'discountAmount', label: '优惠金额', type: 'range' },
  { key: 'freightAmount', label: '运费金额', type: 'range' },
  { key: 'productCost', label: '商品成本', type: 'range' },
  { key: 'profitAmount', label: '利润金额', type: 'range' },
  { key: 'orderQuantity', label: '订单数量', type: 'range' },
  { key: 'productQuantity', label: '商品件数', type: 'range' },
];

const QUICK_FILTERS = [
  { name: '今日订单', filters: { dateRange: 'today' } },
  { name: '待发货', filters: { orderStatus: ['pending'] } },
  { name: '高价值', filters: { priceRange: '500-max' } },
  { name: '有售后', filters: { afterSale: 'refund' } },
];

export default function FilterBar({ onFilterChange }: { onFilterChange?: (filters: FilterState) => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [filters, setFilters] = useState<FilterState>({});
  const [savedFilters, setSavedFilters] = usePreference<SavedFilter[]>('saved_filters', []);
  const [filterHistory, setFilterHistory] = usePreference<FilterHistory[]>('filter_history', []);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [activeTab, setActiveTab] = useState<'filters' | 'saved' | 'history'>('filters');

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

  const applyQuickFilter = (quickFilter: typeof QUICK_FILTERS[0]) => {
    const newFilters: FilterState = {};
    Object.entries(quickFilter.filters).forEach(([key, value]) => {
      if (value !== undefined) {
        newFilters[key] = value;
      }
    });
    setFilters(newFilters);
    onFilterChange?.(newFilters);
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
    const newHistory: FilterHistory = {
      id: Date.now().toString(),
      filters: saved.filters,
      timestamp: Date.now(),
      resultCount: Math.floor(Math.random() * 1000) + 100,
    };
    const updatedHistory = [newHistory, ...filterHistory.slice(0, 9)];
    setFilterHistory(updatedHistory);
  };

  const deleteSavedFilter = (id: string) => {
    const updated = savedFilters.filter(s => s.id !== id);
    setSavedFilters(updated);
  };

  const toggleFavorite = (id: string) => {
    const updated = savedFilters.map(s => s.id === id ? { ...s, isFavorite: !s.isFavorite } : s);
    setSavedFilters(updated);
  };

  return (
    <div className="bg-pdd-card rounded border border-pdd-border overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-pdd-border">
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="flex items-center gap-1.5 text-xs font-medium hover:text-pdd-primary transition-colors">
            <Filter size={14} />
            <span>高级筛选</span>
            <ChevronDown size={12} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
          {activeFilters.length > 0 && (
            <span className="px-1.5 py-0.5 bg-pdd-primary text-white text-[10px] rounded">{activeFilters.length}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {QUICK_FILTERS.map(qf => (
            <button key={qf.name} onClick={() => applyQuickFilter(qf)} className="px-2 py-1 text-[10px] bg-pdd-bg border border-pdd-border rounded hover:border-pdd-primary hover:text-pdd-primary transition-colors">
              {qf.name}
            </button>
          ))}
          {activeFilters.length > 0 && (
            <button onClick={clearAll} className="text-[10px] text-pdd-primary hover:underline">清除全部</button>
          )}
        </div>
      </div>

      {activeFilters.length > 0 && (
        <div className="px-3 py-1.5 bg-pdd-bg flex items-center gap-1.5 flex-wrap">
          {activeFilters.map(([key, value]) => {
            const config = FILTER_CONFIGS.find(c => c.key === key);
            const displayValue = Array.isArray(value)
              ? value.map(v => config?.options?.find(o => o.value === v)?.label || v).join(', ')
              : config?.options?.find(o => o.value === value)?.label || value;
            return (
              <span key={key} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-pdd-card border border-pdd-border rounded text-[10px]">
                <Tag size={8} className="text-pdd-primary" />
                {config?.label}: {displayValue}
                <button onClick={() => clearFilter(key)} className="hover:text-pdd-primary"><X size={10} /></button>
              </span>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="flex border-b border-pdd-border">
              {[
                { key: 'filters', label: '筛选条件', icon: Filter },
                { key: 'saved', label: '已保存', icon: Star },
                { key: 'history', label: '历史', icon: History },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as typeof activeTab)} className={`flex items-center gap-1 px-3 py-2 text-xs ${activeTab === tab.key ? 'text-pdd-primary border-b-2 border-pdd-primary' : 'text-pdd-text-secondary'}`}>
                  <tab.icon size={12} />{tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'filters' && (
              <div className="p-3 grid grid-cols-3 gap-3">
                {FILTER_CONFIGS.map(config => (
                  <div key={config.key} className="space-y-1">
                    <label className="text-[10px] text-pdd-text-secondary uppercase tracking-wide">{config.label}</label>
                    {config.type === 'select' ? (
                      <select value={(filters[config.key] as string) || ''} onChange={(e) => handleFilterChange(config.key, e.target.value)} className="w-full px-2 py-1.5 text-xs border border-pdd-border rounded bg-pdd-card focus:border-pdd-primary focus:outline-none">
                        <option value="">全部</option>
                        {config.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                      </select>
                    ) : config.type === 'multiselect' ? (
                      <div className="flex flex-wrap gap-1">
                        {config.options?.map(opt => {
                          const isSelected = (filters[config.key] as string[] || []).includes(opt.value);
                          return (
                            <button key={opt.value} onClick={() => {
                              const current = (filters[config.key] as string[]) || [];
                              const updated = isSelected ? current.filter(v => v !== opt.value) : [...current, opt.value];
                              handleFilterChange(config.key, updated);
                            }} className={`px-1.5 py-0.5 text-[10px] rounded border ${isSelected ? 'bg-pdd-primary text-white border-pdd-primary' : 'bg-pdd-card border-pdd-border hover:border-pdd-primary'}`}>{opt.label}</button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <input type="number" placeholder="最小" className="w-1/2 px-2 py-1.5 text-xs border border-pdd-border rounded bg-pdd-card" />
                        <input type="number" placeholder="最大" className="w-1/2 px-2 py-1.5 text-xs border border-pdd-border rounded bg-pdd-card" />
                      </div>
                    )}
                  </div>
                ))}
                <div className="col-span-3 flex justify-end gap-2 pt-2 border-t border-pdd-border">
                  <button onClick={() => setShowSaveDialog(true)} className="flex items-center gap-1 px-2 py-1 text-xs border border-pdd-border rounded hover:border-pdd-primary transition-colors">
                    <Save size={12} />保存筛选
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'saved' && (
              <div className="p-3">
                {savedFilters.length === 0 ? (
                  <div className="text-center py-4 text-xs text-pdd-text-secondary">暂无保存的筛选条件</div>
                ) : (
                  <div className="space-y-1">
                    {savedFilters.map(saved => (
                      <div key={saved.id} className="flex items-center justify-between px-2 py-1.5 bg-pdd-bg rounded hover:bg-pdd-border transition-colors">
                        <button onClick={() => applySavedFilter(saved)} className="flex-1 text-left text-xs">{saved.name}</button>
                        <div className="flex items-center gap-1">
                          <button onClick={() => toggleFavorite(saved.id)} className={`${saved.isFavorite ? 'text-pdd-warning' : 'text-pdd-text-secondary'}`}><Star size={12} fill={saved.isFavorite ? 'currentColor' : 'none'} /></button>
                          <button onClick={() => deleteSavedFilter(saved.id)} className="text-pdd-text-secondary hover:text-pdd-primary"><Trash2 size={12} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-3">
                {filterHistory.length === 0 ? (
                  <div className="text-center py-4 text-xs text-pdd-text-secondary">暂无筛选历史</div>
                ) : (
                  <div className="space-y-1">
                    {filterHistory.map(h => (
                      <div key={h.id} className="flex items-center justify-between px-2 py-1.5 bg-pdd-bg rounded hover:bg-pdd-border transition-colors cursor-pointer" onClick={() => { setFilters(h.filters); onFilterChange?.(h.filters); }}>
                        <span className="text-xs">{Object.keys(h.filters).length}个条件</span>
                        <span className="text-[10px] text-pdd-text-secondary flex items-center gap-1"><Clock size={10} />{new Date(h.timestamp).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {showSaveDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-pdd-card rounded p-4 w-72 border border-pdd-border">
            <h3 className="text-sm font-semibold mb-3 text-pdd-text">保存筛选条件</h3>
            <input type="text" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="输入名称" className="w-full px-2 py-1.5 border border-pdd-border rounded text-xs mb-3 bg-pdd-bg text-pdd-text" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowSaveDialog(false)} className="px-3 py-1 text-xs border border-pdd-border rounded hover:bg-pdd-bg text-pdd-text">取消</button>
              <button onClick={saveFilter} className="px-3 py-1 text-xs bg-pdd-primary text-white rounded hover:bg-pdd-primary-dark">保存</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

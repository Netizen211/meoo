import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { useData } from '../App';

interface SearchResult {
  type: 'order' | 'product' | 'phone';
  value: string;
  label: string;
  highlight: string;
}

export default function SearchBox() {
  const { currentDisplayData } = useData();
  const parsedData = currentDisplayData;
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('dianfx_search_history');
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const suggestions = useMemo(() => {
    if (!query.trim() || !parsedData?.orders?.length) return [];
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    
    parsedData.orders.forEach((o: any) => {
      const orderNo = String(o['订单号'] || '');
      const product = String(o['商品'] || '');
      const phone = String(o['用户购买手机号'] || '');
      
      if (orderNo.toLowerCase().includes(q) && !seen.has(`order:${orderNo}`)) {
        seen.add(`order:${orderNo}`);
        results.push({ type: 'order', value: orderNo, label: '订单号', highlight: highlightText(orderNo, q) as string });
      }
      if (product.toLowerCase().includes(q) && !seen.has(`product:${product}`)) {
        seen.add(`product:${product}`);
        results.push({ type: 'product', value: product, label: '商品', highlight: highlightText(product.slice(0, 30), q) as string });
      }
      if (phone.toLowerCase().includes(q) && !seen.has(`phone:${phone}`)) {
        seen.add(`phone:${phone}`);
        results.push({ type: 'phone', value: phone, label: '手机号', highlight: highlightText(phone, q) as string });
      }
    });
    
    return results.slice(0, 10);
  }, [query, parsedData]);

  const highlightText = (text: string, query: string) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <span className="bg-pdd-primary-light/20 text-pdd-primary font-medium">{text.slice(idx, idx + query.length)}</span>
        {text.slice(idx + query.length)}
      </>
    );
  };

  const handleSearch = (value: string) => {
    if (!value.trim()) return;
    const newHistory = [value, ...history.filter(h => h !== value)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem('dianfx_search_history', JSON.stringify(newHistory));
    setQuery(value);
    setIsOpen(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('dianfx_search_history');
  };

  return (
    <div ref={containerRef} className="relative w-80">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--pdd-border)] bg-[var(--pdd-card)] focus-within:border-pdd-primary transition-colors">
        <Search size={16} className="text-[var(--pdd-text-secondary)]" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="搜索订单号、商品、手机号..."
          className="flex-1 text-sm bg-transparent outline-none text-[var(--pdd-text)]"
        />
        {query && (
          <button onClick={() => { setQuery(''); inputRef.current?.focus(); }} className="text-[var(--pdd-text-secondary)] hover:text-pdd-primary">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && (suggestions.length > 0 || (history.length > 0 && !query)) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="absolute top-full left-0 right-0 mt-1 bg-[var(--pdd-card)] border border-[var(--pdd-border)] rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto"
          >
            {!query && history.length > 0 && (
              <div className="p-2">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs text-[var(--pdd-text-secondary)] flex items-center gap-1">
                    <Clock size={12} /> 搜索历史
                  </span>
                  <button onClick={clearHistory} className="text-xs text-pdd-primary hover:underline">清空</button>
                </div>
                {history.map((h, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(h)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-pdd-primary-light/10 rounded flex items-center gap-2"
                  >
                    <Clock size={12} className="text-[var(--pdd-text-secondary)]" />
                    {h}
                  </button>
                ))}
              </div>
            )}
            
            {suggestions.length > 0 && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs text-[var(--pdd-text-secondary)] flex items-center gap-1">
                  <TrendingUp size={12} /> 搜索结果
                </div>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => handleSearch(s.value)}
                    className="w-full text-left px-2 py-1.5 text-sm hover:bg-pdd-primary-light/10 rounded flex items-center gap-2"
                  >
                    <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--pdd-bg)] text-[var(--pdd-text-secondary)]">{s.label}</span>
                    <span className="truncate">{s.highlight}</span>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

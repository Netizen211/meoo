import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface AdminPaginationProps {
  current: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

export default function AdminPagination({
  current,
  total,
  pageSize,
  onChange,
}: AdminPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  const pages: (number | '...')[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...');
    }
  }

  return (
    <div className="flex items-center justify-between pt-4 border-t border-pdd-border">
      <span className="text-xs text-pdd-text-secondary">
        共 {total} 条，第 {current}/{totalPages} 页
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(current - 1)}
          disabled={current <= 1}
          className="p-1.5 rounded-lg hover:bg-pdd-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-pdd-text-secondary transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        {pages.map((p, i) =>
          p === '...' ? (
            <span key={'e' + i} className="px-1 text-pdd-text-secondary text-xs">...</span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[30px] h-7 rounded-lg text-xs font-medium transition-colors ${
                p === current
                  ? 'bg-pdd-primary text-white'
                  : 'text-pdd-text-secondary hover:bg-pdd-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(current + 1)}
          disabled={current >= totalPages}
          className="p-1.5 rounded-lg hover:bg-pdd-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-pdd-text-secondary transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

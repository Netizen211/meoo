import React from 'react';

/**
 * 标准化加载骨架屏
 * Phase 6.2 共享组件库
 */

interface AdminLoadingProps {
  /** 行数（骨架行数量） */
  rows?: number;
  /** 显示为卡片容器 */
  card?: boolean;
  /** 自定义提示 */
  message?: string;
}

export default function AdminLoading({ rows = 3, card = true, message }: AdminLoadingProps) {
  const content = (
    <div className="animate-pulse space-y-3">
      {message && (
        <p className="text-sm text-pdd-text-secondary text-center py-4">{message}</p>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <div className="h-4 bg-pdd-gray-100 rounded w-24" />
          <div className="h-4 bg-pdd-gray-100 rounded flex-1" />
          <div className="h-4 bg-pdd-gray-100 rounded w-16" />
        </div>
      ))}
    </div>
  );

  if (card) {
    return <div className="pdd-card p-6">{content}</div>;
  }
  return content;
}

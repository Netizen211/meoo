import React from 'react';
import { Package, Inbox } from 'lucide-react';

interface AdminEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export default function AdminEmptyState({
  title = '暂无数据',
  description,
  icon,
  action,
}: AdminEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-pdd-gray-100 flex items-center justify-center mb-4">
        {icon || <Inbox size={26} className="text-pdd-gray-400" />}
      </div>
      <p className="text-sm font-medium text-pdd-text mb-1">{title}</p>
      {description && (
        <p className="text-xs text-pdd-text-secondary max-w-[300px]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

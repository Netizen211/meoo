import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--pdd-text)' }}>{title}</h1>
        {subtitle && <p className="text-sm mt-1" style={{ color: 'var(--pdd-text-secondary)' }}>{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-4">
          {actions}
        </div>
      )}
    </div>
  );
}

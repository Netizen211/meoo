import React from 'react';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default';

interface AdminStatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-pdd-success/10 text-pdd-success border-pdd-success/20',
  warning: 'bg-pdd-warning/10 text-pdd-warning border-pdd-warning/20',
  danger: 'bg-pdd-danger/10 text-pdd-danger border-pdd-danger/20',
  info: 'bg-pdd-primary/10 text-pdd-primary border-pdd-primary/20',
  default: 'bg-pdd-gray-100 text-pdd-text-secondary border-pdd-border',
};

const DOT_COLORS: Record<BadgeVariant, string> = {
  success: 'bg-pdd-success',
  warning: 'bg-pdd-warning',
  danger: 'bg-pdd-danger',
  info: 'bg-pdd-primary',
  default: 'bg-pdd-gray-400',
};

export default function AdminStatusBadge({
  status,
  variant = 'default',
  dot = false,
  className = '',
}: AdminStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${VARIANT_STYLES[variant]} ${className}`}
    >
      {dot && (
        <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLORS[variant]}`} />
      )}
      {status}
    </span>
  );
}

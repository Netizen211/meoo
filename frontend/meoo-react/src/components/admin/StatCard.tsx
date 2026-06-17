import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  loading?: boolean;
  onClick?: () => void;
}

export default function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  loading = false,
  onClick,
}: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div
      onClick={onClick}
      className={`bg-pdd-card border border-pdd-border rounded-lg p-4 transition-all ${onClick ? 'cursor-pointer hover:shadow-sm' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium mb-1 text-pdd-text-secondary">{title}</p>
          {loading ? (
            <div className="h-7 w-24 rounded bg-pdd-gray-100 animate-pulse" />
          ) : (
            <p className="text-xl lg:text-2xl font-bold truncate text-pdd-text">{value}</p>
          )}
          {subtitle && (
            <p className="text-xs mt-1 truncate text-pdd-gray-400">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center gap-1 mt-1.5">
              <TrendIcon size={12} className={trend === 'up' ? 'text-pdd-success' : trend === 'down' ? 'text-pdd-danger' : 'text-pdd-gray-400'} />
              <span className={`text-xs font-medium ${trend === 'up' ? 'text-pdd-success' : trend === 'down' ? 'text-pdd-danger' : 'text-pdd-gray-400'}`}>{trendValue}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ml-3 bg-pdd-gray-100">
            <div className="text-pdd-primary">{icon}</div>
          </div>
        )}
      </div>
    </div>
  );
}

import React from 'react';

interface Props {
  statusDist: any[];
  noData: boolean;
  totalOrders?: number;
}

export default function DashboardStatusPanel({ statusDist, noData, totalOrders = 0 }: Props) {
  if (noData) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-bold text-gray-700 mb-3">订单状态</h3>
        <div className="text-xs text-pdd-text-secondary">暂无数据</div>
      </div>
    );
  }
  if (!statusDist.length) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-bold text-gray-700 mb-3">订单状态</h3>
        <div className="text-xs text-pdd-text-secondary">暂无状态数据</div>
      </div>
    );
  }

  const total = statusDist.reduce((s: number, d: any) => s + d.value, 0);
  const topStatuses = statusDist.slice(0, 5);

  return (
    <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
      <h3 className="text-xs font-bold text-gray-700 mb-3">订单状态</h3>
      <div className="space-y-2">
        {topStatuses.map((d: any, i: number) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-xs text-pdd-text-secondary w-16 truncate">{d.name}</span>
              <div className="flex-1 h-1.5 bg-pdd-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-pdd-primary rounded-full"
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
              </div>
              <span className="text-xs text-pdd-text font-medium tabular-nums w-12 text-right">{d.value}</span>
              <span className="text-[11px] text-pdd-text-secondary w-10 text-right">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 pt-2 border-t border-pdd-border flex justify-between text-xs text-pdd-text-secondary">
        <span>合计</span>
        <span className="font-medium text-pdd-text">{total} 单</span>
      </div>
    </div>
  );
}

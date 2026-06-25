import React from 'react';
import { Tag } from 'lucide-react';

/** 状态配色方案 */
const STATUS_COLORS: Record<string, string> = {
  '待发货': '#FF7D00',
  '已发货': '#165DFF',
  '已签收': '#00B42A',
  '已完成': '#00B42A',
  '已取消': '#F53F3F',
  '售后处理中': '#FF7D00',
  '退款中': '#F53F3F',
  '已退款': '#F53F3F',
  '待付款': '#86909C',
  '等待发货': '#FF7D00',
};
const DEFAULT_COLOR = '#86909C';

interface Props {
  statusDist: any[];
  noData: boolean;
  totalOrders?: number;
}

export default function DashboardStatusPanel({ statusDist, noData, totalOrders = 0 }: Props) {
  if (noData) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
          <Tag size={14} className="text-pdd-primary" />订单状态
        </h3>
        <div className="h-28 flex items-center justify-center text-xs text-pdd-text-secondary">暂无数据</div>
      </div>
    );
  }
  if (!statusDist?.length) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
          <Tag size={14} className="text-pdd-primary" />订单状态
        </h3>
        <div className="h-28 flex items-center justify-center text-xs text-pdd-text-secondary">所选时间范围无订单数据</div>
      </div>
    );
  }

  const total = statusDist.reduce((s: number, d: any) => s + d.value, 0);
  const topStatuses = statusDist.slice(0, 6);

  return (
    <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
      <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
        <Tag size={14} className="text-pdd-primary" />订单状态
      </h3>
      <div className="space-y-2">
        {topStatuses.map((d: any, i: number) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          const color = STATUS_COLORS[d.name] || DEFAULT_COLOR;
          return (
            <div key={i} className="grid grid-cols-[5rem_1fr_2.75rem_2.5rem] gap-x-1.5 items-center">
              <span
                className="text-xs text-pdd-text truncate leading-4"
                title={d.name}
              >
                {d.name}
              </span>
              <div className="h-2 bg-pdd-bg rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.max(pct, 1)}%`, background: color }}
                />
              </div>
              <span className="text-xs text-pdd-text font-medium tabular-nums text-right leading-4">{d.value}</span>
              <span className="text-[11px] text-pdd-text-secondary tabular-nums text-right leading-4">{pct.toFixed(0)}%</span>
            </div>
          );
        })}
      </div>
      <div className="mt-2.5 pt-2.5 border-t border-pdd-border flex items-center justify-between text-xs">
        <span className="text-pdd-text-secondary">合计 {statusDist.length} 种状态</span>
        <span className="font-medium text-pdd-text tabular-nums">{total} 单</span>
      </div>
    </div>
  );
}

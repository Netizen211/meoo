import React from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3 } from 'lucide-react';

interface Props {
  revenueTrend: any[];
  noData: boolean;
  rangeLabel: string;
  draggedPanel?: string | null;
  onDragStart?: (p: string) => void;
  onDragOver?: (e: React.DragEvent, p: string) => void;
  onDragEnd?: () => void;
}

export default function DashboardTrendPanel({ revenueTrend, noData }: Props) {
  if (noData) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-pdd-primary" />
          收入趋势
        </h3>
        <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">
          暂无数据
        </div>
      </div>
    );
  }

  if (!revenueTrend?.length) {
    return (
      <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
        <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
          <BarChart3 size={14} className="text-pdd-primary" />
          收入趋势
        </h3>
        <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">
          所选时间范围无订单数据
        </div>
      </div>
    );
  }

  return (
    <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
      <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
        <BarChart3 size={14} className="text-pdd-primary" />
        收入趋势
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={revenueTrend} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" strokeOpacity={0.3} vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }}
            axisLine={{ stroke: 'var(--pdd-border)' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="income"
            orientation="left"
            tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => {
              if (v >= 10000) return `${(v / 10000).toFixed(1)}w`;
              if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
              return `${v}`;
            }}
          />
          <YAxis
            yAxisId="orders"
            orientation="right"
            tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => `${v}`}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0]?.payload;
              if (!d) return null;
              const income = d.income || 0;
              const orders = d.orders || 0;
              const refund = d.refund || 0;
              return (
                <div className="bg-pdd-card border border-pdd-border rounded-lg p-2.5 shadow-lg text-xs space-y-1">
                  <div className="font-medium text-pdd-text mb-1.5">{label}</div>
                  <div className="flex items-center gap-2 text-pdd-text-secondary">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: 'var(--pdd-primary)' }} />
                    <span>商家实收:</span>
                    <span className="font-medium text-pdd-text tabular-nums">
                      {'¥'}{income.toFixed(0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-pdd-text-secondary">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#36CFC9' }} />
                    <span>订单量:</span>
                    <span className="font-medium text-pdd-text tabular-nums">{orders}单</span>
                  </div>
                  <div className="flex items-center gap-2 text-pdd-text-secondary">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: '#ef4444' }} />
                    <span>退款金额:</span>
                    <span className={`font-medium tabular-nums ${refund > 0 ? 'text-red-400' : 'text-pdd-text'}`}>
                      {'¥'}{refund.toFixed(0)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          <Bar yAxisId="income" dataKey="income" fill="var(--pdd-primary)" radius={[3, 3, 0, 0]} opacity={0.75} maxBarSize={32} isAnimationActive={false} name="商家实收" />
          <Line yAxisId="orders" type="monotone" dataKey="orders" stroke="#36CFC9" strokeWidth={2} dot={false} name="订单量" />
          <Line yAxisId="income" type="monotone" dataKey="refund" stroke="#ef4444" strokeWidth={2} dot={false} name="退款金额" strokeOpacity={0.8} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

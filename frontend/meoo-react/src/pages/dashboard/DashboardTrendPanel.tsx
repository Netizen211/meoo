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

export default function DashboardTrendPanel({ revenueTrend, noData, rangeLabel }: Props) {
  return (
    <div className="bg-pdd-card rounded-lg border border-pdd-border p-4">
      <h3 className="text-xs font-semibold text-pdd-text mb-3 flex items-center gap-1.5">
        <BarChart3 size={14} className="text-pdd-primary" />收入趋势
      </h3>
      {noData ? (
        <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">暂无数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" strokeOpacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: '6px', fontSize: '11px', color: 'var(--pdd-text)', boxShadow: 'none' }} labelStyle={{ color: 'var(--pdd-text-secondary)' }} />
            <Bar dataKey="income" fill="var(--pdd-primary)" radius={[2, 2, 0, 0]} opacity={0.8} />
            <Line type="monotone" dataKey="orders" stroke="var(--pdd-primary-light)" strokeWidth={1.5} dot={false} name="订单量" />
            <Line type="monotone" dataKey="refund" stroke="#ef4444" strokeWidth={1.5} dot={false} name="退款" strokeOpacity={0.7} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

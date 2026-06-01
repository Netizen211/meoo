import React from 'react';
import { motion } from 'framer-motion';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BarChart3, Move } from 'lucide-react';

interface Props {
  revenueTrend: any[];
  noData: boolean;
  rangeLabel: string;
  draggedPanel: string | null;
  onDragStart: (p: string) => void;
  onDragOver: (e: React.DragEvent, p: string) => void;
  onDragEnd: () => void;
}

export default function DashboardTrendPanel({ revenueTrend, noData, rangeLabel, draggedPanel, onDragStart, onDragOver, onDragEnd }: Props) {
  return (
    <motion.div key="trend" layoutId="trend" draggable onDragStart={() => onDragStart('trend')} onDragOver={e => onDragOver(e, 'trend')} onDragEnd={onDragEnd}
      className={`bg-pdd-card rounded-xl border border-pdd-border p-3 cursor-move transition-all ${draggedPanel === 'trend' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pdd-text flex items-center gap-1.5"><BarChart3 size={14} color="var(--pdd-primary)" />收入与退款趋势({rangeLabel})</h3>
        <Move size={14} className="text-pdd-text-secondary" />
      </div>
      {noData ? <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传数据</div> : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={revenueTrend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} axisLine={{ stroke: 'var(--pdd-border)' }} tickLine={false} />
            <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: '8px', color: 'var(--pdd-text)', fontSize: '12px' }} labelStyle={{ color: 'var(--pdd-text-secondary)' }} />
            <Bar dataKey="income" fill="var(--pdd-primary)" radius={[2, 2, 0, 0]} />
            <Line type="monotone" dataKey="orders" stroke="var(--pdd-primary-light)" strokeWidth={2} dot={{ r: 3, fill: 'var(--pdd-primary-light)' }} name="订单量" />
            <Line type="monotone" dataKey="refund" stroke="#FF4D4F" strokeWidth={2} dot={{ r: 2, fill: '#FF4D4F' }} name="退款金额" />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

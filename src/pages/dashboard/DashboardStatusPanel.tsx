import React from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Move } from 'lucide-react';

const STATUS_COLORS = ['var(--pdd-success)', 'var(--pdd-info)', 'var(--pdd-primary-light)', 'var(--pdd-warning)', '#a855f7', '#64748b'];

interface Props {
  statusDist: any[];
  noData: boolean;
  draggedPanel: string | null;
  onDragStart: (p: string) => void;
  onDragOver: (e: React.DragEvent, p: string) => void;
  onDragEnd: () => void;
}

export default function DashboardStatusPanel({ statusDist, noData, draggedPanel, onDragStart, onDragOver, onDragEnd }: Props) {
  return (
    <motion.div key="status" layoutId="status" draggable onDragStart={() => onDragStart('status')} onDragOver={e => onDragOver(e, 'status')} onDragEnd={onDragEnd}
      className={`bg-pdd-card rounded-xl border border-pdd-border p-3 cursor-move transition-all ${draggedPanel === 'status' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pdd-text">订单状态分布</h3>
        <Move size={14} className="text-pdd-text-secondary" />
      </div>
      {noData ? (
        <div className="h-40 flex flex-col items-center justify-center text-xs text-pdd-text-secondary">
          <p className="mb-2">请先上传数据</p>
          <p className="text-[10px] text-pdd-text-muted">支持订单数据、推广数据、运费险数据等</p>
        </div>
      ) : statusDist.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">暂无状态数据</div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie data={statusDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" label={({ name, percent }) => `${name.slice(0, 4)} ${(percent * 100).toFixed(0)}%`}>
              {statusDist.map((_, i) => <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />)}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: '8px', fontSize: '11px', color: 'var(--pdd-text)' }}
              itemStyle={{ color: 'var(--pdd-text)' }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'framer-motion';
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Megaphone, Move } from 'lucide-react';

interface Props {
  promoTrendData: any[];
  topPromoProducts: any[];
  rangeLabel: string;
  draggedPanel: string | null;
  onDragStart: (p: string) => void;
  onDragOver: (e: React.DragEvent, p: string) => void;
  onDragEnd: () => void;
}

export default function DashboardPromoPanel({ promoTrendData, topPromoProducts, rangeLabel, draggedPanel, onDragStart, onDragOver, onDragEnd }: Props) {
  return (
    <motion.div key="promo" layoutId="promo" draggable onDragStart={() => onDragStart('promo')} onDragOver={e => onDragOver(e, 'promo')} onDragEnd={onDragEnd}
      className={`bg-pdd-card rounded-xl border border-pdd-border p-3 cursor-move transition-all ${draggedPanel === 'promo' ? 'opacity-50 scale-95' : ''}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-pdd-text flex items-center gap-1.5"><Megaphone size={14} color="var(--pdd-primary)" />推广分析({rangeLabel})</h3>
        <Move size={14} className="text-pdd-text-secondary" />
      </div>
      {!promoTrendData.length ? (
        <div className="h-40 flex items-center justify-center text-xs text-pdd-text-secondary">请先上传推广数据</div>
      ) : (
        <div className="space-y-3">
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={promoTrendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} />
              <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} />
              <YAxis yAxisId="roi" orientation="right" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} />
              <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: '8px', color: 'var(--pdd-text)', fontSize: '11px' }} labelStyle={{ color: 'var(--pdd-text-secondary)' }} />
              <Bar yAxisId="cost" dataKey="cost" fill="var(--pdd-primary)" name="花费(元)" radius={[2, 2, 0, 0]} />
              <Line yAxisId="roi" type="monotone" dataKey="roi" stroke="var(--pdd-purple)" strokeWidth={2} name="ROI" dot={{ r: 3, fill: 'var(--pdd-purple)' }} />
            </ComposedChart>
          </ResponsiveContainer>
          {topPromoProducts.length > 0 && (
            <div>
              <h4 className="text-xs font-medium mb-1.5 text-pdd-text-secondary">推广商品TOP5</h4>
              <div className="space-y-1">
                {topPromoProducts.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-pdd-border last:border-0 text-pdd-text-secondary">
                    <span className="truncate flex-1">{i + 1}. {p.name}</span>
                    <span className="text-pdd-primary-light font-medium ml-2">¥{p.cost.toFixed(0)}</span>
                    <span className="text-pdd-purple-light ml-2">ROI {p.roi.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

/**
 * 异常预警横幅 — P0-3
 */
import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import type { AnomalyResult } from '../../utils/anomalyDetector';

interface Props {
  anomalies: AnomalyResult[];
}

export default function AnomalyBanner({ anomalies }: Props) {
  if (!anomalies.length) return null;
  const criticals = anomalies.filter(a => a.level === 'critical');
  const warnings = anomalies.filter(a => a.level === 'warning');

  return (
    <div className={`rounded-lg border p-2.5 text-xs ${criticals.length > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <AlertTriangle size={14} className={criticals.length > 0 ? 'text-red-500' : 'text-yellow-600'} />
        <span className={`font-bold ${criticals.length > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
          异常预警 {criticals.length > 0 ? `(${criticals.length}项严重)` : `(${warnings.length}项注意)`}
        </span>
      </div>
      <div className="space-y-0.5 max-h-24 overflow-y-auto">
        {anomalies.slice(0, 8).map((a, i) => (
          <div key={i} className={`flex items-center gap-1.5 ${a.level === 'critical' ? 'text-red-600' : 'text-yellow-600'}`}>
            {a.direction === 'up' ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            <span className="font-mono">{a.date}</span>
            <span>{a.metric}: {typeof a.value === 'number' && a.value < 100 ? a.value.toFixed(1) + '%' : a.value.toFixed(0)}</span>
            <span className="text-pdd-gray-400">(Z={a.zScore})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

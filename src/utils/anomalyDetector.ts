/**
 * 异常检测引擎 — 基于统计方法的自动异常检测
 * P0-3: GMV/退款率异常波动预警
 */

export interface AnomalyResult {
  metric: string;
  date: string;
  value: number;
  mean: number;
  stdDev: number;
  zScore: number;
  level: 'normal' | 'warning' | 'critical';
  direction: 'up' | 'down';
}

export interface DailyMetric {
  date: string;
  value: number;
}

/** 对每日指标序列做 Z-Score 异常检测 */
export function detectAnomalies(
  dailyData: DailyMetric[],
  metricName: string,
  lookbackDays: number = 14,
  warningThreshold: number = 2.0,
  criticalThreshold: number = 3.0
): AnomalyResult[] {
  if (dailyData.length < lookbackDays + 1) return [];

  const results: AnomalyResult[] = [];

  for (let i = lookbackDays; i < dailyData.length; i++) {
    const window = dailyData.slice(i - lookbackDays, i);
    const values = window.map(d => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    const stdDev = Math.sqrt(variance) || 1;
    const zScore = (dailyData[i].value - mean) / stdDev;

    let level: AnomalyResult['level'] = 'normal';
    if (Math.abs(zScore) >= criticalThreshold) level = 'critical';
    else if (Math.abs(zScore) >= warningThreshold) level = 'warning';

    if (level !== 'normal') {
      results.push({
        metric: metricName,
        date: dailyData[i].date,
        value: dailyData[i].value,
        mean, stdDev,
        zScore: Math.round(zScore * 100) / 100,
        level,
        direction: zScore > 0 ? 'up' : 'down',
      });
    }
  }

  return results;
}

/** 聚合每日异常为汇总文本 */
export function summarizeAnomalies(results: AnomalyResult[]): { critical: string[]; warning: string[] } {
  const critical = results
    .filter(r => r.level === 'critical')
    .map(r => `${r.metric} ${r.date}: ${r.direction === 'up' ? '飙升' : '骤降'}到 ${r.value.toFixed(1)}(Z=${r.zScore})`);
  const warning = results
    .filter(r => r.level === 'warning')
    .map(r => `${r.metric} ${r.date}: ${r.direction === 'up' ? '偏高' : '偏低'} ${r.value.toFixed(1)}(Z=${r.zScore})`);
  return { critical, warning };
}

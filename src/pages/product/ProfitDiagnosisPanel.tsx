import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, TrendingUp, DollarSign, Percent, Shield, Activity, Target, Package, Box, Clock, Zap } from 'lucide-react';
import type { ProductStat } from '../../components/ProductLinkStats';

interface Props {
  productStats: Record<string, ProductStat>;
}

interface DiagnosisItem {
  productId: string;
  productName: string;
  score: number;
  warnings: { type: 'danger' | 'warning' | 'info'; message: string; value: string }[];
  suggestions: string[];
  metrics: {
    profitRate: number; refundRate: number; afterSaleRate: number; roi: number;
    promoCostRatio: number; avgOrderValue: number; turnoverDays: number;
    avgDailySales: number; inventoryEstimate: number;
  };
}

export default function ProfitDiagnosisPanel({ productStats }: Props) {
  const diagnoses = useMemo(() => {
    const results: DiagnosisItem[] = [];

    Object.values(productStats).forEach(s => {
      if (!s.hasOrderData && !s.hasPromoData) return;

      const warnings: DiagnosisItem['warnings'] = [];
      const suggestions: string[] = [];
      let score = 100;

      // 1. 利润率检查
      if (s.profitRate < 0) {
        warnings.push({ type: 'danger', message: '商品亏损', value: `${s.profitRate.toFixed(1)}%` });
        score -= 30;
        suggestions.push('检查商品成本配置是否准确，考虑提价或降低成本');
      } else if (s.profitRate < 10) {
        warnings.push({ type: 'warning', message: '利润率偏低', value: `${s.profitRate.toFixed(1)}%` });
        score -= 15;
        suggestions.push('利润率低于10%，关注成本控制或优化推广策略');
      } else if (s.profitRate > 40) {
        warnings.push({ type: 'info', message: '利润率优秀', value: `${s.profitRate.toFixed(1)}%` });
      }

      // 2. 退款率检查
      if (s.refundRate > 20) {
        warnings.push({ type: 'danger', message: '退款率过高', value: `${s.refundRate.toFixed(1)}%` });
        score -= 25;
        suggestions.push('退款率超20%，重点检查商品质量描述是否准确');
      } else if (s.refundRate > 10) {
        warnings.push({ type: 'warning', message: '退款率偏高', value: `${s.refundRate.toFixed(1)}%` });
        score -= 10;
        suggestions.push('退款率偏高，优化商品详情页和客服响应');
      }

      // 3. 售后率检查
      if (s.afterSaleRate > 30) {
        warnings.push({ type: 'danger', message: '售后率过高', value: `${s.afterSaleRate.toFixed(1)}%` });
        score -= 20;
        suggestions.push('售后率超30%，可能存在产品质量或物流问题');
      } else if (s.afterSaleRate > 15) {
        warnings.push({ type: 'warning', message: '售后率偏高', value: `${s.afterSaleRate.toFixed(1)}%` });
        score -= 10;
      }

      // 4. ROI检查
      if (s.hasPromoData) {
        if (s.roi < 1) {
          warnings.push({ type: 'danger', message: '推广ROI亏损', value: `${s.roi.toFixed(2)}x` });
          score -= 20;
          suggestions.push('推广入不敷出，暂停低效计划或优化投放策略');
        } else if (s.roi < 2) {
          warnings.push({ type: 'warning', message: '推广ROI偏低', value: `${s.roi.toFixed(2)}x` });
          score -= 10;
          suggestions.push('ROI低于2x，筛选高转化关键词、降低低效出价');
        }
      }

      // 5. 推广依赖度检查
      if (s.promoCostRatio > 30) {
        warnings.push({ type: 'warning', message: '推广依赖度高', value: `${s.promoCostRatio.toFixed(1)}%` });
        score -= 10;
        suggestions.push('推广占GMV超30%，培养自然流量降低依赖');
      }

      // 6. 客单价检查
      if (s.avgOrderValue < 20 && s.orders > 10) {
        warnings.push({ type: 'info', message: '客单价较低', value: `¥${s.avgOrderValue.toFixed(0)}` });
        suggestions.push('客单价偏低，考虑捆绑销售或提升商品附加值');
      }

      // 7. 周转效率检查
      if (s.turnoverDays > 60 && s.sales > 0) {
        warnings.push({ type: 'danger', message: '周转严重滞后', value: `${s.turnoverDays}天` });
        score -= 15;
        suggestions.push('周转超60天，存在滞销风险，建议降价促销');
      } else if (s.turnoverDays > 30 && s.sales > 0) {
        warnings.push({ type: 'warning', message: '周转偏慢', value: `${s.turnoverDays}天` });
        score -= 8;
        suggestions.push('周转超30天，优化库存管理或参加平台活动');
      }

      // 8. 库存风险检查
      if (s.avgDailySales > 1 && s.inventoryEstimate < s.avgDailySales * 3) {
        warnings.push({ type: 'warning', message: '库存不足预警', value: `仅够${Math.round(s.inventoryEstimate / Math.max(1, s.avgDailySales))}天` });
        score -= 10;
        suggestions.push('库存即将不足，建议尽快补货');
      }
      if (s.sales === 0 && s.activeDays > 30) {
        warnings.push({ type: 'danger', message: '长期零动销', value: `${s.activeDays}天` });
        score -= 25;
        suggestions.push('超30天零动销，考虑下架或大幅降价清仓');
      } else if (s.sales === 0 && s.activeDays > 7) {
        warnings.push({ type: 'warning', message: '短期零动销', value: `${s.activeDays}天` });
        score -= 10;
        suggestions.push('无销量商品，检查定价或加入推广计划');
      }

      // 9. 成本可信度检查
      if (s.costSource?.productCost === 'missing') {
        warnings.push({ type: 'info', message: '未配置成本', value: '利润估算值' });
        suggestions.push('在成本管理中配置实际成本以获取准确利润');
      }

      score = Math.max(0, Math.min(100, score));

      results.push({
        productId: s.productId,
        productName: s.productName,
        score,
        warnings,
        suggestions: suggestions.slice(0, 3),
        metrics: {
          profitRate: s.profitRate, refundRate: s.refundRate, afterSaleRate: s.afterSaleRate,
          roi: s.roi, promoCostRatio: s.promoCostRatio, avgOrderValue: s.avgOrderValue,
          turnoverDays: s.turnoverDays, avgDailySales: s.avgDailySales,
          inventoryEstimate: s.inventoryEstimate,
        },
      });
    });

    return results.sort((a, b) => a.score - b.score);
  }, [productStats]);

  const summary = useMemo(() => {
    const total = diagnoses.length;
    const dangerCount = diagnoses.filter(d => d.score < 40).length;
    const warningCount = diagnoses.filter(d => d.score >= 40 && d.score < 70).length;
    const healthyCount = diagnoses.filter(d => d.score >= 70).length;
    const avgScore = total > 0 ? diagnoses.reduce((sum, d) => sum + d.score, 0) / total : 0;
    // 利润率分层
    const profitTiers = { high: 0, mid: 0, low: 0, loss: 0 };
    diagnoses.forEach(d => {
      if (d.metrics.profitRate >= 20) profitTiers.high++;
      else if (d.metrics.profitRate >= 5) profitTiers.mid++;
      else if (d.metrics.profitRate >= 0) profitTiers.low++;
      else profitTiers.loss++;
    });
    return { total, dangerCount, warningCount, healthyCount, avgScore, profitTiers };
  }, [diagnoses]);

  const getScoreColor = (score: number) => {
    if (score < 40) return 'var(--pdd-danger)';
    if (score < 70) return 'var(--pdd-warning)';
    return 'var(--pdd-success)';
  };

  const getScoreLabel = (score: number) => {
    if (score < 40) return '高风险';
    if (score < 70) return '需关注';
    return '健康';
  };

  if (diagnoses.length === 0) {
    return (
      <div className="pdd-card p-6 text-center">
        <Package size={32} className="mx-auto mb-2 text-[var(--pdd-text-secondary)]" />
        <p className="text-sm text-[var(--pdd-text-secondary)]">暂无商品数据</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 汇总卡片 */}
      <div className="grid grid-cols-4 gap-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="pdd-card p-3 text-center">
          <div className="text-xs text-[var(--pdd-text-secondary)] mb-1">商品总数</div>
          <div className="text-lg font-bold">{summary.total}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="pdd-card p-3 text-center">
          <div className="text-xs text-[var(--pdd-text-secondary)] mb-1">高风险</div>
          <div className="text-lg font-bold text-[var(--pdd-danger)]">{summary.dangerCount}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="pdd-card p-3 text-center">
          <div className="text-xs text-[var(--pdd-text-secondary)] mb-1">需关注</div>
          <div className="text-lg font-bold text-[var(--pdd-warning)]">{summary.warningCount}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="pdd-card p-3 text-center">
          <div className="text-xs text-[var(--pdd-text-secondary)] mb-1">平均健康分</div>
          <div className="text-lg font-bold" style={{ color: getScoreColor(summary.avgScore) }}>{summary.avgScore.toFixed(0)}</div>
        </motion.div>
      </div>

      {/* 利润率分层 */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        <div className="bg-green-50 rounded p-1.5 text-center">
          <span className="text-green-600">高利润 ≥20%</span>
          <div className="font-bold text-green-700">{summary.profitTiers.high}</div>
        </div>
        <div className="bg-blue-50 rounded p-1.5 text-center">
          <span className="text-blue-600">中等 5-20%</span>
          <div className="font-bold text-blue-700">{summary.profitTiers.mid}</div>
        </div>
        <div className="bg-yellow-50 rounded p-1.5 text-center">
          <span className="text-yellow-600">微利 0-5%</span>
          <div className="font-bold text-yellow-700">{summary.profitTiers.low}</div>
        </div>
        <div className="bg-red-50 rounded p-1.5 text-center">
          <span className="text-red-600">亏损</span>
          <div className="font-bold text-red-700">{summary.profitTiers.loss}</div>
        </div>
      </div>

      {/* 商品诊断列表 */}
      <div className="pdd-card overflow-hidden">
        <div className="px-3 py-2 border-b border-[var(--pdd-border)] bg-[var(--pdd-bg)]">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Activity size={14} color="#722ed1" />
            商品盈利诊断
          </h3>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {diagnoses.slice(0, 20).map((d, i) => (
            <motion.div
              key={d.productId}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="px-3 py-2.5 border-b border-[var(--pdd-border)] hover:bg-[var(--pdd-bg)]"
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate max-w-[180px]">{d.productName}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      d.score < 40 ? 'bg-pdd-danger/10 text-red-700' :
                      d.score < 70 ? 'bg-pdd-warning/10 text-yellow-700' :
                      'bg-pdd-success/10 text-green-700'
                    }`}>
                      {getScoreLabel(d.score)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--pdd-text-secondary)] font-mono">ID: {d.productId}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: getScoreColor(d.score) }}>{d.score}</div>
                  <div className="text-[10px] text-[var(--pdd-text-secondary)]">健康分</div>
                </div>
              </div>

              {/* 警告标签 */}
              {d.warnings.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {d.warnings.map((w, wi) => (
                    <span key={wi} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] ${
                      w.type === 'danger' ? 'bg-pdd-danger/10 text-red-700' :
                      w.type === 'warning' ? 'bg-pdd-warning/10 text-yellow-700' :
                      'bg-pdd-info/10 text-blue-700'
                    }`}>
                      {w.type === 'danger' && <AlertTriangle size={10} />}
                      {w.type === 'warning' && <TrendingDown size={10} />}
                      {w.type === 'info' && <TrendingUp size={10} />}
                      {w.message}: {w.value}
                    </span>
                  ))}
                </div>
              )}

              {/* 改进建议 */}
              {d.suggestions.length > 0 && (
                <div className="mb-1.5 text-[10px] text-blue-600 bg-blue-50 rounded px-1.5 py-1">
                  <span className="font-medium">建议: </span>
                  {d.suggestions[0]}
                </div>
              )}

              {/* 关键指标 */}
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                <div className="bg-[var(--pdd-bg)] rounded px-1.5 py-1">
                  <span className="text-[var(--pdd-text-secondary)]">利润率</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.profitRate >= 0 ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>
                    {d.metrics.profitRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[var(--pdd-bg)] rounded px-1.5 py-1">
                  <span className="text-[var(--pdd-text-secondary)]">退款率</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.refundRate > 15 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>
                    {d.metrics.refundRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[var(--pdd-bg)] rounded px-1.5 py-1">
                  <span className="text-[var(--pdd-text-secondary)]">ROI</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.roi >= 2 ? 'var(--pdd-success)' : d.metrics.roi >= 1 ? 'var(--pdd-warning)' : 'var(--pdd-danger)' }}>
                    {d.metrics.roi > 0 ? `${d.metrics.roi.toFixed(2)}x` : '--'}
                  </div>
                </div>
                <div className="bg-[var(--pdd-bg)] rounded px-1.5 py-1">
                  <span className="text-[var(--pdd-text-secondary)]">推广占比</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.promoCostRatio > 25 ? 'var(--pdd-warning)' : 'var(--pdd-text)' }}>
                    {d.metrics.promoCostRatio.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-[var(--pdd-bg)] rounded px-1.5 py-1">
                  <span className="text-[var(--pdd-text-secondary)]">周转</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.turnoverDays > 30 ? 'var(--pdd-danger)' : d.metrics.turnoverDays > 14 ? 'var(--pdd-warning)' : 'var(--pdd-success)' }}>
                    {d.metrics.turnoverDays < 999 ? `${d.metrics.turnoverDays}天` : '--'}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        {diagnoses.length > 20 && (
          <div className="px-3 py-2 text-center text-xs text-[var(--pdd-text-secondary)] border-t border-[var(--pdd-border)]">
            显示前20个商品，共{diagnoses.length}个
          </div>
        )}
      </div>
    </div>
  );
}

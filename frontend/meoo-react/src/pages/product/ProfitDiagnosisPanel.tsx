import React, { useMemo } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Package, Info } from 'lucide-react';
import type { ProductStat } from '../../components/ProductLinkStats';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { SEMANTIC, CHART } from '../../ui/tokens/colors';

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
    if (score < 40) return SEMANTIC.loss;
    if (score < 70) return SEMANTIC.warning;
    return SEMANTIC.profit;
  };

  const getScoreLabel = (score: number) => {
    if (score < 40) return '高风险';
    if (score < 70) return '需关注';
    return '健康';
  };

  const [showRules, setShowRules] = React.useState(false);
  const [showDistribution, setShowDistribution] = React.useState(false);

  // 评分规则定义
  const scoringRules = [
    { icon: '📊', label: '利润率', threshold: '≥10%', penalty: '亏损扣30分, <10%扣15分', weight: '高' as const },
    { icon: '↩️', label: '退款率', threshold: '≤10%', penalty: '>20%扣25分, >10%扣10分', weight: '高' as const },
    { icon: '🛡️', label: '售后率', threshold: '≤15%', penalty: '>30%扣20分, >15%扣10分', weight: '中' as const },
    { icon: '🎯', label: '推广ROI', threshold: '≥2x', penalty: '<1x扣20分, <2x扣10分', weight: '中' as const },
    { icon: '📈', label: '推广依赖', threshold: '≤30%', penalty: '>30%扣10分', weight: '中' as const },
    { icon: '💰', label: '客单价', threshold: '≥¥20', penalty: '<¥20扣0分(仅提示)', weight: '低' as const },
    { icon: '🔄', label: '周转天数', threshold: '≤30天', penalty: '>60天扣15分, >30天扣8分', weight: '中' as const },
    { icon: '📦', label: '库存风险', threshold: '≥3天', penalty: '库存不足扣10分', weight: '中' as const },
    { icon: '📋', label: '成本可信', threshold: '已配置', penalty: '未配置扣0分(仅提示)', weight: '低' as const },
  ];

  // 各因子触发统计（用于展示整体扣分分布）
  const factorStats = useMemo(() => {
    const counts: Record<string, { danger: number; warning: number; info: number }> = {};
    // 消息→规则标签映射
    const msgToRule: Record<string, string> = {
      '商品亏损': '利润率', '利润率偏低': '利润率', '利润率优秀': '利润率',
      '退款率过高': '退款率', '退款率偏高': '退款率',
      '售后率过高': '售后率', '售后率偏高': '售后率',
      '推广ROI亏损': '推广ROI', '推广ROI偏低': '推广ROI',
      '推广依赖度高': '推广依赖',
      '客单价较低': '客单价',
      '周转严重滞后': '周转天数', '周转偏慢': '周转天数',
      '库存不足预警': '库存风险', '长期零动销': '库存风险', '短期零动销': '库存风险',
      '未配置成本': '成本可信',
    };
    diagnoses.forEach(d => {
      d.warnings.forEach(w => {
        const key = msgToRule[w.message] || w.message;
        if (!counts[key]) counts[key] = { danger: 0, warning: 0, info: 0 };
        counts[key][w.type]++;
      });
    });
    return counts;
  }, [diagnoses]);

  if (diagnoses.length === 0) {
    return (
      <Card className="p-6 text-center">
        <CardContent className="p-0">
          <Package size={32} className="mx-auto mb-2 text-pdd-text-secondary/50" />
          <p className="text-sm text-pdd-text-secondary">暂无商品数据</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* 评分规则说明 — 可折叠玻璃卡片 */}
      <Card className="overflow-hidden border-pdd-border/60">
        <button onClick={() => setShowRules(!showRules)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-pdd-text hover:bg-gradient-to-r hover:from-blue-50/30 hover:to-transparent transition-all duration-200">
          <span className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-md bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center">
              <Info size={10} className="text-white" />
            </div>
            评分规则说明（9项检查，满分100分）
          </span>
          <span className={'transition-transform duration-200 text-pdd-text-secondary/50 ' + (showRules ? 'rotate-180' : '')}>▼</span>
        </button>
        {showRules && (
          <div className="border-t border-pdd-border/50 p-3 bg-gradient-to-br from-blue-50/20 to-indigo-50/10">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 text-[10px]">
              {scoringRules.map((rule, i) => (
                <div key={i} className="bg-white/60 backdrop-blur-sm rounded-lg p-2 flex items-start gap-2 border border-pdd-border/30 hover:border-blue-200/40 transition-colors">
                  <span className="text-xs shrink-0">{rule.icon}</span>
                  <div className="min-w-0">
                    <div className="font-medium text-pdd-text">{rule.label}</div>
                    <div className="text-pdd-text-secondary/70 mt-0.5">{rule.penalty}</div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-pdd-text-secondary/50">阈值:</span>
                      <span className="font-semibold" style={{ color: rule.weight === '高' ? SEMANTIC.loss : rule.weight === '中' ? SEMANTIC.warning : 'var(--pdd-text-secondary)' }}>{rule.threshold}</span>
                      <Badge variant={rule.weight === '高' ? 'destructive' : rule.weight === '中' ? 'secondary' : 'outline'} className="text-[9px] h-4 px-1 ml-1">{rule.weight}权重</Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* 汇总卡片 + 分布可视化 — 带渐变背景 */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-400 to-blue-600" />
          <CardContent className="p-3">
            <div className="text-xs text-pdd-text-secondary/50 mb-1">商品总数</div>
            <div className="text-lg font-bold text-pdd-text">{summary.total}</div>
          </CardContent>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden group" onClick={() => setShowDistribution(!showDistribution)}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-400 to-red-600 group-hover:h-1.5 transition-all" />
          <CardContent className="p-3">
            <div className="text-xs text-pdd-text-secondary/50 mb-1">高风险</div>
            <div className="text-lg font-bold" style={{ color: SEMANTIC.loss }}>{summary.dangerCount}</div>
            {summary.total > 0 && (
              <div className="text-[10px] text-pdd-text-secondary/50">{((summary.dangerCount / summary.total) * 100).toFixed(0)}%</div>
            )}
          </CardContent>
        </Card>
        <Card className="text-center cursor-pointer hover:shadow-lg transition-all duration-300 relative overflow-hidden group" onClick={() => setShowDistribution(!showDistribution)}>
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-amber-600 group-hover:h-1.5 transition-all" />
          <CardContent className="p-3">
            <div className="text-xs text-pdd-text-secondary/50 mb-1">需关注</div>
            <div className="text-lg font-bold" style={{ color: SEMANTIC.warning }}>{summary.warningCount}</div>
            {summary.total > 0 && (
              <div className="text-[10px] text-pdd-text-secondary/50">{((summary.warningCount / summary.total) * 100).toFixed(0)}%</div>
            )}
          </CardContent>
        </Card>
        <Card className="text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r" style={{ background: `linear-gradient(90deg, ${getScoreColor(summary.avgScore)}, ${getScoreColor(summary.avgScore)}88)` }} />
          <CardContent className="p-3">
            <div className="text-xs text-pdd-text-secondary/50 mb-1">平均健康分</div>
            <div className="text-lg font-bold" style={{ color: getScoreColor(summary.avgScore) }}>{summary.avgScore.toFixed(0)}</div>
            <div className="text-[10px] mt-0.5 flex items-center justify-center gap-1">
              <span style={{ color: SEMANTIC.profit }}>{summary.healthyCount}健康</span>
              <span className="text-pdd-text-secondary/30">·</span>
              <span style={{ color: SEMANTIC.warning }}>{summary.warningCount}关注</span>
              <span className="text-pdd-text-secondary/30">·</span>
              <span style={{ color: SEMANTIC.loss }}>{summary.dangerCount}风险</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 展开的分数分布条 */}
      {showDistribution && summary.total > 0 && (
        <Card className="p-3 border-pdd-border/60 bg-gradient-to-br from-pdd-bg/80 to-white/50">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-pdd-text">分数分布</span>
              <span className="text-[10px] text-pdd-text-secondary/50">共{summary.total}个商品</span>
            </div>
            <div className="flex h-5 rounded-full overflow-hidden text-[10px] font-medium shadow-inner">
              {summary.dangerCount > 0 && (
                <div className="flex items-center justify-center text-white" style={{ width: `${(summary.dangerCount / summary.total) * 100}%`, backgroundColor: SEMANTIC.loss }}>
                  {summary.dangerCount > 1 ? `${summary.dangerCount}` : ''}
                </div>
              )}
              {summary.warningCount > 0 && (
                <div className="bg-amber-500 flex items-center justify-center text-white" style={{ width: `${(summary.warningCount / summary.total) * 100}%` }}>
                  {summary.warningCount > 1 ? `${summary.warningCount}` : ''}
                </div>
              )}
              {summary.healthyCount > 0 && (
                <div className="flex items-center justify-center text-white" style={{ width: `${(summary.healthyCount / summary.total) * 100}%`, backgroundColor: SEMANTIC.profit }}>
                  {summary.healthyCount > 1 ? `${summary.healthyCount}` : ''}
                </div>
              )}
            </div>
            <div className="flex justify-center gap-3 mt-1 text-[10px] text-pdd-text-secondary/50">
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: SEMANTIC.loss }} />高风险 &lt;40分</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: SEMANTIC.warning }} />需关注 40-69分</span>
              <span><span className="inline-block w-2 h-2 rounded-full mr-1" style={{ backgroundColor: SEMANTIC.profit }} />健康 ≥70分</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 扣分因子分布 */}
      {Object.keys(factorStats).length > 0 && (
        <Card className="p-3 border-pdd-border/60">
          <CardContent className="p-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-pdd-text flex items-center gap-1.5">
                <div className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center">
                  <Activity size={10} className="text-white" />
                </div>
                扣分因子分布
              </span>
              <span className="text-[10px] text-pdd-text-secondary/50">各因子触发次数</span>
            </div>
            <div className="space-y-1.5">
              {Object.entries(factorStats).map(([factor, counts]) => {
                const total = counts.danger + counts.warning + counts.info;
                const totalDiagnoses = diagnoses.length;
                const pct = totalDiagnoses > 0 ? ((total / totalDiagnoses) * 100).toFixed(0) : '0';
                return (
                  <div key={factor} className="flex items-center gap-2 text-[11px]">
                    <span className="w-20 text-right font-medium text-pdd-text truncate" title={factor}>{factor}</span>
                    <div className="flex-1 h-4 bg-pdd-border/20 rounded-sm overflow-hidden flex shadow-inner">
                      {counts.danger > 0 && <div style={{ width: `${(counts.danger / total) * 100}%`, backgroundColor: SEMANTIC.loss }} />}
                      {counts.warning > 0 && <div className="bg-amber-500" style={{ width: `${(counts.warning / total) * 100}%` }} />}
                      {counts.info > 0 && <div style={{ width: `${(counts.info / total) * 100}%`, backgroundColor: SEMANTIC.info, opacity: 0.4 }} />}
                    </div>
                    <span className="w-8 text-right text-pdd-text-secondary/70">{pct}%</span>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-1 text-[9px] text-pdd-text-secondary/50">
              <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ backgroundColor: SEMANTIC.loss }} /> 严重</span>
              <span><span className="inline-block w-2 h-2 rounded-sm mr-0.5" style={{ backgroundColor: SEMANTIC.warning }} /> 警告</span>
              <span><span className="inline-block w-2 h-2 bg-pdd-primary/40 rounded-sm mr-0.5" /> 提示</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 利润率分层 */}
      <div className="grid grid-cols-4 gap-1.5 text-[10px]">
        <div className="bg-green-50 rounded p-1.5 text-center border border-green-200">
          <span className="text-pdd-success font-medium">高利润 ≥20%</span>
          <div className="font-bold text-pdd-success text-sm mt-0.5">{summary.profitTiers.high}</div>
        </div>
        <div className="bg-blue-50 rounded p-1.5 text-center border border-blue-200">
          <span className="text-pdd-primary font-medium">中等 5-20%</span>
          <div className="font-bold text-pdd-primary text-sm mt-0.5">{summary.profitTiers.mid}</div>
        </div>
        <div className="bg-amber-50 rounded p-1.5 text-center border border-amber-200">
          <span className="text-amber-600 font-medium">微利 0-5%</span>
          <div className="font-bold text-amber-600 text-sm mt-0.5">{summary.profitTiers.low}</div>
        </div>
        <div className="bg-red-50 rounded p-1.5 text-center border border-red-200">
          <span className="text-pdd-danger font-medium">亏损</span>
          <div className="font-bold text-pdd-danger text-sm mt-0.5">{summary.profitTiers.loss}</div>
        </div>
      </div>

      {/* 商品诊断列表 */}
      <Card className="overflow-hidden">
        <CardHeader className="px-3 py-2 border-b border-pdd-border bg-pdd-bg/50">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity size={14} className="text-pdd-primary" />
            商品盈利诊断
          </CardTitle>
        </CardHeader>
        <div className="max-h-[400px] overflow-y-auto">
          {diagnoses.slice(0, 20).map((d, i) => (
            <div
              key={d.productId}
              className="px-3 py-2.5 border-b border-pdd-border/50 hover:bg-pdd-bg/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-1.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate max-w-[180px] text-pdd-text">{d.productName}</span>
                    <Badge variant={d.score < 40 ? 'destructive' : d.score < 70 ? 'secondary' : 'default'} className="text-[10px] h-5 px-1.5">
                      {getScoreLabel(d.score)}
                    </Badge>
                  </div>
                  <span className="text-[10px] text-pdd-text-secondary/40 font-mono">ID: {d.productId}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold" style={{ color: getScoreColor(d.score) }}>{d.score}</div>
                  <div className="text-[10px] text-pdd-text-secondary/50">健康分</div>
                </div>
              </div>

              {/* 警告标签 */}
              {d.warnings.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1.5">
                  {d.warnings.map((w, wi) => (
                    <Badge key={wi} variant={w.type === 'danger' ? 'destructive' : w.type === 'warning' ? 'secondary' : 'outline'} className="text-[10px] h-5 gap-0.5">
                      {w.type === 'danger' && <AlertTriangle size={10} />}
                      {w.type === 'warning' && <TrendingDown size={10} />}
                      {w.type === 'info' && <TrendingUp size={10} />}
                      {w.message}: {w.value}
                    </Badge>
                  ))}
                </div>
              )}

              {/* 改进建议 */}
              {d.suggestions.length > 0 && (
                <div className="mb-1.5 text-[10px] text-pdd-primary bg-pdd-primary/10 rounded px-1.5 py-1">
                  <span className="font-medium">建议: </span>
                  {d.suggestions[0]}
                </div>
              )}

              {/* 关键指标 */}
              <div className="grid grid-cols-5 gap-1 text-[10px]">
                <div className="bg-pdd-bg/50 rounded px-1.5 py-1">
                  <span className="text-pdd-text-secondary/60">利润率</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.profitRate >= 0 ? SEMANTIC.profit : SEMANTIC.loss }}>
                    {d.metrics.profitRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-pdd-bg/50 rounded px-1.5 py-1">
                  <span className="text-pdd-text-secondary/60">退款率</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.refundRate > 15 ? SEMANTIC.loss : 'var(--pdd-text)' }}>
                    {d.metrics.refundRate.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-pdd-bg/50 rounded px-1.5 py-1">
                  <span className="text-pdd-text-secondary/60">ROI</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.roi >= 2 ? SEMANTIC.profit : d.metrics.roi >= 1 ? SEMANTIC.warning : SEMANTIC.loss }}>
                    {d.metrics.roi > 0 ? `${d.metrics.roi.toFixed(2)}x` : '--'}
                  </div>
                </div>
                <div className="bg-pdd-bg/50 rounded px-1.5 py-1">
                  <span className="text-pdd-text-secondary/60">推广占比</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.promoCostRatio > 25 ? SEMANTIC.warning : 'var(--pdd-text)' }}>
                    {d.metrics.promoCostRatio.toFixed(1)}%
                  </div>
                </div>
                <div className="bg-pdd-bg/50 rounded px-1.5 py-1">
                  <span className="text-pdd-text-secondary/60">周转</span>
                  <div className="font-mono font-medium" style={{ color: d.metrics.turnoverDays > 30 ? SEMANTIC.loss : d.metrics.turnoverDays > 14 ? SEMANTIC.warning : SEMANTIC.profit }}>
                    {d.metrics.turnoverDays < 999 ? `${d.metrics.turnoverDays}天` : '--'}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {diagnoses.length > 20 && (
          <div className="px-3 py-2 text-center text-xs text-pdd-text-secondary/50 border-t border-pdd-border/50">
            显示前20个商品，共{diagnoses.length}个
          </div>
        )}
      </Card>
    </div>
  );
}

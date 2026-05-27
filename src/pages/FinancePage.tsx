import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DollarSign, TrendingUp, TrendingDown, FileText, Search, Download,
  ChevronDown, ChevronRight, CreditCard, AlertCircle, BarChart3,
  PieChart, Calculator, Zap, Shield, RefreshCw
} from 'lucide-react';
import { useData } from '../App';
import { useTimeFilter } from '../components/TimeFilter';
import { sf, exportCSV, findField } from '../utils';
import {
  buildFinancialIndex, getBestPlatformFee, getBestInsuranceFee,
  getPenaltyFees, getMarketingFees, isSubsidyOrder, getSuggestedCommissionRate
} from '../utils/financialActuals';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

type FinanceTab = 'compare' | 'subsidy' | 'penalties' | 'calibrate';

const PIE_COLORS = ['var(--pdd-success)', 'var(--pdd-info)', '#6366f1', 'var(--pdd-danger)', 'var(--pdd-warning)', '#ef4444', '#8b5cf6'];

const TABS: { key: FinanceTab; label: string; icon: any }[] = [
  { key: 'compare', label: '对比校准', icon: BarChart3 },
  { key: 'subsidy', label: '百亿补贴', icon: Zap },
  { key: 'penalties', label: '扣款记录', icon: AlertCircle },
  { key: 'calibrate', label: '费率校准', icon: Calculator },
];

export default function FinancePage() {
  const { currentDisplayData, orderFinancialActuals, unlinkedFinancials, platformCommissionRate, setPlatformCommissionRate, insuranceFeePerOrder } = useData();
  const financialRecords = currentDisplayData?.financialRecords || [];
  const orders = currentDisplayData?.orders || [];
  const tf = useTimeFilter('30', 'day');

  const [activeTab, setActiveTab] = useState<FinanceTab>('compare');
  const [searchOrder, setSearchOrder] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [expandedPenaltyTypes, setExpandedPenaltyTypes] = useState<Set<string>>(new Set());

  const toggleExpand = (orderNo: string) => {
    setExpandedOrders(prev => { const n = new Set(prev); if (n.has(orderNo)) n.delete(orderNo); else n.add(orderNo); return n; });
  };
  const togglePenaltyType = (type: string) => {
    setExpandedPenaltyTypes(prev => { const n = new Set(prev); if (n.has(type)) n.delete(type); else n.add(type); return n; });
  };

  // ======================== 订单财务匹配 ========================

  // 为订单数据构建 orderNo -> order record 索引
  const orderRecordMap = useMemo(() => {
    const map: Record<string, any> = {};
    orders.forEach((o: any) => {
      const no = String(findField(o, '订单号') || '').trim();
      if (no) map[no] = o;
    });
    return map;
  }, [orders]);

  // 订单对比数据：公式估算 vs 实际财务
  const comparisonData = useMemo(() => {
    if (!orders.length || !Object.keys(orderFinancialActuals).length) return [];

    const results: any[] = [];
    const seen = new Set<string>();

    orders.forEach((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      if (!orderNo || seen.has(orderNo)) return;
      seen.add(orderNo);

      const merchantReceived = parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0;
      const productName = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
      const actual = orderFinancialActuals[orderNo];

      // 公式估算
      const formulaPlatformFee = merchantReceived * (platformCommissionRate / 100);
      const formulaInsuranceFee = (insuranceFeePerOrder || 0);

      // 实际数据
      const actualPlatformFee = actual?.hasData ? (actual.baseTechFee + actual.subTechFee) : 0;
      const actualInsuranceFee = actual?.hasData ? actual.shippingInsurance : 0;
      const actualPenalties = actual?.penalties ?? 0;
      const actualMarketing = actual?.marketingFees ?? 0;
      const hasActual = actual?.hasData ?? false;

      const platformDiff = formulaPlatformFee - actualPlatformFee;
      const insuranceDiff = formulaInsuranceFee - actualInsuranceFee;
      const totalDiff = (formulaPlatformFee + formulaInsuranceFee) - (actualPlatformFee + actualInsuranceFee + actualPenalties + actualMarketing);

      results.push({
        orderNo, productName, merchantReceived, hasActual,
        formulaPlatformFee, actualPlatformFee, platformDiff,
        formulaInsuranceFee, actualInsuranceFee, insuranceDiff,
        actualPenalties, actualMarketing, totalDiff,
        isSubsidy: isSubsidyOrder(orderNo, orderFinancialActuals),
      });
    });

    return results.sort((a, b) => Math.abs(b.totalDiff) - Math.abs(a.totalDiff));
  }, [orders, orderFinancialActuals, platformCommissionRate, insuranceFeePerOrder]);

  // 对比汇总 KPI
  const compareKPI = useMemo(() => {
    let totalFormula = 0, totalActual = 0;
    let countWithActual = 0;
    comparisonData.forEach(c => {
      totalFormula += c.formulaPlatformFee + c.formulaInsuranceFee;
      totalActual += c.actualPlatformFee + c.actualInsuranceFee + c.actualPenalties + c.actualMarketing;
      if (c.hasActual) countWithActual++;
    });
    return {
      totalFormula, totalActual,
      diff: totalFormula - totalActual,
      countWithActual,
      totalOrders: comparisonData.length,
      avgErrorRate: totalFormula > 0 ? ((totalActual - totalFormula) / totalFormula) * 100 : 0,
    };
  }, [comparisonData]);

  // 过滤搜索
  const filteredComparison = useMemo(() => {
    if (!searchOrder.trim()) return comparisonData;
    const q = searchOrder.trim();
    return comparisonData.filter(c => c.orderNo.includes(q) || c.productName.includes(q));
  }, [comparisonData, searchOrder]);

  // ======================== 百亿补贴分析 ========================

  const subsidyAnalysis = useMemo(() => {
    const results: any[] = [];
    const seen = new Set<string>();

    orders.forEach((o: any) => {
      const orderNo = String(findField(o, '订单号') || '').trim();
      if (!orderNo || seen.has(orderNo)) return;
      seen.add(orderNo);

      if (!isSubsidyOrder(orderNo, orderFinancialActuals)) return;

      const merchantReceived = parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0;
      const productName = String(findField(o, '商品', '商品名称') || '').slice(0, 30);
      const actual = orderFinancialActuals[orderNo];

      results.push({
        orderNo, productName, merchantReceived,
        baseTechFee: actual?.baseTechFee ?? 0,
        subTechFee: actual?.subTechFee ?? 0,
        totalTechFee: (actual?.baseTechFee ?? 0) + (actual?.subTechFee ?? 0),
        effectiveRate: merchantReceived > 0 ? (((actual?.baseTechFee ?? 0) + (actual?.subTechFee ?? 0)) / merchantReceived) * 100 : 0,
      });
    });

    return results.sort((a, b) => b.totalTechFee - a.totalTechFee);
  }, [orders, orderFinancialActuals]);

  const subsidyKPI = useMemo(() => {
    let totalRevenue = 0, totalFee = 0;
    subsidyAnalysis.forEach(s => { totalRevenue += s.merchantReceived; totalFee += s.totalTechFee; });
    return {
      count: subsidyAnalysis.length,
      totalFee,
      effectiveRate: totalRevenue > 0 ? (totalFee / totalRevenue) * 100 : 0,
    };
  }, [subsidyAnalysis]);

  // ======================== 扣款记录 ========================

  const penaltyRecords = useMemo(() => {
    if (!financialRecords.length) return { byType: {}, list: [] as any[] };

    const byType: Record<string, { count: number; total: number; records: any[] }> = {};
    const list: any[] = [];

    financialRecords.forEach((r: any) => {
      const desc = String(r['业务描述'] || '');
      const code = desc.split('|')[0] || '';
      const orderNo = String(r['商户订单号'] || '').trim();
      const inc = sf(r['收入金额（+元）'] || r['收入金额(元)'] || r['收入金额'] || 0);
      const exp = sf(r['支出金额（-元）'] || r['支出金额(元)'] || r['支出金额'] || 0);

      // 004 = 罚款/售后扣款, 006 = 营销费用
      let penaltyType = '';
      if (code.startsWith('004')) {
        const parts = desc.split('|');
        penaltyType = parts[1] || '售后扣款';
        if (penaltyType.includes('延迟发货')) penaltyType = '延迟发货罚款';
        else if (penaltyType.includes('虚假发货')) penaltyType = '虚假发货罚款';
        else if (penaltyType.includes('售后')) penaltyType = '售后补偿扣款';
        else penaltyType = '其他扣款';
      } else if (code.startsWith('006')) {
        penaltyType = '营销费用';
      }
      if (!penaltyType) return;

      const amount = Math.abs(inc + exp);
      if (!byType[penaltyType]) byType[penaltyType] = { count: 0, total: 0, records: [] };
      byType[penaltyType].count++;
      byType[penaltyType].total += amount;
      byType[penaltyType].records.push({
        time: r['发生时间'] || '', orderNo, amount,
        desc: desc.split('|').slice(1).join(' / ') || desc,
      });
      list.push({ penaltyType, time: r['发生时间'] || '', orderNo, amount, desc: desc.split('|').slice(1).join(' / ') || desc });
    });

    // 按时间排序各类型的记录
    Object.values(byType).forEach(t => t.records.sort((a: any, b: any) => b.time.localeCompare(a.time)));

    return { byType, list };
  }, [financialRecords]);

  // ======================== 费率校准 ========================

  const calibration = useMemo(() => {
    return getSuggestedCommissionRate(
      orderFinancialActuals, orders,
      (o: any) => String(findField(o, '订单号') || '').trim(),
      (o: any) => parseFloat(String(findField(o, '商家实收金额(元)', '商家实收金额', '商家实收', '实收金额') || '0').replace(/[^\d.\-]/g, '')) || 0,
    );
  }, [orderFinancialActuals, orders]);

  // ======================== 导出 ========================

  const handleExportCompare = () => {
    const headers = ['订单号', '商品', '实收', '公式佣金', '实际佣金', '佣金差异', '公式运费险', '实际运费险', '运费险差异', '罚款', '营销费', '总差异', '有实际数据'];
    const rows = filteredComparison.map(c => [
      c.orderNo, c.productName, c.merchantReceived.toFixed(2),
      c.formulaPlatformFee.toFixed(2), c.actualPlatformFee.toFixed(2), c.platformDiff.toFixed(2),
      c.formulaInsuranceFee.toFixed(2), c.actualInsuranceFee.toFixed(2), c.insuranceDiff.toFixed(2),
      c.actualPenalties.toFixed(2), c.actualMarketing.toFixed(2), c.totalDiff.toFixed(2),
      c.hasActual ? '是' : '否',
    ]);
    exportCSV(headers, rows as any[][], '财务对比校准');
  };

  const handleExportPenalties = () => {
    const headers = ['类型', '时间', '订单号', '金额', '说明'];
    const rows = penaltyRecords.list.map((p: any) => [p.penaltyType, p.time, p.orderNo, p.amount.toFixed(2), p.desc]);
    exportCSV(headers, rows as any[][], '扣款记录');
  };

  // ======================== Empty State ========================

  if (financialRecords.length === 0) {
    return (
      <div className="min-h-screen p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3 text-pdd-text">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark shadow-lg shadow-pdd-primary/20">
                  <LandmarkIcon size={24} className="text-white" />
                </div>
                财务管理
              </h1>
              <p className="text-sm text-pdd-text-secondary mt-1 ml-1">公式估算 vs 货款明细实际数据对比校准</p>
            </div>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pdd-card text-center py-20">
            <CreditCard size={64} className="mx-auto mb-4 text-pdd-border" />
            <p className="text-lg text-pdd-text-secondary mb-2">暂无货款明细数据</p>
            <p className="text-sm text-pdd-text-secondary mb-4">
              请从拼多多商家后台导出「货款明细」CSV文件，然后通过数据上传导入
            </p>
            <div className="inline-flex items-start gap-2 text-left text-xs text-pdd-text-secondary bg-pdd-bg rounded-xl p-4 border border-pdd-border">
              <AlertCircle size={16} className="text-pdd-warning mt-0.5 flex-shrink-0" />
              <div>货款明细包含每笔订单的实际平台技术服务费、消费者体验提升计划费（运费险）、<br />
              售后罚款、营销扣款等完整资金流水，可用于校准公式估算的准确度</div>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ======================== Main Render ========================

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-pdd-text">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-pdd-primary to-pdd-primary-dark shadow-lg shadow-pdd-primary/20">
                <LandmarkIcon size={24} className="text-white" />
              </div>
              财务管理
            </h1>
            <p className="text-sm text-pdd-text-secondary mt-1 ml-1">
              {comparisonData.length} 个订单 · {compareKPI.countWithActual} 个有货款明细
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 bg-pdd-card rounded-xl p-1 border border-pdd-border w-fit">
          {TABS.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-pdd-primary text-white shadow-lg shadow-pdd-primary/20'
                  : 'text-pdd-text-secondary hover:text-pdd-text'
              }`}>
              <tab.icon size={16} /> {tab.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ======================== TAB 1: 对比校准 ======================== */}
          {activeTab === 'compare' && (
            <motion.div key="compare" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* KPI */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                {[
                  { label: '公式估算成本', value: `¥${compareKPI.totalFormula.toFixed(2)}`, icon: Calculator, color: 'var(--pdd-info)' },
                  { label: '实际成本', value: `¥${compareKPI.totalActual.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-warning)' },
                  { label: '差异', value: `${compareKPI.diff >= 0 ? '+' : ''}¥${compareKPI.diff.toFixed(2)}`, icon: TrendingUp,
                    color: compareKPI.diff > 0 ? 'var(--pdd-success)' : compareKPI.diff < 0 ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' },
                  { label: '有实际数据', value: `${compareKPI.countWithActual} / ${compareKPI.totalOrders}`, icon: Shield, color: 'var(--pdd-success)' },
                ].map(card => (
                  <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className="pdd-card p-4 hover:border-pdd-border transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <card.icon size={18} style={{ color: card.color }} />
                      <span className="text-xs text-pdd-text-secondary">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-pdd-text">{card.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* 误差率提示 */}
              {compareKPI.countWithActual > 0 && (
                <div className={`p-4 rounded-xl border mb-6 flex items-start gap-3 ${
                  Math.abs(compareKPI.avgErrorRate) < 5 ? 'bg-pdd-success/5 border-pdd-success/20' :
                  Math.abs(compareKPI.avgErrorRate) < 15 ? 'bg-pdd-warning/5 border-pdd-warning/20' :
                  'bg-pdd-danger/5 border-pdd-danger/20'
                }`}>
                  <AlertCircle size={18} className={Math.abs(compareKPI.avgErrorRate) < 5 ? 'text-pdd-success' : Math.abs(compareKPI.avgErrorRate) < 15 ? 'text-pdd-warning' : 'text-pdd-danger'} />
                  <div>
                    <p className="text-sm font-medium text-pdd-text">
                      平均误差率：{compareKPI.avgErrorRate >= 0 ? '+' : ''}{compareKPI.avgErrorRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      {compareKPI.avgErrorRate < 0
                        ? '公式低估了实际成本（实际扣费比公式估算更多），建议到费率校准页调整参数。'
                        : '公式高估了成本（公式估算偏保守），当前费率配置相对安全。'}
                    </p>
                  </div>
                </div>
              )}

              {/* Search + Export */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-[300px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
                  <input type="text" placeholder="搜索订单号或商品名..."
                    value={searchOrder} onChange={e => setSearchOrder(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-pdd-border rounded-xl bg-pdd-bg text-pdd-text focus:outline-none focus:border-pdd-primary transition-colors" />
                </div>
                <button onClick={handleExportCompare}
                  className="flex items-center gap-2 px-4 py-2 bg-pdd-primary/20 text-pdd-primary-light border border-pdd-primary/20 rounded-xl hover:bg-pdd-primary/30 transition-all text-sm">
                  <Download size={14} /> 导出CSV
                </button>
              </div>

              {/* Comparison Table */}
              <div className="pdd-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pdd-border bg-pdd-bg">
                        <th className="text-left px-3 py-3 text-pdd-text-secondary font-medium">订单号</th>
                        <th className="text-left px-3 py-3 text-pdd-text-secondary font-medium">商品</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">实收</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">公式佣金</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">实际佣金</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">佣金差异</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">实际运费险</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">实际罚款</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">实际营销</th>
                        <th className="text-right px-3 py-3 text-pdd-text-secondary font-medium">总差异</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredComparison.slice(0, 300).map(c => (
                        <tr key={c.orderNo} className={`border-b border-pdd-border hover:bg-pdd-bg transition-colors ${!c.hasActual ? 'opacity-50' : ''}`}>
                          <td className="px-3 py-2 font-mono text-xs text-pdd-text">
                            {c.orderNo}
                            {c.isSubsidy && <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-pdd-warning/10 text-pdd-warning">补贴</span>}
                            {!c.hasActual && <span className="ml-1 px-1 py-0.5 rounded text-[9px] bg-pdd-bg text-pdd-text-secondary">公式</span>}
                          </td>
                          <td className="px-3 py-2 text-pdd-text-secondary max-w-[150px] truncate">{c.productName}</td>
                          <td className="px-3 py-2 text-right font-mono text-pdd-text">¥{c.merchantReceived.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono text-pdd-text-secondary">¥{c.formulaPlatformFee.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{c.hasActual ? `¥${c.actualPlatformFee.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: c.platformDiff > 0 ? 'var(--pdd-success)' : c.platformDiff < 0 ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' }}>
                            {c.hasActual ? `${c.platformDiff >= 0 ? '+' : ''}¥${c.platformDiff.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-pdd-text-secondary">{c.actualInsuranceFee > 0 ? `¥${c.actualInsuranceFee.toFixed(2)}` : '-'}</td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: c.actualPenalties > 0 ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' }}>
                            {c.actualPenalties > 0 ? `¥${c.actualPenalties.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono" style={{ color: c.actualMarketing > 0 ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' }}>
                            {c.actualMarketing > 0 ? `¥${c.actualMarketing.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-3 py-2 text-right font-bold font-mono" style={{ color: c.totalDiff > 0 ? 'var(--pdd-success)' : c.totalDiff < 0 ? 'var(--pdd-danger)' : 'var(--pdd-text-secondary)' }}>
                            {c.hasActual ? `${c.totalDiff >= 0 ? '+' : ''}¥${c.totalDiff.toFixed(2)}` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {filteredComparison.length === 0 && (
                  <div className="text-center py-12 text-pdd-text-secondary">未找到匹配的订单</div>
                )}
                {filteredComparison.length > 300 && (
                  <div className="text-center py-3 text-xs text-pdd-text-secondary border-t border-pdd-border">
                    仅显示前 300 条，共 {filteredComparison.length} 条
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex items-center gap-4 mt-3 text-xs text-pdd-text-secondary">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--pdd-success)' }} /> 公式高估（安全）</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded" style={{ backgroundColor: 'var(--pdd-danger)' }} /> 公式低估（风险）</span>
                <span>半透明行 = 仅有公式估算，无实际数据</span>
              </div>
            </motion.div>
          )}

          {/* ======================== TAB 2: 百亿补贴分析 ======================== */}
          {activeTab === 'subsidy' && (
            <motion.div key="subsidy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* KPI */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: '百亿补贴订单数', value: String(subsidyKPI.count), icon: Zap, color: 'var(--pdd-warning)' },
                  { label: '补贴订单技服费合计', value: `¥${subsidyKPI.totalFee.toFixed(2)}`, icon: DollarSign, color: 'var(--pdd-danger)' },
                  { label: '实际技服费率', value: `${subsidyKPI.effectiveRate.toFixed(2)}%`, icon: TrendingUp, color: subsidyKPI.effectiveRate > platformCommissionRate ? 'var(--pdd-danger)' : 'var(--pdd-success)' },
                ].map(card => (
                  <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className="pdd-card p-4 hover:border-pdd-border transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <card.icon size={18} style={{ color: card.color }} />
                      <span className="text-xs text-pdd-text-secondary">{card.label}</span>
                    </div>
                    <p className="text-2xl font-bold text-pdd-text">{card.value}</p>
                  </motion.div>
                ))}
              </div>

              {/* 警告 */}
              {subsidyKPI.count > 0 && subsidyKPI.effectiveRate > platformCommissionRate + 1 && (
                <div className="p-4 rounded-xl border mb-6 bg-pdd-danger/5 border-pdd-danger/20 flex items-start gap-3">
                  <AlertCircle size={18} className="text-pdd-danger" />
                  <div>
                    <p className="text-sm font-medium text-pdd-text">百亿补贴实际技服费率远高于当前配置</p>
                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      当前配置佣金率为 {platformCommissionRate}%，但百亿补贴订单实际技服费率达 {subsidyKPI.effectiveRate.toFixed(1)}%（含基础 + 百亿补贴两部分）。
                      公式估算时不知道百亿补贴的存在，导致这些订单的利润被大幅高估。建议到「费率校准」页查看建议值。
                    </p>
                  </div>
                </div>
              )}

              {/* Table */}
              {subsidyAnalysis.length > 0 ? (
                <div className="pdd-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-pdd-border bg-pdd-bg">
                          <th className="text-left px-4 py-3 text-pdd-text-secondary font-medium">订单号</th>
                          <th className="text-left px-4 py-3 text-pdd-text-secondary font-medium">商品</th>
                          <th className="text-right px-4 py-3 text-pdd-text-secondary font-medium">实收</th>
                          <th className="text-right px-4 py-3 text-pdd-text-secondary font-medium">基础技服费</th>
                          <th className="text-right px-4 py-3 text-pdd-text-secondary font-medium">百亿补贴技服费</th>
                          <th className="text-right px-4 py-3 text-pdd-text-secondary font-medium">合计技服费</th>
                          <th className="text-right px-4 py-3 text-pdd-text-secondary font-medium">实际费率</th>
                        </tr>
                      </thead>
                      <tbody>
                        {subsidyAnalysis.map(s => (
                          <tr key={s.orderNo} className="border-b border-pdd-border hover:bg-pdd-bg transition-colors">
                            <td className="px-4 py-2 font-mono text-xs text-pdd-text">{s.orderNo}</td>
                            <td className="px-4 py-2 text-pdd-text-secondary max-w-[200px] truncate">{s.productName}</td>
                            <td className="px-4 py-2 text-right font-mono text-pdd-text">¥{s.merchantReceived.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono text-pdd-text-secondary">¥{s.baseTechFee.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--pdd-warning)' }}>¥{s.subTechFee.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold" style={{ color: 'var(--pdd-danger)' }}>¥{s.totalTechFee.toFixed(2)}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold" style={{ color: s.effectiveRate > 5 ? 'var(--pdd-danger)' : 'var(--pdd-text)' }}>
                              {s.effectiveRate.toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="pdd-card text-center py-12 text-pdd-text-secondary">
                  没有检测到百亿补贴订单（无 0030003 扣费记录）
                </div>
              )}
            </motion.div>
          )}

          {/* ======================== TAB 3: 扣款记录 ======================== */}
          {activeTab === 'penalties' && (
            <motion.div key="penalties" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* KPI */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  { label: '扣款类型数', value: String(Object.keys(penaltyRecords.byType).length), color: 'var(--pdd-info)' },
                  { label: '扣款总笔数', value: String(penaltyRecords.list.length), color: 'var(--pdd-warning)' },
                  { label: '扣款总金额', value: `¥${Object.values(penaltyRecords.byType).reduce((s: number, t: any) => s + t.total, 0).toFixed(2)}`, color: 'var(--pdd-danger)' },
                ].map(card => (
                  <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    className="pdd-card p-4 hover:border-pdd-border transition-all">
                    <p className="text-xs text-pdd-text-secondary mb-1">{card.label}</p>
                    <p className="text-2xl font-bold" style={{ color: card.color }}>{card.value}</p>
                  </motion.div>
                ))}
              </div>

              {penaltyRecords.list.length > 0 ? (
                <>
                  <div className="flex items-center gap-4 mb-4">
                    <button onClick={handleExportPenalties}
                      className="flex items-center gap-2 px-4 py-2 bg-pdd-primary/20 text-pdd-primary-light border border-pdd-primary/20 rounded-xl hover:bg-pdd-primary/30 transition-all text-sm">
                      <Download size={14} /> 导出全部扣款记录
                    </button>
                  </div>

                  {/* 按类型分组 */}
                  {Object.entries(penaltyRecords.byType).map(([type, data]: [string, any]) => {
                    const isExpanded = expandedPenaltyTypes.has(type);
                    return (
                      <div key={type} className="pdd-card mb-4 overflow-hidden">
                        <div
                          onClick={() => togglePenaltyType(type)}
                          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-pdd-bg transition-colors border-b border-pdd-border"
                        >
                          <div className="flex items-center gap-3">
                            {isExpanded ? <ChevronDown size={16} className="text-pdd-primary-light" /> : <ChevronRight size={16} className="text-pdd-text-secondary" />}
                            <span className="font-medium text-pdd-text">{type}</span>
                            <span className="text-xs text-pdd-text-secondary">{data.count} 笔</span>
                          </div>
                          <span className="font-bold font-mono text-sm" style={{ color: 'var(--pdd-danger)' }}>-¥{data.total.toFixed(2)}</span>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-pdd-border bg-pdd-bg">
                                    <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">时间</th>
                                    <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">订单号</th>
                                    <th className="text-right px-4 py-2 text-pdd-text-secondary font-medium">金额</th>
                                    <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">说明</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {data.records.map((r: any, i: number) => (
                                    <tr key={i} className="border-b border-pdd-border last:border-0 hover:bg-pdd-bg transition-colors">
                                      <td className="px-4 py-2 text-pdd-text-secondary">{r.time}</td>
                                      <td className="px-4 py-2 font-mono text-xs text-pdd-text">{r.orderNo}</td>
                                      <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--pdd-danger)' }}>-¥{r.amount.toFixed(2)}</td>
                                      <td className="px-4 py-2 text-pdd-text-secondary max-w-[400px] truncate">{r.desc}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </>
              ) : null}

              {/* 未关联订单号的费用（货款明细中无商户订单号的记录） */}
              {unlinkedFinancials && unlinkedFinancials.records.length > 0 && (
                <div className="pdd-card mb-4 overflow-hidden border-pdd-warning/30">
                  <div className="flex items-center justify-between px-4 py-3 bg-pdd-warning/5 border-b border-pdd-warning/20">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={16} className="text-pdd-warning" />
                      <span className="font-medium text-pdd-text">未关联订单的费用</span>
                      <span className="text-xs text-pdd-text-secondary">({unlinkedFinancials.records.length} 条记录无商户订单号)</span>
                    </div>
                    <span className="font-bold font-mono text-sm" style={{ color: 'var(--pdd-danger)' }}>
                      -¥{unlinkedFinancials.records.reduce((s, r) => s + r.amount, 0).toFixed(2)}
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-pdd-border bg-pdd-bg">
                        <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">时间</th>
                        <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">类型</th>
                        <th className="text-right px-4 py-2 text-pdd-text-secondary font-medium">金额</th>
                        <th className="text-left px-4 py-2 text-pdd-text-secondary font-medium">说明</th>
                      </tr>
                    </thead>
                    <tbody>
                      {unlinkedFinancials.records.map((r, i) => (
                        <tr key={i} className="border-b border-pdd-border last:border-0 hover:bg-pdd-bg transition-colors">
                          <td className="px-4 py-2 text-pdd-text-secondary">{r.time}</td>
                          <td className="px-4 py-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-pdd-warning/10 text-pdd-warning">{r.type}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono" style={{ color: 'var(--pdd-danger)' }}>-¥{r.amount.toFixed(2)}</td>
                          <td className="px-4 py-2 text-pdd-text-secondary max-w-[400px] truncate">{r.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {penaltyRecords.list.length === 0 && (!unlinkedFinancials || unlinkedFinancials.records.length === 0) && (
                <div className="pdd-card text-center py-12 text-pdd-text-secondary">
                  未检测到扣款记录（无 004/006 业务描述编码）
                </div>
              )}
            </motion.div>
          )}

          {/* ======================== TAB 4: 费率校准 ======================== */}
          {activeTab === 'calibrate' && (
            <motion.div key="calibrate" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              {/* 当前配置 */}
              <div className="pdd-card p-5 mb-6">
                <h3 className="text-sm font-bold text-pdd-text mb-3">当前配置</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-pdd-text-secondary mb-1">平台佣金率</p>
                    <p className="text-xl font-bold text-pdd-text">{platformCommissionRate}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-pdd-text-secondary mb-1">运费险/单</p>
                    <p className="text-xl font-bold text-pdd-text">¥{insuranceFeePerOrder?.toFixed(2) ?? '0.00'}</p>
                  </div>
                </div>
              </div>

              {/* 建议费率 */}
              {calibration.normalOrders > 0 || calibration.subsidyOrders > 0 ? (
                <>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: '普通订单建议费率', value: `${calibration.normalRate.toFixed(2)}%`,
                        sub: `${calibration.normalOrders} 个有实际数据的普通订单`, color: 'var(--pdd-info)',
                        action: calibration.normalRate > 0 ? () => setPlatformCommissionRate(Math.round(calibration.normalRate * 100) / 100) : undefined },
                      { label: '百亿补贴建议费率', value: `${calibration.subsidyRate.toFixed(2)}%`,
                        sub: `${calibration.subsidyOrders} 个有实际数据的补贴订单`, color: 'var(--pdd-warning)',
                        action: calibration.subsidyRate > 0 ? () => setPlatformCommissionRate(Math.round(calibration.subsidyRate * 100) / 100) : undefined },
                      { label: '综合建议费率', value: `${calibration.overallRate.toFixed(2)}%`,
                        sub: '普通 + 补贴加权平均', color: 'var(--pdd-success)',
                        action: calibration.overallRate > 0 ? () => setPlatformCommissionRate(Math.round(calibration.overallRate * 100) / 100) : undefined },
                    ].map(card => (
                      <motion.div key={card.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                        className="pdd-card p-4 hover:border-pdd-border transition-all">
                        <p className="text-xs text-pdd-text-secondary mb-1">{card.label}</p>
                        <p className="text-2xl font-bold mb-1" style={{ color: card.color }}>{card.value}</p>
                        <p className="text-[10px] text-pdd-text-secondary mb-3">{card.sub}</p>
                        {card.action && (
                          <button onClick={card.action}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-pdd-primary/20 text-pdd-primary-light border border-pdd-primary/20 rounded-lg hover:bg-pdd-primary/30 transition-all text-xs">
                            <RefreshCw size={12} /> 应用此费率
                          </button>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* 说明 */}
                  <div className="pdd-card p-5">
                    <h3 className="text-sm font-bold text-pdd-text mb-3">计算说明</h3>
                    <div className="space-y-2 text-xs text-pdd-text-secondary">
                      <p>· 建议费率基于货款明细中 <b>实际技术服务费 ÷ 商家实收金额</b> 计算得出</p>
                      <p>· <b>普通订单费率</b>：仅包含基础技术服务费 (0030002)，不含百亿补贴订单</p>
                      <p>· <b>百亿补贴费率</b>：包含基础技术服务费 + 百亿补贴技术服务费 (0030003)，通常 5-6%</p>
                      <p>· <b>综合费率</b>：所有有货款明细的订单加权平均，建议作为全局 platformCommissionRate</p>
                      <p className="mt-2 p-2 bg-pdd-bg rounded-lg">
                        <b>注意</b>：当前系统不支持区分普通/百亿补贴两套费率，建议使用综合费率或普通费率作为全局配置。
                        百亿补贴订单的超额技服费会通过货款明细覆盖自动修正（参见「对比校准」Tab）。
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="pdd-card text-center py-12 text-pdd-text-secondary">
                  <p className="mb-2">暂无比对数据</p>
                  <p className="text-xs">需要有货款明细数据且订单中有匹配的订单号才能计算建议费率</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LandmarkIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <svg width={size || 24} height={size || 24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 20 7 4 7 12 2" />
    </svg>
  );
}

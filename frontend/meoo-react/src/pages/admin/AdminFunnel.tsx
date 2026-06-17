import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { RefreshCw, Users, TrendingDown, ArrowRight, Target } from 'lucide-react';
import type { FunnelStep } from '../../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import { useFunnelData } from '../../hooks/useAdminData';

const FUNNEL_COLORS = [
  'var(--pdd-primary)',
  'rgba(31, 107, 255, 0.75)',
  'rgba(31, 107, 255, 0.6)',
  'rgba(31, 107, 255, 0.5)',
  'rgba(31, 107, 255, 0.4)',
  'rgba(31, 107, 255, 0.3)',
  'rgba(31, 107, 255, 0.2)',
];

const FUNNEL_STEP_LABELS: Record<string, string> = {
  register: '注册',
  login: '登录',
  page_view: '页面浏览',
  function_click: '功能点击',
  paywall_view: '付费墙曝光',
  upgrade_click: '升级点击',
  recharge_submit: '充值成功',
};

export default function AdminFunnel() {
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const queryParams = useMemo(() => {
    let start: string, end: string;
    if (timeRange === 'custom' && startDate && endDate) {
      start = startDate; end = endDate;
    } else {
      const now = new Date();
      const s = new Date();
      if (timeRange === '7d') s.setDate(now.getDate() - 7);
      else if (timeRange === '30d') s.setDate(now.getDate() - 30);
      else if (timeRange === '90d') s.setDate(now.getDate() - 90);
      start = s.toISOString().split('T')[0];
      end = now.toISOString().split('T')[0];
    }
    return { startDate: start, endDate: end };
  }, [timeRange, startDate, endDate]);

  const { data: funnelDataRaw, isLoading, refetch } = useFunnelData(queryParams);
  const fd = (funnelDataRaw as FunnelStep[]) || [];

  const maxCount = fd.length > 0 ? Math.max(...fd.map(d => d.user_count)) : 1;
  const firstCount = fd.length > 0 ? fd[0].user_count : 0;
  const lastCount = fd.length > 0 ? fd[fd.length - 1].user_count : 0;
  const overallConversion = firstCount > 0 ? ((lastCount / firstCount) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5">
      <PageHeader
        title="用户路径分析"
        subtitle="分析用户从注册到付费的核心转化路径，定位流失关键环节"
        actions={
          <button onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <RefreshCw size={13} /> 刷新
          </button>
        }
      />

      <FilterPanel
        dateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
        onDateRangeChange={(range) => { setStartDate(range.start); setEndDate(range.end); setTimeRange('custom'); }}
        extraFilters={
          <div className="flex items-center gap-1.5 bg-pdd-card rounded-lg border p-0.5" style={{ borderColor: 'var(--pdd-border)' }}>
            {[
              { label: '近7天', value: '7d' },
              { label: '近30天', value: '30d' },
              { label: '近90天', value: '90d' },
            ].map(opt => (
              <button key={opt.value} onClick={() => setTimeRange(opt.value)}
                className={"px-3 py-1.5 text-xs rounded-md font-medium transition-all " + (timeRange === opt.value ? "text-white shadow-sm" : "hover:bg-gray-50")}
                style={{ backgroundColor: timeRange === opt.value ? 'var(--pdd-primary)' : 'transparent', color: timeRange === opt.value ? 'var(--pdd-card)' : 'var(--pdd-text-secondary)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        }
        onReset={() => { setTimeRange('30d'); setStartDate(''); setEndDate(''); }}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} style={{ color: 'var(--pdd-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>入口用户</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{firstCount.toLocaleString()}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>注册用户数</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={14} style={{ color: 'var(--pdd-success)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>转化终点</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{lastCount.toLocaleString()}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>充值成功数</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown size={14} style={{ color: 'var(--pdd-warning)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>整体转化率</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{overallConversion}%</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>注册 → 充值</div>
        </motion.div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>转化漏斗</h3>
        {isLoading ? (
          <AdminLoading card={false} rows={4} message="加载中..." />
        ) : fd.length > 0 ? (
          <div className="space-y-0">
            <ResponsiveContainer width="100%" height={fd.length * 56 + 40}>
              <BarChart data={fd} layout="vertical" margin={{ left: 80, right: 80, top: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} domain={[0, 'dataMax']} />
                <YAxis type="category" dataKey="step_name" tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} axisLine={false} tickLine={false} width={80}
                  tickFormatter={(val) => FUNNEL_STEP_LABELS[val] || val} />
                <Tooltip
                  formatter={(value: number, name: string, props: any) => [
                    value.toLocaleString(),
                    FUNNEL_STEP_LABELS[props.payload.step_name] || props.payload.step_name,
                  ]}
                  contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                />
                <Bar dataKey="user_count" radius={[0, 4, 4, 0]} maxBarSize={28}>
                  {fd.map((entry, idx) => (
                    <Cell key={entry.step_name} fill={FUNNEL_COLORS[idx % FUNNEL_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Conversion Rate Indicators */}
            <div className="mt-3 space-y-1.5">
              {fd.map((step, idx) => {
                if (idx === 0) return null;
                const prev = fd[idx - 1];
                const rate = prev.user_count > 0 ? ((step.user_count / prev.user_count) * 100).toFixed(1) : '0';
                const drop = prev.user_count > 0 ? (100 - (step.user_count / prev.user_count) * 100).toFixed(1) : '0';
                return (
                  <div key={'rate-' + step.step_name} className="flex items-center gap-2 text-xs px-1">
                    <ArrowRight size={10} style={{ color: 'var(--pdd-gray-400)' }} />
                    <span style={{ color: 'var(--pdd-text-secondary)' }}>{FUNNEL_STEP_LABELS[step.step_name] || step.step_name}</span>
                    <span className="font-medium" style={{ color: 'var(--pdd-success)' }}>转化率 {rate}%</span>
                    <span className={parseFloat(drop) > 50 ? 'font-medium' : ''} style={{ color: parseFloat(drop) > 50 ? 'var(--pdd-danger)' : 'var(--pdd-warning)' }}>
                      流失 {drop}%
                    </span>
                    <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--pdd-gray-100)' }}>
                      <span className="h-full block rounded-full" style={{ width: rate + '%', background: parseFloat(rate) > 50 ? 'var(--pdd-success)' : 'var(--pdd-warning)' }} />
                    </span>
                    <span className="tabular-nums" style={{ color: 'var(--pdd-gray-400)' }}>{step.user_count.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <AdminEmptyState title="暂无漏斗数据" />
        )}
      </div>

      {/* Step Detail Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>各环节数据</h3>
          <ExportButton
            columns={[
              { key: 'step_name', title: '步骤' },
              { key: 'user_count', title: '用户数' },
            ]}
            data={fd}
            filename="转化漏斗数据"
            formatRow={(row) => [
              FUNNEL_STEP_LABELS[row.step_name] || row.step_name,
              String(row.user_count),
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr style={{ background: 'var(--pdd-gray-50)' }}>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>步骤</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>用户数</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>占比</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>步骤转化率</th>
                <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>流失率</th>
                <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>流失等级</th>
              </tr>
            </thead>
            <tbody>
              {fd.map((step, idx) => {
                const prev = idx > 0 ? fd[idx - 1] : null;
                const pct = firstCount > 0 ? ((step.user_count / firstCount) * 100).toFixed(1) : '0';
                const stepRate = prev ? ((step.user_count / prev.user_count) * 100).toFixed(1) : '100.0';
                const drop = prev ? (100 - parseFloat(stepRate)) : 0;
                const level = drop > 50 ? '严重' : drop > 20 ? '较高' : '正常';
                return (
                  <tr key={step.step_name} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ background: FUNNEL_COLORS[idx % FUNNEL_COLORS.length] }} />
                        {FUNNEL_STEP_LABELS[step.step_name] || step.step_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{step.user_count.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{pct}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-success)' }}>{stepRate}%</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: drop > 50 ? 'var(--pdd-danger)' : 'var(--pdd-warning)' }}>{drop.toFixed(1)}%</td>
                    <td className="px-4 py-2.5">
                      <AdminStatusBadge status={level} variant={drop > 50 ? 'danger' : drop > 20 ? 'warning' : 'success'} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

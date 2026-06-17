import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { RefreshCw, Eye, MousePointer, TrendingUp, DollarSign, Users } from 'lucide-react';
import type { PayConversionTrend } from '../../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import StatCard from '../../components/admin/StatCard';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { usePayConversion } from '../../hooks/useAdminData';

export default function AdminPayConversion() {
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

  const { data: payData, isLoading, refetch } = usePayConversion(queryParams);
  const trendData = (payData?.trend as PayConversionTrend[]) || [];

  const sortedTrend = [...trendData].sort((a, b) => a.stat_date.localeCompare(b.stat_date));

  const totalViews = trendData.reduce((s, d) => s + (d.paywall_views || 0), 0);
  const totalClicks = trendData.reduce((s, d) => s + (d.module_clicks || 0), 0);
  const totalDau = trendData.reduce((s, d) => s + (d.dau || 0), 0);
  const viewToClickRate = totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(1) : '0';
  const avgDau = trendData.length > 0 ? Math.round(totalDau / trendData.length) : 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="付费转化分析"
        subtitle="跟踪付费墙曝光与模块点击转化，分析用户付费意愿"
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <StatCard title="付费墙曝光" value={totalViews.toLocaleString()} subtitle="总曝光次数" icon={<Eye size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <StatCard title="模块交互" value={totalClicks.toLocaleString()} subtitle="曝光后模块点击" icon={<MousePointer size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <StatCard title="日均DAU" value={avgDau.toLocaleString()} subtitle="日活跃用户均值" icon={<Users size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <StatCard title="曝光→交互" value={viewToClickRate + '%'} subtitle="点击转化率" icon={<TrendingUp size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard title="日均曝光/用户" value={trendData.length > 0 && totalDau > 0 ? (totalViews / totalDau * avgDau / trendData.length).toFixed(1) : '-'} subtitle="每用户曝光次数" icon={<DollarSign size={16} />} loading={isLoading} />
        </motion.div>
      </div>

      {/* Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3 bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>曝光与交互趋势</h3>
          {sortedTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={sortedTrend}>
                <defs>
                  <linearGradient id="pGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="stat_date" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="paywall_views" name="付费墙曝光" stroke="var(--pdd-primary)" fill="url(#pGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="module_clicks" name="模块交互" stroke="var(--pdd-warning)" fill="none" strokeWidth={1.5} dot={false} />
                <Area type="monotone" dataKey="dau" name="日活跃用户" stroke="var(--pdd-success)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <AdminEmptyState title="暂无趋势数据" />
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>转化概览</h3>
          <div className="space-y-4 pt-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>付费墙曝光</span>
                <span className="text-xs font-medium" style={{ color: 'var(--pdd-text)' }}>{totalViews.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--pdd-gray-100)' }}>
                <div className="h-full rounded-full" style={{ width: '100%', background: 'var(--pdd-primary)' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>模块交互</span>
                <span className="text-xs font-medium" style={{ color: 'var(--pdd-text)' }}>{totalClicks.toLocaleString()}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--pdd-gray-100)' }}>
                <div className="h-full rounded-full" style={{ width: viewToClickRate + '%', background: 'var(--pdd-warning)' }} />
              </div>
              <span className="text-[10px]" style={{ color: 'var(--pdd-gray-400)' }}>转化率 {viewToClickRate}%</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>日活跃用户</span>
                <span className="text-xs font-medium" style={{ color: 'var(--pdd-text)' }}>{avgDau.toLocaleString()}/天</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ background: 'var(--pdd-gray-100)' }}>
                <div className="h-full rounded-full" style={{ width: Math.min(100, (avgDau / (totalDau || 1) * 10000)) + '%', background: 'var(--pdd-success)' }} />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="text-center">
              <div className="text-2xl font-bold" style={{ color: 'var(--pdd-primary)' }}>{viewToClickRate}%</div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>曝光→交互转化率</div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Detail Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>每日转化明细</h3>
          <ExportButton
            columns={[
              { key: 'stat_date', title: '日期' },
              { key: 'dau', title: 'DAU' },
              { key: 'paywall_views', title: '付费墙曝光' },
              { key: 'module_clicks', title: '模块交互' },
            ]}
            data={sortedTrend}
            filename="付费转化明细"
            formatRow={(row) => [
              row.stat_date || '',
              String(row.dau || 0),
              String(row.paywall_views || 0),
              String(row.module_clicks || 0),
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          {sortedTrend.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>日期</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>DAU</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>付费墙曝光</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>模块交互</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>曝光→交互</th>
                </tr>
              </thead>
              <tbody>
                {sortedTrend.map((d, idx) => {
                  const conv = d.paywall_views > 0 ? ((d.module_clicks / d.paywall_views) * 100).toFixed(1) : '0';
                  return (
                    <tr key={d.stat_date || idx} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>{d.stat_date}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{d.dau?.toLocaleString() || '-'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{d.paywall_views?.toLocaleString() || '-'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{d.module_clicks?.toLocaleString() || '-'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--pdd-primary)' }}>{conv}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无转化数据" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

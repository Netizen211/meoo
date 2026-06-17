import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Eye, MousePointer, Upload, Download, CreditCard, Cpu,
  RefreshCw, Search,
} from 'lucide-react';
import type { EventStat, DailyActivity, EventRecord } from '../../../api/adminApi';
import StatCard from '../../components/admin/StatCard';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminPagination from '../../components/admin/AdminPagination';
import { useEventStats, useDailyActivity, useEvents } from '../../hooks/useAdminData';

const EVENT_TYPE_MAP: Record<string, { label: string; color: string }> = {
  page_view: { label: '页面访问', color: 'var(--pdd-primary)' },
  module_click: { label: '模块点击', color: 'var(--pdd-purple)' },
  button_click: { label: '按钮点击', color: 'var(--pdd-cyan)' },
  upload_success: { label: '上传成功', color: 'var(--pdd-success)' },
  upload_fail: { label: '上传失败', color: 'var(--pdd-danger)' },
  export_click: { label: '导出点击', color: 'var(--pdd-warning)' },
  paywall_view: { label: '付费墙曝光', color: 'var(--pdd-warning)' },
  upgrade_click: { label: '升级点击', color: 'var(--pdd-purple)' },
  recharge_submit: { label: '提交充值', color: 'var(--pdd-pink)' },
  ai_call_success: { label: 'AI调用成功', color: 'var(--pdd-cyan)' },
  ai_call_fail: { label: 'AI调用失败', color: 'var(--pdd-orange)' },
  login_success: { label: '登录成功', color: 'var(--pdd-success)' },
  login_fail: { label: '登录失败', color: 'var(--pdd-danger)' },
};

function formatDuration(seconds: number): string {
  if (!seconds) return '0s';
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ' + Math.round(seconds % 60) + 's';
  return Math.floor(seconds / 3600) + 'h ' + Math.floor((seconds % 3600) / 60) + 'm';
}

export default function AdminBehavior() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [eventsPage, setEventsPage] = useState(1);
  const [eventTypeFilter, setEventTypeFilter] = useState('');
  const pageSize = 15;

  const dateParams = useMemo(() => {
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

  const { data: eventStats, isLoading: statsLoading, refetch: refetchStats } = useEventStats(dateParams);
  const { data: dailyActivity, isLoading: activityLoading, refetch: refetchActivity } = useDailyActivity(dateParams);
  const { data: eventsData, isLoading: eventsLoading, refetch: refetchEvents } = useEvents({
    event_type: eventTypeFilter || undefined,
    page: eventsPage,
    pageSize,
    ...dateParams,
  });

  const loading = statsLoading || activityLoading;
  const events = (eventsData?.data as EventRecord[]) || [];
  const eventsTotal = eventsData?.total ?? 0;

  const getKPIValue = (type: string): number => {
    const found = (eventStats || []).find((s: EventStat) => s.event_type === type);
    return found?.count ?? 0;
  };

  const getUniqueUsers = (type: string): number => {
    const found = (eventStats || []).find((s: EventStat) => s.event_type === type);
    return found?.unique_users ?? 0;
  };

  const sortedStats = [...(eventStats || [])].sort((a: EventStat, b: EventStat) => b.count - a.count);
  const trendData = [...(dailyActivity || [])].sort((a: DailyActivity, b: DailyActivity) => a.stat_date.localeCompare(b.stat_date));
  return (
    <div className="space-y-5">
      <PageHeader
        title="用户行为分析"
        subtitle="追踪用户在平台上的操作行为，洞察使用模式"
        actions={
          <button onClick={() => { refetchStats(); refetchActivity(); refetchEvents(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <RefreshCw size={13} /> 刷新
          </button>
        }
      />

      {/* Filter Bar */}
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
        onReset={() => { setTimeRange('30d'); setStartDate(''); setEndDate(''); setEventTypeFilter(''); }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <StatCard title="页面访问" value={getKPIValue('page_view').toLocaleString()} subtitle={'用户 ' + getUniqueUsers('page_view').toLocaleString()} icon={<Eye size={16} />} loading={loading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <StatCard title="功能点击" value={(getKPIValue('module_click') + getKPIValue('button_click')).toLocaleString()} subtitle={'用户 ' + getUniqueUsers('module_click').toLocaleString()} icon={<MousePointer size={16} />} loading={loading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <StatCard title="上传成功" value={getKPIValue('upload_success').toLocaleString()} subtitle={'失败 ' + getKPIValue('upload_fail').toLocaleString()} icon={<Upload size={16} />} loading={loading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <StatCard title="导出次数" value={getKPIValue('export_click').toLocaleString()} subtitle="数据导出" icon={<Download size={16} />} loading={loading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard title="付费墙曝光" value={getKPIValue('paywall_view').toLocaleString()} subtitle={'升级点击 ' + getKPIValue('upgrade_click').toLocaleString()} icon={<CreditCard size={16} />} loading={loading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <StatCard title="AI调用" value={getKPIValue('ai_call_success').toLocaleString()} subtitle={'失败 ' + getKPIValue('ai_call_fail').toLocaleString()} icon={<Cpu size={16} />} loading={loading} />
        </motion.div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-pdd-card rounded-xl border p-4 lg:col-span-2" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>日活跃趋势</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="stat_date" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }} />
                <Area type="monotone" dataKey="active_users" name="活跃用户" stroke="var(--pdd-primary)" fill="url(#activeGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="total_page_views" name="页面访问" stroke="var(--pdd-purple)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <AdminEmptyState title="暂无趋势数据" />
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>事件分布</h3>
          {sortedStats.length > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
              {sortedStats.slice(0, 10).map((stat, i) => {
                const meta = EVENT_TYPE_MAP[stat.event_type] || { label: stat.event_type, color: 'var(--pdd-gray-400)' };
                const total = sortedStats.reduce((s, x) => s + x.count, 0);
                const pct = total > 0 ? ((stat.count / total) * 100).toFixed(1) : '0';
                return (
                  <div key={stat.event_type} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.color }} />
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--pdd-text-secondary)' }}>{meta.label}</span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--pdd-text)' }}>{stat.count.toLocaleString()}</span>
                    <span className="text-[10px]" style={{ color: 'var(--pdd-gray-400)' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <AdminEmptyState title="暂无事件数据" />
          )}
        </div>
      </div>

      {/* Event Details Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>事件明细</h3>
          <div className="flex items-center gap-2">
            <ExportButton
              columns={[
                { key: 'created_at', title: '时间' },
                { key: 'user_id', title: '用户' },
                { key: 'event_type', title: '事件类型' },
                { key: 'event_label', title: '标签' },
                { key: 'page_url', title: '页面' },
                { key: 'duration_ms', title: '时长(ms)' },
              ]}
              data={events}
              filename="用户行为事件明细"
              formatRow={(row) => [
                new Date(row.created_at).toLocaleString('zh-CN'),
                row.user_id || '',
                row.event_type || '',
                row.event_label || '',
                row.page_url || '',
                String(row.duration_ms || 0),
              ]}
            />
            <select value={eventTypeFilter} onChange={e => { setEventTypeFilter(e.target.value); setEventsPage(1); }}
            className="px-2.5 py-1.5 text-xs border rounded-lg outline-none"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
            <option value="">全部事件</option>
            {Object.entries(EVENT_TYPE_MAP).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
        </div>
        <div className="overflow-x-auto">
          {eventsLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={4} message="加载中..." />
            </div>
          ) : events.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>用户</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>事件类型</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>标签</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>页面</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时长</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => {
                  const meta = EVENT_TYPE_MAP[ev.event_type] || { label: ev.event_type, color: 'var(--pdd-gray-400)' };
                  return (
                    <tr key={ev.id || idx} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                        {new Date(ev.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>{ev.user_id?.substring(0, 8) || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: meta.color + '15', color: meta.color }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--pdd-text-secondary)' }}>{ev.event_label || '-'}</td>
                      <td className="px-4 py-2.5 max-w-[150px] truncate" style={{ color: 'var(--pdd-text-secondary)' }}>{ev.page_url || '-'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{formatDuration(ev.duration_ms / 1000)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无事件记录" />
            </div>
          )}
        </div>
        {eventsTotal > 15 && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--pdd-border)' }}>
            <AdminPagination current={eventsPage} total={eventsTotal} pageSize={15} onChange={(p) => setEventsPage(p)} />
          </div>
        )}
      </div>
    </div>
  );
}

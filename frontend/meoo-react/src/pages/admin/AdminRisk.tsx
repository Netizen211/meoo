import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Shield, AlertTriangle, AlertCircle, Skull, CheckCircle } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import StatCard from '../../components/admin/StatCard';
import ExportButton from '../../components/admin/ExportButton';
import FilterPanel from '../../components/admin/FilterPanel';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import { useRiskEvents } from '../../hooks/useAdminData';

interface RiskSummary {
  total_events: number;
  critical_count: number;
  high_count: number;
  open_count: number;
}

interface RiskEvent {
  id: number;
  risk_type: string;
  risk_level: string;
  title: string;
  description: string;
  status: string;
  store_id: string;
  user_id: string;
  created_at: string;
  resolved_at: string;
}

const RISK_LEVEL_MAP: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: '严重', color: 'var(--pdd-danger)', bg: 'var(--pdd-danger)' },
  high: { label: '高危', color: 'var(--pdd-danger)', bg: 'var(--pdd-danger)' },
  medium: { label: '中危', color: 'var(--pdd-warning)', bg: 'var(--pdd-warning)' },
  low: { label: '低危', color: 'var(--pdd-gray-400)', bg: 'var(--pdd-gray-50)' },
};

const RISK_TYPE_LABELS: Record<string, string> = {
  security: '安全风险',
  data_breach: '数据泄露',
  abnormal_behavior: '异常行为',
  compliance: '合规风险',
  financial: '财务风险',
  system: '系统风险',
};

export default function AdminRisk() {
  const [page, setPage] = useState(1);
  const [riskLevelFilter, setRiskLevelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const pageSize = 15;

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
    return {
      risk_level: riskLevelFilter || undefined,
      status: statusFilter || undefined,
      page,
      pageSize,
      startDate: start,
      endDate: end,
    };
  }, [riskLevelFilter, statusFilter, page, timeRange, startDate, endDate]);

  const { data, isLoading, refetch } = useRiskEvents(queryParams);
  const summary = data?.summary || ({} as RiskSummary);
  const events = (data?.events as RiskEvent[]) || [];
  const total = data?.total ?? 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="风险审计中心"
        subtitle="实时监控系统风险事件，及时处理安全隐患"
        actions={
          <button onClick={() => { setPage(1); refetch(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <RefreshCw size={13} /> 刷新
          </button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <StatCard title="总事件" value={(summary.total_events || 0).toLocaleString()} subtitle="风险事件数" icon={<Shield size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <StatCard title="严重" value={(summary.critical_count || 0).toLocaleString()} subtitle="需立即处理" icon={<Skull size={16} />} loading={isLoading} trend="up" trendValue={(summary.critical_count || 0) > 0 ? '紧急' : ''} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <StatCard title="高危" value={(summary.high_count || 0).toLocaleString()} subtitle="需关注" icon={<AlertCircle size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <StatCard title="待处理" value={(summary.open_count || 0).toLocaleString()} subtitle="未关闭" icon={<AlertTriangle size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard title="已处理" value={((summary.total_events || 0) - (summary.open_count || 0)).toLocaleString()} subtitle="已关闭" icon={<CheckCircle size={16} />} loading={isLoading} />
        </motion.div>
      </div>

      {/* Filters */}
      <FilterPanel
        dateRange={startDate && endDate ? { start: startDate, end: endDate } : undefined}
        onDateRangeChange={(range) => { setStartDate(range.start); setEndDate(range.end); setTimeRange('custom'); }}
        extraFilters={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 bg-pdd-card rounded-lg border p-0.5" style={{ borderColor: 'var(--pdd-border)' }}>
              {[
                { label: '近7天', value: '7d' },
                { label: '近30天', value: '30d' },
                { label: '近90天', value: '90d' },
              ].map(opt => (
                <button key={opt.value} onClick={() => { setTimeRange(opt.value); setPage(1); }}
                  className={"px-3 py-1.5 text-xs rounded-md font-medium transition-all " + (timeRange === opt.value ? "text-white shadow-sm" : "hover:bg-gray-50")}
                  style={{ backgroundColor: timeRange === opt.value ? 'var(--pdd-primary)' : 'transparent', color: timeRange === opt.value ? 'var(--pdd-card)' : 'var(--pdd-text-secondary)' }}>
                  {opt.label}
                </button>
              ))}
            </div>
            <select value={riskLevelFilter} onChange={e => { setRiskLevelFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border rounded-lg outline-none"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
              <option value="">全部级别</option>
              {Object.entries(RISK_LEVEL_MAP).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="px-2.5 py-1.5 text-xs border rounded-lg outline-none"
              style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
              <option value="">全部状态</option>
              <option value="open">待处理</option>
              <option value="resolved">已处理</option>
              <option value="muted">已忽略</option>
            </select>
          </div>
        }
        onReset={() => { setTimeRange('7d'); setStartDate(''); setEndDate(''); setRiskLevelFilter(''); setStatusFilter(''); setPage(1); }}
      />

      {/* Events Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>风险事件</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>共 {total} 条</span>
            <ExportButton
              columns={[
                { key: 'created_at', title: '时间' },
                { key: 'title', title: '标题' },
                { key: 'risk_type', title: '类型' },
                { key: 'risk_level', title: '级别' },
                { key: 'status', title: '状态' },
                { key: 'store_id', title: '商家' },
                { key: 'user_id', title: '用户' },
              ]}
              data={events}
              filename="风险事件"
              formatRow={(row) => [
                new Date(row.created_at).toLocaleString('zh-CN'),
                row.title || '',
                row.risk_type || '',
                row.risk_level || '',
                row.status || '',
                row.store_id || '',
                row.user_id || '',
              ]}
            />
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={4} message="加载中..." />
            </div>
          ) : events.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>标题</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>类型</th>
                  <th className="text-center px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>级别</th>
                  <th className="text-center px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>状态</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>商家</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>用户</th>
                </tr>
              </thead>
              <tbody>
                {events.map((ev, idx) => {
                  const level = RISK_LEVEL_MAP[ev.risk_level] || { label: ev.risk_level, color: 'var(--pdd-gray-400)', bg: 'var(--pdd-gray-50)' };
                  const typeLabel = RISK_TYPE_LABELS[ev.risk_type] || ev.risk_type;
                  return (
                    <tr key={ev.id || idx} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                        {new Date(ev.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 font-medium max-w-[180px] truncate" style={{ color: 'var(--pdd-text)' }}>{ev.title || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[10px] px-1 py-0.5 rounded" style={{ background: 'var(--pdd-gray-100)', color: 'var(--pdd-primary)' }}>{typeLabel}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <AdminStatusBadge
                          status={level.label}
                          variant={ev.risk_level === 'critical' || ev.risk_level === 'high' ? 'danger' : ev.risk_level === 'medium' ? 'warning' : 'default'}
                          dot
                        />
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <AdminStatusBadge
                          status={ev.status === 'open' ? '待处理' : ev.status === 'resolved' ? '已处理' : '已忽略'}
                          variant={ev.status === 'open' ? 'danger' : ev.status === 'resolved' ? 'success' : 'default'}
                          dot
                        />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>{ev.store_id?.substring(0, 8) || '-'}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>{ev.user_id?.substring(0, 8) || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无风险事件" />
            </div>
          )}
        </div>
        {total > pageSize && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--pdd-border)' }}>
            <AdminPagination current={page} total={total} pageSize={pageSize} onChange={(p) => setPage(p)} />
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Cpu, CheckCircle, XCircle, Clock, DollarSign, Zap, Activity } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import StatCard from '../../components/admin/StatCard';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminPagination from '../../components/admin/AdminPagination';
import { useAiMonitoring } from '../../hooks/useAdminData';

interface AISummary {
  total_calls: number;
  success_calls: number;
  avg_response_ms: number;
  total_tokens: number;
  total_cost: number;
}

interface AICallRecord {
  id: number;
  user_id: string;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  response_time_ms: number;
  cost: number;
  success: number;
  error_message: string;
  created_at: string;
}

export default function AdminAIMonitor() {
  const [page, setPage] = useState(1);
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
    return { startDate: start, endDate: end, page, pageSize };
  }, [timeRange, startDate, endDate, page]);

  const { data, isLoading, refetch } = useAiMonitoring(queryParams);
  const summary = (data?.summary as AISummary) || ({} as AISummary);
  const recent = (data?.recent as AICallRecord[]) || [];
  const total = data?.total ?? 0;

  const successRate = summary.total_calls > 0
    ? ((summary.success_calls / summary.total_calls) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-5">
      <PageHeader
        title="AI调用监控"
        subtitle="监控AI接口调用量、响应时间、Token消耗及费用"
        actions={
          <button onClick={() => { setPage(1); refetch(); }}
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
              <button key={opt.value} onClick={() => { setTimeRange(opt.value); setPage(1); }}
                className={"px-3 py-1.5 text-xs rounded-md font-medium transition-all " + (timeRange === opt.value ? "text-white shadow-sm" : "hover:bg-gray-50")}
                style={{ backgroundColor: timeRange === opt.value ? 'var(--pdd-primary)' : 'transparent', color: timeRange === opt.value ? 'var(--pdd-card)' : 'var(--pdd-text-secondary)' }}>
                {opt.label}
              </button>
            ))}
          </div>
        }
        onReset={() => { setTimeRange('7d'); setStartDate(''); setEndDate(''); setPage(1); }}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}>
          <StatCard title="总调用" value={(summary.total_calls || 0).toLocaleString()} subtitle="AI请求次数" icon={<Cpu size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
          <StatCard title="成功率" value={successRate + '%'} subtitle={(summary.success_calls || 0) + ' 成功'} icon={<CheckCircle size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}>
          <StatCard title="平均响应" value={(summary.avg_response_ms || 0).toFixed(0) + 'ms'} subtitle="响应时间" icon={<Clock size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <StatCard title="Token消耗" value={(summary.total_tokens || 0).toLocaleString()} subtitle="总计" icon={<Zap size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.10 }}>
          <StatCard title="总费用" value={'¥' + (summary.total_cost || 0).toFixed(4)} subtitle="AI调用成本" icon={<DollarSign size={16} />} loading={isLoading} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
          <StatCard title="失败数" value={((summary.total_calls || 0) - (summary.success_calls || 0)).toLocaleString()} subtitle="需关注" icon={<XCircle size={16} />} loading={isLoading} />
        </motion.div>
      </div>

      {/* Records Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>调用记录</h3>
          <div className="flex items-center gap-2">
            <ExportButton
              columns={[
                { key: 'created_at', title: '时间' },
                { key: 'user_id', title: '用户' },
                { key: 'model_name', title: '模型' },
                { key: 'success', title: '状态' },
                { key: 'response_time_ms', title: '响应时间' },
                { key: 'cost', title: '费用' },
                { key: 'error_message', title: '错误' },
              ]}
              data={recent}
              filename="AI调用记录"
              formatRow={(row) => [
                new Date(row.created_at).toLocaleString('zh-CN'),
                row.user_id || '',
                row.model_name || '',
                row.success ? '成功' : '失败',
                (row.response_time_ms || 0).toFixed(0) + 'ms',
                '¥' + (row.cost || 0).toFixed(4),
                row.error_message || '',
              ]}
            />
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>共 {total} 条</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={4} message="加载中..." />
            </div>
          ) : recent.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>用户</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>模型</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>状态</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>响应时间</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>Token</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>费用</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>错误</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((rec, idx) => (
                  <tr key={rec.id || idx} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {new Date(rec.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>{rec.user_id?.substring(0, 8) || '-'}</td>
                    <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>{rec.model_name || '-'}</td>
                    <td className="px-4 py-2.5 text-right">
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
                        style={{ background: rec.success ? 'var(--pdd-success)' : 'var(--pdd-danger)', color: rec.success ? 'var(--pdd-success)' : 'var(--pdd-danger)' }}>
                        {rec.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                        {rec.success ? '成功' : '失败'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{(rec.response_time_ms || 0).toFixed(0)}ms</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{(rec.prompt_tokens || 0) + (rec.completion_tokens || 0)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>¥{(rec.cost || 0).toFixed(4)}</td>
                    <td className="px-4 py-2.5 max-w-[120px] truncate" style={{ color: 'var(--pdd-danger)' }}>{rec.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无调用记录" />
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

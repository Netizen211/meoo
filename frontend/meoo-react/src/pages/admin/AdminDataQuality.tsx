import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminPagination from '../../components/admin/AdminPagination';
import AdminStatusBadge from '../../components/admin/AdminStatusBadge';
import { useDataQuality } from '../../hooks/useAdminData';

interface CheckSummary {
  check_type: string;
  total_checks: number;
  failed_checks: number;
  total_issues: number;
}

interface QualityCheck {
  id: number;
  store_id: string;
  check_type: string;
  check_status: string;
  issue_count: number;
  details: string;
  created_at: string;
}

const CHECK_TYPE_LABELS: Record<string, string> = {
  missing_fields: '缺失字段',
  format_error: '格式错误',
  duplicate_data: '重复数据',
  outlier_detect: '异常值检测',
  referential_integrity: '引用完整性',
};

const CHECK_TYPE_COLORS: Record<string, string> = {
  missing_fields: 'var(--pdd-primary)',
  format_error: 'var(--pdd-warning)',
  duplicate_data: 'var(--pdd-danger)',
  outlier_detect: 'var(--pdd-purple)',
  referential_integrity: 'var(--pdd-success)',
};

export default function AdminDataQuality() {
  const [page, setPage] = useState(1);
  const [checkTypeFilter, setCheckTypeFilter] = useState('');
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
    return { check_type: checkTypeFilter || undefined, page, pageSize, startDate: start, endDate: end };
  }, [checkTypeFilter, page, timeRange, startDate, endDate]);

  const { data, isLoading, refetch } = useDataQuality(queryParams);
  const summary = (data?.summary as CheckSummary[]) || [];
  const checks = (data?.checks as QualityCheck[]) || [];
  const total = data?.total ?? 0;

  const totalChecks = summary.reduce((s, x) => s + x.total_checks, 0);
  const totalFailed = summary.reduce((s, x) => s + x.failed_checks, 0);
  const passRate = totalChecks > 0 ? ((1 - totalFailed / totalChecks) * 100).toFixed(1) : '100';

  return (
    <div className="space-y-5">
      <PageHeader
        title="数据质量中心"
        subtitle="监控数据完整性、准确性，及时发现数据异常"
        actions={
          <button onClick={() => { setPage(1); refetch(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)' }}>
            <RefreshCw size={13} /> 刷新
          </button>
        }
      />

      {/* Overall Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} style={{ color: 'var(--pdd-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>检查总数</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{totalChecks.toLocaleString()}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={14} style={{ color: 'var(--pdd-success)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>通过率</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{passRate}%</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <XCircle size={14} style={{ color: 'var(--pdd-danger)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>失败检查</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{totalFailed.toLocaleString()}</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} style={{ color: 'var(--pdd-warning)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>总问题数</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{summary.reduce((s, x) => s + x.total_issues, 0).toLocaleString()}</div>
        </motion.div>
      </div>

      {/* Filter */}
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

      {/* Check Type Summary */}
      <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>检查类型概览</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {summary.map((item, idx) => {
            const label = CHECK_TYPE_LABELS[item.check_type] || item.check_type;
            const color = CHECK_TYPE_COLORS[item.check_type] || 'var(--pdd-gray-400)';
            const rate = item.total_checks > 0 ? ((1 - item.failed_checks / item.total_checks) * 100).toFixed(0) : '100';
            return (
              <motion.div key={item.check_type} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                style={{ borderColor: 'var(--pdd-border)' }}
                onClick={() => setCheckTypeFilter(checkTypeFilter === item.check_type ? '' : item.check_type)}>
                <div className="flex items-center gap-1.5 mb-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                  <span className="text-xs font-medium truncate" style={{ color: 'var(--pdd-text)' }}>{label}</span>
                </div>
                <div className="text-lg font-bold tabular-nums" style={{ color }}>{rate}%</div>
                <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>
                  {item.failed_checks}/{item.total_checks} 失败 · {item.total_issues} 问题
                </div>
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: 'var(--pdd-gray-100)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: rate + '%', background: Number(rate) > 90 ? 'var(--pdd-success)' : Number(rate) > 70 ? 'var(--pdd-warning)' : 'var(--pdd-danger)' }} />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <select value={checkTypeFilter} onChange={e => { setCheckTypeFilter(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 text-xs border rounded-lg outline-none"
          style={{ borderColor: 'var(--pdd-border)', color: 'var(--pdd-text-secondary)', background: 'var(--pdd-gray-50)' }}>
          <option value="">全部检查类型</option>
          {Object.entries(CHECK_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Detail Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>检查明细</h3>
          <ExportButton
            columns={[
              { key: 'created_at', title: '时间' },
              { key: 'store_id', title: '商家' },
              { key: 'check_type', title: '检查类型' },
              { key: 'check_status', title: '状态' },
              { key: 'issue_count', title: '问题数' },
              { key: 'details', title: '详情' },
            ]}
            data={checks}
            filename="数据质量检查明细"
            formatRow={(row) => [
              new Date(row.created_at).toLocaleString('zh-CN'),
              row.store_id || '',
              CHECK_TYPE_LABELS[row.check_type] || row.check_type || '',
              row.check_status === 'failed' ? '失败' : '通过',
              String(row.issue_count || 0),
              row.details || '',
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={4} message="加载中..." />
            </div>
          ) : checks.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>商家</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>检查类型</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>状态</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>问题数</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>详情</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((chk, idx) => {
                  const label = CHECK_TYPE_LABELS[chk.check_type] || chk.check_type;
                  const color = CHECK_TYPE_COLORS[chk.check_type] || 'var(--pdd-gray-400)';
                  const isFailed = chk.check_status === 'failed';
                  return (
                    <tr key={chk.id || idx} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                      <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                        {new Date(chk.created_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[10px]" style={{ color: 'var(--pdd-text-secondary)' }}>{chk.store_id?.substring(0, 8) || '-'}</td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ background: color + '15', color }}>
                          {label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <AdminStatusBadge
                          status={isFailed ? '失败' : '通过'}
                          variant={isFailed ? 'danger' : 'success'}
                          dot
                        />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{chk.issue_count || 0}</td>
                      <td className="px-4 py-2.5 max-w-[200px] truncate" style={{ color: 'var(--pdd-gray-400)' }}>{chk.details || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无检查记录" />
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

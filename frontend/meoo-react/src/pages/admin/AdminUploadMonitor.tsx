import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { RefreshCw, Upload, CheckCircle, XCircle, Clock, FileText, Activity, AlertTriangle } from 'lucide-react';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import AdminPagination from '../../components/admin/AdminPagination';
import { useUploadStats, useUploadFailures } from '../../hooks/useAdminData';

// file type display labels
const FT: Record<string, string> = { csv: 'CSV', xlsx: 'Excel', xls: 'Excel', json: 'JSON', txt: '文本', pdf: 'PDF' };

export default function AdminUploadMonitor() {
  const [page, setPage] = useState(1);
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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

  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useUploadStats(dateParams);
  const { data: failuresData, isLoading: failuresLoading, refetch: refetchFailures } = useUploadFailures({ page, pageSize, ...dateParams });
  const isLoading = statsLoading || failuresLoading;

  const ud = (statsData as any) || {};
  const s = ud.stats || {};
  const trend = Array.isArray(ud.trend) ? ud.trend : [];
  const typeDist = Array.isArray(ud.typeDist) ? ud.typeDist : [];
  const failReasons = Array.isArray(ud.failReasons) ? ud.failReasons : [];
  const failures = (failuresData?.uploads as any[]) || [];
  const failuresTotal = failuresData?.total ?? 0;
  const successRate = (s.total_uploads ?? 0) > 0
    ? (((s.success_count ?? 0) / (s.total_uploads ?? 0)) * 100).toFixed(1) : '0';
  const sortedTrend = [...trend].sort((a: any, b: any) => a.date?.localeCompare?.(b.date) || 0);

  // KPI card configs
  const kpiCards = [
    { label: '上传总次数', value: (s.total_uploads ?? 0).toLocaleString(), sub: '全部记录', icon: Upload, color: 'var(--pdd-primary)', bg: 'var(--pdd-gray-100)' },
    { label: '成功次数', value: (s.success_count ?? 0).toLocaleString(), sub: '上传成功', icon: CheckCircle, color: 'var(--pdd-success)', bg: 'var(--pdd-success)' },
    { label: '失败次数', value: (s.fail_count ?? 0).toLocaleString(), sub: '上传失败', icon: XCircle, color: 'var(--pdd-danger)', bg: 'var(--pdd-danger)' },
    { label: '成功率', value: successRate + '%', sub: (s.success_count ?? 0) + ' 成功', icon: Activity, color: 'var(--pdd-purple)', bg: 'var(--pdd-purple)' },
    { label: '平均解析', value: (s.avg_parse_ms ?? 0).toFixed(0) + 'ms', sub: '解析耗时', icon: Clock, color: 'var(--pdd-warning)', bg: 'var(--pdd-warning)' },
    { label: '活跃店铺', value: (s.active_stores ?? 0).toLocaleString(), sub: '有上传的店铺', icon: FileText, color: 'var(--pdd-cyan)', bg: 'var(--pdd-cyan)' },
  ];

  const chartColors = ['var(--pdd-primary)', 'var(--pdd-purple)', 'var(--pdd-success)', 'var(--pdd-warning)', 'var(--pdd-danger)', 'var(--pdd-cyan)'];

  return (
    <div className="space-y-5">
      <PageHeader
        title="数据上传监控"
        subtitle="监控用户数据上传的成功率、类型分布及失败原因"
        actions={
          <button onClick={() => { setPage(1); refetchStats(); refetchFailures(); }}
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
        {kpiCards.map((item, i) => (
          <div key={item.label}
            className="bg-pdd-card rounded-xl border p-4 transition-shadow hover:shadow-sm"
            style={{ borderColor: 'var(--pdd-border)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: item.bg }}>
                <item.icon size={14} style={{ color: item.color }} />
              </div>
              <span className="text-[10px] font-medium" style={{ color: 'var(--pdd-gray-400)' }}>{item.label}</span>
            </div>
            <div className="text-lg font-bold" style={{ color: 'var(--pdd-text)' }}>{isLoading ? '-' : item.value}</div>
            <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {/* Upload Trend + File Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trend AreaChart */}
        <div className="bg-pdd-card rounded-xl border p-4 lg:col-span-2" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>上传趋势</h3>
          {sortedTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={sortedTrend}>
                <defs>
                  <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
                />
                <Area type="monotone" dataKey="total" stroke="var(--pdd-primary)" fill="url(#uploadGrad)" strokeWidth={2} dot={false} name="总上传" />
                <Area type="monotone" dataKey="success" stroke="var(--pdd-success)" fill="none" strokeWidth={1.5} dot={false} name="成功" />
                <Area type="monotone" dataKey="fail" stroke="var(--pdd-danger)" fill="none" strokeWidth={1.5} dot={false} strokeDasharray="4 3" name="失败" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-xs py-16 text-center" style={{ color: 'var(--pdd-gray-400)' }}>暂无趋势数据</div>
          )}
        </div>

        {/* File Type Distribution */}
        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--pdd-text)' }}>文件类型分布</h3>
          {typeDist.length > 0 ? (
            <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
              {typeDist.map((item: any, idx: number) => {
                const total = typeDist.reduce((sum: number, x: any) => sum + (x.count || 0), 0);
                const pct = total > 0 ? ((item.count / total) * 100).toFixed(1) : '0';
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: chartColors[idx % 6] }} />
                    <span className="text-xs flex-1" style={{ color: 'var(--pdd-text-secondary)' }}>{FT[item.file_type] || item.file_type}</span>
                    <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--pdd-text)' }}>{item.count}</span>
                    <span className="text-[10px] w-10 text-right" style={{ color: 'var(--pdd-gray-400)' }}>{pct}%</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无数据" />
            </div>
          )}
        </div>
      </div>

      {/* Failure Reasons */}
      {failReasons.length > 0 && (
        <div className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: 'var(--pdd-text)' }}>
            <AlertTriangle size={15} style={{ color: 'var(--pdd-danger)' }} /> 失败原因排行
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={Math.max(80, failReasons.length * 36)}>
              <BarChart data={failReasons} layout="vertical" margin={{ left: 100, right: 20, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--pdd-gray-400)' }} />
                <YAxis
                  type="category" dataKey="error_message" tick={{ fontSize: 10, fill: 'var(--pdd-text-secondary)' }} width={100}
                  tickFormatter={(v: string) => v && v.length > 14 ? v.substring(0, 14) + '...' : v || ''}
                />
                <Tooltip
                  contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="count" name="失败次数" fill="var(--pdd-danger)" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="space-y-1.5">
              {failReasons.map((r: any, idx: number) => (
                <div key={idx}
                  className="flex items-center gap-2.5 text-xs px-3 py-2 rounded-lg"
                  style={{ background: 'var(--pdd-gray-50)' }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: 'var(--pdd-danger)', color: 'var(--pdd-danger)' }}>
                    {idx + 1}
                  </span>
                  <span className="flex-1" style={{ color: 'var(--pdd-text-secondary)' }}>{r.error_message || '未知错误'}</span>
                  <span className="tabular-nums font-semibold" style={{ color: 'var(--pdd-text)' }}>{r.count}次</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Failure Records Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>失败记录</h3>
          <div className="flex items-center gap-2">
            <ExportButton
              columns={[
                { key: 'uploaded_at', title: '时间' },
                { key: 'store_name', title: '店铺' },
                { key: 'file_name', title: '文件名' },
                { key: 'file_type', title: '类型' },
                { key: 'row_count', title: '行数' },
                { key: 'error_message', title: '错误信息' },
              ]}
              data={failures}
              filename="上传失败记录"
              formatRow={(row) => [
                row.uploaded_at ? new Date(row.uploaded_at).toLocaleString('zh-CN') : '',
                row.store_name || row.store_id || '',
                row.file_name || '',
                row.file_type ? (FT[row.file_type] || row.file_type) : '',
                row.row_count != null ? String(row.row_count) : '',
                row.error_message || '',
              ]}
            />
            <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>共 {failuresTotal} 条</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={4} message="加载中..." />
            </div>
          ) : failures.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>时间</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>店铺</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>文件名</th>
                  <th className="text-center px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>类型</th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>行数</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>错误信息</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f: any, idx: number) => (
                  <tr key={f.id || idx} className="border-t transition-colors hover:bg-gray-50/30" style={{ borderColor: 'var(--pdd-border)' }}>
                    <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {f.uploaded_at
                        ? new Date(f.uploaded_at).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                        : '-'}
                    </td>
                    <td className="px-4 py-2.5 max-w-[110px] truncate font-medium" style={{ color: 'var(--pdd-text)' }}>
                      {f.store_name || (f.store_id ? f.store_id.substring(0, 8) : '-')}
                    </td>
                    <td className="px-4 py-2.5 max-w-[130px] truncate" style={{ color: 'var(--pdd-text-secondary)' }}>{f.file_name || '-'}</td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ background: 'var(--pdd-gray-100)', color: 'var(--pdd-primary)' }}>
                        {f.file_type ? (FT[f.file_type] || f.file_type) : '-'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>
                      {f.row_count != null ? f.row_count.toLocaleString() : '-'}
                    </td>
                    <td className="px-4 py-2.5 max-w-[180px] truncate" style={{ color: 'var(--pdd-danger)' }}>{f.error_message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无失败记录" />
            </div>
          )}
        </div>
        {failuresTotal > pageSize && (
          <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--pdd-border)' }}>
            <AdminPagination current={page} total={failuresTotal} pageSize={pageSize} onChange={(p) => setPage(p)} />
          </div>
        )}
      </div>
    </div>
  );
}

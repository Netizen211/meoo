import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { RefreshCw, MousePointer, Users, BarChart3, Clock } from 'lucide-react';
import type { ModuleRankItem } from '../../../api/adminApi';
import PageHeader from '../../components/admin/PageHeader';
import FilterPanel from '../../components/admin/FilterPanel';
import ExportButton from '../../components/admin/ExportButton';
import AdminLoading from '../../components/admin/AdminLoading';
import AdminEmptyState from '../../components/admin/AdminEmptyState';
import { useModuleRank } from '../../hooks/useAdminData';

const MODULE_ICONS: Record<string, string> = {
  dashboard: '运营总览',
  users: '用户管理',
  stores: '商家管理',
  products: '商品管理',
  orders: '订单管理',
  finance: '财务管理',
  data: '数据中心',
  analytics: '数据分析',
  marketing: '营销管理',
  settings: '系统设置',
  logistics: '物流管理',
  membership: '会员体系',
  promotion: '促销活动',
  insurance: '保险服务',
  legal: '法务管理',
  after_sale: '售后服务',
  cost: '成本管理',
  risk: '风控中心',
  upload: '批量上传',
  recharge: '充值管理',
  invite: '邀请管理',
};

function getRankIcon(rank: number) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return '';
}

export default function AdminModuleRank() {
  const [timeRange, setTimeRange] = useState('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortField, setSortField] = useState<'click_count' | 'unique_users'>('click_count');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');

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

  const { data: rankData, isLoading, refetch } = useModuleRank(queryParams);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const rd = rankData || [];
  const sorted = [...rd].sort((a, b) => {
    const aVal = a[sortField] || 0;
    const bVal = b[sortField] || 0;
    return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const totalClicks = rd.reduce((s, r) => s + (r.click_count || 0), 0);
  const totalUsers = rd.reduce((s, r) => s + (r.unique_users || 0), 0);

  return (
    <div className="space-y-5">
      <PageHeader
        title="模块点击排行"
        subtitle="查看各功能模块的点击热度，了解用户关注焦点"
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

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.02 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <MousePointer size={14} style={{ color: 'var(--pdd-primary)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>总点击</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{totalClicks.toLocaleString()}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>所有模块</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} style={{ color: 'var(--pdd-purple)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>覆盖用户</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{totalUsers.toLocaleString()}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>独立用户数</div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
          className="bg-pdd-card rounded-xl border p-4" style={{ borderColor: 'var(--pdd-border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 size={14} style={{ color: 'var(--pdd-success)' }} />
            <span className="text-xs" style={{ color: 'var(--pdd-text-secondary)' }}>活跃模块</span>
          </div>
          <div className="text-xl font-bold tabular-nums" style={{ color: 'var(--pdd-text)' }}>{rd.length}</div>
          <div className="text-[10px] mt-0.5" style={{ color: 'var(--pdd-gray-400)' }}>有点击记录的模块</div>
        </motion.div>
      </div>

      {/* Ranking Table */}
      <div className="bg-pdd-card rounded-xl border" style={{ borderColor: 'var(--pdd-border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--pdd-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--pdd-text)' }}>模块排名</h3>
          <ExportButton
            columns={[
              { key: 'rank', title: '排名' },
              { key: 'module_name', title: '模块' },
              { key: 'click_count', title: '点击量' },
              { key: 'unique_users', title: '独立用户' },
              { key: 'avg_duration_sec', title: '平均时长' },
            ]}
            data={sorted.map((item, idx) => ({ ...item, rank: idx + 1 }))}
            filename="模块点击排行"
            formatRow={(row) => [
              String(row.rank),
              MODULE_ICONS[row.module_name] || row.module_name,
              String(row.click_count || 0),
              String(row.unique_users || 0),
              row.avg_duration_sec ? ((row.avg_duration_sec / 1000).toFixed(1) + 's') : '-',
            ]}
          />
        </div>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-4">
              <AdminLoading card={false} rows={5} message="加载中..." />
            </div>
          ) : sorted.length > 0 ? (
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: 'var(--pdd-gray-50)' }}>
                  <th className="text-left px-4 py-2.5 font-medium w-10" style={{ color: 'var(--pdd-text-secondary)' }}>#</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>模块</th>
                  <th className="text-right px-4 py-2.5 font-medium cursor-pointer select-none hover:text-pdd-text"
                    style={{ color: 'var(--pdd-text-secondary)' }} onClick={() => toggleSort('click_count')}>
                    点击量 {sortField === 'click_count' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium cursor-pointer select-none hover:text-pdd-text"
                    style={{ color: 'var(--pdd-text-secondary)' }} onClick={() => toggleSort('unique_users')}>
                    独立用户 {sortField === 'unique_users' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                  <th className="text-right px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>平均时长</th>
                  <th className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text-secondary)' }}>占比</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((item, idx) => {
                  const rank = idx + 1;
                  const pct = totalClicks > 0 ? ((item.click_count / totalClicks) * 100).toFixed(1) : '0';
                  const label = MODULE_ICONS[item.module_name] || item.module_name;
                  const avgDuration = item.avg_duration_sec ?? 0;
                  return (
                    <tr key={item.module_name} className="border-t transition-colors hover:bg-gray-50/50" style={{ borderColor: 'var(--pdd-border)' }}>
                      <td className="px-4 py-2.5 text-base">{getRankIcon(rank) || <span className="text-xs" style={{ color: 'var(--pdd-gray-400)' }}>{rank}</span>}</td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--pdd-text)' }}>{label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--pdd-text)' }}>{item.click_count.toLocaleString()}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{item.unique_users?.toLocaleString() || '-'}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{avgDuration > 0 ? (avgDuration / 1000).toFixed(1) + 's' : '-'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs tabular-nums" style={{ color: 'var(--pdd-text-secondary)' }}>{pct}%</span>
                          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--pdd-gray-100)' }}>
                            <div className="h-full rounded-full" style={{ width: pct + '%', background: rank <= 3 ? 'var(--pdd-primary)' : 'color-mix(in srgb, var(--pdd-primary) 50%, white)' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="py-4">
              <AdminEmptyState title="暂无排行数据" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

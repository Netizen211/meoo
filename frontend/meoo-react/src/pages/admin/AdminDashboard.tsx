import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import {
  Users, Store, Database, DollarSign, Activity, Clock, AlertTriangle,
  CreditCard, FileText, Settings, RefreshCw, UserPlus, Zap, Shield,
  TrendingUp, Wallet,
} from 'lucide-react';
import type { OperationsOverview } from '../../../api/adminApi';
import StatCard from '../../components/admin/StatCard';
import { useOperationsOverview, useRecentActivity } from '../../hooks/useAdminData';

const TIME_OPTIONS = [
  { label: '今日', value: '1d' },
  { label: '近7天', value: '7d' },
  { label: '近30天', value: '30d' },
  { label: '近90天', value: '90d' },
];

const QUICK_ACTIONS = [
  { label: '审核充值', icon: CreditCard, path: '/admin/recharge' },
  { label: '用户管理', icon: Users, path: '/admin/users' },
  { label: '操作日志', icon: FileText, path: '/admin/logs' },
  { label: '系统设置', icon: Settings, path: '/admin/settings' },
  { label: '数据总览', icon: Activity, path: '/admin/data' },
  { label: '风险监控', icon: Shield, path: '/admin/risk' },
];

function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let val = bytes;
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++; }
  return val.toFixed(1) + ' ' + units[i];
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState('7d');

  const { data: overview, isLoading, isFetching, refetch } = useOperationsOverview(timeRange, {
    refetchInterval: 30000,
    placeholderData: (prev: OperationsOverview | null | undefined) => prev,
  });

  if (isLoading && !overview) {
    return (
      <div className='flex flex-col items-center justify-center h-64 gap-3'>
        <RefreshCw size={24} className='animate-spin text-pdd-gray-400' />
        <span className='text-sm text-pdd-text-secondary'>加载运营数据...</span>
      </div>
    );
  }

  const { trendData = [] } = overview || {};

  return (
    <div className='space-y-5'>

      {/* Alert Banners */}
      {overview && (overview.pendingRecharge > 0 || overview.systemAnomalies > 0) && (
        <div className='space-y-2'>
          {overview.pendingRecharge > 0 && (
            <div className='flex items-center gap-3 px-4 py-3 rounded-lg border border-pdd-warning/30 bg-pdd-warning/5'>
              <Wallet size={18} className='text-pdd-warning' />
              <div className='flex-1 min-w-0'>
                <span className='text-sm font-medium text-pdd-warning'>待审核充值</span>
                <span className='text-sm ml-2 text-pdd-text-secondary'>
                  {overview.pendingRecharge} 笔，合计 ¥{overview.pendingRechargeAmount.toLocaleString()}
                </span>
              </div>
              <button
                onClick={() => navigate('/admin/recharge')}
                className='text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-pdd-warning hover:bg-pdd-warning/10'
              >
                去审核 →
              </button>
            </div>
          )}
          {overview.systemAnomalies > 0 && (
            <div className='flex items-center gap-3 px-4 py-3 rounded-lg border border-pdd-danger/30 bg-pdd-danger/5'>
              <AlertTriangle size={18} className='text-pdd-danger' />
              <div className='flex-1 min-w-0'>
                <span className='text-sm font-medium text-pdd-danger'>系统异常</span>
                <span className='text-sm ml-2 text-pdd-text-secondary'>
                  检测到 {overview.systemAnomalies} 个异常事件，请及时处理
                </span>
              </div>
              <button
                onClick={() => navigate('/admin/risk')}
                className='text-xs font-medium px-3 py-1.5 rounded-lg transition-colors text-pdd-danger hover:bg-pdd-danger/10'
              >
                查看详情 →
              </button>
            </div>
          )}
        </div>
      )}

      {/* KPI Cards — no stagger animations, flat professional layout */}
      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
        <StatCard
          title='日活跃用户 (DAU)'
          value={overview?.dau ?? '-'}
          subtitle='当日活跃用户数'
          icon={<Zap size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/analytics')}
        />
        <StatCard
          title='周活跃用户 (WAU)'
          value={overview?.wau ?? '-'}
          subtitle='近7天活跃用户数'
          icon={<Activity size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/analytics')}
        />
        <StatCard
          title='月活跃用户 (MAU)'
          value={overview?.mau ?? '-'}
          subtitle='近30天活跃用户数'
          icon={<Users size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/analytics')}
        />
        <StatCard
          title='总用户数'
          value={overview?.totalUsers ?? '-'}
          subtitle={'新增 ' + (overview?.newUsers ?? 0).toLocaleString()}
          icon={<UserPlus size={18} />}
          loading={isLoading}
          trend='up'
          trendValue={'+' + (overview?.newUsers ?? 0)}
          onClick={() => navigate('/admin/users')}
        />
        <StatCard
          title='店铺总数'
          value={overview?.totalStores ?? '-'}
          subtitle={'新增 ' + (overview?.newStores ?? 0).toLocaleString()}
          icon={<Store size={18} />}
          loading={isLoading}
          trend={(overview?.newStores ?? 0) > 0 ? 'up' : 'stable'}
          trendValue={'+' + (overview?.newStores ?? 0)}
          onClick={() => navigate('/admin/stores')}
        />
        <StatCard
          title='上传次数'
          value={overview?.uploads ?? '-'}
          subtitle='累计上传文件数'
          icon={<Database size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/data')}
        />
        <StatCard
          title='总营收'
          value={'¥' + (overview?.revenue ?? 0).toLocaleString()}
          subtitle='累计付费金额'
          icon={<DollarSign size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/revenue')}
        />
        <StatCard
          title='付费用户'
          value={overview?.payingUsers ?? '-'}
          subtitle='累计付费人数'
          icon={<TrendingUp size={18} />}
          loading={isLoading}
          onClick={() => navigate('/admin/revenue')}
        />
      </div>

      {/* Storage + Trend Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="bg-pdd-card border border-pdd-border rounded-lg p-4 lg:col-span-1">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-pdd-text-secondary">存储使用</span>
            <Database size={14} className="text-pdd-gray-400" />
          </div>
          <p className="text-lg font-bold text-pdd-text">{formatBytes(overview?.storageBytes ?? 0)}</p>
          <div className="mt-3 w-full h-1.5 rounded-full bg-pdd-gray-100">
            <div className="h-1.5 rounded-full bg-pdd-primary transition-all duration-700" style={{ width: Math.min(((overview?.storageBytes ?? 0) / (5 * 1024 * 1024 * 1024)) * 100, 100) + '%' }} />
          </div>
          <p className="text-[10px] mt-1.5 text-pdd-gray-400">已用 {((overview?.storageBytes ?? 0) / (1024 * 1024 * 1024)).toFixed(2)} GB / 5 GB</p>
        </div>

        <div className="bg-pdd-card border border-pdd-border rounded-lg p-4 lg:col-span-3">
          <h3 className="text-sm font-semibold mb-3 text-pdd-text">增长趋势 (30天)</h3>
          {trendData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="trendUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--pdd-primary)" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="var(--pdd-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--pdd-gray-400)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: 'var(--pdd-card)', border: '1px solid var(--pdd-border)', borderRadius: 8, fontSize: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} />
                  <Area type="monotone" dataKey="newUsers" name="新用户" stroke="var(--pdd-primary)" fill="url(#trendUsers)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="newStores" name="新店铺" stroke="var(--pdd-primary)" strokeOpacity={0.5} fill="url(#trendUsers)" strokeWidth={1.5} dot={false} />
                  <Area type="monotone" dataKey="uploads" name="上传" stroke="var(--pdd-primary)" strokeOpacity={0.3} fill="url(#trendUsers)" strokeWidth={1} dot={false} />
                  <Area type="monotone" dataKey="revenue" name="营收" stroke="var(--pdd-success)" fill="url(#trendUsers)" strokeWidth={1.5} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center flex-wrap">
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-pdd-primary" /><span className="text-[10px] text-pdd-text-secondary">新用户</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--pdd-primary)', opacity: 0.5 }} /><span className="text-[10px] text-pdd-text-secondary">新店铺</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded" style={{ backgroundColor: 'var(--pdd-primary)', opacity: 0.3 }} /><span className="text-[10px] text-pdd-text-secondary">上传</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-pdd-success" /><span className="text-[10px] text-pdd-text-secondary">营收</span></div>
              </div>
            </>
          ) : (
            <div className="text-xs py-12 text-center text-pdd-gray-400">暂无趋势数据</div>
          )}
        </div>
      </div>

      {/* Bottom: Quick actions + Activity log */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div className="bg-pdd-card border border-pdd-border rounded-lg p-4">
          <h3 className="text-sm font-semibold mb-3 text-pdd-text">快捷操作</h3>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_ACTIONS.map(item => (
              <button key={item.label} onClick={() => navigate(item.path)} className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-pdd-border hover:border-pdd-primary/30 transition-colors bg-pdd-gray-50">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-pdd-gray-100 text-pdd-primary">
                  <item.icon size={16} />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        <ActivityLog />
      </div>
    </div>
  );
}

interface ActivityItem {
  id: number;
  username: string;
  action: string;
  details: string;
  targetType: string;
  createdAt: string;
}

function ActivityLog() {
  const { data: activities = [], isLoading } = useRecentActivity();

  const ACTION_LABELS: Record<string, string> = {
    ban_user: '封禁用户', unban_user: '解封用户',
    admin_adjust_membership: '调整会员',
    delete_data: '删除数据', generate_invite: '生成邀请码',
    delete_invite: '删除邀请码', system_config: '系统配置',
    impersonate_user: '模拟登录',
  };

  const getIcon = (action: string) => {
    if (action.includes('ban')) return <Shield size={12} />;
    if (action.includes('membership')) return <TrendingUp size={12} />;
    if (action.includes('invite')) return <UserPlus size={12} />;
    if (action.includes('impersonate')) return <Users size={12} />;
    return <FileText size={12} />;
  };

  const getBadgeStyle = (action: string): { cls: string; color: string } => {
    if (action.includes('ban') && !action.includes('unban')) return { cls: 'bg-pdd-danger/10 text-pdd-danger', color: 'var(--pdd-danger)' };
    if (action.includes('unban')) return { cls: 'bg-pdd-success/10 text-pdd-success', color: 'var(--pdd-success)' };
    if (action.includes('membership')) return { cls: 'bg-pdd-warning/10 text-pdd-warning', color: 'var(--pdd-warning)' };
    if (action.includes('impersonate')) return { cls: 'bg-pdd-purple/10 text-pdd-purple', color: 'var(--pdd-purple)' };
    return { cls: 'bg-pdd-primary/10 text-pdd-primary', color: 'var(--pdd-primary)' };
  };

  return (
    <div className="bg-pdd-card border border-pdd-border rounded-lg p-4 lg:col-span-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-pdd-text">最近操作</h3>
        <Clock size={14} className="text-pdd-gray-400" />
      </div>
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-start gap-2.5 animate-pulse">
              <div className="w-6 h-6 rounded-full bg-pdd-gray-100" />
              <div className="flex-1 space-y-1">
                <div className="h-3 w-32 rounded bg-pdd-gray-100" />
                <div className="h-2.5 w-48 rounded bg-pdd-gray-50" />
              </div>
            </div>
          ))}
        </div>
      ) : activities.length > 0 ? (
        <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
          {activities.map(a => {
            const badge = getBadgeStyle(a.action);
            return (
              <div key={a.id} className="flex items-start gap-2.5">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${badge.cls}`}>
                  {getIcon(a.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-pdd-text">{a.username}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${badge.cls}`}>
                      {ACTION_LABELS[a.action] || a.action}
                    </span>
                  </div>
                  <p className="text-[10px] mt-0.5 truncate text-pdd-text-secondary">{a.details || '-'}</p>
                  <p className="text-[10px] text-pdd-gray-400">{new Date(a.createdAt).toLocaleString('zh-CN')}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-xs py-8 text-center text-pdd-gray-400">暂无操作记录</div>
      )}
    </div>
  );
}

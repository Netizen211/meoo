import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import {
  Users, Store, Database, HardDrive, Shield, Crown, AlertTriangle,
  Clock, Wifi, WifiOff, Server, Activity, CreditCard, FileText, Settings,
  RefreshCw, TrendingUp, UserPlus, Zap, ArrowUpRight,
} from 'lucide-react';
import { adminApi, type AdminStats } from '../../api/adminApi';

interface ActivityItem {
  id: number;
  username: string;
  action: string;
  details: string;
  targetType: string;
  createdAt: string;
}

interface HealthData {
  dbConnected: boolean;
  uptime: number;
  status: string;
  timestamp: string;
}

interface GrowthPoint {
  date: string;
  newUsers: number;
  newStores: number;
}

const ACTION_LABELS: Record<string, string> = {
  ban_user: '封禁用户', unban_user: '解封用户',
  admin_adjust_membership: '调整会员',
  delete_data: '删除数据', generate_invite: '生成邀请码',
  delete_invite: '删除邀请码', system_config: '系统配置',
  impersonate_user: '模拟登录',
};

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [growthTrend, setGrowthTrend] = useState<GrowthPoint[]>([]);
  const [apiLatency, setApiLatency] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const startTime = performance.now();
    try {
      const [s, a, h, g] = await Promise.all([
        adminApi.getStats(),
        adminApi.getRecentActivity(),
        adminApi.getHealth(),
        adminApi.getGrowthTrend(),
      ]);
      const latency = Math.round(performance.now() - startTime);
      setStats(s);
      if (a?.success) setActivities(a.data || []);
      if (h?.success) setHealth(h.data);
      if (g?.success) setGrowthTrend(g.data || []);
      setApiLatency(latency);
    } catch {
      // keep stale data on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  const getActionIcon = (action: string) => {
    if (action.includes('ban')) return <Shield size={12} />;
    if (action.includes('membership')) return <Crown size={12} />;
    if (action.includes('invite')) return <UserPlus size={12} />;
    if (action.includes('impersonate')) return <Users size={12} />;
    return <FileText size={12} />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('ban') && !action.includes('unban')) return 'text-red-400 bg-red-500/10';
    if (action.includes('unban')) return 'text-green-400 bg-green-500/10';
    if (action.includes('membership')) return 'text-amber-400 bg-amber-500/10';
    if (action.includes('impersonate')) return 'text-purple-400 bg-purple-500/10';
    return 'text-blue-400 bg-blue-500/10';
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <RefreshCw size={24} className="animate-spin text-pdd-text-secondary" />
        <span className="text-sm text-pdd-text-secondary">加载系统数据...</span>
      </div>
    );
  }

  const cards = [
    { label: '总用户', value: stats?.totalUsers ?? 0, icon: Users, color: '#3b82f6', bg: 'bg-blue-500/10', path: '/users' },
    { label: '企业用户', value: stats?.enterpriseUsers ?? 0, icon: Shield, color: '#22c55e', bg: 'bg-green-500/10', path: '/members' },
    { label: 'Pro 用户', value: stats?.proUsers ?? 0, icon: Crown, color: '#f59e0b', bg: 'bg-amber-500/10', path: '/members' },
    { label: '免费用户', value: stats?.freeUsers ?? 0, icon: Activity, color: '#6b7280', bg: 'bg-gray-500/10', path: '/users' },
    { label: '总店铺', value: stats?.totalStores ?? 0, icon: Store, color: '#8b5cf6', bg: 'bg-violet-500/10', path: '/data' },
    { label: '总记录数', value: (stats?.totalRecords ?? 0).toLocaleString(), icon: Database, color: '#06b6d4', bg: 'bg-cyan-500/10', path: '/data' },
    { label: '今日活跃', value: stats?.todayActiveUsers ?? 0, icon: Zap, color: '#14b8a6', bg: 'bg-teal-500/10' },
    { label: '封禁用户', value: stats?.bannedUsers ?? 0, icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/10', path: '/users' },
  ];

  const pieData = [
    { name: '企业', value: stats?.enterpriseUsers || 0 },
    { name: '专业', value: stats?.proUsers || 0 },
    { name: '免费', value: stats?.freeUsers || 0 },
  ].filter(d => d.value > 0);

  const storageMB = ((stats?.storageBytes ?? 0) / (1024 * 1024)).toFixed(1);
  const storagePercent = Math.min(((stats?.storageBytes ?? 0) / (500 * 1024 * 1024)) * 100, 100);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">系统概览</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">
            实时监控平台运行状态
            {health && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20">
                {health.status === 'healthy' ? '运行正常' : '降级运行'}
              </span>
            )}
          </p>
        </div>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-pdd-card text-pdd-text-secondary hover:text-pdd-text transition-colors" title="刷新数据">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => card.path ? navigate(card.path) : undefined}
            className={`bg-pdd-card rounded-xl border border-pdd-border p-4 transition-all ${
              card.path ? 'cursor-pointer hover:border-pdd-primary/30 hover:shadow-lg hover:shadow-pdd-primary/5' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-pdd-text-secondary font-medium">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-pdd-text-primary tabular-nums">{card.value}</span>
              {card.path && <ArrowUpRight size={12} className="text-pdd-text-secondary mb-1 opacity-50" />}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">会员分布</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={150}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={55} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, idx) => <Cell key={idx} fill={COLORS[idx]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 flex-1">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-pdd-text-secondary">{d.name}</span>
                    <span className="text-xs font-bold text-pdd-text-primary ml-auto">{d.value}</span>
                  </div>
                ))}
                <div className="text-[10px] text-pdd-text-secondary pt-1 border-t border-pdd-border">
                  总计 <span className="font-bold text-pdd-text-primary">{(stats?.totalUsers ?? 0).toLocaleString()}</span> 用户
                </div>
              </div>
            </div>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无数据</div>
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">近7天增长趋势</h3>
          {growthTrend.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={growthTrend}>
                  <defs>
                    <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorStores" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--pdd-border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--pdd-text-secondary)' }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#171717', border: '1px solid #262626', borderRadius: 8, fontSize: 12 }} />
                  <Area type="monotone" dataKey="newUsers" name="新用户" stroke="#3b82f6" fill="url(#colorUsers)" strokeWidth={2} />
                  <Area type="monotone" dataKey="newStores" name="新店铺" stroke="#8b5cf6" fill="url(#colorStores)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2 justify-center">
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-blue-500" /><span className="text-[10px] text-pdd-text-secondary">新用户</span></div>
                <div className="flex items-center gap-1.5"><div className="w-3 h-0.5 rounded bg-violet-500" /><span className="text-[10px] text-pdd-text-secondary">新店铺</span></div>
              </div>
            </>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无趋势数据</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-pdd-text-primary">最近操作</h3>
            <Clock size={14} className="text-pdd-text-secondary" />
          </div>
          {activities.length > 0 ? (
            <div className="space-y-3 max-h-[260px] overflow-y-auto">
              {activities.map((a) => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${getActionColor(a.action)}`}>
                    {getActionIcon(a.action)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-pdd-text-primary">{a.username}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-pdd-bg text-pdd-text-secondary">
                        {ACTION_LABELS[a.action] || a.action}
                      </span>
                    </div>
                    <p className="text-[10px] text-pdd-text-secondary truncate mt-0.5">{a.details || '-'}</p>
                    <p className="text-[10px] text-pdd-gray-400 mt-0.5">{new Date(a.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无操作记录</div>
          )}
        </div>

        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">系统健康</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg">
              <div className="flex items-center gap-2">
                {health?.dbConnected ? <Wifi size={14} className="text-green-400" /> : <WifiOff size={14} className="text-red-400" />}
                <span className="text-xs text-pdd-text-secondary">数据库</span>
              </div>
              <span className={`text-xs font-medium ${health?.dbConnected ? 'text-green-400' : 'text-red-400'}`}>
                {health?.dbConnected ? '正常' : '异常'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg">
              <div className="flex items-center gap-2">
                <Server size={14} className="text-blue-400" />
                <span className="text-xs text-pdd-text-secondary">API 延迟</span>
              </div>
              <span className={`text-xs font-medium tabular-nums ${(apiLatency ?? 0) < 300 ? 'text-green-400' : (apiLatency ?? 0) < 800 ? 'text-amber-400' : 'text-red-400'}`}>
                {apiLatency !== null ? `${apiLatency}ms` : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg">
              <div className="flex items-center gap-2">
                <HardDrive size={14} className="text-cyan-400" />
                <span className="text-xs text-pdd-text-secondary">存储空间</span>
              </div>
              <span className={`text-xs font-medium ${storagePercent < 80 ? 'text-green-400' : storagePercent < 95 ? 'text-amber-400' : 'text-red-400'}`}>
                {storageMB} MB
              </span>
            </div>
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-pdd-bg">
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-purple-400" />
                <span className="text-xs text-pdd-text-secondary">运行时长</span>
              </div>
              <span className="text-xs font-medium text-pdd-text-primary tabular-nums">
                {health?.uptime ? formatUptime(health.uptime) : '-'}
              </span>
            </div>
            <div className="w-full bg-pdd-bg rounded-full h-1.5 mt-1">
              <div
                className="h-1.5 rounded-full transition-all duration-700"
                style={{
                  width: `${Math.max(100 - storagePercent, 4)}%`,
                  backgroundColor: storagePercent > 90 ? 'var(--pdd-danger)' : storagePercent > 70 ? 'var(--pdd-warning)' : 'var(--pdd-success)',
                }}
              />
            </div>
            <p className="text-[10px] text-pdd-text-secondary text-center">存储使用 {storagePercent.toFixed(1)}%</p>
          </div>
        </div>

        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">快捷操作</h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: '审核充值', icon: CreditCard, color: 'text-amber-400', bg: 'bg-amber-500/10', path: '/recharge' },
              { label: '用户管理', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10', path: '/users' },
              { label: '操作日志', icon: FileText, color: 'text-cyan-400', bg: 'bg-cyan-500/10', path: '/logs' },
              { label: '系统设置', icon: Settings, color: 'text-gray-400', bg: 'bg-gray-500/10', path: '/settings' },
              { label: '会员管理', icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10', path: '/members' },
              { label: '数据监控', icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10', path: '/data' },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg bg-pdd-bg hover:bg-pdd-border/50 transition-colors"
              >
                <div className={`w-9 h-9 rounded-lg ${item.bg} flex items-center justify-center`}>
                  <item.icon size={16} className={item.color} />
                </div>
                <span className="text-[10px] text-pdd-text-secondary">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

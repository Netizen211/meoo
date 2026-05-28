import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Users, Store, Database, Upload, Shield, AlertTriangle,
  Crown, Activity, Clock, UserPlus, FileText,
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

const ACTION_LABELS: Record<string, string> = {
  ban_user: '封禁用户', unban_user: '解封用户',
  admin_adjust_membership: '调整会员',
  delete_data: '删除数据', generate_invite: '生成邀请码',
  delete_invite: '删除邀请码', system_config: '系统配置',
};

const COLORS = ['#22c55e', '#f59e0b', '#3b82f6'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getStats(),
      adminApi.getRecentActivity(),
    ]).then(([s, a]) => {
      setStats(s);
      if (a?.success) setActivities(a.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-pdd-text-secondary">加载中...</div>;
  }

  const cards = [
    { label: '总用户', value: stats?.totalUsers ?? 0, icon: Users, color: '#3b82f6', bg: 'bg-blue-500/10' },
    { label: '企业用户', value: stats?.enterpriseUsers ?? 0, icon: Shield, color: '#22c55e', bg: 'bg-green-500/10' },
    { label: 'Pro 用户', value: stats?.proUsers ?? 0, icon: Crown, color: '#f59e0b', bg: 'bg-amber-500/10' },
    { label: '免费用户', value: stats?.freeUsers ?? 0, icon: Activity, color: '#6b7280', bg: 'bg-gray-500/10' },
    { label: '总店铺', value: stats?.totalStores ?? 0, icon: Store, color: '#8b5cf6', bg: 'bg-violet-500/10' },
    { label: '总记录数', value: (stats?.totalRecords ?? 0).toLocaleString(), icon: Database, color: '#06b6d4', bg: 'bg-cyan-500/10' },
    { label: '今日上传', value: stats?.todayUploads ?? 0, icon: Upload, color: '#14b8a6', bg: 'bg-teal-500/10' },
    { label: '封禁用户', value: stats?.bannedUsers ?? 0, icon: AlertTriangle, color: '#ef4444', bg: 'bg-red-500/10' },
  ];

  const pieData = [
    { name: '企业', value: stats?.enterpriseUsers || 0 },
    { name: '专业', value: stats?.proUsers || 0 },
    { name: '免费', value: stats?.freeUsers || 0 },
  ].filter(d => d.value > 0);

  const storageMB = ((stats?.storageBytes ?? 0) / (1024 * 1024)).toFixed(1);

  const getActionIcon = (action: string) => {
    if (action.includes('ban')) return <Shield size={12} />;
    if (action.includes('membership')) return <Crown size={12} />;
    if (action.includes('invite')) return <UserPlus size={12} />;
    return <FileText size={12} />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('ban') && !action.includes('unban')) return 'text-red-400 bg-red-500/10';
    if (action.includes('unban')) return 'text-green-400 bg-green-500/10';
    if (action.includes('membership')) return 'text-amber-400 bg-amber-500/10';
    return 'text-blue-400 bg-blue-500/10';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">系统概览</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">实时监控平台运行状态</p>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-4 gap-3">
        {cards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-pdd-card rounded-xl border border-pdd-border p-4 hover:border-pdd-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-pdd-text-secondary font-medium">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                <card.icon size={16} style={{ color: card.color }} />
              </div>
            </div>
            <div className="text-2xl font-bold text-pdd-text-primary tabular-nums">{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* 图表 + 活动 */}
      <div className="grid grid-cols-3 gap-4">
        {/* 会员分布饼图 */}
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">会员分布</h3>
          {pieData.length > 0 ? (
            <div className="flex items-center">
              <ResponsiveContainer width="60%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={0}>
                    {pieData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1a1d2e', border: '1px solid #2d3144', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                    <span className="text-xs text-pdd-text-secondary">{d.name}</span>
                    <span className="text-xs font-bold text-pdd-text-primary">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无数据</div>
          )}
        </div>

        {/* 存储概览 */}
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <h3 className="text-sm font-semibold text-pdd-text-primary mb-3">存储用量</h3>
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--pdd-bg)" strokeWidth="10" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="var(--pdd-primary)" strokeWidth="10"
                  strokeDasharray={`${Math.min((stats?.storageBytes ?? 0) / (500 * 1024 * 1024) * 251, 251)} 251`}
                  strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-bold text-pdd-text-primary">{storageMB}</span>
                <span className="text-[10px] text-pdd-text-secondary">MB</span>
              </div>
            </div>
            <div className="text-xs text-pdd-text-secondary">
              总记录 <span className="font-bold text-pdd-text-primary">{(stats?.totalRecords ?? 0).toLocaleString()}</span> 行
            </div>
          </div>
        </div>

        {/* 最近操作 */}
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-pdd-text-primary">最近操作</h3>
            <Clock size={14} className="text-pdd-text-secondary" />
          </div>
          {activities.length > 0 ? (
            <div className="space-y-2.5 max-h-[200px] overflow-y-auto">
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
                    <p className="text-[10px] text-pdd-text-secondary truncate">{a.details || '-'}</p>
                    <p className="text-[10px] text-pdd-gray-400">{new Date(a.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-pdd-text-secondary text-xs py-8 text-center">暂无操作记录</div>
          )}
        </div>
      </div>
    </div>
  );
}

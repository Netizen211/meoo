import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Store, Database, Upload, Shield, AlertTriangle, Crown, Activity } from 'lucide-react';
import { adminApi, type AdminStats } from '../../api/adminApi';

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats().then(data => { setStats(data); setLoading(false); });
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-pdd-text-secondary">加载中...</div>;
  }

  const cards = [
    { label: '总用户', value: stats?.totalUsers ?? 0, icon: Users, color: 'text-pdd-primary' },
    { label: '免费用户', value: stats?.freeUsers ?? 0, icon: Activity, color: 'text-pdd-text-secondary' },
    { label: 'Pro 用户', value: stats?.proUsers ?? 0, icon: Crown, color: 'text-pdd-warning' },
    { label: '企业用户', value: stats?.enterpriseUsers ?? 0, icon: Shield, color: 'text-pdd-success' },
    { label: '总店铺', value: stats?.totalStores ?? 0, icon: Store, color: 'text-pdd-info' },
    { label: '今日上传', value: stats?.todayUploads ?? 0, icon: Upload, color: 'text-pdd-primary' },
    { label: '总记录数', value: (stats?.totalRecords ?? 0).toLocaleString(), icon: Database, color: 'text-pdd-text-secondary' },
    { label: '封禁用户', value: stats?.bannedUsers ?? 0, icon: AlertTriangle, color: 'text-pdd-danger' },
  ];

  const storageMB = ((stats?.storageBytes ?? 0) / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-pdd-text-primary">系统概览</h2>
      <div className="grid grid-cols-4 gap-4">
        {cards.map((card) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-pdd-card p-4 rounded-xl border border-pdd-border"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-pdd-text-secondary">{card.label}</span>
              <card.icon size={18} className={card.color} />
            </div>
            <div className="text-2xl font-bold text-pdd-text-primary">{card.value}</div>
          </motion.div>
        ))}
      </div>
      <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border">
        <div className="text-sm text-pdd-text-secondary mb-2">存储用量</div>
        <div className="text-2xl font-bold text-pdd-text-primary">{storageMB} MB</div>
        <div className="mt-2 w-full bg-pdd-bg rounded-full h-2">
          <div className="bg-pdd-primary h-2 rounded-full" style={{ width: `${Math.min((stats?.storageBytes ?? 0) / (100 * 1024 * 1024) * 100, 100)}%` }} />
        </div>
        <div className="text-xs text-pdd-text-secondary mt-1">已用 {storageMB} MB / 无限制</div>
      </div>
    </div>
  );
}

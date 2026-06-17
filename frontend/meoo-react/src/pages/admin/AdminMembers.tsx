import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Crown, Shield, Clock, ChevronLeft, ChevronRight,
  AlertTriangle, History, Edit3, Store, X,
} from 'lucide-react';
import type { AdminUser } from '../../../api/adminApi';
import { useAdminUsers, useAdjustMembership, useMembershipHistory } from '../../hooks/useAdminData';

const PAGE_SIZE = 20;
const LEVEL_LABELS: Record<string, string> = { free: '免费', pro: '专业', enterprise: '企业' };
const LEVEL_OPTIONS = [
  { value: 'free', label: '免费' },
  { value: 'pro', label: '专业 Pro' },
  { value: 'enterprise', label: '企业 Enterprise' },
];
const DURATION_LABELS: Record<string, string> = { monthly: '月付', yearly: '年付' };

type FilterType = 'all' | 'free' | 'pro' | 'enterprise' | 'expired';

export default function AdminMembers() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [actionMsg, setActionMsg] = useState('');
  const [page, setPage] = useState(1);

  // Adjust membership modal
  const [adjustModal, setAdjustModal] = useState<AdminUser | null>(null);
  const [adjustLevel, setAdjustLevel] = useState('free');
  const [adjustExpires, setAdjustExpires] = useState('');
  const [adjustNote, setAdjustNote] = useState('');

  // History modal
  const [historyModal, setHistoryModal] = useState<{ userId: string; username: string } | null>(null);

  const membershipLevel = (filter === 'free' || filter === 'pro' || filter === 'enterprise') ? filter : undefined;
  const { data: usersData, isLoading } = useAdminUsers({ page, pageSize: PAGE_SIZE, search, membershipLevel });
  const adjustMutation = useAdjustMembership();
  const { data: history = [], isLoading: historyLoading } = useMembershipHistory(historyModal?.userId ?? null);

  // Apply client-side expired filter + compute total
  const { users, total } = useMemo(() => {
    const raw = usersData?.users ?? [];
    const totalRaw = usersData?.total ?? 0;
    if (filter === 'expired') {
      const now = new Date();
      const filtered = raw.filter((u: AdminUser) =>
        u.membershipLevel !== 'free' && u.membershipExpiresAt && new Date(u.membershipExpiresAt) < now
      );
      return { users: filtered, total: filtered.length };
    }
    return { users: raw, total: totalRaw };
  }, [usersData, filter]);

  const showMsg = (msg: string) => {
    setActionMsg(msg);
    setTimeout(() => setActionMsg(''), 2000);
  };

  const openAdjustModal = (u: AdminUser) => {
    setAdjustModal(u);
    setAdjustLevel(u.membershipLevel || 'free');
    setAdjustExpires(u.membershipExpiresAt ? u.membershipExpiresAt.split('T')[0] : '');
    setAdjustNote('');
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const ok = await adjustMutation.mutateAsync({
      userId: adjustModal.id,
      membershipLevel: adjustLevel,
      expiresAt: adjustExpires || undefined,
      note: adjustNote || undefined,
    });
    if (ok) {
      showMsg('会员调整成功');
      setAdjustModal(null);
    } else {
      showMsg('操作失败');
    }
  };

  // Compute expiry status
  const getExpiryStatus = (user: AdminUser): 'normal' | 'warning' | 'expired' | 'free' => {
    if (!user.membershipLevel || user.membershipLevel === 'free') return 'free';
    if (!user.membershipExpiresAt) return 'normal';
    const now = new Date();
    const expires = new Date(user.membershipExpiresAt);
    if (expires < now) return 'expired';
    const daysUntilExpiry = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntilExpiry <= 7) return 'warning';
    return 'normal';
  };

  const getExpiryDisplay = (user: AdminUser) => {
    if (!user.membershipExpiresAt) return '-';
    const status = getExpiryStatus(user);
    const dateStr = new Date(user.membershipExpiresAt).toLocaleDateString('zh-CN');
    if (status === 'expired') {
      return (
        <div className="flex items-center gap-1">
          <span className="text-pdd-danger text-xs">{dateStr}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pdd-danger/10 text-pdd-danger font-medium">
            已过期
          </span>
        </div>
      );
    }
    if (status === 'warning') {
      const now = new Date();
      const daysLeft = Math.ceil((new Date(user.membershipExpiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return (
        <div className="flex items-center gap-1">
          <span className="text-pdd-warning text-xs">{dateStr}</span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-pdd-warning/10 text-pdd-warning font-medium">
            {daysLeft}天到期
          </span>
        </div>
      );
    }
    return <span className="text-pdd-text-secondary text-xs">{dateStr}</span>;
  };

  const getLevelBadge = (level: string) => {
    const map: Record<string, string> = {
      free: 'bg-pdd-bg text-pdd-text-secondary border border-pdd-border',
      pro: 'bg-pdd-warning/20 text-pdd-warning',
      enterprise: 'bg-pdd-success/20 text-pdd-success',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${map[level] || ''}`}>
        {LEVEL_LABELS[level] || level}
      </span>
    );
  };

  const FILTER_TABS: { key: FilterType; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: '全部' },
    { key: 'free', label: '免费' },
    { key: 'pro', label: 'Pro' },
    { key: 'enterprise', label: '企业', icon: <Shield size={12} /> },
    { key: 'expired', label: '已过期', icon: <AlertTriangle size={12} /> },
  ];

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">会员管理</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">管理用户会员等级、到期时间和变更记录</p>
        </div>
      </div>

      {/* Action message */}
      <AnimatePresence>
        {actionMsg && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20"
          >
            {actionMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Filter tabs */}
        <div className="flex gap-1 p-1 bg-pdd-bg rounded-lg">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => { setFilter(tab.key); setPage(1); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-pdd-card text-pdd-text-primary shadow-sm'
                  : 'text-pdd-text-secondary hover:text-pdd-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
          <input
            className="bg-pdd-card border border-pdd-border rounded-lg pl-9 pr-3 py-2 text-sm text-pdd-text-primary w-56 outline-none focus:border-pdd-primary/50 transition-colors"
            placeholder="搜索用户名..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-16 text-pdd-text-secondary">加载中...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-pdd-text-secondary">
              <Crown size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无会员数据</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg/50">
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">用户名</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">当前等级</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">到期时间</th>
                  <th className="text-center py-3 px-4 font-medium text-pdd-text-secondary">累计充值</th>
                  <th className="text-center py-3 px-4 font-medium text-pdd-text-secondary">店铺数</th>
                  <th className="text-left py-3 px-4 font-medium text-pdd-text-secondary">最近活跃</th>
                  <th className="text-right py-3 px-4 font-medium text-pdd-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr
                    key={u.id}
                    className={`border-b border-pdd-border/30 hover:bg-pdd-bg/30 transition-colors ${
                      getExpiryStatus(u) === 'expired' ? 'bg-pdd-danger/5' : ''
                    } ${getExpiryStatus(u) === 'warning' ? 'bg-pdd-warning/5' : ''}`}
                  >
                    <td className="py-3 px-4">
                      <div className="font-medium text-pdd-text-primary">{u.username}</div>
                      <div className="text-xs text-pdd-text-secondary">{u.phone || '-'}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getLevelBadge(u.membershipLevel)}
                      </div>
                    </td>
                    <td className="py-3 px-4">{getExpiryDisplay(u)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-pdd-text-primary font-medium tabular-nums">
                        ¥{u.totalRecharge ?? 0}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-pdd-text-secondary tabular-nums">
                      {u.storeCount ?? '-'}
                    </td>
                    <td className="py-3 px-4 text-pdd-text-secondary text-xs">
                      {u.lastLoginAt
                        ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN')
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setHistoryModal({ userId: u.id, username: u.username })}
                          className="p-1.5 rounded text-pdd-text-secondary hover:text-pdd-info hover:bg-pdd-info/10 transition-colors"
                          title="变更历史"
                        >
                          <History size={15} />
                        </button>
                        <button
                          onClick={() => openAdjustModal(u)}
                          className="px-3 py-1 rounded text-xs font-medium bg-pdd-primary/10 text-pdd-primary hover:bg-pdd-primary/20 transition-colors flex items-center gap-1"
                        >
                          <Edit3 size={12} />
                          调整
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-pdd-text-secondary">
          <span>共 {total} 条记录</span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded border border-pdd-border disabled:opacity-30 hover:bg-pdd-bg transition-colors"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="px-2 text-xs text-pdd-text-primary tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded border border-pdd-border disabled:opacity-30 hover:bg-pdd-bg transition-colors"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-pdd-text-secondary">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-pdd-warning/30 border border-pdd-warning/40" />
          7天内到期
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-pdd-danger/20 border border-pdd-danger/30" />
          已过期
        </div>
      </div>

      {/* Adjust Membership Modal */}
      <AnimatePresence>
        {adjustModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setAdjustModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                    <Crown size={20} className="text-amber-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-pdd-text-primary">调整会员</h3>
                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      用户：{adjustModal.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setAdjustModal(null)}
                  className="p-1.5 rounded-lg hover:bg-pdd-bg transition-colors text-pdd-text-secondary"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-2 block">
                  选择等级
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {LEVEL_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setAdjustLevel(opt.value)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-medium border transition-colors ${
                        adjustLevel === opt.value
                          ? 'border-pdd-primary bg-pdd-primary/10 text-pdd-primary'
                          : 'border-pdd-border text-pdd-text-secondary hover:border-pdd-primary/50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  到期时间
                </label>
                <input
                  type="date"
                  value={adjustExpires}
                  onChange={e => setAdjustExpires(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                />
                <p className="text-xs text-pdd-text-secondary mt-1">
                  留空表示无到期限制（免费用户建议留空）
                </p>
              </div>

              <div className="mb-5">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  操作备注
                </label>
                <textarea
                  value={adjustNote}
                  onChange={e => setAdjustNote(e.target.value)}
                  placeholder="填写调整原因..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setAdjustModal(null)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAdjust}
                  disabled={adjustMutation.isPending}
                  className="flex-1 py-2.5 rounded-lg bg-pdd-primary hover:bg-pdd-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {adjustMutation.isPending ? '保存中...' : '确认调整'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Membership History Modal */}
      <AnimatePresence>
        {historyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setHistoryModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-lg w-full max-h-[70vh] shadow-xl border border-pdd-border flex flex-col"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <History size={20} className="text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-pdd-text-primary">会员变更历史</h3>
                    <p className="text-xs text-pdd-text-secondary mt-0.5">
                      用户：{historyModal.username}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setHistoryModal(null)}
                  className="p-1.5 rounded-lg hover:bg-pdd-bg transition-colors text-pdd-text-secondary"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {historyLoading ? (
                  <div className="text-center py-8 text-pdd-text-secondary text-xs">加载中...</div>
                ) : history.length === 0 ? (
                  <div className="text-center py-8 text-pdd-text-secondary text-xs">
                    <Clock size={24} className="mx-auto mb-2 opacity-30" />
                    暂无变更记录
                  </div>
                ) : (
                  <div className="space-y-2">
                    {history.map(h => (
                      <div
                        key={h.id}
                        className="bg-pdd-bg rounded-lg p-3 border border-pdd-border"
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`px-2 py-0.5 rounded text-xs ${getLevelBadge(h.fromLevel) ?? ''}`}>
                            {LEVEL_LABELS[h.fromLevel] || h.fromLevel}
                          </span>
                          <span className="text-pdd-text-secondary text-xs">&rarr;</span>
                          <span className={`px-2 py-0.5 rounded text-xs ${getLevelBadge(h.toLevel) ?? ''}`}>
                            {LEVEL_LABELS[h.toLevel] || h.toLevel}
                          </span>
                        </div>
                        {h.note && (
                          <p className="text-xs text-pdd-text-secondary mb-1">{h.note}</p>
                        )}
                        <div className="flex items-center gap-3 text-[10px] text-pdd-text-secondary">
                          <span>操作人：{h.operatedBy}</span>
                          {h.toExpiresAt && (
                            <span>到期：{new Date(h.toExpiresAt).toLocaleDateString('zh-CN')}</span>
                          )}
                          <span>{new Date(h.createdAt).toLocaleString('zh-CN')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 mt-4">
                <button
                  onClick={() => setHistoryModal(null)}
                  className="w-full py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

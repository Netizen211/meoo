import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Ban, CheckCircle, ChevronDown, ChevronUp,
  X, AlertTriangle, Bell, Store, Database, CreditCard,
  RotateCcw, ChevronLeft, ChevronRight, Users as UsersIcon,
  UserPlus, ExternalLink, Download,
} from 'lucide-react';
import { adminApi, type AdminUser, type UserStore, type UserRechargeRecord, type GetUsersParams } from '../../../api/adminApi';
import { useAuth } from '../../App';
import { useAdminUsers, useBanUser, useBatchBanUsers, useBatchNotify, useCreateUser } from '../../hooks/useAdminData';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [riskFilter, setRiskFilter] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // ── react-query 用户列表（自动缓存/刷新） ──
  const queryParams: GetUsersParams = { page, pageSize, search };
  if (roleFilter) queryParams.role = roleFilter;
  if (levelFilter) queryParams.membershipLevel = levelFilter;
  if (activityFilter) queryParams.activityLevel = activityFilter;
  if (riskFilter) queryParams.hasRisk = riskFilter;
  const { data, isLoading } = useAdminUsers(queryParams);
  const users = data?.users || [];
  const total = data?.total || 0;

  // ── react-query 变更操作（自动刷新列表） ──
  const banMutation = useBanUser();
  const batchBanMutation = useBatchBanUsers();
  const notifyMutation = useBatchNotify();
  const createUserMutation = useCreateUser();

  // Expand row
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stores, setStores] = useState<UserStore[]>([]);
  const [rechargeRecords, setRechargeRecords] = useState<UserRechargeRecord[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Selection for batch ops
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Ban modal
  const [banModal, setBanModal] = useState<{
    userId: string;
    username: string;
    isBanned: boolean;
  } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banSubmitting, setBanSubmitting] = useState(false);

  // Batch notify modal
  const [notifyModal, setNotifyModal] = useState(false);
  const [notifyMessage, setNotifyMessage] = useState('');
  const [notifySubmitting, setNotifySubmitting] = useState(false);

  // Confirm batch ban
  const [batchBanConfirm, setBatchBanConfirm] = useState<{
    isBanned: boolean;
  } | null>(null);
  const [batchBanReason, setBatchBanReason] = useState('');
  const [batchBanSubmitting, setBatchBanSubmitting] = useState(false);

  // Create user modal
  const [createModal, setCreateModal] = useState(false);
  const [createUsername, setCreateUsername] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState('normal');
  const [createLevel, setCreateLevel] = useState('free');
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Load user detail when expanding
  const handleExpand = async (userId: string) => {
    if (expandedId === userId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(userId);
    setDetailLoading(true);
    setStores([]);
    setRechargeRecords([]);
    const detail = await adminApi.getUserDetail(userId);
    if (detail) {
      setStores(detail.stores || []);
      setRechargeRecords(detail.rechargeRecords || []);
    }
    setDetailLoading(false);
  };

  // Single ban/unban
  const openBanModal = (userId: string, username: string, isBanned: boolean) => {
    if (userId === currentUser?.id) {
      setActionMsg('不能操作自己的账号');
      setTimeout(() => setActionMsg(''), 2000);
      return;
    }
    setBanModal({ userId, username, isBanned });
    setBanReason('');
  };

  const handleBan = async () => {
    if (!banModal) return;
    setBanSubmitting(true);
    const ok = await banMutation.mutateAsync({
      userId: banModal.userId,
      isBanned: !banModal.isBanned,
      reason: banReason || undefined,
    });
    setBanSubmitting(false);
    if (ok) {
      setActionMsg(banModal.isBanned ? '已解封' : '已封禁');
      setBanModal(null);
    } else {
      setActionMsg('操作失败');
    }
    setTimeout(() => setActionMsg(''), 2000);
  };

  // Batch operations
  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(users.map(u => u.id)));
    }
  };

  const openBatchBan = (isBanned: boolean) => {
    setBatchBanConfirm({ isBanned });
    setBatchBanReason('');
  };

  const handleBatchBan = async () => {
    if (!batchBanConfirm) return;
    setBatchBanSubmitting(true);
    const ids = Array.from(selectedIds);
const ok = await batchBanMutation.mutateAsync({ userIds: ids, isBanned: batchBanConfirm.isBanned, reason: batchBanReason || undefined });
    setBatchBanSubmitting(false);
    if (ok) {
      setSelectedIds(new Set());
      setActionMsg(batchBanConfirm.isBanned ? `已封禁 ${ids.length} 个用户` : `已解封 ${ids.length} 个用户`);
    } else {
      setActionMsg('批量操作失败');
    }
    setBatchBanConfirm(null);
    setTimeout(() => setActionMsg(''), 2000);
  };

  const handleBatchNotify = async () => {
    if (!notifyMessage.trim()) return;
    setNotifySubmitting(true);
    const ids = Array.from(selectedIds);
    const ok = await notifyMutation.mutateAsync({ userIds: ids, message: notifyMessage });
    setNotifySubmitting(false);
    if (ok) {
      setSelectedIds(new Set());
      setActionMsg(`已向 ${ids.length} 个用户发送通知`);
      setNotifyModal(false);
      setNotifyMessage('');
    } else {
      setActionMsg('发送通知失败');
    }
    setTimeout(() => setActionMsg(''), 2000);
  };

  const handleCreateUser = async () => {
    setCreateError('');
    if (!createUsername.trim()) { setCreateError('请输入用户名'); return; }
    if (createUsername.trim().length < 3) { setCreateError('用户名至少3个字符'); return; }
    if (!createPassword.trim()) { setCreateError('请输入密码'); return; }
    if (createPassword.trim().length < 6) { setCreateError('密码至少6个字符'); return; }

    setCreateSubmitting(true);
    const res = await adminApi.createUser({
      username: createUsername.trim(),
      password: createPassword.trim(),
      email: createEmail.trim() || undefined,
      role: createRole,
      membershipLevel: createLevel,
    });
    setCreateSubmitting(false);

    if (res.success) {
      setCreateModal(false);
      setCreateUsername('');
      setCreatePassword('');
      setCreateEmail('');
      setCreateRole('normal');
      setCreateLevel('free');
      setActionMsg(`账号创建成功`);
      setTimeout(() => setActionMsg(''), 2000);
    } else {
      setCreateError(res.error || '创建失败');
    }
  };

  const getLevelBadge = (level: string) => {
    const map: Record<string, string> = {
      free: 'bg-pdd-bg text-pdd-text-secondary',
      pro: 'bg-pdd-warning/20 text-pdd-warning',
      enterprise: 'bg-pdd-success/20 text-pdd-success',
    };
    const labels: Record<string, string> = { free: '免费', pro: '专业', enterprise: '企业' };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${map[level] || ''}`}>
        {labels[level] || level}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = {
      admin: 'bg-pdd-danger/20 text-pdd-danger',
      user: 'bg-pdd-info/20 text-pdd-info',
      test: 'bg-pdd-purple/20 text-pdd-purple',
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${map[role] || 'bg-pdd-bg text-pdd-text-secondary'}`}>
        {role === 'admin' ? '管理员' : role === 'test' ? '测试' : '用户'}
      </span>
    );
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">用户管理</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">
            共 {total} 个用户，已选择 {selectedIds.size} 个
          </p>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: '总用户', value: total, color: 'text-blue-400' },
          { label: '管理员', value: users.filter(u => u.role === 'admin').length, color: 'text-red-400' },
          { label: '已封禁', value: users.filter(u => u.isBanned).length, color: 'text-red-400' },
          { label: '企业版', value: users.filter(u => u.membershipLevel === 'enterprise').length, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-pdd-card rounded-lg border border-pdd-border px-3 py-2 flex items-center justify-between">
            <span className="text-xs text-pdd-text-secondary">{s.label}</span>
            <span className={`text-sm font-bold ${s.color}`}>{s.value}</span>
          </div>
        ))}
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
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
          <input
            className="bg-pdd-card border border-pdd-border rounded-lg pl-9 pr-3 py-2 text-sm text-pdd-text-primary w-56 outline-none focus:border-pdd-primary/50 transition-colors"
            placeholder="搜索用户名/手机号..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => { setRoleFilter(e.target.value); setPage(1); }}
          className="bg-pdd-card border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary outline-none focus:border-pdd-primary/50"
        >
          <option value="">全部角色</option>
          <option value="user">用户</option>
          <option value="admin">管理员</option>
          <option value="test">测试</option>
        </select>
        <select
          value={levelFilter}
          onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
          className="bg-pdd-card border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary outline-none focus:border-pdd-primary/50"
        >
          <option value="">全部会员</option>
          <option value="free">免费</option>
          <option value="pro">专业</option>
          <option value="enterprise">企业</option>
        </select>
        <select
          value={activityFilter}
          onChange={e => { setActivityFilter(e.target.value); setPage(1); }}
          className="bg-pdd-card border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary outline-none focus:border-pdd-primary/50"
        >
          <option value="">全部活跃度</option>
          <option value="high">高活跃</option>
          <option value="medium">中活跃</option>
          <option value="low">低活跃</option>
          <option value="silent">沉默用户</option>
        </select>
        <select
          value={riskFilter}
          onChange={e => { setRiskFilter(e.target.value); setPage(1); }}
          className="bg-pdd-card border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary outline-none focus:border-pdd-primary/50"
        >
          <option value="">全部风险</option>
          <option value="true">有风险</option>
          <option value="false">无风险</option>
        </select>

        <div className="flex-1" />

        {/* Export button */}
        <button
          onClick={async () => {
            const ok = await adminApi.exportUsersCSV();
            if (!ok) setActionMsg('导出失败');
            else setActionMsg('导出成功');
          }}
          className="px-3 py-2 rounded-lg text-xs border border-pdd-border text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1.5"
        >
          <Download size={13} /> 导出
        </button>

        {/* Create user button */}
        <button
          onClick={() => { setCreateModal(true); setCreateError(''); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-pdd-primary text-white hover:bg-pdd-primary-dark transition-colors flex items-center gap-2"
        >
          <UserPlus size={16} />
          创建账号
        </button>

        {/* Batch action buttons */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => openBatchBan(true)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pdd-danger/20 text-pdd-danger hover:bg-pdd-danger/30 transition-colors flex items-center gap-1"
            >
              <Ban size={13} />
              批量封禁
            </button>
            <button
              onClick={() => openBatchBan(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pdd-success/20 text-pdd-success hover:bg-pdd-success/30 transition-colors flex items-center gap-1"
            >
              <CheckCircle size={13} />
              批量解封
            </button>
            <button
              onClick={() => { setNotifyModal(true); setNotifyMessage(''); }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-pdd-info/20 text-pdd-info hover:bg-pdd-info/30 transition-colors flex items-center gap-1"
            >
              <Bell size={13} />
              发送通知
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-16 text-pdd-text-secondary">加载中...</div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-pdd-text-secondary">
              <UsersIcon size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无用户数据</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-pdd-border bg-pdd-bg/50">
                  <th className="py-3 px-3 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === users.length && users.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-pdd-border"
                    />
                  </th>
                  <th className="text-left py-3 px-2 font-medium text-pdd-text-secondary">用户名</th>
                  <th className="text-left py-3 px-2 font-medium text-pdd-text-secondary">角色</th>
                  <th className="text-left py-3 px-2 font-medium text-pdd-text-secondary">会员等级</th>
                  <th className="text-left py-3 px-2 font-medium text-pdd-text-secondary">注册时间</th>
                  <th className="text-left py-3 px-2 font-medium text-pdd-text-secondary">最后登录</th>
                  <th className="text-center py-3 px-2 font-medium text-pdd-text-secondary">店铺数</th>
                  <th className="text-center py-3 px-2 font-medium text-pdd-text-secondary">数据量</th>
                  <th className="text-center py-3 px-2 font-medium text-pdd-text-secondary">活跃度</th>
                  <th className="text-center py-3 px-2 font-medium text-pdd-text-secondary">风险</th>
                  <th className="text-center py-3 px-2 font-medium text-pdd-text-secondary">状态</th>
                  <th className="text-right py-3 px-2 font-medium text-pdd-text-secondary">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <React.Fragment key={u.id}>
                    <tr
                      className={`border-b border-pdd-border/30 hover:bg-pdd-bg/30 cursor-pointer transition-colors ${
                        u.isBanned ? 'bg-pdd-danger/5' : ''
                      } ${selectedIds.has(u.id) ? 'bg-pdd-info/5' : ''}`}
                      onClick={() => handleExpand(u.id)}
                    >
                      <td className="py-3 px-3" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(u.id)}
                          onChange={() => toggleSelect(u.id)}
                          className="rounded border-pdd-border"
                        />
                      </td>
                      <td className="py-3 px-2 text-pdd-text-primary font-medium">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate('/users/' + u.id); }}
                            className="text-pdd-text-primary hover:text-amber-400 transition-colors flex items-center gap-1 font-medium"
                            title="查看用户详情"
                          >
                            {u.username}
                            <ExternalLink size={10} className="opacity-40" />
                          </button>
                          {u.isBanned && (
                            <span className="text-xs text-pdd-danger px-1.5 py-0.5 rounded bg-pdd-danger/10">
                              已封禁
                            </span>
                          )}
                        </div>
                        {u.phone && (
                          <span className="text-xs text-pdd-text-secondary">{u.phone}</span>
                        )}
                      </td>
                      <td className="py-3 px-2">{getRoleBadge(u.role)}</td>
                      <td className="py-3 px-2">{getLevelBadge(u.membershipLevel)}</td>
                      <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                        {new Date(u.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                        {u.lastLoginAt
                          ? new Date(u.lastLoginAt).toLocaleDateString('zh-CN')
                          : '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-pdd-text-primary tabular-nums">
                        {u.storeCount ?? '-'}
                      </td>
                      <td className="py-3 px-2 text-center text-pdd-text-secondary text-xs tabular-nums">
                        {u.dataVolume != null ? `${u.dataVolume.toLocaleString()} 行` : '-'}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {u.activityLevel ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            u.activityLevel === 'high' ? 'bg-green-50 text-green-700 border border-green-200' :
                            u.activityLevel === 'medium' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            u.activityLevel === 'low' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                            'bg-gray-50 text-gray-500 border border-gray-200'
                          }`}>
                            {u.activityLevel === 'high' ? '高' : u.activityLevel === 'medium' ? '中' : u.activityLevel === 'low' ? '低' : '沉默'}
                          </span>
                        ) : (
                          <span className="text-xs text-pdd-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {u.riskEventCount != null && u.riskEventCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-50 text-red-700 border border-red-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            {u.riskEventCount}
                          </span>
                        ) : (
                          <span className="text-xs text-pdd-text-secondary">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {u.isBanned ? (
                          <span className="text-xs text-pdd-danger">已封禁</span>
                        ) : (
                          <span className="text-xs text-pdd-success">正常</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openBanModal(u.id, u.username, u.isBanned)}
                            className={`p-1.5 rounded transition-colors ${
                              u.isBanned
                                ? 'text-pdd-success hover:bg-pdd-success/10'
                                : 'text-pdd-danger hover:bg-pdd-danger/10'
                            }`}
                            title={u.isBanned ? '解封' : '封禁'}
                          >
                            {u.isBanned ? <CheckCircle size={15} /> : <Ban size={15} />}
                          </button>
                          <span className="text-pdd-text-secondary/50 text-xs">
                            {expandedId === u.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    <AnimatePresence>
                      {expandedId === u.id && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="border-b border-pdd-border/30 bg-pdd-bg/20"
                        >
                          <td colSpan={12} className="p-0">
                            {detailLoading ? (
                              <div className="text-center py-6 text-pdd-text-secondary text-xs">
                                加载详情中...
                              </div>
                            ) : (
                              <div className="p-4 grid grid-cols-2 gap-4">
                                {/* Store list */}
                                <div>
                                  <h4 className="text-xs font-semibold text-pdd-text-primary mb-2 flex items-center gap-1.5">
                                    <Store size={13} className="text-pdd-info" />
                                    店铺列表 ({stores.length})
                                  </h4>
                                  {stores.length === 0 ? (
                                    <p className="text-xs text-pdd-text-secondary">暂无店铺</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                      {stores.map(s => (
                                        <div
                                          key={s.storeId}
                                          className="flex items-center justify-between text-xs bg-pdd-card rounded-md px-3 py-2 border border-pdd-border"
                                        >
                                          <span className="text-pdd-text-primary font-medium truncate max-w-[160px]">
                                            {s.storeName}
                                          </span>
                                          <span className="text-pdd-text-secondary tabular-nums flex-shrink-0">
                                            {s.totalRows.toLocaleString()} 行数据
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Recharge records */}
                                <div>
                                  <h4 className="text-xs font-semibold text-pdd-text-primary mb-2 flex items-center gap-1.5">
                                    <CreditCard size={13} className="text-pdd-warning" />
                                    充值记录 ({rechargeRecords.length})
                                  </h4>
                                  {rechargeRecords.length === 0 ? (
                                    <p className="text-xs text-pdd-text-secondary">暂无充值</p>
                                  ) : (
                                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                      {rechargeRecords.map(r => (
                                        <div
                                          key={r.id}
                                          className="flex items-center justify-between text-xs bg-pdd-card rounded-md px-3 py-2 border border-pdd-border"
                                        >
                                          <div className="flex items-center gap-2">
                                            <span className="text-pdd-text-primary">
                                              {r.plan === 'pro' ? '专业版' : '企业版'}
                                              ({r.duration === 'monthly' ? '月付' : '年付'})
                                            </span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                                              r.status === 'approved'
                                                ? 'bg-green-100 text-green-700'
                                                : r.status === 'rejected'
                                                  ? 'bg-red-100 text-red-700'
                                                  : 'bg-yellow-100 text-yellow-700'
                                            }`}>
                                              {r.status === 'approved' ? '通过' : r.status === 'rejected' ? '拒绝' : '待审'}
                                            </span>
                                          </div>
                                          <span className="text-pdd-text-primary font-medium">
                                            ¥{r.amount}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-pdd-text-secondary">
          <div className="flex items-center gap-2">
            <span>每页</span>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="bg-pdd-card border border-pdd-border rounded px-2 py-1 text-xs text-pdd-text-primary outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(n => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>条</span>
            <span className="ml-2">共 {total} 条</span>
          </div>
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
        </div>
      )}

      {/* Ban/Unban Modal */}
      <AnimatePresence>
        {banModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setBanModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  banModal.isBanned ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  {banModal.isBanned ? (
                    <CheckCircle size={20} className="text-green-600" />
                  ) : (
                    <Ban size={20} className="text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">
                    {banModal.isBanned ? '确认解封用户' : '确认封禁用户'}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">
                    用户：{banModal.username}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  {banModal.isBanned ? '备注（选填）' : '封禁原因'}
                </label>
                <textarea
                  value={banReason}
                  onChange={e => setBanReason(e.target.value)}
                  placeholder={banModal.isBanned ? '可填写解封备注...' : '请填写封禁原因...'}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              {!banModal.isBanned && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                  <AlertTriangle size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    封禁后该用户将无法登录和使用系统。
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setBanModal(null)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBan}
                  disabled={banSubmitting}
                  className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                    banModal.isBanned
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {banSubmitting ? '处理中...' : banModal.isBanned ? '确认解封' : '确认封禁'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Ban Confirm Modal */}
      <AnimatePresence>
        {batchBanConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setBatchBanConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  batchBanConfirm.isBanned ? 'bg-red-100' : 'bg-green-100'
                }`}>
                  {batchBanConfirm.isBanned ? (
                    <Ban size={20} className="text-red-600" />
                  ) : (
                    <CheckCircle size={20} className="text-green-600" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">
                    {batchBanConfirm.isBanned
                      ? `批量封禁 ${selectedIds.size} 个用户`
                      : `批量解封 ${selectedIds.size} 个用户`}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">
                    {batchBanConfirm.isBanned
                      ? '封禁后这些用户将无法登录系统'
                      : '解封后这些用户将恢复正常使用'}
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  备注（选填）
                </label>
                <textarea
                  value={batchBanReason}
                  onChange={e => setBatchBanReason(e.target.value)}
                  placeholder="可填写批量操作备注..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setBatchBanConfirm(null)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchBan}
                  disabled={batchBanSubmitting}
                  className={`flex-1 py-2.5 rounded-lg text-white text-sm font-medium transition-colors disabled:opacity-50 ${
                    batchBanConfirm.isBanned
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-green-600 hover:bg-green-700'
                  }`}
                >
                  {batchBanSubmitting ? '处理中...' : '确认'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Batch Notify Modal */}
      <AnimatePresence>
        {notifyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setNotifyModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <Bell size={20} className="text-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">
                    发送通知（{selectedIds.size} 个用户）
                  </h3>
                </div>
              </div>

              <div className="mb-4">
                <label className="text-sm font-medium text-pdd-text-primary mb-1 block">
                  通知内容
                </label>
                <textarea
                  value={notifyMessage}
                  onChange={e => setNotifyMessage(e.target.value)}
                  placeholder="请输入通知内容..."
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none resize-none"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setNotifyModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleBatchNotify}
                  disabled={!notifyMessage.trim() || notifySubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {notifySubmitting ? '发送中...' : '发送'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create User Modal */}
      <AnimatePresence>
        {createModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-pdd-primary/20 flex items-center justify-center">
                  <UserPlus size={20} className="text-pdd-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-pdd-text-primary">创建账号</h3>
                  <p className="text-xs text-pdd-text-secondary mt-0.5">
                    管理员手动创建用户账号（无需邀请码）
                  </p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-medium text-pdd-text-primary mb-1 block">用户名 *</label>
                  <input
                    type="text"
                    value={createUsername}
                    onChange={e => { setCreateUsername(e.target.value); setCreateError(''); }}
                    placeholder="至少3个字符"
                    className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-pdd-text-primary mb-1 block">密码 *</label>
                  <input
                    type="text"
                    value={createPassword}
                    onChange={e => { setCreatePassword(e.target.value); setCreateError(''); }}
                    placeholder="至少6个字符"
                    className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-pdd-text-primary mb-1 block">邮箱（选填）</label>
                  <input
                    type="email"
                    value={createEmail}
                    onChange={e => setCreateEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-pdd-text-primary mb-1 block">角色</label>
                    <select
                      value={createRole}
                      onChange={e => setCreateRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                    >
                      <option value="normal">普通用户</option>
                      <option value="admin">管理员</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-pdd-text-primary mb-1 block">会员等级</label>
                    <select
                      value={createLevel}
                      onChange={e => setCreateLevel(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm text-pdd-text-primary focus:border-pdd-primary/50 outline-none"
                    >
                      <option value="free">免费版</option>
                      <option value="pro">专业版</option>
                      <option value="enterprise">企业版</option>
                    </select>
                  </div>
                </div>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-pdd-danger/10 border border-pdd-danger/20 rounded-lg text-sm text-pdd-danger">
                  {createError}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCreateModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={createSubmitting}
                  className="flex-1 py-2.5 rounded-lg bg-pdd-primary hover:bg-pdd-primary-dark text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {createSubmitting ? '创建中...' : '创建账号'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

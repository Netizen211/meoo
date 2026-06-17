import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Ban, CheckCircle, Trash2, Shield, Clock,
  UserPlus, Users, ChevronLeft, ChevronRight,
  AlertTriangle, FileText,
} from 'lucide-react';
import { useSubAccounts, useParentUsers, useSubAccountLogs, useCreateSubAccount, useDeleteSubAccount, useToggleSubAccountBan } from '../../hooks/useAdminData';
import { useAuth } from '../../App';

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const ROLES = ['管理员', '运营专员', '客服专员', '财务专员', '只读观察'];

export default function AdminSubAccounts() {
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState('');
  const [parentFilter, setParentFilter] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [tab, setTab] = useState<'accounts' | 'logs'>('accounts');
  const [logsPage, setLogsPage] = useState(1);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', password: '', parentId: '', roleName: '只读观察' });
  const [createError, setCreateError] = useState('');

  // Delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; username: string } | null>(null);
  const [banModal, setBanModal] = useState<{ subId: string; username: string; isBanned: boolean } | null>(null);
  const [banReason, setBanReason] = useState('');

  const { data: accountsData, isLoading } = useSubAccounts({ page, pageSize, search: search || undefined, parentId: parentFilter || undefined });
  const { data: parentUsersData } = useParentUsers();
  const { data: logsData, isLoading: logsLoading } = useSubAccountLogs(tab === 'logs' ? logsPage : 0);
  const createMutation = useCreateSubAccount();
  const deleteMutation = useDeleteSubAccount();
  const banMutation = useToggleSubAccountBan();

  const accounts = accountsData?.items ?? [];
  const total = accountsData?.total ?? 0;
  const parentUsers = (parentUsersData as any)?.data ?? [];
  const logs = logsData?.items ?? [];
  const logsTotal = logsData?.total ?? 0;

  const handleCreate = async () => {
    const { username, password, parentId, roleName } = newUser;
    if (!username || !password) { setCreateError('请填写完整'); return; }
    if (username.length < 3) { setCreateError('用户名至少3个字符'); return; }
    if (password.length < 6) { setCreateError('密码至少6个字符'); return; }
    if (!parentId) { setCreateError('请选择主账号'); return; }
    const res = await createMutation.mutateAsync({
      username: username.trim(),
      password: password.trim(),
      parentUserId: parentId,
      roleName,
    });
    if (res.success) {
      setActionMsg('子账号创建成功');
      setShowCreate(false);
      setNewUser({ username: '', password: '', parentId: '', roleName: '只读观察' });
    } else {
      setCreateError(res.error || '创建失败');
    }
    setTimeout(() => setActionMsg(''), 3000);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    await deleteMutation.mutateAsync(deleteConfirm.id);
    setActionMsg('子账号已删除');
    setDeleteConfirm(null);
    setTimeout(() => setActionMsg(''), 2000);
  };

  const handleBan = async () => {
    if (!banModal) return;
    await banMutation.mutateAsync({ subId: banModal.subId, isBanned: !banModal.isBanned, reason: banReason || undefined });
    setActionMsg(banModal.isBanned ? '已解封' : '已封禁');
    setBanModal(null);
    setTimeout(() => setActionMsg(''), 2000);
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (isLoading) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary">子账号管理</h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">共 {total} 个子账号</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); }}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-pdd-primary text-white hover:bg-pdd-primary-dark transition-colors flex items-center gap-2"
        >
          <UserPlus size={16} />创建子账号
        </button>
      </div>

      {actionMsg && (
        <div className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20">
          {actionMsg}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-pdd-border pb-2">
        <button
          onClick={() => setTab('accounts')}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            tab === 'accounts'
              ? 'bg-pdd-primary/10 text-pdd-primary font-medium'
              : 'text-pdd-text-secondary'
          }`}
        >
          <Users size={14} className="inline mr-1" />子账号列表
        </button>
        <button
          onClick={() => setTab('logs')}
          className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
            tab === 'logs'
              ? 'bg-pdd-primary/10 text-pdd-primary font-medium'
              : 'text-pdd-text-secondary'
          }`}
        >
          <FileText size={14} className="inline mr-1" />操作日志
        </button>
      </div>

      {/* Accounts Tab */}
      {tab === 'accounts' && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
              <input
                className="bg-pdd-card border border-pdd-border rounded-lg pl-9 pr-3 py-2 text-sm text-pdd-text-primary w-64 outline-none focus:border-pdd-primary/50"
                placeholder="搜索子账号或主账号..."
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </div>
            <select
              value={parentFilter}
              onChange={e => { setParentFilter(e.target.value); setPage(1); }}
              className="bg-pdd-card border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary outline-none"
            >
              <option value="">全部主账号</option>
              {parentUsers.map((p: any) => (
                <option key={p.id} value={p.id}>{p.username}</option>
              ))}
            </select>
          </div>

          <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden">
            {accounts.length === 0 ? (
              <div className="text-center py-16 text-pdd-text-secondary">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">暂无子账号</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-pdd-border bg-pdd-bg/50">
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">子账号</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">主账号</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">角色</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">创建时间</th>
                    <th className="text-center py-3 px-3 font-medium text-pdd-text-secondary">状态</th>
                    <th className="text-right py-3 px-3 font-medium text-pdd-text-secondary">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((a: any) => (
                    <tr
                      key={a.id}
                      className={`border-b border-pdd-border/30 hover:bg-pdd-bg/30 transition-colors ${
                        a.isBanned ? 'bg-pdd-danger/5' : ''
                      }`}
                    >
                      <td className="py-3 px-3">
                        <div className="text-pdd-text-primary font-medium flex items-center gap-1.5">
                          <Shield size={12} className="text-pdd-text-secondary" />
                          {a.username}
                        </div>
                        {a.phone && (
                          <div className="text-xs text-pdd-text-secondary mt-0.5">{a.phone}</div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span className="text-pdd-text-primary">{a.parentUsername}</span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-pdd-info/10 text-pdd-info font-medium">
                          {a.role || '只读观察'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-pdd-text-secondary text-xs">
                        <Clock size={11} className="inline mr-1" />
                        {new Date(a.createdAt).toLocaleDateString('zh-CN')}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {a.isBanned ? (
                          <span className="text-xs text-pdd-danger bg-pdd-danger/10 px-2 py-0.5 rounded">已封禁</span>
                        ) : (
                          <span className="text-xs text-pdd-success bg-pdd-success/10 px-2 py-0.5 rounded">正常</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setBanModal({ subId: a.id, username: a.username, isBanned: a.isBanned })}
                            className={`p-1.5 rounded transition-colors ${
                              a.isBanned
                                ? 'text-pdd-success hover:bg-pdd-success/10'
                                : 'text-pdd-warning hover:bg-pdd-warning/10'
                            }`}
                            title={a.isBanned ? '解封' : '封禁'}
                          >
                            {a.isBanned ? <CheckCircle size={15} /> : <Ban size={15} />}
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ id: a.id, username: a.username })}
                            className="p-1.5 rounded text-pdd-text-secondary hover:text-pdd-danger hover:bg-pdd-danger/10"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

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
                <span>条，共 {total} 条</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded border border-pdd-border disabled:opacity-30"
                >
                  <ChevronLeft size={14} />
                </button>
                <span className="px-2 text-xs text-pdd-text-primary">{page} / {totalPages}</span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="p-1.5 rounded border border-pdd-border disabled:opacity-30"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Logs Tab */}
      {tab === 'logs' && (
        <>
          {logsLoading ? (
            <div className="text-center py-16 text-pdd-text-secondary">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-pdd-text-secondary">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">暂无操作日志</p>
            </div>
          ) : (
            <div className="bg-pdd-card rounded-xl border border-pdd-border overflow-hidden max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-pdd-bg/80">
                  <tr className="border-b border-pdd-border">
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">操作人</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">操作</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">目标</th>
                    <th className="text-left py-3 px-3 font-medium text-pdd-text-secondary">详情</th>
                    <th className="text-right py-3 px-3 font-medium text-pdd-text-secondary">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((l: any) => (
                    <tr key={l.id} className="border-b border-pdd-border/30 hover:bg-pdd-bg/30">
                      <td className="py-2.5 px-3 text-pdd-text-primary font-medium text-xs">
                        {l.username || l.user_id}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-xs bg-pdd-bg text-pdd-text-secondary">
                          {l.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-xs text-pdd-text-secondary">
                        {l.target_type}{l.target_id ? ': ' + l.target_id : ''}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-pdd-text-secondary max-w-[300px] truncate">
                        {l.details || '-'}
                      </td>
                      <td className="py-2.5 px-3 text-xs text-pdd-text-secondary text-right">
                        {new Date(l.created_at).toLocaleString('zh-CN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Create Modal */}
      {showCreate && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-4">创建子账号</h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1 block">主账号 *</label>
                <select
                  value={newUser.parentId}
                  onChange={e => { setNewUser({ ...newUser, parentId: e.target.value }); setCreateError(''); }}
                  className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary"
                >
                  <option value="">请选择主账号...</option>
                  {parentUsers.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.username}</option>
                  ))}
                </select>
              </div>
              <input
                value={newUser.username}
                onChange={e => { setNewUser({ ...newUser, username: e.target.value }); setCreateError(''); }}
                placeholder="登录用户名"
                className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary"
              />
              <input
                value={newUser.password}
                onChange={e => { setNewUser({ ...newUser, password: e.target.value }); setCreateError(''); }}
                placeholder="登录密码"
                type="password"
                className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary"
              />
              <select
                value={newUser.roleName}
                onChange={e => setNewUser({ ...newUser, roleName: e.target.value })}
                className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary"
              >
                {ROLES.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {createError && (
                <div className="p-3 bg-pdd-danger/10 border border-pdd-danger/20 rounded-lg text-sm text-pdd-danger">
                  {createError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  className="flex-1 py-2 bg-pdd-primary text-white rounded-lg text-sm disabled:opacity-50"
                >
                  {createMutation.isPending ? '创建中...' : '创建'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 border border-pdd-border rounded-lg text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Delete Confirm */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-md w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex gap-3 mb-4">
                <AlertTriangle size={24} className="text-pdd-danger" />
                <div>
                  <h3 className="font-bold">确认删除</h3>
                  <p className="text-xs text-pdd-text-secondary">子账号: {deleteConfirm.username}</p>
                </div>
              </div>
              <p className="text-xs text-pdd-danger mb-4 bg-pdd-danger/5 rounded-lg p-3">
                删除后该子账号的所有数据将被清除，不可恢复。
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-2 border border-pdd-border rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 py-2 bg-pdd-danger text-white rounded-lg text-sm"
                >
                  确认删除
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ban Modal */}
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
              <div className="flex gap-3 mb-4">
                {banModal.isBanned ? (
                  <CheckCircle size={24} className="text-pdd-success" />
                ) : (
                  <Ban size={24} className="text-pdd-danger" />
                )}
                <div>
                  <h3 className="font-bold">
                    {banModal.isBanned ? '解封子账号' : '封禁子账号'}
                  </h3>
                  <p className="text-xs text-pdd-text-secondary">{banModal.username}</p>
                </div>
              </div>
              <textarea
                value={banReason}
                onChange={e => setBanReason(e.target.value)}
                placeholder={banModal.isBanned ? '备注（选填）' : '封禁原因...'}
                rows={3}
                className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary mb-4"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setBanModal(null)}
                  className="flex-1 py-2 border border-pdd-border rounded-lg text-sm"
                >
                  取消
                </button>
                <button
                  onClick={handleBan}
                  disabled={banMutation.isPending}
                  className={`flex-1 py-2 text-white rounded-lg text-sm disabled:opacity-50 ${
                    banModal.isBanned ? 'bg-pdd-success' : 'bg-pdd-danger'
                  }`}
                >
                  {banMutation.isPending ? '处理中...' : '确认'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

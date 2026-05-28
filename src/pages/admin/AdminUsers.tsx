import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Ban, CheckCircle, Clock } from 'lucide-react';
import { adminApi, type AdminUser } from '../../api/adminApi';
import { useAuth } from '../../App';

export default function AdminUsers() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getUsers(page, 20, search).then(res => {
      if (res.success) { setUsers(res.data); setTotal((res as any).total); }
      setLoading(false);
    });
  }, [page, search]);

  const handleBan = async (userId: string, isBanned: boolean) => {
    if (userId === currentUser?.id) { setActionMsg('不能操作自己的账号'); return; }
    const ok = await adminApi.toggleBan(userId, !isBanned);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isBanned: !isBanned } : u));
      setActionMsg(isBanned ? '已解封' : '已封禁');
    }
    setTimeout(() => setActionMsg(''), 2000);
  };

  const getLevelBadge = (level: string) => {
    const map: Record<string, string> = { free: 'bg-pdd-bg text-pdd-text-secondary', pro: 'bg-pdd-warning/20 text-pdd-warning', enterprise: 'bg-pdd-success/20 text-pdd-success' };
    const labels: Record<string, string> = { free: '免费', pro: '专业', enterprise: '企业' };
    return <span className={`px-2 py-0.5 rounded text-xs ${map[level] || ''}`}>{labels[level] || level}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pdd-text-primary">用户管理</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            <input
              className="bg-pdd-bg border border-pdd-border rounded-lg pl-9 pr-3 py-2 text-sm text-pdd-text-primary w-64 outline-none"
              placeholder="搜索用户名..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      </div>

      {actionMsg && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-1 rounded">{actionMsg}</motion.div>}

      {loading ? <div className="text-pdd-text-secondary">加载中...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border text-pdd-text-secondary">
                <th className="text-left py-3 px-2">用户名</th>
                <th className="text-left py-3 px-2">角色</th>
                <th className="text-left py-3 px-2">会员</th>
                <th className="text-left py-3 px-2">到期时间</th>
                <th className="text-left py-3 px-2">手机</th>
                <th className="text-left py-3 px-2">注册时间</th>
                <th className="text-right py-3 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className={`border-b border-pdd-border/30 ${u.isBanned ? 'bg-pdd-danger/5' : ''}`}>
                  <td className="py-3 px-2 text-pdd-text-primary">
                    {u.username}
                    {u.isBanned && <span className="ml-2 text-xs text-pdd-danger">(已封禁)</span>}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{u.role}</td>
                  <td className="py-3 px-2">{getLevelBadge(u.membershipLevel)}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">
                    {u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{u.phone || '-'}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td className="py-3 px-2 text-right">
                    <button
                      onClick={() => handleBan(u.id, u.isBanned)}
                      className={`px-3 py-1 rounded text-xs font-medium ${u.isBanned ? 'bg-pdd-success/20 text-pdd-success hover:bg-pdd-success/30' : 'bg-pdd-danger/20 text-pdd-danger hover:bg-pdd-danger/30'}`}
                    >
                      {u.isBanned ? <CheckCircle size={14} className="inline mr-1" /> : <Ban size={14} className="inline mr-1" />}
                      {u.isBanned ? '解封' : '封禁'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 20 && (
            <div className="flex items-center justify-between pt-4 text-sm text-pdd-text-secondary">
              <span>共 {total} 个用户</span>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1 bg-pdd-bg rounded disabled:opacity-50">上一页</button>
                <span className="px-3 py-1">{page} / {Math.ceil(total / 20)}</span>
                <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)} className="px-3 py-1 bg-pdd-bg rounded disabled:opacity-50">下一页</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

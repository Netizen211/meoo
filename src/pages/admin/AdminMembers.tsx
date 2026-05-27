import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Crown, Shield } from 'lucide-react';
import { adminApi, type AdminUser } from '../../api/adminApi';

export default function AdminMembers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState('free');
  const [editExpires, setEditExpires] = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getUsers(1, 100, search).then(res => {
      if (res.success) setUsers(res.data);
      setLoading(false);
    });
  }, [search]);

  const handleAdjust = async (userId: string) => {
    const ok = await adminApi.adjustMembership(userId, editLevel, editExpires || undefined);
    if (ok) {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, membershipLevel: editLevel, membershipExpiresAt: editExpires || null } : u));
      setActionMsg('会员调整成功');
      setEditingUser(null);
    } else {
      setActionMsg('操作失败');
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
        <h2 className="text-lg font-semibold text-pdd-text-primary">会员管理</h2>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
          <input className="bg-pdd-bg border border-pdd-border rounded-lg pl-9 pr-3 py-2 text-sm text-pdd-text-primary w-64 outline-none" placeholder="搜索用户名..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {actionMsg && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-1 rounded">{actionMsg}</motion.div>}

      {loading ? <div className="text-pdd-text-secondary">加载中...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border text-pdd-text-secondary">
                <th className="text-left py-3 px-2">用户名</th>
                <th className="text-left py-3 px-2">当前会员</th>
                <th className="text-left py-3 px-2">到期时间</th>
                <th className="text-left py-3 px-2">封禁状态</th>
                <th className="text-right py-3 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-pdd-border/30">
                  <td className="py-3 px-2 text-pdd-text-primary">{u.username}</td>
                  <td className="py-3 px-2">{getLevelBadge(u.membershipLevel)}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">{u.membershipExpiresAt ? new Date(u.membershipExpiresAt).toLocaleDateString('zh-CN') : '-'}</td>
                  <td className="py-3 px-2">{u.isBanned ? <span className="text-xs text-pdd-danger">已封禁</span> : <span className="text-xs text-pdd-success">正常</span>}</td>
                  <td className="py-3 px-2 text-right">
                    {editingUser === u.id ? (
                      <div className="flex items-center gap-2 justify-end">
                        <select value={editLevel} onChange={e => setEditLevel(e.target.value)} className="bg-pdd-bg border border-pdd-border rounded px-2 py-1 text-xs text-pdd-text-primary">
                          <option value="free">免费</option>
                          <option value="pro">专业</option>
                          <option value="enterprise">企业</option>
                        </select>
                        <input type="date" value={editExpires} onChange={e => setEditExpires(e.target.value)} className="bg-pdd-bg border border-pdd-border rounded px-2 py-1 text-xs text-pdd-text-primary w-32" />
                        <button onClick={() => handleAdjust(u.id)} className="px-2 py-1 bg-pdd-primary text-white rounded text-xs">确认</button>
                        <button onClick={() => setEditingUser(null)} className="px-2 py-1 bg-pdd-bg rounded text-xs">取消</button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditingUser(u.id); setEditLevel(u.membershipLevel); setEditExpires(u.membershipExpiresAt?.split('T')[0] || ''); }} className="px-3 py-1 bg-pdd-bg hover:bg-pdd-border rounded text-xs text-pdd-text-primary">
                        调整
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

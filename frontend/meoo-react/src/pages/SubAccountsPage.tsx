import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { UserPlus, Trash2, Shield, Users, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

const ROLES = ['管理员','运营专员','客服专员','财务专员','只读观察'];

export default function SubAccountsPage() {
  const [accounts, setAccounts] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab] = useState<'accounts'|'logs'>('accounts');
  const [newUser, setNewUser] = useState({ username: '', password: '', roleName: '只读观察' });
  const [msg, setMsg] = useState('');

  const load = async () => {
    setLoading(true);
    const res = await apiClient.get('/sub-accounts');
    if (res.success) { setAccounts(res.data?.accounts || []); setRoles(res.data?.roles || []); }
    setLoading(false);
  };

  const loadLogs = async () => {
    const res = await apiClient.get('/sub-accounts/logs');
    if (res.success) setLogs(res.data || []);
  };

  useEffect(() => { load(); loadLogs(); }, []);

  const createSub = async () => {
    if (!newUser.username || !newUser.password) { setMsg('请填写完整'); return; }
    const res = await apiClient.post('/sub-accounts', newUser);
    if (res.success) { setMsg('创建成功'); setShowCreate(false); setNewUser({ username: '', password: '', roleName: '只读观察' }); load(); }
    else setMsg(res.error || '创建失败');
    setTimeout(() => setMsg(''), 3000);
  };

  const deleteSub = async (id: string) => {
    if (!confirm('确认删除此子账号？')) return;
    await apiClient.delete(`/sub-accounts/${id}`);
    load();
  };

  const getRolePerms = (roleName: string) => {
    const r = roles.find(x => x.name === roleName);
    if (!r) return '未知';
    try {
      const p = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
      return Object.keys(p.pages || {}).length + '个页面';
    } catch { return '未知'; }
  };

  if (loading) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-pdd-text flex items-center gap-2"><Users size={20} />团队管理</h2>
          <p className="text-xs text-pdd-text-secondary">共 {accounts.length} 个子账号</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-pdd-primary text-white rounded-lg text-sm flex items-center gap-1.5">
          <UserPlus size={16} />添加子账号
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-pdd-border pb-2">
        <button onClick={() => setTab('accounts')} className={`px-3 py-1 text-xs rounded ${tab==='accounts'?'bg-pdd-primary/10 text-pdd-primary':'text-pdd-text-secondary'}`}>子账号</button>
        <button onClick={() => setTab('logs')} className={`px-3 py-1 text-xs rounded ${tab==='logs'?'bg-pdd-primary/10 text-pdd-primary':'text-pdd-text-secondary'}`}>操作日志</button>
      </div>

      {msg && <div className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded">{msg}</div>}

      {/* Create modal */}
      {showCreate && (
        <motion.div initial={{opacity:0}} animate={{opacity:1}} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowCreate(false)}>
          <motion.div initial={{scale:0.9}} animate={{scale:1}} className="bg-pdd-card p-6 rounded-xl w-96 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">创建子账号</h3>
            <div className="space-y-3">
              <input value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} placeholder="登录用户名" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm" />
              <input value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} placeholder="登录密码" type="password" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm" />
              <select value={newUser.roleName} onChange={e => setNewUser({...newUser, roleName: e.target.value})} className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm">
                {ROLES.map(r => <option key={r} value={r}>{r} ({getRolePerms(r)})</option>)}
              </select>
              <div className="flex gap-2 pt-2">
                <button onClick={createSub} className="flex-1 py-2 bg-pdd-primary text-white rounded-lg text-sm">创建</button>
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 border border-pdd-border rounded-lg text-sm">取消</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Accounts tab */}
      {tab === 'accounts' && (
        <div className="grid grid-cols-2 gap-3">
          {accounts.length === 0 && <p className="text-pdd-text-secondary text-sm col-span-2">暂无子账号</p>}
          {accounts.map(a => (
            <div key={a.id} className="p-4 bg-pdd-card rounded-xl border border-pdd-border flex items-center justify-between">
              <div>
                <div className="font-medium text-pdd-text">{a.username}</div>
                <div className="text-xs text-pdd-text-secondary flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><Shield size={10} />子账号</span>
                  <span className="flex items-center gap-1"><Clock size={10} />{new Date(a.created_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
              <button onClick={() => deleteSub(a.id)} className="p-2 text-pdd-text-secondary hover:text-pdd-danger rounded-lg hover:bg-pdd-danger/10">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Logs tab */}
      {tab === 'logs' && (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {logs.length === 0 && <p className="text-pdd-text-secondary text-sm">暂无操作记录</p>}
          {logs.map((l: any) => (
            <div key={l.id} className="flex items-center justify-between text-xs py-2 px-3 rounded hover:bg-pdd-bg">
              <div>
                <span className="font-medium text-pdd-text">{l.username}</span>
                <span className="text-pdd-text-secondary ml-2">{l.action}</span>
                <span className="text-pdd-text-secondary ml-2">{l.target_type}{l.target_id ? ':'+l.target_id : ''}</span>
              </div>
              <span className="text-pdd-text-secondary">{new Date(l.created_at).toLocaleString('zh-CN')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { Eye, Search, ExternalLink, Shield } from 'lucide-react';
import { adminApi } from '../../api/adminApi';

export default function AdminShadow() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<{ username: string; time: string }[]>(() => {
    try { return JSON.parse(localStorage.getItem('shadow_history') || '[]'); } catch { return []; }
  });

  const handleShadow = async () => {
    if (!username.trim()) { setError('请输入用户名'); return; }
    setLoading(true); setError('');
    try {
      const usersRes = await adminApi.getUsers(1, 10, username.trim());
      if (!usersRes.success || !usersRes.data?.length) {
        setError('未找到该用户'); setLoading(false); return;
      }
      const user = usersRes.data[0];
      const res = await adminApi.impersonateUser(user.id);
      if (res.success && res.data?.accessToken) {
        localStorage.setItem('dianfx_access_token', res.data.accessToken);
        localStorage.setItem('dianfx_user', JSON.stringify(res.data.user));
        localStorage.setItem('dianfx_shadow_mode', 'true');
        const h = [{ username: user.username, time: new Date().toLocaleString() }, ...history].slice(0, 20);
        setHistory(h);
        localStorage.setItem('shadow_history', JSON.stringify(h));
        window.open('/#/', '_blank');
      } else {
        setError('操作失败');
      }
    } catch { setError('网络错误'); }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-pdd-text-primary flex items-center gap-2">
          <Shield size={20} className="text-pdd-primary" />影子访问
        </h2>
        <p className="text-xs text-pdd-text-secondary mt-1">输入用户名即可查看该用户视角的全部数据，用户端无感无痕</p>
      </div>

      <div className="bg-pdd-card rounded-xl border border-pdd-border p-6 max-w-lg">
        <div className="flex items-center gap-3 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
          <Shield size={16} className="shrink-0" />
          <span>只读模式，无法修改任何数据。每次访问均记录审计日志。仅用于技术支持和故障排查。</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            <input
              value={username}
              onChange={e => { setUsername(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleShadow()}
              placeholder="输入用户名，回车直接进入"
              className="w-full pl-9 pr-3 py-2.5 bg-pdd-bg border border-pdd-border rounded-lg text-sm outline-none focus:border-pdd-primary"
            />
          </div>
          <button onClick={handleShadow} disabled={loading}
            className="px-6 py-2.5 bg-pdd-primary text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
            <Eye size={16} />{loading ? '查找中...' : '进入'}
          </button>
        </div>

        {error && <p className="text-sm text-pdd-danger mt-2">{error}</p>}

        <div className="mt-2 text-[10px] text-pdd-text-secondary">
          支持输入用户名或用户ID进行模糊搜索
        </div>
      </div>

      {history.length > 0 && (
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4 max-w-lg">
          <h3 className="text-sm font-semibold text-pdd-text mb-2">最近访问记录</h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-pdd-bg">
                <span className="text-pdd-text font-medium">{h.username}</span>
                <span className="text-pdd-text-secondary">{h.time}</span>
                <button onClick={() => { setUsername(h.username); handleShadow(); }}
                  className="text-pdd-primary hover:underline text-[10px]">
                  <ExternalLink size={10} className="inline mr-0.5" />再次进入
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

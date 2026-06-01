import React, { useState, useEffect, useRef } from 'react';
import { Eye, Search, ExternalLink, Shield, User, Hash, AlertTriangle, CheckCircle, Clock, X } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';
import { apiClient } from '../../../api/client';

interface ShadowHistory {
  id: string;
  username: string;
  time: string;
}

export default function AdminShadow() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'id' | 'username'>('id');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [previewUser, setPreviewUser] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [history, setHistory] = useState<ShadowHistory[]>(() => {
    try { return JSON.parse(localStorage.getItem('shadow_history') || '[]'); } catch { return []; }
  });
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Preview user when typing an ID
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!input.trim() || mode !== 'id' || input.length < 8) {
      setPreviewUser(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setPreviewLoading(true);
      try {
        // Try direct user lookup by ID
        const res = await apiClient.get('/admin/users?search=' + encodeURIComponent(input.trim()) + '&pageSize=5');
        if (res.success && res.data?.length) {
          const match = res.data.find((u: any) =>
            u.id === input.trim() || u.id.includes(input.trim())
          ) || res.data[0];
          setPreviewUser(match);
        } else {
          setPreviewUser(null);
        }
      } catch { setPreviewUser(null); }
      setPreviewLoading(false);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, mode]);

  const handleShadow = async () => {
    if (!input.trim()) { setError('请输入用户ID或用户名'); return; }
    setLoading(true); setError('');

    try {
      let userId: string;
      let username: string;

      if (mode === 'id') {
        // Direct ID access - try to get user by ID
        const userRes = await apiClient.get('/admin/users?search=' + encodeURIComponent(input.trim()) + '&pageSize=1');
        if (!userRes.success || !userRes.data?.length) {
          setError('未找到该用户，请检查ID是否正确'); setLoading(false); return;
        }
        const match = userRes.data.find((u: any) => u.id === input.trim()) || userRes.data[0];
        userId = match.id;
        username = match.username;
      } else {
        // Username search
        const usersRes = await adminApi.getUsers(1, 10, input.trim());
        if (!usersRes.success || !usersRes.data?.length) {
          setError('未找到该用户'); setLoading(false); return;
        }
        const user = usersRes.data[0];
        userId = user.id;
        username = user.username;
      }

      // Impersonate
      const res = await adminApi.impersonateUser(userId);
      if (res.success && res.data?.accessToken) {
        localStorage.setItem('dianfx_access_token', res.data.accessToken);
        localStorage.setItem('dianfx_user', JSON.stringify(res.data.user));
        localStorage.setItem('dianfx_shadow_mode', 'true');
        const h = [{ id: userId, username, time: new Date().toLocaleString() }, ...history.filter(h => h.id !== userId)].slice(0, 30);
        setHistory(h);
        localStorage.setItem('shadow_history', JSON.stringify(h));
        window.open('/#/', '_blank');
      } else {
        setError(res.error || '操作失败');
      }
    } catch { setError('网络错误'); }
    setLoading(false);
  };

  const removeHistory = (id: string) => {
    const h = history.filter(item => item.id !== id);
    setHistory(h);
    localStorage.setItem('shadow_history', JSON.stringify(h));
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-pdd-text-primary flex items-center gap-2">
          <Shield size={20} className="text-amber-400" />影子访问
        </h2>
        <p className="text-xs text-pdd-text-secondary mt-1">
          以任意用户身份查看系统，用户端完全无感。支持用户ID直连或用户名搜索。
        </p>
      </div>

      {/* Quick access cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          onClick={() => setMode('id')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            mode === 'id'
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-pdd-border bg-pdd-card hover:border-pdd-primary/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Hash size={16} className={mode === 'id' ? 'text-amber-400' : 'text-pdd-text-secondary'} />
            <span className={`text-sm font-medium ${mode === 'id' ? 'text-amber-400' : 'text-pdd-text-primary'}`}>ID 直连</span>
          </div>
          <p className="text-[10px] text-pdd-text-secondary">输入用户ID直接进入，快速精准</p>
        </div>
        <div
          onClick={() => setMode('username')}
          className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
            mode === 'username'
              ? 'border-amber-500/50 bg-amber-500/5'
              : 'border-pdd-border bg-pdd-card hover:border-pdd-primary/30'
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <Search size={16} className={mode === 'username' ? 'text-amber-400' : 'text-pdd-text-secondary'} />
            <span className={`text-sm font-medium ${mode === 'username' ? 'text-amber-400' : 'text-pdd-text-primary'}`}>用户名搜索</span>
          </div>
          <p className="text-[10px] text-pdd-text-secondary">模糊搜索用户名后选择进入</p>
        </div>
      </div>

      {/* Main input area */}
      <div className="bg-pdd-card rounded-xl border border-pdd-border p-6">
        <div className="flex items-center gap-3 mb-4 p-3 rounded-lg text-xs"
          style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', color: '#d97706' }}>
          <Shield size={16} className="shrink-0" />
          <span>只读模式，无法修改任何数据。每次访问均记录审计日志。仅用于技术支持和故障排查。</span>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            {mode === 'id' ? (
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            ) : (
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-pdd-text-secondary" />
            )}
            <input
              value={input}
              onChange={e => { setInput(e.target.value); setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleShadow()}
              placeholder={mode === 'id' ? '输入用户ID，如 user-1234567890-abcdef' : '输入用户名进行搜索...'}
              className="w-full pl-9 pr-3 py-2.5 bg-pdd-bg border border-pdd-border rounded-lg text-sm outline-none focus:border-pdd-primary text-pdd-text-primary"
            />
          </div>
          <button
            onClick={handleShadow}
            disabled={loading || !input.trim()}
            className="px-6 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            <Eye size={16} />{loading ? '验证中...' : '进入'}
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 mt-3 p-2.5 rounded-lg text-xs text-red-400 bg-red-500/10 border border-red-500/20">
            <AlertTriangle size={14} />
            {error}
          </div>
        )}

        {/* User preview */}
        {mode === 'id' && input.trim().length >= 5 && (
          <div className="mt-3">
            {previewLoading ? (
              <div className="text-xs text-pdd-text-secondary py-2">查找用户中...</div>
            ) : previewUser ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-pdd-bg border border-pdd-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                    <span className="text-white text-xs font-bold">{(previewUser.username || 'U')[0].toUpperCase()}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-pdd-text-primary">{previewUser.username}</span>
                      {previewUser.isBanned && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400">已封禁</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-pdd-text-secondary">
                      <span className="font-mono">{previewUser.id}</span>
                      <span>{previewUser.membershipLevel === 'free' ? '免费' : previewUser.membershipLevel === 'pro' ? '专业' : '企业'}</span>
                    </div>
                  </div>
                </div>
                <CheckCircle size={16} className="text-green-400" />
              </div>
            ) : (
              <div className="text-[10px] text-pdd-text-secondary py-1">未匹配到用户，将尝试模糊搜索</div>
            )}
          </div>
        )}

        <div className="mt-2 text-[10px] text-pdd-text-secondary">
          {mode === 'id'
            ? '支持完整用户ID或部分ID匹配。可从用户管理页面复制ID。'
            : '支持输入用户名进行模糊搜索，匹配后选择目标用户进入。'}
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="bg-pdd-card rounded-xl border border-pdd-border p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
              <Clock size={14} className="text-pdd-text-secondary" />
              最近访问记录
            </h3>
            <button
              onClick={() => { setHistory([]); localStorage.removeItem('shadow_history'); }}
              className="text-[10px] text-pdd-text-secondary hover:text-red-400 transition-colors"
            >
              清空记录
            </button>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg hover:bg-pdd-bg transition-colors group">
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <User size={10} className="text-amber-400" />
                  </div>
                  <div>
                    <span className="text-pdd-text-primary font-medium">{h.username}</span>
                    <span className="text-pdd-text-secondary ml-2 font-mono text-[10px]">{h.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-pdd-text-secondary text-[10px]">{h.time}</span>
                  <button
                    onClick={() => { setInput(h.id); setMode('id'); }}
                    className="text-amber-400 hover:underline text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink size={10} className="inline mr-0.5" />再次进入
                  </button>
                  <button
                    onClick={() => removeHistory(h.id)}
                    className="text-pdd-text-secondary hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

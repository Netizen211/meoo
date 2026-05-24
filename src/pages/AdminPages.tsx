import React, { useState } from 'react';
import { useAuth, useStore, useData } from '../App';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, Crown, Database, Bot, Settings, Shield, ToggleLeft, ToggleRight, Trash2, Eye, Ban, Edit3, Save, Plus, Key, Cpu, Copy, Check } from 'lucide-react';

// Mock data
const MOCK_USERS = [
  { id: 'u1', username: '商家A', role: 'normal', membership: 'free', stores: 1, status: 'active', createdAt: '2026-05-10' },
  { id: 'u2', username: '商家B', role: 'normal', membership: 'pro', stores: 2, status: 'active', createdAt: '2026-05-12' },
  { id: 'u3', username: '商家C', role: 'normal', membership: 'enterprise', stores: 5, status: 'active', createdAt: '2026-05-15' },
  { id: 'test-001', username: '123456', role: 'test', membership: 'enterprise', stores: 3, status: 'active', createdAt: '2026-05-17' },
];
const MOCK_STATS = { totalUsers: 4, totalStores: 11, totalFiles: 8, totalOrders: 1031 };
const MOCK_CHART = [
  { date: '05-11', uploads: 1 }, { date: '05-12', uploads: 2 }, { date: '05-13', uploads: 0 },
  { date: '05-14', uploads: 3 }, { date: '05-15', uploads: 1 }, { date: '05-16', uploads: 2 }, { date: '05-17', uploads: 4 },
];

const cardCls = 'bg-pdd-card rounded-lg p-4 border border-pdd-border';
const labelCls = 'text-pdd-text-secondary text-xs';
const valueCls = 'text-pdd-text text-2xl font-bold';
const btnCls = 'px-3 py-1 rounded text-xs transition-colors';

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className={cardCls}>
      <div className="flex items-center gap-2 mb-2">
        <Icon size={18} className={color} /><span className={labelCls}>{label}</span>
      </div>
      <div className={valueCls}>{value}</div>
    </div>
  );
}

export function AdminHomePage() {
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold">平台概览</h2>
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={Users} label="总用户数" value={MOCK_STATS.totalUsers} color="text-pdd-primary-light" />
        <StatCard icon={Database} label="总店铺数" value={MOCK_STATS.totalStores} color="text-pdd-success" />
        <StatCard icon={Database} label="上传文件数" value={MOCK_STATS.totalFiles} color="text-pdd-warning" />
        <StatCard icon={Database} label="总订单数" value={MOCK_STATS.totalOrders} color="text-pdd-red" />
      </div>
      <div className={cardCls}>
        <h3 className="text-pdd-text text-sm mb-2">近7日上传趋势</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={MOCK_CHART}>
            <XAxis dataKey="date" stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip contentStyle={{ background: '#2a2a3a', border: '1px solid #3a3a4a', color: '#fff' }} />
            <Bar dataKey="uploads" fill="var(--pdd-primary)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const toggleStatus = (id: string) => setUsers(prev => prev.map(u => u.id === id ? { ...u, status: u.status === 'active' ? 'banned' : 'active' } : u));
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold">用户管理</h2>
      <div className={cardCls + ' overflow-x-auto'}>
        <table className="w-full text-sm">
          <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
            <th className="py-2 text-left">用户名</th><th className="text-left">角色</th><th className="text-left">会员</th><th className="text-left">店铺数</th><th className="text-left">状态</th><th className="text-left">操作</th>
          </tr></thead>
          <tbody>{users.map(u => (
            <tr key={u.id} className="border-b border-pdd-border hover:bg-[#35354a]">
              <td className="py-2 text-pdd-text">{u.username}</td>
              <td className="py-2"><span className={u.role === 'test' ? 'text-pdd-warning' : 'text-pdd-text-secondary'}>{u.role === 'test' ? '测试' : '普通'}</span></td>
              <td className="py-2 text-pdd-text-secondary">{u.membership}</td>
              <td className="py-2 text-pdd-text-secondary">{u.stores}</td>
              <td className="py-2"><span className={u.status === 'active' ? 'text-pdd-success' : 'text-pdd-danger'}>{u.status === 'active' ? '正常' : '禁用'}</span></td>
              <td className="py-2">
                <button onClick={() => toggleStatus(u.id)} className={btnCls + (u.status === 'active' ? ' bg-[#3d2020] text-pdd-danger hover:bg-[#4d2828]' : ' bg-[#1a3d20] text-pdd-success hover:bg-[#224d28]')}>
                  {u.status === 'active' ? <Ban size={14} /> : <Eye size={14} />}
                </button>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminMembersPage() {
  const [users, setUsers] = useState(MOCK_USERS);
  const changeLevel = (id: string, level: string) => setUsers(prev => prev.map(u => u.id === id ? { ...u, membership: level } : u));
  const levels = ['free', 'pro', 'enterprise'];
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold">会员管理</h2>
      <div className={cardCls + ' overflow-x-auto'}>
        <table className="w-full text-sm">
          <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
            <th className="py-2 text-left">用户名</th><th className="text-left">当前等级</th><th className="text-left">调整等级</th>
          </tr></thead>
          <tbody>{users.filter(u => u.role !== 'test').map(u => (
            <tr key={u.id} className="border-b border-pdd-border">
              <td className="py-2 text-pdd-text">{u.username}</td>
              <td className="py-2 text-pdd-text-secondary">{u.membership}</td>
              <td className="py-2">
                <select value={u.membership} onChange={e => changeLevel(u.id, e.target.value)}
                  className="bg-[#2a2a3a] text-white text-xs rounded px-2 py-1 border border-[#3a3a4a]">
                  {levels.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminDataPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold">数据监控</h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Database} label="今日上传" value={4} color="text-pdd-primary-light" />
        <StatCard icon={Database} label="今日解析" value={1031} color="text-pdd-success" />
        <StatCard icon={Database} label="存储占用" value="2.1MB" color="text-pdd-warning" />
      </div>
      <div className={cardCls}>
        <h3 className="text-pdd-text text-sm mb-2">数据类型分布</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={[{ type: '订单CSV', count: 1 }, { type: '推广XLSX', count: 3 }, { type: '运费险', count: 1 }]}>
            <XAxis dataKey="type" stroke="#666" fontSize={12} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip contentStyle={{ background: '#2a2a3a', border: '1px solid #3a3a4a', color: '#fff' }} />
            <Bar dataKey="count" fill="#1890ff" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function AdminAiPage() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [enabled, setEnabled] = useState(false);
  const [saved, setSaved] = useState(false);
  const handleSave = () => { localStorage.setItem('dianfx_ai_config', JSON.stringify({ apiKey, model, enabled })); setSaved(true); setTimeout(() => setSaved(false), 2000); };
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold flex items-center gap-2"><Bot size={20} />AI配置</h2>
      <div className={cardCls + ' space-y-4'}>
        <div>
          <label className={labelCls + ' block mb-1'}>API Key</label>
          <div className="flex gap-2">
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="输入AI模型API Key"
              className="flex-1 bg-[#2a2a3a] text-white rounded px-3 py-2 text-sm border border-[#3a3a4a] focus:border-pdd-red outline-none" />
            <Key size={18} className="text-pdd-text-secondary" />
          </div>
        </div>
        <div>
          <label className={labelCls + ' block mb-1'}>模型选择</label>
          <div className="flex gap-2">
            <select value={model} onChange={e => setModel(e.target.value)}
              className="flex-1 bg-[#2a2a3a] text-white rounded px-3 py-2 text-sm border border-[#3a3a4a]">
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="claude-3-haiku">Claude 3 Haiku</option>
              <option value="deepseek-chat">DeepSeek Chat</option>
            </select>
            <Cpu size={18} className="text-pdd-text-secondary" />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <label className={labelCls}>启用AI分析功能</label>
          <button onClick={() => setEnabled(!enabled)} className="text-pdd-text">
            {enabled ? <ToggleRight size={28} className="text-pdd-success" /> : <ToggleLeft size={28} className="text-pdd-text-secondary" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleSave} className={btnCls + ' bg-pdd-red text-white hover:bg-pdd-darkRed px-4 py-2'}>
            <Save size={14} className="inline mr-1" />保存配置
          </button>
          {saved && <span className="text-pdd-success text-xs">已保存</span>}
        </div>
        <p className="text-pdd-text-secondary text-xs">配置后，前台各分析页面将出现"AI分析"按钮，可自动生成分析报告和问题排查建议。</p>
      </div>
    </div>
  );
}

export function AdminInvitePage() {
  const [codes, setCodes] = useState<any[]>(() => {
    const saved = localStorage.getItem('dianfx_invite_codes');
    return saved ? JSON.parse(saved) : [];
  });
  const [newCodeCount, setNewCodeCount] = useState(1);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const generateCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const newCodes: any[] = [];
    for (let i = 0; i < newCodeCount; i++) {
      let code = '';
      for (let j = 0; j < 8; j++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
      newCodes.push({
        id: `invite-${Date.now()}-${i}`,
        code,
        used: false,
        usedBy: null,
        usedAt: null,
        createdAt: new Date().toISOString(),
      });
    }
    const updated = [...newCodes, ...codes];
    setCodes(updated);
    localStorage.setItem('dianfx_invite_codes', JSON.stringify(updated));
  };

  const deleteCode = (id: string) => {
    const updated = codes.filter(c => c.id !== id);
    setCodes(updated);
    localStorage.setItem('dianfx_invite_codes', JSON.stringify(updated));
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const usedCount = codes.filter(c => c.used).length;
  const unusedCount = codes.filter(c => !c.used).length;

  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold flex items-center gap-2"><Key size={20} />邀请码管理</h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard icon={Key} label="总邀请码" value={codes.length} color="text-pdd-primary-light" />
        <StatCard icon={Check} label="已使用" value={usedCount} color="text-pdd-warning" />
        <StatCard icon={Plus} label="未使用" value={unusedCount} color="text-pdd-success" />
      </div>
      <div className={cardCls + ' space-y-4'}>
        <div className="flex items-center gap-3">
          <label className={labelCls}>生成数量</label>
          <input type="number" min={1} max={50} value={newCodeCount}
            onChange={e => setNewCodeCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
            className="w-20 bg-[#2a2a3a] text-white rounded px-3 py-2 text-sm border border-[#3a3a4a] focus:border-pdd-red outline-none" />
          <button onClick={generateCode} className={btnCls + ' bg-pdd-red text-white hover:bg-pdd-darkRed px-4 py-2'}>
            <Plus size={14} className="inline mr-1" />生成邀请码
          </button>
        </div>
      </div>
      <div className={cardCls + ' overflow-x-auto'}>
        <table className="w-full text-sm">
          <thead><tr className="text-pdd-text-secondary border-b border-pdd-border">
            <th className="py-2 text-left">邀请码</th><th className="text-left">状态</th><th className="text-left">使用者</th><th className="text-left">创建时间</th><th className="text-left">使用时间</th><th className="text-left">操作</th>
          </tr></thead>
          <tbody>
            {codes.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-pdd-text-secondary">暂无邀请码，请点击上方按钮生成</td></tr>
            ) : codes.map(c => (
              <tr key={c.id} className="border-b border-pdd-border hover:bg-[#35354a]">
                <td className="py-2">
                  <span className="text-pdd-text font-mono tracking-wider">{c.code}</span>
                  <button onClick={() => copyCode(c.code, c.id)} className="ml-2 text-pdd-text-secondary hover:text-pdd-text transition-colors">
                    {copiedId === c.id ? <Check size={14} className="text-pdd-success" /> : <Copy size={14} />}
                  </button>
                </td>
                <td className="py-2">
                  <span className={c.used ? 'text-pdd-warning' : 'text-pdd-success'}>
                    {c.used ? '已使用' : '未使用'}
                  </span>
                </td>
                <td className="py-2 text-pdd-text-secondary">{c.usedBy || '-'}</td>
                <td className="py-2 text-pdd-text-secondary">{new Date(c.createdAt).toLocaleDateString()}</td>
                <td className="py-2 text-pdd-text-secondary">{c.usedAt ? new Date(c.usedAt).toLocaleDateString() : '-'}</td>
                <td className="py-2">
                  {!c.used && (
                    <button onClick={() => deleteCode(c.id)} className={btnCls + ' bg-[#3d2020] text-pdd-danger hover:bg-[#4d2828]'}>
                      <Trash2 size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminSettingsPage() {
  const [siteName, setSiteName] = useState('店分析');
  const [maxUpload, setMaxUpload] = useState('10');
  return (
    <div className="space-y-4">
      <h2 className="text-pdd-text text-lg font-bold flex items-center gap-2"><Settings size={20} />系统设置</h2>
      <div className={cardCls + ' space-y-4'}>
        <div>
          <label className={labelCls + ' block mb-1'}>站点名称</label>
          <input value={siteName} onChange={e => setSiteName(e.target.value)}
            className="w-full bg-[#2a2a3a] text-white rounded px-3 py-2 text-sm border border-[#3a3a4a] focus:border-pdd-red outline-none" />
        </div>
        <div>
          <label className={labelCls + ' block mb-1'}>最大上传文件数(MB)</label>
          <input type="number" value={maxUpload} onChange={e => setMaxUpload(e.target.value)}
            className="w-full bg-[#2a2a3a] text-white rounded px-3 py-2 text-sm border border-[#3a3a4a] focus:border-pdd-red outline-none" />
        </div>
      </div>
      <div className={cardCls}>
        <h3 className="text-pdd-text text-sm mb-2 flex items-center gap-2"><Shield size={16} />测试账号</h3>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-pdd-text-secondary">用户名: <span className="text-pdd-text">123456</span></span>
          <span className="text-pdd-text-secondary">密码: <span className="text-pdd-text">123456</span></span>
          <span className="text-pdd-warning text-xs">最高权限 · 企业版</span>
        </div>
      </div>
    </div>
  );
}
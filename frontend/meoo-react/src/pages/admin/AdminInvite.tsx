import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Copy, Check, TrendingUp, Users, Key, Activity } from 'lucide-react';
import { adminApi } from '../../../api/adminApi';

interface InviteCodeRow {
  id: number;
  code: string;
  batchId: string;
  createdBy: string;
  usedBy: string;
  usedAt: string;
  isUsed: boolean;
  createdAt: string;
}

export default function AdminInvite() {
  const [codes, setCodes] = useState<InviteCodeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [genCount, setGenCount] = useState(5);
  const [newCodes, setNewCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => { loadCodes(); }, []);

  const loadCodes = async () => {
    setLoading(true);
    const res = await adminApi.getInviteCodes();
    if (res.success) setCodes(res.data);
    setLoading(false);
  };

  const handleGenerate = async () => {
    const res = await adminApi.generateInviteCodes(genCount);
    if (res.success && res.data) {
      setNewCodes(res.data.codes);
      loadCodes();
    }
  };

  const handleDelete = async (code: string) => {
    await adminApi.deleteInviteCode(code);
    setCodes(prev => prev.filter(c => c.code !== code));
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(newCodes.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 统计数据
  const stats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisWeek = codes.filter(c => new Date(c.createdAt) >= weekAgo);
    const usedThisWeek = thisWeek.filter(c => c.isUsed);
    const totalUsed = codes.filter(c => c.isUsed);
    const totalAvailable = codes.filter(c => !c.isUsed);
    return {
      total: codes.length,
      available: totalAvailable.length,
      used: totalUsed.length,
      generatedThisWeek: thisWeek.length,
      usedThisWeek: usedThisWeek.length,
      usageRate: codes.length > 0 ? Math.round((totalUsed.length / codes.length) * 100) : 0,
    };
  }, [codes]);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-pdd-text-primary">邀请码管理</h2>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: '总计', value: stats.total, icon: Key, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: '可用', value: stats.available, icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: '已使用', value: stats.used, icon: Users, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: '本周生成', value: stats.generatedThisWeek, icon: Plus, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
          { label: '使用率', value: `${stats.usageRate}%`, icon: TrendingUp, color: 'text-amber-400', bg: 'bg-amber-500/10' },
        ].map(c => (
          <div key={c.label} className="bg-pdd-card rounded-xl border border-pdd-border p-3 text-center">
            <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center mx-auto mb-1.5`}>
              <c.icon size={13} className={c.color} />
            </div>
            <div className="text-lg font-bold text-pdd-text-primary">{c.value}</div>
            <div className="text-[10px] text-pdd-text-secondary mt-0.5">{c.label}</div>
          </div>
        ))}
      </div>

      {/* 生成区域 */}
      <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border">
        <div className="flex items-center gap-3">
          <span className="text-sm text-pdd-text-secondary">生成数量:</span>
          <input type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(Number(e.target.value))} className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary w-20 outline-none" />
          <button onClick={handleGenerate} className="px-4 py-2 bg-pdd-primary text-white rounded-lg text-sm flex items-center gap-1">
            <Plus size={14} /> 生成邀请码
          </button>
        </div>

        {newCodes.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 p-3 bg-pdd-success/10 border border-pdd-success/20 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-pdd-success">已生成 {newCodes.length} 个邀请码</span>
              <button onClick={handleCopyAll} className="text-xs text-pdd-primary flex items-center gap-1">
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? '已复制' : '一键复制'}
              </button>
            </div>
            <div className="space-y-1">
              {newCodes.map(c => (
                <div key={c} className="text-sm font-mono text-pdd-text-primary bg-pdd-bg px-2 py-1 rounded">{c}</div>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* 邀请码列表 */}
      {loading ? <div className="text-pdd-text-secondary">加载中...</div> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-pdd-border text-pdd-text-secondary">
                <th className="text-left py-3 px-2">邀请码</th>
                <th className="text-left py-3 px-2">批次</th>
                <th className="text-left py-3 px-2">使用状态</th>
                <th className="text-left py-3 px-2">使用者</th>
                <th className="text-left py-3 px-2">使用时间</th>
                <th className="text-right py-3 px-2">操作</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(c => (
                <tr key={c.id} className="border-b border-pdd-border/30">
                  <td className="py-3 px-2 font-mono text-pdd-text-primary">{c.code}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">{c.batchId || '-'}</td>
                  <td className="py-3 px-2">
                    {c.isUsed ? <span className="text-xs text-pdd-text-secondary">已使用</span> : <span className="text-xs text-pdd-success">可用</span>}
                  </td>
                  <td className="py-3 px-2 text-pdd-text-secondary">{c.usedBy || '-'}</td>
                  <td className="py-3 px-2 text-pdd-text-secondary text-xs">{c.usedAt ? new Date(c.usedAt).toLocaleDateString('zh-CN') : '-'}</td>
                  <td className="py-3 px-2 text-right">
                    {!c.isUsed && (
                      <button onClick={() => handleDelete(c.code)} className="p-1.5 text-pdd-danger hover:bg-pdd-danger/10 rounded">
                        <Trash2 size={14} />
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

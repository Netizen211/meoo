import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Megaphone, Clock, CheckCircle, XCircle, Edit3, X } from 'lucide-react';
import { apiClient } from '../../../api/client';

interface Announcement {
  id: number;
  title: string;
  content: string;
  isActive: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  targetRoles: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  urgent: { label: '紧急', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
  high: { label: '重要', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
  normal: { label: '普通', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  low: { label: '低', color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
};

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '', content: '', priority: 'normal' as string, targetRoles: '', isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const res = await apiClient.get('/admin/announcements');
    if (res.success) setAnnouncements(res.data || []);
    setLoading(false);
  };

  const openCreate = () => {
    setShowCreate(true);
    setEditingId(null);
    setForm({ title: '', content: '', priority: 'normal', targetRoles: '', isActive: true });
    setFormError('');
  };

  const openEdit = (a: Announcement) => {
    setShowCreate(true);
    setEditingId(a.id);
    setForm({
      title: a.title, content: a.content,
      priority: a.priority, targetRoles: a.targetRoles || '',
      isActive: a.isActive,
    });
    setFormError('');
  };

  const handleSave = async () => {
    setFormError('');
    if (!form.title.trim()) { setFormError('请输入标题'); return; }
    if (!form.content.trim()) { setFormError('请输入内容'); return; }

    setSaving(true);
    const body: any = {
      title: form.title.trim(),
      content: form.content.trim(),
      priority: form.priority,
      targetRoles: form.targetRoles || null,
      isActive: form.isActive,
    };

    let res;
    if (editingId) {
      res = await apiClient.put('/admin/announcements/' + editingId, body);
    } else {
      res = await apiClient.post('/admin/announcements', body);
    }

    setSaving(false);
    if (res.success) {
      setShowCreate(false);
      setActionMsg(editingId ? '公告已更新' : '公告已发布');
      setTimeout(() => setActionMsg(''), 2000);
      load();
    } else {
      setFormError(res.error || '保存失败');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除此公告？')) return;
    await apiClient.delete('/admin/announcements/' + id);
    setActionMsg('公告已删除');
    setTimeout(() => setActionMsg(''), 2000);
    load();
  };

  const handleToggleActive = async (a: Announcement) => {
    await apiClient.put('/admin/announcements/' + a.id, { isActive: !a.isActive });
    setAnnouncements(prev => prev.map(x => x.id === a.id ? { ...x, isActive: !a.isActive } : x));
  };

  if (loading) return <div className="p-4 text-pdd-text-secondary">加载中...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-pdd-text-primary flex items-center gap-2">
            <Megaphone size={20} className="text-pdd-primary" />系统公告
          </h2>
          <p className="text-xs text-pdd-text-secondary mt-0.5">
            管理系统公告，可设置优先级和目标角色。活跃公告将在用户端首页展示。
          </p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 rounded-lg text-sm font-medium bg-pdd-primary text-white hover:bg-pdd-primary-dark transition-colors flex items-center gap-2">
          <Plus size={16} />发布公告
        </button>
      </div>

      {actionMsg && <div className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-2 rounded border border-pdd-success/20">{actionMsg}</div>}

      {announcements.length === 0 ? (
        <div className="text-center py-16 text-pdd-text-secondary bg-pdd-card rounded-xl border border-pdd-border">
          <Megaphone size={32} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">暂无公告</p>
        </div>
      ) : (
        <div className="space-y-3">
          {announcements.map(a => {
            const pc = PRIORITY_CONFIG[a.priority] || PRIORITY_CONFIG.normal;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-pdd-card rounded-xl border p-4 transition-all ${
                  a.isActive ? 'border-pdd-border' : 'border-pdd-border opacity-50'
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${pc.color}`}>
                      {pc.label}
                    </span>
                    <h3 className="text-sm font-semibold text-pdd-text-primary">{a.title}</h3>
                    {a.isActive ? (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">发布中</span>
                    ) : (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-500/10 text-gray-400">已下线</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(a)}
                      className="p-1.5 rounded text-pdd-text-secondary hover:bg-pdd-bg transition-colors"
                      title={a.isActive ? '下线' : '上线'}
                    >
                      {a.isActive ? <XCircle size={15} /> : <CheckCircle size={15} />}
                    </button>
                    <button onClick={() => openEdit(a)} className="p-1.5 rounded text-pdd-text-secondary hover:bg-pdd-bg transition-colors">
                      <Edit3 size={15} />
                    </button>
                    <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded text-pdd-text-secondary hover:text-red-400 hover:bg-red-500/10 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="text-xs text-pdd-text-secondary whitespace-pre-wrap line-clamp-3">{a.content}</p>
                <div className="flex items-center gap-4 mt-3 text-[10px] text-pdd-text-secondary">
                  <span className="flex items-center gap-1"><Clock size={10} />{new Date(a.createdAt).toLocaleString('zh-CN')}</span>
                  {a.targetRoles && <span>目标: {a.targetRoles}</span>}
                  <span>创建者: {a.createdBy}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreate(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-pdd-card rounded-xl p-6 max-w-lg w-full shadow-xl border border-pdd-border"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-pdd-text-primary">
                  {editingId ? '编辑公告' : '发布新公告'}
                </h3>
                <button onClick={() => setShowCreate(false)} className="p-1.5 rounded hover:bg-pdd-bg text-pdd-text-secondary">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">标题 *</label>
                  <input value={form.title} onChange={e => { setForm({ ...form, title: e.target.value }); setFormError(''); }}
                    placeholder="公告标题" className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">内容 *</label>
                  <textarea value={form.content} onChange={e => { setForm({ ...form, content: e.target.value }); setFormError(''); }}
                    placeholder="公告内容，支持纯文本..." rows={4}
                    className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">优先级</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                      className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none">
                      <option value="low">低</option>
                      <option value="normal">普通</option>
                      <option value="high">重要</option>
                      <option value="urgent">紧急</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">目标角色（可选）</label>
                    <input value={form.targetRoles} onChange={e => setForm({ ...form, targetRoles: e.target.value })}
                      placeholder="留空为全部用户"
                      className="w-full px-3 py-2 border border-pdd-border rounded-lg text-sm bg-pdd-bg text-pdd-text-primary outline-none focus:border-pdd-primary/50" />
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })}
                    className="rounded border-pdd-border" />
                  <span className="text-sm text-pdd-text-secondary">发布后立即生效</span>
                </label>
              </div>

              {formError && (
                <div className="mb-4 p-3 bg-pdd-danger/10 border border-pdd-danger/20 rounded-lg text-sm text-pdd-danger">{formError}</div>
              )}

              <div className="flex gap-3">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-lg border border-pdd-border text-sm text-pdd-text-secondary hover:bg-pdd-bg">取消</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-lg bg-pdd-primary hover:bg-pdd-primary-dark text-white text-sm font-medium disabled:opacity-50">
                  {saving ? '保存中...' : editingId ? '更新公告' : '发布公告'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

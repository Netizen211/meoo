import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '../../api/adminApi';

interface SystemSettings {
  registrationOpen: boolean;
  inviteCodeRequired: boolean;
  rateLimitPerMinute: number;
  maxUploadSizeMB: number;
  freeUserStoreLimit: number;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    adminApi.getSettings().then(res => {
      if (res.success) setSettings(res.data);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await adminApi.updateSettings(settings);
    setMsg(res.success ? '保存成功' : '保存失败');
    setSaving(false);
    setTimeout(() => setMsg(''), 2000);
  };

  if (loading) return <div className="text-pdd-text-secondary">加载中...</div>;
  if (!settings) return <div className="text-pdd-text-secondary">加载失败</div>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-pdd-text-primary">系统设置</h2>

      {msg && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-1 rounded">{msg}</motion.div>}

      <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-pdd-text-primary">开放注册</div>
            <div className="text-xs text-pdd-text-secondary">关闭后仅管理员可创建账号</div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s!, registrationOpen: !s!.registrationOpen }))}
            className={`w-11 h-6 rounded-full transition-colors ${settings.registrationOpen ? 'bg-pdd-primary' : 'bg-pdd-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.registrationOpen ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-pdd-text-primary">注册需要邀请码</div>
            <div className="text-xs text-pdd-text-secondary">开启后新用户注册必须提供有效邀请码</div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s!, inviteCodeRequired: !s!.inviteCodeRequired }))}
            className={`w-11 h-6 rounded-full transition-colors ${settings.inviteCodeRequired ? 'bg-pdd-primary' : 'bg-pdd-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.inviteCodeRequired ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-pdd-text-primary">API 限流 (次/分钟)</div>
            <div className="text-xs text-pdd-text-secondary">每个 IP 每分钟最大请求数</div>
          </div>
          <input
            type="number"
            min={10}
            max={1000}
            value={settings.rateLimitPerMinute}
            onChange={e => setSettings(s => ({ ...s!, rateLimitPerMinute: Number(e.target.value) }))}
            className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary w-24 outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-pdd-text-primary">最大上传文件 (MB)</div>
            <div className="text-xs text-pdd-text-secondary">单次上传文件大小上限</div>
          </div>
          <input
            type="number"
            min={1}
            max={100}
            value={settings.maxUploadSizeMB}
            onChange={e => setSettings(s => ({ ...s!, maxUploadSizeMB: Number(e.target.value) }))}
            className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary w-24 outline-none"
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-pdd-text-primary">免费用户店铺上限</div>
            <div className="text-xs text-pdd-text-secondary">免费用户最多可创建的店铺数量</div>
          </div>
          <input
            type="number"
            min={1}
            max={50}
            value={settings.freeUserStoreLimit}
            onChange={e => setSettings(s => ({ ...s!, freeUserStoreLimit: Number(e.target.value) }))}
            className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm text-pdd-text-primary w-24 outline-none"
          />
        </div>

        <div className="pt-2 border-t border-pdd-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-pdd-primary text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}

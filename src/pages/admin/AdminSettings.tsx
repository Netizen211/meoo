import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { adminApi } from '../../api/adminApi';
import { Brain, Key, Hash, Cpu } from 'lucide-react';

interface SystemSettings {
  registrationOpen: boolean;
  inviteCodeRequired: boolean;
  rateLimitPerMinute: number;
  maxUploadSizeMB: number;
  freeUserStoreLimit: number;
  aiEnabled: boolean;
  aiApiKey: string;
  aiDailyLimit: number;
  aiModel: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    adminApi.getSettings().then(res => {
      if (res.success && res.data) {
        setSettings({
          registrationOpen: res.data.registrationOpen ?? true,
          inviteCodeRequired: res.data.inviteCodeRequired ?? true,
          rateLimitPerMinute: res.data.rateLimitPerMinute ?? 200,
          maxUploadSizeMB: res.data.maxUploadSizeMB ?? 50,
          freeUserStoreLimit: res.data.freeUserStoreLimit ?? 1,
          aiEnabled: res.data.aiEnabled ?? false,
          aiApiKey: res.data.aiApiKey ?? '',
          aiDailyLimit: res.data.aiDailyLimit ?? 10,
          aiModel: res.data.aiModel ?? 'claude-sonnet-4-6',
        });
      }
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
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">系统设置</h2>

      {msg && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-pdd-success bg-pdd-success/10 px-3 py-1 rounded">
          {msg}
        </motion.div>
      )}

      {/* 基础设置 */}
      <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Cpu size={14} className="text-pdd-primary" />
          基础设置
        </h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">开放注册</div>
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
            <div className="text-sm">注册需要邀请码</div>
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
            <div className="text-sm">免费用户店铺上限</div>
            <div className="text-xs text-pdd-text-secondary">免费用户最多可创建的店铺数量</div>
          </div>
          <input
            type="number" min={1} max={50}
            value={settings.freeUserStoreLimit}
            onChange={e => setSettings(s => ({ ...s!, freeUserStoreLimit: Number(e.target.value) }))}
            className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm w-24 outline-none"
          />
        </div>
      </div>

      {/* AI 配置 */}
      <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Brain size={14} className="text-purple-500" />
          AI 分析配置
        </h3>
        <p className="text-xs text-pdd-text-secondary">
          配置 AI 分析功能，免费用户无法使用 AI 分析。如果未配置 API Key，所有用户看到的 AI 入口将显示"AI 分析暂未开启"。
        </p>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm">启用 AI 分析</div>
            <div className="text-xs text-pdd-text-secondary">开启后全功能会员可使用 AI 分析</div>
          </div>
          <button
            onClick={() => setSettings(s => ({ ...s!, aiEnabled: !s!.aiEnabled }))}
            className={`w-11 h-6 rounded-full transition-colors ${settings.aiEnabled ? 'bg-purple-500' : 'bg-pdd-border'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${settings.aiEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>

        <div>
          <div className="text-sm mb-1 flex items-center gap-2">
            <Key size={12} className="text-pdd-text-secondary" />
            API Key
          </div>
          <div className="text-xs text-pdd-text-secondary mb-2">
            填入 AI 服务的 API Key（支持 Claude API / OpenAI API）
          </div>
          <div className="flex gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.aiApiKey}
              onChange={e => setSettings(s => ({ ...s!, aiApiKey: e.target.value }))}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3 py-2 rounded-lg border border-pdd-border text-xs text-pdd-text-secondary hover:bg-pdd-bg"
            >
              {showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm mb-1 flex items-center gap-2">
              <Hash size={12} className="text-pdd-text-secondary" />
              每日调用上限
            </div>
            <div className="text-xs text-pdd-text-secondary mb-2">
              每个全功能会员每天最大调用次数
            </div>
            <input
              type="number" min={1} max={1000}
              value={settings.aiDailyLimit}
              onChange={e => setSettings(s => ({ ...s!, aiDailyLimit: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
            />
          </div>
          <div>
            <div className="text-sm mb-1 flex items-center gap-2">
              <Brain size={12} className="text-pdd-text-secondary" />
              AI 模型
            </div>
            <div className="text-xs text-pdd-text-secondary mb-2">
              选择使用的 AI 模型
            </div>
            <select
              value={settings.aiModel}
              onChange={e => setSettings(s => ({ ...s!, aiModel: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-7">Claude Opus 4.7</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="deepseek-v3">DeepSeek V3</option>
            </select>
          </div>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-pdd-primary text-white rounded-lg text-sm disabled:opacity-50 hover:bg-pdd-primary/90 transition-colors"
        >
          {saving ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}

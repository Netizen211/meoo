import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Brain, Key, Hash, Cpu, Shield, Bell, Users, Clock,
  Trash2, Eye, EyeOff, Save,
} from 'lucide-react';
import { useSystemSettings, useUpdateSystemSettings } from '../../hooks/useAdminData';
import type { SystemSettings } from '../../../api/adminApi';

const DEFAULT_SETTINGS: SystemSettings = {
  registrationOpen: true,
  inviteCodeRequired: true,
  proGraceDays: 30,
  membershipReminderDays: 7,
  freeDataRetentionDays: 3,
  cleanupCron: '0 3 * * *',
  dataRetentionDays: 365,
  maxLoginAttempts: 5,
  tokenExpiresMinutes: 15,
  wecomWebhook: '',
  dingtalkWebhook: '',
  copyEnabled: true,
  aiEnabled: false,
  aiApiKey: '',
  aiDailyLimit: 10,
  aiModel: 'claude-sonnet-4-6',
};

export default function AdminSettings() {
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const { data: loadedSettings, isLoading } = useSystemSettings();
  const updateMutation = useUpdateSystemSettings();

  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);

  // sync loaded settings into local form state once
  useEffect(() => {
    if (loadedSettings) setSettings(loadedSettings);
  }, [loadedSettings]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleSave = async () => {
    try {
      const res = await updateMutation.mutateAsync(settings);
      showMsg(res.success ? 'success' : 'error', res.success ? '设置保存成功' : (res.error || '保存失败'));
    } catch {
      showMsg('error', '保存设置失败，请检查网络连接');
    }
  };

  const update = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(s => ({ ...s, [key]: value }));
  };

  if (isLoading) return <div className="text-pdd-text-secondary py-8 text-center">加载设置中...</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-pdd-text-primary">系统设置</h2>
      </div>

      {msg && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={'text-sm px-4 py-2.5 rounded-lg border ' + (
            msg.type === 'success'
              ? 'text-green-400 bg-green-500/10 border-green-500/20'
              : 'text-red-400 bg-red-500/10 border-red-500/20'
          )}
        >
          {msg.text}
        </motion.div>
      )}

      {/* 注册设置 */}
      <SectionCard icon={<Users size={16} className="text-blue-400" />} title="注册设置">
        <ToggleRow
          label="开放注册" hint="关闭后仅管理员可创建账号"
          checked={settings.registrationOpen}
          onChange={v => update('registrationOpen', v)}
        />
        <ToggleRow
          label="注册需要邀请码" hint="开启后新用户注册必须提供有效邀请码"
          checked={settings.inviteCodeRequired}
          onChange={v => update('inviteCodeRequired', v)}
        />
      </SectionCard>

      {/* 会员设置 */}
      <SectionCard icon={<Clock size={16} className="text-amber-400" />} title="会员设置">
        <NumberRow
          label="Pro 宽限期（天）" hint="Pro 到期后仍可访问数据的天数"
          value={settings.proGraceDays}
          onChange={v => update('proGraceDays', v)}
          min={0} max={365}
        />
        <NumberRow
          label="到期提醒（天）" hint="会员到期前多少天开始提醒"
          value={settings.membershipReminderDays}
          onChange={v => update('membershipReminderDays', v)}
          min={1} max={30}
        />
        <NumberRow
          label="免费数据保留（天）" hint="免费用户数据自动过期天数"
          value={settings.freeDataRetentionDays}
          onChange={v => update('freeDataRetentionDays', v)}
          min={1} max={365}
        />
      </SectionCard>

      {/* 清理策略 */}
      <SectionCard icon={<Trash2 size={16} className="text-red-400" />} title="清理策略">
        <div className="space-y-1.5">
          <div className="text-sm text-pdd-text-primary">自动清理 Cron 表达式</div>
          <div className="text-xs text-pdd-text-secondary">
            格式: 分 时 日 月 星期 (例如 0 3 * * * 表示每天凌晨3点)
          </div>
          <input
            type="text" value={settings.cleanupCron}
            onChange={e => update('cleanupCron', e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
            placeholder="0 3 * * *"
          />
        </div>
        <NumberRow
          label="数据保留天数" hint="超过该天数的历史数据将被清理"
          value={settings.dataRetentionDays}
          onChange={v => update('dataRetentionDays', v)}
          min={30} max={3650}
        />
      </SectionCard>

      {/* 安全设置 */}
      <SectionCard icon={<Shield size={16} className="text-purple-400" />} title="安全设置">
        <ToggleRow
          label="允许复制内容"
          hint="开启后用户可以选中和复制页面内容，关闭则禁止复制"
          checked={settings.copyEnabled}
          onChange={v => update('copyEnabled', v)}
        />
        <NumberRow
          label="登录尝试次数限制" hint="连续失败超过此次数将临时锁定"
          value={settings.maxLoginAttempts}
          onChange={v => update('maxLoginAttempts', v)}
          min={3} max={20}
        />
        <NumberRow
          label="Token 有效期（分钟）" hint="访问令牌的有效时长"
          value={settings.tokenExpiresMinutes}
          onChange={v => update('tokenExpiresMinutes', v)}
          min={5} max={1440}
        />
      </SectionCard>

      {/* 通知设置 */}
      <SectionCard icon={<Bell size={16} className="text-cyan-400" />} title="通知设置">
        <div className="space-y-1.5">
          <div className="text-sm text-pdd-text-primary">企业微信 Webhook</div>
          <div className="text-xs text-pdd-text-secondary">接收系统通知的企业微信机器人 Webhook 地址</div>
          <input
            type="text" value={settings.wecomWebhook}
            onChange={e => update('wecomWebhook', e.target.value)}
            placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=..."
            className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
          />
        </div>
        <div className="space-y-1.5">
          <div className="text-sm text-pdd-text-primary">钉钉 Webhook</div>
          <div className="text-xs text-pdd-text-secondary">接收系统通知的钉钉机器人 Webhook 地址</div>
          <input
            type="text" value={settings.dingtalkWebhook}
            onChange={e => update('dingtalkWebhook', e.target.value)}
            placeholder="https://oapi.dingtalk.com/robot/send?access_token=..."
            className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
          />
        </div>
      </SectionCard>

      {/* AI 配置 */}
      <SectionCard icon={<Brain size={16} className="text-purple-400" />} title="AI 分析配置">
        <p className="text-xs text-pdd-text-secondary -mt-1">
          配置 AI 分析功能。如果未配置 API Key，所有用户的 AI 入口将显示未开启状态。
        </p>

        <ToggleRow
          label="启用 AI 分析"
          hint="开启后全功能会员可使用 AI 分析"
          checked={settings.aiEnabled}
          onChange={v => update('aiEnabled', v)}
          activeColor="bg-purple-500"
        />

        <div className="space-y-1.5">
          <div className="text-sm text-pdd-text-primary flex items-center gap-2">
            <Key size={12} className="text-pdd-text-secondary" /> API Key
          </div>
          <div className="text-xs text-pdd-text-secondary">
            填入 AI 服务的 API Key（支持 Claude API / OpenAI API）
          </div>
          <div className="flex gap-2">
            <input
              type={showApiKey ? 'text' : 'password'}
              value={settings.aiApiKey}
              onChange={e => update('aiApiKey', e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
            />
            <button
              onClick={() => setShowApiKey(!showApiKey)}
              className="px-3 py-2 rounded-lg border border-pdd-border text-xs text-pdd-text-secondary hover:bg-pdd-bg flex items-center gap-1"
            >
              {showApiKey ? <EyeOff size={12} /> : <Eye size={12} />}
              {showApiKey ? '隐藏' : '显示'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <div className="text-sm text-pdd-text-primary flex items-center gap-2">
              <Hash size={12} className="text-pdd-text-secondary" /> 每日调用上限
            </div>
            <div className="text-xs text-pdd-text-secondary">每个全功能会员每天最大调用次数</div>
            <input
              type="number" min={1} max={1000}
              value={settings.aiDailyLimit}
              onChange={e => update('aiDailyLimit', Number(e.target.value))}
              className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none focus:border-pdd-primary"
            />
          </div>
          <div className="space-y-1.5">
            <div className="text-sm text-pdd-text-primary flex items-center gap-2">
              <Brain size={12} className="text-pdd-text-secondary" /> AI 模型
            </div>
            <div className="text-xs text-pdd-text-secondary">选择使用的 AI 模型</div>
            <select
              value={settings.aiModel}
              onChange={e => update('aiModel', e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-pdd-border bg-pdd-bg text-sm outline-none"
            >
              <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
              <option value="claude-opus-4-7">Claude Opus 4.7</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="deepseek-v3">DeepSeek V3</option>
            </select>
          </div>
        </div>
      </SectionCard>

      {/* 保存按钮 */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="px-6 py-2.5 bg-pdd-primary text-white rounded-lg text-sm font-medium
            disabled:opacity-50 hover:bg-pdd-primary/90 transition-colors flex items-center gap-2"
        >
          <Save size={14} />
          {updateMutation.isPending ? '保存中...' : '保存设置'}
        </button>
      </div>
    </div>
  );
}

/* ==================== 子组件 ==================== */

function SectionCard({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode;
}) {
  return (
    <div className="bg-pdd-card p-4 rounded-xl border border-pdd-border space-y-3">
      <h3 className="text-sm font-semibold text-pdd-text-primary flex items-center gap-2">
        {icon} {title}
      </h3>
      {children}
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, activeColor }: {
  label: string; hint: string; checked: boolean;
  onChange: (v: boolean) => void; activeColor?: string;
}) {
  const color = activeColor || 'bg-pdd-primary';
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-pdd-text-primary">{label}</div>
        <div className="text-xs text-pdd-text-secondary">{hint}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={'w-11 h-6 rounded-full transition-colors ' + (checked ? color : 'bg-pdd-border')}
      >
        <div className={'w-5 h-5 bg-pdd-card rounded-full shadow transition-transform ' +
          (checked ? 'translate-x-6' : 'translate-x-0.5')}
        />
      </button>
    </div>
  );
}

function NumberRow({ label, hint, value, onChange, min, max }: {
  label: string; hint: string; value: number;
  onChange: (v: number) => void; min?: number; max?: number;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-pdd-text-primary">{label}</div>
        <div className="text-xs text-pdd-text-secondary">{hint}</div>
      </div>
      <input
        type="number" min={min} max={max}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="bg-pdd-bg border border-pdd-border rounded-lg px-3 py-2 text-sm w-24 outline-none text-center"
      />
    </div>
  );
}

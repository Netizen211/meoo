import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, ShieldOff, RefreshCw, Monitor, Terminal,
  FileText, Copy, MousePointer, Globe,
  Droplets, Key, SlidersHorizontal,
  ChevronDown, ChevronRight, CheckCircle, XCircle, Eye,
} from 'lucide-react';
import { useProtectionConfig } from '../../protection/protectionConfig';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  const base = 'relative inline-flex h-6 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ';
  return (
    <button onClick={() => onChange(!checked)} className={base + (checked ? 'bg-pdd-primary' : 'bg-pdd-border')}>
      <span className={'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ' + (checked ? 'translate-x-4' : 'translate-x-0')} />
    </button>
  );
}


const SECTIONS = [
  { id: 'browser', icon: 'Monitor', title: '浏览器调试防护', desc: '防止通过浏览器开发者工具查看或修改前端代码' },
  { id: 'antiCrawl', icon: 'Globe', title: '反爬虫防护', desc: '屏蔽非浏览器请求、异常User-Agent和爬虫工具' },
  { id: 'content', icon: 'FileText', title: '内容保护', desc: '水印、复制限制等内容安全措施' },
  { id: 'access', icon: 'Key', title: '访问控制', desc: '基于IP、时间的访问控制策略' },
];


const ICON_MAP: Record<string, any> = { Monitor, Globe, FileText, Key, Terminal };


export default function AdminProtection() {
  const { config, updateConfig, resetConfig } = useProtectionConfig();
  const [open, setOpen] = useState<Record<string, boolean>>({ browser: true });
  const toggle = (id: string) => setOpen(p => ({ ...p, [id]: !p[id] }));


  const SectionCard = ({ s }: { s: typeof SECTIONS[0] }) => {
    const Icon = ICON_MAP[s.icon] || Shield;
    const expanded = open[s.id];
    return (
      <div className="relative group mb-4">
        <div className="absolute -inset-[0.5px] rounded-xl bg-gradient-to-r from-pdd-primary/20 to-purple-500/20 opacity-20 group-hover:opacity-40 blur-[0.5px] transition-all duration-500" />
        <div className="relative bg-pdd-card rounded-xl border border-pdd-border/60 shadow-sm overflow-hidden">
          <button onClick={() => toggle(s.id)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-pdd-bg/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pdd-primary to-purple-500 flex items-center justify-center">
                <Icon size={16} className="text-white" />
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-pdd-text">{s.title}</h3>
                <p className="text-[11px] text-pdd-text-secondary/70 mt-0.5">{s.desc}</p>
              </div>
            </div>
            {expanded ? <ChevronDown size={18} className="text-pdd-text-secondary" /> : <ChevronRight size={18} className="text-pdd-text-secondary" />}
          </button>
          {expanded && <div className="px-5 pb-5 border-t border-pdd-border/40 pt-4">{renderSectionFields(s.id)}</div>}
        </div>
      </div>
    );
  };


  const Row = ({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) => (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-pdd-bg/50 border border-pdd-border/30">
      <div className="min-w-0">
        <p className="text-xs font-medium text-pdd-text">{label}</p>
        <p className="text-[10px] text-pdd-text-secondary/70 mt-0.5">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );

  const addField = (fields: React.ReactNode[], label: string, desc: string, control: React.ReactNode) => {
    fields.push(<Row key={label} label={label} desc={desc}>{control}</Row>);
  };

  const addToggle = (fields: React.ReactNode[], key: string, label: string, desc: string) => {
    addField(fields, label, desc, <Toggle checked={(config as any)[key]} onChange={v => updateConfig({ [key]: v } as any)} />);
  };


  const renderSectionFields = (id: string): React.ReactNode[] => {
    const fields: React.ReactNode[] = [];

    switch (id) {
      case 'browser':
        addToggle(fields, 'disableRightClick', '禁用右键菜单', '屏蔽鼠标右键上下文菜单');
        addToggle(fields, 'disableF12', '禁用F12', '屏蔽F12开发者工具快捷键');
        addToggle(fields, 'disableDevShortcuts', '禁用Ctrl+Shift+I/J', '屏蔽其他DevTools快捷键');
        addToggle(fields, 'detectDevTools', 'DevTools检测', '检测开发者工具是否打开');
        if (config.detectDevTools) {
          fields.push(
            <div key="dt-action" className="ml-10 flex items-center gap-3">
              <span className="text-xs text-pdd-text-secondary">检测后行为：</span>
              <select value={config.devToolsAction} onChange={e => updateConfig({ devToolsAction: e.target.value as any })}
                className="px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary">
                <option value="warn">弹窗警告</option>
                <option value="redirect">跳转首页</option>
                <option value="blank">白屏</option>
              </select>
            </div>
          );
        }
        addToggle(fields, 'disableCopy', '禁用复制', '禁止Ctrl+C/X/V');
        addToggle(fields, 'disableSelection', '禁用文本选择', '禁止鼠标选择文字');
        addToggle(fields, 'disableDrag', '禁用拖拽', '禁止拖拽页面元素');
        addToggle(fields, 'disableConsole', '禁用Console', '生产环境禁用console');
        break;


      case 'antiCrawl':
        addToggle(fields, 'uaFilter', 'UA黑名单过滤', '屏蔽已知爬虫User-Agent');
        if (config.uaFilter) {
          fields.push(
            <div key="ua-input" className="ml-10">
              <label className="text-xs text-pdd-text-secondary block mb-1">黑名单关键词（逗号分隔）：</label>
              <input type="text" value={config.uaBlacklist} onChange={e => updateConfig({ uaBlacklist: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary" />
            </div>
          );
        }
        addToggle(fields, 'blockNonBrowser', '屏蔽非浏览器UA', '拒绝没有浏览器特征的请求');
        addToggle(fields, 'blockEmptyReferer', '拒绝空Referer', '拒绝不带Referer头的请求');
        addField(fields, '请求频率限制', '每分钟最多请求数',
          <div className="flex items-center gap-2">
            <input type="number" value={config.rateLimit} onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) updateConfig({ rateLimit: n }); }} min={10} max={600}
              className="w-20 px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary text-right" />
            <span className="text-xs text-pdd-text-secondary">次/分</span>
          </div>
        );
        break;


      case 'content':
        addToggle(fields, 'watermark', '水印', '页面叠加半透明文字水印');
        if (config.watermark) {
          fields.push(
            <div key="wm-config" className="ml-10 space-y-3">
              <div>
                <label className="text-xs text-pdd-text-secondary block mb-1">水印文字：</label>
                <input type="text" value={config.watermarkText} onChange={e => updateConfig({ watermarkText: e.target.value })}
                  className="w-full px-3 py-1.5 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary" />
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-pdd-text-secondary">透明度：</span>
                  <input type="range" min="1" max="20" value={Math.round((config.watermarkOpacity || 0.06) * 100)}
                    onChange={e => updateConfig({ watermarkOpacity: parseInt(e.target.value) / 100 })} className="w-24" />
                  <span className="text-xs text-pdd-text">{Math.round((config.watermarkOpacity || 0.06) * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-pdd-text-secondary">字号：</span>
                  <input type="number" value={config.watermarkFontSize} onChange={e => { const n = parseInt(e.target.value); if (!isNaN(n)) updateConfig({ watermarkFontSize: n }); }} min={10} max={32}
                    className="w-16 px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary text-right" />
                  <span className="text-xs text-pdd-text-secondary">px</span>
                </div>
              </div>
            </div>
          );
        }
        break;


      case 'access':
        addToggle(fields, 'timeRestrict', '时间限制', '仅允许在指定时间段内访问');
        if (config.timeRestrict) {
          fields.push(
            <div key="time-picker" className="ml-10 flex items-center gap-3">
              <span className="text-xs text-pdd-text-secondary">允许时段：</span>
              <input type="time" value={config.timeStart} onChange={e => updateConfig({ timeStart: e.target.value })}
                className="px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary" />
              <span className="text-xs text-pdd-text-secondary">至</span>
              <input type="time" value={config.timeEnd} onChange={e => updateConfig({ timeEnd: e.target.value })}
                className="px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary" />
            </div>
          );
        }
        addToggle(fields, 'blockProxyVpn', '代理/VPN检测', '检测并拦截代理或VPN工具访问');
        if (config.blockProxyVpn) {
          fields.push(
            <div key="proxy-action" className="ml-10 flex items-center gap-3">
              <span className="text-xs text-pdd-text-secondary">检测后行为：</span>
              <select value={config.proxyVpnAction} onChange={e => updateConfig({ proxyVpnAction: e.target.value as any })}
                className="px-2 py-1 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary">
                <option value="warn">弹窗警告</option>
                <option value="redirect">跳转首页</option>
                <option value="blank">白屏</option>
              </select>
            </div>
          );
        }
        fields.push(
          <div key="ip-wl" className="pt-2">
            <label className="text-xs text-pdd-text-secondary block mb-1">IP白名单（每行一个，留空不限制）：</label>
            <textarea value={config.ipWhitelist} onChange={e => updateConfig({ ipWhitelist: e.target.value })} rows={2}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary resize-none"
              placeholder="192.168.1.1" />
          </div>,
          <div key="ip-bl">
            <label className="text-xs text-pdd-text-secondary block mb-1">IP黑名单（每行一个）：</label>
            <textarea value={config.ipBlacklist} onChange={e => updateConfig({ ipBlacklist: e.target.value })} rows={2}
              className="w-full px-3 py-1.5 text-xs rounded-md border border-pdd-border bg-pdd-bg text-pdd-text outline-none focus:border-pdd-primary resize-none"
              placeholder="1.2.3.4" />
          </div>
        );
        break;
    }
    return fields;
  };


  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-pdd-text flex items-center gap-2">
            <Shield size={22} className="text-pdd-primary" />安全防护系统
          </h1>
          <p className="text-xs text-pdd-text-secondary mt-1">集中管理前端安全防护、反调试、反爬虫与访问控制策略</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-pdd-bg border border-pdd-border">
            <span className="text-xs text-pdd-text-secondary">全局开关</span>
            <Toggle checked={config.enabled} onChange={v => updateConfig({ enabled: v })} />
          </div>
          <button onClick={() => { if (window.confirm('确认重置所有设置为默认值？')) resetConfig(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-pdd-border text-pdd-text-secondary hover:text-pdd-danger hover:border-pdd-danger/50 transition-colors">
            <RefreshCw size={14} />重置默认
          </button>
        </div>
      </div>

      {!config.enabled && (
        <div className="mb-4 p-4 bg-pdd-danger/10 border border-pdd-danger/30 rounded-xl flex items-center gap-3">
          <ShieldOff size={20} className="text-pdd-danger shrink-0" />
          <div>
            <p className="text-sm font-medium text-pdd-danger">防护已全局关闭</p>
            <p className="text-xs text-pdd-text-secondary mt-0.5">所有安全防护措施已停用，网站处于无保护状态。</p>
          </div>
        </div>
      )}

      {SECTIONS.map(s => <SectionCard key={s.id} s={s} />)}

      <div className="mt-6 p-4 bg-pdd-bg rounded-xl border border-pdd-border/60">
        <h3 className="text-sm font-semibold text-pdd-text flex items-center gap-2 mb-3">
          <Shield size={16} className="text-pdd-primary" />安全头状态（Nginx层生效）
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <HeaderStatus label="严格CSP" active={config.strictCSP} />
          <HeaderStatus label="X-Frame-Deny" active={config.xFrameDeny} />
          <HeaderStatus label="HSTS" active={config.hsts} />
          <HeaderStatus label="Referrer-Policy" active={config.referrerPolicy} />
        </div>
        <p className="text-[10px] text-pdd-text-secondary/60 mt-2">修改Nginx配置后需执行nginx -t && systemctl reload nginx生效。</p>
      </div>
    </div>
  );
}


function HeaderStatus({ label, active }: { label: string; active: boolean }) {
  const cls = 'flex items-center gap-2 px-3 py-2 rounded-lg border ' + (active ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-pdd-danger/5 border-pdd-danger/20');
  const txtCls = 'text-xs ' + (active ? 'text-emerald-500' : 'text-pdd-text-secondary/60');
  return (
    <div className={cls}>
      {active ? <CheckCircle size={14} className="text-emerald-500" /> : <XCircle size={14} className="text-pdd-danger/60" />}
      <span className={txtCls}>{label}</span>
    </div>
  );
}


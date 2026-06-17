/**
 * 安全防护配置 — Zustand + persist (localStorage)
 *
 * 所有防护措施以开关形式保存在本地，前端实时生效。
 * 管理员可通过后台 /protection 页面调整。
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProtectionConfig {
  /** 全局总开关 */
  enabled: boolean;

  // ─── 浏览器调试防护 ────────────────
  /** 禁用右键菜单 */
  disableRightClick: boolean;
  /** 禁用 F12 / 开发者工具快捷键 */
  disableF12: boolean;
  /** 禁用 Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+U */
  disableDevShortcuts: boolean;
  /** DevTools 检测（检测到打开时弹窗/跳转） */
  detectDevTools: boolean;
  /** DevTools 检测后的行为: 'warn' | 'redirect' | 'blank' */
  devToolsAction: 'warn' | 'redirect' | 'blank';
  /** 禁用 Ctrl+C / Ctrl+X / Ctrl+V */
  disableCopy: boolean;
  /** 禁用文本选择 */
  disableSelection: boolean;
  /** 禁用拖拽 */
  disableDrag: boolean;
  /** 禁用 console（生产环境防调试） */
  disableConsole: boolean;

  // ─── 反爬虫防护 ────────────────────
  /** User-Agent 黑名单过滤 */
  uaFilter: boolean;
  /** 自定义 UA 黑名单关键词（逗号分隔） */
  uaBlacklist: string;
  /** 请求频率限制（请求/分钟） */
  rateLimit: number;
  /** 屏蔽非浏览器 User-Agent */
  blockNonBrowser: boolean;
  /** 空 Referer 拒绝 */
  blockEmptyReferer: boolean;

  // ─── 内容保护 ──────────────────────
  /** 水印开关 */
  watermark: boolean;
  /** 水印文字 */
  watermarkText: string;
  /** 水印透明度 */
  watermarkOpacity: number;
  /** 水印字体大小 */
  watermarkFontSize: number;

  // ─── 访问控制 ──────────────────────
  /** IP 黑名单（逗号分隔） */
  ipBlacklist: string;
  /** IP 白名单（逗号分隔，为空不限制） */
  ipWhitelist: string;
  /** 启用时间限制 */
  timeRestrict: boolean;
  /** 允许访问的开始时间 (HH:mm) */
  timeStart: string;
  /** 允许访问的结束时间 (HH:mm) */
  timeEnd: string;

  // ─── 代理/VPN 检测 ────────────────
  /** 屏蔽代理/VPN 访问 */
  blockProxyVpn: boolean;
  /** 检测到代理/VPN 后的行为: 'warn' | 'redirect' | 'blank' */
  proxyVpnAction: 'warn' | 'redirect' | 'blank';

  // ─── 安全头 ────────────────────────
  /** 启用严格 CSP */
  strictCSP: boolean;
  /** X-Frame-Options: DENY */
  xFrameDeny: boolean;
  /** 启用 HSTS */
  hsts: boolean;
  /** Referrer-Policy: strict-origin */
  referrerPolicy: boolean;
}

const DEFAULT_CONFIG: ProtectionConfig = {
  enabled: true,

  disableRightClick: true,
  disableF12: true,
  disableDevShortcuts: true,
  detectDevTools: false,
  devToolsAction: 'warn',
  disableCopy: true,
  disableSelection: true,
  disableDrag: false,
  disableConsole: false,

  uaFilter: false,
  uaBlacklist: 'python-requests,curl,wget,scrapy,httpclient,go-http-client,okhttp',
  rateLimit: 60,
  blockNonBrowser: false,
  blockEmptyReferer: false,

  watermark: false,
  watermarkText: '店分析 Confidential',
  watermarkOpacity: 0.06,
  watermarkFontSize: 16,

  ipBlacklist: '',
  ipWhitelist: '',
  timeRestrict: false,
  timeStart: '08:00',
  timeEnd: '23:00',

  strictCSP: true,
  xFrameDeny: true,
  hsts: true,
  referrerPolicy: true,

  blockProxyVpn: false,
  proxyVpnAction: 'warn',
};

interface ProtectionStore {
  config: ProtectionConfig;
  updateConfig: (patch: Partial<ProtectionConfig>) => void;
  resetConfig: () => void;
}

export const useProtectionConfig = create<ProtectionStore>()(
  persist(
    (set) => ({
      config: { ...DEFAULT_CONFIG },
      updateConfig: (patch) =>
        set((state) => ({ config: { ...state.config, ...patch } })),
      resetConfig: () => set({ config: { ...DEFAULT_CONFIG } }),
    }),
    { name: 'meoo-protection-config', version: 1 }
  )
);

export { DEFAULT_CONFIG };

/**
 * 调试配置服务 — 基于文件的 IP 白名单管理
 *
 * 配置存储在 /www/wwwroot/meoo/debug-config.json
 * 仅管理员可修改，自动热加载
 */
import fs from 'fs';
import path from 'path';

const CONFIG_PATH = process.env.DEBUG_CONFIG_PATH || '/www/wwwroot/meoo/debug-config.json';

export interface DebugConfig {
  /** 全局调试开关 */
  enabled: boolean;
  /** 允许调试的 IP 列表 */
  allowedIPs: string[];
  /** 上次修改时间 */
  updatedAt: string;
}

const DEFAULT_CONFIG: DebugConfig = {
  enabled: true,
  allowedIPs: [],
  updatedAt: new Date().toISOString(),
};

let cachedConfig: DebugConfig | null = null;
let lastLoad = 0;
const CACHE_TTL = 5000; // 5秒

function ensureConfigFile(): void {
  if (fs.existsSync(CONFIG_PATH)) return;
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
}

export function loadDebugConfig(): DebugConfig {
  const now = Date.now();
  if (cachedConfig && now - lastLoad < CACHE_TTL) return cachedConfig;
  try {
    ensureConfigFile();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    lastLoad = now;
  } catch {
    cachedConfig = { ...DEFAULT_CONFIG };
  }
  return cachedConfig!;
}

export function saveDebugConfig(config: DebugConfig): boolean {
  try {
    ensureConfigFile();
    config.updatedAt = new Date().toISOString();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    cachedConfig = { ...config };
    lastLoad = Date.now();
    return true;
  } catch (e) {
    console.error('Failed to save debug config:', e);
    return false;
  }
}

export function isIPAllowed(ip: string): boolean {
  const config = loadDebugConfig();
  if (!config.enabled) return false;
  if (config.allowedIPs.length === 0) return false;
  // 支持精确匹配
  if (config.allowedIPs.includes(ip)) return true;
  // 支持通配符匹配 (e.g. 192.168.*)
  for (const allowed of config.allowedIPs) {
    if (allowed.includes('*')) {
      const pattern = allowed.replace(/\./g, '\.').replace(/\*/g, '.*');
      if (new RegExp(`^${pattern}$`).test(ip)) return true;
    }
  }
  return false;
}

// ===== Bug Report 存储 =====

export interface DebugReport {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  ip: string;
  userId?: string;
  username?: string;
  createdAt: string;
  deviceInfo: {
    userAgent: string;
    screen: string;
    url: string;
    language: string;
    theme?: string;
    timestamp?: string;
  };
  logs: any[];
  /** ★ v6: 用户操作录轨（点击、路由、input） */
  userActions?: any[];
  /** ★ v6: 网络请求录轨 */
  networkRequests?: any[];
  /** ★ v6: localStorage 配置快照 */
  config?: Record<string,any>;
  /** ★ v6.5: 资源加载记录 */
  resources?: any[];
  /** ★ v6.5: 部署诊断 */
  deployDiagnostics?: Record<string,any>;
  /** ★ v6.5: 网络诊断 */
  networkDiagnostics?: Record<string,any>;
  /** ★ v6.5: 服务端 requestId 关联 */
  serverRequestIds?: string[];
  /** ★ v6.5: 路由历史 */
  routeHistory?: string[];
  /** ★ v6.5: 错误摘要 */
  errorSummary?: any[];
  /** ★ v6.5: 运行时诊断 */
  runtimeDiagnostics?: Record<string,any>;
  status: 'open' | 'resolved' | 'wontfix';
  /** Enriched element info from picker (single element, legacy) */
  elementInfo?: {
    tag: string;
    id: string;
    cls: string;
    selectorPath: string;
    reactComponent: string;
    computedCss: Record<string,string>;
    position: number[];
    text: string;
    theme: string;
  };
  /** Multiple element info from picker (multi-select) */
  elementInfos?: Array<{
    tag: string;
    id: string;
    cls: string;
    selectorPath: string;
    reactComponent: string;
    computedCss: Record<string,string>;
    position: number[];
    text: string;
    theme: string;
  }>;
  /** Build metadata */
  buildInfo?: {
    buildId?: string;
  };
  /** Element screenshot (base64 data URL) */
  screenshot?: string;
  /** Page context: current filters, data counts, etc. */
  pageContext?: Record<string, any>;
  /** ★ 自动诊断流程 — 每次反馈附带处理 SOP */
  diagnosticFlow?: Array<{
    step: number;
    action: string;
    detail: string;
    status: 'pending' | 'done' | 'skipped';
  }>;
}

function getReportsDir(): string {
  const baseDir = path.dirname(CONFIG_PATH); // e.g. /www/wwwroot/meoo
  const reportsDir = path.join(baseDir, 'debug-reports');
  if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });
  return reportsDir;
}

export function saveReport(report: DebugReport): boolean {
  try {
    const dir = getReportsDir();
    const filePath = path.join(dir, `${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Failed to save debug report:', e);
    return false;
  }
}

export function listReports(): { id: string; title: string; severity: string; status: string; createdAt: string; username?: string }[] {
  try {
    const dir = getReportsDir();
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse()
      .slice(0, 200); // 最多返回200条
    return files.map(f => {
      try {
        const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
        const report: DebugReport = JSON.parse(raw);
        return {
          id: report.id,
          title: report.title,
          severity: report.severity,
          status: report.status,
          createdAt: report.createdAt,
          username: report.username,
        };
      } catch { return null; }
    }).filter(Boolean) as any[];
  } catch { return []; }
}

export function getReport(id: string): DebugReport | null {
  try {
    const dir = getReportsDir();
    const filePath = path.join(dir, `${id}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

export function updateReportStatus(id: string, status: 'open' | 'resolved' | 'wontfix'): boolean {
  try {
    const report = getReport(id);
    if (!report) return false;
    report.status = status;
    return saveReport(report);
  } catch { return false; }
}

/**
 * ContextSnapshot — 全链路上下文快照 v4
 *
 * 基于 TimelineStore 持久化，覆盖 30~60 秒全量操作：
 *   1. 时间线事件（TimelineStore 全部事件）
 *   2. CodeTracer 代码执行追踪（渲染、模块、DOM 变更）
 *   3. FPS/性能时序记录
 *   4. ActionRecorder 兼容缓冲区
 *   5. 视口截图 + DOM 元素信息
 *   6. 应用状态（Zustand store）
 *   7. 设备与环境（含 GPU、字体、时区）
 *   8. localStorage 关键配置
 *   9. 构建版本 + 部署诊断
 *  10. 网络诊断（CDN、DNS、TTFB）
 *  11. React 组件树
 *  12. 错误摘要（合并历史 + 当前 session）
 *  13. 运行时诊断
 *  14. session 统计信息
 *
 * 设计参考：RRWeb + Sentry Replay + LogRocket 全量录制
 */

import { actionRecorder } from './actionRecorder';
import { timelineStore, type TimelineEvent } from './timelineStore';
import { codeTracer } from './codeTracer';
import html2canvas from 'html2canvas';

// ──── 导出类型 ────

export interface ElSnapshot {
  tag: string;
  id: string;
  cls: string;
  text: string;
  selectorPath: string;
  reactComponent: string;
  computedCss: Record<string, string>;
  position: [number, number, number, number];
  theme: string;
}

export interface DeviceSnapshot {
  userAgent: string;
  screen: string;
  language: string;
  theme: string;
  timestamp: string;
  url: string;
  referrer: string;
  connection?: string;
  memory?: string;
  /** ★ 时区 */
  timezone: string;
  /** ★ GPU / WebGL 渲染器 */
  gpu?: string;
  /** ★ 平台: Win32/MacIntel/Linux x86_64 */
  platform: string;
  /** ★ 已安装字体数量 */
  fontCount?: number;
  /** ★ 已开启浏览器扩展列表（仅从 DOM 推断） */
  detectedExtensions?: string[];
}

export interface DeployDiagnostics {
  /** build-meta.json 中的 buildId */
  serverBuildId?: string;
  /** 当前本地缓存的 buildId */
  localBuildId?: string;
  /** buildId 一致性 */
  buildMatch: boolean;
  /** 当前 bundle 文件名 */
  bundleName: string;
  /** 脚本加载顺序校验 */
  scriptLoadOrder?: string[];
  /** 部署时间（build-meta 中的时间） */
  buildTime?: string;
}

export interface NetworkDiagnostics {
  /** Cloudflare 响应头 */
  cfRay?: string;
  cfCache?: string;
  /** DNS 耗时 */
  dnsTime?: number;
  /** TCP 连接耗时 */
  tcpTime?: number;
  /** TLS 握手耗时 */
  tlsTime?: number;
  /** 首字节时间 */
  ttfb?: number;
  /** 完整的服务端 requestId 列表（用于日志关联） */
  requestIds: string[];
  /** API 端点可用性 */
  endpointStatus?: Record<string, number>;
}

export interface FullContextSnapshot {
  title?: string;
  description?: string;
  severity?: string;

  // Multi-element selection
  elementInfos?: ElSnapshot[];

  // Background recordings (from actionRecorder) — v4 accepts both old and new event types
  logs: any[];
  actions: any[];
  networks: any[];
  resources?: any[];

  // ★ v4: TimelineStore 完整时间线（30~60 秒全量事件）
  timeline?: TimelineEvent[];
  timelineStats?: Record<string, any>;

  // ★ v4: CodeTracer 数据
  codeTraces?: TimelineEvent[];
  componentRenderCounts?: Record<string, number>;

  // ★ v4: 用户信息
  userId?: string;
  username?: string;
  userSessionId?: string;
  userPageLoadId?: string;

  // Screenshot
  screenshot?: string;

  // App state (all zustand stores)
  appState: Record<string, any>;

  // Device & env
  device: DeviceSnapshot;

  // Build info
  buildInfo?: Record<string, any>;

  // ★ 部署诊断
  deployDiagnostics?: DeployDiagnostics;

  // ★ 网络诊断
  networkDiagnostics?: NetworkDiagnostics;

  // ★ 路由历史
  routeHistory?: string[];

  // ★ 服务端关联
  serverRequestIds?: string[];

  // ★ 错误摘要
  errorSummary?: Array<{ message: string; count: number; lastTs: string }>;

  // ★ 运行时诊断
  runtimeDiagnostics?: Record<string, any>;

  // ★ 自动诊断流程 — 每次反馈自带处理 SOP
  diagnosticFlow?: DiagnosticStep[];

  // localStorage config (anonymized)
  config: Record<string, any>;
}

/**
 * 诊断步骤 — 每步有编号/动作/说明
 */
export interface DiagnosticStep {
  step: number;
  action: string;
  detail: string;
  status: 'pending' | 'done' | 'skipped';
}

// ──── 工具函数 ────

/**
 * 安全地读取 zustand store 状态
 */
function captureZustandStores(): Record<string, any> {
  const stores: Record<string, any> = {};
  try {
    const zStores = (window as any).__ZUSTAND_STORES__;
    if (!zStores) return stores;

    // 读取 preferenceStore（精简：只保留 value，去掉 version 噪声）
    if (zStores.preferenceStore) {
      try {
        const prefs = zStores.preferenceStore.getState();
        if (prefs) {
          const flat: Record<string, any> = {};
          const raw = prefs.preferences || prefs;
          for (const [key, val] of Object.entries(raw) as [string, any][]) {
            if (val && typeof val === 'object' && 'value' in val) {
              flat[key] = val.value;
            } else {
              flat[key] = val;
            }
          }
          stores.preferences = flat;

          // ★ 当前选中的店铺 ID（从 preferenceStore 读取）
          try {
            const lastStore = prefs.get?.('last_store', '') || '';
            if (lastStore) stores.currentStoreId = lastStore;
          } catch {}
        }
      } catch {}
    }

    // 读取 dataStore（取概要统计，不传全量订单数据避免太大）
    if (zStores.dataStore) {
      try {
        const ds = zStores.dataStore.getState();
        if (ds) {
          const storeDataMap = ds.storeDataMap || {};
          const summary: Record<string, any> = {};
          for (const [sid, data] of Object.entries(storeDataMap) as [string, any][]) {
            summary[sid] = {
              ordersCount: (data.orders || []).length,
              promotionSummaryCount: (data.promotionSummary || []).length,
              promotionProductsCount: (data.promotionProducts || []).length,
              promotionHourlyCount: (data.promotionHourly || []).length,
              shippingInsuranceCount: (data.shippingInsurance || []).length,
              afterSaleRecordsCount: (data.afterSaleRecords || []).length,
              financialRecordsCount: (data.financialRecords || []).length,
              availableFields: data.availableFields,
            };
          }
          stores.dataStoreSummary = summary;
          stores.uploadRecordsCount = (ds.uploadRecords || []).length;
          stores.storageMode = ds.storageMode;
          stores.syncStatus = ds.syncStatus;

          // ★ 聚合总览：所有店铺的数据合计（即使页面没传 KPIs，反馈报告也有数据概览）
          const totalCounts: Record<string, number> = {
            totalOrders: 0, totalPromotionSummary: 0, totalPromotionProducts: 0,
            totalPromotionHourly: 0, totalShippingInsurance: 0,
            totalAfterSaleRecords: 0, totalFinancialRecords: 0,
          };
          for (const [, data] of Object.entries(storeDataMap) as [string, any][]) {
            totalCounts.totalOrders += (data.orders || []).length;
            totalCounts.totalPromotionSummary += (data.promotionSummary || []).length;
            totalCounts.totalPromotionProducts += (data.promotionProducts || []).length;
            totalCounts.totalPromotionHourly += (data.promotionHourly || []).length;
            totalCounts.totalShippingInsurance += (data.shippingInsurance || []).length;
            totalCounts.totalAfterSaleRecords += (data.afterSaleRecords || []).length;
            totalCounts.totalFinancialRecords += (data.financialRecords || []).length;
          }
          stores.dataCounts = totalCounts;
          stores.storeCount = Object.keys(storeDataMap).length;

          // ★ 当前店铺的数据细项（如果已知 currentStoreId）
          try {
            if (stores.currentStoreId && storeDataMap[stores.currentStoreId]) {
              const cur = storeDataMap[stores.currentStoreId];
              stores.currentStoreData = {
                ordersCount: (cur.orders || []).length,
                promotionSummaryCount: (cur.promotionSummary || []).length,
                promotionProductsCount: (cur.promotionProducts || []).length,
                afterSaleCount: (cur.afterSaleRecords || []).length,
                financialCount: (cur.financialRecords || []).length,
                insuranceCount: (cur.shippingInsurance || []).length,
              };
            }
          } catch {}

          // ★ 上传记录摘要（最近5条的类型/时间）
          if (ds.uploadRecords && ds.uploadRecords.length > 0) {
            stores.recentUploads = ds.uploadRecords
              .slice(-5)
              .map((r: any) => ({ storeId: r.storeId, type: r.fileType, fileName: r.fileName, rows: r.rowCount }));
          }
        }
      } catch {}
    }

    // 注意：不直接把 __ZUSTAND_STORES__ 写入 stores，因为它包含的是函数引用，
    // JSON 序列化后变成 {}，会被误认为"数据没抓到"。实际数据已通过上面的代码分别提取。
  } catch {}
  return stores;
}



/**
 * 捕获 React 组件树信息（从 fiber 遍历）
 */
function captureReactTree(): Record<string, any> {
  try {
    const rootEl = document.getElementById('root');
    if (!rootEl) return {};
    const key = Object.keys(rootEl).find(k => k.startsWith('__reactFiber$'));
    if (!key) return {};
    let fiber = (rootEl as any)[key];
    if (!fiber) return {};
    // 向上找到 root
    while (fiber.return) fiber = fiber.return;
    // 遍历所有子节点的组件名
    const components: string[] = [];
    const visited = new Set<any>();
    const traverse = (node: any, depth: number) => {
      if (!node || depth > 20 || visited.has(node)) return;
      visited.add(node);
      const type = node.elementType || node.type;
      if (typeof type === 'function' || typeof type === 'object') {
        const name = type.displayName || type.name || (typeof type === 'object' ? type.$$typeof?.toString() : undefined);
        if (name && !name.startsWith('_') && !name.includes('Symbol')) {
          components.push(name);
        }
      }
      // 遍历 child 和 sibling
      traverse(node.child, depth + 1);
      traverse(node.sibling, depth);
    };
    traverse(fiber, 0);
    return { components: components.slice(0, 50), count: components.length };
  } catch { return {}; }
}

/**
 * 捕获全部 localStorage 配置（排除敏感字段）
 */
function captureConfig(): Record<string, any> {
  const result: Record<string, any> = {};
  // ★ 跳过敏感/体积过大的 key
  const SKIP_KEYS = [
    'jwt', 'token', 'secret', 'password', 'credential',
    'meoo_ds_',           // 原始订单数据（极大）
    'dianfx_jwt_',        // JWT（已单独处理）
    '__dianfx_errors',    // 已单独处理
    'spec_group_labels_', // 商品规格数据（巨大）
    'dianfx_product_costs_', // 成本数据（敏感，已从 store 获取）
    'dianfx_abnormal_orders_', // 异常订单（敏感）
    'dianfx_cost_history_',    // 成本历史（敏感）
    'dianfx_search_history',   // 搜索历史（隐私）
  ];
  // ★ meoo-data-store 只取概要信息（完整 JSON 可能很大）
  let meooDataStoreSummary: Record<string, any> | null = null;
  try {
    const raw = localStorage.getItem('meoo-data-store');
    if (raw && raw.length < 50000) {
      try {
        const parsed = JSON.parse(raw);
        meooDataStoreSummary = {
          uploadRecordsCount: (parsed.state?.uploadRecords || []).length,
          storageMode: parsed.state?.storageMode || {},
          storeCount: Object.keys(parsed.state?.storeDataMap || {}).length,
          hasConfigs: !!(parsed.state?.productCostsByStore && Object.keys(parsed.state.productCostsByStore).length > 0),
          configKeys: Object.keys(parsed.state || {}).filter(k => k !== 'uploadRecords' && k !== 'storeDataMap'),
        };
      } catch {
        meooDataStoreSummary = { error: 'parse_failed', sizeBytes: raw.length };
      }
    } else if (raw) {
      meooDataStoreSummary = { skipped: true, sizeBytes: raw.length };
    }
  } catch {}
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      // 跳过敏感键
      if (SKIP_KEYS.some(skip => key.includes(skip))) continue;
      try {
        const val = localStorage.getItem(key);
        if (!val) continue;
        // 超大值跳过（>5KB 的原始数据不提交）
        if (val.length > 5000) {
          result[key] = `[${val.length} chars, skipped]`;
          continue;
        }
        try { result[key] = JSON.parse(val); }
        catch {
          result[key] = val.length > 500 ? val.slice(0, 500) + '...' : val;
        }
      } catch {}
    }
  } catch {}
  // ★ 附加 meoo-data-store 概要
  if (meooDataStoreSummary) {
    result['__meoo_data_store_summary'] = meooDataStoreSummary;
  }
  return result;
}

/**
 * 读取 build-meta.json
 */
async function captureBuildMeta(): Promise<Record<string, any>> {
  try {
    const res = await fetch('/build-meta.json?_=' + Date.now(), { cache: 'no-store' });
    if (res.ok) return await res.json();
  } catch {}
  return {};
}

/**
 * 部署诊断 — 校验 buildId 一致性、脚本加载顺序
 */
function captureDeployDiagnostics(serverBuildInfo: Record<string, any>): DeployDiagnostics {
  const serverBuildId = serverBuildInfo.buildId || '';
  const localBuildId = localStorage.getItem('__app_buildId') || '';
  const scripts = document.querySelectorAll('script[src]');
  const scriptLoadOrder: string[] = [];
  scripts.forEach(s => {
    const src = (s as HTMLScriptElement).src || '';
    if (src && !src.includes('data:')) {
      scriptLoadOrder.push(src.split('/').pop() || src);
    }
  });

  // 获取当前 bundle 文件名
  const mainScript = document.querySelector('script[src*="bundle"]');
  const bundleName = mainScript
    ? (mainScript as HTMLScriptElement).src.split('/').pop() || ''
    : '';

  return {
    serverBuildId,
    localBuildId,
    buildMatch: !!(serverBuildId && serverBuildId === localBuildId),
    bundleName,
    scriptLoadOrder,
    buildTime: serverBuildInfo.buildTime || serverBuildInfo.timestamp || '',
  };
}

/**
 * 从 performance 对象捕获网络诊断信息
 */
function captureNetworkDiagnostics(requestIds: string[]): NetworkDiagnostics {
  const result: NetworkDiagnostics = { requestIds };

  try {
    // 尝试获取关键 API 端点的 Timing
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const apiEntries = entries.filter(e =>
      e.name.includes('/api/') && !e.name.includes('.js') && !e.name.includes('.css')
    );
    const apiEntry = apiEntries[0];
    if (apiEntry) {
      result.dnsTime = Math.round(apiEntry.domainLookupEnd - apiEntry.domainLookupStart);
      result.tcpTime = Math.round(apiEntry.connectEnd - apiEntry.connectStart);
      result.tlsTime = apiEntry.secureConnectionStart > 0
        ? Math.round(apiEntry.connectEnd - apiEntry.secureConnectionStart)
        : undefined;
      result.ttfb = Math.round(apiEntry.responseStart - apiEntry.requestStart);
    }

    // 端点状态从 network log 汇总
    const endpointStatus: Record<string, number> = {};
    for (const n of actionRecorder.getNetworks(50)) {
      const nData: any = n;
      const url = nData.url || '';
      const status = nData.status ?? nData.data?.status ?? 0;
      const path = '/' + (url.split('/api/')[1] || '').split('?')[0];
      if (path) endpointStatus[path] = status;
    }
    result.endpointStatus = endpointStatus;
  } catch {}

  return result;
}

/**
 * 捕获错误摘要
 */
function captureErrorSummary(): Array<{ message: string; count: number; lastTs: string; page?: string }> {
  const errors = actionRecorder.getLogs(200).filter(l => l.type === 'error' || l.type === 'react');
  const summary: Record<string, { count: number; lastTs: string; page?: string }> = {};
  // 获取当前页面信息，关联到错误
  let currentPage = '';
  try {
    currentPage = document.querySelector('#app-root')?.getAttribute('data-page') || location.hash || location.pathname;
  } catch {}
  for (const err of errors) {
    const key = err.message.slice(0, 100);
    if (!summary[key]) {
      summary[key] = { count: 0, lastTs: err.ts, page: currentPage || undefined };
    }
    summary[key].count++;
    summary[key].lastTs = err.ts;
  }
  return Object.entries(summary)
    .map(([message, data]) => ({ message, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);
}

/**
 * 捕获运行时诊断信息
 */
function captureRuntimeDiagnostics(): Record<string, any> {
  const result: Record<string, any> = {};
  try {
    // webpack 热更新状态
    result.webpackHot = !!(module as any)?.hot;
    // React 版本
    const reactRoot = document.getElementById('root');
    const fiberKey = reactRoot ? Object.keys(reactRoot).find(k => k.startsWith('__reactFiber$')) : undefined;
    const containerKey = reactRoot ? Object.keys(reactRoot).find(k => k.startsWith('__reactContainer$')) : undefined;
    result.reactVersion = fiberKey || containerKey ? '>=18' : undefined;
    // 当前页面可见性
    result.visibilityState = document.visibilityState;
    // 在线状态
    result.online = navigator.onLine;
    // 页面加载完成
    result.loadComplete = document.readyState === 'complete';
    // 渲染帧率（近似）
    result.frameRate = (window as any).__FRAME_RATE__ || undefined;
  } catch {}
  return result;
}

/**
 * 捕获 GPU/WebGL 信息
 */
function captureGpuInfo(): string | undefined {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as any;
    if (!gl) return undefined;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return undefined;
    const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(ext.UNMASKED_VENDOR_WEBGL);
    return `${vendor} | ${renderer}`;
  } catch { return undefined; }
}

// ──── 诊断流程自动生成 ────

/**
 * 根据当前上下文自动生成诊断处理流程
 *
 * 每次反馈提交时附带此流程，开发者无需额外写 SOP，
 * 直接按报告里的步骤操作即可。
 */
function generateDiagnosticFlow(
  page: string,
  errorSummary: Array<{ message: string; count: number; lastTs: string }>,
  dataCounts: Record<string, number>,
  severity: string
): DiagnosticStep[] {
  const steps: DiagnosticStep[] = [];

  // ── 固定前置步骤（每次都有） ──
  steps.push({ step: 1, action: '确认问题', detail: '阅读 title + description，理解用户要什么', status: 'pending' });
  steps.push({ step: 2, action: '定位页面', detail: `页面: ${page}，路由确认`, status: 'pending' });

  // ── 根据 dataCounts 分析数据状态 ──
  const dataIssues: string[] = [];
  const totalOrders = dataCounts.totalOrders ?? 0;
  const totalPromo = dataCounts.totalPromotionSummary ?? 0;
  const totalHourly = dataCounts.totalPromotionHourly ?? 0;
  const totalAfterSale = dataCounts.totalAfterSaleRecords ?? 0;
  const totalFinancial = dataCounts.totalFinancialRecords ?? 0;
  const totalInsurance = dataCounts.totalShippingInsurance ?? 0;

  if (totalOrders === 0) dataIssues.push('无订单数据');
  if (totalPromo === 0 && page === 'promotion') dataIssues.push('无推广数据');
  if (totalAfterSale === 0) dataIssues.push('无售后数据');
  if (totalFinancial === 0) dataIssues.push('无财务数据');
  if (totalInsurance === 0) dataIssues.push('无运费险数据');

  if (dataIssues.length > 0) {
    steps.push({
      step: 3, action: '检查数据状态',
      detail: `数据概览: 订单${totalOrders} 推广${totalPromo} 分时${totalHourly} 售后${totalAfterSale} 财务${totalFinancial} 运费险${totalInsurance} | 注意: ${dataIssues.join(', ')}`,
      status: 'pending',
    });
  } else {
    steps.push({
      step: 3, action: '检查数据状态',
      detail: `数据完整: 订单${totalOrders} 推广${totalPromo} 分时${totalHourly} 售后${totalAfterSale} 财务${totalFinancial} 运费险${totalInsurance}`,
      status: 'done',
    });
  }

  // ── 根据 severity 严重程度 ──
  if (severity === 'blocker' || severity === 'critical') {
    steps.push({ step: 4, action: '紧急响应', detail: '阻塞级/严重问题，优先处理', status: 'pending' });
  }

  // ── 根据错误摘要自动添加步骤 ──
  const hasJsErrors = errorSummary && errorSummary.length > 0;
  if (hasJsErrors) {
    const jsErrors = errorSummary.filter(e => !e.message.includes('chunk') && !e.message.includes('Loading'));
    const chunkErrors = errorSummary.filter(e => e.message.includes('chunk') || e.message.includes('Loading'));
    if (chunkErrors.length > 0) {
      steps.push({
        step: steps.length + 1, action: '检查 Chunk 加载失败',
        detail: `${chunkErrors.length} 个 chunk 加载失败，可能旧部署文件被清理`,
        status: 'pending',
      });
    }
    if (jsErrors.length > 0) {
      steps.push({
        step: steps.length + 1, action: '修复 JS 错误',
        detail: `${jsErrors.length} 个 JS 异常: ${jsErrors.slice(0, 3).map(e => e.message.slice(0, 50)).join(' | ')}`,
        status: 'pending',
      });
    }
  }

  // ── 根据页面定制步骤 ──
  const pageSpecificSteps: Record<string, DiagnosticStep[]> = {
    dashboard: [
      { step: 0, action: '检查 KPI 显示', detail: '确认无数据时是否统一显示 -- 而非有的 0 有的 --', status: 'pending' },
      { step: 0, action: '检查趋势图', detail: 'dailyKpiData 是否有数据渲染', status: 'pending' },
    ],
    promotion: [
      { step: 0, action: '检查分小时图', detail: 'promotionHourly 聚合 & 折线图渲染', status: 'pending' },
      { step: 0, action: '检查商品表格', detail: 'tops 列表 & 点击单商品趋势图', status: 'pending' },
    ],
    product: [
      { step: 0, action: '检查商品级 KPI', detail: 'productCosts 成本配置是否生效', status: 'pending' },
    ],
    upload: [
      { step: 0, action: '检查上传解析', detail: '文件分类 / 字段匹配 / 行数正确', status: 'pending' },
    ],
    'after-sale': [
      { step: 0, action: '检查售后统计', detail: '退款金额/退款率/售后率计算', status: 'pending' },
    ],
  };

  const extra = pageSpecificSteps[page];
  if (extra) {
    for (const s of extra) {
      steps.push({ ...s, step: steps.length + 1 });
    }
  }

  // ── 最终验证步骤（固定尾步） ──
  steps.push({ step: steps.length + 1, action: '通读完整代码', detail: '修改前 Read 整个文件，禁止片段式修改', status: 'pending' });
  steps.push({ step: steps.length + 1, action: '制定修改计划', detail: '写清楚改什么、为什么改、风险点', status: 'pending' });
  steps.push({ step: steps.length + 1, action: '构建 & 部署', detail: 'npm run build → tar → scp → 解压 → nginx reload', status: 'pending' });
  steps.push({ step: steps.length + 1, action: '验证部署', detail: 'curl 200 + 刷新页面确认不空白 + 功能正常', status: 'pending' });

  return steps;
}

// ──── 主入口 ────

/**
 * Build a full context snapshot for the feedback report.
 */
export async function buildFullSnapshot(
  options: {
    elementInfos?: ElSnapshot[];
    title?: string;
    description?: string;
    severity?: string;
  } = {}
): Promise<FullContextSnapshot> {
  const recorderCtx = actionRecorder.getAllContext();

  // ── Build info（并行请求） ──
  const buildInfo = await captureBuildMeta();

  // ── 部署诊断 ──
  const deployDiagnostics = captureDeployDiagnostics(buildInfo);

  // ── 请求关联 ID ──
  const serverRequestIds = recorderCtx.networks
    .filter((n: any) => n.requestId)
    .map((n: any) => n.requestId);

  // ── 网络诊断 ──
  const networkDiagnostics = captureNetworkDiagnostics(serverRequestIds);

  // ── 应用状态 ──
  const appState: Record<string, any> = {
    currentRoute: location.hash || location.pathname,
    darkMode: document.documentElement.getAttribute('data-theme') === 'dark',
    ...captureZustandStores(),
  };

  // ── GPU ──
  const gpu = captureGpuInfo();

  // ── 字体数量 ──
  let fontCount: number | undefined;
  try {
    fontCount = (document.fonts as any).size;
  } catch {}

  // ── 路由历史 ──
  const routeHistory: string[] = recorderCtx.actions
    .filter((a: any) => a.category === 'route')
    .map((a: any) => a.detail || a.label);

  // ── 错误摘要 ──
  const errorSummary = captureErrorSummary();

  // ── 运行时诊断 ──
  const runtimeDiagnostics = captureRuntimeDiagnostics();

  // ── React 组件树 ──
  try {
    const reactTree = captureReactTree();
    appState.reactComponents = reactTree.components;
    appState.reactComponentCount = reactTree.count;
  } catch {}

  // ── Device ──
  const device: DeviceSnapshot = {
    userAgent: navigator.userAgent,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    language: navigator.language,
    theme: document.documentElement.getAttribute('data-theme') || 'light',
    timestamp: new Date().toISOString(),
    url: location.href,
    referrer: document.referrer,
    connection: captureConnection(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    platform: (navigator as any).platform || '',
    gpu,
    fontCount,
  };

  // Performance memory
  try {
    const mem = (performance as any).memory;
    if (mem) {
      device.memory = `${Math.round(mem.usedJSHeapSize / 1048576)}MB / ${Math.round(mem.totalJSHeapSize / 1048576)}MB`;
    }
  } catch {}

  // ── ★ v4: TimelineStore 全量事件（最近 60 秒） ──
  const recent60s = timelineStore.getRecentEvents(60);

  // ── ★ v4: CodeTracer 数据 ──
  const codeEvents = timelineStore.getEventsByType('code', 100);
  const renderEvents = timelineStore.getEventsByType('render', 50);
  const componentRenderCounts = codeTracer.getComponentRenderCounts();

  // ── ★ v4: session 统计 ──
  const timelineStats = timelineStore.getStats();

  // ── ★ v4: 用户身份 ──
  let userId = '', username = '';
  try {
    const raw = localStorage.getItem('dianfx_jwt_tokens');
    if (raw) {
      const tokens = JSON.parse(raw);
      if (tokens.accessToken) {
        const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
        userId = payload.userId || '';
        username = payload.username || '';
      }
    }
  } catch {}

  // ── ★ 自动诊断流程 ──
  const page = (location.hash || location.pathname).replace(/^#\//, '').split('/')[0] || 'unknown';
  const dataCounts: Record<string, number> = (appState as any).dataCounts || {};
  const severity = options.severity || 'minor';
  const diagnosticFlow = generateDiagnosticFlow(page, errorSummary, dataCounts, severity);

  const snapshot: FullContextSnapshot = {
    title: options.title,
    description: options.description,
    severity: options.severity,
    elementInfos: options.elementInfos,
    logs: recorderCtx.logs,
    actions: recorderCtx.actions,
    networks: recorderCtx.networks,
    resources: recorderCtx.resources,
    // ★ v4 新增
    timeline: recent60s,
    timelineStats,
    codeTraces: [...codeEvents, ...renderEvents].slice(-150),
    componentRenderCounts,
    userId,
    username,
    userSessionId: timelineStore.getSessionId(),
    userPageLoadId: timelineStore.getPageLoadId(),
    appState,
    device,
    buildInfo,
    deployDiagnostics,
    networkDiagnostics,
    serverRequestIds,
    routeHistory,
    errorSummary,
    runtimeDiagnostics,
    // ★ 自动诊断流程 — 每次反馈附带处理 SOP
    diagnosticFlow,
    config: captureConfig(),
  };

  // ★ 修复：等截图完成再返回（避免竞态）
  try {
    const dataUrl = await captureScreenshot();
    if (dataUrl) snapshot.screenshot = dataUrl;
  } catch {}

  return snapshot;
}

/**
 * Capture current viewport as JPEG base64.
 */
export async function captureScreenshot(): Promise<string | null> {
  try {
    const canvas = await html2canvas(document.documentElement, {
      backgroundColor: '#ffffff',
      scale: 0.8,
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
    });
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return null;
  }
}

function captureConnection(): string {
  try {
    const conn = (navigator as any).connection;
    if (conn) return conn.effectiveType || '';
  } catch {}
  return '';
}

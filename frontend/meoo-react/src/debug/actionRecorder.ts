/**
 * ActionRecorder — 全链路行为录轨器 v4
 *
 * 基于 TimelineStore 持久化存储，刷新不丢数据。
 * 持续记录七大事件类，支持 30~60 秒回溯：
 *   1. console 全部方法
 *   2. fetch 全链路（含请求体/响应体/响应头）
 *   3. 用户交互（点击、路由、input、scroll）
 *   4. 资源加载失败
 *   5. React 错误边界
 *   6. 性能/内存快照（自动每 10s）
 *   7. 代码执行追踪（CodeTracer）
 *
 * 设计参考：RRWeb + Sentry Replay + LogRocket
 */

import { timelineStore } from './timelineStore';
import { codeTracer } from './codeTracer';

/** ★ 兼容旧接口导出类型 */
export interface LogEntry {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'trace' | 'network' | 'action' | 'resource' | 'react';
  message: string;
  args?: any[];
  stack?: string;
  ts: string;
  t: number;
  requestId?: string;
}

export interface ActionEntry {
  id: number;
  category: 'click' | 'route' | 'input' | 'scroll' | 'api' | 'store' | 'custom';
  label: string;
  detail?: string;
  elSnapshot?: string;
  position?: [number, number];
  ts: string;
  t: number;
}

export interface NetworkEntry {
  id: number;
  method: string;
  url: string;
  status: number;
  duration: number;
  requestBody?: string;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  requestId?: string;
  ts: string;
  t: number;
  error?: string;
}

export interface ResourceEntry {
  id: number;
  type: 'script' | 'style' | 'image' | 'font' | 'xhr' | 'other';
  url: string;
  failed: boolean;
  status?: number;
  duration?: number;
  ts: string;
  t: number;
}

class ActionRecorder {
  private origConsole: Record<string, any> = {};
  private origFetch: typeof window.fetch | null = null;
  private initialized = false;
  private subscribers = new Set<() => void>();

  /** 从响应头提取 requestId */
  private extractRequestId(res: Response): string | undefined {
    return res.headers.get('x-request-id') || res.headers.get('request-id') || undefined;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;

    // ── 0. 启动 CodeTracer ──
    codeTracer.enable();

    // ── 1. 控制台全方法拦截 ──
    const methods = ['log', 'warn', 'error', 'info', 'debug', 'trace'] as const;
    for (const m of methods) {
      this.origConsole[m] = console[m].bind(console);
      console[m] = (...args: any[]) => {
        const msg = args.map(x => this.safeStr(x)).join(' ');
        // ★ 同步写入 TimelineStore（持久化）
        timelineStore.addLogEvent(m, msg);
        // 旧方式也保留以便兼容（但不受环形缓冲区限制）
        this.origConsole[m](...args);
      };
    }

    // ── 2. window 级错误 ──
    window.onerror = (msg, source, line, col, err) => {
      const full = `${msg} (${source}:${line}:${col})`;
      timelineStore.add('error', {
        message: full,
        category: 'window_error',
        data: { msg, source, line, col },
        stack: err?.stack,
      });
      return false;
    };
    window.onunhandledrejection = (e) => {
      const msg = e.reason?.message || String(e.reason);
      timelineStore.add('error', {
        message: `未捕获Promise: ${msg}`,
        category: 'unhandled_rejection',
        stack: e.reason?.stack,
      });
    };

    // ── 3. fetch 全链路拦截 ──
    this.origFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = init?.method || 'GET';
      const bodyStr = init?.body
        ? (typeof init.body === 'string' ? init.body.slice(0, 500) : '[非文本体]')
        : undefined;
      const start = Date.now();
      return this.origFetch!(input, init)
        .then(async res => {
          const duration = Date.now() - start;
          const requestId = this.extractRequestId(res);
          let responseBody: string | undefined;
          try {
            const cloned = res.clone();
            const text = await cloned.text();
            responseBody = text.length > 2000
              ? text.slice(0, 2000) + `\n... [截断, 原长${text.length}字符]`
              : text;
          } catch {}

          const headers: Record<string, string> = {};
          (res.headers as any).forEach?.((v: string, k: string) => {
            if (['content-type', 'x-request-id', 'x-ratelimit-remaining', 'cf-ray'].includes(k)) {
              headers[k] = v;
            }
          });

          // ★ 跳过静态资源到 TimelineStore
          if (!url.includes('.js') && !url.includes('.css') && !url.includes('favicon')) {
            timelineStore.addNetworkEvent(method, url, res.status, duration, {
              requestBody: bodyStr,
              responseBody,
              responseHeaders: headers,
              requestId,
            });
          }
          return res;
        })
        .catch(err => {
          timelineStore.addNetworkEvent(method, url, 0, Date.now() - start, { error: err.message });
          throw err;
        });
    };

    // ── 4. 路由变化 ──
    const origPushState = history.pushState.bind(history);
    history.pushState = (...args) => {
      const path = args[2] ? String(args[2]) : '';
      timelineStore.add('navigation', {
        message: `导航至: ${path}`,
        category: 'pushState',
        data: { path, from: location.href },
      });
      origPushState(...args);
    };
    const origReplaceState = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      const path = args[2] ? String(args[2]) : '';
      timelineStore.add('navigation', {
        message: `替换为: ${path}`,
        category: 'replaceState',
        data: { path },
      });
      origReplaceState(...args);
    };
    window.addEventListener('popstate', () => {
      timelineStore.add('navigation', {
        message: `后退/前进: ${location.href}`,
        category: 'popstate',
      });
    });

    // ── 5. 点击拦截 ──
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase() || '';
      if (['button', 'a', 'input', 'select', 'textarea', 'label'].includes(tag) ||
          target.getAttribute('role') === 'button' ||
          target.closest('[data-track]')) {
        const text = target.textContent?.trim().slice(0, 40) || target.getAttribute('aria-label') || tag;
        const elSnap = this.getElementSnapshot(target);
        timelineStore.addActionEvent('click', text, this.getClickSelector(target), elSnap);
      }
    }, true);

    // ── 6. 资源加载失败监听 ──
    window.addEventListener('error', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName?.toLowerCase() || '';
      if (tag === 'script' || tag === 'link' || tag === 'img') {
        const src = (target as HTMLScriptElement | HTMLImageElement).src
          || (target as HTMLLinkElement).href || '';
        if (src) {
          const type = tag === 'script' ? 'script' : tag === 'link' ? 'style' : 'image';
          timelineStore.addResourceEvent(type, src, true);
        }
      }
    }, true);

    // ── 7. 输入变化拦截（延迟加载，避免影响表单初始渲染） ──
    setTimeout(() => {
      document.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement | null;
        if (!target || !target.tagName) return;
        const tag = target.tagName.toLowerCase();
        if (tag === 'input' || tag === 'select' || tag === 'textarea') {
          const name = target.name || target.id || tag;
          const val = (target as any).value || '';
          if (val.length < 200) {
            timelineStore.addInputEvent(name, val);
          }
        }
      }, true);
    }, 3000);

    // ── 8. 初始日志 ──
    timelineStore.addLogEvent('info', `[app] 启动: ${location.href}`);
    this.notify();
  }

  /** 捕获元素的简要快照 */
  private getElementSnapshot(el: Element): string {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.className && typeof el.className === 'string'
      ? '.' + el.className.split(/\s+/).filter(c => c.length > 1).slice(0, 2).join('.')
      : '';
    return `${tag}${id}${cls}`;
  }

  private getClickSelector(el: HTMLElement): string {
    const parts: string[] = [];
    let cur: HTMLElement | null = el;
    let depth = 0;
    while (cur && cur !== document.body && depth < 5) {
      let seg = cur.tagName.toLowerCase();
      if (cur.id) { seg = '#' + cur.id; parts.unshift(seg); break; }
      const cls = cur.className && typeof cur.className === 'string'
        ? cur.className.split(/\s+/).filter(c => !c.startsWith('_') && c.length > 1).slice(0, 2).join('.')
        : '';
      if (cls) seg += '.' + cls;
      parts.unshift(seg);
      cur = cur.parentElement;
      depth++;
    }
    return parts.join(' > ');
  }

  /** ★ logAction: 兼容旧接口 */
  logAction(category: string, action: string, detail?: any) {
    const msg = detail !== undefined
      ? `[${category}] ${action}: ${typeof detail === 'object' ? this.safeStr(detail) : detail}`
      : `[${category}] ${action}`;
    timelineStore.addLogEvent('info', msg);
    timelineStore.addActionEvent('store', action, msg);
  }

  /** ★ recordResource: 兼容旧接口 */
  recordResource(type: string, url: string, failed: boolean, status?: number, duration?: number) {
    timelineStore.addResourceEvent(type, url, failed, status, duration);
  }

  /** ★ recordReactError: 兼容旧接口 */
  recordReactError(error: Error, componentStack?: string) {
    timelineStore.add('error', {
      message: `[React ErrorBoundary] ${error.message}`,
      category: 'react_error',
      stack: error.stack + (componentStack ? '\n' + componentStack : ''),
    });
  }

  // ─── 兼容旧接口获取数据（委托给 timelineStore） ───

  getLogs(limit = 150) { return timelineStore.getLogs(limit); }
  getActions(limit = 80) { return timelineStore.getUserActions(limit); }
  getNetworks(limit = 50) { return timelineStore.getNetworkRequests(limit); }
  getResources(limit = 30) { return timelineStore.getResources(limit); }

  getAllContext() {
    return {
      logs: this.getLogs(200),
      actions: this.getActions(80),
      networks: this.getNetworks(50),
      resources: this.getResources(30),
    };
  }

  /** ★ 获取完整的时序事件流（兼容旧接口） */
  getTimeline(limit = 100) {
    return timelineStore.getTimeline(limit);
  }

  subscribe(fn: () => void) { this.subscribers.add(fn); return () => this.subscribers.delete(fn); }
  notify() { this.subscribers.forEach(fn => fn()); }

  reset() {
    timelineStore.reset();
    this.notify();
  }

  safeStr(o: any): string {
    try { const s = new WeakSet(); return JSON.stringify(o, (k, v) => { if (typeof v === 'object' && v !== null) { if (s.has(v)) return '[Circular]'; s.add(v); } return v; }, 2); }
    catch { return String(o); }
  }
}

export const actionRecorder = new ActionRecorder();

export function logAction(category: string, action: string, detail?: any) {
  actionRecorder.logAction(category, action, detail);
}

export function getRecentLogs(msOrCount: number = 30000, asCount: boolean = false) {
  const logs = timelineStore.getLogs(200);
  if (asCount) return logs.slice(-msOrCount);
  const cutoff = Date.now() - msOrCount;
  return logs.filter((l: any) => (l.t || 0) >= cutoff);
}

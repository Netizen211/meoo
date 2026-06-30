/**
 * TimelineStore v1 — 持久化时间线事件存储
 *
 * 超越传统环形缓冲区，提供：
 *   - 10,000+ 事件容量（覆盖 30~60 秒用户操作）
 *   - localStorage 批量刷盘，页面刷新不丢数据
 *   - 跨会话 sessionId 关联，同一用户连续跟踪
 *   - 事件按类型/分类/时间范围检索
 *   - 自动裁剪旧事件避免撑爆 localStorage（~5MB 上限）
 *
 * 设计参考：RRWeb + Sentry Replay + LogRocket 全量录制思路
 */

const STORAGE_KEY = '__dianfx_timeline_v2';
const SESSION_KEY = '__dianfx_session_v2';
const MAX_EVENTS = 10000;
const TRIM_TARGET = 7000;
const FLUSH_INTERVAL = 2000; // ms
const STORAGE_MAX_BYTES = 4_000_000; // 4MB 软上限

export interface TimelineEvent {
  id: number;
  sessionId: string;
  ts: number;           // Date.now()
  type: 'log' | 'action' | 'network' | 'resource' | 'error' | 'state' | 'code' | 'navigation' | 'memory' | 'render' | 'custom' | 'input';
  category?: string;
  message: string;
  data?: any;
  stack?: string;
  url?: string;
  /** 用于时间线分组展示 */
  groupKey?: string;
}

class TimelineStore {
  private events: TimelineEvent[] = [];
  private eventId = 0;
  private sessionId: string;
  private sessionStart: number;
  private pageLoadId: string;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private dirty = false;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.sessionStart = this.getOrCreateSessionStart();
    this.pageLoadId = 'pl-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
    this.restore();
    this.startAutoFlush();

    // 页面关闭前强制刷盘
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush());
      // 记录页面加载事件
      this.add('navigation', {
        message: `页面加载: ${location.href}`,
        category: 'page_load',
        data: { url: location.href, referrer: document.referrer, pageLoadId: this.pageLoadId },
      });
    }
  }

  // ─── 公开访问器 ───

  getSessionId() { return this.sessionId; }
  getSessionStart() { return this.sessionStart; }
  getPageLoadId() { return this.pageLoadId; }
  getEventCount() { return this.events.length; }

  /**
   * 获取全部事件（用于构建快照/提交报告）
   */
  getAllEvents(): TimelineEvent[] {
    return [...this.events];
  }

  /**
   * 按时间范围筛选
   */
  getEventsInRange(fromTs: number, toTs: number): TimelineEvent[] {
    return this.events.filter(e => e.ts >= fromTs && e.ts <= toTs);
  }

  /**
   * 按类型筛选
   */
  getEventsByType(type: TimelineEvent['type'], limit = 200): TimelineEvent[] {
    return this.events.filter(e => e.type === type).slice(-limit);
  }

  /**
   * 获取最近 N 秒的事件
   */
  getRecentEvents(seconds = 30): TimelineEvent[] {
    const cutoff = Date.now() - seconds * 1000;
    return this.events.filter(e => e.ts >= cutoff);
  }

  /**
   * 获取事件统计
   */
  getEventCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.events) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }

  /**
   * 获取完整统计信息（UI 展示用）
   */
  getStats() {
    const counts = this.getEventCounts();
    return {
      total: this.events.length,
      sessionId: this.sessionId,
      sessionDuration: Date.now() - this.sessionStart,
      pageLoadId: this.pageLoadId,
      counts,
      storageBytes: this.estimateStorageBytes(),
    };
  }

  // ─── 事件添加 ───

  add(type: TimelineEvent['type'], fields: {
    message: string;
    category?: string;
    data?: any;
    stack?: string;
    url?: string;
    groupKey?: string;
  }) {
    const event: TimelineEvent = {
      id: ++this.eventId,
      sessionId: this.sessionId,
      ts: Date.now(),
      type,
      message: String(fields.message).slice(0, 2000),
      category: fields.category,
      data: fields.data,
      stack: fields.stack?.slice(0, 2000),
      url: fields.url,
      groupKey: fields.groupKey,
    };
    this.events.push(event);

    // 超过上限时裁剪
    if (this.events.length > MAX_EVENTS * 1.2) {
      this.events = this.events.slice(-TRIM_TARGET);
    }

    this.dirty = true;
  }

  /**
   * 便捷方法：添加一条带堆栈的代码执行记录
   */
  addCodeTrace(message: string, data?: any) {
    const stack = new Error().stack?.split('\n').slice(2, 8).join('\n') || '';
    this.add('code', { message, data, stack, category: 'code_trace' });
  }

  /**
   * 便捷方法：记录状态快照
   */
  addStateSnapshot(label: string, stateSlice: Record<string, any>) {
    this.add('state', {
      message: `状态快照: ${label}`,
      category: 'state_snapshot',
      data: stateSlice,
    });
  }

  /**
   * 记录内存/性能快照
   */
  addPerformanceSnapshot() {
    const mem = (performance as any).memory;
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    this.add('memory', {
      message: '性能快照',
      category: 'performance',
      data: {
        memory: mem ? { used: mem.usedJSHeapSize, total: mem.totalJSHeapSize, limit: mem.jsHeapSizeLimit } : undefined,
        domNodes: document.querySelectorAll('*').length,
        loadTime: nav ? nav.loadEventEnd - nav.startTime : undefined,
        fps: (window as any).__FRAME_RATE__ || undefined,
      },
    });
  }

  // ─── 内部持久化 ───

  private getOrCreateSessionId(): string {
    try {
      let sid = localStorage.getItem(SESSION_KEY);
      if (!sid) {
        sid = 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 12);
        localStorage.setItem(SESSION_KEY, sid);
      }
      return sid;
    } catch { return 'sid-fallback'; }
  }

  private getOrCreateSessionStart(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sessionId === this.sessionId && parsed.sessionStart) {
          return parsed.sessionStart;
        }
      }
    } catch {}
    return Date.now();
  }

  private restore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // 只有同一个 sessionId 的数据才恢复（避免不同登录态混用）
      if (parsed.sessionId === this.sessionId && Array.isArray(parsed.events)) {
        this.events = parsed.events;
        this.eventId = this.events.length > 0
          ? this.events[this.events.length - 1].id
          : 0;
      } else {
        // session 变化（如重新登录），保留旧 session 数据但不恢复事件列表
        // 将旧 session 存档以便后续追溯
        try {
          const archiveKey = STORAGE_KEY + '_archive_' + parsed.sessionId?.slice(0, 20);
          localStorage.setItem(archiveKey, raw);
        } catch {}
        this.events = [];
      }
    } catch {
      this.events = [];
    }
  }

  private flush() {
    if (!this.dirty || this.events.length === 0) return;
    try {
      const payload = JSON.stringify({
        sessionId: this.sessionId,
        sessionStart: this.sessionStart,
        events: this.events.slice(-MAX_EVENTS),
      });
      // 检查大小，超限时裁剪
      if (payload.length > STORAGE_MAX_BYTES) {
        // 裁剪 40% 的旧事件
        const keep = Math.floor(MAX_EVENTS * 0.6);
        this.events = this.events.slice(-keep);
        const retry = JSON.stringify({
          sessionId: this.sessionId,
          sessionStart: this.sessionStart,
          events: this.events,
        });
        localStorage.setItem(STORAGE_KEY, retry);
      } else {
        localStorage.setItem(STORAGE_KEY, payload);
      }
      this.dirty = false;
    } catch (e) {
      // 写入失败（可能超出配额），暴力裁剪一半
      this.events = this.events.slice(-Math.floor(MAX_EVENTS * 0.5));
      this.dirty = true; // 下次再试
    }
  }

  private startAutoFlush() {
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL);
  }

  private estimateStorageBytes(): number {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? raw.length : 0;
    } catch { return 0; }
  }

  /**
   * 清除所有数据（重置 session）
   */
  reset() {
    this.events = [];
    this.eventId = 0;
    this.dirty = true;
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    this.sessionId = 'sid-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 12);
    this.sessionStart = Date.now();
    localStorage.setItem(SESSION_KEY, this.sessionId);
    this.flush();
  }

  /**
   * 添加一个网络请求事件（由 actionRecorder 调用）
   */
  addNetworkEvent(method: string, url: string, status: number, duration: number, opts?: {
    requestBody?: string;
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    requestId?: string;
    error?: string;
  }) {
    this.add('network', {
      message: `${method} ${url.split('?')[0]}`,
      category: 'api',
      data: {
        method, url, status, duration,
        requestBody: opts?.requestBody,
        responseBody: opts?.responseBody,
        responseHeaders: opts?.responseHeaders,
        requestId: opts?.requestId,
        error: opts?.error,
      },
      url: url.split('?')[0],
      groupKey: opts?.error ? 'error' : status >= 400 ? 'warning' : 'success',
    });
  }

  /**
   * 添加一个 console 日志事件（由 actionRecorder 调用）
   */
  addLogEvent(type: string, message: string, stack?: string) {
    const eventType: TimelineEvent['type'] =
      type === 'error' ? 'error' :
      type === 'warn' ? 'log' : 'log';
    this.add(eventType, { message, stack, category: `console:${type}` });
  }

  /**
   * 添加一个用户操作事件（由 actionRecorder 调用）
   */
  addActionEvent(category: string, label: string, detail?: string, elSnapshot?: string) {
    this.add('action', {
      message: label,
      category,
      data: { detail, elSnapshot },
    });
  }

  /**
   * 添加一个资源加载事件
   */
  addResourceEvent(type: string, url: string, failed: boolean, status?: number, duration?: number) {
    this.add('resource', {
      message: `${failed ? '❌' : '✓'} ${url.split('/').pop() || url}`,
      category: type,
      data: { type, url, failed, status, duration },
      url,
      groupKey: failed ? 'error' : 'success',
    });
  }

  /**
   * 添加一个输入事件
   */
  addInputEvent(target: string, value: string) {
    this.add('input', {
      message: `输入: ${target}`,
      category: 'input',
      data: { target, value: value.slice(0, 100) },
    });
  }

  /**
   * 获取 API 请求列表（用于报告）
   */
  getNetworkRequests(limit = 80) {
    return this.getEventsByType('network', limit);
  }

  /**
   * 获取用户操作列表（用于报告）
   */
  getUserActions(limit = 80) {
    return this.getEventsByType('action', limit);
  }

  /**
   * 获取带时间线的完整上下文（用于 DebugOverlay 展示）
   */
  getTimeline(limit = 200): TimelineEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * 获取所有日志（兼容旧接口）
   */
  getLogs(limit = 200) {
    return this.events.filter(e =>
      e.type === 'log' || e.type === 'error'
    ).slice(-limit).map(e => ({
      id: e.id,
      type: e.type as any,
      message: e.message,
      stack: e.stack,
      ts: new Date(e.ts).toLocaleTimeString(),
      t: e.ts,
    }));
  }

  /**
   * 获取所有资源事件
   */
  getResources(limit = 50) {
    return this.getEventsByType('resource', limit);
  }
}

/** 全局单例 */
export const timelineStore = new TimelineStore();

export default timelineStore;

/**
 * 前端行为埋点追踪器 (Tracker)
 *
 * 使用方法:
 *   import { trackEvent, trackPageView } from '../services/tracker';
 *
 *   // 自动追踪 (在 App.tsx 中监听路由变化)
 *   trackPageView('/dashboard');
 *
 *   // 手动追踪
 *   trackEvent('module_click', { module_name: 'data-overview' });
 *   trackEvent('button_click', { button_name: 'export-csv' });
 *
 * 采集策略:
 *   - 每 10 秒或积攒 10 条事件后批量上报
 *   - 上报失败自动重试 3 次，指数退避
 *   - 失败事件存入 localStorage，页面恢复后继续上报
 */

// 事件类型枚举
export const EventType = {
  PAGE_VIEW: 'page_view',
  MODULE_CLICK: 'module_click',
  BUTTON_CLICK: 'button_click',
  UPLOAD_START: 'upload_start',
  UPLOAD_SUCCESS: 'upload_success',
  UPLOAD_FAIL: 'upload_fail',
  PAYWALL_VIEW: 'paywall_view',
  UPGRADE_CLICK: 'upgrade_click',
  RECHARGE_SUBMIT: 'recharge_submit',
  AI_CALL_START: 'ai_call_start',
  AI_CALL_SUCCESS: 'ai_call_success',
  AI_CALL_FAIL: 'ai_call_fail',
  EXPORT_CLICK: 'export_click',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAIL: 'login_fail',
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

export interface TrackEvent {
  event_type: EventTypeValue;
  event_category?: string;
  event_label?: string;
  event_value?: string;
  page_url?: string;
  store_id?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

interface PendingEvent extends TrackEvent {
  _t: number; // timestamp
  _retries?: number;
}

const BATCH_INTERVAL_MS = 10000;
const BATCH_MAX_SIZE = 10;
const MAX_RETRIES = 3;
const STORAGE_KEY = 'dianfx_pending_events';
const API_ENDPOINT = '/api/v1/admin/events/batch';

let batch: PendingEvent[] = [];
let timer: ReturnType<typeof setInterval> | null = null;
let pageLoadTime = Date.now();
let currentPageUrl = '';

// Load pending events from localStorage on init
function loadFromStorage(): void {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as PendingEvent[];
      batch = batch.concat(parsed);
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

function saveToStorage(): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(batch));
  } catch {
    // storage full or unavailable
  }
}

function getUserId(): string | null {
  try {
    const stored = localStorage.getItem('dianfx_user');
    if (stored) {
      const user = JSON.parse(stored);
      return user?.id || user?.username || null;
    }
  } catch {
    // ignore
  }
  return null;
}

function getAuthToken(): string | null {
  try {
    return localStorage.getItem('dianfx_token') || sessionStorage.getItem('dianfx_token');
  } catch {
    return null;
  }
}

async function sendBatch(events: PendingEvent[]): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;

  try {
    const resp = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ events: events.map(e => ({
        event_type: e.event_type,
        event_category: e.event_category,
        event_label: e.event_label,
        event_value: e.event_value,
        page_url: e.page_url,
        store_id: e.store_id,
        duration_ms: e.duration_ms,
        metadata: e.metadata,
      })) }),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

async function flush(): Promise<void> {
  if (batch.length === 0) return;

  const toSend = batch.splice(0, BATCH_MAX_SIZE);
  const success = await sendBatch(toSend);

  if (!success) {
    // Retry with backoff
    const failed = toSend.filter(e => (e._retries || 0) < MAX_RETRIES);
    const giveUp = toSend.filter(e => (e._retries || 0) >= MAX_RETRIES);

    if (failed.length > 0) {
      failed.forEach(e => { e._retries = (e._retries || 0) + 1; });
      batch = failed.concat(batch);

      // If batch is too large, save to storage
      if (batch.length > 100) {
        saveToStorage();
      }
    }

    // Give up on max retries exceeded events
    if (giveUp.length > 0 && process.env.NODE_ENV === 'development') {
      console.warn('[tracker] Dropped events after max retries:', giveUp.length);
    }
  }
}

function startTimer(): void {
  if (timer) return;
  timer = setInterval(flush, BATCH_INTERVAL_MS);
}

/**
 * Track a user event
 */
export function trackEvent(
  eventType: EventTypeValue,
  data?: Partial<Omit<TrackEvent, 'event_type'>>,
): void {
  const event: PendingEvent = {
    event_type: eventType,
    event_category: data?.event_category || '',
    event_label: data?.event_label || '',
    event_value: data?.event_value || '',
    page_url: data?.page_url || currentPageUrl,
    store_id: data?.store_id || '',
    duration_ms: data?.duration_ms || 0,
    metadata: data?.metadata || {},
    _t: Date.now(),
  };

  batch.push(event);

  // Start timer on first event
  startTimer();

  // Flush immediately if batch is large enough
  if (batch.length >= BATCH_MAX_SIZE) {
    flush();
  }
}

/**
 * Track a page view (call on route change)
 */
export function trackPageView(pageUrl: string): void {
  if (currentPageUrl && currentPageUrl !== pageUrl) {
    // Record time spent on previous page
    const duration = Date.now() - pageLoadTime;
    // Re-record previous page with duration
    const prevEvent = batch.find(
      e => e.event_type === 'page_view' && e.page_url === currentPageUrl && !e.duration_ms,
    );
    if (prevEvent) {
      prevEvent.duration_ms = duration;
    }
  }

  currentPageUrl = pageUrl;
  pageLoadTime = Date.now();

  trackEvent(EventType.PAGE_VIEW, { page_url: pageUrl });
}

/**
 * Force flush pending events immediately
 */
export function flushEvents(): Promise<void> {
  return flush();
}

/**
 * Initialize tracker (load stored events, start timer)
 */
export function initTracker(): void {
  loadFromStorage();
  startTimer();

  // Flush on page unload (sendBeacon)
  window.addEventListener('beforeunload', () => {
    if (batch.length > 0) {
      try {
        const data = JSON.stringify({ events: batch });
        navigator.sendBeacon(API_ENDPOINT, data);
      } catch {
        // sendBeacon failed, save to storage
        saveToStorage();
      }
    }
  });

  // Flush periodically even when page is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && batch.length > 0) {
      flush();
    }
  });
}

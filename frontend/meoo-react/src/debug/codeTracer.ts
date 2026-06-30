/**
 * CodeTracer v1 — 代码执行追踪器
 *
 * 追踪三类代码执行信息：
 *   1. 模块/Chunk 加载 — webpack 异步 chunk 加载成功/失败
 *   2. React 渲染追踪 — 通过劫持 React.createElement 记录组件渲染
 *   3. 函数调用栈 — 在关键操作点自动捕捉调用栈
 *   4. 定时器/MutationObserver — 记录 DOM 变化和异步调度
 *
 * 设计参考：Rekit Studio + React DevTools 调用栈捕获
 */

import { timelineStore } from './timelineStore';

class CodeTracer {
  private enabled = false;
  private originalCreateElement: any = null;
  private renderCount = 0;
  private componentRenderCount: Record<string, number> = {};
  private observer: MutationObserver | null = null;
  private lastFrameTime = 0;
  private frameCount = 0;
  private fpsInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * 启动所有追踪
   */
  enable() {
    if (this.enabled) return;
    this.enabled = true;

    // 1. 追踪 React 渲染（通过劫持 createElement）
    this.trackReactRenders();

    // 2. 追踪 DOM 变化
    this.trackDOMChanges();

    // 3. 记录初始模块加载状态
    this.snapshotModules();

    // 4. 启动 FPS 监控
    this.startFPSMonitor();

    // 5. 拦截 webpack chunk 加载（如果存在）
    this.trackWebpackChunks();

    // 6. 每 10 秒拍一次性能快照
    setInterval(() => {
      if (this.enabled) timelineStore.addPerformanceSnapshot();
    }, 10000);

    timelineStore.add('code', {
      message: 'CodeTracer 已启动',
      category: 'system',
      data: { ua: navigator.userAgent.slice(0, 100) },
    });
  }

  /**
   * 停止追踪
   */
  disable() {
    this.enabled = false;
    if (this.originalCreateElement) {
      try {
        (window as any).React.createElement = this.originalCreateElement;
      } catch {}
    }
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    if (this.fpsInterval) {
      clearInterval(this.fpsInterval);
      this.fpsInterval = null;
    }
  }

  // ─── React 渲染追踪 ───

  private trackReactRenders() {
    try {
      const React = (window as any).React;
      if (!React || !React.createElement) return;

      this.originalCreateElement = React.createElement;

      const self = this;
      const orig = React.createElement;
      React.createElement = function (...args: any[]) {
        const type = args[0];
        // 只追踪函数/类组件（跳过原生 html 标签）
        if (typeof type === 'function') {
          const name = type.displayName || type.name || 'Anonymous';
          // 只记录部分页面的重渲染，避免爆炸
          if (self.renderCount % 50 === 0) {
            timelineStore.add('render', {
              message: `渲染: ${name}`,
              category: 'react_render',
              data: { name, renderCount: self.renderCount },
            });
          }
          self.componentRenderCount[name] = (self.componentRenderCount[name] || 0) + 1;
          self.renderCount++;
        }
        return orig.apply(this, args as any);
      };
    } catch {}
  }

  // ─── DOM 变化追踪 ───

  private trackDOMChanges() {
    try {
      let timeoutId: any = null;
      this.observer = new MutationObserver((mutations) => {
        // 节流：500ms 内只记录一次
        if (timeoutId) return;
        timeoutId = setTimeout(() => {
          timeoutId = null;
          // 只记录有意义的变化
          const nodeAdditions = mutations.filter(m =>
            m.type === 'childList' && m.addedNodes.length > 0
          );
          if (nodeAdditions.length > 0) {
            // 找第一个有 class/id 的节点了解变化内容
            const sample = nodeAdditions[0].addedNodes[0] as HTMLElement;
            const tag = sample?.tagName?.toLowerCase() || 'unknown';
            const id = sample?.id ? `#${sample.id}` : '';
            const cls = sample?.className && typeof sample.className === 'string'
              ? '.' + sample.className.split(/\s+/).filter(Boolean).slice(0, 2).join('.')
              : '';
            if (tag !== 'unknown' && tag !== 'script' && tag !== 'style') {
              timelineStore.add('custom', {
                message: `DOM 变更: ${tag}${id}${cls}`,
                category: 'dom_change',
                data: {
                  tag, id: sample?.id || '',
                  addedCount: nodeAdditions.length,
                },
              });
            }
          }
        }, 500);
      });
      this.observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
      });
    } catch {}
  }

  // ─── FPS 监控 ───

  private startFPSMonitor() {
    this.lastFrameTime = performance.now();
    this.frameCount = 0;

    const frameCallback = (now: number) => {
      if (!this.enabled) return;
      this.frameCount++;
      if (now - this.lastFrameTime >= 1000) {
        const fps = Math.round(this.frameCount * 1000 / (now - this.lastFrameTime));
        (window as any).__FRAME_RATE__ = fps;
        this.frameCount = 0;
        this.lastFrameTime = now;
        // 只在 FPS 过低时记录
        if (fps < 20) {
          timelineStore.add('memory', {
            message: `FPS 过低: ${fps}`,
            category: 'performance',
            data: { fps },
          });
        }
      }
      requestAnimationFrame(frameCallback);
    };
    requestAnimationFrame(frameCallback);
  }

  // ─── Webpack Chunk 追踪 ───

  private trackWebpackChunks() {
    try {
      const webpackChunk = (window as any).webpackChunkpdd_order_analyzer;
      if (!webpackChunk || !webpackChunk.push) return;

      const origPush = webpackChunk.push.bind(webpackChunk);
      const self = this;
      webpackChunk.push = function (...args: any[]) {
        const result = origPush(...args);
        try {
          const chunkData = args[0];
          if (Array.isArray(chunkData)) {
            const chunkIds = chunkData[0];
            if (Array.isArray(chunkIds)) {
              timelineStore.add('code', {
                message: `Chunk 加载: [${chunkIds.join(', ')}]`,
                category: 'webpack_chunk',
                data: { chunkIds: chunkIds.map(String) },
              });
            }
          }
        } catch {}
        return result;
      };
    } catch {}
  }

  // ─── 模块快照 ───

  private snapshotModules() {
    // 记录当前已加载的 script 标签
    const scripts = document.querySelectorAll('script[src]');
    const loaded: string[] = [];
    scripts.forEach(s => {
      const src = (s as HTMLScriptElement).src;
      if (src) loaded.push(src.split('/').pop() || src);
    });

    // 检查 webpack 模块缓存
    let moduleCount = 0;
    try {
      const webpackJsonp = (window as any).webpackChunkpdd_order_analyzer;
      if (webpackJsonp) moduleCount = webpackJsonp.length;
    } catch {}

    timelineStore.add('code', {
      message: '模块快照',
      category: 'module_snapshot',
      data: {
        scripts: loaded.slice(-20),
        webpackChunksLoaded: moduleCount,
        domReadyState: document.readyState,
      },
    });
  }

  getComponentRenderCounts(): Record<string, number> {
    return { ...this.componentRenderCount };
  }

  isEnabled() { return this.enabled; }
}

export const codeTracer = new CodeTracer();
export default codeTracer;

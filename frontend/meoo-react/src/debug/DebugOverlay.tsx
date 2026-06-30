/** DebugOverlay v7 — 企业级反馈中心（持久化时间线 + 代码追踪 + 全链路上下文） */
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import { actionRecorder, getRecentLogs } from "./actionRecorder";
import { buildFullSnapshot, type ElSnapshot, type FullContextSnapshot } from "./contextSnapshot";
import { timelineStore, type TimelineEvent } from "./timelineStore";
import { codeTracer } from "./codeTracer";

interface LogRow {
  id: number;
  type: "log"|"warn"|"error"|"info"|"network"|"react";
  message: string;
  stack?: string;
  ts: string;
  t: number;
}

// ── 兼容 v5 全局导出 ──
const debugContext: Record<string, any> = {};
export function setDebugContext(key: string, value: any) {
  if (value === undefined) delete debugContext[key];
  else debugContext[key] = value;
}
export function getDebugContext(): Record<string, any> { return { ...debugContext }; }
export function logAction(category: string, action: string, detail?: any) {
  actionRecorder.logAction(category, action, detail);
}

// ── Backward compat ──
const G = { items:[], n:0, subs:new Set(), on:false };

interface ElInfo {
  tag: string;
  id: string;
  cls: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** CSS selector path from root to this element */
  selectorPath: string;
  /** React component name (from fiber) */
  reactComponent: string;
  /** Computed CSS values for key properties */
  computedCss: Record<string,string>;
  /** Theme mode */
  theme: string;
}

function getDomPath(el: Element): string {
  const parts: string[] = [];
  let cur: Element|null = el;
  let depth = 0;
  while (cur && cur !== document.body && cur !== document.documentElement && depth < 10) {
    let seg = cur.tagName.toLowerCase();
    if (cur.id) { seg = "#"+cur.id; parts.unshift(seg); break; }
    if (cur.classList.length > 0) seg += "."+Array.from(cur.classList).slice(0,2).join(".");
    else {
      const parent = cur.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter(c=>c.tagName===cur!.tagName);
        const idx = siblings.indexOf(cur)+1;
        if (siblings.length>1) seg += `:nth-child(${idx})`;
      }
    }
    parts.unshift(seg);
    cur = cur.parentElement;
    depth++;
  }
  return parts.join(" > ");
}

function getReactCompName(el: Element): string {
  try {
    const key = Object.keys(el).find(k=>k.startsWith("__reactFiber$"));
    if (!key) return "";
    let fiber = (el as any)[key];
    for (let depth = 0; fiber && depth < 10; depth++) {
      const type = fiber.elementType;
      if (typeof type === "function") {
        const name = type.displayName || type.name;
        if (name && !name.startsWith("_") && name!=="Provider" && name!=="Consumer") return name;
      }
      fiber = fiber.return;
    }
  } catch {}
  return "";
}

function getComputedCss(el: Element): Record<string,string> {
  try {
    const s = getComputedStyle(el);
    // ★ 只读取最关键的 CSS 属性，减少循环开销
    const props = [
      "background-color","color","border-top-color","border",
      "font-size","font-weight","text-align",
      "width","height","display",
      "box-shadow","border-radius","opacity",
    ];
    const result: Record<string,string> = {};
    for (let i = 0; i < props.length; i++) {
      const v = s.getPropertyValue(props[i]);
      if (v) result[props[i]] = v;
    }
    return result;
  } catch { return {}; }
}

/** Walk up from a DOM element to find the most meaningful parent container.
 *  Skips SVGs, text nodes, inline elements with no class/id.
 *  ★ 优化：只对可能跳过的元素调 getBoundingClientRect，减少 layout 触发
 */
function resolveMeaningfulEl(el: Element): Element {
  let cur: Element|null = el;
  let best = el;
  while (cur && cur !== document.body) {
    const tag = cur.tagName.toLowerCase();
    const hasId = !!cur.id;
    const hasClass = cur.classList.length > 0;
    // Skip without getBoundingClientRect for known-small tags
    if (tag === "svg" || tag === "path" || tag === "img" || (tag === "span" && !hasId && !hasClass)) {
      cur = cur.parentElement;
      continue;
    }
    // Only call getBoundingClientRect when needed
    if (tag === "svg" || tag === "path" || tag === "img" || tag === "span") {
      const rect = cur.getBoundingClientRect();
      if (rect.width < 16 && rect.height < 16) { cur = cur.parentElement; continue; }
    }
    // Prefer elements with IDs or meaningful class names
    if (hasId || hasClass) best = cur;
    // If we find a meaningful container with decent size, stop here
    if (hasId || (hasClass && (tag === "div" || tag === "button" || tag === "a" || tag === "input" || tag === "label" || tag === "td" || tag === "th"))) {
      break;
    }
    cur = cur.parentElement;
  }
  return best;
}

function getElInfo(el: Element): ElInfo {
  const resolved = resolveMeaningfulEl(el);
  const r = resolved.getBoundingClientRect();
  return {
    tag: resolved.tagName.toLowerCase(),
    id: resolved.id || "",
    cls: Array.from(resolved.classList).join("."),
    text: (resolved.textContent||"").trim().slice(0,80),
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.width),
    h: Math.round(r.height),
    selectorPath: getDomPath(resolved),
    reactComponent: getReactCompName(resolved),
    computedCss: getComputedCss(resolved),
    theme: document.documentElement.getAttribute("data-theme") || "light",
  };
}

/** Capture full-page screenshot as base64 data URL */
async function captureFullPage(): Promise<string|null> {
  try {
    // Capture the entire viewport (visible area)
    const canvas = await html2canvas(document.documentElement, {
      backgroundColor: "#ffffff",
      scale: 1,
      useCORS: true,
      logging: false,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: window.scrollX,
      y: window.scrollY,
    });
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  }
}

/* ★★★ 多元素选择器 v3 — 支持点击多个元素 ★★★ */
interface SelectedBox {
  el: Element;
  info: ElInfo;
  box: HTMLDivElement;
  label: HTMLDivElement;
  /** Unique color per box */
  color: string;
}
let selHighBox: HTMLDivElement|null = null;
let selBoxes: SelectedBox[] = [];
let selCb: ((infos: ElInfo[])=>void)|null = null;
let pickCb: ((info: ElInfo)=>void)|null = null;  // ★ 每点一个元素立即触发
let selActive = false;
let selCounter = 0;
const PICKER_COLORS = ['#ff4444','#ff8800','#22aa66','#4488ff','#aa44ff','#ff44aa','#888888'];
const DONE_BTN_ID = 'debug-picker-done-btn';
// ★ 用 Set 缓存已选元素，避免每次 mousemove 都遍历 selBoxes
const selectedElSet = new Set<Element>();

/* Remove all persist boxes and labels */
function clearPersistBoxes() {
  for (const sb of selBoxes) {
    sb.box.remove();
    sb.label.remove();
  }
  selBoxes = [];
  selectedElSet.clear();
}

function onSelScroll() {
  for (const sb of selBoxes) {
    sb.box.style.display = "none";
    sb.label.style.display = "none";
  }
}

function startSelector(cb: (infos: ElInfo[])=>void, onPick?: (info: ElInfo)=>void) {
  stopSelector();
  selCb = cb;
  pickCb = onPick || null;  // ★ 每点一个元素立即触发的回调
  selActive = true;
  selCounter = 0;
  // ★ 不清除已有 selBoxes，支持积累添加

  selHighBox = document.createElement("div");
  Object.assign(selHighBox.style, {
    position:"fixed", pointerEvents:"none",
    border:"2px dashed #ff6600",
    background:"rgba(255,102,0,0.08)",
    zIndex:"2147483647",
    display:"none",
    borderRadius:"2px",
  });
  document.body.appendChild(selHighBox);

  // ★ "完成选择"按钮
  const existingDone = document.getElementById(DONE_BTN_ID);
  if (existingDone) existingDone.remove();
  const doneBtn = document.createElement("div");
  doneBtn.id = DONE_BTN_ID;
  doneBtn.textContent = "✓ 完成选择";
  Object.assign(doneBtn.style, {
    position:"fixed", bottom:"20px", left:"50%", transform:"translateX(-50%)",
    zIndex:"2147483647",
    background:"#ff4444", color:"#fff",
    fontFamily:"sans-serif", fontSize:"14px", fontWeight:"bold",
    padding:"10px 24px", borderRadius:"8px",
    cursor:"pointer", boxShadow:"0 2px 12px rgba(0,0,0,0.3)",
    border:"none", userSelect:"none",
  });
  doneBtn.onclick = () => finishMultiPick();
  document.body.appendChild(doneBtn);

  document.addEventListener("mousemove",onSelMove,true);
  document.addEventListener("click",onSelClick,true);
  document.addEventListener("keydown",onSelKey);
  document.addEventListener("contextmenu",onCtxMenu,true);
  window.addEventListener("scroll",onSelScroll,true);
}

function onCtxMenu(e:Event){e.preventDefault();}

function onSelMove(e:MouseEvent) {
  if (!selActive||!selHighBox) return;
  const el = document.elementFromPoint(e.clientX,e.clientY);
  if (!el||el===selHighBox||el===document.body||el===document.documentElement||!!(el as HTMLElement).closest("[data-debug-panel]")||!!(el as HTMLElement).closest("#"+DONE_BTN_ID)) {
    selHighBox.style.display="none"; return;
  }
  // ★ 用 Set 快速查找
  if (selectedElSet.has(el)) { selHighBox.style.display="none"; return; }
  const r = el.getBoundingClientRect();
  selHighBox.style.display="block";
  selHighBox.style.left=r.left+"px";
  selHighBox.style.top=r.top+"px";
  selHighBox.style.width=r.width+"px";
  selHighBox.style.height=r.height+"px";
}

/** Convert hex color to rgba string */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function addPersistBox(el: Element, info: ElInfo) {
  const color = PICKER_COLORS[selBoxes.length % PICKER_COLORS.length];
  // ★ 使用 info 中已缓存的坐标，避免再次 getBoundingClientRect() 触发 layout
  const r = { left: info.x, top: info.y, width: info.w, height: info.h, bottom: info.y + info.h, right: info.x + info.w };

  const box = document.createElement("div");
  const bgRgba = color.startsWith('#')
    ? hexToRgba(color, 0.10)
    : color.replace(")", ",0.10)");
  Object.assign(box.style, {
    position:"fixed", pointerEvents:"none",
    border:"2px solid "+color,
    background: bgRgba,
    zIndex:"2147483646",
    borderRadius:"2px",
    left:r.left+"px", top:r.top+"px",
    width:r.width+"px", height:r.height+"px",
  });
  document.body.appendChild(box);

  const label = document.createElement("div");
  const tagStr = (selBoxes.length+1)+". "+info.tag+(info.id?"#"+info.id:"")+(info.cls?"."+info.cls:"");
  label.textContent = tagStr;
  Object.assign(label.style, {
    position:"fixed", pointerEvents:"none",
    background:color, color:"#fff",
    fontFamily:"monospace", fontSize:"11px",
    padding:"2px 6px", borderRadius:"3px",
    zIndex:"2147483647",
    whiteSpace:"nowrap",
  });
  const vw = window.innerWidth, vh = window.innerHeight;
  let lx = Math.max(4, Math.min(r.left, vw - 200));
  let ly = r.top < 30 ? r.bottom + 4 : r.top - 22;
  ly = Math.max(4, Math.min(ly, vh - 24));
  label.style.left = lx+"px";
  label.style.top = ly+"px";
  document.body.appendChild(label);

  selBoxes.push({ el, info, box, label, color });
}

function onSelClick(e:MouseEvent) {
  if (!selActive) return;

  // ★ 关键修复：先检查是否点击了"完成选择"按钮或调试面板
  // 这些元素的点击事件必须正常传递，不能 stopPropagation
  const clickTarget = e.target as HTMLElement;
  if (clickTarget.closest("#"+DONE_BTN_ID) || clickTarget.closest("[data-debug-panel]")) {
    return; // 放行，让这些元素自己处理点击
  }

  e.stopPropagation();
  e.preventDefault();

  const el = document.elementFromPoint(e.clientX,e.clientY);
  if (!el||el===selHighBox||el===document.body||el===document.documentElement||!!(el as HTMLElement).closest("[data-debug-panel]")||!!(el as HTMLElement).closest("#"+DONE_BTN_ID)) return;
  // Skip if already selected
  if (selectedElSet.has(el)) return;

  const info = getElInfo(el);
  selectedElSet.add(el);
  addPersistBox(el, info);
  // ★ 每点一个元素，立刻通知 React 更新状态（不等待"完成选择"）
  if (pickCb) pickCb(info);
  if (selHighBox) selHighBox.style.display="none";
}

function finishMultiPick() {
  if (!selActive) return;
  selActive = false;
  const infos = selBoxes.map(sb => sb.info);
  if (selHighBox) { selHighBox.remove(); selHighBox=null; }
  // ★ 清理 persistBoxes，用户点击"完成"后框消失，但 React 状态保留
  clearPersistBoxes();
  // Remove done button
  const doneBtn = document.getElementById(DONE_BTN_ID);
  if (doneBtn) doneBtn.remove();
  document.removeEventListener("mousemove",onSelMove,true);
  document.removeEventListener("click",onSelClick,true);
  document.removeEventListener("contextmenu",onCtxMenu,true);
  window.removeEventListener("scroll",onSelScroll,true);
  if (selCb) {
    selCb(infos);
    selCb = null;
  }
  pickCb = null;
}

function onSelKey(e:KeyboardEvent) {
  if (e.key==="Escape") { stopSelector(); }
}

function stopSelector() {
  selActive = false;
  if (selHighBox) { selHighBox.remove(); selHighBox=null; }
  clearPersistBoxes();
  const doneBtn = document.getElementById(DONE_BTN_ID);
  if (doneBtn) doneBtn.remove();
  selCb = null;
  pickCb = null;
  document.removeEventListener("mousemove",onSelMove,true);
  document.removeEventListener("click",onSelClick,true);
  document.removeEventListener("keydown",onSelKey);
  document.removeEventListener("contextmenu",onCtxMenu,true);
  window.removeEventListener("scroll",onSelScroll,true);
}

// ── ★ v7 辅助函数 ──
function getEventIcon(evt: TimelineEvent): string {
  switch (evt.type) {
    case 'action': return '👆';
    case 'network':
      if (evt.data?.error) return '❌';
      if (evt.data?.status >= 400) return '⚠️';
      return '🔗';
    case 'error': return '❌';
    case 'resource': return evt.data?.failed ? '❌' : '📦';
    case 'navigation': return '🚦';
    case 'code': return '💻';
    case 'render': return '⚛';
    case 'memory': return '📊';
    case 'state': return '💾';
    case 'input': return '⌨';
    case 'custom': return '🔧';
    default: return '📋';
  }
}
function getEventColor(evt: TimelineEvent): string {
  switch (evt.type) {
    case 'error': return '#ff4444';
    case 'network': return evt.data?.error ? '#ff4444' : evt.data?.status >= 400 ? '#ff8800' : '#4488ff';
    case 'action': return '#ff8800';
    case 'navigation': return '#22aa66';
    case 'code': return '#8844ff';
    case 'render': return '#44aaff';
    case 'resource': return evt.data?.failed ? '#ff4444' : '#22aa66';
    case 'memory': return '#888';
    case 'input': return '#aa66cc';
    default: return '#999';
  }
}
function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 1000) return '刚刚';
  if (diff < 60000) return `${Math.floor(diff / 1000)}秒前`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
  return `${Math.floor(diff / 3600000)}小时前`;
}
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}秒`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}分${Math.floor((ms % 60000) / 1000)}秒`;
  return `${Math.floor(ms / 3600000)}时${Math.floor((ms % 3600000) / 60000)}分`;
}
function safeStringify(o: any): string {
  try { const s = new WeakSet(); return JSON.stringify(o, (k, v) => { if (typeof v === 'object' && v !== null) { if (s.has(v)) return '[Circular]'; s.add(v); } return v; }, 2); }
  catch { return String(o); }
}

interface Props {}

/** ★ v6 SEVERITIES array — color + label + description */
const SEVERITIES = [
  { value: "critical", label: "严重", color: "#ff4444", desc: "功能无法使用" },
  { value: "major",   label: "主要", color: "#ff8800", desc: "有影响但可解决" },
  { value: "minor",   label: "轻微", color: "#22aa66", desc: "小问题" },
  { value: "suggestion", label: "建议", color: "#4488ff", desc: "可改进之处" },
] as const;

const DebugOverlay: React.FC<Props> = () => {
  const [debugAllowed, setDebugAllowed] = useState<boolean | null>(null); // null = loading
  const [visible, setVisible] = useState(false);
  const [tab, setTab] = useState<"form"|"context"|"diagnostics"|"timeline"|"code"|"user">("form");
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [expandedLog, setExpandedLog] = useState<number|null>(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [severity, setSeverity] = useState("major");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [lastReportId, setLastReportId] = useState('');
  const [selMode, setSelMode] = useState(false);
  const [selInfos, setSelInfos] = useState<ElInfo[]>([]);
  const [selScreenshot, setSelScreenshot] = useState<string|null>(null);
  const [contextCounts, setContextCounts] = useState({ logs:0, networks:0, actions:0, resources:0 });
  // ★ v7: 时间线筛选 & 事件详情
  const [timelineFilter, setTimelineFilter] = useState<string>('all');
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  // ★ v7: session/用户信息
  const [userInfo, setUserInfo] = useState({ userId:'', username:'', role:'', sessionId:'', duration:0, events:0 });
  const toggleRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ★ 检查调试权限：跟账号走，不依赖 IP 白名单
  const checkDebugPermission = useCallback(async () => {
    try {
      const raw = localStorage.getItem("dianfx_jwt_tokens");
      if (!raw) { setDebugAllowed(false); return; }
      const tokens = JSON.parse(raw);
      if (!tokens.accessToken) { setDebugAllowed(false); return; }
      // 解码 JWT payload（第二个 . 分隔的部分）
      const payloadB64 = tokens.accessToken.split(".")[1];
      if (!payloadB64) { setDebugAllowed(false); return; }
      // base64url → base64（恢复 +/ 并补足 padding）
      let b64 = payloadB64.replace(/-/g,"+").replace(/_/g,"/");
      while (b64.length % 4) b64 += "=";
      const payload = JSON.parse(atob(b64));
      const role = payload.role || "";
      // admin 或 test 角色即显示反馈按钮，不检查 IP
      if (role !== "admin" && role !== "test") { setDebugAllowed(false); return; }
      setDebugAllowed(true);
    } catch {
      setDebugAllowed(false);
    }
  }, []);

  useEffect(() => {
    // ★ 录轨器已在 App.tsx 模块级初始化，此处不再重复调用
    const upd = () => setLogs([...G.items]);
    G.subs.add(upd);
    checkDebugPermission();
    window.addEventListener('dianfx:auth-changed', checkDebugPermission);
    return () => {
      G.subs.delete(upd);
      window.removeEventListener('dianfx:auth-changed', checkDebugPermission);
    };
  }, [checkDebugPermission]);

  // Escape during picker mode: clear React state
  useEffect(() => {
    if (!selMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelMode(false);
        setSelInfos([]);
        setSelScreenshot(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selMode]);

  // ★ v6: periodic context count + v7 timeline/user update
  useEffect(() => {
    const update = () => {
      const ctx = actionRecorder.getAllContext();
      setContextCounts({
        logs: ctx.logs?.length || 0,
        networks: ctx.networks?.length || 0,
        actions: ctx.actions?.length || 0,
        resources: ctx.resources?.length || 0,
      });
      // ★ v7: 更新时间线视图
      setTimelineEvents(timelineStore.getTimeline(300));
      // ★ v7: 更新用户信息
      try {
        const raw = localStorage.getItem('dianfx_jwt_tokens');
        if (raw) {
          const tokens = JSON.parse(raw);
          if (tokens.accessToken) {
            const payload = JSON.parse(atob(tokens.accessToken.split('.')[1]));
            setUserInfo(prev => ({
              ...prev,
              userId: payload.userId || prev.userId,
              username: payload.username || prev.username,
              role: payload.role || prev.role,
              sessionId: timelineStore.getSessionId(),
              duration: Date.now() - timelineStore.getSessionStart(),
              events: timelineStore.getEventCount(),
            }));
          }
        }
      } catch {}
    };
    update();
    const iv = setInterval(update, 2000);
    return () => clearInterval(iv);
  }, []);

  function formatElBlock(info: ElInfo) {
    const lines: string[] = [];
    lines.push("[问题模块] " + info.tag + (info.id?"#"+info.id:"") + (info.cls?"."+info.cls:""));
    lines.push("DOM路径: " + info.selectorPath);
    if (info.reactComponent) lines.push("React组件: " + info.reactComponent);
    lines.push("位置: (" + info.x + ", " + info.y + ") " + info.w + "x" + info.h);
    if (info.text) lines.push("文本: " + info.text);
    lines.push("主题: " + info.theme);
    // Computed CSS — only include the most relevant ones
    const bg = info.computedCss["background-color"];
    const color = info.computedCss["color"];
    const border = info.computedCss["border"];
    const borderColor = info.computedCss["border-top-color"];
    if (bg) lines.push("background: " + bg);
    if (color) lines.push("color: " + color);
    if (border && border !== "none") lines.push("border: " + border);
    else if (borderColor) lines.push("border-color: " + borderColor);
    return lines.join("\n");
  }

  const startPick = useCallback(() => {
    setSelMode(true);
    // ★ 不清空 selInfos，支持积累添加（用户可能在不同页面位置选元素）
    startSelector(
      // finishCb — 点"完成选择"时触发
      async (_infos: ElInfo[]) => {
        setSelMode(false);
        const dataUrl = await captureFullPage();
        if (dataUrl) setSelScreenshot(dataUrl);
      },
      // pickCb — ★ 每点一个元素立即触发，不等待"完成选择"
      // ★ React 18 createRoot 会自动批量化 setState，两次调用只触发一次渲染
      (info: ElInfo) => {
        setSelInfos(prev => [...prev, info]);
        const block = formatElBlock(info);
        setDesc(prev => {
          if (prev.includes(info.selectorPath)) return prev;
          return prev ? prev + "\n" + block : block;
        });
      }
    );
  }, []);
  const handleSubmit = useCallback(async () => {
    if (!title.trim()) return alert("请输入题目");
    if (!desc.trim()) return alert("请描述问题");
    setSubmitting(true);
    actionRecorder.logAction('feedback', 'submit', `${title} (${severity})`);
    try {
      // ★ JWT 鉴权：提交时后端验证 JWT 角色，不再依赖 IP 白名单

      // ★ 使用全链路上下文快照
      const elementSnapshots: ElSnapshot[] = selInfos.map(si => ({
        tag: si.tag, id: si.id, cls: si.cls,
        selectorPath: si.selectorPath, reactComponent: si.reactComponent,
        computedCss: si.computedCss, position: [si.x, si.y, si.w, si.h],
        text: si.text, theme: si.theme,
      }));

      const snapshot = await buildFullSnapshot({
        title: title.trim(),
        description: desc.trim(),
        severity,
        elementInfos: elementSnapshots,
      });

      // ★ 从 JWT 解码用户身份（修复：userId/username 永远为空的问题）
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

      // ★ 读取历史 JS 错误（修复：跨会话错误丢失的问题）
      let legacyErrors: any[] = [];
      try {
        const raw = localStorage.getItem('__dianfx_errors');
        if (raw) {
          legacyErrors = JSON.parse(raw);
        }
      } catch {}
      // 合并到 errorSummary：历史错误 + 当前 session 错误
      const mergedErrors = [...(snapshot.errorSummary || [])];
      const seen = new Set(mergedErrors.map((e: any) => e.message));
      for (const err of legacyErrors) {
        const key = (err.msg || '').slice(0, 100);
        if (!seen.has(key)) {
          mergedErrors.push({
            message: key,
            count: 1,
            lastTs: new Date(err.time || Date.now()).toLocaleTimeString(),
            source: 'legacy',
          });
          seen.add(key);
        } else {
          // 增加计数
          const existing = mergedErrors.find((e: any) => e.message === key);
          if (existing) existing.count = (existing.count || 0) + 1;
        }
      }

      const body: Record<string, any> = {
        title: snapshot.title,
        description: snapshot.description,
        severity: snapshot.severity,
        elementInfos: snapshot.elementInfos,
        logs: snapshot.logs,
        deviceInfo: snapshot.device,
        userId,  // ★ 修复：带上用户身份
        username, // ★ 修复：带上用户名
        pageContext: { ...debugContext, ...snapshot.appState },
        buildInfo: snapshot.buildInfo,
        config: snapshot.config,
        userActions: snapshot.actions,
        networkRequests: snapshot.networks,
        resources: snapshot.resources,
        deployDiagnostics: snapshot.deployDiagnostics,
        networkDiagnostics: snapshot.networkDiagnostics,
        serverRequestIds: snapshot.serverRequestIds,
        routeHistory: snapshot.routeHistory,
        errorSummary: mergedErrors,  // ★ 修复：含历史错误
        runtimeDiagnostics: snapshot.runtimeDiagnostics,
        // ★ 自动诊断流程 — 每次反馈附带处理 SOP
        diagnosticFlow: snapshot.diagnosticFlow,
      };

      // Attach screenshot if available
      if (snapshot.screenshot) body.screenshot = snapshot.screenshot;

      // 携带 JWT 令牌提交（后端通过 JWT 角色验证权限）
      let authHeaders: Record<string, string> = { "Content-Type": "application/json" };
      try {
        const raw = localStorage.getItem('dianfx_jwt_tokens');
        if (raw) {
          const tokens = JSON.parse(raw);
          if (tokens.accessToken) authHeaders['Authorization'] = 'Bearer ' + tokens.accessToken;
        }
      } catch {}
      const res = await fetch("/api/v1/debug/report", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        setLastReportId(data.data.id);
        setDone(true);
        setTitle(""); setDesc(""); setSeverity("major");
        setSelInfos([]); setSelScreenshot(null);
      } else {
        alert("提交失败: " + (data.error || "未知错误"));
      }
    } catch (e: any) {
      alert("网络错误: " + e.message);
    }
    setSubmitting(false);
  }, [title, desc, severity, selInfos]);
  const copyReport = useCallback(() => {
    const recentLogs = getRecentLogs(50, true);
    const lines: string[] = [
      "=== 调试报告 ===",
      "标题: " + title,
      "严重程度: " + (SEVERITIES.find(s => s.value === severity)?.label || severity),
      "描述: " + desc,
      "时间: " + new Date().toLocaleString(),
      "URL: " + location.href,
      "--- 页面上下文 ---",
      ...Object.entries(debugContext).map(([k, v]) => k + ": " + (typeof v === 'object' ? JSON.stringify(v) : String(v))),
    ];
    if (selInfos.length > 0) {
      lines.push("");
      lines.push("--- 选择的" + selInfos.length + "个元素 ---");
      selInfos.forEach((si, idx) => {
        lines.push("[" + (idx+1) + "] 选择器: " + si.tag + (si.id?"#"+si.id:"") + (si.cls?"."+si.cls:""));
        lines.push("    DOM路径: " + si.selectorPath);
        if (si.reactComponent) lines.push("    React组件: " + si.reactComponent);
        lines.push("    位置: ("+si.x+", "+si.y+") "+si.w+"x"+si.h);
        const bg = si.computedCss["background-color"];
        const color = si.computedCss["color"];
        if (bg) lines.push("    background: " + bg);
        if (color) lines.push("    color: " + color);
      });
    }
    lines.push("");
    lines.push("--- 控制台日志 (最近50条, "+recentLogs.length+"条) ---");
    lines.push(...recentLogs.map(l => `[${l.ts}][${l.type}] ${l.message}`));
    navigator.clipboard.writeText(lines.join("\n")).then(() => {
      alert("报告已复制到剪贴板！");
    }).catch(() => {
      alert("复制失败，请手动复制");
    });
  }, [title, desc, severity, selInfos]);
  // ---- render ----
  // ★ 如果权限检查未通过，完全隐藏调试按钮和面板
  if (debugAllowed !== true) return null;
  return (
    <>
      {/* ★ v6 draggable feedback button */}
      <motion.div
        ref={toggleRef}
        drag
        dragMomentum={false}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        onClick={() => { setVisible(v=>{ if(v){ stopSelector(); setSelInfos([]); } return !v; }); setDone(false); }}
        style={{
          position:"fixed", bottom:"80px", right:"20px", zIndex:2147483645,
          width:"52px", height:"52px", borderRadius:"50%",
          background:"linear-gradient(135deg, #ff4444, #ff8800)",
          color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
          cursor:"grab", fontSize:"13px", fontWeight:"bold",
          boxShadow:"0 3px 16px rgba(255,68,0,0.4)",
          border:"none", userSelect:"none", fontFamily:"sans-serif",
          touchAction:"none",
        }}
      >
        <span style={{ lineHeight:"1", letterSpacing:"1px" }}>反馈</span>
      </motion.div>

      {/* ★ v6 animated panel */}
      <AnimatePresence>
        {visible && (
          <motion.div
            ref={panelRef}
            data-debug-panel="1"
            initial={{ opacity:0, y:20, scale:0.95 }}
            animate={{ opacity:1, y:0, scale:1 }}
            exit={{ opacity:0, y:20, scale:0.95 }}
            transition={{ type:"spring", damping:25, stiffness:300 }}
            style={{
              position:"fixed", bottom:"140px", right:"20px", zIndex:2147483645,
              width:"440px", maxHeight:"580px", background:"#fff", borderRadius:"16px",
              boxShadow:"0 8px 32px rgba(0,0,0,0.18)", overflow:"hidden",
              display:"flex", flexDirection:"column", fontFamily:"sans-serif",
              fontSize:"14px", color:"#333",
            }}
          >
          {/* ★ v6 header with context preview counts */}
          <div style={{
            padding:"14px 16px",
            background:"linear-gradient(135deg, #ff4444, #ff6a00)",
            color:"#fff",
            display:"flex", justifyContent:"space-between", alignItems:"center",
            fontWeight:"bold", fontSize:"15px",
            flexShrink:0,
          }}>
            <span>反馈中心</span>
            <div style={{ display:"flex", gap:"4px", alignItems:"center" }}>
              <button onClick={() => setTab("form")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="form" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="form"?"bold":"normal",
              }}>
                📝 反馈
              </button>
              <button onClick={() => setTab("context")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="context" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="context"?"bold":"normal",
                position:"relative",
              }}>
                📊 上下文
                {contextCounts.logs + contextCounts.networks + contextCounts.actions + contextCounts.resources > 0 && (
                  <span style={{
                    position:"absolute", top:"-2px", right:"-4px",
                    background:"#fff", color:"#ff4444", fontSize:"9px",
                    padding:"1px 5px", borderRadius:"8px", fontWeight:"bold",
                    lineHeight:"14px",
                  }}>
                    {contextCounts.logs + contextCounts.networks + contextCounts.actions}
                  </span>
                )}
              </button>
              <button onClick={() => setTab("diagnostics")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="diagnostics" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="diagnostics"?"bold":"normal",
              }}>
                🔍 诊断
              </button>
              <button onClick={() => setTab("timeline")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="timeline" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="timeline"?"bold":"normal",
                position:"relative",
              }}>
                ⏱ 时间线
                {timelineEvents.length > 0 && <span style={{
                  position:"absolute", top:"-2px", right:"-4px",
                  background:"#fff", color:"#ff4444", fontSize:"9px",
                  padding:"1px 5px", borderRadius:"8px", fontWeight:"bold",
                  lineHeight:"14px",
                }}>{timelineEvents.length}</span>}
              </button>
              <button onClick={() => setTab("code")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="code" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="code"?"bold":"normal",
              }}>
                💻 代码
              </button>
              <button onClick={() => setTab("user")} style={{
                padding:"4px 10px", borderRadius:"6px", border:"none",
                background: tab==="user" ? "rgba(255,255,255,0.25)" : "transparent",
                color:"#fff", cursor:"pointer", fontSize:"12px", fontWeight: tab==="user"?"bold":"normal",
              }}>
                👤 用户
              </button>
              <span style={{ margin:"0 2px", opacity:0.3 }}>|</span>
              <button onClick={() => { setVisible(false); stopSelector(); clearPersistBoxes(); setSelInfos([]); }} style={{
                padding:"2px 8px", borderRadius:"6px", border:"none",
                background:"transparent", color:"#fff", cursor:"pointer",
                fontSize:"18px", lineHeight:"1", opacity:0.8,
              }}>
                ✕
              </button>
            </div>
          </div>
          {tab === "form" && (
            <div style={{ padding:"12px 16px", overflow:"auto", flex:1, display:"flex", flexDirection:"column", gap:"10px" }}>
              {done ? (
                <div style={{ textAlign:"center", padding:"30px 0" }}>
                  <div style={{ fontSize:"40px", marginBottom:"10px" }}>✅</div>
                  <div style={{ fontSize:"16px", fontWeight:"bold", color:"#333" }}>感谢您的反馈！</div>
                  <div style={{ fontSize:"13px", color:"#888", marginTop:"6px", marginBottom:"16px" }}>报告已提交，我们会尽快处理。</div>
                  {lastReportId && (
                    <div style={{ fontSize:"12px", color:"#666", marginBottom:"12px", padding:"8px", background:"#f5f5f5", borderRadius:"6px" }}>
                      报告编号：<strong>{lastReportId}</strong>
                      <button onClick={() => { navigator.clipboard.writeText(lastReportId); alert('已复制报告编号'); }}
                        style={{ marginLeft:"8px", padding:"2px 8px", fontSize:"11px", background:"#e0e0e0", border:"none", borderRadius:"4px", cursor:"pointer" }}
                      >📋 复制</button>
                    </div>
                  )}
                  <button onClick={() => setDone(false)}
                    style={{ padding:"8px 24px", background:"#ff4444", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer" }}
                  >继续提交</button>
                </div>
              ) : (
                <>
                  {/* severity — v6 SEVERITIES */}
                  <div>
                    <div style={{ fontSize:"12px", color:"#888", marginBottom:"4px" }}>严重程度</div>
                    <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                      {SEVERITIES.map(s => (
                        <button key={s.value} onClick={() => setSeverity(s.value)}
                          style={{
                            padding:"5px 14px", borderRadius:"16px", border:"1px solid",
                            borderColor: severity===s.value ? s.color : "#ddd",
                            background: severity===s.value ? s.color : "#f9f9f9",
                            color: severity===s.value ? "#fff" : "#666",
                            cursor:"pointer", fontSize:"12px", fontWeight: severity===s.value?"bold":"normal",
                            transition:"all 0.15s ease",
                          }}
                        >{s.label} — {s.desc}</button>
                      ))}
                    </div>
                  </div>

                  {/* title */}
                  <div>
                    <div style={{ fontSize:"12px", color:"#888", marginBottom:"4px" }}>问题标题</div>
                    <input
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="简单描述你遇到的问题"
                      style={{
                        width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid #ddd",
                        fontSize:"14px", outline:"none", boxSizing:"border-box",
                      }}
                    />
                  </div>

                  {/* description with element picker */}
                  <div>
                    <div style={{ fontSize:"12px", color:"#888", marginBottom:"4px" }}>问题描述
                      <button onClick={selMode ? () => { stopSelector(); setSelMode(false); } : startPick}
                        style={{
                          marginLeft:"8px", padding:"2px 8px", borderRadius:"4px",
                          border:"1px solid #ff4444", background: selMode ? "#ff4444" : "#fff",
                          color: selMode ? "#fff" : "#ff4444", cursor:"pointer", fontSize:"11px",
                        }}
                      >
                        {selMode ? "点击页面元素(可多选)..." : "选择页面元素(可多选)"}
                      </button>
                      {selMode && (
                        <button onClick={() => { stopSelector(); setSelMode(false); setSelInfos([]); setSelScreenshot(null); }}
                          style={{
                            marginLeft:"4px", padding:"2px 8px", borderRadius:"4px",
                            border:"1px solid #999", background:"#fff",
                            color:"#666", cursor:"pointer", fontSize:"11px",
                          }}
                        >取消选择</button>
                      )}
                    </div>
                    <textarea
                      value={desc}
                      onChange={e => setDesc(e.target.value)}
                      placeholder="请详细描述你遇到的问题，或点击上方按钮选择页面元素（可多选）"
                      rows={4}
                      style={{
                        width:"100%", padding:"8px 10px", borderRadius:"6px", border:"1px solid #ddd",
                        fontSize:"13px", outline:"none", resize:"vertical", boxSizing:"border-box",
                        fontFamily:"sans-serif",
                      }}
                    />
                    {selInfos.length > 0 && (
                      <div style={{ fontSize:"11px", color:"#999", marginTop:"4px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
                          <span style={{ fontWeight:"bold", color:"#333" }}>已选择 {selInfos.length} 个元素:</span>
                          <button onClick={() => { stopSelector(); clearPersistBoxes(); setSelInfos([]); setSelScreenshot(null); }}
                            style={{ background:"none", border:"1px solid #ccc", borderRadius:"3px", cursor:"pointer", fontSize:"10px", padding:"0 5px", color:"#999", lineHeight:"16px" }}
                          >清空</button>
                        </div>
                        {selInfos.map((si, idx) => (
                          <div key={idx} style={{ marginTop:"3px", padding:"4px", background:"#f9f9f9", borderRadius:"4px", border:"1px solid #eee" }}>
                            <span style={{ fontWeight:"bold", color:PICKER_COLORS[idx % PICKER_COLORS.length] }}>#{idx+1}</span>
                            <span style={{ marginLeft:"4px", color:"#333" }}>{si.tag}{si.id ? "#"+si.id : ""}{si.cls ? "."+si.cls : ""}</span>
                            {si.text && <span style={{ marginLeft:"4px", color:"#999", fontSize:"10px" }}>"{si.text.slice(0,30)}"</span>}
                            {si.reactComponent && <div style={{ fontSize:"10px", color:"#aaa" }}>组件: {si.reactComponent}</div>}
                          </div>
                        ))}
                        {/* Screenshot preview */}
                        {selScreenshot && (
                          <div style={{ marginTop:"6px" }}>
                            <div style={{ fontSize:"10px", color:"#888", marginBottom:"3px" }}>页面截图:</div>
                            <img src={selScreenshot} alt="页面截图"
                              style={{
                                maxWidth:"100%", maxHeight:"120px", borderRadius:"4px",
                                border:"1px solid #ddd", cursor:"pointer",
                              }}
                              onClick={() => window.open(selScreenshot, "_blank")}
                              title="点击查看大图"
                            />
                            <div style={{ fontSize:"9px", color:"#bbb", marginTop:"2px" }}>
                              {(selScreenshot.length * 0.75 / 1024).toFixed(0)} KB · 视口截图
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* actions */}
                  <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end", alignItems:"center", paddingTop:"4px" }}>
                    <span style={{ fontSize:"10px", color:"#aaa", marginRight:"auto" }}>
                      📊{contextCounts.logs} 🔗{contextCounts.networks} 💡{contextCounts.actions} 📦{contextCounts.resources}
                      {selScreenshot && " 🖼️截图"}
                    </span>
                    <button onClick={copyReport}
                      style={{
                        padding:"8px 16px", borderRadius:"6px", border:"1px solid #ddd",
                        background:"#fff", color:"#666", cursor:"pointer", fontSize:"13px",
                      }}
                    >
                      复制报告
                    </button>
                    <button onClick={handleSubmit} disabled={submitting}
                      style={{
                        padding:"8px 24px", borderRadius:"6px", border:"none",
                        background: submitting ? "#ccc" : "#ff4444",
                        color:"#fff", cursor: submitting ? "not-allowed" : "pointer", fontSize:"13px",
                      }}
                    >
                      {submitting ? "提交中..." : "提交反馈"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
          {tab === "context" && (
            <div style={{ padding:"12px 16px", overflow:"auto", flex:1, display:"flex", flexDirection:"column", gap:"8px", maxHeight:"400px" }}>
              <div style={{ display:"flex", gap:"12px", fontSize:"11px", color:"#888", marginBottom:"4px" }}>
                <span>📊 {contextCounts.logs} 条日志</span>
                <span>🔗 {contextCounts.networks} 条网络请求</span>
                <span>💡 {contextCounts.actions} 条操作</span>
              </div>
              {(() => {
                const ctx = actionRecorder.getAllContext();
                const nets = ctx.networks || [];
                const acts = ctx.actions || [];
                return (
                  <>
                    {nets.length > 0 && (
                      <div>
                        <div style={{ fontSize:"12px", fontWeight:"bold", color:"#333", marginBottom:"4px" }}>🌐 网络请求</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                          {nets.slice(-20).reverse().map((n: any, i: number) => (
                            <div key={i} style={{
                              padding:"5px 8px", borderRadius:"4px", fontSize:"11px",
                              background: n.error ? "#fff0f0" : "#f5f8ff",
                              border:"1px solid", borderColor: n.error ? "#ffd0d0" : "#e0e8f0",
                            }}>
                              <div style={{ display:"flex", gap:"6px", alignItems:"center" }}>
                                <span style={{
                                  background: n.method==="POST"?"#22aa66":n.method==="PUT"?"#ff8800":n.method==="DELETE"?"#ff4444":"#4488ff",
                                  color:"#fff", borderRadius:"3px", padding:"0 5px",
                                  fontWeight:"bold", fontSize:"9px", lineHeight:"16px",
                                }}>{n.method||"GET"}</span>
                                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{String(n.url||"").slice(0,60)}</span>
                                {n.status && (
                                  <span style={{
                                    color: n.status>=400?"#ff4444":"#22aa66",
                                    fontWeight:"bold", fontSize:"11px",
                                  }}>{n.status}</span>
                                )}
                              </div>
                              {n.error && <div style={{ color:"#cc0000", fontSize:"10px", marginTop:"2px" }}>{String(n.error)}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {acts.length > 0 && (
                      <div>
                        <div style={{ fontSize:"12px", fontWeight:"bold", color:"#333", marginBottom:"4px", marginTop:"8px" }}>💡 用户操作</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"3px" }}>
                          {acts.slice(-30).reverse().map((a: any, i: number) => (
                            <div key={i} style={{
                              padding:"5px 8px", borderRadius:"4px", fontSize:"11px",
                              background:"#fafafa", border:"1px solid #eee",
                            }}>
                              <span style={{ color:"#999", fontSize:"10px" }}>[{a.ts||""}]</span>
                              <span style={{ color:"#333", marginLeft:"4px" }}><strong>{a.category||""}</strong></span>
                              <span style={{ color:"#666", marginLeft:"4px" }}>{a.action||""}</span>
                              {a.detail && <span style={{ color:"#999", fontSize:"10px", marginLeft:"4px" }}>{typeof a.detail==='string'?a.detail:JSON.stringify(a.detail).slice(0,40)}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {nets.length === 0 && acts.length === 0 && (
                      <div style={{ padding:"30px", textAlign:"center", color:"#999", fontSize:"13px" }}>
                        暂无上下文数据，请点击"反馈"面板操作页面后再查看
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
          {tab === "diagnostics" && (
            <div style={{ padding:"12px 16px", overflow:"auto", flex:1, maxHeight:"400px", fontSize:"12px" }}>
              {(() => {
                const ctx = actionRecorder.getAllContext();
                const resources = ctx.resources || [];
                const failedResources = resources.filter((r: any) => r.failed);
                const networks = ctx.networks || [];
                const errors = ctx.logs?.filter((l:any) => l.type === 'error' || l.type === 'react') || [];
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    <div style={{ padding:"8px", background:"#f8f9ff", borderRadius:"6px", border:"1px solid #e0e4f0" }}>
                      <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>🔧 构建部署诊断</div>
                      <div style={{ color:"#666", lineHeight:"1.8" }}>
                        <div>Bundle: <strong>{document.querySelector('script[src*="bundle"]')?.getAttribute('src')?.split('/').pop() || '未知'}</strong></div>
                        <div>Build ID: <strong>{localStorage.getItem('__app_buildId') || '无'}</strong></div>
                        <div>文档就绪: <strong style={{ color: document.readyState === 'complete' ? '#22aa66' : '#ff8800' }}>{document.readyState}</strong></div>
                        <div>在线: <strong style={{ color: navigator.onLine ? '#22aa66' : '#ff4444' }}>{navigator.onLine ? '在线' : '离线'}</strong></div>
                      </div>
                    </div>

                    <div style={{ padding:"8px", background:"#f5f8ff", borderRadius:"6px", border:"1px solid #e0e8f0" }}>
                      <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>🌐 网络诊断</div>
                      <div style={{ color:"#666", lineHeight:"1.8" }}>
                        <div>API 请求: <strong>{networks.length}</strong> 次</div>
                        <div>失败请求: <strong style={{ color: networks.filter((n:any)=>n.status>=400||n.error).length > 0 ? '#ff4444' : '#22aa66' }}>{networks.filter((n:any)=>n.status>=400||n.error).length}</strong></div>
                        <div>资源加载失败: <strong style={{ color: failedResources.length > 0 ? '#ff4444' : '#22aa66' }}>{failedResources.length}</strong></div>
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div style={{ padding:"8px", background:"#fff0f0", borderRadius:"6px", border:"1px solid #ffd0d0" }}>
                        <div style={{ fontWeight:"bold", color:"#cc0000", marginBottom:"4px", fontSize:"13px" }}>❌ 错误摘要 ({errors.length}条)</div>
                        {errors.slice(-10).reverse().map((e:any, i:number) => (
                          <div key={i} style={{ padding:"4px 0", borderBottom:"1px solid #ffe0e0", fontSize:"11px", color:"#cc0000" }}>
                            <span style={{ color:"#999" }}>[{e.ts}]</span> {e.message.slice(0, 120)}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ padding:"8px", background:"#fafafa", borderRadius:"6px", border:"1px solid #eee" }}>
                      <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>⚛ 页面组件</div>
                      <div style={{ color:"#666", fontSize:"11px" }}>
                        {location.hash || location.pathname}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* ★ v7: 代码追踪标签页 */}
          {tab === "code" && (
            <div style={{ padding:"12px 16px", overflow:"auto", flex:1, maxHeight:"400px", fontSize:"12px" }}>
              {(() => {
                const codeEvents = timelineStore.getEventsByType('code', 100);
                const renderEvents = timelineStore.getEventsByType('render', 50);
                const memoryEvents = timelineStore.getEventsByType('memory', 30);
                const renderCounts = codeTracer.getComponentRenderCounts();
                const topComponents = Object.entries(renderCounts)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 20);
                const codeEnabled = codeTracer.isEnabled();
                return (
                  <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                    {/* CodeTracer 状态 */}
                    <div style={{
                      padding:"8px", borderRadius:"6px", border:"1px solid",
                      background: codeEnabled ? '#f0faf0' : '#fff0f0',
                      borderColor: codeEnabled ? '#c0e0c0' : '#ffd0d0',
                    }}>
                      <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>
                        {codeEnabled ? '✅ CodeTracer 运行中' : '❌ CodeTracer 未启动'}
                      </div>
                      <div style={{ color:"#666", fontSize:"11px" }}>
                        已记录 {codeEvents.length} 条代码事件 · {renderEvents.length} 条渲染事件 · {memoryEvents.length} 条性能快照
                      </div>
                    </div>

                    {/* 组件渲染 TOP */}
                    {topComponents.length > 0 && (
                      <div style={{ padding:"8px", background:"#faf5ff", borderRadius:"6px", border:"1px solid #e4d0f0" }}>
                        <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>⚛ 组件渲染 TOP {topComponents.length}</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                          {topComponents.map(([name, count]) => (
                            <div key={name} style={{
                              display:"flex", justifyContent:"space-between",
                              padding:"2px 6px", fontSize:"11px",
                              background:"rgba(255,255,255,0.6)", borderRadius:"3px",
                            }}>
                              <span style={{ color:"#444", fontFamily:"monospace", fontSize:"10px" }}>{name}</span>
                              <span style={{ color:"#8844ff", fontWeight:"bold" }}>{count} 次</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Chunk 加载事件 */}
                    {codeEvents.filter(e => e.category === 'webpack_chunk').length > 0 && (
                      <div style={{ padding:"8px", background:"#f5f8ff", borderRadius:"6px", border:"1px solid #e0e8f0" }}>
                        <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>📦 Chunk 加载</div>
                        {codeEvents.filter(e => e.category === 'webpack_chunk').slice(-10).reverse().map((e, i) => (
                          <div key={i} style={{ padding:"2px 0", fontSize:"10px", color:"#666", fontFamily:"monospace" }}>
                            {e.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 性能警告 */}
                    {memoryEvents.filter(e => e.message.includes('FPS')).length > 0 && (
                      <div style={{ padding:"8px", background:"#fff8f0", borderRadius:"6px", border:"1px solid #ffe0b0" }}>
                        <div style={{ fontWeight:"bold", color:"#cc6600", marginBottom:"4px", fontSize:"13px" }}>⚠️ 性能警告</div>
                        {memoryEvents.filter(e => e.message.includes('FPS')).slice(-5).reverse().map((e, i) => (
                          <div key={i} style={{ fontSize:"11px", color:"#cc6600", padding:"2px 0" }}>
                            {e.message} · {new Date(e.ts).toLocaleTimeString()}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* DOM 变更事件 */}
                    {(() => {
                      const domChanges = timelineStore.getEventsByType('custom', 50)
                        .filter(e => e.category === 'dom_change');
                      if (domChanges.length === 0) return null;
                      return (
                        <div style={{ padding:"8px", background:"#fafafa", borderRadius:"6px", border:"1px solid #eee" }}>
                          <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>🔄 DOM 变更 ({domChanges.length} 次)</div>
                          {domChanges.slice(-8).reverse().map((e, i) => (
                            <div key={i} style={{ fontSize:"10px", color:"#888", padding:"1px 0", fontFamily:"monospace" }}>
                              {new Date(e.ts).toLocaleTimeString()}.{String(e.ts % 1000).padStart(3,'0')} — {e.message}
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* 代码事件流 */}
                    {codeEvents.length > 0 && (
                      <div style={{ padding:"8px", background:"#fcfcfc", borderRadius:"6px", border:"1px solid #eee" }}>
                        <div style={{ fontWeight:"bold", color:"#333", marginBottom:"4px", fontSize:"13px" }}>📋 代码事件流</div>
                        <div style={{ maxHeight:"150px", overflow:"auto" }}>
                          {codeEvents.slice(-20).reverse().map((e, i) => (
                            <div key={i} style={{
                              display:"flex", gap:"6px", padding:"2px 0",
                              fontSize:"10px", fontFamily:"monospace", color:"#666",
                              borderBottom:"1px solid #f0f0f0",
                            }}>
                              <span style={{ color:"#bbb", flexShrink:0, width:"45px" }}>
                                {new Date(e.ts).toLocaleTimeString().slice(-8)}
                              </span>
                              <span style={{ color:"#8844ff", flexShrink:0 }}>{e.category || ''}</span>
                              <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                                {e.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ★ v7: 用户信息标签页 */}
          {tab === "user" && (
            <div style={{ padding:"12px 16px", overflow:"auto", flex:1, maxHeight:"400px", fontSize:"12px" }}>
              <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
                {/* 用户身份 */}
                <div style={{ padding:"8px", background:"#f0f4ff", borderRadius:"6px", border:"1px solid #d0d8f0" }}>
                  <div style={{ fontWeight:"bold", color:"#333", marginBottom:"6px", fontSize:"13px" }}>👤 用户身份</div>
                  <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"4px 12px", color:"#555", fontSize:"11px" }}>
                    <span style={{ color:"#999" }}>用户 ID</span><span style={{ fontWeight:"bold", color:"#333", fontFamily:"monospace" }}>{userInfo.userId || '未登录'}</span>
                    <span style={{ color:"#999" }}>用户名</span><span style={{ fontWeight:"bold", color:"#333" }}>{userInfo.username || '未登录'}</span>
                    <span style={{ color:"#999" }}>角色</span><span>{userInfo.role || '未知'}</span>
                  </div>
                </div>

                {/* Session 信息 */}
                <div style={{ padding:"8px", background:"#f5faff", borderRadius:"6px", border:"1px solid #e0e8f0" }}>
                  <div style={{ fontWeight:"bold", color:"#333", marginBottom:"6px", fontSize:"13px" }}>🆔 会话信息</div>
                  <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"4px 12px", color:"#555", fontSize:"11px" }}>
                    <span style={{ color:"#999" }}>Session ID</span>
                    <span style={{ fontFamily:"monospace", fontSize:"10px", wordBreak:"break-all" }}>{userInfo.sessionId || '无'}</span>
                    <span style={{ color:"#999" }}>会话时长</span><span>{formatDuration(userInfo.duration)}</span>
                    <span style={{ color:"#999" }}>已收集</span><span><strong>{userInfo.events}</strong> 个事件</span>
                    <span style={{ color:"#999" }}>存储用量</span><span>{((timelineStore.getStats().storageBytes || 0) / 1024).toFixed(1)} KB</span>
                  </div>
                </div>

                {/* 事件统计 */}
                <div style={{ padding:"8px", background:"#fafafa", borderRadius:"6px", border:"1px solid #eee" }}>
                  <div style={{ fontWeight:"bold", color:"#333", marginBottom:"6px", fontSize:"13px" }}>📊 事件统计</div>
                  {(() => {
                    const counts = timelineStore.getEventCounts();
                    const typeLabels: Record<string, string> = {
                      log: '📋 日志', error: '❌ 错误', action: '👆 操作', network: '🔗 网络',
                      resource: '📦 资源', code: '💻 代码', render: '⚛ 渲染',
                      navigation: '🚦 路由', memory: '📊 性能', state: '💾 状态',
                      input: '⌨ 输入', custom: '🔧 自定义',
                    };
                    const order = ['action','navigation','input','network','error','log','code','render','memory','resource','state','custom'];
                    return (
                      <div style={{ display:"flex", flexDirection:"column", gap:"2px" }}>
                        {order.filter(k => counts[k]).map(k => (
                          <div key={k} style={{
                            display:"flex", justifyContent:"space-between",
                            padding:"3px 6px", fontSize:"11px",
                            background:"rgba(255,255,255,0.8)", borderRadius:"3px",
                          }}>
                            <span style={{ color:"#555" }}>{typeLabels[k] || k}</span>
                            <span style={{ fontWeight:"bold", color:"#333" }}>{counts[k]}</span>
                          </div>
                        ))}
                        {Object.keys(counts).length === 0 && (
                          <div style={{ color:"#999", fontSize:"11px", padding:"4px" }}>暂无数据</div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* 操作按钮 */}
                <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                  <button onClick={() => {
                    if (confirm('确定清除所有时间线数据？此操作不可撤销。')) {
                      timelineStore.reset();
                      setTimelineEvents([]);
                      setUserInfo(prev => ({ ...prev, events: 0, duration: 0 }));
                    }
                  }} style={{
                    padding:"6px 14px", borderRadius:"6px", border:"1px solid #ff4444",
                    background:"#fff", color:"#ff4444", cursor:"pointer", fontSize:"11px",
                  }}>
                    🗑 清除时间线
                  </button>
                  <button onClick={() => {
                    const stats = timelineStore.getStats();
                    alert(`Session: ${stats.sessionId}\n事件: ${stats.total}\n时长: ${formatDuration(stats.sessionDuration)}\n存储: ${(stats.storageBytes/1024).toFixed(1)} KB`);
                  }} style={{
                    padding:"6px 14px", borderRadius:"6px", border:"1px solid #4488ff",
                    background:"#f0f4ff", color:"#4488ff", cursor:"pointer", fontSize:"11px",
                  }}>
                    📋 详细信息
                  </button>
                </div>
              </div>
            </div>
          )}
          {tab === "timeline" && (
            <div style={{ padding:"0", overflow:"auto", flex:1, maxHeight:"400px", display:"flex", flexDirection:"column" }}>
              {/* ★ v7: 筛选栏 */}
              <div style={{
                display:"flex", gap:"4px", padding:"8px 12px", borderBottom:"1px solid #eee",
                flexWrap:"wrap", flexShrink:0,
              }}>
                {[
                  { key:'all', label:'全部', color:'#666' },
                  { key:'action', label:'👆操作', color:'#ff8800' },
                  { key:'network', label:'🔗网络', color:'#4488ff' },
                  { key:'error', label:'❌错误', color:'#ff4444' },
                  { key:'navigation', label:'🚦路由', color:'#22aa66' },
                  { key:'code', label:'💻代码', color:'#8844ff' },
                  { key:'render', label:'⚛渲染', color:'#44aaff' },
                  { key:'memory', label:'📊性能', color:'#888' },
                  { key:'input', label:'⌨输入', color:'#aa66cc' },
                ].map(f => (
                  <button key={f.key} onClick={() => setTimelineFilter(timelineFilter === f.key ? 'all' : f.key)}
                    style={{
                      padding:"2px 8px", borderRadius:"4px", border:"1px solid",
                      borderColor: timelineFilter === f.key ? f.color : '#ddd',
                      background: timelineFilter === f.key ? f.color : 'transparent',
                      color: timelineFilter === f.key ? '#fff' : '#666',
                      cursor:"pointer", fontSize:"10px", lineHeight:"18px",
                      transition:"all 0.15s",
                    }}
                  >{f.label}</button>
                ))}
              </div>
              {/* ★ v7: 事件时间线（带详情弹出） */}
              <div style={{ flex:1, overflow:"auto", position:"relative", padding:"4px 0" }}>
                {(() => {
                  // 筛选事件
                  let filtered = timelineEvents;
                  if (timelineFilter !== 'all') {
                    filtered = timelineEvents.filter(e => e.type === timelineFilter);
                  }
                  if (filtered.length === 0) {
                    return <div style={{ padding:"30px", textAlign:"center", color:"#999", fontSize:"13px" }}>
                      {timelineFilter === 'all' ? '暂无事件记录，操作页面后自动收集' : `无 ${timelineFilter} 类型事件`}
                    </div>;
                  }
                  // 按时间倒序
                  const sorted = [...filtered].sort((a, b) => b.ts - a.ts);
                  return (
                    <div style={{ position:"relative" }}>
                      {/* 时间线竖线 */}
                      <div style={{ position:"absolute", left:"16px", top:"0", bottom:"0", width:"2px", background:"#f0f0f0" }} />
                      {sorted.slice(0, 150).map((evt, i) => {
                        const icon = getEventIcon(evt);
                        const color = getEventColor(evt);
                        const isSelected = selectedEvent?.id === evt.id;
                        const timeAgo = formatTimeAgo(evt.ts);
                        return (
                          <div key={evt.id || i} onClick={() => setSelectedEvent(isSelected ? null : evt)}
                            style={{
                              display:"flex", gap:"6px", padding:"6px 10px 6px 32px",
                              position:"relative", fontSize:"11px", cursor:"pointer",
                              background: isSelected ? '#f0f4ff' : (i % 2 === 0 ? 'transparent' : '#fafafa'),
                              borderBottom: isSelected ? '2px solid #4488ff' : '1px solid transparent',
                              transition:"background 0.1s",
                            }}
                          >
                            <span style={{
                              position:"absolute", left:"10px", top:"10px", zIndex:1, fontSize:"10px", lineHeight:"16px",
                            }}>{icon}</span>
                            <span style={{
                              color:"#aaa", flexShrink:0, fontSize:"9px", fontFamily:"monospace",
                              width:"50px", overflow:"hidden", textOverflow:"ellipsis",
                            }}>{timeAgo}</span>
                            <span style={{
                              color:"#333", flex:1, overflow:"hidden", textOverflow:"ellipsis",
                              whiteSpace:"nowrap", fontSize:"11px",
                            }}>{evt.message || evt.category || ''}</span>
                            <span style={{
                              width:"8px", height:"8px", borderRadius:"50%",
                              background: color, flexShrink:0, marginTop:"4px",
                            }} />
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              {/* ★ v7: 事件详情面板 */}
              {selectedEvent && (
                <div style={{
                  borderTop:"2px solid #4488ff", padding:"8px 12px",
                  background:"#f8faff", flexShrink:0, maxHeight:"180px",
                  overflow:"auto", fontSize:"11px",
                }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"4px" }}>
                    <span style={{ fontWeight:"bold", color:"#333" }}>
                      {getEventIcon(selectedEvent)} 事件详情
                    </span>
                    <button onClick={() => setSelectedEvent(null)}
                      style={{ background:"none", border:"none", cursor:"pointer", color:"#999", fontSize:"14px" }}
                    >✕</button>
                  </div>
                  <div style={{ display:"grid", gridTemplateColumns:"auto 1fr", gap:"2px 8px", color:"#555" }}>
                    <span style={{ color:"#999" }}>类型</span><span>{selectedEvent.type}{selectedEvent.category ? ` / ${selectedEvent.category}` : ''}</span>
                    <span style={{ color:"#999" }}>时间</span><span>{new Date(selectedEvent.ts).toLocaleTimeString()}.{String(selectedEvent.ts % 1000).padStart(3,'0')}</span>
                    <span style={{ color:"#999" }}>消息</span><span style={{ wordBreak:"break-all" }}>{selectedEvent.message}</span>
                    {selectedEvent.url && <><span style={{ color:"#999" }}>URL</span><span style={{ wordBreak:"break-all", fontSize:"10px" }}>{selectedEvent.url}</span></>}
                    {selectedEvent.stack && <><span style={{ color:"#999" }}>堆栈</span><span style={{ fontSize:"9px", color:"#888", fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-all", maxHeight:"60px", overflow:"auto" }}>{selectedEvent.stack}</span></>}
                    {selectedEvent.data && <><span style={{ color:"#999" }}>数据</span><span style={{ fontSize:"9px", color:"#666", fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-all", maxHeight:"60px", overflow:"auto" }}>{safeStringify(selectedEvent.data)}</span></>}
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>
        )}
      </AnimatePresence>

      {/* ★ v6 keyframes & scrollbar style */}
      <style>{`
        @keyframes ar-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        [data-debug-panel] ::-webkit-scrollbar {
          width: 4px;
        }
        [data-debug-panel] ::-webkit-scrollbar-track {
          background: transparent;
        }
        [data-debug-panel] ::-webkit-scrollbar-thumb {
          background: #ddd;
          border-radius: 2px;
        }
        [data-debug-panel] ::-webkit-scrollbar-thumb:hover {
          background: #bbb;
        }
      `}</style>
    </>
  );
};

export default DebugOverlay;
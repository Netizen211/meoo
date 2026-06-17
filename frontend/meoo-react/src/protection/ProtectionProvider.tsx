/**
 * ProtectionProvider - 运行时注入防护脚本
 *
 * 读取 useProtectionConfig 的配置，在 DOM 层施加各种防护。
 * 包裹在 App 根组件外层，对所有页面生效。
 */
import React, { useEffect } from 'react';
import { useProtectionConfig } from './protectionConfig';

const WATERMARK_ID = '__meoo_watermark__';

export default function ProtectionProvider({ children }: { children: React.ReactNode }) {
  const { config } = useProtectionConfig();

  useEffect(() => {
    if (!config.enabled) {
      cleanupInjections();
      return;
    }

    const onContextMenu = (e: MouseEvent) => {
      if (config.disableRightClick) { e.preventDefault(); e.stopPropagation(); }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (config.disableF12 && e.key === 'F12') { e.preventDefault(); return false; }
      if (config.disableDevShortcuts && e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J' || e.key === 'i' || e.key === 'j')) { e.preventDefault(); return false; }
      if (config.disableDevShortcuts && e.ctrlKey && (e.key === 'U' || e.key === 'u')) { e.preventDefault(); return false; }
      if (config.disableCopy && e.ctrlKey && (e.key === 'C' || e.key === 'c' || e.key === 'X' || e.key === 'x' || e.key === 'V' || e.key === 'v')) { e.preventDefault(); return false; }
    };

    document.body.style.userSelect = config.disableSelection ? 'none' : '';
    (document.body.style).webkitUserSelect = config.disableSelection ? 'none' : '';

    const onDrag = (e: DragEvent) => { if (config.disableDrag) { e.preventDefault(); } };

    let dtInterval = null;
    if (config.detectDevTools) {
      dtInterval = setInterval(() => {
        const wd = window.outerWidth - window.innerWidth;
        const hd = window.outerHeight - window.innerHeight;
        if (wd > 160 || hd > 160) {
          if (config.devToolsAction === 'blank') {
            document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;font-size:24px;color:#666;">禁止调试</div>';
          } else if (config.devToolsAction === 'redirect') {
            window.location.href = window.location.origin;
          } else {
            alert('已检测到开发者工具，请关闭后继续使用');
          }
        }
      }, 2000);
    }

    if (config.disableConsole) {
      const noop = () => {};
      ['log','warn','error','info','debug','trace','dir','table','group','groupEnd'].forEach(k => { console[k] = noop; });
    }

    const oldWm = document.getElementById(WATERMARK_ID);
    if (oldWm) oldWm.remove();
    if (config.watermark && config.watermarkText) {
      const c = document.createElement('canvas');
      c.width = 240; c.height = 120;
      const ctx = c.getContext('2d');
      if (ctx) {
        const fs = config.watermarkFontSize || 16;
        ctx.clearRect(0,0,240,120);
        ctx.font = fs + 'px "Microsoft YaHei",sans-serif';
        ctx.fillStyle = 'rgba(0,0,0,' + (config.watermarkOpacity||0.06) + ')';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.translate(120,60);
        ctx.rotate(-0.5);
        ctx.fillText(config.watermarkText, 0, 0);
        const div = document.createElement('div');
        div.id = WATERMARK_ID;
        div.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99998;background-image:url(' + c.toDataURL() + ');background-repeat:repeat;';
        document.body.appendChild(div);
      }
    }

    if (config.timeRestrict && config.timeStart && config.timeEnd) {
      const now = new Date();
      const cur = now.getHours()*60 + now.getMinutes();
      const [sh,sm] = config.timeStart.split(':').map(Number);
      const [eh,em] = config.timeEnd.split(':').map(Number);
      if (cur < sh*60+sm || cur > eh*60+em) {
        document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f1223;color:#94a3b8;"><div style="font-size:48px;margin-bottom:16px;">🛡️</div><h1 style="font-size:20px;color:#e2e8f0;margin-bottom:8px;">非开放时间</h1><p style="font-size:14px;">系统仅在北京时间 ' + config.timeStart + ' ~ ' + config.timeEnd + ' 期间开放访问</p><p style="font-size:12px;margin-top:8px;color:#64748b;">当前时间：' + now.toLocaleTimeString('zh-CN',{hour12:false}) + '</p></div>';
      }
    }

    // 代理/VPN 检测（仅启用时生效）
    if (config.blockProxyVpn) {
      detectProxyVpn(config.proxyVpnAction || 'warn');
    }

    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('dragstart', onDrag);
    document.addEventListener('drop', onDrag);

    return () => {
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('dragstart', onDrag);
      document.removeEventListener('drop', onDrag);
      if (dtInterval) clearInterval(dtInterval);
      const w = document.getElementById(WATERMARK_ID);
      if (w) w.remove();
      document.body.style.userSelect = '';
    };
  }, [config]);

  return React.createElement(React.Fragment, null, children);
}

function cleanupInjections() {
  document.body.style.userSelect = '';
  const w = document.getElementById(WATERMARK_ID);
  if (w) w.remove();
}

/** 简易代理/VPN 检测 */
function detectProxyVpn(action: 'warn' | 'redirect' | 'blank') {
  // 检测信号：webdriver 标记、Connection 类型、WebRTC 暴露公网 IP
  let detected = false;
  const reasons: string[] = [];

  if ((navigator as any).webdriver) {
    detected = true;
    reasons.push('自动化工具');
  }

  // 通过 RTCPeerConnection 检测 WebRTC 泄露的公网 IP
  try {
    const pc = new (window.RTCPeerConnection || (window as any).webkitRTCPeerConnection)({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then((offer: any) => pc.setLocalDescription(offer)).catch(() => {});
    pc.onicecandidate = (e: RTCPeerConnectionIceEvent) => {
      if (e.candidate && e.candidate.candidate) {
        const ipMatch = e.candidate.candidate.match(/(?:[0-9]{1,3}\.){3}[0-9]{1,3}/);
        if (ipMatch) {
          const ip = ipMatch[0];
          // 不是内网 IP 段，说明暴露了真实 IP（可能通过代理/VPN）
          if (!ip.startsWith('10.') && !ip.startsWith('192.168.') && !ip.startsWith('172.1') && !ip.startsWith('127.')) {
            detected = true;
            reasons.push('疑似代理/VPN');
          }
        }
      }
      pc.close();
    };
  } catch (_) {}

  // 延迟执行检测结果，等页面渲染完毕
  setTimeout(() => {
    if (!detected) return;
    const msg = '检测到代理或VPN工具访问，' + reasons.join('、') + '。如确认安全可关闭此检测。';
    if (action === 'blank') {
      document.body.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0f1223;color:#94a3b8;"><div style="font-size:48px;margin-bottom:16px;">🛡️</div><h1 style="font-size:20px;color:#e2e8f0;margin-bottom:8px;">代理/VPN 访问受限</h1><p style="font-size:14px;">' + msg + '</p></div>';
    } else if (action === 'redirect') {
      window.location.href = window.location.origin;
    } else {
      alert(msg);
    }
  }, 500);
}


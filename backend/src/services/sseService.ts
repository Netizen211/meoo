/**
 * SSE (Server-Sent Events) 实时推送服务
 *
 * 用于向前端推送：上传进度、同步状态、系统通知
 * 比 WebSocket 更轻量，单向推送，自动重连
 */
import { Request, Response } from 'express';
import logger from './loggerService';

interface SSEClient {
  id: string;
  userId: string;
  res: Response;
  createdAt: number;
}

const clients = new Map<string, SSEClient>();

// 定时清理僵尸连接（每 60 秒）
setInterval(() => {
  const now = Date.now();
  for (const [id, client] of clients.entries()) {
    if (now - client.createdAt > 300000) { // 5 分钟超时
      try { client.res.end(); } catch { /* ignore */ }
      clients.delete(id);
    }
  }
}, 60000).unref();

export const sse = {
  /** 建立 SSE 连接 */
  connect(req: Request, res: Response): void {
    const userId = (req as any).user?.userId || 'anonymous';
    const clientId = `${userId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 Nginx 缓冲
    });

    // SSE 协议：event + data + 空行
    res.write(`event: connected\ndata: {"clientId":"${clientId}"}\n\n`);

    clients.set(clientId, { id: clientId, userId, res, createdAt: Date.now() });
    logger.debug('SSE client connected', { extra: { clientId, userId } as any });

    req.on('close', () => {
      clients.delete(clientId);
      logger.debug('SSE client disconnected', { extra: { clientId } as any });
    });
  },

  /** 向指定用户的所有连接推送事件 */
  sendToUser(userId: string, event: string, data: any): number {
    let sent = 0;
    for (const client of clients.values()) {
      if (client.userId === userId) {
        try {
          client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          sent++;
        } catch { clients.delete(client.id); }
      }
    }
    return sent;
  },

  /** 广播给所有连接 */
  broadcast(event: string, data: any): number {
    let sent = 0;
    for (const client of clients.values()) {
      try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
        sent++;
      } catch { clients.delete(client.id); }
    }
    return sent;
  },

  /** 获取连接统计 */
  stats(): { total: number; byUser: Record<string, number> } {
    const byUser: Record<string, number> = {};
    for (const c of clients.values()) {
      byUser[c.userId] = (byUser[c.userId] || 0) + 1;
    }
    return { total: clients.size, byUser };
  },
};

export default sse;
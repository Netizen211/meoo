/**
 * 结构化日志服务 — 请求追踪 + 级别过滤 + JSON 输出
 *
 * 每条日志自动附加：
 * - requestId: 全链路追踪标识
 * - timestamp: ISO 8601 毫秒精度
 * - level: DEBUG | INFO | WARN | ERROR | FATAL
 *
 * 生产环境输出 JSON（可接入 ELK / Datadog / Splunk）
 * 开发环境输出彩色人类可读格式
 */
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  requestId?: string;
  userId?: string;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  error?: string;
  stack?: string;
  extra?: Record<string, any>;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, FATAL: 4,
};

const MIN_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) ||
  (process.env.NODE_ENV === 'production' ? 'INFO' : 'DEBUG');

const isProduction = process.env.NODE_ENV === 'production';

function formatEntry(entry: LogEntry): string {
  if (isProduction) {
    return JSON.stringify(entry);
  }
  const colors: Record<LogLevel, string> = {
    DEBUG: '\x1b[36m',
    INFO: '\x1b[32m',
    WARN: '\x1b[33m',
    ERROR: '\x1b[31m',
    FATAL: '\x1b[35m',
  };
  const c = colors[entry.level];
  const r = '\x1b[0m';
  const rid = entry.requestId ? ` [${entry.requestId.slice(0, 8)}]` : '';
  const dur = entry.durationMs !== undefined ? ` ${entry.durationMs}ms` : '';
  const status = entry.statusCode ? ` ${entry.statusCode}` : '';
  const method = entry.method ? ` ${entry.method}` : '';
  const path = entry.path || '';
  return `${c}${entry.level}${r}${rid}${method} ${path}${status}${dur} ${entry.message}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[MIN_LEVEL];
}

function log(level: LogLevel, message: string, extra?: Partial<LogEntry>): void {
  if (!shouldLog(level)) return;
  const entry: LogEntry = {
    level, message,
    timestamp: new Date().toISOString(),
    ...extra,
  };
  const output = formatEntry(entry);
  switch (level) {
    case 'ERROR': case 'FATAL': console.error(output); break;
    case 'WARN': console.warn(output); break;
    default: console.log(output);
  }
}

export const logger = {
  debug: (msg: string, extra?: Partial<LogEntry>) => log('DEBUG', msg, extra),
  info: (msg: string, extra?: Partial<LogEntry>) => log('INFO', msg, extra),
  warn: (msg: string, extra?: Partial<LogEntry>) => log('WARN', msg, extra),
  error: (msg: string, extra?: Partial<LogEntry>) => log('ERROR', msg, extra),
  fatal: (msg: string, extra?: Partial<LogEntry>) => log('FATAL', msg, extra),
};

// ─── Express 中间件：请求追踪 ─────────────────────────

export function requestTracker(req: Request, res: Response, next: () => void): void {
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  const startTime = Date.now();
  (req as any).requestId = requestId;
  res.setHeader('x-request-id', requestId);
  logger.debug('→', {
    requestId, method: req.method, path: req.originalUrl,
    userId: (req as any).user?.userId,
  });
  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    if (res.statusCode >= 500) {
      logger.error('←', { requestId, method: req.method, path: req.originalUrl, statusCode: res.statusCode, durationMs, userId: (req as any).user?.userId });
    } else if (res.statusCode >= 400) {
      logger.warn('←', { requestId, method: req.method, path: req.originalUrl, statusCode: res.statusCode, durationMs, userId: (req as any).user?.userId });
    } else {
      logger.info('←', { requestId, method: req.method, path: req.originalUrl, statusCode: res.statusCode, durationMs, userId: (req as any).user?.userId });
    }
  });
  next();
}

export default logger;

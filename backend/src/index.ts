import express, { Request, Response } from 'express';
import path from 'path';
import compression from 'compression';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { testConnection, startKeepAlive, destroyPool } from './db';
import { errorHandler } from './middleware/errorHandler';
import { tenantContext } from './middleware/tenantContext';
import { installTenantQueryScope } from './middleware/tenantContext';
import { requestTracker } from './services/loggerService';
import logger from './services/loggerService';
import { startClusterCacheInvalidation } from './services/cacheService';
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import membershipRoutes from './routes/membership';
import storeRoutes from './routes/stores';
import adminRoutes from './routes/admin';
import rechargeRoutes from './routes/recharge';
import analyticsRoutes from './routes/analytics';
import subAccountRoutes from './routes/subAccounts';
import sseRoutes from './routes/sse';
import { startCleanupCron } from './services/cleanupService';
import { startRiskDetection } from './services/riskDetectionService';
import bcrypt from 'bcrypt';
import { db } from './db';
import { requireAuth } from './middleware/auth';
import { requireRole } from './middleware/requireRole';
import fs from 'fs';

// ★ 安装 Knex 租户隔离查询注入（全局生效）
installTenantQueryScope();

// ===== 全局异常捕获（使用结构化日志） =====
process.on('uncaughtException', (err: Error) => {
  logger.fatal('Uncaught Exception', { error: err.message, stack: err.stack });
});

process.on('unhandledRejection', (reason: any, _promise: Promise<any>) => {
  logger.error('Unhandled Rejection', { error: reason?.message || String(reason), stack: reason?.stack });
});

// ===== 优雅关闭 =====
let server: ReturnType<typeof app.listen> | null = null;

async function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info('HTTP server closed');
    });
  }
  await destroyPool();
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ===== 确保管理员账号存在 =====
async function ensureAdminUser() {
  try {
    const adminUsername = '17516299920';
    const existing = await db('users').where('username', adminUsername).first();
    if (!existing) {
      const passwordHash = await bcrypt.hash('Aa17516299920', 12);
      await db('users').insert({
        id: 'admin-001',
        username: adminUsername,
        password_hash: passwordHash,
        role: 'admin',
        membership_level: 'enterprise',
        phone: '',
      });
      logger.info('Admin user created: 17516299920');
    } else if (existing.role !== 'admin') {
      await db('users').where('username', adminUsername).update({ role: 'admin' });
      logger.info('Admin user role updated to admin');
    } else {
      logger.debug('Admin user already exists');
    }
  } catch (err: any) {
    logger.error('Failed to ensure admin user', { error: err.message });
  }
}

const app = express();

// 信任 Nginx 反向代理（修复 express-rate-limit X-Forwarded-For 告警）
app.set('trust proxy', 1);

// ===== 安全中间件栈 (按高→低优先级排列) =====

// 0. 请求追踪 — 第一个中间件，为所有后续日志注入 requestId
app.use(requestTracker);

// 1. Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: false, // CSP 在 Nginx 层处理
}));

// 2. Gzip/Brotli 压缩 — JSON 响应体积减少 70-90%
app.use(compression({
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  },
}));

// 3. CORS
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (config.cors.allowedOrigins.includes(origin) || config.cors.allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

// 4. 请求体解析（限制大小防内存炸弹，100MB 满足大CSV上传需求）
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
// 产品图片静态目录
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// 5. 全局限流
const globalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
});
app.use('/api/', globalLimiter);

// 6. 健康检查增强版（不限流）
app.get('/api/v1/health', async (_req, res) => {
  const dbOk = await testConnection();
  const memUsage = process.memoryUsage();
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    db: dbOk ? 'connected' : 'disconnected',
    memory: {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
    },
    nodeVersion: process.version,
    pid: process.pid,
  });
});

// 向后兼容旧 health 端点
app.get('/api/health', async (_req, res) => {
  const dbOk = await testConnection();
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'disconnected',
    version: '1.0',
  });
});

// ===== API 路由 =====

// 登录限流更严格
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请 1 分钟后再试' },
});

// ===== API 路由 (v1 — 当前版本) =====

// ★ 租户上下文中间件（业务路由统一注入）
// 使用 /api/v1/ 前缀进行 API 版本控制
const API_V1 = '/api/v1';

app.use(`${API_V1}/data`, tenantContext, dataRoutes);
app.use(`${API_V1}/membership`, tenantContext, membershipRoutes);
app.use(`${API_V1}/stores`, tenantContext, storeRoutes);

// ─── Reports 路由（放在 adminRoutes 前面，避免子路由匹配问题） ─────
const REPORTS_DIR = path.resolve(__dirname, 'reports');
const REPORT_TITLES: Record<string, string> = {
  'ui-feasibility-report.html': 'UI可配置化可行性分析报告',
};

app.get(`${API_V1}/admin/reports`, tenantContext, requireAuth, requireRole('admin', 'test'), (_req, res) => {
  try {
    if (!fs.existsSync(REPORTS_DIR)) {
      res.json({ success: true, data: [] });
      return;
    }
    const files = fs.readdirSync(REPORTS_DIR)
      .filter((f: string) => f.endsWith('.html'))
      .map((f: string) => {
        const stat = fs.statSync(path.join(REPORTS_DIR, f));
        return {
          id: f.replace('.html', ''),
          name: f,
          title: REPORT_TITLES[f] || f.replace('.html', ''),
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
        };
      });
    res.json({ success: true, data: files });
  } catch {
    res.status(500).json({ success: false, error: '获取报告列表失败' });
  }
});

app.get(`${API_V1}/admin/reports/:id`, tenantContext, requireAuth, requireRole('admin', 'test'), (req, res) => {
  try {
    const { id } = req.params;
    const safeId = path.basename(id.replace(/\.\./g, ''));
    const filePath = path.join(REPORTS_DIR, safeId.endsWith('.html') ? safeId : safeId + '.html');
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: '报告不存在' });
      return;
    }
    const html = fs.readFileSync(filePath, 'utf-8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch {
    res.status(500).json({ success: false, error: '读取报告失败' });
  }
});

app.use(`${API_V1}/admin`, tenantContext, adminRoutes);
app.use(`${API_V1}/recharge`, tenantContext, rechargeRoutes);
app.use(`${API_V1}/analytics`, tenantContext, analyticsRoutes);
app.use(`${API_V1}/sub-accounts`, tenantContext, subAccountRoutes);
app.use(`${API_V1}/sse`, tenantContext, sseRoutes);  // ★ SSE 实时推送

// auth 路由单独处理（不含 tenantContext，因登录时尚未有完整上下文）
app.use(`${API_V1}/auth`, loginLimiter, authRoutes);

// ─── 公开设置 — 无需登录 ───
app.get(`${API_V1}/settings/public`, async (_req: Request, res: Response) => {
  try {
    const rows = await db('system_configs').select('config_key', 'config_value');
    const cfg: Record<string, string> = {};
    for (const row of rows as any[]) cfg[row.config_key] = row.config_value;
    res.json({
      success: true,
      data: {
        copyEnabled: cfg.copy_enabled !== 'false',
      },
    });
  } catch {
    res.status(500).json({ success: false, error: '获取设置失败' });
  }
});

// ─── 向后兼容：旧版 /api/ 路径自动重定向到 /api/v1/ ───
// 这样旧客户端不会突然全部报错，而是渐进式迁移
const LEGACY_MOUNTS: Array<{ path: string; router: any }> = [
  { path: '/api/data', router: dataRoutes },
  { path: '/api/membership', router: membershipRoutes },
  { path: '/api/stores', router: storeRoutes },
  { path: '/api/admin', router: adminRoutes },
  { path: '/api/recharge', router: rechargeRoutes },
  { path: '/api/analytics', router: analyticsRoutes },
  { path: '/api/sub-accounts', router: subAccountRoutes },
];

for (const { path, router } of LEGACY_MOUNTS) {
  app.use(path, tenantContext, (req, res, next) => {
    // 设置 deprecation 头提醒客户端升级
    res.setHeader('X-API-Deprecated', 'true');
    res.setHeader('X-API-Version', '1.0');
    next();
  }, router);
}
app.use('/api/auth', loginLimiter, (req, res, next) => {
  res.setHeader('X-API-Deprecated', 'true');
  next();
}, authRoutes);

// 全局错误处理
app.use(errorHandler);

// ===== 启动 =====

const PORT = config.port;

server = app.listen(PORT, async () => {
  logger.info(`Server running on port ${PORT}`, {
    extra: {
      env: config.nodeEnv,
      cors: config.cors.allowedOrigins,
      dbPoolMin: config.db.poolMin,
      dbPoolMax: config.db.poolMax,
      dbSocket: config.db.socketPath || `TCP ${config.db.host}:${config.db.port}`,
      apiVersion: 'v1',
    } as any,
  });

  // 启动连接池保活（防止 MySQL wait_timeout 断连）
  startKeepAlive();

  // ★ 启动 PM2 集群缓存失效同步（跨进程广播）
  startClusterCacheInvalidation();

  // 确保管理员账号存在
  await ensureAdminUser();

  // 启动定时清理任务（生产环境）
  if (config.nodeEnv === 'production') {
    startCleanupCron();
    startRiskDetection();
  }

  logger.info('Ready ✓');
});

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { testConnection } from './db';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import dataRoutes from './routes/data';
import membershipRoutes from './routes/membership';
import storeRoutes from './routes/stores';
import adminRoutes from './routes/admin';
import rechargeRoutes from './routes/recharge';
import analyticsRoutes from './routes/analytics';
import subAccountRoutes from './routes/subAccounts';
import { startCleanupCron } from './services/cleanupService';

const app = express();

// ===== 安全中间件栈 =====

// 1. Helmet 安全头
app.use(helmet({
  contentSecurityPolicy: false, // CSP 在 Nginx 层处理
}));

// 2. CORS
app.use(cors({
  origin: (origin, callback) => {
    // 允许无 origin 的请求（如 curl、Postman、移动端）
    if (!origin) return callback(null, true);
    if (config.cors.allowedOrigins.includes(origin) || config.cors.allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  credentials: true,
}));

// 3. 请求体解析（限制大小防内存炸弹）
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// 4. 全局限流
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 分钟
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试' },
});
app.use('/api/', globalLimiter);

// 5. 健康检查（不限流）
app.get('/api/health', async (_req, res) => {
  const dbOk = await testConnection();
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    db: dbOk ? 'connected' : 'disconnected',
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

// ===== 路由 =====
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/recharge', rechargeRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/sub-accounts', subAccountRoutes);

// 全局错误处理
app.use(errorHandler);

// ===== 启动 =====

const PORT = config.port;

app.listen(PORT, () => {
  console.log(`[meoo-server] Running on port ${PORT}`);
  console.log(`[meoo-server] Environment: ${config.nodeEnv}`);
  console.log(`[meoo-server] CORS origins: ${config.cors.allowedOrigins.join(', ')}`);

  if (config.nodeEnv === 'development') {
    console.log('[meoo-server] JWT secret is using default (development only)');
  }

  // 启动定时清理任务（生产环境）
  if (config.nodeEnv === 'production') {
    startCleanupCron();
  }
});

export default app;

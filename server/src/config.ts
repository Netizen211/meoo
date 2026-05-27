import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpires: process.env.JWT_ACCESS_EXPIRES || '15m',
    refreshExpires: process.env.JWT_REFRESH_EXPIRES || '7d',
  },

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'meoo_dev',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10),
  },

  cors: {
    allowedOrigins: (process.env.ALLOWED_ORIGINS || 'http://localhost:3015').split(',').map(s => s.trim()),
  },

  admin: {
    usernames: (process.env.ADMIN_USERNAMES || 'admin').split(',').map(s => s.trim()),
  },

  // 会员过期宽限期（天数）
  membership: {
    proGraceDays: 30,       // Pro 到期后保留数据 30 天
    reminderDays: 7,        // 到期前 7 天开始提醒
    freeDataTTLDays: 3,     // 免费用户数据 3 天过期
  },

  // 测试账号
  testAccount: {
    username: '123456',
    password: '123456',
    role: 'test' as const,
    membershipLevel: 'enterprise' as const,
  },
};

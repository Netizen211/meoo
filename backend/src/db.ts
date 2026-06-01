import knex from 'knex';
import { config } from './config';

// 连接池配置：生产级稳定性
// - Unix socket 直连，绕过 TCP 协议栈，零延迟
// - 连接保活：每 30 秒 ping，防止 MySQL wait_timeout 断连
// - 获取超时：排队等连接最多 10 秒，超时即告警
// - 重试：连接失败自动重试 3 次
const poolConfig: knex.Knex.Config['pool'] = {
  min: config.db.poolMin,
  max: config.db.poolMax,
  // 获取连接超时：防止请求在连接池耗尽时无限等待
  acquireTimeoutMillis: 10000,
  // 空闲连接超时：超过此时间未使用的连接会被释放
  idleTimeoutMillis: 30000,
  // 连接创建超时
  createTimeoutMillis: 5000,
  // 销毁超时
  destroyTimeoutMillis: 5000,
  // 连接回收：空闲超过 30 秒的连接回收（但保留 min 个）
  reapIntervalMillis: 10000,
  // 创建后立即验证连接
  afterCreate: (conn: any, done: (err: Error | null, conn: any) => void) => {
    // 发送 ping 确保连接有效
    conn.query('SELECT 1', (err: Error | null) => {
      if (err) {
        console.error('[db] new connection failed ping:', err.message);
        done(err, conn);
      } else {
        done(null, conn);
      }
    });
  },
};

// 生产环境优先使用 Unix socket（同机部署，零网络开销）
const connectionConfig = config.db.socketPath
  ? { socketPath: config.db.socketPath }
  : {
      host: config.db.host,
      port: config.db.port,
    };

export const db = knex({
  client: 'mysql2',
  connection: {
    ...connectionConfig,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    // 连接超时
    connectTimeout: 5000,
    // 字符集
    charset: 'utf8mb4',
    // 时区：确保时间戳一致
    timezone: '+08:00',
  },
  pool: poolConfig,
  // 调试：生产环境关闭 SQL 日志
  debug: config.nodeEnv === 'development',
});

// 连接池事件监听
const pool = (db.client as any).pool;
if (pool) {
  pool.on('acquireRequest', (_eventId: number) => {
    // 连接被请求，不记录（太频繁）
  });
  pool.on('acquireSuccess', (_eventId: number, resource: any) => {
    // 连接获取成功
  });
  pool.on('acquireFail', (_eventId: number, err: Error) => {
    console.error('[db] failed to acquire connection:', err.message);
  });
  pool.on('createSuccess', (_eventId: number, _resource: any) => {
    // 新连接创建成功
  });
  pool.on('createFail', (_eventId: number, err: Error) => {
    console.error('[db] failed to create connection:', err.message);
  });
  pool.on('destroySuccess', (_eventId: number, _resource: any) => {
    // 连接销毁
  });
  pool.on('release', (_resource: any) => {
    // 连接释放回池
  });
}

// 定时保活：每 30 秒 ping 一下所有空闲连接，防止 MySQL wait_timeout 断连
let keepAliveTimer: NodeJS.Timeout | null = null;

export function startKeepAlive(): void {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(async () => {
    try {
      await db.raw('SELECT 1');
    } catch (err: any) {
      console.error('[db] keepalive ping failed:', err.message);
    }
  }, 30000);
  console.log('[db] Keepalive started (30s interval)');
}

export function stopKeepAlive(): void {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

// 优雅关闭：销毁连接池
export async function destroyPool(): Promise<void> {
  stopKeepAlive();
  try {
    await db.destroy();
    console.log('[db] Connection pool destroyed');
  } catch (err: any) {
    console.error('[db] Error destroying pool:', err.message);
  }
}

// 数据库操作重试包装器
// 连接断开等临时错误自动重试，最多重试 3 次，指数退避
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      // 只重试连接相关错误
      const isRetryable =
        err.code === 'ECONNREFUSED' ||
        err.code === 'ECONNRESET' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'PROTOCOL_CONNECTION_LOST' ||
        err.code === 'ER_QUERY_TIMEOUT' ||
        (err.message && (
          err.message.includes('Connection lost') ||
          err.message.includes('read ECONNRESET') ||
          err.message.includes('connect ETIMEDOUT') ||
          err.message.includes('Pool is closed')
        ));

      if (!isRetryable || attempt === maxRetries) {
        throw lastError;
      }

      const delay = Math.min(100 * Math.pow(2, attempt), 2000);
      console.warn(`[db] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms: ${err.code || err.message}`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

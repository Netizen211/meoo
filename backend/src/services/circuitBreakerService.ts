/**
 * 断路器服务 — 防止级联故障
 *
 * 当数据库连续失败达到阈值，自动"熔断"：
 * - 后续请求直接返回 503，不再访问数据库
 * - 等待冷却时间后，允许探测请求通过
 * - 探测成功 → 断路器关闭，恢复正常
 *
 * 三态模型: CLOSED(正常) → OPEN(熔断) → HALF_OPEN(探测) → CLOSED
 */
import logger from './loggerService';

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitConfig {
  name: string;
  failureThreshold: number;    // 连续失败多少次则熔断
  cooldownMs: number;          // 熔断后多久进入半开状态
  halfOpenMaxRequests: number; // 半开状态最多允许几个探测请求
  timeoutMs: number;           // 操作超时时间
}

class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime = 0;
  private halfOpenRequests = 0;
  private config: CircuitConfig;

  constructor(config: CircuitConfig) {
    this.config = config;
  }

  /**
   * 执行受保护的操作
   * @returns 操作结果，或抛出断路器打开错误
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      // 检查是否到了冷却时间
      if (Date.now() - this.lastFailureTime >= this.config.cooldownMs) {
        logger.info(`Circuit [${this.config.name}]: OPEN → HALF_OPEN (cooldown elapsed)`);
        this.state = 'HALF_OPEN';
        this.halfOpenRequests = 0;
      } else {
        const remainingMs = this.config.cooldownMs - (Date.now() - this.lastFailureTime);
        throw new CircuitOpenError(
          `服务暂时不可用，请 ${Math.ceil(remainingMs / 1000)} 秒后重试`,
          this.config.name
        );
      }
    }

    if (this.state === 'HALF_OPEN') {
      if (this.halfOpenRequests >= this.config.halfOpenMaxRequests) {
        throw new CircuitOpenError('服务正在恢复中，请稍后重试', this.config.name);
      }
      this.halfOpenRequests++;
    }

    // 超时保护
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${this.config.timeoutMs}ms`)), this.config.timeoutMs)
    );

    try {
      const result = await Promise.race([operation(), timeoutPromise]);
      this.onSuccess();
      return result;
    } catch (err: any) {
      this.onFailure(err);
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit [${this.config.name}]: HALF_OPEN → CLOSED (probe succeeded)`);
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  private onFailure(err: Error): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      logger.warn(`Circuit [${this.config.name}]: HALF_OPEN probe failed, re-opening`);
      this.state = 'OPEN';
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      logger.error(`Circuit [${this.config.name}]: CLOSED → OPEN (${this.failureCount} consecutive failures)`, {
        error: err.message,
      });
      this.state = 'OPEN';
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string, public circuitName: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}

// ─── 预配置的断路器实例 ────────────────────────────

/** 数据库操作断路器 */
export const dbCircuit = new CircuitBreaker({
  name: 'mysql-db',
  failureThreshold: 5,      // 连续 5 次失败熔断
  cooldownMs: 30000,        // 30 秒冷却
  halfOpenMaxRequests: 2,   // 最多 2 个探测请求
  timeoutMs: 10000,         // 数据库操作 10 秒超时
});

/** 分析计算断路器（计算密集，保护 CPU） */
export const analyticsCircuit = new CircuitBreaker({
  name: 'analytics',
  failureThreshold: 3,
  cooldownMs: 60000,        // 1 分钟冷却
  halfOpenMaxRequests: 1,
  timeoutMs: 30000,         // 计算 30 秒超时
});

export default { dbCircuit, analyticsCircuit, CircuitBreaker, CircuitOpenError };

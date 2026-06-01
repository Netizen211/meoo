/**
 * 数据库事务包装器
 *
 * 所有多表写操作必须包裹在 transaction() 中，
 * 确保要么全部成功要么全部回滚。
 *
 * 用法：
 *   await transaction(async (trx) => {
 *     await trx('stores').insert({...});
 *     await trx('store_data').insert({...});
 *   });
 */
import { db } from '../db';
import type { Knex } from 'knex';
import logger from './loggerService';

export type TxOrDb = Knex | Knex.Transaction;

/**
 * 执行事务 — 自动 commit/rollback
 * 发生任何错误（包括 throw）都会自动回滚
 */
export async function transaction<T>(
  operation: (trx: Knex.Transaction) => Promise<T>,
  options?: { isolationLevel?: string }
): Promise<T> {
  const trx = await db.transaction();

  // 设置隔离级别（MySQL 默认 REPEATABLE READ）
  if (options?.isolationLevel) {
    await trx.raw(`SET TRANSACTION ISOLATION LEVEL ${options.isolationLevel}`);
  }

  try {
    const result = await operation(trx);
    await trx.commit();
    return result;
  } catch (err: any) {
    // 回滚失败也记录
    try {
      await trx.rollback();
    } catch (rollbackErr: any) {
      logger.error('Transaction rollback failed', {
        error: rollbackErr.message,
        extra: { originalError: err.message },
      });
    }
    throw err; // 重新抛出，让上层处理
  }
}

/**
 * 便捷方法：在已有事务或新连接中执行
 * 如果传入了 trx 就用它，否则用普通 db
 */
export function query(trx?: Knex.Transaction): Knex | Knex.Transaction {
  return trx || db;
}

export default { transaction, query };

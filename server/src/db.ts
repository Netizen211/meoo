import knex from 'knex';
import { config } from './config';

export const db = knex({
  client: 'mysql2',
  connection: {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
  },
  pool: {
    min: config.db.poolMin,
    max: config.db.poolMax,
  },
});

export async function testConnection(): Promise<boolean> {
  try {
    await db.raw('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

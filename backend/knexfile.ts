import { config } from './src/config';
import type { Knex } from 'knex';

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'mysql2',
    connection: {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    },
    migrations: {
      directory: './src/migrations',
      extension: 'ts',
    },
  },
  production: {
    client: 'mysql2',
    connection: {
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    },
    migrations: {
      directory: './src/migrations',
      extension: 'ts',
    },
  },
};

export default knexConfig;

import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ===== 性能索引 =====

  // store_data: 按分类查询的速度优化
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_store_data_category ON store_data(category)'
  ).catch(() => {});

  // store_configs: 按 config_key 查询
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_store_configs_key ON store_configs(config_key)'
  ).catch(() => {});

  // upload_records: 按上传时间排序
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_upload_records_uploaded_at ON upload_records(uploaded_at)'
  ).catch(() => {});

  // users: 按角色查询（管理员列表等）
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)'
  ).catch(() => {});

  // refresh_tokens: 按过期时间清理
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at)'
  ).catch(() => {});

  // admin_logs: 按时间范围查询
  await knex.schema.raw(
    'CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON admin_logs(created_at)'
  ).catch(() => {});

  // ===== 缓存失效协调表（PM2 集群跨进程） =====
  await knex.schema.createTableIfNotExists('cache_invalidations', (table) => {
    table.bigIncrements('id');
    table.string('cache_key_pattern', 255).notNullable();
    table.dateTime('invalidated_at').notNullable().defaultTo(knex.fn.now());
    table.index('invalidated_at');
  });

  console.log('[migration:006] Performance indexes created');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cache_invalidations');
  console.log('[migration:006] Performance indexes removed');
}

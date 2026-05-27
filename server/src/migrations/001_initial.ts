import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 用户表
  await knex.schema.createTable('users', (table) => {
    table.string('id', 36).primary();
    table.string('username', 64).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.enu('role', ['normal', 'test', 'admin']).notNullable().defaultTo('normal');
    table.enu('membership_level', ['free', 'pro', 'enterprise']).notNullable().defaultTo('free');
    table.dateTime('membership_expires_at').nullable();
    table.boolean('is_banned').notNullable().defaultTo(false);
    table.string('banned_reason', 255).nullable();
    table.string('phone', 20).defaultTo('');
    table.string('invite_code', 36).nullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // 刷新令牌表
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 36).notNullable();
    table.string('token_hash', 255).notNullable();
    table.dateTime('expires_at').notNullable();
    table.dateTime('revoked_at').nullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('user_id');
  });

  // 店铺表
  await knex.schema.createTable('stores', (table) => {
    table.string('id', 36).primary();
    table.string('user_id', 36).notNullable();
    table.string('name', 128).notNullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('user_id');
  });

  // 店铺数据表（8个分类，使用 JSON 存储）
  await knex.schema.createTable('store_data', (table) => {
    table.bigIncrements('id');
    table.string('store_id', 36).notNullable();
    table.string('category', 32).notNullable();
    table.text('payload_json', 'mediumtext').notNullable();
    table.integer('row_count').notNullable().defaultTo(0);
    table.dateTime('uploaded_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('store_id').references('id').inTable('stores').onDelete('CASCADE');
    table.unique(['store_id', 'category'], 'uk_store_category');
    table.index('store_id');
  });

  // 店铺配置表
  await knex.schema.createTable('store_configs', (table) => {
    table.bigIncrements('id');
    table.string('store_id', 36).notNullable();
    table.string('config_key', 64).notNullable();
    table.text('payload_json', 'mediumtext').notNullable();
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('store_id').references('id').inTable('stores').onDelete('CASCADE');
    table.unique(['store_id', 'config_key'], 'uk_store_config');
    table.index('store_id');
  });

  // 店铺可用字段表
  await knex.schema.createTable('store_available_fields', (table) => {
    table.bigIncrements('id');
    table.string('store_id', 36).notNullable();
    table.string('field_source', 16).notNullable();
    table.text('fields_json').notNullable();
    table.foreign('store_id').references('id').inTable('stores').onDelete('CASCADE');
    table.unique(['store_id', 'field_source'], 'uk_store_source');
    table.index('store_id');
  });

  // 上传记录表
  await knex.schema.createTable('upload_records', (table) => {
    table.string('id', 64).primary();
    table.string('user_id', 36).notNullable();
    table.string('store_id', 36).notNullable();
    table.string('store_name', 128).notNullable();
    table.string('file_name', 256).notNullable();
    table.string('file_type', 32).notNullable();
    table.integer('row_count').notNullable().defaultTo(0);
    table.integer('field_count').notNullable().defaultTo(0);
    table.dateTime('uploaded_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.foreign('store_id').references('id').inTable('stores').onDelete('CASCADE');
    table.index(['user_id', 'store_id']);
  });

  // 邀请码表
  await knex.schema.createTable('invite_codes', (table) => {
    table.bigIncrements('id');
    table.string('code', 32).notNullable().unique();
    table.string('batch_id', 36).nullable();
    table.string('created_by', 36).notNullable();
    table.string('used_by', 64).nullable();
    table.dateTime('used_at').nullable();
    table.boolean('is_used').notNullable().defaultTo(false);
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('code');
  });

  // 管理员操作日志表
  await knex.schema.createTable('admin_logs', (table) => {
    table.bigIncrements('id');
    table.string('admin_id', 36).notNullable();
    table.string('action', 64).notNullable();
    table.string('target_type', 32).notNullable();
    table.string('target_id', 64).nullable();
    table.text('details').nullable();
    table.string('ip_address', 45).nullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.foreign('admin_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('admin_id');
    table.index('created_at');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('admin_logs');
  await knex.schema.dropTableIfExists('invite_codes');
  await knex.schema.dropTableIfExists('upload_records');
  await knex.schema.dropTableIfExists('store_available_fields');
  await knex.schema.dropTableIfExists('store_configs');
  await knex.schema.dropTableIfExists('store_data');
  await knex.schema.dropTableIfExists('stores');
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('users');
}

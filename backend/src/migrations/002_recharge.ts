import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 充值申请表
  await knex.schema.createTable('recharge_orders', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 36).notNullable();
    table.string('username', 64).notNullable();
    table.enu('plan', ['pro', 'enterprise']).notNullable().defaultTo('pro');
    table.enu('duration', ['monthly', 'yearly']).notNullable().defaultTo('monthly');
    table.decimal('amount', 10, 2).notNullable().defaultTo(0);
    table.string('wechat_nickname', 128).defaultTo('');
    table.text('remark').nullable();
    table.enu('status', ['pending', 'approved', 'rejected']).notNullable().defaultTo('pending');
    table.string('reviewed_by', 36).nullable();
    table.text('review_note').nullable();
    table.dateTime('reviewed_at').nullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());

    table.foreign('user_id').references('id').inTable('users').onDelete('CASCADE');
    table.index('user_id');
    table.index('status');
    table.index('created_at');
  });

  // AI 配置表
  await knex.schema.createTable('ai_config', (table) => {
    table.string('config_key', 64).primary();
    table.text('config_value').notNullable();
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // 插入默认 AI 配置
  await knex('ai_config').insert([
    { config_key: 'ai_enabled', config_value: 'false' },
    { config_key: 'ai_api_key', config_value: '' },
    { config_key: 'ai_daily_limit', config_value: '10' },
    { config_key: 'ai_model', config_value: 'claude-sonnet-4-6' },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('recharge_orders');
  await knex.schema.dropTableIfExists('ai_config');
}

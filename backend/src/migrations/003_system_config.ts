import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 系统配置表 — 存储全局配置（包括系统设置和费用/税务等业务配置）
  await knex.schema.createTable('system_configs', (table) => {
    table.string('config_key', 128).primary();
    table.text('config_value', 'mediumtext').notNullable();
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  // 配置变更历史表
  await knex.schema.createTable('config_history', (table) => {
    table.bigIncrements('id');
    table.string('config_key', 128).notNullable();
    table.text('old_value', 'mediumtext').nullable();
    table.text('new_value', 'mediumtext').nullable();
    table.string('changed_by', 64).notNullable();
    table.dateTime('changed_at').notNullable().defaultTo(knex.fn.now());
    table.string('ip_address', 45).nullable();
    table.index('config_key');
    table.index('changed_at');
  });

  // 插入默认系统设置
  await knex('system_configs').insert([
    // 注册设置
    { config_key: 'registration_open', config_value: 'true' },
    { config_key: 'invite_code_required', config_value: 'true' },
    // 会员设置
    { config_key: 'pro_grace_days', config_value: '30' },
    { config_key: 'membership_reminder_days', config_value: '7' },
    { config_key: 'free_data_retention_days', config_value: '3' },
    // 清理策略
    { config_key: 'cleanup_cron', config_value: '0 3 * * *' },
    { config_key: 'data_retention_days', config_value: '365' },
    // 安全设置
    { config_key: 'max_login_attempts', config_value: '5' },
    { config_key: 'token_expires_minutes', config_value: '15' },
    // 通知设置
    { config_key: 'wecom_webhook', config_value: '' },
    { config_key: 'dingtalk_webhook', config_value: '' },
    // 费用配置
    { config_key: 'fees', config_value: JSON.stringify({
      packagingFee: 0,
      expressFee: 0,
      platformCommissionRate: 0,
      shippingInsurance: 0,
      laborFee: 0,
      promotionFee: 0,
    }) },
    // 快递公司费率表
    { config_key: 'express_rates', config_value: JSON.stringify([
      { company: '中通', firstWeight: 1, firstPrice: 3.5, continuedWeight: 1, continuedPrice: 1.5 },
      { company: '圆通', firstWeight: 1, firstPrice: 3.5, continuedWeight: 1, continuedPrice: 1.5 },
      { company: '申通', firstWeight: 1, firstPrice: 3.5, continuedWeight: 1, continuedPrice: 1.5 },
      { company: '韵达', firstWeight: 1, firstPrice: 3.5, continuedWeight: 1, continuedPrice: 1.5 },
      { company: '顺丰', firstWeight: 1, firstPrice: 12, continuedWeight: 1, continuedPrice: 6 },
      { company: '极兔', firstWeight: 1, firstPrice: 3, continuedWeight: 1, continuedPrice: 1.2 },
    ]) },
    // 自定义扣费公式
    { config_key: 'deduction_formulas', config_value: JSON.stringify([
      { id: '1', name: '运费=首重价格+续重*续重单价', formula: 'firstPrice + continuedWeight * continuedPrice', enabled: true, createdBy: 'system', createdAt: new Date().toISOString() },
    ]) },
    // 税务配置
    { config_key: 'tax_rates', config_value: JSON.stringify({
      vatRate: 13,
      incomeTaxRate: 25,
      surtaxRate: 6,
    }) },
  ]);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('config_history');
  await knex.schema.dropTableIfExists('system_configs');
}

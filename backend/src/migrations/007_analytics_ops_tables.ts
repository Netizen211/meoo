import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ===== 1. User Events (行为埋点) =====
  await knex.schema.createTableIfNotExists('user_events', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 64).notNullable();
    table.string('session_id', 64);
    table.string('event_type', 32).notNullable();
    table.string('event_category', 32);
    table.string('event_label', 128);
    table.string('event_value', 256);
    table.string('page_url', 256);
    table.string('store_id', 64);
    table.string('device_info', 256);
    table.string('ip_address', 45);
    table.integer('duration_ms').defaultTo(0);
    table.json('metadata');
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id', 'idx_ue_user_id');
    table.index('event_type', 'idx_ue_event_type');
    table.index('created_at', 'idx_ue_created_at');
    table.index(['user_id', 'event_type', 'created_at'], 'idx_ue_user_event_time');
  });

  // ===== 2. Module Click Stats =====
  await knex.schema.createTableIfNotExists('module_click_stats', (table) => {
    table.bigIncrements('id');
    table.string('module_name', 64).notNullable();
    table.integer('click_count').defaultTo(0);
    table.integer('unique_users').defaultTo(0);
    table.decimal('click_ratio', 5, 2).defaultTo(0);
    table.integer('avg_duration_sec').defaultTo(0);
    table.decimal('bounce_rate', 5, 2).defaultTo(0);
    table.decimal('pay_conversion_contribution', 5, 2).defaultTo(0);
    table.date('stat_date').notNullable();
    table.unique(['module_name', 'stat_date'], 'uk_mcs_module_date');
  });

  // ===== 3. User Funnel =====
  await knex.schema.createTableIfNotExists('user_funnel', (table) => {
    table.bigIncrements('id');
    table.string('funnel_name', 64).notNullable();
    table.string('step_name', 64).notNullable();
    table.integer('step_order').notNullable();
    table.integer('user_count').defaultTo(0);
    table.decimal('conversion_rate', 5, 2).defaultTo(0);
    table.date('stat_date').notNullable();
    table.unique(['funnel_name', 'step_name', 'stat_date'], 'uk_uf_funnel_step_date');
  });

  // ===== 4. User Daily Activity =====
  await knex.schema.createTableIfNotExists('user_daily_activity', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 64).notNullable();
    table.date('stat_date').notNullable();
    table.tinyint('is_active').defaultTo(0);
    table.integer('page_views').defaultTo(0);
    table.integer('module_clicks').defaultTo(0);
    table.integer('upload_count').defaultTo(0);
    table.integer('export_count').defaultTo(0);
    table.integer('ai_call_count').defaultTo(0);
    table.integer('paywall_views').defaultTo(0);
    table.integer('session_duration_sec').defaultTo(0);
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'stat_date'], 'uk_uda_user_date');
    table.index('stat_date', 'idx_uda_stat_date');
    table.index(['is_active', 'stat_date'], 'idx_uda_active_date');
  });

  // ===== 5. AI Call Logs =====
  await knex.schema.createTableIfNotExists('ai_call_logs', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 64).notNullable();
    table.string('feature_type', 32).notNullable();
    table.integer('tokens_input').defaultTo(0);
    table.integer('tokens_output').defaultTo(0);
    table.decimal('cost', 10, 6).defaultTo(0);
    table.integer('response_time_ms').defaultTo(0);
    table.tinyint('success').defaultTo(1);
    table.string('error_message', 256);
    table.string('model_name', 64);
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id', 'idx_acl_user_id');
    table.index('feature_type', 'idx_acl_feature_type');
    table.index('created_at', 'idx_acl_created_at');
  });

  // ===== 6. Risk Events =====
  await knex.schema.createTableIfNotExists('risk_events', (table) => {
    table.bigIncrements('id');
    table.string('risk_type', 32).notNullable();
    table.string('risk_level', 16).notNullable();
    table.string('user_id', 64);
    table.string('description', 512);
    table.json('event_data');
    table.string('ip_address', 45);
    table.string('status', 16).defaultTo('open');
    table.string('resolved_by', 64);
    table.dateTime('resolved_at');
    table.string('resolution_note', 256);
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('risk_type', 'idx_re_risk_type');
    table.index('risk_level', 'idx_re_risk_level');
    table.index('user_id', 'idx_re_user_id');
    table.index('status', 'idx_re_status');
    table.index('created_at', 'idx_re_created_at');
  });

  // ===== 7. API Health Stats =====
  await knex.schema.createTableIfNotExists('api_health_stats', (table) => {
    table.bigIncrements('id');
    table.string('endpoint', 128).notNullable();
    table.string('method', 8).notNullable();
    table.integer('avg_response_ms').defaultTo(0);
    table.integer('p95_response_ms').defaultTo(0);
    table.integer('p99_response_ms').defaultTo(0);
    table.integer('error_count').defaultTo(0);
    table.integer('total_calls').defaultTo(0);
    table.decimal('error_rate', 5, 2).defaultTo(0);
    table.date('stat_date').notNullable();
    table.unique(['endpoint', 'method', 'stat_date'], 'uk_ahs_endpoint_method_date');
  });

  // ===== 8. Data Quality Checks =====
  await knex.schema.createTableIfNotExists('data_quality_checks', (table) => {
    table.bigIncrements('id');
    table.string('store_id', 64).notNullable();
    table.string('check_type', 32).notNullable();
    table.string('check_status', 16).notNullable();
    table.integer('issue_count').defaultTo(0);
    table.json('issue_details');
    table.date('check_date').notNullable();
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index(['store_id', 'check_date'], 'idx_dqc_store_date');
  });

  // ===== 9. User Segments =====
  await knex.schema.createTableIfNotExists('user_segments', (table) => {
    table.bigIncrements('id');
    table.string('segment_name', 64).notNullable();
    table.json('segment_rules').notNullable();
    table.integer('user_count').defaultTo(0);
    table.tinyint('is_active').defaultTo(1);
    table.string('created_by', 64);
    table.dateTime('created_at').notNullable().defaultTo(knex.fn.now());
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  console.log('[migration:007] Analytics & ops tables created (9 tables)');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_segments');
  await knex.schema.dropTableIfExists('data_quality_checks');
  await knex.schema.dropTableIfExists('api_health_stats');
  await knex.schema.dropTableIfExists('risk_events');
  await knex.schema.dropTableIfExists('ai_call_logs');
  await knex.schema.dropTableIfExists('user_daily_activity');
  await knex.schema.dropTableIfExists('user_funnel');
  await knex.schema.dropTableIfExists('module_click_stats');
  await knex.schema.dropTableIfExists('user_events');
  console.log('[migration:007] Analytics & ops tables dropped');
}

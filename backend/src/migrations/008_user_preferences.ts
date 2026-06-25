import type Knex from 'knex';

export async function up(knex: Knex): Promise<void> {
  // ===== 1. 用户偏好表 (user_preferences) =====
  // 用于跨设备/跨浏览器同步用户界面偏好设置
  // 设计原则：
  // - 所有 UI 偏好存储为 JSON，支持任意复杂结构
  // - version 字段用于乐观锁冲突检测
  // - UNIQUE(user_id, pref_key) 确保一个用户一个值
  // - 无外键约束（保持轻量），应用层保证数据一致性
  await knex.schema.createTableIfNotExists('user_preferences', (table) => {
    table.bigIncrements('id');
    table.string('user_id', 64).notNullable();
    table.string('pref_key', 128).notNullable();
    table.json('pref_value').notNullable();
    table.integer('version').notNullable().defaultTo(1);
    table.dateTime('updated_at').notNullable().defaultTo(knex.fn.now());
    table.unique(['user_id', 'pref_key'], 'uk_up_user_key');
    table.index(['user_id', 'updated_at'], 'idx_up_user_updated');
  });

  console.log('[migration:008] user_preferences table created');

  // ===== 2. 为已有用户创建默认偏好（初始迁移）=====
  // 从 users 表中读取所有用户 ID，为每个用户插入空的预设备偏好
  // 这样后续读取代无需判断"用户是否存在"
  const users = await knex('users').select('id');
  if (users.length > 0) {
    const defaultPrefs: any[] = [];
    const now = new Date();
    for (const user of users) {
      defaultPrefs.push({
        user_id: user.id,
        pref_key: '_initialized',
        pref_value: JSON.stringify(true),
        version: 1,
        updated_at: now,
      });
    }
    // 批量插入，忽略重复（已存在的不覆盖）
    await knex('user_preferences')
      .insert(defaultPrefs)
      .onConflict(['user_id', 'pref_key'])
      .ignore();
    console.log(`[migration:008] Default prefs created for ${users.length} users`);
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('user_preferences');
  console.log('[migration:008] user_preferences table dropped');
}

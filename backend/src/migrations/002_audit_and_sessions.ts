/**
 * 迁移002：审计日志 + 用户会话 + 子账号权限增强
 */
import { db } from '../db';

export async function up(): Promise<void> {
  // ─── audit_logs：不可篡改审计日志 ───
  const hasAudit = await db.schema.hasTable('audit_logs');
  if (!hasAudit) {
    await db.schema.createTable('audit_logs', t => {
      t.string('id', 64).primary();
      t.string('user_id', 64).notNullable().index();
      t.string('username', 128).notNullable();
      t.string('role', 32).notNullable();
      t.string('action', 64).notNullable().index();
      t.string('resource', 64).notNullable();
      t.string('resource_id', 128).nullable();
      t.string('store_id', 128).nullable().index();
      t.text('details').notNullable();
      t.string('ip_address', 64).notNullable();
      t.string('device_id', 64).notNullable();
      t.string('prev_hash', 128).notNullable();
      t.string('current_hash', 128).notNullable();
      t.text('metadata_json').nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // ─── user_sessions：多设备会话管理 ───
  const hasSessions = await db.schema.hasTable('user_sessions');
  if (!hasSessions) {
    await db.schema.createTable('user_sessions', t => {
      t.string('session_id', 128).primary();
      t.string('user_id', 64).notNullable().index();
      t.string('device_id', 64).notNullable();
      t.string('device_name', 128).notNullable();
      t.string('ip_address', 64).notNullable();
      t.string('geo_location', 64).nullable();
      t.string('login_method', 32).notNullable();
      t.boolean('is_active').defaultTo(true).index();
      t.timestamp('last_active_at').defaultTo(db.fn.now());
      t.timestamp('terminated_at').nullable();
      t.string('terminated_by', 64).nullable();
      t.timestamp('created_at').defaultTo(db.fn.now());
    });
  }

  // ─── users 表增强：添加设备指纹相关字段 ───
  const hasLastLoginIp = await db.schema.hasColumn('users', 'last_login_ip');
  if (!hasLastLoginIp) {
    await db.schema.alterTable('users', t => {
      t.string('last_login_ip', 64).nullable();
      t.string('last_device_id', 64).nullable();
      t.timestamp('last_login_at').nullable();
    });
  }
}

export async function down(): Promise<void> {
  // 迁移回滚（保留数据安全，仅删表结构）
}

// 自动执行迁移
if (require.main === module) {
  up().then(() => { console.log('[migration] 002_audit_and_sessions ✓'); process.exit(0); })
    .catch(err => { console.error('[migration] failed:', err); process.exit(1); });
}

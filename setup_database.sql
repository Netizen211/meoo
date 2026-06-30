USE meoo_dev;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('normal','test','admin') NOT NULL DEFAULT 'normal',
  membership_level ENUM('free','pro','enterprise') NOT NULL DEFAULT 'free',
  membership_expires_at DATETIME NULL,
  is_banned TINYINT(1) NOT NULL DEFAULT 0,
  banned_reason VARCHAR(255) NULL,
  phone VARCHAR(20) DEFAULT '',
  invite_code VARCHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Refresh tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Stores
CREATE TABLE IF NOT EXISTS stores (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(128) NOT NULL,
  platform VARCHAR(32) DEFAULT 'pdd',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_s_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Store data
CREATE TABLE IF NOT EXISTS store_data (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL,
  category VARCHAR(32) NOT NULL,
  payload_json MEDIUMTEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE KEY uk_store_category (store_id, category),
  INDEX idx_sd_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Store configs
CREATE TABLE IF NOT EXISTS store_configs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL,
  config_key VARCHAR(64) NOT NULL,
  payload_json MEDIUMTEXT NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE KEY uk_store_config (store_id, config_key),
  INDEX idx_sc_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Available fields
CREATE TABLE IF NOT EXISTS store_available_fields (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  store_id VARCHAR(36) NOT NULL,
  field_source VARCHAR(16) NOT NULL,
  fields_json TEXT NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  UNIQUE KEY uk_store_source (store_id, field_source),
  INDEX idx_saf_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Upload records
CREATE TABLE IF NOT EXISTS upload_records (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  store_name VARCHAR(128) NOT NULL,
  file_name VARCHAR(256) NOT NULL,
  file_type VARCHAR(32) NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  field_count INT NOT NULL DEFAULT 0,
  uploaded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  INDEX idx_ur_user_store (user_id, store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Invite codes
CREATE TABLE IF NOT EXISTS invite_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  batch_id VARCHAR(36) NULL,
  created_by VARCHAR(36) NOT NULL,
  used_by VARCHAR(64) NULL,
  used_at DATETIME NULL,
  is_used TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ic_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin logs
CREATE TABLE IF NOT EXISTS admin_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  admin_id VARCHAR(36) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL,
  target_id VARCHAR(64) NULL,
  details TEXT NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_al_admin (admin_id),
  INDEX idx_al_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Email codes
CREATE TABLE IF NOT EXISTS email_codes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  code VARCHAR(6) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ec_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Recharge orders
CREATE TABLE IF NOT EXISTS recharge_orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(16) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  platform_order_id VARCHAR(128) NULL,
  paid_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ro_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System config
CREATE TABLE IF NOT EXISTS system_config (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(64) NOT NULL UNIQUE,
  config_value TEXT NOT NULL,
  description VARCHAR(255) NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- User preferences
CREATE TABLE IF NOT EXISTS user_preferences (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  pref_key VARCHAR(64) NOT NULL,
  pref_value TEXT NOT NULL,
  version INT NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uk_user_pref (user_id, pref_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sub roles
CREATE TABLE IF NOT EXISTS sub_roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  parent_user_id VARCHAR(36) NOT NULL,
  name VARCHAR(64) NOT NULL,
  description VARCHAR(255) DEFAULT '',
  permissions JSON NOT NULL,
  is_preset TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sr_parent (parent_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sub account stores
CREATE TABLE IF NOT EXISTS sub_account_stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  permission_level ENUM('view','edit','admin') NOT NULL DEFAULT 'view',
  granted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sas (user_id, store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Operation logs
CREATE TABLE IF NOT EXISTS user_operation_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  parent_user_id VARCHAR(36) NOT NULL,
  username VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_type VARCHAR(32) NOT NULL DEFAULT '',
  details TEXT NULL,
  store_id VARCHAR(36) NULL,
  ip_address VARCHAR(45) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_uol_parent (parent_user_id, created_at),
  INDEX idx_uol_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Membership history
CREATE TABLE IF NOT EXISTS membership_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  from_level VARCHAR(16) NOT NULL,
  to_level VARCHAR(16) NOT NULL,
  from_expires_at DATETIME NULL,
  to_expires_at DATETIME NULL,
  note TEXT NULL,
  operated_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_mh_user (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Announcements
CREATE TABLE IF NOT EXISTS system_announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  priority ENUM('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
  target_roles VARCHAR(255) NULL,
  created_by VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_sa_active (is_active, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Risk alerts
CREATE TABLE IF NOT EXISTS risk_alerts (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  store_id VARCHAR(36) NOT NULL,
  alert_type VARCHAR(32) NOT NULL,
  alert_level ENUM('info','warning','critical') NOT NULL DEFAULT 'warning',
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  related_data JSON NULL,
  is_resolved TINYINT(1) NOT NULL DEFAULT 0,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_ra_store (store_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

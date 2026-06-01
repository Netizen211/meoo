export const migration = `
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
`;

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS students (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_code VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NULL,
  phone VARCHAR(30) NULL,
  department VARCHAR(120) NULL,
  year VARCHAR(30) NULL,
  profile_completed TINYINT(1) NOT NULL DEFAULT 0,
  payment_completion TINYINT(1) NOT NULL DEFAULT 0,
  gate_pass_created TINYINT(1) NOT NULL DEFAULT 0,
  payment_approved ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
  food_included TINYINT(1) NOT NULL DEFAULT 0,
  food_preference ENUM('VEG','NON-VEG') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CHECK (
    (food_included = 0 AND food_preference IS NULL) OR
    (food_included = 1 AND food_preference IN ('VEG','NON-VEG'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_gateway_config (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  option_id VARCHAR(60) NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  upi_id VARCHAR(120) NOT NULL,
  payee_name VARCHAR(120) NOT NULL DEFAULT 'Refresko 2026',
  note_text VARCHAR(255) NOT NULL,
  include_food TINYINT(1) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  payment_id VARCHAR(60) NOT NULL UNIQUE,
  transaction_id VARCHAR(80) NOT NULL,
  utr_no VARCHAR(80) NOT NULL UNIQUE,
  student_code VARCHAR(64) NOT NULL,
  student_name VARCHAR(120) NOT NULL,
  email VARCHAR(150) NULL,
  department VARCHAR(120) NULL,
  year VARCHAR(30) NULL,
  amount DECIMAL(10,2) NOT NULL,
  status ENUM('pending','completed','declined') NOT NULL DEFAULT 'pending',
  payment_approved ENUM('pending','approved','declined') NOT NULL DEFAULT 'pending',
  payment_method VARCHAR(40) NOT NULL DEFAULT 'UPI',
  food_included TINYINT(1) NOT NULL DEFAULT 0,
  food_preference ENUM('VEG','NON-VEG') NULL,
  screenshot_path VARCHAR(255) NULL,
  screenshot_name VARCHAR(180) NULL,
  reviewed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_student_code FOREIGN KEY (student_code) REFERENCES students(student_code)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CHECK (
    (food_included = 0 AND food_preference IS NULL) OR
    (food_included = 1 AND food_preference IN ('VEG','NON-VEG'))
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS used_utr_registry (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  utr_no VARCHAR(80) NOT NULL UNIQUE,
  student_code VARCHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_utr_student (student_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  display_name VARCHAR(120) NULL,
  email VARCHAR(160) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','superadmin') NOT NULL DEFAULT 'admin',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS event_staff_users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  username VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('cr','volunteer') NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  auth_token VARCHAR(128) NULL,
  token_expires_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_staff_role (role),
  INDEX idx_staff_auth_token (auth_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Day entry columns are auto-migrated by API route code for student_details.

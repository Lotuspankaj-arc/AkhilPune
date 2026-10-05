USE akhil_pune_bhavsar;

CREATE TABLE IF NOT EXISTS sftp_config (
    config_id TINYINT PRIMARY KEY,
    host VARCHAR(255) NOT NULL,
    port INT NOT NULL DEFAULT 22,
    username VARCHAR(255) NOT NULL,
    encrypted_password TEXT NULL,
    encrypted_private_key MEDIUMTEXT NULL,
    remote_path VARCHAR(500) NOT NULL DEFAULT '/',
    auth_method ENUM('password', 'private_key') NOT NULL DEFAULT 'password',
    is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
);
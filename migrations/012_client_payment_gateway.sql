USE akhil_pune_bhavsar;

CREATE TABLE IF NOT EXISTS client_payment_gateway (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    key_id VARCHAR(255) NULL,
    key_secret TEXT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_payment_gateway_client (client_id),
    FOREIGN KEY (client_id) REFERENCES clients(client_id),
    FOREIGN KEY (created_by) REFERENCES admin_users(admin_id),
    FOREIGN KEY (updated_by) REFERENCES admin_users(admin_id)
);
USE akhil_pune_bhavsar;

ALTER TABLE client_payment_gateway
    DROP FOREIGN KEY client_payment_gateway_ibfk_1;

ALTER TABLE client_payment_gateway
    DROP INDEX ux_client_payment_gateway_client,
    ADD INDEX idx_client_payment_gateway_client (client_id),
    ADD COLUMN gateway_name VARCHAR(120) NULL AFTER client_id;

ALTER TABLE client_payment_gateway
    ADD CONSTRAINT fk_client_payment_gateway_client
        FOREIGN KEY (client_id) REFERENCES clients(client_id);

ALTER TABLE events
    ADD COLUMN payment_gateway_id INT NULL AFTER client_id;

ALTER TABLE events
    ADD CONSTRAINT fk_events_payment_gateway
        FOREIGN KEY (payment_gateway_id) REFERENCES client_payment_gateway(config_id)
        ON DELETE SET NULL;

UPDATE client_payment_gateway
SET gateway_name = CONCAT('Gateway ', config_id)
WHERE gateway_name IS NULL OR TRIM(gateway_name) = '';

UPDATE events e
INNER JOIN client_payment_gateway g ON g.client_id = e.client_id
SET e.payment_gateway_id = g.config_id
WHERE e.payment_gateway_id IS NULL;

CREATE TABLE IF NOT EXISTS client_domains (
    domain_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    hostname VARCHAR(255) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_domains_hostname (hostname),
    INDEX idx_client_domains_client (client_id),
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES admin_users(admin_id) ON DELETE SET NULL
);
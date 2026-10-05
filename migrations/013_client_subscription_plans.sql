USE akhil_pune_bhavsar;

CREATE TABLE IF NOT EXISTS subscription_plans (
    plan_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_code VARCHAR(50) NOT NULL UNIQUE,
    plan_name VARCHAR(120) NOT NULL,
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    billing_cycle VARCHAR(20) NOT NULL DEFAULT 'monthly',
    max_active_events INT NULL,
    max_candidates INT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_subscription_plans_active (is_active)
);

CREATE TABLE IF NOT EXISTS client_subscriptions (
    client_subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    plan_id INT NOT NULL,
    starts_at DATETIME NOT NULL,
    ends_at DATETIME NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    notes VARCHAR(500) NULL,
    created_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_client_subscriptions_client_status (client_id, status, ends_at),
    INDEX idx_client_subscriptions_plan (plan_id),
    CONSTRAINT fk_client_subscriptions_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    CONSTRAINT fk_client_subscriptions_plan FOREIGN KEY (plan_id) REFERENCES subscription_plans(plan_id) ON DELETE RESTRICT
);

INSERT INTO subscription_plans (
    plan_code, plan_name, description, price, billing_cycle,
    max_active_events, max_candidates, is_active
)
SELECT 'legacy-unlimited', 'Legacy Unlimited', 'Compatibility plan for existing clients.', 0, 'custom', NULL, NULL, TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM subscription_plans WHERE plan_code = 'legacy-unlimited'
);

SET @legacy_plan_id = (
    SELECT plan_id FROM subscription_plans WHERE plan_code = 'legacy-unlimited' LIMIT 1
);

INSERT INTO client_subscriptions (
    client_id, plan_id, starts_at, ends_at, status, notes
)
SELECT c.client_id, @legacy_plan_id, NOW(), NULL, 'active', 'Migrated automatically. Replace with a Super User plan assignment.'
FROM clients c
WHERE NOT EXISTS (
    SELECT 1
    FROM client_subscriptions cs
    WHERE cs.client_id = c.client_id
      AND cs.status = 'active'
      AND (cs.ends_at IS NULL OR cs.ends_at >= NOW())
);

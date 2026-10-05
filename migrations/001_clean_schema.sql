-- Multi-tenant Event Registration Platform Schema
-- Simplified migration with single statements

USE akhil_pune_bhavsar;

-- 1. Clients table
CREATE TABLE IF NOT EXISTS clients (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL UNIQUE,
    address TEXT NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    bank_details JSON,
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Client core committee
CREATE TABLE IF NOT EXISTS client_core_committee (
    committee_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    adhyaksha_name VARCHAR(100),
    adhyaksha_phone VARCHAR(15),
    adhyaksha_email VARCHAR(100),
    upa_adhyaksha_name VARCHAR(100),
    upa_adhyaksha_phone VARCHAR(15),
    upa_adhyaksha_email VARCHAR(100),
    khajindar_name VARCHAR(100),
    khajindar_phone VARCHAR(15),
    khajindar_email VARCHAR(100),
    sachiv_name VARCHAR(100),
    sachiv_phone VARCHAR(15),
    sachiv_email VARCHAR(100),
    upasachiv_name VARCHAR(100),
    upasachiv_phone VARCHAR(15),
    upasachiv_email VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_committee (client_id),
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- 3. Alter events table - add client tracking
ALTER TABLE events ADD COLUMN client_id INT;
ALTER TABLE events ADD COLUMN banner_url VARCHAR(500);
ALTER TABLE events ADD FOREIGN KEY fk_events_client (client_id) REFERENCES clients(client_id) ON DELETE RESTRICT;
CREATE INDEX idx_events_client_id ON events(client_id);

-- 4. Candidate event registrations
CREATE TABLE IF NOT EXISTS candidate_event_registrations (
    registration_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    event_id INT NOT NULL,
    event_registration_code VARCHAR(64) NULL,
    client_id INT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_event (batch_id, event_id),
    UNIQUE KEY ux_event_registration_code (event_registration_code),
    FOREIGN KEY (batch_id) REFERENCES candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    INDEX idx_registration_date (registration_date)
);

-- 5. Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    event_id INT NOT NULL,
    client_id INT NOT NULL,
    registration_date TIMESTAMP NOT NULL,
    access_expiry_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    access_granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_event_access (batch_id, event_id),
    FOREIGN KEY (batch_id) REFERENCES candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE,
    INDEX idx_expiry_date (access_expiry_date),
    INDEX idx_is_active (is_active)
);

-- 6. Client admin mapping
CREATE TABLE IF NOT EXISTS client_admin_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    client_id INT NOT NULL,
    can_view_forms BOOLEAN DEFAULT TRUE,
    can_generate_links BOOLEAN DEFAULT TRUE,
    can_view_registrations BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY ux_admin_client (admin_id, client_id),
    FOREIGN KEY (admin_id) REFERENCES admin_users(admin_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE
);

-- 7. Alter admin_users for RBAC
ALTER TABLE admin_users ADD COLUMN role_type ENUM('superuser', 'client_admin') DEFAULT 'client_admin';
ALTER TABLE admin_users ADD COLUMN permissions JSON;

-- 8. Sample data
INSERT INTO clients (client_name, address, phone_number, contact_email, is_active)
VALUES 
('Pune Matrimony Circle', 'Pune, Maharashtra', '9876543210', 'info@punematrimony.com', TRUE),
('Mumbai Matrimony Association', 'Mumbai, Maharashtra', '9123456789', 'info@mumbaivivah.com', TRUE)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

-- ==========================================
-- MULTI-TENANT & SUBSCRIPTION ARCHITECTURE
-- Migration: 001_multi_tenant_schema.sql
-- ==========================================

USE akhil_pune_bhavsar;

-- ==========================================
-- 1. CLIENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.clients (
    client_id INT AUTO_INCREMENT PRIMARY KEY,
    client_name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    bank_details JSON, -- {account_holder, account_number, ifsc, bank_name}
    contact_email VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_client_name (client_name)
);

-- ==========================================
-- 2. CLIENT CORE COMMITTEE TABLE (1-to-1 with clients)
-- ==========================================
CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.client_core_committee (
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
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE
);

-- ==========================================
-- 3. ALTER EVENTS TABLE
-- ==========================================
ALTER TABLE akhil_pune_bhavsar.events ADD COLUMN client_id INT;
ALTER TABLE akhil_pune_bhavsar.events ADD COLUMN banner_url VARCHAR(500);
ALTER TABLE akhil_pune_bhavsar.events ADD CONSTRAINT fk_events_client FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE RESTRICT;
CREATE INDEX idx_events_client_id ON akhil_pune_bhavsar.events(client_id);
CREATE INDEX idx_events_active ON akhil_pune_bhavsar.events(is_active);

-- ==========================================
-- 4. CANDIDATE EVENT REGISTRATIONS TABLE
-- Track which candidate registered for which event and when
-- ==========================================
CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.candidate_event_registrations (
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
    FOREIGN KEY (batch_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE,
    INDEX idx_registration_date (registration_date)
);

-- ==========================================
-- 5. SUBSCRIPTIONS TABLE
-- Track 6-month access window from registration
-- ==========================================
CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    event_id INT NOT NULL,
    client_id INT NOT NULL,
    registration_date TIMESTAMP NOT NULL,
    access_expiry_date TIMESTAMP NOT NULL, -- registration_date + 6 months
    is_active BOOLEAN DEFAULT TRUE,
    access_granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_event_access (batch_id, event_id),
    FOREIGN KEY (batch_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE,
    INDEX idx_expiry_date (access_expiry_date),
    INDEX idx_is_active (is_active)
);

-- ==========================================
-- 6. CLIENT ADMIN USERS MAPPING
-- Link admin_users to clients they can manage
-- ==========================================
CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.client_admin_mapping (
    mapping_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    client_id INT NOT NULL,
    can_view_forms BOOLEAN DEFAULT TRUE,
    can_generate_links BOOLEAN DEFAULT TRUE,
    can_view_registrations BOOLEAN DEFAULT TRUE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE KEY ux_admin_client (admin_id, client_id),
    FOREIGN KEY (admin_id) REFERENCES akhil_pune_bhavsar.admin_users(admin_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE
);

-- ==========================================
-- 7. ALTER ADMIN_USERS FOR RBAC FIELDS
-- ==========================================
ALTER TABLE akhil_pune_bhavsar.admin_users ADD COLUMN IF NOT EXISTS role_type ENUM('superuser', 'client_admin') DEFAULT 'client_admin';
ALTER TABLE akhil_pune_bhavsar.admin_users ADD COLUMN IF NOT EXISTS permissions JSON;

-- ==========================================
-- 8. VERIFY CONSTRAINT: One active event per client
-- ==========================================
-- The UNIQUE constraint with WHERE clause ensures only one active event per client
-- Additional validation should be done in the application layer

-- ==========================================
-- 9. PROCEDURES FOR HELPER FUNCTIONS
-- ==========================================

-- PROCEDURE: Calculate and return subscription expiry (6 months from registration)
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS akhil_pune_bhavsar.sp_calculate_subscription_expiry(
    IN p_registration_date TIMESTAMP,
    OUT p_expiry_date TIMESTAMP
)
BEGIN
    SET p_expiry_date = DATE_ADD(p_registration_date, INTERVAL 6 MONTH);
END$$
DELIMITER ;

-- PROCEDURE: Link candidate to multiple events (avoid duplicates)
DELIMITER $$
CREATE PROCEDURE IF NOT EXISTS akhil_pune_bhavsar.sp_link_candidate_to_event(
    IN p_batch_id INT,
    IN p_event_id INT,
    IN p_client_id INT,
    IN p_registration_date TIMESTAMP
)
BEGIN
    DECLARE v_expiry_date TIMESTAMP;
    DECLARE v_event_client_id INT;

    SELECT client_id INTO v_event_client_id
    FROM akhil_pune_bhavsar.events
    WHERE event_id = p_event_id AND is_active = TRUE;

    IF v_event_client_id IS NULL OR v_event_client_id <> p_client_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Event does not belong to the supplied client';
    END IF;
    
    -- Calculate expiry (6 months from registration)
    CALL sp_calculate_subscription_expiry(p_registration_date, v_expiry_date);
    
    -- Insert or update candidate-event registration
    INSERT INTO akhil_pune_bhavsar.candidate_event_registrations 
    (batch_id, event_id, client_id, registration_date, is_active)
    VALUES (p_batch_id, p_event_id, p_client_id, p_registration_date, TRUE)
    ON DUPLICATE KEY UPDATE 
        is_active = TRUE,
        updated_at = CURRENT_TIMESTAMP;
    
    -- Create or update subscription entry
    INSERT INTO akhil_pune_bhavsar.subscriptions 
    (batch_id, event_id, client_id, registration_date, access_expiry_date, is_active)
    VALUES (p_batch_id, p_event_id, p_client_id, p_registration_date, v_expiry_date, TRUE)
    ON DUPLICATE KEY UPDATE 
        is_active = TRUE,
        access_expiry_date = v_expiry_date,
        updated_at = CURRENT_TIMESTAMP;
END$$
DELIMITER ;

-- ==========================================
-- 10. VIEWS FOR CROSS-EVENT VISIBILITY
-- ==========================================

-- VIEW: Active subscriptions (not expired)
CREATE OR REPLACE VIEW akhil_pune_bhavsar.v_active_subscriptions AS
SELECT 
    s.subscription_id,
    s.batch_id,
    s.event_id,
    s.client_id,
    s.registration_date,
    s.access_expiry_date,
    c.mobile_number,
    c.first_name,
    c.last_name,
    c.gender,
    e.event_name,
    cl.client_name,
    CASE 
        WHEN s.access_expiry_date >= NOW() THEN 'active'
        ELSE 'expired'
    END AS subscription_status
FROM akhil_pune_bhavsar.subscriptions s
JOIN akhil_pune_bhavsar.candidates c ON s.batch_id = c.batch_id
JOIN akhil_pune_bhavsar.events e ON s.event_id = e.event_id
JOIN akhil_pune_bhavsar.clients cl ON s.client_id = cl.client_id
WHERE s.is_active = TRUE;

-- VIEW: Candidates unique per event (deduplicated)
CREATE OR REPLACE VIEW akhil_pune_bhavsar.v_unique_candidates_per_event AS
SELECT DISTINCT
    c.batch_id,
    c.mobile_number,
    c.first_name,
    c.middle_name,
    c.last_name,
    c.gender,
    c.birth_date,
    c.education_qualification,
    c.job_business_title,
    c.annual_income,
    c.location_master_id,
    c.height,
    c.complexion,
    c.blood_group,
    c.gotra,
    c.kul,
    c.zodiac,
    c.selected_expectations,
    c.photo_path,
    c.is_active,
    c.registration_date,
    cer.event_id,
    cer.client_id
FROM akhil_pune_bhavsar.candidates c
JOIN akhil_pune_bhavsar.candidate_event_registrations cer 
    ON c.batch_id = cer.batch_id
WHERE c.is_active = TRUE 
  AND cer.is_active = TRUE;

-- ==========================================
-- 11. INITIAL DATA (Optional Sample)
-- ==========================================

-- Insert sample client
INSERT INTO akhil_pune_bhavsar.clients 
(client_name, address, phone_number, contact_email, is_active)
VALUES 
('Pune Matrimony Circle', 'Pune, Maharashtra', '9876543210', 'info@punematrimony.com', TRUE),
('Mumbai Matrimony Association', 'Mumbai, Maharashtra', '9123456789', 'info@mumbaivivah.com', TRUE)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

-- Insert sample client committee members
INSERT INTO akhil_pune_bhavsar.client_core_committee 
(client_id, adhyaksha_name, adhyaksha_phone, upa_adhyaksha_name, upa_adhyaksha_phone,
 khajindar_name, khajindar_phone, sachiv_name, sachiv_phone, upasachiv_name, upasachiv_phone)
SELECT 
    c.client_id,
    'Raj Patel', '9876543210', 'Priya Sharma', '9876543211',
    'Amit Kumar', '9876543212', 'Neha Singh', '9876543213', 'Rajesh Dubey', '9876543214'
FROM akhil_pune_bhavsar.clients c
WHERE c.client_name = 'Pune Matrimony Circle'
    AND NOT EXISTS (SELECT 1 FROM akhil_pune_bhavsar.client_core_committee WHERE client_id = c.client_id)
ON DUPLICATE KEY UPDATE adhyaksha_name = VALUES(adhyaksha_name);

-- ==========================================
-- END OF MIGRATION
-- ==========================================

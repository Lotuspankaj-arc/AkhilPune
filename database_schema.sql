-- Create schema if it doesn't exist and use it
CREATE SCHEMA IF NOT EXISTS akhil_pune_bhavsar;
USE akhil_pune_bhavsar;

-- ==========================================
-- 1. LANGUAGE MASTER TABLE
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.languages (
    language_id INT AUTO_INCREMENT PRIMARY KEY,
    language_code VARCHAR(10) NOT NULL,
    language_name VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.state_master (
    state_id INT AUTO_INCREMENT PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_state_master (state_name)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.district_master (
    district_id INT AUTO_INCREMENT PRIMARY KEY,
    state_id INT NOT NULL,
    district_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_id) REFERENCES akhil_pune_bhavsar.state_master(state_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.subdistrict_master (
    subdistrict_id INT AUTO_INCREMENT PRIMARY KEY,
    district_id INT NOT NULL,
    subdistrict_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_subdistrict_master (district_id, subdistrict_name),
    FOREIGN KEY (district_id) REFERENCES akhil_pune_bhavsar.district_master(district_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.location_master (
    location_id INT AUTO_INCREMENT PRIMARY KEY,
    state_id INT NOT NULL,
    district_id INT NOT NULL,
    subdistrict_id INT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    city VARCHAR(150) NOT NULL,
    post_office VARCHAR(150) NOT NULL,
    village_name_local VARCHAR(150) NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_location_master (pincode, post_office, city, subdistrict_id),
    FOREIGN KEY (state_id) REFERENCES akhil_pune_bhavsar.state_master(state_id),
    FOREIGN KEY (district_id) REFERENCES akhil_pune_bhavsar.district_master(district_id),
    FOREIGN KEY (subdistrict_id) REFERENCES akhil_pune_bhavsar.subdistrict_master(subdistrict_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.education_master (
    education_id INT AUTO_INCREMENT PRIMARY KEY,
    qualification VARCHAR(100) NOT NULL,
    education_detail VARCHAR(150) NOT NULL,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_education_master (qualification, education_detail)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.expectation_master (
    expectation_id INT AUTO_INCREMENT PRIMARY KEY,
    expectation_name VARCHAR(150) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_expectation_master (expectation_name)
);

-- ==========================================
-- 2. ADMIN & EVENT MANAGEMENT
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.admin_users (
    admin_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    volunteer_id INT NULL,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(15) NOT NULL,
    whatsapp_number VARCHAR(15),
    photo_url VARCHAR(255),
    birthdate DATE,
    address TEXT,
    is_super_user BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.events (
    event_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    payment_gateway_id INT NULL,
    event_name VARCHAR(255) NOT NULL,
    venue VARCHAR(255) NOT NULL,
    office_address VARCHAR(500),
    event_time VARCHAR(100),
    event_type VARCHAR(100),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    registration_cutoff_date DATE NOT NULL,
    organizer_name VARCHAR(100),
    organizer_phone VARCHAR(15),
    organizer_whatsapp VARCHAR(15),
        organizer_photo VARCHAR(255),
        organizer_photo_data LONGBLOB,
        organizer_photo_mime_type VARCHAR(100),
    registration_banner_path VARCHAR(255),
    registration_banner_data LONGBLOB,
    registration_banner_mime_type VARCHAR(100),
    razorpay_key_id VARCHAR(255),
    razorpay_key_secret TEXT,
    razorpay_registration_amount DECIMAL(10,2),
    is_active BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id),
    FOREIGN KEY (created_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.client_payment_gateway (
    config_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NOT NULL,
    gateway_name VARCHAR(120) NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    key_id VARCHAR(255) NULL,
    key_secret TEXT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    created_by INT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_client_payment_gateway_client (client_id),
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id),
    FOREIGN KEY (created_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id),
    FOREIGN KEY (updated_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.client_domains (
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
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id) ON DELETE SET NULL
);

-- ==========================================
-- 3. TEAMS, ROLES & VOLUNTEERS
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.teams (
    team_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT,
    language_id INT,
    team_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.roles (
    role_id INT AUTO_INCREMENT PRIMARY KEY,
    language_id INT,
    role_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    update_user INT, 
    FOREIGN KEY (language_id) REFERENCES akhil_pune_bhavsar.languages(language_id),
    FOREIGN KEY (update_user) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.volunteers (
    volunteer_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    volunteer_name VARCHAR(100) NOT NULL,
    address TEXT,
    photo_url VARCHAR(255),
    photo_data LONGBLOB,
    photo_mime_type VARCHAR(100),
    email VARCHAR(255),
    whatsapp_number VARCHAR(15),
    birthdate DATE,
    main_profession VARCHAR(150),
    can_edit_candidates BOOLEAN DEFAULT FALSE, 
    is_active BOOLEAN DEFAULT TRUE,
    update_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    update_user INT,
    FOREIGN KEY (update_user) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.volunteer_team_assignments (
    assignment_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    volunteer_id INT,
    team_id INT,
    role_id INT,
    is_team_lead BOOLEAN DEFAULT FALSE,
    is_team_manager BOOLEAN DEFAULT FALSE,
    assigned_by INT, 
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (volunteer_id) REFERENCES akhil_pune_bhavsar.volunteers(volunteer_id),
    FOREIGN KEY (team_id) REFERENCES akhil_pune_bhavsar.teams(team_id),
    FOREIGN KEY (role_id) REFERENCES akhil_pune_bhavsar.roles(role_id),
    FOREIGN KEY (assigned_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

-- ==========================================
-- 4. CANDIDATE (PARTICIPANT) REGISTRATION
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.candidates (
    batch_id INT AUTO_INCREMENT PRIMARY KEY, 
    event_id INT,
    marriage_type VARCHAR(50) NOT NULL,
    gender ENUM('Bride', 'Groom') NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    middle_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    address_line TEXT NOT NULL, 
    pincode VARCHAR(6) NOT NULL,
    city_village VARCHAR(100) NOT NULL,
    tehsil VARCHAR(100) NOT NULL,
    district VARCHAR(100),
    state VARCHAR(50) NOT NULL,
    location_state_id INT NULL,
    location_district_id INT NULL,
    location_subdistrict_id INT NULL,
    location_master_id INT NULL,
    mobile_number VARCHAR(15) NOT NULL,
    whatsapp_number VARCHAR(15) NOT NULL,
    height VARCHAR(20),
    education_qualification VARCHAR(100),
    education_details TEXT,
    job_business_title VARCHAR(150),
    annual_income VARCHAR(50), 
    job_business_location VARCHAR(100),
    mamekul VARCHAR(100),
    birth_date DATE NOT NULL,
    birth_time VARCHAR(15), 
    birth_place VARCHAR(100),
    complexion VARCHAR(50),
    blood_group VARCHAR(15),
    gotra VARCHAR(100),
    kul VARCHAR(100),
    zodiac VARCHAR(50),
    gan VARCHAR(50),
    nadi VARCHAR(50),
    charan VARCHAR(20), 
    nakshatra VARCHAR(50),
    selected_expectations JSON, 
    other_expectations TEXT,
    photo_path VARCHAR(255),
    photo_data LONGBLOB,
    photo_mime_type VARCHAR(100),
    photo_validation_status VARCHAR(30),
    photo_validated_at DATETIME,
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    payment_status VARCHAR(50),
    consent_agreed BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE, 
    last_edited_by_volunteer INT NULL, 
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id),
    FOREIGN KEY (last_edited_by_volunteer) REFERENCES akhil_pune_bhavsar.volunteers(volunteer_id)
);

-- ==========================================
-- 5. NORMALIZED CANDIDATE EVENT MEMBERSHIP
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.candidate_event_registrations (
    registration_id INT AUTO_INCREMENT PRIMARY KEY,
    batch_id INT NOT NULL,
    event_id INT NOT NULL,
    client_id INT NOT NULL,
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_event (batch_id, event_id),
    INDEX idx_candidate_event_batch_active (batch_id, is_active, event_id),
    INDEX idx_candidate_event_event_active (event_id, is_active, batch_id),
    FOREIGN KEY (batch_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.subscriptions (
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
    INDEX idx_subscription_batch_active_expiry (batch_id, is_active, access_expiry_date, event_id),
    INDEX idx_subscription_event_active_expiry (event_id, is_active, access_expiry_date, batch_id),
    FOREIGN KEY (batch_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (event_id) REFERENCES akhil_pune_bhavsar.events(event_id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES akhil_pune_bhavsar.clients(client_id) ON DELETE CASCADE
);

-- ==========================================
-- 6. AUTHENTICATION & LEGACY CANDIDATES
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.auth_credentials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    candidate_id INT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (candidate_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id)
);

-- ==========================================
-- 6. ACTIVITY LOGS
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.activity_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(100),
    table_name VARCHAR(100),
    record_id INT,
    old_values JSON,
    new_values JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES akhil_pune_bhavsar.admin_users(admin_id)
);

-- ==========================================
-- 7. CURRENT APPLICATION FIELDS & TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.volunteer_groups (
    group_id INT AUTO_INCREMENT PRIMARY KEY,
    client_id INT NULL,
    group_name VARCHAR(150) NOT NULL UNIQUE,
    adhyaksha_name VARCHAR(100),
    khajindar_name VARCHAR(100),
    upadhyaksha_name VARCHAR(100),
    sachiv_name VARCHAR(100),
    upasachiv_name VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    update_user INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

ALTER TABLE akhil_pune_bhavsar.events
    ADD COLUMN IF NOT EXISTS registration_banner_path VARCHAR(255);

ALTER TABLE akhil_pune_bhavsar.volunteers
    ADD COLUMN IF NOT EXISTS client_id INT NULL,
    ADD COLUMN IF NOT EXISTS group_id INT NULL;

ALTER TABLE akhil_pune_bhavsar.volunteer_team_assignments
    ADD COLUMN IF NOT EXISTS client_id INT NULL;

ALTER TABLE akhil_pune_bhavsar.volunteer_groups
    ADD COLUMN IF NOT EXISTS client_id INT NULL;

ALTER TABLE akhil_pune_bhavsar.candidates
    ADD COLUMN IF NOT EXISTS email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS education_category VARCHAR(100),
    ADD COLUMN IF NOT EXISTS registration_code VARCHAR(50),
    ADD COLUMN IF NOT EXISTS payment_details JSON,
    ADD COLUMN IF NOT EXISTS payment_date DATETIME,
    ADD COLUMN IF NOT EXISTS attended_active_event VARCHAR(20),
    ADD COLUMN IF NOT EXISTS will_attend_event VARCHAR(20),
    ADD COLUMN IF NOT EXISTS attendee_count INT NULL;

ALTER TABLE akhil_pune_bhavsar.auth_credentials
    ADD COLUMN IF NOT EXISTS user_id INT NULL,
    ADD COLUMN IF NOT EXISTS role_id INT NULL;

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.candidate_interactions (
    interaction_id INT AUTO_INCREMENT PRIMARY KEY,
    from_candidate_id INT NOT NULL,
    to_candidate_id INT NOT NULL,
    is_liked BOOLEAN DEFAULT FALSE,
    is_shortlisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_candidate_interaction_pair (from_candidate_id, to_candidate_id),
    FOREIGN KEY (from_candidate_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE,
    FOREIGN KEY (to_candidate_id) REFERENCES akhil_pune_bhavsar.candidates(batch_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.registration_intents (
    intent_id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT,
    email VARCHAR(255),
    first_name VARCHAR(100),
    middle_name VARCHAR(100),
    last_name VARCHAR(100),
    mobile_number VARCHAR(15),
    payload_json JSON,
    password_hash VARCHAR(255),
    photo_path VARCHAR(255),
    photo_data LONGBLOB,
    photo_mime_type VARCHAR(100),
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(255),
    payment_amount DECIMAL(10,2),
    payment_currency VARCHAR(10),
    payment_status VARCHAR(50),
    candidate_batch_id INT,
    failure_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS akhil_pune_bhavsar.sftp_config (
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
    FOREIGN KEY (updated_by) REFERENCES akhil_pune_bhavsar.admin_users(admin_id) ON DELETE SET NULL
);

-- ==========================================
-- 8. INSERT INITIAL DATA
-- ==========================================

-- Insert Languages
INSERT INTO akhil_pune_bhavsar.languages (language_code, language_name) VALUES 
('hi', 'Hindi'),
('en', 'English'), 
('mr', 'Marathi')
ON DUPLICATE KEY UPDATE language_name = VALUES(language_name);

INSERT INTO akhil_pune_bhavsar.state_master (state_name, is_active) VALUES
('MAHARASHTRA', TRUE)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

INSERT INTO akhil_pune_bhavsar.district_master (state_id, district_name, is_active)
SELECT state_id, 'PUNE', TRUE
FROM akhil_pune_bhavsar.state_master
WHERE state_name = 'MAHARASHTRA'
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

INSERT INTO akhil_pune_bhavsar.subdistrict_master (district_id, subdistrict_name, is_active)
SELECT district_id, subdistrict_name, TRUE
FROM (
    SELECT 'PUNE' AS district_name, '' AS subdistrict_name
    UNION ALL SELECT 'PUNE', 'Haveli'
    UNION ALL SELECT 'PUNE', 'Mulshi'
) seed
INNER JOIN akhil_pune_bhavsar.district_master dm ON dm.district_name = seed.district_name
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

INSERT INTO akhil_pune_bhavsar.location_master (state_id, district_id, subdistrict_id, pincode, city, post_office, village_name_local, is_active)
SELECT sm.state_id, dm.district_id, sdm.subdistrict_id, seed.pincode, seed.city, seed.post_office, seed.village_name_local, TRUE
FROM (
    SELECT 'MAHARASHTRA' AS state_name, 'PUNE' AS district_name, '' AS subdistrict_name, '411033' AS pincode, 'Pimpri-Chinchwad' AS city, 'Chinchwadgaon S.O' AS post_office, NULL AS village_name_local
    UNION ALL SELECT 'MAHARASHTRA', 'PUNE', 'Haveli', '411012', 'Pune City East', 'Dapodi Bazar S.O', 'दापोडी'
    UNION ALL SELECT 'MAHARASHTRA', 'PUNE', 'Mulshi', '411033', 'Pimpri-Chinchwad', 'Punawale', 'पुनावळे'
) seed
INNER JOIN akhil_pune_bhavsar.state_master sm ON sm.state_name = seed.state_name
INNER JOIN akhil_pune_bhavsar.district_master dm ON dm.state_id = sm.state_id AND dm.district_name = seed.district_name
INNER JOIN akhil_pune_bhavsar.subdistrict_master sdm ON sdm.district_id = dm.district_id AND sdm.subdistrict_name = seed.subdistrict_name
ON DUPLICATE KEY UPDATE village_name_local = VALUES(village_name_local), is_active = VALUES(is_active);

INSERT INTO akhil_pune_bhavsar.education_master (qualification, education_detail, sort_order, is_active) VALUES
('B.A.', 'B.A. Arts', 10, TRUE),
('B.Com', 'B.Com General', 20, TRUE),
('B.Sc', 'B.Sc Computer Science', 30, TRUE),
('B.Sc', 'B.Sc Physics', 40, TRUE),
('B.Sc', 'B.Sc Chemistry', 50, TRUE),
('B.Sc', 'B.Sc Mathematics', 60, TRUE),
('B.Sc', 'B.Sc Biology', 70, TRUE),
('B.E.', 'B.E. Computer Engineering', 80, TRUE),
('B.Tech', 'B.Tech Information Technology', 90, TRUE),
('M.Com', 'M.Com General', 100, TRUE),
('M.Sc', 'M.Sc Computer Science', 110, TRUE),
('M.Sc', 'M.Sc Physics', 120, TRUE),
('MBA', 'MBA Finance', 130, TRUE),
('MBA', 'MBA Marketing', 140, TRUE),
('Diploma', 'Diploma Engineering', 150, TRUE)
ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order), is_active = VALUES(is_active);

INSERT INTO akhil_pune_bhavsar.expectation_master (expectation_name, is_active) VALUES
('Good family background', TRUE),
('Well educated', TRUE),
('Respectful nature', TRUE),
('Simple living', TRUE),
('Vegetarian', TRUE),
('Non-smoker', TRUE),
('Non-drinker', TRUE),
('Working professional', TRUE),
('Own house', TRUE),
('Well mannered', TRUE),
('Family oriented', TRUE),
('Financially stable', TRUE)
ON DUPLICATE KEY UPDATE is_active = VALUES(is_active);

-- Insert Teams (English - ID 2, Marathi - ID 3)
INSERT INTO akhil_pune_bhavsar.teams (language_id, team_name) VALUES 
(2, 'Food Team'), (2, 'Technical Team'), (2, 'Stage Team'), (2, 'Suchi Team'),
(2, 'Help Desk Team'), (2, 'Medical Team'), (2, 'Marketing Team'), (2, 'Registration Team'),
(2, 'Gunmilan Committee'), (2, 'Welcome Committee'),
(3, 'भोजन समिती'), (3, 'तांत्रिक समिती'), (3, 'स्टेज समिती'), (3, 'सूची समिती'),
(3, 'मदत कक्ष समिती'), (3, 'वैद्यकीय समिती'), (3, 'मार्केटिंग समिती'), (3, 'नोंदणी समिती'),
(3, 'गुणमिलन समिती'), (3, 'स्वागत समिती')
ON DUPLICATE KEY UPDATE team_name = VALUES(team_name);

-- Insert Roles
INSERT INTO akhil_pune_bhavsar.roles (language_id, role_name) VALUES 
(2, 'President'), (2, 'Vice President'), (2, 'Treasurer'), (2, 'Secretary'), (2, 'Joint Secretary'),
(2, 'Technical Team Coordinator'), (2, 'Lead Software Developer'), (2, 'Software Testing & Tech Support'),
(2, 'Backoffice'), (2, 'Data Suchi Verification Committee'), (2, 'Printer'), (2, 'Online Suchi Guider'),
(2, 'Batch ID Distributor'), (2, 'Suchi Distributor'), (2, 'Suchi Advertisement Committee'), 
(2, 'Announcement Committee'), (2, 'Decoration Role'), (2, 'Rangoli Role'), (2, 'Anchoring Role'),
(2, 'Introduction Committee'), (2, 'Youtube Live Role'), (2, 'Stage Help Support'), 
(2, 'Social Media Campaign Role'), (2, 'Registration Role'), (2, 'Coupon Distributor'), (2, 'Stock Maintainer'),
(3, 'अध्यक्ष'), (3, 'उपाध्यक्ष'), (3, 'खजिनदार'), (3, 'सचिव'), (3, 'सहसचिव'),
(3, 'टेक्निकल टीम समन्वयक'), (3, 'मुख्य सॉफ्टवेअर डेव्हलपर'), (3, 'सॉफ्टवेअर टेस्टिंग टेक्निकल सपोर्ट'),
(3, 'बॅक ऑफिस (Backoffice)'), (3, 'डेटा सूची पडताळणी समिती'), (3, 'प्रिंटर'), (3, 'ऑनलाईन सूची मार्गदर्शक'),
(3, 'बॅच आयडी वितरक'), (3, 'सूची वितरक'), (3, 'सूची जाहिरात समिती'), 
(3, 'निवेदन समिती'), (3, 'सजावट (Decoration)'), (3, 'रांगोळी'), (3, 'सूत्रसंचालन (Anchoring)'),
(3, 'परिचय समिती'), (3, 'यूट्यूब लाईव्ह (YouTube Live)'), (3, 'स्टेज मदत व सपोर्ट'), 
(3, 'सोशल मीडिया कॅम्पेन'), (3, 'नोंदणी प्रतिनिधी'), (3, 'कुपन वितरक'), (3, 'स्टॉक व्यवस्थापक')
ON DUPLICATE KEY UPDATE role_name = VALUES(role_name);

USE akhil_pune_bhavsar;

SET @add_adhyaksha_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'client_core_committee' AND column_name = 'adhyaksha_volunteer_id'),
    'SELECT 1', 'ALTER TABLE client_core_committee ADD COLUMN adhyaksha_volunteer_id INT NULL AFTER client_id'
);
PREPARE add_adhyaksha_volunteer_id_stmt FROM @add_adhyaksha_volunteer_id;
EXECUTE add_adhyaksha_volunteer_id_stmt;
DEALLOCATE PREPARE add_adhyaksha_volunteer_id_stmt;

SET @add_upa_adhyaksha_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'client_core_committee' AND column_name = 'upa_adhyaksha_volunteer_id'),
    'SELECT 1', 'ALTER TABLE client_core_committee ADD COLUMN upa_adhyaksha_volunteer_id INT NULL AFTER adhyaksha_email'
);
PREPARE add_upa_adhyaksha_volunteer_id_stmt FROM @add_upa_adhyaksha_volunteer_id;
EXECUTE add_upa_adhyaksha_volunteer_id_stmt;
DEALLOCATE PREPARE add_upa_adhyaksha_volunteer_id_stmt;

SET @add_khajindar_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'client_core_committee' AND column_name = 'khajindar_volunteer_id'),
    'SELECT 1', 'ALTER TABLE client_core_committee ADD COLUMN khajindar_volunteer_id INT NULL AFTER upa_adhyaksha_email'
);
PREPARE add_khajindar_volunteer_id_stmt FROM @add_khajindar_volunteer_id;
EXECUTE add_khajindar_volunteer_id_stmt;
DEALLOCATE PREPARE add_khajindar_volunteer_id_stmt;

SET @add_sachiv_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'client_core_committee' AND column_name = 'sachiv_volunteer_id'),
    'SELECT 1', 'ALTER TABLE client_core_committee ADD COLUMN sachiv_volunteer_id INT NULL AFTER sachiv_email'
);
PREPARE add_sachiv_volunteer_id_stmt FROM @add_sachiv_volunteer_id;
EXECUTE add_sachiv_volunteer_id_stmt;
DEALLOCATE PREPARE add_sachiv_volunteer_id_stmt;

SET @add_upasachiv_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'client_core_committee' AND column_name = 'upasachiv_volunteer_id'),
    'SELECT 1', 'ALTER TABLE client_core_committee ADD COLUMN upasachiv_volunteer_id INT NULL AFTER upasachiv_email'
);
PREPARE add_upasachiv_volunteer_id_stmt FROM @add_upasachiv_volunteer_id;
EXECUTE add_upasachiv_volunteer_id_stmt;
DEALLOCATE PREPARE add_upasachiv_volunteer_id_stmt;
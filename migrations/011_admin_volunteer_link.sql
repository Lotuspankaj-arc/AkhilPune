USE akhil_pune_bhavsar;

SET @add_volunteer_id = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'admin_users' AND column_name = 'volunteer_id'),
    'SELECT 1', 'ALTER TABLE admin_users ADD COLUMN volunteer_id INT NULL, ADD INDEX idx_admin_users_volunteer_id (volunteer_id)'
);
PREPARE add_volunteer_id_stmt FROM @add_volunteer_id;
EXECUTE add_volunteer_id_stmt;
DEALLOCATE PREPARE add_volunteer_id_stmt;

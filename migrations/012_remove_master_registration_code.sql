USE akhil_pune_bhavsar;

SET @drop_master_registration_code = (
        SELECT IF(COUNT(*) > 0, 'ALTER TABLE candidates DROP COLUMN registration_code', 'SELECT 1')
        FROM information_schema.columns
        WHERE table_schema = DATABASE()
            AND table_name = 'candidates'
            AND column_name = 'registration_code'
);

PREPARE drop_master_registration_code FROM @drop_master_registration_code;
EXECUTE drop_master_registration_code;
DEALLOCATE PREPARE drop_master_registration_code;

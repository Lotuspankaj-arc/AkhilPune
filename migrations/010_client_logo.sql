USE akhil_pune_bhavsar;

SET @add_logo_data = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clients' AND column_name = 'logo_data'),
    'SELECT 1', 'ALTER TABLE clients ADD COLUMN logo_data LONGBLOB NULL'
);
PREPARE add_logo_data_stmt FROM @add_logo_data;
EXECUTE add_logo_data_stmt;
DEALLOCATE PREPARE add_logo_data_stmt;

SET @add_logo_mime = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'clients' AND column_name = 'logo_mime_type'),
    'SELECT 1', 'ALTER TABLE clients ADD COLUMN logo_mime_type VARCHAR(100) NULL'
);
PREPARE add_logo_mime_stmt FROM @add_logo_mime;
EXECUTE add_logo_mime_stmt;
DEALLOCATE PREPARE add_logo_mime_stmt;
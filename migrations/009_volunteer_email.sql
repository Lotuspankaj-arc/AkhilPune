USE akhil_pune_bhavsar;

SET @add_volunteer_email = IF(
	EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'volunteers' AND column_name = 'email'),
	'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN email VARCHAR(255) NULL'
);
PREPARE add_volunteer_email_stmt FROM @add_volunteer_email;
EXECUTE add_volunteer_email_stmt;
DEALLOCATE PREPARE add_volunteer_email_stmt;
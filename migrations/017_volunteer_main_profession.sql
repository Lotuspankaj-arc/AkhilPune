USE akhil_pune_bhavsar;

SET @add_main_profession = IF(
    EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'volunteers' AND column_name = 'main_profession'),
    'SELECT 1', 'ALTER TABLE volunteers ADD COLUMN main_profession VARCHAR(150) NULL AFTER birthdate'
);
PREPARE add_main_profession_stmt FROM @add_main_profession;
EXECUTE add_main_profession_stmt;
DEALLOCATE PREPARE add_main_profession_stmt;

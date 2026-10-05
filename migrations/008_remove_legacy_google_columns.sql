USE akhil_pune_bhavsar;

SET @drop_drive_folder = IF(
	EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'drive_folder_id'),
	'ALTER TABLE events DROP COLUMN drive_folder_id', 'SELECT 1'
);
PREPARE drop_drive_folder_stmt FROM @drop_drive_folder;
EXECUTE drop_drive_folder_stmt;
DEALLOCATE PREPARE drop_drive_folder_stmt;

SET @drop_drive_candidates_folder = IF(
	EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'events' AND column_name = 'drive_candidates_folder_id'),
	'ALTER TABLE events DROP COLUMN drive_candidates_folder_id', 'SELECT 1'
);
PREPARE drop_drive_candidates_folder_stmt FROM @drop_drive_candidates_folder;
EXECUTE drop_drive_candidates_folder_stmt;
DEALLOCATE PREPARE drop_drive_candidates_folder_stmt;
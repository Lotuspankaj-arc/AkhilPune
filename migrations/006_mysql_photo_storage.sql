USE akhil_pune_bhavsar;

ALTER TABLE events
    ADD COLUMN organizer_photo_data LONGBLOB NULL AFTER organizer_photo,
    ADD COLUMN organizer_photo_mime_type VARCHAR(100) NULL AFTER organizer_photo_data,
    ADD COLUMN registration_banner_data LONGBLOB NULL AFTER registration_banner_path,
    ADD COLUMN registration_banner_mime_type VARCHAR(100) NULL AFTER registration_banner_data;

ALTER TABLE volunteers
    ADD COLUMN photo_data LONGBLOB NULL AFTER photo_url,
    ADD COLUMN photo_mime_type VARCHAR(100) NULL AFTER photo_data;
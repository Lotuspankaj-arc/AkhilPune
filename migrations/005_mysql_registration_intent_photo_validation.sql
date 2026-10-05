USE akhil_pune_bhavsar;

ALTER TABLE registration_intents
    ADD COLUMN photo_validation_status VARCHAR(30) NULL AFTER photo_mime_type,
    ADD COLUMN photo_validated_at DATETIME NULL AFTER photo_validation_status;
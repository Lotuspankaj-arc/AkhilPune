USE akhil_pune_bhavsar;

ALTER TABLE candidates
    ADD COLUMN education_category VARCHAR(255) NULL AFTER education_details;

-- Each paid/free event registration gets its own stage-facing code.
-- The candidate batch_id remains the stable master-profile identity.
ALTER TABLE candidate_event_registrations
    ADD COLUMN event_registration_code VARCHAR(64) NULL AFTER event_id;

ALTER TABLE candidate_event_registrations
    ADD UNIQUE KEY ux_event_registration_code (event_registration_code);

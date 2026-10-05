USE akhil_pune_bhavsar;

ALTER TABLE clients
    ADD COLUMN public_slug VARCHAR(255) NULL,
    ADD COLUMN homepage_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN homepage_title VARCHAR(255) NULL,
    ADD COLUMN homepage_intro TEXT NULL,
    ADD COLUMN registration_form_config JSON NULL;

CREATE UNIQUE INDEX ux_clients_public_slug ON clients(public_slug);

UPDATE clients
SET public_slug = LOWER(TRIM(BOTH '-' FROM REGEXP_REPLACE(client_name, '[^a-zA-Z0-9]+', '-')))
WHERE public_slug IS NULL;

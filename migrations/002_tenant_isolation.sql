USE akhil_pune_bhavsar;

ALTER TABLE volunteers ADD COLUMN client_id INT NULL;
ALTER TABLE volunteers ADD INDEX idx_volunteers_client_id (client_id);
ALTER TABLE volunteers ADD CONSTRAINT fk_volunteers_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE;

ALTER TABLE volunteer_groups ADD COLUMN client_id INT NULL;
ALTER TABLE volunteer_groups ADD INDEX idx_volunteer_groups_client_id (client_id);
ALTER TABLE volunteer_groups ADD CONSTRAINT fk_volunteer_groups_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE;

ALTER TABLE teams ADD COLUMN client_id INT NULL;
ALTER TABLE teams ADD INDEX idx_teams_client_id (client_id);
ALTER TABLE teams ADD CONSTRAINT fk_teams_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE;

ALTER TABLE volunteer_team_assignments ADD COLUMN client_id INT NULL;
ALTER TABLE volunteer_team_assignments ADD INDEX idx_team_assignments_client_id (client_id);
ALTER TABLE volunteer_team_assignments ADD CONSTRAINT fk_team_assignments_client FOREIGN KEY (client_id) REFERENCES clients(client_id) ON DELETE CASCADE;

ALTER TABLE client_admin_mapping ADD UNIQUE INDEX ux_client_admin_single_client (admin_id);

CREATE INDEX idx_candidate_event_registrations_client_event
    ON candidate_event_registrations (client_id, event_id, batch_id);

CREATE INDEX idx_subscriptions_client_event
    ON subscriptions (client_id, event_id, batch_id);

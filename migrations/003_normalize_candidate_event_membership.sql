USE akhil_pune_bhavsar;

-- Candidate identity is independent from event participation.
-- `candidates.event_id` is retained for legacy compatibility; the canonical
-- relationship is candidate_event_registrations, one row per candidate/event.

INSERT INTO candidate_event_registrations
    (batch_id, event_id, client_id, registration_date, is_active)
SELECT
    c.batch_id,
    c.event_id,
    e.client_id,
    COALESCE(c.registration_date, CURRENT_TIMESTAMP),
    c.is_active
FROM candidates c
INNER JOIN events e ON e.event_id = c.event_id
LEFT JOIN candidate_event_registrations cer
    ON cer.batch_id = c.batch_id AND cer.event_id = c.event_id
WHERE c.event_id IS NOT NULL
  AND cer.registration_id IS NULL;

INSERT INTO subscriptions
    (batch_id, event_id, client_id, registration_date, access_expiry_date, is_active)
SELECT
    cer.batch_id,
    cer.event_id,
    cer.client_id,
    cer.registration_date,
    DATE_ADD(cer.registration_date, INTERVAL 6 MONTH),
    cer.is_active
FROM candidate_event_registrations cer
LEFT JOIN subscriptions s
    ON s.batch_id = cer.batch_id AND s.event_id = cer.event_id
WHERE s.subscription_id IS NULL;

-- Migration 001 already creates the table-level indexes. Do not recreate
-- them here: MySQL has no portable CREATE INDEX IF NOT EXISTS syntax.

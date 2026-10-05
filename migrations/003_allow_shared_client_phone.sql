USE akhil_pune_bhavsar;

-- A contact phone can be shared by multiple communities/clients.
-- Client names remain unique; phone numbers are no longer globally unique.
ALTER TABLE clients
    DROP INDEX ux_phone_number;

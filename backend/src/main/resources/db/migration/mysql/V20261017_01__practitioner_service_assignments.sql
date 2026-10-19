-- Apply after V20261016_01 and before the booking-capacity application build.
-- Existing practitioners remain unrestricted so current bookings and catalog availability are preserved.
ALTER TABLE practitioners
    ADD COLUMN service_assignments_restricted BIT(1) NOT NULL DEFAULT b'0';

CREATE TABLE practitioner_service_assignments (
    practitioner_id BIGINT NOT NULL,
    service_id BIGINT NOT NULL,
    PRIMARY KEY (practitioner_id, service_id),
    CONSTRAINT fk_practitioner_assignment_person FOREIGN KEY (practitioner_id) REFERENCES practitioners(id),
    CONSTRAINT fk_practitioner_assignment_service FOREIGN KEY (service_id) REFERENCES service_offerings(id),
    INDEX idx_practitioner_assignment_service (service_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

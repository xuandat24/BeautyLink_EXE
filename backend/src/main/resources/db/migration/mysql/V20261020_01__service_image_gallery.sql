-- MANUAL RELEASE STEP: back up first; apply once before deploying the gallery backend.
-- Additive and nullable: existing covers and legacy application versions remain unchanged.
ALTER TABLE service_offerings ADD COLUMN image_urls LONGTEXT NULL;
-- Code rollback: leave this nullable column in place. Do not drop it: gallery data would be lost.

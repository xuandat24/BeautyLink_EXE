-- Additive, apply once before deploying code that selects UserAccount.avatarUrl.
-- Retain this nullable column on code rollback; no account/booking/payment rows are changed.
-- LONGTEXT matches the existing public-image storage legacy mode when Cloudinary is disabled.
ALTER TABLE user_accounts ADD COLUMN avatar_url LONGTEXT NULL;

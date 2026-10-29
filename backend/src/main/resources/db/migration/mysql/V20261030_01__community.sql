-- Manual additive migration. Pause Railway auto-deploy BEFORE merge; verify backup/restore.

-- Never execute against production from tests. Existing account/service/workforce tables must exist.

CREATE TABLE IF NOT EXISTS community_posts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  author_id BIGINT NOT NULL,
  CONSTRAINT fk_community_posts_author FOREIGN KEY (author_id) REFERENCES user_accounts(id),
  request_key VARCHAR(36) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  content VARCHAR(5000) NOT NULL,
  category VARCHAR(24) NOT NULL,
  visibility VARCHAR(24) NOT NULL,
  identity VARCHAR(24) NOT NULL,
  salon_id BIGINT NULL,
  CONSTRAINT fk_community_posts_salon FOREIGN KEY (salon_id) REFERENCES suppliers(id),
  practitioner_id BIGINT NULL,
  CONSTRAINT fk_community_posts_practitioner FOREIGN KEY (practitioner_id) REFERENCES practitioners(id),
  service_id BIGINT NULL,
  CONSTRAINT fk_community_posts_service FOREIGN KEY (service_id) REFERENCES service_offerings(id),
  like_count BIGINT NOT NULL DEFAULT 0,
  comment_count BIGINT NOT NULL DEFAULT 0,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_community_post_request UNIQUE (author_id,request_key),
  INDEX idx_community_feed (visibility,id),
  INDEX idx_community_topic (visibility,category,id),
  INDEX idx_community_author (author_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_post_media (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  owner_id BIGINT NOT NULL,
  CONSTRAINT fk_community_post_media_owner FOREIGN KEY (owner_id) REFERENCES user_accounts(id),
  post_id BIGINT NULL,
  CONSTRAINT fk_community_post_media_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
  url VARCHAR(700) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_community_media_post (post_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_comments (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  post_id BIGINT NOT NULL,
  CONSTRAINT fk_community_comments_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
  author_id BIGINT NOT NULL,
  CONSTRAINT fk_community_comments_author FOREIGN KEY (author_id) REFERENCES user_accounts(id),
  parent_id BIGINT NULL,
  CONSTRAINT fk_community_comments_parent FOREIGN KEY (parent_id) REFERENCES community_comments(id),
  request_key VARCHAR(36) NOT NULL,
  fingerprint VARCHAR(64) NOT NULL,
  content VARCHAR(2000) NOT NULL,
  visibility VARCHAR(24) NOT NULL,
  revision BIGINT NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_community_comment_request UNIQUE (post_id,author_id,request_key),
  INDEX idx_community_thread (post_id,parent_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_reactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  CONSTRAINT fk_community_reactions_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
  author_id BIGINT NOT NULL,
  CONSTRAINT fk_community_reactions_author FOREIGN KEY (author_id) REFERENCES user_accounts(id),
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_community_reaction UNIQUE (post_id,author_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_reports (
  target_revision BIGINT NOT NULL DEFAULT 0,
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  public_id VARCHAR(36) NOT NULL UNIQUE,
  post_id BIGINT NOT NULL,
  CONSTRAINT fk_community_reports_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
  comment_id BIGINT NULL,
  CONSTRAINT fk_community_reports_comment FOREIGN KEY (comment_id) REFERENCES community_comments(id),
  reporter_id BIGINT NOT NULL,
  CONSTRAINT fk_community_reports_reporter FOREIGN KEY (reporter_id) REFERENCES user_accounts(id),
  target_key VARCHAR(36) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  resolved BOOLEAN NOT NULL DEFAULT 0,
  created_at DATETIME(6) NOT NULL,
  CONSTRAINT uk_community_report UNIQUE (reporter_id,target_key,target_revision),
  INDEX idx_community_report_queue (resolved,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_moderation_actions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  post_id BIGINT NOT NULL,
  CONSTRAINT fk_community_moderation_actions_post FOREIGN KEY (post_id) REFERENCES community_posts(id),
  comment_id BIGINT NULL,
  CONSTRAINT fk_community_moderation_actions_comment FOREIGN KEY (comment_id) REFERENCES community_comments(id),
  moderator_id BIGINT NOT NULL,
  CONSTRAINT fk_community_moderation_actions_moderator FOREIGN KEY (moderator_id) REFERENCES user_accounts(id),
  action VARCHAR(24) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  INDEX idx_community_audit_post (post_id,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS community_restrictions (
  id BIGINT PRIMARY KEY,
  blocked BOOLEAN NOT NULL DEFAULT 0,
  updated_at DATETIME(6) NOT NULL,
  CONSTRAINT fk_community_restriction_account FOREIGN KEY (id) REFERENCES user_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

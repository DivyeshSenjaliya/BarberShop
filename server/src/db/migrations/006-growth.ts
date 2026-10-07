import type { Migration } from '../migrate';

/**
 * Growth & Engagement:
 * - Coupons & promotions with usage limits, service restrictions, and date windows.
 * - Coupon redemptions log.
 * - Customer loyalty accounts and immutable loyalty transactions ledger.
 * - Verified reviews, ratings (shop + barber), owner replies, and moderation reports.
 * - Customer favorites (shops, barbers).
 * - Notifications and user notification preferences.
 */
export const migration: Migration = {
  id: '006',
  name: 'growth',
  sql: `
CREATE TABLE coupons (
  id                  TEXT PRIMARY KEY,
  shop_id             TEXT REFERENCES shops (id) ON DELETE CASCADE,
  code                TEXT NOT NULL UNIQUE,
  discount_type       TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value      INTEGER NOT NULL CHECK (discount_value > 0),
  min_order_cents     INTEGER NOT NULL DEFAULT 0 CHECK (min_order_cents >= 0),
  max_discount_cents  INTEGER CHECK (max_discount_cents IS NULL OR max_discount_cents > 0),
  usage_limit         INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
  per_user_limit      INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  times_used          INTEGER NOT NULL DEFAULT 0 CHECK (times_used >= 0),
  first_booking_only  INTEGER NOT NULL DEFAULT 0 CHECK (first_booking_only IN (0, 1)),
  service_id          TEXT REFERENCES services (id) ON DELETE SET NULL,
  starts_at           TEXT NOT NULL,
  expires_at          TEXT NOT NULL,
  is_active           INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_coupons_code ON coupons (code);
CREATE INDEX idx_coupons_shop ON coupons (shop_id, is_active);
CREATE INDEX idx_coupons_validity ON coupons (starts_at, expires_at);

CREATE TABLE coupon_redemptions (
  id              TEXT PRIMARY KEY,
  coupon_id       TEXT NOT NULL REFERENCES coupons (id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  appointment_id  TEXT REFERENCES appointments (id) ON DELETE SET NULL,
  invoice_id      TEXT REFERENCES invoices (id) ON DELETE SET NULL,
  discount_cents  INTEGER NOT NULL CHECK (discount_cents > 0),
  redeemed_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_coupon_redemptions_user ON coupon_redemptions (user_id, coupon_id);
CREATE INDEX idx_coupon_redemptions_coupon ON coupon_redemptions (coupon_id);

CREATE TABLE loyalty_accounts (
  id                  TEXT PRIMARY KEY,
  user_id             TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  points_balance      INTEGER NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  lifetime_earned     INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  lifetime_redeemed   INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_redeemed >= 0),
  tier                TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_loyalty_user ON loyalty_accounts (user_id);

CREATE TABLE loyalty_transactions (
  id              TEXT PRIMARY KEY,
  account_id      TEXT NOT NULL REFERENCES loyalty_accounts (id) ON DELETE CASCADE,
  type            TEXT NOT NULL CHECK (type IN ('earned_booking', 'redeemed_discount', 'referral_bonus', 'promotional', 'manual_adjustment', 'expired')),
  points          INTEGER NOT NULL,
  balance_after   INTEGER NOT NULL CHECK (balance_after >= 0),
  reference_id    TEXT,
  description     TEXT,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_loyalty_tx_account ON loyalty_transactions (account_id, created_at);

CREATE TABLE reviews (
  id                    TEXT PRIMARY KEY,
  appointment_id        TEXT UNIQUE REFERENCES appointments (id) ON DELETE SET NULL,
  customer_id           TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  shop_id               TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  staff_id              TEXT REFERENCES staff (id) ON DELETE SET NULL,
  rating                INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  staff_rating          INTEGER CHECK (staff_rating IS NULL OR (staff_rating >= 1 AND staff_rating <= 5)),
  title                 TEXT,
  comment               TEXT NOT NULL,
  images_json           TEXT,
  status                TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'under_review', 'hidden', 'flagged')),
  owner_reply           TEXT,
  owner_replied_at      TEXT,
  is_verified_booking   INTEGER NOT NULL DEFAULT 1 CHECK (is_verified_booking IN (0, 1)),
  created_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_reviews_shop ON reviews (shop_id, status, created_at);
CREATE INDEX idx_reviews_staff ON reviews (staff_id, status, created_at);
CREATE INDEX idx_reviews_customer ON reviews (customer_id, created_at);

CREATE TABLE review_reports (
  id            TEXT PRIMARY KEY,
  review_id     TEXT NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
  reporter_id   TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reason        TEXT NOT NULL CHECK (reason IN ('spam', 'inappropriate', 'harassment', 'fake', 'other')),
  details       TEXT,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_review_reports_review ON review_reports (review_id, status);

CREATE TABLE favorites (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  target_type   TEXT NOT NULL CHECK (target_type IN ('shop', 'barber')),
  target_id     TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (user_id, target_type, target_id)
) STRICT;

CREATE INDEX idx_favorites_user ON favorites (user_id, target_type);

CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type          TEXT NOT NULL CHECK (type IN ('booking_confirmed', 'booking_reminder', 'booking_cancelled', 'booking_rescheduled', 'payment_success', 'payment_failed', 'refund_processed', 'review_request', 'promotional', 'system')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  data_json     TEXT,
  read_at       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_notifications_user ON notifications (user_id, read_at, created_at);

CREATE TABLE notification_preferences (
  id                      TEXT PRIMARY KEY,
  user_id                 TEXT NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  email_booking_updates   INTEGER NOT NULL DEFAULT 1 CHECK (email_booking_updates IN (0, 1)),
  email_reminders         INTEGER NOT NULL DEFAULT 1 CHECK (email_reminders IN (0, 1)),
  email_promotions        INTEGER NOT NULL DEFAULT 0 CHECK (email_promotions IN (0, 1)),
  push_booking_updates    INTEGER NOT NULL DEFAULT 1 CHECK (push_booking_updates IN (0, 1)),
  push_reminders          INTEGER NOT NULL DEFAULT 1 CHECK (push_reminders IN (0, 1)),
  push_promotions         INTEGER NOT NULL DEFAULT 0 CHECK (push_promotions IN (0, 1)),
  sms_booking_updates     INTEGER NOT NULL DEFAULT 1 CHECK (sms_booking_updates IN (0, 1)),
  created_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at              TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_notif_prefs_user ON notification_preferences (user_id);
`,
};

import type { Migration } from '../migrate';

/**
 * Catalog: shops, branches, opening hours, holidays, service categories
 * and services.
 *
 * Design notes:
 * - A shop owns branches; every address, schedule and appointment hangs
 *   off a branch, because customers book a *place*, not a brand.
 * - Prices are integer cents; `price_type` distinguishes a fixed price
 *   from "starting from" marketing prices.
 * - Per-branch enablement (and optional price override) lives in
 *   `branch_services`, so rolling a service out to one location is data,
 *   not code.
 * - Soft deletion keeps historical appointments joinable.
 */
export const migration: Migration = {
  id: '002',
  name: 'catalog',
  sql: `
CREATE TABLE shops (
  id             TEXT PRIMARY KEY,
  owner_id       TEXT NOT NULL REFERENCES users (id),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  description    TEXT,
  phone          TEXT,
  email          TEXT,
  website        TEXT,
  timezone       TEXT NOT NULL DEFAULT 'UTC',
  currency       TEXT NOT NULL DEFAULT 'USD',
  logo_url       TEXT,
  cover_url      TEXT,
  status         TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft', 'pending', 'active', 'suspended', 'closed')),
  rating_avg     REAL NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count   INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
) STRICT;

CREATE UNIQUE INDEX idx_shops_slug ON shops (slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_shops_owner ON shops (owner_id);
CREATE INDEX idx_shops_status ON shops (status) WHERE deleted_at IS NULL;

CREATE TABLE branches (
  id             TEXT PRIMARY KEY,
  shop_id        TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  address_line1  TEXT NOT NULL,
  address_line2  TEXT,
  city           TEXT NOT NULL,
  region         TEXT,
  postal_code    TEXT NOT NULL,
  country        TEXT NOT NULL DEFAULT 'US',
  latitude       REAL CHECK (latitude IS NULL OR (latitude >= -90 AND latitude <= 90)),
  longitude      REAL CHECK (longitude IS NULL OR (longitude >= -180 AND longitude <= 180)),
  phone          TEXT,
  timezone       TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'temporarily_closed', 'closed')),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
) STRICT;

CREATE UNIQUE INDEX idx_branches_shop_name ON branches (shop_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_branches_shop_status ON branches (shop_id, status);
CREATE INDEX idx_branches_location ON branches (latitude, longitude);

-- Weekly opening hours. closes_at is NULL for a closed day; a branch
-- without rows is treated as closed.
CREATE TABLE business_hours (
  id             TEXT PRIMARY KEY,
  branch_id      TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at       TEXT CHECK (opens_at IS NULL OR opens_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  closes_at      TEXT CHECK (closes_at IS NULL OR closes_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  closed         INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  valid_from     TEXT NOT NULL DEFAULT '1970-01-01',
  valid_until    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((closed = 1) OR (opens_at IS NOT NULL AND closes_at IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX idx_business_hours_slot
  ON business_hours (branch_id, weekday, valid_from);

CREATE TABLE holidays (
  id             TEXT PRIMARY KEY,
  branch_id      TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  holiday_date   TEXT NOT NULL,
  name           TEXT NOT NULL,
  recurring      INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0, 1)),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
) STRICT;

CREATE UNIQUE INDEX idx_holidays_branch_date ON holidays (branch_id, holiday_date) WHERE deleted_at IS NULL;

-- Categories may be platform-wide (shop_id NULL) or shop-specific.
CREATE TABLE service_categories (
  id             TEXT PRIMARY KEY,
  shop_id        TEXT REFERENCES shops (id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  description    TEXT,
  icon_url       TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at     TEXT
) STRICT;

CREATE UNIQUE INDEX idx_categories_scope_slug
  ON service_categories (IFNULL(shop_id, '-'), slug)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_categories_shop_order ON service_categories (shop_id, sort_order);

CREATE TABLE services (
  id               TEXT PRIMARY KEY,
  shop_id          TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  category_id      TEXT REFERENCES service_categories (id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  slug             TEXT NOT NULL,
  description      TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 5 AND 480),
  buffer_minutes   INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes BETWEEN 0 AND 120),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  price_type       TEXT NOT NULL DEFAULT 'fixed'
                   CHECK (price_type IN ('fixed', 'from', 'custom')),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'inactive')),
  image_url        TEXT,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at       TEXT
) STRICT;

CREATE UNIQUE INDEX idx_services_shop_slug ON services (shop_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX idx_services_shop_status ON services (shop_id, status, sort_order);
CREATE INDEX idx_services_category ON services (category_id);

-- Which branches offer which services, with an optional price override.
CREATE TABLE branch_services (
  branch_id        TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  service_id       TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  price_cents      INTEGER CHECK (price_cents IS NULL OR price_cents >= 0),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (branch_id, service_id)
) STRICT;

CREATE INDEX idx_branch_services_service ON branch_services (service_id, enabled);
`,
};

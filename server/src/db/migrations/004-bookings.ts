import type { Migration } from '../migrate';

/**
 * Bookings engine: appointments, appointment service items, and status change audit log.
 *
 * Design notes:
 * - Appointments belong to a branch (the place) and assign a staff member (the professional).
 * - Multi-service bookings are supported via `appointment_services`.
 * - Status transitions are recorded in `appointment_status_history` for full auditability.
 * - Conflict detection queries index `staff_id`, `starts_at`, `ends_at` excluding cancelled/no_show.
 */
export const migration: Migration = {
  id: '004',
  name: 'bookings',
  sql: `
CREATE TABLE appointments (
  id                  TEXT PRIMARY KEY,
  shop_id             TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  branch_id           TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES users (id),
  staff_id            TEXT NOT NULL REFERENCES staff (id),
  status              TEXT NOT NULL DEFAULT 'confirmed'
                      CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  appointment_date    TEXT NOT NULL,
  starts_at           TEXT NOT NULL,
  ends_at             TEXT NOT NULL,
  duration_minutes    INTEGER NOT NULL CHECK (duration_minutes > 0),
  buffer_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (buffer_minutes >= 0),
  total_price_cents   INTEGER NOT NULL CHECK (total_price_cents >= 0),
  currency            TEXT NOT NULL DEFAULT 'USD',
  notes               TEXT,
  cancellation_reason TEXT,
  cancelled_by        TEXT REFERENCES users (id) ON DELETE SET NULL,
  cancelled_at        TEXT,
  created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at          TEXT,
  CHECK (starts_at < ends_at)
) STRICT;

CREATE INDEX idx_appointments_staff_window
  ON appointments (staff_id, starts_at, ends_at)
  WHERE status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL;

CREATE INDEX idx_appointments_customer
  ON appointments (customer_id, starts_at);

CREATE INDEX idx_appointments_branch_date
  ON appointments (branch_id, appointment_date, starts_at);

CREATE INDEX idx_appointments_shop_status
  ON appointments (shop_id, status, starts_at);

-- Multi-service items associated with an appointment
CREATE TABLE appointment_services (
  id               TEXT PRIMARY KEY,
  appointment_id   TEXT NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  service_id       TEXT NOT NULL REFERENCES services (id),
  service_name     TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents      INTEGER NOT NULL CHECK (price_cents >= 0),
  sort_order       INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_appointment_services_apt
  ON appointment_services (appointment_id, sort_order);

-- Status change audit log
CREATE TABLE appointment_status_history (
  id             TEXT PRIMARY KEY,
  appointment_id TEXT NOT NULL REFERENCES appointments (id) ON DELETE CASCADE,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  changed_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  reason         TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE INDEX idx_appointment_status_history_apt
  ON appointment_status_history (appointment_id, created_at);
`,
};

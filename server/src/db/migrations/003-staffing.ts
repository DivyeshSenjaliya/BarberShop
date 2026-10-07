import type { Migration } from '../migrate';

/**
 * Staffing: barber/staff profiles, their skills, branches, working
 * schedules, breaks, leave requests and ad-hoc availability overrides.
 *
 * The availability story has three layers, evaluated in this order by the
 * booking engine:
 *   1. `staff_schedules`  — recurring weekly working hours
 *   2. `staff_breaks`     — recurring pauses inside a working day
 *   3. `staff_leaves` / `staff_availability_overrides` — day-specific
 *      changes (approved leave closes the day; an override can open or
 *      close individual windows).
 *
 * A staff member without a user account is allowed (`user_id` NULL) so a
 * shop can be seeded before inviting people to the app.
 */
export const migration: Migration = {
  id: '003',
  name: 'staffing',
  sql: `
CREATE TABLE staff (
  id               TEXT PRIMARY KEY,
  user_id          TEXT REFERENCES users (id) ON DELETE SET NULL,
  shop_id          TEXT NOT NULL REFERENCES shops (id) ON DELETE CASCADE,
  employee_code    TEXT NOT NULL,
  display_name     TEXT NOT NULL,
  title            TEXT,
  bio              TEXT,
  avatar_url       TEXT,
  email            TEXT,
  phone            TEXT,
  commission_bps   INTEGER NOT NULL DEFAULT 0
                   CHECK (commission_bps >= 0 AND commission_bps <= 10000),
  status           TEXT NOT NULL DEFAULT 'active'
                   CHECK (status IN ('invited', 'active', 'inactive', 'terminated')),
  employment       TEXT NOT NULL DEFAULT 'full_time'
                   CHECK (employment IN ('full_time', 'part_time', 'contract', 'chair_rental')),
  can_accept_bookings INTEGER NOT NULL DEFAULT 1 CHECK (can_accept_bookings IN (0, 1)),
  rating_avg       REAL NOT NULL DEFAULT 0 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count     INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  hired_at         TEXT,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  deleted_at       TEXT
) STRICT;

CREATE UNIQUE INDEX idx_staff_shop_code ON staff (shop_id, employee_code) WHERE deleted_at IS NULL;
CREATE INDEX idx_staff_user ON staff (user_id);
CREATE INDEX idx_staff_shop_status ON staff (shop_id, status) WHERE deleted_at IS NULL;

-- Skills: which services a staff member can perform.
CREATE TABLE staff_services (
  staff_id     TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  service_id   TEXT NOT NULL REFERENCES services (id) ON DELETE CASCADE,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (staff_id, service_id)
) STRICT;

CREATE INDEX idx_staff_services_service ON staff_services (service_id);

-- Where a staff member works; the first branch is their home location.
CREATE TABLE staff_branches (
  staff_id     TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  branch_id    TEXT NOT NULL REFERENCES branches (id) ON DELETE CASCADE,
  is_primary   INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (staff_id, branch_id)
) STRICT;

CREATE INDEX idx_staff_branches_branch ON staff_branches (branch_id);

-- Recurring weekly working hours for one staff member.
CREATE TABLE staff_schedules (
  id             TEXT PRIMARY KEY,
  staff_id       TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  starts_at      TEXT NOT NULL CHECK (starts_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  ends_at        TEXT NOT NULL CHECK (ends_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  valid_from     TEXT NOT NULL DEFAULT '1970-01-01',
  valid_until    TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (starts_at < ends_at)
) STRICT;

CREATE UNIQUE INDEX idx_staff_schedules_slot
  ON staff_schedules (staff_id, weekday, valid_from);
CREATE INDEX idx_staff_schedules_staff ON staff_schedules (staff_id, weekday);

-- Recurring breaks inside a scheduled working day.
CREATE TABLE staff_breaks (
  id             TEXT PRIMARY KEY,
  staff_id       TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  weekday        INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  name           TEXT,
  starts_at      TEXT NOT NULL CHECK (starts_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  ends_at        TEXT NOT NULL CHECK (ends_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (starts_at < ends_at)
) STRICT;

CREATE UNIQUE INDEX idx_staff_breaks_slot
  ON staff_breaks (staff_id, weekday, starts_at);

-- Leave requests: approved leave removes availability for whole days.
CREATE TABLE staff_leaves (
  id             TEXT PRIMARY KEY,
  staff_id       TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  starts_on      TEXT NOT NULL,
  ends_on        TEXT NOT NULL,
  half_day       INTEGER NOT NULL DEFAULT 0 CHECK (half_day IN (0, 1)),
  reason         TEXT,
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  decided_at     TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (starts_on <= ends_on)
) STRICT;

CREATE INDEX idx_staff_leaves_window ON staff_leaves (staff_id, status, starts_on, ends_on);

-- Day-specific availability changes: close a day, extend a shift, or
-- block a single hour without touching the recurring schedule.
CREATE TABLE staff_availability_overrides (
  id             TEXT PRIMARY KEY,
  staff_id       TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  override_date  TEXT NOT NULL,
  available      INTEGER NOT NULL DEFAULT 0 CHECK (available IN (0, 1)),
  starts_at      TEXT CHECK (starts_at IS NULL OR starts_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  ends_at        TEXT CHECK (ends_at IS NULL OR ends_at GLOB '[0-2][0-9]:[0-5][0-9]'),
  reason         TEXT,
  created_by     TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((available = 0) OR (starts_at IS NOT NULL AND ends_at IS NOT NULL))
) STRICT;

CREATE UNIQUE INDEX idx_staff_overrides_day
  ON staff_availability_overrides (staff_id, override_date);

-- Attendance punches for commission and performance reporting.
CREATE TABLE staff_attendance (
  id             TEXT PRIMARY KEY,
  staff_id       TEXT NOT NULL REFERENCES staff (id) ON DELETE CASCADE,
  work_date      TEXT NOT NULL,
  clock_in       TEXT,
  clock_out      TEXT,
  status         TEXT NOT NULL DEFAULT 'present'
                 CHECK (status IN ('present', 'late', 'absent', 'on_leave', 'half_day')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (clock_in IS NULL OR clock_out IS NULL OR clock_in <= clock_out)
) STRICT;

CREATE UNIQUE INDEX idx_staff_attendance_day ON staff_attendance (staff_id, work_date);
`,
};

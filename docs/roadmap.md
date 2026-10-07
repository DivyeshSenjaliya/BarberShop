# Development Roadmap

The roadmap is derived from the [audit](./audit.md). It is ordered so that every batch
builds on a working foundation; each bullet is expected to become one or more commits.

## Phase 0 — Foundations

- [x] Record audit and roadmap (this batch).
- [x] Scaffold `server/` workspace: TypeScript, Express, SQLite, Jest.
- [x] Core kernel: config loader, structured logger, error taxonomy, request IDs.
- [x] Validation layer (shared zod schemas + error formatting).
- [x] Database: migration runner, initial schema, indexes, constraints.
- [x] Repository layer (users, sessions) + test fixtures.

## Phase 1 — Identity & access

- [x] Users: registration, login, password hashing (scrypt), sessions/JWT.
- [x] Refresh tokens, logout, token revocation (rotation with reuse detection).
- [x] Roles and permissions (customer, barber, manager, owner, admin).
- [x] Rate limiting on auth endpoints.
- [ ] Mobile: auth screens wired to the real API, secure token storage.

## Phase 2 — Catalog

- [x] Schema: shops, branches, business hours, holidays.
- [x] Schema: service categories, services, durations, pricing, per-branch overrides.
- [x] Schema: staff profiles, roles, skills, working hours, breaks, leave, attendance.
- [x] Shops/branches/services/staff repositories and services.
- [x] Catalog API endpoints.
- [x] Staff availability computation (moved into Phase 3 with the booking engine).

## Phase 3 — Booking engine

- [x] Availability computation (hours ∩ staff schedule ∩ breaks ∩ existing bookings).
- [x] Booking creation with server-side conflict detection and cancellation window.
- [x] Rescheduling and cancellation with state machine.
- [x] Buffer time, multi-service bookings, per-staff schedules.
- [x] Tests: no double booking, out-of-hours rejected, deadline enforced.

## Phase 4 — Money

- [x] Payment abstraction (mock provider + provider interface).
- [x] Invoices: tax, discount, coupon, refunds (full/partial), payment states.
- [x] Wallet and transaction records.
- [x] Refund state machine and tests.

## Phase 5 — Growth features

- [ ] Coupons & promotions with usage limits and validation.
- [ ] Loyalty point ledger, earning, redemption, expiry, referrals.
- [ ] Reviews & ratings (shop/barber/service), moderation, owner responses, reports.
- [ ] Favourites (shops, barbers).
- [ ] Notifications: in-app + email/push abstractions, preferences, templates.

## Phase 6 — Discovery

- [ ] Search & filters (category, price, rating, distance, availability) + sorting.
- [ ] Pagination and query optimisation, indexes.

## Phase 7 — Dashboard

- [ ] Admin/owner web dashboard: revenue, bookings, customers, staff analytics.
- [ ] Staff portal: schedule, appointment statuses, earnings/commission.

## Phase 8 — Mobile polish

- [ ] Design-system components (Button, Input, Modal, Drawer, Table, Toast, …).
- [ ] State management, offline-friendly API client, error boundaries.
- [ ] Remaining customer screens wired to real data.

## Phase 9 — Quality & operations

- [ ] Error handling audit, logging/observability, performance pass,
      security hardening, accessibility, documentation.

---

Progress is tracked in commit history; this file is updated as phases complete.

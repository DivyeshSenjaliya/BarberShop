# Development Roadmap

The roadmap is derived from the [audit](./audit.md). It is ordered so that every batch
builds on a working foundation; each bullet is expected to become one or more commits.

## Phase 0 — Foundations

- [ ] Record audit and roadmap (this batch).
- [ ] Scaffold `server/` workspace: TypeScript, Express, SQLite, Jest.
- [ ] Core kernel: config loader, structured logger, error taxonomy, request IDs.
- [ ] Validation layer (shared zod schemas + error formatting).
- [ ] Database: migration runner, initial schema, indexes, constraints.
- [ ] Repository layer + seed data.

## Phase 1 — Identity & access

- [ ] Users: registration, login, password hashing (scrypt), sessions/JWT.
- [ ] Refresh tokens, logout, token revocation.
- [ ] Roles and permissions (customer, barber, manager, owner, admin).
- [ ] Rate limiting on auth endpoints.
- [ ] Mobile: auth screens wired to the real API, secure token storage.

## Phase 2 — Catalog

- [ ] Shops, branches, business hours, holidays.
- [ ] Service categories, services, durations, pricing, add-ons.
- [ ] Staff/barber profiles, roles, permissions, working hours, breaks.
- [ ] Staff availability and leave.

## Phase 3 — Booking engine

- [ ] Availability computation (hours ∩ staff schedule ∩ breaks ∩ existing bookings).
- [ ] Booking creation with server-side conflict detection and cancellation window.
- [ ] Rescheduling and cancellation with state machine.
- [ ] Buffer time, multi-service bookings, per-staff schedules.
- [ ] Tests: no double booking, out-of-hours rejected, deadline enforced.

## Phase 4 — Money

- [ ] Payment abstraction (mock provider + provider interface).
- [ ] Invoices: tax, discount, coupon, refunds (full/partial), payment states.
- [ ] Wallet and transaction records.
- [ ] Refund state machine and tests.

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

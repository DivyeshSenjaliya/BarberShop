# Codebase Audit — BarberShop

_Date of audit: 2026-10-07_

## 1. Stack

| Area            | Technology                                                      |
| --------------- | --------------------------------------------------------------- |
| App             | React Native 0.73.6 (JavaScript, no TypeScript in `src/`)       |
| Navigation      | `@react-navigation/native` + `native-stack` (single stack)      |
| State           | None — local `useState` per screen                              |
| Networking      | Raw `fetch` to `dummyjson.com` (a demo placeholder API)         |
| Tests           | One smoke test (`__tests__/App.test.tsx`)                       |
| Backend         | None — the app has no server of its own                         |
| Database        | None                                                            |
| CI / CD         | None                                                             |
| Lint / format   | ESLint (`@react-native` preset), Prettier                       |

## 2. Folder structure

```
src/
  assests/        images + Inter fonts (note: misspelling of "assets")
  component/      Card.js — three unrelated list renderers in one file
  constants/      Color.js, Fonts.js, Services.js (hardcoded demo data)
  navigator/      Navigation.js — one flat stack, 13 screens
  screen/         13 screen files (Welcome, Login, SignUp, Services, …)
  utilits/        Scale.js (note: misspelling of "utils")
```

Total `src/` + `__tests__/` lines: **~2,175**.

## 3. Features that exist today

- Onboarding / welcome slides.
- Email + password sign-up and login **forms** (validation is inline string checks; the
  login request goes to a third-party demo API and its response is only `console.log`ed).
- Forgot-password / reset screens (pure UI, no logic).
- Service listing screen fed by hardcoded `Service` constants.
- Barbers/professionals list, checkout, summary, card-entry screens — all driven by
  hardcoded data and static UI.

## 4. Incomplete / fake features

- `Login.handleFetch` posts credentials to `dummyjson.com` and does nothing with the result.
- `Reset`, `Forgot`, `SelectProfessional`, `BusinessPage` have no working logic.
- `Checkout` shows a "Payment Successful" modal without any payment being performed.
- `Color.red` is literally `'yellow'` — the colour constant file is a placeholder.
- No persistence of anything: no tokens, no bookings, no user profile.

## 5. Technical debt

- **Language**: everything under `src/` is untyped JS; `App.tsx` is the only TS file.
- **Duplication**: header/back-button markup is copy-pasted into every screen with the
  same inline `styles.header`; the payment-method row is duplicated between
  `Checkout.js` and `SelectProfessional.js`; card input rows duplicated between
  `BusinessPage.js` and `SingUp.js`.
- **Styling**: colours (`#3244E9`, `#16161B`, `#EFF3F9`, `#554F67`) and font sizes are
  inlined everywhere instead of coming from a theme; `Color.js` is unused for this.
- **Naming**: `utilits/`, `assests/`, `SingUp.js`, `Welcome1/2` — typos and unclear names.
- **Dead code**: `text` state in `Login`/`BusinessPage` never used; `Screen` import from
  `react-native-screens` unused in `Card.js`; `onFinishRating={this.ratingCompleted}`
  references `this` outside a class.
- **Navigation**: flat stack with no auth gating, no typed route params, screens
  navigate by magic strings.
- **Error handling**: `try/catch` around a promise chain that cannot be caught;
  user-facing errors are raw strings (`{isEmail && <Text>…</Text>}`) and one of them
  says "Email is empty" for a password error.
- **Validation**: duplicated ad-hoc `if (x === '')` checks, no shared rules.
- **Security**: no token handling, no secure storage, credentials logged, no env config.
- **Performance**: images required eagerly, lists not virtualised with keys, no
  memoisation anywhere.

## 6. Missing entirely

Backend/API, database, migrations, seed data, authentication & authorisation,
availability/booking engine, payments, reviews, coupons, loyalty, notifications,
favourites, search/discovery, analytics, admin & staff tooling, error boundary,
theming, design-system components, API client layer, environment configuration,
logging, rate limiting, documentation, meaningful tests.

## 7. Decision

The existing React Native app stays as the **customer application**. We keep the screen
flow and visual language (blue `#3244E9` accent, rounded cards, `scale()` sizing) and
evolve it in place: introduce TypeScript, a theme, a reusable component library, a
typed API client and real state management.

We add, alongside it, the parts that make it a real product:

- `server/` — TypeScript API (Express + SQLite) with domain modules, migrations,
  validation, RBAC and tests.
- `web/` — owner/staff admin dashboard.
- `docs/` — architecture, API, database and operations documentation.

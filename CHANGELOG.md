# Changelog

All notable changes to Hudoor. Dates are local (Africa/Cairo).
Format loosely follows Keep a Changelog; versions are not tagged yet.

## [Unreleased] — 2026-10-25

### Added

- **Student Attendance screen** (`/student/attendance`): overall register
  head, per-course cards with expandable lecture/section split, threshold
  marker on each progress bar, semester heatmap, filterable ledger with
  "show more", safe-miss/recovery line, excuse and dispute wizards.
- **Student Me screen** (`/student/me`): profile summary, study details,
  bound device + reset request, language, theme, text size, reduced motion,
  notification preferences with quiet hours, data export, privacy/terms,
  account-deletion request, install prompt, existing passkeys, sign out.
- **`lib/attendance.ts`** + `tests/attendance.test.mjs`: single source of
  truth for percentages, excused removal, late weight, lecture/section
  combination, verdicts, safe misses and heatmap severity.
- **`lib/scan-input.ts`** + `tests/scan-input.test.mjs`: manual fallback
  parser for a full scan URL or raw compact token.
- **Privacy and terms pages** (`/privacy`, `/terms`) with bilingual content
  in `lib/legal.ts`; version 1.0, updated 2026-10-25.
- **Signup consent checkbox** linking both documents; consent version stored
  in auth metadata and, when available, in the `consents` ledger.
- **`GET /api/student/export`**: JSON download of the caller's own data.
- **Migration 014** (`notification_prefs`, `push_subscriptions`, `consents`,
  RLS, notification defaults). Committed, not applied live.
- **PWA icons**: 192, 512 and Apple touch icon, plus the layout link.
- **Five-tab student navigation** with scan kept in the centre.
- **ESLint toolchain** (`.eslintrc.json`, `eslint`, `eslint-config-next`).

### Changed

- Student home now uses `summariseAttendance()`, respects each course's
  `attendance_rule`, includes `timetable_slots(session_type)`, excludes
  cancelled sessions, and passes the per-course threshold to the shared card.
- Late weight default is now `1` (was `0.5` in the participation helper);
  explicit `0.5` rules still work.
- `SegmentedControl` items and sheet close buttons meet 44 px touch targets;
  Attendance/Me action buttons and inline dispute links were raised to 44 px.
- Bottom sheet supports controlled `open` / `onOpenChange`.
- Manual scan entry was added to both `/scan` and `/student/scan-in-app`.

### Fixed

- Attendance `tally()` labelled every aggregate kind as `"other"`, so the
  lecture/section summary could never be trusted.
- Scan token failures no longer collapse into one message: `token_expired`
  tells the student to scan the current QR; `bad_token` rejects an unrelated
  code.
- Scan retries reuse one idempotency key; successful replies are cached for
  90 seconds on the same server instance, while the DB unique constraint stays
  the hard duplicate guard.
- Unauthenticated scan attempts are now flagged, and authenticated scans have
  an account-level rate limit.
- The in-app scanner no longer calls hooks conditionally (lint error), and the
  camera-denied/aborted/in-use triage remains intact.
- `Input` forwards its ref, so react-hook-form `register()` actually mounts the
  field; this was the root cause of visible input still reporting "Required".
- The onboarding stepper is a normal import (`components/hudoor/stepper.tsx`)
  instead of `dynamic(ssr:false)`, so swapping the fallback no longer unmounts
  fields mid-typing.
- Onboarding gate dismissal keys on a stable error signature, so it reacts even
  when react-hook-form reuses the same errors object.
- Field-specific Arabic/English onboarding messages are asserted by tests.

### Security / privacy

- Attendance remains server-time and signed-token based; manual fallback cannot
  bypass the token.
- Export is scoped to the authenticated caller and sends `no-store` +
  `nosniff`.
- Legal text is explicit that university legal review and a hosting decision
  (including possible processing outside Egypt) are still required.
- Passkey UI is intentionally not offered until the v14 WebAuthn API and
  session creation are fixed.

### Docs

- `DECISIONS.md` added (this phase's choices and costs).
- `CHANGELOG.md` added.
- `AUDIT.md` and `README.md` updated with current coverage, migration range,
  verified results and remaining limitations.

### Verification (at the time of writing)

- `npx tsc --noEmit` — clean.
- `npm test` — **88 passing, 0 failing**; one suite (NTG PDF fixture) skipped
  by design. 25 suites.
- `npm run lint` — exits 0; warnings only (pre-existing `exhaustive-deps` and
  two `<img>` warnings).
- `npx next build` — succeeds, **45/45 static pages**, including
  `/student/attendance`, `/student/me`, `/privacy` and `/terms`.

### Known gaps

- Migration 014 is not applied live; server-side notification preferences and
  the consent ledger are inert until it is. Verified via `list_migrations`:
  live head is `013_qr_scans_retention`, and the 014 tables do not exist.
- Passkey registration/authentication is broken against the installed
  `@simplewebauthn/server` v14 API and authentication does not create a session.
- `npm install` reports 35 advisories in the dependency tree (5 low, 2 moderate,
  27 high, 1 critical); not yet triaged.
- Anti-relay signals beyond replay detection/flagging, RLS cross-tenant tests,
  load tests and PDF import remain out of scope.

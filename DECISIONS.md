# Hudoor — Decisions log

Short, dated records of choices that affect behaviour. Newest first.
Each entry says what was chosen, why, and what it costs.

---

## 2026-10-25 — Student attendance, Me, privacy, scan reliability

### 1. One attendance formula for the whole product

**Decision.** `lib/attendance.ts` is the only place that turns attendance
records into a percentage. Student home, the Attendance screen and the shared
course card all call `summariseAttendance()`.

Rules implemented:

- denominator = `present + late + absent`; **excused sessions are removed
  entirely**, not counted as present or absent;
- numerator = `present + late × late_weight` (default **1**, clamped 0–1);
- only finished sessions with a recorded/derived status count; future and
  cancelled sessions are ignored;
- lecture and section percentages are reported separately and combined with
  the course rule: `all` (default), `worst`, or `weighted`
  (`lecture_weight` / `section_weight`);
- threshold = `attendance_rule.min_pct` (legacy `threshold` accepted),
  default 75, clamped 1–100;
- verdict: `safe` at/above threshold, `watch` within 10 points, `at_risk`
  further below, `none` when nothing is countable;
- safe misses = `floor(counted × 100 / threshold − total)`.

**Why.** Three screens previously disagreed after a late scan or an approved
excuse. Duplicated formulas cannot stay consistent, and attendance is the one
number students will challenge.

**Cost.** A course with only future sessions shows `—`, not `0%`; an empty
course must never look like a failing course.

### 2. Late counts fully by default

**Decision.** `late_weight` defaults to `1` in `lib/settings.ts` and
`lib/attendance.ts`. A course can still set `late_weight: 0.5` explicitly.

**Why.** The brief defines a late arrival as attendance; treating it as half a
class by default contradicted that and made students appear below the line
after arriving. Explicit legacy rules keep working.

### 3. Session kind comes from the timetable slot

**Decision.** `attendance_sessions` has no `session_type`; the UI embeds
`timetable_slots(session_type)` through `slot_id` and falls back to `other`
for manual sessions. Lecture/section splits only appear when the data exists.

**Why.** Avoids a schema change and keeps one source of truth for whether a
class is a lecture or a section.

### 4. Student navigation has five destinations

**Decision.** `/student`, `/student/timetable`, scan (centre), 
`/student/attendance`, `/student/me`.

**Why.** Attendance and profile were reachable only from cards, which is not
discoverable on a phone. Scan stays the centre action so it never moves.

### 5. Me screen degrades instead of failing

**Decision.** Notification preferences, quiet hours and consent rows use
`notification_prefs` / `consents` from migration 014 when present. If the
table is missing or the request fails, preferences are stored in
`localStorage`, the UI says so, and the rest of the page still works.

**Why.** The page ships before the migration is applied; a missing optional
table must not blank the profile. Server-side notification delivery remains
the source of truth once 014 is applied.

**Cost.** Preferences saved locally do not affect server-sent notifications.
The UI does not pretend they do.

### 6. Passkeys are listed, not offered

**Decision.** The Me page shows existing passkeys if the account has any, but
does not present an "add passkey" flow.

**Why.** The existing WebAuthn routes were written for an older
`@simplewebauthn/server` API (`credentialID` / `credentialPublicKey` instead
of `registrationInfo.credential.*`), and the authentication finish route does
not create a session. Shipping the button would promise a login method that
cannot work. Device binding remains stored-device-ID plus an admin-approved
reset.

**Next step.** Rewrite registration/authentication against the installed
v14 API and create the Supabase session in the finish route; then enable the
UI.

### 7. Scan retries are idempotent, fallbacks keep the security model

**Decision.**

- The client generates an `idempotencyKey` per logical attempt, stores it in
  `sessionStorage` (`hudoor_scan_idem:<token>`) and reuses it for network
  retries. The server keeps a best-effort 90-second in-memory map keyed by
  `user:key`.
- The database unique constraint `(session_id, student_id)` remains the hard
  guarantee; the cache only avoids repeating work when a response was lost.
- The manual fallback accepts a **full scan URL or the raw compact JWT** —
  never a short join code. A short code would be guessable and would bypass
  the signed-token model.
- Expired tokens and invalid signatures return different codes
  (`token_expired` vs `bad_token`) so the UI can tell the student to rescan
  the live QR instead of implying they scanned the wrong class.
- Unauthenticated scan attempts are written to the flag log; authenticated
  attempts also have an account-level rate limit (20/min) on top of the
  device/IP limits.

**Why.** Double-taps and tunnel timeouts produced duplicate errors or
"already marked" confusion; silently accepting short codes would have weakened
the core anti-proxy control.

**Cost.** The idempotency cache is per server instance and expires; a retry
after a cold start relies on the unique constraint and returns
`already_marked` — still correct.

### 8. Legal text describes only shipped behaviour

**Decision.** Privacy and terms live in `lib/legal.ts` (Arabic + English,
version 1.0, updated 2026-10-25) and render at `/privacy` and `/terms`.
Signup requires an explicit checkbox; the version is stored in auth metadata
and, when migration 014 exists, copied into the `consents` ledger on signup or
first login.

**Why.** Publishing aspirational promises is worse than publishing a shorter
truthful policy. The text states that the university/program is the
controller, lists the data actually stored, names Egypt PDPL 151/2020, and
says legal review plus a hosting decision are still required.

**Cost.** The pages are not a substitute for university legal approval.

### 9. Data export is self-service and scoped to the caller

**Decision.** `GET /api/student/export` returns the signed-in user's profile,
details, enrollments, attendance, excuses, disputes, service requests,
devices, passkeys, preferences and consents as a JSON download. It uses the
service role **after** resolving the session user and filters every query by
that user ID; no query accepts an ID from the request.

**Why.** A privacy policy that promises access without a way to exercise it is
incomplete. Account deletion remains a reviewed request
(`service_requests.type = 'data_change'`) because it needs retention and
academic-record decisions.

### 10. ESLint is part of the toolchain again

**Decision.** Added `eslint@8.57.1`, `eslint-config-next@14.2.5` and
`.eslintrc.json`. `npm run lint` now runs. Warnings are reported, not
suppressed globally.

**Why.** The brief requires lint as a gate, and `next lint` previously could
not start at all. Fixing the two real errors (conditional hooks in the in-app
scanner, an unknown rule disable) was part of adding the gate.

### 11. Migration 014 is additive and intentionally unapplied here

**Decision.** `014_student_prefs.sql` adds `notification_prefs`,
`push_subscriptions`, `consents`, RLS policies and two notification defaults.
It is committed but **not applied to the live database** in this phase.

**Why.** Schema changes to a shared database need an owner with backup/rollback
context. The application tolerates its absence, so shipping code first is safe.
Apply it before enabling server-driven notifications or relying on the consent
ledger.

### 12. Touch targets and motion are explicit

**Decision.** Interactive controls on the new screens are at least 44 px tall;
the Me screen can force reduced motion (`.reduce-motion`) and a larger base
font without changing OS settings.

**Why.** The app is used one-handed, outdoors, often in a hurry. Motion and
text-size preferences are accessibility requirements, not decoration.

### 13. PWA icons are real files

**Decision.** Added `icon-192.png`, `icon-512.png` and
`apple-touch-icon.png`, matching the manifest and the existing brand mark.
Maskable safe area was checked (badge inside the inner 80%).

**Why.** The manifest referenced files that did not exist, so installation
silently fell back to a screenshot/letter tile.

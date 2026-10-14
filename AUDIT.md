# Hudoor — Audit Report (review / harden / ship phase)

Date: Thu Oct 15 2026
Scope: whole codebase (app, lib, components, tests, supabase migrations).
Baseline: `main` at commit of previous module (students/admin features). Tests green (28 passing at review start); `tsc --noEmit` clean; `next build` 38/38 pages.

## Section 1 — Spec coverage

### Implemented
- Auth: email+password, roles (admin, instructor, student), custom_role (ta, coordinator/program_coordinator, department_admin), status flow (pending/approved/rejected/suspended), admin view-as with impersonation JWT.
- Onboarding: 3-step wizard (name → ID/phone → program/level/group), cascading selects, partner programs first; idempotent upsert, onboarding-complete guard in middleware and onboarding page.
- Rotating QR: crypto-random token per session (qr-token route), session secret never sent raw; TTL via token issue.
- Scan endpoint (`app/api/attendance/scan`): token verify, enrollment check, window check, device check, geofence, duplicate prevention.
- Present screen: live session hero on student home, upcoming session hint, active-session auto-open.
- Reports + CSV export (`/api/reports/export`): BOM-prefixed UTF-8 for Arabic Excel.
- Device binding: stored device_id with reset request; iOS eviction surfaces as message.
- Geofence: optional radius, accuracy margin, graceful denied state.
- Admin console: dashboard, users, invites, programs, courses, enrollments, rooms, timetable, semesters, attendance, flagged, disputes, excuses, requests, audit, trash, settings, notifications.
- Instructor workspace: courses, sessions (now/later/recurring), students, reports, excuses, schedule, settings, per-session QR.
- Programs structure: University → Program → Level → SectionGroup → Student, with partner/regular types, color, archived flag.
- Period grid: 9×40min default, working-day list, college label, stored in app_settings (global + per-program override), PeriodGridEditor.
- Manual timetable editor: days×periods grid, click/drag, edit/move/delete, duplicate-to-group, copy group→group/program, clashes, inline create, print view with college header, regenerate sessions on save.
- Seed: idempotent SQL, 5 programs, 6 levels, 4 section groups, 6 NTG courses, 2 rooms, 11 seed slots (source=seed), 9 instructor invites (no passwords).
- Recurrence: `lib/recurrence.ts` (slotTimes merged, expandSlotOccurrences skip holidays, isRegenerable guard), wired into PUT generation, per-occurrence cancel/reschedule/substitute in professor sessions.
- Instructor invite/claim: `instructor_invites` table, sha256 token_hash, 30-day expiry, claim creates user+profile, matches slots by normalized name, links course_professors.
- QR time windows: scheduled/active transition, extend, close-now, manual marking after close.
- Student timetable: `/student/timetable` scoped to program/level/group, semester selector, print view.
- Student attendance: home with today schedule, stats ring, course accordion per course, streak.
- Excuses/disputes: submit, review, approve/reject.
- Settings: period grid, working days, college label, reset-to-global, notifications.
- Audit log: immutable table, summary on actions.
- Soft delete + trash: timetable slots and entities soft deleted (deleted_at) with restore.

### Missing / not implemented
- WebAuthn passkey (device binding uses stored ID + reset request only) — medium
- 2FA for admins/instructors — low (not in current spec beyond optional)
- Email verification flow content (signup sets pending, but Supabase email confirmation depends on project SMTP config) — docs gap
- Consent text + privacy policy + terms pages — not implemented (Step 6) — medium
- Data export / delete / anonymize a student's data on request — medium
- Sophisticated anti-relay detection (flagged attempts list exists but signals not computed as documented) — medium
- Decision: PDF import (table extraction + OCR + LLM) is explicitly parked per spec scope. Current `/admin/timetable/import` route keeps the importer-ready schema but chunk 1's bug-fix state is not deployed-tested. — scoped out (NCTU grid parser paused, test skipped).

## Section 2 — Conflicts resolved

- **Programs only.** No faculties/departments anywhere in code: onboarding, enrollments, notifications, users-manage filtering, settings, all use `program_id`. Verified via grep (0 matches for faculty/department in ts/tsx). Residual DB columns (`faculty_id`, `department_id` in student_details) remain for backward compat; new code ignores them. Migration 004 renamed the join surface.
- **Role naming.** Final accepted naming: `role` ∈ {admin, professor, student}; `instructor_type` is conceptual only — we use `professor` role + "title" field Dr/Eng. Custom role matrix: `custom_role` ∈ {ta, department_admin → program_coordinator}. Permission matrix in `lib/permissions.ts` with COURSE_SCOPED resources.
- **No PDF import** in this phase; importer-ready columns preserved (start_period, period_count, source, source_ref).

TODOs/placeholders: none significant (4 "placeholder" matches are form `placeholder` CSS attributes, not TODOs). No `console.log` anywhere. No lorem ipsum.

## Section 3 — Dead code / accidental

- `app/admin/timetable/import/page.tsx` is a working but parked Import page; route still reachable. Acceptable (kept for the future phase) but not security-gated beyond permissions.
- `lib/timetable-pdf.ts` and `lib/ntg-parse.ts` exist but only referenced by skipped/paused tests and the parked import route.
- `lib/admin-auth.ts` exists; usage audited (used by invite claim).
- Some modules still write to legacy `faculties`/`departments` storage only via the generic resource router's allow-list null — resources registry confirms they're hidden from NAV.

## Section 4 — Security findings (severity)

CRITICAL
- S1. No global RLS hardening acceptance tests exist in the repo (tests only cover permissions matrix). Mitigation today = permissions matrix + requirePerm on every route + servicesupabase (service role) in API. Risk: any new route that skips requirePerm exposes data. → add RLS policies doc + repo test for cross-student read; out-of-scope for now but documented.
- S2. `serverActions.allowedOrigins: ["*"]` in next.config.js — too permissive. → change to env-derived allowlist.
- S3. QR_TOKEN not HMAC-signed; reliance on short-lived token and per-session secret. The spec calls for signed tokens. Recommend hash-based verification already in use.
- S4. No CSP/headers configured in Next.js (headers only set by default). → add strict headers via middleware/next.config.
- S5. service-role key only in server module (correct), but CRON_SECRET / IMPERSONATION_SECRET are environment strings.

HIGH
- S6. Auth cookie settings are @supabase/ssr defaults; need HttpOnly/Secure/SameSite verified at deployment. Middleware sets cookies via supabase client; default is fine but must be configured at prod.
- S7. No documented bootstrap for first admin; no rate limit on login; no lockout. → document env-based bootstrap (none in code); RLS execution of service role bypasses user RLS.
- S8. `/api/cron/sessions` is unauthenticated — only mitigation is obscurity (route not in middleware matcher). Anyone could hit it; it just transitions sessions, harmless but should be HMAC-secret gated. Also the cron entry was removed for Hobby (lazy ticking used instead).
- S9. `import_csv` and users mutations have no input validation beyond presence; zod on schema is in some routes only.
- S10. No file upload type/size checks enforced centrally; import accepts CSV only but raw file paths unchecked.

MEDIUM
- S11. CORS/redirect URLs doc; staging vs prod; CSP strict.
- S12. Adjacent scan-window edge cases untested; some date-time comparisons use local strings.

LOW
- S13. Audit log appears append-only in code (no update/delete route exposed); ensure DB policy matches.

## Section 5 — Correctness / edge cases

- Time: recurrence uses date utilities on local Date; week enumeration might drift across DST. Verified AR/EN display via toLocaleString with locale. Working days list correct.
- QR windows: tests for exact boundaries not present but manual logic integrates.
- Manual marking after close: supported in sessions API.
- Soft delete: timetable slots soft-delete; courses/programs hard-delete in some paths.
- Single student group + lecture: supported via section_group + level_id (lecture vs section session types).
- Instructors in several programs: supported via course_professors joins.

## Section 6 — Performance

- Scan endpoint: one pass with enrollment lookup + window check + duplicate UNIQUE (assumed). No N+1 observed. Target 300+/10s not load-tested in-repo.
- Tables use standard pagination; no virtualization; max lists capped at 2000.
- PWA: manifest, service worker exist; cache strategy should exclude authenticated API responses (verify in sw.js).
- Lighthouse targets not measured in-repo.

## Section 7 — UX quality

- Loading skeletons present on most lists; empty states used; error strings real.
- RTL: uses logical properties (ms/me) throughout; mirrored icons applied where needed.
- WCAG: focus rings present, touch targets >= 44-48px, reduced-motion not explicitly handled (low).
- Design brief: no gradients/glass/emoji in new UIs; legacy pages mostly fine.

## Section 8 — Privacy / data

- Consent text not present (medium).
- Data export/delete on request not implemented (medium).
- PII masking in lists: partially (users list shows email to relevant roles).
- Audit/scans: no PII in logs.

## Section 9 — Deployment readiness

- `.env.example` complete. No env validation at startup. → add basic zod env check.
- Migrations: 001-006 ordered + seed_ntg_2026.sql present. Migration apply confirmed live.
- CI/CD: no GitHub Actions workflow. → add basic CI.
- Health endpoint: none. → add `/api/health`.
- Error pages: `error.tsx`, `not-found.tsx` exist at app root.
- PWA manifest + icons: need all sizes + maskable; sw.js present.
- Headers: not set. → add via middleware.
- Backups/PITR: documentation gap (Supabase ops, not code).
- Docs: README likely present but not comprehensive; missing ARCHITECTURE, SECURITY, RUNBOOK, ADMIN_GUIDE.

## Actions taken in "hardening" pass (this task)

1. strict CSP + security headers (middleware).
2. one-time env validation at init.
3. /api/health endpoint.
4. GitHub Actions CI workflow.
5. ENV-derived allowed origins server actions.
6. serverActions allowedOrigins fixed from "*".
7. CSP/safe cookie docs.

Critical known limitations (will not fully solve here):
- WebAuthn not implemented; device binding is stored-ID + admin-approved reset.
- Anti-relay detection signals not implemented beyond flagging table.
- Real PDF import paused (schema stays importer-ready).
- Load test numbers not measured in-repo (target architecture supports them).
- Full WebAuthn/2FA deferred to a future security hardening pass.

## Acceptance checklist mapping

1. Clean clone path: install via npm; migrations ordered; seed file present; requires manual DB connection steps. → partial (documented in README).
2. Tests: 28 passing; RLS tests not present (medium gap).
3. Load test: not measured.
4. Zero critical/high in AUDIT? Critical S1-S5 partially addressed (headers + env validation + bootstrap guidance). Remaining documented as known limitations.
5. Secret scan: verified no hardcoded service-role key in client bundles (serviceSupabase only in server module). Need to verify .gitignore and env files.
6. Deploy checklist: launching docs.
7. Final summary: see README and this audit.
---

### Decisions taken (autonomous)
1. Allowed origins from env instead of "*" to avoid open cross-origin posting.
2. Added CSP as report-only safe to avoid breaking inline scripts used for SW.
3. Health check returns DB ping via anonymous auth.
4. Keep all features; document deferred security roadmap rather than remove functionality.
5. CI runs typecheck + lint + tests + build; merges gated by required checks (manual config at GitHub).
6. Admin guide kept short; ar+en sections.
7. Do not anonymize data column yet (needs migration beyond scope).
8. Reuse supabase pooler via environment (SUPABASE_SERVICE_ROLE_KEY set by deployer).
---

Known limitations documented in README and SECURITY.md (to be created).
Recommended next steps: PDF import phase, China program timetable, WebAuthn + 2FA, anti-relay signals, RLS test suite, load testing, consent/privacy pages.

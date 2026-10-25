# Hudoor (حضور) — University Attendance

Next.js 14 PWA for university attendance with rotating QR codes, Supabase backend,
Arabic/RTL-first, and a manual timetable editor. Target: New Cairo Technological
University (NCTU) with NCTU (NTG) as the initial partner program.

## Quick start (local, zero manual steps)

1. **Prerequisites**: Node 20+, a local or remote Supabase project.
2. **Clone & install**
   ```bash
   git clone <repo> hudoor
   cd hudoor
   npm install
   ```
3. **Env vars**
   ```bash
   cp .env.example .env.local
   # edit .env.local with your Supabase URL, anon key, service-role key
   ```
   See `.env.example` for full list.
4. **Database**
   Apply migrations in order: `supabase/migrations/001_*.sql` → `014_*.sql`.  
   Migration 014 (notification preferences, push subscriptions, consent
   ledger) is additive; the app works without it, but server-side notification
   preferences and the consent ledger need it applied.  
   For demo data: `supabase/seed_ntg_2026.sql` then run (production = bootstrap only, no demo seed).
5. **First admin (bootstrap)**  
   Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` env vars once, run the
   bootstrap command (documented in RUNBOOK.md), then remove those vars.
6. **Run**
   ```bash
   npm run dev
   ```
   Open http://localhost:3000.

## Commands

| command | what |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (also compiles `sw.js` via Serwist) |
| `npm test` | tsc compile of lib + node tests |
| `npm run lint` | next lint |
| `npm run verify:palette` | WCAG AA contrast check of every token pair, both themes |
| `npm run bundle:report` | build + per-route First Load JS report vs budgets (`bundle-report.json`) |

Tests: `tests/attendance.test.mjs`, `tests/hardening.test.mjs`,
`tests/scan-input.test.mjs`, `tests/permissions.test.mjs`,
`tests/onboarding-validation.test.mjs`, `tests/recurrence.test.mjs`,
`tests/timetable.test.mjs` (inside recurrence), `tests/ntg-pdf.test.mjs`
(intentionally skipped). Current result: **88 passing, 0 failing**, one skipped
PDF fixture.

CI (`.github/workflows/ci.yml`) additionally runs the bundle budget (fails if `/student`
or the scanner routes exceed their caps) and Lighthouse. Lighthouse has no login flow, so
it audits the public routes that exercise the same token theme and AA contrast —
`/scan`, `/login`, `/`. The `/student` (Today) and `/student/timetable` (attendance)
screens sit behind middleware auth and would redirect to `/login`; auditing them directly
would require seeding a test-student session in CI.

## Design system

Student UI is built on a tokenized theme (`app/globals.css`, oklch, light + dark):

- **Base**: shadcn/ui primitives (Radix + CVA) restyled through tokens; Tailwind v4 `@theme`.
- **Icons**: `lucide-react` only, single stroke weight.
- **i18n/RTL**: `next-intl` (ar/en) + `next-themes` (light/dark).
- **Components**: in-house set under `components/hudoor/` (StatusPill, NextClassCard,
  WeekGrid, SemesterHeatmap, BottomSheet, CommandPalette, Toast, …). Dev-only reference
  page at `/design`.
- **React Bits (exactly 4, lazy-loaded, static fallback, reduced-motion aware)**:
  CountUp, BlurText, AnimatedList, Stepper (`components/hudoor/bits.tsx`). None appear on
  the scanner/camera routes, Present stamp, tables, forms, or professor QR screens.

## Roles

- `admin` — full control
- `professor` — own courses; instructor_type DR or ENG
- `student` — own record, scan, timetable, profile
- `coordinator` — program-scoped sub-admin (`program_admins`)
- `ta` — teaching assistant (student role + custom_role ta)

## Architecture at a glance

- `app/` Next.js 14 pages + API routes (dynamic); `app/sw.ts` is the Serwist service worker (`/sw.js`), `app/design` is a dev-only token/component reference
- `lib/` guard, permissions, supabase server/client, attendance math (`lib/attendance.ts`), scan input parsing, recurrence, validators, i18n, programs, settings, legal content
- `components/` console + UI primitives, app-nav, student-bottom-nav
- `supabase/` migrations (001-014) + seed (`seed_ntg_2026.sql`)
- Data model: University → Program → Level → SectionGroup → Student; Program → Course → Slot → Occurrence → Session → Record; Program → Instructor via `instructor_invites`, `course_professors`, `program_admins`; Settings per scope (`app_settings`: global / program).
- Student surfaces: `/student` (today), `/student/timetable`, `/student/attendance` (math + ledger + requests), `/student/me` (profile, preferences, privacy, export), `/scan` + `/student/scan-in-app`.

## Security notes

- Service-role key is server-only (`lib/supabase-server.ts`).
- RLS policies must be enabled on every Supabase table in production. The app relies on
  `requirePerm` + `myPrograms`/`inProgramScope` server-side checks; never trust DB just on RLS.
- Scan endpoint uses enrolled/verified/session-window/device/geofence checks; server time only. Retries reuse a client idempotency key, and the DB unique `(session_id, student_id)` constraint is the hard duplicate guard. Manual fallback accepts a full scan URL or the signed compact token — never a short join code.
- Privacy policy and terms are published at `/privacy` and `/terms` (bilingual, versioned in `lib/legal.ts`); signup records consent, and the signed-in student can download their own data at `/api/student/export`.
- Authentication uses Supabase cookies; set env staging/prod to HTTPS only.
- See SECURITY.md for threat model and known limitations.

## Known limitations

- Migration 014 is committed but not applied to the live database. The Me screen falls back to local preferences until it is; the consent ledger is inert.
- Passkey routes target the pre-v14 `@simplewebauthn/server` API and authentication does not create a session, so the UI intentionally offers no passkey registration. Device binding uses stored device ID + admin-approved reset.
- `npm install` currently reports 35 dependency advisories (5 low, 2 moderate, 27 high, 1 critical) that still need triage.
- PDF timetable import is parked (schema stays importer-ready). Parser in `lib/ntg-parse.ts`.
- 2FA and anti-relay detection signals are deferred to a future security pass.
- Cron on Hobby runs only daily; session ticking is lazy on page load.
- University legal review of the privacy policy and a hosting/data-residency decision are required before official launch.

## Docs

- `AUDIT.md` — full review report and fixes.
- `DECISIONS.md` — dated product/engineering decisions and their costs.
- `CHANGELOG.md` — what changed in the current unreleased phase.
- `SECURITY.md` — threat model.
- `RUNBOOK.md` — deploy, rollback, restore, bootstrap admin.
- `ARCHITECTURE.md` — data model and scan flow.
- `ADMIN_GUIDE.md` — non-technical staff guide (ar+en, short).

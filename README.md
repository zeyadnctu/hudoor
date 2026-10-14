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
   Apply migrations in order: `supabase/migrations/001_*.sql` → `005_*.sql`.  
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
| `npm run build` | production build |
| `npm test` | tsc compile of lib + node tests |
| `npm run lint` | next lint |

Tests: `tests/permissions.test.mjs`, `tests/recurrence.test.mjs`, `tests/ntg-pdf.test.mjs` (skipped).

## Roles

- `admin` — full control
- `professor` — own courses; instructor_type DR or ENG
- `student` — own record, scan, timetable, profile
- `coordinator` — program-scoped sub-admin (`program_admins`)
- `ta` — teaching assistant (student role + custom_role ta)

## Architecture at a glance

- `app/` Next.js 14 pages + API routes (dynamic)
- `lib/` guard, permissions, supabase server/client, recurrence, validators, i18n, programs, settings
- `components/` console + UI primitives, app-nav, student-bottom-nav
- `supabase/` migrations (001-006) + seed (`seed_ntg_2026.sql`)
- Data model: University → Program → Level → SectionGroup → Student; Program → Course → Slot → Occurrence → Session → Record; Program → Instructor via `instructor_invites`, `course_professors`, `program_admins`; Settings per scope (`app_settings`: global / program).

## Security notes

- Service-role key is server-only (`lib/supabase-server.ts`).
- RLS policies must be enabled on every Supabase table in production. The app relies on
  `requirePerm` + `myPrograms`/`inProgramScope` server-side checks; never trust DB just on RLS.
- Scan endpoint uses enrolled/verified/session-window/device/geofence checks; server time only.
- Authentication uses Supabase cookies; set env staging/prod to HTTPS only.
- See SECURITY.md for threat model and known limitations.

## Known limitations

- PDF timetable import is parked (schema stays importer-ready). Parser in `lib/ntg-parse.ts`.
- Device binding uses stored device ID + admin-approved reset (no WebAuthn yet).
- 2FA and anti-relay detection signals are deferred to a future security pass.
- Cron on Hobby runs only daily; session ticking is lazy on page load.
- Consent/privacy/anonymize-data pages not yet built.

## Docs

- `AUDIT.md` — full review report and fixes.
- `SECURITY.md` — threat model.
- `RUNBOOK.md` — deploy, rollback, restore, bootstrap admin.
- `ARCHITECTURE.md` — data model and scan flow.
- `ADMIN_GUIDE.md` — non-technical staff guide (ar+en, short).

# Hudoor — setup

## 1. Supabase project
1. Create project at https://supabase.com → copy Project URL, anon key, service_role key.
2. SQL Editor → run `supabase/migrations/001_schema.sql`, then `supabase/seed.sql`.
3. Auth → Providers → enable Email + (optional) Google (redirect: `NEXT_PUBLIC_APP_URL/student`).
4. Auth → Users → create admin + test users, copy their UUIDs, insert into `profiles`:
```sql
insert into profiles (id,email,role,status) values
 ('UUID','admin@hudoor.edu','admin','approved');
```

## 2. Local run
```bash
cp .env.example .env.local  # fill keys
npm install
npm run dev  # http://localhost:3000
```

## 3. Deploy (Vercel)
- Import repo, set env vars (same as .env), deploy. Service-role key only server-side (API routes use it; never `NEXT_PUBLIC_`).
- Required env vars on Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (your https domain, used inside QR links),
  `QR_TOKEN_TTL_SECONDS=15`. If Google login is used, add `<domain>/student` as redirect URL in Supabase Auth settings.
- After deploy, create the admin account from the live `/signup` page, then in Supabase SQL:
  `update profiles set role='admin', status='approved' where email='...';`.
  From then on use `/admin` → Manage data to create instructors, courses, and enrollments.

## Decisions
- QR secret never leaves server: client polls `GET /api/sessions/[id]/qr-token` which signs JWT with per-session secret (HS256, 15s TTL).
- Device ID: random stable ID in localStorage + cookie + IndexedDB best-effort; enforced server-side in `devices` (unique per student + per device).
- Geofence is soft signal: Haversine + accuracy margin; per-session toggle; mock/low-accuracy rejected.
- Server time (`now()`) used for all expiry/active checks; client countdown is display-only.
- CSV includes BOM for Arabic Excel.
- Late verdict is server-computed (`present_within_min` / `late_after_min` / grace, narrowest scope wins).
- View-as switches role gating + banner only; record data stays under RLS. Read-only by convention.

## Adding a new managed resource (no rewriting)
1. Migration: `create table` + RLS (admin write, sensible reads) + `deleted_at` if trashable.
2. `lib/resources.ts`: one `ResourceDef` entry (fields, search cols, `pk` if not `id`).
3. `lib/permissions.ts`: nothing needed if it fits an existing resource name; otherwise add the name to `RESOURCES` and grant it in `SYSTEM_MATRIX`.
4. Page: `app/admin/<name>/page.tsx` rendering `<CrudPage resource="<name>" columns={...} />` (+ optional detail drawer).
5. Sidebar: one line in `components/console/AdminShell.tsx` NAV.
6. API: none — `app/api/console/[resource]` already does list/create/edit/delete with permission checks + before/after audit + soft delete.
Custom behavior (joins, side effects) gets a dedicated route using `requirePerm` from `lib/guard.ts`.

## Console migrations
Run in order after 001: `002_console.sql` (all tables + RLS), `003_heads.sql` (heads),
then `seed_console.sql` (demo roles grants, rooms, program). New env: `IMPERSONATION_SECRET`
(32+ hex) enables admin view-as.

## Test plan (cheating)
1. Photo of QR to friend → token expires in ~15s; friend scan gets `expired_code`; attempt logged in flagged_attempts.
2. Second device → `wrong_device` unless admin resets binding; flagged.
3. Outside hall → `outside_hall` with distance; flagged. Disable geofence per session if needed.
4. Double scan → idempotent `already_marked`, single record (UNIQUE constraint).
5. Non-enrolled scanner → `not_enrolled`, flagged. Unapproved student → `not_eligible`.
6. Expired/ended session → `session_closed`.

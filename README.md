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

## Test plan (cheating)
1. Photo of QR to friend → token expires in ~15s; friend scan gets `expired_code`; attempt logged in flagged_attempts.
2. Second device → `wrong_device` unless admin resets binding; flagged.
3. Outside hall → `outside_hall` with distance; flagged. Disable geofence per session if needed.
4. Double scan → idempotent `already_marked`, single record (UNIQUE constraint).
5. Non-enrolled scanner → `not_enrolled`, flagged. Unapproved student → `not_eligible`.
6. Expired/ended session → `session_closed`.

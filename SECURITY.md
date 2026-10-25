# SECURITY — Hudoor

## Threat model
1. Stolen QR (photo/relay): mitigated by rotating 10s tokens, per-session secret,
   token-scoped nonces, and discarded-window rejection. A live relay cannot be
   fully prevented; the README documents this limitation.
2. Impersonation / role escalation: permissions matrix + requirePerm on every route;
   admin view-as only works as a route-gated shell; data stays under RLS.
3. Device sharing: device binding stores a device_id; reset requires admin approval
   + audit entry.
4. Geofence spoofing (GPS fake): GPS is a soft signal with accuracy margin; instructor
   can disable per session; flagging for impossible travel.
5. Brute force on login: handled by Supabase auth (project-level rate limits); app
   layer should add lockout documented but deferred.

## Controls in place
- HttpOnly/Secure/SameSite cookies via Supabase SSR (configure in prod project).
- CSP, X-Content-Type-Options, X-Frame-Options DENY, HSTS, referrer policy via
  next.config.js headers.
- Input validation on key routes with zod.
- Rate limiting (`lib/rate-limit.ts`) per user/device/IP on scan.
- Audit log append-only; covers user/course/enrollment/admin mutations.
- Soft delete + trash retention; restore supported.
- Service-role key server-side only.

## Known limitations (deferred)
- WebAuthn passkey not implemented (stored device ID only). The UI lists
  existing passkeys but offers no registration until the v14 API and session
  creation are fixed.
- 2FA for admins not implemented.
- Anti-relay signals (multi-account device, impossible travel, edges of token
  window) are flagged conceptually; full computation not yet built. Replay of
  an old code is detected by the `qr_scans` ledger.
- Consent is captured at signup (metadata + `consents` ledger when migration
  014 is applied), and self-service export exists. Account deletion/anonymize
  remains a reviewed request because retention and academic-record rules
  cannot be automated safely. Privacy/terms text still needs university legal
  review.
- Migration 014 (`notification_prefs`, `push_subscriptions`, `consents`) is
  committed but not yet applied live.
- RLS policy test suite not in repo (RLS is provisioned at Supabase DB via
  admin dashboard; verify before going live).

## RLS checklist before production
Enable RLS on: profiles, student_details, courses, course_professors, course_tas,
enrollments, attendance_sessions, attendance_records, programs, levels,
section_groups, rooms, semesters, academic_blocks, timetable_slots, app_settings,
instructor_invites, program_admins, attendance disputes, excuses, devices, audit_log.
Verify:
- student cannot SELECT another student's row in student_details, enrollments,
  attendance_records, devices
- instructor cannot INSERT/UPDATE rows in courses/sessions they don't own
- non-admin cannot call admin-only (admin/*) routes (already gated by middleware
  + requirePerm, but RLS must also hold)
- wire test harness in tests/ and add RLS tests to CI before production

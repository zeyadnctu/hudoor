# ARCHITECTURE — Hudoor

## Data model
University → Program → Level → SectionGroup → Student
Program → Course (per level) → TimetableSlot (day + start_period + period_count)
TimetableSlot → (recurrence) → AttendanceSession (slot_id nullable)
AttendanceSession → AttendanceRecord (UNIQUE session_id + student_id)
Course → many instructors (course_professors, course_tas)
Program admins (coordinators) via program_admins

Settings are scoped per program or global (app_settings: scope_type, scope_id, key,
value), including `period_grid`, `working_days`, `college_label`.

## Scan flow
1. Client requests QR token from `/api/sessions/[id]/qr-token` (rotating, signed,
   10-15s TTL, secret never leaves server).
2. Student scanner sends token + device_id + coords to `/api/attendance/scan`.
3. Server (single transaction): verify token (HMAC + session match + nonce + window),
   check enrollment for course, check window open/late, check duplicate
   (session_id+student_id UNIQUE), check device binding, check geofence (accuracy
   margin), then insert record (UTC time), return status (present/late).
4. Idempotent: duplicate scan returns already-recorded, no double count.

## Roles & permissions
- admin: full, custom_role null.
- professor: own courses; teaching in several programs via course_professors.
- student: own records, scan, own courses' timetable.
- coordinator (operator OR student with custom_role program_coordinator): scoped
  sub-admin over their `program_admins` portfolio.
- ta: student + custom_role ta.

## Time zones
- All timestamps stored UTC. Display/local computing uses Africa/Cairo. Weekly
  recurrence computed with local dates; working days configurable.

## Key decisions
- Programs only — no faculties/departments.
- No PDF import in this phase (manual editor + seed; schema keeps importer-ready
  columns: start_period, period_count, source, source_ref).
- Service-role key server-only.
- Time window state machine: scheduled → active → ended + paused/cancelled.

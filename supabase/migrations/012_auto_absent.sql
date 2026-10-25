-- 012: automatic absent marking for ended sessions + 'auto' method.
-- The daily cron (app/api/cron/sessions) closes ended sessions and writes
-- absent rows for students with no attendance record; the same endpoint can
-- also be ticked lazily by any signed-in console client.

alter table attendance_records drop constraint if exists attendance_records_method_check;
alter table attendance_records add constraint attendance_records_method_check
  check (method in ('scan', 'manual', 'auto'));

-- Global switch; admin toggles it in Settings -> Attendance (auto_absent).
-- Absent rows written by the cron are deletable: a late scan/manual entry
-- can still replace them (insert ... on conflict do nothing on the unique
-- index), so this is reversible per student.
insert into app_settings (scope_type, scope_id, key, value)
values ('global', null, 'auto_absent', 'true'::jsonb)
on conflict do nothing;

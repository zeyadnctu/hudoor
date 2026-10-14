-- HUDOOR migration 006: program coordinator role + base grants.
-- Additive only. Coordinators get an empty base (no wildcard) and are scoped
-- to their program_admins programs in the API layer (lib/guard.ts).

DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'profiles'::regclass AND pg_get_constraintdef(oid) LIKE '%admin%professor%student%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE profiles DROP CONSTRAINT %I', c); END IF;
END $$;
alter table profiles
  add constraint profiles_role_check
  check (role in ('admin','professor','student','coordinator'));

insert into roles (name, label_ar, label_en, is_system) values
  ('program_coordinator','منسق برنامج','Program coordinator', false)
on conflict (name) do nothing;

insert into role_permissions (role, resource, action) values
  ('program_coordinator','programs','view'),
  ('program_coordinator','courses','view'),
  ('program_coordinator','courses','create'),
  ('program_coordinator','courses','edit'),
  ('program_coordinator','timetable','manage'),
  ('program_coordinator','enrollments','view'),
  ('program_coordinator','enrollments','create'),
  ('program_coordinator','enrollments','delete'),
  ('program_coordinator','users','view'),
  ('program_coordinator','attendance','view'),
  ('program_coordinator','attendance','export'),
  ('program_coordinator','sessions','view'),
  ('program_coordinator','rooms','view'),
  ('program_coordinator','semesters','view'),
  ('program_coordinator','announcements','view'),
  ('program_coordinator','announcements','create'),
  ('program_coordinator','settings','view'),
  ('program_coordinator','requests','view')
on conflict do nothing;

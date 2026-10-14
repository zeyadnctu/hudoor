-- HUDOOR migration 004: NCTU programs replace faculties/departments in the model.
-- Additive only: old tables/columns stay (hidden from UI, never dropped).

-- ===== programs: NCTU fields, faculty link optional =====
alter table programs alter column faculty_id drop not null;
alter table programs add column if not exists partner text;
alter table programs add column if not exists type text not null default 'regular'
  check (type in ('partner','regular'));
alter table programs add column if not exists color text not null default '#2F5D8A';
alter table programs add column if not exists archived boolean not null default false;

-- ===== program scoping columns =====
alter table courses add column if not exists program_id uuid references programs(id) on delete set null;
create index if not exists idx_courses_program on courses(program_id);
alter table timetable_slots add column if not exists program_id uuid references programs(id) on delete set null;
create index if not exists idx_slots_program on timetable_slots(program_id);
-- raw import tokens kept until matched to real rows
alter table timetable_slots add column if not exists instructor_name text;
alter table timetable_slots add column if not exists session_type text
  check (session_type in ('lecture','section'));
alter table timetable_imports add column if not exists program_id uuid references programs(id) on delete set null;
create index if not exists idx_imports_program on timetable_imports(program_id);

-- ===== program-scoped sub-admins (e.g. NTG coordinator) =====
create table if not exists program_admins (
  program_id uuid references programs(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  primary key (program_id, profile_id)
);
alter table program_admins enable row level security;
create policy "admin program_admins" on program_admins for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- ===== program scope for scoped settings =====
alter table app_settings drop constraint if exists app_settings_scope_type_check;
alter table app_settings add constraint app_settings_scope_type_check
  check (scope_type in ('global','faculty','department','course','session','program'));

-- ===== NCTU timetable defaults (global; per-program overrides allowed) =====
-- 40-minute period grid + working days + display-only college label + title prefixes
insert into app_settings (scope_type, scope_id, key, value)
select 'global', null, k, v from (values
  ('period_grid', '[{"start":"09:00","end":"09:40"},{"start":"09:40","end":"10:20"},{"start":"10:30","end":"11:10"},{"start":"11:10","end":"11:50"},{"start":"12:00","end":"12:40"},{"start":"12:40","end":"13:20"},{"start":"13:30","end":"14:10"},{"start":"15:00","end":"15:40"},{"start":"15:40","end":"16:20"}]'::jsonb),
  ('working_days', '[6,0,1]'),
  ('college_label', '"Faculty of Industry"'),
  ('title_prefixes', '{"lecturer":["dr","dr.","dr:","د/","أ.د/","أ.د.","د."],"section":["eng","eng.","م/","م."]}')
) s(k, v)
where not exists (
  select 1 from app_settings a
  where a.scope_type = 'global' and a.scope_id is null and a.key = s.k
);

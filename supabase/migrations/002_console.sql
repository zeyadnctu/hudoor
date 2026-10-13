-- HUDOOR migration 002: admin console + instructor workspace
-- Run AFTER 001. Never modifies 001 objects except additive alters.
-- New tables: roles, role_permissions, buildings, rooms, programs, levels,
-- section_groups, course_tas, timetable_slots, timetable_imports, academic_blocks,
-- excuse_requests, disputes, announcements, notification_templates, feature_flags,
-- app_settings, settings_history, instructor_notes, report_presets, service_requests.

-- ===== profiles: extensibility (additive only) =====
alter table profiles add column if not exists custom_role text;
alter table profiles add column if not exists is_active boolean not null default true;
alter table profiles add column if not exists last_login_at timestamptz;

-- ===== sessions: instructor controls (additive only) =====
-- widen status to include paused (drop old check by definition match)
DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'attendance_sessions'::regclass
     AND pg_get_constraintdef(oid) LIKE '%scheduled%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE attendance_sessions DROP CONSTRAINT %I', c); END IF;
END $$;
alter table attendance_sessions
  add constraint attendance_sessions_status_check
  check (status in ('scheduled','active','paused','ended'));
alter table attendance_sessions add column if not exists paused_at timestamptz;
alter table attendance_sessions add column if not exists extended_min int not null default 0;
alter table attendance_sessions add column if not exists late_after_min int;
alter table attendance_sessions add column if not exists qr_interval_sec int;
alter table attendance_sessions add column if not exists room_id uuid;
alter table attendance_sessions add column if not exists source text not null default 'manual'
  check (source in ('manual','timetable','recurring','import'));

-- ===== courses: rules + credits (additive) =====
alter table courses add column if not exists credit_hours int not null default 3;
alter table courses add column if not exists attendance_rule jsonb not null default '{}';

-- ===== student_details: program placement (additive) =====
alter table student_details add column if not exists program_id uuid;
alter table student_details add column if not exists level_id uuid;
alter table student_details add column if not exists section_id uuid;

-- ===== audit: diffs + network (additive) =====
alter table audit_logs add column if not exists before_data jsonb;
alter table audit_logs add column if not exists after_data jsonb;
alter table audit_logs add column if not exists ip text;
alter table audit_logs add column if not exists device_id text;

-- ===== trash: soft delete (additive) =====
alter table faculties add column if not exists deleted_at timestamptz;
alter table departments add column if not exists deleted_at timestamptz;
alter table courses add column if not exists deleted_at timestamptz;
alter table semesters add column if not exists deleted_at timestamptz;

-- ===== roles + permission grants =====
create table if not exists roles (
  name text primary key,
  label_ar text not null, label_en text not null,
  is_system boolean not null default false,
  created_at timestamptz default now()
);
create table if not exists role_permissions (
  role text references roles(name) on delete cascade not null,
  resource text not null,
  action text not null,
  primary key (role, resource, action)
);
insert into roles (name, label_ar, label_en, is_system) values
  ('admin','إدارة','Admin', true),
  ('professor','أستاذ','Instructor', true),
  ('ta','معيد','Teaching assistant', true),
  ('department_admin','مشرف قسم','Department admin', false),
  ('student','طالب','Student', true)
on conflict (name) do nothing;
-- admin wildcard: resource='*', action='*'
insert into role_permissions (role, resource, action) values ('admin','*','*')
on conflict do nothing;

-- ===== academic structure =====
create table if not exists programs (
  id uuid primary key default uuid_generate_v4(),
  faculty_id uuid references faculties(id) on delete cascade not null,
  code text unique not null, name_ar text not null, name_en text not null,
  deleted_at timestamptz, created_at timestamptz default now()
);
create table if not exists levels (
  id uuid primary key default uuid_generate_v4(),
  program_id uuid references programs(id) on delete cascade not null,
  name_ar text not null, name_en text not null,
  position int not null default 0,
  created_at timestamptz default now()
);
create table if not exists section_groups (
  id uuid primary key default uuid_generate_v4(),
  level_id uuid references levels(id) on delete cascade not null,
  name text not null,
  created_at timestamptz default now()
);
DO $$ BEGIN
  alter table student_details
    add constraint fk_sd_program foreign key (program_id) references programs(id) on delete set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  alter table student_details
    add constraint fk_sd_level foreign key (level_id) references levels(id) on delete set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  alter table student_details
    add constraint fk_sd_section foreign key (section_id) references section_groups(id) on delete set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== TAs =====
create table if not exists course_tas (
  course_id uuid references courses(id) on delete cascade,
  ta_id uuid references profiles(id) on delete cascade,
  primary key (course_id, ta_id)
);

-- ===== rooms & buildings =====
create table if not exists buildings (
  id uuid primary key default uuid_generate_v4(),
  name_ar text not null, name_en text not null,
  deleted_at timestamptz, created_at timestamptz default now()
);
create table if not exists rooms (
  id uuid primary key default uuid_generate_v4(),
  building_id uuid references buildings(id) on delete set null,
  name_ar text not null, name_en text not null,
  capacity int not null default 0,
  geofence_lat double precision, geofence_lng double precision,
  geofence_radius_m int not null default 100,
  deleted_at timestamptz, created_at timestamptz default now()
);
DO $$ BEGIN
  alter table attendance_sessions
    add constraint fk_session_room foreign key (room_id) references rooms(id) on delete set null;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ===== timetable =====
create table if not exists timetable_slots (
  id uuid primary key default uuid_generate_v4(),
  semester_id uuid references semesters(id) on delete cascade not null,
  course_id uuid references courses(id) on delete cascade not null,
  professor_id uuid references profiles(id) on delete set null,
  room_id uuid references rooms(id) on delete set null,
  section text not null default 'A',
  group_name text not null default '',
  day int not null check (day between 0 and 6),
  starts_at time not null, ends_at time not null,
  import_id uuid,
  deleted_at timestamptz, created_at timestamptz default now(),
  check (starts_at < ends_at)
);
create table if not exists timetable_imports (
  id uuid primary key default uuid_generate_v4(),
  filename text not null,
  storage_path text not null,
  status text not null default 'draft' check (status in ('draft','reviewed','committed','rolled_back')),
  parsed jsonb not null default '[]',
  report jsonb not null default '{}',
  slot_ids uuid[] not null default '{}',
  replaces_id uuid references timetable_imports(id) on delete set null,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists academic_blocks (
  id uuid primary key default uuid_generate_v4(),
  semester_id uuid references semesters(id) on delete cascade not null,
  name_ar text not null, name_en text not null,
  kind text not null check (kind in ('holiday','exam')),
  starts_at date not null, ends_at date not null,
  created_at timestamptz default now()
);

-- ===== excuses / disputes / service requests =====
create table if not exists excuse_requests (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references profiles(id) on delete cascade not null,
  course_id uuid references courses(id) on delete set null,
  session_id uuid references attendance_sessions(id) on delete set null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by uuid references profiles(id) on delete set null,
  comment text, decided_at timestamptz,
  created_at timestamptz default now()
);
create table if not exists disputes (
  id uuid primary key default uuid_generate_v4(),
  record_id uuid references attendance_records(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by uuid references profiles(id) on delete set null,
  comment text, decided_at timestamptz,
  created_at timestamptz default now()
);
create table if not exists service_requests (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('device_reset','data_change','professor_signup')),
  student_id uuid references profiles(id) on delete cascade,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','approved','denied')),
  decided_by uuid references profiles(id) on delete set null,
  comment text, decided_at timestamptz,
  created_at timestamptz default now()
);

-- ===== announcements / templates / flags =====
create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid references profiles(id) on delete set null not null,
  audience jsonb not null default '{"roles":[],"course_ids":[],"department_ids":[],"sections":[]}',
  title_ar text not null, title_en text not null,
  body_ar text not null, body_en text not null,
  deleted_at timestamptz, created_at timestamptz default now()
);
create table if not exists notification_templates (
  key text primary key,
  trigger text not null,
  title_ar text not null, title_en text not null,
  body_ar text not null, body_en text not null
);
insert into notification_templates (key, trigger, title_ar, title_en, body_ar, body_en) values
  ('low_attendance','low_attendance','تنبيه حضور منخفض','Low attendance warning',
   'نسبة حضورك في {{course}} وصلت {{pct}}% وهي تحت الحد {{min_pct}}%.','Your attendance in {{course}} is {{pct}}%, below the {{min_pct}}% minimum.'),
  ('absence_streak','absence_streak','غياب متتالي','Absence streak',
   'سجلت {{n}} غياب متتالي في {{course}}.','You have {{n}} consecutive absences in {{course}}.'),
  ('session_started','session_started','بدأت جلسة','Session started',
   'بدأت جلسة {{course}}. امسح الرمز في القاعة.','{{course}} session started. Scan the hall code.')
on conflict (key) do nothing;
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,
  description text not null default ''
);
insert into feature_flags (key, enabled, description) values
  ('timetable', true, 'Weekly timetable + PDF import'),
  ('excuses', true, 'Excuse requests + dispute queue'),
  ('announcements', true, 'In-app announcements'),
  ('view_as', true, 'Admin view-as impersonation (audit-logged)'),
  ('rooms_map', true, 'Room geofence map picker')
on conflict (key) do nothing;

-- ===== scoped settings + history =====
create table if not exists app_settings (
  id uuid primary key default uuid_generate_v4(),
  scope_type text not null check (scope_type in ('global','faculty','department','course','session')),
  scope_id uuid,
  key text not null,
  value jsonb not null,
  updated_by uuid references profiles(id) on delete set null,
  updated_at timestamptz default now()
);
-- null-safe uniqueness: NULL scope_id (global rows) maps to the nil uuid
create unique index if not exists uq_app_settings_scope_key
  on app_settings (scope_type, (coalesce(scope_id, '00000000-0000-0000-0000-000000000000')), key);
insert into app_settings (scope_type, scope_id, key, value) values
  ('global', null, 'qr_rotation_seconds', '10'),
  ('global', null, 'qr_token_ttl_seconds', '15'),
  ('global', null, 'present_within_min', '10'),
  ('global', null, 'late_after_min', '20'),
  ('global', null, 'grace_period_min', '5'),
  ('global', null, 'min_pct_per_course', '75'),
  ('global', null, 'auto_end_sessions', 'true'),
  ('global', null, 'allow_late_scanning', 'true'),
  ('global', null, 'geofence_default_radius_m', '100'),
  ('global', null, 'gps_accuracy_margin_m', '50'),
  ('global', null, 'device_binding_on', 'true'),
  ('global', null, 'devices_per_student', '1'),
  ('global', null, 'rate_limit_per_min', '20'),
  ('global', null, 'trash_retention_days', '30')
on conflict do nothing;
create table if not exists settings_history (
  id uuid primary key default uuid_generate_v4(),
  scope_type text not null, scope_id uuid, key text not null,
  old_value jsonb, new_value jsonb,
  changed_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- ===== instructor workspace =====
create table if not exists instructor_notes (
  id uuid primary key default uuid_generate_v4(),
  professor_id uuid references profiles(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  course_id uuid references courses(id) on delete set null,
  kind text not null default 'note' check (kind in ('note','warning')),
  note text not null,
  created_at timestamptz default now()
);
create table if not exists report_presets (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid references profiles(id) on delete cascade not null,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamptz default now()
);

-- ===== indexes =====
create index if not exists idx_slots_course on timetable_slots(course_id);
create index if not exists idx_slots_prof on timetable_slots(professor_id);
create index if not exists idx_slots_room on timetable_slots(room_id);
create index if not exists idx_slots_sem on timetable_slots(semester_id);
create index if not exists idx_excuse_student on excuse_requests(student_id);
create index if not exists idx_excuse_course on excuse_requests(course_id);
create index if not exists idx_dispute_student on disputes(student_id);
create index if not exists idx_notes_student on instructor_notes(student_id);
create index if not exists idx_ann_author on announcements(author_id);
create index if not exists idx_settings_key on app_settings(key);
create index if not exists idx_audit_actor on audit_logs(actor_id);
create index if not exists idx_audit_entity on audit_logs(entity_type, entity_id);

-- ===== RLS =====
alter table roles enable row level security;
alter table role_permissions enable row level security;
alter table programs enable row level security;
alter table levels enable row level security;
alter table section_groups enable row level security;
alter table course_tas enable row level security;
alter table buildings enable row level security;
alter table rooms enable row level security;
alter table timetable_slots enable row level security;
alter table timetable_imports enable row level security;
alter table academic_blocks enable row level security;
alter table excuse_requests enable row level security;
alter table disputes enable row level security;
alter table service_requests enable row level security;
alter table announcements enable row level security;
alter table notification_templates enable row level security;
alter table feature_flags enable row level security;
alter table app_settings enable row level security;
alter table settings_history enable row level security;
alter table instructor_notes enable row level security;
alter table report_presets enable row level security;

-- roles matrix: admin only (APIs use service role)
create policy "admin roles" on roles for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin role_perms" on role_permissions for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- academic structure: readable by all auth, writable by admin
create policy "auth read programs" on programs for select to authenticated using (true);
create policy "admin write programs" on programs for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read levels" on levels for select to authenticated using (true);
create policy "admin write levels" on levels for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read section_groups" on section_groups for select to authenticated using (true);
create policy "admin write section_groups" on section_groups for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "read tas" on course_tas for select to authenticated using (true);
create policy "admin write tas" on course_tas for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- rooms/buildings: readable by all auth, writable by admin
create policy "auth read buildings" on buildings for select to authenticated using (true);
create policy "admin write buildings" on buildings for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read rooms" on rooms for select to authenticated using (true);
create policy "admin write rooms" on rooms for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- timetable: readable by all auth, writable by admin
create policy "auth read slots" on timetable_slots for select to authenticated using (true);
create policy "admin write slots" on timetable_slots for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin imports" on timetable_imports for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read blocks" on academic_blocks for select to authenticated using (true);
create policy "admin write blocks" on academic_blocks for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- excuses: student owns; professor of the course decides; admin all
create policy "student excuses" on excuse_requests for all to authenticated
  using (student_id = auth.uid() or public.my_role()='admin' or exists (
    select 1 from course_professors cp where cp.course_id = excuse_requests.course_id and cp.professor_id = auth.uid()))
  with check (student_id = auth.uid() or public.my_role()='admin');
-- disputes: student owns; professor of the session decides; admin all
create policy "student disputes" on disputes for all to authenticated
  using (student_id = auth.uid() or public.my_role()='admin' or exists (
    select 1 from attendance_records r join attendance_sessions s on s.id = r.session_id
     join course_professors cp on cp.course_id = s.course_id
     where r.id = disputes.record_id and cp.professor_id = auth.uid()))
  with check (student_id = auth.uid() or public.my_role()='admin');
-- service requests: student owns; admin manages
create policy "student svc requests" on service_requests for all to authenticated
  using (student_id = auth.uid() or public.my_role()='admin')
  with check (student_id = auth.uid() or public.my_role()='admin');

-- announcements: author + admin + targeted audience can read; author/admin write
create policy "read announcements" on announcements for select to authenticated using (
  author_id = auth.uid() or public.my_role()='admin'
  or (audience->'roles' ? coalesce(public.my_role(),''))
  or exists (select 1 from enrollments e
      where e.student_id = auth.uid()
        and (audience->'course_ids' ? e.course_id::text))
  or exists (select 1 from student_details d
      where d.user_id = auth.uid()
        and (audience->'department_ids' ? d.department_id::text))
);
create policy "write announcements" on announcements for all to authenticated
  using (author_id = auth.uid() or public.my_role()='admin')
  with check (author_id = auth.uid() or public.my_role()='admin');

-- templates/flags/settings: readable by auth, writable by admin; history admin-read
create policy "auth read templates" on notification_templates for select to authenticated using (true);
create policy "admin write templates" on notification_templates for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read flags" on feature_flags for select to authenticated using (true);
create policy "admin write flags" on feature_flags for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "auth read app_settings" on app_settings for select to authenticated using (true);
create policy "admin write app_settings" on app_settings for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin read settings_history" on settings_history for select to authenticated
  using (public.my_role()='admin');

-- notes: professor owns; admin reads
create policy "prof notes" on instructor_notes for all to authenticated
  using (professor_id = auth.uid() or public.my_role()='admin')
  with check (professor_id = auth.uid() or public.my_role()='admin');
-- presets: owner + admin
create policy "own presets" on report_presets for all to authenticated
  using (owner_id = auth.uid() or public.my_role()='admin')
  with check (owner_id = auth.uid() or public.my_role()='admin');

-- TA read access on course-scoped data (additive policies; existing ones untouched)
create policy "ta read enrollments" on enrollments for select to authenticated using (
  exists (select 1 from course_tas t where t.course_id = enrollments.course_id and t.ta_id = auth.uid())
);
create policy "ta read sessions" on attendance_sessions for select to authenticated using (
  exists (select 1 from course_tas t where t.course_id = attendance_sessions.course_id and t.ta_id = auth.uid())
);
create policy "ta read records" on attendance_records for select to authenticated using (
  exists (select 1 from attendance_sessions s join course_tas t on t.course_id = s.course_id
    where s.id = attendance_records.session_id and t.ta_id = auth.uid())
);

-- realtime: announcements feed
alter publication supabase_realtime add table announcements;

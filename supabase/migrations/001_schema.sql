-- HUDOOR migration 001: schema + RLS
-- Run in Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- ===== Tables =====
create table if not exists faculties (
  id uuid primary key default uuid_generate_v4(),
  name_en text not null, name_ar text not null, created_at timestamptz default now()
);
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  faculty_id uuid references faculties(id) on delete cascade not null,
  name_en text not null, name_ar text not null, created_at timestamptz default now()
);
create table if not exists semesters (
  id uuid primary key default uuid_generate_v4(),
  name text not null, starts_at date not null, ends_at date not null, is_current boolean default false
);
create table if not exists courses (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null, name_en text not null, name_ar text not null,
  faculty_id uuid references faculties(id), department_id uuid references departments(id),
  semester_id uuid references semesters(id), section text default 'A', created_at timestamptz default now()
);
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null, role text not null check (role in ('admin','professor','student')),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  created_at timestamptz default now()
);
create table if not exists student_details (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid unique references profiles(id) on delete cascade not null,
  full_name_ar text not null, full_name_en text not null,
  university_id text unique not null,
  faculty_id uuid references faculties(id), department_id uuid references departments(id),
  level_year int not null, section_group text not null, phone text not null,
  photo_url text, created_at timestamptz default now()
);
create table if not exists course_professors (
  course_id uuid references courses(id) on delete cascade,
  professor_id uuid references profiles(id) on delete cascade,
  primary key (course_id, professor_id)
);
create table if not exists enrollments (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  section text default 'A',
  unique (course_id, student_id)
);
create table if not exists attendance_sessions (
  id uuid primary key default uuid_generate_v4(),
  course_id uuid references courses(id) on delete cascade not null,
  professor_id uuid references profiles(id) not null,
  starts_at timestamptz default now() not null,
  ends_at timestamptz not null,
  secret text not null,
  geofence_lat double precision, geofence_lng double precision,
  geofence_radius_m int default 100,
  geofence_enabled boolean default true,
  status text default 'active' check (status in ('scheduled','active','ended')),
  created_at timestamptz default now()
);
create table if not exists attendance_records (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references attendance_sessions(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  scanned_at timestamptz default now() not null,
  method text default 'scan' check (method in ('scan','manual')),
  status text default 'present' check (status in ('present','late','absent','excused')),
  unique (session_id, student_id)
);
create table if not exists devices (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid unique references profiles(id) on delete cascade not null,
  device_id text unique not null,
  ua_hint text, bound_at timestamptz default now()
);
create table if not exists flagged_attempts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete set null,
  session_id uuid references attendance_sessions(id) on delete set null,
  reason text not null, device_id text, ip text,
  metadata jsonb default '{}', created_at timestamptz default now()
);
create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  actor_id uuid references profiles(id) on delete set null,
  action text not null, entity_type text not null, entity_id text,
  metadata jsonb default '{}', created_at timestamptz default now()
);
create table if not exists settings (
  key text primary key, value text not null
);
insert into settings (key, value) values
  ('qr_rotation_seconds','10'), ('qr_token_ttl_seconds','15'),
  ('geofence_default_radius_m','100'), ('attendance_window_min','60')
on conflict (key) do nothing;

-- ===== Indexes =====
create index if not exists idx_records_session on attendance_records(session_id);
create index if not exists idx_records_student on attendance_records(student_id);
create index if not exists idx_sessions_course on attendance_sessions(course_id);
create index if not exists idx_enroll_course on enrollments(course_id);
create index if not exists idx_enroll_student on enrollments(student_id);
create index if not exists idx_flagged_user on flagged_attempts(user_id);

-- ===== RLS =====
alter table faculties enable row level security;
alter table departments enable row level security;
alter table semesters enable row level security;
alter table courses enable row level security;
alter table profiles enable row level security;
alter table student_details enable row level security;
alter table course_professors enable row level security;
alter table enrollments enable row level security;
alter table attendance_sessions enable row level security;
alter table attendance_records enable row level security;
alter table devices enable row level security;
alter table flagged_attempts enable row level security;
alter table audit_logs enable row level security;
alter table settings enable row level security;

-- helper: current role (hardened: fixed search_path, no anon RPC execute;
-- see 004_my_role_hardening on live DB)
create or replace function public.my_role() returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Public catalog readable by authenticated users
create policy "auth read faculties" on faculties for select to authenticated using (true);
create policy "auth read departments" on departments for select to authenticated using (true);
create policy "auth read semesters" on semesters for select to authenticated using (true);
create policy "auth read courses" on courses for select to authenticated using (true);
create policy "admin write faculties" on faculties for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin write departments" on departments for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin write semesters" on semesters for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
create policy "admin write courses" on courses for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- profiles: user reads own; admin reads all; admin updates
create policy "own profile" on profiles for select to authenticated using (id = auth.uid() or public.my_role()='admin');
create policy "admin manage profiles" on profiles for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');
-- allow insert of own profile on signup (id = auth.uid)
create policy "self insert profile" on profiles for insert to authenticated with check (id = auth.uid());

-- student_details: student manages own; professor/admin read enrolled
create policy "student own details" on student_details for all to authenticated using (user_id = auth.uid() or public.my_role() in ('admin','professor')) with check (user_id = auth.uid() or public.my_role()='admin');

-- enrollments: student sees own; professor sees own courses; admin all
create policy "read enrollments" on enrollments for select to authenticated using (
  student_id = auth.uid() or public.my_role()='admin' or
  exists (select 1 from course_professors cp where cp.course_id = enrollments.course_id and cp.professor_id = auth.uid())
);
create policy "admin write enrollments" on enrollments for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

create policy "read cp" on course_professors for select to authenticated using (true);
create policy "admin write cp" on course_professors for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- sessions: professor sees own; student sees active sessions of enrolled courses; admin all
-- NOTE: secret column must never be selected client-side; API uses service role.
create policy "read sessions" on attendance_sessions for select to authenticated using (
  public.my_role()='admin' or professor_id = auth.uid() or
  exists (select 1 from enrollments e where e.course_id = attendance_sessions.course_id and e.student_id = auth.uid())
);
create policy "prof write own sessions" on attendance_sessions for all to authenticated using (
  public.my_role()='admin' or professor_id = auth.uid()
) with check (public.my_role()='admin' or professor_id = auth.uid());

-- records: student own; professor own courses; admin all. Inserts go through service role API.
create policy "read records" on attendance_records for select to authenticated using (
  student_id = auth.uid() or public.my_role()='admin' or
  exists (select 1 from attendance_sessions s join course_professors cp on cp.course_id = s.course_id
    where s.id = attendance_records.session_id and (s.professor_id = auth.uid() or cp.professor_id = auth.uid()))
);
create policy "prof manual records" on attendance_records for all to authenticated using (
  public.my_role()='admin' or exists (
    select 1 from attendance_sessions s where s.id = attendance_records.session_id and s.professor_id = auth.uid())
) with check (
  public.my_role()='admin' or exists (
    select 1 from attendance_sessions s where s.id = attendance_records.session_id and s.professor_id = auth.uid())
);

-- devices: student own row; admin all
create policy "own device" on devices for select to authenticated using (student_id = auth.uid() or public.my_role()='admin');
create policy "admin devices" on devices for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- flagged/audit: professor+admin read; admin write; service role bypasses RLS
create policy "staff read flagged" on flagged_attempts for select to authenticated using (public.my_role() in ('admin','professor'));
create policy "staff read audit" on audit_logs for select to authenticated using (public.my_role() in ('admin','professor'));

create policy "read settings" on settings for select to authenticated using (true);
create policy "admin write settings" on settings for all to authenticated using (public.my_role()='admin') with check (public.my_role()='admin');

-- Realtime: allow records + sessions
alter publication supabase_realtime add table attendance_records;
alter publication supabase_realtime add table attendance_sessions;

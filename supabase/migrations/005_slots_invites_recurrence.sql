-- HUDOOR migration 005: importer-ready timetable slots, instructor invites, recurrence.
-- Additive only. Old slot columns (starts_at/ends_at/section/group_name/professor_id)
-- stay and are dual-written; new code reads the period model with time fallback.

-- ===== timetable_slots: period model + raw tokens + instructor link =====
alter table timetable_slots add column if not exists program_id uuid references programs(id) on delete set null;
alter table timetable_slots add column if not exists level_id uuid references levels(id) on delete set null;
alter table timetable_slots add column if not exists group_id uuid references section_groups(id) on delete set null;
alter table timetable_slots add column if not exists instructor_id uuid references profiles(id) on delete set null;
alter table timetable_slots add column if not exists start_period int;
alter table timetable_slots add column if not exists period_count int not null default 1
  check (period_count between 1 and 12);
alter table timetable_slots add column if not exists source text not null default 'manual'
  check (source in ('manual','seed','import'));
alter table timetable_slots add column if not exists source_ref uuid;
create index if not exists idx_slots_program2 on timetable_slots(program_id);
create index if not exists idx_slots_level on timetable_slots(level_id);
create index if not exists idx_slots_group on timetable_slots(group_id);
create index if not exists idx_slots_instructor on timetable_slots(instructor_id);

-- ===== attendance_sessions: occurrence overrides =====
alter table attendance_sessions add column if not exists slot_id uuid references timetable_slots(id) on delete set null;
alter table attendance_sessions add column if not exists substitute_professor_id uuid references profiles(id) on delete set null;
create index if not exists idx_sessions_slot on attendance_sessions(slot_id);
DO $$ DECLARE c text; BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'attendance_sessions'::regclass AND conname = 'attendance_sessions_status_check';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE attendance_sessions DROP CONSTRAINT %I', c); END IF;
END $$;
alter table attendance_sessions
  add constraint attendance_sessions_status_check
  check (status in ('scheduled','active','paused','ended','cancelled'));

-- ===== instructor invites (passwordless claim via link) =====
create table if not exists instructor_invites (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  title text not null default 'Dr' check (title in ('Dr','Eng')),
  role text not null default 'professor' check (role in ('admin','professor','student')),
  program_id uuid references programs(id) on delete set null,
  token_hash text unique,
  expires_at timestamptz not null default (now() + interval '30 days'),
  claimed_by uuid references profiles(id) on delete set null,
  claimed_at timestamptz,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);
alter table instructor_invites enable row level security;
create policy "admin invites" on instructor_invites for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

-- ===== announcements: match program audience too =====
drop policy if exists "read announcements" on announcements;
create policy "read announcements" on announcements for select to authenticated using (
  author_id = auth.uid() or public.my_role()='admin'
  or (audience->'roles' ? coalesce(public.my_role(),''))
  or exists (select 1 from enrollments e
      where e.student_id = auth.uid()
        and (audience->'course_ids' ? e.course_id::text))
  or exists (select 1 from student_details d
      where d.user_id = auth.uid()
        and ((audience->'department_ids' ? d.department_id::text)
          or (audience->'program_ids' ? d.program_id::text)))
  or exists (select 1 from enrollments e join courses c on c.id = e.course_id
      where e.student_id = auth.uid()
        and (audience->'program_ids' ? c.program_id::text))
);

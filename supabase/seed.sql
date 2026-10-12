-- Seed: run after creating users in Supabase Auth.
-- Replace UUIDs with real auth.users ids.
-- Admin: admin@hudoor.edu | Professors: prof1@hudoor.edu, prof2@hudoor.edu | Students: s1..s3@hudoor.edu

-- 1) Create these users via Dashboard > Auth > Users first, then copy ids below.
-- Example placeholders:
-- insert into profiles (id, email, role, status) values
--   ('ADMIN_UUID','admin@hudoor.edu','admin','approved'),
--   ('PROF1_UUID','prof1@hudoor.edu','professor','approved'),
--   ('STU1_UUID','s1@hudoor.edu','student','approved');

insert into faculties (id, name_en, name_ar) values
  ('11111111-1111-1111-1111-111111111111','Engineering','الهندسة'),
  ('22222222-2222-2222-2222-222222222222','Medicine','الطب')
on conflict (id) do nothing;

insert into departments (id, faculty_id, name_en, name_ar) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','11111111-1111-1111-1111-111111111111','Computer Engineering','هندسة الحاسب'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','11111111-1111-1111-1111-111111111111','Electrical Engineering','الهندسة الكهربائية')
on conflict (id) do nothing;

insert into semesters (id, name, starts_at, ends_at, is_current) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc','2026 Fall','2026-09-01','2027-01-15', true)
on conflict (id) do nothing;

insert into courses (id, code, name_en, name_ar, faculty_id, department_id, semester_id, section) values
  ('d0000000-0000-0000-0000-000000000001','CE201','Databases','قواعد البيانات','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc','A'),
  ('d0000000-0000-0000-0000-000000000002','CE302','Computer Networks','شبكات الحاسب','11111111-1111-1111-1111-111111111111','aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa','cccccccc-cccc-cccc-cccc-cccccccccccc','B')
on conflict (id) do nothing;

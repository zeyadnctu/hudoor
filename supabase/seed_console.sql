-- HUDOOR seed 002: console demo data (run after 002 + 003)
-- Department-admin base grants (custom role; system roles are coded in lib/permissions.ts)
insert into role_permissions (role, resource, action) values
  ('department_admin','faculties','view'), ('department_admin','departments','view'),
  ('department_admin','departments','edit'), ('department_admin','programs','manage'),
  ('department_admin','courses','view'), ('department_admin','courses','edit'),
  ('department_admin','enrollments','view'), ('department_admin','users','view'),
  ('department_admin','attendance','view'), ('department_admin','timetable','view')
on conflict do nothing;

-- Sample building + rooms (Cairo University approx.)
insert into buildings (id, name_ar, name_en) values
  ('e0000000-0000-0000-0000-000000000001','المبنى الرئيسي','Main Building')
on conflict (id) do nothing;
insert into rooms (id, building_id, name_ar, name_en, capacity, geofence_lat, geofence_lng, geofence_radius_m) values
  ('e0000000-0000-0000-0000-000000000011','e0000000-0000-0000-0000-000000000001','قاعة 101','Hall 101',120,30.0270,31.2100,100),
  ('e0000000-0000-0000-0000-000000000012','e0000000-0000-0000-0000-000000000001','معمل 202','Lab 202',40,30.0272,31.2102,60)
on conflict (id) do nothing;

-- Sample program / levels / groups (Engineering faculty from seed 001)
insert into programs (id, faculty_id, code, name_ar, name_en) values
  ('e0000000-0000-0000-0000-000000000021','11111111-1111-1111-1111-111111111111','CMP','هندسة الحاسب','Computer Engineering')
on conflict (id) do nothing;
insert into levels (id, program_id, name_ar, name_en, position) values
  ('e0000000-0000-0000-0000-000000000031','e0000000-0000-0000-0000-000000000021','الأول','First',1),
  ('e0000000-0000-0000-0000-000000000032','e0000000-0000-0000-0000-000000000021','الثاني','Second',2)
on conflict (id) do nothing;
insert into section_groups (level_id, name)
  select 'e0000000-0000-0000-0000-000000000031', g
  from (values ('A'),('B')) v(g)
  where not exists (
    select 1 from section_groups s
    where s.level_id = 'e0000000-0000-0000-0000-000000000031' and s.name = v.g
  );

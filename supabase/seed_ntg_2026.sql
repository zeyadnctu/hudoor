-- HUDOOR seed: NCTU programs + NTG 1st-year sec1 timetable 2026-2027.
-- Idempotent (safe to re-run). People become claimable invites (no passwords);
-- slots carry instructor_name + session_type until invites are claimed.
-- Times are the best reading of NTG V3; edit them in the timetable editor.

DO $$ DECLARE
  v_ntg uuid; v_china uuid; v_it uuid; v_mech uuid; v_auto uuid;
  v_lvl1 uuid; v_sec1 uuid;
  v_sem uuid;
  v_ppc uuid; v_prog uuid; v_oop uuid; v_math uuid; v_eng uuid; v_web uuid;
  v_a308 uuid; v_a104 uuid;
BEGIN
  -- ===== programs =====
  insert into programs (id, code, name_en, name_ar, partner, type, color, archived) values
    ('10000000-0000-4000-8000-000000000001','NTG','AI and Digital Transformation','الذكاء الاصطناعي والتحول الرقمي','NTG company','partner','#7C3AED',false),
    ('10000000-0000-4000-8000-000000000002','CHINA','AI and Data Engineering','الذكاء الاصطناعي وهندسة البيانات','Chinese partner','partner','#0284C7',false),
    ('10000000-0000-4000-8000-000000000003','IT','Information Technology','تكنولوجيا المعلومات',null,'regular','#059669',false),
    ('10000000-0000-4000-8000-000000000004','MECH','Mechatronics','الميكاترونكس',null,'regular','#D97706',false),
    ('10000000-0000-4000-8000-000000000005','AUTO','Autotronics','الأوتوترونكس',null,'regular','#DB2777',false)
  on conflict (code) do update set
    name_en = excluded.name_en, name_ar = excluded.name_ar,
    partner = excluded.partner, type = excluded.type, color = excluded.color;
  select id into v_ntg from programs where code = 'NTG';
  select id into v_china from programs where code = 'CHINA';
  select id into v_it from programs where code = 'IT';
  select id into v_mech from programs where code = 'MECH';
  select id into v_auto from programs where code = 'AUTO';

  -- ===== NTG levels 1-4 =====
  insert into levels (id, program_id, name_en, name_ar, position) values
    ('20000000-0000-4000-8000-000000000001', v_ntg, '1st year', 'السنة الأولى', 1),
    ('20000000-0000-4000-8000-000000000002', v_ntg, '2nd year', 'السنة الثانية', 2),
    ('20000000-0000-4000-8000-000000000003', v_ntg, '3rd year', 'السنة الثالثة', 3),
    ('20000000-0000-4000-8000-000000000004', v_ntg, '4th year', 'السنة الرابعة', 4)
  on conflict (id) do nothing;
  select id into v_lvl1 from levels where program_id = v_ntg and position = 1;

  -- ===== section groups sec1/sec2 on level 1 =====
  insert into section_groups (id, level_id, name) values
    ('30000000-0000-4000-8000-000000000001', v_lvl1, 'sec1'),
    ('30000000-0000-4000-8000-000000000002', v_lvl1, 'sec2')
  on conflict (id) do nothing;
  select id into v_sec1 from section_groups where level_id = v_lvl1 and name = 'sec1';

  -- ===== semester (existing current one) =====
  select id into v_sem from semesters where is_current order by starts_at desc limit 1;
  if v_sem is null then
    insert into semesters (id, name, starts_at, ends_at, is_current)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc','2026-2027','2026-09-01','2027-01-15', true)
    on conflict (id) do nothing;
    select id into v_sem from semesters where is_current order by starts_at desc limit 1;
  end if;

  -- ===== NTG courses =====
  insert into courses (id, program_id, code, name_en, name_ar, semester_id, section) values
    ('40000000-0000-4000-8000-000000000001', v_ntg, 'PPC',  'Professional Practice & Communication', 'الممارسة المهنية والاتصال', v_sem, 'sec1'),
    ('40000000-0000-4000-8000-000000000002', v_ntg, 'PROG', 'Programming', 'البرمجة', v_sem, 'sec1'),
    ('40000000-0000-4000-8000-000000000003', v_ntg, 'OOP',  'Object Oriented Programming', 'البرمجة كائنية التوجه', v_sem, 'sec1'),
    ('40000000-0000-4000-8000-000000000004', v_ntg, 'MATH1','Technical Mathematics I', 'الرياضيات التقنية 1', v_sem, 'sec1'),
    ('40000000-0000-4000-8000-000000000005', v_ntg, 'ENG1', 'Technical English I', 'الإنجليزية التقنية 1', v_sem, 'sec1'),
    ('40000000-0000-4000-8000-000000000006', v_ntg, 'WEB',  'Web Essentials', 'أساسيات الويب', v_sem, 'sec1')
  on conflict (code) do update set program_id = excluded.program_id, name_en = excluded.name_en,
    name_ar = excluded.name_ar, semester_id = excluded.semester_id, section = excluded.section;
  select id into v_ppc  from courses where code = 'PPC';
  select id into v_prog from courses where code = 'PROG';
  select id into v_oop  from courses where code = 'OOP';
  select id into v_math from courses where code = 'MATH1';
  select id into v_eng  from courses where code = 'ENG1';
  select id into v_web  from courses where code = 'WEB';

  -- ===== rooms A308 / A104 =====
  insert into rooms (id, building_id, name_ar, name_en, capacity, geofence_radius_m) values
    ('50000000-0000-4000-8000-000000000001', null, 'قاعة A308', 'A308', 120, 100),
    ('50000000-0000-4000-8000-000000000002', null, 'قاعة A104', 'A104', 60, 100)
  on conflict (id) do nothing;
  select id into v_a308 from rooms where name_en = 'A308';
  select id into v_a104 from rooms where name_en = 'A104';

  -- ===== NTG 1st-year sec1 slots (day: 6=Sat 0=Sun 1=Mon) =====
  -- (course, day, start, end, start_period, count, type, instructor, room)
  insert into timetable_slots
    (id, program_id, level_id, group_id, semester_id, course_id, session_type, instructor_name,
     room_id, day, start_period, period_count, starts_at, ends_at, section, group_name, source)
  select * from (values
    ('60000000-0000-4000-8000-000000000001'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_ppc,  'lecture'::text, 'Dr. Bothaina'::text,      v_a308, 6, 0, 2, '09:00'::time, '10:20'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000002'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_prog, 'lecture'::text, 'Dr. Sara Medhat'::text,   v_a308, 6, 2, 1, '10:30'::time, '11:10'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000003'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_oop,  'lecture'::text, 'Dr. Sara Medhat'::text,   v_a308, 6, 3, 2, '11:10'::time, '12:40'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000004'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_math, 'section'::text, 'Eng. Mariam'::text,       v_a308, 0, 0, 2, '09:00'::time, '10:20'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000005'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_math, 'lecture'::text, 'Dr. Atef Abdelhay'::text, v_a104, 0, 2, 2, '10:30'::time, '11:50'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000006'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_oop,  'section'::text, 'Eng. M. Hesham'::text,    v_a308, 0, 4, 2, '12:00'::time, '13:20'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000007'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_eng,  'section'::text, 'Eng. Fatma Mohamed'::text,v_a308, 0, 6, 2, '13:30'::time, '15:40'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000008'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_prog, 'section'::text, 'Eng. Norhan'::text,       v_a308, 1, 0, 2, '09:00'::time, '10:20'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000009'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_web,  'section'::text, 'Eng. M. Hesham'::text,    v_a308, 1, 2, 2, '10:30'::time, '11:50'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000010'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_eng,  'lecture'::text, 'Dr. Eman Magdy'::text,    v_a308, 1, 4, 2, '12:00'::time, '13:20'::time, '1st year', 'sec1', 'seed'),
    ('60000000-0000-4000-8000-000000000011'::uuid, v_ntg, v_lvl1, v_sec1, v_sem, v_web,  'lecture'::text, 'Dr. Rasha'::text,         v_a308, 1, 6, 2, '13:30'::time, '15:40'::time, '1st year', 'sec1', 'seed')
  ) s(id, program_id, level_id, group_id, semester_id, course_id, session_type, instructor_name,
        room_id, day, start_period, period_count, starts_at, ends_at, section, group_name, source)
  where not exists (select 1 from timetable_slots t where t.id = s.id);

  -- ===== instructor invites (no passwords; admin generates claim links) =====
  insert into instructor_invites (full_name, title, role, program_id)
  select * from (values
    ('Bothaina', 'Dr', 'professor', v_ntg),
    ('Sara Medhat', 'Dr', 'professor', v_ntg),
    ('Atef Abdelhay', 'Dr', 'professor', v_ntg),
    ('Eman Magdy', 'Dr', 'professor', v_ntg),
    ('Rasha', 'Dr', 'professor', v_ntg),
    ('Mariam', 'Eng', 'professor', v_ntg),
    ('M. Hesham', 'Eng', 'professor', v_ntg),
    ('Fatma Mohamed', 'Eng', 'professor', v_ntg),
    ('Norhan', 'Eng', 'professor', v_ntg)
  ) s(full_name, title, role, program_id)
  where not exists (
    select 1 from instructor_invites i
    where i.full_name = s.full_name and i.program_id is not distinct from s.program_id
  );
END $$;

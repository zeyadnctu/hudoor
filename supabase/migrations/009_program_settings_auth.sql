-- HUDOOR migration 009: program-scoped settings + Google/scan defaults
-- Additive only. Run AFTER 007_auth_google.sql (and 004_nctu_programs.sql).

-- 1) The app is program-centric (see 004), but app_settings only accepted
--    global/faculty/department/course/session — so every program-scoped
--    override saved from the admin console was rejected by the DB.
--    Drop whatever check constraint holds scope_type and re-add a wider one.
do $$
declare c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.app_settings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%scope_type%'
  loop
    execute format('alter table public.app_settings drop constraint %I', c.conname);
  end loop;

  alter table public.app_settings
    add constraint app_settings_scope_type_check
    check (scope_type in ('global','faculty','department','program','course','session'));
end $$;

-- 2) Make sure every key the admin "scan settings" screen offers actually has a
--    global default row (the scan endpoint and QR routes read these).
insert into app_settings (scope_type, scope_id, key, value)
select 'global', null, k.key, k.value
from (values
  ('auto_end_sessions',          'true'::jsonb),
  ('allow_late_scanning',        'true'::jsonb),
  ('device_binding_on',          'true'::jsonb),
  ('devices_per_student',        '1'::jsonb),
  ('geofence_default_radius_m',  '100'::jsonb),
  ('gps_accuracy_margin_m',      '50'::jsonb),
  ('rate_limit_per_min',         '60'::jsonb),
  ('campus_ip_allowlist',        '""'::jsonb),
  ('self_signup_on',             'true'::jsonb),
  ('approval_required',          'true'::jsonb),
  ('session_timeout_min',        '720'::jsonb),
  ('trash_retention_days',       '30'::jsonb),
  ('university_name',            '"جامعة حلوان التكنولوجية"'::jsonb),
  ('default_language',           '"ar"'::jsonb),
  ('auth_restrict_domain',       'false'::jsonb),
  ('auth_email_domains',         '["stu.nctu.edu.eg","nctu.edu.eg"]'::jsonb)
) as k(key, value)
where not exists (
  select 1 from app_settings s
  where s.scope_type = 'global' and s.scope_id is null and s.key = k.key
);

-- 3) Sign in with Google ships enabled (the provider still has to be configured
--    in Supabase Auth — see GOOGLE_AUTH_SETUP.md). Admins can toggle it any time
--    from Admin → Settings → Feature flags.
insert into feature_flags (key, enabled, description)
values ('google_signin', true, 'Enable Sign in with Google (OAuth via Supabase)')
on conflict (key) do update set enabled = true;

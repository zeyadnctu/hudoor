-- HUDOOR migration 007: Google OAuth + email-domain restriction settings
-- Additive only. Run AFTER 002_console.sql (app_settings table must exist).

-- Auth-related scoped settings (global scope)
insert into app_settings (scope_type, scope_id, key, value) values
  ('global', null, 'auth_restrict_domain', 'false'),
  ('global', null, 'auth_email_domains', '["stu.nctu.edu.eg", "nctu.edu.eg"]')
on conflict (scope_type, coalesce(scope_id, '00000000-0000-0000-0000-000000000000'), key) do nothing;

-- Feature flag for Google Sign-in (toggleable from admin console)
insert into feature_flags (key, enabled, description) values
  ('google_signin', false, 'Enable Sign in with Google (OAuth via Supabase)')
on conflict (key) do nothing;

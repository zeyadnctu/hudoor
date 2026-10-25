-- HUDOOR migration 014: student preferences, push subscriptions, consents.
-- Additive only. Apply after 013.

-- ===== notification preferences (one row per user) =====
create table if not exists notification_prefs (
  user_id uuid primary key references profiles(id) on delete cascade,
  class_soon boolean not null default true,
  window_closing boolean not null default true,
  timetable_change boolean not null default true,
  decisions boolean not null default true,
  at_risk boolean not null default true,
  quiet_hours boolean not null default false,
  quiet_from time not null default '22:00',
  quiet_to time not null default '07:00',
  updated_at timestamptz not null default now()
);
alter table notification_prefs enable row level security;
create policy "own notification_prefs" on notification_prefs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin notification_prefs" on notification_prefs for select to authenticated
  using (public.my_role() = 'admin');

-- ===== push subscriptions (per device/browser) =====
create table if not exists push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  ua_hint text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists idx_push_user on push_subscriptions(user_id);
alter table push_subscriptions enable row level security;
create policy "own push_subscriptions" on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin push_subscriptions" on push_subscriptions for select to authenticated
  using (public.my_role() = 'admin');

-- ===== consent ledger (privacy / terms acceptance) =====
create table if not exists consents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  kind text not null check (kind in ('privacy','terms','data_processing')),
  version text not null,
  accepted_at timestamptz not null default now(),
  ip text,
  unique (user_id, kind, version)
);
create index if not exists idx_consents_user on consents(user_id);
alter table consents enable row level security;
create policy "own consents" on consents for select to authenticated
  using (user_id = auth.uid());
create policy "insert own consents" on consents for insert to authenticated
  with check (user_id = auth.uid());
create policy "admin consents" on consents for select to authenticated
  using (public.my_role() = 'admin');

-- ===== global defaults for the notifications engine =====
insert into app_settings (scope_type, scope_id, key, value) values
  ('global', null, 'push_class_soon_min', '15'),
  ('global', null, 'push_window_closing_min', '10')
on conflict (scope_type, scope_id, key) do nothing;

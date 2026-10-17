-- HUDOOR migration 008: Passkeys / WebAuthn credential store
-- Additive only. Run AFTER 007_auth_google.sql.

create table if not exists passkeys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references profiles(id) on delete cascade not null,
  name text not null,                          -- e.g. "iPhone 15", "Windows Hello"
  credential_id text unique not null,          -- base64url raw credential id
  public_key text not null,                    -- base64url COSE public key
  counter bigint not null default 0,
  transports text[] default '{}',              -- usb,nfc,ble,internal,hybrid
  created_at timestamptz default now(),
  last_used_at timestamptz
);

alter table passkeys enable row level security;

-- user manages own passkeys; admin reads all
create policy "own passkeys" on passkeys for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin passkeys" on passkeys for all to authenticated
  using (public.my_role()='admin') with check (public.my_role()='admin');

create index if not exists idx_passkeys_user on passkeys(user_id);

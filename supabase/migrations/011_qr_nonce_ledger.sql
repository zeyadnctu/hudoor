-- HUDOOR migration 011: QR nonce single-use ledger (anti-replay)
-- Additive only. Run AFTER 010.
--
-- Every rotating QR carries a signed JWT with a random `nonce`. The class
-- shares one code, so a nonce is legitimately consumed by MANY students —
-- but never twice by the SAME student. This closes the replay window:
-- after a professor unmarks a student mid-session, the student cannot
-- re-mark themselves by re-scanning their old captured code; they must
-- scan the live rotating QR like everyone else.
--
-- RLS enabled with NO policies: service-role only (the scan route writes
-- it; no client ever reads or writes this ledger).

create table if not exists qr_scans (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references attendance_sessions(id) on delete cascade not null,
  student_id uuid references profiles(id) on delete cascade not null,
  nonce text not null,
  device_id text,
  created_at timestamptz not null default now(),
  unique (session_id, nonce, student_id)
);

create index if not exists idx_qr_scans_session_nonce on qr_scans(session_id, nonce);
create index if not exists idx_qr_scans_created on qr_scans(created_at);

alter table qr_scans enable row level security;

-- Retention: QR codes live for seconds; the ledger is audit trail.
-- Keep 30 days, then prune (the unique key makes it useless after that).
delete from qr_scans where created_at < now() - interval '30 days';

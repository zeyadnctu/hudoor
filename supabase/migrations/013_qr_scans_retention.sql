-- 013: recurring retention pruning for the QR nonce ledger.
-- Migration 011 pruned once at apply time; pg_cron keeps it pruned daily.
create extension if not exists pg_cron;

create or replace function public.prune_qr_scans() returns void
language sql security definer set search_path = public as
$$
  delete from public.qr_scans where created_at < now() - interval '30 days';
$$;

select cron.schedule(
  'prune-qr-scans',
  '0 3 * * *',
  $$ select public.prune_qr_scans(); $$
);

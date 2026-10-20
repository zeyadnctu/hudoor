-- HUDOOR migration 010: lock down internal helper functions
-- Additive/hardening only. Run AFTER 009.
--
-- `my_role()` and `rls_auto_enable()` are SECURITY DEFINER helpers used inside
-- RLS policies. They were executable by anyone (PUBLIC), so an anonymous
-- caller could hit /rest/v1/rpc/my_role and /rest/v1/rpc/rls_auto_enable.
-- RLS policies evaluate as the querying role, so `authenticated` (and
-- `service_role`) must keep EXECUTE — only PUBLIC/anon lose it.

revoke execute on function public.my_role() from public, anon;
revoke execute on function public.rls_auto_enable() from public, anon;

-- my_role() returns only the caller's own role, so authenticated access is
-- intentional and carries no data leak.

# RUNBOOK — Hudoor

## Bootstrap first admin (one-time)
1. Set `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD` env vars in your
   production environment.
2. Run the bootstrap script: `node scripts/bootstrap-admin.mjs` (if added; otherwise
   create the profile manually via Supabase Studio with role=admin, status=approved).
3. Remove the env vars immediately. No default passwords ship in seed or code.

## Deploy
1. Merge to `main`. CI (`.github/workflows/ci.yml`) runs typecheck + tests + build.
2. Promote staging deploy from `main` (Vercel auto-deploys staging environment).
3. Smoke test staging `/api/health` (expect status ok).
4. Promote to production manually in Vercel (production environment variables).

## Rollback
- Vercel: instant rollback to previous deployment.
- Database: revert via Supabase migrations (apply revert migration); for data-loss
  rollback, use Point-in-Time Recovery from Supabase (configure before going live).
- Never drop migrate-down on the way forward; keep ordered migrations (001..006).

## Restore a backup
- Supabase Dashboard → Database → Backups → restore PITR or daily backup.
- Verify by hitting `/api/health` and loading admin dashboard.

## Reset a student device (admin)
- Admin → Students → search → open detail → "Reset device". Audit logged.

## Handle incident
1. Check `/api/health`.
2. Check Sentry (when configured) error rate + logs.
3. Supabase Studio SQL editor for audit_log entries around the activity.
4. Revoke sessions: update profile.is_active=false for affected user; audit logged.
5. Rotate JWT/keys if secret suspected compromised.

## Soft-delete retention
- Trash UI at `/admin/trash`; restore or permanently purge.
- Schedule a daily job to purge soft-deleted records older than policy (90 days).

## Audit log retention
- Append-only. Implement retention policy when table exceeds threshold (export
  to object storage, then prune).

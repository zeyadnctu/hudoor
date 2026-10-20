import { NextResponse } from "next/server";
import { serviceSupabase } from "@/lib/supabase-server";
import { asBool } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Public, non-sensitive auth configuration for the login / OAuth-callback screens.
 *
 * `app_settings` is admin-readable only (RLS: authenticated + my_role()='admin'),
 * so a signed-out browser cannot read `auth_restrict_domain` /
 * `auth_email_domains` directly — this route is the door. It never returns
 * anything but these three keys.
 */
function normalizeDomains(raw: unknown): string[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) list = raw;
  else if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      list = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      list = raw.split(/[\n,;]+/);
    }
  }
  return [...new Set(
    list.map(d => String(d).trim().toLowerCase().replace(/^@/, "")).filter(Boolean)
  )];
}

export async function GET() {
  let restrictDomain = false;
  let emailDomains: string[] = [];
  let googleEnabled = true;

  const svc = serviceSupabase();
  try {
    const { data: rows } = await svc.from("app_settings")
      .select("key,value")
      .eq("scope_type", "global")
      .in("key", ["auth_restrict_domain", "auth_email_domains"]);
    const list = (rows ?? []) as { key: string; value: unknown }[];
    restrictDomain = asBool(list.find(r => r.key === "auth_restrict_domain")?.value, false);
    emailDomains = normalizeDomains(list.find(r => r.key === "auth_email_domains")?.value);
  } catch { /* settings optional — default to open */ }

  try {
    const { data: flag } = await svc.from("feature_flags")
      .select("enabled").eq("key", "google_signin").maybeSingle();
    // Missing row (migration 007 not applied yet) = enabled, so sign-in keeps working.
    if (flag) googleEnabled = flag.enabled === true;
  } catch { /* flag optional */ }

  return NextResponse.json(
    { ok: true, restrictDomain, emailDomains, googleEnabled },
    { headers: { "Cache-Control": "no-store" } }
  );
}

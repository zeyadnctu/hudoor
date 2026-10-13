import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { effective } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** GET scoped rows + effective values + history. POST set. DELETE reset to inherited. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "settings", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const scope = q.get("scope") ?? "";
  const scopeId = q.get("scope_id") ?? "";
  let query = svc.from("app_settings").select("*").order("key");
  if (scope) query = query.eq("scope_type", scope);
  if (scopeId) query = query.eq("scope_id", scopeId);
  const { data: rows, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: all } = await svc.from("app_settings").select("*").limit(2000);
  const keys = [...new Set(((all ?? []) as any[]).map(r => r.key))];
  const eff: Record<string, unknown> = {};
  for (const k of keys) eff[k] = effective((all ?? []) as any[], k, null);
  const { data: hist } = await svc.from("settings_history").select("*").order("created_at", { ascending: false }).limit(50);
  const hids = [...new Set(((hist ?? []) as any[]).map((h: any) => h.changed_by).filter(Boolean))];
  let hemails: Record<string, string> = {};
  if (hids.length) {
    const { data: hp } = await svc.from("profiles").select("id,email").in("id", hids);
    for (const r of (hp ?? []) as any[]) hemails[r.id] = r.email;
  }
  return NextResponse.json({
    rows, effective: eff, keys,
    history: ((hist ?? []) as any[]).map((h: any) => ({ ...h, email: hemails[h.changed_by] ?? null }))
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "settings", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { scope_type, scope_id, key, value } = body;
  if (!["global", "faculty", "department", "course", "session"].includes(scope_type) || !key)
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (scope_type !== "global" && !scope_id) return NextResponse.json({ error: "scope_required" }, { status: 400 });
  const prevQ = svc.from("app_settings").select("value").eq("scope_type", scope_type).eq("key", key);
  const { data: prev } = scope_id
    ? await prevQ.eq("scope_id", scope_id).maybeSingle()
    : await prevQ.is("scope_id", null).maybeSingle();
  const { error } = await svc.from("app_settings").upsert(
    { scope_type, scope_id: scope_id || null, key, value },
    { onConflict: "scope_type,scope_id,key" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await svc.from("settings_history").insert({
    scope_type, scope_id: scope_id || null, key,
    old_value: (prev as any)?.value ?? null, new_value: value,
    changed_by: gate.ctx.profile.id
  });
  await auditDiff(svc, gate.ctx.profile.id, "settings.edit", "app_settings", key, (prev as any)?.value ?? null, value, { scope_type, scope_id }, gate.ctx);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePerm(req, "settings", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const scope_type = q.get("scope_type") ?? "";
  const scope_id = q.get("scope_id") ?? "";
  const key = q.get("key") ?? "";
  if (!scope_type || !key) return NextResponse.json({ error: "invalid" }, { status: 400 });
  let del = svc.from("app_settings").delete().eq("scope_type", scope_type).eq("key", key);
  del = scope_id ? del.eq("scope_id", scope_id) : del.is("scope_id", null);
  const { error } = await del;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "settings.reset", "app_settings", key, null, null, { scope_type, scope_id }, gate.ctx);
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { RESOURCES } from "@/lib/permissions";

export const dynamic = "force-dynamic";

/** GET roles + grants matrix. POST grant|revoke. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "settings", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const [roles, grants] = await Promise.all([
    svc.from("roles").select("*").order("name"),
    svc.from("role_permissions").select("*").order("role")
  ]);
  return NextResponse.json({
    roles: roles.data ?? [],
    grants: (grants.data ?? []) as { role: string; resource: string; action: string }[],
    resources: [...RESOURCES],
    actions: ["view", "create", "edit", "delete", "decide", "export", "manage"]
  });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "settings", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { role, resource, action, allow, label_ar, label_en } = body;
  if (!role || !resource || !action) return NextResponse.json({ error: "invalid" }, { status: 400 });
  if (!RESOURCES.includes(resource) && resource !== "*")
    return NextResponse.json({ error: "bad_resource" }, { status: 400 });
  // custom role rows can be created on the fly (system roles are protected)
  if (allow && label_ar) {
    await svc.from("roles").upsert({ name: role, label_ar, label_en: label_en || label_ar, is_system: false }, { onConflict: "name" });
  }
  if (allow) {
    const { error } = await svc.from("role_permissions").upsert({ role, resource, action }, { onConflict: "role,resource,action" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else {
    const { data: r } = await svc.from("roles").select("is_system").eq("name", role).single();
    if ((r as any)?.is_system && resource === "*" && action === "*")
      return NextResponse.json({ error: "protected" }, { status: 400 });
    await svc.from("role_permissions").delete().eq("role", role).eq("resource", resource).eq("action", action);
  }
  await auditDiff(svc, gate.ctx.profile.id, "roles.matrix", "role_permissions", role, null, { resource, action, allow: !!allow }, {}, gate.ctx);
  return NextResponse.json({ ok: true });
}

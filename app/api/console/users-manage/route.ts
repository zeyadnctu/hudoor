import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

function randomPassword(n = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  for (const b of buf) s += chars[b % chars.length];
  return s;
}

/** GET list with search/role/status filters + detail joins (admin; professors see own roster). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const search = (q.get("search") ?? "").trim().replace(/[%_]/g, "");
  const role = q.get("role") ?? "";
  const status = q.get("status") ?? "";
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(200, Math.max(1, Number(q.get("perPage") ?? 25)));

  let query = svc.from("profiles").select("id,email,role,custom_role,status,is_active,last_login_at,created_at", { count: "exact" });
  if (role) query = query.eq("role", role);
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("email", `%${search}%`);

  if (profile.role !== "admin") {
    // professors/TAs: only students of their own courses
    const [cp, tas] = await Promise.all([
      svc.from("course_professors").select("course_id").eq("professor_id", profile.id),
      svc.from("course_tas").select("course_id").eq("ta_id", profile.id)
    ]);
    const cids = [...((cp.data ?? []) as any[]), ...((tas.data ?? []) as any[])].map(r => r.course_id);
    if (!cids.length) return NextResponse.json({ rows: [], total: 0 });
    const { data: enr } = await svc.from("enrollments").select("student_id").in("course_id", cids);
    const sids = [...new Set(((enr ?? []) as any[]).map(e => e.student_id))];
    if (!sids.length) return NextResponse.json({ rows: [], total: 0 });
    query = query.in("id", sids);
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const ids = (data ?? []).map((p: any) => p.id);
  let det: Record<string, any> = {};
  if (ids.length) {
    const { data: d } = await svc.from("student_details").select("user_id,full_name_ar,full_name_en,university_id,phone,level_year,section_group").in("user_id", ids);
    for (const r of (d ?? []) as any[]) det[r.user_id] = r;
  }
  return NextResponse.json({ rows: (data ?? []).map((p: any) => ({ ...p, details: det[p.id] ?? null })), total: count ?? 0 });
}

/** PATCH edit / role / status / active. DELETE deactivate or purge. POST reset/import. */
export async function PATCH(req: NextRequest) {
  const gate = await requirePerm(req, "users", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { id, email, role, custom_role, status, is_active } = body;
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (role && !["admin", "professor", "student"].includes(role)) return NextResponse.json({ error: "bad_role" }, { status: 400 });
  const { data: before } = await svc.from("profiles").select("*").eq("id", id).single();
  const patch: any = {};
  if (email) patch.email = email;
  if (role) patch.role = role;
  if (custom_role !== undefined) patch.custom_role = custom_role || null;
  if (status) patch.status = status;
  if (is_active !== undefined) patch.is_active = !!is_active;
  const { data, error } = await svc.from("profiles").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "users.edit", "profiles", id, before, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

export async function DELETE(req: NextRequest) {
  const gate = await requirePerm(req, "users", "delete");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json().catch(() => ({}));
  const id = new URL(req.url).searchParams.get("id") ?? body.id;
  const mode = new URL(req.url).searchParams.get("mode") ?? body.mode ?? "deactivate";
  if (!id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
  if (id === gate.ctx.profile.id) return NextResponse.json({ error: "cannot_self" }, { status: 400 });
  if (mode === "delete") {
    const { data: before } = await svc.from("profiles").select("*").eq("id", id).single();
    const { error } = await svc.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "users.purge", "profiles", id, before, null, {}, gate.ctx);
    return NextResponse.json({ ok: true, deleted: id });
  }
  const { error } = await svc.from("profiles").update({ is_active: false, status: "suspended" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, gate.ctx.profile.id, "users.deactivate", "profiles", id, null, { is_active: false }, {}, gate.ctx);
  return NextResponse.json({ ok: true, deactivated: id });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "users", "edit");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const body = await req.json();
  const { action } = body;

  if (action === "reset_password") {
    if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    const pw = randomPassword();
    const { error } = await svc.auth.admin.updateUserById(body.id, { password: pw });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "users.reset_password", "profiles", body.id, null, null, {}, gate.ctx);
    return NextResponse.json({ ok: true, password: pw });
  }
  if (action === "reset_device") {
    if (!body.id) return NextResponse.json({ error: "missing_id" }, { status: 400 });
    await svc.from("devices").delete().eq("student_id", body.id);
    await auditDiff(svc, gate.ctx.profile.id, "users.reset_device", "devices", body.id, null, null, {}, gate.ctx);
    return NextResponse.json({ ok: true });
  }
  if (action === "import_csv") {
    const lines = String(body.csv ?? "").split("\n").map(s => s.trim()).filter(Boolean);
    const created: string[] = [];
    const failed: string[] = [];
    for (const line of lines.slice(0, 500)) {
      const [email, password, role] = line.split(",").map(s => s.trim());
      if (!email || !password) { failed.push(`${line} (bad format)`); continue; }
      const r = (role === "professor" || role === "admin") ? role : "student";
      const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: r } });
      if (error || !data.user) { failed.push(`${email} (${error?.message ?? "error"})`); continue; }
      await svc.from("profiles").upsert({ id: data.user.id, email, role: r, status: "approved" }, { onConflict: "id" });
      created.push(email);
    }
    await auditDiff(svc, gate.ctx.profile.id, "users.import_csv", "profiles", null, null, { created: created.length }, {}, gate.ctx);
    return NextResponse.json({ ok: true, created, failed });
  }
  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

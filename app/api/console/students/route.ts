import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET /api/console/students — all students with attendance stats, program/level/group. */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = new URL(req.url).searchParams;
  const search = (q.get("search") ?? "").trim().replace(/[%_]/g, "");
  const status = q.get("status") ?? "";
  const programId = q.get("program_id") ?? "";
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(200, Math.max(1, Number(q.get("perPage") ?? 25)));

  let query = svc.from("profiles")
    .select("id,email,role,status,is_active,last_login_at,created_at", { count: "exact" })
    .eq("role", "student");
  if (status) query = query.eq("status", status);
  if (search) query = query.ilike("email", `%${search}%`);

  const { data, error, count } = await query.order("created_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (data ?? []).map((p: any) => p.id);
  let details: Record<string, any> = {};
  let attendance: Record<string, { present: number; late: number; absent: number }> = {};
  let programs: Record<string, any> = {};

  if (ids.length) {
    const [detRes, attRes, progRes] = await Promise.all([
      svc.from("student_details").select("user_id,full_name_ar,full_name_en,university_id,phone,level_year,section_group,program_id,level_id,section_id").in("user_id", ids),
      svc.from("attendance_records").select("student_id,status").in("student_id", ids),
      svc.from("programs").select("id,code,name_ar,name_en").eq("archived", false),
    ]);
    for (const r of (detRes.data ?? []) as any[]) details[r.user_id] = r;
    for (const r of (progRes.data ?? []) as any[]) programs[r.id] = r;
    for (const rec of (attRes.data ?? []) as any[]) {
      const e = attendance[rec.student_id] ?? { present: 0, late: 0, absent: 0 };
      if (rec.status === "present") e.present++;
      else if (rec.status === "late") e.late++;
      else e.absent++;
      attendance[rec.student_id] = e;
    }
  }

  const rows = (data ?? []).map((p: any) => {
    const det = details[p.id] ?? {};
    const att = attendance[p.id] ?? { present: 0, late: 0, absent: 0 };
    const total = att.present + att.late + att.absent;
    const rate = total > 0 ? Math.round(((att.present + att.late) / total) * 100) : 0;
    const prog = det.program_id ? programs[det.program_id] : null;
    return {
      ...p,
      details: det,
      attendance: { ...att, total, rate },
      program: prog,
    };
  });

  if (programId) {
    const filtered = rows.filter(r => r.details?.program_id === programId);
    return NextResponse.json({ rows: filtered, total: filtered.length });
  }

  return NextResponse.json({ rows, total: count ?? 0 });
}

/** POST /api/console/students — bulk actions: approve, reject, enroll, deactivate. */
export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "users", "edit");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { action, ids, course_id } = body as { action: string; ids: string[]; course_id?: string };
  if (!ids?.length) return NextResponse.json({ error: "missing_ids" }, { status: 400 });

  if (action === "approve" || action === "reject") {
    const status = action === "approve" ? "approved" : "rejected";
    const { error } = await svc.from("profiles").update({ status, is_active: true }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, profile.id, `students.${action}`, "profiles", ids.join(","), null, { ids, status }, {}, gate.ctx);
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "deactivate") {
    const { error } = await svc.from("profiles").update({ is_active: false, status: "suspended" }).in("id", ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, profile.id, "students.deactivate", "profiles", ids.join(","), null, { ids }, {}, gate.ctx);
    return NextResponse.json({ ok: true, updated: ids.length });
  }

  if (action === "enroll") {
    if (!course_id) return NextResponse.json({ error: "course_required" }, { status: 400 });
    const { data: course } = await svc.from("courses").select("id").eq("id", course_id).single();
    if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { error } = await svc.from("enrollments")
      .upsert(ids.map(sid => ({ course_id, student_id: sid, section: "A" })), { onConflict: "course_id,student_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, profile.id, "students.enroll", "enrollments", course_id, null, { ids }, {}, gate.ctx);
    return NextResponse.json({ ok: true, enrolled: ids.length });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

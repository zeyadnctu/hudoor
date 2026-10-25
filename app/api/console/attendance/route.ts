import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** GET explorer with filters. */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id") ?? "";
  const gate = await requirePerm(req, "attendance", "view", courseId ? { courseId } : {});
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const page = Math.max(1, Number(q.get("page") ?? 1));
  const perPage = Math.min(500, Math.max(1, Number(q.get("perPage") ?? 50)));
  const status = q.get("status") ?? "";
  const from = q.get("from") ?? "";
  const to = q.get("to") ?? "";
  const sessionId = q.get("session_id") ?? "";
  const student = (q.get("student") ?? "").trim().replace(/[%_]/g, "");

  let query = svc.from("attendance_records")
    .select("id,scanned_at,method,status,student_id,session_id,attendance_sessions!inner(course_id,starts_at,courses(code,name_ar))", { count: "exact" });
  if (courseId) query = query.eq("attendance_sessions.course_id", courseId);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scanned_at", from);
  if (to) query = query.lte("scanned_at", to + "T23:59");
  if (sessionId) query = query.eq("session_id", sessionId);
  if (profile.role === "student") query = query.eq("student_id", profile.id);
  else if (student) query = query.eq("student_id", student);

  const { data, error, count } = await query.order("scanned_at", { ascending: false }).range((page - 1) * perPage, page * perPage - 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sids = [...new Set(((data ?? []) as any[]).map(r => r.student_id))];
  let det: Record<string, any> = {};
  if (sids.length) {
    const { data: d } = await svc.from("student_details").select("user_id,full_name_ar,full_name_en,university_id").in("user_id", sids);
    for (const r of (d ?? []) as any[]) det[r.user_id] = r;
  }
  const rows = ((data ?? []) as any[]).map(r => ({
    ...r,
    course_code: r.attendance_sessions?.courses?.code ?? "",
    course_name: r.attendance_sessions?.courses?.name_ar ?? "",
    who: det[r.student_id] ?? null
  }));
  return NextResponse.json({ rows, total: count ?? 0 });
}

/** PATCH single record (reason required) — resolves linked pending dispute. */
export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, status, reason } = body;
  if (!id || !status || !reason || String(reason).trim().length < 3)
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  if (!["present", "late", "absent", "excused"].includes(status))
    return NextResponse.json({ error: "bad_status" }, { status: 400 });
  // need session first for course scoping
  const tmp = serviceSupabase();
  const { data: rec } = await tmp.from("attendance_records").select("session_id").eq("id", id).single();
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const gate = await requirePerm(req, "attendance", "edit", { sessionId: (rec as any).session_id });
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const { data: before } = await svc.from("attendance_records").select("*").eq("id", id).single();
  const { data, error } = await svc.from("attendance_records").update({ status }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await svc.from("disputes").update({ status: "approved", comment: `resolved by manual edit: ${reason}`, decided_by: gate.ctx.profile.id, decided_at: new Date().toISOString() })
    .eq("record_id", id).eq("status", "pending");
  await auditDiff(svc, gate.ctx.profile.id, "attendance.edit", "attendance_records", id, before, data, { reason }, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

/** POST bulk mark/unmark. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { session_id, record_ids, status, reason, mark_all_present } = body;
  if (!reason || String(reason).trim().length < 3)
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  // resolve course scope from session or first record (professors/TAs)
  const tmp = serviceSupabase();
  let scopeCourse: string | null = null;
  if (session_id) {
    const { data: s } = await tmp.from("attendance_sessions").select("course_id").eq("id", session_id).single();
    scopeCourse = (s as any)?.course_id ?? null;
  } else if (record_ids?.length) {
    const { data: r } = await tmp.from("attendance_records").select("session_id").eq("id", record_ids[0]).single();
    if (r) {
      const { data: s } = await tmp.from("attendance_sessions").select("course_id").eq("id", (r as any).session_id).single();
      scopeCourse = (s as any)?.course_id ?? null;
    }
  }
  const gate = await requirePerm(req, "attendance", "edit", scopeCourse ? { courseId: scopeCourse } : session_id ? { sessionId: session_id } : {});
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;

  if (mark_all_present && session_id) {
    const { data: sess } = await svc.from("attendance_sessions").select("course_id").eq("id", session_id).single();
    if (!sess) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const { data: enr } = await svc.from("enrollments").select("student_id").eq("course_id", (sess as any).course_id);
    const { data: have } = await svc.from("attendance_records").select("student_id").eq("session_id", session_id);
    const haveSet = new Set(((have ?? []) as any[]).map(r => r.student_id));
    const missing = ((enr ?? []) as any[]).map(e => e.student_id).filter(id => !haveSet.has(id));
    let n = 0;
    for (const sid of missing) {
      const { error } = await svc.from("attendance_records").insert({ session_id, student_id: sid, method: "manual", status: "present" });
      if (!error) n++;
    }
    await auditDiff(svc, gate.ctx.profile.id, "attendance.bulk_mark", "attendance_sessions", session_id, null, { marked: n }, { reason }, gate.ctx);
    return NextResponse.json({ ok: true, marked: n });
  }
  if (record_ids?.length && status) {
    if (!["present", "late", "absent", "excused"].includes(status)) return NextResponse.json({ error: "bad_status" }, { status: 400 });
    // capture per-row before-state so the audit trail shows a real diff,
    // not just the requested target status
    const { data: beforeRows } = await svc.from("attendance_records")
      .select("id,status,method,student_id,session_id,scanned_at").in("id", record_ids);
    const before = ((beforeRows ?? []) as any[]).map(r => ({
      id: r.id, student_id: r.student_id, session_id: r.session_id,
      status: r.status, method: r.method, scanned_at: r.scanned_at
    }));
    const { error } = await svc.from("attendance_records").update({ status }).in("id", record_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const after = ((beforeRows ?? []) as any[]).map(r => ({ id: r.id, status }));
    await auditDiff(svc, gate.ctx.profile.id, "attendance.bulk_edit", "attendance_records", record_ids.join(","), before, after, { reason, count: record_ids.length }, gate.ctx);
    return NextResponse.json({ ok: true, updated: record_ids.length });
  }
  if (record_ids?.length && body.unmark) {
    // keep the deleted rows in the audit trail (who/what/when/why)
    const { data: beforeRows } = await svc.from("attendance_records")
      .select("id,status,method,student_id,session_id,scanned_at").in("id", record_ids);
    const before = ((beforeRows ?? []) as any[]).map(r => ({
      id: r.id, student_id: r.student_id, session_id: r.session_id,
      status: r.status, method: r.method, scanned_at: r.scanned_at
    }));
    const { error } = await svc.from("attendance_records").delete().in("id", record_ids);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auditDiff(svc, gate.ctx.profile.id, "attendance.bulk_unmark", "attendance_records", record_ids.join(","), before, null, { reason, count: record_ids.length }, gate.ctx);
    return NextResponse.json({ ok: true, removed: record_ids.length });
  }
  return NextResponse.json({ error: "invalid" }, { status: 400 });
}

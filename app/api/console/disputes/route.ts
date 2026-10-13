import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** GET own (student) or all pending (staff, optionally by course). POST contest (student). */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id") ?? "";
  const gate = await requirePerm(req, "disputes", "view", courseId ? { courseId } : {});
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  let query = svc.from("disputes").select("id,record_id,student_id,reason,status,comment,created_at,attendance_records(session_id,status,scanned_at,attendance_sessions(course_id,courses(code,name_ar)))").order("created_at", { ascending: false }).limit(200);
  if (profile.role === "student" && profile.custom_role !== "ta") query = query.eq("student_id", profile.id);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let rows = (data ?? []) as any[];
  if (courseId) rows = rows.filter(r => r.attendance_records?.attendance_sessions?.course_id === courseId);
  return NextResponse.json({ rows });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "disputes", "create");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { record_id, reason } = body;
  if (!record_id || !reason || String(reason).trim().length < 5)
    return NextResponse.json({ error: "reason_required" }, { status: 400 });
  const tmp = serviceSupabase();
  const { data: rec } = await tmp.from("attendance_records").select("student_id").eq("id", record_id).single();
  if (!rec || (rec as any).student_id !== profile.id)
    return NextResponse.json({ error: "not_yours" }, { status: 403 });
  const { data: dup } = await tmp.from("disputes").select("id").eq("record_id", record_id).eq("status", "pending").maybeSingle();
  if (dup) return NextResponse.json({ error: "already_pending" }, { status: 400 });
  const { data, error } = await svc.from("disputes").insert({
    record_id, student_id: profile.id, reason: String(reason).trim()
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, profile.id, "disputes.create", "disputes", data.id, null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

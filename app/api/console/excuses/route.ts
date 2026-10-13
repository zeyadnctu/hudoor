import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** GET own (student) or course-filtered (staff). POST create (student). */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const courseId = q.get("course_id") ?? "";
  const gate = await requirePerm(req, "excuses", "view", courseId ? { courseId } : {});
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  let query = svc.from("excuse_requests").select("id,student_id,course_id,session_id,reason,status,comment,decided_at,created_at,courses(code,name_ar)").order("created_at", { ascending: false }).limit(200);
  if (profile.role === "student" && profile.custom_role !== "ta") query = query.eq("student_id", profile.id);
  if (courseId) query = query.eq("course_id", courseId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data });
}

export async function POST(req: NextRequest) {
  const gate = await requirePerm(req, "excuses", "create");
  if (!gate.ok) return gate.res;
  const { svc, profile } = gate.ctx;
  const body = await req.json();
  const { course_id, session_id, reason } = body;
  if (!reason || String(reason).trim().length < 5) return NextResponse.json({ error: "reason_required" }, { status: 400 });
  const { data, error } = await svc.from("excuse_requests").insert({
    student_id: profile.id, course_id: course_id || null, session_id: session_id || null,
    reason: String(reason).trim()
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  await auditDiff(svc, profile.id, "excuses.create", "excuse_requests", data.id, null, data, {}, gate.ctx);
  return NextResponse.json({ ok: true, row: data });
}

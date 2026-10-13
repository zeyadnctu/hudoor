import { NextRequest, NextResponse } from "next/server";
import { requirePerm, auditDiff } from "@/lib/guard";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Decide excuses, disputes, service requests. Applies side effects. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { kind, id, decision, comment } = body as {
    kind: "excuse" | "dispute" | "service"; id: string;
    decision: "approved" | "denied"; comment?: string;
  };
  if (!kind || !id || !["approved", "denied"].includes(decision))
    return NextResponse.json({ error: "invalid" }, { status: 400 });

  const table = kind === "excuse" ? "excuse_requests" : kind === "dispute" ? "disputes" : "service_requests";
  const resource = kind === "service" ? "requests" : kind === "excuse" ? "excuses" : "disputes";

  // load row first to resolve course scope
  const tmp = serviceSupabase();
  const { data: row } = await tmp.from(table).select("*").eq("id", id).single();
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let courseId: string | null = null;
  if (kind === "excuse") courseId = (row as any).course_id;
  if (kind === "dispute") {
    const { data: rec } = await tmp.from("attendance_records").select("session_id").eq("id", (row as any).record_id).single();
    if (rec) {
      const { data: s } = await tmp.from("attendance_sessions").select("course_id").eq("id", (rec as any).session_id).single();
      courseId = (s as any)?.course_id ?? null;
    }
  }
  const gate = await requirePerm(req, resource, "decide", courseId ? { courseId } : {});
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const now = new Date().toISOString();

  const { error } = await svc.from(table).update({
    status: decision, comment: comment ?? null,
    decided_by: gate.ctx.profile.id, decided_at: now
  }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  // side effects
  if (kind === "excuse" && decision === "approved" && (row as any).session_id) {
    await svc.from("attendance_records").upsert({
      session_id: (row as any).session_id,
      student_id: (row as any).student_id,
      method: "manual", status: "excused"
    }, { onConflict: "session_id,student_id" });
  }
  if (kind === "dispute" && decision === "approved") {
    await svc.from("attendance_records").update({ status: "present" }).eq("id", (row as any).record_id);
  }
  if (kind === "service" && decision === "approved" && (row as any).type === "device_reset" && (row as any).student_id) {
    await svc.from("devices").delete().eq("student_id", (row as any).student_id);
  }
  await auditDiff(svc, gate.ctx.profile.id, `${resource}.decide`, table, id, { status: "pending" }, { status: decision }, { comment: comment ?? "" }, gate.ctx);
  return NextResponse.json({ ok: true });
}

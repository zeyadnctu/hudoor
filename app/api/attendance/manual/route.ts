import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { manualMarkSchema } from "@/lib/validators";
import { audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Professor manual mark / override (reason required)
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const p = manualMarkSchema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const svc = serviceSupabase();
  const { data: s } = await svc.from("attendance_sessions").select("professor_id,course_id").eq("id", p.data.session_id).single();
  const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!s || (prof?.role !== "admin" && s.professor_id !== user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { error } = await svc.from("attendance_records").upsert(
    { session_id: p.data.session_id, student_id: p.data.student_id, method: "manual", status: p.data.status },
    { onConflict: "session_id,student_id" }
  );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(svc, user.id, "manual_mark", "attendance_record", p.data.session_id, { student: p.data.student_id, reason: p.data.reason, status: p.data.status });
  return NextResponse.json({ ok: true });
}

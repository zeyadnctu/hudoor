import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase-server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/courses — all courses in the student's program.
 * Returns: { rows: [...courses] } with enrollment status.
 */
export async function GET(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();

  const { data: det } = await svc.from("student_details").select("program_id").eq("user_id", user.id).maybeSingle();
  if (!det?.program_id) return NextResponse.json({ rows: [] });

  const { data: courses, error } = await svc.from("courses")
    .select("id,code,name_ar,name_en,credit_hours,section,program_id")
    .eq("program_id", det.program_id)
    .order("code")
    .limit(200);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Mark which ones the student is already enrolled in
  const cids = ((courses ?? []) as any[]).map(c => c.id);
  const { data: enr } = await svc.from("enrollments").select("course_id")
    .eq("student_id", user.id).in("course_id", cids.length ? cids : ["00000000-0000-0000-0000-000000000000"]);
  const enrolledIds = new Set(((enr ?? []) as any[]).map(e => e.course_id));

  const rows = ((courses ?? []) as any[]).map(c => ({ ...c, enrolled: enrolledIds.has(c.id) }));
  return NextResponse.json({ rows });
}

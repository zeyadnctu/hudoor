import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase-server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * POST /api/student/enroll — student self-enrolls in a course from their program.
 * Body: { course_id }
 * Only works for courses in the student's own program.
 */
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();

  const { data: prof } = await svc.from("profiles").select("role,status").eq("id", user.id).single();
  if (!prof || prof.role !== "student" || prof.status !== "approved")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const courseId = body.course_id;
  if (!courseId) return NextResponse.json({ error: "course_required" }, { status: 400 });

  // Get student's program
  const { data: det } = await svc.from("student_details").select("program_id").eq("user_id", user.id).maybeSingle();
  if (!det?.program_id) return NextResponse.json({ error: "no_program" }, { status: 404 });

  // Verify course belongs to student's program
  const { data: course } = await svc.from("courses").select("id,program_id").eq("id", courseId).single();
  if (!course) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if ((course as any).program_id !== det.program_id)
    return NextResponse.json({ error: "not_your_program" }, { status: 403 });

  // Already enrolled?
  const { data: existing } = await svc.from("enrollments").select("id")
    .eq("course_id", courseId).eq("student_id", user.id).maybeSingle();
  if (existing) return NextResponse.json({ ok: true, already: true });

  const { error } = await svc.from("enrollments").insert({
    course_id: courseId,
    student_id: user.id,
    section: "A",
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

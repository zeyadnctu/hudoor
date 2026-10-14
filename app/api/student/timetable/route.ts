import { NextRequest, NextResponse } from "next/server";
import { serverSupabase } from "@/lib/supabase-server";
import { serviceSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/timetable?semester_id=
 * Returns timetable slots for the student's program/level/group.
 * Includes course code/name, instructor name, room, day, start/end times.
 */
export async function GET(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });

  const svc = serviceSupabase();

  // Get student details
  const { data: det } = await svc.from("student_details")
    .select("program_id, level_id, section_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!det) return NextResponse.json({ error: "no_details" }, { status: 404 });

  const q = new URL(req.url).searchParams;
  const semesterId = q.get("semester_id") ?? "";

  let query = svc.from("timetable_slots")
    .select("*,courses(code,name_ar,name_en),rooms(name_ar,name_en)")
    .is("deleted_at", null)
    .eq("program_id", det.program_id)
    .order("day")
    .order("starts_at")
    .limit(500);

  if (semesterId) query = query.eq("semester_id", semesterId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Filter by level + group when set (slots may target specific group)
  const rows = ((data ?? []) as any[]).filter(s => {
    if (det.level_id && s.level_id && s.level_id !== det.level_id) return false;
    if (det.section_id && s.group_id && s.group_id !== det.section_id) return false;
    return true;
  });

  return NextResponse.json({ rows });
}

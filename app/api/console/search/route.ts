import { NextRequest, NextResponse } from "next/server";
import { requirePerm } from "@/lib/guard";

export const dynamic = "force-dynamic";

/** Global search across users, courses, rooms, sessions (admin + staff). */
export async function GET(req: NextRequest) {
  const gate = await requirePerm(req, "users", "view");
  if (!gate.ok) return gate.res;
  const { svc } = gate.ctx;
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().replace(/[%_]/g, "");
  if (q.length < 2) return NextResponse.json({ users: [], courses: [], rooms: [], sessions: [] });
  const like = `%${q}%`;
  const [users, courses, rooms, sessions] = await Promise.all([
    svc.from("profiles").select("id,email,role,status").or(`email.ilike.${like}`).limit(8),
    svc.from("courses").select("id,code,name_ar,name_en").or(`code.ilike.${like},name_ar.ilike.${like},name_en.ilike.${like}`).limit(8),
    svc.from("rooms").select("id,name_ar,name_en,building_id").or(`name_ar.ilike.${like},name_en.ilike.${like}`).limit(8),
    svc.from("attendance_sessions").select("id,status,starts_at,course_id,courses(code)").order("starts_at", { ascending: false }).limit(8)
  ]);
  let studentHits: any[] = [];
  try {
    const { data } = await svc.from("student_details").select("user_id,full_name_ar,full_name_en,university_id")
      .or(`full_name_ar.ilike.${like},full_name_en.ilike.${like},university_id.ilike.${like}`).limit(8);
    studentHits = data ?? [];
  } catch {}
  return NextResponse.json({
    users: [...((users.data ?? []) as any[]), ...studentHits.map((s: any) => ({ id: s.user_id, email: s.university_id, role: "student", status: "", name: s.full_name_ar }))],
    courses: courses.data ?? [],
    rooms: rooms.data ?? [],
    sessions: (sessions.data ?? []) as any[]
  });
}

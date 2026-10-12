import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { sessionCreateSchema, manualMarkSchema } from "@/lib/validators";
import { randomBytes } from "crypto";
import { audit } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/sessions — start a session
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const svc = serviceSupabase();
  const { data: prof } = await svc.from("profiles").select("role,status").eq("id", user.id).single();
  if (!prof || !["professor", "admin"].includes(prof.role) || prof.status !== "approved")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const p = sessionCreateSchema.safeParse(body);
  if (!p.success) return NextResponse.json({ error: "invalid", details: p.error.flatten() }, { status: 400 });
  // professor must own course (unless admin)
  if (prof.role !== "admin") {
    const { data: cp } = await svc.from("course_professors").select("course_id").eq("course_id", p.data.course_id).eq("professor_id", user.id).maybeSingle();
    const { data: own } = await svc.from("attendance_sessions").select("id").limit(0); // noop
    if (!cp) {
      // also allow if no cp row but professor created course? enforce cp
      return NextResponse.json({ error: "not_your_course" }, { status: 403 });
    }
  }
  const ends = new Date(Date.now() + p.data.duration_min * 60_000).toISOString();
  const secret = randomBytes(32).toString("hex");
  const { data, error } = await svc.from("attendance_sessions").insert({
    course_id: p.data.course_id, professor_id: user.id, ends_at: ends, secret,
    geofence_lat: p.data.geofence_lat ?? null, geofence_lng: p.data.geofence_lng ?? null,
    geofence_radius_m: p.data.geofence_radius_m, geofence_enabled: p.data.geofence_enabled, status: "active"
  }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await audit(svc, user.id, "session_start", "attendance_session", data.id, { course: p.data.course_id });
  return NextResponse.json(data);
}

// PATCH /api/sessions?id= — end session | POST manual mark lives in /api/attendance/manual
export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const svc = serviceSupabase();
  const { data: s } = await svc.from("attendance_sessions").select("professor_id").eq("id", id).single();
  const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!s || (prof?.role !== "admin" && s.professor_id !== user.id)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await svc.from("attendance_sessions").update({ status: "ended" }).eq("id", id);
  await audit(svc, user.id, "session_end", "attendance_session", id, {});
  return NextResponse.json({ ok: true });
}

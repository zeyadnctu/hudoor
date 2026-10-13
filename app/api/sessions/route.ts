import { NextRequest, NextResponse } from "next/server";
import { serverSupabase, serviceSupabase } from "@/lib/supabase-server";
import { sessionCreateSchema } from "@/lib/validators";
import { randomBytes } from "crypto";
import { audit } from "@/lib/auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

const scheduleSchema = sessionCreateSchema.extend({
  course_id: sessionCreateSchema.shape.course_id,
  starts_at: z.string().optional(),
  room_id: z.string().uuid().nullable().optional(),
  late_after_min: z.number().int().min(0).max(180).nullable().optional(),
  qr_interval_sec: z.number().int().min(5).max(60).nullable().optional(),
  recurring: z.boolean().optional(),
  recurring_until: z.string().optional()
});

async function inBlock(svc: any, courseId: string, dateISO: string): Promise<boolean> {
  const { data: course } = await svc.from("courses").select("semester_id").eq("id", courseId).single();
  if (!(course as any)?.semester_id) return false;
  const { data } = await svc.from("academic_blocks").select("id")
    .eq("semester_id", (course as any).semester_id)
    .lte("starts_at", dateISO).gte("ends_at", dateISO).limit(1);
  return !!((data ?? []) as any[]).length;
}

// POST /api/sessions — start now, schedule, or create weekly recurring series
export async function POST(req: NextRequest) {
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const uid = user.id;
  const svc = serviceSupabase();
  const { data: prof } = await svc.from("profiles").select("role,status,custom_role").eq("id", uid).single();
  if (!prof || !["professor", "admin"].includes(prof.role) || prof.status !== "approved")
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const parsed = scheduleSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid", details: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  if (prof.role !== "admin") {
    const { data: cp } = await svc.from("course_professors").select("course_id").eq("course_id", d.course_id).eq("professor_id", uid).maybeSingle();
    if (!cp) return NextResponse.json({ error: "not_your_course" }, { status: 403 });
  }
  const startsAt = d.starts_at ? new Date(d.starts_at) : new Date();
  if (isNaN(startsAt.getTime())) return NextResponse.json({ error: "bad_time" }, { status: 400 });
  if (await inBlock(svc, d.course_id, startsAt.toISOString().slice(0, 10)))
    return NextResponse.json({ error: "blocked_day" }, { status: 400 });

  async function makeOne(start: Date, src: string) {
    const ends = new Date(start.getTime() + d.duration_min * 60_000);
    const secret = randomBytes(32).toString("hex");
    const { data, error } = await svc.from("attendance_sessions").insert({
      course_id: d.course_id, professor_id: uid,
      starts_at: start.toISOString(), ends_at: ends.toISOString(), secret,
      geofence_lat: d.geofence_lat ?? null, geofence_lng: d.geofence_lng ?? null,
      geofence_radius_m: d.geofence_radius_m, geofence_enabled: d.geofence_enabled,
      status: d.starts_at ? "scheduled" : "active",
      room_id: d.room_id ?? null,
      late_after_min: d.late_after_min ?? null,
      qr_interval_sec: d.qr_interval_sec ?? null,
      source: src as any
    }).select().single();
    if (error) throw new Error(error.message);
    return data;
  }

  try {
    if (d.recurring) {
      const until = d.recurring_until ? new Date(d.recurring_until) : new Date(startsAt.getTime() + 90 * 86400000);
      let created = 0;
      const first = await makeOne(startsAt, "recurring");
      created++;
      for (let dd = new Date(startsAt.getTime() + 7 * 86400000); dd <= until; dd = new Date(dd.getTime() + 7 * 86400000)) {
        if (await inBlock(svc, d.course_id, dd.toISOString().slice(0, 10))) continue;
        await makeOne(dd, "recurring");
        created++;
        if (created >= 30) break;
      }
      await audit(svc, uid, "session_recurring", "attendance_session", first.id, { course: d.course_id, count: created });
      return NextResponse.json({ ...first, series: created });
    }
    const data = await makeOne(startsAt, "manual");
    await audit(svc, uid, d.starts_at ? "session_schedule" : "session_start", "attendance_session", data.id, { course: d.course_id });
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// PATCH /api/sessions?id=&op=end|pause|resume|extend|duplicate (default end)
export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const op = url.searchParams.get("op") ?? "end";
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
  const sb = serverSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauth" }, { status: 401 });
  const svc = serviceSupabase();
  const { data: s } = await svc.from("attendance_sessions").select("*").eq("id", id).single();
  const { data: prof } = await svc.from("profiles").select("role").eq("id", user.id).single();
  if (!s || (prof?.role !== "admin" && (s as any).professor_id !== user.id))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (op === "end") {
    await svc.from("attendance_sessions").update({ status: "ended" }).eq("id", id);
  } else if (op === "pause") {
    if ((s as any).status !== "active") return NextResponse.json({ error: "bad_state" }, { status: 400 });
    await svc.from("attendance_sessions").update({ status: "paused", paused_at: new Date().toISOString() }).eq("id", id);
  } else if (op === "resume") {
    if ((s as any).status !== "paused") return NextResponse.json({ error: "bad_state" }, { status: 400 });
    await svc.from("attendance_sessions").update({ status: "active", paused_at: null }).eq("id", id);
  } else if (op === "extend") {
    const mins = Math.min(120, Math.max(5, Number(url.searchParams.get("mins") ?? 15)));
    const ends = new Date(new Date((s as any).ends_at).getTime() + mins * 60000).toISOString();
    await svc.from("attendance_sessions").update({
      ends_at: ends, extended_min: ((s as any).extended_min ?? 0) + mins, status: "active"
    }).eq("id", id);
  } else if (op === "duplicate") {
    const secret = randomBytes(32).toString("hex");
    const dur = new Date((s as any).ends_at).getTime() - new Date((s as any).starts_at).getTime();
    const start = new Date();
    const { data: dup, error } = await svc.from("attendance_sessions").insert({
      course_id: (s as any).course_id, professor_id: user.id,
      starts_at: start.toISOString(), ends_at: new Date(start.getTime() + dur).toISOString(), secret,
      geofence_lat: (s as any).geofence_lat, geofence_lng: (s as any).geofence_lng,
      geofence_radius_m: (s as any).geofence_radius_m, geofence_enabled: (s as any).geofence_enabled,
      status: "active", room_id: (s as any).room_id ?? null,
      late_after_min: (s as any).late_after_min ?? null,
      qr_interval_sec: (s as any).qr_interval_sec ?? null, source: "manual"
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await audit(svc, user.id, "session_duplicate", "attendance_session", dup.id, { from: id });
    return NextResponse.json(dup);
  } else {
    return NextResponse.json({ error: "bad_op" }, { status: 400 });
  }
  await audit(svc, user.id, `session_${op}`, "attendance_session", id, {});
  return NextResponse.json({ ok: true });
}
